import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleTurn, type TurnDeps, type TurnInput } from "./orchestrator";
import type { AgentContext, AgentResult, NluResult, TurnEvent } from "./types";

/**
 * Hợp đồng streaming ở tầng điều phối.
 *
 * Phần khó của streaming trong hệ này không phải là đẩy chữ đi — mà là điều gì xảy ra khi chữ đã
 * ra màn hình rồi guardrail mới chặn nó. Các ca dưới đây khoá đúng chỗ đó lại: một câu trả lời bị
 * loại KHÔNG được đứng lại trên màn hình, và câu thay thế KHÔNG được nối vào sau nó.
 */
const input: TurnInput = {
  now: new Date("2026-09-15T03:00:00Z"), sessionId: "offline", userId: null,
  message: "Đồng Văn có gì?", history: [], slots: {},
};

const answer: AgentResult = {
  reply: "Có phố cổ Đồng Văn.", grounding: "grounded", evidence: [],
  retrievedDocIds: ["doc-1"], citedDocIds: ["doc-1"], suggestions: [], calls: [],
};

/**
 * Tác tử giả lập có stream: đẩy chữ qua `context.stream` y như tác tử thật, rồi trả về kết quả.
 * Đây là điểm mấu chốt — nếu orchestrator trao kênh stream cho lượt gọi dự phòng thì ca kiểm thử
 * bên dưới sẽ thấy chữ của câu chuyển tiếp nối vào sau câu đã bị chặn.
 */
function talkative(result: AgentResult, says = "Giá phòng khoảng 9.999.999đ") {
  return async (_intent: unknown, context: AgentContext): Promise<AgentResult> => {
    for (const piece of says.match(/.{1,6}/g) ?? []) context.stream?.delta(piece);
    return result;
  };
}

function fixture(result: AgentResult = answer, nlu: Partial<NluResult> = {}): TurnDeps {
  return {
    classify: vi.fn<TurnDeps["classify"]>(async () => ({
      result: { intent: "knowledge", confidence: 0.9, entities: {}, temporalPhrases: [], wantsHuman: false, ...nlu },
      metrics: { model: "fixture", latencyMs: 0, retries: 0 },
    })),
    resolvePlaceNames: vi.fn(async () => ({ slugs: ["dong-van"], unknown: [] })),
    findPlacesInText: vi.fn(async () => []),
    runAgent: vi.fn(talkative(result)),
    runSupport: vi.fn(async (context, reason) => {
      // Tác tử hỗ trợ cũng biết stream; nếu orchestrator trao kênh cho nó ở đường dự phòng thì
      // chữ này sẽ lọt ra và ca kiểm thử bắt được.
      context.stream?.delta("Mình chưa xử lý được yêu cầu này.");
      return { ...answer, citedDocIds: [], reply: "Mình chưa xử lý được yêu cầu này.",
        escalation: { reason, summary: "Chuyển tiếp" } };
    }),
  };
}

/** Chạy một lượt và gom lại toàn bộ sự kiện, kèm chuỗi chữ mà khách THỰC SỰ còn nhìn thấy. */
async function collect(deps: TurnDeps, turn: TurnInput = input) {
  const events: TurnEvent[] = [];
  const out = await handleTurn({ ...turn, onEvent: (event) => events.push(event) }, deps);

  // Dựng lại đúng cách client xử lý: `reset` xoá sạch, `delta` nối thêm.
  let visible = "";
  for (const event of events) {
    if (event.type === "reset") visible = "";
    if (event.type === "delta") visible += event.text;
  }
  return { events, out, visible, stages: events.filter((e) => e.type === "stage").map((e) => e.stage) };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Test offline không được gọi mạng"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("handleTurn có kênh sự kiện", () => {
  it("lượt trót lọt: báo tiến trình theo thứ tự rồi đẩy chữ, không xoá lần nào", async () => {
    const { visible, events, stages, out } = await collect(fixture());

    expect(stages).toEqual(["nlu", "route", "agent"]);
    expect(events.some((e) => e.type === "reset")).toBe(false);
    expect(visible).toBe("Giá phòng khoảng 9.999.999đ");
    // Chữ đã stream và kết quả thật phải là hai thứ độc lập: cái sau mới đi vào database.
    expect(out.result.reply).toBe("Có phố cổ Đồng Văn.");
  });

  it("guardrail chặn: xoá sạch chữ đã hiện, và câu chuyển tiếp KHÔNG nối vào sau", async () => {
    // Câu trả lời nêu con số không có trong chứng cứ — đúng ca mà streaming nguy hiểm nhất, vì
    // khách đã kịp đọc một cái giá bịa.
    const hallucinated: AgentResult = { ...answer, reply: "Phòng giá 9.999.999đ", grounding: "unsupported" };
    const deps = fixture(hallucinated);
    const { visible, events, out } = await collect(deps);

    expect(events.some((e) => e.type === "reset")).toBe(true);
    // Sau khi client xử lý xong toàn bộ luồng, màn hình phải trống — con số bịa đã biến mất và
    // câu chuyển tiếp không được stream vào chỗ của nó.
    expect(visible).toBe("");
    expect(out.agent).toBe("support");
    expect(out.result.reply).toContain("Mình chưa xử lý được yêu cầu này.");
    // Lượt gọi dự phòng phải nhận một ngữ cảnh KHÔNG có kênh stream.
    expect(deps.runSupport).toHaveBeenCalledWith(
      expect.objectContaining({ stream: undefined }), "OUT_OF_SCOPE",
    );
  });

  it("tác tử ném lỗi giữa chừng: chữ dở dang bị xoá trước khi chuyển tiếp", async () => {
    const deps = fixture();
    deps.runAgent = vi.fn(async (_intent, context: AgentContext) => {
      context.stream?.delta("Đang tra cứu thì");
      throw new Error("sidecar embedding không phản hồi");
    });

    const { visible, events, out } = await collect(deps);

    expect(events.some((e) => e.type === "reset")).toBe(true);
    expect(visible).toBe("");
    expect(out.agent).toBe("support");
  });

  it("chuyển tiếp bắt buộc: câu của tác tử hỗ trợ được stream, vì nó là câu trả lời chính", async () => {
    // Khách xin gặp người thật. Ở đường này không có câu nào bị loại trước đó, nên không có gì
    // phải xoá và chữ được đẩy đi bình thường.
    const deps = fixture(answer, { wantsHuman: true });
    const { visible, events, stages } = await collect(deps);

    expect(events.some((e) => e.type === "reset")).toBe(false);
    expect(stages).toEqual(["nlu", "agent"]);
    expect(visible).toBe("Mình chưa xử lý được yêu cầu này.");
  });

  it("hỏi bổ sung slot: không có lượt gọi model nào nên không có chữ nào chảy", async () => {
    const deps = fixture(answer, { intent: "itinerary" });
    const { visible, events, out } = await collect(deps, { ...input, message: "lên lịch giúp mình" });

    expect(events.filter((e) => e.type === "delta")).toHaveLength(0);
    expect(visible).toBe("");
    // Câu hỏi bổ sung vẫn về đủ trong kết quả — nó chỉ không đi qua đường streaming.
    expect(out.result.reply).toBeTruthy();
    expect(deps.runAgent).not.toHaveBeenCalled();
  });

  it("không truyền onEvent thì tác tử không nhận kênh stream, và lượt chạy y như cũ", async () => {
    const deps = fixture();
    const out = await handleTurn(input, deps);

    const [intent, context] = vi.mocked(deps.runAgent).mock.calls[0];
    expect(intent).toBe("knowledge");
    expect(context.stream).toBeUndefined();
    expect(out.result.reply).toBe("Có phố cổ Đồng Văn.");
  });
});
