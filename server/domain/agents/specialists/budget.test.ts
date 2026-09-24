import { describe, expect, it } from "vitest";
import { checkNumericFacts } from "@server/domain/agents/grounding";
import { derivedAmounts, describeStatedBudget } from "./budget";

/** GS-199: câu trả lời nhắc lại ngân sách khách nêu từng bị guardrail chặn vì "không có nguồn". */
describe("describeStatedBudget", () => {
  it("ngân sách cả đoàn: quy ra mỗi người và tính khoản thiếu", () => {
    const block = describeStatedBudget("Ngân sách 5 triệu", 4, 9_000_000)!.text;
    expect(block).toContain("(cả đoàn)");
    // Câu model hay viết nhất phải kiểm được bằng chính khối này.
    const reply = "Ngân sách 5.000.000đ cho cả đoàn, tức 1.250.000đ mỗi người, thiếu 4.000.000đ so với dự trù, tức 1.000.000đ mỗi người.";
    expect(checkNumericFacts(reply, [{ id: "B3", kind: "knowledge", label: "", text: block, sourceRef: "" }]).unsupported).toEqual([]);
  });

  it("ngân sách mỗi người: nhân lên cả đoàn", () => {
    const { text: block, groupBudget } = describeStatedBudget("tầm 3 triệu mỗi người", 2, 5_000_000)!;
    expect(groupBudget).toBe(6_000_000);
    expect(block).toContain("(mỗi người)");
    expect(block).toMatch(/Dư so với dự trù cả đoàn/);
  });

  it("không nêu con số tiền thì không có khối nào", () => {
    expect(describeStatedBudget("Đi 3 ngày 2 người hết bao nhiêu?", 2, 5_000_000)).toBeNull();
  });
});

describe("derivedAmounts", () => {
  const table = "- Ăn uống: 600.000đ\n- Lưu trú: 450.000đ\n- Dorm: 150.000đ\n- TỔNG: 8.640.000đ\n- Ngân sách: 5.000.000đ";
  const evidence = [{ id: "B5", kind: "knowledge" as const, label: "", text: derivedAmounts(table, [2, 1, 4]), sourceRef: "" }];

  it("chấp nhận hiệu hai khoản và chia theo số ngày — đúng những câu GS-199 từng bị chặn", () => {
    const reply = "Vẫn thiếu 3.640.000đ, tiết kiệm 300.000đ mỗi người, ăn khoảng 300.000đ/ngày.";
    expect(checkNumericFacts(reply, evidence).unsupported).toEqual([]);
  });

  it("con số không suy ra được vẫn bị chặn", () => {
    expect(checkNumericFacts("Chỉ cần 777.000đ là đủ.", evidence).unsupported).toEqual(["777.000đ"]);
  });
});
