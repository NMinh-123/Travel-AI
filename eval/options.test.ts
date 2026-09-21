import { describe, expect, it } from "vitest";
import { parseOptions, sample } from "./options";

describe("KE-20…KE-22: tham số dòng lệnh", () => {
  it("mặc định 30 kịch bản, k = 5, chạy cả hai tập", () => {
    expect(parseOptions([])).toEqual({ limit: 30, k: 5, skipScore: false, help: false });
  });

  it("đọc được bộ lọc tập, k và danh sách ID", () => {
    expect(parseOptions(["--split", "holdout"]).split).toBe("holdout");
    expect(parseOptions(["--split", "all"]).split).toBeUndefined();
    expect(parseOptions(["--k", "10"]).k).toBe(10);
    expect(parseOptions(["--ids", "GS-001,GS-002"]).ids).toEqual(["GS-001", "GS-002"]);
  });

  it.each([
    ["--split", "dev-set"], ["--k", "0"], ["--k", "-1"], ["--limit", "0"],
    ["--ids", "GS-1"], ["--ids", "GS-001,GS-001"], ["--khong-co", "x"],
  ])("từ chối %s %s", (name, value) => {
    expect(() => parseOptions([name, value])).toThrow();
  });

  it("từ chối tham số trùng và tham số thiếu giá trị", () => {
    expect(() => parseOptions(["--limit", "5", "--limit", "6"])).toThrow();
    expect(() => parseOptions(["--limit"])).toThrow();
    expect(() => parseOptions(["--limit", "--ids"])).toThrow();
  });

  it("--results không trộn với tham số chạy đo", () => {
    expect(parseOptions(["--results", "eval/results/x"]).results).toBe("eval/results/x");
    for (const extra of [["--skip-score"], ["--ids", "GS-001"], ["--split", "dev"], ["--limit", "5"], ["--out", "x"]]) {
      expect(() => parseOptions(["--results", "eval/results/x", ...extra])).toThrow();
    }
  });
});

describe("KE-23: cắt bớt khi chạy thử", () => {
  const rows = Array.from({ length: 100 }, (_, i) => i);

  it("giữ nguyên khi không phải cắt", () => {
    expect(sample(rows, 100)).toEqual(rows);
    expect(sample(rows, 200)).toEqual(rows);
    expect(sample([], 5)).toEqual([]);
  });

  it("lấy cách đều chứ không lấy N phần tử đầu, và trả đúng số lượng", () => {
    const picked = sample(rows, 10);
    expect(picked).toHaveLength(10);
    expect(picked[0]).toBe(0);
    // Cuối danh sách phải có đại diện: bộ vàng xếp theo nhóm nên lấy N dòng đầu là bỏ hẳn
    // kịch bản từ chối và kịch bản hội thoại, vốn nằm ở cuối file.
    expect(picked[picked.length - 1]).toBeGreaterThan(80);
    expect(new Set(picked).size).toBe(10);
  });
});
