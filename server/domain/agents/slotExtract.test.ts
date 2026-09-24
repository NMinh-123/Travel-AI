import { describe, expect, it } from "vitest";
import { extractSlots } from "./slotExtract";
import type { Slots } from "./types";

describe("KT-24…KT-31: slot tất định", () => {
  it.each<[string, Slots]>([
    ["Du lịch 3 ngày 2 đêm", { days: 3 }],
    ["đi 2 đêm", { days: 3 }],
    ["tour 3n2d", { days: 3 }],
    ["đoàn mình 5 người", { travelers: 5 }],
    ["thuê easy rider đi xe máy", { travelMode: "easy_rider" }],
    ["đi bụi tiết kiệm", { budgetLevel: "backpacker" }],
    ["đi tháng 10", {}],
    ["đi 10 ngày", { days: 10 }],
    ["đi ba ngày với hai người", { days: 3, travelers: 2 }],
    ["đi ô tô chụp ảnh", { travelMode: "car_suv", vibe: "photography" }],
    ["đi 31 ngày với 41 người", {}],
  ])("%s", (message, expected) => {
    expect(extractSlots(message)).toEqual(expected);
    expect(extractSlots(message)).not.toHaveProperty("month");
  });
});

/**
 * Khách đổi hạng giữa chừng thường dùng lối SO SÁNH NHẤT thay vì gọi lại tên mức. GS-200 của bộ
 * vàng là đúng ca đó: "Mình muốn đi kiểu tiết kiệm thôi" rồi "Thôi đổi sang loại tốt nhất đi" —
 * câu sau không chứa từ nào trong bảng cũ nên slot kẹt ở `backpacker`, và tác tử ngân sách tính
 * lại theo đúng mức khách vừa bỏ.
 */
describe("đổi hạng ngân sách bằng lối so sánh nhất", () => {
  it.each<[string, Slots]>([
    ["Thôi đổi sang loại tốt nhất đi", { budgetLevel: "luxury" }],
    ["cho mình loại xịn nhất", { budgetLevel: "luxury" }],
    ["chọn chỗ đẹp nhất", { budgetLevel: "luxury" }],
    ["cho mình chỗ rẻ nhất", { budgetLevel: "backpacker" }],
  ])("%s", (message, expected) => {
    expect(extractSlots(message)).toEqual(expected);
  });

  /**
   * "tốt" đứng một mình là hỏi ý kiến, không phải lệnh đổi hạng — nên mẫu neo vào "nhất". Thiếu
   * cái neo đó thì mọi câu khen chê đều lặng lẽ ghi đè ngân sách của khách.
   */
  it.each([
    "chỗ nào tốt để ngắm hoàng hôn?",
    "đường đó có tốt không",
    "quán này ngon không",
  ])("KHÔNG đổi hạng: %s", (message) => {
    expect(extractSlots(message)).not.toHaveProperty("budgetLevel");
  });
});
