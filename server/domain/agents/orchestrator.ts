import type { EscalationReason } from "@prisma/client";
import { AiBudgetExceededError } from "@server/infra/aiBudget";
import { AiUnavailableError } from "@server/infra/gemini";
import { classify } from "./nlu";
import { TraceCollector } from "./trace";
import { resolve } from "@server/domain/temporal/router";
import { mergeTemporalPhrases } from "@server/domain/temporal/phrases";
import { mergeSlots, missingSlots, questionFor } from "./dialog";
import { inspect } from "./guardrail";
import { classifyFailure, type FailureClass } from "./failure";
import { runBudget } from "./specialists/budget";
import { runDiscovery } from "./specialists/discovery";
import { runItinerary } from "./specialists/itinerary";
import { runKnowledge } from "./specialists/knowledge";
import { runSupport } from "./specialists/support";
import { MIN_INTENT_CONFIDENCE, type AgentContext, type AgentResult, type Intent, type NluResult, type Slots, type TurnTrace } from "./types";
import { findOutOfAreaPlaces, findPlacesInText, resolvePlaceNames } from "@server/domain/rag/places";
import { rewriteQuery } from "@server/domain/rag/rewrite";

/**
 * Tác tử điều phối (SRS Hình 9.2): căn cứ ý định đã chuẩn hoá để chọn tác tử chuyên biệt phù hợp,
 * gộp kết quả và kiểm soát chi phí, độ trễ của mỗi lượt hội thoại.
 *
 * Đây là nơi ba trigger chuyển tiếp BẮT BUỘC của SRS Mục 10.6 được hiện thực — ngoài khiếu nại,
 * hệ thống buộc chuyển tiếp khi: độ tin cậy nhận diện ý định thấp hơn ngưỡng, câu hỏi nằm ngoài
 * phạm vi kho tri thức, và khách yêu cầu gặp người thật.
 */

export interface TurnInput {
  now?: Date;
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
    // Hỏi bổ sung slot không phải một câu trả lời có nội dung, nhưng cũng không phải câu không
    // có căn cứ: nó là bước tiến của hội thoại. Đánh dấu `grounded` để guardrail không chặn.
    grounding: "grounded",
    evidence: [],
    retrievedDocIds: [],
    citedDocIds: [],
    calls: [],
  };
}

export interface TurnDeps {
  classify: typeof classify;
  resolvePlaceNames: typeof resolvePlaceNames;
  findPlacesInText: typeof findPlacesInText;
  runAgent: typeof runAgent;
  runSupport: typeof runSupport;
}

export const PRODUCTION_DEPS: TurnDeps = {
  classify, resolvePlaceNames, findPlacesInText, runAgent, runSupport,
};

export async function handleTurn(input: TurnInput, deps: TurnDeps = PRODUCTION_DEPS): Promise<TurnOutput> {
  const startedAt = Date.now();
  const path = new TraceCollector();
  const recordAgent = (name: Intent, value: AgentResult): void => {
    path.push({ node: "agent", outcome: "ok", detail: name });
    for (const tool of value.toolCalls ?? []) {
      path.push({ node: "tool", outcome: tool.outcome, detail: tool.tool, ...(tool.code ? { reason: tool.code } : {}) });
    }
  };

  const { result: nlu, metrics: nluMetrics } = await deps.classify(input.message, input.history);
  const nluMs = Date.now() - startedAt;
  path.push({ node: "nlu", outcome: "ok", detail: `${nlu.intent} conf=${nlu.confidence}`, ms: nluMs });

  // Dialog Manager: gộp thực thể vừa trích xuất vào trạng thái phiên TRƯỚC khi định tuyến.
  // Đây là cơ chế cho phép khách bổ sung thông tin dần qua nhiều lượt (SRS Mục 11.1) — thiếu bước
  // này thì mỗi lượt lại bắt đầu từ con số không và vòng lặp hỏi bổ sung ở Hình 10.4 không đóng.
  // Giữ thứ tự trong câu, kể cả khi mô hình bỏ sót cụm đầu hoặc trả danh sách đảo thứ tự.
  const temporalPhrases = mergeTemporalPhrases(nlu.temporalPhrases, input.message);
  const fresh = resolve(temporalPhrases, input.now ?? new Date());
  path.push({ node: "temporal", outcome: fresh.temporalType === "none" ? "none" : "resolved", detail: fresh.temporalType });
  const entities = fresh.temporalType === "none" ? nlu.entities : { ...nlu.entities, temporal: fresh };
  const slots = mergeSlots(input.slots, entities);

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
  /**
   * Chuẩn hoá câu TRƯỚC khi quét địa danh.
   *
   * Thứ tự này quyết định: "Mã Pì Lèng" và "ma pi leng" phải thành "Mã Pí Lèng" trước, nếu không
   * bộ quét đi qua chúng mà không nhận ra gì và cả lượt mất bộ lọc địa danh.
   */
  const normalized = rewriteQuery({ message: input.message });

  const resolved = await deps.resolvePlaceNames(nlu.entities.destinations ?? []);
  const scanned = await deps.findPlacesInText(normalized.query);
  let placeSlugs = [...new Set([...resolved.slugs, ...scanned])];
  const outOfArea = findOutOfAreaPlaces(normalized.query);

  /**
   * ĐẠI TỪ THAY CHO ĐỊA DANH: "ở đó ăn sáng gì", "chỗ này có đắt không".
   *
   * Hai nguồn phân giải phía trên đều chỉ đọc CÂU HIỆN TẠI, nên một lượt chỉ dùng đại từ sẽ ra
   * danh sách địa danh rỗng — và truy xuất khi đó mất hẳn bộ lọc địa danh, trả về đoạn của bất kỳ
   * nơi nào trong tỉnh. Khách hỏi tiếp về phố cổ Đồng Văn và nhận câu trả lời về Mèo Vạc.
   *
   * Địa danh được mang sang từ `slots.destinations` — thứ Dialog Manager đã gom qua các lượt —
   * chứ không đọc lại lịch sử: đọc lại lịch sử là làm lần thứ hai cùng một việc bằng một cách
   * kém chính xác hơn.
   *
   * Chỉ mang khi lượt này KHÔNG tự nêu nơi nào. Khách vừa nhắc tên mới thì tên mới thắng, kể cả
   * khi câu vẫn còn một đại từ ở chỗ khác.
   */
  const rewrite = rewriteQuery({
    message: normalized.query,
    carriedPlaces: placeSlugs.length === 0 ? slots.destinations ?? [] : [],
  });
  if (rewrite.resolvedPlaces.length > 0) {
    const carried = await deps.resolvePlaceNames(rewrite.resolvedPlaces);
    placeSlugs = carried.slugs;
  }
  const applied = [...new Set([...normalized.applied, ...rewrite.applied])];
  /**
   * Chỉ ghi nút khi THỰC SỰ có phép nào áp dụng.
   *
   * Phần lớn lượt không cần viết lại gì, nên ghi một nút "none" vào mọi trace sẽ làm loãng đúng
   * thứ mà trace sinh ra để đọc. Có nút nghĩa là câu đi tới truy xuất KHÁC câu khách gõ — và đó
   * là điều luôn đáng biết khi truy xuất trả về thứ không ai ngờ.
   */
  if (applied.length) {
    path.push({
      node: "rewrite",
      outcome: "applied",
      detail: applied.join(","),
      ...(rewrite.resolvedPlaces.length ? { reason: rewrite.resolvedPlaces.join(",") } : {}),
    });
  }

  const context: AgentContext = {
    sessionId: input.sessionId,
    userId: input.userId,
    message: input.message,
    /**
     * Câu dùng để TRUY XUẤT, tách khỏi câu khách viết.
     *
     * Hai thứ này phải đi riêng: lời nhắc phải thấy đúng chữ khách gõ, vì một câu bị viết lại rồi
     * đưa cho model sẽ khiến câu trả lời nói về thứ khách không hỏi. Còn truy xuất thì cần bản đã
     * chuẩn hoá — tên viết sai đã sửa, đại từ đã gắn kèm địa danh.
     */
    retrievalQuery: rewrite.query,
    slots,
    nlu,
    history: input.history,
    placeSlugs,
  };

  const agentStartedAt = Date.now();
  let agent: Intent = nlu.intent;
  let result: AgentResult;
  /** Nhóm nguyên nhân hỏng của lượt này. Xem `server/domain/agents/failure.ts`. */
  let failure: FailureClass = "none";

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
  path.push({
    node: "place_resolve", outcome: offTopicPlace ? "out_of_area" : placeSlugs.length ? "resolved" : "empty",
    detail: placeSlugs.join(","),
    ...(offTopicPlace ? { reason: [...resolved.unknown, ...outOfArea].join(",") } : {}),
  });

  // Trigger 1 và 3 của Mục 10.6: khách yêu cầu gặp người thật, hoặc ý định không đủ tin cậy.
  const forcedReason: EscalationReason | null = nlu.wantsHuman
    ? "USER_REQUEST"
    : nlu.confidence < MIN_INTENT_CONFIDENCE
      ? "LOW_CONFIDENCE"
      : offTopicPlace
        ? "OUT_OF_SCOPE"
        : null;

  /**
   * Ghi lại quyết định định tuyến.
   *
   * Không phải log tạm để gỡ lỗi: khi một lượt bị chuyển tiếp, phía khách chỉ thấy đúng một câu
   * "mình chưa xử lý được", và bốn nguyên nhân hoàn toàn khác nhau — khách xin gặp người, NLU
   * không hiểu, hỏi ngoài địa bàn, hay tác tử ném lỗi — đều biểu hiện y hệt nhau. Không có dòng
   * này thì việc phân biệt chúng phải làm bằng cách dựng lại toàn bộ luồng, và đó đúng là việc
   * đã phải làm khi truy ca "Hôm nay thời tiết Đồng Văn thế nào".
   */
  console.info(
    `[turn] msg=${JSON.stringify(input.message).slice(0, 80)} ` +
      `intent=${nlu.intent} conf=${nlu.confidence} entities=${JSON.stringify(nlu.entities)} ` +
      `slots=${JSON.stringify(slots)} places=[${placeSlugs.join(",")}] ` +
      `temporal=${fresh.temporalType}:${JSON.stringify(fresh.phrase ?? "")} ` +
      `outOfArea=[${outOfArea.join(",")}] unknown=[${resolved.unknown.join(",")}] ` +
      `wantsHuman=${nlu.wantsHuman} -> ${forcedReason ? `support (${forcedReason})` : agent}`,
  );

  if (forcedReason) {
    path.push({ node: "route", outcome: "forced_escalation", detail: "support", reason: forcedReason });
    agent = "support";
    result = await deps.runSupport(context, forcedReason);
    recordAgent(agent, result);
  } else {
    path.push({ node: "route", outcome: "agent", detail: agent });
    const missing = missingSlots(agent, slots);
    if (missing.length > 0) {
      path.push({ node: "slot_gate", outcome: "ask", detail: missing[0] });
      result = askForSlot(agent, missing[0]);
    } else {
      path.push({ node: "slot_gate", outcome: "complete" });
      try {
        result = await deps.runAgent(agent, context);
        recordAgent(agent, result);
      } catch (error) {
        // Thiếu API key là lỗi cấu hình, phải nổi lên thành 503 chứ không nuốt thành escalation.
        if (error instanceof AiUnavailableError) throw error;
        /**
         * Chạm trần chi phí cũng phải nổi lên, cùng lý do: đó là tình trạng của hệ thống, không
         * phải một câu hỏi mà tác tử không trả lời được. Nuốt nó thành escalation thì khách nhận
         * một lời xin lỗi vô nghĩa, bản ghi chuyển tiếp đếm sai, và người vận hành mất đúng tín
         * hiệu cần thấy — trong khi phản hồi đúng là 429 kèm Retry-After.
         */
        if (error instanceof AiBudgetExceededError) throw error;
        // Không lưu thông điệp lỗi bên ngoài: nó có thể chứa URL hoặc bí mật của adapter.
        /**
         * Ghi NHÓM nguyên nhân vào trace, không chỉ ghi "đã hỏng".
         *
         * `reason` cũ luôn là chuỗi `AGENT_ERROR`, nên mọi sự cố — hết hạn mức model, Postgres
         * không trả lời, sidecar embedding chưa lên — đều đọng lại thành đúng một con số và phải
         * mở log ra mới biết là chuyện gì. Bốn nhóm này do bốn người khác nhau xử lý.
         *
         * `classifyFailure` nhận dạng theo hình dạng lỗi, không chép thông điệp của nhà cung cấp
         * vào trace: thông điệp đó có thể chứa URL hoặc khoá.
         */
        failure = classifyFailure(error);
        path.push({ node: "agent", outcome: "threw", detail: agent, reason: `AGENT_ERROR:${failure}` });
        console.error(`Tác tử ${agent} lỗi (${failure}):`, error);
        agent = "support";
        result = await deps.runSupport(context, "OUT_OF_SCOPE");
        recordAgent(agent, result);
      }

      // Trigger 2: guardrail chặn thì chuyển tiếp thay vì trả một câu trả lời không có căn cứ.
      const blocked = inspect(result, agent);
      path.push({ node: "guardrail", outcome: blocked ? "block" : "pass", ...(blocked ? { reason: blocked } : {}) });
      if (blocked) {
        /**
         * Ánh xạ lý do chặn sang lý do chuyển tiếp.
         *
         * `unsupported` (câu trả lời nêu con số không có trong chứng cứ) đi chung nhóm với
         * `insufficient` vì enum EscalationReason trong Prisma chưa có giá trị nào cho ảo giác,
         * và thêm một giá trị là một migration cơ sở dữ liệu. Lý do CHÍNH XÁC vẫn không mất: nó
         * nằm ở nút guardrail trong trace ngay phía trên, cùng danh sách dữ kiện không kiểm được.
         */
        const reason: EscalationReason =
          blocked === "insufficient" || blocked === "unsupported" ? "OUT_OF_SCOPE" : "COMPLAINT";
        const fallback = await deps.runSupport(context, reason);
        recordAgent("support", fallback);
        agent = "support";
        result = { ...fallback, calls: [...result.calls, ...fallback.calls], retrieval: result.retrieval };
      }
    }
  }

  const agentMs = Date.now() - agentStartedAt;
  path.push({ node: result.escalation ? "escalate" : "respond", outcome: "ok", detail: agent,
    ...(result.escalation ? { reason: result.escalation.reason } : {}) });

  return {
    result,
    nlu,
    agent,
    slots: result.slotUpdates ? { ...slots, ...result.slotUpdates } : slots,
    trace: {
      path: path.snapshot(),
      intent: nlu.intent,
      confidence: nlu.confidence,
      agent,
      grounding: result.grounding,
      // Tool hỏng mà không có exception nào vẫn là một sự cố hạ tầng, và là nhóm `realtime` —
      // nhóm duy nhất không bao giờ nổi lên thành exception, vì tầng tool trả về union chứ không ném.
      failure: failure !== "none" ? failure : result.toolStatus === "failed" ? "realtime" : "none",
      toolStatus: result.toolStatus,
      coverage: result.coverage,
      evidence: result.evidence,
      retrievedDocIds: result.retrievedDocIds,
      citedDocIds: result.citedDocIds,
      unsupportedFacts: result.unsupportedFacts ?? [],
      escalated: Boolean(result.escalation),
      totalMs: Date.now() - startedAt,
      nluMs,
      agentMs,
      calls: [nluMetrics, ...result.calls],
      retrieval: result.retrieval,
    },
  };
}
