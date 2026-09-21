import { INTENTS, type Intent } from "@server/domain/agents/types";
import type { EvalRecord } from "@eval/dataset";

/**
 * Chỉ số tầng nhận diện ý định và trích xuất slot.
 *
 * Đo trên `nlu.intent` — ý định NLU trả về TRƯỚC khi orchestrator ép chuyển tiếp. Đo trên tác tử
 * chạy thật thì không phân biệt được "NLU hiểu sai" với "NLU hiểu đúng nhưng độ tin cậy dưới
 * ngưỡng nên bị ép sang support", mà hai lỗi đó cần hai cách sửa khác nhau: một bên sửa prompt
 * phân loại, một bên hiệu chỉnh MIN_INTENT_CONFIDENCE.
 *
 * Dùng macro-F1 chứ không dùng accuracy vì phân bố lớp rất lệch — phần lớn bộ vàng là `knowledge`,
 * nên một bộ phân loại trả `knowledge` cho mọi câu vẫn đạt accuracy cao trong khi hỏng hoàn toàn
 * ở bốn ý định còn lại. Macro-F1 cho mỗi ý định trọng số bằng nhau nên phơi ra đúng chỗ đó.
 */

export interface IntentClassScore {
  intent: Intent;
  support: number;
  predicted: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface IntentScores {
  count: number;
  accuracy: number;
  macro_f1: number;
  classes: IntentClassScore[];
  /** Tỷ lệ cặp (slot, giá trị) có nhãn mà hệ thống điền đúng, gộp mọi lượt của mọi kịch bản. */
  slot_accuracy: number;
  slot_pairs: number;
  /** Tỷ lệ lượt mà TẤT CẢ slot có nhãn đều đúng — thước đo khắt khe hơn cho cả một lượt. */
  slot_exact_turn_rate: number;
  slot_turns: number;
}

/** So sánh sâu, đủ cho giá trị slot: số, chuỗi, mảng chuỗi và object mốc thời gian. */
export function slotEquals(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((item, index) => slotEquals(item, actual[index]));
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object") return false;
    const left = expected as Record<string, unknown>;
    const right = actual as Record<string, unknown>;
    // So khớp BỘ PHẬN: nhãn chỉ ghi những khoá đáng quan tâm, phần còn lại do hệ thống suy ra.
    return Object.keys(left).every((key) => slotEquals(left[key], right[key]));
  }
  return expected === actual;
}

export function scoreIntent(records: EvalRecord[]): IntentScores {
  const labelled = records.filter((row) => row.expected_intent !== null);
  // Kịch bản nhiều lượt: chấm ý định ở lượt CUỐI, lượt mang yêu cầu đã đủ thông tin.
  const pairs = labelled.map((row) => ({
    expected: row.expected_intent as Intent,
    actual: row.turns[row.turns.length - 1].intent,
  }));

  const classes = INTENTS.map((intent) => {
    const support = pairs.filter((pair) => pair.expected === intent).length;
    const predicted = pairs.filter((pair) => pair.actual === intent).length;
    const truePositive = pairs.filter((pair) => pair.expected === intent && pair.actual === intent).length;
    const precision = predicted === 0 ? 0 : truePositive / predicted;
    const recall = support === 0 ? 0 : truePositive / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { intent, support, predicted, precision, recall, f1 };
  });

  /**
   * Trung bình macro chỉ trên ý định CÓ mẫu trong nhãn.
   *
   * Gộp cả lớp support = 0 thì F1 của lớp đó luôn bằng 0 và macro-F1 tụt theo số ý định mà bộ vàng
   * chưa phủ — con số khi đó nói về độ phủ của bộ vàng chứ không nói về bộ phân loại. Lớp chưa có
   * mẫu vẫn hiện trong bảng `classes` với support = 0 để thấy rõ khoảng trống đó.
   */
  const observed = classes.filter((row) => row.support > 0);
  const macroF1 = observed.length === 0 ? 0 : observed.reduce((sum, row) => sum + row.f1, 0) / observed.length;
  const accuracy = pairs.length === 0 ? 0 : pairs.filter((pair) => pair.expected === pair.actual).length / pairs.length;

  let slotPairs = 0;
  let slotHits = 0;
  let slotTurns = 0;
  let slotExactTurns = 0;
  for (const row of records) {
    for (const turn of row.turns) {
      if (!turn.expected_slots || Object.keys(turn.expected_slots).length === 0) continue;
      slotTurns += 1;
      const keys = Object.keys(turn.expected_slots);
      const hits = keys.filter((key) => slotEquals(turn.expected_slots?.[key], turn.slots[key])).length;
      slotPairs += keys.length;
      slotHits += hits;
      if (hits === keys.length) slotExactTurns += 1;
    }
  }

  return {
    count: pairs.length,
    accuracy,
    macro_f1: macroF1,
    classes,
    slot_accuracy: slotPairs === 0 ? 0 : slotHits / slotPairs,
    slot_pairs: slotPairs,
    slot_exact_turn_rate: slotTurns === 0 ? 0 : slotExactTurns / slotTurns,
    slot_turns: slotTurns,
  };
}
