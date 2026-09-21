import { describe, expect, it } from "vitest";
import { mergeTemporalPhrases, sanitizeModelPhrases } from "./phrases";
import { resolve } from "./router";

const NOW = new Date("2026-09-14T03:00:00Z");

describe("Hồi quy REV-001/002/003", () => {
  it.each(["10", "11", "12"])("REV-001: không cắt tháng %s thành tháng 1", (month) => {
    const message = `đi tháng ${month}`;
    const filtered = sanitizeModelPhrases(["tháng 1"], message);
    expect(filtered).toEqual([]);
    expect(resolve(mergeTemporalPhrases(filtered, message), NOW))
      .toMatchObject({ travelMonth: Number(month), travelYear: 2026 });
  });

  it.each(["/", "-"])("REV-001: giữ năm của ngày đầy đủ với dấu %s", (separator) => {
    const short = `12${separator}10`;
    const full = `${short}${separator}2028`;
    const message = `đi ngày ${full}`;
    expect(sanitizeModelPhrases([short], message)).toEqual([]);
    expect(resolve(mergeTemporalPhrases([short], message), NOW))
      .toMatchObject({ travelDate: "2028-10-12", phrase: full });
  });

  it("REV-001: ranh giới Unicode hai phía, vẫn nhận dấu câu và lần xuất hiện hợp lệ", () => {
    expect(sanitizeModelPhrases(["mai"], "ngàymainày mai2 /mai mai-" )).toEqual([]);
    expect(sanitizeModelPhrases(["tháng 10"], "(tháng 10), nhé")).toEqual(["tháng 10"]);
    expect(sanitizeModelPhrases(["mai"], "ngàymai rồi mai")).toEqual(["mai"]);
  });

  it("REV-001: ký tự regex được đối chiếu nguyên văn", () => {
    expect(sanitizeModelPhrases(["mai.*", "[mai]"], "mai nhé")).toEqual([]);
    expect(sanitizeModelPhrases(["[mai]"], "đi [mai] nhé")).toEqual(["[mai]"]);
  });

  it("REV-002: cùng vị trí thì cụm đầy đủ thắng dù mô hình đứng trước", () => {
    const phrases = mergeTemporalPhrases(["Tết"], "đi Tết Nguyên đán");
    expect(phrases).toEqual(["Tết Nguyên đán", "Tết"]);
    expect(resolve(phrases, NOW).phrase).toBe("Tết Nguyên đán");
  });

  it("REV-003: loại cụm không có trong câu ngay tại hàm hợp", () => {
    expect(mergeTemporalPhrases(["tháng 3", "tháng 1"], "đi tháng 12")).toEqual(["tháng 12"]);
  });

  it("REV-003: sắp theo lần xuất hiện có ranh giới hợp lệ", () => {
    expect(mergeTemporalPhrases(["mai", "tháng 10"], "ngàymai, tháng 10 rồi mai"))
      .toEqual(["tháng 10", "mai"]);
  });
});

describe("Lọc cụm chữ từ mô hình", () => {
  it.each<unknown>([undefined, null, "tháng 10", 42, {}])("KT-53: bỏ đầu vào không phải mảng %j", (raw) => {
    expect(sanitizeModelPhrases(raw, "đi tháng 10")).toEqual([]);
  });

  it("KT-54: bỏ phần tử sai kiểu và cụm rỗng", () => {
    expect(sanitizeModelPhrases([1, null, {}, "", "   ", "tháng 10"], "đi tháng 10"))
      .toEqual(["tháng 10"]);
  });

  it("KT-55: trim trước khi đối chiếu nguyên văn", () => {
    expect(sanitizeModelPhrases(["  tháng 10  "], "đi tháng 10")).toEqual(["tháng 10"]);
  });

  it("KT-56: nhận 60 ký tự, bỏ 61 ký tự dù có nguyên văn", () => {
    const accepted = "a".repeat(60);
    const rejected = "b".repeat(61);
    expect(sanitizeModelPhrases([accepted, rejected], `${accepted} ${rejected}`)).toEqual([accepted]);
  });

  it("KT-56: không nhận diễn giải hoặc đổi hoa thường", () => {
    expect(sanitizeModelPhrases(["tháng mười", "Tháng 10", "tháng 10"], "đi tháng 10"))
      .toEqual(["tháng 10"]);
  });

  it("KT-57: giữ năm cụm hợp lệ đầu tiên sau khi lọc", () => {
    const phrases = ["mai", "mốt", "tuần sau", "tháng sau", "tháng 10", "tháng 11", "Tết"];
    expect(sanitizeModelPhrases([null, "", ...phrases], phrases.join(", ")))
      .toEqual(["mai", "mốt", "tuần sau", "tháng sau", "tháng 10"]);
  });
});

describe("KT-58: hợp cụm mô hình và bộ quét", () => {
  it("cụm cuối tuần cụ thể hơn thắng cụm tuần", () => {
    const phrases = mergeTemporalPhrases(["tuần sau"], "đi cuối tuần sau nhé");
    expect(phrases).toEqual(["cuối tuần sau", "tuần sau"]);
    expect(resolve(phrases, NOW)).toMatchObject({ temporalType: "weekend", phrase: "cuối tuần sau" });
  });

  it("bổ sung cụm bị bỏ sót và khử trùng giữa hai nguồn", () => {
    const phrases = mergeTemporalPhrases(["tháng 10"], "đi tháng 10 hoặc tháng 11");
    expect(phrases).toEqual(["tháng 10", "tháng 11"]);
    expect(resolve(phrases, NOW)).toMatchObject({ phrase: "tháng 10", travelMonth: 10 });
  });

  it("sắp lại khi mô hình đảo thứ tự, giữ nguyên đầu vào", () => {
    const modelPhrases: readonly string[] = Object.freeze(["tháng 11", "tháng 10", "tháng 11"]);
    const phrases = mergeTemporalPhrases(modelPhrases, "đi tháng 10 hoặc tháng 11");
    expect(phrases).toEqual(["tháng 10", "tháng 11"]);
    expect(resolve(phrases, NOW).phrase).toBe("tháng 10");
    expect(modelPhrases).toEqual(["tháng 11", "tháng 10", "tháng 11"]);
  });

  it("bộ quét vẫn chạy khi mô hình không trả cụm nào", () => {
    expect(mergeTemporalPhrases([], "đi ngày mai")).toEqual(["ngày mai"]);
    expect(mergeTemporalPhrases([], "cảm ơn")).toEqual([]);
  });
});
