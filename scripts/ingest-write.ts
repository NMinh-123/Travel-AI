import { prisma } from "@server/infra/db";
import { toVectorLiteral } from "@server/domain/rag/embedder";
import type { PlannedChunk } from "./ingest-plan";

/**
 * Tách khỏi scripts/ingest-knowledge.ts vì file đó là một CLI — nó gọi `main()` ngay khi được nạp,
 * nên không import được từ test mà không kích hoạt cả lần chạy ingest. Phần ghi lại là phần cần
 * test integration nhất: tính nguyên tử giữa hàng và vector chỉ kiểm được trên Postgres thật.
 */

/**
 * Ghi một đoạn: hàng và vector trong CÙNG một transaction.
 *
 * Đây là phép sửa cho tính chất số 2 ở đầu file. Bản trước gọi `upsert` rồi gọi `$executeRaw` như
 * hai thao tác rời; tiến trình chết giữa hai câu — hoặc sidecar embedding timeout ở đoạn kế tiếp
 * làm cả script dừng — để lại một hàng mang nội dung MỚI cùng vector CŨ. Trạng thái đó không có
 * dấu vết nào: hàng vẫn đủ cột, vẫn được truy xuất, chỉ là vector trỏ về một nội dung không còn
 * tồn tại. Gói vào transaction thì hoặc cả hai cùng có, hoặc không có gì.
 *
 * `index` null nghĩa là chỉ sửa metadata: nội dung không đổi nên vector cũ vẫn đúng, không việc gì
 * phải ghi lại.
 */
export async function writeChunk(
  item: PlannedChunk,
  embeddingModel: string,
  pipelineVersion: string,
  index: { vector: number[]; title: string; body: string } | null,
): Promise<void> {
  const chunk = item.chunk;
  const row = {
    docType: chunk.docType, domain: chunk.domain, entityType: chunk.entityType, entityId: chunk.entityId,
    tags: chunk.tags, season: chunk.season, title: chunk.title, content: chunk.content,
    sourceRef: chunk.sourceRef, scope: chunk.scope, placeSlug: chunk.placeSlug,
    chunkIndex: chunk.chunkIndex, tokenCount: chunk.tokenCount,
    sourceUrl: chunk.sourceUrl, sourceClass: chunk.sourceClass,
    verifiedAt: chunk.verifiedAt, validUntil: chunk.validUntil,
    contentHash: chunk.contentHash, embeddingModel, pipelineVersion,
  };

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDoc.upsert({
      where: { slug: chunk.slug },
      create: { ...row, slug: chunk.slug, status: "APPROVED", language: "vi" },
      // `version` chỉ tăng khi nội dung hoặc metadata thật sự đổi — và mọi lượt gọi hàm này đều
      // là một lần như vậy, vì `planIngest` đã loại các đoạn không đổi trước khi tới đây.
      update: { ...row, version: { increment: 1 } },
    });

    if (!index) return;

    // embedding và search_tsv là kiểu Unsupported nên Prisma Client không ghi được — phải raw SQL.
    // Trọng số A cho tiêu đề, B cho nội dung theo SRS Mục 11.4.4.
    await tx.$executeRaw`
      UPDATE "KnowledgeDoc"
      SET "embedding" = ${toVectorLiteral(index.vector)}::vector,
          "search_tsv" =
            setweight(to_tsvector('vietnamese', ${index.title}), 'A') ||
            setweight(to_tsvector('vietnamese', ${index.body}), 'B')
      WHERE "slug" = ${chunk.slug}
    `;
  });
}
