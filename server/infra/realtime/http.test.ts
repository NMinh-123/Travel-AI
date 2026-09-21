import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderProfile } from "@data/realtime/types";
import { buildUrl, requestJson } from "./http";
import { isFailure } from "./toolResult";

/**
 * Ba quy tắc ở đầu `http.ts` đều là quy tắc TỐN TIỀN nếu làm sai, và không quy tắc nào trong số
 * đó biểu hiện thành lỗi lúc chạy: thử lại một lỗi 4xx chỉ làm hoá đơn API tăng lên trong im lặng,
 * còn một request treo vì thiếu timeout thì chỉ thấy khi khách phàn nàn là chatbot đứng hình.
 *
 * Toàn bộ chạy với `fetch` giả nên không có một byte nào ra mạng.
 */

const PROFILE: ProviderProfile = {
  tool: "weather",
  provider: "fixture-provider",
  baseUrl: "https://fixture.invalid",
  apiKeyEnv: null,
  ttlSeconds: 600,
  timeoutMs: 4000,
  maxRetries: 1,
  attribution: "Fixture",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("IT-RT-01: lỗi 4xx KHÔNG được thử lại", () => {
  it("gọi đúng một lần rồi trả PROVIDER_ERROR", async () => {
    // Thử lại một request sai thì lần sau vẫn sai, nhưng với API tính tiền theo lượt gọi thì mỗi
    // lần thử vẫn bị tính. Đây là cách đốt hạn mức nhanh nhất.
    fetchMock.mockResolvedValue(new Response("tham số sai", { status: 400 }));
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isFailure(result) && result.error.code).toBe("PROVIDER_ERROR");
  });

  it("429 thành RATE_LIMITED riêng và cũng không thử lại", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isFailure(result) && result.error.code).toBe("RATE_LIMITED");
  });
});

describe("IT-RT-02: timeout và lỗi mạng", () => {
  it("timeout thành mã TIMEOUT chứ không phải PROVIDER_ERROR", async () => {
    // Hai mã dẫn tới hai câu trả lời khác nhau cho khách và hai quyết định khác nhau về thử lại.
    const timeout = Object.assign(new Error("hết giờ"), { name: "TimeoutError" });
    fetchMock.mockRejectedValue(timeout);
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(isFailure(result) && result.error.code).toBe("TIMEOUT");
  });

  it("lỗi mạng ĐƯỢC thử lại đúng số lần trong hồ sơ", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await requestJson("https://fixture.invalid/x", PROFILE);
    expect(fetchMock).toHaveBeenCalledTimes(PROFILE.maxRetries + 1);
  });

  it("thử lại thành công ở lượt sau thì trả dữ liệu, không trả lỗi", async () => {
    fetchMock.mockRejectedValueOnce(new Error("mạng chập")).mockResolvedValueOnce(json({ ok: 1 }));
    const result = await requestJson<{ ok: number }>("https://fixture.invalid/x", PROFILE);
    expect(isFailure(result)).toBe(false);
    expect(!isFailure(result) && result.data.ok).toBe(1);
  });

  it("mọi lượt gọi đều mang signal timeout", async () => {
    fetchMock.mockResolvedValue(json({}));
    await requestJson("https://fixture.invalid/x", PROFILE);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe("IT-RT-03: phản hồi hỏng không được ném ra ngoài luồng", () => {
  it("HTTP 200 mà thân không phải JSON thành PROVIDER_ERROR", async () => {
    // Nhà cung cấp trả HTML báo lỗi kèm mã 200 là chuyện có thật.
    fetchMock.mockResolvedValue(new Response("<html>lỗi</html>", { status: 200 }));
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(isFailure(result) && result.error.code).toBe("PROVIDER_ERROR");
  });

  it("5xx được thử lại rồi mới trả lỗi", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(fetchMock).toHaveBeenCalledTimes(PROFILE.maxRetries + 1);
    expect(isFailure(result) && result.error.code).toBe("PROVIDER_ERROR");
  });

  it("kết quả thành công luôn ghi rõ nhà cung cấp", async () => {
    fetchMock.mockResolvedValue(json({ value: 7 }));
    const result = await requestJson("https://fixture.invalid/x", PROFILE);
    expect(!isFailure(result) && result.source).toBe("fixture-provider");
    expect(!isFailure(result) && Date.parse(result.retrieved_at)).not.toBeNaN();
  });
});

describe("IT-RT-04: ghép URL bỏ tham số rỗng", () => {
  it("không đưa tham số rỗng hoặc undefined vào query", () => {
    const url = buildUrl("https://fixture.invalid", "/v1/forecast", {
      latitude: 23.1, longitude: undefined, units: "", lang: "vi",
    });
    expect(url).toContain("latitude=23.1");
    expect(url).toContain("lang=vi");
    expect(url).not.toContain("longitude");
    expect(url).not.toContain("units");
  });
});
