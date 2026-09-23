import { describe, expect, it } from "vitest";
import { asksForHuman, resolveWantsHuman } from "./nlu";

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
  ])("KHÔNG bắt: %s", (message) => {
    expect(asksForHuman(message)).toBe(false);
  });
});

describe("resolveWantsHuman: mã được bật tự do, chỉ được tắt trong một ca hẹp", () => {
  it("đọc ra lời đòi gặp người thì bật, kể cả khi model nói không", () => {
    expect(resolveWantsHuman(false, "Cho tôi nói chuyện với nhân viên tư vấn thật.", {})).toBe(true);
  });

  it("câu thuê tài xế mà model bật nhầm thì tắt — đúng quy tắc lược đồ đã ghi", () => {
    expect(resolveWantsHuman(true, "À cho mình thuê người lái thôi", { travelMode: "easy_rider" })).toBe(false);
  });

  it("thuê tài xế KÈM xin cứu giúp thì vẫn bật: không bao giờ bỏ rơi người đang cần giúp", () => {
    expect(
      resolveWantsHuman(true, "thuê người lái mà xe hỏng giữa đèo, cứu với", { travelMode: "easy_rider" }),
    ).toBe(true);
  });

  it("không có tín hiệu tất định nào thì giữ nguyên phán đoán của model", () => {
    expect(resolveWantsHuman(true, "tôi muốn khiếu nại", {})).toBe(true);
    expect(resolveWantsHuman(false, "Đồng Văn có gì?", {})).toBe(false);
  });
});
