import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import {
  browsableUrl,
  config,
  hasGeminiCredentials,
  hasGoogleCredentials,
} from "./server/config";
import { isDatabaseReachable } from "./server/db";
import { asyncRoute } from "./server/asyncHandler";
import { AiUnavailableError, respondAiUnavailable } from "./server/gemini";
import { ItineraryGenerationError, generateItinerary } from "./server/itineraryCore";
import { authRouter } from "./server/routes/auth";
import { chatRouter } from "./server/routes/chat";
import { contentRouter } from "./server/routes/content";
import { meRouter } from "./server/routes/me";
import { BUDGET_LEVELS, TRAVEL_MODES, VIBES, type ItineraryRequest } from "./server/prompts";

const app = express();

app.use(express.json({ limit: "5mb" }));
// Session nằm trong cookie httpOnly nên phải đọc được cookie trước mọi route.
app.use(cookieParser());

/**
 * Health check. Trả riêng trạng thái database và Gemini để khi ứng dụng trông như bị hỏng,
 * ta biết ngay nguyên nhân nằm ở đâu thay vì phải đoán.
 */
app.get(
  "/api/health",
  asyncRoute(async (_req: Request, res: Response) => {
    const aiConfigured = hasGeminiCredentials();
    res.json({
      status: "ok",
      dbConnected: await isDatabaseReachable(),
      aiConfigured,
      model: aiConfigured ? config.geminiModel : null,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * Cấu hình công khai cho client. Client ID của Google vốn không phải bí mật, nên gửi qua đây
 * thay vì khai thêm một biến VITE_* thứ hai chứa cùng giá trị. Trả null thì nút đăng nhập
 * Google tự ẩn — không để người dùng bấm vào một nút chắc chắn lỗi.
 */
app.get("/api/config", (_req: Request, res: Response) => {
  res.json({
    googleClientId: hasGoogleCredentials() ? config.googleClientId : null,
  });
});

// Router phải mount TRƯỚC error handler của /api ở dưới, nếu không lỗi từ chúng sẽ lọt qua
// và Express trả về trang HTML mặc định thay vì JSON.
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/content", contentRouter);
app.use("/api/chat", chatRouter);

const MIN_TRIP_DAYS = 1;
const MAX_TRIP_DAYS = 14;

interface ParseResult {
  value?: ItineraryRequest;
  error?: string;
}

function parseItineraryRequest(body: any): ParseResult {
  const days = Number(body?.days);
  if (!Number.isInteger(days) || days < MIN_TRIP_DAYS || days > MAX_TRIP_DAYS) {
    return { error: `Số ngày phải là số nguyên từ ${MIN_TRIP_DAYS} đến ${MAX_TRIP_DAYS}` };
  }

  const travelMode = body?.travelMode;
  if (!TRAVEL_MODES.includes(travelMode)) {
    return { error: `Phương tiện không hợp lệ (chọn: ${TRAVEL_MODES.join(", ")})` };
  }

  const vibe = body?.vibe;
  if (!VIBES.includes(vibe)) {
    return { error: `Phong cách không hợp lệ (chọn: ${VIBES.join(", ")})` };
  }

  const budget = body?.budget;
  if (!BUDGET_LEVELS.includes(budget)) {
    return { error: `Mức ngân sách không hợp lệ (chọn: ${BUDGET_LEVELS.join(", ")})` };
  }

  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

  return { value: { days, travelMode, vibe, budget, notes } };
}

// AI Itinerary Generator Endpoint. Lõi sinh lịch trình nằm ở server/itineraryCore.ts và được
// dùng chung với tác tử itinerary trong luồng hội thoại, để hai đường vào không trả về hai kết
// quả khác nhau cho cùng một yêu cầu.
app.post("/api/plan-itinerary", async (req: Request, res: Response) => {
  const parsedRequest = parseItineraryRequest(req.body);
  if (!parsedRequest.value) {
    return res.status(400).json({ error: parsedRequest.error ?? "Yêu cầu không hợp lệ" });
  }

  try {
    const { plan } = await generateItinerary(parsedRequest.value);
    return res.json(plan);
  } catch (error: any) {
    if (error instanceof AiUnavailableError) return respondAiUnavailable(res);

    if (error instanceof ItineraryGenerationError) {
      return res.status(502).json({
        error: error.message,
        details: "Bạn vui lòng thử lại, hoặc điều chỉnh phần ghi chú thêm.",
      });
    }

    console.error("Gemini itinerary error:", error);
    return res.status(502).json({
      error: "Không thể tạo lịch trình",
      details: error?.message ?? "Vui lòng thử lại sau giây lát.",
    });
  }
});

/**
 * Mọi lỗi dưới /api phải trả về JSON. Nếu không có handler này, body JSON sai
 * cú pháp sẽ khiến Express trả về trang HTML mặc định và client không đọc được
 * thông báo lỗi.
 */
app.use("/api", (err: any, _req: Request, res: Response, _next: express.NextFunction) => {
  const isBadJson = err?.type === "entity.parse.failed";
  const status = isBadJson ? 400 : (err?.status ?? 500);

  if (!isBadJson) console.error("Unhandled API error:", err);

  /**
   * Ở production không gửi `details` ra ngoài. Lỗi của Prisma chứa đường dẫn file trên máy
   * chủ, tên bảng và địa chỉ database — hữu ích khi dev, nhưng là thông tin rò rỉ khi lên
   * production. Nội dung đầy đủ vẫn nằm trong log server ở dòng trên.
   */
  const exposeDetails = !config.isProduction || isBadJson;

  res.status(status).json({
    error: isBadJson ? "Nội dung yêu cầu không phải JSON hợp lệ" : "Lỗi máy chủ",
    details: exposeDetails ? (err?.message ?? undefined) : undefined,
  });
});

async function startServer() {
  /**
   * Tự dựng http server thay vì app.listen(): chế độ dev cần đưa chính server này cho Vite làm
   * kênh HMR (xem bên dưới), còn app.listen() thì không trả ra đối tượng đó trước khi lắng nghe.
   */
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (!config.isProduction) {
    /**
     * HMR đi chung cổng với ứng dụng, qua nâng cấp WebSocket trên chính httpServer.
     *
     * Ở chế độ middleware, mặc định Vite mở một WebSocket server RIÊNG ở cổng 24678 cố định —
     * không đổi theo PORT. Chạy hai instance dev cùng lúc, hoặc còn sót một tiến trình dev cũ,
     * thì instance sau báo "WebSocket server error: Port 24678 is already in use" rồi VẪN khởi
     * động bình thường: trang tải được nhưng HMR chết, sửa file không thấy cập nhật và cũng
     * không có lỗi nào ở màn hình. Dùng chung cổng thì cổng nào chạy được app, cổng đó chạy HMR.
     *
     * DISABLE_HMR vẫn có hiệu lực: cờ đó tắt HMR trong vite.config.ts, nên chỉ nối kênh khi nó
     * không được bật — nếu không, cấu hình nội tuyến này sẽ ghi đè và bật lại HMR.
     */
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(process.env.DISABLE_HMR === "true" ? {} : { hmr: { server: httpServer } }),
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    /**
     * Chỉ phục vụ dist/client. Bản build server (dist/server.cjs) và sourcemap của nó nằm
     * cùng nhánh dist; trỏ express.static vào cả dist sẽ công khai luôn mã nguồn server.
     */
    const distPath = path.join(process.cwd(), "dist", "client");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(config.port, config.host, () => {
    console.log(`Cinematic Highlands Server running on ${browsableUrl()}`);
    if (!hasGeminiCredentials()) {
      console.warn(
        "⚠  GEMINI_API_KEY chưa được thiết lập — các endpoint AI sẽ trả về HTTP 503.",
      );
    }
    // Một điểm cuối AI bị đổi âm thầm là thứ rất khó truy khi câu trả lời trở nên lạ, nên nó
    // được in ra lúc khởi động thay vì chỉ nằm trong .env.
    if (config.geminiBaseUrl) {
      console.log(`Gemini đi qua điểm cuối tuỳ chỉnh: ${config.geminiBaseUrl}`);
    }
  });
}

startServer();
