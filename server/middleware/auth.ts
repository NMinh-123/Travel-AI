import jwt from "jsonwebtoken";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { config } from "@server/config";
import { asyncRoute } from "./asyncHandler";
import { prisma } from "@server/infra/db";

/**
 * Phiên đăng nhập ở tầng HTTP: phát cookie, đọc cookie, chặn route.
 *
 * Việc băm mật khẩu nằm ở @server/domain/password, còn hình dạng bản ghi user trả cho client
 * nằm ở @server/domain/mappers — ba mối quan tâm khác nhau, ba file khác nhau, để khi truy một
 * lỗi đăng nhập ta biết ngay phải mở file nào.
 */

const SESSION_COOKIE = "travel_ai_session";
const SESSION_DAYS = 7;

interface SessionPayload {
  sub: string;
}

/**
 * Token nằm trong cookie httpOnly, không phải localStorage: script trên trang không đọc
 * được nó, nên một lỗi XSS ở đâu đó cũng không lấy được session.
 */
export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId } satisfies SessionPayload, config.jwtSecret, {
    expiresIn: `${SESSION_DAYS}d`,
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
  });
}

function readUserId(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) return null;

  try {
    const payload = jwt.verify(token, config.jwtSecret) as SessionPayload;
    return typeof payload?.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    // Token hết hạn hoặc bị sửa — coi như chưa đăng nhập, không phải lỗi server.
    return null;
  }
}

export type AuthedRequest = Request & { userId: string };

/**
 * Chặn mọi thứ dưới /api/me. Cookie không hợp lệ hoặc user đã bị xoá đều trả 401 để client
 * biết cần đăng nhập lại, thay vì 500 như một sự cố server.
 */
const loadUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Bạn cần đăng nhập để thực hiện việc này" });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    clearSession(res);
    res.status(401).json({ error: "Phiên đăng nhập không còn hợp lệ" });
    return;
  }

  (req as AuthedRequest).userId = userId;
  next();
};

/**
 * Bọc qua asyncRoute: truy vấn `prisma.user.findUnique` ở trên là một await, nên database lỗi
 * làm middleware này reject. Không bọc thì mọi request tới /api/me sập tiến trình.
 */
export const requireUser: RequestHandler = asyncRoute(loadUser);

/** Dùng cho GET /api/auth/me: không có session thì trả null chứ không phải lỗi. */
export function optionalUserId(req: Request): string | null {
  return readUserId(req);
}
