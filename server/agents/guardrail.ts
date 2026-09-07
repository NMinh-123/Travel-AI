import { hasLeftoverPlaceholder } from "./pii";
import type { AgentResult } from "./types";

/**
 * Lớp guardrail của SRS Hình 9.2: kiểm tra nội dung đầu ra TRƯỚC khi trả về khách, nhằm chặn rò
 * rỉ dữ liệu cá nhân và các phát ngôn nằm ngoài phạm vi tri thức đã kiểm duyệt.
 */

export type GuardrailBlock = "empty" | "ungrounded" | "pii_leak";

/** Trả về null khi câu trả lời đạt, hoặc lý do bị chặn. */
export function inspect(result: AgentResult, agent: string): GuardrailBlock | null {
  const reply = result.reply.trim();

  if (!reply) return "empty";

  // Placeholder sót lại nghĩa là model đã viết lại hoặc bịa thêm ký hiệu che dữ liệu. Trả nguyên
  // ra thì khách thấy "__PHONE_1__" giữa câu trả lời, và tệ hơn là ta mất dấu dữ liệu thật.
  if (hasLeftoverPlaceholder(reply)) return "pii_leak";

  // Tác tử tri thức mà không truy xuất được đoạn nào thì không được trả lời tự do. Đây là trigger
  // "câu hỏi nằm ngoài phạm vi kho tri thức" của SRS Mục 10.6 — biện pháp trực tiếp nhất chống
  // "ảo giác" ở Mục 13.
  if (agent === "knowledge" && !result.grounded) return "ungrounded";

  return null;
}
