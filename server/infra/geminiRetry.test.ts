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
