import { Prisma } from "@prisma/client";
import type { KnowledgeDocType } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db";
import { getEmbedder, toVectorLiteral } from "./embedder";
import { segmentForSearch } from "./segment";

/**
 * Tìm kiếm lai theo SRS Mục 11.4.4: nhánh vector và nhánh từ khoá chạy song song, hợp nhất bằng
 * Reciprocal Rank Fusion, rồi xếp hạng lại có điều kiện.
 *
 * Vì sao bắt buộc có cả hai nhánh: người dùng Việt Nam gõ không dấu, viết tắt, và phần lớn câu
 * hỏi chứa danh từ riêng ("mã pí lèng", "lô lô chải", "tà làng"). Tìm kiếm từ khoá bắt chính xác
 * danh từ riêng mà vector dễ làm nhoè; vector bắt được các cách diễn đạt khác nhau của cùng một
 * ý. Chỉ dùng một trong hai đều để lọt một nhóm truy vấn.
 */

export interface RetrievedChunk {
  id: string;
  slug: string;
  title: string;
  content: string;
  docType: KnowledgeDocType;
  sourceRef: string;
  scope: "PROVINCE" | "PLACE";
  placeSlug: string | null;
}

export interface RetrievalOptions {
  docTypes?: KnowledgeDocType[];
  /**
   * Khoá Place lấy được từ câu hỏi. Rỗng hoặc bỏ trống thì KHÔNG lọc theo địa danh — câu hỏi
   * không nêu nơi nào thì mọi đoạn đều là ứng viên hợp lệ.
   */
  placeSlugs?: string[];
  /**
   * Ngưỡng liên quan của từng nhánh. Bỏ trống thì lấy từ config (RAG_MIN_VECTOR_SIMILARITY,
   * RAG_MIN_KEYWORD_RANK). Đặt cả hai về 0 để tắt hẳn việc lọc — hữu ích khi đo lại ngưỡng.
   */
  minVectorSimilarity?: number;
  minKeywordRank?: number;
  /** Số ứng viên mỗi nhánh trước khi hợp nhất. SRS đề xuất ~50. */
  candidatesPerBranch?: number;
  /** Số ứng viên sau hợp nhất, trước khi xếp hạng lại. SRS đề xuất ~20. */
  fuseLimit?: number;
  /** Số đoạn cuối cùng đưa vào ngữ cảnh. SRS đề xuất 3–5. */
  finalLimit?: number;
}

export interface RetrievalMetrics {
  /** Số hàng CÒN LẠI sau khi lọc theo ngưỡng, không phải số hàng đọc lên từ chỉ mục. */
  vectorHits: number;
  keywordHits: number;
  /** Số hàng mỗi nhánh đọc lên trước khi lọc — để thấy ngưỡng đang cắt bao nhiêu. */
  vectorScanned: number;
  keywordScanned: number;
  fusedHits: number;
  reranked: boolean;
  embedMs: number;
  searchMs: number;
  rerankMs: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  metrics: RetrievalMetrics;
}

const DEFAULTS = { candidatesPerBranch: 50, fuseLimit: 20, finalLimit: 4 } as const;

/**
 * Hằng số k của RRF. SRS Mục 11.4.4 chốt ~60.
 *
 * RRF chỉ dùng thứ hạng, không dùng điểm, nên tránh được bài toán chuẩn hoá giữa điểm cosine
 * (có biên [-1, 1]) và điểm ts_rank (không biên) — vốn là nguyên nhân khiến cách cộng điểm có
 * trọng số cố định hoạt động thiếu ổn định.
 */
const RRF_K = 60;

/** Chỉ đoạn đã kiểm duyệt được đưa vào câu trả lời (FR-BOT-05). */
function baseFilter(options: RetrievalOptions): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`"status" = 'APPROVED'`];

  if (options.docTypes?.length) {
    clauses.push(
      Prisma.sql`"docType"::text IN (${Prisma.join(options.docTypes.map((type) => Prisma.sql`${type}`))})`,
    );
  }
  /**
   * Bộ lọc hai tầng, không phải phân mảnh phẳng theo địa danh: đoạn cấp địa bàn LUÔN là ứng viên,
   * cộng thêm đoạn của đúng những nơi khách nhắc tới.
   *
   * Đây là chỗ dễ làm sai nhất của cả thiết kế. Lọc cứng `placeSlug IN (...)` sẽ loại 23/31 đoạn
   * hiện có — toàn bộ tri thức về giấy tờ biên giới, bằng lái, sạt lở mùa mưa, ứng xử bản làng —
   * ngay khi khách lỡ nhắc tên một địa danh trong câu hỏi. Hỏi "đi Mã Pí Lèng cần mang giấy tờ
   * gì" mà mất hết tài liệu giấy tờ thì bộ lọc phản tác dụng đúng vào việc nó sinh ra để làm.
   */
  if (options.placeSlugs?.length) {
    clauses.push(
      Prisma.sql`("scope" = 'PROVINCE' OR "placeSlug" IN (${Prisma.join(
        options.placeSlugs.map((slug) => Prisma.sql`${slug}`),
      )}))`,
    );
  }

  return Prisma.join(clauses, " AND ");
}

async function vectorBranch(
  query: string,
  options: RetrievalOptions,
  limit: number,
  minSimilarity: number,
): Promise<{ rows: RetrievedChunk[]; embedMs: number; scanned: number }> {
  const startedAt = Date.now();
  const [vector] = await getEmbedder().embed([query]);
  const embedMs = Date.now() - startedAt;

  const literal = toVectorLiteral(vector);

  // Vector đã chuẩn hoá L2 nên `<=>` (khoảng cách cosine) nằm trong [0, 2] và độ tương đồng
  // cosine đúng bằng 1 trừ đi khoảng cách. Lọc ngay trong SQL thay vì lọc ở JS để không kéo về
  // những hàng chắc chắn sẽ bị bỏ.
  const rows = await prisma.$queryRaw<(RetrievedChunk & { similarity: number })[]>`
    SELECT "id", "slug", "title", "content", "docType", "sourceRef", "scope", "placeSlug",
           1 - ("embedding" <=> ${literal}::vector) AS "similarity"
    FROM "KnowledgeDoc"
    WHERE ${baseFilter(options)} AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${limit}
  `;

  return {
    rows: rows.filter((row) => Number(row.similarity) >= minSimilarity),
    embedMs,
    scanned: rows.length,
  };
}

async function keywordBranch(
  query: string,
  options: RetrievalOptions,
  limit: number,
  minRank: number,
): Promise<{ rows: RetrievedChunk[]; scanned: number }> {
  // Tách từ phải đối xứng với lúc ingest, nếu không thì chỉ mục và truy vấn nằm ở hai dạng văn
  // bản khác nhau và âm thầm không khớp. segmentForSearch tự trả về nguyên văn khi cờ tắt.
  const searchText = await segmentForSearch(query);

  /**
   * websearch_to_tsquery nối MỌI từ bằng AND, và với câu hỏi tự nhiên thì điều đó có nghĩa là
   * không bao giờ khớp: "Chỗ nào rút được tiền mặt trên cao nguyên đá?" thành mười lexeme nối
   * bằng `&`, và không đoạn nào chứa đủ cả mười. Đo trên kho hiện tại, nhánh này trả về 0 hoặc 1
   * hàng cho hầu hết truy vấn — tức tìm kiếm "lai" trên thực tế chỉ còn nhánh vector.
   *
   * Cách sửa là đổi các toán tử `&` thành `|` ngay trên tsquery ĐÃ phân tích, thay vì tự ghép
   * chuỗi truy vấn trong TypeScript. Làm trên tsquery đã phân tích giữ được ba thứ: cùng một
   * cấu hình `vietnamese` (unaccent + simple) như lúc đánh chỉ mục nên gõ không dấu vẫn khớp;
   * cụm trong ngoặc kép vẫn là toán tử `<->` chứ không bị rã thành OR; và không có đường nào để
   * văn bản người dùng biến thành cú pháp tsquery.
   *
   * Đổi sang OR thì gần như mọi đoạn đều khớp, nên `ts_rank` không còn là thứ để sắp thứ tự nữa
   * mà thành thứ để LỌC — xem `minRank`. Trọng số A cho tiêu đề và B cho nội dung đã đặt lúc
   * ingest chính là chỗ khiến điểm này phân biệt được.
   *
   * NULLIF xử lý truy vấn không sinh ra lexeme nào (chuỗi rỗng, chỉ dấu câu, chỉ stop word):
   * ''::tsquery là lỗi cú pháp, còn NULL::tsquery thì hợp lệ và làm `@@` trả NULL nên hàng bị
   * loại — không có đoạn nào lọt, cũng không có ngoại lệ nào bị ném ra.
   */
  const rows = await prisma.$queryRaw<(RetrievedChunk & { rank: number })[]>`
    WITH q AS (
      SELECT NULLIF(
        replace(websearch_to_tsquery('vietnamese', ${searchText})::text, '&', '|'),
        ''
      )::tsquery AS query
    )
    SELECT "id", "slug", "title", "content", "docType", "sourceRef", "scope", "placeSlug",
           ts_rank("search_tsv", q.query) AS "rank"
    FROM "KnowledgeDoc", q
    WHERE ${baseFilter(options)}
      AND "search_tsv" @@ q.query
    ORDER BY ts_rank("search_tsv", q.query) DESC
    LIMIT ${limit}
  `;

  return { rows: rows.filter((row) => Number(row.rank) >= minRank), scanned: rows.length };
}

/** Hợp nhất theo thứ hạng: điểm của một đoạn là tổng 1/(k + hạng) trên các nhánh tìm thấy nó. */
function fuse(branches: RetrievedChunk[][], limit: number): RetrievedChunk[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, RetrievedChunk>();

  for (const rows of branches) {
    rows.forEach((row, index) => {
      byId.set(row.id, row);
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + index + 1));
    });
  }

  return [...scores.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
}

/**
 * Xếp hạng lại bằng cross-encoder. Mặc định tắt (`RERANK_ENABLED`), vì SRS Mục 11.4.4 yêu cầu đo
 * mức cải thiện trên tập đánh giá của dự án trước khi bật — và bộ câu hỏi vàng chưa có.
 *
 * Lỗi ở bước này KHÔNG làm vỡ truy xuất: rơi về thứ tự RRF. Xếp hạng lại là tối ưu hoá chất
 * lượng, không phải điều kiện để có câu trả lời.
 */
async function rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[] | null> {
  try {
    const response = await fetch(`${config.embeddingServiceUrl}/rerank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => `${chunk.title}\n${chunk.content}`),
      }),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { scores?: number[] };
    if (!Array.isArray(payload.scores) || payload.scores.length !== chunks.length) return null;

    return chunks
      .map((chunk, index) => ({ chunk, score: payload.scores![index] }))
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.chunk);
  } catch (error) {
    console.warn("Bỏ qua bước xếp hạng lại:", error);
    return null;
  }
}

export async function retrieve(
  query: string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const candidatesPerBranch = options.candidatesPerBranch ?? DEFAULTS.candidatesPerBranch;
  const fuseLimit = options.fuseLimit ?? DEFAULTS.fuseLimit;
  const finalLimit = options.finalLimit ?? DEFAULTS.finalLimit;
  const minVectorSimilarity = options.minVectorSimilarity ?? config.ragMinVectorSimilarity;
  const minKeywordRank = options.minKeywordRank ?? config.ragMinKeywordRank;

  const searchStartedAt = Date.now();
  // Hai nhánh độc lập nên chạy song song: tổng độ trễ là nhánh chậm hơn, không phải tổng hai bên.
  const [vector, keyword] = await Promise.all([
    vectorBranch(query, options, candidatesPerBranch, minVectorSimilarity),
    keywordBranch(query, options, candidatesPerBranch, minKeywordRank),
  ]);
  const searchMs = Date.now() - searchStartedAt;

  /**
   * Ngưỡng đã áp trong từng nhánh, nên hợp nhất một danh sách rỗng là kết quả hợp lệ: nó có
   * nghĩa "không nhánh nào tìm được gì đủ liên quan". Đó chính là điều kiện mà
   * server/agents/specialists/knowledge.ts chờ để trả `grounded: false` và không gọi model.
   *
   * Một đoạn chỉ cần vượt ngưỡng ở MỘT nhánh là được giữ, chứ không phải cả hai. Hai nhánh mạnh
   * ở hai kiểu truy vấn khác nhau (xem ghi chú ngưỡng trong server/config.ts), nên bắt buộc
   * vượt cả hai sẽ loại đúng nhóm truy vấn mà nhánh kia sinh ra để cứu.
   */
  const fused = fuse([vector.rows, keyword.rows], fuseLimit);

  let ranked = fused;
  let rerankMs = 0;
  let reranked = false;

  if (config.rerankEnabled && fused.length > 1) {
    const rerankStartedAt = Date.now();
    const result = await rerank(query, fused);
    rerankMs = Date.now() - rerankStartedAt;
    if (result) {
      ranked = result;
      reranked = true;
    }
  }

  return {
    chunks: ranked.slice(0, finalLimit),
    metrics: {
      vectorHits: vector.rows.length,
      keywordHits: keyword.rows.length,
      vectorScanned: vector.scanned,
      keywordScanned: keyword.scanned,
      fusedHits: fused.length,
      reranked,
      embedMs: vector.embedMs,
      searchMs,
      rerankMs,
    },
  };
}
