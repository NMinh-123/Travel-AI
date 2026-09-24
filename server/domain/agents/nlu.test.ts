import { describe, expect, it } from "vitest";
import { asksForHuman } from "./nlu";

/**
 * `wantsHuman` của model sai theo CẢ HAI chiều trên bộ holdout ngày 2026-09-23: bỏ sót lời đòi gặp
 * nhân viên (GS-171) và lời xin cứu giúp (GS-174), còn bật nhầm với câu thuê tài xế (GS-186) dù
 * lược đồ đã ghi rõ ngoại lệ đó.
 */
describe("asksForHuman: đọc tất định lời đòi gặp người", () => {
  it.each([
    "Cho tôi nói chuyện với nhân viên tư vấn thật.",
    "Đoàn tôi đang mắc kẹt vì sạt lở, cần hỗ trợ khẩn cấp.",
    "Cho mình gặp nhân viên",
    "cứu với, xe tụt dốc",
    "Tôi muốn gặp người phụ trách, chatbot không giải quyết được việc của tôi.",
    "Tôi đã chuyển tiền cọc mà cơ sở nói không có đặt chỗ nào, tôi cần người xử lý ngay.",
    "thuê người lái mà xe hỏng giữa đèo, cứu với",
  ])("bắt: %s", (message) => {
    expect(asksForHuman(message)).toBe(true);
  });

  /**
   * Câu HỎI THÔNG TIN an toàn đáng được trả lời bằng chính con số, không đáng bị đẩy vào một hàng
   * đợi chuyển tiếp. Và chữ "nhân viên" đứng trong câu chưa chắc là đòi gặp nhân viên.
   */
  it.each([
    "Có người rơi xuống vực thì gọi số nào?",
    "À cho mình thuê người lái thôi",
    "Nhân viên homestay có nói tiếng Anh không?",
    "Phố cổ Đồng Văn có gì?",
    "Tiền hoàn có thể chuyển sang tài khoản khác được không?",
    "Ninh Bình nên thuê thuyền ở bến nào?",
    "Giải giúp tôi phương trình x bình phương trừ năm x cộng sáu bằng không.",
    "tôi muốn khiếu nại",
  ])("KHÔNG bắt: %s", (message) => {
    expect(asksForHuman(message)).toBe(false);
  });
});
