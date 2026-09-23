import type { EscalationReason } from "@prisma/client";
import { AiBudgetExceededError } from "@server/infra/aiBudget";
import { AiUnavailableError } from "@server/infra/gemini";
import { classify } from "./nlu";
import { TraceCollector } from "./trace";
import { resolve } from "@server/domain/temporal/router";
import { mergeTemporalPhrases } from "@server/domain/temporal/phrases";
import { mergeSlots, missingSlots, questionFor } from "./dialog";
import { extractSlots } from "./slotExtract";
import { inspect } from "./guardrail";
import { classifyFailure, type FailureClass } from "./failure";
import { runBudget } from "./specialists/budget";
import { runDiscovery } from "./specialists/discovery";
import { runItinerary } from "./specialists/itinerary";
import { runKnowledge } from "./specialists/knowledge";
import { runSupport } from "./specialists/support";
import { MIN_INTENT_CONFIDENCE, type AgentContext, type AgentResult, type AgentStream, type Intent, type NluResult, type Slots, type TurnEvent, type TurnTrace } from "./types";
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
  /**
   * Tác tử đã phục vụ lượt gần nhất của phiên này — tức VIỆC ĐANG LÀM DỞ.
   *
   * Dialog Manager mang slot qua các lượt nhưng không mang việc, nên một câu sửa lại yêu cầu cũ
   * ("À cho mình thuê người lái thôi") đứng một mình thì không còn đủ nghĩa để phân loại. Nơi gọi
   * lấy từ `ChatMessage.agent` đã lưu sẵn; bỏ trống thì hành vi y như trước.
   */
  previousIntent?: Intent;
  /**
   * Kênh đẩy tiến trình và chữ ra ngay trong lúc lượt đang chạy. Chỉ endpoint streaming truyền
   * vào; thiếu nó thì `handleTurn` chạy y hệt bản cũ và trả về đúng một lần ở cuối.
   *
   * Hợp đồng giữ nguyên bất kể có hay không: `TurnOutput` vẫn là kết quả thật và đầy đủ, đã qua
   * guardrail. Mọi thứ đi qua đây chỉ là bản xem trước chưa được kiểm.
   */
  onEvent?: (event: TurnEvent) => void;
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

/**
 * Ngắt kênh streaming cho một lượt gọi tác tử, sau khi đã xoá chữ đã đẩy ra.
 *
 * ĐÂY LÀ CHỖ HỢP ĐỒNG STREAMING GẶP GUARDRAIL, và nó phải nằm ở một hàm có tên chứ không phải một
 * phép sao chép đối tượng viết vội. Câu trả lời mà tác tử vừa stream đã bị guardrail vứt — vì nêu
 * con số không có trong chứng cứ, hoặc lộ ký hiệu che dữ liệu — nên nó KHÔNG được đứng lại trên
 * màn hình. `reset` xoá nó đi, và câu chuyển tiếp thay thế cố tình không stream: nó về nguyên khối
 * trong sự kiện `final`, nơi nó đã là kết quả đã kiểm.
 *
 * Nối thêm câu chuyển tiếp vào sau đoạn vừa bị chặn là hỏng nặng hơn không stream: khách đọc được
 * một con số bịa, rồi ngay dưới là lời xin lỗi vì không có số liệu.
 */
function quiet(context: AgentContext): AgentContext {
  context.stream?.reset();
  return { ...context, stream: undefined };
}

/** Bắc `AgentStream` lên kênh sự kiện của lượt. Một phép đổi hình dạng, không thêm logic nào. */
function makeStream(onEvent: (event: TurnEvent) => void): AgentStream {
  return {
    delta: (text) => onEvent({ type: "delta", text }),
    reset: () => onEvent({ type: "reset" }),
    stage: (stage, detail) => onEvent({ type: "stage", stage, ...(detail ? { detail } : {}) }),
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
  input.onEvent?.({ type: "stage", stage: "nlu", detail: nlu.intent });

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
  /**
   * Điều kiện là "CÂU CHỮ không nêu nơi nào", không phải "không phân giải được nơi nào".
   *
   * Bản trước hỏi `placeSlugs.length === 0`. Nhưng `placeSlugs` gộp cả `resolved.slugs` — thứ lấy
   * từ `nlu.entities.destinations`, mà NLU thì tự mang địa danh của lượt trước sang. Nên với câu
   * "Ở đó ăn sáng thì nên ăn gì?" sau khi khách vừa hỏi về phố cổ Đồng Văn, NLU trả về
   * `destinations: ["Phố cổ Đồng Văn"]`, `placeSlugs` không rỗng, và nhánh mang địa danh KHÔNG
   * chạy — trong khi câu chữ đưa đi nhúng vẫn còn nguyên chữ "Ở đó" và không có tên nơi nào.
   *
   * Hậu quả đo được trên GS-201: truy xuất trả về Cổng Trời Quản Bạ, quần áo theo mùa và điểm
   * ngắm Bản Phùng — không đoạn nào về Đồng Văn, không đoạn nào về ăn uống. Ghép tên nơi vào thì
   * ra 5 đoạn, trong đó có đúng `food:food-banh-cuon-dong-van`. Guardrail chặn lượt đó là đúng;
   * thứ sai nằm ở truy vấn đưa cho nó.
   *
   * `scanned` là kết quả quét CHÍNH câu khách gõ, nên nó trả lời đúng câu hỏi cần hỏi. Nguồn địa
   * danh để ghép lấy từ `nlu.entities.destinations` trước, rồi mới tới slot đã gom qua các lượt.
   */
  const namedInText = scanned.length > 0;
  const rewrite = rewriteQuery({
    message: normalized.query,
    carriedPlaces: namedInText ? [] : nlu.entities.destinations ?? slots.destinations ?? [],
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
    ...(input.onEvent ? { stream: makeStream(input.onEvent) } : {}),
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
   * CHỈ tin `outOfArea`, tức danh sách chặn tường minh. Bản trước tin thêm `resolved.unknown` —
   * những tên NLU trích ra mà từ điển không có — và đó là một sai lầm đo được: mảng `destinations`
   * do model trả về chứa cả CỤM DANH TỪ CHUNG, không riêng tên riêng. Lần chạy đánh giá ngày
   * 2026-09-22 cho thấy "Chợ phiên vùng cao", "bản sát biên giới" và "nhà người Mông" đều bị xếp
   * là địa danh lạ, và cả ba lượt bị chuyển tiếp OUT_OF_SCOPE trước khi truy xuất kịp chạy — trong
   * khi tài liệu trả lời đúng nằm sẵn trong kho, một trong số đó ở độ tương đồng 0.75.
   *
   * Bỏ tín hiệu ấy đi KHÔNG mở cửa cho câu hỏi ngoài địa bàn: guardrail căn cứ ở cuối lượt vẫn
   * chuyển tiếp OUT_OF_SCOPE khi truy xuất không có gì để bám vào. Chặn sớm bằng một tín hiệu do
   * model sinh ra chỉ thêm ca từ chối nhầm, không thêm lớp bảo vệ nào mà phía sau chưa có.
   */
  const offTopicPlace = outOfArea.length > 0 && placeSlugs.length === 0;
  path.push({
    node: "place_resolve", outcome: offTopicPlace ? "out_of_area" : placeSlugs.length ? "resolved" : "empty",
    detail: placeSlugs.join(","),
    ...(offTopicPlace ? { reason: outOfArea.join(",") } : {}),
  });

  /**
   * ĐỘ TIN CẬY THẤP Ở MỘT LƯỢT SỬA LẠI VIỆC ĐANG LÀM DỞ KHÔNG PHẢI LÀ KHÔNG HIỂU.
   *
   * Đo ngày 2026-09-23 trên GS-186 và GS-200: với đúng lịch sử hội thoại của chúng, NLU trả về độ
   * tin cậy 0,40–0,45 ở CẢ BA lần chạy, và nhãn lật qua lại giữa `support` với `itinerary`. Model
   * không sai khi thiếu tự tin — "À cho mình thuê người lái thôi" tách khỏi ngữ cảnh thì thật sự
   * mơ hồ. Thứ giải nghĩa nó nằm ở việc đang làm dở, không nằm trong câu.
   *
   * Nhưng hai câu ấy ĐƯỢC HIỂU: `extractSlots` — mã tất định, không gọi model — rút ra
   * `travelMode: easy_rider` và `budgetLevel: luxury` từ chính chúng. Chuyển tiếp một lượt mà
   * chính ta vừa đọc hiểu bằng regex là chuyển tiếp nhầm.
   *
   * Nên trigger LOW_CONFIDENCE chỉ bỏ qua khi CẢ HAI điều kiện cùng đúng: có việc đang làm dở, và
   * lượt này tự nó cung cấp được thông tin. Thiếu một trong hai thì escalation giữ nguyên — một
   * câu cụt không bổ sung gì vẫn là câu mà hệ thống nên nhận là mình không hiểu.
   */
  const amendsOngoingTask =
    input.previousIntent !== undefined && Object.keys(extractSlots(input.message)).length > 0;

  // Trigger 1 và 3 của Mục 10.6: khách yêu cầu gặp người thật, hoặc ý định không đủ tin cậy.
  const forcedReason: EscalationReason | null = nlu.wantsHuman
    ? "USER_REQUEST"
    : nlu.confidence < MIN_INTENT_CONFIDENCE && !amendsOngoingTask
      ? "LOW_CONFIDENCE"
      : offTopicPlace
        ? "OUT_OF_SCOPE"
        : null;

  /**
   * Nhãn ý định của lượt này không đáng tin (đo được: lật giữa hai lần chạy cùng một câu), nên
   * tiếp tục đúng việc đang làm thay vì nhảy sang việc khác vì một lần đoán.
   */
  if (amendsOngoingTask && nlu.confidence < MIN_INTENT_CONFIDENCE) {
    agent = input.previousIntent as Intent;
  }

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
    input.onEvent?.({ type: "stage", stage: "agent", detail: "support" });
    result = await deps.runSupport(context, forcedReason);
    recordAgent(agent, result);
  } else {
    /**
     * NLU đoán `support` mà khách KHÔNG xin gặp người: thử tra kho trước khi chuyển tiếp.
     *
     * Tới được nhánh này nghĩa là `wantsHuman` bằng false và độ tin cậy đủ cao, nên nhãn `support`
     * ở đây hoàn toàn là phỏng đoán về GIỌNG ĐIỆU. Mô tả ý định trong prompt gộp "khiếu nại, sự
     * cố" vào một nhóm còn "an toàn, thủ tục" vào nhóm khác, và hai vùng đó chồng lên nhau đúng ở
     * chỗ khách đang lo lắng. Lần chạy đánh giá ngày 2026-09-22 có bốn câu rơi vào đó, trong đó
     * GS-116 là "Có người rơi xuống vực thì gọi số nào?" — hệ thống trả lời "vượt quá khả năng hỗ
     * trợ tự động của tôi" trong khi tài liệu số khẩn cấp nằm ngay hạng 1.
     *
     * Tác tử hỗ trợ theo thiết kế KHÔNG tra kho (`tool_status = not_used`), nên một câu bị gán
     * nhầm nhãn là một câu mất hẳn cơ hội được trả lời. Đổi lại, câu hỏi "kho có trả lời được
     * không" đáng tin hơn hẳn câu "bộ phân loại nói gì", và ở đây nó KHÔNG tốn thêm lượt gọi nào:
     * guardrail căn cứ ngay bên dưới đã sẵn sàng chuyển tiếp khi tác tử tri thức không bám được
     * vào đâu. Khiếu nại thật vẫn về đúng tác tử hỗ trợ, chỉ là đi qua một cửa kiểm chứng.
     */
    const guessedSupport = agent === "support";
    if (guessedSupport) agent = "knowledge";

    path.push({
      node: "route", outcome: "agent", detail: agent,
      ...(guessedSupport ? { reason: "support_thu_tra_kho_truoc" } : {}),
    });
    input.onEvent?.({ type: "stage", stage: "route", detail: agent });
    const missing = missingSlots(agent, slots);
    if (missing.length > 0) {
      path.push({ node: "slot_gate", outcome: "ask", detail: missing[0] });
      result = askForSlot(agent, missing[0]);
    } else {
      path.push({ node: "slot_gate", outcome: "complete" });
      input.onEvent?.({ type: "stage", stage: "agent", detail: agent });
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
        result = await deps.runSupport(quiet(context), "OUT_OF_SCOPE");
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
        /**
         * Lượt vừa được chuyển từ `support` sang `knowledge` ở trên thì giữ nguyên `COMPLAINT` —
         * đúng lý do mà nó đã mang nếu không có cửa kiểm chứng đó. Không làm vậy thì mọi khiếu
         * nại thật đều bị ghi thành OUT_OF_SCOPE và số liệu chuyển tiếp mất nghĩa.
         */
        const reason: EscalationReason = guessedSupport
          ? "COMPLAINT"
          : blocked === "insufficient" || blocked === "unsupported" ? "OUT_OF_SCOPE" : "COMPLAINT";
        const fallback = await deps.runSupport(quiet(context), reason);
        recordAgent("support", fallback);
        agent = "support";
        /**
         * GIỮ LẠI CHỨNG CỨ ĐÃ TRUY XUẤT, DÙ CÂU TRẢ LỜI BỊ VỨT.
         *
         * `evidence` và `retrievedDocIds` mô tả TRUY XUẤT tìm được gì — một sự thật độc lập với
         * việc câu trả lời dựng trên nó có qua được guardrail hay không. Bản trước thay nguyên
         * `result` bằng kết quả của tác tử hỗ trợ, mà tác tử ấy không truy xuất gì, nên mọi lượt
         * chuyển tiếp đều được ghi lại là truy xuất rỗng.
         *
         * Hậu quả là bốn chỉ số của bộ đo — tỷ lệ truy xuất rỗng, Recall@k, hit@1, MRR — bị kéo
         * theo TỈ LỆ CHUYỂN TIẾP chứ không đo chất lượng truy xuất. Đo ngày 2026-09-23: GS-035 và
         * GS-134 đều bị ghi `retrieved_docs: []`, trong khi chạy lại đúng câu hỏi ấy thì tài liệu
         * kỳ vọng nằm ở HẠNG 1 của cả hai.
         *
         * `citedDocIds` thì KHÔNG giữ, và sự khác biệt ở đây là có chủ đích: trích dẫn là thuộc
         * tính của câu trả lời vừa bị vứt, nên giữ lại là ghi công cho một câu không ai đọc.
         */
        result = {
          ...fallback,
          calls: [...result.calls, ...fallback.calls],
          retrieval: result.retrieval,
          evidence: result.evidence,
          retrievedDocIds: result.retrievedDocIds,
        };
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
