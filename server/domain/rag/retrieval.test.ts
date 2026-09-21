import { describe, expect, it } from "vitest";
import { PlaceKind } from "@prisma/client";
import { KnowledgeEntityType } from "@prisma/client";
import { fuse, metadataFilter, resolveDegraded, type RetrievedChunk } from "./retrieval";
import { descendantsOf } from "./places";
import { domainSignals, entityTypeSignals, seasonSignals } from "./signals";

describe("KR-01: chế độ suy giảm khi một nhánh hỏng", () => {
  it("nhánh vector hỏng thì vẫn chạy bằng nhánh từ khoá, có ghi lại", () => {
    expect(resolveDegraded(true, false)).toBe("vector_failed");
  });

  it("nhánh từ khoá hỏng thì vẫn chạy bằng nhánh vector", () => {
    expect(resolveDegraded(false, true)).toBe("keyword_failed");
  });

  it("cả hai cùng hỏng là sự cố, phải ném ra chứ không trả danh sách rỗng", () => {
    // Nuốt thành rỗng sẽ khiến tác tử tri thức báo "ngoài phạm vi" — một sự cố hạ tầng bị ghi
    // nhận thành một câu hỏi khó, đúng kiểu nhầm lẫn mà trace được dựng lên để tránh.
    expect(() => resolveDegraded(true, true)).toThrow();
  });

  it("không nhánh nào hỏng thì không phải suy giảm", () => {
    expect(resolveDegraded(false, false)).toBe("none");
  });
});

describe("KR-02: nhánh metadata chỉ chạy khi có tín hiệu", () => {
  it("không tín hiệu nào thì không có nhánh metadata", () => {
    expect(metadataFilter({})).toBeNull();
    expect(metadataFilter({ domains: [], entityTypes: [], seasons: [] })).toBeNull();
  });

  it("một tín hiệu bất kỳ là đủ để dựng điều kiện", () => {
    expect(metadataFilter({ domains: ["food"] })).not.toBeNull();
    expect(metadataFilter({ entityTypes: ["local_food"] })).not.toBeNull();
    expect(metadataFilter({ seasons: ["hoa_tam_giac_mach"] })).not.toBeNull();
  });
});

describe("KR-03: mở cây địa danh", () => {
  const tree = [
    { slug: "tuyen-quang", parentSlug: null },
    { slug: "dong-van", parentSlug: "tuyen-quang" },
    { slug: "pho-co-dong-van", parentSlug: "dong-van" },
    { slug: "cho-phien-dong-van", parentSlug: "dong-van" },
    { slug: "meo-vac", parentSlug: "tuyen-quang" },
  ];

  it("hỏi về một vùng thì gom cả con cháu", () => {
    expect(new Set(descendantsOf(tree, ["dong-van"]))).toEqual(
      new Set(["dong-van", "pho-co-dong-van", "cho-phien-dong-van"]),
    );
  });

  it("không kéo theo anh em hay cha", () => {
    expect(descendantsOf(tree, ["pho-co-dong-van"])).toEqual(["pho-co-dong-van"]);
    expect(descendantsOf(tree, ["dong-van"])).not.toContain("meo-vac");
  });

  it("danh sách rỗng trả về rỗng, nhiều gốc thì gộp và khử trùng", () => {
    expect(descendantsOf(tree, [])).toEqual([]);
    expect(descendantsOf(tree, ["dong-van", "dong-van"]).filter((s) => s === "dong-van")).toHaveLength(1);
  });

  it("cây có chu trình không làm treo vòng lặp", () => {
    const cyclic = [
      { slug: "a", parentSlug: "c" },
      { slug: "b", parentSlug: "a" },
      { slug: "c", parentSlug: "b" },
    ];
    expect(new Set(descendantsOf(cyclic, ["a"]))).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("KR-04: suy tín hiệu metadata từ câu hỏi", () => {
  it.each([
    ["Thắng cố Hà Giang nấu bằng gì, ăn ở đâu?", "food"],
    ["Ngủ ở Đồng Văn thì chọn homestay nào?", "accommodation"],
    ["Huỷ phòng sau hạn thì mất bao nhiêu tiền?", "policy"],
    ["Thuê xe máy ở Hà Giang cần bằng lái gì?", "travel_guide"],
    ["Tháng mấy có hoa tam giác mạch?", "seasonal_recommendation"],
  ])("%s -> %s", (question, domain) => {
    expect(domainSignals(question)).toContain(domain);
  });

  it("nhận được cả khi khách gõ không dấu", () => {
    expect(domainSignals("thue xe may can bang lai gi")).toContain("travel_guide");
  });

  it("câu không thuộc nhánh nào rõ rệt thì không có tín hiệu", () => {
    expect(domainSignals("Hà Giang trông như thế nào?")).toEqual([]);
  });

  it("câu chạm quá nhiều nhánh cũng coi như không có tín hiệu", () => {
    // Bốn nhánh trở lên thì nhánh metadata phủ gần hết kho, nên nó chỉ nhân đôi thứ hạng của
    // nhánh vector chứ không thêm thông tin nào.
    const question = "Ăn gì, ngủ ở đâu, thuê xe máy thế nào và huỷ phòng ra sao?";
    expect(domainSignals(question)).toEqual([]);
  });
});

describe("KR-05: tín hiệu mùa", () => {
  it("bỏ quanh_nam vì nó là mặc định của phần lớn kho", () => {
    expect(seasonSignals(["quanh_nam"])).toEqual([]);
    expect(seasonSignals(["hoa_tam_giac_mach", "quanh_nam"])).toEqual(["hoa_tam_giac_mach"]);
  });

  it("bỏ giá trị không có trong bảng mùa và khử trùng lặp", () => {
    expect(seasonSignals(["mua_bao", "lua_chin", "lua_chin"])).toEqual(["lua_chin"]);
    expect(seasonSignals(undefined)).toEqual([]);
  });
});

describe("KR-06: PlaceKind và KnowledgeEntityType phải còn khớp tên", () => {
  it("mọi PlaceKind đều có mặt trong KnowledgeEntityType", () => {
    // `entityTypeSignals` ánh xạ đồng nhất theo tên. Hai enum lệch nhau thì phép ánh xạ đó im lặng
    // trả về một giá trị không khớp hàng nào, và nhánh metadata mất chiều entityType mà không báo.
    const entityTypes = new Set<string>(Object.values(KnowledgeEntityType));
    for (const kind of Object.values(PlaceKind)) {
      expect(entityTypes, `PlaceKind "${kind}" không có trong KnowledgeEntityType`).toContain(kind);
    }
  });

  it("chuyển loại địa danh thành tín hiệu entityType, có khử trùng lặp", () => {
    expect(entityTypeSignals(["local_food", "region", "local_food"])).toEqual(["local_food", "region"]);
    expect(entityTypeSignals([])).toEqual([]);
  });
});

describe("KR-06: metadata tham gia xếp hạng theo bốn cách khác nhau", () => {
  const chunk = (id: string): RetrievedChunk => ({
    id, slug: id, title: id, content: id, sourceRef: `food:${id}`,
    docType: "FAQ" as RetrievedChunk["docType"], scope: "PLACE", placeSlug: null,
  });

  const ids = (rows: RetrievedChunk[]): string[] => rows.map((row) => row.id);

  /**
   * ĐÂY LÀ LÝ DO CHẾ ĐỘ MẶC ĐỊNH KHÔNG CÒN LÀ `branch`.
   *
   * Với k = 60, chênh lệch giữa hạng 1 và hạng 2 trong cùng một nhánh là 1/61 − 1/62 ≈ 0,00026,
   * còn có mặt thêm ở một nhánh nữa cộng thẳng 1/61 ≈ 0,0164 — gấp sáu mươi lần. Nên "xuất hiện
   * ở hai nhánh" áp đảo mọi khác biệt thứ hạng, và HẠ TRỌNG SỐ KHÔNG CHỮA ĐƯỢC: bài này chốt
   * rằng ngay cả trọng số 0,5 vẫn đảo thứ tự.
   *
   * Với cặp vector + từ khoá đó là điều mong muốn — hai cách tìm độc lập cùng chọn một đoạn là
   * bằng chứng độc lập. Với metadata thì không, vì nhánh ấy là chính lượt tìm vector kia cộng
   * một điều kiện OR.
   */
  it("đưa metadata vào như một nhánh sẽ đảo thứ tự, kể cả khi hạ trọng số", () => {
    const vector = [chunk("a"), chunk("b")];
    const metadata = [chunk("b")];

    const full = fuse([{ rows: vector }, { rows: [] }, { rows: metadata, weight: 1 }], { limit: 2 });
    expect(ids(full)).toEqual(["b", "a"]);

    const halved = fuse([{ rows: vector }, { rows: [] }, { rows: metadata, weight: 0.5 }], { limit: 2 });
    expect(ids(halved)).toEqual(["b", "a"]);
  });

  /**
   * Chế độ thưởng diễn đạt đúng điều ta muốn nói: khớp metadata làm một đoạn đáng tin hơn MỘT
   * CHÚT. Khoản thưởng bằng khoảng cách hai bậc, nên một đoạn ở hạng 5 lên khoảng hạng 3 chứ
   * không nhảy lên đầu.
   */
  it("chế độ thưởng nhích đoạn lên vài bậc, không kéo nó lên đầu", () => {
    const vector = ["a", "b", "c", "d", "e"].map(chunk);
    const bonused = fuse([{ rows: vector }], { limit: 5, bonusIds: new Set(["e"]) });
    expect(ids(bonused)[0]).toBe("a");
    expect(ids(bonused).indexOf("e")).toBe(2);
  });

  /**
   * Khoản thưởng không được kéo vào một đoạn mà KHÔNG nhánh xếp hạng nào tìm thấy. Nếu không, nó
   * thành một nhánh truy xuất trá hình và mọi ràng buộc ngưỡng của hai nhánh kia bị đi vòng.
   */
  it("thưởng không tạo ra đoạn mới", () => {
    const fused = fuse([{ rows: [chunk("a")] }], { limit: 5, bonusIds: new Set(["khong-ton-tai"]) });
    expect(ids(fused)).toEqual(["a"]);
  });

  it("chế độ phá hoà chỉ đổi thứ tự khi điểm BẰNG NHAU", () => {
    // Hai đoạn cùng đứng đầu hai nhánh khác nhau nên điểm bằng nhau tuyệt đối.
    const tied = fuse(
      [{ rows: [chunk("a")] }, { rows: [chunk("b")] }],
      { limit: 2, tiebreakIds: new Set(["b"]) },
    );
    expect(ids(tied)).toEqual(["b", "a"]);

    // Điểm khác nhau thì metadata không được đảo thứ tự.
    const ordered = fuse([{ rows: [chunk("a"), chunk("b")] }], { limit: 2, tiebreakIds: new Set(["b"]) });
    expect(ids(ordered)).toEqual(["a", "b"]);
  });
});
