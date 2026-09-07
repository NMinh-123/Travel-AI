# Hồ sơ duyệt kế hoạch — Hoàn tất Giai đoạn 1

Kế hoạch: [plan.md](plan.md). Quy trình: [../../dev-flow.md](../../dev-flow.md).

---

## Vòng 1 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật**, chưa phải code. Hãy phản biện thẳng thắn;
việc của bạn là chặn kế hoạch sai trước khi nó tốn công triển khai.

### Bối cảnh dự án

Travel AI Hà Giang — React + Vite (TypeScript) ở `src/`, server Express ở `server.ts`
và `server/`, Postgres + pgvector qua Prisma ở `prisma/`, một embedding service riêng ở
`embedding-service/`. Model sinh nội dung gọi qua biến môi trường, không hard-code.

Sản phẩm bám theo một tài liệu SRS v1.2 (đặc tả website bán tour du lịch + chatbot AI).
SRS chia lộ trình ba giai đoạn; **Giai đoạn 1 chỉ gồm chatbot AI đủ 6 tác tử** (1 điều phối
+ 5 chuyên biệt: tư vấn tìm tour, tạo tour tự do, lập kế hoạch kinh phí, giới thiệu địa danh
& FAQ, hỗ trợ & chuyển tiếp nhân viên), chạy trên dữ liệu mẫu, widget chat trên trang landing,
lưu và đồng bộ lịch sử hội thoại. Giai đoạn 1 **chưa** có giỏ hàng, thanh toán, đặt chỗ tự
động — khách muốn đặt thật thì chatbot chuyển tiếp cho nhân viên.

Các điều khoản SRS được trích dẫn trong kế hoạch, để bạn không phải đoán:

- **Mục 11.4.7**: "bộ công cụ đo lường là một phần bắt buộc của phạm vi Giai đoạn 1 chứ không
  phải hạng mục tuỳ chọn". Đề xuất Langfuse (ghi vết) + RAGAS (đo bám nguồn, độ liên quan,
  độ chính xác/bao phủ ngữ cảnh) + DeepEval (cổng chất lượng CI). Yêu cầu "bộ câu hỏi vàng
  tiếng Việt cho miền du lịch với khoảng 100–200 câu, lấy từ log hỗ trợ thực tế và từ kịch bản
  nghiệp vụ, có đáp án và đoạn tri thức đúng kèm theo". Ngưỡng cảnh báo: chỉ số bám nguồn dưới
  0,80 thì dừng phát hành.
- **Mục 11.4.4**: hybrid search (vector + toàn văn) hợp nhất bằng Reciprocal Rank Fusion k≈60;
  bước xếp hạng lại (rerank) bằng cross-encoder "bật có điều kiện", và "mức cải thiện phải được
  đo trực tiếp trên tập đánh giá của dự án trước khi bật mặc định".
- **Mục 10.6**: ngoài khiếu nại, hệ thống **buộc** chuyển tiếp sang nhân viên trong ba trường
  hợp: độ tin cậy nhận diện ý định thấp hơn ngưỡng, câu hỏi nằm ngoài phạm vi kho tri thức, và
  khách yêu cầu gặp người thật.
- **Mục 10.4 bước 8–12** (ràng buộc thiết kế bắt buộc): tác tử truy vấn dữ liệu thật **trước**,
  rồi mới đưa dữ liệu đó cho model diễn đạt. Model không được tự sinh giá, số chỗ hay chính sách.
- **Mục 11.4.8**: bắt buộc che dữ liệu cá nhân trước khi đưa vào lời nhắc gửi ra API nước ngoài.
  Nghị định 13/2023 đặt nghĩa vụ xoá dữ liệu trong 72 giờ khi có yêu cầu hợp lệ. Nghị định
  53/2022 đặt yêu cầu lưu trữ dữ liệu người dùng Việt Nam trong nước với thời hạn **tối thiểu
  24 tháng** đối với một số nhóm doanh nghiệp.
- **Mục 11.3**: dữ liệu hội thoại chứa thông tin cá nhân nên phải tuân thủ NFR-SEC-05, "bao gồm
  chính sách thời hạn lưu trữ và quyền yêu cầu xoá của người dùng".
- **NFR-PERF-03**: chatbot phản hồi ≤ 3 giây cho 95% yêu cầu hội thoại thông thường.
- **NFR-MAINT-01**: độ phủ kiểm thử tự động tối thiểu 70% cho các module nghiệp vụ cốt lõi.
- **Mục 14 (nghiệm thu)**: chatbot đạt tỷ lệ tự giải quyết không cần chuyển tiếp ≥ 60%.

### Yêu cầu cần giải quyết

Người dùng yêu cầu: *"dựa vào file SRS và source code hiện có hãy hoàn thành giai đoạn 1.
Nếu có phần dữ liệu, API, key nào cần thiết, hãy yêu cầu tôi"*.

Tức là: xác định phần còn thiếu của Giai đoạn 1 so với SRS, lập kế hoạch đóng nốt, và nêu rõ
những đầu vào (dữ liệu, API, key, quyết định nghiệp vụ) mà người dùng phải cung cấp.

### Hiện trạng code

Codebase đã có sẵn gần trọn kiến trúc chatbot. Điểm mấu chốt: **toàn bộ tầng đó chưa chạy
thật lần nào** — máy phát triển vừa cài Docker nhưng chưa reboot, và `GEMINI_API_KEY` còn rỗng.
Nên migration, `CREATE EXTENSION vector`, ingest kho tri thức và mọi lượt hội thoại đều chưa
từng thực thi. Lớp kiểm chứng duy nhất tới nay là `tsc --noEmit`.

Cây thư mục phần server:

```
server/agents/{types,nlu,dialog,orchestrator,tools,guardrail,pii}.ts
server/agents/specialists/{discovery,itinerary,budget,knowledge,support,shared}.ts
server/rag/{embedder,retrieval,chunker,segment,places}.ts
server/routes/{auth,chat,content,me}.ts
server/{config,db,auth,gemini,costs,itineraryCore,mappers,prompts,rateLimit}.ts
prisma/{schema.prisma,seed.ts,seed-data.ts,place-data.ts}
prisma/migrations/{20260905000000_init,20260906000000_chat_and_knowledge,20260906120000_place_and_knowledge_scope}/
scripts/{ingest-knowledge,knowledge-source,crawl-web,web-sources,flow-review,flow-cursor}.ts
embedding-service/main.py          # FastAPI + sentence-transformers, BGE-M3, chạy CPU
src/hooks/useChatSession.tsx
src/components/{AIConciergeTab,AIConciergeModal,MarkdownMessage,ItineraryPlanner}.tsx
```

**`package.json` (rút gọn — chú ý: KHÔNG có script `test`, KHÔNG có vitest/jest):**

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "prisma generate && vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --define:__BUILT_FOR_PRODUCTION__=true --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "lint": "tsc --noEmit",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:crawl": "tsx scripts/crawl-web.ts",
    "db:ingest": "tsx scripts/ingest-knowledge.ts"
  },
  "dependencies": {
    "@google/genai": "^2.4.0", "@prisma/client": "^6.19.3", "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7", "dotenv": "^17.2.3", "express": "^4.21.2",
    "google-auth-library": "^11.0.2", "jsonwebtoken": "^9.0.3", "react": "^19.0.1", "vite": "^6.2.3"
  },
  "devDependencies": {
    "esbuild": "^0.25.0", "prisma": "^6.19.3", "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0", "typescript": "~5.8.2"
  }
}
```

**`server/agents/orchestrator.ts` — định tuyến và ba trigger chuyển tiếp bắt buộc (trích):**

```ts
export async function handleTurn(input: TurnInput): Promise<TurnOutput> {
  const startedAt = Date.now();

  const { result: nlu, metrics: nluMetrics } = await classify(input.message, input.history);
  const nluMs = Date.now() - startedAt;

  // Dialog Manager: gộp thực thể vừa trích xuất vào trạng thái phiên TRƯỚC khi định tuyến.
  const slots = mergeSlots(input.slots, nlu.entities);

  // Chiều địa danh: hai nguồn (NLU trích xuất + quét chuỗi) gộp lại vì hỏng theo hai kiểu khác nhau.
  const resolved = await resolvePlaceNames(nlu.entities.destinations ?? []);
  const scanned = await findPlacesInText(input.message);
  const placeSlugs = [...new Set([...resolved.slugs, ...scanned])];
  const outOfArea = findOutOfAreaPlaces(input.message);

  const context: AgentContext = { sessionId: input.sessionId, userId: input.userId,
    message: input.message, slots, nlu, history: input.history, placeSlugs };

  let agent: Intent = nlu.intent;
  let result: AgentResult;

  // "Không nơi nào nhận diện được" chứ không phải "có nơi nào": câu "từ Hà Nội lên Đồng Văn"
  // nhắc Hà Nội (ngoài địa bàn) nhưng vẫn hợp lệ vì Đồng Văn nhận diện được.
  const offTopicPlace =
    (resolved.unknown.length > 0 || outOfArea.length > 0) && placeSlugs.length === 0;

  const forcedReason: EscalationReason | null = nlu.wantsHuman
    ? "USER_REQUEST"
    : nlu.confidence < MIN_INTENT_CONFIDENCE   // = 0.5
      ? "LOW_CONFIDENCE"
      : offTopicPlace
        ? "OUT_OF_SCOPE"
        : null;

  if (forcedReason) {
    agent = "support";
    result = await runSupport(context, forcedReason);
  } else {
    const missing = missingSlots(agent, slots);
    if (missing.length > 0) {
      result = askForSlot(agent, missing[0]);     // vòng lặp hỏi bổ sung slot
    } else {
      try {
        result = await runAgent(agent, context);
      } catch (error) {
        if (error instanceof AiUnavailableError) throw error;  // lỗi cấu hình → 503, không nuốt
        agent = "support";
        result = await runSupport(context, "OUT_OF_SCOPE");
      }
      const blocked = inspect(result, agent);     // guardrail
      if (blocked) {
        const reason: EscalationReason = blocked === "ungrounded" ? "OUT_OF_SCOPE" : "COMPLAINT";
        const fallback = await runSupport(context, reason);
        agent = "support";
        result = { ...fallback, calls: [...result.calls, ...fallback.calls], retrieval: result.retrieval };
      }
    }
  }

  return { result, nlu, agent,
    slots: result.slotUpdates ? { ...slots, ...result.slotUpdates } : slots,
    trace: { intent: nlu.intent, confidence: nlu.confidence, agent, grounded: result.grounded,
      citedDocIds: result.citedDocIds, escalated: Boolean(result.escalation),
      totalMs: Date.now() - startedAt, nluMs, agentMs, calls: [nluMetrics, ...result.calls],
      retrieval: result.retrieval } };
}
```

**`server/agents/types.ts` — ngưỡng tin cậy, tự ghi chú là chưa đo:**

```ts
/**
 * Ngưỡng tin cậy để chuyển tiếp... Con số 0,5 là điểm khởi đầu, chưa phải kết quả đo.
 * Phải hiệu chỉnh trên bộ câu hỏi vàng (SRS Mục 11.4.7) — đặt quá cao thì chuyển tiếp tràn lan
 * và hàng đợi vô nghĩa, quá thấp thì chatbot trả lời tự tin những câu nó không hiểu.
 */
export const MIN_INTENT_CONFIDENCE = 0.5;

export interface TurnTrace {
  intent: Intent; confidence: number; agent: Intent;
  grounded: boolean; citedDocIds: string[]; escalated: boolean;
  totalMs: number; nluMs: number; agentMs: number;
  calls: CallMetrics[]; retrieval?: RetrievalMetrics;
}
```

**`server/agents/specialists/knowledge.ts` — tác tử duy nhất dùng RAG; chỗ chặn "ảo giác":**

```ts
export async function runKnowledge(context: AgentContext): Promise<AgentResult> {
  const { chunks, metrics: retrieval } = await retrieve(context.message, {
    finalLimit: 5,
    placeSlugs: context.placeSlugs,
  });

  // Không có đoạn nào vượt ngưỡng → KHÔNG gọi model. grounded:false để orchestrator chuyển tiếp.
  if (chunks.length === 0) {
    return { reply: "", suggestions: [], grounded: false, citedDocIds: [], calls: [], retrieval };
  }

  const knowledgeBlock = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.content}`).join("\n\n");

  const { data, metrics } = await generateStructured<{ reply: string; suggestions: string[] }>({
    tier: "light",
    systemInstruction: personaFor(
      "trả lời câu hỏi của khách CHỈ dựa trên các đoạn tri thức đã kiểm duyệt được cung cấp"),
    temperature: 0.6,
    schema: CHAT_RESPONSE_SCHEMA,
    contents: `Câu hỏi của khách: ${context.message}...\n\nTRI THỨC ĐÃ KIỂM DUYỆT (nguồn duy nhất được phép dùng):\n${knowledgeBlock}`,
  });

  const reply = data?.reply?.trim() ?? "";
  return { reply, suggestions: cleanStringList(data?.suggestions, 4),
    grounded: reply.length > 0, citedDocIds: chunks.map((c) => c.id),
    calls: [metrics], retrieval };
}
```

**`server/config.ts` — bốn tham số ngưỡng, kèm nguyên văn cảnh báo về biên an toàn:**

```ts
  /**
   * Mặc định tắt có chủ ý. SRS Mục 11.4.4 nói rõ "mức cải thiện phải được đo trực tiếp trên
   * tập đánh giá của dự án trước khi bật mặc định" — bộ câu hỏi vàng chưa có.
   */
  rerankEnabled: readBool("RERANK_ENABLED", false),
  /**
   * Tách từ tiếng Việt cho nhánh từ khoá. Mặc định tắt vì chưa đo được, và vì tách từ PHẢI
   * đối xứng giữa ingest và truy vấn: bật biến này thì phải chạy lại toàn bộ ingest, nếu
   * không thì chỉ mục và truy vấn nằm ở hai dạng văn bản khác nhau và âm thầm không khớp.
   */
  viSegmentEnabled: readBool("VI_SEGMENT_ENABLED", false),

  /**
   * ...Đo trên 45 câu (25 hợp lệ, 12 ngoài địa bàn, 8 khác chủ đề): 0,60/0,34 cho 23/25 câu
   * hợp lệ, còn 0,60/0,26 cho đủ 25/25 mà vẫn không câu âm tính nào lọt.
   *
   * Cảnh báo về biên: hạ tiếp xuống 0,22 thì ba câu khác chủ đề lọt ngay. Biên an toàn phía
   * dưới chỉ khoảng 0,04, và toàn bộ con số này đo trên tập tự soạn với kho 31 đoạn, KHÔNG
   * phải tập câu hỏi vàng mà SRS Mục 11.4.4 yêu cầu. Đổi nội dung kho thì phải đo lại.
   */
  ragMinVectorSimilarity: readNumber("RAG_MIN_VECTOR_SIMILARITY", 0.6, 0, 1),
  ragMinKeywordRank: readNumber("RAG_MIN_KEYWORD_RANK", 0.26, 0, 1),
```

**`server/routes/chat.ts` — endpoint hội thoại (trích phần quan trọng):**

```ts
/** Chỉ trả về phiên đúng chủ: phiên của khách vãng lai (userId null) ai giữ id thì đọc được,
 * còn phiên đã gắn tài khoản thì bắt buộc đúng user. */
async function loadSession(sessionId: string, userId: string | null) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;
  return session;
}

chatRouter.post("/", chatLimiter, async (req, res, next) => {
  // ...tạo hoặc nạp session, cắt history 10 lượt...

  // SRS Mục 11.4.8: che dữ liệu cá nhân TRƯỚC khi gửi ra API ngoài. Một masker cho cả lượt.
  const masker = new PiiMasker();
  const maskedMessage = masker.mask(message);
  const maskedHistory = history.map((t) => ({ ...t, content: masker.mask(t.content) }));

  const outcome = await handleTurn({ sessionId: session.id, userId,
    message: maskedMessage, slots: parseSlots(session.slots), history: maskedHistory });

  const reply = masker.restore(outcome.result.reply);
  const suggestions = outcome.result.suggestions.map((s) => masker.restore(s));

  // Lưu bản GỐC chưa che: việc che chỉ áp dụng ở biên gửi ra API ngoài.
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { sessionId: session.id, role: "USER", content: message } }),
    prisma.chatMessage.create({ data: { sessionId: session.id, role: "ASSISTANT", content: reply,
      intent: outcome.nlu.intent, confidence: outcome.nlu.confidence, agent: outcome.agent,
      suggestions, trace: outcome.trace as unknown as Prisma.InputJsonValue } }),
    prisma.chatSession.update({ where: { id: session.id },
      data: { slots: outcome.slots as unknown as Prisma.InputJsonValue,
              ...(outcome.result.escalation ? { escalated: true } : {}) } }),
  ]);

  if (outcome.result.escalation) {
    await prisma.chatEscalation.create({ data: { sessionId: session.id,
      reason: outcome.result.escalation.reason,
      summary: masker.restore(outcome.result.escalation.summary) } });
  }

  return res.json({
    sessionId: session.id, reply, suggestions,
    agent: outcome.agent,
    escalated: Boolean(outcome.result.escalation),
    itinerary: outcome.result.itinerary,     // <-- dòng 138
  });
});

// Ngoài POST "/" còn có: GET /sessions/:id (nạp lại lịch sử) và POST /feedback (FR-BOT-11).
// KHÔNG có DELETE nào.
```

**`src/hooks/useChatSession.tsx` — chỗ có lỗi kế hoạch định sửa (dòng 58 trở đi):**

```ts
interface ChatResponse {
  sessionId: string;
  reply: string;
  suggestions: string[];
  agent: string;
  escalated: boolean;
  // KHÔNG có `itinerary` — trường server trả về ở chat.ts:138 bị vứt đi tại đây,
  // và không component nào đọc tới nó.
}
```

Trong khi `src/types.ts` đã khai sẵn từ lâu một trường chưa ai ghi vào:

```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: string[];
  itinerarySnippet?: Partial<ItineraryPlan>;   // <-- chưa có đường nào ghi vào
}
```

**`prisma/schema.prisma` — ba model liên quan (trích, giữ nguyên chú thích gốc):**

```prisma
/// Một phiên hội thoại. `userId` nullable vì SRS Mục 7.2 cho khách vãng lai trò chuyện với
/// chatbot mà không cần tài khoản...
/// Cascade khi xoá user, không SetNull: nội dung hội thoại có thể chứa dữ liệu cá nhân, nên
/// xoá tài khoản phải xoá luôn hội thoại — nghĩa vụ xoá dữ liệu của Nghị định 13/2023.
model ChatSession {
  id           String   @id @default(cuid())
  userId       String?
  channel      String   @default("web")
  slots        Json     @default("{}")
  escalated    Boolean  @default(false)
  satisfaction Int?                        // FR-BOT-11: 1 / -1 / null
  startedAt    DateTime @default(now())
  lastActiveAt DateTime @updatedAt

  user        User?            @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages    ChatMessage[]
  escalations ChatEscalation[]

  @@index([userId, startedAt])
  @@index([lastActiveAt])
}

/// Các trường intent/confidence/agent/trace là phần đo lường: không có chúng thì không có cách
/// nào biết ngân sách 3 giây của NFR-PERF-03 có giữ được hay không, và sau này RAGAS
/// (SRS Mục 11.4.7) lấy dữ liệu từ đây.
model ChatMessage {
  id          String      @id @default(cuid())
  sessionId   String
  role        MessageRole
  /// Lưu bản GỐC chưa che dữ liệu cá nhân. Việc che chỉ áp dụng ở biên gửi ra API ngoài.
  content     String
  intent      String?
  confidence  Float?
  agent       String?
  suggestions String[]
  /// Độ trễ từng chặng, tầng model đã dùng, id các đoạn tri thức đã truy xuất, số token.
  trace       Json?
  createdAt   DateTime    @default(now())
  session     ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, createdAt])
}

model KnowledgeDoc {
  id         String           @id @default(cuid())
  /// Bền vững và suy ra được từ nguồn ('destination:ma-pi-leng#0'), nên ingest là idempotent.
  slug       String           @unique
  docType    KnowledgeDocType   // faq | policy | destination | tour_desc
  title      String
  content    String
  sourceRef  String
  language   String           @default("vi")
  version    Int              @default(1)
  status     KnowledgeStatus  @default(APPROVED)
  scope      KnowledgeScope   @default(PROVINCE)   // PROVINCE | PLACE
  placeSlug  String?
  chunkIndex Int
  tokenCount Int
  /// Prisma không có kiểu vector/tsvector nên khai Unsupported; hai cột do ingest ghi raw SQL.
  embedding  Unsupported("vector(1024)")?
  searchTsv  Unsupported("tsvector")?     @map("search_tsv")
  @@index([docType, status])
  @@index([scope, placeSlug])
}
```

**Migration `20260906000000_chat_and_knowledge/migration.sql` (phần đầu, chưa từng chạy):**

```sql
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CREATE TEXT SEARCH CONFIGURATION không có IF NOT EXISTS, nên bọc trong DO block.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'vietnamese') THEN
    CREATE TEXT SEARCH CONFIGURATION "vietnamese" (COPY = "simple");
    ALTER TEXT SEARCH CONFIGURATION "vietnamese"
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END $$;
-- ...sau đó CREATE TABLE "KnowledgeDoc" (... "embedding" vector(1024), "search_tsv" tsvector ...),
-- các bảng Chat*, rồi chỉ mục HNSW cho embedding và GIN cho search_tsv.
```

**`.env.example` — biến đang có (rút gọn phần liên quan):**

```
DATABASE_URL="postgresql://travel:travel@localhost:5432/travelai"
JWT_SECRET=""                          # bắt buộc, tối thiểu 32 ký tự
GEMINI_API_KEY=""                      # RỖNG — /api/chat và /api/plan-itinerary trả 503
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_MODEL_LIGHT="gemini-2.5-flash-lite"   # ghi chú: "XÁC MINH tên model với API trước khi chạy thật lần đầu"
EMBEDDER="bge-m3"                      # hoặc "gemini"; cả hai ra 1024 chiều
EMBEDDING_SERVICE_URL="http://127.0.0.1:8000"
RERANK_ENABLED="false"
VI_SEGMENT_ENABLED="false"
RAG_MIN_VECTOR_SIMILARITY="0.6"
RAG_MIN_KEYWORD_RANK="0.26"
GOOGLE_CLIENT_ID=""                    # rỗng thì nút đăng nhập Google tự ẩn
```

**Trạng thái môi trường (ghi trong `history.md`):** Docker Desktop 4.89.0 đã cài nhưng
`RebootPending = True` nên engine chưa chạy; `npm run lint` 0 lỗi; `npx vite build` thành công
(bundle 341 kB); kiểm tra drift schema ↔ migration: 53/53 object khớp. Kho tri thức hiện có
khoảng vài chục đoạn (một đợt đo trước dùng kho 31 đoạn). Không có test tự động nào trong repo.
Toàn bộ công việc của sáu vòng phát triển **vẫn chưa commit** (repo chỉ có duy nhất một commit).

Một số đo thật đã ghi lại được trước đó: cosine giữa "đèo Mã Pí Lèng" (có dấu) và "deo ma pi
leng" (không dấu) chỉ **0,44** với BGE-M3 — đây là lý do nhánh tìm kiếm từ khoá với `unaccent`
là bắt buộc, không phải tuỳ chọn.

### Kế hoạch đề xuất

#### Phương án chọn

Chia thành **năm mảng, thực hiện đúng thứ tự phụ thuộc**, trong đó mảng A là cổng chặn: chưa
chạy thật được thì bốn mảng còn lại không kiểm chứng được gì.

**A. Đưa hệ thống vào trạng thái chạy thật, rồi ghi lại đúng những gì quan sát được.**
Không viết code mới. Chạy: `docker compose up -d db` → `npx prisma migrate deploy` →
`npm run db:seed` → khởi động sidecar embedding → `npm run db:ingest` → `npm run dev`. Với mỗi
bước ghi lại output thật vào một file kết quả. Sau đó kiểm chứng bằng SQL trực tiếp, không tin
vào việc "lệnh không báo lỗi": `SELECT extname FROM pg_extension` phải có `vector` và `unaccent`;
`pg_ts_config` phải có `vietnamese`; `count(*) FROM "KnowledgeDoc" WHERE embedding IS NOT NULL`
phải bằng tổng số đoạn; `\d "KnowledgeDoc"` phải thấy chỉ mục HNSW và GIN; `/api/health` trả
`dbConnected: true` và `aiConfigured: true`. Rồi chạy tay năm kịch bản hội thoại của SRS Mục 11.2
và ghi lại `ChatMessage.trace` thật để có số đối chiếu ngưỡng ≤ 3 giây. Xác minh tên hai model
Gemini bằng lệnh liệt kê model của API. Mảng A chặn trên `GEMINI_API_KEY` của người dùng.

**B. Bộ đo lường (SRS Mục 11.4.7) — tự viết trong repo, không dựng Langfuse/RAGAS/DeepEval.**
Đánh đổi: mất giao diện quan sát của Langfuse và bộ chỉ số RAGAS chuẩn hoá; được: không dựng
thêm dịch vụ (Langfuse tự triển khai cần Postgres riêng + ClickHouse), không kéo stack Python
thứ hai bên cạnh `embedding-service/`, và nằm cùng ngôn ngữ nên `tsc` kiểm được. Khả thi vì
`ChatMessage.trace` đã ghi sẵn đúng dữ liệu Langfuse cần — lớp ghi vết đã có, thứ thiếu là lớp
*đọc*. Ba phần:

1. `eval/golden-set.ts` — bộ câu hỏi vàng tiếng Việt. Mỗi câu: câu hỏi, ý định đúng, các
   `KnowledgeDoc.slug` được coi là đoạn đúng, và nhãn `expect`: `answer` hay `escalate`. Bốn
   nhóm: chính sách/thủ tục, địa danh, lịch trình/kinh phí, và nhóm âm tính (ngoài địa bàn,
   khác chủ đề, gõ không dấu).
2. `scripts/eval-retrieval.ts` (`npm run eval:retrieval`) — chỉ chạy tầng truy xuất, **không gọi
   model sinh**, nên rẻ và chạy được nhiều lần. Báo cáo recall@5, MRR, tỷ lệ chặn đúng nhóm âm
   tính, và **quét lưới** `RAG_MIN_VECTOR_SIMILARITY` × `RAG_MIN_KEYWORD_RANK` để hai con số
   0,6/0,26 có căn cứ. Chạy thêm một lượt `RERANK_ENABLED=true` để có số đo quyết định bật hay
   không, đúng điều Mục 11.4.4 yêu cầu.
3. `scripts/eval-answer.ts` (`npm run eval:answer`) — chạy trọn `handleTurn()`, báo cáo độ chính
   xác ý định, tỷ lệ chuyển tiếp đúng/sai, tỷ lệ tự phục vụ (đối chiếu ngưỡng ≥ 60% của Mục 14),
   p50/p95 `totalMs` (đối chiếu NFR-PERF-03). Tốn tiền gọi model nên chạy có chủ đích, không nằm
   trong `npm test`.

Cả hai script ghi JSON dưới `eval/results/` để so giữa các lần chạy. **Chỉ sau khi có số của
bước này mới được đụng vào bốn tham số** `MIN_INTENT_CONFIDENCE`, `RERANK_ENABLED`,
`VI_SEGMENT_ENABLED`, và cặp ngưỡng RAG.

**C. Kiểm thử tự động (NFR-MAINT-01).** Thêm **vitest** làm devDependency. Dự án có nguyên tắc
"không thêm dependency" rõ ràng, nên nói rõ vì sao đây là ngoại lệ: nguyên tắc đó áp cho
dependency **chạy trong sản phẩm** (vào bundle client hoặc đường chạy server); vitest là
devDependency thuần và dùng chung transform pipeline của Vite đã có. Ưu tiên theo rủi ro:
`pii.ts` (Vòng 5 từng có lỗi regex khiến số điện thoại **không hề được che** trước khi gửi ra
API ngoài), `rag/chunker.ts`, `agents/dialog.ts` (`mergeSlots` — Vòng 5 từng có lỗi slot không
tích luỹ, bot hỏi lại mãi một câu), `auth.ts` + `routes/auth.ts` (không rò email đã tồn tại,
`/api/me/*` không nhận `userId` từ body, gộp Google theo email), `MarkdownMessage.tsx`
(`[x](javascript:alert(1))` phải ra text thuần), `orchestrator.ts` (ba trigger chuyển tiếp, với
NLU giả lập). Test auth dùng Postgres dev với schema riêng (`?schema=test`) thay vì mock Prisma.

**D. Nối lịch trình từ chat ra giao diện (FR-BOT-03 đầu-cuối).** Thêm `itinerary?: ItineraryPlan`
vào `interface ChatResponse` và gắn vào `ChatMessage.itinerarySnippet`. Thêm một thẻ tóm tắt gọn
trong khung chat (tiêu đề, tổng km, các ngày) kèm nút mở sang trình lập lịch trình đầy đủ —
**không** dựng lại toàn bộ UI của `ItineraryPlanner` trong khung chat vì khung hẹp và hai bản
render sẽ lệch nhau theo thời gian.

**E. Thời hạn lưu trữ và quyền xoá hội thoại (NFR-SEC-05, NĐ 13/2023).** `docs/chinh-sach-du-lieu.md`;
`DELETE /api/chat/sessions/:id` dùng lại đúng `loadSession()` để phân quyền (phiên vãng lai ai
giữ id xoá được, phiên đã gắn tài khoản bắt buộc đúng user), Cascade tự dọn `ChatMessage` và
`ChatEscalation`; `scripts/purge-chat.ts` (`npm run db:purge-chat`) xoá phiên quá hạn theo
`lastActiveAt`, chạy tay hoặc cron, **không** cắm vào tiến trình server vì một job xoá dữ liệu
chạy ngầm không ai thấy là thứ nguy hiểm, mặc định `--dry-run` bật. Giao diện có một dòng ngắn
và nút xoá, giữ nguyên tắc **không hứa điều hệ thống không làm được**.

#### Phương án đã loại

| Phương án | Lý do loại |
|---|---|
| Bỏ qua mảng A, code tiếp bốn mảng còn lại | ~30 file server chưa chạy dòng nào. Viết thêm code lên nền chưa xác minh là nhân rủi ro lên. Mọi con số ở mảng B cũng vô nghĩa nếu ingest chưa chạy được. |
| Dựng Langfuse + RAGAS + DeepEval đúng như SRS Mục 11.4.7 | Langfuse tự triển khai cần Postgres riêng và ClickHouse; RAGAS/DeepEval kéo stack Python thứ hai. Chi phí dựng lớn hơn giá trị ở mốc này, trong khi `ChatMessage.trace` đã chứa sẵn đúng dữ liệu cần. |
| Sinh bộ câu hỏi vàng bằng chính Gemini | SRS yêu cầu lấy từ log hỗ trợ thực tế và kịch bản nghiệp vụ. Dùng model sinh câu hỏi rồi lấy chính model đó chấm điểm là vòng lặp tự khen: nó sẽ sinh đúng những câu kho tri thức hiện có trả lời được, mọi chỉ số đẹp một cách giả tạo. |
| Hiệu chỉnh bốn tham số ngưỡng theo cảm tính trong vòng này | Mục 11.4.4 nói thẳng phải đo trên tập đánh giá của dự án trước khi bật mặc định. |
| Chuyển kênh chat sang WebSocket theo Mục 4.4 / Hình 9.1 | Một tiến trình, chưa có tính năng nào cần server đẩy xuống (chưa có nhân viên trả lời trực tiếp). Đổi khi dựng live chat thật ở Giai đoạn 2. |
| Làm FR-ADM-02 (trang quản trị kho tri thức) | SRS Mục 12 xếp back-office vào Giai đoạn 2. Kho tri thức đã nằm đúng chỗ trong kiến trúc nên khi có trang quản trị chỉ phải đổi nguồn đọc. |
| Tự viết runner test tối giản để né devDependency | Tốn công bảo trì một công cụ không phải giá trị của dự án. |

#### Các bước thực hiện

1. **Bring-up thật** — không sửa file nguồn; ghi output thật vào `buoc-a-ket-qua.md`. Kết quả:
   `/api/health` trả `dbConnected: true` + `aiConfigured: true`; năm truy vấn SQL đều đúng.
2. **Xác minh tên model** — `.env.example`, và `server/config.ts` chỉ khi tên mặc định sai.
3. **Chạy tay 5 kịch bản Mục 11.2** — 5 bản ghi `trace` thật, có `totalMs`.
4. **Sửa lỗi phát sinh từ bước 1–3** — file chưa xác định được trước. Nếu lỗi làm lộ ra sai
   thiết kế (không phải lỗi vặt) thì quay lại bước lập kế hoạch, không tự sửa hướng giữa chừng.
5. **Bộ câu hỏi vàng** — `eval/golden-set.ts`, 100–200 câu. Chặn trên quyết định của người dùng.
6. **`scripts/eval-retrieval.ts`** + script `eval:retrieval` trong `package.json`.
7. **`scripts/eval-answer.ts`** + script `eval:answer`.
8. **Hiệu chỉnh tham số theo số đo** — `.env.example`, `server/config.ts`, `server/agents/types.ts`,
   kèm chú thích ghi rõ số đo được và trên tập nào. Chỉ chạy sau bước 6–7.
9. **Dựng vitest** — `package.json`, `vitest.config.ts` (mới), `tsconfig.json` nếu cần.
10. **Viết test theo bảng ưu tiên mảng C** — `pii.test.ts`, `chunker.test.ts`, `dialog.test.ts`,
    `orchestrator.test.ts`, `routes/auth.test.ts`, `MarkdownMessage.test.tsx`. Đo độ phủ trên
    `server/agents/` + `server/rag/` + `server/auth.ts`, đối chiếu ngưỡng 70%.
11. **Nối lịch trình ra giao diện** — `src/hooks/useChatSession.tsx`, `AIConciergeTab.tsx`,
    `AIConciergeModal.tsx`, có thể `src/types.ts`.
12. **Quyền xoá hội thoại** — `server/routes/chat.ts` (thêm `DELETE`), `scripts/purge-chat.ts`,
    `package.json`, và nút xoá ở frontend.
13. **Tài liệu chính sách dữ liệu** — `docs/chinh-sach-du-lieu.md`; trỏ tới từ Footer hoặc khung
    chat. Chặn trên quyết định thời hạn lưu trữ.
14. **Cập nhật `history.md`** — ghi Vòng 7 với quyết định và số đo thật.

#### Rủi ro

- **Bước 1–3 làm lộ ra lỗi thiết kế, không phải lỗi vặt.** ~30 file chưa chạy dòng nào; xác suất
  chỉ có lỗi nhỏ là thấp. → Chạy bring-up **trước** mọi việc khác. Nếu là sai thiết kế thì quay
  lại lập kế hoạch.
- **Bộ câu hỏi vàng tự soạn không phản ánh câu hỏi thật của khách.** → Ghi rõ trong
  `eval/golden-set.ts` rằng đây là tập kịch bản nghiệp vụ, không phải log thật; mọi ngưỡng hiệu
  chỉnh từ nó phải đo lại khi có lưu lượng thật. Không trình bày số đo trên tập tự soạn như kết
  quả đã nghiệm thu.
- **Kho tri thức chỉ có vài chục đoạn.** Bộ 100–200 câu có thể vượt xa những gì kho trả lời được,
  làm recall thấp một cách hệ thống. → Bước 6 báo cáo riêng nhóm "câu hỏi không có đoạn tri thức
  nào tương ứng trong kho" thay vì tính thành lỗi truy xuất; đó là danh sách việc bổ sung nội
  dung, không phải lỗi của tầng RAG.
- **Test auth dùng database thật có thể xoá nhầm dữ liệu dev.** → Bắt buộc `?schema=test`; script
  test tự kiểm tên schema và từ chối chạy nếu trỏ vào `public`.
- **Quét lưới ngưỡng tốn nhiều lượt gọi embedding.** → Lưu đệm embedding của truy vấn theo câu
  hỏi trong một lần chạy; một câu hỏi chỉ embed một lần cho cả lưới.
- **Job xoá dữ liệu xoá nhầm.** → Mặc định `--dry-run`, in số lượng và mẫu bản ghi sẽ xoá.
- **Thay đổi ngưỡng ở bước 8 làm hồi quy.** → Lưu JSON kết quả bước 6–7 trước và sau, so trực
  tiếp; không đổi ngưỡng nếu không có bảng so.

#### Cách kiểm chứng

```bash
npm run lint          # tsc --noEmit, đang bật noUnusedLocals + noUnusedParameters
npx vite build
npm test              # vitest (mới)
npm run eval:retrieval
npm run eval:answer
npm run db:purge-chat # mặc định --dry-run
```

Cộng năm truy vấn SQL sau bring-up, và bảy kịch bản tay đầu-cuối:
(1) "chợ phiên Đồng Văn họp ngày nào" → trả lời có căn cứ, `citedDocIds` không rỗng;
(2) "chợ phiên Bắc Hà họp ngày nào" → phải chuyển tiếp `OUT_OF_SCOPE`, không được trả lời;
(3) "cho mình gặp người thật" → `USER_REQUEST`, có bản ghi `ChatEscalation`;
(4) "lên lịch trình 3 ngày cho 2 người" → thẻ lịch trình hiện trong khung chat;
(5) gõ không dấu "deo ma pi leng co nguy hiem khong" → vẫn trả lời được;
(6) bấm nút xoá hội thoại → phiên biến mất, tải lại trang bắt đầu phiên mới;
(7) F5 giữa phiên → lịch sử được nạp lại (FR-BOT-07).

#### Ngoài phạm vi

- **FR-BOT-09 (song ngữ Việt–Anh)** — mức "Nên có". Prompt, kho tri thức và cấu hình tìm kiếm
  `vietnamese` hiện chỉ phục vụ tiếng Việt; làm tiếng Anh là thêm một nhánh truy xuất và một bộ
  nội dung nữa.
- **FR-BOT-10 (Zalo OA / Messenger)** — Giai đoạn 3 theo SRS Mục 12.
- **FR-ADM-01..04 (back-office, RBAC nhân viên)** — Giai đoạn 2. Hệ quả phải giữ: giao diện
  **không được hứa thời gian phản hồi** vì chưa có ai đọc `ChatEscalation`.
- **FR-BOOK / FR-PAY (giỏ hàng, đặt chỗ, thanh toán)** — SRS Mục 12 nói rõ Giai đoạn 1 chưa có.
- **WebSocket cho kênh chat** — lý do ở bảng phương án đã loại.
- **Dọn dữ liệu còn giả**: ảnh stock, `rating`/`reviewCount` homestay, `PassWeather` chưa nối API
  thời tiết thật, đăng nhập Facebook. Cần quyết nguồn dữ liệu trước, không chặn mốc Giai đoạn 1.
- **Commit / dọn git** — chờ quyết định của người dùng.

#### Đầu vào sẽ yêu cầu người dùng cung cấp

1. **`GEMINI_API_KEY`** — chặn cứng toàn bộ mảng A, B, D.
2. **Xác nhận đã reboot và Docker chạy được** — chặn bước 1.
3. **Nguồn bộ câu hỏi vàng**: có log hỗ trợ thật không? Nếu không, xin xác nhận cho phép tự soạn
   100–200 câu từ kịch bản nghiệp vụ và chấp nhận hạn chế đã nêu ở mục Rủi ro.
4. **Thời hạn lưu trữ hội thoại** (90 ngày / 12 tháng / 24 tháng?) — quyết định pháp lý và kinh
   doanh; lưu ý NĐ 53/2022 đặt lưu trữ **tối thiểu 24 tháng** với một số nhóm doanh nghiệp, kéo
   ngược chiều với nghĩa vụ xoá của NĐ 13/2023.
5. **Kênh tiếp nhận escalation**: ai đọc, qua đâu, hay chưa có ai — quyết định câu chữ giao diện.
6. *(không bắt buộc)* **`GOOGLE_CLIENT_ID`**.

Nếu (1) hoặc (2) chưa có, mảng C (test các module logic thuần: PII, chunker, dialog,
MarkdownMessage) không cần cả database lẫn API key nên có thể làm trước trong lúc chờ.

### Phản hồi vòng trước

Không có — đây là vòng 1.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự giải quyết yêu cầu không; có sai giả định về code hiện
tại không; có bỏ sót trường hợp biên, lỗi bảo mật, hay ảnh hưởng tới phần khác không;
có cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Bốn câu hỏi mà kế hoạch này đặc biệt muốn bị phản biện:

1. Việc thay Langfuse + RAGAS + DeepEval bằng hai script tự viết có làm mất một năng lực
   thực sự cần cho nghiệm thu Giai đoạn 1 không, hay chỉ mất tiện nghi?
2. Xếp mảng A (bring-up + xác minh) làm cổng chặn tuyệt đối trước mọi việc khác có đúng không,
   hay có phần nào nên chạy song song?
3. Phạm vi có bị phình so với định nghĩa Giai đoạn 1 của SRS Mục 12 không? Nếu phải cắt một
   mảng để kịp mốc, mảng nào cắt được mà vẫn nghiệm thu được?
4. Sáu đầu vào yêu cầu người dùng có thiếu mục nào không, hoặc có mục nào thật ra tự quyết được?

Trả lời **đúng định dạng sau**, không thêm lời dẫn:

```
VERDICT: PASS | FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. <vấn đề> — vì sao chặn: <lý do> — đề xuất: <cách sửa>

NON-BLOCKER (nên cân nhắc, không chặn)
1. <góp ý>

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. <câu hỏi>
```

Chỉ trả `PASS` khi mục BLOCKER trống. Nếu thiếu thông tin để kết luận, trả `FAIL` và
đặt câu hỏi thay vì đoán.

---

## Vòng 1 — phản hồi nhận về (2026-09-06)

VERDICT: FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. Mảng B chưa đáp ứng bộ đo bắt buộc: golden set không có đáp án tham chiếu, còn hai script không đo faithfulness/độ đúng câu trả lời/độ bao phủ-ngữ cảnh và không có quality gate CI — vì sao chặn: không thể chứng minh ngưỡng bám nguồn 0,80 hay nghiệm thu Mục 11.4.7 chỉ bằng recall, MRR, intent và latency — đề xuất: bổ sung đáp án/tiêu chí chấm cho từng câu, metric tương đương RAGAS và cổng CI tương đương DeepEval; có thể tự viết, nhưng phải nêu phương pháp, ngưỡng và chống hồi quy.
2. Mảng D làm mất lịch trình sau F5: `itinerary` chỉ có trong response POST; `ChatMessage` Prisma không lưu trường này và GET `/sessions/:id` không trả lại — vì sao chặn: kế hoạch chỉ sửa frontend nhưng đồng thời yêu cầu lịch sử hội thoại được lưu/khôi phục; thẻ lịch trình sẽ biến mất sau tải lại — đề xuất: xác định contract `ItineraryPlan`, lưu JSON lịch trình theo message (migration), trả nó từ endpoint lịch sử và chỉ khi đó gắn `itinerarySnippet` vào client.
3. Kế hoạch hiệu chỉnh bốn ngưỡng thiếu phép đo cho `VI_SEGMENT_ENABLED`; việc bật nó đòi `underthesea` và ingest lại toàn bộ kho, còn cấu hình được nạp một lần khi process khởi động — vì sao chặn: không thể kết luận tham số này từ cùng một index/lần chạy hiện có — đề xuất: nêu benchmark đối xứng tắt/bật, chạy process riêng và re-ingest cho mỗi biến thể; chỉ so kết quả trên cùng golden set.
4. Mốc hiện trạng bị mô tả sai: `history.md` ghi đã có kiểm tra tay logic thuần cho PII/chunker (bao gồm 16 ca PII), trái với khẳng định “lớp kiểm chứng duy nhất là tsc” — vì sao chặn: baseline kiểm chứng và phần việc test dễ bị báo cáo sai hoặc làm lại mà không đối chiếu regression có sẵn — đề xuất: sửa baseline, thu thập các ca kiểm tra tay hiện có làm test case đầu vào cho Vitest.

NON-BLOCKER (nên cân nhắc, không chặn)
1. Không cần dựng đúng Langfuse/RAGAS/DeepEval nếu bộ thay thế tái tạo được các năng lực nghiệm thu và có artefact/versioning; hiện tại nó mất năng lực thực sự, không chỉ mất giao diện tiện nghi.
2. A nên chặn các quyết định phụ thuộc runtime, nhưng C (test logic thuần), thiết kế golden set, policy dữ liệu và thiết kế persistence lịch trình có thể làm song song.
3. Xoá hội thoại cần bao phủ backup, log, cache và quy trình chứng minh hoàn tất xoá; job “chạy tay hoặc cron” cần lịch chạy cụ thể để đáp ứng SLA 72 giờ.
4. Session khách vãng lai dùng `sessionId` như bearer credential. DELETE/GET dùng lại `loadSession()` giữ nguyên đặc tính này; cần đánh giá chuyển sang secret phiên riêng trong cookie HttpOnly hoặc nêu rõ mô hình capability và biện pháp giảm rò rỉ.
5. Phạm vi không phình đáng kể: A, B, C, E là yêu cầu/NFR đã trích; nếu buộc cắt để kịp mốc, chỉ nên hoãn thẻ lịch trình D, không hoãn đo lường, test hoặc quyền xoá.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. File SRS chuẩn nằm ở đâu? Repo hiện chỉ thấy bản kế hoạch và bản prompt có trích đoạn, nên chưa thể đối chiếu nguyên văn Mục 12/11.4.7.
2. Đơn vị có thuộc trường hợp phải lưu dữ liệu trong nước tối thiểu 24 tháng không, dữ liệu production/backup đặt ở đâu, và ai phê duyệt việc gửi dữ liệu đã che sang Gemini?
3. Có nguồn dữ liệu nghiệp vụ đã được duyệt cho giá, chính sách, tour và escalation không; nếu chỉ dùng seed, ai chịu trách nhiệm xác nhận dữ liệu mẫu đủ cho nghiệm thu?

## Vòng 1 — phân loại điểm chặn (2026-09-06)

Đối chiếu từng BLOCKER với code thật. Kết luận: **cả bốn đều Đúng → cổng FAIL**, lập lại kế
hoạch cho vòng 2.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Bộ đo không đo được bám nguồn / độ đúng câu trả lời / độ bao phủ ngữ cảnh, golden set thiếu đáp án tham chiếu, không có cổng CI | **Đúng** | Mâu thuẫn nội tại của chính kế hoạch: mục B đặt ngưỡng "bám nguồn dưới 0,80 thì dừng phát hành" nhưng `eval-answer.ts` chỉ đo ý định, chuyển tiếp, tỷ lệ tự phục vụ và độ trễ. Không có đường nào tính ra con số 0,80 đó. |
| 2 | Thẻ lịch trình biến mất sau F5 vì `itinerary` không được lưu | **Đúng** | `model ChatMessage` (`prisma/schema.prisma`) có `intent, confidence, agent, suggestions, trace` — không có trường lịch trình. `GET /sessions/:id` (`server/routes/chat.ts`) chỉ trả `id, role, content, suggestions, timestamp`. Kế hoạch chỉ sửa frontend nên mâu thuẫn với chính kịch bản kiểm chứng số 7 (F5 phải nạp lại được lịch sử). |
| 3 | Không có phép đo cho `VI_SEGMENT_ENABLED` | **Đúng** | Bước 8 liệt kê biến này trong nhóm "hiệu chỉnh theo số đo", nhưng bước 6–7 không mô tả phép đo nào cho nó. Mà bật nó thì phải cài `underthesea` và **ingest lại toàn bộ kho** (`.env.example`), còn `config` được dựng một lần lúc nạp module (`server/config.ts`) nên không đổi được giữa chừng một lần chạy. |
| 4 | Gói prompt mô tả sai mốc kiểm chứng hiện có | **Đúng** | `chatgpt.md:68` viết "Lớp kiểm chứng duy nhất tới nay là `tsc --noEmit`", trong khi `plan.md:64` và `history.md` Vòng 5 đều ghi có thêm kiểm thử logic thuần chạy tay (chunker + PII, 16 ca). Lỗi nằm ở gói prompt, không ở kế hoạch — nhưng đúng là gói prompt đã trôi khỏi kế hoạch mà không ai đối chiếu. |

### Câu hỏi của người soát

| # | Câu hỏi | Xử lý |
|---|---|---|
| 1 | File SRS chuẩn nằm ở đâu? | **Phát hiện thật**: SRS v1.2 chỉ tồn tại dưới dạng file đính kèm trong hội thoại, **không có trong repo**, nên người soát không đối chiếu được nguyên văn. Vòng 2 phải đưa SRS (hoặc bản trích các mục được viện dẫn) vào `docs/`. |
| 2 | Có thuộc diện lưu trong nước 24 tháng không; dữ liệu/backup đặt ở đâu; ai duyệt việc gửi dữ liệu đã che sang Gemini? | Đã nằm ở mục "Đầu vào cần người dùng" số 4; vòng 2 tách rõ thêm phần backup và người phê duyệt. |
| 3 | Có nguồn dữ liệu nghiệp vụ đã duyệt cho giá/chính sách/tour không; ai xác nhận dữ liệu mẫu đủ để nghiệm thu? | Đã nằm ở mục số 3 và 5; vòng 2 nêu rõ ai là người ký nhận dữ liệu mẫu. |

### Điểm NON-BLOCKER sẽ đưa vào vòng 2

- Mảng C, thiết kế golden set, chính sách dữ liệu và **thiết kế lưu lịch trình** làm song song
  được với mảng A, không phải chờ bring-up. Nhận đúng: chỉ những quyết định phụ thuộc số đo
  runtime mới thật sự bị chặn.
- Xoá hội thoại phải bao phủ cả backup, log, cache, và job cần lịch chạy cụ thể để đáp ứng
  mốc 72 giờ — "chạy tay hoặc cron" là chưa đủ.
- `sessionId` của khách vãng lai đang đóng vai bearer credential; `DELETE` dùng lại
  `loadSession()` sẽ kế thừa nguyên đặc tính đó. Phải nêu rõ mô hình capability hoặc chuyển
  sang secret phiên riêng trong cookie httpOnly.
- Nếu buộc cắt phạm vi để kịp mốc thì chỉ hoãn thẻ lịch trình (mảng D), không hoãn đo lường,
  test hay quyền xoá.

---

## Vòng 2 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 2**, chưa phải code. Vòng 1 đã bị trả FAIL với 4 điểm
chặn; kế hoạch đã được lập lại. Hãy phản biện thẳng thắn.

### Bối cảnh dự án

Travel AI Hà Giang — React + Vite (TypeScript) ở `src/`, server Express ở `server.ts` và
`server/`, Postgres + pgvector qua Prisma ở `prisma/`, một embedding service Python riêng ở
`embedding-service/`. Model sinh nội dung (Gemini) gọi qua biến môi trường, không hard-code.

Sản phẩm bám theo SRS v1.2. **Giai đoạn 1 chỉ gồm chatbot AI đủ 6 tác tử** (1 điều phối + 5
chuyên biệt), chạy trên dữ liệu mẫu, widget chat trên trang landing, lưu và đồng bộ lịch sử hội
thoại. Chưa có giỏ hàng, thanh toán, đặt chỗ tự động.

**Mới ở vòng này:** các điều khoản SRS được viện dẫn đã được chép nguyên văn vào
`docs/srs-trich-yeu.md` trong repo — bạn đọc file đó để đối chiếu thay vì phải tin phần trích ở
đây. Bản PDF đầy đủ vẫn chưa có trong repo (đã ghi thành đầu vào số 7 cần người dùng cung cấp).

### Yêu cầu cần giải quyết

Người dùng yêu cầu: *"dựa vào file SRS và source code hiện có hãy hoàn thành giai đoạn 1. Nếu có
phần dữ liệu, API, key nào cần thiết, hãy yêu cầu tôi"*.

### Bốn điểm chặn của vòng 1 và cách vòng 2 xử lý

Cả 4 điểm đều đã được đối chiếu lại với code và **công nhận là đúng**. Không điểm nào bị bác.

| # | Điểm chặn vòng 1 | Xử lý ở vòng 2 |
|---|---|---|
| 1 | Bộ đo không đo được bám nguồn / độ đúng câu trả lời / bao phủ ngữ cảnh; golden set thiếu đáp án; không có cổng CI | Golden set thêm `referenceAnswer`, `mustInclude`, `mustNotInclude`. Thêm `scripts/eval-judge.ts` chấm bốn chỉ số tương đương RAGAS bằng model tầng mạnh, có trích dẫn đoạn chống lưng. Thêm `scripts/eval-gate.ts` làm cổng chặn hồi quy với ngưỡng 0,80 và baseline được commit. |
| 2 | Thẻ lịch trình biến mất sau F5 vì không được lưu | Thêm **migration** `ChatMessage.itinerary Json?`, ghi ở `POST /api/chat`, trả ở `GET /sessions/:id`, rồi mới tới frontend. Kịch bản kiểm chứng số 5 giờ là "F5 ngay sau khi thẻ hiện — thẻ phải còn". |
| 3 | Không có phép đo cho `VI_SEGMENT_ENABLED` | Khảo sát lại code, thấy **ba tham số hành xử khác nhau** nên cần ba cách đo khác nhau (bảng ở phần Kế hoạch). `VI_SEGMENT_ENABLED` cần hai lần ingest riêng. |
| 4 | Gói prompt mô tả sai mốc kiểm chứng hiện có | Đã sửa ở mục "Hiện trạng code" bên dưới. Nguyên nhân gốc: gói prompt diễn đạt lại thay vì trích nguyên văn `plan.md`; từ nay trích nguyên văn. |

Ba điểm NON-BLOCKER cũng được nhận: (a) mảng A không còn là cổng chặn tuyệt đối, sáu bước đầu
chạy song song được; (b) phạm vi xoá dữ liệu phải bao phủ backup/log/cache và job cần lịch chạy
cụ thể; (c) mô hình quyền của `sessionId` phải được nêu rõ.

### Hiện trạng code

Codebase đã có sẵn gần trọn kiến trúc chatbot (6 tác tử, RAG hybrid search, lưu hội thoại,
escalation, che PII, auth thật). Điểm mấu chốt: **toàn bộ tầng đó chưa chạy thật lần nào** — máy
phát triển vừa cài Docker nhưng chưa reboot, và `GEMINI_API_KEY` còn rỗng. Migration,
`CREATE EXTENSION vector`, ingest kho tri thức và mọi lượt hội thoại đều chưa từng thực thi.

**Mốc kiểm chứng hiện có, nói cho đúng (điểm chặn số 4 của vòng 1):**

- `tsc --noEmit` sạch trên toàn repo (đang bật `noUnusedLocals` + `noUnusedParameters`).
- `npx vite build` thành công, bundle 341 kB.
- Drift schema ↔ migration: 53/53 object khớp.
- **16 ca kiểm thử logic thuần chạy TAY** cho `server/rag/chunker.ts` và `server/agents/pii.ts`
  ở Vòng 5 phát triển. Chính đợt đó bắt được một lỗi regex khiến số điện thoại **không hề được
  che** trước khi gửi ra API ngoài. Các ca này **chưa được đóng băng thành test tự động** — đó
  là việc của mảng C, không phải viết mới từ đầu.

Không có framework test nào trong repo: `package.json` không có script `test`, không có
vitest/jest, không có file `*.test.ts`.

**Ba tham số cấu hình hành xử khác nhau — nền tảng cho thiết kế phép đo ở vòng này.**

`server/rag/retrieval.ts` — hai ngưỡng nhận được theo TỪNG LƯỢT GỌI:

```ts
export interface RetrievalOptions {
  docTypes?: KnowledgeDocType[];
  placeSlugs?: string[];
  /**
   * Ngưỡng liên quan của từng nhánh. Bỏ trống thì lấy từ config (RAG_MIN_VECTOR_SIMILARITY,
   * RAG_MIN_KEYWORD_RANK). Đặt cả hai về 0 để tắt hẳn việc lọc — hữu ích khi đo lại ngưỡng.
   */
  minVectorSimilarity?: number;
  minKeywordRank?: number;
  candidatesPerBranch?: number;   // SRS đề xuất ~50
  fuseLimit?: number;             // SRS đề xuất ~20
  finalLimit?: number;            // SRS đề xuất 3-5
}

export interface RetrievalMetrics {
  vectorHits: number;      // số hàng CÒN LẠI sau khi lọc theo ngưỡng
  keywordHits: number;
  vectorScanned: number;   // số hàng đọc lên TRƯỚC khi lọc
  keywordScanned: number;
  fusedHits: number;
  reranked: boolean;
  embedMs: number; searchMs: number; rerankMs: number;
}
```

Nhưng `RERANK_ENABLED` thì đọc từ config đã đóng băng lúc nạp module:

```ts
// server/rag/retrieval.ts:273
if (config.rerankEnabled && fused.length > 1) { ... }

// server/config.ts:152 — config là object dựng MỘT LẦN lúc import
rerankEnabled: readBool("RERANK_ENABLED", false),
viSegmentEnabled: readBool("VI_SEGMENT_ENABLED", false),
```

Còn `VI_SEGMENT_ENABLED` ảnh hưởng **cả hai phía** — nạp và truy vấn:

```ts
// server/rag/segment.ts:27
export async function segmentBatch(texts: string[]): Promise<string[]> {
  if (!config.viSegmentEnabled) return texts;
  // ... goi POST /segment cua sidecar
}
```

Chú thích gốc trong `server/rag/segment.ts` ghi rõ ràng buộc: *"tách từ phải ĐỐI XỨNG giữa ingest
và truy vấn. Bật cờ này thì phải chạy lại toàn bộ ingest, nếu không thì chỉ mục lưu văn bản chưa
tách còn truy vấn đã tách — không lỗi, không cảnh báo, chỉ là không khớp được gì."*

**`model ChatMessage` hiện tại — không có chỗ nào lưu lịch trình (điểm chặn số 2):**

```prisma
model ChatMessage {
  id          String      @id @default(cuid())
  sessionId   String
  role        MessageRole
  /// Lưu bản GỐC chưa che dữ liệu cá nhân. Việc che chỉ áp dụng ở biên gửi ra API ngoài.
  content     String
  intent      String?
  confidence  Float?
  agent       String?
  suggestions String[]
  /// Độ trễ từng chặng, tầng model đã dùng, id các đoạn tri thức đã truy xuất, số token.
  trace       Json?
  createdAt   DateTime    @default(now())
  session     ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, createdAt])
}
```

`POST /api/chat` **có** trả `itinerary` về client, nhưng không lưu:

```ts
// server/routes/chat.ts:132-139
return res.json({
  sessionId: session.id, reply, suggestions,
  agent: outcome.agent,
  escalated: Boolean(outcome.result.escalation),
  itinerary: outcome.result.itinerary,     // tra ve nhung khong luu vao DB
});
```

Còn `GET /sessions/:id` thì không trả:

```ts
// server/routes/chat.ts — nap lai lich su (FR-BOT-07)
return res.json({
  sessionId: session.id,
  escalated: session.escalated,
  satisfaction: session.satisfaction,
  messages: session.messages.map((row) => ({
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
    suggestions: row.suggestions,
    timestamp: row.createdAt.toISOString(),
    // khong co itinerary
  })),
});
```

Frontend cũng chưa khai:

```ts
// src/hooks/useChatSession.tsx:58
interface ChatResponse {
  sessionId: string; reply: string; suggestions: string[];
  agent: string; escalated: boolean;
  // KHONG co `itinerary`
}
```

Trong khi `src/types.ts:114` đã khai sẵn từ lâu một trường chưa ai ghi vào:

```ts
export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system';
  content: string; timestamp: string;
  suggestions?: string[];
  itinerarySnippet?: Partial<ItineraryPlan>;   // chua co duong nao ghi vao
}
```

**Phân quyền phiên hiện tại — nền cho thiết kế endpoint xoá:**

```ts
// server/routes/chat.ts:38-46
/** Chỉ trả về phiên đúng chủ: phiên của khách vãng lai (userId null) ai giữ id thì đọc được,
 * còn phiên đã gắn tài khoản thì bắt buộc đúng user. */
async function loadSession(sessionId: string, userId: string | null) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;
  return session;
}
```

`ChatSession` có `userId String?` (khách vãng lai), `lastActiveAt DateTime @updatedAt` kèm chỉ
mục `@@index([lastActiveAt])`, và quan hệ `onDelete: Cascade` từ `User` xuống. Không có endpoint
`DELETE` nào.

**Cửa gọi model dùng chung** (sẽ được `eval-judge.ts` tái sử dụng):

```ts
// server/gemini.ts
export type ModelTier = "light" | "strong";
export function modelFor(tier: ModelTier): string {
  return tier === "light" ? config.geminiModelLight : config.geminiModel;
}
export async function generateStructured<T>(call: StructuredCall): Promise<StructuredResult<T>>;
// StructuredCall: { tier, systemInstruction, temperature, schema, contents }
// StructuredResult: { data: T | null, metrics: CallMetrics }
```

**Bốn tham số chưa có căn cứ đo:**

```ts
// server/agents/types.ts:34
/** Con số 0,5 là điểm khởi đầu, chưa phải kết quả đo. Phải hiệu chỉnh trên bộ câu hỏi vàng. */
export const MIN_INTENT_CONFIDENCE = 0.5;
```

```ts
// server/config.ts:186-193 (chu thich goc, rut gon)
/**
 * Đo trên 45 câu (25 hợp lệ, 12 ngoài địa bàn, 8 khác chủ đề)... Cảnh báo về biên: hạ tiếp
 * xuống 0,22 thì ba câu khác chủ đề lọt ngay. Biên an toàn phía dưới chỉ khoảng 0,04, và toàn
 * bộ con số này đo trên tập tự soạn với kho 31 đoạn, KHÔNG phải tập câu hỏi vàng mà SRS Mục
 * 11.4.4 yêu cầu.
 */
ragMinVectorSimilarity: readNumber("RAG_MIN_VECTOR_SIMILARITY", 0.6, 0, 1),
ragMinKeywordRank: readNumber("RAG_MIN_KEYWORD_RANK", 0.26, 0, 1),
```

Một số đo thật đã ghi lại được: cosine giữa "đèo Mã Pí Lèng" (có dấu) và "deo ma pi leng" (không
dấu) với BGE-M3 chỉ **0,44** — lý do nhánh tìm kiếm từ khoá với `unaccent` là bắt buộc.

Kho tri thức hiện có khoảng vài chục đoạn (một đợt đo trước dùng kho 31 đoạn). Toàn bộ công việc
của sáu vòng phát triển **vẫn chưa commit** (repo chỉ có duy nhất một commit).

### Kế hoạch đề xuất

Kế hoạch đầy đủ ở `docs/plans/20260906-giai-doan-1-hoan-tat/plan.md` trong repo — bạn đọc trực
tiếp để đối chiếu. Tóm tắt phần cốt lõi:

**Năm mảng A–E. Thứ tự thực hiện (đổi so với vòng 1):**

```
A. bring-up + xác minh  ──┬──► B-đo: chạy đo, hiệu chỉnh tham số ──► chốt ngưỡng
   (cần GEMINI_API_KEY)   └──► D-đo: kiểm chứng lịch trình đầu-cuối

song song, KHÔNG chờ A:
C.     test module logic thuần (pii, chunker, dialog, orchestrator, MarkdownMessage)
B-soạn thiết kế + soạn bộ câu hỏi vàng, viết ba bộ chạy đánh giá và cổng chặn
D-code migration + contract lưu lịch trình + frontend
E.     chính sách dữ liệu, endpoint xoá, job dọn
```

**A.** Chạy `docker compose up -d db` → `prisma migrate deploy` → `db:seed` → sidecar embedding →
`db:ingest` → `dev`. Kiểm chứng bằng SQL trực tiếp (`pg_extension` có `vector`+`unaccent`,
`pg_ts_config` có `vietnamese`, mọi `KnowledgeDoc` có `embedding IS NOT NULL`, có chỉ mục HNSW và
GIN), không tin vào việc "lệnh không báo lỗi". Xác minh tên hai model Gemini bằng lệnh liệt kê
model của API.

**B. Bộ đo lường — không dựng Langfuse/RAGAS/DeepEval, tự viết trong repo.** Đánh đổi phải được
duyệt; vòng 1 bị chặn vì bản thay thế thiếu năng lực thật. Vòng này phải tái tạo đủ ba năng lực:
đo bốn chỉ số RAG, có artefact so sánh được giữa các lần chạy, và có cổng chặn hồi quy.

*B1. `eval/golden-set.ts`* — 100–200 câu, mỗi câu bảy trường: `question`, `intent`, `expect`
(`answer` hoặc `escalate`), `goldChunks` (các `KnowledgeDoc.slug` đúng), `referenceAnswer` (đáp
án chuẩn 1–3 câu), `mustInclude` (dữ kiện bắt buộc xuất hiện), `mustNotInclude` (khẳng định sai
thường gặp). Hai trường cuối chấm được **bằng code thuần**, không qua model: rẻ, tất định, và là
lưới an toàn khi bộ chấm bằng model trục trặc. Bốn nhóm: chính sách/thủ tục, địa danh, lịch
trình/kinh phí, và nhóm âm tính (ngoài địa bàn, khác chủ đề, gõ không dấu).

*B2. Ba bộ chạy:*

| Script | Gọi model sinh? | Đo gì |
|---|---|---|
| `eval-retrieval.ts` | Không | Recall@5, MRR, độ bao phủ ngữ cảnh, tỷ lệ chặn đúng nhóm âm tính |
| `eval-answer.ts` | Có | Độ chính xác ý định, tỷ lệ chuyển tiếp đúng/sai, tỷ lệ tự phục vụ, p50/p95 `totalMs`, `mustInclude`/`mustNotInclude` |
| `eval-judge.ts` | Có (giám khảo) | Bám nguồn, độ đúng câu trả lời, độ liên quan, độ bao phủ ngữ cảnh |

`eval-judge.ts` đọc kết quả JSON của `eval-answer.ts` rồi chấm bằng `generateStructured` với
`tier: "strong"`, schema bắt trả về điểm 0–1 **kèm trích dẫn đoạn nào chống lưng cho khẳng định
nào**; khẳng định không kèm trích dẫn bị coi là không có căn cứ. Bám nguồn = tỷ lệ khẳng định có
đoạn chống lưng.

Rủi ro tự chấm điểm được nêu thẳng trong kế hoạch: giám khảo là Gemini, cùng nhà cung cấp với
model sinh. Ba biện pháp giảm thiểu (không xoá được hoàn toàn): giám khảo không biết câu trả lời
do model nào sinh và không thấy điểm lần trước; `mustInclude`/`mustNotInclude` chấm bằng code làm
đối chứng tất định; mỗi lần chạy phải chấm tay 10 câu ngẫu nhiên và ghi độ lệch vào file kết quả.

*B3. `eval-gate.ts`* — cổng chặn, thoát khác 0 khi bám nguồn < 0,80, hoặc bất kỳ chỉ số nào tụt
quá 5 điểm phần trăm so với `eval/baseline.json` (file được commit, không tự ghi đè), hoặc có
câu vi phạm `mustNotInclude`.

*B4. Bốn cách đo cho bốn tham số:*

| Tham số | Cách đo |
|---|---|
| Hai ngưỡng RAG | Quét lưới **trong một lần chạy** (`retrieve()` nhận ngưỡng theo lượt gọi); embedding mỗi câu hỏi lưu đệm, một câu chỉ embed một lần cho cả lưới |
| `RERANK_ENABLED` | **Hai lần chạy tiến trình riêng, cùng chỉ mục** — không ingest lại vì chỉ ảnh hưởng khâu truy vấn. Lần bật đầu tiên sidecar tải model ~2,2 GB nên chậm bất thường, không tính vào số đo độ trễ |
| `VI_SEGMENT_ENABLED` | **Hai lần ingest + hai lần chạy riêng**, cần `pip install underthesea`. Không được so hai nhánh trên cùng một chỉ mục |
| `MIN_INTENT_CONFIDENCE` | Không quét lưới được (chặn ở orchestrator trước khi tác tử chạy). Thay vào đó ghi lại `confidence` thật của từng câu rồi phân tích ngoại tuyến: chọn ngưỡng tối đa hoá số câu `expect: answer` được trả lời mà không để câu `expect: escalate` nào lọt |

**C. Test tự động** — thêm vitest làm devDependency (nguyên tắc "không thêm dependency" của dự án
áp cho dependency chạy trong sản phẩm; vitest không vào bundle và dùng chung transform pipeline
của Vite). Năm nhóm logic thuần không cần DB: `pii` (đóng băng 16 ca đã chạy tay), `chunker`,
`dialog` (`mergeSlots`), `orchestrator` (ba trigger chuyển tiếp, NLU giả lập), `MarkdownMessage`
(`[x](javascript:alert(1))` phải ra text thuần). Hai nhóm cần DB (`auth`, quyền xoá phiên) dùng
schema riêng `?schema=test`, script tự từ chối chạy nếu trỏ vào `public`.

**D. Lưu và khôi phục lịch trình** — bốn tầng: migration `itinerary Json?` → ghi ở `POST` → trả ở
`GET /sessions/:id` → frontend gắn vào `ChatMessage.itinerarySnippet` và render thẻ tóm tắt gọn
kèm nút mở sang trình lập lịch trình đầy đủ. Không dựng lại toàn bộ UI của `ItineraryPlanner`
trong khung chat. Cột `Json` không có ràng buộc kiểu ở tầng DB nên khi đọc lên phải kiểm tra hình
dạng trước khi render, và coi bản ghi cũ (`null`) là hợp lệ.

**E. Thời hạn lưu trữ và quyền xoá** — `docs/chinh-sach-du-lieu.md`;
`DELETE /api/chat/sessions/:id`; `scripts/purge-chat.ts` mặc định `--dry-run`.

Mô hình quyền được nêu rõ thay vì kế thừa im lặng: `sessionId` của phiên vãng lai đang đóng vai
**capability token** — ai giữ id thì đọc và xoá được. Đánh đổi chấp nhận ở Giai đoạn 1 vì hậu quả
tối đa là xoá hội thoại của chính người giữ id, và SRS Mục 7.2 đòi khách vãng lai chat được mà
không cần tài khoản. Ba điều kiện kèm theo: id là `cuid()` không đoán được, không ghi `sessionId`
ra log tập trung, và giới hạn tần suất cho `DELETE`. Khi phiên vãng lai mang dữ liệu nhạy cảm hơn
thì phải chuyển sang secret riêng trong cookie `httpOnly` — ghi thành nợ kỹ thuật có điều kiện
kích hoạt.

Phạm vi xoá: Giai đoạn 1 chưa có backup tự động, chưa có log tập trung, chưa có cache cho hội
thoại, nên DB là nơi **duy nhất** chứa dữ liệu hội thoại — tài liệu phải ghi rõ điều đó cùng ngày
rà lại, và khi bật backup ở Giai đoạn 2 thì nghĩa vụ xoá mở rộng theo. Lịch chạy: yêu cầu xoá
theo đơn của khách đi qua endpoint `DELETE` nên **có hiệu lực tức thì**, không phụ thuộc job;
job `purge-chat` chỉ lo phần hết hạn lưu trữ, chạy hằng ngày qua Task Scheduler/cron, không cắm
vào tiến trình server.

**Phương án đã loại** (đầy đủ trong `plan.md`): dựng đúng Langfuse+RAGAS+DeepEval; giữ mảng B như
vòng 1; sinh bộ câu hỏi vàng bằng chính Gemini; mảng D chỉ sửa frontend; đo `VI_SEGMENT_ENABLED`
trên cùng một chỉ mục; hiệu chỉnh tham số theo cảm tính; chuyển kênh chat sang WebSocket; làm
FR-ADM-02; chuyển `sessionId` sang secret riêng ngay vòng này.

**Cách kiểm chứng:** `npm run lint`, `npx vite build`, `npm test`, `npm run eval:retrieval`,
`eval:answer`, `eval:judge`, `eval:gate`, `db:purge-chat`. Cộng năm truy vấn SQL sau bring-up và
tám kịch bản tay đầu-cuối, trong đó kịch bản 5 là **F5 ngay sau khi thẻ lịch trình hiện — thẻ
phải còn**, và kịch bản 7 là thử `DELETE` phiên của tài khoản khác phải trả 404.

**Ngoài phạm vi:** FR-BOT-09 (song ngữ), FR-BOT-10 (Zalo/Messenger), FR-ADM-01..04 (back-office),
FR-BOOK/FR-PAY, WebSocket, chuyển `sessionId` sang secret riêng, mở rộng nghĩa vụ xoá sang
backup/log/cache, dọn dữ liệu còn giả (ảnh stock, rating homestay, thời tiết, Facebook login),
commit/dọn git.

**Đầu vào sẽ yêu cầu người dùng:** (1) `GEMINI_API_KEY`; (2) xác nhận đã reboot + Docker chạy;
(3) nguồn bộ câu hỏi vàng — có log hỗ trợ thật không, nếu không thì xin phép tự soạn; (4) thời
hạn lưu trữ hội thoại và nơi đặt dữ liệu/backup; (5) kênh tiếp nhận escalation; (6) **ai ký nhận
rằng dữ liệu mẫu và đáp án chuẩn là đúng nghiệp vụ**; (7) đưa file SRS PDF vào repo;
(8) `GOOGLE_CLIENT_ID` (không bắt buộc). Nếu (1) và (2) chưa có thì sáu bước đầu vẫn làm được.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự xử lý xong bốn điểm chặn của vòng 1 không; có sai giả định về code
hiện tại không (bạn đọc được repo, hãy đối chiếu); có bỏ sót trường hợp biên, lỗi bảo mật, hay
ảnh hưởng tới phần khác không; có cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng
được không.

Bốn câu hỏi vòng này đặc biệt muốn bị phản biện:

1. Bộ đo mới (golden set bảy trường + `eval-judge` + `eval-gate`) đã đủ để nghiệm thu Mục 11.4.7
   chưa, hay vẫn còn năng lực nào bị mất so với Langfuse + RAGAS + DeepEval?
2. Ba biện pháp giảm thiểu rủi ro tự chấm điểm có đủ không? Nếu không, phương án nào rẻ hơn việc
   thuê một model của nhà cung cấp khác làm giám khảo?
3. Thiết kế lưu lịch trình bằng cột `Json` trên `ChatMessage` có đúng chỗ không, hay nên tham
   chiếu tới bảng `SavedItinerary` đã có sẵn?
4. Mô hình capability token cho `sessionId` có chấp nhận được ở Giai đoạn 1 không, với ba điều
   kiện kèm theo đã nêu?

Trả lời **đúng định dạng sau**, không thêm lời dẫn:

```
VERDICT: PASS | FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. <vấn đề> — vì sao chặn: <lý do> — đề xuất: <cách sửa>

NON-BLOCKER (nên cân nhắc, không chặn)
1. <góp ý>

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. <câu hỏi>
```

Chỉ trả `PASS` khi mục BLOCKER trống. Nếu thiếu thông tin để kết luận, trả `FAIL` và đặt câu hỏi
thay vì đoán.

## Vòng 2 — phản hồi nhận về (2026-09-06)

VERDICT: FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. Kế hoạch quét lưới ngưỡng RAG sai giả định về code hiện tại — vì sao chặn: `retrieve()` luôn tự gọi `getEmbedder().embed([query])` trong `vectorBranch`; `RetrievalOptions` không nhận embedding đã tính. Vì vậy mỗi ô lưới lại embed, trái với cam kết “một câu chỉ embed một lần”, làm số đo độ trễ và chi phí không hợp lệ — đề xuất: bổ sung API nội bộ nhận query embedding đã chuẩn hoá, hoặc tách embed/search để script đánh giá tái sử dụng chính xác một vector mỗi câu.
2. Mảng B chưa nghiệm thu được Mục 11.4.7 như SRS trích yếu — vì sao chặn: kế hoạch chủ ý không có Langfuse, không chạy định kỳ trên mẫu 1–5% hội thoại thật, không có dashboard cho tỷ lệ không có căn cứ/escalation/p95/chi phí mỗi phiên, và nói rõ CI chỉ làm “về sau”. Golden set và gate thủ công không thay thế các năng lực đó — đề xuất: hoặc triển khai Langfuse + RAGAS + DeepEval và cấu hình CI ngay trong phạm vi này, hoặc có phê duyệt sửa/miễn trừ SRS nêu rõ phương án thay thế, nguồn dữ liệu hội thoại thật, lịch chạy, nơi quan sát chỉ số và workflow CI.
3. Capability token cho phiên khách không chấp nhận được với dữ liệu hiện tại — vì sao chặn: hội thoại lưu bản gốc chưa che PII, nhưng `sessionId` bearer lại ở `localStorage`; ai lấy được id có thể đọc toàn bộ transcript qua `GET`, không chỉ “xoá hội thoại của chính người giữ id” như kế hoạch nêu. Điều kiện kích hoạt “khi nhạy cảm hơn” đã xảy ra — đề xuất: tạo secret phiên ngẫu nhiên riêng, chỉ lưu trong cookie `httpOnly`/`Secure`/`SameSite`, lưu hash phía server và bắt buộc secret đó cho đọc/xoá/ghi phiên khách; giữ `sessionId` chỉ làm định danh không đủ quyền.

NON-BLOCKER (nên cân nhắc, không chặn)
1. `ChatMessage.itinerary Json?` đúng chỗ hơn tham chiếu `SavedItinerary`: đây là snapshot của một câu trả lời, còn `SavedItinerary` là đối tượng người dùng đã đăng nhập chủ động lưu. Tuy nhiên `generateItinerary()` hiện trả `any`, không phải `ItineraryPlan` đã được kiểm tra; nên xác thực runtime khi ghi lẫn khi đọc.
2. Ba biện pháp chống tự chấm chưa đủ mạnh để coi điểm 0,80 là đáng tin: 10 câu ngẫu nhiên không có cỡ mẫu theo nhóm, tiêu chí chấp nhận hay đối soát giữa người chấm. Rẻ hơn thuê model khác là blind human review cố định, phân tầng và giữ lại một tập holdout; ghi agreement và ngưỡng lệch tối đa trước khi chấp nhận baseline.
3. Mảng C chưa nêu cấu hình đo và cổng coverage ≥70%, dù kế hoạch viện dẫn NFR-MAINT-01; cũng chưa thấy kế hoạch OpenAPI/Swagger mà SRS trích yếu yêu cầu.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. Có thể cung cấp PDF SRS v1.2 đầy đủ hoặc phê duyệt rõ rằng `docs/srs-trich-yeu.md` là đủ để thay đổi/miễn các yêu cầu Langfuse, RAGAS, DeepEval và dashboard không?
2. Ai phê duyệt mục tiêu self-service tối thiểu và ngưỡng chấp nhận cho đối soát thủ công của bộ đánh giá?

## Vòng 2 — phân loại điểm chặn (2026-09-06)

Đối chiếu từng BLOCKER với code thật.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Quét lưới ngưỡng sai giả định: `retrieve()` luôn tự embed, không nhận vector đã tính | **Đúng** | `server/rag/retrieval.ts:116` — `vectorBranch()` gọi `getEmbedder().embed([query])` mỗi lượt, và `RetrievalOptions` (dòng 29–49) không có trường nào nhận embedding có sẵn. Cam kết "một câu chỉ embed một lần cho cả lưới" ở vòng 2 là **sai về code hiện tại**. |
| 2 | Mảng B chưa nghiệm thu được Mục 11.4.7: không Langfuse, không chạy định kỳ trên 1–5% hội thoại thật, không dashboard, CI hoãn "về sau" | **Không rõ — cần người dùng quyết** | Người soát mô tả đúng cả hai phía: SRS Mục 11.4.7 liệt kê rõ Langfuse + RAGAS + DeepEval + bốn chỉ số vận hành trên bảng điều khiển, còn kế hoạch thì chủ ý thay bằng bộ tự viết. Đây không phải lỗi sự kiện mà là **đánh đổi phạm vi**: hoặc làm đủ theo SRS, hoặc có phê duyệt miễn trừ. Không tự quyết được. |
| 3 | Capability token không chấp nhận được: hội thoại lưu bản gốc chưa che PII, `sessionId` là bearer trong `localStorage`, ai có id đọc được toàn bộ transcript qua `GET` | **Đúng, và nặng hơn kế hoạch mô tả** | `src/hooks/useChatSession.tsx:30-34` lưu `sessionId` trong `localStorage`; `server/routes/chat.ts:38-46` cho phiên vãng lai đọc được bởi bất kỳ ai giữ id; `prisma/schema.prisma` model `ChatMessage` ghi rõ `content` lưu **bản gốc chưa che**. Kế hoạch vòng 2 nói "hậu quả tối đa là xoá hội thoại của chính người giữ id" — **sai**: hậu quả lớn hơn là *đọc* được toàn bộ transcript kèm PII. Và rủi ro này **đã tồn tại trong code hiện tại**, không phải do kế hoạch tạo ra. |

### Hệ quả

Điểm 1 và 3 sẽ được xử lý trong vòng 3. Điểm 2 là loại "Không rõ" nên theo `docs/dev-flow.md`
phải **dừng và hỏi người dùng** kèm khuyến nghị, thay vì tự chọn một trong hai hướng.

### Điểm NON-BLOCKER ghi nhận cho vòng 3

- `ChatMessage.itinerary Json?` được xác nhận là đúng chỗ hơn tham chiếu `SavedItinerary`
  (snapshot của một câu trả lời, khác với đối tượng người dùng chủ động lưu). Nhưng
  `generateItinerary()` hiện trả `any` chứ không phải `ItineraryPlan` đã kiểm tra — phải xác
  thực hình dạng ở **cả lúc ghi lẫn lúc đọc**, không chỉ lúc đọc như vòng 2 nêu.
- Ba biện pháp chống tự chấm điểm chưa đủ mạnh: 10 câu ngẫu nhiên không có cỡ mẫu theo nhóm,
  không có tiêu chí chấp nhận, không có đối soát giữa người chấm. Đề xuất thay bằng blind human
  review phân tầng cố định + giữ một tập holdout, ghi mức đồng thuận và ngưỡng lệch tối đa
  **trước** khi chấp nhận baseline.
- Mảng C chưa nêu cấu hình đo độ phủ và cổng ≥ 70% dù viện dẫn NFR-MAINT-01; cũng chưa có kế
  hoạch cho tài liệu API OpenAPI/Swagger mà chính NFR đó yêu cầu.

### Câu hỏi của người soát

| # | Câu hỏi | Xử lý |
|---|---|---|
| 1 | Cung cấp PDF SRS đầy đủ, hoặc phê duyệt rõ rằng `docs/srs-trich-yeu.md` là đủ để miễn trừ yêu cầu Langfuse/RAGAS/DeepEval và dashboard? | Chính là điểm chặn số 2 — đang hỏi người dùng. |
| 2 | Ai phê duyệt mục tiêu self-service tối thiểu và ngưỡng chấp nhận cho đối soát thủ công? | Đã nằm ở đầu vào số 6 của kế hoạch; vòng 3 sẽ nêu rõ hơn rằng ngưỡng đối soát phải chốt trước khi chạy đo. |

---

## Vòng 3 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 3**, chưa phải code. Vòng 1 FAIL với 4 điểm chặn, vòng
2 FAIL với 3 điểm chặn. Kế hoạch đã được lập lại lần thứ hai. Hãy phản biện thẳng thắn.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-giai-doan-1-hoan-tat/plan.md`;
các điều khoản SRS được viện dẫn đã chép nguyên văn vào `docs/srs-trich-yeu.md`. Hãy đọc trực
tiếp hai file đó và đối chiếu với code thật, thay vì chỉ tin phần tóm tắt dưới đây.

### Bối cảnh dự án

Travel AI Hà Giang — React + Vite (TypeScript) ở `src/`, server Express ở `server.ts` và
`server/`, Postgres + pgvector qua Prisma ở `prisma/`, embedding service Python ở
`embedding-service/`. Gemini gọi qua biến môi trường.

Giai đoạn 1 theo SRS Mục 12: chatbot AI đủ 6 tác tử, dữ liệu mẫu, widget chat, lưu và đồng bộ
lịch sử hội thoại. Chưa có giỏ hàng/thanh toán/đặt chỗ. Codebase đã có gần trọn kiến trúc đó
nhưng **chưa chạy thật lần nào** (`RebootPending = True`, `GEMINI_API_KEY` rỗng).

### Hai quyết định của người dùng định hình vòng này

Vòng 2 có một điểm chặn thuộc loại "cần người dùng quyết", đã hỏi và có câu trả lời:

1. **Dựng đủ bộ đo lường theo SRS Mục 11.4.7** — Langfuse + RAGAS + DeepEval + CI + bảng điều
   khiển bốn chỉ số vận hành. Người dùng **bác** phương án bộ tự viết mà vòng 1 và vòng 2 đề
   xuất, chấp nhận phạm vi phình.
2. **Tách lỗ hổng bảo mật phiên thành task riêng** — hồ sơ mới
   `docs/plans/20260906-bao-mat-phien-chat/plan.md`, không nhét vào kế hoạch Giai đoạn 1.

### Ba điểm chặn của vòng 2 và cách vòng 3 xử lý

| # | Điểm chặn vòng 2 | Kết luận sau khi đối chiếu code | Xử lý |
|---|---|---|---|
| 1 | `retrieve()` luôn tự embed; `RetrievalOptions` không nhận vector đã tính, nên "một câu embed một lần cho cả lưới" là sai | **Đúng** — `server/rag/retrieval.ts:116` | Thêm `RetrievalOptions.queryEmbedding?: number[]`; `vectorBranch()` dùng vector truyền vào nếu có và đặt `embedMs = 0` để không tính nhầm độ trễ |
| 2 | Bộ đo tự viết không tái tạo được Langfuse / chạy định kỳ / dashboard / CI | **Không rõ → người dùng quyết** | **Dựng đủ theo SRS** (chi tiết bên dưới) |
| 3 | `sessionId` là bearer token trong `localStorage`, transcript lưu PII chưa che, ai có id **đọc** được toàn bộ | **Đúng, nặng hơn kế hoạch vòng 2 mô tả** | **Tách thành task riêng** theo quyết định người dùng; ghi vào "Ngoài phạm vi" kèm đường dẫn và mốc "phải đóng trước khi nhận khách thật" |

Ba điểm NON-BLOCKER của vòng 2 cũng được nhận: xác thực hình dạng lịch trình ở **cả lúc ghi lẫn
lúc đọc** (vì `ItineraryOutcome.plan` khai là `any`), cấu hình đo độ phủ kèm cổng ≥ 70%, và tài
liệu API OpenAPI/Swagger mà NFR-MAINT-01 yêu cầu.

### Sự kiện về code, đã kiểm chứng ở vòng này

**Điểm chặn số 1 — `retrieve()` luôn tự embed:**

```ts
// server/rag/retrieval.ts:109-117
async function vectorBranch(query: string, options, limit, minSimilarity) {
  const startedAt = Date.now();
  const [vector] = await getEmbedder().embed([query]);   // LUON tu embed
  const embedMs = Date.now() - startedAt;
```

`RetrievalOptions` (dòng 29–49) có `minVectorSimilarity`, `minKeywordRank`,
`candidatesPerBranch`, `fuseLimit`, `finalLimit`, `docTypes`, `placeSlugs` — **không** có
trường nào nhận embedding có sẵn.

**NON-BLOCKER số 1 — lịch trình không có bảo đảm kiểu:**

```ts
// server/itineraryCore.ts:25-30
export interface ItineraryOutcome {
  plan: any;                    // <-- any
  metrics: CallMetrics;
}
export async function generateItinerary(request: ItineraryRequest): Promise<ItineraryOutcome>;
```

Tác tử gán thẳng `itinerary: plan` (`server/agents/specialists/itinerary.ts:77`), và cột dự
kiến `ChatMessage.itinerary Json?` cũng không ràng buộc kiểu ở tầng DB.

**Hạ tầng đo lường — chưa có gì, nhưng có chỗ cắm:**

- Không có `.github` trong repo.
- **Có** remote GitHub: `https://github.com/NMinh-123/Travel-AI.git` → GitHub Actions dùng được
  ngay.
- Đã có một stack Python (`embedding-service/`: FastAPI + sentence-transformers + torch), nhưng
  torch có ràng buộc CUDA riêng nên bộ đánh giá phải dùng **virtualenv tách biệt**.
- **Langfuse v3 self-host cần sáu dịch vụ**: `langfuse-web`, `langfuse-worker`, PostgreSQL,
  ClickHouse, Redis/Valkey, S3/MinIO. Yêu cầu tối thiểu công bố cộng lại khoảng **9 CPU và
  21,5 GiB RAM**, chồng lên Postgres ứng dụng và sidecar BGE-M3 trên cùng máy phát triển.
- **Langfuse Cloud không phải lối thoát**: dữ liệu ghi vết chứa nội dung hội thoại, tức chứa
  PII — đúng loại việc mà SRS Mục 11.4.8 và NĐ 13/2023 đặt nghĩa vụ.
- RAGAS và DeepEval đều chạy được với Gemini làm model chấm, nên không phát sinh khoá của nhà
  cung cấp thứ hai.

**Mốc kiểm chứng hiện có, nói cho đúng:** `tsc --noEmit` sạch; `npx vite build` thành công
(341 kB); drift schema ↔ migration 53/53 object khớp; **và 16 ca kiểm thử logic thuần chạy TAY**
cho `chunker` + `pii` ở Vòng 5 phát triển — chính đợt đó bắt được lỗi regex khiến số điện thoại
không hề được che trước khi gửi ra API ngoài. Các ca đó chưa được đóng băng thành test tự động.
Repo không có framework test nào.

### Tóm tắt kế hoạch vòng 3

Đọc `plan.md` để có bản đầy đủ. Cốt lõi:

**A. Bring-up thật** — `docker compose up -d db` → `prisma migrate deploy` → `db:seed` →
sidecar → `db:ingest` → `dev`, kiểm chứng bằng SQL trực tiếp (extension `vector`+`unaccent`,
cấu hình `vietnamese`, mọi `KnowledgeDoc` có embedding, chỉ mục HNSW và GIN), chạy tay 5 kịch
bản Mục 11.2, xác minh tên hai model Gemini.

**B. Bộ đo lường theo đúng SRS:**

| Thành phần | Cách dựng |
|---|---|
| Langfuse self-host | `docker-compose.langfuse.yml` **tách riêng** để bật/tắt độc lập |
| SDK Langfuse trong server | Gọi từ `orchestrator.ts` sau mỗi lượt, dùng lại `TurnTrace` đã có |
| RAGAS | virtualenv riêng `eval-service/`, Gemini làm model chấm |
| DeepEval | cùng virtualenv, chạy như kiểm thử đơn vị trên bộ câu hỏi vàng |
| CI | `.github/workflows/quality.yml` |
| Dashboard | Dashboard sẵn có của Langfuse + score tuỳ biến cho bốn chỉ số vận hành |

Hai ràng buộc: ghi vết theo kiểu **bắn-và-quên có timeout** (lỗi ghi vết không bao giờ được làm
hỏng câu trả lời cho khách), và **Langfuse là kho PII thứ hai** nên phải nằm trong phạm vi
chính sách xoá ở mảng E.

Bộ câu hỏi vàng `eval/golden-set.ts`: 100–200 câu, mỗi câu có `question`, `intent`, `expect`
(`answer`/`escalate`), `goldChunks`, `referenceAnswer`, `mustInclude`, `mustNotInclude`; xuất
sang dataset Langfuse để RAGAS và DeepEval cùng đọc một nguồn.

Bốn cách đo cho bốn tham số: hai ngưỡng RAG quét lưới **một lần embed** nhờ `queryEmbedding`;
`RERANK_ENABLED` hai lần chạy cùng chỉ mục; `VI_SEGMENT_ENABLED` **hai lần ingest** riêng;
`MIN_INTENT_CONFIDENCE` phân tích ngoại tuyến từ `confidence` thật đã ghi. Ngưỡng chặn: bám
nguồn dưới 0,80 thì dừng phát hành.

**C. Test + độ phủ + tài liệu API** — vitest làm devDependency; 5 nhóm logic thuần không cần DB
(`pii` đóng băng 16 ca đã chạy tay, `chunker`, `dialog`, `orchestrator`, `MarkdownMessage`), 2
nhóm cần DB (`auth`, quyền xoá phiên) dùng schema `?schema=test`. Cổng độ phủ **70% áp cho
`server/agents/**`, `server/rag/**`, `server/auth.ts`** chứ không cho toàn repo.
`docs/openapi.yaml` viết tay cho ~20 endpoint hiện có.

**D. Lưu và khôi phục lịch trình** — migration `ChatMessage.itinerary Json?` → ghi ở `POST` →
trả ở `GET /sessions/:id` → frontend gắn vào `ChatMessage.itinerarySnippet` và render thẻ tóm
tắt. **Xác thực hình dạng ở cả lúc ghi lẫn lúc đọc** vì `ItineraryOutcome.plan` là `any`.

**E. Thời hạn lưu trữ và quyền xoá** — `docs/chinh-sach-du-lieu.md`;
`DELETE /api/chat/sessions/:id`; `scripts/purge-chat.ts` mặc định `--dry-run`. Phạm vi xoá gồm
**hai kho**: Postgres ứng dụng và Langfuse. Yêu cầu xoá theo đơn của khách có hiệu lực **tức
thì** qua endpoint; job chỉ lo phần hết hạn lưu trữ, chạy hằng ngày qua Task Scheduler/cron.

**Ngoài phạm vi:** bảo mật phiên (task riêng, phải đóng trước khi nhận khách thật), FR-BOT-09,
FR-BOT-10, FR-ADM-01..04, FR-BOOK/FR-PAY, WebSocket, **chạy RAGAS định kỳ trên 1–5% hội thoại
THẬT** (hạ tầng dựng đủ nhưng chưa có lưu lượng thật để lấy mẫu — cấu hình sẵn, kích hoạt khi
có khách), dọn dữ liệu còn giả, commit/dọn git.

**Đầu vào yêu cầu người dùng:** `GEMINI_API_KEY`; xác nhận reboot + Docker; **máy có kham nổi
Langfuse không** (còn bao nhiêu RAM/CPU); nguồn bộ câu hỏi vàng; ai ký nhận đáp án chuẩn và
ngưỡng đối soát thủ công; thời hạn lưu trữ và nơi đặt dữ liệu/backup; kênh tiếp nhận escalation;
quyền ghi GitHub Secrets cho khoá Gemini dùng trong CI; đưa SRS PDF vào repo; `GOOGLE_CLIENT_ID`.

### Việc của bạn

Kiểm tra: kế hoạch có xử lý xong ba điểm chặn của vòng 2 không; có sai giả định về code hiện tại
không (hãy đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên, lỗi bảo mật, hay ảnh
hưởng tới phần khác không; có cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được
không.

Bốn câu hỏi vòng này đặc biệt muốn bị phản biện:

1. Với quyết định "dựng đủ theo SRS" đã chốt, kế hoạch mảng B có còn thiếu năng lực nào mà
   Mục 11.4.7 đòi hỏi không?
2. Việc **hoãn** phần "chạy RAGAS định kỳ trên 1–5% hội thoại thật" sang khi có lưu lượng có
   hợp lý không, hay đó vẫn là một khoảng trống nghiệm thu phải xử lý ngay?
3. Tách bảo mật phiên thành task riêng có tạo ra rủi ro nào cho chính kế hoạch này không —
   ví dụ mảng E thêm endpoint `DELETE` dùng lại đúng cơ chế quyền đang có vấn đề?
4. `RetrievalOptions.queryEmbedding` có phải cách đúng để tái sử dụng embedding không, hay nên
   tách hẳn khâu embed ra khỏi `retrieve()`?

Trả lời **đúng định dạng sau**, không thêm lời dẫn:

```
VERDICT: PASS | FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. <vấn đề> — vì sao chặn: <lý do> — đề xuất: <cách sửa>

NON-BLOCKER (nên cân nhắc, không chặn)
1. <góp ý>

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. <câu hỏi>
```

Chỉ trả `PASS` khi mục BLOCKER trống. Nếu thiếu thông tin để kết luận, trả `FAIL` và đặt câu hỏi
thay vì đoán.

## Vòng 3 — phản hồi nhận về (2026-09-06)

VERDICT: FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. Mảng B chưa thiết kế đường ghi Langfuse đáp ứng đủ dữ liệu SRS yêu cầu — vì sao chặn: `TurnTrace` hiện chỉ có ID tài liệu trích dẫn, độ trễ và token; không có câu hỏi, nội dung các chunk truy xuất, câu trả lời hay chi phí đã tính. Gọi SDK từ `orchestrator.ts` “dùng lại TurnTrace” không thể tự ghi đủ trace bắt buộc. — đề xuất: định nghĩa contract telemetry đầy đủ và điểm phát trace sau khi có đủ input/output; lưu/query chunk thực tế, usage và quy tắc tính chi phí rõ ràng, cùng kiểm thử xác nhận một trace Langfuse chứa đủ trường.
2. Hoãn chạy RAGAS định kỳ trên 1–5% hội thoại thật sang “khi có khách” để lại thiếu năng lực bắt buộc của Mục 11.4.7 — vì sao chặn: SRS yêu cầu chạy định kỳ, còn kế hoạch không nêu scheduler, cách lấy mẫu 1–5%, chống chạy trùng, xử lý thất bại, hay kiểm chứng job. “Cấu hình sẵn” nhưng để ngoài phạm vi không nghiệm thu được. — đề xuất: dựng và kiểm thử ngay job định kỳ với tập dữ liệu/trace seed; khi chưa có hội thoại thật, job chạy hợp lệ với mẫu rỗng và quan sát được, rồi tự lấy mẫu 1–5% khi trace thật xuất hiện.
3. Mảng E yêu cầu xoá tức thì ở Postgres lẫn Langfuse nhưng chưa có cơ chế nhất quán, và dùng endpoint trước khi task bảo mật phiên được hoàn tất — vì sao chặn: guest `sessionId` hiện là bearer token; endpoint DELETE mới sẽ kế thừa quyền sai đó. Đồng thời fire-and-forget trace có thể đến Langfuse sau khi phiên đã bị xoá, và kế hoạch không lưu liên kết trace/session hay có outbox, retry, tombstone để chứng minh xoá đủ hai kho. — đề xuất: đưa việc triển khai DELETE sau task bảo mật phiên, hoặc coi task đó là dependency bắt buộc; thiết kế correlation ID theo session, tombstone/outbox xoá bền vững, retry/idempotency và chặn trace mới cho phiên đã xoá.

NON-BLOCKER (nên cân nhắc, không chặn)
1. `queryEmbedding?: number[]` là cách tương thích ngược hợp lý; vẫn nên kiểm tra hữu hạn và đúng 1024 chiều trước khi tạo vector literal, đồng thời báo riêng thời gian embed dùng chung ở harness để số đo end-to-end không bị hiểu là `embedMs = 0`.
2. Cần chốt rõ RAGAS chấm trên câu trả lời/chunk thực tế được ghi trace, không chỉ trên `goldChunks`; `goldChunks` nên là ground truth để tính context coverage/recall.
3. Test quyền xoá nên có cả guest không sở hữu secret/cookie, phiên đăng nhập của chính chủ và người dùng khác; kiểm tra hiện nêu chỉ bao phủ phiên đã gắn tài khoản.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. Task bảo mật phiên có được hoàn tất và nghiệm thu trước khi bắt đầu mảng E, hay kế hoạch Giai đoạn 1 dự kiến phát hành endpoint DELETE độc lập?

## Vòng 3 — phân loại điểm chặn (2026-09-06)

Đối chiếu từng BLOCKER với code thật. **Cả ba đều Đúng.** Đây là vòng FAIL thứ ba liên tiếp nên
theo quy tắc chống lặp ở `docs/dev-flow.md`, dừng lại và xin người dùng quyết thay vì gửi vòng 4.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | `TurnTrace` không đủ dữ liệu để ghi vết theo SRS; "dùng lại `TurnTrace`" là bất khả thi | **Đúng** | `server/agents/types.ts` — `TurnTrace` có `intent, confidence, agent, grounded, citedDocIds, escalated, totalMs, nluMs, agentMs, calls, retrieval`. **Không có** câu hỏi, **không có** nội dung các đoạn đã truy xuất (chỉ có id), **không có** câu trả lời. `CallMetrics` (`server/gemini.ts`) có `model, latencyMs, promptTokens?, outputTokens?` — có token nhưng **không có chi phí**; `server/costs.ts` là dự toán chi phí chuyến đi cho khách, không liên quan chi phí gọi model. SRS Mục 11.4.7 đòi lưu "câu hỏi, các đoạn tri thức được truy xuất, câu trả lời, chi phí và độ trễ của từng lượt" — thiếu ba trong năm. |
| 2 | Hoãn chạy RAGAS định kỳ trên 1–5% hội thoại thật là để lại khoảng trống nghiệm thu | **Đúng** | Kế hoạch vòng 3 xếp mục này vào "Ngoài phạm vi" với lý do chưa có lưu lượng thật. Nhưng SRS liệt kê nó trong danh sách bắt buộc của Giai đoạn 1, và đề xuất của người soát là làm được: dựng job ngay, chạy hợp lệ với mẫu rỗng, tự lấy mẫu khi có trace thật. Kế hoạch không nêu scheduler, cách lấy mẫu, chống chạy trùng, xử lý thất bại. |
| 3 | Mảng E thêm `DELETE` kế thừa đúng cơ chế quyền đang hỏng; và xoá hai kho chưa có cơ chế nhất quán | **Đúng, và lộ ra mâu thuẫn do việc tách task** | `server/routes/chat.ts:38-46` — `loadSession()` cho phiên vãng lai đọc/ghi được bởi bất kỳ ai giữ id. Kế hoạch vòng 3 tách bảo mật phiên sang task riêng **nhưng vẫn thêm `DELETE` dùng lại chính hàm đó**. Thêm nữa: ghi vết bắn-và-quên có thể tới Langfuse **sau khi** phiên đã bị xoá, và kế hoạch không có correlation id theo phiên, không outbox, không tombstone, không retry — nên không chứng minh được đã xoá đủ hai kho. |

### Ba điểm NON-BLOCKER ghi nhận

- `queryEmbedding?: number[]` được xác nhận là cách tương thích ngược hợp lý, nhưng phải **kiểm
  tra hữu hạn và đúng 1024 chiều** trước khi dựng vector literal, và harness phải báo riêng thời
  gian embed dùng chung để số đo đầu-cuối không bị hiểu nhầm là `embedMs = 0`.
- Phải chốt rõ RAGAS chấm trên **câu trả lời và đoạn thực tế đã ghi vết**, không phải trên
  `goldChunks`; `goldChunks` chỉ đóng vai ground truth để tính độ bao phủ và recall.
- Test quyền xoá phải bao gồm **khách vãng lai không giữ secret/cookie**, chủ phiên đã đăng
  nhập, và người dùng khác — bản vòng 3 chỉ nêu trường hợp phiên đã gắn tài khoản.

### Điểm phải hỏi người dùng

Người soát đặt đúng câu hỏi mà kế hoạch không tự trả lời được: **task bảo mật phiên có phải là
điều kiện tiên quyết của mảng E không, hay Giai đoạn 1 vẫn phát hành `DELETE` độc lập?**

Quyết định tách task ở vòng trước làm nảy sinh mâu thuẫn này: mảng E cần một endpoint ghi/xoá
trên đúng cơ chế quyền mà task kia sinh ra để sửa.
