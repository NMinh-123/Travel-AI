-- Chiều địa danh cho kho tri thức: bảng Place, và cặp scope/placeSlug thay cho cột region.
--
-- CẢNH BÁO CHO LẦN SAU: bản SQL do `prisma migrate diff` sinh ra có thêm hai dòng
--
--   DROP INDEX "knowledgedoc_embedding_hnsw";
--   DROP INDEX "knowledgedoc_search_gin";
--
-- và hai dòng đó đã bị XOÁ khỏi file này một cách có chủ ý. Prisma không biết hai chỉ mục ấy tồn
-- tại: chúng nằm trên cột kiểu Unsupported (vector, tsvector) nên không khai báo được trong
-- schema.prisma, và được tạo bằng raw SQL ở migration 20260906000000. Với Prisma thì thứ nó
-- không thấy trong datamodel là thứ thừa cần dọn.
--
-- Để chúng bị xoá thì truy xuất vẫn CHẠY, chỉ là mọi truy vấn chuyển sang quét tuần tự — hỏng
-- âm thầm, không có lỗi nào báo. Mỗi lần chạy `prisma migrate diff` trên schema này đều phải rà
-- lại và bỏ các dòng DROP INDEX đụng vào hai chỉ mục đó.

-- CreateEnum
CREATE TYPE "KnowledgeScope" AS ENUM ('PROVINCE', 'PLACE');

-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('PROVINCE', 'TOWN', 'SITE');

-- DropIndex
DROP INDEX "KnowledgeDoc_region_idx";

-- AlterTable
--
-- Bỏ `region` chứ không chuyển đổi dữ liệu: giá trị cũ là chuỗi tên huyện ghép ("Yên Minh -
-- Đồng Văn") nên không ánh xạ một-một sang địa danh nào, và cấp huyện thì đã bị bỏ từ 01/7/2025.
-- Tám giá trị mất đi được `npm run db:ingest` dựng lại đầy đủ ở dạng scope/placeSlug.
ALTER TABLE "KnowledgeDoc" DROP COLUMN "region",
ADD COLUMN     "placeSlug" TEXT,
ADD COLUMN     "scope" "KnowledgeScope" NOT NULL DEFAULT 'PROVINCE';

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL,
    "aliases" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_slug_key" ON "Place"("slug");

-- CreateIndex
CREATE INDEX "Place_kind_idx" ON "Place"("kind");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_scope_placeSlug_idx" ON "KnowledgeDoc"("scope", "placeSlug");
