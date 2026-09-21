-- Xuất xứ và vân tay cho KnowledgeDoc.
--
-- Hai nhóm cột phục vụ hai việc khác nhau:
--   * sourceUrl / sourceClass / verifiedAt / validUntil — bản ghi tự giải thích được nó đến từ
--     đâu và còn tin được tới khi nào, thay vì phải tra ngược về file nguồn theo sourceRef.
--   * contentHash / embeddingModel / pipelineVersion — cho ingest chạy tăng dần, chỉ embed lại
--     đoạn thật sự đổi.
--
-- Mặc định chuỗi rỗng cho ba cột vân tay là có chủ đích: mọi hàng đã có sẽ không khớp bất kỳ vân
-- tay nào, nên lần ingest kế tiếp tự đánh chỉ mục lại toàn bộ một lần rồi mới vào nhịp tăng dần.
-- Không đoán vân tay cho dữ liệu cũ, vì đoán sai thì ingest sẽ bỏ qua đúng những đoạn cần sửa.

CREATE TYPE "KnowledgeSourceClass" AS ENUM ('editorial', 'crawled_verified', 'estimated');

ALTER TABLE "KnowledgeDoc"
  ADD COLUMN "sourceUrl"       TEXT,
  ADD COLUMN "sourceClass"     "KnowledgeSourceClass" NOT NULL DEFAULT 'editorial',
  ADD COLUMN "verifiedAt"      TIMESTAMP(3),
  ADD COLUMN "validUntil"      TIMESTAMP(3),
  ADD COLUMN "contentHash"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "embeddingModel"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN "pipelineVersion" TEXT NOT NULL DEFAULT '';

-- Soát nội dung hết hạn: "tài liệu crawl nào đã quá validUntil". Không có chỉ mục thì phép soát đó
-- quét toàn bảng, nên nó sẽ không bao giờ được chạy định kỳ.
CREATE INDEX "KnowledgeDoc_sourceClass_validUntil_idx" ON "KnowledgeDoc"("sourceClass", "validUntil");

-- Nội dung crawl và nội dung ước lượng bắt buộc phải có nguồn: đây là ràng buộc của
-- data/knowledge/types.ts, nay được database giữ luôn để một lần ingest từ nhánh khác không lách
-- qua được. Nội dung biên tập của dự án không cần nguồn ngoài.
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_external_source_check"
  CHECK ("sourceClass" = 'editorial' OR ("sourceUrl" IS NOT NULL AND "verifiedAt" IS NOT NULL));
