import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { config } from "@server/config";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@server/infra/db", () => ({ prisma: db }));

const { optionalUserId } = await import("./auth");

function read(token: string) {
  const req = { cookies: { travel_ai_session: token } } as unknown as Request;
  const res = { clearCookie: vi.fn() };
  return { userId: optionalUserId(req, res as unknown as Response), res };
}

describe("phiên JWT", () => {
  beforeEach(() => db.user.findUnique.mockResolvedValue({ sessionVersion: 0 }));

  it("nhận token HS256 ký đúng secret", async () => {
    await expect(read(jwt.sign({ sub: "alice", ver: 0 }, config.jwtSecret)).userId).resolves.toBe("alice");
  });

  it("từ chối token thuật toán khác dù ký đúng secret", async () => {
    const token = jwt.sign({ sub: "alice", ver: 0 }, config.jwtSecret, { algorithm: "HS512" });
    await expect(read(token).userId).resolves.toBeNull();
  });

  it("token phát trước khi có sessionVersion vẫn dùng được, để triển khai không đá ai ra", async () => {
    await expect(read(jwt.sign({ sub: "alice" }, config.jwtSecret)).userId).resolves.toBe("alice");
  });

  it("token có ver cũ hơn DB bị thu hồi và cookie bị xoá", async () => {
    db.user.findUnique.mockResolvedValue({ sessionVersion: 1 });
    const { userId, res } = read(jwt.sign({ sub: "alice", ver: 0 }, config.jwtSecret));
    await expect(userId).resolves.toBeNull();
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("user đã bị xoá thì token không còn hiệu lực", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(read(jwt.sign({ sub: "alice", ver: 0 }, config.jwtSecret)).userId).resolves.toBeNull();
  });
});
