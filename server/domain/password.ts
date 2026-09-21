import bcrypt from "bcryptjs";

/**
 * Băm và đối chiếu mật khẩu. Tách khỏi @server/middleware/auth vì đây là nghiệp vụ thuần: nó
 * không biết gì về express, và db/seed.ts phải dùng được nó mà không kéo theo cả tầng HTTP.
 */

/**
 * Cost 12: khoảng 200-300ms mỗi lần băm trên máy thường. Đủ chậm để chống dò offline, đủ
 * nhanh để không thành cửa ngõ tấn công từ chối dịch vụ ở tầng đăng nhập.
 */
const BCRYPT_COST = 12;

/** Frontend cũng phải kiểm cùng ngưỡng này, xem client/components/AuthModal.tsx. */
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
