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
/** Ghim thuật toán lúc verify, để token ký bằng thuật toán khác (HS512, none...) bị từ chối. */
const SESSION_ALGORITHM = "HS256";

/**
 * `ver` so với `User.sessionVersion`: tăng cột đó lên là mọi token đã phát cho user ấy mất hiệu
 * lực ngay, không phải đợi hết 7 ngày. Token cũ không có `ver` được coi là 0, để lần triển khai
 * thêm cột này không đá mọi người đang đăng nhập ra ngoài.
 */
interface SessionPayload {
  sub: string;
  ver?: number;
}

/**
 * Token nằm trong cookie httpOnly, không phải localStorage: script trên trang không đọc
 * được nó, nên một lỗi XSS ở đâu đó cũng không lấy được session.
 */
export function issueSession(res: Response, userId: string, sessionVersion: number): void {
  const token = jwt.sign({ sub: userId, ver: sessionVersion } satisfies SessionPayload, config.jwtSecret, {
    algorithm: SESSION_ALGORITHM,
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

/**
 * "none": không có token, hoặc token hết hạn/bị sửa. "revoked": chữ ký đúng nhưng user đã bị xoá
 * hoặc phiên đã bị thu hồi — nơi gọi nên xoá cookie để client biết cần đăng nhập lại.
 */
type SessionState = { userId: string } | "none" | "revoked";

async function readSession(req: Request): Promise<SessionState> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) return "none";

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: [SESSION_ALGORITHM] }) as SessionPayload;
  } catch {
    // Token hết hạn hoặc bị sửa — coi như chưa đăng nhập, không phải lỗi server.
    return "none";
  }
  if (typeof payload?.sub !== "string" || !payload.sub) return "none";

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { sessionVersion: true },
  });
  if (!user || user.sessionVersion !== (payload.ver ?? 0)) return "revoked";
  return { userId: payload.sub };
}

export type AuthedRequest = Request & { userId: string };

/**
 * Chặn mọi thứ dưới /api/me. Cookie không hợp lệ hoặc user đã bị xoá đều trả 401 để client
 * biết cần đăng nhập lại, thay vì 500 như một sự cố server.
 */
const loadUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await readSession(req);
  if (session === "none") {
    res.status(401).json({ error: "Bạn cần đăng nhập để thực hiện việc này" });
    return;
  }
  if (session === "revoked") {
    clearSession(res);
    res.status(401).json({ error: "Phiên đăng nhập không còn hợp lệ" });
    return;
  }

  (req as AuthedRequest).userId = session.userId;
  next();
};

/**
 * Bọc qua asyncRoute: truy vấn `prisma.user.findUnique` ở trên là một await, nên database lỗi
 * làm middleware này reject. Không bọc thì mọi request tới /api/me sập tiến trình.
 */
export const requireUser: RequestHandler = asyncRoute(loadUser);

/**
 * Cho route mở với cả khách chưa đăng nhập: không có session hợp lệ thì trả null chứ không phải
 * lỗi. Phiên bị thu hồi thì xoá luôn cookie, như requireUser.
 */
export async function optionalUserId(req: Request, res: Response): Promise<string | null> {
  const session = await readSession(req);
  if (session === "revoked") clearSession(res);
  return typeof session === "object" ? session.userId : null;
}
