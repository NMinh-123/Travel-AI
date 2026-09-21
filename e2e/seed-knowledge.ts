import { PrismaClient } from "@prisma/client";

/**
 * Vài đoạn tri thức có vector, để tác tử tri thức có căn cứ mà trả lời trong E2E.
 *
 * Vector phải khớp cách máy chủ giả sinh vector (`e2e/mock-gemini.ts`), nếu không nhánh vector
 * không khớp gì và tác tử trả `no_source` — luồng chat sẽ chuyển tiếp thay vì trả lời, và test
 * đỏ vì một lý do nằm ngoài thứ nó muốn kiểm.
 */
const DIM = 1024;

function fakeVector(): number[] {
  const vector = new Array<number>(DIM).fill(0);
  vector[0] = 1;
  return vector;
}

const prisma = new PrismaClient();

const DOCS = [
  {
    slug: "attraction:pho-co-dong-van",
    title: "Phố cổ Đồng Văn",
    content: "Khu phố cổ nằm gọn trong lòng chảo Đồng Văn, dãy nhà trình tường mái ngói âm dương, buổi tối rất tĩnh.",
  },
  {
    slug: "travel_guide:giay-to-bien-gioi",
    title: "Giấy tờ khu vực biên giới",
    content: "Mang theo giấy tờ tuỳ thân và luôn có sẵn để xuất trình khi được yêu cầu ở vùng sát biên.",
  },
];

async function main(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "KnowledgeDoc"`);
  for (const doc of DOCS) {
    // Vector sinh từ ĐÚNG chuỗi mà tầng nhúng sẽ gửi đi: `title\ncontent`.
    const literal = `[${fakeVector().join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeDoc" (
         "id","slug","docType","title","content","sourceRef","language","version","status","scope",
         "placeSlug","domain","entityType","entityId","tags","season","chunkIndex","tokenCount",
         "contentHash","embeddingModel","pipelineVersion","sourceClass","embedding","search_tsv",
         "createdAt","updatedAt"
       ) VALUES (
         gen_random_uuid()::text,$1,'faq',$2,$3,$1,'vi',1,'APPROVED','PROVINCE',
         NULL,'travel_guide','faq',NULL,ARRAY[]::text[],ARRAY[]::text[],0,100,
         '','','','editorial',$4::vector,
         setweight(to_tsvector('vietnamese',$2),'A') || setweight(to_tsvector('vietnamese',$3),'B'),
         now(),now())`,
      doc.slug, doc.title, doc.content, literal,
    );
  }
  await prisma.$disconnect();
}

void main();
