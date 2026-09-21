import { describe, expect, it } from "vitest";
import { canonical, findLeakage, longestCopiedRatio, type LeakageIssue } from "./leakage";
import { loadGolden, type GoldenCase } from "./schema";

/**
 * Bài kiểm chống rò rỉ chạy trên CHÍNH bộ vàng của dự án, không chỉ trên dữ liệu dựng sẵn.
 *
 * Đó là điểm khác biệt đáng giá nhất của nhóm này: nó không kiểm một hàm, nó kiểm một tài sản.
 * Một tập giữ riêng đã rò rỉ thì mọi con số báo cáo về sau đều cao hơn thực tế, và không có lệnh
 * nào khác trong dự án phát hiện được điều đó.
 */

const base = (patch: Partial<GoldenCase>): GoldenCase => ({
  id: "GS-001", kind: "qa", group: "food", split: "dev", variant: "clean", out_of_scope: false,
  question: "Thắng cố nấu từ gì?", reference: "Thắng cố nấu từ nội tạng ngựa.",
  expected_docs: ["food:thang-co"], expected_intent: "knowledge", expected_escalation_reason: null,
  turns: [{ message: "Thắng cố nấu từ gì?" }], ...patch,
});

const codes = (issues: LeakageIssue[]): string[] => issues.map((issue) => issue.code);

describe("KR-01: đường rò rỉ mã tự canh được", () => {
  it("bắt câu hỏi trùng nguyên văn giữa hai tập", () => {
    const issues = findLeakage({
      cases: [base({}), base({ id: "GS-002", split: "holdout" })],
    });
    expect(codes(issues)).toContain("DUPLICATE_QUESTION");
    expect(issues[0].level).toBe("error");
  });

  /**
   * Chỉ khác dấu và dấu câu vẫn là cùng một câu. Đây là kiểu rò hay xảy ra nhất khi bộ vàng được
   * mở rộng bằng cách sao chép rồi thêm biến thể không dấu vào tập kia.
   */
  it("bắt câu chỉ khác dấu và dấu câu", () => {
    const issues = findLeakage({
      cases: [
        base({}),
        base({ id: "GS-002", split: "holdout", question: "thang co nau tu gi", variant: "no_diacritics" }),
      ],
    });
    expect(codes(issues)).toContain("DUPLICATE_QUESTION");
  });

  it("nêu tên câu diễn đạt lại, nhưng chỉ ở mức cảnh báo", () => {
    const issues = findLeakage({
      cases: [
        base({ question: "Thắng cố được nấu từ nguyên liệu gì vậy bạn?" }),
        base({ id: "GS-002", split: "holdout", question: "Thắng cố được nấu từ nguyên liệu gì thế bạn?" }),
      ],
    });
    expect(codes(issues)).toContain("NEAR_DUPLICATE");
    expect(issues.every((issue) => issue.level === "warning")).toBe(true);
  });

  /**
   * Vốn từ du lịch rất hẹp, nên hai câu hỏi khác hẳn nhau vẫn chia nhau nhiều từ. Ngưỡng phải đủ
   * cao để không biến báo cáo thành một danh sách cảnh báo giả mà ai cũng học cách bỏ qua.
   */
  it("hai câu khác chủ đề nhưng cùng khuôn không bị báo", () => {
    const issues = findLeakage({
      cases: [
        base({ question: "Đồng Văn có gì chơi?" }),
        base({ id: "GS-002", split: "holdout", question: "Mèo Vạc có gì chơi?" }),
      ],
    });
    expect(issues).toEqual([]);
  });

  it("bắt đáp án mẫu chép nguyên văn từ nguồn", () => {
    const source =
      "Thắng cố là món ăn truyền thống của người Mông, nấu từ nội tạng ngựa cùng mười hai loại " +
      "gia vị bản địa, ninh trong chảo lớn suốt nhiều giờ tại các phiên chợ vùng cao.";
    const issues = findLeakage({
      cases: [base({ id: "GS-002", split: "holdout", reference: source })],
      documents: new Map([["food:thang-co", source]]),
    });
    expect(codes(issues)).toContain("REFERENCE_COPIED");
  });

  it("đáp án mẫu viết lại bằng lời người soạn thì không bị báo", () => {
    const issues = findLeakage({
      cases: [
        base({
          id: "GS-002", split: "holdout",
          reference: "Món này dùng lòng ngựa làm nguyên liệu chính, hầm lâu với gia vị của người Mông.",
        }),
      ],
      documents: new Map([[
        "food:thang-co",
        "Thắng cố là món ăn truyền thống của người Mông, nấu từ nội tạng ngựa cùng mười hai loại gia vị bản địa.",
      ]]),
    });
    expect(codes(issues)).not.toContain("REFERENCE_COPIED");
  });

  it("chuẩn hoá bỏ dấu, dấu câu và khoảng trắng thừa", () => {
    expect(canonical("  Thắng  cố, nấu từ gì?  ")).toBe("thang co nau tu gi");
    expect(canonical("Đồng Văn")).toBe("dong van");
  });

  /**
   * Bài này chốt lại một lần sửa có nguyên nhân cụ thể. Bản đầu báo "chép" khi tìm thấy bất kỳ
   * đoạn 40 ký tự nào trùng, và nó gắn cờ 128 trên 161 kịch bản có nhãn — gần như cả bộ vàng.
   * Đọc lại thì phần lớn là báo nhầm: danh từ riêng và cụm cố định không viết lại được, nên một
   * đáp án mẫu đúng vẫn buộc phải chứa những cụm dài trùng nguồn.
   */
  it("đo theo TỶ LỆ đáp án mẫu, không theo độ dài tuyệt đối của đoạn trùng", () => {
    const source =
      "Con đường Hạnh Phúc là trục xương sống nối thành phố Hà Giang với Đồng Văn rồi Mèo Vạc, " +
      "và trên thực tế nó chính là hành trình chứ không phải một điểm nằm trong hành trình. " +
      "Đặc điểm dễ nhận nhất là con đường hầu như không có đoạn thẳng nào đáng kể.";

    /**
     * Đây là đáp án mẫu THẬT của GS-006, chính ca khiến bản đầu báo nhầm. Cụm "nối thành phố Hà
     * Giang với Đồng Văn rồi Mèo Vạc" dài hơn 40 ký tự và không có cách nào viết khác, nhưng nó
     * chỉ chiếm một phần ba đáp án — phần còn lại là chữ của người soạn.
     */
    expect(longestCopiedRatio(
      "Đường nối thành phố Hà Giang với Đồng Văn rồi Mèo Vạc, bám theo sườn núi và có nhiều khúc " +
        "cua; lề hẹp, nhiều đoạn một bên vách núi một bên vực.",
      source,
    )).toBeLessThan(0.5);

    // Cả câu lấy nguyên từ nguồn: đúng là chép.
    expect(longestCopiedRatio(
      "Đặc điểm dễ nhận nhất là con đường hầu như không có đoạn thẳng nào đáng kể.",
      source,
    )).toBeGreaterThan(0.9);
  });

  it("đáp án mẫu quá ngắn thì không xét, để tránh báo nhầm hàng loạt", () => {
    expect(longestCopiedRatio("Không.", "Không.")).toBe(0);
  });
});

describe("KR-02: bộ vàng THẬT của dự án không rò rỉ", () => {
  it("không có câu hỏi nào trùng giữa tập dev và tập holdout", async () => {
    const issues = findLeakage({ cases: await loadGolden() });
    const errors = issues.filter((issue) => issue.level === "error");
    expect(
      errors,
      errors.map((issue) => `${issue.code} ${issue.dev} ↔ ${issue.holdout}: ${issue.message}`).join("\n"),
    ).toEqual([]);
  });
});
