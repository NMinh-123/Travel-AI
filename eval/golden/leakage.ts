import type { GoldenCase } from "./schema";

/**
 * BẢO VỆ TẬP HOLDOUT KHỎI RÒ RỈ.
 *
 * Tập giữ riêng chỉ có giá trị chừng nào nó còn LẠ với hệ thống. Nhưng nó rò rỉ rất dễ, và rò rỉ
 * âm thầm: không lệnh nào báo lỗi, không test nào đỏ, chỉ có điểm số đẹp lên một cách không giải
 * thích được. Bốn đường rò dưới đây là những đường mà mã có thể tự canh — bốn đường còn lại nằm
 * ở quy ước làm việc và được ghi trong `eval/README.md`.
 *
 *  1. TRÙNG CÂU HỎI. Cùng một câu, hoặc một câu chỉ khác dấu và khoảng trắng, nằm ở cả hai tập.
 *     Đây là kiểu rò thô nhất và hay xảy ra nhất khi bộ vàng được mở rộng bằng cách sao chép.
 *  2. DIỄN ĐẠT LẠI. Hai câu gần trùng về từ. Không chặn cứng vì tiếng Việt du lịch dùng đi dùng
 *     lại một vốn từ hẹp, nhưng phải NÊU TÊN để người soạn nhìn lại.
 *  3. ĐÁP ÁN MẪU CHÉP TỪ NGUỒN. `reference` trùng nguyên văn một đoạn trong `contexts` nghĩa là
 *     bài kiểm không còn đo khả năng trả lời mà đo khả năng chép lại.
 *  4. TRÙNG `expected_docs` VỚI CÙNG MỘT CÂU HỎI. Hai kịch bản cùng câu hỏi và cùng nhãn tài
 *     liệu ở hai tập khác nhau là cùng một bài kiểm được đếm hai lần.
 *
 * Chạy: `npm run eval:leakage`
 */

export interface LeakageIssue {
  code: "DUPLICATE_QUESTION" | "NEAR_DUPLICATE" | "REFERENCE_COPIED" | "SHARED_LABEL";
  /** Mức nặng. `error` chặn, `warning` chỉ nêu tên để người soạn nhìn lại. */
  level: "error" | "warning";
  dev: string;
  holdout: string;
  message: string;
}

/** Bỏ dấu, bỏ dấu câu, gộp khoảng trắng. Hai câu chỉ khác cách gõ phải ra cùng một chuỗi. */
export function canonical(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(canonical(text).split(" ").filter((word) => word.length > 1));
}

/** Jaccard: phần chung trên phần hợp. Đối xứng, nên không phụ thuộc câu nào dài hơn. */
function similarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Ngưỡng coi hai câu là diễn đạt lại của nhau.
 *
 * 0,8 chứ không thấp hơn, vì vốn từ ở đây rất hẹp: "Đồng Văn có gì" và "Mèo Vạc có gì" đã chia
 * nhau một nửa số từ mà vẫn là hai câu hỏi hoàn toàn khác. Đặt ngưỡng thấp thì báo cáo đầy cảnh
 * báo giả, và người soạn sẽ học cách bỏ qua toàn bộ danh sách.
 */
const NEAR_DUPLICATE = 0.8;

/**
 * Độ dài tối thiểu của một đoạn trùng để đáng xét, và TỶ LỆ khiến nó thành "chép".
 *
 * Đo bằng tỷ lệ chứ không bằng độ dài tuyệt đối, và đó là một lần sửa có nguyên nhân cụ thể: bản
 * đầu báo "chép" khi tìm thấy bất kỳ đoạn 40 ký tự nào trùng, và nó gắn cờ 128 trên 161 kịch bản
 * có nhãn. Đọc lại thì phần lớn là báo nhầm — một đáp án mẫu nói về con đường Hạnh Phúc buộc
 * phải chứa cụm "nối thành phố Hà Giang với Đồng Văn rồi Mèo Vạc", và cụm ấy dài hơn 40 ký tự
 * mà không có cách diễn đạt nào khác. Danh từ riêng và cụm cố định là thứ KHÔNG viết lại được.
 *
 * Thứ đáng gắn cờ là đáp án mẫu mà PHẦN LỚN nội dung là một đoạn liền lấy nguyên từ nguồn. Khi
 * đó bài kiểm không còn đo khả năng trả lời mà đo khả năng chép lại, và `context_recall` của
 * RAGAS — chỉ số duy nhất đọc `reference` — thành 1,0 gần như mặc nhiên.
 */
const MIN_SPAN = 40;
const COPIED_RATIO = 0.5;

/**
 * Đoạn liền dài nhất của `reference` xuất hiện nguyên văn trong `source`, tính theo tỷ lệ độ dài
 * đáp án mẫu.
 *
 * Kéo dài dần từ mỗi vị trí bắt đầu: khi một đoạn đã không có trong nguồn thì mọi đoạn dài hơn
 * bắt đầu từ đó cũng không có, nên vòng lặp dừng sớm và chi phí thực tế thấp hơn nhiều so với
 * hình dạng O(n·m) của nó.
 */
export function longestCopiedRatio(reference: string, source: string): number {
  const target = canonical(reference);
  const text = canonical(source);
  if (target.length < MIN_SPAN) return 0;

  let longest = 0;
  for (let start = 0; start < target.length; start += 1) {
    if (target.length - start <= longest) break;
    let length = longest + 1;
    while (start + length <= target.length && text.includes(target.slice(start, start + length))) {
      longest = length;
      length += 1;
    }
  }
  return longest / target.length;
}

/** `reference` có phải phần lớn là một đoạn lấy nguyên từ nguồn không. */
function referenceCopiesSource(reference: string, sources: string[]): boolean {
  return sources.some((source) => longestCopiedRatio(reference, source) >= COPIED_RATIO);
}

export interface LeakageInput {
  cases: GoldenCase[];
  /** Nội dung tài liệu theo `sourceRef`, để kiểm đáp án mẫu có bị chép từ nguồn không. */
  documents?: Map<string, string>;
}

export function findLeakage(input: LeakageInput): LeakageIssue[] {
  const dev = input.cases.filter((row) => row.split === "dev");
  const holdout = input.cases.filter((row) => row.split === "holdout");
  const issues: LeakageIssue[] = [];

  const devIndex = dev.map((row) => ({ row, key: canonical(row.question), words: tokens(row.question) }));

  for (const test of holdout) {
    const key = canonical(test.question);
    const words = tokens(test.question);

    for (const entry of devIndex) {
      if (entry.key === key) {
        issues.push({
          code: "DUPLICATE_QUESTION",
          level: "error",
          dev: entry.row.id,
          holdout: test.id,
          message: `Cùng một câu hỏi ở cả hai tập: "${test.question}".`,
        });
        continue;
      }

      const score = similarity(words, entry.words);
      if (score >= NEAR_DUPLICATE) {
        issues.push({
          code: "NEAR_DUPLICATE",
          level: "warning",
          dev: entry.row.id,
          holdout: test.id,
          message: `Trùng ${(score * 100).toFixed(0)}% từ vựng với câu ở tập dev — xem lại xem có phải cùng một bài kiểm không.`,
        });
      }

      /**
       * Cùng nhãn tài liệu VÀ cùng chủ đề. Không báo khi chỉ trùng nhãn: một tài liệu dài hoàn
       * toàn có thể trả lời được hai câu hỏi khác nhau, và đó là cách dùng đúng chứ không phải rò.
       */
      const shared = test.expected_docs.filter((ref) => entry.row.expected_docs.includes(ref));
      if (shared.length > 0 && shared.length === test.expected_docs.length && score >= 0.5) {
        issues.push({
          code: "SHARED_LABEL",
          level: "warning",
          dev: entry.row.id,
          holdout: test.id,
          message: `Cùng nhãn tài liệu (${shared.join(", ")}) và cùng chủ đề với một câu ở tập dev.`,
        });
      }
    }

    /**
     * Đáp án mẫu chép nguyên văn từ nguồn.
     *
     * Khi đó bài kiểm không còn đo khả năng trả lời mà đo khả năng chép lại, và điểm RAGAS
     * answer_relevancy sẽ cao một cách vô nghĩa với bất kỳ hệ thống nào biết trích dẫn.
     */
    if (input.documents) {
      const sources = test.expected_docs
        .map((ref) => input.documents?.get(ref))
        .filter((text): text is string => typeof text === "string");
      if (referenceCopiesSource(test.reference, sources)) {
        issues.push({
          code: "REFERENCE_COPIED",
          level: "warning",
          dev: "—",
          holdout: test.id,
          message: "Đáp án mẫu chép nguyên văn một đoạn dài của nguồn; viết lại bằng lời của người soạn.",
        });
      }
    }
  }

  return issues;
}

export function formatLeakage(issues: LeakageIssue[]): string {
  if (issues.length === 0) return "Không phát hiện rò rỉ giữa tập dev và tập holdout.";
  return issues
    .map((issue) => `  [${issue.level === "error" ? "LỖI " : "CẢNH"}] ${issue.code} ${issue.dev} ↔ ${issue.holdout}: ${issue.message}`)
    .join("\n");
}
