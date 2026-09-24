-- Phiên bản phiên đăng nhập: tăng lên là mọi JWT đã phát cho user đó mất hiệu lực.
-- Hàng cũ nhận 0, khớp với token cũ không mang `ver`, nên không ai bị đăng xuất khi triển khai.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
