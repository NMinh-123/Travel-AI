import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CHUỖI ĐIỂM CUỐI CHẠY LUÂN PHIÊN.
 *
 * Tách khỏi geminiRetry.test.ts vì hai tệp cần CẤU HÌNH khác nhau: tệp kia chốt hợp đồng khi chỉ
 * có một điểm cuối — nơi một mã 400 phải nổi lên ngay và không được thử lại — còn tệp này chốt
 * hợp đồng khi có ba. Cùng một lỗi 400 mang hai ý nghĩa khác hẳn nhau ở hai cấu hình đó, nên gộp
 * chung một tệp sẽ phải đổi biến môi trường giữa chừng và các phép kiểm bắt đầu phụ thuộc thứ tự.
 *
 * Đo được ngày 2026-09-23 trên proxy đang dùng: gửi ĐÚNG một câu hỏi năm lần thì hai lần trả lời
 * được, ba lần trả 400 "Yêu cầu không hợp lệ" cho chính request mà lần trước nó đã nhận. Đó là
 * lý do tồn tại của chuỗi này.
 */
const { call, behaviour, keysUsed } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "key-1,key-2,key-3";
  process.env.GEMINI_BASE_URL = "https://proxy-a.invalid";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://x/y";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "x".repeat(32);

  /** Mỗi khoá có hàng đợi riêng: `Error` thì ném, chuỗi thì trả về làm nội dung phản hồi. */
  const behaviour = new Map<string, (string | Error)[]>();
  const keysUsed: string[] = [];

  const call = vi.fn(async (apiKey: string) => {
    keysUsed.push(apiKey);
    const item = behaviour.get(apiKey)?.shift();
    if (item instanceof Error) throw item;
    return { text: item ?? '{"reply": "Trả lời mặc định của test."}', usageMetadata: {} };
  });

  return { call, behaviour, keysUsed };
});

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models: { generateContent: (...args: unknown[]) => unknown };
      constructor(options: { apiKey: string }) {
        this.models = { generateContent: () => call(options.apiKey) };
      }
    },
  };
});

const { generateStructured, resetGeminiPool, endpointCount } = await import("./gemini");
const { config } = await import("@server/config");

const SCHEMA = { type: "OBJECT", properties: { reply: { type: "STRING" } } } as never;
const ask = () =>
  generateStructured<{ reply: string }>({ tier: "light", contents: "câu hỏi", schema: SCHEMA } as never);

/** Lỗi của SDK mang `status`; đây đúng hình dạng proxy trả về khi từ chối nhầm. */
function providerError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}
const invalidRequest = () =>
  providerError("Yêu cầu không hợp lệ, vui lòng kiểm tra lại tham số.", 400);

beforeEach(() => {
  behaviour.clear();
  keysUsed.length = 0;
  call.mockClear();
  resetGeminiPool();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Test offline không được gọi mạng"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("cấu hình chuỗi điểm cuối", () => {
  it("đọc ba khoá ngăn bằng dấu phẩy thành ba điểm cuối", () => {
    expect(endpointCount()).toBe(3);
    expect(config.geminiEndpoints.map((e) => e.apiKey)).toEqual(["key-1", "key-2", "key-3"]);
  });

  it("ít địa chỉ hơn khoá thì địa chỉ cuối dùng chung cho phần còn lại", () => {
    expect(config.geminiEndpoints.map((e) => e.baseUrl))
      .toEqual(["https://proxy-a.invalid", "https://proxy-a.invalid", "https://proxy-a.invalid"]);
  });

  it("luôn đặt hạn thời gian cho một lượt gọi", () => {
    expect(config.geminiTimeoutMs).toBeGreaterThan(0);
  });
});

describe("chuyển tiếp khi một điểm cuối từ chối", () => {
  /**
   * Đây là phép kiểm quan trọng nhất của cả tệp. Với MỘT điểm cuối, 400 là chỗ phải dừng. Với
   * ba, nó chỉ là ý kiến của một điểm cuối và phải được kiểm chứng ở điểm cuối kế tiếp.
   */
  it("400 ở điểm cuối đầu không làm chết lượt gọi khi còn điểm cuối khác", async () => {
    behaviour.set("key-1", [invalidRequest()]);

    const result = await ask();

    expect(result.data).not.toBeNull();
    expect(keysUsed.slice(0, 2)).toEqual(["key-1", "key-2"]);
  });

  it("yêu cầu sai THẬT thì hỏng ở mọi điểm cuối và lỗi vẫn nổi lên", async () => {
    for (const key of ["key-1", "key-2", "key-3"]) {
      behaviour.set(key, [invalidRequest(), invalidRequest()]);
    }

    await expect(ask()).rejects.toThrow(/không hợp lệ/);
    expect(new Set(keysUsed)).toEqual(new Set(["key-1", "key-2", "key-3"]));
  });

  it("lỗi tạm thời cũng đi sang điểm cuối kế tiếp chứ không nện lại chỗ vừa hỏng", async () => {
    behaviour.set("key-1", [providerError("The service is overloaded", 503)]);

    const result = await ask();

    expect(result.data).not.toBeNull();
    expect(keysUsed[0]).not.toBe(keysUsed[1]);
  });
});

describe("tải rải đều giữa các điểm cuối", () => {
  it("hai lượt gọi liên tiếp không cùng vào một điểm cuối", async () => {
    await ask();
    const first = keysUsed[0];
    keysUsed.length = 0;
    await ask();

    expect(keysUsed[0]).not.toBe(first);
  });

  it("ba lượt gọi trơn tru đi qua đủ ba điểm cuối", async () => {
    await ask();
    await ask();
    await ask();

    expect(new Set(keysUsed)).toEqual(new Set(["key-1", "key-2", "key-3"]));
  });
});
