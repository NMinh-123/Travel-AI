import { describe, expect, it } from "vitest";
import { hasAnaphora, rewriteQuery } from "./rewrite";

/**
 * Viết lại truy vấn được đo RIÊNG, đúng như yêu cầu: mỗi phép áp dụng đều có tên trong `applied`,
 * nên đếm được nhóm nào có ích và nhóm nào chỉ thêm nhiễu.
 *
 * Điều bài test này canh chặt nhất là chiều NGƯỢC LẠI: viết lại không được THÊM thông tin khách
 * chưa nói. Một câu bị gắn nhầm tên địa danh sẽ đi thẳng vào bộ lọc, nơi không còn lớp nào kiểm.
 */

describe("KQ-01: đại từ thay cho địa danh", () => {
  it("nhận ra các cách nói đại từ hay gặp", () => {
    for (const message of [
      "Ở đó ăn sáng thì nên ăn gì?",
      "Chỗ này có đắt không?",
      "Khu đó đi lại thế nào?",
      "Quanh đấy có homestay nào không?",
      "Vùng ấy mùa nào đẹp?",
    ]) {
      expect(hasAnaphora(message), message).toBe(true);
    }
  });

  it("không nhận nhầm câu đã nêu rõ nơi chốn", () => {
    expect(hasAnaphora("Đồng Văn có gì chơi?")).toBe(false);
    expect(hasAnaphora("Thắng cố nấu bằng gì?")).toBe(false);
  });

  /**
   * GẮN THÊM tên vào cuối, không thay chữ trong câu. Thay chữ đòi viết lại ngữ pháp cho đúng —
   * "Chỗ này có đắt không" mà thay thẳng sẽ thành "Chỗ Đồng Văn có đắt không".
   */
  it("mang địa danh của lượt trước sang, và giữ nguyên câu khách viết", () => {
    const result = rewriteQuery({
      message: "Ở đó ăn sáng thì nên ăn gì?",
      carriedPlaces: ["Phố cổ Đồng Văn"],
    });
    expect(result.applied).toContain("anaphora");
    expect(result.resolvedPlaces).toEqual(["Phố cổ Đồng Văn"]);
    expect(result.query).toContain("Ở đó ăn sáng thì nên ăn gì?");
    expect(result.query).toContain("Phố cổ Đồng Văn");
  });

  it("chỉ mang MỘT địa danh, để bộ lọc không rộng hơn cả khi không lọc", () => {
    const result = rewriteQuery({
      message: "Ở đó ăn gì?",
      carriedPlaces: ["Đồng Văn", "Mèo Vạc", "Yên Minh"],
    });
    expect(result.resolvedPlaces).toEqual(["Đồng Văn"]);
  });

  it("không có gì để mang thì không viết lại", () => {
    const result = rewriteQuery({ message: "Ở đó ăn gì?", carriedPlaces: [] });
    expect(result.applied).toEqual([]);
    expect(result.query).toBe("Ở đó ăn gì?");
  });

  it("câu không có đại từ thì KHÔNG bị gắn thêm địa danh nào", () => {
    const result = rewriteQuery({
      message: "Thắng cố nấu bằng gì?",
      carriedPlaces: ["Mèo Vạc"],
    });
    expect(result.resolvedPlaces).toEqual([]);
    expect(result.query).toBe("Thắng cố nấu bằng gì?");
  });
});

describe("câu nối tiếp lược chủ ngữ", () => {
  it.each(["Nên đi buổi sáng hay buổi chiều?", "Giá vé bao nhiêu?", "Khi nào đẹp nhất?", "Có nên đi buổi tối không?"])(
    "mang địa danh sang: %s",
    (message) => {
      const result = rewriteQuery({ message, carriedPlaces: ["hẻm Tu Sản"] });
      expect(result.applied).toEqual(["ellipsis"]);
      expect(result.resolvedPlaces).toEqual(["hẻm Tu Sản"]);
    },
  );

  it("chữ đứng giữa câu không tính: 'giá' trong câu tự có chủ ngữ", () => {
    const result = rewriteQuery({ message: "Homestay ở Hà Giang giá bao nhiêu?", carriedPlaces: ["Mèo Vạc"] });
    expect(result.resolvedPlaces).toEqual([]);
  });

  it("'nênh' hay 'giáo' không bị nhận nhầm là từ mở đầu", () => {
    expect(rewriteQuery({ message: "Giáo xứ có lễ không?", carriedPlaces: ["Mèo Vạc"] }).resolvedPlaces).toEqual([]);
  });
});

describe("KQ-02: viết tắt và tên hay viết sai", () => {
  it("mở rộng viết tắt không thể hiểu thành gì khác", () => {
    const result = rewriteQuery({ message: "Đi HG mấy ngày là đủ?" });
    expect(result.applied).toContain("abbreviation");
    expect(result.query).toContain("Hà Giang");
  });

  it("sửa tên hay viết sai về đúng dạng trong danh mục", () => {
    expect(rewriteQuery({ message: "Mã Pì Lèng có nguy hiểm không?" }).query).toContain("Mã Pí Lèng");
    expect(rewriteQuery({ message: "di ma pi leng can gi" }).query).toContain("Mã Pí Lèng");
    expect(rewriteQuery({ message: "Đi thuyền sông Nho Quê" }).query).toContain("Nho Quế");
  });

  it("câu sạch đi thẳng, không phép nào áp dụng", () => {
    const result = rewriteQuery({ message: "Phố cổ Đồng Văn có gì?" });
    expect(result.applied).toEqual([]);
    expect(result.query).toBe("Phố cổ Đồng Văn có gì?");
  });

  /**
   * Bảng viết tắt cố tình ngắn. Một bảng rộng là nguồn lỗi âm thầm: mở rộng nhầm thì câu hỏi bị
   * đẩy sang một địa danh khách không nhắc tới, và bộ lọc địa danh tin vào đó mà không kiểm lại.
   */
  it("không mở rộng những cụm có thể hiểu thành thứ khác", () => {
    expect(rewriteQuery({ message: "Bên DV có dịch vụ gì?" }).query).toBe("Bên DV có dịch vụ gì?");
  });
});
