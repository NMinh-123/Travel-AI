import { GROUNDING_STATUSES, type EvalRecord } from "@eval/dataset";
import type { GroundingStatus } from "@server/domain/agents/grounding";

/**
 * Chỉ số về CĂN CỨ của câu trả lời.
 *
 * Nhóm này đo đúng phần mà `server/domain/agents/grounding.ts` vừa dựng lên, và nó trả lời một
 * câu mà bốn điểm RAGAS không trả lời được: câu trả lời có CHỈ RA ĐƯỢC nguồn của mình không.
 * RAGAS faithfulness hỏi model chấm xem câu trả lời có mâu thuẫn với ngữ cảnh hay không — một
 * câu đúng nhưng không dẫn được nguồn nào vẫn đạt điểm cao ở đó, trong khi với hệ thống này nó
 * là một câu không kiểm được.
 *
 * Cả nhóm tính từ dataset, không tốn lượt gọi model nào.
 */

export interface GroundingRow {
  id: string;
  status: GroundingStatus;
  unsupported: string[];
  /** Câu mang con số mà không dẫn được nguồn. Đưa vào hàng báo cáo để đọc được ngay chỗ hỏng. */
  uncovered: string[];
  cited: number;
  retrieved: number;
}

export interface GroundingScores {
  turns: number;
  statuses: Record<GroundingStatus, number>;
  /** Lượt có chứng cứ và có trả lời — mẫu số của `cited_answer_rate`. */
  answered_with_evidence: number;
  /** Trong số đó, bao nhiêu phần dẫn được ít nhất một tài liệu. */
  cited_answer_rate: number;
  answered: number;
  /** Lượt có ít nhất một dữ kiện số không đối chiếu được với chứng cứ. */
  unsupported_fact_rate: number;
  /** Lượt chuyển sang nhánh "chưa tra được" vì tool hỏng. Chỉ số sức khoẻ, không phải chất lượng. */
  tool_failure_rate: number;
  /**
   * Lượt có tool hỏng nhưng câu trả lời KHÔNG phụ thuộc tool đó.
   *
   * Tách khỏi `tool_failure_rate` vì hai con số nói hai chuyện: một bên là khách không được trả
   * lời, một bên là nhà cung cấp chập nhưng khách không nhận ra. Gộp lại thì một sự cố Open-Meteo
   * kéo dài trông giống hệt một đợt chất lượng đi xuống.
   */
  tool_degraded_rate: number;
  /**
   * ĐỘ PHỦ TRÍCH DẪN: trong các câu mang thông tin của câu trả lời, bao nhiêu phần dẫn được nguồn.
   *
   * Đây là chỉ số bắt được kiểu hỏng mà `cited_answer_rate` mù hoàn toàn. `cited_answer_rate` chỉ
   * hỏi "lượt này có dẫn được tài liệu nào không", nên một câu trả lời sáu câu mà chỉ câu đầu có
   * nguồn vẫn đạt 100%. Mẫu số ở đây là từng câu, nên nó tụt đúng như thực tế: 1/6.
   */
  citation_coverage: number;
  /** Mẫu số của `citation_coverage`: tổng số câu mang thông tin trên toàn bộ lượt đã trả lời. */
  covered_sentence_rows: number;
  /**
   * Tỷ lệ ý model KHAI mà không kèm mã nguồn thật nào.
   *
   * Nhìn từ phía đối diện `citation_coverage`: bên kia hỏi câu trả lời có được phủ không, bên này
   * hỏi lời khai của model có thật không. Một mã bịa và một ý bỏ trống đều rơi vào đây.
   */
  uncited_claim_rate: number;
  /** Mẫu số của `uncited_claim_rate`: tổng số ý model khai. */
  claim_rows: number;
  /**
   * Tỷ lệ lượt còn câu mang CON SỐ mà không dẫn được nguồn.
   *
   * Nhóm nghiêm trọng nhất trong ba chỉ số phủ, vì lời nhắc đã yêu cầu rõ mọi câu có con số phải
   * có mục trích dẫn riêng — còn sót nghĩa là model bỏ qua một ràng buộc đã nói thẳng.
   */
  uncovered_important_rate: number;
  /** Trong các tài liệu ĐƯỢC DẪN, bao nhiêu phần nằm trong nhãn `expected_docs`. */
  citation_precision: number;
  citation_rows: number;
  rows: GroundingRow[];
}

export function scoreGrounding(records: EvalRecord[]): GroundingScores {
  const turns = records.flatMap((row) => row.turns);
  const statuses = Object.fromEntries(GROUNDING_STATUSES.map((status) => [status, 0])) as Record<GroundingStatus, number>;
  for (const turn of turns) statuses[turn.grounding] += 1;

  const answered = turns.filter((turn) => turn.reply.trim().length > 0);
  const withEvidence = answered.filter((turn) => turn.contexts.length > 0);
  const ratio = (hits: number, total: number): number => (total === 0 ? 0 : hits / total);

  /**
   * Độ chính xác trích dẫn chỉ tính trên kịch bản CÓ NHÃN `expected_docs`, và chỉ trên lượt cuối.
   *
   * Không gộp kịch bản từ chối: ở đó không dẫn nguồn nào mới là đúng, nên đưa chúng vào mẫu số
   * sẽ biến một hành vi đúng thành một điểm 0.
   */
  const labelled = records.filter((row) => !row.out_of_scope && row.expected_docs.length > 0);
  let citedTotal = 0;
  let citedCorrect = 0;
  for (const row of labelled) {
    const last = row.turns[row.turns.length - 1];
    const expected = new Set(row.expected_docs);
    citedTotal += last.cited_docs.length;
    citedCorrect += last.cited_docs.filter((ref) => expected.has(ref)).length;
  }

  const rows: GroundingRow[] = records
    .map((row) => {
      const last = row.turns[row.turns.length - 1];
      return {
        id: row.id,
        status: last.grounding,
        unsupported: last.unsupported_facts,
        uncovered: last.uncovered_important,
        cited: last.cited_docs.length,
        retrieved: last.retrieved_docs.length,
      };
    })
    .filter(
      (row) =>
        row.unsupported.length > 0 ||
        row.uncovered.length > 0 ||
        row.status === "unsupported" ||
        (row.retrieved > 0 && row.cited === 0),
    );

  /**
   * Độ phủ cộng dồn theo CÂU, không lấy trung bình của trung bình.
   *
   * Trung bình theo lượt cho mỗi câu trả lời một phiếu bằng nhau, nên một câu trả lời dài mười
   * câu phủ được một nửa và một câu trả lời đúng một câu phủ trọn vẹn sẽ ra 0,75 — che mất đúng
   * chỗ hỏng. Cộng dồn tử số và mẫu số rồi mới chia thì mỗi câu một phiếu, và con số nói về văn
   * bản khách thực sự đọc.
   */
  const sentenceTotal = answered.reduce((sum, turn) => sum + turn.sentences, 0);
  const sentenceCovered = answered.reduce((sum, turn) => sum + turn.covered_sentences, 0);
  const claimTotal = answered.reduce((sum, turn) => sum + turn.claims, 0);
  const claimUncited = answered.reduce((sum, turn) => sum + turn.uncited_claims, 0);

  return {
    turns: turns.length,
    statuses,
    answered_with_evidence: withEvidence.length,
    cited_answer_rate: ratio(withEvidence.filter((turn) => turn.cited_docs.length > 0).length, withEvidence.length),
    answered: answered.length,
    unsupported_fact_rate: ratio(answered.filter((turn) => turn.unsupported_facts.length > 0).length, answered.length),
    tool_failure_rate: ratio(turns.filter((turn) => turn.tool_status === "failed").length, turns.length),
    tool_degraded_rate: ratio(turns.filter((turn) => turn.tool_status === "degraded").length, turns.length),
    citation_coverage: ratio(sentenceCovered, sentenceTotal),
    covered_sentence_rows: sentenceTotal,
    uncited_claim_rate: ratio(claimUncited, claimTotal),
    claim_rows: claimTotal,
    uncovered_important_rate: ratio(
      answered.filter((turn) => turn.uncovered_important.length > 0).length,
      answered.length,
    ),
    citation_precision: ratio(citedCorrect, citedTotal),
    citation_rows: citedTotal,
    rows,
  };
}
