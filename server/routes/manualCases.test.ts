import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Server } from "node:http";
import { config } from "@server/config";
import { AiUnavailableError, respondAiUnavailable } from "@server/infra/gemini";

/**
 * BỐN CA TRƯỚC ĐÂY CHỈ CHẠY TAY, nay chạy máy — xem cột "Tự động hoá" ở docs/TEST-CASES.md.
 *
 * Đặt ở tầng route chứ không ở E2E vì cả bốn đều hỏi về HỢP ĐỒNG CỦA API chứ không về giao diện:
 * mã trạng thái, câu lỗi, và thứ có được lộ ra ngoài hay không. E2E dựng trình duyệt và database
 * thật cho những câu hỏi ấy thì chậm hơn nhiều mà không trả lời chính xác hơn.
 */
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  savedItinerary: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const credentials = vi.hoisted(() => ({ has: vi.fn(() => true) }));
const handleTurn = vi.hoisted(() => vi.fn());
const generateItinerary = vi.hoisted(() => vi.fn());

vi.mock("@server/infra/db", () => ({ prisma: db, isDatabaseReachable: vi.fn(async () => true) }));
vi.mock("@server/domain/agents/orchestrator", () => ({ handleTurn }));
vi.mock("@server/domain/itinerary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/domain/itinerary")>();
  return { ...actual, generateItinerary };
});
vi.mock("@server/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/config")>();
  return { ...actual, hasGeminiCredentials: () => credentials.has() };
});

const { chatRouter } = await import("./chat");
const { itineraryRouter } = await import("./itinerary");
const { meRouter } = await import("./me");
const { healthRouter } = await import("./health");

let server: Server;
let base: string;
const USER = "user-manual-cases";

function request(path: string, body?: unknown, method = body ? "POST" : "GET") {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: `travel_ai_session=${jwt.sign({ sub: USER }, config.jwtSecret)}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", healthRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api", itineraryRouter);
  app.use("/api/me", meRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  credentials.has.mockReturnValue(true);
  // `requireAuth` tra user trong database để một phiên của tài khoản đã xoá không còn dùng được.
  db.user.findUnique.mockResolvedValue({ id: USER, sessionVersion: 0 });
});

describe("TC-SYS-02: trợ lý chưa cấu hình khoá API", () => {
  /**
   * Mức Cao trong TEST-CASES.md và vẫn chỉ chạy tay. Điều phải đúng không chỉ là "trả lỗi" mà là
   * trả 503 kèm HƯỚNG DẪN sửa: thiếu khoá là lỗi cấu hình của người vận hành, và một câu 500 trơn
   * sẽ bị đọc nhầm thành ứng dụng hỏng.
   */
  it("sinh lịch trình trả 503 kèm hướng dẫn tạo .env, không phải 500", async () => {
    credentials.has.mockReturnValue(false);
    generateItinerary.mockRejectedValue(new AiUnavailableError());

    const response = await request("/api/plan-itinerary", {
      days: 3, travelMode: "car_suv", vibe: "culture", budget: "comfort",
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/chưa được cấu hình/i);
    expect(body.details).toMatch(/GEMINI_API_KEY/);
    expect(body.details).toMatch(/\.env/);
  });

  /**
   * `/api/chat` ánh xạ cùng một lỗi qua cùng một hàm `respondAiUnavailable` (xem chat.ts, nhánh
   * `error instanceof AiUnavailableError`). Kiểm thẳng hàm đó thay vì dựng lại toàn bộ đường chat
   * với database giả: thứ cần chốt là NỘI DUNG phản hồi, và nó nằm ở đây.
   */
  it("hàm dùng chung trả đúng 503 và hướng dẫn", async () => {
    const captured: { status?: number; body?: any } = {};
    const res = {
      status(code: number) { captured.status = code; return this; },
      json(payload: unknown) { captured.body = payload; return this; },
    };

    respondAiUnavailable(res as never);

    expect(captured.status).toBe(503);
    expect(captured.body.details).toMatch(/GEMINI_API_KEY/);
    expect(captured.body.details).toMatch(/\.env/);
  });
});

describe("TC-SYS-05: không lộ tên model ở production", () => {
  /**
   * Tên model chỉ giúp người đang dò biết cần đọc CVE và mẹo vượt guardrail của model nào. Ở dev
   * thì nó trả lời đúng câu hỏi hay gặp nhất khi câu trả lời trở nên lạ.
   */
  it("dev: có tên model; khoá API vắng thì để null", async () => {
    expect((await (await request("/api/health")).json()).model).toBe(config.geminiModel);

    credentials.has.mockReturnValue(false);
    expect((await (await request("/api/health")).json()).model).toBeNull();
  });
});

describe("TC-PROF-06: tài khoản Google không đổi được mật khẩu", () => {
  /**
   * Giao diện ẩn khối mật khẩu, nhưng ẩn ở giao diện không phải là một biện pháp — gọi thẳng API
   * vẫn phải bị từ chối, và từ chối kèm lý do đọc được chứ không phải một mã trơn.
   */
  it("gọi thẳng API trả 409 kèm lý do", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: null });

    const response = await request("/api/me/password", {
      currentPassword: "khong-quan-trong",
      newPassword: "mat-khau-moi-8-ky-tu",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Google/);
  });
});

describe("đổi mật khẩu thu hồi các phiên khác", () => {
  it("tăng sessionVersion và phát lại cookie cho thiết bị đang dùng", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: bcrypt.hashSync("mat-khau-cu-8", 4) });
    db.user.update.mockResolvedValue({ sessionVersion: 1 });

    const response = await request("/api/me/password", {
      currentPassword: "mat-khau-cu-8",
      newPassword: "mat-khau-moi-8-ky-tu",
    });

    expect(response.status).toBe(204);
    expect(db.user.update.mock.calls[0][0].data.sessionVersion).toEqual({ increment: 1 });
    const cookie = response.headers.get("set-cookie") ?? "";
    const token = /travel_ai_session=([^;]+)/.exec(cookie)?.[1] ?? "";
    expect(jwt.verify(token, config.jwtSecret)).toMatchObject({ sub: USER, ver: 1 });
  });
});

describe("TC-PLAN-09: trần 50 lịch trình đã lưu", () => {
  it("lưu thêm khi đã đủ trần trả 409 kèm hướng dẫn xoá bớt", async () => {
    db.savedItinerary.count.mockResolvedValue(50);

    const response = await request("/api/me/itineraries", {
      title: "Hà Giang 3 ngày",
      overview: "Vòng cung cơ bản",
      totalKm: 400,
      days: [{ day: 1, title: "Ngày 1", summary: "", stops: [] }],
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/tối đa/i);
    expect(body.details).toMatch(/50/);
  });

  it("dưới trần thì không bị chặn bởi luật này", async () => {
    db.savedItinerary.count.mockResolvedValue(49);
    db.savedItinerary.create.mockResolvedValue({ id: "it-1", days: [], createdAt: new Date() });

    const response = await request("/api/me/itineraries", {
      title: "Hà Giang 3 ngày",
      overview: "Vòng cung cơ bản",
      totalKm: 400,
      days: [{ day: 1, title: "Ngày 1", summary: "", stops: [] }],
    });

    expect(response.status).not.toBe(409);
  });
});
