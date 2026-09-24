import { Router } from "express";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config, hasGoogleCredentials } from "@server/config";
import { prisma } from "@server/infra/db";
import { clearSession, issueSession, optionalUserId } from "@server/middleware/auth";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@server/domain/password";
import { toUserProfile, userWithRelations } from "@server/domain/mappers";
import { rateLimit } from "@server/middleware/rateLimit";
import { requireTurnstile } from "@server/middleware/turnstile";
import { consume, peek } from "@server/infra/rateLimitStore";
import { asyncRoute } from "@server/middleware/asyncHandler";

export const authRouter = Router();

/**
 * Form đăng nhập và đăng ký là hai bề mặt bị dò nhiều nhất, nên giới hạn tần suất theo IP.
 * Ngưỡng đặt thoáng để không cản người dùng gõ sai vài lần.
 */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Bạn đã thử quá nhiều lần",
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Ảnh đại diện mặc định sinh từ email, không cần dịch vụ ngoài lưu ảnh. */
function defaultAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

interface Credentials {
  email: string;
  password: string;
  name?: string;
}

function parseCredentials(body: any, requireName: boolean): Credentials | string {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!EMAIL_PATTERN.test(email)) return "Địa chỉ email không đúng định dạng";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  if (requireName && !name) return "Vui lòng nhập họ và tên của bạn";

  return { email, password, name: name || undefined };
}

authRouter.post(
  "/register",
  authLimiter,
  requireTurnstile,
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = parseCredentials(req.body, true);
    if (typeof parsed === "string") return res.status(400).json({ error: parsed });

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Email này đã được sử dụng" });
    }

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name!,
        avatar: defaultAvatar(parsed.name!),
        passwordHash: await hashPassword(parsed.password),
        provider: "EMAIL",
        riderLevel: "BEGINNER",
      },
      include: userWithRelations,
    });

    issueSession(res, user.id);
    return res.status(201).json({ user: toUserProfile(user) });
  }),
);

/**
 * Sai email và sai mật khẩu trả về **cùng một** thông báo: nếu phân biệt, kẻ tấn công sẽ
 * dùng chính form này để liệt kê email nào có tài khoản trên hệ thống.
 */
const INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng";

/**
 * CHẶN DÒ MẬT KHẨU THEO TÀI KHOẢN — bổ sung cho giới hạn theo IP, không thay nó.
 *
 * `authLimiter` chặn một IP gửi quá nhiều. Nó không chặn được kiểu tấn công phổ biến hơn hẳn:
 * rải thử qua nhiều IP (botnet, proxy thuê theo giờ), mỗi IP chỉ thử vài lần nên IP nào cũng nằm
 * trong hạn mức. Đếm theo EMAIL thì mọi lần thử vào cùng một tài khoản gặp cùng một bộ đếm, bất
 * kể chúng đến từ đâu.
 *
 * CHỈ ĐẾM LẦN THẤT BẠI. Đếm cả lần thành công thì một người đăng nhập đúng trên nhiều thiết bị
 * trong buổi sáng sẽ tự chặn chính mình — và đó là kiểu giới hạn mà người vận hành sẽ tắt sau
 * lần thứ hai bị gọi điện, tức là còn tệ hơn không có.
 *
 * ĐÁNH ĐỔI PHẢI BIẾT: ai cũng làm được cho email của người khác chạm trần, nên đây cũng là một
 * lối gây khó chịu cho chủ tài khoản. Vì thế cửa sổ ngắn (15 phút, không phải khoá tài khoản) và
 * trần đặt ở 10 — cao hơn số lần một người gõ sai mật khẩu của chính mình, thấp hơn nhiều mức
 * cần để dò trúng một mật khẩu dù yếu.
 */
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_MAX = 10;

function loginFailureKey(email: string): string {
  return `login:${email}`;
}

authRouter.post(
  "/login",
  authLimiter,
  requireTurnstile,
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = parseCredentials(req.body, false);
    if (typeof parsed === "string") {
      // Kể cả lỗi định dạng cũng không nên tiết lộ gì thêm ở bước đăng nhập.
      return res.status(400).json({ error: INVALID_CREDENTIALS });
    }

    /**
     * Kiểm trần TRƯỚC khi so mật khẩu, và cũng trước cả khi tra database. Hai lý do: không tiêu
     * một lượt băm bcrypt cho một request chắc chắn bị từ chối (bcrypt cố tình đắt, nên nó cũng
     * là một lối đốt CPU), và không tiết lộ qua thời gian phản hồi rằng email đó có tồn tại.
     */
    const failures = await peek(loginFailureKey(parsed.email));
    if (failures.count >= LOGIN_FAILURE_MAX) {
      res.setHeader("Retry-After", String(failures.retryAfterSeconds));
      return res.status(429).json({
        error: "Tài khoản này vừa có quá nhiều lần đăng nhập sai",
        details: `Vui lòng thử lại sau ${Math.ceil(failures.retryAfterSeconds / 60)} phút.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      include: userWithRelations,
    });

    if (!user?.passwordHash || !(await verifyPassword(parsed.password, user.passwordHash))) {
      /**
       * Đếm cả trường hợp email không tồn tại. Nếu chỉ đếm khi email có thật thì chính bộ đếm
       * trở thành một cách liệt kê tài khoản: gõ sai 11 lần, ai trả 429 thì email đó tồn tại.
       */
      await consume({
        key: loginFailureKey(parsed.email),
        scope: "login-email",
        windowMs: LOGIN_FAILURE_WINDOW_MS,
        max: LOGIN_FAILURE_MAX,
      });
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    issueSession(res, user.id);
    return res.json({ user: toUserProfile(user) });
  }),
);

let googleClient: OAuth2Client | null = null;

authRouter.post(
  "/google",
  authLimiter,
  asyncRoute(async (req: Request, res: Response) => {
    if (!hasGoogleCredentials()) {
      return res.status(503).json({
        error: "Đăng nhập Google chưa được cấu hình",
        details: "Thiếu biến môi trường GOOGLE_CLIENT_ID trên server.",
      });
    }

    const credential = req.body?.credential;
    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({ error: "Thiếu ID token từ Google" });
    }

    googleClient ??= new OAuth2Client(config.googleClientId);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error("Google verifyIdToken thất bại:", error);
      return res.status(401).json({ error: "Không xác thực được tài khoản Google" });
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: "Tài khoản Google chưa xác thực email" });
    }

    const email = payload.email.toLowerCase();
    const name = payload.name?.trim() || email.split("@")[0];

    /**
     * Gộp theo email: người đã đăng ký bằng mật khẩu rồi bấm đăng nhập Google vẫn vào đúng
     * tài khoản cũ, không tạo ra bản ghi thứ hai. `passwordHash` giữ nguyên nên họ vẫn đăng
     * nhập được bằng mật khẩu.
     */
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        avatar: payload.picture ?? defaultAvatar(name),
        provider: "GOOGLE",
        googleId: payload.sub,
        riderLevel: "BEGINNER",
      },
      update: {
        googleId: payload.sub,
        ...(payload.picture ? { avatar: payload.picture } : {}),
      },
      include: userWithRelations,
    });

    issueSession(res, user.id);
    return res.json({ user: toUserProfile(user) });
  }),
);

authRouter.post(
  "/logout",
  asyncRoute((_req: Request, res: Response) => {
    clearSession(res);
    return res.status(204).end();
  }),
);

/** Frontend gọi endpoint này khi mở trang để biết cookie hiện tại còn hiệu lực hay không. */
authRouter.get(
  "/me",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = optionalUserId(req);
    if (!userId) return res.json({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRelations,
    });

    if (!user) {
      clearSession(res);
      return res.json({ user: null });
    }

    return res.json({ user: toUserProfile(user) });
  }),
);
