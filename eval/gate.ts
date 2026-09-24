export const METRICS = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"] as const;
export type Metric = (typeof METRICS)[number];
export type Metrics = Record<Metric, number>;

export interface ScoreRow {
  id: string;
  /** Có chấm RAGAS hay không. Câu ngoài phạm vi và kịch bản không gắn tài liệu thì không chấm. */
  scored: boolean;
  scores: Metrics | null;
}
export interface Scores {
  aggregate: Metrics;
  rows: ScoreRow[];
  skipped: number;
  judge_calls: number;
  judge_model: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function parseMetrics(value: unknown): Metrics {
  if (!record(value) || !METRICS.every((key) => unit(value[key]))) throw new Error("Điểm phải đủ bốn chỉ số hữu hạn trong [0, 1]");
  return {
    faithfulness: Number(value.faithfulness),
    answer_relevancy: Number(value.answer_relevancy),
    context_precision: Number(value.context_precision),
    context_recall: Number(value.context_recall),
  };
}

/**
 * Xác thực cả dòng chi tiết để file thiếu câu/NaN không thể được coi là đo thành công.
 *
 * Từ khi chỉ số từ chối chuyển sang TypeScript (eval/metrics/refusal.ts), file này KHÔNG còn mang
 * `refusal_pass` nữa. Bộ chấm Python chỉ biết `escalated === true` chứ không biết lượt đó chuyển
 * tiếp vì nhận ra câu ngoài phạm vi hay vì tác tử ném lỗi, nên nó không phải chỗ ra phán quyết đó.
 */
export function parseScores(value: unknown): Scores {
  if (!record(value) || !Array.isArray(value.rows) || value.rows.length === 0) throw new Error("File điểm thiếu rows");
  const aggregate = parseMetrics(value.aggregate);
  const ids = new Set<string>();
  const rows: ScoreRow[] = value.rows.map((row) => {
    if (!record(row) || typeof row.id !== "string" || !/^GS-\d{3}$/.test(row.id) || ids.has(row.id) || typeof row.scored !== "boolean") throw new Error("Dòng điểm không hợp lệ hoặc trùng id");
    ids.add(row.id);
    if (!row.scored) {
      if (row.scores !== null) throw new Error("Dòng không chấm RAGAS không được mang điểm");
      return { id: row.id, scored: false, scores: null };
    }
    return { id: row.id, scored: true, scores: parseMetrics(row.scores) };
  });
  const scored = rows.filter((row) => row.scored);
  if (!scored.length) throw new Error("Không có câu nào được chấm RAGAS");
  for (const key of METRICS) {
    const mean = scored.reduce((sum, row) => sum + (row.scores as Metrics)[key], 0) / scored.length;
    if (Math.abs(mean - aggregate[key]) > 1e-6) throw new Error("Điểm tổng hợp không khớp các dòng chi tiết");
  }
  const skipped = rows.length - scored.length;
  if (value.skipped !== skipped) throw new Error("Số dòng bỏ chấm không khớp");
  if (typeof value.judge_calls !== "number" || !Number.isSafeInteger(value.judge_calls) || value.judge_calls < 0) throw new Error("Thiếu số lượt gọi bộ chấm");
  if (typeof value.judge_model !== "string" || !value.judge_model.trim()) throw new Error("File điểm phải ghi rõ model đã chấm");
  return { aggregate, rows, skipped, judge_calls: value.judge_calls, judge_model: value.judge_model };
}

export type Direction = "min" | "max";

export interface GateRule {
  /** Khoá phẳng, cũng là khoá trong bảng giá trị mà report.ts dựng. */
  key: string;
  label: string;
  direction: Direction;
  /** Ngưỡng mặc định, null nghĩa là chỉ báo cáo chứ không quyết định PASS/FAIL. */
  fallback: number | null;
  env: string;
  unit: "ratio" | "ms";
  /**
   * Khoá đếm cỡ mẫu. Luật có cỡ mẫu 0 bị BỎ QUA chứ không FAIL.
   *
   * Thiếu điều này thì `npm run eval -- --ids GS-001` luôn trượt cổng: chạy một câu trong phạm vi
   * thì không có câu ngoài phạm vi nào, `correct_refusal_rate` bằng 0 theo định nghĩa, và một lần
   * chạy thử một câu bị báo là hồi quy.
   */
  samples: string;
}

/**
 * Bảng luật của cổng.
 *
 * Các ngưỡng mặc định là ĐIỂM KHỞI ĐẦU để bắt hồi quy và hỏng hóc, không phải mục tiêu chất lượng
 * đã hiệu chỉnh — giống ghi chú ở MIN_INTENT_CONFIDENCE. Hiệu chỉnh trên tập `dev` rồi mới siết,
 * và siết bằng biến môi trường chứ không sửa file này, để tập `holdout` không bị nhìn trước.
 *
 * Riêng `p95_latency_ms` là 3000 vì đó là NFR-PERF-03 chốt sẵn, không phải con số đoán.
 */
export const GATE_RULES: GateRule[] = [
  { key: "ragas.faithfulness", label: "RAGAS faithfulness", direction: "min", fallback: 0.8, env: "EVAL_MIN_FAITHFULNESS", unit: "ratio", samples: "ragas.count" },
  { key: "ragas.answer_relevancy", label: "RAGAS answer_relevancy", direction: "min", fallback: null, env: "EVAL_MIN_ANSWER_RELEVANCY", unit: "ratio", samples: "ragas.count" },
  { key: "ragas.context_precision", label: "RAGAS context_precision", direction: "min", fallback: null, env: "EVAL_MIN_CONTEXT_PRECISION", unit: "ratio", samples: "ragas.count" },
  { key: "ragas.context_recall", label: "RAGAS context_recall", direction: "min", fallback: null, env: "EVAL_MIN_CONTEXT_RECALL", unit: "ratio", samples: "ragas.count" },
  { key: "retrieval.recall_at_k", label: "Recall@k", direction: "min", fallback: 0.7, env: "EVAL_MIN_RECALL_AT_K", unit: "ratio", samples: "retrieval.count" },
  /**
   * NGƯỠNG TẮT CÓ CHỦ ĐÍCH — Precision@k không đo được điều nó định đo trên bộ vàng này.
   *
   * Precision@k bằng `số đoạn đúng / số đoạn trả về`. Trong bộ vàng hiện tại, 53 trên 54 câu
   * holdout chỉ gắn ĐÚNG MỘT tài liệu, trong khi truy xuất trả về trung bình 2,41 đoạn. Trần lý
   * thuyết của chỉ số này vì thế là 0,4954: kể cả khi mọi câu đều tìm đúng tài liệu, nó vẫn
   * không thể chạm ngưỡng 0,6. Giá trị đo được 0,4685 đã là 94,6% của trần.
   *
   * Đã kiểm xem nhãn có thiếu không, vì nếu bộ vàng gắn sót tài liệu anh em thì lỗi nằm ở nhãn
   * chứ không ở chỉ số. Kết quả ngược lại: đối chiếu nội dung từng tài liệu với đáp án mẫu, 161
   * trên 162 câu có nhãn được tài liệu ĐÃ GẮN phủ trọn. Nhãn đúng — câu hỏi thật sự chỉ có một
   * tài liệu trả lời.
   *
   * Nên cách duy nhất để "đạt" ngưỡng này là trả về ít đoạn hơn — trung bình dưới 1,67 đoạn mỗi
   * câu — và đó là tối ưu hoá theo một con số trong khi làm hỏng Recall thật. Đúng kiểu hỏng mà
   * một cổng chất lượng sinh ra để ngăn.
   *
   * Mối lo mà Precision@k được đặt ra để canh — truy xuất nới rộng kéo theo nguồn không liên
   * quan — nay do `retrieval.hit_at_1` canh: nhét thêm ứng viên vào danh sách sẽ đẩy tài liệu
   * đúng khỏi vị trí đầu, và chỉ số đó tụt ngay. Nó đo cùng một thứ mà không phụ thuộc vào việc
   * bộ vàng gắn một hay nhiều nhãn.
   *
   * Bật lại ngưỡng này khi bộ vàng chuyển sang gắn nhiều tài liệu cho một câu:
   * `EVAL_MIN_PRECISION_AT_K=0.6`.
   */
  { key: "retrieval.precision_at_k", label: "Precision@k (độ chính xác trích dẫn)", direction: "min", fallback: null, env: "EVAL_MIN_PRECISION_AT_K", unit: "ratio", samples: "retrieval.count" },
  { key: "retrieval.mrr", label: "MRR", direction: "min", fallback: 0.6, env: "EVAL_MIN_MRR", unit: "ratio", samples: "retrieval.count" },
  { key: "retrieval.ndcg_at_k", label: "nDCG@k", direction: "min", fallback: null, env: "EVAL_MIN_NDCG", unit: "ratio", samples: "retrieval.count" },
  /**
   * Thay chân Precision@k làm luật canh việc truy xuất nới rộng bừa. Ngưỡng 0,7 đặt dưới mức đo
   * được 0,7778 một chút, đủ để bắt một lần tụt thật mà không đỏ vì nhiễu giữa hai lần chạy.
   */
  { key: "retrieval.hit_at_1", label: "Nguồn đúng ở vị trí đầu", direction: "min", fallback: 0.7, env: "EVAL_MIN_HIT_AT_1", unit: "ratio", samples: "retrieval.count" },
  { key: "retrieval.hit_at_3", label: "Nguồn đúng trong top-3", direction: "min", fallback: 0.7, env: "EVAL_MIN_HIT_AT_3", unit: "ratio", samples: "retrieval.count" },
  { key: "retrieval.empty_retrieval_rate", label: "Tỷ lệ truy xuất rỗng", direction: "max", fallback: 0.1, env: "EVAL_MAX_EMPTY_RETRIEVAL", unit: "ratio", samples: "retrieval.count" },
  { key: "grounding.cited_answer_rate", label: "Câu trả lời dẫn được nguồn", direction: "min", fallback: 0.8, env: "EVAL_MIN_CITED_ANSWER", unit: "ratio", samples: "grounding.answered_with_evidence" },
  { key: "grounding.unsupported_fact_rate", label: "Dữ kiện số không kiểm được", direction: "max", fallback: 0.05, env: "EVAL_MAX_UNSUPPORTED_FACT", unit: "ratio", samples: "grounding.answered" },
  { key: "grounding.citation_precision", label: "Độ chính xác nguồn được dẫn", direction: "min", fallback: null, env: "EVAL_MIN_CITATION_PRECISION", unit: "ratio", samples: "grounding.citation_rows" },
  { key: "grounding.citation_coverage", label: "Độ phủ trích dẫn (theo câu)", direction: "min", fallback: 0.7, env: "EVAL_MIN_CITATION_COVERAGE", unit: "ratio", samples: "grounding.covered_sentence_rows" },
  { key: "grounding.uncited_claim_rate", label: "Ý khai không có nguồn", direction: "max", fallback: 0.1, env: "EVAL_MAX_UNCITED_CLAIM", unit: "ratio", samples: "grounding.claim_rows" },
  { key: "grounding.uncovered_important_rate", label: "Lượt còn câu số không dẫn nguồn", direction: "max", fallback: 0.1, env: "EVAL_MAX_UNCOVERED_IMPORTANT", unit: "ratio", samples: "grounding.answered" },
  { key: "intent.macro_f1", label: "Macro-F1 ý định", direction: "min", fallback: 0.7, env: "EVAL_MIN_INTENT_MACRO_F1", unit: "ratio", samples: "intent.count" },
  { key: "intent.slot_accuracy", label: "Độ chính xác slot", direction: "min", fallback: 0.8, env: "EVAL_MIN_SLOT_ACCURACY", unit: "ratio", samples: "intent.slot_pairs" },
  { key: "refusal.correct_refusal_rate", label: "Từ chối đúng lý do", direction: "min", fallback: 0.8, env: "EVAL_MIN_CORRECT_REFUSAL", unit: "ratio", samples: "refusal.out_of_scope_count" },
  { key: "refusal.false_refusal_rate", label: "Từ chối nhầm câu hợp lệ", direction: "max", fallback: 0.1, env: "EVAL_MAX_FALSE_REFUSAL", unit: "ratio", samples: "refusal.in_scope_count" },
  { key: "refusal.infra_escalation_rate", label: "Chuyển tiếp do lỗi hạ tầng", direction: "max", fallback: 0.05, env: "EVAL_MAX_INFRA_ESCALATION", unit: "ratio", samples: "refusal.total_count" },
  { key: "conversation.slot_retention_rate", label: "Giữ slot qua lượt", direction: "min", fallback: 0.9, env: "EVAL_MIN_SLOT_RETENTION", unit: "ratio", samples: "conversation.retention_pairs" },
  { key: "conversation.slot_update_accuracy", label: "Ghi đè slot khi khách sửa", direction: "min", fallback: 0.9, env: "EVAL_MIN_SLOT_UPDATE", unit: "ratio", samples: "conversation.update_pairs" },
  { key: "conversation.repeat_ask_rate", label: "Hỏi lặp", direction: "max", fallback: 0.1, env: "EVAL_MAX_REPEAT_ASK", unit: "ratio", samples: "conversation.count" },
  { key: "conversation.task_completion_rate", label: "Hoàn thành yêu cầu", direction: "min", fallback: 0.9, env: "EVAL_MIN_TASK_COMPLETION", unit: "ratio", samples: "conversation.count" },
  { key: "operational.p95_latency_ms", label: "p95 độ trễ (NFR-PERF-03)", direction: "max", fallback: 3000, env: "EVAL_MAX_P95_LATENCY_MS", unit: "ms", samples: "operational.turns" },
];

export type Thresholds = Record<string, number | null>;

function parseThreshold(rule: GateRule, raw: string): number {
  const value = Number(raw);
  if (!raw.trim() || !Number.isFinite(value)) throw new Error(`${rule.env} phải là số`);
  if (rule.unit === "ratio" && !unit(value)) throw new Error(`${rule.env} phải là số trong [0, 1]`);
  if (rule.unit === "ms" && (value < 0 || !Number.isSafeInteger(value))) throw new Error(`${rule.env} phải là số nguyên mili-giây không âm`);
  return value;
}

/** `EVAL_GATE_OFF=<khoá>,<khoá>` tắt hẳn một luật — dùng khi một tầng đang được viết lại. */
export function readThresholds(env: NodeJS.ProcessEnv): Thresholds {
  const disabled = new Set((env.EVAL_GATE_OFF ?? "").split(",").map((key) => key.trim()).filter(Boolean));
  for (const key of disabled) {
    if (!GATE_RULES.some((rule) => rule.key === key)) throw new Error(`EVAL_GATE_OFF nhắc luật không có: ${key}`);
  }
  const thresholds: Thresholds = {};
  for (const rule of GATE_RULES) {
    const raw = env[rule.env];
    thresholds[rule.key] = disabled.has(rule.key) ? null : raw === undefined ? rule.fallback : parseThreshold(rule, raw);
  }
  return thresholds;
}

export interface GateCheck {
  rule: GateRule;
  threshold: number | null;
  value: number;
  samples: number;
  status: "pass" | "fail" | "skipped" | "off";
  detail: string;
}

export interface GateOutcome {
  passed: boolean;
  checks: GateCheck[];
  failures: string[];
}

/**
 * Áp toàn bộ bảng luật.
 *
 * `values`/`samples` là hai bảng phẳng do report.ts dựng, cố tình không nhận nguyên đối tượng báo
 * cáo: cổng chỉ cần con số và cỡ mẫu, nên tách vậy thì thêm một chỉ số mới là thêm một dòng trong
 * GATE_RULES chứ không phải sửa chữ ký hàm.
 */
export function evaluateGate(values: Record<string, number>, samples: Record<string, number>, thresholds: Thresholds): GateOutcome {
  const checks: GateCheck[] = GATE_RULES.map((rule) => {
    const threshold = thresholds[rule.key] ?? null;
    const value = values[rule.key];
    const sampleCount = samples[rule.samples] ?? 0;
    if (threshold === null) return { rule, threshold, value: value ?? Number.NaN, samples: sampleCount, status: "off" as const, detail: "không áp" };
    if (sampleCount === 0) return { rule, threshold, value: value ?? Number.NaN, samples: 0, status: "skipped" as const, detail: "không có mẫu" };
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { rule, threshold, value: Number.NaN, samples: sampleCount, status: "fail" as const, detail: "thiếu điểm hợp lệ" };
    }
    const ok = rule.direction === "min" ? value >= threshold : value <= threshold;
    const sign = rule.direction === "min" ? "<" : ">";
    return {
      rule, threshold, value, samples: sampleCount,
      status: ok ? ("pass" as const) : ("fail" as const),
      detail: ok ? "đạt" : `${format(value, rule.unit)} ${sign} ${format(threshold, rule.unit)}`,
    };
  });
  const failures = checks.filter((check) => check.status === "fail").map((check) => `${check.rule.label}: ${check.detail}`);
  return { passed: failures.length === 0, checks, failures };
}

export function format(value: number, unit: "ratio" | "ms"): string {
  if (!Number.isFinite(value)) return "—";
  return unit === "ms" ? `${Math.round(value)}ms` : value.toFixed(4);
}
