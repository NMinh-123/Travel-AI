import express from "express";
import cookieParser from "cookie-parser";
import { config } from "@server/config";
import { apiErrorHandler } from "@server/middleware/errorHandler";
import { originCheck } from "@server/middleware/originCheck";
import { securityHeaders } from "@server/middleware/securityHeaders";
import { apiRouter } from "@server/routes";

/**
 * Lắp ráp ứng dụng express — và CHỈ có thế. Không mở cổng, không đụng Vite, không spawn tiến
 * trình con: những việc đó nằm ở server/index.ts.
 *
 * Tách như vậy để lớp HTTP kiểm thử được mà không phải khởi động cả hệ thống, và để thứ tự
 * đăng ký middleware — thứ quyết định vì sao một request rơi vào nhánh nào — đọc hết trong
 * một màn hình.
 */

/**
 * TRẦN KÍCH THƯỚC BODY, và vì sao nó không còn là một con số duy nhất.
 *
 * Trước đây mọi route dùng chung `5mb`. Không route nào cần tới mức đó: tin nhắn chat bị cắt ở
 * 2.000 ký tự, ghi chú lịch trình ở 1.000, ID token của Google khoảng 1–2 KB. Nghĩa là trần ấy
 * chỉ có tác dụng duy nhất là cho phép ai đó bắt server phân giải 5 MB JSON cho mỗi request tới
 * form đăng nhập — một cách rất rẻ để đốt CPU và bộ nhớ của người khác.
 *
 * 64 KB là mức rộng gấp nhiều lần mọi thứ đang gửi thật. Ngoại lệ duy nhất là lưu lịch trình:
 * body ở đó là cả kế hoạch nhiều ngày (`days` được lưu nguyên dạng Json), nên nó có trần riêng.
 */
const DEFAULT_BODY_LIMIT = "64kb";
const ITINERARY_BODY_LIMIT = "256kb";

export function createApp(): express.Express {
  const app = express();

  /** Không quảng cáo framework và phiên bản cho người đang dò. */
  app.disable("x-powered-by");

  /**
   * PHẢI đặt trước mọi middleware đọc `req.ip`. Xem readTrustProxy() trong server/config.ts về
   * việc vì sao giá trị này không có mặc định an toàn và phải do người vận hành khai.
   */
  app.set("trust proxy", config.trustProxy);

  // Header bảo mật áp cho MỌI phản hồi, nên nó đứng đầu — kể cả trang tĩnh và cả phản hồi lỗi.
  app.use(securityHeaders);

  /**
   * Kiểm `Origin` đứng TRƯỚC khi phân giải body: request từ một trang khác thì không có lý do gì
   * để ta bỏ công đọc body của nó.
   */
  app.use("/api", originCheck);

  /**
   * Trần riêng đăng ký TRƯỚC trần mặc định, và thứ tự này là bắt buộc chứ không phải thẩm mỹ:
   * body-parser đánh dấu request đã phân giải, nên bộ nào chạy trước thì bộ sau bỏ qua. Đảo lại
   * thứ tự thì trần mặc định 64 KB chặn mất lịch trình dài trước khi trần riêng kịp chạy.
   */
  app.use("/api/me/itineraries", express.json({ limit: ITINERARY_BODY_LIMIT }));
  app.use(express.json({ limit: DEFAULT_BODY_LIMIT }));

  // Session nằm trong cookie httpOnly nên phải đọc được cookie trước mọi route.
  app.use(cookieParser());

  app.use("/api", apiRouter);
  // Phải đứng SAU apiRouter: express chỉ gọi error handler đăng ký sau nơi lỗi phát sinh.
  app.use("/api", apiErrorHandler);

  return app;
}
