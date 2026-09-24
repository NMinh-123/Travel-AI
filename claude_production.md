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
| Tên miền | **vntravelai.food**: đăng ký ngày 2026-09-24 qua iNET, hết hạn 2027-09-24. `client hold` đã gỡ (kiểm 2026-09-24 09:24 UTC). Nameserver còn là của iNET (`vclouddns.com`), chưa về Cloudflare | ☑ |
| Giai đoạn | **Thử thị trường** trước (mục tiêu khoảng 1000 người dùng/tháng), chưa thuê VPS lớn. Người dùng chốt ngày 2026-09-24 | ☑ |
| Nhà cung cấp VPS | **Cloud server Việt Nam trả bằng chuyển khoản** (KVM, 2–4 vCPU, 4 GB RAM, ≥ 40 GB SSD, Ubuntu 24.04 x86). Nhà cung cấp cụ thể: _chưa chốt_. Oracle Always Free bị bỏ ngày 2026-09-24 vì không xác minh được thẻ Visa. Đo ngày 2026-09-24: sidecar chỉ nạp BGE-M3 dùng 1,3 GB RAM, cả stack khoảng 2 GB | ◐ |
| Dữ liệu có bắt buộc lưu tại Việt Nam (Nghị định 53/2022, SRS dòng 264)? | **Không bắt buộc**, người dùng chốt ngày 2026-09-24 | ☑ |
| Database | **Supabase Free**, Singapore, cho giai đoạn thử. Lên Supabase Pro khi cần backup hằng ngày hoặc vượt hạn mức Free | ☑ |
| Rerank | **Tắt** (`RERANK_ENABLED=false`). Đo trên x86 20 luồng, rerank 20 đoạn mất 5,8 s; trên 2 OCPU ARM sẽ chậm hơn nhiều | ☑ |

---

## Bước 0: Chốt quyết định (người dùng làm, không cần code)

- [x] Chọn tên miền: `vntravelai.food`.
  - [x] Gỡ trạng thái `client hold`. Khi còn trạng thái này, tên miền **không phân giải được** và
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

- [x] **(Người dùng)** Tạo project trên https://supabase.com/dashboard: gói **Free**, Region
      **Southeast Asia (Singapore)**, mật khẩu DB mạnh (nút Generate). Gói Free không có backup
      hằng ngày, và project tự tạm dừng khi không có hoạt động 7 ngày.
- [x] **(Người dùng)** Lấy chuỗi kết nối: nút **Connect** → **Session pooler** (cổng 5432 trên host
      `aws-...-ap-southeast-1.pooler.supabase.com`), thay `[YOUR-PASSWORD]` bằng mật khẩu, thêm
      `?sslmode=require` vào cuối, rồi ghi vào tệp `.env.supabase` ở gốc repo dưới dạng
      `DATABASE_URL=...`. Tệp này bị `.env*` trong `.gitignore` chặn nên không lọt vào git.
      **Không dán mật khẩu vào chat.**
- [x] Không bật extension `vector` trên dashboard: migration `20260906000000_chat_and_knowledge` tự
      chạy `CREATE EXTENSION IF NOT EXISTS` cho `vector` và `unaccent`, cả hai đều nằm trong danh
      sách Supabase cho phép. Migration không có lệnh nào cần superuser.
- [x] Chọn kiểu kết nối: dùng **Session pooler cho cả app lẫn migrate**, không sửa schema để thêm
      `directUrl`.
  - Kết nối trực tiếp `db.<ref>.supabase.co` chỉ có IPv6 (trừ khi mua add-on IPv4), mà runner
    của GitHub Actions không có IPv6, nên migrate từ CI ở Bước 6 không đi được đường đó.
  - Transaction pooler (cổng 6543) không chạy được `prisma migrate` và buộc thêm
    `?pgbouncer=true`. Session pooler thì chạy được cả hai, và server chạy lâu dài nên không cần
    kiểu kết nối ngắn hạn của transaction pooler.
  - Prisma mở mặc định `số CPU × 2 + 1` kết nối, tức 5 trên máy 2 OCPU, nằm trong giới hạn của
    session pooler gói Free.
- [x] Từ máy dev, trỏ `DATABASE_URL` vào Supabase rồi chạy `npm run db:migrate:deploy`,
      `db:seed`, `db:ingest` (dùng sidecar embedding trên máy dev), rồi `db:audit`. Số bản ghi phải
      **đếm lại từ `data/website`**, không lấy từ trí nhớ.
- [x] Script backup `scripts/backup-db.sh`: `pg_dump` trong container `postgres:17-alpine`, chỉ
      schema `public` kèm extension `vector` và `unaccent`, giữ `KEEP` bản gần nhất. Đã thử trên DB
      dev: xoay vòng giữ đúng số bản; khôi phục vào database trống và đè lên database có sẵn đều
      ra đủ 167 đoạn / 167 vector / 26 điểm đến / 13 migration. Lần thử đầu (thiếu `--extension`)
      hỏng ở bảng KnowledgeDoc, nên cờ đó là bắt buộc.
- [x] Chạy `scripts/backup-db.sh` vào Supabase, khôi phục bản dump vào một database tạm trên máy
      dev để kiểm (không cần project thứ hai), rồi đặt cron trên VPS ở Bước 4.

- Kết quả 2026-09-24: project Supabase vùng `ap-southeast-1` (Singapore), PostgreSQL 17.6.
  - 13 migration áp thành công; seed ra 114 địa danh, 26 điểm đến, 20 chỗ nghỉ, 16 đồ dùng, 6
    trạm thời tiết đèo, 1 lịch trình mẫu, khớp số đếm lại từ `data/website`; ingest 167 đoạn,
    `db:audit` sạch (167 duyệt, 167 vector, 167 chỉ mục từ khoá).
  - Stack production (Docker) trỏ vào Supabase: `/api/health` OK, chatbot trả lời câu RAG bằng
    tác tử tri thức có trích dẫn, không chuyển tiếp (14–17 s).
  - Sao lưu Supabase bằng `scripts/backup-db.sh` (1,2 MB), khôi phục vào database tạm ra đủ số
    bản ghi trên. Chưa đặt cron: làm ở Bước 4 khi có VPS.
  - Bẫy đã gặp khi lấy chuỗi kết nối: mật khẩu để nguyên ngoặc `[ ]` của mẫu; mật khẩu của
    project cũ (Tokyo) dán vào project mới; ký tự `%` trong mật khẩu phải mã hoá thành `%25`;
    mật khẩu vừa đặt lại cần 1–2 phút mới đồng bộ sang pooler. Mật khẩu có `$` hoặc `&` thì
    đừng `source` tệp env trong shell, để Docker `--env-file` hoặc tiến trình tự đọc.
  - Mật khẩu project Tokyo (đã bỏ) từng lộ trong phiên chat; project Singapore dùng mật khẩu mới.

**Xong khi:** app chạy trên máy trỏ vào Supabase trả lời chatbot đúng, `db:audit` sạch, đã khôi
phục thử thành công.

## Bước 4: Dựng server (VPS)

Chuẩn bị sẵn trong repo (đã kiểm trên máy dev, chưa chạy trên máy Oracle thật):

- `deploy/setup-server.sh`, chạy một lần bằng `sudo` trên máy mới: cập nhật bảo mật tự động
  (unattended-upgrades), Docker (xoay vòng log 10 MB × 3), user `deploy` (nhóm docker, dùng lại
  khoá SSH của user `ubuntu`), tắt đăng nhập mật khẩu và root, clone repo vào `/opt/travel-ai`,
  ghi dải IP Cloudflare vào `.env` (`CF_IPS`), cron backup hằng ngày 02:17 giờ Việt Nam. Đã chạy
  hai lần liên tiếp trong container Ubuntu 24.04: lần hai không đổi gì, `sshd -t` hợp lệ.
  Chạy thử đã bắt được một lỗi thật và đã sửa: Ubuntu 24.04 bật SSH theo socket activation nên
  `/run/sshd` có thể chưa có và `systemctl reload ssh` lỗi khi service chưa chạy.
- `deploy/Caddyfile` + service `caddy` trong `docker-compose.prod.yml`: nhận 443 bằng Cloudflare
  Origin Certificate, **đóng kết nối nếu request không đến từ dải IP Cloudflare**, chuyển vào
  `web:3000`. Đã đo bằng container giả lập: peer ngoài dải bị đóng kết nối; peer trong dải thì
  app nhận `X-Forwarded-For: <khách>, <Cloudflare>`, nên `TRUST_PROXY=2` (ghi cố định trong
  compose).
- `scripts/backup-db.sh` nhận `ENV_FILE` (Docker tự đọc tệp) để cron không phải `source` tệp env.

Máy thật (2026-09-24): cloud server Việt Nam, IP `103.216.116.207`, SSH cổng **24700**, Ubuntu
24.04.1 x86_64 (KVM), 2 CPU, 7,8 GB RAM, 40 GB. Đăng nhập: `ssh -i ~/.ssh/travelai_vps -p 24700
deploy@103.216.116.207` (khoá `travelai_vps` nằm trên máy dev của người dùng). Máy đầu tiên của
nhà cung cấp (`162.4.177.142`) hỏng VM ngay khi tạo và đã được thay.

- [x] `setup-server.sh` chạy xong trên máy thật (sửa thêm 4 chỗ, xem commit `6a34050`): user
      `deploy` (docker), SSH chỉ bằng khoá (root chỉ vào bằng khoá, mật khẩu tắt), ufw bật và
      **còn bật sau reboot** (đã reboot 2 lần), Docker 29.8, cron backup, `CF_IPS` trong `.env`.
      Đã cài bản vá bảo mật và reboot sang kernel 6.8.0-142.
- [x] `.env` trên máy: `DATABASE_URL` (Supabase), `JWT_SECRET` sinh mới trên máy, `GEMINI_*`,
      `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGINS=https://vntravelai.food,https://www.vntravelai.food`.
      Chmod 600, không có ký tự `$`. Còn thiếu: `GOOGLE_MAPS_*` (dev cũng chưa có),
      `TURNSTILE_*` (tạo ở Bước 5).
- [x] `web` + `embedding` build ngay trên máy (4 phút 54 giây) và chạy healthy: `/api/health`
      nối được Supabase; chatbot trả lời câu RAG có trích dẫn trong 13 giây. RAM lúc nghỉ: web
      139 MB, embedding 895 MB. Từ ngoài, cổng 3000, 8000, 80, 5432 đều đóng.
- [ ] `caddy` chưa chạy: chờ Origin Certificate (Bước 5).

Việc trên máy thật (danh sách gốc):

- [ ] **(Người dùng)** Security List của VCN trên Oracle Console (Networking → Virtual Cloud
      Networks → subnet → Security List → Ingress Rules):
  - TCP 22 **chỉ từ IP quản trị** (`<IP-của-bạn>/32`). IP nhà mạng hay đổi thì cập nhật rule khi
    đổi; bị khoá ngoài vẫn vào được bằng Cloud Shell / Console Connection của Oracle.
  - TCP 443 từ các dải của https://www.cloudflare.com/ips-v4 (nếu ngại nhập 15 rule thì mở
    0.0.0.0/0: Caddy vẫn đóng mọi kết nối không đến từ Cloudflare).
  - **Không** cần mở 80, 3000 hay 8000.
- [ ] **(Người dùng)** SSH vào máy bằng user `ubuntu`, chạy `deploy/setup-server.sh` (lệnh ở đầu
      tệp). Tệp phải có trên nhánh `main` trước, vì script tải từ `main`.
- [ ] Điền `/opt/travel-ai/.env` (chmod 600, script đã tạo sẵn cùng dòng `CF_IPS`):
  - `DATABASE_URL`: chuỗi Session pooler của Supabase như `.env.supabase`. Mật khẩu **phải mã
    hoá URL** (`$` → `%24`, `&` → `%26`, `%` → `%25`): docker compose diễn giải ký tự `$` trong
    tệp env, và mã hoá thì không còn `$` nào.
  - `JWT_SECRET`: sinh mới, ≥ 32 byte ngẫu nhiên (`openssl rand -hex 32`), không dùng lại của dev.
  - `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL`, `GEMINI_MODEL_LIGHT`: giữ proxy hiện tại.
  - `GOOGLE_MAPS_API_KEY` (giới hạn theo IP của VPS), `GOOGLE_MAPS_EMBED_KEY` (giới hạn theo tên
    miền), `GOOGLE_CLIENT_ID` (thêm `https://vntravelai.food` vào Authorized JavaScript origins).
  - `ALLOWED_ORIGINS=https://vntravelai.food` (thêm `https://www.vntravelai.food` nếu dùng www).
  - `NODE_ENV`, `TRUST_PROXY`, `EMBEDDER`, `EMBEDDING_*`, `RERANK_ENABLED` đã cố định trong
    compose, không cần khai.
- [ ] Đặt Origin Certificate vào `/opt/travel-ai/deploy/certs/origin.pem` và `origin.key`
      (chmod 600). Thư mục `deploy/certs/` nằm trong `.gitignore`. Tạo cert ở Bước 5.
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`, rồi
      `curl -s http://127.0.0.1:3000/api/health` trên máy chủ.
- Firewall trên máy: cổng do Docker mở (443 của `caddy`) đi qua chain FORWARD/DOCKER-USER, **không
  qua INPUT**, nên luật REJECT trong INPUT của image Ubuntu Oracle không chặn nó và cũng không
  bảo vệ nó. Chặn ở tầng mạng là Security List; lớp thứ hai là Caddy. Cần kiểm trên máy thật
  rằng 443 vào được qua Cloudflare.

**Xong khi:** gọi thẳng vào IP của VPS từ ngoài dải Cloudflare bị chặn, còn gọi qua Cloudflare
tới `/api/health` thì trả OK.

## Bước 5: Cloudflare

Việc của người dùng trên dashboard Cloudflare (không cần server):

- [ ] Tạo tài khoản https://dash.cloudflare.com (gói Free) → **Add a domain** → `vntravelai.food` →
      gói **Free**. Cloudflare đưa 2 nameserver dạng `xxx.ns.cloudflare.com`.
- [ ] Ở trang quản lý tên miền của iNET: đổi nameserver từ `sapa/laocai.vclouddns.com` sang 2
      nameserver của Cloudflare. Chờ Cloudflare báo "Active" (vài phút tới vài giờ).
- [ ] **SSL/TLS → Overview:** chế độ **Full (strict)**.
- [ ] **SSL/TLS → Origin Server → Create Certificate:** RSA, hostname `vntravelai.food` và
      `*.vntravelai.food`, thời hạn 15 năm. Lưu **Origin Certificate** thành `origin.pem` và
      **Private Key** thành `origin.key` (private key chỉ hiện MỘT lần). Chép lên server vào
      `/opt/travel-ai/deploy/certs/` khi có server (chmod 600). Không gửi private key qua chat.
- [ ] **Turnstile → Add widget:** tên `travelai`, hostname `vntravelai.food`, chế độ **Managed**.
      Cloudflare đưa **Site Key** và **Secret Key**: ghi vào `.env` trên server thành
      `TURNSTILE_SITE_KEY` và `TURNSTILE_SECRET_KEY`.
- [ ] Khi có IP server: **DNS → Add record** `A` `@` → IP server, **Proxied** (đám mây cam); thêm
      `CNAME` `www` → `vntravelai.food`, Proxied, nếu dùng www.
- [ ] Sau khi HTTPS đã chạy ổn vài ngày: **SSL/TLS → Edge Certificates** bật **Always Use HTTPS**,
      rồi mới bật **HSTS**. Server đã gửi HSTS ở production, nên bật HSTS ở Cloudflare là tuỳ chọn.
- [ ] **Caching → Cache Rules:** rule "Bypass cache" khi URI Path bắt đầu bằng `/api/`. Asset của
      Vite có hash trong tên nên để Cloudflare cache theo mặc định là đủ.

Đã làm trong mã:

- [x] IP khách: `TRUST_PROXY=2` cố định trong `docker-compose.prod.yml` (Cloudflare → Caddy →
      Express), đã đo bằng container giả lập ở Bước 4. **Còn phải kiểm trên máy thật**: hai máy
      khác nhau vào qua tên miền thì log phải ra hai IP khác nhau, không phải IP của Cloudflare.
- [x] Turnstile ở form đăng nhập và đăng ký:
  - `server/middleware/turnstile.ts` đứng trước `/api/auth/login` và `/api/auth/register`, gọi
    `siteverify`. Thiếu hoặc sai token → 400; không gọi được Cloudflare → 503 (từ chối, không cho
    qua). Chỉ bật khi có ĐỦ `TURNSTILE_SITE_KEY` và `TURNSTILE_SECRET_KEY`; thiếu thì dev, CI và
    E2E chạy như cũ. Đăng nhập Google không đi qua Turnstile.
  - `/api/config` trả `turnstileSiteKey`; `AuthModal` hiện widget, gửi `turnstileToken`, và
    reset widget sau mỗi lần gửi (mỗi token dùng một lần).
  - Test: `server/middleware/turnstile.test.ts` (5 ca, gồm token sai). Kiểm trong trình duyệt
    bằng khoá thử của Cloudflare: secret `1x…AA` qua được tới bước kiểm mật khẩu, kể cả lượt
    thử thứ hai sau khi reset; secret `2x…AA` bị chặn 400 và giao diện hiện đúng thông báo.
- [x] CSP: thêm `https://challenges.cloudflare.com` vào `script-src` và `frame-src`. Đã chạy
      stack production (CSP chặn thật) với khoá thử: widget lấy được token, không có lỗi CSP nào
      trong console, nên không cần chạy qua `CSP_REPORT_ONLY`.

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
| 2026-09-24 | Bước 3 | Xong. Supabase Free Singapore (PG 17.6): migrate 13/13, seed khớp `data/website`, ingest 167 đoạn, `db:audit` sạch; app Docker trỏ vào Supabase trả lời chatbot đúng; backup + khôi phục thử thành công | Chưa đặt cron backup (Bước 4). `package.json` có thêm `@supabase/supabase-js` và `@supabase/ssr` do người dùng tự cài, chưa commit và chưa dùng ở đâu |
| 2026-09-24 | Bước 4 | Gần xong. Server Việt Nam 103.216.116.207 (SSH 24700) dựng bằng `setup-server.sh`; web + embedding chạy healthy trên máy, nối Supabase, chatbot trả lời RAG; firewall giữ qua reboot | Còn: Origin Certificate để bật `caddy`, rồi kiểm "gọi thẳng IP bị chặn, qua Cloudflare thì OK" ở Bước 5 |
