import { readFile } from "node:fs/promises";
import { ALL_KNOWLEDGE } from "@data/knowledge/index";
import { INTENTS, SLOT_KEYS, type Intent } from "@server/domain/agents/types";
import { ESCALATION_REASONS, KINDS, SPLITS, VARIANTS, type EscalationReasonName, type Kind, type Split, type Variant } from "@eval/dataset";

/**
 * Bộ vàng. Một dòng JSON là một KỊCH BẢN, không nhất thiết là một câu hỏi.
 *
 * Ba dạng kịch bản, phân biệt bằng `kind`:
 *  - `qa` — một câu hỏi trong phạm vi, có `expected_docs`. Chấm RAGAS, truy xuất và ý định.
 *  - `refusal` — câu phải bị từ chối, có `expected_escalation_reason`. Chấm nhóm từ chối.
 *  - `conversation` — nhiều lượt, mỗi lượt có thể mang `expected_slots`. Chấm nhóm hội thoại, và
 *    chấm cả RAGAS/truy xuất khi lượt cuối có `expected_docs`.
 *
 * `split` chia tập tinh chỉnh (`dev`) và tập giữ riêng (`holdout`). Quy ước làm việc: đọc, phân
 * tích lỗi và vặn prompt/ngưỡng CHỈ trên `dev`; `holdout` chạy để lấy con số báo cáo. Vi phạm quy
 * ước này thì hai tập hoà làm một và mọi chỉ số đều là điểm trên tập đã học thuộc.
 *
 * `variant` ghi kiểu nhiễu của câu hỏi. Nó không đổi cách chấm, chỉ để bảng phân rã chỉ ra hệ
 * thống hỏng ở nhóm đầu vào nào — câu viết chuẩn và câu gõ không dấu thường lệch nhau rất xa.
 */

export interface GoldenTurn {
  message: string;
  /** Slot đúng phải có SAU lượt này, kể cả giá trị giữ lại từ lượt trước. */
  expected_slots?: Record<string, unknown>;
}

export interface GoldenCase {
  id: string;
  kind: Kind;
  group: string;
  split: Split;
  variant: Variant;
  out_of_scope: boolean;
  /** Lượt cuối — câu mà hệ thống phải trả lời được. */
  question: string;
  reference: string;
  expected_docs: string[];
  expected_intent: Intent | null;
  expected_escalation_reason: EscalationReasonName | null;
  turns: GoldenTurn[];
  note?: string;
}

/** Nhóm hợp lệ: tám nhánh kho tri thức, cộng các nhóm kịch bản không gắn với nhánh nào. */
const EXTRA_GROUPS = ["out_of_scope", "itinerary", "budget", "discovery", "support"] as const;

const DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function member<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function parseTurns(value: Record<string, unknown>, fail: () => never): GoldenTurn[] {
  if ("turns" in value) {
    if ("question" in value || !Array.isArray(value.turns) || value.turns.length < 2) return fail();
    return value.turns.map((turn) => {
      if (!turn || typeof turn !== "object" || Array.isArray(turn)) return fail();
      const row = turn as Record<string, unknown>;
      if (typeof row.message !== "string" || !row.message.trim()) return fail();
      if (!("expected_slots" in row)) return { message: row.message };
      const slots = row.expected_slots;
      if (!slots || typeof slots !== "object" || Array.isArray(slots)) return fail();
      const keys = Object.keys(slots);
      if (!keys.length || keys.some((key) => !(SLOT_KEYS as string[]).includes(key))) return fail();
      return { message: row.message, expected_slots: slots as Record<string, unknown> };
    });
  }
  if (typeof value.question !== "string" || !value.question.trim()) return fail();
  return [{ message: value.question }];
}

export function parseGolden(text: string): GoldenCase[] {
  const ids = new Set<string>();
  const sources = new Set(ALL_KNOWLEDGE.map((doc) => `${doc.domain}:${doc.slug}`));
  const groups = new Set<string>([...ALL_KNOWLEDGE.map((doc) => doc.domain), ...EXTRA_GROUPS]);
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      const fail = (): never => {
        throw new Error(`Bộ câu hỏi không hợp lệ tại dòng ${index + 1}`);
      };
      if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
      const row = value as Record<string, unknown>;
      if (typeof row.id !== "string" || !/^GS-\d{3}$/.test(row.id) || ids.has(row.id)) return fail();
      ids.add(row.id);
      if (!member(row.kind, KINDS) || !member(row.split, SPLITS)) return fail();
      const variant: Variant = "variant" in row ? (member(row.variant, VARIANTS) ? row.variant : fail()) : "clean";
      if (typeof row.reference !== "string" || !row.reference.trim()) return fail();
      if (typeof row.group !== "string" || !groups.has(row.group)) return fail();
      if (!Array.isArray(row.expected_docs)) return fail();

      const docs: string[] = [];
      for (const ref of row.expected_docs) {
        if (typeof ref !== "string" || !sources.has(ref) || docs.includes(ref)) return fail();
        docs.push(ref);
      }

      const turns = parseTurns(row, fail);
      const question = turns[turns.length - 1].message;
      const outOfScope = row.kind === "refusal";

      // Ràng buộc theo dạng kịch bản. Sai một trong số này là nhãn tự mâu thuẫn, và nhãn tự mâu
      // thuẫn thì chỉ số tính ra vẫn có vẻ hợp lệ — đó là kiểu hỏng khó thấy nhất của một bộ vàng.
      if (outOfScope && (docs.length !== 0 || row.group !== "out_of_scope")) return fail();
      if (row.kind === "qa" && (docs.length === 0 || turns.length !== 1)) return fail();
      if (row.kind === "conversation" && turns.length < 2) return fail();
      // Lý do chuyển tiếp là nhãn BẮT BUỘC của kịch bản từ chối: không có nó thì chỉ đo được
      // "có chuyển tiếp hay không", đúng cái phép đo mà nhóm chỉ số từ chối sinh ra để thay thế.
      if (outOfScope ? !member(row.expected_escalation_reason, ESCALATION_REASONS) : "expected_escalation_reason" in row) return fail();
      if ("expected_intent" in row && !member(row.expected_intent, INTENTS)) return fail();
      // Nhãn biến thể phải khớp nội dung, nếu không bảng phân rã nói dối sau vài lần sửa file.
      if (variant === "no_diacritics" && DIACRITICS.test(question)) return fail();
      if ("note" in row && typeof row.note !== "string") return fail();

      return {
        id: row.id,
        kind: row.kind,
        group: row.group,
        split: row.split,
        variant,
        out_of_scope: outOfScope,
        question,
        reference: row.reference,
        expected_docs: docs,
        expected_intent: "expected_intent" in row ? (row.expected_intent as Intent) : null,
        expected_escalation_reason: outOfScope ? (row.expected_escalation_reason as EscalationReasonName) : null,
        turns,
        ...("note" in row && typeof row.note === "string" ? { note: row.note } : {}),
      };
    });
}

export async function loadGolden(file = new URL("./ha-giang.jsonl", import.meta.url)): Promise<GoldenCase[]> {
  return parseGolden(await readFile(file, "utf8"));
}
