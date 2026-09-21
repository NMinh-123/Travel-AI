import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import { prisma } from "@server/infra/db";
import type { TurnOutput } from "@server/domain/agents/orchestrator";
import type { Slots } from "@server/domain/agents/types";

/**
 * Luồng hội thoại chạy trên DATABASE THẬT, chỉ thay lượt gọi model.
 *
 * `chat.test.ts` đã phủ phần định tuyến và phân quyền với database giả. Phần còn thiếu là những
 * thứ chỉ Postgres mới trả lời được: slot có sống qua nhiều lượt không, lịch sử có khôi phục đúng
 * thứ tự không, và hai lượt gửi ĐỒNG THỜI trên cùng một phiên thì chuyện gì xảy ra.
 */

const handleTurn = vi.hoisted(() => vi.fn());
vi.mock("@server/domain/agents/orchestrator", () => ({ handleTurn }));
const { chatRouter } = await import("./chat");

let server: Server;
let base: string;

function reply(slots: Slots, text = "Trả lời."): TurnOutput {
  return {
    result: {
      reply: text, suggestions: [], grounding: "grounded", evidence: [],
      retrievedDocIds: [], citedDocIds: [], calls: [],
    },
    nlu: { intent: "knowledge", confidence: 0.9, entities: {}, temporalPhrases: [], wantsHuman: false },
    agent: "knowledge",
    slots,
    trace: {
      path: [], intent: "knowledge", confidence: 0.9, agent: "knowledge", grounding: "grounded",
      evidence: [], retrievedDocIds: [], citedDocIds: [], unsupportedFacts: [], escalated: false,
      totalMs: 1, nluMs: 1, agentMs: 1, calls: [],
    },
  };
}

function post(body: unknown): Promise<Response> {
  return fetch(`${base}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/chat", chatRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không lấy được cổng test");
  base = `http://127.0.0.1:${address.port}/chat`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

beforeEach(async () => {
  handleTurn.mockReset();
  // "RateLimit" đi cùng: bộ đếm hạn mức nay nằm ở database và dùng chung giữa các ca kiểm, nên
  // không dọn thì mười lăm lượt POST của cả file cộng dồn vào một cửa sổ và ca kiểm cuối nhận 429.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ChatEscalation", "ChatMessage", "ChatSession", "RateLimit" CASCADE`,
  );
});

describe("IT-CHAT-01: slot sống qua nhiều lượt", () => {
  it("lượt sau nhận đúng slot lượt trước đã lưu", async () => {
    handleTurn.mockResolvedValueOnce(reply({ days: 3 }));
    const first = await post({ message: "Đi 3 ngày" });
    const { sessionId } = (await first.json()) as { sessionId: string };

    handleTurn.mockResolvedValueOnce(reply({ days: 3, travelers: 4 }));
    await post({ sessionId, message: "4 người" });

    // Đây là điều `chat.test.ts` không kiểm được: slot phải đi qua cột Json của ChatSession và
    // quay lại đúng hình dạng cũ.
    expect(handleTurn.mock.calls[1][0].slots).toEqual({ days: 3 });

    const session = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.slots).toEqual({ days: 3, travelers: 4 });
  });

  it("khách sửa lại yêu cầu thì slot mới ghi đè, slot cũ giữ nguyên", async () => {
    handleTurn.mockResolvedValueOnce(reply({ days: 3, travelers: 4 }));
    const first = await post({ message: "3 ngày, 4 người" });
    const { sessionId } = (await first.json()) as { sessionId: string };

    handleTurn.mockResolvedValueOnce(reply({ days: 2, travelers: 4 }));
    await post({ sessionId, message: "Đổi thành 2 ngày" });

    const session = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.slots).toEqual({ days: 2, travelers: 4 });
  });
});

describe("IT-CHAT-02: khôi phục lịch sử đúng thứ tự", () => {
  it("lượt thứ ba nhận được lịch sử hai lượt trước, theo thứ tự thời gian", async () => {
    handleTurn.mockResolvedValue(reply({}, "Trả lời."));
    const first = await post({ message: "Câu một" });
    const { sessionId } = (await first.json()) as { sessionId: string };
    await post({ sessionId, message: "Câu hai" });
    await post({ sessionId, message: "Câu ba" });

    const history = handleTurn.mock.calls[2][0].history as { role: string; content: string }[];
    expect(history.map((row) => row.content)).toEqual(["Câu một", "Trả lời.", "Câu hai", "Trả lời."]);

    const stored = await prisma.chatMessage.findMany({
      where: { sessionId }, orderBy: { createdAt: "asc" }, select: { role: true, content: true },
    });
    expect(stored).toHaveLength(6);
  });

  it("phiên khách vãng lai khôi phục được bằng đúng sessionId", async () => {
    handleTurn.mockResolvedValue(reply({}));
    const first = await post({ message: "Xin chào" });
    const { sessionId } = (await first.json()) as { sessionId: string };

    const again = await post({ sessionId, message: "Tiếp tục" });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { sessionId: string }).sessionId).toBe(sessionId);
  });
});

describe("IT-CHAT-03: hai lượt gửi ĐỒNG THỜI trên cùng một phiên", () => {
  it("không mất tin nhắn nào, và phiên không bị nhân đôi", async () => {
    handleTurn.mockResolvedValue(reply({ days: 3 }));
    const first = await post({ message: "Khởi tạo" });
    const { sessionId } = (await first.json()) as { sessionId: string };

    handleTurn.mockReset();
    handleTurn.mockImplementation(async () => {
      // Kéo dài lượt xử lý để hai request thật sự chồng lên nhau chứ không nối tiếp.
      await new Promise((resolve) => setTimeout(resolve, 60));
      return reply({ days: 3 });
    });

    const [a, b] = await Promise.all([
      post({ sessionId, message: "Lượt A" }),
      post({ sessionId, message: "Lượt B" }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);

    const messages = await prisma.chatMessage.findMany({ where: { sessionId }, select: { content: true } });
    const contents = messages.map((row) => row.content);
    expect(contents).toContain("Lượt A");
    expect(contents).toContain("Lượt B");
    expect(await prisma.chatSession.count()).toBe(1);
  });

  /**
   * HÀNH VI HIỆN TẠI, ghi lại chứ không phải tán thành.
   *
   * Hai lượt đồng thời cùng đọc `slots` cũ rồi cùng ghi đè, nên lượt về sau thắng và cập nhật của
   * lượt kia biến mất. Với hội thoại thật thì điều này hiếm — khách gõ lần lượt — nhưng nó có thật
   * khi giao diện gửi lại do mạng chập, hoặc khi khách mở hai tab.
   *
   * Test này chốt hành vi để một lần sửa (khoá theo phiên, hoặc gộp slot lúc ghi) là một thay đổi
   * CÓ Ý THỨC chứ không phải tình cờ, và để lần sửa đó có chỗ chứng minh mình đã sửa được gì.
   */
  it("ghi nhận: slot của lượt về sau ghi đè lượt kia", async () => {
    handleTurn.mockResolvedValueOnce(reply({}));
    const first = await post({ message: "Khởi tạo" });
    const { sessionId } = (await first.json()) as { sessionId: string };

    handleTurn.mockReset();
    handleTurn.mockImplementation(async (input: { message: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return reply(input.message === "Số ngày" ? { days: 4 } : { travelers: 5 });
    });

    await Promise.all([post({ sessionId, message: "Số ngày" }), post({ sessionId, message: "Số người" })]);

    const session = await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
    const slots = session.slots as Record<string, unknown>;
    // Chỉ MỘT trong hai slot sống sót — nếu ngày nào đó cả hai cùng sống thì bài này đỏ, và đó là
    // lúc cần đọc lại ghi chú phía trên chứ không phải lúc sửa con số kỳ vọng.
    expect(Object.keys(slots)).toHaveLength(1);
  });
});
