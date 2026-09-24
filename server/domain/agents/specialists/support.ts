import type { EscalationReason } from "@prisma/client";
import { describeSlots } from "@server/domain/agents/dialog";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";

/**
 * Tác tử hỗ trợ — lối thoát khi trợ lý không trả lời được.
 *
 * CHƯA CHUYỂN KHÁCH SANG NHÂN VIÊN. Dự án chưa có bộ phận chăm sóc khách hàng; luồng chuyển tiếp
 * (FR-BOT-08, SRS Hình 10.6) chỉ được dựng sau khi có đối tác cung cấp dịch vụ đi lại, ăn ở. Cho
 * tới lúc đó khách nhận một thông báo THIẾU THÔNG TIN và không được hứa có người liên hệ lại.
 *
 * Câu thông báo là văn bản cố định chứ không do model viết: nó không nêu dữ kiện nào nên model
 * không thêm được giá trị gì, còn một lượt gọi model ở đây là thêm độ trễ và thêm một chỗ để hỏng
 * đúng ở lối thoát cuối cùng của hệ thống.
 *
 * Lý do và bản tóm tắt vẫn được trả về để ghi vào bảng ChatEscalation: đó là danh sách câu hỏi
 * trợ lý chưa trả lời được, dùng để bổ sung dữ liệu, và là hàng đợi sẵn có khi dựng CSKH sau này.
 */

const MISSING_INFO =
  "Hiện mình **chưa có đủ thông tin** để trả lời chính xác câu này. Dữ liệu của trợ lý tập trung " +
  "vào du lịch Hà Giang: cung đường, điểm đến, lưu trú, ăn uống, thời tiết và chi phí. Bạn thử hỏi " +
  "cụ thể hơn, ví dụ nêu rõ địa danh, số ngày hoặc thời điểm đi nhé.";

const NO_SUPPORT_DESK =
  "Hiện trợ lý **chưa có bộ phận hỗ trợ trực tiếp**, nên mình chưa kết nối bạn với nhân viên được. " +
  "Bạn cứ mô tả điều cần hỏi về chuyến đi Hà Giang, mình sẽ tra trong dữ liệu để trả lời.";

const REPLIES: Record<EscalationReason, string> = {
  OUT_OF_SCOPE: MISSING_INFO,
  LOW_CONFIDENCE: MISSING_INFO,
  USER_REQUEST: NO_SUPPORT_DESK,
  URGENT: NO_SUPPORT_DESK,
  COMPLAINT:
    "Mình xin lỗi vì trải nghiệm chưa tốt. Hiện trợ lý **chưa có bộ phận hỗ trợ trực tiếp** để xử " +
    "lý khiếu nại, và mình chưa có đủ thông tin để giải quyết vấn đề này.",
};

const SUGGESTIONS = [
  "Gợi ý lịch trình 3 ngày Hà Giang",
  "Thời tiết Đồng Văn mấy hôm tới",
  "Đi đèo Mã Pì Lèng cần lưu ý gì?",
];

/** Số khẩn cấp quốc gia, trùng với danh sách đã xác minh ở Footer.tsx. */
const EMERGENCY_NOTE =
  "\n\n> **Nếu đây là tình huống khẩn trên đường đèo**, gọi ngay 113 (cảnh sát), " +
  "115 (cấp cứu) hoặc 114 (cứu hoả & cứu nạn cứu hộ).";

export async function runSupport(
  context: AgentContext,
  reason: EscalationReason,
): Promise<AgentResult> {
  return {
    /**
     * Khách đòi gặp người có thể đang gặp nạn thật — GS-174 "Đoàn tôi đang mắc kẹt vì sạt lở" đi
     * vào nhánh này — nên với hai lý do đó số cứu hộ đứng ĐẦU, không nằm dưới lời mời tự tra.
     */
    reply: reason === "USER_REQUEST" || reason === "URGENT"
      ? `${EMERGENCY_NOTE.trimStart()}\n\n${REPLIES[reason]}`
      : REPLIES[reason] + EMERGENCY_NOTE,
    suggestions: SUGGESTIONS,
    // Câu thông báo không nêu dữ kiện nào nên không có gì để chứng minh; đánh dấu `grounded`
    // để guardrail không chặn chính lối thoát cuối cùng của hệ thống.
    grounding: "grounded",
    evidence: [],
    retrievedDocIds: [],
    citedDocIds: [],
    escalation: {
      reason,
      summary: `[${reason}] Khách hỏi: ${context.message}\nSlot đã thu thập: ${describeSlots(context.slots)}`,
    },
    calls: [],
  };
}
