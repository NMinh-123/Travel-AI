-- Bảng cache cho tầng dữ liệu động (SRS Mục 11.1.1.3 và 11.1.1.7).
--
-- CẢNH BÁO CHO NGƯỜI SINH MIGRATION LẦN SAU: bản do `prisma migrate dev` sinh ra cho migration
-- này có kèm hai câu lệnh đã bị XOÁ BỎ khỏi đây:
--
--     DROP INDEX "knowledgedoc_embedding_hnsw";
--     DROP INDEX "knowledgedoc_search_gin";
--
-- Hai index đó được tạo bằng raw SQL trong migration 20260906000000_chat_and_knowledge, trên hai
-- cột kiểu `Unsupported` (`vector(1024)` và `tsvector`). Prisma không mô hình hoá được chúng nên
-- mỗi lần so sánh schema nó đều coi chúng là drift và đề nghị xoá.
--
-- Để nguyên hai câu lệnh đó là phá tầng RAG mà KHÔNG có lỗi nào báo: truy vấn vector sẽ chuyển
-- sang quét tuần tự toàn bảng, nhánh từ khoá mất index GIN, và biểu hiện duy nhất là chatbot chậm
-- dần khi kho tri thức lớn lên. Không có test nào bắt được, vì kết quả trả về vẫn đúng.
--
-- Quy tắc: MỌI migration sinh tự động từ nay phải được đọc lại và gỡ hai câu DROP INDEX này trước
-- khi áp.

-- CreateTable
CREATE TABLE "RealtimeCache" (
    "key" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
--
-- Index theo expiresAt phục vụ hai truy vấn khác nhau: điều kiện `expiresAt > now()` ở mỗi lượt
-- đọc cache, và câu xoá của bộ quét định kỳ. Không có index này thì mỗi lượt đọc cache là một lần
-- quét bảng — tức cache trở thành thứ làm chậm hệ thống thay vì làm nhanh.
CREATE INDEX "RealtimeCache_expiresAt_idx" ON "RealtimeCache"("expiresAt");

-- Index theo tool để soi được lượng gọi và tỷ lệ trúng cache theo từng nhà cung cấp khi cần
-- kiểm tra hoá đơn API.
CREATE INDEX "RealtimeCache_tool_idx" ON "RealtimeCache"("tool");
