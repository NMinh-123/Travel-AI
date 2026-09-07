import { CONCIERGE_SYSTEM_PROMPT } from "../../prompts";

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
- Trả lời bằng tiếng Việt, dùng markdown với bullet rõ ràng, và luôn kèm 3-4 câu hỏi gợi ý tiếp theo.`;
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
