-- Metadata phân loại tri thức (SRS Mục 11.1.1.5) và mở rộng từ điển địa danh.
--
-- Migration này viết TAY chứ không do `prisma migrate dev` sinh, vì hai lý do:
--
--   1. Phép đổi `enum PlaceKind` là thay đổi phá huỷ, nên Prisma đòi xác nhận tương tác và từ
--      chối chạy trong môi trường không tương tác.
--   2. Bản sinh tự động luôn kèm hai câu DROP INDEX cho `knowledgedoc_embedding_hnsw` và
--      `knowledgedoc_search_gin` — hai index tạo bằng raw SQL trên cột `Unsupported` mà Prisma
--      không mô hình hoá được nên coi là drift. Để nguyên chúng là phá tầng RAG mà không có lỗi
--      nào báo: truy vấn vector chuyển sang quét tuần tự, biểu hiện duy nhất là chậm dần.
--
-- Quy tắc rút ra và áp cho mọi migration sau: KHÔNG áp thẳng bản sinh tự động; đọc lại và gỡ hai
-- câu DROP INDEX đó trước.

-- ---------------------------------------------------------------------------
-- 1. PlaceKind: 3 giá trị -> 13 giá trị
-- ---------------------------------------------------------------------------
-- Ba giá trị cũ (PROVINCE, TOWN, SITE) không phân biệt được một con đèo với một quán ăn hay một
-- điểm dừng ngắm cảnh, nên mọi câu hỏi theo loại đều phải quét văn bản thay vì lọc.
--
-- Chuyển cột về TEXT trước rồi mới đổi kiểu, để chạy được phép backfill ở giữa. Bảng hiện đang
-- rỗng nên bước backfill là dư trên máy này, nhưng nó phải có mặt để migration còn đúng trên một
-- database đã có dữ liệu — bỏ nó đi thì lần chạy ở môi trường khác sẽ hỏng ở phép ép kiểu.

ALTER TABLE "Place" ALTER COLUMN "kind" TYPE TEXT USING ("kind"::TEXT);

UPDATE "Place" SET "kind" = CASE "kind"
  WHEN 'PROVINCE' THEN 'province'
  -- TOWN là thị trấn, mà cấp huyện đã bỏ từ 01/7/2025 nên cấp dưới tỉnh giờ là xã/phường/thị trấn.
  WHEN 'TOWN' THEN 'commune'
  -- SITE gộp chung mọi địa danh; landmark là giá trị bao trùm nhất trong bộ mới. Việc tách tiếp
  -- thành scenic_view / cultural_site / historical_site là việc của người biên tập dữ liệu, không
  -- suy tự động được.
  WHEN 'SITE' THEN 'landmark'
  ELSE "kind"
END;

DROP TYPE "PlaceKind";

CREATE TYPE "PlaceKind" AS ENUM (
  'province', 'commune', 'region',
  'landmark', 'scenic_view', 'cultural_site', 'historical_site',
  'local_food', 'specialty', 'restaurant',
  'homestay', 'guesthouse', 'hotel'
);

ALTER TABLE "Place" ALTER COLUMN "kind" TYPE "PlaceKind" USING ("kind"::"PlaceKind");

-- ---------------------------------------------------------------------------
-- 2. Hai enum mới cho metadata tri thức
-- ---------------------------------------------------------------------------

CREATE TYPE "KnowledgeDomain" AS ENUM (
  'destination', 'attraction', 'food', 'seasonal_recommendation',
  'accommodation', 'tour', 'travel_guide', 'policy'
);

CREATE TYPE "KnowledgeEntityType" AS ENUM (
  'province', 'commune', 'region', 'location',
  'landmark', 'scenic_view', 'cultural_site', 'historical_site',
  'local_food', 'restaurant', 'specialty',
  'hotel', 'homestay', 'guesthouse',
  'tour_description', 'tour_itinerary', 'tour_policy',
  'transportation', 'safety', 'local_tips', 'faq',
  'booking_policy', 'cancellation_policy', 'payment_policy', 'refund_policy'
);

-- ---------------------------------------------------------------------------
-- 3. Năm cột metadata trên KnowledgeDoc
-- ---------------------------------------------------------------------------

ALTER TABLE "KnowledgeDoc" ADD COLUMN "domain" "KnowledgeDomain" NOT NULL DEFAULT 'travel_guide';
ALTER TABLE "KnowledgeDoc" ADD COLUMN "entityType" "KnowledgeEntityType" NOT NULL DEFAULT 'faq';
ALTER TABLE "KnowledgeDoc" ADD COLUMN "entityId" TEXT;
ALTER TABLE "KnowledgeDoc" ADD COLUMN "tags" TEXT[];
ALTER TABLE "KnowledgeDoc" ADD COLUMN "season" TEXT[];

-- Backfill từ `docType` cũ. `docType` được GIỮ LẠI một vòng phát hành để rollback được, rồi mới bỏ
-- ở migration sau — bỏ ngay bây giờ là cắt đường lui trong khi bộ lọc mới chưa được đo.
UPDATE "KnowledgeDoc" SET
  "domain" = CASE "docType"
    WHEN 'faq'         THEN 'travel_guide'::"KnowledgeDomain"
    WHEN 'policy'      THEN 'policy'::"KnowledgeDomain"
    WHEN 'destination' THEN 'destination'::"KnowledgeDomain"
    WHEN 'tour_desc'   THEN 'tour'::"KnowledgeDomain"
  END,
  "entityType" = CASE "docType"
    WHEN 'faq'         THEN 'faq'::"KnowledgeEntityType"
    WHEN 'policy'      THEN 'booking_policy'::"KnowledgeEntityType"
    WHEN 'destination' THEN 'location'::"KnowledgeEntityType"
    WHEN 'tour_desc'   THEN 'tour_description'::"KnowledgeEntityType"
  END,
  -- placeSlug đã trỏ đúng tới Place.slug từ trước, nên nó chính là entityId cần điền.
  "entityId" = "placeSlug";

-- ---------------------------------------------------------------------------
-- 4. Chỉ mục cho bộ lọc metadata
-- ---------------------------------------------------------------------------
-- Bắt buộc phải có. Bộ lọc chạy TRƯỚC semantic search, và lọc trước mà không có chỉ mục thì bước
-- lọc tốn hơn việc không lọc — khi đó cả tối ưu này thành một khoản lỗ.

CREATE INDEX "KnowledgeDoc_domain_entityType_idx" ON "KnowledgeDoc"("domain", "entityType");
CREATE INDEX "KnowledgeDoc_domain_status_idx" ON "KnowledgeDoc"("domain", "status");
CREATE INDEX "KnowledgeDoc_entityId_idx" ON "KnowledgeDoc"("entityId");
