import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import { afterAll, beforeAll } from "vitest";
import { resetMemoryLimits } from "@server/infra/rateLimitStore";

const db = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));
const sendMail = vi.hoisted(() => vi.fn());
const verifyIdToken = vi.hoisted(() => vi.fn());
const password = vi.hoisted(() => ({
  MIN_PASSWORD_LENGTH: 8,
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@server/infra/db", () => ({ prisma: db }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));
vi.mock("@server/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@server/config")>()),
  hasGoogleCredentials: () => true,
  hasMailer: () => true,
}));
vi.mock("@server/infra/mailer", () => ({ sendMail }));
vi.mock("@server/domain/password", () => password);
vi.mock("@server/domain/mappers", () => ({
  userWithRelations: {},
  toUserProfile: (user: { id: string }) => ({ id: user.id }),
}));

const { authRouter, hashResetCode } = await import("./auth");

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

  it("email không có mật khẩu vẫn chạy bcrypt, để thời gian phản hồi không lộ email tồn tại", async () => {
    db.user.findUnique.mockResolvedValue(null);
    password.verifyPassword.mockClear();
    password.verifyPassword.mockResolvedValue(true);

    // Dù bcrypt giả "khớp", không có user thì vẫn phải là 401.
    expect((await login("khong-ton-tai@example.com")).status).toBe(401);
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
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

describe("gộp tài khoản Google theo email", () => {
  function loginGoogle() {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-alice", email: "alice@example.com", email_verified: true }),
    });
    db.user.upsert.mockResolvedValue({ id: "alice", sessionVersion: 1 });
    return fetch(`${base}/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "id-token" }),
    });
  }

  it("lần đầu gộp vào tài khoản mật khẩu thì xoá mật khẩu và thu hồi phiên cũ", async () => {
    // Tài khoản có thể do kẻ tấn công mở trước bằng email của nạn nhân — đăng ký không xác thực email.
    db.user.findUnique.mockResolvedValue({ googleId: null });

    expect((await loginGoogle()).status).toBe(200);
    expect(db.user.upsert.mock.calls[0][0].update).toMatchObject({
      passwordHash: null,
      sessionVersion: { increment: 1 },
    });
  });

  it("tài khoản đã liên kết Google từ trước thì giữ nguyên mật khẩu và phiên", async () => {
    db.user.findUnique.mockResolvedValue({ googleId: "google-alice" });

    expect((await loginGoogle()).status).toBe(200);
    const update = db.user.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty("passwordHash");
    expect(update).not.toHaveProperty("sessionVersion");
  });
});

describe("quên mật khẩu bằng mã OTP", () => {
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const reset = (code: string, secret = "mat-khau-moi-8") =>
    post("/reset-password", { email: "alice@example.com", code, password: secret });

  it("gửi mã 6 chữ số mà database chỉ giữ HMAC, kèm hạn và bộ đếm sai về 0", async () => {
    db.user.findUnique.mockResolvedValue({ id: "alice" });
    sendMail.mockResolvedValue(undefined);

    expect((await post("/forgot-password", { email: "Alice@Example.com" })).status).toBe(202);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("alice@example.com");
    const code = /\b(\d{6})\b/.exec(mail.text)?.[1] ?? "";
    expect(code).toMatch(/^\d{6}$/);

    const saved = db.user.update.mock.calls[0][0].data;
    expect(saved.passwordResetCodeHash).toBe(hashResetCode("alice@example.com", code));
    expect(saved.passwordResetCodeHash).not.toContain(code);
    expect(saved.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(saved.passwordResetAttempts).toBe(0);
  });

  it("email không có tài khoản nhận đúng câu trả lời như email có thật, và không có thư nào", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const response = await post("/forgot-password", { email: "khong-ton-tai@example.com" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    await vi.waitFor(() => expect(db.user.findUnique).toHaveBeenCalled());
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("mỗi email chỉ xin được 3 mã mỗi giờ, kể cả email không tồn tại", async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await post("/forgot-password", { email: "nan-nhan@example.com" })).status).toBe(202);
    }
    expect((await post("/forgot-password", { email: "nan-nhan@example.com" })).status).toBe(429);
  });

  it("mã đúng: đặt mật khẩu mới, tiêu mã, thu hồi phiên cũ và đăng nhập luôn", async () => {
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUniqueOrThrow.mockResolvedValue({ id: "alice", sessionVersion: 3 });
    password.hashPassword.mockResolvedValue("$2b$12$moi");

    const response = await reset("123456");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/travel_ai_session=/);

    const { where, data } = db.user.updateMany.mock.calls[0][0];
    expect(where).toMatchObject({
      email: "alice@example.com",
      passwordResetCodeHash: hashResetCode("alice@example.com", "123456"),
      passwordResetExpiresAt: { gt: expect.any(Date) },
      passwordResetAttempts: { lt: 5 },
    });
    expect(data).toMatchObject({
      passwordHash: "$2b$12$moi",
      passwordResetCodeHash: null,
      sessionVersion: { increment: 1 },
    });
  });

  it("mã sai thì 400 và cộng một lần sai; sai đủ 5 lần thì câu UPDATE không bao giờ khớp nữa", async () => {
    db.user.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    const response = await reset("000000");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Mã xác nhận không đúng hoặc đã hết hạn");
    expect(db.user.updateMany.mock.calls[1][0]).toMatchObject({
      where: { email: "alice@example.com", passwordResetCodeHash: { not: null } },
      data: { passwordResetAttempts: { increment: 1 } },
    });
  });

  it("email không tồn tại đi đúng con đường như mã sai: một lượt bcrypt, hai câu UPDATE", async () => {
    // Rẽ nhánh sớm khi không có user thì thời gian phản hồi lại lộ email nào có tài khoản.
    db.user.updateMany.mockResolvedValue({ count: 0 });

    expect((await reset("123456")).status).toBe(400);
    expect(password.hashPassword).toHaveBeenCalledTimes(1);
    expect(db.user.updateMany).toHaveBeenCalledTimes(2);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("mã sai định dạng hoặc mật khẩu quá ngắn thì từ chối trước khi đụng tới database", async () => {
    expect((await reset("12345")).status).toBe(400);
    expect((await reset("abcdef")).status).toBe(400);
    expect((await reset("123456", "ngan")).status).toBe(400);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});
