import { hasLeftoverPlaceholder } from "./pii";
import type { AgentResult } from "./types";

/**
 * Lớp guardrail của SRS Hình 9.2: kiểm tra nội dung đầu ra TRƯỚC khi trả về khách, nhằm chặn rò
 * rỉ dữ liệu cá nhân và các phát ngôn nằm ngoài phạm vi tri thức đã kiểm duyệt.
 */

type GuardrailBlock = "empty" | "insufficient" | "unsupported" | "pii_leak";

/**
 * Phạm vi của từng phép kiểm, và vì sao chúng khác nhau.
 *
 * `insufficient` chỉ áp cho tác tử tri thức, giữ đúng phạm vi cũ của phép kiểm `ungrounded`: bốn
 * tác tử còn lại lấy dữ liệu thẳng từ database hoặc từ máy tính chi phí, và một danh mục rỗng ở
 * đó là câu trả lời hợp lệ ("chưa có điểm nào khớp") chứ không phải một câu không có căn cứ.
 *
 * `unsupported` thì áp cho MỌI tác tử, vì nó không nói về việc có nguồn hay không mà nói về việc
 * câu trả lời đã nêu một con số không có trong nguồn. Tác tử ngân sách là nơi cần nó nhất: lời
 * nhắc ở đó yêu cầu giữ nguyên từng con số, nên một con số lệch là dấu hiệu model đã tự tính lại.
 */
const GROUNDING_SCOPE = new Set(["knowledge"]);

/** Trả về null khi câu trả lời đạt, hoặc lý do bị chặn. */
export function inspect(result: AgentResult, agent: string): GuardrailBlock | null {
  const reply = result.reply.trim();

  if (!reply) return "empty";

  // Placeholder sót lại nghĩa là model đã viết lại hoặc bịa thêm ký hiệu che dữ liệu. Trả nguyên
  // ra thì khách thấy "__PHONE_1__" giữa câu trả lời, và tệ hơn là ta mất dấu dữ liệu thật.
  if (hasLeftoverPlaceholder(reply)) return "pii_leak";

  /**
   * Câu trả lời nêu dữ kiện số không có trong chứng cứ. Đây là ảo giác đã bắt được bằng code
   * (xem `checkNumericFacts`), khác hẳn với việc thiếu nguồn — và nó nguy hiểm hơn, vì một con
   * số sai đi kèm danh sách nguồn trông đầy đủ thì không ai kiểm lại.
   */
  if (result.grounding === "unsupported") return "unsupported";

  /**
   * Tác tử tri thức không truy xuất được đoạn nào, hoặc có đoạn nhưng câu trả lời không dẫn được
   * về đoạn nào — cả hai đều là trigger "câu hỏi nằm ngoài phạm vi kho tri thức" của Mục 10.6.
   *
   * `tool_failed` CỐ Ý không nằm trong nhóm này: khi Open-Meteo hỏng, câu trả lời đúng là nói với
   * khách rằng chưa tra được thời tiết, chứ không phải chuyển tiếp sang người thật với lý do
   * ngoài phạm vi. Gộp hai thứ đó là cách một sự cố hạ tầng bị ghi nhận thành một câu hỏi khó.
   */
  if (GROUNDING_SCOPE.has(agent) && (result.grounding === "no_source" || result.grounding === "insufficient")) {
    return "insufficient";
  }

  return null;
}
