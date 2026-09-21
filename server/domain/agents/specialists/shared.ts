import { CONCIERGE_SYSTEM_PROMPT } from "@server/domain/prompts";

/**
 * Giọng điệu dùng chung cho mọi tác tử. Sau Vòng 5, CONCIERGE_SYSTEM_PROMPT chỉ còn vai và văn
 * phong — toàn bộ dữ kiện Hà Giang đã chuyển sang bảng KnowledgeDoc và tới tác tử qua truy xuất.
 */
export function personaFor(role: string): string {
  return `${CONCIERGE_SYSTEM_PROMPT}

Nhiệm vụ của bạn trong lượt này: ${role}

RÀNG BUỘC TUYỆT ĐỐI:
- Chỉ dùng dữ liệu được cung cấp bên dưới. KHÔNG tự bịa giá, số km, độ cao, số điện thoại hay chính sách.
- Nếu dữ liệu được cung cấp không đủ để trả lời, hãy nói thẳng là chưa có thông tin đó.
- Trả lời bằng tiếng Việt, dùng markdown với bullet rõ ràng.
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
