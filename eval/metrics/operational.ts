import type { EvalRecord } from "@eval/dataset";

/**
 * Chỉ số vận hành: độ trễ, token và số lượt gọi lại.
 *
 * Đo trên TỪNG LƯỢT chứ không trên từng kịch bản: khách chờ một lượt trả lời, không chờ cả cuộc
 * hội thoại, nên ngưỡng 3 giây của NFR-PERF-03 áp cho lượt. Gộp theo kịch bản thì một hội thoại
 * ba lượt tự động trông chậm gấp ba mà không ai chậm thêm.
 */

export interface OperationalScores {
  turns: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  max_latency_ms: number;
  /** Tỷ lệ lượt vượt ngưỡng NFR-PERF-03. Nói rõ hơn p95 khi cỡ mẫu còn nhỏ. */
  over_budget_rate: number;
  budget_ms: number;
  prompt_tokens: number;
  output_tokens: number;
  tokens_per_turn: number;
  retries: number;
  /** Tỷ lệ lượt phải gọi lại ít nhất một lần vì phản hồi không phân giải được JSON. */
  retry_turn_rate: number;
}

/**
 * Phân vị theo hạng gần nhất (nearest-rank), không nội suy.
 *
 * Với cỡ mẫu vài chục lượt, nội suy tuyến tính tạo ra một con số không ứng với lượt nào có thật.
 * Hạng gần nhất luôn trả về một giá trị đã đo được, nên khi p95 vượt ngưỡng thì luôn tìm ra đúng
 * lượt gây ra nó.
 */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  if (!(fraction > 0 && fraction <= 1)) throw new Error("Phân vị phải nằm trong (0, 1]");
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1];
}

export function scoreOperational(records: EvalRecord[], budgetMs = 3000): OperationalScores {
  const turns = records.flatMap((row) => row.turns);
  const latencies = turns.map((turn) => turn.latency_ms);
  const sum = (pick: (turn: (typeof turns)[number]) => number): number => turns.reduce((total, turn) => total + pick(turn), 0);
  const promptTokens = sum((turn) => turn.prompt_tokens);
  const outputTokens = sum((turn) => turn.output_tokens);
  const ratio = (hits: number): number => (turns.length === 0 ? 0 : hits / turns.length);
  return {
    turns: turns.length,
    p50_latency_ms: percentile(latencies, 0.5),
    p95_latency_ms: percentile(latencies, 0.95),
    max_latency_ms: latencies.length === 0 ? 0 : Math.max(...latencies),
    over_budget_rate: ratio(latencies.filter((value) => value > budgetMs).length),
    budget_ms: budgetMs,
    prompt_tokens: promptTokens,
    output_tokens: outputTokens,
    tokens_per_turn: turns.length === 0 ? 0 : (promptTokens + outputTokens) / turns.length,
    retries: sum((turn) => turn.retries),
    retry_turn_rate: ratio(turns.filter((turn) => turn.retries > 0).length),
  };
}
