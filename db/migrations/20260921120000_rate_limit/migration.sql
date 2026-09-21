-- Bộ đếm hạn mức chuyển từ bộ nhớ tiến trình xuống database.
--
-- Giới hạn tần suất trước đây đếm bằng một Map trong server/middleware/rateLimit.ts. Ghi chú ở
-- đó đã nêu đúng hai hệ quả, và đây là migration để bỏ chúng: số đếm không còn mất khi khởi động
-- lại, và nhiều instance cùng đọc một bộ đếm thay vì mỗi instance một bộ riêng.
--
-- `key` là sha256 của khoá thật (IP + đường dẫn, hoặc email) nên bảng này không trở thành danh
-- sách email và IP; `scope` giữ dạng đọc được để đếm theo nhóm.

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

CREATE INDEX "RateLimit_scope_idx" ON "RateLimit"("scope");
