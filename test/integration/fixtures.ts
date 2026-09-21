import { prisma } from "@server/infra/db";
import { EMBEDDING_DIM } from "@server/domain/rag/embedder";

/**
 * DỰNG DỮ LIỆU CHO TEST INTEGRATION.
 *
 * Vector ở đây là vector TỔNG HỢP, không gọi sidecar embedding. Lý do: phép kiểm cần khẳng định
 * là "pgvector xếp đúng thứ tự theo khoảng cách cosine", "bộ lọc APPROVED chặn đúng", "tsvector
 * khớp được chữ không dấu" — không phép nào trong số đó phụ thuộc vào chất lượng của model. Gọi
 * model thật chỉ thêm một phụ thuộc chậm, không tất định, và khi test đỏ thì không ai biết lỗi ở
 * SQL hay ở model.
 *
 * Vector một-nóng làm khoảng cách trở nên đọc được bằng mắt: tài liệu `axis: 0` và truy vấn
 * `axis: 0` có cosine đúng bằng 1, còn hai trục khác nhau thì đúng bằng 0. Nhờ vậy các ngưỡng
 * trong test là con số có ý nghĩa chứ không phải số ma thuật.
 */

export function unitVector(axis: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  vector[axis % EMBEDDING_DIM] = 1;
  return vector;
}

/** `[0,1,0,...]` -> `'[0,1,0,...]'`, dạng literal mà pgvector nhận. */
function literal(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export interface DocFixture {
  slug: string;
  title: string;
  content: string;
  axis: number;
  status?: "DRAFT" | "APPROVED" | "ARCHIVED";
  scope?: "PROVINCE" | "PLACE";
  placeSlug?: string | null;
  domain?: string;
  entityType?: string;
  season?: string[];
  sourceRef?: string;
}

/**
 * Chèn một đoạn tri thức đầy đủ vector và chỉ mục từ khoá.
 *
 * Dùng raw SQL cho cả hàng chứ không upsert rồi update: `embedding` và `search_tsv` là kiểu
 * Unsupported nên Prisma Client không ghi được, và tách làm hai câu lệnh sẽ tạo ra đúng trạng thái
 * "nội dung mới đi cùng vector cũ" mà test ingest sinh ra để bắt.
 */
export async function insertDoc(fixture: DocFixture): Promise<void> {
  const sourceRef = fixture.sourceRef ?? `${fixture.domain ?? "travel_guide"}:${fixture.slug}`;
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "KnowledgeDoc" (
      "id", "slug", "docType", "title", "content", "sourceRef", "language", "version", "status",
      "scope", "placeSlug", "domain", "entityType", "entityId", "tags", "season",
      "chunkIndex", "tokenCount", "contentHash", "embeddingModel", "pipelineVersion",
      "sourceClass", "embedding", "search_tsv", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, $1, 'faq', $2, $3, $4, 'vi', 1, $5::"KnowledgeStatus",
      $6::"KnowledgeScope", $7, $8::"KnowledgeDomain", $9::"KnowledgeEntityType", NULL,
      ARRAY[]::text[], $10::text[], 0, 100, '', '', '', 'editorial',
      $11::vector,
      setweight(to_tsvector('vietnamese', $2), 'A') || setweight(to_tsvector('vietnamese', $3), 'B'),
      now(), now()
    )
    `,
    fixture.slug,
    fixture.title,
    fixture.content,
    sourceRef,
    fixture.status ?? "APPROVED",
    fixture.scope ?? "PROVINCE",
    fixture.placeSlug ?? null,
    fixture.domain ?? "travel_guide",
    fixture.entityType ?? "faq",
    fixture.season ?? [],
    literal(unitVector(fixture.axis)),
  );
}

/** Dọn sạch kho tri thức. Mỗi file test tự dựng dữ liệu của mình, không dựa vào file khác. */
export async function resetKnowledge(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "KnowledgeDoc"`);
}

export async function resetPlaces(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Place"`);
}

export async function insertPlace(place: {
  slug: string;
  name: string;
  aliases?: string[];
  kind?: string;
  parentSlug?: string | null;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Place" ("id", "slug", "name", "kind", "aliases", "parentSlug", "sortOrder")
     VALUES (gen_random_uuid()::text, $1, $2, $3::"PlaceKind", $4::text[], $5, 0)`,
    place.slug,
    place.name,
    place.kind ?? "region",
    place.aliases ?? [],
    place.parentSlug ?? null,
  );
}
