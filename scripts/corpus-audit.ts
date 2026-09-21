import "dotenv/config";
import { prisma } from "@server/infra/db";
import { getEmbedder } from "@server/domain/rag/embedder";

/**
 * SOÁT SỨC KHOẺ KHO TRI THỨC — chạy trước khi phát hành, và chạy như một cổng trong ingest.
 *
 * Kho tri thức hỏng theo kiểu KHÔNG BÁO LỖI. Một đoạn thiếu vector vẫn nằm trong bảng, vẫn trả
 * về từ nhánh từ khoá, vẫn được trích dẫn — nó chỉ biến mất khỏi nhánh vector. Một đoạn còn
 * `search_tsv` rỗng thì ngược lại. Một đoạn được embed bằng model cũ thì tệ hơn cả hai: nó vẫn
 * có vector, vẫn được so sánh, và khoảng cách cosine giữa hai không gian embedding khác nhau là
 * một con số vô nghĩa nhưng trông hoàn toàn bình thường.
 *
 * Không phép kiểm nào ở đây cần model. Tất cả đều là đếm và so sánh trên Postgres.
 *
 * GIỚI HẠN ĐÃ BIẾT, nói thẳng ở đây thay vì để người đọc tự phát hiện: dự án KHÔNG có cơ chế
 * corpus hai bản với một con trỏ "bản đang phục vụ". Làm được điều đó cần thêm cột phiên bản vào
 * `KnowledgeDoc`, thêm bảng theo dõi phiên bản, và sửa đường truy xuất nóng để lọc theo bản đang
 * hoạt động. Thứ có ở đây là mức bảo đảm yếu hơn nhưng rẻ hơn nhiều: mỗi đoạn được ghi trong một
 * transaction nên hàng và vector không bao giờ lệch nhau, và bước XOÁ của ingest chỉ chạy sau khi
 * bài soát này xanh — nên một lần ingest hỏng không bao giờ vừa làm hỏng vừa dọn mất bản cũ.
 *
 * Chạy: `npm run db:audit`
 */

export interface CorpusIssue {
  code:
    | "MISSING_VECTOR"
    | "MISSING_KEYWORD_INDEX"
    | "WRONG_DIMENSION"
    | "EMBEDDING_MODEL_SKEW"
    | "PIPELINE_SKEW"
    | "EXPIRED_APPROVED"
    | "EMPTY_CORPUS";
  count: number;
  detail: string;
}

export interface CorpusHealth {
  total: number;
  approved: number;
  withVector: number;
  withKeyword: number;
  issues: CorpusIssue[];
  healthy: boolean;
}

interface CountRow {
  value: bigint;
}

async function scalar(query: Promise<CountRow[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

export async function auditCorpus(expected?: { embeddingModel: string; pipelineVersion: string }): Promise<CorpusHealth> {
  const issues: CorpusIssue[] = [];

  const total = await scalar(prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc"`);
  const approved = await scalar(
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc" WHERE "status" = 'APPROVED'`,
  );
  const withVector = await scalar(
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc" WHERE "embedding" IS NOT NULL`,
  );
  const withKeyword = await scalar(
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc" WHERE "search_tsv" IS NOT NULL`,
  );

  if (total === 0) {
    issues.push({ code: "EMPTY_CORPUS", count: 0, detail: "Không có đoạn nào trong kho." });
    return { total, approved, withVector, withKeyword, issues, healthy: false };
  }

  if (withVector < total) {
    issues.push({
      code: "MISSING_VECTOR",
      count: total - withVector,
      detail: "Đoạn thiếu vector chỉ còn tìm được qua nhánh từ khoá — biến mất im lặng khỏi nhánh ngữ nghĩa.",
    });
  }
  if (withKeyword < total) {
    issues.push({
      code: "MISSING_KEYWORD_INDEX",
      count: total - withKeyword,
      detail: "Đoạn thiếu search_tsv không bao giờ khớp truy vấn không dấu, kể cả khi nội dung đúng.",
    });
  }

  /**
   * Số chiều sai là kiểu hỏng nguy hiểm nhất trong nhóm: pgvector vẫn lưu được, vẫn so sánh được
   * với vector cùng chiều, và chỉ ném lỗi khi gặp vector khác chiều — tức là lúc chạy thật, trước
   * mặt khách.
   */
  const wrongDim = await scalar(
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc"
      WHERE "embedding" IS NOT NULL AND vector_dims("embedding") <> 1024
    `,
  );
  if (wrongDim > 0) {
    issues.push({ code: "WRONG_DIMENSION", count: wrongDim, detail: "Vector không phải 1024 chiều." });
  }

  /**
   * Trộn nhiều model embedding trong cùng một kho.
   *
   * Khoảng cách cosine giữa hai không gian embedding khác nhau là một con số vô nghĩa, nhưng nó
   * là một con số hợp lệ — nên không có gì báo lỗi, chỉ có thứ hạng trở nên ngẫu nhiên.
   */
  const models = await prisma.$queryRaw<{ model: string | null; value: bigint }[]>`
    SELECT "embeddingModel" AS model, COUNT(*)::bigint AS value
    FROM "KnowledgeDoc" WHERE "embedding" IS NOT NULL
    GROUP BY "embeddingModel"
  `;
  if (models.length > 1) {
    issues.push({
      code: "EMBEDDING_MODEL_SKEW",
      count: models.length,
      detail: `Kho trộn ${models.length} model embedding: ${models.map((row) => `${row.model ?? "(trống)"}=${row.value}`).join(", ")}.`,
    });
  } else if (expected && models.length === 1 && models[0].model !== expected.embeddingModel) {
    issues.push({
      code: "EMBEDDING_MODEL_SKEW",
      count: Number(models[0].value),
      detail: `Kho embed bằng "${models[0].model}" nhưng cấu hình hiện tại dùng "${expected.embeddingModel}".`,
    });
  }

  const pipelines = await prisma.$queryRaw<{ version: string | null; value: bigint }[]>`
    SELECT "pipelineVersion" AS version, COUNT(*)::bigint AS value
    FROM "KnowledgeDoc" GROUP BY "pipelineVersion"
  `;
  if (pipelines.length > 1) {
    issues.push({
      code: "PIPELINE_SKEW",
      count: pipelines.length,
      detail: `Kho trộn ${pipelines.length} phiên bản pipeline: ${pipelines.map((row) => `${row.version ?? "(trống)"}=${row.value}`).join(", ")}. Cách cắt đoạn khác nhau thì thứ hạng không so được.`,
    });
  }

  /**
   * Tài liệu quá hạn tin cậy mà vẫn ở trạng thái APPROVED.
   *
   * `data/validate.ts` bắt được điều này ở tầng nguồn, TRƯỚC khi ingest. Phép kiểm ở đây bắt
   * trường hợp còn lại và cũng là trường hợp hay xảy ra hơn: tài liệu vào kho khi còn hạn rồi
   * NẰM ĐÓ cho tới lúc quá hạn. Không ai chạy lại ingest thì không ai phát hiện.
   */
  const expired = await scalar(
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS value FROM "KnowledgeDoc"
      WHERE "status" = 'APPROVED' AND "validUntil" IS NOT NULL AND "validUntil" < NOW()
    `,
  );
  if (expired > 0) {
    issues.push({
      code: "EXPIRED_APPROVED",
      count: expired,
      detail: "Đoạn đã quá hạn tin cậy nhưng vẫn được truy xuất và trích dẫn như nội dung hiện hành.",
    });
  }

  return { total, approved, withVector, withKeyword, issues, healthy: issues.length === 0 };
}

export function formatHealth(health: CorpusHealth): string {
  const lines = [
    `Kho tri thức: ${health.total} đoạn, ${health.approved} đã duyệt, ` +
      `${health.withVector} có vector, ${health.withKeyword} có chỉ mục từ khoá.`,
  ];
  if (health.healthy) {
    lines.push("Không phát hiện vấn đề nào.");
  } else {
    for (const issue of health.issues) lines.push(`  [${issue.code}] ${issue.count}: ${issue.detail}`);
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  // Lấy tên model từ chính bộ embedding đang cấu hình, không chép lại một bảng tên thứ hai:
  // hai bảng tên cho cùng một thứ là cách chắc chắn nhất để chúng lệch nhau.
  const health = await auditCorpus({ embeddingModel: getEmbedder().model, pipelineVersion: "" });
  console.log(formatHealth(health));
  return health.healthy ? 0 : 1;
}

// Chỉ chạy khi được gọi trực tiếp; `auditCorpus` được ingest import lại làm cổng trước bước xoá.
if (process.argv[1]?.includes("corpus-audit")) {
  main()
    .then((code) => prisma.$disconnect().then(() => process.exit(code)))
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      await prisma.$disconnect();
      process.exit(1);
    });
}
