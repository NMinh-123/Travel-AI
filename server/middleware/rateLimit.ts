import type { Request, RequestHandler, Response } from "express";
import { asyncRoute } from "./asyncHandler";
import { consume } from "@server/infra/rateLimitStore";

/**
 * Giới hạn tần suất theo IP, để form đăng nhập không thành chỗ dò mật khẩu bằng vét cạn và
 * chatbot không thành chỗ đốt hạn mức model.
 *
 * Bộ đếm nằm ở @server/infra/rateLimitStore (Postgres, dùng chung giữa các instance). File này
 * chỉ còn phần HTTP: lấy khoá từ request, và dịch kết quả thành 429 kèm `Retry-After`.
 *
 * `req.ip` CHỈ ĐÚNG KHI `trust proxy` ĐÃ ĐƯỢC ĐẶT ĐÚNG — xem readTrustProxy() trong
 * server/config.ts. Sau một reverse proxy mà không khai, mọi request mang IP của proxy và cả
 * thiên hạ dùng chung một bộ đếm: người dùng thật bị chặn nhầm, còn kẻ tấn công thì chỉ cần một
 * IP là đủ để chặn cả hệ thống. Khai quá tay cũng sai theo hướng ngược lại: tin một header mà
 * client tự đặt được thì đổi header là đổi bộ đếm, tức không còn giới hạn nào.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  /**
   * Nhóm ghi vào cột `scope` của bảng đếm. Mặc định "ip-path" — đủ cho mọi nơi đang dùng; đặt
   * tên khác khi cần đếm riêng một bề mặt trong lúc vận hành.
   */
  scope?: string;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return asyncRoute(async (req: Request, res: Response, next) => {
    const result = await consume({
      // Đường dẫn nằm trong khoá: 20 lần đăng nhập sai không được ăn vào hạn mức của đăng ký.
      key: `ip:${req.ip ?? "unknown"}:${req.path}`,
      scope: options.scope ?? "ip-path",
      windowMs: options.windowMs,
      max: options.max,
    });

    if (result.allowed) return next();

    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({
      error: options.message,
      details: `Vui lòng thử lại sau ${result.retryAfterSeconds} giây.`,
    });
  });
}
