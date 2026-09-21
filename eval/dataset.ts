import { INTENTS, type Intent } from "@server/domain/agents/types";
import type { GroundingStatus, ToolStatus as ToolStatusName } from "@server/domain/agents/grounding";
import type { FailureClass as FailureClassName } from "@server/domain/agents/failure";

/**
 * Hình dạng một dòng `dataset.jsonl` — thứ mà run-eval ghi ra và MỌI chỉ số tất định đọc vào.
 *
 * Tách riêng khỏi gate.ts vì hai tầng có nguồn dữ liệu khác nhau: gate.ts xác thực file điểm do
 * bộ chấm Python trả về (RAGAS, cần gọi model), còn file này là nhật ký thô của hệ thống thật.
 * Recall@k, macro-F1, tỷ lệ từ chối nhầm và p95 độ trễ tính được từ đây mà không tốn một lượt gọi
 * model nào — nên chúng phải chạy được cả khi bộ chấm hỏng, và phải là phần quyết định PASS/FAIL
 * ít thiên lệch nhất của cổng.
 */

export const KINDS = ["qa", "refusal", "conversation"] as const;
export type Kind = (typeof KINDS)[number];
export const SPLITS = ["dev", "holdout"] as const;
export type Split = (typeof SPLITS)[number];
export const VARIANTS = ["clean", "no_diacritics", "typo", "near_miss_place", "underspecified"] as const;
export type Variant = (typeof VARIANTS)[number];
export const ESCALATION_REASONS = ["COMPLAINT", "LOW_CONFIDENCE", "OUT_OF_SCOPE", "USER_REQUEST", "URGENT"] as const;
export type EscalationReasonName = (typeof ESCALATION_REASONS)[number];
export const GROUNDING_STATUSES = [
  "grounded", "partially_grounded", "insufficient", "unsupported", "tool_failed", "no_source",
] as const;
/** Trục tool, ghi riêng khỏi trục căn cứ. Xem `ToolStatus` ở server/domain/agents/grounding.ts. */
export const TOOL_STATUSES = ["not_used", "ok", "degraded", "failed"] as const;
/** Nhóm nguyên nhân hỏng. Xem `FailureClass` ở server/domain/agents/failure.ts. */
export const FAILURE_CLASSES = ["none", "model", "database", "embedding", "realtime", "unknown"] as const;

/** Một lượt hội thoại đã chạy. Câu đơn lượt cũng là một mảng `turns` dài đúng 1. */
export interface TurnRecord {
  index: number;
  message: string;
  /** Ý định NLU nhận ra, TRƯỚC khi orchestrator ép chuyển tiếp. Đây mới là thứ macro-F1 đo. */
  intent: Intent;
  confidence: number;
  /** Tác tử thực sự chạy sau định tuyến. Khác `intent` nghĩa là đã có một lần ép chuyển tiếp. */
  agent: Intent;
  slots: Record<string, unknown>;
  expected_slots: Record<string, unknown> | null;
  /** Slot mà hệ thống hỏi lại ở lượt này, lấy từ nút `slot_gate` trong trace. */
  asked_slot: string | null;
  escalated: boolean;
  escalation_reason: EscalationReasonName | null;
  /**
   * Lượt này chuyển tiếp VÌ tác tử ném lỗi, không phải vì nhận ra câu ngoài phạm vi.
   *
   * Trường quyết định của cả nhóm chỉ số từ chối: thiếu nó thì một hệ thống hỏng hoàn toàn —
   * mọi lượt gọi model đều lỗi nên lượt nào cũng chuyển tiếp — vẫn đạt 100% "từ chối đúng".
   */
  agent_error: boolean;
  /**
   * Trạng thái căn cứ do tác tử tự khai, đã qua ba lớp kiểm ở server/domain/agents/grounding.ts.
   * Thay cho cờ nhị phân cũ, vốn chỉ nói được "model có nói gì đó hay không".
   */
  grounding: GroundingStatus;
  /**
   * Tình trạng tool trong lượt này, ĐỘC LẬP với `grounding`.
   *
   * Cần riêng vì hai trục lệch nhau được: `degraded` nghĩa là có tool hỏng nhưng câu trả lời
   * không phụ thuộc vào nó, và không có nấc đó thì mọi sự cố Open-Meteo hoặc biến mất khỏi số
   * liệu, hoặc kéo tụt điểm căn cứ của những lượt vốn phục vụ khách bình thường.
   */
  tool_status: ToolStatusName;
  /**
   * Nhóm nguyên nhân hỏng của lượt này.
   *
   * `agent_error` chỉ trả lời được "có hỏng không". Trường này trả lời "hỏng vì cái gì", và đó là
   * khác biệt giữa một con số báo động và một con số hành động được: lỗi model, lỗi database, lỗi
   * embedding và lỗi nhà cung cấp dữ liệu động do bốn người khác nhau xử lý.
   */
  failure: FailureClassName;
  /** Dữ kiện số trong câu trả lời không đối chiếu được với chứng cứ. */
  unsupported_facts: string[];
  /** Số ý model KHAI trong `citations`. Mẫu số của `uncited_claim_rate`. */
  claims: number;
  /** Trong đó, số ý không kèm mã nguồn thật nào. */
  uncited_claims: number;
  /** Số câu mang thông tin trong chính câu trả lời. Mẫu số của `citation_coverage`. */
  sentences: number;
  /** Trong đó, số câu khớp được một ý đã dẫn nguồn hợp lệ. */
  covered_sentences: number;
  /** Số câu mang dữ kiện số — nhóm bắt buộc phải có trích dẫn. */
  important_sentences: number;
  /** Câu mang dữ kiện số mà không dẫn được nguồn nào. Rỗng là điều kiện để lượt đạt `grounded`. */
  uncovered_important: string[];
  latency_ms: number;
  prompt_tokens: number;
  output_tokens: number;
  /** Số lượt gọi lại do phản hồi không phân giải được JSON, cộng dồn mọi lượt gọi của lượt này. */
  retries: number;
  /** sourceRef của MỌI đoạn đưa vào lời nhắc, đúng thứ hạng truy xuất, đã khử trùng lặp. */
  retrieved_docs: string[];
  /** sourceRef của các đoạn câu trả lời THẬT SỰ dẫn. Tập con của `retrieved_docs`. */
  cited_docs: string[];
  reply: string;
  contexts: string[];
}

export interface EvalRecord {
  id: string;
  kind: Kind;
  group: string;
  split: Split;
  variant: Variant;
  out_of_scope: boolean;
  /** Lượt cuối. Đây là câu mà RAGAS chấm, vì nó là câu khách thực sự chờ trả lời. */
  question: string;
  reference: string;
  expected_docs: string[];
  expected_intent: Intent | null;
  expected_escalation_reason: EscalationReasonName | null;
  answer: string;
  contexts: string[];
  turns: TurnRecord[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function member<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Khử trùng lặp GIỮ NGUYÊN thứ hạng.
 *
 * Một tài liệu nguồn bị cắt thành nhiều đoạn nên cùng một `sourceRef` xuất hiện nhiều lần trong
 * danh sách trích dẫn. Không khử thì Recall@5 đọc "5 đoạn" thành "5 tài liệu", và một truy xuất
 * chỉ tìm ra đúng một tài liệu vẫn có vẻ như phủ kín top-5.
 */
export function dedupe(refs: string[]): string[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
}

function parseTurn(value: unknown, index: number, fail: () => never): TurnRecord {
  if (!record(value)) return fail();
  if (!text(value.message) || typeof value.reply !== "string") return fail();
  if (!member(value.intent, INTENTS) || !member(value.agent, INTENTS)) return fail();
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)) return fail();
  if (typeof value.escalated !== "boolean" || typeof value.agent_error !== "boolean") return fail();
  if (!member(value.grounding, GROUNDING_STATUSES)) return fail();
  if (!member(value.tool_status, TOOL_STATUSES)) return fail();
  if (!member(value.failure, FAILURE_CLASSES)) return fail();
  if (!strings(value.unsupported_facts) || !strings(value.uncovered_important)) return fail();
  if (![value.claims, value.uncited_claims, value.sentences, value.covered_sentences,
        value.important_sentences].every(count)) return fail();
  if (value.escalation_reason !== null && !member(value.escalation_reason, ESCALATION_REASONS)) return fail();
  if (value.asked_slot !== null && !text(value.asked_slot)) return fail();
  if (![value.latency_ms, value.prompt_tokens, value.output_tokens, value.retries].every(count)) return fail();
  if (!strings(value.retrieved_docs) || !strings(value.cited_docs) || !strings(value.contexts)) return fail();
  if (!record(value.slots)) return fail();
  if (value.expected_slots !== null && !record(value.expected_slots)) return fail();
  return {
    index,
    message: value.message,
    intent: value.intent,
    confidence: value.confidence,
    agent: value.agent,
    slots: value.slots,
    expected_slots: value.expected_slots as Record<string, unknown> | null,
    asked_slot: (value.asked_slot as string | null) ?? null,
    escalated: value.escalated,
    escalation_reason: (value.escalation_reason as EscalationReasonName | null) ?? null,
    agent_error: value.agent_error,
    grounding: value.grounding,
    tool_status: value.tool_status,
    failure: value.failure,
    unsupported_facts: value.unsupported_facts,
    claims: value.claims as number,
    uncited_claims: value.uncited_claims as number,
    sentences: value.sentences as number,
    covered_sentences: value.covered_sentences as number,
    important_sentences: value.important_sentences as number,
    uncovered_important: value.uncovered_important,
    latency_ms: value.latency_ms as number,
    prompt_tokens: value.prompt_tokens as number,
    output_tokens: value.output_tokens as number,
    retries: value.retries as number,
    retrieved_docs: dedupe(value.retrieved_docs),
    cited_docs: dedupe(value.cited_docs),
    reply: value.reply,
    contexts: value.contexts,
  };
}

/** Xác thực từng dòng: một trường thiếu hoặc NaN không được phép đi tiếp thành "đã đo xong". */
export function parseDataset(content: string): EvalRecord[] {
  const ids = new Set<string>();
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, row) => {
      const value: unknown = JSON.parse(line);
      const fail = (): never => {
        throw new Error(`Dòng dataset không hợp lệ tại dòng ${row + 1}`);
      };
      if (!record(value)) return fail();
      if (typeof value.id !== "string" || !/^GS-\d{3}$/.test(value.id) || ids.has(value.id)) return fail();
      ids.add(value.id);
      if (!member(value.kind, KINDS) || !member(value.split, SPLITS) || !member(value.variant, VARIANTS)) return fail();
      if (!text(value.group) || !text(value.question) || !text(value.reference)) return fail();
      if (typeof value.answer !== "string") return fail();
      if (typeof value.out_of_scope !== "boolean" || value.out_of_scope !== (value.kind === "refusal")) return fail();
      if (!strings(value.expected_docs) || !strings(value.contexts)) return fail();
      if (value.expected_intent !== null && !member(value.expected_intent, INTENTS)) return fail();
      if (value.expected_escalation_reason !== null && !member(value.expected_escalation_reason, ESCALATION_REASONS)) return fail();
      if (!Array.isArray(value.turns) || value.turns.length === 0) return fail();
      const turns = value.turns.map((turn, index) => parseTurn(turn, index, fail));
      if (turns[turns.length - 1].message !== value.question) return fail();
      return {
        id: value.id,
        kind: value.kind,
        group: value.group,
        split: value.split,
        variant: value.variant,
        out_of_scope: value.out_of_scope,
        question: value.question,
        reference: value.reference,
        expected_docs: value.expected_docs,
        expected_intent: (value.expected_intent as Intent | null) ?? null,
        expected_escalation_reason: (value.expected_escalation_reason as EscalationReasonName | null) ?? null,
        answer: value.answer,
        contexts: value.contexts,
        turns,
      };
    });
}
