import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import { afterAll, beforeAll } from "vitest";
import { resetMemoryLimits } from "@server/infra/rateLimitStore";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() } }));
const password = vi.hoisted(() => ({
  MIN_PASSWORD_LENGTH: 8,
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@server/infra/db", () => ({ prisma: db }));
vi.mock("@server/domain/password", () => password);
vi.mock("@server/domain/mappers", () => ({
  userWithRelations: {},
  toUserProfile: (user: { id: string }) => ({ id: user.id }),
}));

const { authRouter } = await import("./auth");

let server: Server;
let base: string;

function login(email: string, secret = "mat-khau-sai-roi") {
  return fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: secret }),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/auth", authRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không lấy được cổng test");
  base = `http://127.0.0.1:${address.port}/auth`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

beforeEach(() => {
  vi.resetAllMocks();
  // Bộ đếm dùng chung giữa các ca kiểm, nên phải dọn — nếu không, giới hạn theo IP của ca trước
  // sẽ chặn ca sau và bài kiểm đỏ vì một lý do không liên quan đến điều nó đang kiểm.
  resetMemoryLimits();
});

describe("KB-08: chặn dò mật khẩu theo tài khoản", () => {
  it("sai mười lần thì lần thứ mười một bị chặn bằng 429 kèm Retry-After", async () => {
    db.user.findUnique.mockResolvedValue(null);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await login("nan-nhan@example.com");
      expect(response.status).toBe(401);
    }

    const blocked = await login("nan-nhan@example.com");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("chặn TRƯỚC khi tra database và trước khi so mật khẩu", async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let attempt = 1; attempt <= 10; attempt += 1) await login("nan-nhan@example.com");

    db.user.findUnique.mockClear();
    password.verifyPassword.mockClear();

    await login("nan-nhan@example.com");

    // Một request chắc chắn bị từ chối không được tiêu một lượt băm bcrypt — bcrypt cố tình đắt,
    // nên nó cũng là một lối đốt CPU.
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(password.verifyPassword).not.toHaveBeenCalled();
  });

  it("bộ đếm tính theo từng email, không chặn lây sang tài khoản khác", async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let attempt = 1; attempt <= 10; attempt += 1) await login("nan-nhan@example.com");

    expect((await login("nan-nhan@example.com")).status).toBe(429);
    expect((await login("nguoi-khac@example.com")).status).toBe(401);
  });

  it("email không tồn tại cũng bị đếm, để bộ đếm không thành cách liệt kê tài khoản", async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let attempt = 1; attempt <= 10; attempt += 1) await login("khong-ton-tai@example.com");

    // Nếu chỉ đếm khi email có thật thì mã trả về ở đây sẽ là 401, và chênh lệch đó đủ để liệt kê.
    expect((await login("khong-ton-tai@example.com")).status).toBe(429);
  });

  it("đăng nhập ĐÚNG không ăn vào bộ đếm", async () => {
    db.user.findUnique.mockResolvedValue({ id: "alice", passwordHash: "$2b$10$bam" });
    password.verifyPassword.mockResolvedValue(true);

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const response = await login("alice@example.com", "mat-khau-dung");
      expect(response.status).toBe(200);
    }
  });
});
