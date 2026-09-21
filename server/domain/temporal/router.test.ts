import { describe, expect, it } from "vitest";
import { resolve } from "./router";

/**
 * Mốc cố định cho mọi ca dưới đây: thứ Tư 16/09/2026. Chọn giữa tuần có chủ ý — thứ Bảy và Chủ
 * nhật của tuần này còn ở phía trước, nên phân biệt được "cuối tuần này" với "cuối tuần sau", và
 * "thứ tư" (chính hôm nay) với "thứ tư tới".
 */
const NOW = new Date("2026-09-16T03:00:00Z");

describe("cuối tuần", () => {
  it("cụm trần hiểu như cuối tuần này", () => {
    expect(resolve(["cuối tuần"], NOW)).toMatchObject({
      temporalType: "weekend",
      travelDateRange: { start: "2026-09-19", end: "2026-09-20" },
    });
  });

  it("cuối tuần này trùng với cụm trần", () => {
    expect(resolve(["cuối tuần này"], NOW).travelDateRange).toEqual({
      start: "2026-09-19",
      end: "2026-09-20",
    });
  });

  /** Mẫu "cuối tuần" trần đứng sau trong bảng, nếu đảo thứ tự thì ca này trả về tuần hiện tại. */
  it("cuối tuần sau sang tuần kế, không bị cụm trần nuốt mất phần đuôi", () => {
    expect(resolve(["cuối tuần sau"], NOW).travelDateRange).toEqual({
      start: "2026-09-26",
      end: "2026-09-27",
    });
  });
});

describe("thứ trong tuần", () => {
  it.each([
    ["thứ bảy", "2026-09-19"],
    ["thứ 7", "2026-09-19"],
    ["chủ nhật", "2026-09-20"],
    ["thứ hai", "2026-09-21"],
  ])("%s quy về ngày gần nhất phía trước", (phrase, expected) => {
    expect(resolve([phrase], NOW)).toMatchObject({
      temporalType: "relative_day",
      travelDate: expected,
    });
  });

  it("nhắc đúng thứ của hôm nay thì vẫn là hôm nay", () => {
    expect(resolve(["thứ tư"], NOW).travelDate).toBe("2026-09-16");
  });

  it("hậu tố tới loại hôm nay ra khỏi lựa chọn", () => {
    expect(resolve(["thứ tư tới"], NOW).travelDate).toBe("2026-09-23");
  });

  it("hậu tố sau đẩy thêm một tuần", () => {
    expect(resolve(["thứ bảy sau"], NOW).travelDate).toBe("2026-09-26");
  });
});

describe("không nhận nhầm", () => {
  it("cụm không phải thời gian thì trả về none", () => {
    expect(resolve(["thứ đồ ăn"], NOW).temporalType).toBe("none");
  });

  /**
   * Ca này chống lưng cho `forecastDaysFor` ở tác tử tri thức: không có ngày cụ thể nghĩa là
   * không gọi tool thời tiết, vì dự báo không với tới tháng 11 và số đo hôm nay thì không nói
   * được gì về nó.
   */
  it("tháng xa vẫn là month, không có ngày cụ thể", () => {
    const out = resolve(["tháng 11"], NOW);
    expect(out).toMatchObject({ temporalType: "month", travelMonth: 11 });
    expect(out).not.toHaveProperty("travelDate");
    expect(out).not.toHaveProperty("travelDateRange");
  });
});
