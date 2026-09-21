import { describe, expect, it } from "vitest";
import { VARIANTS } from "@eval/dataset";
import { loadGolden, parseGolden } from "./schema";

// Cố tình nhận `unknown`: phần lớn bài test dưới đây dựng nhãn HỎNG, nên kiểu chặt ở đây chỉ làm
// trình biên dịch từ chối đúng những trường hợp cần kiểm.
const line = (row: Record<string, unknown>): string => JSON.stringify(row);
const qa = {
  id: "GS-001", kind: "qa", group: "food", split: "dev", question: "Thắng cố nấu thế nào?",
  reference: "Đáp án mẫu.", expected_docs: ["food:food-thang-co"], expected_intent: "knowledge",
};

describe("KE-01…KE-05: bộ vàng", () => {
  it("đủ cỡ, ID liên tục và mọi nguồn đều có thật", async () => {
    const rows = await loadGolden();
    expect(rows.length).toBeGreaterThanOrEqual(150);
    expect(rows.map((row) => row.id)).toEqual(rows.map((_, i) => `GS-${String(i + 1).padStart(3, "0")}`));
  });

  it("chia tập tinh chỉnh và tập giữ riêng, không tập nào quá mỏng", async () => {
    const rows = await loadGolden();
    const holdout = rows.filter((row) => row.split === "holdout");
    expect(holdout.length / rows.length).toBeGreaterThan(0.25);
    expect(holdout.length / rows.length).toBeLessThan(0.45);
    // Tập giữ riêng phải phủ cả ba dạng kịch bản, nếu không nó chỉ đo được một phần hệ thống.
    expect(new Set(holdout.map((row) => row.kind))).toEqual(new Set(["qa", "refusal", "conversation"]));
  });

  it("phủ đủ các nhóm nội dung, các dạng kịch bản và mọi biến thể nhiễu", async () => {
    const rows = await loadGolden();
    expect(new Set(rows.map((row) => row.group)).size).toBeGreaterThanOrEqual(8);
    for (const variant of VARIANTS) {
      expect(rows.filter((row) => row.variant === variant).length, variant).toBeGreaterThanOrEqual(5);
    }
    expect(rows.filter((row) => row.kind === "refusal").length).toBeGreaterThanOrEqual(20);
    expect(rows.filter((row) => row.kind === "conversation").length).toBeGreaterThanOrEqual(15);
  });

  it("kịch bản hội thoại có ít nhất một lượt sửa lại yêu cầu đã nói", async () => {
    const rows = await loadGolden();
    const revisions = rows.filter((row) =>
      row.kind === "conversation" &&
      row.turns.some((turn, index) => {
        const previous = index === 0 ? null : row.turns[index - 1].expected_slots;
        if (!previous || !turn.expected_slots) return false;
        return Object.keys(turn.expected_slots).some((key) => key in previous && previous[key] !== turn.expected_slots?.[key]);
      }));
    expect(revisions.length).toBeGreaterThanOrEqual(5);
  });

  it("mọi kịch bản từ chối đều ghi lý do chuyển tiếp mong đợi", async () => {
    const rows = await loadGolden();
    for (const row of rows.filter((item) => item.out_of_scope)) {
      expect(row.expected_escalation_reason, row.id).not.toBeNull();
      expect(row.expected_docs, row.id).toEqual([]);
    }
  });

  it("câu không dấu thật sự không dấu, câu có dấu thật sự có dấu", async () => {
    const rows = await loadGolden();
    const marked = /[à-ỹđ]/i;
    for (const row of rows) {
      expect(marked.test(row.question), row.id).toBe(row.variant !== "no_diacritics");
    }
  });
});

describe("KE-06: nhãn tự mâu thuẫn bị chặn ngay khi đọc file", () => {
  it("không nhận id trùng, nguồn giả, thiếu đáp án hay sai nhóm", () => {
    expect(() => parseGolden(`${line(qa)}\n${line(qa)}`)).toThrow();
    for (const patch of [
      { expected_docs: ["food:khong-ton-tai"] }, { reference: " " }, { group: "bad" },
      { expected_docs: [] }, { question: 1 }, { split: "test" }, { kind: "khac" },
      { variant: "khac" }, { expected_intent: "khong-co" },
    ]) {
      expect(() => parseGolden(line({ ...qa, ...patch }))).toThrow();
    }
  });

  it("kịch bản trong phạm vi không được mang lý do chuyển tiếp, và ngược lại", () => {
    expect(() => parseGolden(line({ ...qa, expected_escalation_reason: "OUT_OF_SCOPE" }))).toThrow();
    const refusal = { ...qa, kind: "refusal", group: "out_of_scope", expected_docs: [] };
    expect(() => parseGolden(line(refusal))).toThrow();
    expect(() => parseGolden(line({ ...refusal, expected_escalation_reason: "KHONG_CO" }))).toThrow();
    expect(parseGolden(line({ ...refusal, expected_escalation_reason: "OUT_OF_SCOPE" }))[0].out_of_scope).toBe(true);
  });

  it("nhãn không dấu phải khớp nội dung câu hỏi", () => {
    expect(() => parseGolden(line({ ...qa, variant: "no_diacritics" }))).toThrow();
    expect(parseGolden(line({ ...qa, variant: "no_diacritics", question: "Thang co nau the nao?" }))[0].variant).toBe("no_diacritics");
  });

  it("hội thoại cần ít nhất hai lượt, slot có nhãn phải là slot có thật", () => {
    const base = { ...qa, kind: "conversation", group: "itinerary", expected_intent: "itinerary" };
    const { question: _question, ...noQuestion } = base;
    expect(() => parseGolden(line({ ...noQuestion, turns: [{ message: "Đi 3 ngày" }] }))).toThrow();
    expect(() => parseGolden(line({ ...base, turns: [{ message: "a" }, { message: "b" }] }))).toThrow();
    expect(() => parseGolden(line({ ...noQuestion, turns: [{ message: "a" }, { message: "b", expected_slots: { khong_co: 1 } }] }))).toThrow();
    const ok = parseGolden(line({ ...noQuestion, turns: [{ message: "Đi 3 ngày", expected_slots: { days: 3 } }, { message: "Đổi thành 2 ngày", expected_slots: { days: 2 } }] }));
    expect(ok[0].question).toBe("Đổi thành 2 ngày");
    expect(ok[0].turns).toHaveLength(2);
  });
});
