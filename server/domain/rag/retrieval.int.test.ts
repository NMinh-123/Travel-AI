import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { insertDoc, resetKnowledge, unitVector } from "@test/integration/fixtures";
import { prisma } from "@server/infra/db";

/**
 * Chỉ thay lượt NHÚNG câu hỏi, giữ nguyên toàn bộ phần còn lại chạy thật trên Postgres.
 *
 * Đây là ranh giới đúng cho một test tích hợp tầng truy xuất: cái cần khẳng định là pgvector xếp
 * đúng theo khoảng cách cosine, bộ lọc APPROVED chặn đúng, `tsvector` khớp được chữ không dấu, và
 * bộ lọc địa danh hai tầng hoạt động. Không phép nào trong số đó phụ thuộc vào chất lượng model,
 * còn gọi model thật thì thêm một phụ thuộc chậm và không tất định.
 */
const embedQuery = vi.fn(async (texts?: string[]) => (texts ?? [""]).map(() => unitVector(0)));
vi.mock("@server/domain/rag/embedder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/domain/rag/embedder")>();
  return {
    ...actual,
    getEmbedder: () => ({ kind: "fixture", model: "fixture", embed: embedQuery }),
  };
});

const { retrieve } = await import("./retrieval");

/** Ngưỡng tắt hẳn: từng bài tự nói về điều nó kiểm, không để ngưỡng mặc định che kết quả. */
const OPEN = { minVectorSimilarity: 0, minKeywordRank: 0, finalLimit: 10 };

beforeAll(async () => {
  await resetKnowledge();
  await insertDoc({
    slug: "guide:deo-ma-pi-leng",
    title: "Đèo Mã Pí Lèng",
    content: "Con đường đục vào vách đá dựng đứng, nhìn xuống sông Nho Quế xanh ngọc.",
    axis: 0,
    scope: "PLACE",
    placeSlug: "deo-ma-pi-leng",
    domain: "attraction",
  });
  await insertDoc({
    slug: "guide:giay-to-bien-gioi",
    title: "Giấy tờ khu vực biên giới",
    content: "Mang theo giấy tờ tuỳ thân và luôn có sẵn để xuất trình khi được yêu cầu.",
    axis: 1,
    scope: "PROVINCE",
    domain: "travel_guide",
  });
  await insertDoc({
    slug: "guide:chua-duyet",
    title: "Bản nháp chưa duyệt",
    content: "Nội dung này chưa qua kiểm duyệt và không được phép trích dẫn.",
    axis: 0,
    status: "DRAFT",
  });
  await insertDoc({
    slug: "guide:cho-phien-dong-van",
    title: "Chợ phiên Đồng Văn",
    content: "Phiên chính họp sáng Chủ nhật trong khu nhà chợ đá cũ.",
    axis: 2,
    scope: "PLACE",
    placeSlug: "dong-van",
    domain: "attraction",
    season: ["hoa_tam_giac_mach"],
  });
});

afterAll(async () => {
  await resetKnowledge();
  await prisma.$disconnect();
});

beforeEach(() => embedQuery.mockClear());

describe("IT-RAG-01: pgvector xếp theo khoảng cách cosine thật", () => {
  it("tài liệu cùng trục với truy vấn đứng trước", async () => {
    const result = await retrieve("đèo Mã Pí Lèng", { ...OPEN, branches: { keyword: false, metadata: false } });
    expect(result.chunks[0].slug).toBe("guide:deo-ma-pi-leng");
    expect(result.metrics.vectorHits).toBeGreaterThan(0);
    // Chốt hợp đồng với tầng nhúng: câu hỏi phải tới được embedder nguyên vẹn, và chỉ nhúng MỘT
    // lần cho cả nhánh vector lẫn nhánh metadata.
    expect(embedQuery).toHaveBeenCalledTimes(1);
    expect(embedQuery).toHaveBeenCalledWith(["đèo Mã Pí Lèng"]);
  });

  it("ngưỡng tương đồng cắt đúng tài liệu khác trục", async () => {
    // Truy vấn ở trục 0; tài liệu trục 1 và 2 có cosine đúng bằng 0 nên phải bị ngưỡng 0,6 loại.
    const result = await retrieve("đèo Mã Pí Lèng", {
      minVectorSimilarity: 0.6, minKeywordRank: 1, finalLimit: 10,
      branches: { keyword: false, metadata: false },
    });
    expect(result.chunks.map((chunk) => chunk.slug)).toEqual(["guide:deo-ma-pi-leng"]);
  });
});

describe("IT-RAG-02: chỉ đoạn APPROVED được trả về", () => {
  it("bản nháp không lọt kể cả khi vector khớp hoàn hảo", async () => {
    // `guide:chua-duyet` cùng trục 0 với truy vấn nên nếu không có bộ lọc trạng thái, nó sẽ đứng
    // ngang hàng với tài liệu đúng. Đây là FR-BOT-05 được kiểm ở tầng SQL chứ không ở tầng ứng dụng.
    const result = await retrieve("đèo Mã Pí Lèng", OPEN);
    expect(result.chunks.map((chunk) => chunk.slug)).not.toContain("guide:chua-duyet");
  });
});

describe("IT-RAG-03: nhánh từ khoá khớp được chữ KHÔNG DẤU", () => {
  it("gõ không dấu vẫn tìm ra tài liệu có dấu", async () => {
    // Cấu hình `vietnamese` là bản sao của `simple` có thêm unaccent; thiếu nó thì nhánh từ khoá
    // im lặng không khớp gì, và đó chính là kiểu hỏng chỉ test chạy trên Postgres thật mới thấy.
    const result = await retrieve("ma pi leng", { ...OPEN, branches: { vector: false, metadata: false } });
    expect(result.chunks.map((chunk) => chunk.slug)).toContain("guide:deo-ma-pi-leng");
    expect(result.metrics.keywordHits).toBeGreaterThan(0);
  });

  it("gõ có dấu cũng khớp, nên hai cách gõ cho cùng một tài liệu", async () => {
    const result = await retrieve("Mã Pí Lèng", { ...OPEN, branches: { vector: false, metadata: false } });
    expect(result.chunks.map((chunk) => chunk.slug)).toContain("guide:deo-ma-pi-leng");
  });
});

describe("IT-RAG-04: bộ lọc địa danh hai tầng", () => {
  it("đoạn cấp địa bàn LUÔN là ứng viên, kể cả khi khách nêu một địa danh khác", async () => {
    /**
     * Đây là phép kiểm bảo vệ quyết định thiết kế quan trọng nhất của `baseFilter`. Lọc cứng
     * `placeSlug IN (...)` sẽ loại toàn bộ tri thức cấp địa bàn — giấy tờ biên giới, bằng lái,
     * sạt lở mùa mưa — ngay khi khách lỡ nhắc tên một nơi trong câu hỏi.
     */
    const result = await retrieve("giấy tờ", {
      ...OPEN,
      placeSlugs: ["deo-ma-pi-leng"],
      branches: { vector: false, metadata: false },
    });
    expect(result.chunks.map((chunk) => chunk.slug)).toContain("guide:giay-to-bien-gioi");
  });

  it("đoạn của địa danh KHÁC bị loại", async () => {
    const result = await retrieve("chợ phiên", {
      ...OPEN,
      placeSlugs: ["deo-ma-pi-leng"],
      branches: { vector: false, metadata: false },
    });
    expect(result.chunks.map((chunk) => chunk.slug)).not.toContain("guide:cho-phien-dong-van");
  });

  it("không nêu địa danh nào thì không lọc theo địa danh", async () => {
    const result = await retrieve("chợ phiên", { ...OPEN, branches: { vector: false, metadata: false } });
    expect(result.chunks.map((chunk) => chunk.slug)).toContain("guide:cho-phien-dong-van");
  });
});

describe("IT-RAG-05: chế độ suy giảm khi nhánh vector hỏng", () => {
  it("sidecar sập thì vẫn trả kết quả bằng nhánh từ khoá, và ghi lại là suy giảm", async () => {
    embedQuery.mockRejectedValueOnce(new Error("sidecar sập"));
    const result = await retrieve("ma pi leng", { ...OPEN, branches: { metadata: false } });
    expect(result.metrics.degraded).toBe("vector_failed");
    expect(result.chunks.length).toBeGreaterThan(0);
  });
});

describe("IT-RAG-06: nhánh metadata chạy thật trên cột domain và season", () => {
  it("tín hiệu domain khớp được hàng trong database", async () => {
    const result = await retrieve("chợ phiên", {
      ...OPEN,
      domains: ["attraction"],
      branches: { vector: true, keyword: false, metadata: true },
    });
    expect(result.metrics.metadataHits).toBeGreaterThan(0);
  });

  it("tín hiệu mùa khớp qua toán tử giao mảng", async () => {
    const result = await retrieve("hoa tam giác mạch", {
      ...OPEN,
      seasons: ["hoa_tam_giac_mach"],
      branches: { vector: true, keyword: false, metadata: true },
    });
    expect(result.metrics.metadataHits).toBeGreaterThan(0);
  });
});
