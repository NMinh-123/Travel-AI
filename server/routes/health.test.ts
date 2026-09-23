import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

/**
 * MẤT DATABASE PHẢI LỘ RA Ở MÃ TRẠNG THÁI.
 *
 * Bản trước luôn trả 200 kèm `status: "ok"` dù `dbConnected` bằng false, nên một readiness probe
 * chỉ kiểm mã 200 — cách dùng hiển nhiên nhất của một đường dẫn tên là /health — vẫn coi tiến
 * trình mất hẳn database là sẵn sàng nhận traffic.
 */
const reachable = vi.hoisted(() => vi.fn());
vi.mock("@server/infra/db", () => ({ isDatabaseReachable: reachable, prisma: {} }));

const { healthRouter } = await import("./health");

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/api", healthRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("GET /api/health", () => {
  it("database còn sống: 200 và status ok", async () => {
    reachable.mockResolvedValue(true);

    const response = await fetch(`${base}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", dbConnected: true });
  });

  it("mất database: 503 và status degraded", async () => {
    reachable.mockResolvedValue(false);

    const response = await fetch(`${base}/api/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "degraded", dbConnected: false });
  });

  /** Giữ hình dạng thân phản hồi để nơi nào đang đọc `dbConnected` vẫn đọc được. */
  it("thân phản hồi giữ nguyên các khoá ở cả hai trạng thái", async () => {
    reachable.mockResolvedValue(false);
    const down = Object.keys(await (await fetch(`${base}/api/health`)).json()).sort();
    reachable.mockResolvedValue(true);
    const up = Object.keys(await (await fetch(`${base}/api/health`)).json()).sort();

    expect(down).toEqual(up);
    expect(up).toContain("dbConnected");
    expect(up).toContain("aiConfigured");
  });
});
