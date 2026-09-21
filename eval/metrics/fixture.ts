import type { EvalRecord, TurnRecord } from "@eval/dataset";

/** Dựng bản ghi tối thiểu cho test: chỉ khai những trường bài test thực sự nói tới. */
export function turn(patch: Partial<TurnRecord> = {}): TurnRecord {
  return {
    index: 0, message: "câu hỏi", intent: "knowledge", confidence: 0.9, agent: "knowledge",
    slots: {}, expected_slots: null, asked_slot: null, escalated: false, escalation_reason: null,
    agent_error: false, grounding: "grounded", tool_status: "not_used", failure: "none",
    unsupported_facts: [],
    claims: 1, uncited_claims: 0, sentences: 1, covered_sentences: 1, important_sentences: 0,
    uncovered_important: [], latency_ms: 1000,
    prompt_tokens: 100, output_tokens: 50, retries: 0, retrieved_docs: [], cited_docs: [],
    reply: "câu trả lời", contexts: ["ngữ cảnh"], ...patch,
  };
}

export function record(patch: Partial<EvalRecord> = {}): EvalRecord {
  const turns = patch.turns ?? [turn()];
  return {
    id: "GS-001", kind: "qa", group: "food", split: "dev", variant: "clean", out_of_scope: false,
    question: turns[turns.length - 1].message, reference: "đáp án mẫu", expected_docs: ["food:a"],
    expected_intent: "knowledge", expected_escalation_reason: null, answer: "câu trả lời",
    contexts: ["ngữ cảnh"], ...patch, turns,
  };
}
