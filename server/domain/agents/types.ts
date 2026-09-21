import type { EscalationReason } from "@prisma/client";
import type { ItineraryPlan } from "@shared/types";
import type { CallMetrics } from "@server/infra/gemini";
import type { RetrievalMetrics } from "@server/domain/rag/retrieval";
import type { TemporalContext } from "@server/domain/temporal/types";
import type { CoverageStats, EvidenceBlock, GroundingStatus, ToolStatus } from "./grounding";
import type { FailureClass } from "./failure";

/**
 * Kiểu dùng chung cho luồng 6 tác tử (SRS Hình 9.2, Mục 11.1).
 *
 * Một lượt hội thoại đi theo đúng thứ tự: NLU → Dialog Manager → Orchestrator → một tác tử
 * chuyên biệt → Guardrail. Ràng buộc bắt buộc của SRS Mục 10.4 bước 8–12 nằm bên trong từng tác
 * tử: **truy vấn dữ liệu thật trước, rồi mới đưa dữ liệu đó cho model diễn đạt.** Model không
 * bao giờ được tự sinh giá, số liệu hay chính sách.
 */

/** Năm ý định tương ứng năm tác tử chuyên biệt của SRS Mục 12 Giai đoạn 1. */
export type Intent = "discovery" | "itinerary" | "budget" | "knowledge" | "support";

export const INTENTS: Intent[] = [
  "discovery",
  "itinerary",
  "budget",
  "knowledge",
  "support",
];

/**
 * Ngưỡng tin cậy để chuyển tiếp. Dưới ngưỡng này là một trong ba trường hợp SRS Mục 10.6 nói hệ
 * thống *buộc* phải chuyển tiếp sang người thật.
 *
 * Con số 0,5 là điểm khởi đầu, chưa phải kết quả đo. Phải hiệu chỉnh trên bộ câu hỏi vàng
 * (SRS Mục 11.4.7) — đặt quá cao thì chuyển tiếp tràn lan và hàng đợi vô nghĩa, quá thấp thì
 * chatbot trả lời tự tin những câu nó không hiểu.
 */
export const MIN_INTENT_CONFIDENCE = 0.5;

/**
 * Nhu cầu thu thập dần qua nhiều lượt (FR-BOT-02). Dùng lại đúng các union type của
 * shared/types.ts để tác tử lịch trình map sang `ItineraryRequest` mà không cần chuyển đổi.
 */
export interface Slots {
  destinations?: string[];
  days?: number;
  travelers?: number;
  budgetLevel?: ItineraryPlan["budgetLevel"];
  travelMode?: ItineraryPlan["travelMode"];
  vibe?: ItineraryPlan["vibe"];
  /** Mốc thời gian do mã tất định quy đổi từ cụm chữ của khách. */
  temporal?: TemporalContext;
  stayStyle?: "dorm" | "private_room" | "ecolodge";
  notes?: string;
}

export const SLOT_KEYS: (keyof Slots)[] = [
  "destinations",
  "days",
  "travelers",
  "budgetLevel",
  "travelMode",
  "vibe",
  "temporal",
  "stayStyle",
  "notes",
];

export interface NluResult {
  intent: Intent;
  confidence: number;
  entities: Slots;
  temporalPhrases: string[];
  /** Khách nói rõ muốn gặp người thật, hoặc đang khiếu nại. Kiểm riêng vì nó ghi đè định tuyến. */
  wantsHuman: boolean;
}

export interface AgentContext {
  sessionId: string;
  userId: string | null;
  message: string;
  /**
   * Câu dùng cho TRUY XUẤT, đã qua `rewriteQuery`. Bằng `message` khi không có phép nào áp dụng.
   *
   * Tách khỏi `message` vì hai chỗ dùng đòi hai thứ khác nhau: lời nhắc phải thấy đúng chữ khách
   * gõ, còn truy xuất cần bản đã sửa tên viết sai và đã gắn địa danh mà đại từ trỏ tới.
   */
  retrievalQuery?: string;
  slots: Slots;
  nlu: NluResult;
  /** Lịch sử đã cắt bớt và đã che dữ liệu cá nhân, sẵn sàng đưa vào prompt. */
  history: { role: "user" | "assistant"; content: string }[];
  /**
   * Khoá Place nhận diện được trong lượt này, đã phân giải qua từ điển địa danh. Rỗng nghĩa là
   * khách không nêu nơi cụ thể nào — khi đó truy xuất không lọc theo địa danh.
   */
  placeSlugs: string[];
}

export interface EscalationRequest {
  reason: EscalationReason;
  summary: string;
}

export interface AgentResult {
  toolCalls?: ToolCallTrace[];
  reply: string;
  suggestions: string[];
  /**
   * Câu trả lời có căn cứ tới đâu. Guardrail đọc trường này.
   *
   * Thay cho cờ `grounded: boolean` cũ, vốn được đặt bằng `reply.length > 0` ở tác tử tri thức —
   * tức "model có nói gì đó" bị coi là "có căn cứ". Năm trạng thái ở đây phân biệt được ba tình
   * huống mà cờ nhị phân gộp làm một: có nguồn, nguồn không đủ trả lời, và tool gặp lỗi. Ba tình
   * huống đó dẫn tới ba câu trả lời khác nhau cho khách.
   */
  grounding: GroundingStatus;
  /**
   * Tình trạng tool, TÁCH khỏi `grounding` vì hai trục có thể lệch nhau.
   *
   * Một lượt hoàn toàn có thể vừa `grounding: "grounded"` vừa `toolStatus: "degraded"`: thời tiết
   * tra không được nhưng khách hỏi về phiên chợ, nên câu trả lời vẫn đứng vững. Trước khi tách,
   * tình huống đó hoặc biến mất khỏi trace, hoặc kéo cả lượt xuống `tool_failed` một cách oan uổng.
   */
  toolStatus?: ToolStatus;
  /** Số liệu độ phủ trích dẫn. Nguồn của `citation_coverage` và `uncited_claim_rate` trong eval. */
  coverage?: CoverageStats;
  /**
   * Chứng cứ THẬT SỰ đưa vào lời nhắc, đã đánh mã. Rỗng với tác tử không dùng khối chứng cứ.
   *
   * Đây cũng là ngữ cảnh mà bộ đo phải ghi lại: chấm faithfulness so với những đoạn đọc lại từ
   * database là chấm sai denominator, vì nó bỏ mất số liệu tool mà model thực sự nhìn thấy.
   */
  evidence: EvidenceBlock[];
  /** Mọi đoạn truy xuất được. Tách khỏi `citedDocIds` vì truy xuất không đồng nghĩa với trích dẫn. */
  retrievedDocIds: string[];
  /** Id KnowledgeDoc mà câu trả lời THẬT SỰ dẫn, sau khi mã trích dẫn đã được đối chiếu. */
  citedDocIds: string[];
  /** Dữ kiện số trong câu trả lời không tìm được chứng cứ chống lưng. Rỗng là điều kiện để `grounded`. */
  unsupportedFacts?: string[];
  /** Slot mà tác tử suy ra thêm được trong lúc xử lý (ví dụ số ngày mặc định đã dùng). */
  slotUpdates?: Slots;
  escalation?: EscalationRequest;
  calls: CallMetrics[];
  retrieval?: RetrievalMetrics;
  /** Lịch trình đầy đủ khi tác tử itinerary chạy thành công, để giao diện render được thẻ riêng. */
  itinerary?: unknown;
}

/** Ghi vào ChatMessage.trace. Nguồn dữ liệu duy nhất để đối chiếu ngưỡng 3 giây của NFR-PERF-03. */
export interface TurnTrace {
  path: TraceNode[];
  intent: Intent;
  confidence: number;
  agent: Intent;
  grounding: GroundingStatus;
  /**
   * Nhóm nguyên nhân hỏng, khi lượt này có hỏng.
   *
   * Cần thiết vì bốn nguyên nhân — model, database, embedding, realtime — đều biểu hiện y hệt
   * nhau với khách ("mình chưa xử lý được") và trước đây cũng đọng lại y hệt nhau trong trace,
   * dưới cùng một chuỗi `AGENT_ERROR`. Bốn nhóm đó do bốn người khác nhau xử lý.
   */
  failure?: FailureClass;
  /** Trục tool, ghi riêng. Xem chú thích ở `AgentResult.toolStatus`. */
  toolStatus?: ToolStatus;
  coverage?: CoverageStats;
  evidence: EvidenceBlock[];
  retrievedDocIds: string[];
  citedDocIds: string[];
  unsupportedFacts: string[];
  escalated: boolean;
  totalMs: number;
  nluMs: number;
  agentMs: number;
  calls: CallMetrics[];
  retrieval?: RetrievalMetrics;
}

export type TraceNodeName =
  | "nlu" | "temporal" | "rewrite" | "place_resolve" | "route" | "slot_gate"
  | "agent" | "tool" | "guardrail" | "respond" | "escalate";

export interface TraceNode {
  node: TraceNodeName;
  outcome: string;
  detail?: string;
  reason?: string;
  ms?: number;
}

export interface ToolCallTrace {
  tool: string;
  outcome: "ok" | "failed";
  code?: string;
}
