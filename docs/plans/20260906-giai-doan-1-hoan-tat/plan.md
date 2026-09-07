---
task: giai-doan-1-hoan-tat
tieu-de: Hoàn tất Giai đoạn 1 của SRS v1.2 — đưa chatbot 6 tác tử vào trạng thái chạy thật, đo được và nghiệm thu được
status: cho-duyet
round: 3
ngay-tao: 2026-09-06
---

# Hoàn tất Giai đoạn 1 — SRS v1.2 Mục 12

## Yêu cầu

Nguyên văn người dùng: *"dựa vào file SRS và source code hiện có hãy hoàn thành giai đoạn 1.
Nếu có phần dữ liệu, API, key nào cần thiết, hãy yêu cầu tôi"*.

Giai đoạn 1 theo SRS Mục 12: chatbot AI đủ 6 tác tử theo Hình 9.2, chạy trên dữ liệu mẫu,
widget chat trên trang landing, lưu và đồng bộ lịch sử hội thoại. Chưa có giỏ hàng, thanh toán,
đặt chỗ tự động. Ràng buộc kèm theo (nguyên văn ở [`docs/srs-trich-yeu.md`](../../srs-trich-yeu.md)):
Mục 11.4.7 (bộ đo lường bắt buộc), Mục 11.4.4 (đo trước khi bật rerank), Mục 11.3 + NFR-SEC-05
(thời hạn lưu trữ, quyền xoá, xem lại được lịch trình đã nhận), NFR-MAINT-01 (độ phủ ≥ 70% và
tài liệu API OpenAPI/Swagger), NFR-PERF-03 (≤ 3 giây cho 95% lượt), Mục 14 (tự phục vụ ≥ 60%).

**Hai quyết định của người dùng ngày 2026-09-06 định hình vòng này:**

1. **Dựng đủ bộ đo lường theo SRS** — Langfuse + RAGAS + DeepEval + CI + bảng điều khiển bốn
   chỉ số vận hành, thay vì bộ tự viết mà hai vòng trước đề xuất. Chấp nhận phạm vi phình.
2. **Tách lỗ hổng bảo mật phiên thành task riêng** —
   [`docs/plans/20260906-bao-mat-phien-chat/`](../20260906-bao-mat-phien-chat/plan.md), không
   nhét vào kế hoạch này.

## Thay đổi so với vòng 2

Vòng 2 bị **FAIL** với 3 điểm chặn:

| # | Điểm chặn vòng 2 | Kết luận | Xử lý ở vòng 3 |
|---|---|---|---|
| 1 | Quét lưới ngưỡng sai giả định: `retrieve()` luôn tự embed, `RetrievalOptions` không nhận vector đã tính | **Đúng** | Thêm trường `queryEmbedding?: number[]` vào `RetrievalOptions`; `vectorBranch()` dùng vector truyền vào nếu có, chỉ tự embed khi không có. Bộ đánh giá embed một lần rồi tái sử dụng cho cả lưới |
| 2 | Bộ đo tự viết không tái tạo được Langfuse, chạy định kỳ trên hội thoại thật, dashboard, CI | **Không rõ → người dùng quyết** | **Dựng đủ theo SRS.** Mảng B viết lại hoàn toàn ở dưới |
| 3 | `sessionId` là bearer token, ai có id đọc được toàn bộ transcript kèm PII chưa che | **Đúng, nặng hơn kế hoạch mô tả** | **Tách thành task riêng** theo quyết định của người dùng; đưa vào "Ngoài phạm vi" kèm đường dẫn |

Ba điểm NON-BLOCKER cũng được nhận và đưa vào kế hoạch: xác thực hình dạng lịch trình ở **cả
lúc ghi lẫn lúc đọc** (vì `ItineraryOutcome.plan` là `any`), cấu hình đo độ phủ kèm cổng ≥ 70%,
và tài liệu API OpenAPI/Swagger mà NFR-MAINT-01 yêu cầu.

## Hiện trạng

### Phần lõi Giai đoạn 1 đã có code và type-check sạch

Vòng 5–6 (`history.md`) đã dựng gần trọn kiến trúc Hình 9.2: NLU (`server/agents/nlu.ts`),
Dialog Manager (`dialog.ts`), Orchestrator (`orchestrator.ts`), 5 tác tử chuyên biệt
(`specialists/`), bộ công cụ (`tools.ts` — chỉ truy vấn DB, không gọi model), Guardrail
(`guardrail.ts`), che PII (`pii.ts`), đường ống RAG (`server/rag/`), kho vector + tsvector
(`KnowledgeDoc`), ba bảng hội thoại, widget và tab chat.

Ba trigger chuyển tiếp bắt buộc của Mục 10.6 ở `server/agents/orchestrator.ts:118-137`.
FR-BOT-11 có cả endpoint lẫn giao diện.

### Toàn bộ tầng đó chưa chạy thật một lần nào

`RebootPending` vẫn `True`, `GEMINI_API_KEY` vẫn rỗng. Migration, `CREATE EXTENSION vector`,
cấu hình `vietnamese`, chỉ mục HNSW, `db:ingest` và mọi lượt hội thoại đều chưa từng thực thi —
khoảng 30 file server chưa chạy một dòng nào ở runtime.

Mốc kiểm chứng hiện có, nói cho đúng: `tsc --noEmit` sạch; `npx vite build` thành công (341 kB);
drift schema ↔ migration 53/53 object khớp; **và 16 ca kiểm thử logic thuần chạy tay** cho
`chunker` + `pii` ở Vòng 5 — chính đợt đó bắt được lỗi regex khiến số điện thoại không hề được
che. Các ca đó chưa được đóng băng thành test tự động.

### Ba tham số cấu hình hành xử khác nhau

| Tham số | Đổi được trong một lần chạy? | Cần ingest lại? | Dẫn chứng |
|---|---|---|---|
| Hai ngưỡng RAG | **Có** | Không | `RetrievalOptions.minVectorSimilarity` / `.minKeywordRank` (`server/rag/retrieval.ts:38-41`) |
| `RERANK_ENABLED` | Không | Không | `config.rerankEnabled` đọc lúc truy vấn (`retrieval.ts:273`), `config` đóng băng lúc nạp module |
| `VI_SEGMENT_ENABLED` | Không | **Có** | Ảnh hưởng cả `scripts/ingest-knowledge.ts:142` lẫn `server/rag/segment.ts:27` |

**Nhưng embedding thì chưa tái sử dụng được** — đây là điểm chặn số 1 của vòng 2:

```ts
// server/rag/retrieval.ts:109-117
async function vectorBranch(query: string, options, limit, minSimilarity) {
  const startedAt = Date.now();
  const [vector] = await getEmbedder().embed([query]);   // LUÔN tự embed
  const embedMs = Date.now() - startedAt;
```

`RetrievalOptions` không có trường nào nhận vector đã tính, nên quét lưới ngưỡng theo cách vòng
2 mô tả sẽ embed lại ở **mỗi ô lưới**.

### Hạ tầng đo lường: chưa có gì, nhưng có chỗ để cắm

- **Không có CI**: repo không có thư mục `.github`.
- **Có remote GitHub**: `https://github.com/NMinh-123/Travel-AI.git` — nên GitHub Actions dùng
  được ngay, không phải dựng runner riêng.
- **Đã có một stack Python**: `embedding-service/` (FastAPI + sentence-transformers + torch).
  RAGAS và DeepEval là thư viện Python, nên chúng vào được cùng hệ sinh thái đó thay vì thành
  một môi trường thứ ba — nhưng **phải là virtualenv riêng**, vì torch của sidecar rất nặng và
  không nên trộn với phụ thuộc của bộ đánh giá.
- **Langfuse v3 self-host cần sáu dịch vụ**: `langfuse-web`, `langfuse-worker`, PostgreSQL,
  ClickHouse, Redis/Valkey, và S3/MinIO. Yêu cầu tối thiểu công bố: worker 2 CPU / 4 GiB,
  Postgres 2 CPU / 4 GiB, Redis 1 CPU / 1,5 GiB, ClickHouse 2 CPU / 8 GiB, MinIO 2 CPU / 4 GiB.
  Cộng lại khoảng **9 CPU và 21,5 GiB RAM**, chồng lên Postgres của ứng dụng và sidecar BGE-M3
  đang chạy. Đây là chi phí thật của quyết định "dựng đủ theo SRS" và phải được nói thẳng —
  xem mục Rủi ro.
- **Langfuse Cloud không phải lối thoát**: dữ liệu ghi vết chứa nội dung hội thoại, tức chứa
  PII. Đẩy sang dịch vụ đám mây nước ngoài là đúng loại việc mà SRS Mục 11.4.8 và NĐ 13/2023
  đặt nghĩa vụ. Tự triển khai là lựa chọn đúng, không phải lựa chọn tiện.
- **RAGAS và DeepEval đều chạy được với Gemini làm model chấm**, nên không phát sinh khoá của
  nhà cung cấp thứ hai.

### Bốn khoảng trống so với mốc nghiệm thu

1. **Không có bộ đo lường nào.** Bốn tham số chưa có căn cứ: `MIN_INTENT_CONFIDENCE = 0.5`
   (`server/agents/types.ts:34`) tự ghi chú là chưa phải kết quả đo; cặp ngưỡng RAG đo trên tập
   tự soạn 45 câu với kho 31 đoạn, biên an toàn phía dưới chỉ khoảng 0,04.
2. **Không có test tự động nào**, không có cấu hình đo độ phủ, không có tài liệu API.
3. **Lịch trình không được lưu.** `server/routes/chat.ts:138` trả `itinerary` trong phản hồi
   `POST` nhưng `ChatMessage` không có trường chứa, `GET /sessions/:id` không trả về, frontend
   chưa khai. Thêm nữa `ItineraryOutcome.plan` là **`any`** (`server/itineraryCore.ts:26`) —
   không có gì bảo đảm hình dạng.
4. **Chưa có chính sách lưu trữ và quyền xoá hội thoại.** Phiên vãng lai không có đường nào xoá.

## Phương án chọn

Năm mảng A–E.

```
A. bring-up + xác minh  ──┬──► B3. chạy đo, hiệu chỉnh tham số ──► chốt baseline
   (cần GEMINI_API_KEY)   └──► D. kiểm chứng lịch trình đầu-cuối

song song, KHÔNG chờ A:
C.  test + cấu hình độ phủ + OpenAPI
B1. dựng hạ tầng đo lường (Langfuse, môi trường Python đánh giá, CI)
B2. bộ câu hỏi vàng
D.  migration + contract lưu lịch trình + frontend
E.  chính sách dữ liệu, endpoint xoá, job dọn
```

### A. Đưa hệ thống vào trạng thái chạy thật

Không viết code mới. Chạy `docker compose up -d db` → `npx prisma migrate deploy` →
`npm run db:seed` → sidecar embedding → `npm run db:ingest` → `npm run dev`. Ghi output thật
từng bước vào `docs/plans/20260906-giai-doan-1-hoan-tat/buoc-a-ket-qua.md`.

Kiểm chứng bằng SQL trực tiếp, không tin vào "lệnh không báo lỗi": `pg_extension` phải có
`vector` và `unaccent`; `pg_ts_config` phải có `vietnamese`; mọi `KnowledgeDoc` phải có
`embedding IS NOT NULL`; `\d "KnowledgeDoc"` phải thấy chỉ mục HNSW và GIN; `/api/health` trả
`dbConnected: true` và `aiConfigured: true`.

Rồi chạy tay năm kịch bản Mục 11.2, ghi `ChatMessage.trace` thật để đối chiếu ngưỡng ≤ 3 giây.
**Xác minh tên model** `gemini-2.5-flash` và `gemini-2.5-flash-lite` bằng lệnh liệt kê model.

### B. Bộ đo lường theo đúng SRS Mục 11.4.7

#### B1. Hạ tầng

| Thành phần | Cách dựng | Vai trò theo SRS |
|---|---|---|
| **Langfuse** (self-host) | `docker-compose.langfuse.yml` **tách riêng** khỏi `docker-compose.yml` của ứng dụng, để bật/tắt độc lập | Lớp ghi vết: câu hỏi, đoạn tri thức truy xuất, câu trả lời, chi phí, độ trễ từng lượt |
| **SDK Langfuse trong server** | Gọi từ `server/agents/orchestrator.ts` sau mỗi lượt, dùng lại đúng dữ liệu `TurnTrace` đã có | Nguồn dữ liệu duy nhất để phân tích chất lượng |
| **RAGAS** | virtualenv riêng `eval-service/`, cấu hình Gemini làm model chấm | Bốn chỉ số: bám nguồn, độ liên quan câu trả lời, độ chính xác và độ bao phủ ngữ cảnh |
| **DeepEval** | cùng virtualenv, chạy như kiểm thử đơn vị trên bộ câu hỏi vàng | Cổng chất lượng trong CI |
| **CI** | `.github/workflows/quality.yml` (repo đã có remote GitHub) | Chặn triển khai nếu chất lượng suy giảm |
| **Bảng điều khiển** | Dùng dashboard sẵn có của Langfuse; bổ sung bốn chỉ số vận hành bằng truy vấn/score tuỳ biến | Tỷ lệ trả lời không tìm thấy căn cứ, tỷ lệ chuyển tiếp nhân viên, độ trễ p95, chi phí trung bình mỗi phiên |

Hai ràng buộc phải giữ:

- **Ghi vết không được làm hỏng lượt hội thoại.** Gọi Langfuse theo kiểu bắn-và-quên, có
  timeout, lỗi thì nuốt và ghi log — không bao giờ để một lỗi ghi vết làm hỏng câu trả lời cho
  khách. Cùng nguyên tắc "không dựng nội dung giả để che lỗi cấu hình" nhưng theo chiều ngược:
  hạ tầng quan sát hỏng thì sản phẩm vẫn phải chạy.
- **Che PII trước khi ghi vết?** Langfuse tự triển khai nằm trong hạ tầng của mình nên xét theo
  Mục 11.4.8 thì không phải "gửi ra API nước ngoài". Nhưng nó là một kho dữ liệu thứ hai chứa
  PII, nên **phải nằm trong phạm vi của chính sách xoá ở mảng E** — không được quên như kiểu
  backup bị bỏ sót.

#### B2. Bộ câu hỏi vàng — `eval/golden-set.ts`

100–200 câu tiếng Việt, mỗi câu: `question`, `intent`, `expect` (`answer`|`escalate`),
`goldChunks` (các `KnowledgeDoc.slug` đúng), `referenceAnswer` (đáp án chuẩn 1–3 câu),
`mustInclude`, `mustNotInclude`. Bốn nhóm theo Mục 11.4.7: chính sách/thủ tục, địa danh, lịch
trình/kinh phí, và nhóm âm tính (ngoài địa bàn, khác chủ đề, gõ không dấu).

Xuất sang định dạng dataset của Langfuse để RAGAS và DeepEval cùng đọc một nguồn — tránh cảnh
ba nơi giữ ba bản tập vàng lệch nhau.

`mustInclude` / `mustNotInclude` vẫn giữ dù đã có RAGAS: chúng chấm được **bằng code thuần**,
tất định, và là đối chứng khi điểm của model chấm trông đáng ngờ.

#### B3. Chạy đo và hiệu chỉnh

**Trước hết sửa `RetrievalOptions`** để quét lưới không embed lại (điểm chặn số 1):

```ts
export interface RetrievalOptions {
  // ...
  /** Vector truy vấn đã tính sẵn. Bộ đánh giá truyền vào để quét nhiều ngưỡng trên cùng một
   *  lần embed; bỏ trống thì retrieve() tự embed như thường. */
  queryEmbedding?: number[];
}
```

`vectorBranch()` dùng vector truyền vào nếu có, và đặt `embedMs = 0` để số đo độ trễ không bị
tính nhầm là nhanh bất thường.

Bốn cách đo cho bốn tham số:

| Tham số | Cách đo |
|---|---|
| Hai ngưỡng RAG | Quét lưới trong một lần chạy, **một câu embed đúng một lần** nhờ `queryEmbedding` |
| `RERANK_ENABLED` | Hai lần chạy tiến trình riêng, **cùng chỉ mục** — không ingest lại. Lần bật đầu sidecar tải model ~2,2 GB nên chậm bất thường, không tính vào số đo độ trễ |
| `VI_SEGMENT_ENABLED` | **Hai lần ingest + hai lần chạy riêng**, cần `pip install underthesea`. Không được so hai nhánh trên cùng một chỉ mục |
| `MIN_INTENT_CONFIDENCE` | Không quét lưới được (chặn ở orchestrator trước khi tác tử chạy). Ghi lại `confidence` thật từng câu rồi phân tích ngoại tuyến: chọn ngưỡng tối đa hoá số câu `expect: answer` được trả lời mà không để câu `expect: escalate` nào lọt |

Ngưỡng chặn theo SRS: **bám nguồn dưới 0,80 thì dừng phát hành**. Baseline lưu trong repo, cập
nhật có chủ đích kèm lý do.

### C. Kiểm thử, độ phủ và tài liệu API (NFR-MAINT-01)

Thêm **vitest** làm devDependency — nguyên tắc "không thêm dependency" của dự án áp cho
dependency chạy trong sản phẩm; vitest không vào bundle và dùng chung transform pipeline của
Vite đã có.

| Nhóm | Kiểm gì | Cần DB? |
|---|---|---|
| `server/agents/pii.ts` | Đóng băng 16 ca đã chạy tay ở Vòng 5 | Không |
| `server/rag/chunker.ts` | Ranh giới câu, chồng lấn, độ dài đoạn | Không |
| `server/agents/dialog.ts` | `mergeSlots` tích luỹ qua nhiều lượt | Không |
| `server/agents/orchestrator.ts` | Ba trigger chuyển tiếp bắt buộc, NLU giả lập | Không |
| `src/components/MarkdownMessage.tsx` | `[x](javascript:alert(1))` phải ra text thuần | Không |
| `server/auth.ts` + `routes/auth.ts` | Không rò email đã tồn tại, `/api/me/*` không nhận `userId` từ body, gộp Google theo email | **Có** |
| `server/routes/chat.ts` | Quyền xoá phiên | **Có** |

**Cổng độ phủ:** cấu hình `coverage` của vitest (provider `v8`), ngưỡng **70%** áp cho nhóm
"module nghiệp vụ cốt lõi" — `server/agents/**`, `server/rag/**`, `server/auth.ts` — chứ không
áp cho toàn repo. Ngưỡng dưới mức đó thì `npm test` thoát khác 0, và CI ở B1 chặn.

**Tài liệu API:** NFR-MAINT-01 yêu cầu OpenAPI/Swagger. Viết `docs/openapi.yaml` bằng tay cho
các endpoint hiện có (`/api/health`, `/api/config`, `/api/auth/*`, `/api/me/*`, `/api/content/*`,
`/api/chat/*`, `/api/plan-itinerary`) — không sinh tự động, vì sinh tự động cần thêm decorator
hoặc một framework khác và sẽ kéo theo thay đổi lớn hơn giá trị nó mang lại ở quy mô này.

Test cần DB dùng schema riêng (`?schema=test`), dọn sạch giữa các ca; script tự từ chối chạy
nếu schema trỏ vào `public`.

### D. Lưu và khôi phục lịch trình (FR-BOT-03 + Mục 11.3)

Bốn tầng:

1. **Migration** — `itinerary Json?` trên `ChatMessage`. Cùng lý do đã ghi cho
   `SavedItinerary.days`: cấu trúc ngày → waypoint chỉ đọc trọn khối. Sinh bằng
   `prisma migrate dev` sau khi DB chạy, rồi đối chiếu drift bằng `prisma migrate diff`.
2. **Ghi** — `server/routes/chat.ts` lưu `outcome.result.itinerary` vào bản ghi `ASSISTANT`.
3. **Đọc** — `GET /sessions/:id` trả thêm trường đó cho từng message.
4. **Frontend** — `ChatResponse` và `SessionResponse` khai thêm `itinerary`, gắn vào
   `ChatMessage.itinerarySnippet` (`src/types.ts:114`), render thẻ tóm tắt gọn kèm nút mở sang
   trình lập lịch trình đầy đủ. Không dựng lại toàn bộ UI của `ItineraryPlanner` trong khung
   chat.

**Xác thực hình dạng ở cả hai đầu.** `ItineraryOutcome.plan` khai là `any`
(`server/itineraryCore.ts:26`) nên không có gì bảo đảm model trả về đúng cấu trúc, và cột `Json`
cũng không ràng buộc kiểu ở tầng DB. Thêm một hàm kiểm tra dùng chung: gọi **trước khi ghi**
(ghi `null` nếu không hợp lệ, kèm log) và **sau khi đọc** (bỏ qua thẻ nếu không hợp lệ, không
làm vỡ trang). Bản ghi cũ giá trị `null` là hợp lệ.

### E. Thời hạn lưu trữ và quyền xoá (NFR-SEC-05, NĐ 13/2023)

- `docs/chinh-sach-du-lieu.md` — thu thập gì, mục đích, thời hạn, cách yêu cầu xoá. **Thời hạn
  cụ thể cần người dùng quyết.**
- `DELETE /api/chat/sessions/:id` — cascade dọn `ChatMessage` và `ChatEscalation`.
- `scripts/purge-chat.ts` (`npm run db:purge-chat`) — xoá phiên quá hạn theo `lastActiveAt` (đã
  có chỉ mục). Mặc định `--dry-run` bật.
- **Phạm vi xoá phải bao phủ mọi nơi chứa hội thoại.** Giai đoạn 1 chưa có backup tự động, chưa
  có cache hội thoại — nhưng **từ vòng này có thêm Langfuse**, và nó chứa nội dung hội thoại.
  Nên phạm vi xoá gồm **hai kho**: Postgres của ứng dụng và Langfuse. Tài liệu chính sách phải
  ghi rõ cả hai cùng ngày rà lại.
- **Lịch chạy để đáp ứng mốc 72 giờ:** yêu cầu xoá theo đơn của khách đi qua endpoint `DELETE`
  nên có hiệu lực **tức thì**. Job `purge-chat` chỉ lo phần hết hạn lưu trữ, chạy hằng ngày qua
  Task Scheduler/cron; cấu hình lịch ghi vào tài liệu, không cắm vào tiến trình server.
- Giao diện: một dòng ngắn dưới khung chat nói dữ liệu được lưu để đồng bộ giữa thiết bị, kèm
  nút xoá. Giữ nguyên tắc **không hứa điều hệ thống không làm được**.

## Phương án đã loại

| Phương án | Lý do loại |
|---|---|
| Bộ đo tự viết thay Langfuse + RAGAS + DeepEval | Đề xuất ở vòng 1 và 2, bị người soát chặn cả hai lần vì làm mất năng lực thật (ghi vết tập trung, chạy định kỳ trên hội thoại thật, dashboard), và **người dùng đã quyết dựng đủ theo SRS** |
| Langfuse Cloud thay vì tự triển khai | Dữ liệu ghi vết chứa nội dung hội thoại, tức chứa PII. Đẩy sang dịch vụ đám mây nước ngoài đúng vào loại việc mà Mục 11.4.8 và NĐ 13/2023 đặt nghĩa vụ |
| Cài RAGAS/DeepEval chung virtualenv với `embedding-service` | torch của sidecar rất nặng và có ràng buộc phiên bản CUDA riêng; trộn phụ thuộc sẽ làm cả hai khó nâng cấp |
| Sinh OpenAPI tự động từ code | Cần thêm decorator hoặc đổi framework; ở quy mô ~20 endpoint thì viết tay rẻ hơn và không kéo theo thay đổi kiến trúc |
| Sinh bộ câu hỏi vàng bằng chính Gemini | Mục 11.4.7 yêu cầu lấy từ log hỗ trợ thực tế và kịch bản nghiệp vụ. Model sinh câu hỏi rồi chính model đó chấm là vòng lặp tự khen |
| Mảng D chỉ sửa frontend | Thẻ lịch trình mất sau F5, trái Mục 11.3 |
| Đo `VI_SEGMENT_ENABLED` trên cùng một chỉ mục | Tách từ phải đối xứng giữa ingest và truy vấn; so trên cùng chỉ mục cho ra con số vô nghĩa mà không lỗi nào báo ra |
| Sửa bảo mật phiên trong kế hoạch này | **Người dùng quyết tách thành task riêng** để mỗi kế hoạch bám một mục tiêu |
| Chuyển kênh chat sang WebSocket | Một tiến trình, chưa có tính năng nào cần server đẩy xuống. Đổi khi dựng live chat thật ở Giai đoạn 2 |
| Làm FR-ADM-02 (trang quản trị kho tri thức) | Mục 12 xếp back-office vào Giai đoạn 2 |

## Các bước thực hiện

Nhóm song song — không cần DB lẫn API key:

1. **Dựng vitest + cấu hình độ phủ** — `package.json`, `vitest.config.ts` (mới). Ngưỡng 70% cho
   `server/agents/**`, `server/rag/**`, `server/auth.ts`.
2. **Test module logic thuần** — `pii.test.ts`, `chunker.test.ts`, `dialog.test.ts`,
   `orchestrator.test.ts`, `MarkdownMessage.test.tsx`. 16 ca PII của Vòng 5 nằm trong đó.
3. **Tài liệu API** — `docs/openapi.yaml` cho các endpoint hiện có.
4. **Hạ tầng Langfuse** — `docker-compose.langfuse.yml` (mới), biến môi trường trong
   `.env.example`, tích hợp SDK vào `server/agents/orchestrator.ts` theo kiểu bắn-và-quên.
5. **Môi trường đánh giá Python** — `eval-service/requirements.txt` (mới, virtualenv riêng),
   cấu hình RAGAS và DeepEval dùng Gemini làm model chấm.
6. **Bộ câu hỏi vàng** — `eval/golden-set.ts` + bộ xuất sang dataset Langfuse. **Chặn trên
   quyết định của người dùng về nguồn nội dung và người xác nhận đáp án.**
7. **Cho phép tái sử dụng embedding** — `server/rag/retrieval.ts`: thêm
   `RetrievalOptions.queryEmbedding`, `vectorBranch()` dùng nếu có.
8. **Bộ chạy đánh giá** — script gọi RAGAS/DeepEval trên tập vàng, ghi kết quả vào
   `eval/results/` và đẩy score lên Langfuse.
9. **CI** — `.github/workflows/quality.yml`: `lint` → `test` (kèm cổng độ phủ) → `eval` (DeepEval
   trên tập vàng). Bước `eval` cần khoá Gemini trong GitHub Secrets.
10. **Contract lưu lịch trình** — `prisma/schema.prisma`, `server/routes/chat.ts`, hàm xác thực
    hình dạng dùng chung, `src/hooks/useChatSession.tsx`, `AIConciergeTab.tsx`,
    `AIConciergeModal.tsx`.
11. **Chính sách dữ liệu + quyền xoá** — `docs/chinh-sach-du-lieu.md`, `DELETE` endpoint,
    `scripts/purge-chat.ts`, nút xoá ở frontend. Phạm vi xoá gồm **cả Langfuse**. **Chặn trên
    quyết định thời hạn lưu trữ.**

Nhóm cần môi trường chạy:

12. **Bring-up thật + sinh migration** — chuỗi lệnh mảng A; `prisma migrate dev` sinh migration
    cho bước 10; đối chiếu drift.
13. **Xác minh tên model** — `.env.example`, `server/config.ts` nếu tên mặc định sai.
14. **Chạy tay 5 kịch bản Mục 11.2** — 5 bản ghi `trace` thật kèm `totalMs`.
15. **Sửa lỗi phát sinh từ bước 12–14.** Nếu lộ ra sai thiết kế thì quay lại `/flow-plan`.
16. **Test cần DB** — `auth.test.ts`, `chat.test.ts`; đo độ phủ đối chiếu ngưỡng 70%.
17. **Chạy đo và hiệu chỉnh** — theo bốn cách ở B3; kết quả vào `eval/results/` và Langfuse.
18. **Chốt baseline** — cổng chất lượng phải xanh.
19. **Kiểm chứng lịch trình đầu-cuối** — hỏi chatbot lên lịch trình, F5, thẻ phải còn.
20. **Cập nhật `history.md`** — Vòng 7, kèm số đo thật.

## Rủi ro

- **Hạ tầng Langfuse nặng hơn cả ứng dụng.** Sáu dịch vụ, tối thiểu ~9 CPU và ~21,5 GiB RAM,
  chồng lên Postgres ứng dụng và sidecar BGE-M3 trên cùng một máy phát triển. → Tách
  `docker-compose.langfuse.yml` riêng để chỉ bật khi đo, không chạy thường trực. Nếu máy không
  kham nổi thì đây là chỗ phải quay lại hỏi người dùng, **không** tự ý rút gọn xuống bộ tự viết
  — hướng đó đã bị bác.
- **Bước 12–14 làm lộ ra lỗi thiết kế, không phải lỗi vặt.** ~30 file chưa chạy dòng nào. →
  Chạy bring-up sớm nhất có thể sau khi có key.
- **RAGAS/DeepEval chấm bằng chính Gemini** — cùng nhà cung cấp với model sinh câu trả lời, nên
  vẫn còn rủi ro tự khen dù dùng framework chuẩn. → Giữ `mustInclude`/`mustNotInclude` chấm bằng
  code làm đối chứng tất định; giữ một tập holdout không dùng để hiệu chỉnh; chấm tay một mẫu
  phân tầng và ghi mức đồng thuận **trước** khi chấp nhận baseline.
- **Bộ câu hỏi vàng tự soạn không phản ánh câu hỏi thật.** → Ghi rõ trong `eval/golden-set.ts`;
  mọi ngưỡng hiệu chỉnh từ nó phải đo lại khi có lưu lượng thật.
- **Kho tri thức chỉ vài chục đoạn** nên 100–200 câu có thể vượt xa những gì kho trả lời được.
  → Báo cáo **riêng** nhóm "câu hỏi không có đoạn tri thức tương ứng": đó là danh sách bổ sung
  nội dung, không phải lỗi tầng RAG.
- **Langfuse thành kho PII thứ hai.** → Đưa vào phạm vi chính sách xoá ngay từ đầu, đừng để nó
  lặp lại vết xe của backup bị bỏ quên.
- **Ghi vết làm chậm hoặc làm hỏng lượt hội thoại.** → Bắn-và-quên có timeout; lỗi ghi vết
  không bao giờ được nổi lên thành lỗi cho khách.
- **CI cần khoá Gemini trong GitHub Secrets.** → Bước `eval` phải bỏ qua một cách tường minh
  (không phải thất bại im lặng) khi chạy trên fork hoặc khi thiếu secret.
- **Migration mới trên DB vừa có dữ liệu thật đầu tiên.** → `itinerary Json?` là cột nullable,
  không đụng dữ liệu cũ; vẫn chạy `prisma migrate diff` đối chiếu trước khi deploy.
- **Test dùng DB thật có thể xoá nhầm dữ liệu dev.** → Bắt buộc `?schema=test`.
- **Job xoá dữ liệu xoá nhầm.** → Mặc định `--dry-run`, in số lượng và mẫu bản ghi sẽ xoá.

## Cách kiểm chứng

```bash
npm run lint            # tsc --noEmit
npx vite build
npm test                # vitest, kèm cổng độ phủ 70% cho module cốt lõi
npm run eval            # RAGAS + DeepEval trên bộ câu hỏi vàng
npm run db:purge-chat   # mặc định --dry-run
docker compose -f docker-compose.langfuse.yml up -d    # bật khi đo
```

Cộng năm truy vấn SQL sau bring-up, kiểm tra bảng điều khiển Langfuse hiện đủ bốn chỉ số vận
hành, và tám kịch bản tay đầu-cuối:

1. *"chợ phiên Đồng Văn họp ngày nào"* → trả lời có căn cứ, `trace.citedDocIds` không rỗng.
2. *"chợ phiên Bắc Hà họp ngày nào"* → chuyển tiếp `OUT_OF_SCOPE`, không được trả lời.
3. *"cho mình gặp người thật"* → `USER_REQUEST`, có bản ghi `ChatEscalation`.
4. *"lên lịch trình 3 ngày cho 2 người"* → thẻ lịch trình hiện trong khung chat.
5. **F5 ngay sau bước 4** → thẻ lịch trình **vẫn còn**.
6. Gõ không dấu *"deo ma pi leng co nguy hiem khong"* → vẫn trả lời được.
7. Bấm nút xoá hội thoại → phiên biến mất khỏi **cả Postgres lẫn Langfuse**; thử `DELETE` với id
   của phiên đã gắn tài khoản khác → 404.
8. F5 giữa phiên → lịch sử được nạp lại (FR-BOT-07).

## Ngoài phạm vi

- **Bảo mật phiên khách vãng lai** (`sessionId` làm bearer token, transcript chứa PII chưa che)
  — tách thành [`docs/plans/20260906-bao-mat-phien-chat/`](../20260906-bao-mat-phien-chat/plan.md)
  theo quyết định của người dùng. Phải đóng **trước khi hệ thống nhận khách thật**.
- **FR-BOT-09 (song ngữ Việt–Anh)** — mức "Nên có"; prompt, kho tri thức và cấu hình tìm kiếm
  `vietnamese` hiện chỉ phục vụ tiếng Việt.
- **FR-BOT-10 (Zalo OA / Messenger)** — Giai đoạn 3.
- **FR-ADM-01..04 (back-office, RBAC nhân viên)** — Giai đoạn 2. Hệ quả phải giữ: giao diện
  **không được hứa thời gian phản hồi** vì chưa ai đọc `ChatEscalation`.
- **FR-BOOK / FR-PAY** — Mục 12 nói rõ Giai đoạn 1 chưa có.
- **WebSocket cho kênh chat** — lý do ở bảng phương án đã loại.
- **Chạy RAGAS định kỳ trên 1–5% hội thoại THẬT** — hạ tầng dựng đủ ở vòng này, nhưng chưa có
  lưu lượng thật để lấy mẫu. Lịch chạy định kỳ được cấu hình sẵn và kích hoạt khi có khách thật.
- **Dọn dữ liệu còn giả**: ảnh stock, `rating`/`reviewCount` homestay, `PassWeather` chưa nối
  API thời tiết thật, đăng nhập Facebook.
- **Commit / dọn git** — chờ quyết định của người dùng.

## Đầu vào cần người dùng cung cấp

| # | Cần gì | Chặn bước nào | Vì sao không tự quyết được |
|---|---|---|---|
| 1 | **`GEMINI_API_KEY`** | 12–19, và bước 8 (RAGAS/DeepEval dùng Gemini làm model chấm) | Không có key thì `/api/chat` trả 503 và không đo được gì |
| 2 | **Xác nhận đã khởi động lại máy** và `docker info` không lỗi | 12 | `RebootPending = True` từ Vòng 4 |
| 3 | **Máy có kham nổi Langfuse không** — còn trống bao nhiêu RAM/CPU sau khi Docker Desktop, Postgres ứng dụng và sidecar BGE-M3 đang chạy? | 4 | Langfuse v3 cần ~9 CPU / ~21,5 GiB tối thiểu. Nếu không đủ thì phải quyết: nâng máy, chạy Langfuse trên máy khác, hay xem lại phạm vi |
| 4 | **Nguồn bộ câu hỏi vàng** — có log hỗ trợ thật không? Nếu không, xác nhận cho phép tự soạn 100–200 câu từ kịch bản nghiệp vụ | 6 | Mục 11.4.7 yêu cầu lấy từ log thật; tự soạn là đánh đổi phải được duyệt |
| 5 | **Ai ký nhận rằng dữ liệu mẫu và đáp án chuẩn là đúng nghiệp vụ**, và **ngưỡng chấp nhận cho đối soát thủ công** | 6, 18 | Bộ đo chỉ có giá trị khi đáp án chuẩn được người có thẩm quyền nghiệp vụ xác nhận, và ngưỡng lệch tối đa phải chốt **trước** khi chạy đo |
| 6 | **Thời hạn lưu trữ hội thoại** (90 ngày / 12 tháng / 24 tháng?) và **dữ liệu/backup đặt ở đâu** | 11 | Quyết định pháp lý. NĐ 53/2022 đặt lưu trữ tối thiểu 24 tháng với một số nhóm doanh nghiệp, kéo ngược chiều nghĩa vụ xoá 72 giờ của NĐ 13/2023 |
| 7 | **Kênh tiếp nhận escalation**: ai đọc, qua đâu, hay chưa có ai? | 11 và câu chữ giao diện | Chưa có ai đọc thì giữ nguyên tắc "không hứa thời gian phản hồi" |
| 8 | **Quyền ghi GitHub Secrets** cho khoá Gemini dùng trong CI | 9 | Bước `eval` trong CI cần gọi model |
| 9 | **Đưa file SRS PDF vào repo** | Không chặn, nhưng ảnh hưởng mọi vòng duyệt sau | Đã có `docs/srs-trich-yeu.md` chép nguyên văn các điều khoản viện dẫn; bản đầy đủ vẫn nên nằm trong repo |
| 10 | *(không bắt buộc)* **`GOOGLE_CLIENT_ID`** | Chỉ nút đăng nhập Google | Không có thì nút tự ẩn |

Nếu mục 1 và 2 chưa có, các bước 1, 2, 3, 6, 7, 10, 11 vẫn làm được. Mục 3 nên trả lời sớm vì
nó có thể làm đổi cách dựng mảng B.

## Lịch sử vòng lặp

- Vòng 1: 2026-09-06 — gửi ChatGPT. **FAIL**, 4 điểm chặn, cả 4 đối chiếu lại đều Đúng:
  bộ đo không đo được chỉ số bám nguồn mà chính kế hoạch đặt ngưỡng 0,80; mảng D chỉ sửa
  frontend nên thẻ lịch trình biến mất sau F5; không có phép đo cho `VI_SEGMENT_ENABLED`; gói
  prompt mô tả sai mốc kiểm chứng hiện có. Người soát cũng chỉ ra SRS không nằm trong repo.
- Vòng 2: 2026-09-06 — gửi ChatGPT. **FAIL**, 3 điểm chặn: (1) Đúng — quét lưới ngưỡng sai giả
  định vì `retrieve()` luôn tự embed; (2) Không rõ — bộ đo tự viết không tái tạo được Langfuse,
  chạy định kỳ, dashboard, CI; (3) Đúng và nặng hơn kế hoạch mô tả — `sessionId` là bearer token
  còn transcript chứa PII chưa che. Dừng để hỏi người dùng theo quy tắc "BLOCKER Không rõ".
- Vòng 3: 2026-09-06 — lập lại kế hoạch sau hai quyết định của người dùng: **dựng đủ bộ đo
  lường theo SRS** (Langfuse + RAGAS + DeepEval + CI + dashboard) và **tách bảo mật phiên thành
  task riêng**. Điểm chặn số 1 xử lý bằng `RetrievalOptions.queryEmbedding`. Bổ sung ba điểm
  NON-BLOCKER: xác thực hình dạng lịch trình ở cả lúc ghi lẫn lúc đọc, cổng độ phủ 70%, và tài
  liệu OpenAPI.
- Vòng 3: 2026-09-06 — gửi ChatGPT. **FAIL**, 3 điểm chặn, cả 3 đối chiếu lại đều Đúng:
  (1) `TurnTrace` không chứa câu hỏi, nội dung đoạn truy xuất, câu trả lời hay chi phí, nên
  "dùng lại `TurnTrace`" không ghi đủ trace mà SRS Mục 11.4.7 đòi;
  (2) hoãn chạy RAGAS định kỳ trên 1–5% hội thoại thật là để lại khoảng trống nghiệm thu —
  làm được ngay bằng job chạy hợp lệ với mẫu rỗng;
  (3) mảng E thêm `DELETE` kế thừa đúng cơ chế quyền đang hỏng, và xoá hai kho chưa có
  correlation id / outbox / tombstone / retry để chứng minh xoá đủ.
  **Đây là vòng FAIL thứ ba liên tiếp** → dừng theo quy tắc chống lặp của `docs/dev-flow.md`,
  xin người dùng quyết trước khi lập vòng 4. Bảng phân loại đầy đủ ở `chatgpt.md`.
- 2026-09-06 (sau vòng 3) — người dùng quyết **làm task bảo mật phiên trước**. Task
  `20260906-bao-mat-phien-chat` trở thành **điều kiện tiên quyết của mảng E**: endpoint
  `DELETE /api/chat/sessions/:id` chỉ được thêm sau khi `loadSession()` đã áp cơ chế quyền mới,
  để nó kế thừa quyền đúng thay vì quyền hỏng. Kế hoạch Giai đoạn 1 giữ `status: cho-duyet` và
  vòng 4 sẽ được lập sau khi task kia xong, để phần thiết kế xoá hai kho (Postgres + Langfuse)
  dựa trên cơ chế phiên đã sửa.

