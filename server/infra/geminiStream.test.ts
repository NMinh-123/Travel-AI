import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Giả lập SDK Ở TẦNG `@google/genai`, không phải bằng `vi.spyOn(gemini, ...)`.
 *
 * Bản đầu của file này spy lên chính `getGeminiClient` và spy đó KHÔNG có tác dụng: ESM nối lời
 * gọi nội bộ trong cùng một module thẳng vào hàm gốc, nên `generateStructuredStream` vẫn gọi bản
 * thật — và bộ test bắn request thật ra điểm cuối Gemini. Chặn ở tầng SDK thì đường đi qua
 * `getGeminiClient` được chạy y như thật, chỉ có socket là không tồn tại.
 *
 * `vi.hoisted` cần thiết vì factory của `vi.mock` được nâng lên trước mọi import, nên hàng đợi
 * chunk phải tồn tại từ trước đó. Cùng lý do với khoá API: `config.ts` đọc `process.env` ngay lúc
 * nạp module, và bộ test không được phụ thuộc vào việc máy chạy nó có `.env` hay không.
 */
const { generateContentStream, queue } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "offline-test-key";

  const queue: string[][] = [];
  const generateContentStream = vi.fn(async () => {
    const chunks = queue.shift() ?? [];
    return (async function* () {
      for (const text of chunks) yield { text };
      yield { text: "", usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22 } };
    })();
  });
  return { generateContentStream, queue };
});

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return { ...actual, GoogleGenAI: class { models = { generateContentStream }; } };
});

const { generateStructuredStream, partialReplyText } = await import("./gemini");

/**
 * Bộ trích `reply` từ JSON dở dang là mảnh ghép duy nhất khiến streaming token chạy được trên
 * một hệ thống mà mọi lượt gọi đều đặt `responseSchema`. Nó cũng là chỗ dễ sai nhất, vì mọi lỗi
 * ở đây đều biểu hiện thành chữ méo trên màn hình khách chứ không thành exception.
 */
describe("partialReplyText: rút câu trả lời từ JSON chưa hoàn chỉnh", () => {
  it("chưa thấy khoá reply thì chưa đẩy chữ nào ra", () => {
    for (const raw of ["", "{", '{"sugg', '{"suggestions": ["a"], "rep']) {
      expect(partialReplyText(raw)).toBe("");
    }
  });

  it("đẩy đúng phần chuỗi đã nhận, không kèm dấu ngoặc hay tên trường", () => {
    expect(partialReplyText('{"reply": "Hà Gi')).toBe("Hà Gi");
    expect(partialReplyText('{"reply": "Hà Giang có đèo Mã Pí Lèng')).toBe("Hà Giang có đèo Mã Pí Lèng");
  });

  it("dừng ở dấu nháy đóng, không nuốt sang trường kế tiếp", () => {
    expect(partialReplyText('{"reply": "Xong rồi.", "suggestions": ["Hỏi tiếp?"]}')).toBe("Xong rồi.");
  });

  it("chuỗi thoát được giải mã, không đẩy ra hai ký tự thô", () => {
    expect(partialReplyText('{"reply": "Ngày 1:\\n- Quản Bạ')).toBe("Ngày 1:\n- Quản Bạ");
    expect(partialReplyText('{"reply": "Khách nói \\"đi thôi\\"')).toBe('Khách nói "đi thôi"');
    expect(partialReplyText('{"reply": "100\\u0025')).toBe("100%");
  });

  it("giữ lại chuỗi thoát chưa đủ ký tự thay vì đẩy ra nửa vời", () => {
    // Một `\` lẻ ở cuối buffer chưa nói được nó sắp thành `\n` hay `\"`.
    expect(partialReplyText('{"reply": "Ngày 1:\\')).toBe("Ngày 1:");
    // `\uXXXX` mới về hai chữ số.
    expect(partialReplyText('{"reply": "giá \\u00')).toBe("giá ");
  });

  it("chuỗi đẩy ra luôn là tiền tố của chuỗi ở bước sau", () => {
    // Bất biến mà `generateStructuredStream` dựa vào để tính phần delta. Mất nó thì client hoặc
    // mất chữ, hoặc nhận lại cả đoạn đã hiện.
    const full = '{"reply": "Mã Pí Lèng dài 20 km.\\nĐèo có bốn khúc cua lớn.", "suggestions": []}';
    let previous = "";
    for (let cut = 1; cut <= full.length; cut += 1) {
      const shown = partialReplyText(full.slice(0, cut));
      expect(shown.startsWith(previous)).toBe(true);
      previous = shown;
    }
    expect(previous).toBe("Mã Pí Lèng dài 20 km.\nĐèo có bốn khúc cua lớn.");
  });

  it("bỏ rào markdown mà model hay bọc quanh JSON", () => {
    expect(partialReplyText('```json\n{"reply": "Có ạ')).toBe("Có ạ");
    expect(partialReplyText('```\n{"reply": "Có ạ')).toBe("Có ạ");
  });

  it("văn xuôi trần thì chính nó là câu trả lời", () => {
    // Điểm cuối bỏ qua responseMimeType — cùng tình huống mà `recoverProseReply` cứu ở cuối lượt.
    expect(partialReplyText("Hà Giang mùa này đẹp nhất")).toBe("Hà Giang mùa này đẹp nhất");
  });

  it("schema không có trường reply thì không đẩy gì ra", () => {
    // NLU. Đẩy chữ ở đây nghĩa là hiện kết quả phân loại ý định cho khách đọc.
    expect(partialReplyText('{"intent": "discovery", "confidence": 0.9}')).toBe("");
  });
});

/**
 * Ba điều chỉ `generateStructuredStream` đảm bảo được: thứ tự và tính không chồng lấn của các
 * đoạn delta, việc xoá chữ khi phải gọi lại, và việc hợp đồng trả về không đổi so với bản không
 * streaming.
 */
describe("generateStructuredStream", () => {
  const SCHEMA = {
    type: "OBJECT",
    properties: { reply: { type: "STRING" }, suggestions: { type: "ARRAY" } },
  } as never;

  async function run(attempts: string[][]) {
    queue.length = 0;
    queue.push(...attempts);

    const deltas: string[] = [];
    let resets = 0;
    const result = await generateStructuredStream<{ reply: string; suggestions: string[] }>({
      tier: "light",
      contents: "câu hỏi",
      schema: SCHEMA,
      onDelta: (text) => deltas.push(text),
      onReset: () => { resets += 1; },
    });
    return { deltas, resets, result };
  }

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Lưới an toàn: một lời gọi mạng lọt qua ở đây nghĩa là lớp giả lập đã hỏng.
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Test offline không được gọi mạng"); }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("các đoạn delta nối lại đúng bằng câu trả lời cuối, không lặp không sót", async () => {
    const { deltas, resets, result } = await run([[
      '{"reply": "Mã Pí', " Lèng dài", ' 20 km.", "sugg', 'estions": ["Còn gì nữa?"]}',
    ]]);

    expect(deltas.join("")).toBe("Mã Pí Lèng dài 20 km.");
    expect(resets).toBe(0);
    expect(result.data).toEqual({ reply: "Mã Pí Lèng dài 20 km.", suggestions: ["Còn gì nữa?"] });
    expect(result.metrics).toMatchObject({ promptTokens: 11, outputTokens: 22, retries: 0 });
  });

  it("gọi lại vì phản hồi không phải JSON thì xoá chữ của lượt hỏng trước", async () => {
    // Lượt đầu là văn xuôi quá ngắn để cứu nên phải làm lại; đoạn đã hiện phải biến mất trước khi
    // lượt sau ghi đè, nếu không khách đọc được hai bản nối đuôi nhau.
    const { deltas, resets, result } = await run([
      ["Không rõ."],
      ['{"reply": "Có phố cổ Đồng Văn.", "suggestions": []}'],
    ]);

    expect(resets).toBeGreaterThanOrEqual(1);
    expect(result.data).toEqual({ reply: "Có phố cổ Đồng Văn.", suggestions: [] });
    expect(result.metrics.retries).toBe(1);
    expect(deltas[deltas.length - 1]).toContain("Đồng Văn");
  });

  it("đầu ra đổi từ văn xuôi sang JSON giữa chừng: xoá rồi đẩy lại, không chắp vá", async () => {
    // Chunk đầu về một mình dấu cách nên bị đoán là văn xuôi; chunk sau lộ ra đây là JSON.
    const { deltas, resets, result } = await run([[" ", '{"reply": "Đúng rồi.", "suggestions": []}']]);

    expect(resets).toBeGreaterThanOrEqual(1);
    expect(deltas.join("")).toContain("Đúng rồi.");
    expect(result.data).toEqual({ reply: "Đúng rồi.", suggestions: [] });
  });

  it("điểm cuối trả văn xuôi dài: cứu nguyên văn làm câu trả lời, y như bản không streaming", async () => {
    const prose = "Đèo Mã Pí Lèng nằm trên quốc lộ 4C, nối Đồng Văn với Mèo Vạc, dài khoảng 20 km.";
    const { result } = await run([[prose], [prose], [prose]]);

    expect(result.data).toMatchObject({ reply: prose, suggestions: [] });
    expect(result.metrics.retries).toBe(2);
  });

  it("không truyền onDelta thì không đẩy gì, và kết quả vẫn y nguyên", async () => {
    queue.length = 0;
    queue.push(['{"reply": "Xong.", "suggestions": []}']);

    const result = await generateStructuredStream<{ reply: string }>({
      tier: "light", contents: "hỏi", schema: SCHEMA,
    });
    expect(result.data).toEqual({ reply: "Xong.", suggestions: [] });
  });
});
