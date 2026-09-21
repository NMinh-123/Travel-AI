import { describe, expect, it } from "vitest";
import {
  contentHashOf, embeddingInput, parseArgs, planIngest, prepare, pruneGuard, validUntilFor,
  type ExistingChunk, type PreparedChunk,
} from "./ingest-plan";
import type { KnowledgeSourceDoc } from "@data/knowledge/index";
import { ALL_KNOWLEDGE } from "@data/knowledge/index";

const doc: KnowledgeSourceDoc = {
  slug: "food-thang-co",
  domain: "food",
  entityType: "local_food",
  entityId: "thang-co",
  title: "Thắng cố",
  content: "Thắng cố là món của người Mông, nấu trong một chiếc chảo lớn đặt giữa phiên chợ.",
  tags: ["mon-dia-phuong"],
  season: ["quanh_nam"],
  sourceClass: "editorial",
};

/** Bản ghi database khớp hoàn toàn với một đoạn đã chuẩn bị — điểm xuất phát của mọi bài test. */
function existingFor(chunk: PreparedChunk, patch: Partial<ExistingChunk> = {}): ExistingChunk {
  return {
    slug: chunk.slug, sourceRef: chunk.sourceRef, contentHash: chunk.contentHash,
    embeddingModel: "bge-m3", pipelineVersion: "chunk:1/seg:off", hasVectors: true,
    docType: chunk.docType, domain: chunk.domain, entityType: chunk.entityType, entityId: chunk.entityId,
    tags: chunk.tags, season: chunk.season, title: chunk.title, content: chunk.content,
    scope: chunk.scope, placeSlug: chunk.placeSlug, chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount, sourceUrl: chunk.sourceUrl, sourceClass: chunk.sourceClass,
    verifiedAt: chunk.verifiedAt, validUntil: chunk.validUntil,
    ...patch,
  };
}

const options = (managed: string[]) => ({
  embeddingModel: "bge-m3",
  pipelineVersion: "chunk:1/seg:off",
  managedRefs: new Set(managed),
});

describe("KI-01: chuẩn bị đoạn là tất định", () => {
  it("cùng đầu vào cho cùng slug, cùng nội dung và cùng vân tay", () => {
    expect(prepare(doc)).toEqual(prepare(doc));
  });

  it("vân tay tính trên ĐÚNG chuỗi đem đi embed", () => {
    const [chunk] = prepare(doc);
    expect(chunk.contentHash).toBe(contentHashOf({ title: chunk.title, content: chunk.content }));
    expect(embeddingInput(chunk)).toBe(`${chunk.title}\n${chunk.content}`);
  });

  it("đổi một ký tự trong nội dung là đổi vân tay", () => {
    const [before] = prepare(doc);
    const [after] = prepare({ ...doc, content: `${doc.content} Thêm một câu.` });
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it("câu ghi nguồn gắn vào MỌI đoạn, nên nó nằm trong vân tay", () => {
    const [chunk] = prepare({
      ...doc, sourceClass: "crawled_verified", sourceUrl: "https://example.invalid/x", retrievedAt: "2026-01-15",
    });
    expect(chunk.content).toContain("Nguồn tham khảo: https://example.invalid/x");
    expect(chunk.sourceUrl).toBe("https://example.invalid/x");
    expect(chunk.verifiedAt).toEqual(new Date("2026-01-15T00:00:00.000Z"));
  });
});

describe("KI-02: hạn tin cậy của nội dung ngoài", () => {
  it("nội dung biên tập không có hạn", () => {
    expect(validUntilFor(doc)).toBeNull();
  });

  it("nội dung ước lượng hết hạn sớm hơn nội dung crawl", () => {
    const base = { ...doc, retrievedAt: "2026-01-01" };
    const estimated = validUntilFor({ ...base, sourceClass: "estimated", sourceUrl: "https://x.invalid" });
    const crawled = validUntilFor({ ...base, sourceClass: "crawled_verified", sourceUrl: "https://x.invalid" });
    expect(estimated).not.toBeNull();
    expect(crawled).not.toBeNull();
    expect(estimated!.getTime()).toBeLessThan(crawled!.getTime());
  });

  it("không có ngày đối chiếu thì không bịa ra hạn", () => {
    expect(validUntilFor({ ...doc, sourceClass: "estimated", sourceUrl: "https://x.invalid" })).toBeNull();
  });
});

describe("KI-03: chạy lại cùng dữ liệu không tạo thay đổi", () => {
  const prepared = prepare(doc);
  const managed = options([prepared[0].sourceRef]);

  it("mọi đoạn khớp vân tay thì không đoạn nào bị ghi lại", () => {
    const plan = planIngest(prepared, prepared.map((chunk) => existingFor(chunk)), managed);
    expect(plan.counts).toEqual({ create: 0, reindex: 0, update: 0, unchanged: prepared.length });
    expect(plan.toEmbed).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("toàn bộ kho tri thức thật cũng cho kết quả không đổi khi chạy lại", () => {
    const all = ALL_KNOWLEDGE.flatMap(prepare);
    const plan = planIngest(all, all.map((chunk) => existingFor(chunk)), options(all.map((chunk) => chunk.sourceRef)));
    expect(plan.counts.unchanged).toBe(all.length);
    expect(plan.toEmbed).toHaveLength(0);
  });
});

describe("KI-04: khi nào phải embed lại", () => {
  const [chunk] = prepare(doc);
  const managed = options([chunk.sourceRef]);
  const planOne = (patch: Partial<ExistingChunk>) => planIngest([chunk], [existingFor(chunk, patch)], managed).planned[0];

  it("chưa có trong database thì tạo mới", () => {
    expect(planIngest([chunk], [], managed).planned[0].action).toBe("create");
  });

  it.each([
    ["nội dung đổi", { contentHash: "khac" }],
    ["đổi model embedding", { embeddingModel: "gemini-embedding-001" }],
    ["đổi pipeline", { pipelineVersion: "chunk:2/seg:off" }],
    ["thiếu vector", { hasVectors: false }],
  ])("%s -> đánh chỉ mục lại", (reason, patch) => {
    const planned = planOne(patch);
    expect(planned.action).toBe("reindex");
    expect(planned.reason).toContain(reason.split(" ")[0]);
  });

  it("chỉ metadata đổi thì ghi lại hàng nhưng KHÔNG embed lại", () => {
    const planned = planOne({ tags: ["khac-han"] });
    expect(planned.action).toBe("update");
    expect(planIngest([chunk], [existingFor(chunk, { tags: ["khac-han"] })], managed).toEmbed).toHaveLength(0);
  });

  it("đổi hạn tin cậy cũng là metadata đổi, không phải nội dung đổi", () => {
    expect(planOne({ validUntil: new Date("2027-01-01T00:00:00.000Z") }).action).toBe("update");
  });
});

describe("KI-05: xoá bị giới hạn trong corpus đang quản lý", () => {
  const [chunk] = prepare(doc);

  it("đoạn mồ côi CÙNG sourceRef thì được xoá", () => {
    const orphan = existingFor(chunk, { slug: `${chunk.sourceRef}#9` });
    const plan = planIngest([chunk], [existingFor(chunk), orphan], options([chunk.sourceRef]));
    expect(plan.toDelete).toEqual([`${chunk.sourceRef}#9`]);
  });

  it("đoạn thuộc sourceRef KHÔNG quản lý thì tuyệt đối không đụng tới", () => {
    const other = existingFor(chunk, { slug: "policy:policy-huy-dat-cho", sourceRef: "policy:policy-huy-dat-cho" });
    const plan = planIngest([chunk], [existingFor(chunk), other], options([chunk.sourceRef]));
    expect(plan.toDelete).toEqual([]);
  });

  it("chạy lọc theo một domain không được xoá domain khác", () => {
    const food = prepare(doc);
    const policyRow = existingFor(food[0], { slug: "policy:a", sourceRef: "policy:a" });
    const plan = planIngest(food, [...food.map((c) => existingFor(c)), policyRow], options(food.map((c) => c.sourceRef)));
    expect(plan.toDelete).toEqual([]);
  });
});

describe("KI-06: tham số dòng lệnh", () => {
  it("mặc định là chạy đầy đủ, có ghi, không bỏ qua vân tay", () => {
    expect(parseArgs([])).toEqual({ domains: null, dryRun: false, reindex: false, allowPrune: false });
  });

  it("đọc được bộ lọc domain và các cờ", () => {
    expect(parseArgs(["--domain", "food,policy"]).domains).toEqual(["food", "policy"]);
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
    expect(parseArgs(["--reindex"]).reindex).toBe(true);
    expect(parseArgs(["--allow-prune"]).allowPrune).toBe(true);
  });

  it("từ chối tham số lạ và --domain thiếu giá trị", () => {
    expect(() => parseArgs(["--khong-co"])).toThrow();
    expect(() => parseArgs(["--domain"])).toThrow();
    expect(() => parseArgs(["--domain", "--dry-run"])).toThrow();
  });
});

describe("KI-07: hàng rào chống xoá nhầm diện rộng", () => {
  it("cho qua khi xoá vài đoạn lẻ", () => {
    expect(pruneGuard(5, 162, false)).toBeNull();
  });

  it("chặn khi một nhóm nội dung biến mất khỏi nguồn", () => {
    // Đúng kịch bản đã xảy ra: gỡ nhầm một dòng import ở @data/knowledge/index.
    expect(pruneGuard(60, 162, false)).toContain("vượt ngưỡng an toàn");
  });

  it("--allow-prune là cách con người xác nhận, và kho rỗng thì không có gì để chặn", () => {
    expect(pruneGuard(60, 162, true)).toBeNull();
    expect(pruneGuard(0, 0, false)).toBeNull();
  });
});
