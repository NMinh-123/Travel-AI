import type { EscalationReason } from "@prisma/client";
import type { ItineraryPlan } from "../../src/types";
import type { CallMetrics } from "../gemini";
import type { RetrievalMetrics } from "../rag/retrieval";

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
 * src/types.ts để tác tử lịch trình map sang `ItineraryRequest` mà không cần chuyển đổi.
 */
export interface Slots {
  destinations?: string[];
  days?: number;
  travelers?: number;
  budgetLevel?: ItineraryPlan["budgetLevel"];
  travelMode?: ItineraryPlan["travelMode"];
  vibe?: ItineraryPlan["vibe"];
  /** Tháng dự kiến đi, 1–12. Dùng để trả lời câu hỏi về mùa và thời tiết theo mùa. */
  month?: number;
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
  "month",
  "stayStyle",
  "notes",
];

export interface NluResult {
  intent: Intent;
  confidence: number;
  entities: Slots;
  /** Khách nói rõ muốn gặp người thật, hoặc đang khiếu nại. Kiểm riêng vì nó ghi đè định tuyến. */
  wantsHuman: boolean;
}

export interface AgentContext {
  sessionId: string;
  userId: string | null;
  message: string;
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
  reply: string;
  suggestions: string[];
  /**
   * Câu trả lời có dựa trên dữ liệu lấy từ DB hay không. Guardrail dùng cờ này: tác tử tri thức
   * mà `grounded` false thì không được trả lời tự do — đó là trigger "ngoài phạm vi kho tri
   * thức" của SRS Mục 10.6.
   */
  grounded: boolean;
  /** Id các đoạn KnowledgeDoc đã dùng, để trích dẫn nguồn và để ghi vào trace. */
  citedDocIds: string[];
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
  intent: Intent;
  confidence: number;
  agent: Intent;
  grounded: boolean;
  citedDocIds: string[];
  escalated: boolean;
  totalMs: number;
  nluMs: number;
  agentMs: number;
  calls: CallMetrics[];
  retrieval?: RetrievalMetrics;
}
