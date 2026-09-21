import { config } from "@server/config";

/**
 * Tách từ tiếng Việt cho nhánh tìm kiếm từ khoá (SRS Mục 11.4.3).
 *
 * Vì sao cần: tiếng Việt là ngôn ngữ đơn lập, ranh giới từ không trùng ranh giới khoảng trắng —
 * "cao nguyên đá" là một khái niệm nhưng Postgres thấy ba token rời. Tách từ trước khi đánh chỉ
 * mục làm nhánh từ khoá chính xác hơn rõ rệt. Nhánh vector không cần: BGE-M3 dùng tokenizer
 * subword nên tự xử lý.
 *
 * Vì sao mặc định TẮT:
 *
 * 1. Chưa đo được. SRS yêu cầu mọi cải thiện chất lượng phải được kiểm chứng trên tập đánh giá
 *    của dự án, mà bộ câu hỏi vàng chưa thuộc phạm vi vòng này.
 * 2. underthesea không nằm trong requirements.txt, nên bật cờ mà chưa cài thì sidecar trả 501.
 *
 * RÀNG BUỘC QUAN TRỌNG: tách từ phải ĐỐI XỨNG giữa ingest và truy vấn. Bật cờ này thì phải chạy
 * lại toàn bộ ingest, nếu không thì chỉ mục lưu văn bản chưa tách còn truy vấn đã tách — không
 * lỗi, không cảnh báo, chỉ là không khớp được gì.
 */
export async function segmentForSearch(text: string): Promise<string> {
  const [segmented] = await segmentBatch([text]);
  return segmented;
}

export async function segmentBatch(texts: string[]): Promise<string[]> {
  if (!config.viSegmentEnabled) return texts;

  try {
    const response = await fetch(`${config.embeddingServiceUrl}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      // 501 = chưa cài underthesea. Nói rõ nguyên nhân thay vì im lặng rơi về nguyên văn, vì
      // rơi về nguyên văn ở phía truy vấn trong khi chỉ mục đã tách từ là một lỗi khớp âm thầm.
      console.warn(
        `Tách từ thất bại (HTTP ${response.status}), dùng nguyên văn. ` +
          `Nếu chỉ mục đã được tạo với VI_SEGMENT_ENABLED=true thì recall sẽ giảm.`,
      );
      return texts;
    }

    const payload = (await response.json()) as { texts?: string[] };
    if (!Array.isArray(payload.texts) || payload.texts.length !== texts.length) return texts;
    return payload.texts;
  } catch (error) {
    console.warn("Không gọi được dịch vụ tách từ, dùng nguyên văn:", error);
    return texts;
  }
}
