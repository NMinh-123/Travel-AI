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
