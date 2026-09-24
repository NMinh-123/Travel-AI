import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());

function respond(body: string | null, status = 200, contentType = "application/json") {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
    status,
    headers: { "Content-Type": contentType },
  })));
}

describe("apiRequest response contract", () => {
  it.each([
    ["<html>SPA fallback</html>", "text/html"],
    ["{broken", "application/json"],
    ["", "application/json"],
  ])("rejects an unreadable successful response: %s", async (body, contentType) => {
    respond(body, 200, contentType);
    await expect(apiRequest("/api/missing")).rejects.toMatchObject({
      name: "ApiError", status: 200, message: "Máy chủ trả về phản hồi JSON không hợp lệ",
    });
  });

  it.each([null, { items: [] }])("preserves valid JSON, including null: %j", async (body) => {
    respond(JSON.stringify(body));
    await expect(apiRequest("/api/content/local-weather")).resolves.toEqual(body);
  });

  it("accepts 204 without parsing a body", async () => {
    respond(null, 204);
    await expect(apiRequest("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("preserves the HTTP status when an error response contains HTML", async () => {
    respond("<html>Not found</html>", 404, "text/html");
    await expect(apiRequest("/api/missing")).rejects.toEqual(
      new ApiError("Máy chủ trả về lỗi 404", 404),
    );
  });

  it("preserves the API error message and details", async () => {
    respond(JSON.stringify({ error: "Dịch vụ chưa sẵn sàng", details: "Thử lại sau" }), 503);
    await expect(apiRequest("/api/chat")).rejects.toEqual(
      new ApiError("Dịch vụ chưa sẵn sàng — Thử lại sau", 503),
    );
  });
});
