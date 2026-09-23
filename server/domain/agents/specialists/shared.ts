import { CONCIERGE_SYSTEM_PROMPT } from "@server/domain/prompts";
import {
  generateStructured,
  generateStructuredStream,
  type StructuredCall,
  type StructuredResult,
} from "@server/infra/gemini";
import type { AgentContext } from "@server/domain/agents/types";

/**
 * Giọng điệu dùng chung cho mọi tác tử. Sau Vòng 5, CONCIERGE_SYSTEM_PROMPT chỉ còn vai và văn
 * phong — toàn bộ dữ kiện Hà Giang đã chuyển sang bảng KnowledgeDoc và tới tác tử qua truy xuất.
 *
 * ĐỘ DÀI LÀ MỘT RÀNG BUỘC VỀ ĐỘ TRỄ, KHÔNG PHẢI VỀ VĂN PHONG.
 *
 * Thời gian sinh tăng gần như tuyến tính theo số token đi ra, và đo trên holdout ngày 2026-09-23
 * thì tác tử tri thức trả trung bình 739 token cho những câu hỏi thường chỉ cần ba bốn ý — mỗi
 * trăm token thừa là thêm khoảng một giây khách ngồi nhìn con trỏ chạy.
 *
 * Ràng buộc bằng LỜI NHẮC chứ không bằng `maxOutputTokens`. Mọi lượt ở đây đều trả JSON theo
 * `responseSchema`; cắt cứng ở giữa chừng thì thứ về tới nơi là một JSON thiếu dấu đóng, tức
 * parse hỏng, tức một lượt gọi lại — đúng cái đang phải sửa, chỉ là vì một nguyên nhân khác.
 *
 * Trình lập lịch trình KHÔNG đi qua đây (nó có lời nhắc riêng trong @server/domain/itinerary),
 * nên một lịch trình năm ngày vẫn được dài đúng như nó cần.
 */
export function personaFor(role: string): string {
  return `${CONCIERGE_SYSTEM_PROMPT}

Nhiệm vụ của bạn trong lượt này: ${role}

RÀNG BUỘC TUYỆT ĐỐI:
- Chỉ dùng dữ liệu được cung cấp bên dưới. KHÔNG tự bịa giá, số km, độ cao, số điện thoại hay chính sách.
- Nếu dữ liệu được cung cấp không đủ để trả lời, hãy nói thẳng là chưa có thông tin đó.
- Trả lời bằng tiếng Việt, dùng markdown với bullet rõ ràng.
- NGẮN GỌN: tối đa 6 gạch đầu dòng, mỗi ý gói trong một tới hai câu. Khách đang đọc trên điện thoại giữa đường đèo. Nguồn có nhiều chi tiết thì chọn những ý trả lời thẳng câu hỏi, đừng kể hết những gì đọc được.
- Luôn kèm 3-4 câu hỏi gợi ý tiếp theo, và viết chúng như LỜI CỦA KHÁCH hỏi bạn ở lượt sau, không phải lời bạn mời khách. Khách bấm thẳng vào câu đó và nó được gửi đi nguyên văn dưới tên khách, nên câu mở đầu bằng "Bạn có thể...", "Bạn muốn..." sẽ thành khách nói giọng trợ lý. Ví dụ đúng: "Ngày nào là chặng khó lái nhất?", "Gợi ý homestay dọc cung này giúp mình".`;
}

/** Cắt bớt để prompt không phình theo độ dài hội thoại và chi phí token không trôi. */
export function formatHistory(history: { role: "user" | "assistant"; content: string }[]): string {
  const recent = history.slice(-6);
  if (!recent.length) return "";
  return `\n\nVài lượt trao đổi gần nhất:\n${recent
    .map((turn) => `${turn.role === "user" ? "Khách" : "Trợ lý"}: ${turn.content}`)
    .join("\n")}`;
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/**
 * Một lượt gọi sinh câu trả lời, tự chọn đường streaming hay không theo ngữ cảnh.
 *
 * Bốn tác tử sinh văn xuôi đều gọi qua đây thay vì tự rẽ nhánh, vì chỗ rẽ nhánh này rất dễ bị bỏ
 * sót khi thêm tác tử mới: quên đi thì tác tử đó im lặng suốt lượt rồi mới hiện nguyên câu, mà
 * mọi kiểm thử vẫn xanh — streaming không đổi kết quả trả về, chỉ đổi lúc khách nhìn thấy nó.
 *
 * Tác tử lịch trình KHÔNG dùng hàm này và cũng không nên: câu trả lời ở đó do code dựng từ chính
 * lịch trình vừa sinh, không có token nào chảy ra từ model để mà đẩy sớm.
 */
export function generateReply<T>(
  context: AgentContext,
  call: StructuredCall,
): Promise<StructuredResult<T>> {
  if (!context.stream) return generateStructured<T>(call);
  return generateStructuredStream<T>({
    ...call,
    onDelta: context.stream.delta,
    onReset: context.stream.reset,
  });
}
