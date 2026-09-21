import { config } from "@server/config";
import { prisma } from "@server/infra/db";
import { CHUNKER_VERSION } from "@server/domain/rag/chunker";
import { getEmbedder } from "@server/domain/rag/embedder";
import { segmentBatch } from "@server/domain/rag/segment";
import { ALL_KNOWLEDGE } from "@data/knowledge/index";
import { PLACES } from "@data/places/index";
import { formatIssues, validateData } from "@data/validate";
import {
  embeddingInput, parseArgs, planIngest, prepare, pruneGuard,
  type ExistingChunk,
} from "./ingest-plan";
import { writeChunk } from "./ingest-write";
import { auditCorpus, formatHealth } from "./corpus-audit";

/**
 * Nạp kho tri thức cho chatbot — nhánh A của SRS Hình 11.1 (chạy ngoại tuyến, khi nội dung đổi).
 *
 *   npm run db:ingest
 *   npm run db:ingest -- --domain food,policy   (chỉ nạp lại một phần corpus)
 *   npm run db:ingest -- --dry-run              (in kế hoạch, không ghi gì)
 *   npm run db:ingest -- --reindex              (bỏ qua vân tay, embed lại toàn bộ)
 *
 * MỘT NGUỒN DUY NHẤT: `ALL_KNOWLEDGE` từ @data/knowledge/index, gộp cả tám mặt nội dung. Script
 * này CỐ TÌNH không import từng file tri thức. Lý do là một lỗi đã từng xảy ra ở bản trước: thêm
 * một nhóm nội dung mới mà quên thêm dòng import tương ứng ở đây, và cả nhóm đó không bao giờ được
 * nạp. Không có lỗi nào báo, biểu hiện duy nhất là "chatbot không biết về chuyện đó".
 *
 * BA TÍNH CHẤT PHẢI GIỮ, và mỗi tính chất có một cơ chế riêng:
 *
 *  1. Chạy lại cùng dữ liệu KHÔNG tạo thay đổi. Quyết định nằm ở `planIngest`: so vân tay nội
 *     dung, model embedding và phiên bản pipeline; giống hết thì không chạm vào hàng, nên
 *     `version` và `updatedAt` đứng yên. Bản trước `increment: 1` mọi lượt nên số phiên bản chỉ
 *     nói lên số lần ai đó chạy lệnh.
 *  2. Hỏng giữa chừng KHÔNG để nội dung mới đi cùng vector cũ. Hàng và vector ghi trong CÙNG một
 *     transaction. Bản trước ghi hai câu lệnh rời, nên chết giữa hai câu là để lại đúng trạng
 *     thái đó mà không dấu vết.
 *  3. Chỉ xoá trong phạm vi corpus mình quản lý. Xem `managedRefs` ở scripts/ingest-plan.ts.
 */

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  /**
   * KIỂM ĐỊNH DỮ LIỆU TRƯỚC MỌI THỨ KHÁC.
   *
   * Chạy trước cả việc gọi embedder vì phần lớn lỗi ở đây là lỗi quan hệ giữa các bản ghi — slug
   * trùng, entityId sai chính tả, alias mơ hồ, khoảng giá đảo ngược — và không lỗi nào trong số
   * đó báo ra lúc chạy. Nạp xong mới phát hiện thì kho đã mang dữ liệu hỏng, còn công embedding
   * thì đã tiêu.
   */
  const issues = validateData();
  if (issues.length) {
    throw new Error(`Dữ liệu nguồn có ${issues.length} lỗi, chưa nạp gì:\n${formatIssues(issues)}`);
  }
  console.log(`Kiểm định dữ liệu: ${PLACES.length} thực thể, ${ALL_KNOWLEDGE.length} tài liệu, không có lỗi.`);

  const source = options.domains
    ? ALL_KNOWLEDGE.filter((doc) => options.domains?.includes(doc.domain))
    : ALL_KNOWLEDGE;
  if (options.domains && !source.length) {
    throw new Error(`--domain không khớp tài liệu nào. Có: ${[...new Set(ALL_KNOWLEDGE.map((doc) => doc.domain))].join(", ")}`);
  }

  const embedder = getEmbedder();
  /**
   * Nhận dạng pipeline. `viSegmentEnabled` nằm trong này vì nó quyết định văn bản đem đánh chỉ mục
   * từ khoá — bật hay tắt cờ đó mà không đánh chỉ mục lại thì nửa kho ở dạng tách từ, nửa kia
   * không, và nhánh từ khoá trả kết quả lệch mà không có gì báo.
   */
  const pipelineVersion = `chunk:${CHUNKER_VERSION}/seg:${config.viSegmentEnabled ? "on" : "off"}`;
  console.log(`Nguồn embedding: ${embedder.kind} (${embedder.model}); pipeline ${pipelineVersion}`);

  const prepared = source.flatMap(prepare);
  const managedRefs = new Set(prepared.map((chunk) => chunk.sourceRef));
  console.log(`Chuẩn bị ${prepared.length} đoạn từ ${source.length} tài liệu${options.domains ? ` (lọc theo domain: ${options.domains.join(", ")})` : ""}.`);

  /**
   * Chỉ đọc lên những hàng LIÊN QUAN, và "liên quan" khác nhau giữa hai kiểu chạy.
   *
   * Chạy đầy đủ cần cả bảng để biết tài liệu nào đã bị gỡ khỏi nguồn. Chạy lọc theo domain thì chỉ
   * cần phần corpus mình quản lý — đọc cả bảng rồi so sẽ dẫn tới việc coi mọi thứ ngoài bộ lọc là
   * mồ côi, đúng cái bẫy mà `managedRefs` sinh ra để tránh.
   */
  const existingRows = await prisma.knowledgeDoc.findMany({
    where: options.domains ? { sourceRef: { in: [...managedRefs] } } : undefined,
    select: {
      slug: true, sourceRef: true, contentHash: true, embeddingModel: true, pipelineVersion: true,
      docType: true, domain: true, entityType: true, entityId: true, tags: true, season: true,
      title: true, content: true, scope: true, placeSlug: true, chunkIndex: true, tokenCount: true,
      sourceUrl: true, sourceClass: true, verifiedAt: true, validUntil: true,
    },
  });

  // `embedding` và `search_tsv` là Unsupported nên Prisma Client không select được; hỏi riêng
  // bằng raw SQL để biết hàng nào thiếu chỉ mục và phải vá.
  const indexed = await prisma.$queryRaw<{ slug: string }[]>`
    SELECT "slug" FROM "KnowledgeDoc" WHERE "embedding" IS NOT NULL AND "search_tsv" IS NOT NULL
  `;
  const hasVectors = new Set(indexed.map((row) => row.slug));

  const existing: ExistingChunk[] = existingRows.map((row) => ({
    ...row,
    scope: String(row.scope),
    hasVectors: hasVectors.has(row.slug),
  }));

  const plan = planIngest(prepared, options.reindex ? [] : existing, { embeddingModel: embedder.model, pipelineVersion, managedRefs });

  // Chạy đầy đủ còn phải dọn tài liệu đã bị gỡ khỏi nguồn; chạy lọc thì tuyệt đối không đụng tới
  // phần ngoài bộ lọc.
  const allRefs = new Set(ALL_KNOWLEDGE.map((doc) => `${doc.domain}:${doc.slug}`));
  const retired = options.domains ? [] : existing.filter((row) => !allRefs.has(row.sourceRef)).map((row) => row.slug);
  const toDelete = [...new Set([...plan.toDelete, ...retired])];

  console.log(
    `Kế hoạch: ${plan.counts.create} tạo mới, ${plan.counts.reindex} đánh chỉ mục lại, ` +
      `${plan.counts.update} sửa metadata, ${plan.counts.unchanged} giữ nguyên, ${toDelete.length} xoá.`,
  );
  for (const item of plan.planned.filter((row) => row.reason)) {
    console.log(`  đánh chỉ mục lại ${item.chunk.slug}: ${item.reason}`);
  }

  const blocked = pruneGuard(toDelete.length, existing.length, options.allowPrune);
  if (blocked) throw new Error(blocked);

  if (options.dryRun) {
    console.log("--dry-run: không ghi gì vào database.");
    return;
  }

  if (plan.toEmbed.length) {
    // Sinh embedding theo lô để không giữ toàn bộ vector trong bộ nhớ và để sidecar không nhận một
    // request quá lớn.
    const BATCH = 16;
    const vectors: number[][] = [];
    for (let index = 0; index < plan.toEmbed.length; index += BATCH) {
      const batch = plan.toEmbed.slice(index, index + BATCH);
      vectors.push(...(await embedder.embed(batch.map((item) => embeddingInput(item.chunk)))));
      console.log(`  đã embed ${Math.min(index + BATCH, plan.toEmbed.length)}/${plan.toEmbed.length}`);
    }

    // Tách từ phải ĐỐI XỨNG với lúc truy vấn. segmentBatch tự trả nguyên văn khi cờ tắt, nên hai
    // phía luôn cùng dạng miễn là cùng đọc config.viSegmentEnabled.
    const titles = await segmentBatch(plan.toEmbed.map((item) => item.chunk.title));
    const bodies = await segmentBatch(plan.toEmbed.map((item) => item.chunk.content));
    if (config.viSegmentEnabled) console.log("Đã bật tách từ tiếng Việt cho nhánh từ khoá.");

    for (let index = 0; index < plan.toEmbed.length; index += 1) {
      await writeChunk(plan.toEmbed[index], embedder.model, pipelineVersion, {
        vector: vectors[index], title: titles[index], body: bodies[index],
      });
    }
  }

  for (const item of plan.planned.filter((row) => row.action === "update")) {
    await writeChunk(item, embedder.model, pipelineVersion, null);
  }

  /**
   * SOÁT SỨC KHOẺ TRƯỚC BƯỚC XOÁ, không phải sau.
   *
   * Thứ tự này là cả nội dung của phép sửa. Bản trước xoá rồi mới đếm, nên một lần ingest hỏng
   * giữa chừng làm được hai việc tệ cùng lúc: để lại kho thiếu vector, VÀ dọn mất những đoạn cũ
   * lẽ ra còn phục vụ được. Soát trước thì lần chạy hỏng chỉ dừng lại — kho giữ nguyên bản cũ,
   * và chạy lại là đủ.
   *
   * Đây cũng là mức bảo đảm thay cho corpus hai bản: không có con trỏ "bản đang phục vụ", nhưng
   * bước phá huỷ duy nhất đã được đặt sau một cổng.
   */
  const health = await auditCorpus({ embeddingModel: embedder.model, pipelineVersion });
  console.log(formatHealth(health));

  if (!health.healthy) {
    const blocking = health.issues.filter(
      (issue) => issue.code === "MISSING_VECTOR" || issue.code === "MISSING_KEYWORD_INDEX" || issue.code === "WRONG_DIMENSION",
    );
    if (blocking.length) {
      throw new Error(
        `Kho chưa dùng được (${blocking.map((issue) => issue.code).join(", ")}) — DỪNG TRƯỚC bước xoá, ` +
          `nên bản cũ vẫn còn nguyên. Chạy lại ingest để vá rồi mới xoá.`,
      );
    }
    console.warn("Còn cảnh báo không chặn ở trên; vẫn tiếp tục bước xoá.");
  }

  if (toDelete.length) {
    const removed = await prisma.knowledgeDoc.deleteMany({ where: { slug: { in: toDelete } } });
    console.log(`Đã xoá ${removed.count} đoạn không còn trong nguồn.`);
  }

  console.log("");
  console.log(
    "CẢNH BÁO: hai ngưỡng RAG_MIN_VECTOR_SIMILARITY và RAG_MIN_KEYWORD_RANK được đo trên kho 31\n" +
      "đoạn KHI CHƯA có lọc metadata. Kho hiện tại lớn hơn nhiều và đã có lọc theo domain, nên hai\n" +
      "con số đó PHẢI được đo lại — biên an toàn phía dưới của ngưỡng từ khoá chỉ khoảng 0,04.",
  );
}

main()
  .catch((error) => {
    console.error("Ingest thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
