import { Router } from "express";
import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { config } from "@server/config";
import { optionalUserId, requireUser, type AuthedRequest } from "@server/middleware/auth";
import { prisma } from "@server/infra/db";
import { AiUnavailableError, respondAiUnavailable } from "@server/infra/gemini";
import {
  AiBudgetExceededError,
  consumeTurnQuota,
  respondAiBudgetExceeded,
} from "@server/infra/aiBudget";
import { rateLimit } from "@server/middleware/rateLimit";
import { parseSlots } from "@server/domain/agents/dialog";
import { handleTurn, type TurnOutput } from "@server/domain/agents/orchestrator";
import { PiiMasker, StreamingPiiRestorer } from "@server/domain/agents/pii";
import { INTENTS, type Intent, type TurnEvent } from "@server/domain/agents/types";

/**
 * Kênh hội thoại. Thay cho endpoint /api/chat inline trong server.ts (nay là server/index.ts) trước Vòng 5.
 *
 * Khác biệt lớn nhất so với bản cũ: client gửi `sessionId` thay vì gửi lại toàn bộ
 * `conversationHistory` mỗi lượt. Lịch sử và trạng thái slot nằm trong database, nên hội thoại
 * của một tài khoản đọc lại được từ bất kỳ thiết bị nào (FR-BOT-07).
 *
 * KHÔNG TỰ MỞ LẠI HỘI THOẠI GẦN NHẤT. Server vẫn giữ đủ mọi thứ, nhưng client cố ý không giữ
 * `sessionId` qua các lần tải trang: mỗi lần mở trang là một cuộc trò chuyện mới, và hội thoại cũ
 * chỉ quay lại khi khách chọn nó trong danh sách lịch sử. Đó là một quyết định sản phẩm và nó
 * lệch với phần "sống sót qua F5" của FR-BOT-07 — lý do đầy đủ nằm ở đầu client/hooks/useChatSession.tsx.
 *
 * SRS Mục 4.4 và Hình 9.1 vẽ kênh chat qua WebSocket. Ở đây vẫn là REST: với kiến trúc một tiến
 * trình và không có tính năng nào cần đẩy từ server xuống (chưa có nhân viên trả lời trực tiếp),
 * WebSocket chỉ thêm phức tạp mà chưa đổi được gì. Khi dựng live chat với nhân viên thật thì đây
 * là chỗ phải đổi.
 */
export const chatRouter = Router();

/** NFR-SEC-06: chống bot spam vào chatbot. Chặt hơn nhóm auth vì mỗi lượt tốn tiền gọi model. */
const chatLimiter = rateLimit({
  windowMs: config.chatRateLimitWindowMs,
  max: config.chatRateLimitMax,
  message: "Bạn đang gửi quá nhanh",
});

const HISTORY_TURN_LIMIT = 10;

/** Chỉ trả về phiên đúng chủ: phiên của khách vãng lai (userId null) ai giữ id thì đọc được, còn
 * phiên đã gắn tài khoản thì bắt buộc đúng user — biết id người khác cũng không đọc được. */
async function loadSession(sessionId: string, userId: string | null, recentOnly = false) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: [{ createdAt: recentOnly ? "desc" : "asc" }, { id: recentOnly ? "desc" : "asc" }], ...(recentOnly ? { take: HISTORY_TURN_LIMIT } : {}) } },
  });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;
  if (recentOnly) session.messages.reverse();
  return session;
}

/**
 * Việc đang làm dở của phiên: tác tử đã phục vụ lượt trợ lý gần nhất.
 *
 * Không cần cột mới — `ChatMessage.agent` đã lưu sẵn từ trước. Dùng nó để một câu sửa lại yêu cầu
 * cũ ("À cho mình thuê người lái thôi") không bị chuyển tiếp chỉ vì nhãn ý định của riêng nó
 * không đủ tin cậy. Xem `amendsOngoingTask` trong orchestrator.
 */
function previousIntentOf(messages: { role: string; agent: string | null }[]): Intent | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const agent = messages[index].agent;
    if (messages[index].role === "assistant" && agent && INTENTS.includes(agent as Intent)) {
      return agent as Intent;
    }
  }
  return undefined;
}

/**
 * Mọi bước có thể TỪ CHỐI lượt trước khi nó bắt đầu, gom về một chỗ.
 *
 * Thứ tự ở đây là hợp đồng, không phải tiện tay: kiểm tin nhắn rỗng TRƯỚC khi trừ hạn mức, để một
 * request hỏng không ăn vào hạn mức của người gửi. Và cả ba nhánh từ chối đều phải xảy ra trước
 * khi có một byte nào được ghi ra — endpoint streaming không thể trả 404 hay 429 sau khi header
 * `text/event-stream` đã đi, nên nó buộc phải dùng chung đúng hàm này.
 *
 * Trả về `null` nghĩa là ĐÃ trả lời khách rồi; nơi gọi chỉ việc dừng.
 */
async function prepareTurn(req: Request, res: Response) {
  const userId = await optionalUserId(req, res);
  const rawMessage = req.body?.message;

  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    res.status(400).json({ error: "Tin nhắn không được để trống" });
    return null;
  }
  const message = rawMessage.trim().slice(0, config.chatMaxMessageLength);

  /**
   * Hạn mức theo GIỜ cho từng người, bên cạnh giới hạn 20 lượt/phút ở trên. Hai con số chặn hai
   * kiểu lạm dụng khác nhau — xem server/infra/aiBudget.ts.
   */
  const quota = await consumeTurnQuota(userId ?? `ip:${req.ip ?? "unknown"}`);
  if (!quota.allowed) {
    respondAiBudgetExceeded(res, quota.retryAfterSeconds, quota.reason);
    return null;
  }

  const requestedId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
  let session = requestedId ? await loadSession(requestedId, userId, true) : null;
  if (requestedId && !session) {
    res.status(404).json({ error: "Không tìm thấy phiên hội thoại" });
    return null;
  }

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

  return {
    userId,
    message,
    session,
    masker,
    maskedMessage: masker.mask(message),
    maskedHistory: history.map((turn) => ({ ...turn, content: masker.mask(turn.content) })),
  };
}

/**
 * Ghi lượt xuống database và trả về câu chữ đã khôi phục dữ liệu cá nhân.
 *
 * Chạy y hệt nhau cho cả hai endpoint, và điều đó quan trọng hơn vẻ ngoài của nó: một lượt
 * streaming mà lưu khác một lượt thường sẽ hiện ra đúng lúc khách F5 — đoạn chat đọc lại từ
 * database không khớp thứ họ vừa nhìn thấy.
 */
async function persistTurn(
  sessionId: string,
  message: string,
  outcome: TurnOutput,
  masker: PiiMasker,
) {
  const reply = masker.restore(outcome.result.reply);
  const suggestions = outcome.result.suggestions.map((item) => masker.restore(item));

  // Lưu bản GỐC chưa che: đây là dữ liệu của khách trong database của mình, việc che chỉ áp
  // dụng ở biên gửi ra API ngoài.
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { sessionId, role: "USER", content: message } }),
    prisma.chatMessage.create({
      data: {
        sessionId,
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
      where: { id: sessionId },
      data: {
        slots: outcome.slots as unknown as Prisma.InputJsonValue,
        ...(outcome.result.escalation ? { escalated: true } : {}),
      },
    }),
  ]);

  if (outcome.result.escalation) {
    await prisma.chatEscalation.create({
      data: {
        sessionId,
        reason: outcome.result.escalation.reason,
        summary: masker.restore(outcome.result.escalation.summary),
      },
    });
  }

  return { reply, suggestions };
}

chatRouter.post("/", chatLimiter, async (req: Request, res: Response, next) => {
  try {
    const prepared = await prepareTurn(req, res);
    if (!prepared) return;

    const outcome = await handleTurn({
      sessionId: prepared.session.id,
      userId: prepared.userId,
      message: prepared.maskedMessage,
      slots: parseSlots(prepared.session.slots),
      history: prepared.maskedHistory,
      previousIntent: previousIntentOf(prepared.session.messages),
    });

    const { reply, suggestions } = await persistTurn(
      prepared.session.id, prepared.message, outcome, prepared.masker,
    );

    return res.json({
      sessionId: prepared.session.id,
      reply,
      suggestions,
      agent: outcome.agent,
      escalated: Boolean(outcome.result.escalation),
      itinerary: outcome.result.itinerary,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) return respondAiUnavailable(res);
    // Trần chi phí toàn cục đã chạm giữa lượt: 429 kèm Retry-After, không phải 500.
    if (error instanceof AiBudgetExceededError) {
      return respondAiBudgetExceeded(res, error.retryAfterSeconds);
    }
    return next(error);
  }
});

/** Nhịp giữ kết nối SSE. Dưới ngưỡng đóng-khi-rảnh của các reverse proxy thường gặp (thường 60s). */
const SSE_HEARTBEAT_MS = 15_000;

/**
 * Cùng một lượt hội thoại, nhưng đẩy tiến trình và từng đoạn chữ về ngay trong lúc nó chạy.
 *
 * VÌ SAO LÀ MỘT ENDPOINT RIÊNG CHỨ KHÔNG THAY `POST /`. Hai thứ có hợp đồng lỗi khác hẳn nhau:
 * ở đây header đi trước khi lượt bắt đầu, nên từ giây đó trở đi KHÔNG còn mã trạng thái nào để
 * trả — một lỗi giữa chừng chỉ còn cách đi ra dưới dạng một sự kiện `error` trong thân phản hồi.
 * Bộ chấm, kiểm thử tích hợp và mọi client chưa hỗ trợ SSE vẫn cần một endpoint trả 503/429 đúng
 * nghĩa, và đó là `POST /`.
 *
 * SSE chứ không phải WebSocket: luồng dữ liệu ở đây một chiều từ server xuống, chạy trên đúng
 * request POST đã có, và không cần thêm tầng nào vào kiến trúc một tiến trình hiện tại. Nhận xét
 * ở đầu file về WebSocket vẫn đứng nguyên — nó nói về chiều ngược lại, khi có nhân viên trả lời
 * trực tiếp.
 *
 * KHÁCH THẤY CHỮ TRƯỚC KHI GUARDRAIL KIỂM XONG. Đó là cái giá đã biết và đã chọn của streaming:
 * `delta` là bản xem trước chưa kiểm, `final` mới là câu trả lời thật. Khi guardrail chặn, lượt
 * này gửi `reset` để client xoá sạch rồi mới gửi `final` — xem `quiet()` trong orchestrator.
 */
chatRouter.post("/stream", chatLimiter, async (req: Request, res: Response, next) => {
  let prepared: Awaited<ReturnType<typeof prepareTurn>>;
  try {
    prepared = await prepareTurn(req, res);
  } catch (error) {
    return next(error);
  }
  if (!prepared) return;
  const turn = prepared;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  /**
   * Nhiều reverse proxy đệm phản hồi theo mặc định, và đệm một SSE nghĩa là toàn bộ sự kiện về
   * cùng một lúc ở cuối lượt — tức mất sạch thứ vừa dựng, mà lại không hỏng gì thấy được.
   */
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let open = true;
  // Khách đóng tab giữa lượt. Lượt vẫn chạy nốt và vẫn được lưu — họ mở lại là đọc được câu trả
  // lời — nhưng không ghi thêm byte nào vào một socket đã đóng.
  req.on("close", () => { open = false; });

  const send = (payload: Record<string, unknown>) => {
    if (!open) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => { if (open) res.write(": ping\n\n"); }, SSE_HEARTBEAT_MS);

  /**
   * Khôi phục dữ liệu cá nhân TRÊN DÒNG CHỮ CHẢY DẦN, không phải trên cả câu trả lời.
   *
   * `__PHONE_1__` có thể về làm hai đoạn, và gọi `masker.restore` cho từng đoạn thì không đoạn
   * nào chứa đủ ký hiệu để thay — xem `StreamingPiiRestorer`. Dựng lại từ đầu sau mỗi `reset`,
   * vì phần đang treo trong nó thuộc về đoạn văn vừa bị bỏ.
   */
  let restorer = new StreamingPiiRestorer(turn.masker);

  try {
    // Gửi sớm để client lưu được phiên ngay cả khi lượt hỏng giữa chừng: thiếu nó thì một lượt
    // đầu tiên bị lỗi sẽ mở phiên mới ở lượt sau và bỏ rơi phiên vừa tạo.
    send({ type: "session", sessionId: turn.session.id });

    const outcome = await handleTurn({
      sessionId: turn.session.id,
      userId: turn.userId,
      message: turn.maskedMessage,
      slots: parseSlots(turn.session.slots),
      history: turn.maskedHistory,
      previousIntent: previousIntentOf(turn.session.messages),
      onEvent: (event: TurnEvent) => {
        if (event.type === "delta") {
          const text = restorer.push(event.text);
          if (text) send({ type: "delta", text });
          return;
        }
        if (event.type === "reset") {
          restorer = new StreamingPiiRestorer(turn.masker);
          send({ type: "reset" });
          return;
        }
        send({ type: "stage", stage: event.stage, ...(event.detail ? { detail: event.detail } : {}) });
      },
    });

    const { reply, suggestions } = await persistTurn(
      turn.session.id, turn.message, outcome, turn.masker,
    );

    /**
     * Câu trả lời THẬT, và là thứ client phải dùng làm nội dung cuối cùng.
     *
     * Cố ý gửi đủ cả câu chứ không chỉ gửi phần còn thiếu: phần đã stream có thể lệch với nó ở
     * đuôi vì `StreamingPiiRestorer` còn giữ lại một mẩu, hoặc lệch hoàn toàn vì guardrail đã
     * thay cả câu. Client gán đè là xong, không phải đoán xem hai bên có khớp nhau không.
     */
    send({
      type: "final",
      sessionId: turn.session.id,
      reply,
      suggestions,
      agent: outcome.agent,
      escalated: Boolean(outcome.result.escalation),
      itinerary: outcome.result.itinerary,
    });
  } catch (error) {
    // Header đã đi rồi nên không còn mã trạng thái nào để trả; lỗi phải đi ra trong thân phản hồi.
    // `status` kèm theo để client dựng lại đúng cách xử lý mà nó vẫn làm với `POST /`.
    if (error instanceof AiUnavailableError) {
      send({
        type: "error",
        status: 503,
        error: "Trợ lý AI chưa được cấu hình",
        details: "Thiếu biến môi trường GEMINI_API_KEY. Tạo file .env từ .env.example rồi khởi động lại server.",
      });
    } else if (error instanceof AiBudgetExceededError) {
      send({
        type: "error",
        status: 429,
        error: "Trợ lý AI đang tạm hết hạn mức",
        details: `Bạn vui lòng thử lại sau ${Math.ceil(error.retryAfterSeconds / 60)} phút.`,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    } else {
      console.error("Lượt chat streaming lỗi:", error);
      send({ type: "error", status: 500, error: "Máy chủ gặp sự cố khi xử lý lượt này" });
    }
  } finally {
    clearInterval(heartbeat);
    if (open) res.end();
  }
});

/** Lịch sử riêng của tài khoản; không nhận userId từ client. */
chatRouter.get("/sessions", requireUser, async (req: Request, res: Response, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return res.status(400).json({ error: "Vị trí lịch sử không hợp lệ" });
    }
    const sessions = await prisma.chatSession.findMany({
      where: { userId: (req as AuthedRequest).userId, messages: { some: {} } },
      orderBy: [{ lastActiveAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: 31,
      select: {
        id: true,
        lastActiveAt: true,
        messages: {
          where: { role: "USER" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
          select: { content: true },
        },
      },
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      sessions: sessions.slice(0, 30).map((session) => ({
        id: session.id,
        title: session.messages[0]?.content.slice(0, 100) || "Cuộc trò chuyện",
        lastActiveAt: session.lastActiveAt.toISOString(),
      })),
      nextOffset: sessions.length > 30 ? offset + 30 : null,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Mở lại một hội thoại cũ khi khách CHỌN nó trong danh sách lịch sử (FR-BOT-07).
 *
 * Trước đây client còn gọi endpoint này ngay lúc mở trang, để nối lại hội thoại gần nhất. Nay
 * không còn: mỗi lần mở trang là một cuộc trò chuyện mới, nên đây là đường DUY NHẤT để một hội
 * thoại cũ quay lại màn hình — và cũng là thứ khiến thay đổi đó không làm mất gì của khách.
 */
chatRouter.get("/sessions/:id", async (req: Request, res: Response, next) => {
  try {
    const session = await loadSession(req.params.id, await optionalUserId(req, res));
    if (!session) return res.status(404).json({ error: "Không tìm thấy phiên hội thoại" });

    res.setHeader("Cache-Control", "no-store");
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

    const session = await loadSession(sessionId, await optionalUserId(req, res));
    if (!session) return res.status(404).json({ error: "Không tìm thấy phiên hội thoại" });

    await prisma.chatSession.update({ where: { id: session.id }, data: { satisfaction } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
