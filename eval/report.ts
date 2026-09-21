import { SPLITS, VARIANTS, type EvalRecord, type Split } from "@eval/dataset";
import { scoreConversation, type ConversationScores } from "@eval/metrics/conversation";
import { scoreGrounding, type GroundingScores } from "@eval/metrics/grounding";
import { scoreIntent, type IntentScores } from "@eval/metrics/intent";
import { scoreOperational, type OperationalScores } from "@eval/metrics/operational";
import { scoreRefusal, type RefusalScores } from "@eval/metrics/refusal";
import { scoreRetrieval, type RetrievalScores } from "@eval/metrics/retrieval";
import { evaluateGate, format, METRICS, type GateOutcome, type Metrics, type Scores, type Thresholds } from "@eval/gate";

/**
 * Gộp năm nhóm chỉ số thành một báo cáo và một phán quyết PASS/FAIL.
 *
 * Bốn nhóm tất định (truy xuất, ý định, từ chối, vận hành) tính thẳng từ dataset nên luôn có, kể
 * cả khi chạy `--skip-score`. Nhóm RAGAS cần bộ chấm Python nên có thể vắng — khi vắng thì bốn
 * luật RAGAS bị bỏ qua chứ cổng vẫn chạy, vì phần lớn hồi quy thật (truy xuất trượt, từ chối
 * nhầm, chậm quá ngưỡng) không cần một lượt gọi model nào để phát hiện.
 */

export interface RagasSection extends Metrics {
  count: number;
  judge_model: string;
  judge_calls: number;
}

export interface EvalReport {
  records: number;
  splits: Record<Split, number>;
  retrieval: RetrievalScores;
  intent: IntentScores;
  refusal: RefusalScores;
  conversation: ConversationScores;
  grounding: GroundingScores;
  operational: OperationalScores;
  ragas: RagasSection | null;
  gate: GateOutcome;
  values: Record<string, number>;
  samples: Record<string, number>;
}

export interface ReportOptions {
  k?: number;
  budgetMs?: number;
}

export function buildReport(records: EvalRecord[], scores: Scores | null, thresholds: Thresholds, options: ReportOptions = {}): EvalReport {
  const retrieval = scoreRetrieval(records, options.k ?? 5);
  const intent = scoreIntent(records);
  const refusal = scoreRefusal(records);
  const conversation = scoreConversation(records);
  const grounding = scoreGrounding(records);
  const operational = scoreOperational(records, options.budgetMs ?? 3000);
  const ragas: RagasSection | null = scores
    ? { ...scores.aggregate, count: scores.rows.filter((row) => row.scored).length, judge_model: scores.judge_model, judge_calls: scores.judge_calls }
    : null;

  const values: Record<string, number> = {
    "retrieval.recall_at_k": retrieval.recall_at_k,
    "retrieval.precision_at_k": retrieval.precision_at_k,
    "retrieval.mrr": retrieval.mrr,
    "retrieval.ndcg_at_k": retrieval.ndcg_at_k,
    "retrieval.empty_retrieval_rate": retrieval.empty_retrieval_rate,
    "retrieval.hit_at_1": retrieval.hit_at_1,
    "retrieval.hit_at_3": retrieval.hit_at_3,
    "grounding.cited_answer_rate": grounding.cited_answer_rate,
    "grounding.unsupported_fact_rate": grounding.unsupported_fact_rate,
    "grounding.citation_precision": grounding.citation_precision,
    "grounding.citation_coverage": grounding.citation_coverage,
    "grounding.uncited_claim_rate": grounding.uncited_claim_rate,
    "grounding.uncovered_important_rate": grounding.uncovered_important_rate,
    "intent.macro_f1": intent.macro_f1,
    "intent.slot_accuracy": intent.slot_accuracy,
    "refusal.correct_refusal_rate": refusal.correct_refusal_rate,
    "refusal.false_refusal_rate": refusal.false_refusal_rate,
    "refusal.infra_escalation_rate": refusal.infra_escalation_rate,
    "conversation.slot_retention_rate": conversation.slot_retention_rate,
    "conversation.slot_update_accuracy": conversation.slot_update_accuracy,
    "conversation.repeat_ask_rate": conversation.repeat_ask_rate,
    "conversation.task_completion_rate": conversation.task_completion_rate,
    "operational.p95_latency_ms": operational.p95_latency_ms,
  };
  const samples: Record<string, number> = {
    "retrieval.count": retrieval.count,
    "grounding.answered_with_evidence": grounding.answered_with_evidence,
    "grounding.answered": grounding.answered,
    "grounding.citation_rows": grounding.citation_rows,
    "grounding.covered_sentence_rows": grounding.covered_sentence_rows,
    "grounding.claim_rows": grounding.claim_rows,
    "intent.count": intent.count,
    "intent.slot_pairs": intent.slot_pairs,
    "refusal.out_of_scope_count": refusal.out_of_scope_count,
    "refusal.in_scope_count": refusal.in_scope_count,
    "refusal.total_count": records.length,
    "conversation.count": conversation.count,
    "conversation.retention_pairs": conversation.retention_pairs,
    "conversation.update_pairs": conversation.update_pairs,
    "operational.turns": operational.turns,
    "ragas.count": ragas?.count ?? 0,
  };
  for (const key of METRICS) values[`ragas.${key}`] = ragas ? ragas[key] : Number.NaN;

  return {
    records: records.length,
    splits: Object.fromEntries(SPLITS.map((split) => [split, records.filter((row) => row.split === split).length])) as Record<Split, number>,
    retrieval, intent, refusal, conversation, grounding, operational, ragas,
    gate: evaluateGate(values, samples, thresholds),
    values, samples,
  };
}

const STATUS: Record<string, string> = { pass: "PASS", fail: "FAIL", skipped: "bỏ qua", off: "tắt" };

/**
 * BA NHÓM ĐIỂM, và một phán quyết riêng cho mỗi nhóm.
 *
 * Gộp mọi luật vào một PASS/FAIL duy nhất che mất thứ đáng biết nhất: hệ thống hỏng ở TẦNG NÀO.
 * Ba tầng dưới đây hỏng theo ba cách khác nhau và được sửa bằng ba việc khác nhau — chỉnh truy
 * xuất, siết ràng buộc dẫn nguồn, hay sửa luồng hội thoại.
 *
 * Phân nhóm này cũng là chỗ đặt một nguyên tắc: RAGAS chỉ là MỘT PHẦN của nhóm hai. Một câu trả
 * lời trôi chảy, bám sát ngữ cảnh, điểm faithfulness cao nhưng không hoàn thành việc khách nhờ
 * thì nhóm ba vẫn trượt — và cổng vẫn FAIL. Không có cách chia này thì bốn điểm RAGAS đẹp đủ để
 * che một tỷ lệ hoàn thành nhiệm vụ tệ.
 */
const GROUPS: { name: string; note: string; prefixes: string[] }[] = [
  {
    name: "Chất lượng truy xuất",
    note: "Có tìm ra đúng tài liệu không, và có xếp nó lên đầu không.",
    prefixes: ["retrieval."],
  },
  {
    name: "Căn cứ câu trả lời",
    note: "Câu trả lời có chứng minh được nguồn của mình không. RAGAS chỉ là một phần của nhóm này.",
    prefixes: ["grounding.", "ragas."],
  },
  {
    name: "Hoàn thành nhiệm vụ",
    note: "Khách có nhận được thứ họ nhờ không — kể cả khi câu chữ nghe rất thuyết phục.",
    prefixes: ["intent.", "refusal.", "conversation.", "operational."],
  },
];

function groupTable(gate: GateOutcome): string[] {
  const rows = GROUPS.map((group) => {
    const checks = gate.checks.filter((check) => group.prefixes.some((prefix) => check.rule.key.startsWith(prefix)));
    const decided = checks.filter((check) => check.status === "pass" || check.status === "fail");
    const failed = decided.filter((check) => check.status === "fail");
    // Không có luật nào quyết định thì nhóm là "chưa đo", KHÔNG phải "đạt": một nhóm bị tắt hết
    // luật mà báo PASS là cách tệ nhất để mất một tầng kiểm soát.
    const verdict = decided.length === 0 ? "chưa đo" : failed.length === 0 ? "PASS" : "FAIL";
    return `| ${group.name} | ${verdict} | ${decided.length - failed.length}/${decided.length} | ${failed.map((check) => check.rule.label).join(", ") || "—"} | ${group.note} |`;
  });
  return [
    "", "## Ba nhóm điểm", "",
    "| Nhóm | Kết quả | Luật đạt | Luật trượt | Nhóm này trả lời điều gì |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ];
}

function ratio(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "—";
}

/**
 * Bảng phân rã theo biến thể câu hỏi.
 *
 * Đây là bảng trả lời câu hỏi "hệ thống hỏng ở đâu" nhanh nhất: Recall@k tổng thể 0,75 có thể là
 * mọi nhóm đều 0,75, mà cũng có thể là câu viết chuẩn đạt 0,95 còn câu không dấu đạt 0,30. Hai
 * tình huống đó cần hai cách sửa hoàn toàn khác nhau.
 */
function variantTable(records: EvalRecord[], options: ReportOptions): string[] {
  const rows = VARIANTS.map((variant) => {
    const subset = records.filter((row) => row.variant === variant);
    if (!subset.length) return null;
    const retrieval = scoreRetrieval(subset, options.k ?? 5);
    const refusal = scoreRefusal(subset);
    const intent = scoreIntent(subset);
    return `| ${variant} | ${subset.length} | ${retrieval.count ? ratio(retrieval.recall_at_k) : "—"} | ${intent.count ? ratio(intent.macro_f1) : "—"} | ${refusal.in_scope_count ? ratio(refusal.false_refusal_rate) : "—"} |`;
  }).filter((row): row is string => row !== null);
  if (!rows.length) return [];
  return ["", "## Theo biến thể câu hỏi", "", "| Biến thể | Số kịch bản | Recall@k | Macro-F1 | Từ chối nhầm |", "| --- | --- | --- | --- | --- |", ...rows];
}

function splitTable(records: EvalRecord[], options: ReportOptions): string[] {
  const rows = SPLITS.map((split) => {
    const subset = records.filter((row) => row.split === split);
    if (!subset.length) return null;
    const retrieval = scoreRetrieval(subset, options.k ?? 5);
    const refusal = scoreRefusal(subset);
    const intent = scoreIntent(subset);
    const operational = scoreOperational(subset, options.budgetMs ?? 3000);
    return `| ${split} | ${subset.length} | ${retrieval.count ? ratio(retrieval.recall_at_k) : "—"} | ${intent.count ? ratio(intent.macro_f1) : "—"} | ${refusal.out_of_scope_count ? ratio(refusal.correct_refusal_rate) : "—"} | ${operational.p95_latency_ms}ms |`;
  }).filter((row): row is string => row !== null);
  if (rows.length < 2) return [];
  return ["", "## Tập tinh chỉnh và tập giữ riêng", "",
    "Chênh lệch lớn giữa hai dòng là dấu hiệu prompt và ngưỡng đã được vặn theo tập `dev`.", "",
    "| Tập | Số kịch bản | Recall@k | Macro-F1 | Từ chối đúng | p95 |", "| --- | --- | --- | --- | --- | --- |", ...rows];
}

export function formatSummary(report: EvalReport, records: EvalRecord[], options: ReportOptions = {}): string {
  const { gate, retrieval, intent, refusal, conversation, grounding, operational, ragas } = report;
  const lines: string[] = [
    "# Kết quả đánh giá",
    "",
    `${report.records} kịch bản (${operational.turns} lượt) — dev ${report.splits.dev}, holdout ${report.splits.holdout}.`,
    "",
    `**Cổng: ${gate.passed ? "PASS" : "FAIL"}**${gate.failures.length ? ` — ${gate.failures.join("; ")}` : ""}`,
    "",
    "| Chỉ số | Giá trị | Hướng | Ngưỡng | Mẫu | Kết quả |",
    "| --- | --- | --- | --- | --- | --- |",
    ...gate.checks.map((check) =>
      `| ${check.rule.label} | ${format(check.value, check.rule.unit)} | ${check.rule.direction === "min" ? "≥" : "≤"} | ${check.threshold === null ? "—" : format(check.threshold, check.rule.unit)} | ${check.samples} | ${STATUS[check.status]} |`),
    ...groupTable(gate),
    "",
    "## Truy xuất",
    "",
    `Recall@${retrieval.k} ${ratio(retrieval.recall_at_k)}; Precision@${retrieval.k} ${ratio(retrieval.precision_at_k)}; MRR ${ratio(retrieval.mrr)}; nDCG@${retrieval.k} ${ratio(retrieval.ndcg_at_k)}; truy xuất rỗng ${ratio(retrieval.empty_retrieval_rate)} trên ${retrieval.count} câu có nhãn.`,
    "",
    "## Nhận diện ý định",
    "",
    `Macro-F1 ${ratio(intent.macro_f1)}; accuracy ${ratio(intent.accuracy)} trên ${intent.count} câu. Slot đúng ${intent.slot_accuracy ? ratio(intent.slot_accuracy) : "—"} trên ${intent.slot_pairs} cặp có nhãn.`,
    "",
    "| Ý định | Mẫu | Dự đoán | P | R | F1 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...intent.classes.map((row) => `| ${row.intent} | ${row.support} | ${row.predicted} | ${ratio(row.precision)} | ${ratio(row.recall)} | ${ratio(row.f1)} |`),
    "",
    "## Từ chối và chuyển tiếp",
    "",
    `Có chuyển tiếp ${ratio(refusal.refused_rate)}; **đúng lý do ${ratio(refusal.correct_refusal_rate)}** trên ${refusal.out_of_scope_count} câu ngoài phạm vi.`,
    `Từ chối nhầm câu hợp lệ ${ratio(refusal.false_refusal_rate)} trên ${refusal.in_scope_count} câu. Chuyển tiếp do lỗi hạ tầng ${ratio(refusal.infra_escalation_rate)}.`,
  ];

  const wrongReason = refusal.rows.filter((row) => !row.correct);
  if (wrongReason.length) {
    lines.push("", "| ID | Lý do mong đợi | Lý do thực tế | Lỗi tác tử |", "| --- | --- | --- | --- |",
      ...wrongReason.map((row) => `| ${row.id} | ${row.expected_reason ?? "—"} | ${row.actual_reason ?? (row.escalated ? "không ghi" : "không chuyển tiếp")} | ${row.agent_error ? "có" : "không"} |`));
  }

  if (conversation.count) {
    lines.push("", "## Hội thoại nhiều lượt", "",
      `${conversation.count} kịch bản. Giữ slot ${ratio(conversation.slot_retention_rate)} (${conversation.retention_pairs} cặp); ghi đè khi khách sửa ${ratio(conversation.slot_update_accuracy)} (${conversation.update_pairs} cặp).`,
      `Hỏi lặp ${ratio(conversation.repeat_ask_rate)}; hoàn thành yêu cầu ${ratio(conversation.task_completion_rate)}.`);
    const broken = conversation.rows.filter((row) => !row.completed || row.repeated_ask || row.carried_ok < row.carried || row.updated_ok < row.updated);
    if (broken.length) {
      lines.push("", "| ID | Lượt | Giữ | Ghi đè | Hỏi lặp | Xong |", "| --- | --- | --- | --- | --- | --- |",
        ...broken.map((row) => `| ${row.id} | ${row.turns} | ${row.carried_ok}/${row.carried} | ${row.updated_ok}/${row.updated} | ${row.repeated_ask ?? "—"} | ${row.completed ? "có" : "không"} |`));
    }
  }

  lines.push("", "## Căn cứ của câu trả lời", "",
    `Dẫn được nguồn ${ratio(grounding.cited_answer_rate)} trên ${grounding.answered_with_evidence} lượt có chứng cứ; ` +
      `dữ kiện số không kiểm được ${ratio(grounding.unsupported_fact_rate)} trên ${grounding.answered} lượt có trả lời.`,
    `Nguồn được dẫn trúng nhãn ${grounding.citation_rows ? ratio(grounding.citation_precision) : "—"} (${grounding.citation_rows} lượt dẫn). ` +
      `Tool hỏng ${ratio(grounding.tool_failure_rate)}, tool chập nhưng không cản trả lời ${ratio(grounding.tool_degraded_rate)}.`,
    `Độ phủ trích dẫn ${grounding.covered_sentence_rows ? ratio(grounding.citation_coverage) : "—"} ` +
      `trên ${grounding.covered_sentence_rows} câu mang thông tin; ý khai không có nguồn ` +
      `${grounding.claim_rows ? ratio(grounding.uncited_claim_rate) : "—"} trên ${grounding.claim_rows} ý. ` +
      `Lượt còn câu mang con số không dẫn nguồn ${ratio(grounding.uncovered_important_rate)}.`,
    "",
    `Trạng thái: ${Object.entries(grounding.statuses).map(([status, count]) => `${status} ${count}`).join(" · ")}.`);
  if (grounding.rows.length) {
    lines.push("", "| ID | Trạng thái | Đã dẫn/truy xuất | Dữ kiện không kiểm được |", "| --- | --- | --- | --- |",
      ...grounding.rows.slice(0, 25).map((row) => `| ${row.id} | ${row.status} | ${row.cited}/${row.retrieved} | ${row.unsupported.join(", ") || "—"} |`));
  }

  lines.push("", "## Vận hành", "",
    `p50 ${operational.p50_latency_ms}ms; p95 ${operational.p95_latency_ms}ms; cao nhất ${operational.max_latency_ms}ms; vượt ${operational.budget_ms}ms ở ${ratio(operational.over_budget_rate)} số lượt.`,
    `Token: ${operational.prompt_tokens} vào + ${operational.output_tokens} ra (${operational.tokens_per_turn.toFixed(1)}/lượt). Gọi lại ${operational.retries} lần ở ${ratio(operational.retry_turn_rate)} số lượt.`);

  if (ragas) {
    lines.push("", "## RAGAS", "",
      ...(ragas.judge_model === "" ? [] : [`Model chấm: ${ragas.judge_model}; ${ragas.judge_calls} lượt gọi trên ${ragas.count} câu trong phạm vi.`, ""]),
      "| Chỉ số | Trung bình |", "| --- | --- |",
      ...METRICS.map((key) => `| ${key} | ${ratio(ragas[key])} |`));
  } else {
    lines.push("", "## RAGAS", "", "Không chạy bộ chấm ở lần này; bốn luật RAGAS bị bỏ qua.");
  }

  lines.push(...splitTable(records, options), ...variantTable(records, options), "");
  return lines.join("\n");
}
