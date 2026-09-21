import { dedupe, type EvalRecord } from "@eval/dataset";

/**
 * Chỉ số truy xuất tính TRỰC TIẾP từ nhãn `expected_docs`, không qua model chấm.
 *
 * Bốn điểm RAGAS đo chất lượng câu trả lời chứ không đo tầng truy xuất: `context_precision` và
 * `context_recall` hỏi model xem đoạn lấy về có liên quan tới đáp án mẫu không, nên một truy xuất
 * lấy nhầm tài liệu nhưng nội dung na ná vẫn có thể được chấm cao. Nhãn `expected_docs` nói thẳng
 * tài liệu NÀO là đúng, nên ba chỉ số dưới đây là phép đo tầng truy xuất không cần model, không
 * thiên lệch tự chấm, và chạy được kể cả khi bộ chấm Python hỏng.
 *
 * Quy ước: mọi chỉ số ở đây chỉ tính trên câu TRONG phạm vi có nhãn (`expected_docs` khác rỗng).
 * Câu ngoài phạm vi đúng ra phải truy xuất rỗng nên gộp vào sẽ kéo Recall xuống một cách vô nghĩa.
 */

export interface RetrievalScores {
  k: number;
  count: number;
  recall_at_k: number;
  /**
   * Độ chính xác trích dẫn: trong các tài liệu ĐƯỢC TRÍCH DẪN, bao nhiêu phần là tài liệu đúng.
   *
   * Cần đứng cạnh Recall@k chứ không thay được nó, vì hai chỉ số hỏng theo hai hướng ngược nhau.
   * Recall hỏi "có tìm ra tài liệu đúng không", còn Precision hỏi "có kéo theo tài liệu sai không".
   * Một truy xuất nới rộng để cứu Recall sẽ kéo Precision xuống, và câu trả lời khi đó dẫn nguồn
   * không liên quan — thứ mà khách nhìn thấy trực tiếp dưới dạng trích dẫn sai chỗ.
   */
  precision_at_k: number;
  mrr: number;
  ndcg_at_k: number;
  /** Tỷ lệ câu trong phạm vi mà hệ thống không trích dẫn được đoạn nào. */
  empty_retrieval_rate: number;
  /**
   * Tỷ lệ câu có tài liệu ĐÚNG nằm ở vị trí ĐẦU TIÊN, và trong TOP-3.
   *
   * Hai con số này nói thứ mà Recall@5 và MRR đều không nói thẳng: model đọc danh sách nguồn từ
   * trên xuống và chịu ảnh hưởng nặng nhất từ vài đoạn đầu. Một cấu hình đẩy Recall@5 lên bằng
   * cách nhét thêm ứng viên vào cuối danh sách không giúp câu trả lời tốt hơn chút nào, và hai
   * cột này là chỗ khác biệt ấy lộ ra.
   *
   * MRR gần nhất về ý nghĩa nhưng là một số trung bình điều hoà — khó đọc và khó đặt ngưỡng.
   * "Bao nhiêu phần trăm câu có nguồn đúng ở vị trí đầu" thì đọc là hiểu.
   */
  hit_at_1: number;
  hit_at_3: number;
  rows: RetrievalRow[];
}

export interface RetrievalRow {
  id: string;
  recall_at_k: number;
  precision_at_k: number;
  reciprocal_rank: number;
  ndcg_at_k: number;
  /** Hạng của tài liệu đúng đầu tiên, 1-based; 0 nghĩa là không có trong top-k. */
  first_rank: number;
  empty: boolean;
}

/** Hạng 1-based của tài liệu đúng đầu tiên trong top-k, hoặc 0 nếu không có. */
function firstRelevantRank(retrieved: string[], expected: Set<string>, k: number): number {
  for (let index = 0; index < Math.min(retrieved.length, k); index += 1) {
    if (expected.has(retrieved[index])) return index + 1;
  }
  return 0;
}

/**
 * nDCG@k với gain nhị phân (đúng/sai), chiết khấu log2.
 *
 * Dùng gain nhị phân vì bộ vàng chỉ có nhãn "tài liệu này đúng", không có thang mức độ liên quan.
 * DCG lý tưởng là trường hợp mọi tài liệu đúng nằm ở đầu danh sách — nên nDCG phạt việc xếp tài
 * liệu đúng xuống dưới, điều mà Recall@k không thấy.
 */
function ndcg(retrieved: string[], expected: Set<string>, k: number): number {
  let dcg = 0;
  for (let index = 0; index < Math.min(retrieved.length, k); index += 1) {
    if (expected.has(retrieved[index])) dcg += 1 / Math.log2(index + 2);
  }
  let ideal = 0;
  for (let index = 0; index < Math.min(expected.size, k); index += 1) ideal += 1 / Math.log2(index + 2);
  return ideal === 0 ? 0 : dcg / ideal;
}

export function scoreRetrieval(records: EvalRecord[], k = 5): RetrievalScores {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error("k của Recall@k phải là số nguyên dương");
  const labelled = records.filter((row) => !row.out_of_scope && row.expected_docs.length > 0);
  const rows = labelled.map((row) => {
    // Lượt cuối là lượt đưa ra câu trả lời; các lượt trước trong hội thoại chỉ gom slot.
    const retrieved = dedupe(row.turns[row.turns.length - 1].retrieved_docs);
    const expected = new Set(row.expected_docs);
    const top = retrieved.slice(0, k);
    const hit = top.filter((ref) => expected.has(ref)).length;
    const rank = firstRelevantRank(retrieved, expected, k);
    return {
      id: row.id,
      recall_at_k: hit / expected.size,
      // Mẫu số là số tài liệu THỰC SỰ trích dẫn, không phải k: trích 2 tài liệu và cả hai đều
      // đúng là chính xác 100%, chia cho k sẽ biến nó thành 40% một cách vô nghĩa.
      precision_at_k: top.length === 0 ? 0 : hit / top.length,
      reciprocal_rank: rank === 0 ? 0 : 1 / rank,
      ndcg_at_k: ndcg(retrieved, expected, k),
      first_rank: rank,
      empty: retrieved.length === 0,
    };
  });
  const mean = (pick: (row: RetrievalRow) => number): number =>
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
  return {
    k,
    count: rows.length,
    recall_at_k: mean((row) => row.recall_at_k),
    precision_at_k: mean((row) => row.precision_at_k),
    mrr: mean((row) => row.reciprocal_rank),
    ndcg_at_k: mean((row) => row.ndcg_at_k),
    empty_retrieval_rate: mean((row) => (row.empty ? 1 : 0)),
    // `first_rank === 0` nghĩa là không tìm thấy trong top-k, nên phải loại trừ tường minh —
    // `<= 1` sẽ đếm nhầm mọi lần trượt thành một lần trúng ở vị trí đầu.
    hit_at_1: mean((row) => (row.first_rank === 1 ? 1 : 0)),
    hit_at_3: mean((row) => (row.first_rank >= 1 && row.first_rank <= 3 ? 1 : 0)),
    rows,
  };
}
