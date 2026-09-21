import { Prisma } from "@prisma/client";
import type { KnowledgeDocType, KnowledgeDomain, KnowledgeEntityType } from "@prisma/client";
import { config } from "@server/config";
import { prisma } from "@server/infra/db";
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
  /**
   * Tín hiệu metadata suy từ câu hỏi (xem server/domain/rag/signals.ts).
   *
   * Chúng KHÔNG lọc bớt ứng viên. Khi có ít nhất một tín hiệu, truy xuất chạy thêm một nhánh
   * vector giới hạn trong phần kho khớp metadata, và nhánh đó tham gia hợp nhất RRF như hai nhánh
   * kia. Tài liệu khớp metadata vì thế xuất hiện ở hai nhánh nên xếp cao hơn, còn tài liệu không
   * khớp vẫn nằm nguyên trong nhánh vector gốc — không nguồn nào bị mất.
   */
  domains?: KnowledgeDomain[];
  entityTypes?: KnowledgeEntityType[];
  seasons?: string[];
  /** Bật tắt từng nhánh. Dùng cho thử nghiệm có đối chứng ở scripts/retrieval-ablation.ts. */
  branches?: { vector?: boolean; keyword?: boolean; metadata?: boolean };
  /**
   * Cách tín hiệu metadata tham gia xếp hạng. Mặc định `branch`. Xem `MetadataMode`.
   *
   * Có mặt ở đây để `scripts/retrieval-ablation.ts` so được bốn cách trên cùng một tập câu hỏi —
   * thiên vị do cộng hai lần là thứ chỉ thấy khi đặt chúng cạnh nhau.
   */
  metadataMode?: MetadataMode;
  /** Bỏ qua cấu hình và ép bật/tắt xếp hạng lại. Cũng chỉ dùng cho thử nghiệm có đối chứng. */
  rerank?: boolean;
}

export interface RetrievalMetrics {
  /** Số hàng CÒN LẠI sau khi lọc theo ngưỡng, không phải số hàng đọc lên từ chỉ mục. */
  vectorHits: number;
  keywordHits: number;
  /** Số hàng mỗi nhánh đọc lên trước khi lọc — để thấy ngưỡng đang cắt bao nhiêu. */
  vectorScanned: number;
  keywordScanned: number;
  /** Nhánh metadata: 0 khi câu hỏi không có tín hiệu nào đủ rõ, và đó là trường hợp phổ biến. */
  metadataHits: number;
  metadataScanned: number;
  fusedHits: number;
  reranked: boolean;
  /**
   * Nhánh nào đã hỏng và bị bỏ qua.
   *
   * Trước đây hai nhánh chạy bằng `Promise.all`, nên sidecar embedding sập là cả truy xuất ném
   * lỗi dù nhánh từ khoá vẫn trả lời được. Giờ nhánh hỏng bị bỏ qua và trường này ghi lại — một
   * lượt chạy suy giảm phải PHÂN BIỆT ĐƯỢC với một lượt chạy đủ, nếu không thì chất lượng tụt mà
   * không ai biết vì sao.
   */
  degraded: "none" | "vector_failed" | "keyword_failed";
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

/**
 * Điều kiện của nhánh METADATA — nối bằng OR, không phải AND.
 *
 * Ba chiều nói về ba mặt khác nhau của tài liệu, nên bắt khớp cả ba sẽ ra tập gần rỗng: câu "ăn
 * gì ở Đồng Văn vào tháng 10" cho tín hiệu domain `food` và mùa `hoa_tam_giac_mach`, trong khi
 * một bài về thắng cố khai mùa `quanh_nam`. AND loại mất chính tài liệu đúng nhất.
 *
 * OR an toàn ở đây vì nhánh này KHÔNG lọc bớt gì cả — nó là một nhánh xếp hạng thêm, và trong
 * chính nhánh đó thứ tự vẫn do khoảng cách vector quyết định. Nói cách khác OR chỉ mở rộng phần
 * kho được cộng điểm, không mở rộng phần kho được trả về.
 */
export function metadataFilter(options: RetrievalOptions): Prisma.Sql | null {
  const clauses: Prisma.Sql[] = [];

  if (options.domains?.length) {
    clauses.push(Prisma.sql`"domain"::text IN (${Prisma.join(options.domains.map((value) => Prisma.sql`${value}`))})`);
  }
  if (options.entityTypes?.length) {
    clauses.push(Prisma.sql`"entityType"::text IN (${Prisma.join(options.entityTypes.map((value) => Prisma.sql`${value}`))})`);
  }
  if (options.seasons?.length) {
    // `season` là String[] nên dùng toán tử giao mảng của Postgres: khớp khi tài liệu mang ÍT NHẤT
    // một mùa trong danh sách tín hiệu.
    clauses.push(Prisma.sql`"season" && ARRAY[${Prisma.join(options.seasons.map((value) => Prisma.sql`${value}`))}]::text[]`);
  }

  return clauses.length ? Prisma.join(clauses, " OR ") : null;
}

interface VectorRows {
  rows: RetrievedChunk[];
  scanned: number;
}

/** Một lượt tìm theo vector với bộ lọc cho sẵn. Không tự nhúng — vector truyền vào từ ngoài. */
async function vectorSearch(
  literal: string,
  filter: Prisma.Sql,
  limit: number,
  minSimilarity: number,
): Promise<VectorRows> {
  // Vector đã chuẩn hoá L2 nên `<=>` (khoảng cách cosine) nằm trong [0, 2] và độ tương đồng
  // cosine đúng bằng 1 trừ đi khoảng cách. Lọc ngay trong SQL thay vì lọc ở JS để không kéo về
  // những hàng chắc chắn sẽ bị bỏ.
  const rows = await prisma.$queryRaw<(RetrievedChunk & { similarity: number })[]>`
    SELECT "id", "slug", "title", "content", "docType", "sourceRef", "scope", "placeSlug",
           1 - ("embedding" <=> ${literal}::vector) AS "similarity"
    FROM "KnowledgeDoc"
    WHERE ${filter} AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${limit}
  `;

  return { rows: rows.filter((row) => Number(row.similarity) >= minSimilarity), scanned: rows.length };
}

/**
 * Nhúng câu hỏi MỘT LẦN rồi dùng cho cả nhánh vector gốc lẫn nhánh metadata.
 *
 * Phần đắt của một lượt truy xuất là lần nhúng, không phải câu SQL. Dùng lại cùng một vector nên
 * nhánh metadata chỉ tốn thêm một vòng tới database và không tốn lượt gọi model nào — đó là lý do
 * thêm nhánh này chấp nhận được về độ trễ.
 */
async function vectorBranches(
  query: string,
  options: RetrievalOptions,
  limit: number,
  minSimilarity: number,
  withMetadata: boolean,
): Promise<{ base: VectorRows; metadata: VectorRows | null; embedMs: number }> {
  const startedAt = Date.now();
  const [vector] = await getEmbedder().embed([query]);
  const embedMs = Date.now() - startedAt;
  const literal = toVectorLiteral(vector);

  const filter = baseFilter(options);
  const meta = withMetadata ? metadataFilter(options) : null;

  const [base, metadata] = await Promise.all([
    vectorSearch(literal, filter, limit, minSimilarity),
    meta ? vectorSearch(literal, Prisma.sql`${filter} AND (${meta})`, limit, minSimilarity) : Promise.resolve(null),
  ]);

  return { base, metadata, embedMs };
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

/**
 * BỐN CÁCH DÙNG TÍN HIỆU METADATA, để so được với nhau thay vì chọn bằng cảm tính.
 *
 * Nhánh metadata là một lượt tìm vector có thêm điều kiện OR, nên một đoạn khớp metadata gần như
 * luôn xuất hiện ở CẢ nhánh vector lẫn nhánh metadata. RRF cộng theo từng nhánh, nghĩa là đóng
 * góp theo thứ hạng vector của đoạn ấy bị tính hai lần. Đó là một khoản thiên vị theo cấu trúc,
 * không phải một tín hiệu — nó lớn dần theo việc đoạn đó đứng cao ở nhánh vector, chứ không theo
 * việc metadata khớp tới đâu.
 *
 *  - `branch`   — nhánh riêng, nhưng có TRỌNG SỐ. Giữ được thông tin thứ hạng trong nhánh
 *                 metadata, chỉ hạ mức đóng góp xuống.
 *  - `bonus`    — một khoản CỐ ĐỊNH cho mọi đoạn khớp metadata, không phụ thuộc thứ hạng. Đây là
 *                 cách diễn đạt thẳng nhất ý "khớp metadata thì đáng tin hơn một chút".
 *  - `tiebreak` — chỉ phá hoà. Cách bảo thủ nhất: metadata không bao giờ đảo được thứ tự do vector
 *                 và từ khoá quyết định, chỉ xếp trước khi hai đoạn ngang điểm.
 *  - `off`      — bỏ hẳn, làm đường cơ sở.
 */
export type MetadataMode = "branch" | "bonus" | "tiebreak" | "off";

/**
 * Chế độ mặc định là `bonus`, KHÔNG phải `branch`.
 *
 * Đây là kết luận rút ra khi đặt bốn chế độ cạnh nhau: RRF thưởng cho sự ĐỒNG THUẬN GIỮA CÁC
 * NGUỒN ĐỘC LẬP, và nhánh metadata không phải một nguồn độc lập — nó là lượt tìm vector cũ kèm
 * một điều kiện OR. Đưa nó vào như một nhánh nghĩa là đếm cùng một bằng chứng hai lần, và mức
 * cộng đó áp đảo mọi khác biệt thứ hạng thật.
 *
 * `bonus` nói đúng thứ ta muốn nói: khớp metadata làm một đoạn đáng tin hơn MỘT CHÚT, không phải
 * đáng tin gấp đôi. Đổi mặc định là một thay đổi hành vi, nên nó phải được xác nhận bằng
 * `scripts/retrieval-ablation.ts` trên tập holdout chứ không chỉ bằng lập luận ở đây.
 */
const DEFAULT_METADATA_MODE: MetadataMode = "bonus";

/**
 * Trọng số nhánh metadata khi dùng chế độ `branch`.
 *
 * Hạ xuống 0,5 KHÔNG đủ để chữa thiên vị, và con số này ở đây chủ yếu để chế độ `branch` còn so
 * được trong bảng đối chứng. Lý do nằm ở chính hình dạng của RRF với k = 60: chênh lệch điểm
 * giữa hạng 1 và hạng 2 trong cùng một nhánh là 1/61 − 1/62 ≈ 0,00026, trong khi có mặt thêm ở
 * một nhánh nữa cộng thẳng 1/61 ≈ 0,0164 — gấp sáu mươi lần. Nghĩa là "xuất hiện ở hai nhánh"
 * áp đảo mọi khác biệt về thứ hạng, bất kể trọng số 1 hay 0,5 hay 0,2.
 *
 * Với cặp vector + từ khoá thì đó đúng là điều mong muốn: hai nhánh tìm theo hai cách độc lập
 * nhau, nên cùng chọn một đoạn là một BẰNG CHỨNG ĐỘC LẬP. Với metadata thì không: nhánh đó là
 * chính lượt tìm vector kia cộng thêm một điều kiện OR, nên nó không mang bằng chứng mới nào —
 * nó chỉ nói lại cùng một thứ hạng lần thứ hai.
 */
const METADATA_WEIGHT = 0.5;

/**
 * Khoản cộng cố định của chế độ `bonus`, đặt bằng khoảng cách HAI BẬC trong một nhánh.
 *
 * Diễn đạt bằng bậc chứ không bằng một số tuyệt đối, vì một số tuyệt đối ở thang này rất dễ chọn
 * sai: bản đầu đặt bằng nửa mức đóng góp của hạng nhất và nó kéo một đoạn từ hạng ba lên thẳng
 * hạng nhất, tức mạnh gấp hơn hai mươi lần ý định. "Khớp metadata thì đáng lên khoảng hai bậc"
 * là một câu đọc được, kiểm được, và chỉnh được.
 */
const METADATA_BONUS = 1 / (RRF_K + 1) - 1 / (RRF_K + 3);

export interface FusionBranch {
  rows: RetrievedChunk[];
  /** Mặc định 1. Nhánh metadata dùng `METADATA_WEIGHT`. */
  weight?: number;
}

export interface FusionOptions {
  limit: number;
  /** Đoạn được cộng một khoản cố định, không phụ thuộc thứ hạng. Dùng cho chế độ `bonus`. */
  bonusIds?: Set<string>;
  /** Đoạn được xếp trước khi điểm bằng nhau. Dùng cho chế độ `tiebreak`. */
  tiebreakIds?: Set<string>;
}

/** Hợp nhất theo thứ hạng: điểm của một đoạn là tổng trọng-số/(k + hạng) trên các nhánh tìm thấy nó. */
export function fuse(branches: FusionBranch[], options: FusionOptions): RetrievedChunk[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, RetrievedChunk>();

  for (const branch of branches) {
    const weight = branch.weight ?? 1;
    branch.rows.forEach((row, index) => {
      byId.set(row.id, row);
      scores.set(row.id, (scores.get(row.id) ?? 0) + weight / (RRF_K + index + 1));
    });
  }

  for (const id of options.bonusIds ?? []) {
    // Chỉ cộng cho đoạn ĐÃ có mặt: khoản thưởng không được kéo vào một đoạn mà không nhánh xếp
    // hạng nào tìm thấy, nếu không nó thành một nhánh truy xuất trá hình.
    if (scores.has(id)) scores.set(id, (scores.get(id) as number) + METADATA_BONUS);
  }

  const tiebreak = options.tiebreakIds;
  return [...scores.entries()]
    .sort(([leftId, left], [rightId, right]) => {
      if (right !== left) return right - left;
      if (!tiebreak) return 0;
      return Number(tiebreak.has(rightId)) - Number(tiebreak.has(leftId));
    })
    .slice(0, options.limit)
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
      /**
       * Trần thời gian, bắt buộc phải có.
       *
       * `fetch` mặc định KHÔNG bao giờ tự bỏ cuộc, nên một sidecar treo sẽ giữ cả lượt hội thoại
       * vô hạn. Bước này chỉ sắp lại thứ tự của những đoạn đã có trong tay — nó không đáng để
       * chờ, và hết giờ thì rơi về thứ tự RRF đúng như mọi lỗi khác ở đây.
       */
      signal: AbortSignal.timeout(config.rerankTimeoutMs),
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

/**
 * Quy ra trạng thái suy giảm từ việc nhánh nào hỏng.
 *
 * Cả hai nhánh cùng hỏng là SỰ CỐ, không phải "không tìm thấy gì". Phải ném ra để orchestrator ghi
 * nhận đúng là lỗi tác tử; nuốt nó thành một danh sách rỗng sẽ khiến tác tử tri thức báo với khách
 * là câu hỏi ngoài phạm vi, tức một sự cố hạ tầng bị ghi thành một câu hỏi khó.
 */
export function resolveDegraded(vectorFailed: boolean, keywordFailed: boolean): RetrievalMetrics["degraded"] {
  if (vectorFailed && keywordFailed) throw new Error("Truy xuất tri thức không khả dụng");
  if (vectorFailed) return "vector_failed";
  if (keywordFailed) return "keyword_failed";
  return "none";
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

  const useVector = options.branches?.vector !== false;
  const useKeyword = options.branches?.keyword !== false;
  const useMetadata = options.branches?.metadata !== false;

  const searchStartedAt = Date.now();
  /**
   * `allSettled`, KHÔNG phải `all`.
   *
   * Hai nhánh hỏng vì hai nguyên nhân hoàn toàn khác nhau và độc lập nhau: nhánh vector cần sidecar
   * embedding còn sống, nhánh từ khoá chỉ cần Postgres. `Promise.all` buộc chúng chung số phận, nên
   * sidecar sập là cả truy xuất ném lỗi — rồi tác tử tri thức rơi vào nhánh catch của orchestrator
   * và khách nhận "mình chưa xử lý được", trong khi nhánh từ khoá vẫn thừa sức trả lời phần lớn
   * câu hỏi có danh từ riêng.
   *
   * Chạy suy giảm thì phải GHI LẠI. Một lượt chỉ còn một nhánh vẫn ra câu trả lời, chỉ là kém hơn;
   * không ghi thì chất lượng tụt mà không có gì nối được về nguyên nhân.
   */
  const [vectorSettled, keywordSettled] = await Promise.allSettled([
    useVector
      ? vectorBranches(query, options, candidatesPerBranch, minVectorSimilarity, useMetadata)
      : Promise.resolve(null),
    useKeyword
      ? keywordBranch(query, options, candidatesPerBranch, minKeywordRank)
      : Promise.resolve(null),
  ]);
  const searchMs = Date.now() - searchStartedAt;

  const vector = vectorSettled.status === "fulfilled" ? vectorSettled.value : null;
  const keyword = keywordSettled.status === "fulfilled" ? keywordSettled.value : null;

  if (vectorSettled.status === "rejected" && keywordSettled.status === "rejected") {
    console.error("Truy xuất hỏng cả hai nhánh:", vectorSettled.reason, keywordSettled.reason);
  } else if (vectorSettled.status === "rejected") {
    console.warn("Nhánh vector hỏng, chạy suy giảm bằng nhánh từ khoá:", vectorSettled.reason);
  } else if (keywordSettled.status === "rejected") {
    console.warn("Nhánh từ khoá hỏng, chạy suy giảm bằng nhánh vector:", keywordSettled.reason);
  }
  const degraded = resolveDegraded(vectorSettled.status === "rejected", keywordSettled.status === "rejected");

  /**
   * Ngưỡng đã áp trong từng nhánh, nên hợp nhất một danh sách rỗng là kết quả hợp lệ: nó có nghĩa
   * "không nhánh nào tìm được gì đủ liên quan". Đó chính là điều kiện mà
   * server/domain/agents/specialists/knowledge.ts chờ để trả `grounding: "no_source"` và không gọi
   * model.
   *
   * Một đoạn chỉ cần vượt ngưỡng ở MỘT nhánh là được giữ, chứ không phải cả hai. Hai nhánh mạnh ở
   * hai kiểu truy vấn khác nhau (xem ghi chú ngưỡng trong server/config.ts), nên bắt buộc vượt cả
   * hai sẽ loại đúng nhóm truy vấn mà nhánh kia sinh ra để cứu.
   *
   * Nhánh metadata đứng RIÊNG trong danh sách hợp nhất chứ không gộp vào nhánh vector: RRF cộng
   * điểm theo từng nhánh, nên một đoạn khớp metadata xuất hiện ở hai nhánh và được cộng hai lần.
   * Đó chính là cách dùng metadata khi tín hiệu đủ rõ mà không loại bỏ đoạn nào.
   */
  const metadataRows = vector?.metadata?.rows ?? [];
  const metadataIds = new Set<string>(metadataRows.map((row) => row.id));
  const metadataMode: MetadataMode = useMetadata ? options.metadataMode ?? DEFAULT_METADATA_MODE : "off";

  const fused = fuse(
    [
      { rows: vector?.base.rows ?? [] },
      { rows: keyword?.rows ?? [] },
      // Chỉ chế độ `branch` mới đưa metadata vào như một danh sách xếp hạng. Ba chế độ kia dùng
      // cùng tập id đó theo cách khác, nên chúng không được cộng thêm ở đây nữa.
      { rows: metadataMode === "branch" ? metadataRows : [], weight: METADATA_WEIGHT },
    ],
    {
      limit: fuseLimit,
      bonusIds: metadataMode === "bonus" ? metadataIds : undefined,
      tiebreakIds: metadataMode === "tiebreak" ? metadataIds : undefined,
    },
  );

  let ranked = fused;
  let rerankMs = 0;
  let reranked = false;

  if ((options.rerank ?? config.rerankEnabled) && fused.length > 1) {
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
      vectorHits: vector?.base.rows.length ?? 0,
      keywordHits: keyword?.rows.length ?? 0,
      vectorScanned: vector?.base.scanned ?? 0,
      keywordScanned: keyword?.scanned ?? 0,
      metadataHits: vector?.metadata?.rows.length ?? 0,
      metadataScanned: vector?.metadata?.scanned ?? 0,
      fusedHits: fused.length,
      reranked,
      degraded,
      embedMs: vector?.embedMs ?? 0,
      searchMs,
      rerankMs,
    },
  };
}
