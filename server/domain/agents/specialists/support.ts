import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { EscalationReason } from "@prisma/client";
import { generateStructured } from "@server/infra/gemini";
import { describeSlots } from "@server/domain/agents/dialog";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";
import { formatHistory, personaFor } from "./shared";

/**
 * Tác tử hỗ trợ & chuyển tiếp nhân viên — FR-BOT-08, theo luồng SRS Hình 10.6.
 *
 * Giá trị cốt lõi nằm ở bước 5-6 của sơ đồ: tổng hợp toàn bộ ngữ cảnh hội thoại thành một bản tóm
 * tắt CÓ CẤU TRÚC gửi kèm, để nhân viên không phải yêu cầu khách nhắc lại những gì đã trình bày
 * với chatbot.
 *
 * NÓI THẲNG VỀ GIỚI HẠN: bản tóm tắt được ghi vào bảng ChatEscalation nhưng **hiện chưa có ai đọc
 * được nó** — hệ thống chưa có vai trò CSKH, chưa có RBAC (FR-ACC-06), chưa có back-office
 * (FR-ADM). Vì vậy câu trả lời cho khách TUYỆT ĐỐI không được hứa thời gian phản hồi. Cùng nguyên
 * tắc đã áp ở Footer.tsx Vòng 2: không để giao diện hứa một thứ hệ thống không thực hiện được.
 */

const SUPPORT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        "Câu trả lời cho khách, định dạng markdown. Thừa nhận vấn đề, nói rõ đã ghi nhận và " +
        "sẽ chuyển cho nhân viên, KHÔNG hứa mốc thời gian cụ thể nào.",
    },
    summary: {
      type: Type.STRING,
      description:
        "Bản tóm tắt có cấu trúc dành cho nhân viên CSKH: vấn đề của khách, thông tin đã thu " +
        "thập, và việc cần làm tiếp. Viết cho nhân viên đọc, không phải cho khách.",
    },
    suggestions: {
      type: Type.ARRAY,
      description:
        "2-3 câu do CHÍNH KHÁCH nói tiếp ở lượt sau, không phải câu bạn hỏi khách: giao diện " +
        "biến mỗi câu thành một nút và bấm là gửi đi nguyên văn dưới tên khách. " +
        "Đúng: 'Mình muốn nhân viên gọi lại', 'Mình gửi thêm ảnh chụp màn hình được không?', " +
        "'Mình cần hỗ trợ gấp trong hôm nay'. " +
        "Sai: 'Bạn có thể cho mình biết thêm không?', 'Bạn muốn chia sẻ thêm gì không?'.",
      items: { type: Type.STRING },
    },
  },
  required: ["reply", "summary", "suggestions"],
};

/** Số khẩn cấp quốc gia, trùng với danh sách đã xác minh ở Footer.tsx. */
const EMERGENCY_NOTE =
  "\n\n> **Nếu đây là tình huống khẩn trên đường đèo**, gọi ngay 113 (cảnh sát), " +
  "115 (cấp cứu) hoặc 114 (cứu hoả & cứu nạn cứu hộ) thay vì chờ phản hồi ở đây.";

export async function runSupport(
  context: AgentContext,
  reason: EscalationReason,
): Promise<AgentResult> {
  const { data, metrics } = await generateStructured<{
    reply: string;
    summary: string;
    suggestions: string[];
  }>({
    tier: "light",
    systemInstruction: personaFor(
      "tiếp nhận tình huống vượt khả năng xử lý tự động và chuyển tiếp cho nhân viên. " +
        "Thừa nhận vấn đề của khách một cách chân thành. " +
        "TUYỆT ĐỐI KHÔNG hứa thời gian phản hồi, không nói 'nhân viên sẽ liên hệ trong X phút'.",
    ),
    temperature: 0.5,
    schema: SUPPORT_SCHEMA,
    contents: `Lý do chuyển tiếp: ${reason}
Tin nhắn của khách: ${context.message}${formatHistory(context.history)}

Thông tin đã thu thập được trong phiên:
${describeSlots(context.slots)}`,
  });

  // Model hỏng thì vẫn phải chuyển tiếp được — đây là lối thoát cuối cùng của hệ thống, không
  // được phép phụ thuộc vào việc model trả lời thành công.
  const fallbackReply =
    "Mình chưa xử lý được yêu cầu này. Mình đã ghi nhận lại nội dung trao đổi để nhân viên hỗ trợ xem qua.";
  const fallbackSummary = `[${reason}] Khách hỏi: ${context.message}\nSlot đã thu thập: ${describeSlots(context.slots)}`;

  return {
    reply: (data?.reply?.trim() || fallbackReply) + EMERGENCY_NOTE,
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 3) : [],
    // Câu chuyển tiếp không nêu dữ kiện nào nên không có gì để chứng minh; đánh dấu `grounded`
    // để guardrail không chặn chính lối thoát cuối cùng của hệ thống.
    grounding: "grounded",
    evidence: [],
    retrievedDocIds: [],
    citedDocIds: [],
    escalation: { reason, summary: data?.summary?.trim() || fallbackSummary },
    calls: [metrics],
  };
}
