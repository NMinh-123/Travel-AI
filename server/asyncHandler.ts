import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Bọc handler async cho Express 4.
 *
 * Express 4 không biết gì về promise: một handler `async` bị reject không đi vào error handler,
 * nó thoát ra ngoài thành unhandled rejection — và Node từ v15 coi unhandled rejection là lỗi
 * chí mạng, tiến trình chết ngay. Hệ quả thực tế: chỉ cần database không kết nối được, một
 * request POST /api/auth/login đủ làm sập cả server và client không nhận được phản hồi nào.
 *
 * Mọi handler async PHẢI đi qua đây (hoặc tự try/catch như server/routes/chat.ts), để lỗi thành
 * một phản hồi JSON 500 từ error handler ở server.ts thay vì thành sự cố toàn cục.
 */
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown | Promise<unknown>;

export function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    // Promise.resolve bọc được cả handler đồng bộ, nên dùng chung một cách gói cho mọi route.
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
