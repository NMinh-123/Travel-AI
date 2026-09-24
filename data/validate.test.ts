import { describe, expect, it } from "vitest";
import { validateData, validateKnowledge, validatePlaces } from "./validate";
import type { KnowledgeSourceDoc } from "@data/knowledge/index";
import type { Place } from "@data/places/types";

/**
 * Đồng hồ ghim, để KD-00 chấm dữ liệu thật một cách tất định thay vì đổi kết quả theo ngày chạy.
 *
 * Mốc này phải DỜI LÊN mỗi khi có dữ liệu mới mang `retrievedAt` muộn hơn nó, nếu không
 * `DOC_RETRIEVED_AT_FUTURE` sẽ báo đỏ cho chính lô dữ liệu vừa thu thập. Đừng sửa theo chiều
 * ngược lại — hạ `retrievedAt` xuống cho vừa mốc là khai sai ngày đối chiếu nguồn, và ngày đó
 * chính là thứ quyết định tài liệu còn hạn tin cậy hay không.
 */
const NOW = new Date("2026-09-23T00:00:00.000Z");

const place = (patch: Partial<Place> = {}): Place => ({
  slug: "ma-pi-leng",
  name: "Mã Pí Lèng",
  aliases: ["ma pi leng"],
  kind: "landmark",
  geo: { lat: 23.2, lng: 105.3, elevationM: 1500, precision: "surveyed" },
  tags: [],
  sortOrder: 1,
  ...patch,
});

const doc = (patch: Partial<KnowledgeSourceDoc> = {}): KnowledgeSourceDoc => ({
  slug: "food-thang-co",
  domain: "food",
  entityType: "local_food",
  title: "Thắng cố",
  content: "Nội dung.",
  tags: [],
  season: ["quanh_nam"],
  sourceClass: "editorial",
  ...patch,
});

const codes = (issues: { code: string }[]): string[] => issues.map((issue) => issue.code);

describe("KD-00: dữ liệu thật của dự án phải sạch", () => {
  it("không còn lỗi nào trong danh mục và kho tri thức", () => {
    const issues = validateData(NOW);
    expect(issues, issues.map((i) => `${i.code} ${i.entity}: ${i.message}`).join("\n")).toEqual([]);
  });
});

describe("KD-01: danh mục thực thể", () => {
  it("bắt slug trùng", () => {
    expect(codes(validatePlaces([place(), place()], [], NOW))).toContain("PLACE_DUPLICATE_SLUG");
  });

  it("bắt parentSlug không tồn tại và thực thể tự trỏ về chính nó", () => {
    expect(codes(validatePlaces([place({ parentSlug: "khong-co" })], [], NOW))).toContain("PLACE_PARENT_MISSING");
    expect(codes(validatePlaces([place({ parentSlug: "ma-pi-leng" })], [], NOW))).toContain("PLACE_PARENT_CYCLE");
  });

  it("bắt chu trình dài trong cây địa danh", () => {
    // a -> b -> c -> a. Không có phép kiểm này thì mọi phép đi ngược lên cây sẽ treo.
    const tree = [
      place({ slug: "a", name: "A", aliases: ["a"], parentSlug: "b" }),
      place({ slug: "b", name: "B", aliases: ["b"], parentSlug: "c" }),
      place({ slug: "c", name: "C", aliases: ["c"], parentSlug: "a" }),
    ];
    expect(codes(validatePlaces(tree, [], NOW))).toContain("PLACE_PARENT_CYCLE");
  });

  it("cây hợp lệ không bị báo nhầm là có chu trình", () => {
    const tree = [
      place({ slug: "tinh", name: "Tỉnh", aliases: ["tinh"] }),
      place({ slug: "vung", name: "Vùng", aliases: ["vung"], parentSlug: "tinh" }),
      place({ slug: "diem", name: "Điểm", aliases: ["diem"], parentSlug: "vung" }),
    ];
    expect(codes(validatePlaces(tree, [], NOW))).toEqual([]);
  });

  it.each([
    ["lat và lng bị đảo", { lat: 105.3, lng: 23.2, elevationM: 1500, precision: "surveyed" as const }],
    ["toạ độ bỏ trống thành 0", { lat: 0, lng: 0, elevationM: 1500, precision: "surveyed" as const }],
  ])("bắt %s", (_label, geo) => {
    expect(codes(validatePlaces([place({ geo })], [], NOW))).toContain("PLACE_GEO_OUT_OF_BOUNDS");
  });

  it("bắt độ cao vô lý", () => {
    const geo = { lat: 23.2, lng: 105.3, elevationM: 9000, precision: "surveyed" as const };
    expect(codes(validatePlaces([place({ geo })], [], NOW))).toContain("PLACE_ELEVATION_IMPLAUSIBLE");
  });

  it("bắt alias mơ hồ giữa hai thực thể", () => {
    const pair = [
      place({ slug: "quan-an", aliases: ["hoa cuong dong van"] }),
      place({ slug: "khach-san", aliases: ["hoa cuong dong van"] }),
    ];
    expect(codes(validatePlaces(pair, [], NOW))).toContain("PLACE_ALIAS_AMBIGUOUS");
  });

  it("bắt alias chưa bỏ dấu — alias còn dấu thì không bao giờ khớp lúc chạy", () => {
    expect(codes(validatePlaces([place({ aliases: ["Mã Pí Lèng"] })], [], NOW))).toContain("PLACE_ALIAS_NOT_NORMALIZED");
  });

  it("bắt tên thực thể trùng alias của thực thể khác", () => {
    const pair = [place(), place({ slug: "khac", name: "Chỗ khác", aliases: ["ma pi leng"] })];
    expect(codes(validatePlaces(pair, [], NOW))).toContain("PLACE_ALIAS_AMBIGUOUS");
  });
});

describe("KD-02: khoảng giá", () => {
  const price = (patch = {}) => ({
    minVnd: 300_000, maxVnd: 600_000, unit: "per_night" as const,
    basis: "market_estimate" as const, surveyedAt: "2026-08-10",
    sourceUrls: ["https://example.invalid/x"], ...patch,
  });

  it("chấp nhận khoảng giá hợp lệ", () => {
    expect(codes(validatePlaces([place({ price: price() })], [], NOW))).toEqual([]);
  });

  /**
   * Giá cũ hơn hạn tin cậy vẫn được trích như giá hiện tại nếu không ai canh. Mốc lấy bằng đúng
   * hạn của nội dung `estimated`, vì cả hai đều là con số chụp lại một thời điểm của thị trường.
   */
  it("bắt giá khảo sát đã quá hạn tin cậy", () => {
    expect(codes(validatePlaces([place({ price: price({ surveyedAt: "2026-01-10" }) })], [], NOW)))
      .toContain("PRICE_STALE");
  });

  it("giá vừa khảo sát thì không bị gắn cờ cũ", () => {
    expect(codes(validatePlaces([place({ price: price({ surveyedAt: "2026-09-20" }) })], [], NOW)))
      .not.toContain("PRICE_STALE");
  });

  /**
   * `published_rate` là mức mạnh nhất: nó tuyên bố chính cơ sở công bố con số này. Khai mức đó mà
   * không có trang nào để soát lại là cách một ước lượng thị trường leo lên vị trí giá chính
   * thức — và mọi lớp phía sau đều tin vào nhãn ấy để quyết định được nói "giá là" hay "khoảng".
   */
  it("bắt giá suy luận đội lốt giá chính thức", () => {
    expect(codes(validatePlaces(
      [place({ price: price({ basis: "published_rate", sourceUrls: [] }) })], [], NOW,
    ))).toContain("PRICE_ESTIMATE_AS_OFFICIAL");
  });

  it("bắt giá đọc trên sàn mà không ghi ngày đọc", () => {
    expect(codes(validatePlaces(
      [place({ price: price({ basis: "ota_observed", surveyedAt: "" }) })], [], NOW,
    ))).toContain("PRICE_ESTIMATE_AS_OFFICIAL");
  });

  it("bắt khoảng giá đảo ngược", () => {
    expect(codes(validatePlaces([place({ price: price({ minVnd: 900_000 }) })], [], NOW))).toContain("PRICE_RANGE_INVERTED");
  });

  it("bắt giá không dương và ngày khảo sát hỏng", () => {
    expect(codes(validatePlaces([place({ price: price({ minVnd: 0 }) })], [], NOW))).toContain("PRICE_NOT_POSITIVE");
    expect(codes(validatePlaces([place({ price: price({ surveyedAt: "2026-02-31" }) })], [], NOW))).toContain("PRICE_SURVEYED_AT_INVALID");
    expect(codes(validatePlaces([place({ price: price({ surveyedAt: "2027-01-01" }) })], [], NOW))).toContain("PRICE_SURVEYED_AT_FUTURE");
  });

  it("bắt giá không có nguồn để soát lại", () => {
    expect(codes(validatePlaces([place({ price: price({ sourceUrls: [] }) })], [], NOW))).toContain("PRICE_SOURCE_MISSING");
  });
});

describe("KD-03: danh sách chặn ngoài địa bàn", () => {
  it("bắt mục chặn phủ lên một địa danh có thật", () => {
    expect(codes(validatePlaces([place()], ["ma pi leng"], NOW))).toContain("OUT_OF_AREA_SHADOWS_PLACE");
  });

  it("bắt mục chặn còn dấu", () => {
    expect(codes(validatePlaces([place()], ["Sa Pa"], NOW))).toContain("OUT_OF_AREA_NOT_NORMALIZED");
  });
});

describe("KD-04: kho tri thức", () => {
  const slugs = new Set(["thang-co"]);

  it("bắt hai tài liệu cùng domain và cùng slug", () => {
    expect(codes(validateKnowledge([doc(), doc()], slugs, NOW))).toContain("DOC_DUPLICATE_REF");
  });

  it("bắt entityId không có trong danh mục — lỗi khiến tài liệu biến mất lặng lẽ", () => {
    expect(codes(validateKnowledge([doc({ entityId: "go-sai-chinh-ta" })], slugs, NOW))).toContain("DOC_ENTITY_MISSING");
    expect(codes(validateKnowledge([doc({ entityId: "thang-co" })], slugs, NOW))).toEqual([]);
  });

  it("nội dung crawl và ước lượng bắt buộc có nguồn cùng ngày đối chiếu", () => {
    const issues = codes(validateKnowledge([doc({ sourceClass: "crawled_verified" })], slugs, NOW));
    expect(issues).toContain("DOC_SOURCE_URL_MISSING");
    expect(issues).toContain("DOC_RETRIEVED_AT_MISSING");
    // Nội dung biên tập của dự án thì không cần.
    expect(codes(validateKnowledge([doc()], slugs, NOW))).toEqual([]);
  });

  it("bắt ngày đối chiếu hỏng hoặc ở tương lai", () => {
    const external = { sourceClass: "estimated" as const, sourceUrl: "https://x.invalid" };
    expect(codes(validateKnowledge([doc({ ...external, retrievedAt: "2026-13-01" })], slugs, NOW))).toContain("DOC_RETRIEVED_AT_INVALID");
    expect(codes(validateKnowledge([doc({ ...external, retrievedAt: "2030-01-01" })], slugs, NOW))).toContain("DOC_RETRIEVED_AT_FUTURE");
  });

  it("bắt tài liệu rỗng và mùa không có trong bảng mùa", () => {
    expect(codes(validateKnowledge([doc({ content: "   " })], slugs, NOW))).toContain("DOC_EMPTY");
    expect(codes(validateKnowledge([doc({ season: ["mua_bao" as never] })], slugs, NOW))).toContain("DOC_SEASON_UNKNOWN");
  });

  /**
   * `KnowledgeDoc.status` mặc định là `APPROVED` và `validUntil` được suy lúc ingest, nhưng sau
   * đó không có ai canh nó. Nên một tài liệu crawl đủ cũ vẫn đi thẳng vào kho ở trạng thái đã
   * duyệt rồi được trích như nội dung hiện hành — đúng thứ mà cột `validUntil` sinh ra để ngăn.
   */
  it("bắt tài liệu đã quá hạn tin cậy trước khi nó kịp vào kho với trạng thái APPROVED", () => {
    const crawled = { sourceClass: "crawled_verified" as const, sourceUrl: "https://x.invalid" };
    // Hạn của nội dung crawl là 365 ngày; mốc này cách NOW hơn hai năm.
    expect(codes(validateKnowledge([doc({ ...crawled, retrievedAt: "2024-01-01" })], slugs, NOW)))
      .toContain("DOC_EXPIRED");
    // Vừa đối chiếu lại thì không sao.
    expect(codes(validateKnowledge([doc({ ...crawled, retrievedAt: "2026-09-01" })], slugs, NOW)))
      .not.toContain("DOC_EXPIRED");
  });

  it("nội dung biên tập KHÔNG có hạn, nên không bao giờ bị gắn cờ quá hạn", () => {
    expect(codes(validateKnowledge([doc({ sourceClass: "editorial" })], slugs, NOW)))
      .not.toContain("DOC_EXPIRED");
  });

  /**
   * Giá ước lượng hết hạn sau 180 ngày, nội dung crawl sau 365. Bài này chốt rằng hai tốc độ đó
   * KHÁC nhau — gộp làm một là cách một khoảng giá nửa năm tuổi tiếp tục được trích như giá hôm
   * nay.
   */
  it("giá ước lượng hết hạn nhanh gấp đôi nội dung crawl", () => {
    const at = { retrievedAt: "2026-01-01", sourceUrl: "https://x.invalid" };
    expect(codes(validateKnowledge([doc({ ...at, sourceClass: "estimated" })], slugs, NOW)))
      .toContain("DOC_EXPIRED");
    expect(codes(validateKnowledge([doc({ ...at, sourceClass: "crawled_verified" })], slugs, NOW)))
      .not.toContain("DOC_EXPIRED");
  });
});
