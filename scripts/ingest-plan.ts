import { createHash } from "node:crypto";
import type { KnowledgeDocType, KnowledgeDomain, KnowledgeEntityType, KnowledgeSourceClass } from "@prisma/client";
import { CHUNK_PROFILES, chunkText, estimateTokens } from "@server/domain/rag/chunker";
import type { KnowledgeSourceDoc } from "@data/knowledge/index";
// Chính sách hạn tin cậy sống ở `data/` để bộ xác thực dữ liệu cũng hỏi được nó; ở đây chỉ dùng.
import { validUntilFor } from "@data/knowledge/validity";

export { validUntilFor };

/**
 * QUYẾT ĐỊNH CỦA MỘT LẦN INGEST, tách khỏi phần đọc ghi database.
 *
 * Tách ra vì đây là phần dễ sai nhất và cũng là phần duy nhất kiểm được mà không cần database:
 * đoạn nào phải embed lại, đoạn nào chỉ sửa metadata, đoạn nào không đụng tới, và đoạn nào được
 * phép xoá. Bản trước trộn ba câu hỏi đó vào một vòng lặp có `version: { increment: 1 }` và một
 * `deleteMany` quét toàn bảng, nên không có cách nào khẳng định "chạy lại cùng dữ liệu thì không
 * đổi gì" ngoài việc chạy thật rồi nhìn.
 */

export interface PreparedChunk {
  slug: string;
  docType: KnowledgeDocType;
  domain: KnowledgeDomain;
  entityType: KnowledgeEntityType;
  entityId: string | null;
  tags: string[];
  season: string[];
  title: string;
  content: string;
  sourceRef: string;
  scope: "PROVINCE" | "PLACE";
  placeSlug: string | null;
  chunkIndex: number;
  tokenCount: number;
  sourceUrl: string | null;
  sourceClass: KnowledgeSourceClass;
  verifiedAt: Date | null;
  validUntil: Date | null;
  /** Vân tay của ĐÚNG chuỗi sẽ đem đi embed. Xem `embeddingInput`. */
  contentHash: string;
}

/** Hình dạng bản ghi đã có trong database, rút gọn còn những trường ảnh hưởng tới quyết định. */
export interface ExistingChunk {
  slug: string;
  sourceRef: string;
  contentHash: string;
  embeddingModel: string;
  pipelineVersion: string;
  /** Có đủ cả vector lẫn chỉ mục từ khoá hay không. Thiếu một trong hai là phải đánh chỉ mục lại. */
  hasVectors: boolean;
  docType: KnowledgeDocType;
  domain: KnowledgeDomain;
  entityType: KnowledgeEntityType;
  entityId: string | null;
  tags: string[];
  season: string[];
  title: string;
  content: string;
  scope: string;
  placeSlug: string | null;
  chunkIndex: number;
  tokenCount: number;
  sourceUrl: string | null;
  sourceClass: KnowledgeSourceClass;
  verifiedAt: Date | null;
  validUntil: Date | null;
}

export type ChunkAction =
  /** Chưa có trong database. Phải embed. */
  | "create"
  /** Nội dung hoặc phiên bản pipeline đổi, hoặc thiếu vector. Phải embed lại. */
  | "reindex"
  /** Chỉ metadata đổi (tags, mùa, xuất xứ). Ghi lại hàng, KHÔNG embed lại. */
  | "update"
  /** Không có gì đổi. Không chạm vào hàng, để `updatedAt` và `version` đứng yên. */
  | "unchanged";

export interface PlannedChunk {
  chunk: PreparedChunk;
  action: ChunkAction;
  /** Vì sao phải embed lại — đi thẳng vào log để mỗi lần đánh chỉ mục lại đều giải thích được. */
  reason?: string;
}

export interface IngestPlan {
  planned: PlannedChunk[];
  /** Những đoạn cần gọi embedder, theo đúng thứ tự trong `planned`. */
  toEmbed: PlannedChunk[];
  /** Slug được phép xoá trong phạm vi corpus đang quản lý. */
  toDelete: string[];
  counts: Record<ChunkAction, number>;
}

/**
 * Chuỗi thật sự đem đi embed.
 *
 * Phải là MỘT hàm dùng chung cho cả lúc băm lẫn lúc gọi embedder. Tách thành hai chỗ là mở đường
 * cho tình huống tệ nhất của ingest tăng dần: vân tay tính trên một chuỗi, vector tính trên một
 * chuỗi khác, và từ đó về sau không lần chạy nào phát hiện ra nội dung đã lệch khỏi vector.
 */
export function embeddingInput(chunk: Pick<PreparedChunk, "title" | "content">): string {
  return `${chunk.title}\n${chunk.content}`;
}

export function contentHashOf(chunk: Pick<PreparedChunk, "title" | "content">): string {
  return createHash("sha256").update(embeddingInput(chunk), "utf8").digest("hex");
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameDate(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) return left === right;
  return left.getTime() === right.getTime();
}

/** Metadata đổi mà nội dung không đổi: ghi lại hàng nhưng không tốn một lượt embed nào. */
function metadataChanged(chunk: PreparedChunk, existing: ExistingChunk): boolean {
  return (
    chunk.docType !== existing.docType ||
    chunk.domain !== existing.domain ||
    chunk.entityType !== existing.entityType ||
    chunk.entityId !== existing.entityId ||
    chunk.sourceRef !== existing.sourceRef ||
    chunk.scope !== existing.scope ||
    chunk.placeSlug !== existing.placeSlug ||
    chunk.chunkIndex !== existing.chunkIndex ||
    chunk.tokenCount !== existing.tokenCount ||
    chunk.sourceUrl !== existing.sourceUrl ||
    chunk.sourceClass !== existing.sourceClass ||
    !sameDate(chunk.verifiedAt, existing.verifiedAt) ||
    !sameDate(chunk.validUntil, existing.validUntil) ||
    !sameList(chunk.tags, existing.tags) ||
    !sameList(chunk.season, existing.season) ||
    chunk.title !== existing.title ||
    chunk.content !== existing.content
  );
}

export interface PlanOptions {
  /** Nhận dạng pipeline đang chạy. Đổi giá trị này là buộc đánh chỉ mục lại toàn bộ. */
  embeddingModel: string;
  pipelineVersion: string;
  /**
   * `sourceRef` mà lần chạy này quản lý. Chỉ những hàng có `sourceRef` trong tập này mới được
   * phép xoá.
   *
   * Đây là hàng rào thay cho `deleteMany({ slug: { notIn: keep } })` của bản trước, vốn xoá MỌI
   * hàng không nằm trong danh sách hiện tại. Với một lần chạy lọc theo domain thì câu lệnh đó xoá
   * sạch phần còn lại của kho, và với một lần chạy đầy đủ mà ai đó lỡ bỏ một dòng import thì nó
   * xoá sạch nhóm nội dung tương ứng — đúng sự cố mà chú thích ở đầu script ingest đã kể.
   */
  managedRefs: Set<string>;
}

export function planIngest(prepared: PreparedChunk[], existing: ExistingChunk[], options: PlanOptions): IngestPlan {
  const bySlug = new Map(existing.map((row) => [row.slug, row]));
  const planned: PlannedChunk[] = prepared.map((chunk) => {
    const row = bySlug.get(chunk.slug);
    if (!row) return { chunk, action: "create" as const };

    // Vân tay rỗng là hàng nạp TRƯỚC khi có ingest tăng dần (migration đặt mặc định chuỗi rỗng).
    // Nói đúng tên tình huống thay vì gán cho nó là "nội dung đổi": lần chạy đầu sau migration sẽ
    // đánh chỉ mục lại toàn bộ, và người đọc log cần biết đó là chuyện một lần chứ không phải dấu
    // hiệu nội dung vừa bị sửa hàng loạt.
    if (!row.contentHash) return { chunk, action: "reindex" as const, reason: "chưa có vân tay (hàng nạp trước khi có ingest tăng dần)" };
    if (row.contentHash !== chunk.contentHash) return { chunk, action: "reindex" as const, reason: "nội dung đổi" };
    if (row.embeddingModel !== options.embeddingModel) {
      return { chunk, action: "reindex" as const, reason: `đổi model embedding (${row.embeddingModel} -> ${options.embeddingModel})` };
    }
    if (row.pipelineVersion !== options.pipelineVersion) {
      return { chunk, action: "reindex" as const, reason: `đổi pipeline (${row.pipelineVersion} -> ${options.pipelineVersion})` };
    }
    // Hàng có nội dung đúng nhưng thiếu vector là dấu vết của một lần chạy hỏng giữa chừng ở bản
    // cũ. Lần chạy này phải vá nó thay vì bỏ qua vì vân tay trùng.
    if (!row.hasVectors) return { chunk, action: "reindex" as const, reason: "thiếu vector hoặc chỉ mục từ khoá" };

    if (metadataChanged(chunk, row)) return { chunk, action: "update" as const };
    return { chunk, action: "unchanged" as const };
  });

  const keep = new Set(prepared.map((chunk) => chunk.slug));
  const toDelete = existing
    .filter((row) => !keep.has(row.slug) && options.managedRefs.has(row.sourceRef))
    .map((row) => row.slug);

  const counts: Record<ChunkAction, number> = { create: 0, reindex: 0, update: 0, unchanged: 0 };
  for (const item of planned) counts[item.action] += 1;

  return {
    planned,
    toEmbed: planned.filter((item) => item.action === "create" || item.action === "reindex"),
    toDelete,
    counts,
  };
}

interface Options {
  domains: string[] | null;
  dryRun: boolean;
  reindex: boolean;
  allowPrune: boolean;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { domains: null, dryRun: false, reindex: false, allowPrune: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--dry-run") options.dryRun = true;
    else if (name === "--reindex") options.reindex = true;
    else if (name === "--allow-prune") options.allowPrune = true;
    else if (name === "--domain") {
      const value = argv[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--domain cần danh sách domain, ví dụ --domain food,policy");
      options.domains = value.split(",").map((item) => item.trim()).filter(Boolean);
    } else throw new Error(`Tham số không được hỗ trợ: ${name}`);
  }
  return options;
}

/**
 * Ánh xạ `domain` mới về `docType` cũ.
 *
 * `docType` được GIỮ LẠI một vòng phát hành để rollback được — bỏ ngay là cắt đường lui trong khi
 * bộ lọc metadata mới chưa được đo trên bộ câu hỏi vàng. Nó sẽ bị bỏ ở migration sau. Trong lúc
 * đó, hai cột phải nhất quán, và ánh xạ này là nơi duy nhất quyết định điều đó.
 */
function legacyDocType(domain: KnowledgeDomain): KnowledgeDocType {
  switch (domain) {
    case "policy":
      return "policy";
    case "destination":
    case "attraction":
      return "destination";
    case "tour":
      return "tour_desc";
    default:
      return "faq";
  }
}

/**
 * Câu ghi nguồn gắn vào cuối mỗi đoạn của tài liệu lấy từ web hoặc tài liệu ước lượng.
 *
 * Gắn SAU khi chunk chứ không phải trước: nếu nhét vào `doc.content` rồi mới cắt thì chỉ đoạn CUỐI
 * mang được nguồn, mà truy xuất thì trả về từng đoạn rời — đoạn không mang nguồn sẽ được model đọc
 * như tri thức không rõ xuất xứ.
 */
function sourceNote(doc: KnowledgeSourceDoc): string {
  if (!doc.sourceUrl) return "";
  const when = doc.retrievedAt ? `, đối chiếu ngày ${doc.retrievedAt}` : "";
  const kind = doc.sourceClass === "estimated" ? "Giá tham khảo, tổng hợp từ" : "Nguồn tham khảo:";
  return ` (${kind} ${doc.sourceUrl}${when}.)`;
}

/**
 * Chọn hồ sơ cắt đoạn theo độ dài thật của tài liệu, không theo nhóm nội dung.
 *
 * Bản trước gán hồ sơ theo nguồn (FAQ dùng "short", tri thức web dùng "article") và điều đó sai
 * khi nội dung không đồng đều: một mục chính sách dài vẫn bị cắt theo hồ sơ ngắn nên mất chồng lấn,
 * còn một tài liệu văn hoá ngắn thì không cần chồng lấn mà vẫn phải chịu. Đo theo độ dài thì quyết
 * định luôn khớp với thứ đang cắt.
 */
function profileFor(doc: KnowledgeSourceDoc): "short" | "article" {
  return doc.content.length > 700 ? "article" : "short";
}

/** `YYYY-MM-DD` -> Date lúc nửa đêm UTC. Trả null khi tài liệu không khai ngày. */
function toDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function prepare(doc: KnowledgeSourceDoc): PreparedChunk[] {
  const chunks = chunkText(doc.content, CHUNK_PROFILES[profileFor(doc)]);
  const sourceRef = `${doc.domain}:${doc.slug}`;
  const note = sourceNote(doc);

  return chunks.map((body, index) => {
    const content = `${body}${note}`;
    const title = doc.title;
    return {
      slug: chunks.length === 1 ? sourceRef : `${sourceRef}#${index}`,
      docType: legacyDocType(doc.domain as KnowledgeDomain),
      domain: doc.domain as KnowledgeDomain,
      entityType: doc.entityType as KnowledgeEntityType,
      entityId: doc.entityId ?? null,
      tags: doc.tags,
      season: doc.season,
      title,
      content,
      // Mã tài liệu nguồn, để trích dẫn được nguồn trong câu trả lời và để re-ingest theo nhóm.
      sourceRef,
      // `scope` là cột cũ, nay suy trực tiếp từ việc tài liệu có gắn thực thể hay không. Giữ lại
      // vì `server/domain/rag/retrieval.ts` còn lọc theo nó cho tới khi chuyển hẳn sang entityId.
      scope: doc.entityId ? ("PLACE" as const) : ("PROVINCE" as const),
      placeSlug: doc.entityId ?? null,
      chunkIndex: index,
      tokenCount: estimateTokens(content),
      sourceUrl: doc.sourceUrl ?? null,
      sourceClass: doc.sourceClass as KnowledgeSourceClass,
      verifiedAt: toDate(doc.retrievedAt),
      validUntil: validUntilFor(doc),
      contentHash: contentHashOf({ title, content }),
    };
  });
}

/** Ngưỡng xoá cần người xác nhận. Xem `pruneGuard`. */
export const PRUNE_GUARD_RATIO = 0.3;

/**
 * Hàng rào chống xoá nhầm diện rộng. Trả về thông điệp lỗi, hoặc null khi được phép chạy tiếp.
 *
 * Sự cố cần chặn là đúng sự cố kể ở đầu scripts/ingest-knowledge.ts: một dòng import bị gỡ,
 * `ALL_KNOWLEDGE` mất cả một nhóm nội dung, và lần ingest kế tiếp lặng lẽ xoá nhóm đó khỏi
 * database. Một lần xoá diện rộng luôn đáng để con người xác nhận, vì nó không có đường lui ngoài
 * việc ingest lại toàn bộ.
 */
export function pruneGuard(toDelete: number, existing: number, allowPrune: boolean): string | null {
  if (allowPrune || existing === 0) return null;
  if (toDelete <= existing * PRUNE_GUARD_RATIO) return null;
  return (
    `Kế hoạch xoá ${toDelete}/${existing} đoạn, vượt ngưỡng an toàn ${PRUNE_GUARD_RATIO * 100}%. ` +
    `Kiểm lại @data/knowledge/index xem có nhóm nội dung nào bị gỡ nhầm không, rồi chạy lại với --allow-prune nếu đúng ý.`
  );
}
