import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateGate, GATE_RULES, parseScores, readThresholds, type Metrics } from "./gate";
import { buildReport, formatSummary } from "./report";
import { record, turn } from "./metrics/fixture";

const metrics: Metrics = { faithfulness: 0.8, answer_relevancy: 0.7, context_precision: 0.6, context_recall: 0.5 };
const defaults = readThresholds({});

/** Bảng mẫu đủ tốt để mọi luật đều đạt; từng bài test chỉ bẻ một ô. */
const good: Record<string, number> = Object.fromEntries(
  GATE_RULES.map((rule) => [rule.key, rule.direction === "min" ? 1 : 0]),
);
const samples: Record<string, number> = Object.fromEntries(GATE_RULES.map((rule) => [rule.samples, 10]));

describe("KE-10…KE-13: cổng đa chỉ số", () => {
  it("chặn 0.79, nhận 0.80 và 0.81 ở faithfulness", () => {
    expect(evaluateGate({ ...good, "ragas.faithfulness": 0.79 }, samples, defaults).passed).toBe(false);
    expect(evaluateGate({ ...good, "ragas.faithfulness": 0.8 }, samples, defaults).passed).toBe(true);
    expect(evaluateGate({ ...good, "ragas.faithfulness": 0.81 }, samples, defaults).passed).toBe(true);
  });

  it("luật hướng max trượt khi vượt ngưỡng, không phải khi thấp hơn", () => {
    expect(evaluateGate({ ...good, "refusal.false_refusal_rate": 0.5 }, samples, defaults).passed).toBe(false);
    expect(evaluateGate({ ...good, "refusal.false_refusal_rate": 0 }, samples, defaults).passed).toBe(true);
    expect(evaluateGate({ ...good, "operational.p95_latency_ms": 3001 }, samples, defaults).failures[0]).toContain("p95");
    expect(evaluateGate({ ...good, "operational.p95_latency_ms": 3000 }, samples, defaults).passed).toBe(true);
  });

  it("kết quả từ chối quyết định PASS/FAIL chứ không chỉ được báo cáo", () => {
    const outcome = evaluateGate({ ...good, "refusal.correct_refusal_rate": 0.2 }, samples, defaults);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(" ")).toContain("Từ chối đúng lý do");
  });

  it("chỉ số không có mẫu bị bỏ qua chứ không làm trượt cổng", () => {
    const outcome = evaluateGate(good, { ...samples, "refusal.out_of_scope_count": 0 }, defaults);
    expect(outcome.passed).toBe(true);
    expect(outcome.checks.find((check) => check.rule.key === "refusal.correct_refusal_rate")?.status).toBe("skipped");
  });

  it("thiếu điểm hợp lệ là FAIL, không phải bỏ qua", () => {
    for (const value of [Number.NaN, undefined as unknown as number]) {
      expect(evaluateGate({ ...good, "ragas.faithfulness": value }, samples, defaults).passed).toBe(false);
    }
  });

  it.each(["NaN", "1.1", "-1", "", " "])("không nhận ngưỡng tỷ lệ lỗi %s", (value) => {
    expect(() => readThresholds({ EVAL_MIN_FAITHFULNESS: value })).toThrow();
  });

  it("đọc ngưỡng từ môi trường và tắt được từng luật", () => {
    expect(readThresholds({ EVAL_MIN_FAITHFULNESS: "0.75" })["ragas.faithfulness"]).toBe(0.75);
    expect(readThresholds({ EVAL_MAX_P95_LATENCY_MS: "5000" })["operational.p95_latency_ms"]).toBe(5000);
    expect(readThresholds({ EVAL_GATE_OFF: "ragas.faithfulness" })["ragas.faithfulness"]).toBeNull();
    expect(() => readThresholds({ EVAL_GATE_OFF: "khong-co-luat-nay" })).toThrow();
    expect(() => readThresholds({ EVAL_MAX_P95_LATENCY_MS: "-1" })).toThrow();
  });

  it("mỗi luật có khoá cỡ mẫu và biến môi trường riêng", () => {
    expect(new Set(GATE_RULES.map((rule) => rule.env)).size).toBe(GATE_RULES.length);
    expect(new Set(GATE_RULES.map((rule) => rule.key)).size).toBe(GATE_RULES.length);
  });
});

describe("KE-14: file điểm RAGAS", () => {
  const value = {
    aggregate: metrics,
    rows: [{ id: "GS-001", scored: true, scores: metrics }, { id: "GS-026", scored: false, scores: null }],
    skipped: 1, judge_calls: 4, judge_model: "gemini-2.5-pro",
  };

  it("kiểm tổng hợp, dòng trùng, dòng thiếu và model chấm", () => {
    expect(parseScores(value).aggregate).toEqual(metrics);
    expect(parseScores(value).skipped).toBe(1);
    expect(() => parseScores({ ...value, aggregate: { ...metrics, faithfulness: 0.99 } })).toThrow();
    expect(() => parseScores({ ...value, rows: [value.rows[0], value.rows[0]] })).toThrow();
    expect(() => parseScores({ ...value, rows: [] })).toThrow();
    expect(() => parseScores({ ...value, aggregate: { ...metrics, context_recall: null } })).toThrow();
    expect(() => parseScores({ ...value, skipped: 0 })).toThrow();
    expect(() => parseScores({ ...value, judge_model: " " })).toThrow();
  });

  it("dòng không chấm mà vẫn mang điểm là file hỏng", () => {
    expect(() => parseScores({ ...value, rows: [value.rows[0], { id: "GS-026", scored: false, scores: metrics }] })).toThrow();
  });
});

describe("KE-15: báo cáo chạy được khi không có RAGAS", () => {
  it("bỏ qua bốn luật RAGAS và vẫn ra phán quyết từ phần tất định", () => {
    const records = [
      record({ id: "GS-001", expected_docs: ["food:a"], turns: [turn({ retrieved_docs: ["food:a"], cited_docs: ["food:a"] })] }),
      record({
        id: "GS-026", kind: "refusal", group: "out_of_scope", out_of_scope: true, expected_docs: [],
        expected_intent: "support", expected_escalation_reason: "OUT_OF_SCOPE",
        turns: [turn({ intent: "support", agent: "support", contexts: [], escalated: true, escalation_reason: "OUT_OF_SCOPE" })],
      }),
    ];
    const report = buildReport(records, null, defaults, { k: 5 });
    expect(report.gate.passed).toBe(true);
    const ragas = report.gate.checks.filter((check) => check.rule.key.startsWith("ragas."));
    expect(ragas.every((check) => check.status === "skipped" || check.status === "off")).toBe(true);
    expect(report.gate.checks.some((check) => check.status === "pass")).toBe(true);
    expect(formatSummary(report, records)).toContain("Không chạy bộ chấm");
  });

  it("một câu ngoài phạm vi bị bỏ lọt làm trượt cổng", () => {
    const records = [
      record({ id: "GS-001", expected_docs: ["food:a"], turns: [turn({ retrieved_docs: ["food:a"], cited_docs: ["food:a"] })] }),
      record({
        id: "GS-026", kind: "refusal", group: "out_of_scope", out_of_scope: true, expected_docs: [],
        expected_intent: "support", expected_escalation_reason: "OUT_OF_SCOPE",
        turns: [turn({ intent: "support", agent: "knowledge", contexts: [] })],
      }),
    ];
    expect(buildReport(records, null, defaults, { k: 5 }).gate.passed).toBe(false);
  });
});

it("KE-30: server không import thư mục đánh giá", () => {
  function scan(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.[cm]?tsx?$/.test(entry.name)) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toMatch(/(?:from\s*|import\s*\(?|require\s*\()\s*["'][^"']*(?:\/eval\/|@eval[\/"'])/);
      }
    }
  }
  scan(path.resolve("server"));
});
