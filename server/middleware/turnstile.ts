import type { RequestHandler } from "express";
import { config, hasTurnstile } from "@server/config";

/**
 * CLOUDFLARE TURNSTILE cho form đăng nhập và đăng ký — lớp chặn bot đứng trước giới hạn theo IP
 * và theo email ở server/routes/auth.ts, không thay chúng.
 *
 * Client gửi token trong trường `turnstileToken` của body. Mỗi token dùng được MỘT lần và sống
 * vài phút, nên client phải lấy token mới sau mỗi lần gửi (xem AuthModal).
 *
 * Chưa cấu hình (thiếu một trong hai khoá) thì bỏ qua: dev, test và E2E chạy như cũ.
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const requireTurnstile: RequestHandler = async (req, res, next) => {
  if (!hasTurnstile()) return next();

  const token = typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : "";
  if (!token) {
    return res.status(400).json({ error: "Vui lòng hoàn tất bước xác minh chống bot rồi thử lại" });
  }

  let verdict: { success?: boolean };
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      body: new URLSearchParams({ secret: config.turnstileSecretKey, response: token, remoteip: req.ip ?? "" }),
      signal: AbortSignal.timeout(5000),
    });
    verdict = (await response.json()) as { success?: boolean };
  } catch (error) {
    /**
     * Không hỏi được Cloudflare thì TỪ CHỐI, không cho qua: cho qua nghĩa là kẻ tấn công chỉ cần
     * làm chậm được một lượt gọi này là vượt được lớp chặn. Đổi lại, sự cố của Cloudflare làm
     * tạm ngừng đăng nhập bằng email — đăng nhập Google không đi qua đây nên vẫn dùng được.
     */
    console.error("Không gọi được Turnstile siteverify:", error instanceof Error ? error.name : error);
    return res.status(503).json({ error: "Chưa xác minh được chống bot lúc này, vui lòng thử lại sau ít phút" });
  }

  if (verdict.success !== true) {
    return res.status(400).json({ error: "Xác minh chống bot không thành công, vui lòng thử lại" });
  }
  return next();
};
