import "dotenv/config";
import { prisma } from "@server/infra/db";
import { retrieve, type RetrievalOptions } from "@server/domain/rag/retrieval";
import { expandPlaceTree, findPlacesInText, placeKinds } from "@server/domain/rag/places";
import { domainSignals, entityTypeSignals } from "@server/domain/rag/signals";
import { loadGolden, type GoldenCase } from "@eval/golden/schema";
import { scoreRetrieval } from "@eval/metrics/retrieval";
import { percentile } from "@eval/metrics/operational";
import type { EvalRecord } from "@eval/dataset";

/**
 * THỬ NGHIỆM CÓ ĐỐI CHỨNG CHO TẦNG TRUY XUẤT.
 *
 *   npx tsx scripts/retrieval-ablation.ts [--k 5] [--limit 40] [--split dev|holdout]
 *
 * Bốn cấu hình xếp theo thứ tự cộng dồn — vector-only, lai, lai + metadata, thêm xếp hạng lại —
 * chạy trên cùng một tập câu hỏi và cùng một kho, rồi in ra Recall@k, Precision@k, MRR, nDCG@k,
 * tỷ lệ truy xuất rỗng và p50/p95 độ trễ.
 *
 * VÌ SAO PHẢI CỘNG DỒN chứ không so từng cặp: mỗi bước thêm một chi phí độ trễ có thật, và câu
 * hỏi cần trả lời không phải "bước này có giúp không" mà "bước này có đáng cái giá của nó không".
 * Thấy Recall@5 nhích 0,02 trong khi p95 tăng gấp ba thì câu trả lời là không.
 *
 * Dùng lại nguyên các hàm chỉ số của bộ đánh giá (eval/metrics/) chứ không tự tính lại: hai chỗ
 * tính Recall theo hai cách sẽ cho hai con số khác nhau, và khi đó không ai biết nên tin cái nào.
 *
 * KHÔNG GỌI MODEL SINH. Địa danh phân giải bằng `findPlacesInText` — nhánh quét chuỗi tất định mà
 * orchestrator vẫn dùng song song với NLU — nên kết quả lặp lại được và chạy được khi không có
 * API key. Đổi lại, nó bỏ qua phần địa danh chỉ NLU mới nhận ra, nên các con số ở đây là cận dưới
 * của chất lượng thật.
 */

interface Variant {
  name: string;
  options: Pick<RetrievalOptions, "branches" | "rerank" | "metadataMode">;
}

const VARIANTS: Variant[] = [
  { name: "vector-only", options: { branches: { vector: true, keyword: false, metadata: false }, rerank: false } },
  /**
   * Chỉ từ khoá. Đây là ĐƯỜNG CƠ SỞ đáng giá nhất trong bảng và cũng là đường hay bị bỏ qua nhất:
   * nếu nó bám sát cấu hình hybrid thì cả tầng vector — sidecar, 1024 chiều, chi phí embedding —
   * chưa chứng minh được mình, và đó là một kết luận phải biết trước khi tối ưu tiếp.
   *
   * Cũng chính là cấu hình chạy thật khi sidecar sập, nên con số ở hàng này nói luôn chất lượng
   * của chế độ suy giảm.
   */
  { name: "keyword-only", options: { branches: { vector: false, keyword: true, metadata: false }, rerank: false } },
  { name: "hybrid", options: { branches: { vector: true, keyword: true, metadata: false }, rerank: false } },
  /**
   * Bốn cách đưa tín hiệu metadata vào xếp hạng, đặt cạnh nhau vì chúng khác nhau rất xa chứ
   * không phải khác nhau chút ít.
   *
   * `meta:branch` là cách bản đầu làm và cũng là cách thiên vị nhất: nhánh metadata chính là lượt
   * tìm vector kia cộng một điều kiện OR, nên nó không mang bằng chứng độc lập nào, trong khi RRF
   * thưởng cho việc có mặt ở nhiều nhánh mạnh gấp khoảng sáu mươi lần mọi khác biệt thứ hạng.
   */
  { name: "hybrid+meta:branch", options: { branches: { vector: true, keyword: true, metadata: true }, rerank: false, metadataMode: "branch" } },
  { name: "hybrid+meta:bonus", options: { branches: { vector: true, keyword: true, metadata: true }, rerank: false, metadataMode: "bonus" } },
  { name: "hybrid+meta:tiebreak", options: { branches: { vector: true, keyword: true, metadata: true }, rerank: false, metadataMode: "tiebreak" } },
  { name: "hybrid+meta:bonus+rerank", options: { branches: { vector: true, keyword: true, metadata: true }, rerank: true, metadataMode: "bonus" } },
];

interface Options {
  k: number;
  limit: number;
  split: "dev" | "holdout" | null;
  /**
   * Ngưỡng liên quan của hai nhánh. Mở ra được vì chính ngưỡng quyết định nhánh metadata có đất
   * dụng võ hay không: ngưỡng chặt cắt ứng viên xuống còn vài hàng thì tập con metadata trùng
   * khít tập gốc, và một nhánh xếp hạng thêm trên cùng một tập không đổi được thứ tự nào.
   */
  minVector: number | null;
  minKeyword: number | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { k: 5, limit: 0, split: null, minVector: null, minKeyword: null };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[++index];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`Thiếu giá trị cho ${name}`);
    if (name === "--k") options.k = Number(value);
    else if (name === "--limit") options.limit = Number(value);
    else if (name === "--min-vector") options.minVector = Number(value);
    else if (name === "--min-keyword") options.minKeyword = Number(value);
    else if (name === "--split") {
      if (value !== "dev" && value !== "holdout") throw new Error("--split phải là dev hoặc holdout");
      options.split = value;
    } else throw new Error(`Tham số không được hỗ trợ: ${name}`);
  }
  if (!Number.isSafeInteger(options.k) || options.k < 1) throw new Error("--k phải là số nguyên dương");
  return options;
}

/** Tín hiệu suy một lần cho mỗi câu hỏi, dùng chung cho cả bốn cấu hình để so sánh công bằng. */
interface Prepared {
  row: GoldenCase;
  options: RetrievalOptions;
}

async function prepareQuestions(cases: GoldenCase[], k: number, thresholds: Pick<Options, "minVector" | "minKeyword">): Promise<Prepared[]> {
  const prepared: Prepared[] = [];
  for (const row of cases) {
    const named = await findPlacesInText(row.question);
    prepared.push({
      row,
      options: {
        finalLimit: k,
        ...(thresholds.minVector === null ? {} : { minVectorSimilarity: thresholds.minVector }),
        ...(thresholds.minKeyword === null ? {} : { minKeywordRank: thresholds.minKeyword }),
        placeSlugs: await expandPlaceTree(named),
        domains: domainSignals(row.question),
        entityTypes: entityTypeSignals(await placeKinds(named)),
        // Không có bộ quy đổi thời gian ở đây (nó chạy trong orchestrator), nên chiều mùa để
        // trống. Nói rõ điều này vì nó có nghĩa: cột metadata ở bảng dưới CHƯA tính phần mùa.
        seasons: [],
      },
    });
  }
  return prepared;
}

/** Dựng `EvalRecord` tối thiểu để dùng lại `scoreRetrieval` của bộ đánh giá. */
function toRecord(row: GoldenCase, retrieved: string[]): EvalRecord {
  return {
    id: row.id, kind: row.kind, group: row.group, split: row.split, variant: row.variant,
    out_of_scope: row.out_of_scope, question: row.question, reference: row.reference,
    expected_docs: row.expected_docs, expected_intent: row.expected_intent,
    expected_escalation_reason: row.expected_escalation_reason,
    answer: "", contexts: [],
    turns: [{
      index: 0, message: row.question, intent: "knowledge", confidence: 1, agent: "knowledge",
      slots: {}, expected_slots: null, asked_slot: null, escalated: false, escalation_reason: null,
      agent_error: false, grounding: "grounded", tool_status: "not_used", failure: "none",
      unsupported_facts: [],
      claims: 0, uncited_claims: 0, sentences: 0, covered_sentences: 0, important_sentences: 0,
      uncovered_important: [],
      latency_ms: 0, prompt_tokens: 0, output_tokens: 0, retries: 0,
      retrieved_docs: retrieved, cited_docs: [], reply: "", contexts: [],
    }],
  };
}

interface VariantResult {
  name: string;
  recall: number;
  precision: number;
  mrr: number;
  ndcg: number;
  empty: number;
  hit1: number;
  hit3: number;
  p50: number;
  p95: number;
  degraded: number;
}

async function runVariant(variant: Variant, prepared: Prepared[], k: number): Promise<VariantResult> {
  const records: EvalRecord[] = [];
  const latencies: number[] = [];
  let degraded = 0;

  for (const item of prepared) {
    const startedAt = Date.now();
    const result = await retrieve(item.row.question, { ...item.options, ...variant.options });
    latencies.push(Date.now() - startedAt);
    if (result.metrics.degraded !== "none") degraded += 1;
    records.push(toRecord(item.row, result.chunks.map((chunk) => chunk.sourceRef)));
  }

  const scores = scoreRetrieval(records, k);
  return {
    name: variant.name,
    recall: scores.recall_at_k,
    precision: scores.precision_at_k,
    mrr: scores.mrr,
    ndcg: scores.ndcg_at_k,
    empty: scores.empty_retrieval_rate,
    hit1: scores.hit_at_1,
    hit3: scores.hit_at_3,
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    degraded,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const golden = await loadGolden();

  // Chỉ câu TRONG phạm vi có nhãn tài liệu: Recall không định nghĩa được cho câu phải bị từ chối,
  // và gộp chúng vào sẽ kéo mọi cấu hình xuống như nhau mà không phân biệt được gì.
  let cases = golden.filter((row) => !row.out_of_scope && row.expected_docs.length > 0);
  if (options.split) cases = cases.filter((row) => row.split === options.split);
  if (options.limit) cases = cases.slice(0, options.limit);
  if (!cases.length) throw new Error("Bộ lọc không chọn được câu nào");

  console.log(`${cases.length} câu hỏi${options.split ? ` (tập ${options.split})` : ""}, k = ${options.k}.`);
  const prepared = await prepareQuestions(cases, options.k, options);
  if (options.minVector !== null || options.minKeyword !== null) {
    console.log(`Ngưỡng ghi đè: vector ${options.minVector ?? "mặc định"}, từ khoá ${options.minKeyword ?? "mặc định"}.`);
  }

  const results: VariantResult[] = [];
  for (const variant of VARIANTS) {
    process.stdout.write(`  đang chạy ${variant.name}... `);
    results.push(await runVariant(variant, prepared, options.k));
    console.log("xong");
  }

  const cell = (value: number): string => value.toFixed(4);
  console.log("");
  console.log(`| Cấu hình | Recall@${options.k} | Precision@${options.k} | MRR | nDCG@${options.k} | Top-1 | Top-3 | Rỗng | p50 | p95 |`);
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of results) {
    console.log(
      `| ${row.name} | ${cell(row.recall)} | ${cell(row.precision)} | ${cell(row.mrr)} | ` +
        `${cell(row.ndcg)} | ${cell(row.hit1)} | ${cell(row.hit3)} | ${cell(row.empty)} | ` +
        `${row.p50}ms | ${row.p95}ms |`,
    );
  }

  const degraded = results.filter((row) => row.degraded > 0);
  if (degraded.length) {
    console.log("");
    console.log(`CẢNH BÁO: có lượt chạy suy giảm (${degraded.map((row) => `${row.name}: ${row.degraded}`).join(", ")}).`);
    console.log("Số liệu bên trên KHÔNG so sánh được — sửa nhánh hỏng rồi đo lại.");
  }

  console.log("");
  console.log("Đọc bảng theo chiều cộng dồn: mỗi dòng thêm một bước và thêm một khoản độ trễ.");
  console.log("Chỉ bật bước nào mà mức tăng chất lượng bù được mức tăng p95.");
}

main()
  .catch((error) => {
    console.error("Thử nghiệm thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
