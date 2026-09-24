-- Mã OTP quên mật khẩu. Chỉ lưu HMAC của mã (khoá là JWT_SECRET): mã chỉ có 6 chữ số, nên một
-- hàm băm trần bị dò ngược trong tích tắc nếu bản sao database bị lộ.
ALTER TABLE "User" ADD COLUMN "passwordResetCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0;
