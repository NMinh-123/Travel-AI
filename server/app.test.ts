import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@server/config";
import { AiUnavailableError } from "@server/infra/gemini";
import { AiBudgetExceededError } from "@server/infra/aiBudget";
import { resetMemoryLimits } from "@server/infra/rateLimitStore";

const db = vi.hoisted(() => ({ chatSession: { create: vi.fn() } }));
const handleTurn = vi.hoisted(() => vi.fn());
vi.mock("@server/infra/db", () => ({ prisma: db }));
vi.mock("@server/domain/agents/orchestrator", () => ({ handleTurn }));
import { createApp } from "./app";

const originalProduction = config.isProduction;

describe.each([false, true])("API response contract (production=%s)", (isProduction) => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApp();
    // index.ts attaches the frontend after createApp(). API requests must never reach it.
    app.get("*", (_req, res) => res.type("html").send("<html>Frontend</html>"));
    await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  beforeEach(() => {
    config.isProduction = isProduction;
    vi.resetAllMocks();
    resetMemoryLimits();
    db.chatSession.create.mockResolvedValue({ id: "guest-session", userId: null, slots: {} });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    config.isProduction = originalProduction;
    vi.restoreAllMocks();
  });

  it.each([
    ["GET", "/api"],
    ["GET", "/api/"],
    ["GET", "/api/content/khong-co"],
    ["POST", "/api/khong-co"],
    ["PUT", "/api/khong-co"],
    ["PATCH", "/api/khong-co"],
    ["DELETE", "/api/khong-co"],
    ["OPTIONS", "/api/khong-co"],
  ])("returns JSON 404 for %s %s", async (method, path) => {
    const response = await fetch(`${base}${path}`, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Không tìm thấy endpoint API" });
  });

  it("returns 404 without a body for HEAD", async () => {
    const response = await fetch(`${base}/api/khong-co`, { method: "HEAD" });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).toBe("");
  });

  it.each(["/destinations", "/apiary"])("preserves the frontend fallback for %s", async (path) => {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>Frontend</html>");
  });

  it("preserves existing API routes", async () => {
    const response = await fetch(`${base}/api/config`);
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("googleClientId");
  });

  function postChat(body: string) {
    return fetch(`${base}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    });
  }

  it.each([401, 403, 429, 503, 200, undefined])("does not forward upstream status %s", async (status) => {
    const upstreamError = Object.assign(new Error("Proxy authentication failed"), { status });
    handleTurn.mockRejectedValue(upstreamError);
    const response = await postChat(JSON.stringify({ message: "Xin chào" }));
    expect(handleTurn).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(isProduction
      ? { error: "Lỗi máy chủ" }
      : { error: "Lỗi máy chủ", details: upstreamError.message });
    expect(console.error).toHaveBeenCalledWith("Unhandled API error:", upstreamError);
  });

  it("preserves 401 for an unauthenticated user", async () => {
    const response = await fetch(`${base}/api/chat/sessions`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Bạn cần đăng nhập để thực hiện việc này" });
  });

  it.each([
    [new AiUnavailableError(), 503],
    [new AiBudgetExceededError(60), 429],
  ] as const)("preserves the explicit AI error %s", async (error, status) => {
    handleTurn.mockRejectedValue(error);
    const response = await postChat(JSON.stringify({ message: "Xin chào" }));
    expect(response.status).toBe(status);
    expect(await response.json()).toHaveProperty("error");
    if (status === 429) expect(response.headers.get("retry-after")).toBe("60");
  });

  it.each([
    ["{broken", 400],
    [JSON.stringify({ message: "x".repeat(65 * 1024) }), 413],
  ] as const)("preserves body parser error %#", async (body, status) => {
    const response = await postChat(body);
    expect(response.status).toBe(status);
    expect(await response.json()).toHaveProperty("error");
    expect(handleTurn).not.toHaveBeenCalled();
  });
});
