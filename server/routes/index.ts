import { Router } from "express";
import { authRouter } from "./auth";
import { chatRouter } from "./chat";
import { contentRouter } from "./content";
import { healthRouter } from "./health";
import { itineraryRouter } from "./itinerary";
import { meRouter } from "./me";

/**
 * Bảng mục lục của toàn bộ HTTP API. Muốn biết một đường dẫn `/api/...` chạy vào file nào thì
 * mở đúng file này — không phải đọc rải rác trong phần khởi động server.
 *
 *   GET  /api/health          routes/health.ts
 *   GET  /api/config          routes/health.ts
 *   POST /api/plan-itinerary  routes/itinerary.ts
 *   *    /api/auth/*          routes/auth.ts
 *   *    /api/me/*            routes/me.ts
 *   *    /api/content/*       routes/content.ts
 *   *    /api/chat/*          routes/chat.ts
 */
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(itineraryRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/content", contentRouter);
apiRouter.use("/chat", chatRouter);
