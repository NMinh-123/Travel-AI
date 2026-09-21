import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@server/infra/db";
import { auditCorpus } from "./corpus-audit";
import { insertDoc, resetKnowledge } from "@test/integration/fixtures";

/**
 * Bộ soát sức khoẻ kho chỉ kiểm được trên Postgres thật: mọi phép kiểm của nó đều là câu SQL trên
 * cột `vector` và `tsvector` — hai kiểu mà Prisma Client không biểu diễn được.
 *
 * Nhóm này bảo vệ một đặc tính mà không tầng nào khác bảo vệ: kho tri thức hỏng theo kiểu KHÔNG
 * BÁO LỖI. Một đoạn thiếu vector vẫn nằm trong bảng và vẫn được trích dẫn, chỉ là nó biến mất
 * khỏi nhánh ngữ nghĩa.
 */

describe("KC-01: soát sức khoẻ kho tri thức", () => {
  beforeEach(async () => {
    await resetKnowledge();
  });

  it("kho đủ vector và chỉ mục từ khoá thì xanh", async () => {
    await insertDoc({ slug: "a", title: "Thắng cố", content: "Nội dung", axis: 0 });
    const health = await auditCorpus();
    expect(health.total).toBe(1);
    expect(health.healthy, JSON.stringify(health.issues)).toBe(true);
  });

  it("bắt đoạn thiếu vector — đoạn biến mất khỏi nhánh ngữ nghĩa mà không báo gì", async () => {
    await insertDoc({ slug: "a", title: "Thắng cố", content: "Nội dung", axis: 0 });
    await prisma.$executeRawUnsafe(`UPDATE "KnowledgeDoc" SET "embedding" = NULL WHERE "slug" = 'a'`);

    const health = await auditCorpus();
    expect(health.healthy).toBe(false);
    expect(health.issues.map((issue) => issue.code)).toContain("MISSING_VECTOR");
  });

  it("bắt đoạn thiếu search_tsv — đoạn không bao giờ khớp truy vấn không dấu", async () => {
    await insertDoc({ slug: "a", title: "Thắng cố", content: "Nội dung", axis: 0 });
    await prisma.$executeRawUnsafe(`UPDATE "KnowledgeDoc" SET "search_tsv" = NULL WHERE "slug" = 'a'`);

    const health = await auditCorpus();
    expect(health.issues.map((issue) => issue.code)).toContain("MISSING_KEYWORD_INDEX");
  });

  /**
   * Trộn hai model embedding là kiểu hỏng khó thấy nhất: mọi đoạn vẫn có vector, mọi phép so sánh
   * vẫn chạy, chỉ có khoảng cách cosine giữa hai không gian khác nhau là một con số vô nghĩa.
   */
  it("bắt kho trộn nhiều model embedding", async () => {
    await insertDoc({ slug: "a", title: "A", content: "A", axis: 0 });
    await insertDoc({ slug: "b", title: "B", content: "B", axis: 1 });
    await prisma.$executeRawUnsafe(`UPDATE "KnowledgeDoc" SET "embeddingModel" = 'model-cu' WHERE "slug" = 'b'`);

    const health = await auditCorpus();
    expect(health.issues.map((issue) => issue.code)).toContain("EMBEDDING_MODEL_SKEW");
  });

  it("bắt kho embed bằng model khác model đang cấu hình", async () => {
    await insertDoc({ slug: "a", title: "A", content: "A", axis: 0 });
    await prisma.$executeRawUnsafe(`UPDATE "KnowledgeDoc" SET "embeddingModel" = 'model-cu'`);

    const health = await auditCorpus({ embeddingModel: "BAAI/bge-m3", pipelineVersion: "" });
    expect(health.issues.map((issue) => issue.code)).toContain("EMBEDDING_MODEL_SKEW");
  });

  /**
   * Tài liệu vào kho khi còn hạn rồi NẰM ĐÓ tới lúc quá hạn. `data/validate.ts` không bắt được ca
   * này vì nó chỉ đọc dữ liệu nguồn; chỉ một phép soát trên database mới thấy.
   */
  it("bắt tài liệu quá hạn tin cậy mà vẫn ở trạng thái APPROVED", async () => {
    await insertDoc({ slug: "a", title: "A", content: "A", axis: 0 });
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeDoc" SET "validUntil" = NOW() - INTERVAL '1 day' WHERE "slug" = 'a'`,
    );

    const health = await auditCorpus();
    expect(health.issues.map((issue) => issue.code)).toContain("EXPIRED_APPROVED");
  });

  it("còn hạn thì không bị gắn cờ", async () => {
    await insertDoc({ slug: "a", title: "A", content: "A", axis: 0 });
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeDoc" SET "validUntil" = NOW() + INTERVAL '30 days' WHERE "slug" = 'a'`,
    );

    const health = await auditCorpus();
    expect(health.issues.map((issue) => issue.code)).not.toContain("EXPIRED_APPROVED");
  });

  it("kho rỗng là một vấn đề, không phải một kho khoẻ", async () => {
    const health = await auditCorpus();
    expect(health.healthy).toBe(false);
    expect(health.issues.map((issue) => issue.code)).toContain("EMPTY_CORPUS");
  });
});
