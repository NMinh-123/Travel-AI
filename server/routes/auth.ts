import { Router } from "express";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config, hasGoogleCredentials } from "../config";
import { prisma } from "../db";
import {
  MIN_PASSWORD_LENGTH,
  clearSession,
  issueSession,
  optionalUserId,
  userWithRelations,
} from "../auth";
import { hashPassword, verifyPassword } from "../auth";
import { toUserProfile } from "../mappers";
import { rateLimit } from "../rateLimit";
import { asyncRoute } from "../asyncHandler";

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
        badges: { create: { label: "Thành Viên Mới Travel AI" } },
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

authRouter.post(
  "/login",
  authLimiter,
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = parseCredentials(req.body, false);
    if (typeof parsed === "string") {
      // Kể cả lỗi định dạng cũng không nên tiết lộ gì thêm ở bước đăng nhập.
      return res.status(400).json({ error: INVALID_CREDENTIALS });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      include: userWithRelations,
    });

    if (!user?.passwordHash || !(await verifyPassword(parsed.password, user.passwordHash))) {
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
        badges: { create: { label: "Thành Viên Mới Travel AI" } },
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
