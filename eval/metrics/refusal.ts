import { FAILURE_CLASSES, type EscalationReasonName, type EvalRecord, type TurnRecord } from "@eval/dataset";
import type { FailureClass } from "@server/domain/agents/failure";

/**
 * Chỉ số từ chối/chuyển tiếp, tách bạch "nhận ra câu ngoài phạm vi" với "chuyển tiếp vì hỏng".
 *
 * Cách đo cũ coi `escalated === true` là từ chối thành công. Cách đó có một lỗ hổng nuốt chửng
 * chính nó: khi tác tử ném lỗi, orchestrator cũng chuyển sang support với lý do OUT_OF_SCOPE
 * (xem nhánh catch trong orchestrator.ts). Nghĩa là một hệ thống hỏng toàn bộ — mất API key, sập
 * sidecar, hết hạn mức — sẽ chuyển tiếp mọi lượt và đạt 100% "từ chối đúng", đúng lúc nó tệ nhất.
 *
 * Nên ở đây một lượt từ chối chỉ được tính là ĐÚNG khi hội đủ ba điều: có chuyển tiếp, lý do khớp
 * nhãn, và trace KHÔNG có nút `agent.threw`. Lượt chuyển tiếp do lỗi hạ tầng được đếm riêng thành
 * `infra_escalation_rate` — nó là chỉ số vận hành, không phải điểm cộng cho khả năng nhận diện.
 */

export interface RefusalRow {
  id: string;
  expected_reason: EscalationReasonName | null;
  actual_reason: EscalationReasonName | null;
  escalated: boolean;
  agent_error: boolean;
  /** Chỉ đúng khi chuyển tiếp có chủ đích VÀ đúng lý do. */
  correct: boolean;
}

export interface RefusalScores {
  out_of_scope_count: number;
  in_scope_count: number;
  /** Chỉ số cũ giữ lại để đối chiếu: có chuyển tiếp hay không, bất kể vì lý do gì. */
  refused_rate: number;
  /** Chuyển tiếp có chủ đích và đúng lý do. Đây là con số cổng dùng. */
  correct_refusal_rate: number;
  /** Trong số lượt đã chuyển tiếp có chủ đích, tỷ lệ ghi đúng lý do. */
  reason_accuracy: number;
  /** Câu HỢP LỆ bị từ chối. Đối trọng của chỉ số trên: đẩy từ chối lên cao thì chỉ số này xấu đi. */
  false_refusal_rate: number;
  /** Lượt chuyển tiếp do tác tử ném lỗi, trên toàn bộ kịch bản. Chỉ số sức khoẻ hạ tầng. */
  infra_escalation_rate: number;
  /**
   * Lý do chuyển tiếp CÓ CHỦ ĐÍCH, tách theo từng loại.
   *
   * Ba loại này đến từ ba nhánh khác nhau của orchestrator và nói ba chuyện khác nhau về hệ
   * thống: `OUT_OF_SCOPE` nghĩa là kho tri thức chưa phủ, `LOW_CONFIDENCE` nghĩa là NLU không
   * hiểu câu hỏi, `USER_REQUEST` nghĩa là khách chủ động xin gặp người. Gộp chúng vào một tỷ lệ
   * "đã chuyển tiếp" thì một đợt NLU kém trông y hệt một đợt khách đông.
   */
  deliberate_by_reason: Record<EscalationReasonName, number>;
  /**
   * Lỗi hạ tầng tách theo NGUYÊN NHÂN.
   *
   * Đây là phần `agent_error` không trả lời được. Một cờ nhị phân nói "hôm nay hỏng 12%" không
   * dẫn tới hành động nào; bốn nhóm dưới đây thì dẫn tới bốn người khác nhau — model, database,
   * sidecar embedding, nhà cung cấp dữ liệu động.
   */
  failures_by_class: Record<FailureClass, number>;
  rows: RefusalRow[];
}

function decisive(record: EvalRecord): TurnRecord {
  return record.turns[record.turns.length - 1];
}

export function scoreRefusal(records: EvalRecord[]): RefusalScores {
  const outside = records.filter((row) => row.out_of_scope);
  const inside = records.filter((row) => !row.out_of_scope);

  const rows: RefusalRow[] = outside.map((row) => {
    const turn = decisive(row);
    const deliberate = turn.escalated && !turn.agent_error;
    return {
      id: row.id,
      expected_reason: row.expected_escalation_reason,
      actual_reason: turn.escalation_reason,
      escalated: turn.escalated,
      agent_error: turn.agent_error,
      correct: deliberate && (row.expected_escalation_reason === null || turn.escalation_reason === row.expected_escalation_reason),
    };
  });

  const deliberate = rows.filter((row) => row.escalated && !row.agent_error);
  const infra = records.filter((row) => decisive(row).agent_error);
  const ratio = (hits: number, total: number): number => (total === 0 ? 0 : hits / total);

  /**
   * Đếm trên MỌI kịch bản, không chỉ kịch bản ngoài phạm vi.
   *
   * `LOW_CONFIDENCE` và `USER_REQUEST` xảy ra ở cả câu hỏi hợp lệ — đó chính là chỗ chúng đáng
   * lo nhất. Chỉ đếm trong nhóm `out_of_scope` sẽ bỏ sót đúng những lượt mà hệ thống lẽ ra phải
   * trả lời được.
   */
  const byReason = { COMPLAINT: 0, LOW_CONFIDENCE: 0, OUT_OF_SCOPE: 0, USER_REQUEST: 0, URGENT: 0 } as Record<EscalationReasonName, number>;
  for (const row of records) {
    const turn = decisive(row);
    if (!turn.escalated || turn.agent_error) continue;
    if (turn.escalation_reason !== null) byReason[turn.escalation_reason] += 1;
  }

  const byClass = Object.fromEntries(FAILURE_CLASSES.map((name) => [name, 0])) as Record<FailureClass, number>;
  for (const row of records) {
    // Đếm trên MỌI lượt, không chỉ lượt cuối: một hội thoại bốn lượt có thể hỏng ở lượt hai rồi
    // phục hồi, và sự cố đó vẫn đã xảy ra.
    for (const turn of row.turns) byClass[turn.failure] += 1;
  }

  return {
    out_of_scope_count: outside.length,
    in_scope_count: inside.length,
    refused_rate: ratio(rows.filter((row) => row.escalated).length, outside.length),
    correct_refusal_rate: ratio(rows.filter((row) => row.correct).length, outside.length),
    reason_accuracy: ratio(deliberate.filter((row) => row.correct).length, deliberate.length),
    /**
     * Lượt hỏi bổ sung slot KHÔNG tính là từ chối: "Bạn dự định đi mấy ngày?" là bước tiến của
     * hội thoại, không phải lời từ chối. Nút slot_gate không bao giờ đặt escalation nên điều kiện
     * `escalated` đã loại nó ra; ghi lại ở đây vì đó là phép so sánh dễ bị nới lỏng về sau.
     */
    false_refusal_rate: ratio(inside.filter((row) => decisive(row).escalated).length, inside.length),
    infra_escalation_rate: ratio(infra.length, records.length),
    deliberate_by_reason: byReason,
    failures_by_class: byClass,
    rows,
  };
}
