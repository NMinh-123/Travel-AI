import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@server/infra/db";
import { resetKnowledge, unitVector } from "@test/integration/fixtures";
import { writeChunk } from "./ingest-write";
import { contentHashOf, planIngest, type ExistingChunk, type PreparedChunk } from "./ingest-plan";

/**
 * Ba tính chất của ingest mà chỉ Postgres thật mới kiểm được.
 *
 * `planIngest` đã có test thuần cho phần QUYẾT ĐỊNH; phần còn lại — hàng và vector có thật sự đi
 * cùng nhau không, chạy lại có đụng vào hàng không, xoá có đúng phạm vi không — nằm ở tầng SQL và
 * không có cách nào khẳng định bằng test thuần.
 */

const PIPELINE = { embeddingModel: "fixture-model", pipelineVersion: "chunk:1/seg:off" };

function chunk(patch: Partial<PreparedChunk> = {}): PreparedChunk {
  const title = patch.title ?? "Đèo Mã Pí Lèng";
  const content = patch.content ?? "Con đường đục vào vách đá dựng đứng.";
  return {
    slug: "attraction:deo-ma-pi-leng",
    docType: "destination",
    domain: "attraction",
    entityType: "landmark",
    entityId: null,
    tags: [],
    season: [],
    title,
    content,
    sourceRef: "attraction:deo-ma-pi-leng",
    scope: "PROVINCE",
    placeSlug: null,
    chunkIndex: 0,
    tokenCount: 42,
    sourceUrl: null,
    sourceClass: "editorial",
    verifiedAt: null,
    validUntil: null,
    contentHash: contentHashOf({ title, content }),
    ...patch,
  };
}

const index = (vector = unitVector(0)) => ({ vector, title: "Đèo Mã Pí Lèng", body: "Con đường." });

async function readRow(slug: string) {
  const [row] = await prisma.$queryRawUnsafe<
    { content: string; version: number; updatedAt: Date; hasVector: boolean; hasTsv: boolean }[]
  >(
    `SELECT "content", "version", "updatedAt",
            ("embedding" IS NOT NULL) AS "hasVector",
            ("search_tsv" IS NOT NULL) AS "hasTsv"
     FROM "KnowledgeDoc" WHERE "slug" = $1`,
    slug,
  );
  return row;
}

beforeEach(resetKnowledge);
afterAll(async () => {
  await resetKnowledge();
  await prisma.$disconnect();
});

describe("IT-ING-01: hàng và vector luôn đi cùng nhau", () => {
  it("ghi thành công thì có cả nội dung, vector và chỉ mục từ khoá", async () => {
    await writeChunk({ chunk: chunk(), action: "create" }, PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());
    const row = await readRow("attraction:deo-ma-pi-leng");
    expect(row.hasVector).toBe(true);
    expect(row.hasTsv).toBe(true);
  });

  it("vector hỏng giữa chừng thì KHÔNG để lại nội dung mới đi cùng vector cũ", async () => {
    /**
     * Đây là tính chất mà transaction sinh ra để bảo đảm, và là trạng thái không có dấu vết nào
     * nếu nó hỏng: hàng vẫn đủ cột, vẫn được truy xuất, chỉ là vector trỏ về một nội dung không
     * còn tồn tại. Bản trước ghi hàng và vector bằng hai câu lệnh rời nên trạng thái đó có thật.
     */
    await writeChunk({ chunk: chunk(), action: "create" }, PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());

    // Vector sai số chiều: Postgres từ chối ở câu UPDATE, tức là hỏng SAU khi hàng đã được ghi.
    const broken = { vector: [1, 2, 3], title: "x", body: "y" };
    await expect(
      writeChunk(
        { chunk: chunk({ content: "NỘI DUNG MỚI không được phép lọt vào" }), action: "reindex" },
        PIPELINE.embeddingModel, PIPELINE.pipelineVersion, broken,
      ),
    ).rejects.toThrow();

    const row = await readRow("attraction:deo-ma-pi-leng");
    expect(row.content).not.toContain("NỘI DUNG MỚI");
    expect(row.version).toBe(1);
    expect(row.hasVector).toBe(true);
  });
});

describe("IT-ING-02: chạy lại cùng dữ liệu không đụng vào hàng nào", () => {
  it("kế hoạch lượt hai là giữ nguyên toàn bộ, và version đứng yên", async () => {
    const prepared = [chunk()];
    await writeChunk({ chunk: prepared[0], action: "create" }, PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());
    const before = await readRow("attraction:deo-ma-pi-leng");

    // Đọc lại đúng những gì database đang có rồi lập kế hoạch, giống hệt lượt chạy thật.
    const existing = await loadExisting();
    const plan = planIngest(prepared, existing, { ...PIPELINE, managedRefs: new Set(["attraction:deo-ma-pi-leng"]) });

    expect(plan.counts).toEqual({ create: 0, reindex: 0, update: 0, unchanged: 1 });
    expect(plan.toEmbed).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);

    const after = await readRow("attraction:deo-ma-pi-leng");
    expect(after.version).toBe(before.version);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("đổi nội dung thì phải đánh chỉ mục lại, và version tăng đúng một lần", async () => {
    await writeChunk({ chunk: chunk(), action: "create" }, PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());
    const edited = chunk({ content: "Nội dung đã sửa." });
    const plan = planIngest([edited], await loadExisting(), { ...PIPELINE, managedRefs: new Set(["attraction:deo-ma-pi-leng"]) });
    expect(plan.counts.reindex).toBe(1);

    await writeChunk(plan.toEmbed[0], PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());
    const row = await readRow("attraction:deo-ma-pi-leng");
    expect(row.content).toBe("Nội dung đã sửa.");
    expect(row.version).toBe(2);
  });
});

describe("IT-ING-03: xoá đúng phạm vi corpus đang quản lý", () => {
  it("đoạn mồ côi cùng nguồn bị xoá, đoạn của nguồn khác không bị đụng tới", async () => {
    await writeChunk({ chunk: chunk(), action: "create" }, PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index());
    await writeChunk(
      { chunk: chunk({ slug: "attraction:deo-ma-pi-leng#1" }), action: "create" },
      PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index(),
    );
    await writeChunk(
      { chunk: chunk({ slug: "policy:huy-dat-cho", sourceRef: "policy:huy-dat-cho", domain: "policy" }), action: "create" },
      PIPELINE.embeddingModel, PIPELINE.pipelineVersion, index(),
    );

    // Lần chạy chỉ quản lý nguồn attraction, và tài liệu đó nay chỉ còn một đoạn.
    const plan = planIngest([chunk()], await loadExisting(), {
      ...PIPELINE,
      managedRefs: new Set(["attraction:deo-ma-pi-leng"]),
    });
    expect(plan.toDelete).toEqual(["attraction:deo-ma-pi-leng#1"]);

    await prisma.knowledgeDoc.deleteMany({ where: { slug: { in: plan.toDelete } } });
    const slugs = (await prisma.knowledgeDoc.findMany({ select: { slug: true } })).map((row) => row.slug).sort();
    expect(slugs).toEqual(["attraction:deo-ma-pi-leng", "policy:huy-dat-cho"]);
  });
});

/** Đọc trạng thái hiện có theo đúng cách scripts/ingest-knowledge.ts đọc. */
async function loadExisting(): Promise<ExistingChunk[]> {
  const rows = await prisma.knowledgeDoc.findMany({
    select: {
      slug: true, sourceRef: true, contentHash: true, embeddingModel: true, pipelineVersion: true,
      docType: true, domain: true, entityType: true, entityId: true, tags: true, season: true,
      title: true, content: true, scope: true, placeSlug: true, chunkIndex: true, tokenCount: true,
      sourceUrl: true, sourceClass: true, verifiedAt: true, validUntil: true,
    },
  });
  const indexed = await prisma.$queryRaw<{ slug: string }[]>`
    SELECT "slug" FROM "KnowledgeDoc" WHERE "embedding" IS NOT NULL AND "search_tsv" IS NOT NULL
  `;
  const hasVectors = new Set(indexed.map((row) => row.slug));
  return rows.map((row) => ({ ...row, scope: String(row.scope), hasVectors: hasVectors.has(row.slug) }));
}
