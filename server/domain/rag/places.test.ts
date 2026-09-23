import { describe, expect, it } from "vitest";
import { qualifiedByOutOfArea } from "./places";

/**
 * Alias là DANH TỪ CHUNG — "chợ tình" của Chợ tình Khâu Vai — bị một địa danh ngoài vùng bổ nghĩa
 * ngay sau nó thì không trỏ vào nơi trong địa bàn. GS-163 ("Chợ tình Sa Pa họp vào tối nào?") từng
 * phân giải ra Khâu Vai và không bị nhận là câu hỏi ngoài địa bàn.
 */
describe("qualifiedByOutOfArea", () => {
  it("địa danh ngoài vùng đứng NGAY SAU khớp thì khớp ấy bị bổ nghĩa", () => {
    const text = "cho tinh sa pa hop vao toi nao";
    expect(qualifiedByOutOfArea(text, "cho tinh".length)).toBe(true);
  });

  it("địa danh ngoài vùng ở chỗ KHÁC trong câu thì không ảnh hưởng", () => {
    // "Đi từ Hà Nội lên Đồng Văn": câu hợp lệ, Hà Nội không bổ nghĩa cho Đồng Văn.
    const text = "di tu ha noi len dong van mat bao lau";
    expect(qualifiedByOutOfArea(text, text.indexOf("dong van") + "dong van".length)).toBe(false);
  });

  it("địa danh trong vùng đứng sau thì không phải bổ nghĩa ngoài vùng", () => {
    const text = "cho tinh khau vai hop vao toi nao";
    expect(qualifiedByOutOfArea(text, "cho tinh".length)).toBe(false);
  });

  it("khớp ở cuối câu thì không có gì để bổ nghĩa", () => {
    expect(qualifiedByOutOfArea("pho co dong van", "pho co dong van".length)).toBe(false);
  });
});
