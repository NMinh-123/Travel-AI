/** Mẫu dài đứng trước để không tách "tuần sau" khỏi "cuối tuần sau". */
const TEMPORAL_PATTERNS: readonly string[] = [
  "(?:dịp\\s+)?(?:tết(?:\\s+(?:nguyên\\s+đán|âm\\s+lịch|dương\\s+lịch))?|giỗ\\s+tổ(?:\\s+hùng\\s+vương)?)",
  "dịp\\s+(?:0?2/0?9|30/0?4|0?1/0?5)",
  "cuối\\s+tuần\\s+(?:này|sau|tới)",
  // "cuối tuần" trần phải đứng SAU biến thể có đuôi, nếu không nó khớp trước và "cuối tuần sau"
  // bị hiểu thành cuối tuần này — đúng cái bẫy mà chú thích ở đầu tệp đã cảnh báo.
  "cuối\\s+tuần",
  "(?:đầu|giữa|cuối)\\s+tháng\\s+\\d{1,2}",
  "(?:hôm\\s+nay|ngày\\s+mai|ngày\\s+kia|mốt|mai)",
  // Thứ trong tuần, cả dạng chữ lẫn dạng số ("thứ 7") vì khách gõ cả hai kiểu.
  "(?:thứ\\s+(?:hai|ba|tư|năm|sáu|bảy|[2-7])|chủ\\s+nhật)(?:\\s+(?:này|tới|sau))?",
  "tuần\\s+sau",
  "tháng\\s+(?:sau|\\d{1,2})",
  "\\d{1,2}([/-])\\d{1,2}(?:\\1\\d{4})?",
];

/** Giữ dấu và nguyên văn; bỏ dấu sẽ làm "mốt" khớp nhầm "một người". */
function scanTemporalPhrases(message: string): string[] {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}/-])(?:${TEMPORAL_PATTERNS.join("|")})(?![\\p{L}\\p{N}/-])`, "giu");
  return [...message.matchAll(pattern)].map((match) => match[0]);
}

/** Cùng ranh giới với bộ quét, nhưng phân biệt hoa thường cho cụm mô hình. */
function phraseIndex(phrase: string, message: string): number {
  if (!phrase) return -1;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return message.search(new RegExp(`(?<![\\p{L}\\p{N}/-])${escaped}(?![\\p{L}\\p{N}/-])`, "u"));
}

/** Lọc cụm nguyên văn; đầu ra mô hình chưa được bảo đảm bởi responseSchema. */
export function sanitizeModelPhrases(raw: unknown, message: string): string[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((phrase): phrase is string => typeof phrase === "string")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0 && phrase.length <= 60 && phraseIndex(phrase, message) >= 0)
    .slice(0, 5);
}

/** Chỉ hợp cụm có ranh giới hợp lệ; cùng vị trí thì cụm dài hơn đứng trước. */
export function mergeTemporalPhrases(modelPhrases: readonly string[], message: string): string[] {
  return [...new Set([...modelPhrases, ...scanTemporalPhrases(message)])]
    .map((phrase) => ({ phrase, index: phraseIndex(phrase, message) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length)
    .map(({ phrase }) => phrase);
}
