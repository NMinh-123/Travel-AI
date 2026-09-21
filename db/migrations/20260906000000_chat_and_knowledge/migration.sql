-- Vòng 5 — Hội thoại chatbot + kho tri thức RAG (SRS Mục 8.1, 11.4, 12 Giai đoạn 1)
--
-- Migration này được sinh OFFLINE bằng:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- rồi tách phần delta so với 20260905000000_init và bổ sung tay bốn khối Prisma không sinh
-- được: hai extension, cấu hình tìm kiếm tiếng Việt, chỉ mục HNSW và chỉ mục GIN.
--
-- Thứ tự quan trọng: CREATE EXTENSION "vector" phải chạy TRƯỚC CREATE TABLE "KnowledgeDoc",
-- vì cột "embedding" dùng kiểu vector(1024) do extension đó cung cấp.

-- ---------------------------------------------------------------------------
-- Extension
-- ---------------------------------------------------------------------------
-- Ảnh Docker phải là pgvector/pgvector:pg16 — postgres:16-alpine KHÔNG có extension này
-- và migration sẽ dừng ngay tại dòng dưới.
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ---------------------------------------------------------------------------
-- Cấu hình tìm kiếm toàn văn cho tiếng Việt (SRS Mục 11.4.4)
-- ---------------------------------------------------------------------------
-- Postgres không có từ điển tiếng Việt sẵn. Cách dùng được là copy cấu hình 'simple' rồi
-- chèn unaccent vào chuỗi xử lý, nhờ đó "ma pi leng" khớp "Mã Pí Lèng" — một tỷ lệ đáng kể
-- người dùng gõ không dấu trên di động.
--
-- CREATE TEXT SEARCH CONFIGURATION không có IF NOT EXISTS, nên bọc trong DO block để lệnh
-- này chạy lại được (ví dụ sau prisma migrate reset) mà không vỡ.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'vietnamese') THEN
    CREATE TEXT SEARCH CONFIGURATION "vietnamese" (COPY = "simple");
    ALTER TEXT SEARCH CONFIGURATION "vietnamese"
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "KnowledgeDocType" AS ENUM ('faq', 'policy', 'destination', 'tour_desc');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('COMPLAINT', 'LOW_CONFIDENCE', 'OUT_OF_SCOPE', 'USER_REQUEST', 'URGENT');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "docType" "KnowledgeDocType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "region" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'APPROVED',
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1024),
    "search_tsv" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "slots" JSONB NOT NULL DEFAULT '{}',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "satisfaction" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "agent" TEXT,
    "suggestions" TEXT[],
    "trace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatEscalation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reason" "EscalationReason" NOT NULL,
    "summary" TEXT NOT NULL,
    "contact" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatEscalation_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Chỉ mục do Prisma sinh
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDoc_slug_key" ON "KnowledgeDoc"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_docType_status_idx" ON "KnowledgeDoc"("docType", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_sourceRef_idx" ON "KnowledgeDoc"("sourceRef");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_region_idx" ON "KnowledgeDoc"("region");

-- CreateIndex
CREATE INDEX "ChatSession_userId_startedAt_idx" ON "ChatSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ChatSession_lastActiveAt_idx" ON "ChatSession"("lastActiveAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatEscalation_status_createdAt_idx" ON "ChatEscalation"("status", "createdAt");

-- ---------------------------------------------------------------------------
-- Khoá ngoại
-- ---------------------------------------------------------------------------
-- ChatSession.userId là CASCADE chứ không SET NULL: nội dung hội thoại có thể chứa dữ liệu
-- cá nhân, nên xoá tài khoản phải xoá luôn hội thoại (nghĩa vụ xoá dữ liệu, Nghị định
-- 13/2023/NĐ-CP). Phiên của khách vãng lai có userId NULL và không bị ảnh hưởng.

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEscalation" ADD CONSTRAINT "ChatEscalation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Chỉ mục cho hybrid search — Prisma không sinh được hai cái này
-- ---------------------------------------------------------------------------
-- HNSW với vector_cosine_ops: embedder ở cả hai đường (BGE-M3 và Gemini) đều trả vector đã
-- chuẩn hoá L2, nên cosine là phép so sánh đúng. Đổi sang vector_l2_ops mà không chuẩn hoá
-- lại toàn bộ là sai âm thầm — thứ hạng vẫn ra nhưng không còn nghĩa.
CREATE INDEX "knowledgedoc_embedding_hnsw"
  ON "KnowledgeDoc" USING hnsw ("embedding" vector_cosine_ops);

-- GIN trên search_tsv cho nhánh từ khoá. Cột này do scripts/ingest-knowledge.ts ghi bằng
-- to_tsvector('vietnamese', ...) với trọng số A cho tiêu đề và B cho nội dung — cố tình
-- không phải generated column, lý do ghi trong prisma/schema.prisma.
CREATE INDEX "knowledgedoc_search_gin"
  ON "KnowledgeDoc" USING gin ("search_tsv");
