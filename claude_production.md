# Kế hoạch đưa Travel-AI lên production

Tệp này dùng để làm từng bước qua nhiều phiên mà không phải nạp lại toàn bộ bối cảnh.
**Mỗi phiên chỉ làm MỘT bước.** Đầu phiên: đọc phần "Bối cảnh" và bước đang làm. Cuối phiên:
đánh dấu `[x]`, ghi kết quả vào "Nhật ký tiến độ" ở cuối tệp, rồi commit.

## Bối cảnh (đọc trước mọi bước)

- Stack: Express + Prisma + Postgres/pgvector, client build bằng Vite. Service Python riêng cho
  embedding/rerank (`services/embedding`, BGE-M3 + bge-reranker-v2-m3, chạy CPU, **không có xác
  thực**). Model AI: Gemini qua proxy (giữ nguyên proxy, một endpoint duy nhất).
- Bản build: `npm run build` → `dist/server.cjs` + client trong `dist/`; chạy bằng `npm start`.
  `npm run test:smoke` kiểm bản build không kéo `devDependencies`.
- Bộ đếm hạn mức (rate limit, chặn dò mật khẩu, trần chi phí AI) và trạng thái phiên đều lưu
  trong Postgres. **Không thêm Redis/Upstash.**
- `server/config.ts` dừng server ở production nếu `DATABASE_URL` chứa `travel:travel`.
- Danh sách biến môi trường: `.env.example`.

### Kiến trúc đích

```
Người dùng ─► Cloudflare (DNS, HTTPS, CDN, WAF, Turnstile)
                 │
                 ▼
           VPS chạy Docker (giai đoạn thử: Oracle Free ARM 2 OCPU / 12 GB)
           ├─ web: Express + client build (dist/)
           └─ embedding: FastAPI BGE-M3, rerank tắt (chỉ mạng nội bộ)
                 │
                 ▼
           Supabase vùng Singapore (giai đoạn thử: Free; lên thật: Pro)
```

Giai đoạn thử thị trường chạy được khoảng 1000 người dùng/tháng (vài lượt chat mỗi phút lúc cao
điểm), **không** chịu được 1000 người chat cùng lúc. Ước tính trên máy dev x86: nhúng một câu
hỏi mất khoảng 0,1 s, trên ARM có thể 0,5–1 s. Phần chậm nhất của mỗi lượt là gọi Gemini, không
tốn CPU của máy. Image build đa kiến trúc (`linux/amd64` + `linux/arm64`), nên chuyển sang VPS
x86 chỉ là đổi máy chạy.

Chưa dùng: Resend (làm sau khi ra mắt), Cloudflare R2 (khi có upload), Upstash Redis (bỏ).

### Quyết định đã chốt

| Hạng mục | Lựa chọn | Trạng thái |
|---|---|---|
| Tên miền | **vntravelai.food**: đăng ký ngày 2026-09-24 qua iNET, hết hạn 2027-09-24. RDAP đang báo `client hold` (xem Bước 0) | ☑ |
| Giai đoạn | **Thử thị trường** trước (mục tiêu khoảng 1000 người dùng/tháng), chưa thuê VPS lớn. Người dùng chốt ngày 2026-09-24 | ☑ |
| Nhà cung cấp VPS | **Oracle Cloud Always Free**, Ampere A1 ARM 2 OCPU / 12 GB, home region **Singapore**. Khi cần lên thật: Hostinger KVM 4 hoặc DigitalOcean (bảng so sánh ở Bước 0) | ☑ |
| Dữ liệu có bắt buộc lưu tại Việt Nam (Nghị định 53/2022, SRS dòng 264)? | **Không bắt buộc**, người dùng chốt ngày 2026-09-24 | ☑ |
| Database | **Supabase Free**, Singapore, cho giai đoạn thử. Lên Supabase Pro khi cần backup hằng ngày hoặc vượt hạn mức Free | ☑ |
| Rerank | **Tắt** (`RERANK_ENABLED=false`). Đo trên x86 20 luồng, rerank 20 đoạn mất 5,8 s; trên 2 OCPU ARM sẽ chậm hơn nhiều | ☑ |

---

## Bước 0: Chốt quyết định (người dùng làm, không cần code)

- [x] Chọn tên miền: `vntravelai.food`.
  - [ ] Gỡ trạng thái `client hold`. Khi còn trạng thái này, tên miền **không phân giải được** và
        không đổi nameserver sang Cloudflare được. Thường là do chưa xác minh email chủ thể theo
        yêu cầu của ICANN, hoặc hồ sơ/thanh toán ở iNET chưa hoàn tất. Kiểm lại bằng
        `curl -s https://rdap.org/domain/vntravelai.food`: trường `status` không còn `client hold` là xong.
- [x] Chọn VPS: Oracle Cloud Always Free cho giai đoạn thử thị trường.
  - [ ] Đăng ký tài khoản Oracle Cloud và chọn **home region = Singapore (ap-singapore-1)**. Không
        đổi được sau khi tạo; tài nguyên Always Free chỉ có ở home region.
  - [ ] Nâng tài khoản lên **Pay As You Go** (vẫn miễn phí trong hạn mức Always Free). Tài khoản
        Free thuần có thể bị thu hồi máy khi nhàn rỗi 7 ngày, và hay báo hết capacity ARM hơn.
        Đặt ngay Budget kèm cảnh báo ở mức vài USD để phát hiện nếu có gì vượt hạn mức free.
  - [ ] Tạo instance `VM.Standard.A1.Flex` 2 OCPU / 12 GB, Ubuntu 24.04 aarch64. Báo "Out of
        capacity" thì thử lại sau, hoặc thử availability domain khác.
- [x] Chốt yêu cầu lưu dữ liệu trong nước: không bắt buộc.

So sánh VPS 8 GB / 4 vCPU vùng Singapore (tra ngày 2026-09-24, kiểm lại giá trước khi mua):

| Nhà cung cấp | Gói | Giá/tháng | Ổ đĩa | Băng thông | Ghi chú |
|---|---|---|---|---|---|
| Vultr | Regular Cloud Compute | 40 USD | 160 GB SSD | 4 TB | Rẻ nhất; CPU Intel thế hệ cũ |
| DigitalOcean | Basic Regular | 48 USD | 160 GB SSD | 5 TB | Đề xuất: băng thông lớn nhất, giá như nhau mọi vùng |
| Hetzner | CPX32 (SIN) | 57,99 USD | 160 GB NVMe | 2 TB | Tăng giá ở Singapore từ 15/06/2026; băng thông ít nhất |
| Hostinger | KVM 4 (Kuala Lumpur), **16 GB** / 4 vCPU | ~RM 55 (~13 USD) khuyến mãi, gia hạn ~RM 119 (~28 USD) | 200 GB NVMe | 16 TB | Giá khuyến mãi cần trả trước dài hạn; không có vùng Singapore nhưng KL rất gần |
| Contabo | Cloud VPS 4 (Singapore) | 5,50 EUR + phí vùng vài USD | 100 GB SSD | Không giới hạn (fair use) | Rẻ nhất có trả phí; CPU chia sẻ, hiệu năng không ổn định |
| Oracle Cloud | Always Free Ampere A1, 2 OCPU / 12 GB ARM | 0 | 200 GB | 10 TB | Bị cắt từ 4 OCPU/24 GB từ 15/06/2026; hay hết capacity; phải build image ARM; không hợp production |

Chi phí nền: giai đoạn thử = 0 USD cho máy chủ và database (Oracle Free + Supabase Free +
Cloudflare Free), chỉ còn tên miền và tiền gọi Gemini/Maps. Khi lên thật: VPS khoảng 13–58 USD +
Supabase Pro 25 USD.
- [ ] Mở billing và đặt trần quota cho Gemini và Google Maps Platform.
  - Gemini đi qua proxy `api.shopaikey.com`, nên hạn mức và tiền nằm ở tài khoản proxy: nạp mức
    vừa đủ, bật giới hạn chi tiêu nếu proxy có. Trong app đã có trần `AI_MAX_TURNS_PER_HOUR=120`
    (mỗi người) và `AI_MAX_MODEL_CALLS_PER_HOUR=2000` (toàn hệ thống). Eval đo khoảng 4.300 token
    mỗi lượt chat, lấy con số này nhân với giá của proxy để chọn trần.
  - Google Maps: Cloud Console → Billing → Budgets & alerts (đặt ngân sách tháng kèm cảnh báo
    50/90/100%), rồi APIs & Services → Quotas: đặt trần theo ngày cho Routes API và Places API.
    Maps Embed API miễn phí, không cần trần.
- [x] Điền bảng "Quyết định đã chốt" ở trên.

**Xong khi:** bảng quyết định không còn ô "_chưa chốt_".

## Bước 1: Dọn nhánh và làm CI xanh

- [x] Nhánh `sua-loi-model-schema-va-bo-test`: commit hoặc bỏ các tệp đang sửa. Xoá hoặc thêm vào
      `.gitignore` các tệp ghi chú tạm (`erorr.md`, `result_test*.md`).
- [x] Merge vào `main`.
- [x] CI trên `main` xanh: `lint`, `test`, `build`, `test:smoke`, integration.

**Xong khi:** `git status` sạch trên `main` và run CI mới nhất của `main` xanh.

## Bước 2: Đóng gói bằng Docker

- [x] `Dockerfile` cho web: build nhiều tầng. Tầng build chạy trên kiến trúc của máy build
      (`$BUILDPLATFORM`): `npm ci --ignore-scripts`, `prisma generate`, `build:client`, `build:server`.
      Tầng chạy: `npm ci --omit=dev --ignore-scripts` (postinstall gọi Prisma CLI, mà CLI là
      devDependency), chép `node_modules/.prisma` và `dist/` từ tầng build, chạy bằng user `node`.
      Healthcheck gọi `/api/health` (trả 503 khi mất database) thay cho một endpoint `/ready` mới.
- [x] `services/embedding/Dockerfile`: Python 3.11 (khớp venv dev), torch bản CPU cài trước từ
      index `https://download.pytorch.org/whl/cpu`. Model KHÔNG gói vào image mà tải lần đầu vào
      volume `hf-models` gắn ở `HF_HOME`. Healthcheck gọi `/ready`. Chạy bằng user không phải root.
- [x] `docker-compose.prod.yml`: gồm `web` và `embedding`. `embedding` **không có `ports:`**.
      `web` chỉ mở `127.0.0.1:${WEB_PORT:-3000}` cho reverse proxy trên cùng máy, nhận biến từ
      `${ENV_FILE:-.env}`. Các giá trị cố định (`NODE_ENV`, `EMBEDDER=bge-m3`,
      `EMBEDDING_SERVICE_URL=http://embedding:8000`, `EMBEDDING_AUTOSTART=false`,
      `RERANK_ENABLED=false`) ghi trong compose và thắng tệp env.
- [x] `.dockerignore` ở gốc và ở `services/embedding/` (loại `.venv` nặng).
- [x] **ARM (Oracle Free):** `binaryTargets = ["native", "debian-openssl-3.0.x",
      "linux-arm64-openssl-3.0.x"]` trong `db/schema.prisma`. Build cả hai image cho
      `linux/arm64` được; chạy dưới giả lập QEMU: web ARM nối DB và `/api/health` trả OK
      (engine Prisma arm64 chạy), sidecar ARM import được torch 2.14.0+cpu và sentence-transformers.
      Chưa chạy nhúng thật trên ARM: đo tốc độ khi đã có máy Oracle (Bước 7).
- [x] Trong compose production đặt `RERANK_ENABLED=false`.
- [x] Chạy thử toàn bộ bằng compose trên máy, trỏ `DATABASE_URL` vào DB dev (qua một role tạm, vì
      server ở production từ chối `travel:travel`; role đã xoá sau khi thử).
- Ghi chú cho Bước 6: image web **không có Prisma CLI**, nên `prisma migrate deploy` chạy từ CI
  (hoặc máy quản trị) thẳng vào Supabase bằng kết nối trực tiếp, không chạy trong container web.
- Ghi chú: `services/embedding/requirements.txt` không ghim phiên bản. Image vừa build kéo
  sentence-transformers 6.1.0, còn venv dev là 6.0.1. Ghim bản khi cần build lặp lại được.

**Xong khi:** `docker compose -f docker-compose.prod.yml up` chạy lên, `/ready` của cả hai service
trả OK, chatbot trả lời được một câu có dùng RAG.

## Bước 3: Database trên Supabase

- [ ] Tạo project ở vùng Singapore và đặt mật khẩu DB mạnh. Giai đoạn thử dùng gói **Free**:
      không có backup hằng ngày như Pro, và project tự tạm dừng khi không có hoạt động 7 ngày. Kiểm
      lại hạn mức Free hiện tại trên trang giá của Supabase trước khi tạo.
- [ ] Bật extension `vector`. Migration `20260906000000_chat_and_knowledge` cũng tự tạo extension
      này, nhưng cần kiểm quyền.
- [ ] Prisma: app kết nối qua pooler. `prisma migrate deploy` phải đi qua **kết nối trực tiếp hoặc
      session pooler**, vì transaction pooler ở cổng 6543 không chạy được migrate. Sửa
      `prisma.config.ts` hoặc schema để có `directUrl`. Nếu dùng transaction pooler, thêm
      `?pgbouncer=true`.
- [ ] Chạy `npm run db:migrate:deploy`, `db:seed`, `db:ingest`, rồi `db:audit`. Số bản ghi phải
      **đếm lại từ `data/website`**, không lấy từ trí nhớ.
- [ ] Kiểm backup hằng ngày và **thử khôi phục một lần** sang một project tạm. Gói Free không có
      backup tự động: thay bằng `pg_dump` chạy theo lịch trên VPS, giữ vài bản gần nhất, và thử
      khôi phục một lần.

**Xong khi:** app chạy trên máy trỏ vào Supabase trả lời chatbot đúng, `db:audit` sạch, đã khôi
phục thử thành công.

## Bước 4: Dựng server (VPS)

- [ ] Tạo user riêng, chỉ đăng nhập SSH bằng khoá, tắt đăng nhập root.
- [ ] Cài Docker, bật cập nhật bảo mật tự động.
- [ ] Firewall: SSH chỉ mở cho IP quản trị. 443 (và 80 nếu cần) **chỉ mở cho dải IP Cloudflare**
      (https://www.cloudflare.com/ips/).
  - Oracle có HAI lớp chặn: Security List/NSG của VCN trên Console, **và** iptables có sẵn trong
    image Ubuntu của Oracle. Phải mở cổng ở cả hai lớp, nếu không thì cổng vẫn đóng dù Console
    đã mở.
- [ ] Đặt tệp `.env` production trên server, chmod 600, không đưa vào git:
  - `JWT_SECRET`: sinh mới, ≥ 32 byte ngẫu nhiên.
  - `DATABASE_URL`: chuỗi pooler của Supabase. Thêm chuỗi trực tiếp nếu migrate chạy từ server.
  - `GEMINI_*`: giữ proxy và endpoint hiện tại.
  - `GOOGLE_MAPS_API_KEY`: giới hạn theo IP của VPS. `GOOGLE_MAPS_EMBED_KEY`: giới hạn theo tên miền.
  - `GOOGLE_CLIENT_ID`: thêm tên miền mới vào Authorized JavaScript origins trên Google Cloud Console.
  - `ALLOWED_ORIGINS=https://<tên-miền>`, `TRUST_PROXY` (xem bước 5), `NODE_ENV=production`.
- [ ] Reverse proxy (Caddy hoặc nginx) trên 443 dùng Cloudflare Origin Certificate, chuyển tiếp tới `web`.

**Xong khi:** gọi thẳng vào IP của VPS từ ngoài dải Cloudflare bị chặn, còn gọi qua Cloudflare
tới `/ready` thì trả OK.

## Bước 5: Cloudflare

- [ ] Chuyển nameserver của tên miền về Cloudflare, bật proxy (đám mây cam) cho bản ghi app.
- [ ] SSL/TLS đặt **Full (strict)**, bật Always Use HTTPS và HSTS (sau khi chắc HTTPS ổn).
- [ ] IP khách: đặt `TRUST_PROXY` cho đúng số tầng proxy (Cloudflare → Caddy/nginx → Express).
      Cách khác là cho server đọc `CF-Connecting-IP`. **Kiểm bằng log**: hai máy khác nhau phải ra
      hai IP khác nhau, không phải IP của Cloudflare. Nếu sai, mọi người dùng chung một bộ đếm
      rate limit.
- [ ] Cache: asset tĩnh có hash của Vite thì cache dài hạn. Bypass cache cho `/api/*`.
- [ ] Turnstile: tạo site key, gắn widget vào form đăng nhập và đăng ký, kiểm token ở
      `server/routes/auth.ts` (endpoint `siteverify`). Viết test cho nhánh token sai.
- [ ] CSP (`server/middleware/securityHeaders.ts`): thêm `challenges.cloudflare.com` vào
      `script-src` và `frame-src`. Chạy thử với `CSP_REPORT_ONLY` trước khi bật chặn thật.

**Xong khi:** đăng nhập qua tên miền thật chạy được với Turnstile, log ghi đúng IP khách, không
có lỗi CSP trong console.

## Bước 6: Tự động deploy và vận hành

- [ ] GitHub Actions: khi CI của `main` xanh thì build hai image, gắn tag theo SHA của commit, đẩy
      lên GHCR. Sau đó SSH vào VPS và chạy `docker compose pull && docker compose up -d`, rồi
      `npm run db:migrate:deploy` (chạy migrate **trước** khi đổi container web).
      Secrets để trong GitHub Environments `production`.
- [ ] Rollback: một lệnh hoặc workflow thủ công để đặt tag image về SHA trước đó.
- [ ] Theo dõi: dịch vụ uptime gọi `/ready` mỗi 5 phút, log Docker có xoay vòng (`max-size`),
      cảnh báo ngân sách Gemini và Maps, cảnh báo dung lượng DB trên Supabase.
- [ ] Ghi quy trình deploy và rollback vào `docs/`.

**Xong khi:** merge một commit nhỏ vào `main` thì bản mới tự lên production, và đã thử
rollback một lần.

## Bước 7: Kiểm trước khi mở cho người dùng

- [ ] `npm run test:e2e` chạy vào URL production (hoặc staging).
- [ ] `npm run eval` một lượt trên cấu hình production.
- [ ] Đi tay: 4 luồng tài khoản (G1-ACC-01), chatbot nhiều lượt, bản đồ và tuyến đường, thời tiết,
      trang khám phá điểm đến.
- [ ] Kiểm việc che dữ liệu cá nhân (G1-LAW-01): gửi số điện thoại, email vào chatbot rồi xác nhận
      log hoặc trace ra ngoài đã được che.
- [ ] Thử tải nhẹ để xem RAM của embedding và độ trễ (NFR-PERF-03: 3 giây).

**Xong khi:** mọi mục trên đạt, kết quả được ghi vào nhật ký.

## Sau khi chạy ổn định (không chặn việc ra mắt)

- [ ] **Resend**: xác minh tên miền (SPF, DKIM, DMARC trên Cloudflare DNS), làm quên mật khẩu và
      xác minh email. Gói free giới hạn 100 email/ngày.
- [ ] **Cloudflare R2**: chỉ làm khi có upload ảnh hoặc bộ ảnh quá nặng để để trong repo. Dùng
      presigned URL và gắn tên miền riêng.

---

## Nhật ký tiến độ

Mỗi bước xong thì ghi một dòng: ngày, bước, kết quả, commit hoặc link, việc còn dở.

| Ngày | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-09-24 | Lập kế hoạch | Tạo tệp này | Đang chờ bước 0 |
| 2026-09-24 | Bước 0 | Chốt: thử thị trường trên Oracle Free (ARM, Singapore) + Supabase Free; dữ liệu không bắt buộc lưu tại VN; tên miền `vntravelai.food`; tắt rerank | Còn mở: gỡ `client hold` của tên miền, tạo tài khoản Oracle (home region Singapore, nâng PAYG), đặt trần quota Gemini/Maps |
| 2026-09-24 | Bước 1 | Xong. Commit 5 nhóm (4dc25ba..38f698b), PR #1 merge vào `main` thành `296864b`; CI trên `main` xanh 4/4 (typecheck + test nhanh, integration Postgres, bộ chấm Python, E2E Playwright); `git status` sạch trên `main` | E2E `account.spec.ts` còn chập chờn trên máy local (server test không trả lời request lúc vừa khởi động), CI không gặp |
| 2026-09-24 | Bước 2 | Xong trên máy dev. Dockerfile web + embedding, `docker-compose.prod.yml`, `.dockerignore`, `binaryTargets` cho arm64. Stack production chạy lên, `/api/health` và `/ready` OK, chatbot trả lời câu RAG có trích dẫn (14 s). Image arm64 build và khởi động được dưới QEMU | Chưa đo tốc độ nhúng trên ARM thật; image web 873 MB, embedding 1,99 GB chưa kèm model |
