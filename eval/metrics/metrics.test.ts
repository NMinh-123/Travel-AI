import { describe, expect, it } from "vitest";
import { record, turn } from "./fixture";
import { scoreRetrieval } from "./retrieval";
import { scoreIntent, slotEquals } from "./intent";
import { scoreRefusal } from "./refusal";
import { scoreConversation } from "./conversation";
import { percentile, scoreOperational } from "./operational";
import { scoreGrounding } from "./grounding";
import { buildReport, formatSummary } from "@eval/report";
import { GATE_RULES, readThresholds } from "@eval/gate";

describe("KE-40: truy xuất tính từ expected_docs", () => {
  it("Recall@k, MRR và nDCG đọc đúng thứ hạng", () => {
    const rows = [
      record({ id: "GS-001", expected_docs: ["a", "b"], turns: [turn({ retrieved_docs: ["a", "x", "b"] })] }),
      record({ id: "GS-002", expected_docs: ["a"], turns: [turn({ retrieved_docs: ["x", "y", "a"] })] }),
    ];
    const scores = scoreRetrieval(rows, 5);
    expect(scores.recall_at_k).toBeCloseTo(1, 10);
    // Hạng 1 và hạng 3 → (1 + 1/3) / 2.
    expect(scores.mrr).toBeCloseTo((1 + 1 / 3) / 2, 10);
    expect(scores.rows[0].ndcg_at_k).toBeGreaterThan(scores.rows[1].ndcg_at_k);
  });

  it("Precision@k chia cho số tài liệu đã trích, không chia cho k", () => {
    const rows = [record({ expected_docs: ["a", "b"], turns: [turn({ retrieved_docs: ["a", "b"] })] })];
    expect(scoreRetrieval(rows, 5).precision_at_k).toBe(1);
    const noisy = [record({ expected_docs: ["a"], turns: [turn({ retrieved_docs: ["a", "x", "y", "z"] })] })];
    expect(scoreRetrieval(noisy, 5).precision_at_k).toBe(0.25);
    // Recall vẫn hoàn hảo trong khi Precision tụt: đúng cặp chỉ số mà một truy xuất nới rộng
    // quá tay làm lệch theo hai hướng ngược nhau.
    expect(scoreRetrieval(noisy, 5).recall_at_k).toBe(1);
  });

  it("cắt đúng ở k: tài liệu đúng nằm ngoài top-k không được tính", () => {
    const rows = [record({ expected_docs: ["a"], turns: [turn({ retrieved_docs: ["x", "y", "a"] })] })];
    expect(scoreRetrieval(rows, 2).recall_at_k).toBe(0);
    expect(scoreRetrieval(rows, 2).mrr).toBe(0);
    expect(scoreRetrieval(rows, 3).recall_at_k).toBe(1);
  });

  it("nhiều đoạn cùng một tài liệu không được đọc thành nhiều tài liệu", () => {
    const rows = [record({ expected_docs: ["a", "b"], turns: [turn({ retrieved_docs: ["a", "a", "a", "b"] })] })];
    expect(scoreRetrieval(rows, 3).recall_at_k).toBe(1);
  });

  it("chỉ tính câu trong phạm vi có nhãn, và đếm truy xuất rỗng", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ retrieved_docs: [] })], expected_docs: ["a"] }),
      record({ id: "GS-002", kind: "refusal", out_of_scope: true, expected_docs: [], expected_escalation_reason: "OUT_OF_SCOPE" }),
    ];
    const scores = scoreRetrieval(rows);
    expect(scores.count).toBe(1);
    expect(scores.empty_retrieval_rate).toBe(1);
  });

  it("từ chối k không hợp lệ thay vì trả số vô nghĩa", () => {
    expect(() => scoreRetrieval([], 0)).toThrow();
  });
});

describe("KE-41: ý định và slot", () => {
  it("macro-F1 phơi ra bộ phân loại chỉ đoán lớp đa số", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => record({ id: `GS-00${i + 1}`, expected_intent: "knowledge" })),
      record({ id: "GS-011", expected_intent: "itinerary", turns: [turn({ intent: "knowledge" })] }),
      record({ id: "GS-012", expected_intent: "budget", turns: [turn({ intent: "knowledge" })] }),
    ];
    const scores = scoreIntent(rows);
    expect(scores.accuracy).toBeCloseTo(0.8, 10);
    // Hai lớp còn lại F1 = 0 nên macro kéo xuống hẳn, đúng chỗ accuracy che mất.
    expect(scores.macro_f1).toBeLessThan(0.35);
  });

  it("lớp chưa có mẫu không kéo macro-F1 xuống", () => {
    const scores = scoreIntent([record({ expected_intent: "knowledge" })]);
    expect(scores.macro_f1).toBe(1);
    expect(scores.classes.find((row) => row.intent === "support")?.support).toBe(0);
  });

  it("độ chính xác slot so khớp sâu và bỏ qua khoá không có nhãn", () => {
    const rows = [record({
      turns: [turn({ expected_slots: { days: 3, destinations: ["Đồng Văn"] }, slots: { days: 3, destinations: ["Đồng Văn"], travelers: 9 } })],
    })];
    expect(scoreIntent(rows).slot_accuracy).toBe(1);
    expect(scoreIntent(rows).slot_exact_turn_rate).toBe(1);
  });

  it("slotEquals phân biệt thứ tự mảng và so khớp bộ phận với object", () => {
    expect(slotEquals(["a", "b"], ["b", "a"])).toBe(false);
    expect(slotEquals({ temporalType: "month" }, { temporalType: "month", month: 10 })).toBe(true);
    expect(slotEquals({ temporalType: "month" }, { temporalType: "season" })).toBe(false);
    expect(slotEquals(3, "3")).toBe(false);
  });
});

describe("KE-42: từ chối tách khỏi lỗi hạ tầng", () => {
  const refusal = (patch = {}) => record({
    id: "GS-026", kind: "refusal", group: "out_of_scope", out_of_scope: true, expected_docs: [],
    expected_intent: "support", expected_escalation_reason: "OUT_OF_SCOPE", ...patch,
  });

  it("chuyển tiếp vì tác tử ném lỗi KHÔNG được tính là từ chối đúng", () => {
    const rows = [refusal({ turns: [turn({ escalated: true, escalation_reason: "OUT_OF_SCOPE", agent_error: true })] })];
    const scores = scoreRefusal(rows);
    expect(scores.refused_rate).toBe(1);
    expect(scores.correct_refusal_rate).toBe(0);
    expect(scores.infra_escalation_rate).toBe(1);
  });

  it("chuyển tiếp sai lý do bị tính là trượt", () => {
    const rows = [refusal({ turns: [turn({ escalated: true, escalation_reason: "LOW_CONFIDENCE" })] })];
    expect(scoreRefusal(rows).correct_refusal_rate).toBe(0);
    expect(scoreRefusal(rows).reason_accuracy).toBe(0);
    expect(scoreRefusal(rows).rows[0].actual_reason).toBe("LOW_CONFIDENCE");
  });

  it("chuyển tiếp có chủ đích, đúng lý do thì đạt", () => {
    const rows = [refusal({ turns: [turn({ escalated: true, escalation_reason: "OUT_OF_SCOPE" })] })];
    expect(scoreRefusal(rows).correct_refusal_rate).toBe(1);
    expect(scoreRefusal(rows).infra_escalation_rate).toBe(0);
  });

  it("câu hợp lệ bị chuyển tiếp rơi vào tỷ lệ từ chối nhầm, hỏi bổ sung slot thì không", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ escalated: true, escalation_reason: "OUT_OF_SCOPE" })] }),
      record({ id: "GS-002", turns: [turn({ asked_slot: "days" })] }),
    ];
    expect(scoreRefusal(rows).false_refusal_rate).toBe(0.5);
  });

  it("một hệ thống hỏng toàn bộ không được trông như từ chối hoàn hảo", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      refusal({ id: `GS-02${i + 5}`, turns: [turn({ escalated: true, escalation_reason: "OUT_OF_SCOPE", agent_error: true })] }));
    const scores = scoreRefusal(rows);
    expect(scores.refused_rate).toBe(1);
    expect(scores.correct_refusal_rate).toBe(0);
  });
});

describe("KE-43: hội thoại nhiều lượt", () => {
  // "Đi 3 ngày" → "4 người" → "Đổi thành 2 ngày": phải giữ travelers và cập nhật days.
  const revision = (last: Record<string, unknown>) =>
    record({
      id: "GS-131", kind: "conversation", group: "itinerary", expected_intent: "itinerary",
      turns: [
        turn({ index: 0, message: "Đi 3 ngày", expected_slots: { days: 3 }, slots: { days: 3 } }),
        turn({ index: 1, message: "4 người", expected_slots: { days: 3, travelers: 4 }, slots: { days: 3, travelers: 4 } }),
        turn({ index: 2, message: "Đổi thành 2 ngày", expected_slots: { days: 2, travelers: 4 }, slots: last }),
      ],
    });

  it("giữ đúng và ghi đè đúng thì cả hai chỉ số bằng 1", () => {
    const scores = scoreConversation([revision({ days: 2, travelers: 4 })]);
    expect(scores.slot_retention_rate).toBe(1);
    expect(scores.slot_update_accuracy).toBe(1);
    expect(scores.task_completion_rate).toBe(1);
  });

  it("quên số người: hỏng ở chỉ số giữ slot, không phải chỉ số ghi đè", () => {
    const scores = scoreConversation([revision({ days: 2 })]);
    expect(scores.slot_update_accuracy).toBe(1);
    expect(scores.slot_retention_rate).toBeLessThan(1);
  });

  it("không đổi số ngày: hỏng ở chỉ số ghi đè, không phải chỉ số giữ slot", () => {
    const scores = scoreConversation([revision({ days: 3, travelers: 4 })]);
    expect(scores.slot_retention_rate).toBe(1);
    expect(scores.slot_update_accuracy).toBeLessThan(1);
  });

  it("hỏi lại đúng slot đã hỏi và lượt cuối vẫn hỏi thì bị đếm", () => {
    const rows = [record({
      id: "GS-132", kind: "conversation", group: "itinerary",
      turns: [turn({ index: 0, asked_slot: "days" }), turn({ index: 1, asked_slot: "days" })],
    })];
    const scores = scoreConversation(rows);
    expect(scores.repeat_ask_rate).toBe(1);
    expect(scores.task_completion_rate).toBe(0);
  });

  it("câu đơn lượt không lọt vào nhóm chỉ số hội thoại", () => {
    expect(scoreConversation([record()]).count).toBe(0);
  });
});

describe("KE-44: vận hành", () => {
  it("phân vị theo hạng gần nhất luôn trả về giá trị đã đo", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(40);
    expect(percentile([], 0.5)).toBe(0);
    expect(() => percentile([1], 0)).toThrow();
  });

  it("đo theo lượt chứ không theo kịch bản, và cộng dồn token với retry", () => {
    const rows = [record({
      id: "GS-131", kind: "conversation", group: "itinerary",
      turns: [turn({ index: 0, latency_ms: 500, retries: 1 }), turn({ index: 1, latency_ms: 4000 })],
    })];
    const scores = scoreOperational(rows, 3000);
    expect(scores.turns).toBe(2);
    expect(scores.p95_latency_ms).toBe(4000);
    expect(scores.over_budget_rate).toBe(0.5);
    expect(scores.retries).toBe(1);
    expect(scores.retry_turn_rate).toBe(0.5);
    expect(scores.prompt_tokens).toBe(200);
  });
});

describe("KE-45: căn cứ của câu trả lời", () => {
  it("câu có chứng cứ mà không dẫn được nguồn nào bị đếm vào mẫu số", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ retrieved_docs: ["food:a"], cited_docs: ["food:a"] })] }),
      record({ id: "GS-002", turns: [turn({ retrieved_docs: ["food:a"], cited_docs: [] })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.answered_with_evidence).toBe(2);
    expect(scores.cited_answer_rate).toBe(0.5);
    expect(scores.rows.map((row) => row.id)).toEqual(["GS-002"]);
  });

  it("lượt không có chứng cứ không kéo tỷ lệ dẫn nguồn xuống", () => {
    const rows = [record({ turns: [turn({ contexts: [], retrieved_docs: [], cited_docs: [] })] })];
    expect(scoreGrounding(rows).answered_with_evidence).toBe(0);
    expect(scoreGrounding(rows).cited_answer_rate).toBe(0);
  });

  it("dữ kiện số không kiểm được tính trên lượt CÓ trả lời", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ unsupported_facts: ["35°C"] })] }),
      record({ id: "GS-002", turns: [turn()] }),
      record({ id: "GS-003", turns: [turn({ reply: "", unsupported_facts: [] })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.answered).toBe(2);
    expect(scores.unsupported_fact_rate).toBe(0.5);
  });

  /**
   * `tool_failure_rate` đọc trục TOOL, không đọc trục căn cứ. Hai trục đã tách ở
   * `server/domain/agents/grounding.ts`, và bài này chốt rằng bộ đo đi theo đúng trục ấy: một
   * lượt `no_source` vì kho tri thức rỗng không được tính là một sự cố nhà cung cấp.
   */
  it("tool hỏng được đếm riêng, không lẫn vào thiếu nguồn", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ grounding: "tool_failed", tool_status: "failed" })] }),
      record({ id: "GS-002", turns: [turn({ grounding: "no_source", tool_status: "not_used" })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.tool_failure_rate).toBe(0.5);
    expect(scores.statuses.tool_failed).toBe(1);
    expect(scores.statuses.no_source).toBe(1);
  });

  it("tool chập nhưng câu trả lời vẫn đứng vững -> degraded, không phải failed", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ grounding: "grounded", tool_status: "degraded" })] }),
      record({ id: "GS-002", turns: [turn({ grounding: "grounded", tool_status: "ok" })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.tool_failure_rate).toBe(0);
    expect(scores.tool_degraded_rate).toBe(0.5);
  });

  /**
   * Độ phủ cộng dồn theo CÂU. Bài này chốt đúng chỗ dễ làm sai nhất: lấy trung bình của trung
   * bình sẽ ra 0,75 cho cặp dưới đây (1,0 và 0,5), trong khi thực tế chỉ 6/11 câu được phủ.
   */
  it("độ phủ trích dẫn cộng dồn theo câu, không lấy trung bình của trung bình", () => {
    const rows = [
      record({ id: "GS-001", turns: [turn({ sentences: 1, covered_sentences: 1 })] }),
      record({ id: "GS-002", turns: [turn({ sentences: 10, covered_sentences: 5 })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.covered_sentence_rows).toBe(11);
    expect(scores.citation_coverage).toBeCloseTo(6 / 11, 6);
  });

  it("ý khai không có nguồn và câu mang số không dẫn nguồn được đếm riêng nhau", () => {
    const rows = [
      record({
        id: "GS-001",
        turns: [turn({ claims: 4, uncited_claims: 1, uncovered_important: ["Vé 50.000đ"] })],
      }),
      record({ id: "GS-002", turns: [turn({ claims: 4, uncited_claims: 0 })] }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.claim_rows).toBe(8);
    expect(scores.uncited_claim_rate).toBe(1 / 8);
    expect(scores.uncovered_important_rate).toBe(0.5);
  });

  it("không có ý nào được khai thì hai chỉ số phủ bằng 0, không phải NaN", () => {
    const scores = scoreGrounding([record({ turns: [turn({ claims: 0, sentences: 0, covered_sentences: 0 })] })]);
    expect(scores.citation_coverage).toBe(0);
    expect(scores.uncited_claim_rate).toBe(0);
  });

  it("độ chính xác nguồn được dẫn bỏ qua kịch bản từ chối", () => {
    const rows = [
      record({ id: "GS-001", expected_docs: ["food:a"], turns: [turn({ cited_docs: ["food:a", "food:x"] })] }),
      record({
        id: "GS-026", kind: "refusal", group: "out_of_scope", out_of_scope: true, expected_docs: [],
        expected_escalation_reason: "OUT_OF_SCOPE", turns: [turn({ cited_docs: [] })],
      }),
    ];
    const scores = scoreGrounding(rows);
    expect(scores.citation_rows).toBe(2);
    expect(scores.citation_precision).toBe(0.5);
  });
});

describe("KE-50: ba nhóm điểm phán quyết riêng", () => {
  /** Không đặt biến môi trường nào: mỗi luật dùng đúng `fallback` của chính nó. */
  const thresholds = readThresholds({});

  /**
   * Đây là nguyên tắc mà cách chia nhóm sinh ra để bảo vệ: một câu trả lời trôi chảy, bám ngữ
   * cảnh, điểm RAGAS đẹp, nhưng KHÔNG hoàn thành việc khách nhờ thì cổng vẫn phải FAIL. Gộp mọi
   * luật vào một con số duy nhất thì bốn điểm RAGAS cao đủ sức che một tỷ lệ hoàn thành tệ.
   */
  it("nhóm căn cứ đạt nhưng nhóm nhiệm vụ trượt thì cổng vẫn FAIL", () => {
    const rows = [
      // Trả lời tốt, dẫn nguồn đầy đủ...
      record({ id: "GS-001", turns: [turn({ cited_docs: ["food:a"], retrieved_docs: ["food:a"] })] }),
      // ...nhưng hội thoại đánh rơi slot khách đã nói.
      record({
        id: "GS-002", kind: "conversation", expected_docs: [],
        turns: [
          turn({ index: 0, message: "Đi 3 ngày", expected_slots: { days: 3 }, slots: { days: 3 } }),
          turn({ index: 1, message: "4 người", expected_slots: { days: 3, travelers: 4 }, slots: { travelers: 4 } }),
        ],
      }),
    ];
    const report = buildReport(rows, null, thresholds, { k: 5 });
    const summary = formatSummary(report, rows, { k: 5 });

    expect(summary).toContain("Ba nhóm điểm");
    // Slot `days` biến mất ở lượt hai, nên nhóm nhiệm vụ phải trượt.
    expect(report.values["conversation.slot_retention_rate"]).toBeLessThan(1);
    expect(report.gate.passed).toBe(false);
  });

  it("nhóm không còn luật nào quyết định thì báo 'chưa đo', không báo PASS", () => {
    const rows = [record({ id: "GS-001" })];
    // `EVAL_GATE_OFF` tắt hẳn một luật: nó vẫn hiện trong bảng nhưng không quyết định PASS/FAIL.
    const off = readThresholds({
      EVAL_GATE_OFF: GATE_RULES.filter((rule) => rule.key.startsWith("retrieval."))
        .map((rule) => rule.key)
        .join(","),
    });
    const report = buildReport(rows, null, off, { k: 5 });
    const summary = formatSummary(report, rows, { k: 5 });
    const line = summary.split("\n").find((row) => row.startsWith("| Chất lượng truy xuất"));
    expect(line).toContain("chưa đo");
  });
});
