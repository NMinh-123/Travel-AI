/**
 * PHÂN LOẠI NGUYÊN NHÂN HỎNG — để một sự cố hạ tầng không bị đọc thành một câu hỏi khó.
 *
 * Trace hiện chỉ ghi được `agent.threw`, tức một cờ nhị phân "có hỏng hay không". Cờ đó đủ để
 * ngăn lỗi hạ tầng được tính thành "từ chối đúng", nhưng không đủ để làm gì tiếp theo: bốn nguyên
 * nhân dưới đây đòi bốn người khác nhau xử lý, và gộp chúng vào một con số nghĩa là mỗi lần tỷ lệ
 * lỗi tăng thì lại phải mở log ra đọc tay.
 *
 *  - `model`     — nhà cung cấp model từ chối, hết hạn mức, trả về thứ không phân giải được.
 *  - `database`  — Postgres không trả lời, hoặc truy vấn hỏng.
 *  - `embedding` — sidecar BGE-M3 không sẵn sàng. Nhánh vector chết, nhánh từ khoá vẫn sống, nên
 *                  triệu chứng là câu trả lời kém đi chứ không phải hệ thống ngừng chạy — kiểu
 *                  hỏng tốn nhiều thời gian truy nhất nếu không gọi tên được.
 *  - `realtime`  — Open-Meteo hoặc nhà cung cấp dữ liệu động khác. KHÔNG bao giờ làm cả lượt hỏng
 *                  (xem `toolResult.ts`), nên nó tới đây qua `toolStatus` chứ không qua exception.
 *
 * Nhận dạng bằng HÌNH DẠNG của lỗi, không bằng chuỗi thông điệp: thông điệp của nhà cung cấp đổi
 * theo phiên bản SDK và có thể chứa URL hoặc khoá, nên không được vừa dựa vào vừa ghi lại.
 */

export type FailureClass = "none" | "model" | "database" | "embedding" | "realtime" | "unknown";

/** Mã lỗi Prisma đều mở đầu bằng P; đây là dấu hiệu chắc chắn nhất của một lỗi database. */
function isPrismaError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && /^P\d{4}$/.test(code);
}

function nameOf(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

/**
 * Xếp một exception vào nhóm nguyên nhân.
 *
 * Thứ tự kiểm đi từ dấu hiệu chắc chắn nhất tới dấu hiệu yếu nhất, và `unknown` là một kết quả
 * hợp lệ chứ không phải thất bại của hàm này: đoán bừa một nhóm cho một lỗi chưa từng gặp sẽ làm
 * bẩn đúng những con số mà nhóm này sinh ra để giữ sạch.
 */
export function classifyFailure(error: unknown): FailureClass {
  if (error === undefined || error === null) return "none";
  if (isPrismaError(error)) return "database";

  const name = nameOf(error);
  const message = messageOf(error);

  // Lỗi do chính mã của dự án ném ra, nhận theo tên lớp chứ không theo nội dung.
  if (name === "AiUnavailableError" || name === "GeminiError") return "model";
  if (name === "EmbeddingError" || name === "EmbedderUnavailableError") return "embedding";

  /**
   * Còn lại phải đoán theo chuỗi, và chỗ này được giữ HẸP có chủ ý.
   *
   * Chỉ nhận những dấu hiệu gần như không thể trùng: tên host của sidecar, tên giao thức của
   * Postgres. Nới rộng ra những từ như "timeout" hay "failed" thì mọi lỗi đều rơi vào một nhóm
   * nào đó và việc phân loại mất hết ý nghĩa.
   */
  if (/embedding|bge-m3|sidecar/i.test(message)) return "embedding";
  if (/prisma|postgres|ECONNREFUSED .*5432/i.test(message)) return "database";
  if (/gemini|generativelanguage|responseSchema/i.test(message)) return "model";

  return "unknown";
}

/**
 * Gộp hai nguồn tín hiệu thành một kết luận cho cả lượt.
 *
 * Exception thắng `toolStatus`: một lượt vừa ném lỗi vừa có tool hỏng thì thứ khiến khách không
 * nhận được câu trả lời là exception, còn tool hỏng chỉ là triệu chứng đi kèm. Ngược lại, tool
 * hỏng mà không có exception nào vẫn phải được ghi nhận — đó chính là nhóm `realtime`, nhóm duy
 * nhất không bao giờ xuất hiện dưới dạng exception.
 */
export function resolveFailure(input: { error?: unknown; toolFailed?: boolean }): FailureClass {
  const fromError = classifyFailure(input.error);
  if (fromError !== "none") return fromError;
  return input.toolFailed ? "realtime" : "none";
}
