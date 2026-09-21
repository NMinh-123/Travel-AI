import { describe, expect, it } from "vitest";
import { describeSlots, mergeSlots, parseSlots } from "./dialog";
import { extractSlots } from "./slotExtract";
import { resolve } from "@server/domain/temporal/router";
import { parseTemporalContext } from "@server/domain/temporal/types";

const NOW = new Date("2026-09-14T03:00:00Z");

describe("KT-32…KT-38: tích luỹ và khôi phục slot", () => {
  it("ba lượt 3 ngày → không bổ sung → à thôi 4 ngày", () => {
    const first = mergeSlots({}, extractSlots("3 ngày"));
    const second = mergeSlots(first, extractSlots("cảm ơn"));
    expect(mergeSlots(second, extractSlots("à thôi 4 ngày"))).toEqual({ days: 4 });
    expect(first).toEqual({ days: 3 });
  });
  it("cộng dồn địa danh, khử trùng không phân biệt hoa thường, giữ tối đa 6", () => {
    const current = { destinations: ["Đồng Văn", "Mèo Vạc"] };
    expect(mergeSlots(current, { destinations: ["đồng văn", "Lũng Cú"] }).destinations).toEqual(["Đồng Văn", "Mèo Vạc", "Lũng Cú"]);
    expect(mergeSlots(current, { destinations: ["A", "B", "C", "D", "E"] }).destinations).toEqual(["Mèo Vạc", "A", "B", "C", "D", "E"]);
    expect(current.destinations).toEqual(["Đồng Văn", "Mèo Vạc"]);
  });
  it("thay nguyên khối temporal và giữ nguyên nếu lượt mới không nêu thời gian", () => {
    const old = resolve(["cuối tuần này"], NOW);
    const fresh = resolve(["tháng 11"], NOW);
    const current = { days: 3, temporal: old };
    expect(mergeSlots(current, { temporal: fresh })).toEqual({ days: 3, temporal: fresh });
    expect(mergeSlots(current, { temporal: fresh }).temporal).not.toHaveProperty("travelDateRange");
    expect(mergeSlots(current, { travelers: 2 }).temporal).toEqual(old);
    expect(current.temporal).toEqual(old);
  });
  it("phiên cũ bỏ qua month, không mất số ngày", () => {
    expect(parseSlots({ days: 3, month: 10 })).toEqual({ days: 3 });
  });
  it.each([null, "sai", [], {}, { temporalType: "month" }, { queryDate: "2026-02-31" }])("temporal sai hình dạng: %j", (temporal) => {
    expect(parseSlots({ days: 3, temporal })).toEqual({ days: 3 });
  });
  it("nạp lại JSON và mô tả tháng/mùa", () => {
    const temporal = resolve(["tháng 10"], NOW);
    expect(parseSlots(JSON.parse(JSON.stringify({ days: 3, temporal })))).toEqual({ days: 3, temporal });
    expect(describeSlots({ temporal })).toContain("tháng 10/2026");
    expect(describeSlots({ temporal })).toContain("hoa tam giác mạch");
    expect(describeSlots({ temporal })).not.toContain("Tháng dự kiến đi");
  });
  it.each([
    { travelMonth: 13 }, { travelMonth: 9 }, { travelYear: 2025 },
    { seasons: ["quanh_nam"] }, { seasons: ["khong_co"] },
    { travelDate: "2026-02-31" }, { travelDateRange: { start: "2026-10-13", end: "2026-10-12" } },
    { temporalType: "unsupported" }, { phrase: 42 }, { holiday: { name: "Tết" } },
  ])("từ chối JSON không nhất quán: %j", (patch) => {
    expect(parseTemporalContext({ ...resolve(["12/10"], NOW), ...patch })).toBeUndefined();
  });
  it("từ chối range cho ngày đơn, date cho tháng, và holiday không giao với ngày đi", () => {
    expect(parseTemporalContext({ ...resolve(["12/10"], NOW), travelDate: undefined })).toBeUndefined();
    expect(parseTemporalContext({ ...resolve(["tháng 10"], NOW), travelDate: "2026-10-12" })).toBeUndefined();
    expect(parseTemporalContext({ ...resolve(["12/10"], NOW), holiday: resolve(["Tết"], NOW).holiday })).toBeUndefined();
  });
});
