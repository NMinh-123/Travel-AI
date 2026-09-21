import { slotEquals } from "@eval/metrics/intent";
import type { EvalRecord } from "@eval/dataset";

/**
 * Chỉ số hội thoại nhiều lượt.
 *
 * Chạy mọi câu với `slots: {}` và `history: []` đo được đúng một lượt đầu tiên, trong khi vòng lặp
 * hỏi bổ sung của Dialog Manager mới là phần dễ hỏng nhất: nó phải GIỮ những gì khách đã nói và
 * GHI ĐÈ đúng thứ khách vừa sửa. Hai việc đó hỏng theo hai kiểu ngược nhau nên phải đo tách ra —
 * "Đi 3 ngày" → "4 người" → "Đổi thành 2 ngày" phải giữ travelers = 4 và cập nhật days = 2, còn
 * một bộ gộp slot ghi đè tất cả hay một bộ chỉ cộng dồn đều sai đúng một nửa số cặp.
 */

export interface ConversationRow {
  id: string;
  turns: number;
  carried: number;
  carried_ok: number;
  updated: number;
  updated_ok: number;
  repeated_ask: string | null;
  completed: boolean;
}

export interface ConversationScores {
  count: number;
  /** Cặp slot lượt trước đã đúng và lượt này phải giữ nguyên. Đo trí nhớ. */
  slot_retention_rate: number;
  retention_pairs: number;
  /** Cặp slot khách vừa sửa hoặc vừa nói lần đầu. Đo khả năng ghi đè. */
  slot_update_accuracy: number;
  update_pairs: number;
  /** Kịch bản mà hệ thống hỏi lại đúng một slot nó đã hỏi ở lượt trước. */
  repeat_ask_rate: number;
  /** Lượt cuối trả lời được thật: không hỏi thêm, không chuyển tiếp. */
  task_completion_rate: number;
  rows: ConversationRow[];
}

export function scoreConversation(records: EvalRecord[]): ConversationScores {
  const conversations = records.filter((row) => row.kind === "conversation");
  const rows: ConversationRow[] = conversations.map((row) => {
    let carried = 0;
    let carriedOk = 0;
    let updated = 0;
    let updatedOk = 0;
    const asked = new Map<string, number>();
    let repeatedAsk: string | null = null;

    for (let index = 0; index < row.turns.length; index += 1) {
      const turn = row.turns[index];
      if (turn.asked_slot) {
        const seen = (asked.get(turn.asked_slot) ?? 0) + 1;
        asked.set(turn.asked_slot, seen);
        if (seen > 1 && repeatedAsk === null) repeatedAsk = turn.asked_slot;
      }
      const expected = turn.expected_slots;
      if (!expected) continue;
      const previous = index === 0 ? null : row.turns[index - 1].expected_slots;
      for (const key of Object.keys(expected)) {
        const ok = slotEquals(expected[key], turn.slots[key]);
        // Một cặp là "giữ" khi lượt trước đã kỳ vọng đúng giá trị đó; mọi trường hợp còn lại —
        // khách vừa nói lần đầu hoặc vừa đổi ý — là "cập nhật".
        const isCarry = previous !== null && Object.hasOwn(previous, key) && slotEquals(previous[key], expected[key]);
        if (isCarry) {
          carried += 1;
          if (ok) carriedOk += 1;
        } else {
          updated += 1;
          if (ok) updatedOk += 1;
        }
      }
    }

    const last = row.turns[row.turns.length - 1];
    return {
      id: row.id,
      turns: row.turns.length,
      carried,
      carried_ok: carriedOk,
      updated,
      updated_ok: updatedOk,
      repeated_ask: repeatedAsk,
      completed: last.asked_slot === null && !last.escalated,
    };
  });

  const total = (pick: (row: ConversationRow) => number): number => rows.reduce((sum, row) => sum + pick(row), 0);
  const carried = total((row) => row.carried);
  const updated = total((row) => row.updated);
  const ratio = (hits: number, denominator: number): number => (denominator === 0 ? 0 : hits / denominator);

  return {
    count: rows.length,
    slot_retention_rate: ratio(total((row) => row.carried_ok), carried),
    retention_pairs: carried,
    slot_update_accuracy: ratio(total((row) => row.updated_ok), updated),
    update_pairs: updated,
    repeat_ask_rate: ratio(rows.filter((row) => row.repeated_ask !== null).length, rows.length),
    task_completion_rate: ratio(rows.filter((row) => row.completed).length, rows.length),
    rows,
  };
}
