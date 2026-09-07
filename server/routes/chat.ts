import { Router } from "express";
import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { optionalUserId } from "../auth";
import { prisma } from "../db";
import { AiUnavailableError, respondAiUnavailable } from "../gemini";
import { rateLimit } from "../rateLimit";
import { parseSlots } from "../agents/dialog";
import { handleTurn } from "../agents/orchestrator";
import { PiiMasker } from "../agents/pii";

/**
 * Kênh hội thoại. Thay cho endpoint /api/chat inline trong server.ts trước Vòng 5.
 *
 * Khác biệt lớn nhất so với bản cũ: client gửi `sessionId` thay vì gửi lại toàn bộ
 * `conversationHistory` mỗi lượt. Lịch sử và trạng thái slot nằm trong database, nên nó sống sót
 * qua F5 và đồng bộ giữa các thiết bị khi khách đã đăng nhập (FR-BOT-07).
 *
 * SRS Mục 4.4 và Hình 9.1 vẽ kênh chat qua WebSocket. Ở đây vẫn là REST: với kiến trúc một tiến
 * trình và không có tính năng nào cần đẩy từ server xuống (chưa có nhân viên trả lời trực tiếp),
 * WebSocket chỉ thêm phức tạp mà chưa đổi được gì. Khi dựng live chat với nhân viên thật thì đây
 * là chỗ phải đổi.
 */
export const chatRouter = Router();

/** NFR-SEC-06: chống bot spam vào chatbot. Chặt hơn nhóm auth vì mỗi lượt tốn tiền gọi model. */
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: "Bạn đang gửi quá nhanh",
});

const HISTORY_TURN_LIMIT = 10;
const MAX_MESSAGE_LENGTH = 2000;

/** Chỉ trả về phiên đúng chủ: phiên của khách vãng lai (userId null) ai giữ id thì đọc được, còn
 * phiên đã gắn tài khoản thì bắt buộc đúng user — biết id người khác cũng không đọc được. */
async function loadSession(sessionId: string, userId: string | null) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;
  return session;
}

chatRouter.post("/", chatLimiter, async (req: Request, res: Response, next) => {
  try {
    const userId = optionalUserId(req);
    const rawMessage = req.body?.message;

    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      return res.status(400).json({ error: "Tin nhắn không được để trống" });
    }
    const message = rawMessage.trim().slice(0, MAX_MESSAGE_LENGTH);

    const requestedId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
    let session = requestedId ? await loadSession(requestedId, userId) : null;

    if (!session) {
      const created = await prisma.chatSession.create({ data: { userId } });
      session = { ...created, messages: [] };
    } else if (!session.userId && userId) {
      // Khách chat lúc chưa đăng nhập rồi mới đăng nhập: gắn phiên vào tài khoản để nó đồng bộ
      // sang thiết bị khác, thay vì bỏ lại một phiên mồ côi.
      await prisma.chatSession.update({ where: { id: session.id }, data: { userId } });
    }

    const history = session.messages
      .slice(-HISTORY_TURN_LIMIT)
      .map((row) => ({
        role: row.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: row.content,
      }));

    // SRS Mục 11.4.8: che dữ liệu cá nhân TRƯỚC khi đưa vào lời nhắc gửi ra API nước ngoài.
    // Một masker cho cả lượt, để cùng một số điện thoại trong tin mới và trong lịch sử ra cùng
    // một ký hiệu — nếu không, model mất khả năng hiểu đó là cùng một thứ.
    const masker = new PiiMasker();
    const maskedMessage = masker.mask(message);
    const maskedHistory = history.map((turn) => ({ ...turn, content: masker.mask(turn.content) }));

    const outcome = await handleTurn({
      sessionId: session.id,
      userId,
      message: maskedMessage,
      slots: parseSlots(session.slots),
      history: maskedHistory,
    });

    const reply = masker.restore(outcome.result.reply);
    const suggestions = outcome.result.suggestions.map((item) => masker.restore(item));

    // Lưu bản GỐC chưa che: đây là dữ liệu của khách trong database của mình, việc che chỉ áp
    // dụng ở biên gửi ra API ngoài.
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { sessionId: session.id, role: "USER", content: message },
      }),
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "ASSISTANT",
          content: reply,
          intent: outcome.nlu.intent,
          confidence: outcome.nlu.confidence,
          agent: outcome.agent,
          suggestions,
          trace: outcome.trace as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.chatSession.update({
        where: { id: session.id },
        data: {
          slots: outcome.slots as unknown as Prisma.InputJsonValue,
          ...(outcome.result.escalation ? { escalated: true } : {}),
        },
      }),
    ]);

    if (outcome.result.escalation) {
      await prisma.chatEscalation.create({
        data: {
          sessionId: session.id,
          reason: outcome.result.escalation.reason,
          summary: masker.restore(outcome.result.escalation.summary),
        },
      });
    }

    return res.json({
      sessionId: session.id,
      reply,
      suggestions,
      agent: outcome.agent,
      escalated: Boolean(outcome.result.escalation),
      itinerary: outcome.result.itinerary,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) return respondAiUnavailable(res);
    return next(error);
  }
});

/** Nạp lại lịch sử khi mở lại trang hoặc đăng nhập trên thiết bị khác (FR-BOT-07). */
chatRouter.get("/sessions/:id", async (req: Request, res: Response, next) => {
  try {
    const session = await loadSession(req.params.id, optionalUserId(req));
    if (!session) return res.status(404).json({ error: "Không tìm thấy phiên hội thoại" });

    return res.json({
      sessionId: session.id,
      escalated: session.escalated,
      satisfaction: session.satisfaction,
      messages: session.messages.map((row) => ({
        id: row.id,
        role: row.role === "USER" ? "user" : "assistant",
        content: row.content,
        suggestions: row.suggestions,
        timestamp: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/** FR-BOT-11: thu thập phản hồi hài lòng / không hài lòng sau mỗi phiên hỗ trợ. */
chatRouter.post("/feedback", async (req: Request, res: Response, next) => {
  try {
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    const satisfaction = Number(req.body?.satisfaction);

    if (satisfaction !== 1 && satisfaction !== -1) {
      return res.status(400).json({ error: "Giá trị phản hồi không hợp lệ" });
    }

    const session = await loadSession(sessionId, optionalUserId(req));
    if (!session) return res.status(404).json({ error: "Không tìm thấy phiên hội thoại" });

    await prisma.chatSession.update({ where: { id: session.id }, data: { satisfaction } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
