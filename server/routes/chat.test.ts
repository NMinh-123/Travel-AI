import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { config } from "@server/config";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  chatSession: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  chatMessage: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const handleTurn = vi.hoisted(() => vi.fn());
vi.mock("@server/infra/db", () => ({ prisma: db }));
vi.mock("@server/domain/agents/orchestrator", () => ({ handleTurn }));
import { chatRouter } from "./chat";

let server: Server;
let base: string;
const date = new Date("2026-09-17T01:00:00Z");
function request(path: string, userId?: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(userId ? { Cookie: `travel_ai_session=${jwt.sign({ sub: userId }, config.jwtSecret)}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeAll(async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/chat", chatRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  base = `http://127.0.0.1:${address.port}/chat`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ id: "alice", sessionVersion: 0 });
  db.chatSession.findMany.mockResolvedValue([]);
});

describe("account chat history", () => {
  it("requires authentication to list history", async () => {
    expect((await request("/sessions")).status).toBe(401);
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("filters by the authenticated account, ignoring a supplied userId", async () => {
    const response = await request("/sessions?userId=bob", "alice");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(db.chatSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "alice", messages: { some: {} } },
    }));
    expect(await response.json()).toEqual({ sessions: [], nextOffset: null });
  });

  it("returns a bounded page and a next offset", async () => {
    db.chatSession.findMany.mockResolvedValue(Array.from({ length: 31 }, (_, i) => ({
      id: `session-${i}`, lastActiveAt: date, messages: [{ content: "a".repeat(150) }],
    })));
    const response = await request("/sessions?offset=30", "alice");
    const data = await response.json();
    expect(data.sessions).toHaveLength(30);
    expect(data.sessions[0].title).toHaveLength(100);
    expect(data.nextOffset).toBe(60);
    expect(db.chatSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 31 }));
  });

  it.each(["-1", "1.5", "invalid"])("rejects invalid offset %s", async (offset) => {
    expect((await request(`/sessions?offset=${offset}`, "alice")).status).toBe(400);
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "bob"])("hides another account's messages from %s", async (viewer) => {
    db.chatSession.findUnique.mockResolvedValue({ id: "private", userId: "alice", messages: [] });
    expect((await request("/sessions/private", viewer)).status).toBe(404);
  });

  it("does not silently create a new chat when a foreign session is supplied", async () => {
    db.chatSession.findUnique.mockResolvedValue({ id: "private", userId: "alice", messages: [] });
    expect((await request("/", "bob", { sessionId: "private", message: "hello" })).status).toBe(404);
    expect(handleTurn).not.toHaveBeenCalled();
    expect(db.chatSession.create).not.toHaveBeenCalled();
  });

  it("rejects feedback on another account's conversation", async () => {
    db.chatSession.findUnique.mockResolvedValue({ id: "private", userId: "alice", messages: [] });
    expect((await request("/feedback", "bob", { sessionId: "private", satisfaction: 1 })).status).toBe(404);
    expect(db.chatSession.update).not.toHaveBeenCalled();
  });

  it("still restores a guest conversation using its session id", async () => {
    db.chatSession.findUnique.mockResolvedValue({
      id: "guest", userId: null, escalated: false, satisfaction: null, messages: [],
    });
    expect((await request("/sessions/guest")).status).toBe(200);
  });

  it("restores more than 100 messages without exposing internal traces", async () => {
    db.chatSession.findUnique.mockResolvedValue({
      id: "long", userId: "alice", escalated: false, satisfaction: null,
      messages: Array.from({ length: 120 }, (_, i) => ({
        id: `m-${i}`, role: i % 2 ? "ASSISTANT" : "USER", content: `${i}`,
        suggestions: [], createdAt: date, trace: { private: true },
      })),
    });
    const data = await (await request("/sessions/long", "alice")).json();
    expect(data.messages).toHaveLength(120);
    expect(data.messages[119].content).toBe("119");
    expect(data.messages[0]).not.toHaveProperty("trace");
    const query = db.chatSession.findUnique.mock.calls[0][0];
    expect(query.include.messages).not.toHaveProperty("take");
  });

  it("uses the latest messages, in chronological order, when continuing a chat", async () => {
    db.chatSession.findUnique.mockResolvedValue({
      id: "long", userId: "alice", slots: {},
      messages: [{ role: "ASSISTANT", content: "latest" }, { role: "USER", content: "previous" }],
    });
    handleTurn.mockResolvedValue({
      result: { reply: "reply", suggestions: [] }, nlu: { intent: "faq", confidence: 1 },
      agent: "knowledge", slots: {}, trace: {},
    });
    db.$transaction.mockResolvedValue([]);
    expect((await request("/", "alice", { sessionId: "long", message: "continue" })).status).toBe(200);
    expect(db.chatSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 } },
    }));
    expect(handleTurn).toHaveBeenCalledWith(expect.objectContaining({
      history: [{ role: "user", content: "previous" }, { role: "assistant", content: "latest" }],
    }));
  });
});
