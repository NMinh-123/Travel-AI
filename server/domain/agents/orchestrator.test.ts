import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleTurn, type TurnDeps, type TurnInput } from "./orchestrator";
import type { AgentResult, NluResult } from "./types";
import { AiUnavailableError } from "@server/infra/gemini";
import { weatherFailureBlock } from "./specialists/knowledge";

const input: TurnInput = {
  now: new Date("2026-09-15T03:00:00Z"), sessionId: "offline", userId: null,
  message: "Đồng Văn có gì?", history: [], slots: {},
};
const answer: AgentResult = { reply: "Có phố cổ Đồng Văn.", grounding: "grounded", evidence: [], retrievedDocIds: ["doc-1"], citedDocIds: ["doc-1"], suggestions: [], calls: [] };
function fixture(nlu: Partial<NluResult> = {}, result: AgentResult = answer): TurnDeps {
  return {
    classify: vi.fn<TurnDeps["classify"]>(async () => ({ result: {
      intent: "knowledge", confidence: 0.9, entities: {}, temporalPhrases: [], wantsHuman: false, ...nlu,
    }, metrics: { model: "fixture", latencyMs: 0, retries: 0 } })),
    resolvePlaceNames: vi.fn(async () => ({ slugs: ["dong-van"], unknown: [] })),
    findPlacesInText: vi.fn(async () => []),
    runAgent: vi.fn(async () => result),
    runSupport: vi.fn(async (_context, reason) => ({ ...answer, citedDocIds: [], escalation: { reason, summary: "Chuyển tiếp" } })),
  };
}
const normal = ["nlu:ok", "temporal:none", "place_resolve:resolved", "route:agent", "slot_gate:complete", "agent:ok"];
const sequence = (outcome: Awaited<ReturnType<typeof handleTurn>>): string[] => outcome.trace.path.map(({ node, outcome }) => `${node}:${outcome}`);

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Test offline không được gọi mạng"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("KE-14…KE-20: đường đi thật với phụ thuộc ra ngoài được giả lập", () => {
  it("tri thức có căn cứ; giữ nguyên trường trace cũ", async () => {
    const deps = fixture();
    const out = await handleTurn(input, deps);
    expect(sequence(out)).toEqual([...normal, "guardrail:pass", "respond:ok"]);
    expect(out.trace).toMatchObject({ intent: "knowledge", confidence: 0.9, agent: "knowledge", grounding: "grounded", citedDocIds: ["doc-1"], retrievedDocIds: ["doc-1"], unsupportedFacts: [], escalated: false, calls: [{ model: "fixture", latencyMs: 0, retries: 0 }] });
    for (const key of ["totalMs", "agentMs", "nluMs"] as const) expect(out.trace[key]).toBeGreaterThanOrEqual(0);
    expect(deps.runSupport).not.toHaveBeenCalled();
    expect(deps.runAgent).toHaveBeenCalledWith("knowledge", expect.objectContaining({ placeSlugs: ["dong-van"] }));
  });
  it("ngoài địa bàn: chuyển tiếp trước slot gate và guardrail", async () => {
    const deps = fixture();
    deps.resolvePlaceNames = vi.fn(async () => ({ slugs: [], unknown: [] }));
    const out = await handleTurn({ ...input, message: "chợ phiên Bắc Hà họp ngày nào" }, deps);
    expect(sequence(out)).toEqual(["nlu:ok", "temporal:none", "place_resolve:out_of_area", "route:forced_escalation", "agent:ok", "escalate:ok"]);
    expect(out.trace.path[3]).toMatchObject({ reason: "OUT_OF_SCOPE", detail: "support" });
    expect(deps.runAgent).not.toHaveBeenCalled();
  });
  /**
   * Mảng `destinations` của NLU chứa cả cụm danh từ chung, không riêng tên riêng. Coi mọi tên
   * không tra được là "địa danh ngoài địa bàn" đã khiến ba kịch bản holdout bị chuyển tiếp trước
   * khi truy xuất kịp chạy, dù tài liệu trả lời đúng nằm sẵn trong kho.
   */
  it("cụm danh từ chung không tra được KHÔNG phải cớ để chuyển tiếp", async () => {
    const deps = fixture();
    deps.resolvePlaceNames = vi.fn(async () => ({ slugs: [], unknown: ["Chợ phiên vùng cao"] }));
    const out = await handleTurn({ ...input, message: "Chợ phiên vùng cao họp theo lịch nào?" }, deps);
    expect(sequence(out)).toEqual([
      "nlu:ok", "temporal:none", "place_resolve:empty", "route:agent",
      "slot_gate:complete", "agent:ok", "guardrail:pass", "respond:ok",
    ]);
    expect(deps.runSupport).not.toHaveBeenCalled();
    // Không tra được địa danh nào thì truy xuất chạy KHÔNG lọc địa danh, chứ không bỏ cuộc.
    expect(deps.runAgent).toHaveBeenCalledWith("knowledge", expect.objectContaining({ placeSlugs: [] }));
  });

  /**
   * Nhãn `support` khi khách không xin gặp người chỉ là phỏng đoán giọng điệu. GS-116 của bộ vàng
   * — "Có người rơi xuống vực thì gọi số nào?" — bị gán nhãn ấy và nhận về một câu chuyển tiếp,
   * trong khi tài liệu số khẩn cấp nằm sẵn ở hạng 1.
   */
  it("NLU đoán support mà khách không xin gặp người: tra kho trước, trả lời được thì trả lời", async () => {
    const deps = fixture({ intent: "support" });
    const out = await handleTurn({ ...input, message: "Có người rơi xuống vực thì gọi số nào?" }, deps);
    expect(deps.runAgent).toHaveBeenCalledWith("knowledge", expect.anything());
    expect(deps.runSupport).not.toHaveBeenCalled();
    expect(out.trace.escalated).toBe(false);
    expect(out.trace.path[3]).toMatchObject({ node: "route", detail: "knowledge" });
  });

  it("khiếu nại thật vẫn về tác tử hỗ trợ, và giữ đúng lý do COMPLAINT", async () => {
    const deps = fixture(
      { intent: "support" },
      { ...answer, reply: "Không có căn cứ", grounding: "insufficient", citedDocIds: [], retrievedDocIds: [] },
    );
    const out = await handleTurn({ ...input, message: "Tôi bị trừ tiền hai lần" }, deps);
    expect(deps.runSupport).toHaveBeenCalledWith(expect.anything(), "COMPLAINT");
    expect(out.trace.escalated).toBe(true);
  });

  /**
   * GS-201: khách hỏi về phố cổ Đồng Văn rồi hỏi tiếp "Ở đó ăn sáng thì nên ăn gì?". NLU mang địa
   * danh của lượt trước sang `entities`, nên điều kiện cũ `placeSlugs.length === 0` không còn
   * đúng và đại từ KHÔNG được thay — câu đưa đi nhúng vẫn là "Ở đó ...", không có tên nơi nào.
   * Đo được: truy xuất khi đó trả về Cổng Trời Quản Bạ và quần áo theo mùa; ghép tên nơi vào thì
   * ra đúng tài liệu bánh cuốn Đồng Văn.
   */
  it("đại từ được thay bằng tên nơi, kể cả khi NLU đã mang địa danh sang từ lượt trước", async () => {
    const deps = fixture({ entities: { destinations: ["Phố cổ Đồng Văn"] } });
    deps.resolvePlaceNames = vi.fn(async () => ({ slugs: ["pho-co-dong-van"], unknown: [] }));
    // Câu chữ KHÔNG nêu nơi nào — chỉ có đại từ.
    deps.findPlacesInText = vi.fn(async () => []);

    await handleTurn({ ...input, message: "Ở đó ăn sáng thì nên ăn gì?" }, deps);

    const context = (deps.runAgent as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(context.retrievalQuery).toContain("Phố cổ Đồng Văn");
  });

  it("câu tự nêu tên nơi thì KHÔNG ghép thêm, tên mới thắng", async () => {
    const deps = fixture({ entities: { destinations: ["Mèo Vạc"] } });
    deps.resolvePlaceNames = vi.fn(async () => ({ slugs: ["meo-vac"], unknown: [] }));
    deps.findPlacesInText = vi.fn(async () => ["meo-vac"]);

    await handleTurn({ ...input, message: "Mèo Vạc ăn sáng thì nên ăn gì?" }, deps);

    const context = (deps.runAgent as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(context.retrievalQuery).toBe("Mèo Vạc ăn sáng thì nên ăn gì?");
  });

  /**
   * GS-186 và GS-200: với đúng lịch sử của chúng, NLU trả độ tin cậy 0,40–0,45 ở cả ba lần chạy và
   * nhãn lật giữa `support` với `itinerary`. Model không sai khi thiếu tự tin — câu tách khỏi ngữ
   * cảnh thì thật sự mơ hồ. Nhưng `extractSlots` đọc được `travelMode: easy_rider` từ chính câu
   * đó bằng regex, nên chuyển tiếp nó là chuyển tiếp một lượt mà ta vừa hiểu.
   */
  it("lượt sửa lại việc đang làm dở không bị chuyển tiếp vì độ tin cậy thấp", async () => {
    const deps = fixture({ intent: "support", confidence: 0.4 });

    const out = await handleTurn(
      { ...input, message: "À cho mình thuê người lái thôi", previousIntent: "itinerary", slots: { days: 3 } },
      deps,
    );

    expect(deps.runSupport).not.toHaveBeenCalled();
    expect(out.trace.escalated).toBe(false);
    // Tiếp tục ĐÚNG việc đang làm, không nhảy sang nhãn mà NLU vừa đoán.
    expect(deps.runAgent).toHaveBeenCalledWith("itinerary", expect.anything());
  });

  it("câu cụt KHÔNG bổ sung gì thì vẫn chuyển tiếp như cũ", async () => {
    const deps = fixture({ intent: "support", confidence: 0.4 });

    const out = await handleTurn(
      { ...input, message: "ừ", previousIntent: "itinerary", slots: { days: 3 } },
      deps,
    );

    expect(out.trace.path[3]).toMatchObject({ reason: "LOW_CONFIDENCE" });
  });

  it("chưa có việc đang làm dở thì độ tin cậy thấp vẫn chuyển tiếp", async () => {
    const deps = fixture({ intent: "support", confidence: 0.4 });

    const out = await handleTurn({ ...input, message: "đi 3 ngày bằng xe máy" }, deps);

    expect(out.trace.path[3]).toMatchObject({ reason: "LOW_CONFIDENCE" });
  });

  /**
   * Chuyển tiếp vì guardrail chặn KHÔNG được xoá dấu vết truy xuất. Bốn chỉ số của bộ đo — tỷ lệ
   * truy xuất rỗng, Recall@k, hit@1, MRR — đọc `trace.evidence`, nên mất nó là chúng đo tỉ lệ
   * chuyển tiếp thay vì đo chất lượng truy xuất. Đo ngày 2026-09-23: GS-035 và GS-134 bị ghi
   * truy xuất rỗng, trong khi chạy lại đúng câu hỏi thì tài liệu kỳ vọng nằm hạng 1.
   */
  it("guardrail chặn: vẫn giữ chứng cứ đã truy xuất, nhưng bỏ trích dẫn của câu bị vứt", async () => {
    const blocked: AgentResult = {
      ...answer,
      reply: "Không có căn cứ",
      grounding: "insufficient",
      evidence: [{ id: "K1", kind: "knowledge", label: "Phố cổ", text: "...", sourceRef: "attraction:pho-co", docId: "doc-1" }],
      retrievedDocIds: ["doc-1"],
      citedDocIds: ["doc-1"],
    };
    const deps = fixture({}, blocked);

    const out = await handleTurn(input, deps);

    expect(out.trace.escalated).toBe(true);
    expect(out.trace.retrievedDocIds).toEqual(["doc-1"]);
    expect(out.trace.evidence).toHaveLength(1);
    // Trích dẫn thuộc về câu trả lời vừa bị vứt, nên KHÔNG được ghi công.
    expect(out.trace.citedDocIds).toEqual([]);
  });

  /**
   * Lý do tất định đứng trước lý do do model đoán. GS-163 ("Chợ tình Sa Pa họp vào tối nào?", độ
   * tin cậy 0,4) từng bị chuyển tiếp với LOW_CONFIDENCE — nhân viên đọc bản ghi sẽ tưởng hệ thống
   * không hiểu câu, trong khi nó hiểu đúng và câu hỏi là về Lào Cai.
   */
  it("ngoài địa bàn và độ tin cậy thấp cùng lúc: lý do ghi là OUT_OF_SCOPE", async () => {
    const deps = fixture({ confidence: 0.4 });
    deps.resolvePlaceNames = vi.fn(async () => ({ slugs: [], unknown: [] }));

    const out = await handleTurn({ ...input, message: "Chợ tình Sa Pa họp vào tối nào?" }, deps);

    expect(out.trace.path[3]).toMatchObject({ outcome: "forced_escalation", reason: "OUT_OF_SCOPE" });
  });

  /**
   * GS-189 ("Bớt còn 4 người"): nhãn `support` với độ tin cậy ≥ 0,5 nên quy tắc cũ — chỉ xét độ tin
   * cậy — bỏ qua, và lượt ấy rơi sang nhánh tra kho, không tìm được gì về "bớt người", rồi bị
   * chuyển tiếp.
   */
  it("nhãn support cho một lượt sửa việc đang làm dở: tiếp tục việc đó, không đi tra kho", async () => {
    const deps = fixture({ intent: "support", confidence: 0.9 });

    await handleTurn(
      { ...input, message: "Bớt còn 4 người", previousIntent: "budget", slots: { days: 3, travelers: 5 } },
      deps,
    );

    expect(deps.runAgent).toHaveBeenCalledWith("budget", expect.anything());
  });

  it("nhãn TỰ TIN khác support thì KHÔNG bị ghi đè bởi việc đang làm dở", async () => {
    const deps = fixture({ intent: "knowledge", confidence: 0.9 });

    await handleTurn(
      { ...input, message: "Đi ô tô chụp ảnh ở đâu đẹp?", previousIntent: "itinerary", slots: { days: 3 } },
      deps,
    );

    expect(deps.runAgent).toHaveBeenCalledWith("knowledge", expect.anything());
  });

  it.each([
    { confidence: 0.2, wantsHuman: false, reason: "LOW_CONFIDENCE" },
    { confidence: 0.2, wantsHuman: true, reason: "USER_REQUEST" },
  ])("chuyển tiếp $reason, giữ ưu tiên hiện tại", async ({ confidence, wantsHuman, reason }) => {
    const deps = fixture({ confidence, wantsHuman });
    const out = await handleTurn(input, deps);
    expect(sequence(out)).toEqual(["nlu:ok", "temporal:none", "place_resolve:resolved", "route:forced_escalation", "agent:ok", "escalate:ok"]);
    expect(out.trace.path[3].reason).toBe(reason);
    expect(out.trace.path.at(-1)?.reason).toBe(reason);
    expect(deps.runAgent).not.toHaveBeenCalled();
  });
  it("lịch trình thiếu days chỉ hỏi slot", async () => {
    const deps = fixture({ intent: "itinerary" });
    const out = await handleTurn({ ...input, message: "lên lịch trình giúp mình" }, deps);
    expect(sequence(out)).toEqual([...normal.slice(0, 4), "slot_gate:ask", "respond:ok"]);
    expect(out.trace.path[4].detail).toBe("days");
    expect(out.result.reply).toContain("ngày");
    expect(deps.runAgent).not.toHaveBeenCalled();
  });
  it("hỏi giá thiếu days vẫn chạy tác tử budget, không hỏi ngược", async () => {
    const deps = fixture({ intent: "budget" });
    const out = await handleTurn({ ...input, message: "giá chỗ nghỉ ở Mèo Vạc" }, deps);
    expect(deps.runAgent).toHaveBeenCalledWith("budget", expect.anything());
    expect(sequence(out)).not.toContain("slot_gate:ask");
  });
  it("tool lỗi và lần thử sau giữ đúng thứ tự, mã lỗi", async () => {
    const out = await handleTurn(input, fixture({}, { ...answer, toolCalls: [
      { tool: "getWeather", outcome: "failed", code: "TIMEOUT" },
      { tool: "getWeather", outcome: "ok" },
    ] }));
    expect(sequence(out)).toEqual([...normal, "tool:failed", "tool:ok", "guardrail:pass", "respond:ok"]);
    expect(out.trace.path[6]).toEqual({ node: "tool", outcome: "failed", detail: "getWeather", reason: "TIMEOUT" });
  });
  it.each([
    { reply: "", grounding: "grounded", reason: "empty", escalation: "COMPLAINT" },
    { reply: "Thông tin thiếu nguồn", grounding: "no_source", reason: "insufficient", escalation: "OUT_OF_SCOPE" },
    { reply: "Nguồn có nhưng không dẫn được", grounding: "insufficient", reason: "insufficient", escalation: "OUT_OF_SCOPE" },
    { reply: "Phòng giá 9.999.999đ", grounding: "unsupported", reason: "unsupported", escalation: "OUT_OF_SCOPE" },
    { reply: "Liên hệ __PHONE_1__", grounding: "grounded", reason: "pii_leak", escalation: "COMPLAINT" },
  ] as const)("guardrail $reason lưu lý do trước fallback", async ({ reply, grounding, reason, escalation }) => {
    const out = await handleTurn(input, fixture({}, { ...answer, reply, grounding }));
    expect(sequence(out)).toEqual([...normal, "guardrail:block", "agent:ok", "escalate:ok"]);
    expect(out.trace.path[6].reason).toBe(reason);
    expect(out.trace.path.at(-1)?.reason).toBe(escalation);
  });
  it("lỗi tác tử ghi mã an toàn và chạy fallback hiện có", async () => {
    const deps = fixture();
    deps.runAgent = vi.fn(async () => { throw new Error("URL bí mật không được vào trace"); });
    const out = await handleTurn(input, deps);
    expect(sequence(out)).toEqual([...normal.slice(0, 5), "agent:threw", "agent:ok", "guardrail:pass", "escalate:ok"]);
    // Một lỗi không nhận ra được xếp vào `unknown`, KHÔNG đoán bừa một nhóm: đoán bừa sẽ làm bẩn
    // đúng những con số mà việc phân loại sinh ra để giữ sạch.
    expect(out.trace.path[5].reason).toBe("AGENT_ERROR:unknown");
    expect(out.trace.failure).toBe("unknown");
    expect(JSON.stringify(out.trace)).not.toContain("bí mật");
  });

  /**
   * Bốn nguyên nhân hỏng đều biểu hiện y hệt nhau với khách — một câu "mình chưa xử lý được" — và
   * trước đây cũng đọng lại y hệt nhau trong trace. Chúng do bốn người khác nhau xử lý, nên trace
   * phải gọi được tên chúng.
   */
  it("phân loại được nguyên nhân hỏng theo hình dạng lỗi", async () => {
    const cases: [Error & { code?: string }, string][] = [
      [Object.assign(new Error("connection closed"), { code: "P1001" }), "database"],
      [Object.assign(new Error("hỏng"), { name: "EmbeddingError" }), "embedding"],
      [new Error("sidecar embedding chưa sẵn sàng"), "embedding"],
      [new Error("gemini trả về 429"), "model"],
    ];
    for (const [error, expected] of cases) {
      const deps = fixture();
      deps.runAgent = vi.fn(async () => { throw error; });
      const out = await handleTurn(input, deps);
      expect(out.trace.failure, error.message).toBe(expected);
    }
  });
  it("thiếu khoá vẫn nổi lên thành AiUnavailableError", async () => {
    const deps = fixture();
    deps.runAgent = vi.fn(async () => { throw new AiUnavailableError(); });
    await expect(handleTurn(input, deps)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(deps.runSupport).not.toHaveBeenCalled();
  });
  it("quy đổi thời gian và gộp slot chạy thật", async () => {
    const deps = fixture();
    const out = await handleTurn({ ...input, message: "Đồng Văn tháng 11 có gì?", slots: { travelers: 2 } }, deps);
    expect(out.trace.path[1]).toMatchObject({ outcome: "resolved", detail: "month" });
    expect(out.slots).toMatchObject({ travelers: 2, temporal: { travelMonth: 11, travelYear: 2026 } });
  });
});

it("KE-21: chỉ dẫn tool lỗi nói rõ chưa tra được, không sinh số", () => {
  const block = weatherFailureBlock("TIMEOUT");
  expect(block).toContain("hiện chưa tra được thời tiết");
  expect(block).toContain("đừng suy đoán bất kỳ con số nào");
  expect(block).toContain("TIMEOUT");
  expect(block).not.toMatch(/\d/);
});

describe("KE-21: đại từ thay địa danh không làm mất bộ lọc", () => {
  /**
   * Hai nguồn phân giải địa danh đều chỉ đọc CÂU HIỆN TẠI, nên một lượt chỉ dùng đại từ từng ra
   * danh sách rỗng — và truy xuất khi đó mất hẳn bộ lọc, trả về đoạn của bất kỳ nơi nào trong
   * tỉnh. Khách hỏi tiếp về phố cổ Đồng Văn và nhận câu trả lời về Mèo Vạc.
   */
  it("mang địa danh từ slot sang khi lượt này chỉ nói 'ở đó'", async () => {
    const deps = fixture();
    deps.findPlacesInText = vi.fn(async () => []);
    deps.resolvePlaceNames = vi.fn(async (names: string[]) => ({
      slugs: names.length ? ["dong-van"] : [],
      unknown: [],
    }));

    const out = await handleTurn(
      { ...input, message: "Ở đó ăn sáng thì nên ăn gì?", slots: { destinations: ["Đồng Văn"] } },
      deps,
    );
    const node = out.trace.path.find((row) => row.node === "rewrite");
    expect(node?.detail).toContain("anaphora");
    expect(node?.reason).toBe("Đồng Văn");
  });

  it("lượt tự nêu địa danh thì KHÔNG mang gì sang, tên mới thắng", async () => {
    const deps = fixture();
    deps.findPlacesInText = vi.fn(async () => ["meo-vac"]);

    const out = await handleTurn(
      { ...input, message: "Còn ở đó thì sao, Mèo Vạc ấy?", slots: { destinations: ["Đồng Văn"] } },
      deps,
    );
    const node = out.trace.path.find((row) => row.node === "rewrite");
    expect(node?.detail ?? "").not.toContain("anaphora");
  });

  it("tên viết sai được sửa TRƯỚC khi quét địa danh", async () => {
    const deps = fixture();
    const scan = vi.fn(async () => ["ma-pi-leng"]);
    deps.findPlacesInText = scan;

    await handleTurn({ ...input, message: "Mã Pì Lèng có nguy hiểm không?" }, deps);
    // Bộ quét phải nhận được bản đã sửa dấu, không phải chữ khách gõ.
    expect(scan).toHaveBeenCalledWith(expect.stringContaining("Mã Pí Lèng"));
  });
});
