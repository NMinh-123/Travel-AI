# Ha Giang Travel

Nền tảng du lịch Hà Giang: lập lịch trình bằng AI, cẩm nang phượt và một trợ lý hội thoại đa
tác tử có truy xuất tri thức (RAG).

Ngăn xếp: React 19 + Vite (client) · Express + TypeScript (server) · PostgreSQL + pgvector qua
Prisma · Gemini cho sinh nội dung · một dịch vụ Python nhỏ chạy BGE-M3 để nhúng vector.

## Chạy tại máy

**Cần có:** Node.js 20+, Docker (cho Postgres), Python 3.11 (cho dịch vụ embedding).

```bash
npm install                      # cài phụ thuộc, tự chạy prisma generate
cp .env.example .env             # rồi điền GEMINI_API_KEY và các khoá cần thiết
docker compose up -d db          # Postgres + pgvector ở 127.0.0.1:5432
npm run db:migrate               # dựng lược đồ
npm run db:seed                  # nạp nội dung Hà Giang
npm run db:ingest                # nạp kho tri thức cho RAG (cần dịch vụ embedding)
npm run dev                      # http://localhost:3000
```

Dịch vụ embedding được `npm run dev` tự bật nếu tìm thấy `services/embedding/.venv`. Tạo lần đầu:

```bash
python -m venv services/embedding/.venv
services/embedding/.venv/Scripts/python.exe -m pip install -r services/embedding/requirements.txt
```

Đặt `EMBEDDING_AUTOSTART=false` nếu muốn tự chạy nó ở cửa sổ riêng để xem log đầy đủ.

## Nạp kho tri thức

`npm run db:ingest` chạy TĂNG DẦN: nó so vân tay nội dung, model embedding và phiên bản pipeline
của từng đoạn, rồi chỉ nhúng lại những đoạn thật sự đổi. Chạy lại khi chưa sửa gì thì không hàng
nào bị ghi lại — `version` và `updatedAt` đứng yên.

```bash
npm run db:ingest -- --dry-run            # in kế hoạch, không ghi gì
npm run db:ingest -- --domain food,policy # chỉ nạp lại một phần corpus
npm run db:ingest -- --reindex            # bỏ qua vân tay, nhúng lại toàn bộ
```

Trước khi gọi embedder, script chạy `data/validate.ts` để bắt những lỗi mà TypeScript không thấy:
slug trùng, `entityId` sai chính tả, chu trình trong cây địa danh, toạ độ bị đảo lat/lng, khoảng
giá đảo ngược, alias mơ hồ, nội dung crawl thiếu ngày đối chiếu. Cùng bộ kiểm định đó chạy trong
`npm test`, nên lỗi dữ liệu bị chặn ở CI chứ không đợi tới lúc nạp.

Việc xoá bị giới hạn trong phần corpus mà lần chạy đó quản lý, và một kế hoạch xoá quá 30% kho sẽ
dừng lại chờ `--allow-prune`.

## Các tầng test

```bash
npm run lint && npm test   # mọi pull request: kiểm kiểu và test nhanh, không cần hạ tầng
npm run test:int           # cần Postgres; dựng database riêng travelai_test
npm run test:e2e           # cần Postgres + Chromium; model được thay bằng máy chủ giả
```

Bốn tầng và quy tắc chọn tầng nằm ở [docs/TESTING.md](docs/TESTING.md). Test integration và E2E
không bao giờ đụng vào database dev.

## Kiểm tính khả thi của lịch trình

Lịch trình sinh ra được kiểm bằng CODE trước khi ra tới khách
([server/domain/itineraryCheck.ts](server/domain/itineraryCheck.ts)): đúng số ngày khách yêu cầu,
địa danh có trong danh mục, ngày sau xuất phát từ nơi ngày trước kết thúc, tốc độ và giờ giấc đi
được trên đường đèo, chỗ nghỉ có thật và nằm đúng vùng, quãng đường đối chiếu với bảng chặng khung.

Còn lỗi thì danh sách lỗi được gửi lại cho model sửa, tối đa hai lượt, và chỉ nhận bản sửa khi nó
thực sự ít lỗi hơn. Kết quả luôn kèm `plan.validation` — phần nào chưa kiểm được thì nói ra, không
giấu. Chi phí do `estimateTripCost` tính, kèm giả định và đơn vị trong `plan.cost.assumptions`.

```bash
npx tsx scripts/itinerary-validity.ts --limit 6   # đo tỷ lệ lịch trình khả thi (gọi model thật)
```

## Chọn cấu hình truy xuất

Tầng truy xuất có bốn bước cộng dồn, mỗi bước thêm một khoản độ trễ. Đo trước khi bật:

```bash
npx tsx scripts/retrieval-ablation.ts --k 5            # vector-only -> lai -> + metadata -> + xếp hạng lại
npx tsx scripts/retrieval-ablation.ts --min-vector 0   # bỏ ngưỡng, để thấy nhánh metadata đổi thứ hạng ra sao
```

Script chạy cả bốn cấu hình trên cùng bộ vàng và dùng lại đúng các hàm chỉ số của `eval/metrics/`,
nên con số ở đây so sánh được với con số của cổng đánh giá.

Số đo trên kho 162 đoạn, 40 câu hỏi, ngưỡng mặc định:

| Cấu hình | Recall@5 | Precision@5 | MRR | Rỗng | p50 | p95 |
| --- | --- | --- | --- | --- | --- | --- |
| vector-only | 0.9000 | 0.7500 | 0.9000 | 0.0750 | 78ms | 204ms |
| hybrid | 0.9250 | 0.7042 | 0.9125 | 0.0250 | 72ms | 88ms |
| hybrid+metadata | 0.9250 | 0.7042 | 0.9125 | 0.0250 | 77ms | 91ms |
| + xếp hạng lại | 0.9250 | 0.7042 | 0.9125 | 0.0250 | 77ms | 1277ms |

## Đo chất lượng trợ lý

```bash
npm run eval -- --split dev --limit 20   # vặn prompt và ngưỡng trên tập này
npm run eval -- --split holdout          # con số báo cáo, chạy sau khi đã chốt thay đổi
```

Lệnh chạy hệ thống thật trên bộ vàng và trả mã thoát 0 khi qua cổng, 2 khi trượt. Sáu nhóm chỉ
số — ý định, truy xuất, câu trả lời, hội thoại, từ chối, vận hành — cùng quyết định phán quyết
đó. Xem [eval/README.md](eval/README.md) để biết từng chỉ số đo gì và chỉnh ngưỡng ở đâu.

## Bố cục thư mục

```
client/          Giao diện React. Không bao giờ import trực tiếp từ server/ hay data/.
  components/    Thành phần giao diện
  context/       AuthContext — trạng thái đăng nhập toàn cục
  hooks/         useContent (nội dung), useChatSession (phiên chat)
  lib/           api.ts (gọi HTTP), googleIdentity.ts

server/          Backend Express, chia theo TẦNG chứ không theo tính năng
  index.ts       Điểm vào: dựng http server, gắn Vite/static, lắng nghe
  app.ts         Lắp ráp express — thứ tự middleware nằm gọn ở đây
  config.ts      Đọc và kiểm biến môi trường
  routes/        Tầng HTTP. routes/index.ts là bảng mục lục mọi đường dẫn /api
  middleware/    asyncHandler, rateLimit, auth (phiên đăng nhập), errorHandler
  domain/        Nghiệp vụ — KHÔNG biết gì về express
    agents/      Luồng hội thoại đa tác tử (nlu, dialog, orchestrator, specialists)
    rag/         Truy xuất tri thức (chunker, embedder, retrieval, segment, places)
  infra/         Cổng ra thế giới ngoài: db (Prisma), gemini, embeddingSidecar

shared/          Kiểu dữ liệu dùng chung cho cả client lẫn server
data/            NỘI DUNG, không phải mã: điểm đến, địa danh, kho tri thức
  validate.ts    Kiểm định quan hệ giữa các bản ghi — chạy trước ingest và trong test
db/              Lược đồ Prisma, migration, script seed
scripts/         Công cụ chạy tay: crawl-web, ingest-knowledge (ingest-plan.ts giữ phần
                 quyết định thuần, tách khỏi phần ghi database)
services/        Dịch vụ chạy riêng tiến trình
  embedding/     FastAPI + BGE-M3
eval/            Bộ đo chất lượng trợ lý: bộ vàng, chỉ số, cổng PASS/FAIL
docs/            ARCHITECTURE.md (bản đồ truy vết), history.md (nhật ký), kế hoạch
```

Xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) để biết luồng một request đi qua những đâu và
tra "triệu chứng → mở file nào" khi debug.

### Quy ước import

Import **không bao giờ dùng `../`**. Cùng thư mục thì `./x`, khác thư mục thì dùng alias:

| Alias      | Trỏ tới    | Ai được dùng          |
| ---------- | ---------- | --------------------- |
| `@client/` | `client/`  | client                |
| `@shared/` | `shared/`  | client và server      |
| `@server/` | `server/`  | server, scripts, db   |
| `@data/`   | `data/`    | server, scripts, db   |
| `@eval/`   | `eval/`    | chỉ thư mục eval      |

Nhờ vậy đọc một dòng import là biết ngay file đích ở tầng nào, và di chuyển file không làm gãy
hàng loạt đường dẫn. Alias khai ở `tsconfig.json`; `vite.config.ts` khai lại `@client`/`@shared`
cho client — cố tình KHÔNG khai `@server`/`@data` để một import nhầm sang mã server hỏng ngay
lúc build thay vì lọt vào bundle gửi ra trình duyệt.

## Lệnh thường dùng

| Lệnh                    | Việc                                                     |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Dev server + Vite HMR + tự bật sidecar embedding          |
| `npm run lint`          | `tsc --noEmit` trên toàn dự án                            |
| `npm test`              | Vitest: quy đổi thời gian, trích xuất và gộp slot offline |
| `npm run build`         | prisma generate + vite build + esbuild server → `dist/`   |
| `npm start`             | Chạy bản build production                                 |
| `npm run db:migrate`    | Tạo và áp migration mới                                   |
| `npm run db:seed`       | Nạp nội dung từ `data/` vào database                      |
| `npm run db:crawl`      | Tải bản thô các trang nguồn về `data/raw-web/`            |
| `npm run db:ingest`     | Chunk + nhúng + nạp kho tri thức cho RAG, chạy tăng dần   |
| `npm run test:int`      | Test integration, cần Postgres (xem docs/TESTING.md)      |
| `npm run test:e2e`      | Test end-to-end bằng Playwright, không gọi model thật     |
| `npm run db:studio`     | Mở Prisma Studio                                          |

**Tắt `npm run dev` trước khi chạy `npm run build` trên Windows.** Server dev giữ mở
`node_modules/.prisma/client/query_engine-windows.dll.node`, nên `prisma generate` không thay được
file đó và dừng với `EPERM: operation not permitted, rename`. Bản build vẫn ra nếu chạy tay
`npm run build:client && npm run build:server`, nhưng khi đó Prisma Client là bản sinh từ lần
trước — chỉ đúng chừng nào `db/schema.prisma` chưa đổi, và đó là thứ dễ quên đúng lúc vừa sửa
lược đồ.

Kiểm thử thời gian dùng ngày cố định, không cần khoá mô hình, database hoặc dịch vụ embedding.
Với Node.js 24, nếu môi trường hạn chế quyền khiến esbuild không nạp được cấu hình test, có thể
chẩn đoán bằng `npm test -- --configLoader native`. Lệnh này không thay thế việc kiểm tra
`npm test` và `npm run build` mặc định trước khi bàn giao.

Ngữ cảnh thời gian của chat được lưu ở `slots.temporal`; khoá `month` của phiên cũ được bỏ qua
khi nạp. Khách cần nhắc lại mốc thời gian để bổ sung ngữ cảnh cho phiên cũ. Bảng ngày lễ chỉ phủ
2026–2030, không phải lịch nghỉ bù. Các ngày âm lịch chưa xác nhận chỉ được mô tả theo khoảng;
xem [ghi chú triển khai](agent/docs/architecture.md) và nguồn tại `server/domain/temporal/holidays.ts`.
