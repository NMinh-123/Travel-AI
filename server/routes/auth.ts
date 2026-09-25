import { Router } from "express";
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { createHmac, randomInt } from "node:crypto";
import { config, hasGoogleCredentials, hasMailer } from "@server/config";
import { sendMail } from "@server/infra/mailer";
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
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  message: "Bạn đã thử quá nhiều lần",
});

/**
 * Hash giả, băm cùng cost với hash thật, để đăng nhập bằng email không có mật khẩu (không tồn
 * tại, hoặc chỉ đăng nhập Google) vẫn tốn đúng một lượt bcrypt. Bỏ qua bcrypt ở nhánh đó thì
 * thời gian phản hồi chênh hàng chục lần, đủ để liệt kê email dù câu báo lỗi giống hệt nhau.
 */
const DUMMY_HASH = hashPassword(crypto.randomUUID());

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

    issueSession(res, user.id, user.sessionVersion);
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
    if (failures.count >= config.loginFailureMax) {
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

    const passwordOk = await verifyPassword(parsed.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user?.passwordHash || !passwordOk) {
      /**
       * Đếm cả trường hợp email không tồn tại. Nếu chỉ đếm khi email có thật thì chính bộ đếm
       * trở thành một cách liệt kê tài khoản: gõ sai 11 lần, ai trả 429 thì email đó tồn tại.
       */
      await consume({
        key: loginFailureKey(parsed.email),
        scope: "login-email",
        windowMs: config.loginFailureWindowMs,
        max: config.loginFailureMax,
      });
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    issueSession(res, user.id, user.sessionVersion);
    return res.json({ user: toUserProfile(user) });
  }),
);

/**
 * QUÊN MẬT KHẨU bằng mã OTP 6 chữ số gửi qua email.
 *
 * Mã ngắn thì dễ gõ nhưng chỉ có một triệu khả năng, nên ba lớp chặn dưới đây là BẮT BUỘC chứ
 * không phải tuỳ chọn:
 *  - Mỗi mã chỉ được nhập sai `PASSWORD_RESET_MAX_ATTEMPTS` lần, quá thì mã hỏng.
 *  - Mỗi email chỉ xin được `PASSWORD_RESET_MAX` mã mỗi giờ.
 *  → Tối đa khoảng 15 lần đoán mỗi giờ trên một triệu khả năng.
 *  - Database chỉ giữ HMAC của mã với khoá là JWT_SECRET. SHA-256 trần của 6 chữ số thì bị dò
 *    ngược trong tích tắc nếu bản sao database bị lộ; có HMAC thì phải lộ cả khoá.
 */
const INVALID_RESET_CODE = "Mã xác nhận không đúng hoặc đã hết hạn";
const RESET_CODE_PATTERN = /^\d{6}$/;

/** Gắn email vào HMAC để cùng một mã ở hai tài khoản cho ra hai giá trị khác nhau. */
export function hashResetCode(email: string, code: string): string {
  return createHmac("sha256", config.jwtSecret).update(`password-reset:${email}:${code}`).digest("hex");
}

async function sendPasswordResetCode(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetCodeHash: hashResetCode(email, code),
      passwordResetExpiresAt: new Date(Date.now() + config.passwordResetTtlMs),
      passwordResetAttempts: 0,
    },
  });

  await sendMail({
    to: email,
    subject: `${code} là mã đặt lại mật khẩu Ha Giang Travel`,
    text:
      `Mã đặt lại mật khẩu của bạn: ${code}\n\n` +
      `Nhập mã này vào hộp thoại trên trang trong 15 phút. Đừng chia sẻ mã cho bất kỳ ai.\n\n` +
      `Nếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.`,
    html:
      `<p>Mã đặt lại mật khẩu của bạn:</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>` +
      `<p>Nhập mã này vào hộp thoại trên trang trong 15 phút. Đừng chia sẻ mã cho bất kỳ ai.</p>` +
      `<p>Nếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.</p>`,
  });
}

authRouter.post(
  "/forgot-password",
  authLimiter,
  requireTurnstile,
  asyncRoute(async (req: Request, res: Response) => {
    if (!hasMailer()) {
      return res.status(503).json({
        error: "Chức năng quên mật khẩu chưa được cấu hình",
        details: "Thiếu RESEND_API_KEY hoặc MAIL_FROM trên server.",
      });
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "Địa chỉ email không đúng định dạng" });
    }

    // Đếm cả email không tồn tại, như bộ đếm đăng nhập: chỉ đếm email có thật thì mã 429 thành
    // cách liệt kê tài khoản.
    const quota = await consume({
      key: `password-reset:${email}`,
      scope: "password-reset-email",
      windowMs: config.passwordResetWindowMs,
      max: config.passwordResetMax,
    });
    if (!quota.allowed) {
      res.setHeader("Retry-After", String(quota.retryAfterSeconds));
      return res.status(429).json({
        error: "Email này vừa nhận nhiều mã đặt lại mật khẩu",
        details: `Kiểm tra hộp thư (cả mục Spam) hoặc thử lại sau ${Math.ceil(quota.retryAfterSeconds / 60)} phút.`,
      });
    }

    /**
     * Trả lời NGAY, rồi mới tra user và gửi thư. Chờ xong mới trả thì email có tài khoản phản hồi
     * chậm hơn hẳn (một lượt ghi DB và một lượt gọi Resend) — lại là cách liệt kê email bằng thời
     * gian, cùng loại với lỗi đã sửa ở /login. Câu trả lời cũng giống hệt nhau cho mọi email.
     */
    res.status(202).json({ ok: true });
    sendPasswordResetCode(email).catch((error) => {
      console.error("Không gửi được mã đặt lại mật khẩu:", error);
    });
  }),
);

authRouter.post(
  "/reset-password",
  authLimiter,
  asyncRoute(async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!EMAIL_PATTERN.test(email) || !RESET_CODE_PATTERN.test(code)) {
      return res.status(400).json({ error: INVALID_RESET_CODE });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }

    /**
     * Không tra user trước. Mọi request, dù email có tài khoản hay không, mã đúng hay sai, đều đi
     * cùng một đường: một lượt bcrypt rồi hai câu UPDATE có điều kiện. Rẽ nhánh sớm theo "có user
     * không" thì thời gian phản hồi lại lộ email nào có tài khoản.
     *
     * Điều kiện nằm trong chính câu UPDATE, nên hai request cùng mã chạy song song chỉ một cái
     * khớp, và mã đã hỏng vì sai quá số lần thì không bao giờ khớp nữa. Tăng sessionVersion để đá
     * mọi phiên cũ ra — người quên mật khẩu có thể đang bị kẻ khác dùng tài khoản.
     *
     * Tài khoản chỉ đăng nhập Google (chưa có mật khẩu) cũng đặt được mật khẩu qua đây: nhận được
     * mã ở hộp thư là đã chứng minh sở hữu email, như chính Google đã làm.
     */
    const passwordHash = await hashPassword(password);
    const { count } = await prisma.user.updateMany({
      where: {
        email,
        passwordResetCodeHash: hashResetCode(email, code),
        passwordResetExpiresAt: { gt: new Date() },
        passwordResetAttempts: { lt: config.passwordResetMaxAttempts },
      },
      data: {
        passwordHash,
        passwordResetCodeHash: null,
        passwordResetExpiresAt: null,
        passwordResetAttempts: 0,
        sessionVersion: { increment: 1 },
      },
    });

    if (count === 0) {
      // Email không tồn tại hay không có mã đang chờ thì câu này khớp 0 hàng — vẫn chạy để hai
      // nhánh tốn như nhau.
      await prisma.user.updateMany({
        where: { email, passwordResetCodeHash: { not: null } },
        data: { passwordResetAttempts: { increment: 1 } },
      });
      return res.status(400).json({ error: INVALID_RESET_CODE });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: userWithRelations });
    issueSession(res, user.id, user.sessionVersion);
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
     * tài khoản cũ, không tạo ra bản ghi thứ hai.
     *
     * Lần ĐẦU gộp thì xoá mật khẩu và thu hồi mọi phiên cũ. Đăng ký bằng mật khẩu không xác thực
     * email, nên kẻ tấn công có thể mở trước tài khoản bằng email của nạn nhân; nếu giữ mật khẩu
     * đó thì sau khi nạn nhân đăng nhập Google, kẻ tấn công vẫn vào được và thấy mọi thứ nạn nhân
     * lưu. Google đã xác thực email, còn mật khẩu thì chưa ai chứng minh là của chủ email.
     */
    const existing = await prisma.user.findUnique({ where: { email }, select: { googleId: true } });
    const firstLink = existing !== null && existing.googleId === null;

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
        ...(firstLink ? { passwordHash: null, sessionVersion: { increment: 1 } } : {}),
      },
      include: userWithRelations,
    });

    issueSession(res, user.id, user.sessionVersion);
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
    const userId = await optionalUserId(req, res);
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
