/**
 * Chunking cho kho tri thức, theo SRS Mục 11.4.3: chia theo cấu trúc tài liệu trước, theo kích
 * thước sau. Mỗi cặp câu hỏi–trả lời hoặc mỗi điều khoản là một đoạn độc lập (100–300 token);
 * bài viết điểm đến dài thì cắt 400–600 token với chồng lấn 10–15%, luôn tại ranh giới câu.
 *
 * Việc "chia theo cấu trúc trước" nằm ở scripts/ingest-knowledge.ts — nơi biết đâu là một mục
 * FAQ, đâu là một trường của Destination. File này chỉ lo phần "theo kích thước sau".
 */

export interface ChunkProfile {
  maxTokens: number;
  overlapRatio: number;
}

/**
 * Hai hồ sơ tương ứng hai loại tài liệu trong SRS. `short` dùng cho FAQ và policy: đã là đơn vị
 * ngữ nghĩa trọn vẹn nên gần như không bao giờ bị cắt, và không cần chồng lấn vì cắt giữa một
 * điều khoản mới là vấn đề.
 */
export const CHUNK_PROFILES: Record<"short" | "article", ChunkProfile> = {
  short: { maxTokens: 300, overlapRatio: 0 },
  article: { maxTokens: 600, overlapRatio: 0.12 },
};

/**
 * Ước lượng số token, KHÔNG phải số chính xác của tokenizer.
 *
 * BGE-M3 dùng tokenizer subword của XLM-RoBERTa, chỉ đếm đúng được trong tiến trình Python.
 * Gọi sidecar chỉ để đếm token lúc chunking là thêm một vòng mạng cho mỗi đoạn mà không đổi
 * được gì: con số này chỉ dùng để quyết định chỗ cắt, sai 20% cũng không ảnh hưởng chất lượng
 * truy xuất. Hệ số 1,6 token/từ là mức thường thấy với tiếng Việt có dấu ở tokenizer XLM-R.
 */
const TOKENS_PER_WORD = 1.6;

export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * TOKENS_PER_WORD);
}

/**
 * Tách câu tiếng Việt. Cố tình không dùng thư viện: chỉ cần đủ tốt để tìm ranh giới cắt.
 *
 * Hai chỗ dễ sai đã xử lý: không cắt ở dấu chấm thập phân ("1.520 m", "0,5") và không cắt ở
 * dấu chấm của đơn vị viết liền ("800m."). Điều kiện là sau dấu kết câu phải có khoảng trắng
 * rồi tới chữ hoa hoặc chữ số.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sentences: string[] = [];
  let buffer = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    buffer += char;

    if (char === "\n") {
      const trimmed = buffer.trim();
      if (trimmed) sentences.push(trimmed);
      buffer = "";
      continue;
    }

    if (char !== "." && char !== "!" && char !== "?" && char !== "…") continue;

    const previous = normalized[index - 1] ?? "";
    const next = normalized[index + 1] ?? "";
    const afterNext = normalized[index + 2] ?? "";

    // "1.520" — chữ số ở cả hai bên dấu chấm thì đây là dấu phân cách nghìn, không phải hết câu.
    if (char === "." && /\d/.test(previous) && /\d/.test(next)) continue;

    const endsHere = next === "" || (/\s/.test(next) && (/[A-ZĐÀ-Ỹ0-9"'(]/.test(afterNext) || afterNext === ""));
    if (!endsHere) continue;

    const trimmed = buffer.trim();
    if (trimmed) sentences.push(trimmed);
    buffer = "";
  }

  const tail = buffer.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/**
 * Cắt văn bản thành các đoạn không vượt `maxTokens`, luôn tại ranh giới câu.
 *
 * Chồng lấn được tính bằng cách giữ lại các câu cuối của đoạn trước cho tới khi đủ tỉ lệ — chồng
 * lấn theo câu chứ không theo ký tự, để không có đoạn nào bắt đầu bằng nửa câu.
 *
 * Một câu dài hơn `maxTokens` vẫn được giữ nguyên thành một đoạn: cắt giữa câu làm mất nghĩa,
 * và các đoạn như vậy trong kho này là ngoại lệ hiếm.
 */
export function chunkText(text: string, profile: ChunkProfile): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join(" "));
  };

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (current.length > 0 && currentTokens + sentenceTokens > profile.maxTokens) {
      flush();

      // Giữ lại phần cuối đoạn vừa đóng làm chồng lấn cho đoạn tiếp theo.
      const overlapBudget = Math.floor(profile.maxTokens * profile.overlapRatio);
      const carried: string[] = [];
      let carriedTokens = 0;

      for (let index = current.length - 1; index >= 0 && carriedTokens < overlapBudget; index -= 1) {
        carried.unshift(current[index]);
        carriedTokens += estimateTokens(current[index]);
      }

      current = carried;
      currentTokens = carriedTokens;
    }

    current.push(sentence);
    currentTokens += sentenceTokens;
  }

  flush();
  return chunks;
}
