import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MỘT NHỊP CHẬP CHỜN CỦA ĐIỂM CUỐI KHÔNG ĐƯỢC THÀNH MỘT LƯỢT CHAT CHẾT.
 *
 * Vòng lặp thử lại trong `gemini.ts` vốn chỉ phục vụ một kiểu hỏng — phản hồi không phân giải
 * được — còn lỗi HTTP thì ném thẳng ra ngoài. Ngày 2026-09-22, proxy đang dùng trả "Dịch vụ đang
 * quá tải" cho một lượt rồi chạy đúng ba lượt liền sau đó; với hợp đồng cũ, lượt ấy là một câu
 * hỏi mất trắng của khách, và ở bộ đánh giá là cả một lần chạy bị vứt đi.
 *
 * Giả lập ở tầng `@google/genai` vì lý do đã ghi trong geminiStream.test.ts: spy lên hàm của
 * chính module không chặn được lời gọi nội bộ, và bộ test sẽ bắn request thật ra mạng.
 */
const { generateContent, generateContentStream, queue } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "offline-test-key";

  /** Mỗi phần tử là một lượt gọi: `Error` thì ném, chuỗi thì trả về làm nội dung phản hồi. */
  const queue: (string | Error)[] = [];

  const next = (): string => {
    const item = queue.shift();
    if (item instanceof Error) throw item;
    return item ?? "";
  };

  const generateContent = vi.fn(async () => ({ text: next(), usageMetadata: {} }));

  const generateContentStream = vi.fn(async () => {
    const text = next();
    return (async function* () {
      yield { text };
      yield { text: "", usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22 } };
    })();
  });

  return { generateContent, generateContentStream, queue };
});

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return { ...actual, GoogleGenAI: class { models = { generateContent, generateContentStream }; } };
});

const { generateStructured, generateStructuredStream } = await import("./gemini");

const SCHEMA = { type: "OBJECT", properties: { reply: { type: "STRING" } } } as never;
const ANSWER = '{"reply": "Đèo Mã Pí Lèng dài khoảng 20 km."}';

/** Lỗi của SDK mang `status`; proxy gói lại thì mất `status` và chỉ còn câu chữ. */
function providerError(message: string, status?: number): Error {
  return Object.assign(new Error(message), status === undefined ? {} : { status });
}

/** Đúng hình dạng undici dựng khi kết nối hỏng: TypeError rỗng nghĩa, mã thật nằm ở `cause`. */
function networkError(code: string): Error {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error(`read ${code}`), { code }),
  });
}

describe("lỗi tạm thời của điểm cuối được thử lại", () => {
  beforeEach(() => {
    queue.length = 0;
    generateContent.mockClear();
    generateContentStream.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Test offline không được gọi mạng"); }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("lượt gọi có cấu trúc: 503 rồi thành công, khách vẫn nhận được câu trả lời", async () => {
    queue.push(providerError("The service is overloaded", 503), ANSWER);

    const result = await generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);

    expect(result.data).toEqual({ reply: "Đèo Mã Pí Lèng dài khoảng 20 km." });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("proxy làm mất status: nhận ra lỗi tạm thời qua câu chữ", async () => {
    queue.push(providerError("Dịch vụ đang quá tải, vui lòng thử lại sau."), ANSWER);

    const result = await generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);

    expect(result.data).not.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("streaming: đứt giữa chừng thì viết lại từ đầu, không dán hai mẩu vào nhau", async () => {
    queue.push(providerError("The service is overloaded", 503), ANSWER);

    const deltas: string[] = [];
    let resets = 0;
    const result = await generateStructuredStream<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
      onDelta: (text) => deltas.push(text),
      onReset: () => { resets += 1; },
    } as never);

    expect(result.data).toEqual({ reply: "Đèo Mã Pí Lèng dài khoảng 20 km." });
    expect(deltas.join("")).toBe("Đèo Mã Pí Lèng dài khoảng 20 km.");
    // Lượt hỏng chưa kịp đẩy chữ nào, nhưng lần thử sau vẫn phải mở đầu bằng một lần dọn khung.
    expect(resets).toBeGreaterThanOrEqual(1);
  });

  /**
   * Kết nối đứt không mang `status` và câu chữ chỉ là "fetch failed", nên với hợp đồng cũ nó rơi
   * vào nhánh vĩnh viễn và bị ném ngay. Ngày 2026-09-22 một `read ECONNRESET` như vậy giết một
   * lần chạy đánh giá 67 kịch bản ở ca thứ ba — trong khi đó đúng là kiểu hỏng mà lần gửi sau
   * thường đi lọt.
   */
  it("kết nối đứt giữa chừng được thử lại, không tính là lỗi vĩnh viễn", async () => {
    queue.push(networkError("ECONNRESET"), ANSWER);

    const result = await generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);

    expect(result.data).not.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("tên miền sai KHÔNG thử lại: lỗi cấu hình phải hiện ra ngay", async () => {
    queue.push(networkError("ENOTFOUND"), ANSWER);

    await expect(
      generateStructured<{ reply: string }>({ tier: "light", contents: "câu hỏi", schema: SCHEMA } as never),
    ).rejects.toThrow(/fetch failed/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  /**
   * `GEMINI_TIMEOUT_MS` cắt một lượt gọi treo và SDK ném `AbortError` — không có `status`, câu
   * chữ không khớp mẫu nào. Không nhận diện nó thì bản vá timeout chỉ đổi một lượt chờ dài thành
   * một lượt hỏng ngay, thay vì thành một lượt gửi lại.
   */
  it("hết hạn thời gian được coi là lỗi tạm thời và gửi lại", async () => {
    queue.push(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }), ANSWER);

    const result = await generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);

    expect(result.data).not.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("yêu cầu sai thì KHÔNG thử lại: mỗi lần thử là một lượt tính tiền cho cùng một câu trả lời", async () => {
    queue.push(
      providerError('{"error":{"message":"Invalid request, please check your parameters"}}', 400),
      ANSWER,
    );

    await expect(
      generateStructured<{ reply: string }>({ tier: "light", contents: "câu hỏi", schema: SCHEMA } as never),
    ).rejects.toThrow(/Invalid request/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("điểm cuối hỏng suốt: hết lượt thử thì lỗi vẫn nổi lên, không nuốt im lặng", async () => {
    const down = () => providerError("The service is overloaded", 503);
    queue.push(down(), down(), down());

    await expect(
      generateStructured<{ reply: string }>({ tier: "light", contents: "câu hỏi", schema: SCHEMA } as never),
    ).rejects.toThrow(/overloaded/);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});

/**
 * Ngân sách thử lại phải nới được cho lần chạy đo.
 *
 * Mặc định 2 lượt là đúng cho một câu hỏi có người đang chờ, nhưng ngày 2026-09-22 đúng ngần ấy
 * đã không đủ qua một nhịp quá tải của proxy, và mỗi lần như vậy là một lần chạy đánh giá hàng
 * trăm lượt bị vứt đi ngay từ kịch bản đầu tiên.
 *
 * Timer giả chứ không chờ thật: backoff tăng dần nên năm lượt thử là bảy giây đồng hồ, và tầng
 * test nhanh cả bộ hiện chạy chưa tới năm giây.
 */
describe("ngân sách thử lại nới được qua môi trường", () => {
  beforeEach(() => {
    queue.length = 0;
    generateContent.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GEMINI_MAX_RETRIES;
    vi.restoreAllMocks();
  });

  it("GEMINI_MAX_RETRIES=5 chịu được nhịp quá tải dài hơn mặc định", async () => {
    process.env.GEMINI_MAX_RETRIES = "5";
    const down = () => providerError("The service is overloaded", 503);
    queue.push(down(), down(), down(), down(), ANSWER);

    const pending = generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);
    await vi.runAllTimersAsync();

    expect((await pending).data).not.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(5);
  });

  it("giá trị rác quay về mặc định 2, không tắt thử lại và không thử vô hạn", async () => {
    process.env.GEMINI_MAX_RETRIES = "không-phải-số";
    const down = () => providerError("The service is overloaded", 503);
    queue.push(down(), down(), down(), ANSWER);

    const pending = generateStructured<{ reply: string }>({
      tier: "light", contents: "câu hỏi", schema: SCHEMA,
    } as never);
    const assertion = expect(pending).rejects.toThrow(/overloaded/);
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});
