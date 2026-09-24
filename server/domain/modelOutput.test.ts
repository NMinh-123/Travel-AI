import { describe, expect, it } from "vitest";
import { cleanStringList, safeJsonParse } from "@server/infra/gemini";
import { parseItinerary } from "@server/domain/itineraryCheck";
import { enforceLodging, LODGING_OPTIONS } from "@server/domain/lodging";
import { parseSlots } from "@server/domain/agents/dialog";
import { verifyCitations, type EvidenceBlock } from "@server/domain/agents/grounding";

/**
 * ĐẦU RA CỦA MODEL Ở TRẠNG THÁI HỎNG — nhóm ca mà kiểu TypeScript không bảo vệ được.
 *
 * `JSON.parse` thành công KHÔNG đồng nghĩa với đúng lược đồ nghiệp vụ: model hoàn toàn có thể trả
 * về một object hợp cú pháp với `days` là chuỗi, `confidence` là "cao", hoặc một tên homestay
 * không tồn tại. Mỗi ca dưới đây là một cách hỏng đã quan sát được hoặc dễ xảy ra, và điều cần
 * khẳng định luôn giống nhau: hệ thống PHẢI từ chối hoặc thay thế, không được để giá trị rác đi
 * tiếp và hiện ra trước mặt khách.
 */

describe("IT-MO-01: JSON lẫn trong văn xuôi và khối mã", () => {
  it("đọc được JSON bọc trong khối mã markdown", () => {
    expect(safeJsonParse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(safeJsonParse('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("đọc được JSON nằm lẫn giữa văn xuôi", () => {
    expect(safeJsonParse('Đây là kết quả: {"a":3} — hy vọng giúp được bạn.')).toEqual({ a: 3 });
  });

  it("trả null khi không có gì đọc được, không ném lỗi", () => {
    for (const raw of [undefined, "", "hoàn toàn là văn xuôi", "null", "{ hỏng"]) {
      expect(safeJsonParse(raw as string | undefined), String(raw)).toBeNull();
    }
  });
});

describe("IT-MO-02: đúng cú pháp nhưng SAI KIỂU", () => {
  it("lịch trình có days là chuỗi, ngày thiếu trường bắt buộc -> từ chối", () => {
    expect(parseItinerary({ days: "ba ngày" })).toBeNull();
    expect(parseItinerary({ days: [{ day: "một", startPoint: "A", endPoint: "B" }] })).toBeNull();
    expect(parseItinerary({ days: [{ day: 1, endPoint: "B" }] })).toBeNull();
  });

  /**
   * Hai cách xử lý khác nhau cho hai loại trường, và sự khác nhau đó là có chủ ý.
   *
   * Trường CHỮ sai kiểu lùi về một giá trị an toàn: chúng chỉ ảnh hưởng cách trình bày.
   *
   * Trường SỐ sai kiểu thành `null` và được ghi tên vào `missingFields`. Lấp chúng bằng 0 như bản
   * trước là biến "model trả về chữ ở ô quãng đường" thành "quãng đường bằng 0" — một con số hợp
   * lệ mà không ai viết ra, đủ để mọi phép kiểm phía sau chạy trên dữ liệu giả.
   */
  it("trường chữ lùi về mặc định, trường SỐ thành null và được gọi tên", () => {
    const parsed = parseItinerary({
      title: 42,
      totalKm: "nhiều",
      dailyTips: "không phải mảng",
      days: [{ day: 1, startPoint: "Thành phố Hà Giang", endPoint: "Yên Minh", totalDistanceKm: "xa" }],
    });
    expect(parsed?.title).toBe("Lịch trình Hà Giang");
    expect(parsed?.dailyTips).toEqual([]);

    expect(parsed?.totalKm).toBeNull();
    expect(parsed?.missingFields).toContain("totalKm");
    expect(parsed?.days[0].totalDistanceKm).toBeNull();
    expect(parsed?.days[0].missingFields).toContain("totalDistanceKm");
  });

  it("slot lưu dạng Json bị sai kiểu thì bỏ qua từng trường, không làm hỏng cả phiên", () => {
    expect(parseSlots({ days: "ba", travelers: 4, destinations: "Đồng Văn" })).toEqual({ travelers: 4 });
    expect(parseSlots({ days: Number.NaN })).toEqual({});
    expect(parseSlots("không phải object")).toEqual({});
    expect(parseSlots(null)).toEqual({});
  });

  it("danh sách gợi ý lẫn số và chuỗi rỗng bị lọc sạch", () => {
    expect(cleanStringList(["  a  ", "", 7, null, "b"], 4)).toEqual(["a", "b"]);
    expect(cleanStringList("không phải mảng", 4)).toEqual([]);
  });
});

describe("IT-MO-03: địa điểm và cơ sở lưu trú BỊA", () => {
  it("tên homestay không có trong danh mục bị thay, và tên bị loại được ghi lại", () => {
    // Ba cái tên này quan sát được trên chính dự án: không cái nào có trong danh mục đã seed.
    const plan = {
      days: [
        { endPoint: "Yên Minh", eveningStay: { name: "Yên Minh Homestay" } },
        { endPoint: "Mèo Vạc", eveningStay: { name: "Khách sạn Cao Nguyên Mèo Vạc" } },
        { endPoint: "Thành phố Hà Giang", eveningStay: { name: "Homestay A Páo" } },
      ],
    };
    const result = enforceLodging(plan);
    expect(result.rejectedNames).toContain("Yên Minh Homestay");
    expect(result.rejectedNames).toContain("Khách sạn Cao Nguyên Mèo Vạc");

    const catalogue = new Set(LODGING_OPTIONS.map((option) => option.name));
    // Ngày cuối không có đêm nghỉ nên chỉ xét hai ngày đầu.
    for (const day of plan.days.slice(0, 2)) {
      const name = day.eveningStay.name;
      expect(catalogue.has(name) || name === "Chưa chốt chỗ nghỉ", name).toBe(true);
    }
  });

  it("giá LUÔN lấy từ danh mục, kể cả khi model đưa ra tên đúng kèm giá bịa", () => {
    const real = LODGING_OPTIONS.find((option) => option.areaName === "Yên Minh");
    expect(real).toBeDefined();
    const plan = {
      days: [
        { endPoint: "Yên Minh", eveningStay: { name: real!.name, priceEstimate: "99.000đ/đêm" } },
        { endPoint: "Thành phố Hà Giang", eveningStay: { name: "x" } },
      ],
    };
    enforceLodging(plan);
    expect(plan.days[0].eveningStay.priceEstimate).toBe(real!.priceLabel);
  });

  it("mức tiết kiệm lấy cơ sở rẻ nhất cùng vùng, cao cấp lấy đắt nhất, tiện nghi giữ lựa chọn", () => {
    // Vùng có ít nhất hai cơ sở khác giá — đúng ca "tiết kiệm mà ngủ homestay 858.000đ".
    const areas = [...new Set(LODGING_OPTIONS.map((o) => o.areaName))];
    const area = areas.find((name) => new Set(LODGING_OPTIONS.filter((o) => o.areaName === name && o.priceMidVnd !== null).map((o) => o.priceMidVnd)).size > 1);
    expect(area).toBeDefined();
    const inArea = LODGING_OPTIONS.filter((o) => o.areaName === area && o.priceMidVnd !== null)
      .sort((a, b) => (a.priceMidVnd as number) - (b.priceMidVnd as number));
    const [cheapest, priciest] = [inArea[0], inArea.at(-1)!];
    const planFor = (name: string) => ({ days: [{ endPoint: area, eveningStay: { name } }, { endPoint: "Thành phố Hà Giang", eveningStay: { name: "x" } }] });

    const thrift = planFor(priciest.name);
    enforceLodging(thrift, "backpacker");
    expect(thrift.days[0].eveningStay.name).toBe(cheapest.name);

    const luxury = planFor(cheapest.name);
    enforceLodging(luxury, "luxury");
    expect(luxury.days[0].eveningStay.name).toBe(priciest.name);

    const comfort = planFor(priciest.name);
    enforceLodging(comfort, "comfort");
    expect(comfort.days[0].eveningStay.name).toBe(priciest.name);
  });

  it("không tìm được cơ sở nào trong vùng thì nói CHƯA CHỐT, không giữ tên bịa", () => {
    const plan = {
      days: [
        { endPoint: "Một nơi không có trong danh mục", eveningStay: { name: "Homestay Tưởng Tượng" } },
        { endPoint: "Thành phố Hà Giang", eveningStay: { name: "x" } },
      ],
    };
    enforceLodging(plan);
    expect(plan.days[0].eveningStay.name).toBe("Chưa chốt chỗ nghỉ");
  });
});

describe("IT-MO-04: mã nguồn model tự khai", () => {
  const evidence: EvidenceBlock[] = [
    { id: "K1", kind: "knowledge", label: "Đoạn một", text: "Nội dung", sourceRef: "food:a", docId: "doc-1" },
  ];

  it("mã không có trong lời nhắc bị loại, không được tính là đã dẫn nguồn", () => {
    const check = verifyCitations([{ claim: "ý", sourceIds: ["K9", "W1"] }], evidence);
    expect(check.citedIds).toEqual([]);
    expect(check.unknownIds).toEqual(["K9", "W1"]);
  });

  it("citations sai kiểu hoàn toàn cũng không làm vỡ luồng", () => {
    expect(verifyCitations("không phải mảng" as never, evidence).citedIds).toEqual([]);
    expect(verifyCitations([{ claim: "", sourceIds: ["K1"] }], evidence).citedIds).toEqual([]);
    expect(verifyCitations([{ claim: "ý", sourceIds: "K1" as never }], evidence).citedIds).toEqual([]);
  });
});
