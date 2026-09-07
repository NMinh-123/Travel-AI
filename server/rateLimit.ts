import type { NextFunction, Request, Response } from "express";

/**
 * Giới hạn tần suất theo IP cho nhóm /api/auth, để form đăng nhập không thành chỗ dò mật
 * khẩu bằng vét cạn.
 *
 * Cố tình không thêm dependency: bộ đếm nằm trong bộ nhớ của tiến trình. Hệ quả cần biết —
 * chạy nhiều instance thì mỗi instance đếm riêng, và số đếm mất khi khởi động lại. Đủ cho
 * một máy chủ đơn lẻ; muốn siết chặt hơn thì cần một bộ đếm dùng chung (Redis) hoặc giới
 * hạn ở tầng reverse proxy.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Dọn định kỳ để Map không phình theo số IP đã từng gọi. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

// Không giữ tiến trình sống chỉ vì timer này.
cleanupTimer.unref?.();

export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: options.message,
        details: `Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      });
      return;
    }

    next();
  };
}
