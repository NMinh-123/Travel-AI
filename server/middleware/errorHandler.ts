import type { ErrorRequestHandler } from "express";
import { config } from "@server/config";

/**
 * Mọi lỗi dưới /api phải trả về JSON. Nếu không có handler này, body JSON sai cú pháp sẽ khiến
 * Express trả về trang HTML mặc định và client không đọc được thông báo lỗi.
 *
 * Phải đăng ký SAU khi mount apiRouter (xem server/app.ts), nếu không lỗi từ các router sẽ lọt
 * qua nó.
 */
export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isBadJson = err?.type === "entity.parse.failed";
  /**
   * Body vượt trần (xem DEFAULT_BODY_LIMIT trong server/app.ts) phải nói rõ là vượt trần.
   *
   * Nếu không, nó rơi vào nhánh 500 "Lỗi máy chủ" bên dưới và người gửi đi tìm một sự cố không
   * tồn tại — trong khi thứ họ cần biết là gửi ít dữ liệu hơn. Đây là lỗi của phía gửi, nên nó
   * cũng không được ghi vào log lỗi server.
   */
  const isTooLarge = err?.type === "entity.too.large";
  const status = isBadJson ? 400 : isTooLarge ? 413 : (err?.status ?? 500);

  if (!isBadJson && !isTooLarge) console.error("Unhandled API error:", err);

  if (isTooLarge) {
    return res.status(413).json({
      error: "Nội dung yêu cầu quá lớn",
      details: "Bạn vui lòng gửi ít dữ liệu hơn trong một lần.",
    });
  }

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
};
