import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const db = vi.hoisted(() => ({
  savedItinerary: { count: vi.fn(), create: vi.fn() },
}));

vi.mock("@server/infra/db", () => ({ prisma: db }));
vi.mock("@server/middleware/auth", () => ({
  clearSession: vi.fn(),
  requireUser: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "u1";
    next();
  },
}));
vi.mock("@server/domain/mappers", () => ({
  userWithRelations: {},
  toUserProfile: (user: unknown) => user,
  toRiderLevelCode: (value: unknown) => value,
  toSavedItinerary: (itinerary: unknown) => itinerary,
}));

const { meRouter } = await import("./me");

let server: Server;
let base: string;

function save(body: unknown) {
  return fetch(`${base}/itineraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/me", meRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không lấy được cổng test");
  base = `http://127.0.0.1:${address.port}/api/me`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  db.savedItinerary.count.mockResolvedValue(0);
  db.savedItinerary.create.mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data));
});

describe("POST /api/me/itineraries", () => {
  // `days` đi thẳng vào cột Json: một phần tử không phải object không hỏng ở đây mà nằm im
  // trong database rồi nổ ở chỗ đọc ra.
  it.each([[null], ["ngày 1"], [[1, 2]]])("từ chối phần tử days không phải object: %j", async (day) => {
    const res = await save({ title: "Cung Hà Giang", days: [{ day: 1 }, day] });

    expect(res.status).toBe(400);
    expect(db.savedItinerary.create).not.toHaveBeenCalled();
  });

  it("kẹp quãng đường âm về 0 thay vì lưu lại", async () => {
    const res = await save({ title: "Cung Hà Giang", days: [{ day: 1 }], totalKm: -100 });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ totalKm: 0 });
  });

  it("lưu lịch trình hợp lệ", async () => {
    const res = await save({ title: "Cung Hà Giang", days: [{ day: 1 }], totalKm: 352.6 });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ userId: "u1", totalKm: 353 });
  });
});
