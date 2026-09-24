import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

/**
 * Turnstile đứng trước /login và /register. Phải đúng ở cả hai phía: token sai hay thiếu thì
 * chặn, token đúng thì cho qua, và chưa cấu hình thì không đụng tới ai — nếu không, dev và E2E
 * (không có khoá) sẽ không đăng nhập được nữa.
 */
const keys = vi.hoisted(() => ({ site: "", secret: "" }));
vi.mock("@server/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/config")>();
  return {
    ...actual,
    config: new Proxy(actual.config, {
      get: (target, prop) =>
        prop === "turnstileSecretKey" ? keys.secret : prop === "turnstileSiteKey" ? keys.site : Reflect.get(target, prop),
    }),
    hasTurnstile: () => keys.site !== "" && keys.secret !== "",
  };
});

const { requireTurnstile } = await import("./turnstile");

let server: Server;
let base: string;
const realFetch = globalThis.fetch;
const siteverify = vi.fn();

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post("/login", requireTurnstile, (_req, res) => res.json({ passed: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  keys.site = "site-key";
  keys.secret = "secret-key";
  siteverify.mockReset();
  // Chỉ chặn lời gọi tới Cloudflare; lời gọi của chính bài test tới server cục bộ đi thật.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith("https://challenges.cloudflare.com/") ? siteverify(input, init) : realFetch(input, init),
  );
});
afterEach(() => vi.unstubAllGlobals());

const post = (body: unknown) =>
  realFetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("requireTurnstile", () => {
  it("chưa cấu hình đủ hai khoá thì cho qua và không gọi Cloudflare", async () => {
    keys.secret = "";
    const response = await post({ email: "a@b.vn" });

    expect(response.status).toBe(200);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("thiếu token: 400, không gọi Cloudflare", async () => {
    const response = await post({ email: "a@b.vn" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/xác minh/i);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("token sai (Cloudflare trả success: false): 400", async () => {
    siteverify.mockResolvedValue(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] })));
    const response = await post({ turnstileToken: "token-gia" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/không thành công/i);
  });

  it("token đúng: cho qua, và gửi secret cùng token lên siteverify", async () => {
    siteverify.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    const response = await post({ turnstileToken: "token-that" });

    expect(response.status).toBe(200);
    const sent = new URLSearchParams(String(siteverify.mock.calls[0][1].body));
    expect(sent.get("secret")).toBe("secret-key");
    expect(sent.get("response")).toBe("token-that");
  });

  it("không gọi được Cloudflare: từ chối (503), không cho qua", async () => {
    siteverify.mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post({ turnstileToken: "token-that" });

    expect(response.status).toBe(503);
  });
});
