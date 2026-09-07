import type { KnowledgeDocType } from "@prisma/client";
import { config } from "../server/config";
import { prisma } from "../server/db";
import { CHUNK_PROFILES, chunkText, estimateTokens } from "../server/rag/chunker";
import { getEmbedder, toVectorLiteral } from "../server/rag/embedder";
import { segmentBatch } from "../server/rag/segment";
import { DESTINATIONS } from "../prisma/seed-data";
import { PLACES } from "../prisma/place-data";
import { POLICY_AND_FAQ, type KnowledgeSourceDoc } from "./knowledge-source";
import { WEB_KNOWLEDGE } from "./knowledge-web";

/**
 * Nạp kho tri thức cho chatbot — nhánh A của SRS Hình 11.1 (chạy ngoại tuyến, khi nội dung đổi).
 *
 *   npm run db:ingest
 *
 * Idempotent theo cùng quy ước với prisma/seed.ts: upsert theo slug, rồi xoá các bản ghi có slug
 * không còn trong nguồn. Bỏ một điểm đến khỏi seed-data là nó biến khỏi kho tri thức.
 *
 * Bước này cần CẢ HAI thứ cùng sống: database và nguồn embedding. Đó là lý do nó nằm cuối thứ tự
 * thi công của Vòng 5.
 */

interface PreparedChunk {
  slug: string;
  docType: KnowledgeDocType;
  title: string;
  content: string;
  sourceRef: string;
  scope: "PROVINCE" | "PLACE";
  placeSlug: string | null;
  chunkIndex: number;
  tokenCount: number;
}

/**
 * Câu ghi nguồn gắn vào cuối mỗi đoạn của tài liệu lấy từ web.
 *
 * Gắn sau khi chunk chứ không phải trước: nếu nhét vào `doc.content` rồi mới cắt thì chỉ đoạn
 * CUỐI mang được nguồn, mà truy xuất thì trả về từng đoạn rời — đoạn không mang nguồn sẽ được
 * model đọc như tri thức không rõ xuất xứ.
 */
function sourceNote(doc: KnowledgeSourceDoc): string {
  if (!doc.sourceUrl) return "";
  const when = doc.retrievedAt ? `, đối chiếu ngày ${doc.retrievedAt}` : "";
  return ` (Nguồn tham khảo: ${doc.sourceUrl}${when}.)`;
}

/** Chia theo cấu trúc tài liệu trước, theo kích thước sau (SRS Mục 11.4.3). */
function prepare(doc: KnowledgeSourceDoc, profileKey: "short" | "article"): PreparedChunk[] {
  const chunks = chunkText(doc.content, CHUNK_PROFILES[profileKey]);
  const sourceRef = `${doc.docType}:${doc.slug}`;
  const note = sourceNote(doc);

  return chunks.map((body, index) => {
    const content = `${body}${note}`;
    return {
      slug: chunks.length === 1 ? sourceRef : `${sourceRef}#${index}`,
      docType: doc.docType as KnowledgeDocType,
      title: doc.title,
      content,
      sourceRef,
      scope: doc.place ? ("PLACE" as const) : ("PROVINCE" as const),
      placeSlug: doc.place ?? null,
      chunkIndex: index,
      tokenCount: estimateTokens(content),
    };
  });
}

/**
 * Điểm đến: gộp các trường mô tả thành một bài viết rồi mới cắt.
 *
 * KHÔNG đưa vào kho tri thức: toạ độ, ảnh, khoảng cách, độ cao. Đó là dữ liệu có cấu trúc mà tác
 * tử lấy trực tiếp qua tool layer — đúng ranh giới SRS Mục 11.4 giữa "tri thức văn bản" và "số
 * liệu". Nhét số vào RAG là mở đường cho model đọc sai rồi nói sai.
 */
function destinationDocs(): KnowledgeSourceDoc[] {
  return DESTINATIONS.map((row) => ({
    slug: row.id,
    docType: "destination" as const,
    title: `${row.vietnameseName} (${row.name})`,
    place: row.id,
    content: [
      row.description,
      `Thời điểm lý tưởng để tới: ${row.bestTime}.`,
      `Điểm nhấn nổi bật: ${row.highlights.join("; ")}.`,
      `Đặc sản nên thử tại đây: ${row.localFood.join("; ")}.`,
      `Lưu ý an toàn: ${row.safetyTip}`,
      `Độ khó di chuyển: ${row.difficulty}.`,
    ].join(" "),
  }));
}

async function main() {
  const embedder = getEmbedder();
  console.log(`Nguồn embedding: ${embedder.kind} (${embedder.model})`);

  // WEB_KNOWLEDGE dùng hồ sơ "article" chứ không phải "short" như POLICY_AND_FAQ: các mục thu
  // thập từ web dài hơn một điều khoản FAQ, và khi buộc phải cắt thì cần chồng lấn để câu trả
  // lời không rơi đúng vào chỗ nối giữa hai đoạn.
  const prepared = [
    ...POLICY_AND_FAQ.flatMap((doc) => prepare(doc, "short")),
    ...WEB_KNOWLEDGE.flatMap((doc) => prepare(doc, "article")),
    ...destinationDocs().flatMap((doc) => prepare(doc, "article")),
  ];
  const documentCount = POLICY_AND_FAQ.length + WEB_KNOWLEDGE.length + DESTINATIONS.length;
  console.log(`Chuẩn bị ${prepared.length} đoạn từ ${documentCount} tài liệu.`);

  /**
   * KnowledgeDoc.placeSlug cố tình KHÔNG có khoá ngoại tới Place — kho tri thức được đánh chỉ mục
   * lại độc lập với dữ liệu nghiệp vụ. Đổi lại, tính toàn vẹn phải được kiểm ở đây, và kiểm ngay
   * trước khi tốn công sinh embedding.
   *
   * Sai sót thực tế mà bước này bắt được: thêm một điểm đến vào seed-data mà quên thêm dòng tương
   * ứng vào place-data. Bài viết của nó sẽ mang placeSlug không tồn tại, nên bộ lọc địa danh
   * không bao giờ khớp và bài đó lặng lẽ biến mất khỏi mọi câu trả lời — không lỗi, không cảnh báo.
   */
  const known = new Set(PLACES.map((place) => place.slug));
  const orphans = [
    ...new Set(prepared.map((chunk) => chunk.placeSlug).filter((slug): slug is string => Boolean(slug))),
  ].filter((slug) => !known.has(slug));

  if (orphans.length) {
    throw new Error(
      `placeSlug không có trong prisma/place-data.ts: ${orphans.join(", ")}. ` +
        `Thêm địa danh vào từ điển, hoặc bỏ trường place của tài liệu tương ứng.`,
    );
  }

  // Sinh embedding theo lô để không giữ toàn bộ vector trong bộ nhớ và để sidecar không nhận một
  // request quá lớn.
  const BATCH = 16;
  const vectors: number[][] = [];
  for (let index = 0; index < prepared.length; index += BATCH) {
    const batch = prepared.slice(index, index + BATCH);
    vectors.push(...(await embedder.embed(batch.map((chunk) => `${chunk.title}\n${chunk.content}`))));
    console.log(`  đã embed ${Math.min(index + BATCH, prepared.length)}/${prepared.length}`);
  }

  // Tách từ phải ĐỐI XỨNG với lúc truy vấn. segmentBatch tự trả nguyên văn khi cờ tắt, nên hai
  // phía luôn cùng dạng miễn là cùng đọc config.viSegmentEnabled.
  const titles = await segmentBatch(prepared.map((chunk) => chunk.title));
  const bodies = await segmentBatch(prepared.map((chunk) => chunk.content));
  if (config.viSegmentEnabled) console.log("Đã bật tách từ tiếng Việt cho nhánh từ khoá.");

  for (let index = 0; index < prepared.length; index += 1) {
    const chunk = prepared[index];

    await prisma.knowledgeDoc.upsert({
      where: { slug: chunk.slug },
      create: { ...chunk, status: "APPROVED", language: "vi" },
      update: {
        docType: chunk.docType,
        title: chunk.title,
        content: chunk.content,
        sourceRef: chunk.sourceRef,
        scope: chunk.scope,
        placeSlug: chunk.placeSlug,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        version: { increment: 1 },
      },
    });

    // embedding và search_tsv là kiểu Unsupported nên Prisma Client không ghi được — phải raw SQL.
    // Trọng số A cho tiêu đề, B cho nội dung theo SRS Mục 11.4.4.
    await prisma.$executeRaw`
      UPDATE "KnowledgeDoc"
      SET "embedding" = ${toVectorLiteral(vectors[index])}::vector,
          "search_tsv" =
            setweight(to_tsvector('vietnamese', ${titles[index]}), 'A') ||
            setweight(to_tsvector('vietnamese', ${bodies[index]}), 'B')
      WHERE "slug" = ${chunk.slug}
    `;
  }

  const keep = prepared.map((chunk) => chunk.slug);
  const removed = await prisma.knowledgeDoc.deleteMany({ where: { slug: { notIn: keep } } });

  console.log(`Đã nạp ${prepared.length} đoạn, xoá ${removed.count} đoạn mồ côi.`);

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "KnowledgeDoc"
    WHERE "embedding" IS NOT NULL AND "search_tsv" IS NOT NULL
  `;
  console.log(`Kiểm tra: ${count} đoạn có đủ cả vector lẫn chỉ mục từ khoá.`);

  if (Number(count) !== prepared.length) {
    throw new Error("Có đoạn thiếu vector hoặc thiếu search_tsv — kho tri thức chưa dùng được.");
  }
}

main()
  .catch((error) => {
    console.error("Ingest thất bại:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
