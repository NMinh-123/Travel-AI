import type { EscalationReason } from "@prisma/client";
import { AiUnavailableError } from "../gemini";
import { classify } from "./nlu";
import { mergeSlots, missingSlots, questionFor } from "./dialog";
import { inspect } from "./guardrail";
import { runBudget } from "./specialists/budget";
import { runDiscovery } from "./specialists/discovery";
import { runItinerary } from "./specialists/itinerary";
import { runKnowledge } from "./specialists/knowledge";
import { runSupport } from "./specialists/support";
import { MIN_INTENT_CONFIDENCE, type AgentContext, type AgentResult, type Intent, type NluResult, type Slots, type TurnTrace } from "./types";
import { findOutOfAreaPlaces, findPlacesInText, resolvePlaceNames } from "../rag/places";

/**
 * Tác tử điều phối (SRS Hình 9.2): căn cứ ý định đã chuẩn hoá để chọn tác tử chuyên biệt phù hợp,
 * gộp kết quả và kiểm soát chi phí, độ trễ của mỗi lượt hội thoại.
 *
 * Đây là nơi ba trigger chuyển tiếp BẮT BUỘC của SRS Mục 10.6 được hiện thực — ngoài khiếu nại,
 * hệ thống buộc chuyển tiếp khi: độ tin cậy nhận diện ý định thấp hơn ngưỡng, câu hỏi nằm ngoài
 * phạm vi kho tri thức, và khách yêu cầu gặp người thật.
 */

export interface TurnInput {
  sessionId: string;
  userId: string | null;
  message: string;
  slots: Slots;
  history: { role: "user" | "assistant"; content: string }[];
}

export interface TurnOutput {
  result: AgentResult;
  nlu: NluResult;
  agent: Intent;
  slots: Slots;
  trace: TurnTrace;
}

function runAgent(intent: Intent, context: AgentContext): Promise<AgentResult> {
  switch (intent) {
    case "discovery":
      return runDiscovery(context);
    case "itinerary":
      return runItinerary(context);
    case "budget":
      return runBudget(context);
    case "knowledge":
      return runKnowledge(context);
    case "support":
      return runSupport(context, "COMPLAINT");
  }
}

/** Hỏi bổ sung slot còn thiếu — vòng lặp ở đầu SRS Hình 10.4 bước 4-6. */
function askForSlot(intent: Intent, slot: keyof Slots): AgentResult {
  return {
    reply: questionFor(slot),
    suggestions:
      intent === "itinerary"
        ? ["3 ngày 2 đêm", "4 ngày 3 đêm", "5 ngày 4 đêm"]
        : ["3 ngày", "4 ngày", "5 ngày"],
    grounded: true,
    citedDocIds: [],
    calls: [],
  };
}

export async function handleTurn(input: TurnInput): Promise<TurnOutput> {
  const startedAt = Date.now();

  const { result: nlu, metrics: nluMetrics } = await classify(input.message, input.history);
  const nluMs = Date.now() - startedAt;

  // Dialog Manager: gộp thực thể vừa trích xuất vào trạng thái phiên TRƯỚC khi định tuyến.
  // Đây là cơ chế cho phép khách bổ sung thông tin dần qua nhiều lượt (SRS Mục 11.1) — thiếu bước
  // này thì mỗi lượt lại bắt đầu từ con số không và vòng lặp hỏi bổ sung ở Hình 10.4 không đóng.
  const slots = mergeSlots(input.slots, nlu.entities);

  /**
   * Chiều địa danh. Hai nguồn được gộp lại vì chúng hỏng theo hai kiểu khác nhau: NLU hiểu được
   * cách diễn đạt vòng vo nhưng là một lượt gọi model nên có thể bỏ sót, còn quét chuỗi thì luôn
   * chạy và chắc chắn với tên viết rời như "mã pí lèng".
   *
   * `unknown` là tín hiệu quan trọng nhất ở đây: khách nêu đích danh một địa danh mà từ điển
   * không có nghĩa là câu hỏi về địa bàn khác. Đó chính là nhóm mà ngưỡng liên quan không chặn
   * nổi — "chợ phiên Bắc Hà họp ngày nào" chấm điểm cao hơn phần lớn câu hỏi hợp lệ vì cả vector
   * lẫn từ khoá đều bỏ qua đúng cái tên. Ở đây thì nó chỉ là một phép tra bảng.
   */
  const resolved = await resolvePlaceNames(nlu.entities.destinations ?? []);
  const scanned = await findPlacesInText(input.message);
  const placeSlugs = [...new Set([...resolved.slugs, ...scanned])];
  const outOfArea = findOutOfAreaPlaces(input.message);

  const context: AgentContext = {
    sessionId: input.sessionId,
    userId: input.userId,
    message: input.message,
    slots,
    nlu,
    history: input.history,
    placeSlugs,
  };

  const agentStartedAt = Date.now();
  let agent: Intent = nlu.intent;
  let result: AgentResult;

  /**
   * Địa danh ngoài địa bàn: khách nêu tên nơi nào đó và KHÔNG nơi nào trong số đó nằm trong từ
   * điển. Điều kiện phải là "không nơi nào", không phải "có nơi nào": câu "đi từ Hà Nội lên Đồng
   * Văn mất bao lâu" nhắc Hà Nội — nằm ngoài địa bàn — nhưng vẫn là câu hỏi hợp lệ vì Đồng Văn
   * nhận diện được.
   *
   * Hai nguồn tín hiệu: `resolved.unknown` là tên NLU trích ra mà từ điển không có, còn `outOfArea`
   * là danh sách chặn tường minh. Cần cả hai vì nguồn thứ nhất phụ thuộc vào một lượt gọi model —
   * NLU bỏ sót hoặc chưa cấu hình được API key thì chỉ còn nguồn thứ hai đứng lại.
   */
  const offTopicPlace =
    (resolved.unknown.length > 0 || outOfArea.length > 0) && placeSlugs.length === 0;

  // Trigger 1 và 3 của Mục 10.6: khách yêu cầu gặp người thật, hoặc ý định không đủ tin cậy.
  const forcedReason: EscalationReason | null = nlu.wantsHuman
    ? "USER_REQUEST"
    : nlu.confidence < MIN_INTENT_CONFIDENCE
      ? "LOW_CONFIDENCE"
      : offTopicPlace
        ? "OUT_OF_SCOPE"
        : null;

  if (forcedReason) {
    agent = "support";
    result = await runSupport(context, forcedReason);
  } else {
    const missing = missingSlots(agent, slots);
    if (missing.length > 0) {
      result = askForSlot(agent, missing[0]);
    } else {
      try {
        result = await runAgent(agent, context);
      } catch (error) {
        // Thiếu API key là lỗi cấu hình, phải nổi lên thành 503 chứ không nuốt thành escalation.
        if (error instanceof AiUnavailableError) throw error;
        console.error(`Tác tử ${agent} lỗi:`, error);
        agent = "support";
        result = await runSupport(context, "OUT_OF_SCOPE");
      }

      // Trigger 2: guardrail chặn thì chuyển tiếp thay vì trả một câu trả lời không có căn cứ.
      const blocked = inspect(result, agent);
      if (blocked) {
        const reason: EscalationReason = blocked === "ungrounded" ? "OUT_OF_SCOPE" : "COMPLAINT";
        const fallback = await runSupport(context, reason);
        agent = "support";
        result = { ...fallback, calls: [...result.calls, ...fallback.calls], retrieval: result.retrieval };
      }
    }
  }

  const agentMs = Date.now() - agentStartedAt;

  return {
    result,
    nlu,
    agent,
    slots: result.slotUpdates ? { ...slots, ...result.slotUpdates } : slots,
    trace: {
      intent: nlu.intent,
      confidence: nlu.confidence,
      agent,
      grounded: result.grounded,
      citedDocIds: result.citedDocIds,
      escalated: Boolean(result.escalation),
      totalMs: Date.now() - startedAt,
      nluMs,
      agentMs,
      calls: [nluMetrics, ...result.calls],
      retrieval: result.retrieval,
    },
  };
}
