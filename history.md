# Lịch sử thay đổi

Ghi lại các thay đổi do Claude thực hiện trên dự án Travel AI Hà Giang, kèm lý do,
để lần sau không phải đọc lại diff mới hiểu vì sao code trông như vậy.

Trạng thái nền khi bắt đầu: repo có đúng một commit (`46b4ab5 first commit`) cộng một
đợt sửa chưa commit — tách `server/config.ts` và `server/prompts.ts` khỏi `server.ts`,
bỏ các câu trả lời dựng sẵn khi thiếu `GEMINI_API_KEY` để trả HTTP 503 thật, và cho
frontend hiển thị lỗi từ server thay vì thông báo chung chung.

---

## Vòng 1 — Sửa các lỗi nhỏ (2026-09-05)

### 1. Chat hiển thị markdown thay vì in thô dấu `**` và `-`

Trợ lý được yêu cầu trả lời bằng markdown (`CHAT_RESPONSE_SCHEMA` trong
`server/prompts.ts`) nhưng giao diện render bằng `whitespace-pre-line`, nên người dùng
thấy nguyên các dấu cú pháp trên màn hình.

Thêm `src/components/MarkdownMessage.tsx` — trình render tối giản, dùng ở cả
`AIConciergeTab` và `AIConciergeModal`.

Quyết định thiết kế: **không thêm dependency**. `react-markdown` kéo theo hơn 10 package
chuyển tiếp, trong khi prompt chỉ yêu cầu model dùng bullet và in đậm, nên tập cú pháp
cần hỗ trợ rất hẹp: tiêu đề, bullet, danh sách số, `**đậm**`, `*nghiêng*`, `` `code` ``,
liên kết, đường kẻ ngang. Bundle chỉ tăng 0,3 kB.

Hai điểm về an toàn, cần giữ nguyên khi sửa file này về sau:

- Toàn bộ đầu ra là React element, **không dùng `dangerouslySetInnerHTML`**, nên nội dung
  model sinh ra không thể chèn HTML vào trang.
- Liên kết lọc theo giao thức (`SAFE_LINK`): chỉ `http/https/mailto` mới thành thẻ `<a>`.
  Đã kiểm thử với `[x](javascript:alert(1))` — ra text thuần.

Tin nhắn của người dùng vẫn giữ nguyên văn, không đưa qua parser, vì đó là chữ họ tự gõ.

### 2. Bỏ tên model bịa "Gemini 3.7"

`AIConciergeModal.tsx` ghi "Gemini 3.7" — phiên bản không tồn tại. Model thật do biến
`GEMINI_MODEL` quyết định (mặc định `gemini-2.5-flash`), nên đổi thành "Google Gemini"
thay vì hardcode một số phiên bản khác. Nếu muốn hiện đúng tên model đang chạy thì
`/api/health` đã trả về sẵn field `model`.

### 3. Điểm đến người dùng chọn được truyền đi thật

Trước đó `handlePlanTripTo(dest)` trong `App.tsx` nhận tham số rồi bỏ, chỉ đổi tab — bấm
"Thêm Vào Lịch Trình" ở một điểm đến cụ thể không hề ảnh hưởng tới lịch trình được tạo.
Prop `onOpenMapToLocation` thì được khai báo nhưng **không hề được gọi ở đâu**.

- `App.tsx` thêm state `plannerFocus` / `mapFocus`.
- `ItineraryPlanner` nhận `focusDestination`, mồi sẵn ghi chú
  `Ưu tiên dành thời gian cho <tên>`.
- Wire `onOpenMapToLocation` vào nút "Xem trên bản đồ" ở header từng ngày.
- `HighlandsMap` nhận `focusLocation` và chọn sẵn waypoint tương ứng.

Chỗ khó: tên địa danh do AI sinh ra không theo từ điển cố định — "Thị trấn Đồng Văn" và
"Phố Cổ Đồng Văn" là cùng một chỗ nhưng không phải chuỗi con của nhau. Nên `findWaypoint`
chấm điểm theo tỉ lệ từ khoá trùng nhau (bỏ tiền tố hành chính như "thị trấn", "bản",
"phố"), ngưỡng 0,5, và **trả về null khi không đủ tin cậy** để bản đồ giữ nguyên điểm
đang chọn. Nhảy sai điểm tệ hơn là không nhảy — đừng hạ ngưỡng này.

Kiểm thử với dữ liệu thật: cả 3 `endPoint` của lịch trình mẫu và cả 8 `vietnameseName`
trong `DESTINATIONS` đều khớp đúng; tên lạ và chuỗi rỗng trả null như thiết kế.

### 4. Tổng km và overview không còn hardcode

`ItineraryPlanner` chỉ dùng `data.days` và `data.title`, bỏ `data.overview`; phần "Tổng
quãng đường" ghi cứng `~350 km` và độ cao `110m - 1,520m`. Lịch trình 5 ngày do AI tạo
vẫn hiện số của bản mẫu 3 ngày. Nay overview lấy từ API, tổng km và dải độ cao tính từ
chính `itineraryDays`. Với lịch trình mẫu, con số thành 315 km và 110m - 1.520m.

---

## Rà soát hardcode (2026-09-05)

Quét toàn bộ codebase tìm chỗ hardcode. Kết quả chia làm bốn nhóm: dữ liệu giả được
trình bày như thật, tuỳ chọn bị khoá cứng, dữ liệu AI sinh ra rồi bị bỏ đi, và nội dung
tĩnh chấp nhận được ở giai đoạn này. Vòng 2 dưới đây xử lý ba nhóm đầu.

---

## Vòng 2 — Dọn hardcode và dữ liệu giả (2026-09-05)

### 1. Số hotline cứu hộ bịa, thay bằng đầu số quốc gia có thật

`Footer.tsx` hiển thị `0982 123 456` và `0912 888 999` dưới tiêu đề "Hotline Cứu Hộ
Đường Đèo". Cả hai là mẫu số placeholder. Đây là lỗi nguy hiểm nhất tìm được: một người
gãy phanh trên Mã Pí Lèng gọi vào số không tồn tại.

Không thể tự bịa số cứu hộ địa phương, nên thay bằng ba đầu số quốc gia có thật và kiểm
chứng được — 113 (cảnh sát), 115 (cấp cứu), 114 (cứu hoả & cứu nạn cứu hộ) — kèm một
dòng nhắc du khách lưu số cửa hàng thuê xe và homestay ngay khi nhận xe. **Đừng thêm số
điện thoại nào vào file này nếu không xác minh được nó thật.**

### 2. Mức ngân sách bị khoá cứng ở `comfort`

`ItineraryPlanner` khai báo `useState('comfort')` và gửi `budget` lên API, nhưng
`setBudget` **không được gọi ở bất kỳ đâu** — không có UI để chọn. Nghĩa là mọi yêu cầu
lập lịch trình đều nói "Mức ngân sách: Tiện nghi vừa phải", dù server validate đủ ba mức
và `prompts.ts` đã có nhãn cho `backpacker` và `luxury`.

Đây là dạng hardcode khó thấy nhất: một tham số trông như tuỳ chọn của người dùng nhưng
thực chất là hằng số. Đã thêm `<select>` Mức Ngân Sách vào ô Phong Cách. Phát hiện được
nhờ `tsc --noUnusedLocals` báo `setBudget` không dùng — xem mục 8.

### 3. Ba trường AI sinh ra rồi bỏ đi, giờ được hiển thị

`dailyTips`, `scenicRating` và `maxElevationM` đều nằm trong `required` của
`ITINERARY_RESPONSE_SCHEMA`, nên model buộc phải sinh và ta trả token cho chúng, nhưng
frontend không render ở đâu cả.

Chọn hiển thị thay vì xoá khỏi schema, vì đây là nội dung thật sự hữu ích và đã trả tiền:

- `dailyTips` → thẻ "Mẹo Cho Cả Hành Trình" ở cột trái, chỉ hiện khi có (lịch trình mẫu
  không có trường này nên mặc định ẩn).
- `scenicRating` → 5 ngôi sao trong header từng ngày.
- `maxElevationM` và `ridingHours` → dòng thông số cạnh sao.

### 4. Thời tiết: bỏ độ tươi giả, nối dữ liệu vào giao diện

Ba vấn đề chồng nhau: `PASS_WEATHER_STATION` gắn `updatedAt: 'Vừa cập nhật 5 phút trước'`
cho mỗi trạm (độ tươi giả); mảng này được import vào `PocketGuideSection` nhưng **không
render ở đâu**; và `Navbar` có comment `{/* Live Weather Badge */}` bên trên một chuỗi cứng
`18°C • Nắng ráo`.

- Xoá `updatedAt` khỏi `WeatherPassStatus` và cả 5 bản ghi.
- Render bảng điều kiện 5 đỉnh đèo trong tab "an toàn đường đèo", kèm **đúng một** lời
  cảnh báo rằng đây là số liệu tham khảo theo mùa, không phải quan trắc thời gian thực.
  Việc này cũng làm sống lại `fogLevel`, `roadStatus`, `elevation` và `windSpeedKm` —
  bốn trường trước đó chưa từng được hiển thị.
- Badge Navbar lấy số từ chính `PASS_WEATHER_STATION` và đổi nhãn thành
  "Mã Pí Lèng · tham khảo". Chưa có API thời tiết nên không thể làm nó live thật; ít nhất
  giao diện không còn nói dối và hai chỗ dùng chung một nguồn.

### 5. Xoá `weatherTag`

`Destination.weatherTag` (nhiệt độ, điều kiện, `fogRisk`) có trong types, có dữ liệu cho
3 trong 8 điểm đến, và **không component nào đọc**. Chọn xoá thay vì render: nó chỉ có ở
3/8 điểm nên giao diện sẽ không nhất quán, điền cho 5 điểm còn lại là bịa dữ liệu, và
trường `temp` lại là một nguồn thời tiết giả nữa. Thông tin sương mù theo đèo giờ đã có ở
bảng tham khảo tại mục 4.

### 6. Homestay: bỏ link gọi vào số bịa

Thẻ homestay có `<a href={`tel:${hs.phone}`}>Gọi 0912 345 678</a>` — bấm vào là điện
thoại gọi thật tới một số bịa. Đã xoá `phone` khỏi `HomestaySpot` và cả 4 bản ghi, thay
nút bằng "Hỏi AI về chỗ này" (nhất quán với các lối vào AI khác trong ứng dụng).

`rating` và `reviewCount` vẫn là số mẫu — xoá thì mất khá nhiều giao diện — nên thêm một
dòng nói rõ đây là dữ liệu tham khảo chưa nối hệ thống đặt phòng, và nhắc xác nhận giá
trực tiếp với chủ nhà.

### 7. Đơn giá dự toán chi phí gom về một chỗ

`PocketGuideSection` rải 180k/900k/100k/150k/450k/900k/300k/250k/600k VNĐ ngay trong biểu
thức tính. Đã gom vào `COST_ASSUMPTIONS` ở đầu file, có chú thích từng khoản và ghi rõ đây
là mặt bằng 09/2026 sẽ lạc hậu. Công thức không đổi, kết quả giữ nguyên.

Cũng thống nhất 7 chỗ `toLocaleString()` thiếu locale thành `toLocaleString('vi-VN')`, và
sửa `1,520 m` ở HeroSection thành `1.520 m` cho khớp cách viết số tiếng Việt.

### 8. Dọn 52 import/biến không dùng và bật kiểm tra tự động

`tsc --noEmit --noUnusedLocals` báo 52 lỗi `TS6133`, phần lớn là icon `lucide-react` import
thừa. Đã dọn hết, đồng thời wire `onOpenPlanner` — prop mà `App` truyền vào
`UserProfileModal` nhưng không có gì gọi tới, cùng dạng lỗi với `onOpenMapToLocation` ở
vòng 1 — thành nút "Lập lịch trình mới".

Sau đó bật `noUnusedLocals` và `noUnusedParameters` trong `tsconfig.json`. Đây là điểm
quan trọng: chính hai cờ này đã phát hiện `setBudget` bị khoá cứng (mục 2),
`PASS_WEATHER_STATION` không render (mục 4) và `onOpenPlanner` chết. Giữ chúng bật thì
`npm run lint` sẽ tự bắt loại lỗi "khai báo rồi quên dùng" thay vì phải rà tay.

---

## Những gì cố tình chưa làm

- **Đăng nhập vẫn là mô phỏng.** `AuthContext.tsx` trả về user cứng ("Nguyễn Hoàng Minh",
  "Trần Thị Thu Hà") lưu ở localStorage, không gọi backend. `bcryptjs`, `jsonwebtoken`,
  `cookie-parser`, `google-auth-library`, `prisma`/`@prisma/client` đã cài nhưng chưa được
  import ở đâu và không có `schema.prisma`. Đây là khối việc lớn (auth thật + DB), tách
  riêng chứ không gộp vào đợt dọn hardcode này.
- **Ảnh vẫn là stock Unsplash.** 27 lượt tham chiếu nhưng chỉ 10 ảnh khác nhau, nên nhiều
  điểm đến đang dùng chung một bức. Không thể sửa mà không có ảnh thật của Hà Giang.
- **`rating` / `reviewCount` của homestay vẫn là số mẫu**, chỉ được ghi chú rõ. Muốn số
  thật thì phải có nguồn đánh giá thật.
- **`hagiangData.ts` vẫn là dữ liệu tĩnh** (8 điểm đến, lịch trình mẫu, checklist đồ,
  homestay) và `MAP_WAYPOINTS` vẫn là 15 toạ độ SVG đặt tay. Chấp nhận được ở giai đoạn
  này. Lưu ý `Destination.coordinates` đã có `lat`/`lng` thật, sẵn sàng nếu sau này chuyển
  sang bản đồ thật — hiện chỉ `x`/`y` được dùng.
- **Khối kiến thức Hà Giang vẫn nằm trong `CONCIERGE_SYSTEM_PROMPT`.** Trong file đã có
  `TODO` sẵn: khi có tầng dữ liệu, phần này nên được truy vấn theo câu hỏi rồi chèn vào
  prompt thay vì liệt kê cố định.
- **`350+ km` ở HeroSection giữ nguyên.** Ban đầu tưởng nó mâu thuẫn với 315 km của trình
  lập lịch trình, nhưng đọc lại thì nhãn là "Vòng Cung Đường Đèo" — độ dài cung đường thật,
  khác với tổng quãng đường của một lịch trình cụ thể. Hai số nói về hai thứ khác nhau.
- **UI chỉ cho chọn 3/4/5 ngày** trong khi server nhận 1–14, và máy tính chi phí cho chọn
  2–5 ngày. Đây là lựa chọn sản phẩm, không phải lỗi, nên để nguyên — nhưng nếu muốn thống
  nhất thì thêm `2N1Đ` vào planner là đủ.
- **Một số trường trong `types.ts` chưa dùng:** `ChatMessage.itinerarySnippet`,
  `RouteWaypoint.completed`, `RouteWaypoint.coordinates`, `ItineraryPlan.id`. `noUnusedLocals`
  không bắt được thành viên interface nên chúng sẽ không tự báo lỗi.

---

## Cách kiểm tra sau khi sửa

```bash
npm run lint      # tsc --noEmit, đã bật noUnusedLocals + noUnusedParameters
npx vite build    # build frontend
npm run dev       # server + Vite middleware trên cùng một cổng
```

`/api/health` trả về `aiConfigured` và `model` đang dùng — dùng nó để biết đã nạp
`GEMINI_API_KEY` chưa. Thiếu key thì `/api/chat` và `/api/plan-itinerary` trả HTTP 503 kèm
hướng dẫn, đúng thiết kế, không dựng nội dung giả để che lỗi cấu hình.


---

## Vòng 3 — Tầng database và auth thật (2026-09-05)

Hai vấn đề gốc mà hai vòng trước cố tình để lại: đăng nhập là mô phỏng, và toàn bộ nội dung
Hà Giang là file tĩnh. Vòng này dựng tầng dữ liệu thật để đóng cả hai.

Quyết định đã chốt với người dùng trước khi làm: **PostgreSQL** (kèm `docker-compose.yml`),
phạm vi **auth thật + đưa nội dung vào DB**, và **Google thật / Facebook ẩn**.

### Điều cần biết trước: chưa chạy được migration ở máy này

Máy phát triển hiện chưa có Docker và chưa có Postgres. Nên đợt này:

- Migration SQL được sinh **offline** bằng
  `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
  đặt tại `prisma/migrations/20260905000000_init/migration.sql`. Cách này không cần database
  đang chạy.
- `prisma generate` và `tsc --noEmit` chạy được không cần DB, nên **mọi truy vấn Prisma đã
  được type-check thật** — đây là lớp kiểm chứng chính.
- Nhưng migration, seed và các endpoint đọc/ghi DB **chưa được chạy thật lần nào**. Việc đầu
  tiên khi có Postgres là chạy `npx prisma migrate deploy && npm run db:seed`.

Lưu ý về Prisma CLI: `prisma validate` và `prisma generate` **đòi `DATABASE_URL` phải được
định nghĩa**, dù không cần kết nối được. Không có `.env` thì truyền tạm biến môi trường khi
gọi lệnh.

### Lược đồ

`prisma/schema.prisma` chia hai nhóm: `User` / `Favorite` / `UserBadge` / `SavedItinerary`
cho người dùng, và `Destination` / `MapWaypoint` / `Homestay` / `GearItem` / `PassWeather` /
`PresetItinerary` cho nội dung.

Ba quy ước xuyên suốt, cần giữ khi thêm bảng mới:

- **Mọi bảng nội dung có `slug`.** Frontend tham chiếu bằng slug bền vững (`'ma-pi-leng'`),
  không bằng id sinh tự động. `server/mappers.ts` map `slug` sang `id` khi trả ra API, nên
  `Destination.id` ở frontend vẫn là `'ma-pi-leng'` như trước và không component nào phải sửa.
- **Mọi bảng nội dung có `sortOrder`.** Thứ tự hiển thị phải đúng như mảng gốc, không phụ
  thuộc thứ tự Postgres trả về.
- **`Favorite` trỏ tới `destinationSlug` chứ không phải khoá ngoại.** Slug là thứ client gửi
  lên, và bản ghi yêu thích sống sót khi một điểm đến tạm bị rút khỏi danh mục.

`PresetItinerary.days` và `SavedItinerary.days` lưu dạng `Json`. Cấu trúc ngày → waypoint chỉ
được đọc trọn khối; chuẩn hoá thành hai bảng nữa không đổi được gì về khả năng truy vấn.

Enum `Provider` và `RiderLevel` lưu dạng mã (`EMAIL`, `BEGINNER`), map sang nhãn tiếng Việt
trong `server/mappers.ts`. Đây là lý do `src/types.ts` gần như không đổi.

### Tầng server

| File | Việc |
|---|---|
| `server/db.ts` | `PrismaClient` singleton trên `globalThis` |
| `server/auth.ts` | bcrypt cost 12, ký/xác thực JWT, cookie, middleware `requireUser` |
| `server/rateLimit.ts` | giới hạn tần suất theo IP, in-memory, không thêm dependency |
| `server/mappers.ts` | chuyển row Prisma ↔ shape trong `src/types.ts` |
| `server/routes/auth.ts` | `POST /register /login /google /logout`, `GET /me` |
| `server/routes/me.ts` | hồ sơ, yêu thích, lịch trình đã lưu |
| `server/routes/content.ts` | sáu endpoint đọc nội dung, công khai |

Singleton Prisma không phải chuyện làm cho đẹp: `npm run dev` chạy qua tsx, mỗi lần lưu file
là một lần nạp lại module, và mỗi `new PrismaClient()` mở một pool mới. Sau vài chục lần lưu,
Postgres hết slot kết nối.

Router phải mount **trước** error handler `app.use("/api", ...)` ở cuối `server.ts`. Mount
sau thì lỗi từ chúng lọt qua handler và Express trả về trang HTML thay vì JSON.

### Những quyết định về bảo mật, và lý do

- **`JWT_SECRET` và `DATABASE_URL` là bắt buộc; thiếu thì server dừng ngay** với thông báo
  hướng dẫn sinh khoá. Cùng nguyên tắc đã áp cho `GEMINI_API_KEY`. Riêng khoá JWT, một giá trị
  mặc định lọt vào production là lỗ hổng: ai biết khoá đó đều ký được session hợp lệ.
- **Token nằm trong cookie `httpOnly`, không phải localStorage.** Script trên trang không đọc
  được nó, nên một lỗi XSS ở đâu đó cũng không lấy được session. `sameSite=lax`, `secure` khi
  production, hạn 7 ngày.
- **Sai email và sai mật khẩu trả về cùng một thông báo.** Nếu phân biệt, form đăng nhập thành
  công cụ liệt kê email nào có tài khoản.
- **Đăng nhập Google gộp theo email.** Người đã đăng ký bằng mật khẩu rồi bấm đăng nhập Google
  vẫn vào đúng tài khoản cũ, `passwordHash` giữ nguyên nên vẫn đăng nhập được bằng mật khẩu.
- **Endpoint `/api/me/*` không bao giờ nhận `userId` từ body hay query** — id luôn lấy từ
  cookie đã xác thực. Xoá lịch trình dùng `deleteMany` kèm `userId` nên biết id của người khác
  cũng không xoá được.
- **`details` của lỗi bị ẩn ở production.** Lỗi Prisma chứa đường dẫn file trên máy chủ, tên
  bảng và địa chỉ database; nội dung đầy đủ vẫn vào log server.
- Yêu thích dùng `PUT`/`DELETE` thay vì một endpoint `toggle`: bấm hai lần vì mạng chậm sẽ ra
  đúng kết quả mong đợi, không bật tắt theo số request tới được server.
- **Rate limit là bộ đếm trong bộ nhớ tiến trình.** Chạy nhiều instance thì mỗi instance đếm
  riêng, và số đếm mất khi khởi động lại. Đủ cho một máy chủ đơn lẻ; muốn chặt hơn cần Redis
  hoặc giới hạn ở tầng reverse proxy.
- **Script của Google chỉ được tải khi có `GOOGLE_CLIENT_ID` và người dùng mở hộp đăng nhập**,
  không nhúng sẵn vào trang. Người chỉ vào xem điểm đến không phải tải script bên thứ ba nào.

### Tầng frontend

- `src/lib/api.ts` — `apiRequest` dùng chung. Trước đây cách đọc lỗi từ server
  (`[data.error, data.details].filter(Boolean).join(' — ')`) bị lặp ở bốn component.
- `src/hooks/useContent.ts` — hook `data / isLoading / error / reload` cho sáu endpoint nội dung.
- `src/components/LoadingState.tsx` — `LoadingState` và `ErrorState` dùng chung, có nút thử lại.
- `src/context/AuthContext.tsx` viết lại hoàn toàn. **Giữ nguyên contract** nên `Navbar`,
  `DestinationsGrid` không phải sửa vì lý do auth. Không còn lưu user vào localStorage; cookie
  là nguồn duy nhất. Mọi thao tác ghi trả về hồ sơ đầy đủ và ta thay cả state bằng phản hồi đó,
  không cập nhật lạc quan ở client.
- `AuthModal` dùng `renderButton` của Google Identity Services thay vì tự vẽ nút. Effect nạp
  script phải đặt **trước** lệnh `if (!isAuthModalOpen) return null`, nếu không thứ tự hook đổi
  giữa các lần render.
- `HighlandsMap` và `ItineraryPlanner` tách thành vỏ ngoài (tải dữ liệu) và phần view nhận mảng
  đã chắc chắn không rỗng. Nhờ vậy `selectedPoint` không phải nullable và hơn 300 dòng JSX bên
  dưới không đầy kiểm tra null.
- `App` lấy `destinations` và `passWeather` một lần rồi truyền xuống, vì nhiều nơi cùng cần.
  Các dữ liệu chỉ một chỗ dùng thì fetch tại chỗ đó.
- Checklist đồ: **chỉ lưu danh sách slug đã tick** vào localStorage, không lưu cả mảng
  `GearItem` như trước. Bản cũ lưu cả mảng nên khi danh mục trong DB đổi, người dùng cũ vẫn
  thấy bản chụp cũ mãi mãi. Vẫn không cần đăng nhập để dùng checklist.

Hệ quả phụ đáng chú ý: bundle frontend **giảm** từ 355 kB xuống 338 kB, vì 530 dòng dữ liệu
Hà Giang không còn nằm trong bundle client nữa.

### Lịch trình đã lưu — phần chủ động thêm

`UserProfile.savedItineraries` từ trước tới nay là một trường có trong type mà không đường nào
ghi vào và không chỗ nào hiển thị. Vòng này thêm nút "Lưu lịch trình" trong trình lập lịch
trình (chỉ hiện khi đã đăng nhập) và tab "Lịch Trình" thứ ba trong hồ sơ. Không làm thì nó lại
thành một trường chết trong database — đúng loại lỗi hai vòng trước vừa dọn.

### Dữ liệu

`src/data/hagiangData.ts` chuyển thành `prisma/seed-data.ts` và **bản cũ đã xoá** — để lại
trong `src/` chỉ gây nhầm là còn dùng. `MAP_WAYPOINTS` (trước ở trong `HighlandsMap.tsx`) cũng
chuyển vào đây.

`prisma/seed.ts` là idempotent: `upsert` theo slug hoặc email, và sau đó xoá những bản ghi có
slug không còn trong seed-data — bỏ một điểm đến khỏi file nguồn là nó biến khỏi database.

Seed nạp hai tài khoản demo đúng email và mật khẩu mà nút "điền nhanh" trong `AuthModal`
prefill. **Mật khẩu demo là công khai, chỉ dùng cho dev, đừng chạy seed lên production.**

### Còn giả sau vòng này

- **Ảnh vẫn là stock Unsplash** — 27 lượt tham chiếu, 10 ảnh khác nhau.
- **`rating` và `reviewCount` của homestay vẫn là số mẫu**, có ghi chú rõ trên giao diện.
- **`PassWeather` vẫn là số liệu tham khảo theo mùa**, chưa nối API thời tiết.
- **Facebook bị ẩn thay vì làm thật**: cần Facebook App ID và SDK riêng, hiện chưa có.
  `google-auth-library` thì đã sẵn nên Google làm được ngay.
- **Kiến thức Hà Giang trong `CONCIERGE_SYSTEM_PROMPT` vẫn cố định.** Giờ đã có tầng dữ liệu,
  `TODO` sẵn trong `server/prompts.ts` mới thực sự làm được: truy vấn `Destination` theo câu hỏi
  rồi chèn vào prompt.

### Cách chạy sau vòng này

```bash
docker compose up -d db          # Postgres, chỉ mở cổng ra localhost
cp .env.example .env             # điền DATABASE_URL và JWT_SECRET
npx prisma migrate deploy        # hoặc: npm run db:migrate
npm run db:seed
npm run dev
```

`/api/health` trả `dbConnected` và `aiConfigured` riêng, để khi ứng dụng trông như hỏng thì
biết ngay nguyên nhân ở đâu. Đã xác nhận: DB không chạy thì endpoint nội dung trả JSON lỗi
(không phải trang HTML), `/api/auth/me` trả `{user: null}`, `/api/me/*` trả 401.

---

## Vòng 4 — Dựng môi trường để tầng DB chạy được (2026-09-06)

Vòng 3 để lại đúng một câu chặn: migration, seed và mọi endpoint đọc/ghi DB **chưa chạy thật
lần nào**, vì máy phát triển không có Docker và không có Postgres. Vòng này chỉ lo phần môi
trường để câu đó không còn đúng nữa. Code thay đổi đúng một dòng, ở mục 5.

### 1. Xác minh lại trước khi động vào gì

Ba thứ cần biết chắc trước khi cài đặt, vì nếu một trong ba sai thì môi trường có dựng xong
cũng vô nghĩa:

- `npm run lint` (`tsc --noEmit`, đang bật `noUnusedLocals` + `noUnusedParameters`) — 0 lỗi.
- **Migration sinh offline có còn khớp schema không.** Đây là rủi ro thật của cách làm ở vòng 3:
  file SQL được sinh một lần, còn `schema.prisma` thì có thể đã đổi sau đó mà không ai sinh lại.
  Kiểm được **không cần database** — sinh lại rồi so với file đã commit:

  ```powershell
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
  ```

  So từng dòng với `prisma/migrations/20260905000000_init/migration.sql`: giống hệt, không có
  drift. Giữ thói quen chạy lệnh này mỗi lần sửa `schema.prisma` trong lúc chưa có DB thật.
- `node_modules` đã cài và Prisma Client đã generate.

### 2. `.env` — thứ khiến ứng dụng không chạy được câu lệnh nào

`.env` chưa từng tồn tại trên máy này, nên `server/config.ts` throw ngay tại `requireEnv`. Đúng
như thiết kế fail-fast của vòng 3, nhưng hệ quả là **kể cả `npm run dev` cũng chết trước khi in
ra dòng nào** — không phải lỗi code, chỉ là cấu hình chưa có.

Đã tạo `.env` (nằm trong `.gitignore` qua `.env*`, không có đường lọt vào commit):

- `JWT_SECRET` sinh ngẫu nhiên 48 byte → 64 ký tự base64url, qua ngưỡng tối thiểu 32 của
  `readJwtSecret()`. Sinh trực tiếp trong shell rồi ghi thẳng vào file, không in giá trị ra
  màn hình.
- `DATABASE_URL` đặt đúng chuỗi khớp `docker-compose.yml`, nên sau khi Docker chạy không phải
  sửa thêm gì.
- `GEMINI_API_KEY` và `GOOGLE_CLIENT_ID` để rỗng có chủ ý — thiếu chúng thì `/api/chat` và
  `/api/plan-itinerary` trả 503 còn nút Google tự ẩn, phần còn lại vẫn chạy đủ để kiểm thử
  tầng DB.

### 3. Bật WSL2 — `wsl --install` là đường cụt trên máy này

`wsl --install --no-distribution` trả về đúng một thông báo:

```
The Windows Subsystem for Linux is not installed. You can install by running 'wsl.exe --install'.
```

Nó bảo chạy đúng cái lệnh vừa chạy. Nguyên nhân: khi Windows feature WSL đang tắt, `wsl.exe`
trong `System32` chỉ là stub, không xử lý được `--install`. **Đừng mất thời gian thử lại lệnh
này với các tổ hợp cờ khác** — đi thẳng DISM:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Cả hai trả exit **3010** = thành công, cần khởi động lại. `/norestart` để DISM không tự reboot
giữa lúc đang làm việc khác.

Đã kiểm trước khi cài rằng CPU đủ điều kiện — `VirtualizationFirmwareEnabled` và
`SecondLevelAddressTranslationExtensions` đều `True` — để không cài xong mới phát hiện máy không
chạy nổi WSL2.

### 4. Cài Docker Desktop — lỗi báo sai chỗ

```powershell
winget install -e --id Docker.DockerDesktop --source winget --accept-package-agreements --accept-source-agreements --silent --disable-interactivity
```

Lần đầu chạy **thiếu** `--source winget` thì thất bại exit 94:

```
Failed when searching source: msstore
0x8a15005e : The server certificate did not match any of the expected values.
```

Cái bẫy: lỗi nổ ra **sau khi** đã tải xong 19 MB, nên trông như lỗi cài đặt chứ không phải lỗi
tìm kiếm nguồn. Và nó chẳng liên quan gì tới Docker — source `msstore` của winget trên máy này
hỏng chứng chỉ. Thêm `--source winget` là qua, và **mọi lệnh `winget install` sau này trên máy
này đều nên có cờ đó.**

Kết quả: Docker Desktop 4.89.0, client `docker` 29.7.2.

### 5. Tắt dòng quảng cáo của dotenv

`dotenv` v17 in một dòng tip quảng cáo mỗi lần `config()` chạy, kèm URL của một sản phẩm bên thứ
ba. Log khởi động chỉ nên chứa thông tin của ứng dụng, để dòng nào bất thường thì nhìn ra ngay.
Đổi thành `dotenv.config({ quiet: true })` — `quiet` có từ v17, đang dùng 17.4.2.

Đây là toàn bộ code thay đổi của vòng 4.

### Trạng thái khi kết thúc vòng 4

| Kiểm tra | Kết quả |
|---|---|
| `docker --version` | 29.7.2 — client đã có |
| `docker info` | không kết nối được daemon — **engine chưa chạy** |
| `Microsoft-Windows-Subsystem-Linux` | Enabled (chờ reboot) |
| `VirtualMachinePlatform` | Enabled (chờ reboot) |
| `RebootPending` | **PENDING** |
| `npm run lint` | 0 lỗi |

Engine chưa chạy là đúng dự kiến, không phải lỗi cài: WSL2 backend chỉ hoạt động sau khi hai
feature kia có hiệu lực, và điều đó cần khởi động lại máy.

### Việc tiếp theo, theo đúng thứ tự

Sau khi khởi động lại máy:

```powershell
# Mở Docker Desktop lần đầu và đợi engine sống. Lần đầu nó tự tải WSL2 kernel
# và tạo distro docker-desktop, mất vài phút.
docker info

docker compose up -d db
docker compose ps                # đợi healthcheck báo healthy

npx prisma migrate deploy        # lần chạy thật đầu tiên của migration
npm run db:seed

npm run dev
```

Hai bước `migrate deploy` và `db:seed` là nơi tập trung toàn bộ rủi ro của vòng 3. Chưa từng
chạy lần nào: migration sinh offline, cột `Json` của `PresetItinerary.days` và
`SavedItinerary.days`, map enum `Provider` / `RiderLevel` trong `server/mappers.ts`, và logic xoá
bản ghi mồ côi theo slug trong `seed.ts`.

Sau khi ứng dụng chạy được, bốn hạng mục đã chốt với người dùng, xếp theo thứ tự phụ thuộc:

1. **Kiểm thử tay toàn bộ endpoint** — 6 endpoint nội dung, `register` / `login` / `me`, yêu
   thích (`PUT` / `DELETE`), lưu lịch trình, và `/api/health` để xác nhận `dbConnected` lật đúng.
2. **Test tự động** (vitest + supertest), ưu tiên tầng auth vì đó là phần nhạy cảm nhất: không
   rò email đã tồn tại, `/api/me/*` không nhận `userId` từ body, gộp tài khoản Google theo email.
   Cũng nên pin lại hai thứ vòng 1 chỉ kiểm bằng tay đúng một lần: lọc giao thức trong
   `MarkdownMessage` (`[x](javascript:alert(1))` phải ra text thuần) và ngưỡng 0,5 của
   `findWaypoint`.
3. **`TODO` ở `server/prompts.ts:9`** — truy vấn `Destination` theo câu hỏi rồi chèn vào prompt,
   thay khối kiến thức cố định.
4. **Dọn phần dữ liệu còn giả** — `PassWeather` nối API thời tiết thật, `rating` / `reviewCount`
   homestay, ảnh Unsplash, đăng nhập Facebook. Nhóm này cần quyết nguồn dữ liệu trước khi làm.

### Còn treo, không thuộc phạm vi vòng này

Công việc của cả bốn vòng **vẫn chưa commit**: 21 file sửa (+1620/−726) và 19 file chưa track,
trên một repo chỉ có duy nhất commit `46b4ab5`. Đã nhắc người dùng, chưa có quyết định, nên
không tự commit.


---

## Vòng 5 — Luồng 6 tác tử + RAG (2026-09-06)

Đóng phần lõi của Giai đoạn 1 trong SRS v1.2 Mục 12: "chatbot AI với đủ 6 tác tử (1 điều phối +
5 tác tử chuyên biệt)" theo kiến trúc Hình 9.2. Trước vòng này, chatbot là **một lần gọi Gemini
với một system prompt đơn khối** — không có tầng NLU, không orchestrator, không tool layer, không
guardrail, lịch sử chỉ sống trong React state.

Ba lựa chọn đã chốt với người dùng trước khi làm: phạm vi đầy đủ (6 tác tử + lưu lịch sử +
escalation), **làm pgvector + embedding luôn** trong vòng này thay vì hoãn, và escalation ghi vào
DB kèm giao diện nói thật là chưa có người trực.

### Các file của vòng này

Tầng tác tử và tầng RAG là code mới hoàn toàn, không phải refactor — trước vòng này không có chỗ
nào để cắm tác tử vào.

| Nhóm | File |
|---|---|
| Tác tử | `server/agents/` — `types.ts`, `nlu.ts`, `dialog.ts`, `orchestrator.ts`, `tools.ts`, `guardrail.ts`, `pii.ts` |
| 5 tác tử chuyên biệt | `server/agents/specialists/` — `discovery.ts`, `itinerary.ts`, `budget.ts`, `knowledge.ts`, `support.ts`, `shared.ts` |
| RAG | `server/rag/` — `embedder.ts`, `retrieval.ts`, `chunker.ts`, `segment.ts` |
| Dùng chung | `server/gemini.ts` (cửa duy nhất ra Gemini), `server/costs.ts`, `server/itineraryCore.ts` |
| API | `server/routes/chat.ts` |
| Dịch vụ embedding | `embedding-service/main.py`, `requirements.txt` |
| Nạp tri thức | `scripts/ingest-knowledge.ts`, `scripts/knowledge-source.ts` |
| Migration | `prisma/migrations/20260906000000_chat_and_knowledge/` |
| Frontend | `src/hooks/useChatSession.ts` |

Sửa: `prisma/schema.prisma` (4 model mới), `docker-compose.yml`, `server/config.ts`,
`server/prompts.ts`, `server/routes/content.ts`, `server.ts`, `src/hooks/useContent.ts`,
`src/components/AIConciergeTab.tsx`, `AIConciergeModal.tsx`, `PocketGuideSection.tsx`,
`.env.example`, `package.json`.

`server/gemini.ts` là phần tách ra chứ không phải thêm mới: `getGeminiClient`, `safeJsonParse`,
`cleanStringList` trước đây nằm inline trong `server.ts`. Vòng này có bốn nơi cần dùng (NLU, năm
tác tử, sinh lịch trình, embedder) nên phải gom lại — nếu không sẽ có bốn bản `new GoogleGenAI()`
với bốn cách xử lý lỗi khác nhau.

### Quyết định kiến trúc quan trọng nhất: prefetch tất định, không dùng function calling

Gemini có function calling, nhưng nó để **model quyết định** khi nào gọi tool. SRS Mục 10.4 bước
8–12 ràng buộc ngược lại: tác tử truy vấn dữ liệu thật **trước**, rồi mới đưa dữ liệu đó cho model
diễn đạt. Function calling cũng thêm một vòng round-trip model→tool→model, phá ngân sách 3 giây
của NFR-PERF-03.

Nên luồng một lượt là: NLU (gọi model tầng nhẹ) → Dialog Manager gộp slot → Orchestrator định
tuyến → tác tử **tự chạy truy vấn DB trong code** → gọi model tầng phù hợp để diễn đạt →
Guardrail. Hai lần gọi model, một lượt truy vấn DB.

`server/agents/tools.ts` là lớp bộ công cụ và có đúng một quy tắc: **chỉ truy vấn database, không
bao giờ gọi model.** Khác Hình 9.2 ở chỗ tool gọi thẳng Prisma thay vì HTTP vào API nội bộ — vì
toàn hệ thống vẫn trong một tiến trình, gọi HTTP vào chính mình chỉ thêm một điểm hỏng. Khi tách
chatbot thành dịch vụ riêng thì đổi các hàm đó sang fetch là đủ.

### Ba trigger chuyển tiếp bắt buộc

SRS Mục 10.6 nói ngoài khiếu nại, hệ thống **buộc** chuyển tiếp trong ba trường hợp. Cả ba nằm ở
`server/agents/orchestrator.ts`:

| Trigger | Hiện thực |
|---|---|
| Khách yêu cầu gặp người thật | `nlu.wantsHuman` → `USER_REQUEST` |
| Độ tin cậy ý định dưới ngưỡng | `confidence` dưới 0,5 → `LOW_CONFIDENCE` |
| Câu hỏi ngoài phạm vi kho tri thức | guardrail chặn `ungrounded` → `OUT_OF_SCOPE` |

Trigger thứ ba là biện pháp chống "ảo giác" hiệu quả nhất trong hệ thống: khi hybrid search không
trả về đoạn nào, tác tử tri thức **không gọi model** mà trả `grounded: false`. Không có căn cứ thì
không nói.

Ngưỡng 0,5 là điểm khởi đầu, **chưa phải kết quả đo** — phải hiệu chỉnh trên bộ câu hỏi vàng.

### Vì sao hybrid search là bắt buộc, có số đo

Trong lúc kiểm thử BGE-M3 đã đo được một con số đáng chú ý: cosine giữa "đèo Mã Pí Lèng" có dấu và
"deo ma pi leng" không dấu chỉ **0,44**. Tức nhánh vector một mình sẽ bỏ sót nặng với người gõ
không dấu — đúng lập luận của SRS Mục 11.4.4, nhưng giờ có số của chính dự án thay vì trích dẫn
tài liệu. Nhánh từ khoá với `unaccent` là thứ bù lại khoảng đó.

### Lỗi thật bắt được nhờ kiểm thử bộ che PII

Bản đầu của `server/agents/pii.ts` dùng ranh giới phủ định cả chữ số lẫn dấu chấm/phẩy ở hai bên,
với ý định không cắn vào giữa một dãy số dài hơn. Nhưng điều kiện đó cũng từ chối luôn **dấu phẩy
và dấu chấm kết câu** — mà "sđt 0982123456, email..." là đúng cách người ta viết số điện thoại
trong câu.

Hệ quả: số điện thoại và số CCCD trong trường hợp phổ biến nhất **không hề được che** trước khi
gửi sang Gemini. Đây là vi phạm trực tiếp Mục 11.4.8 và sẽ ship im lặng nếu không kiểm thử.

Điều kiện đúng không phải "không có dấu chấm/phẩy liền kề" mà là "không nằm trong một dãy số dài
hơn": lookahead chỉ chặn khi **sau dấu phân cách còn có chữ số**. Giữ nguyên logic này khi sửa
file đó — chú thích đầy đủ đã nằm ngay trên khối `PATTERNS`.

### Lỗi thứ hai: Dialog Manager không tích luỹ được slot

Bản đầu của `server/agents/orchestrator.ts` có gọi NLU, có đọc `slots` từ phiên, nhưng **quên gộp
thực thể vừa trích xuất vào trạng thái phiên**. Hệ quả: mỗi lượt lại bắt đầu từ con số không.

Khách nói "lên lịch trình giúp mình" → bot hỏi "đi mấy ngày?" → khách trả lời "3 ngày" → NLU trích
xuất được `days: 3` nhưng nó rơi vào hư không, `missingSlots` lại thấy thiếu `days`, và bot hỏi
đúng câu đó lần nữa. Vòng lặp hỏi bổ sung ở Hình 10.4 bước 4–6 không bao giờ đóng được.

Đây đúng là lý do tồn tại của Dialog Manager theo SRS Mục 11.1 — "cho phép khách bổ sung/điều
chỉnh thông tin dần dần thay vì phải cung cấp đầy đủ ngay từ đầu" — nên thiếu nó thì cả tầng đó
chỉ là một file không ai gọi tới.

Phát hiện được nhờ `noUnusedLocals`: `mergeSlots` được import vào `routes/chat.ts` mà không dùng,
vì việc gộp lẽ ra phải nằm ở orchestrator. Cùng loại lỗi mà hai cờ đó đã bắt được `setBudget` bị
khoá cứng ở Vòng 2 và `onOpenPlanner` chết ở Vòng 1 — **giữ chúng bật**.

Bài học chung của cả hai lỗi trong vòng này: phần lớn code của vòng chưa chạy được (chưa có DB,
chưa có API key), nên những module **logic thuần** — chunker, bộ che PII — là chỗ duy nhất kiểm
thử thật được ngay. Đáng bỏ công viết kiểm thử cho chúng trước, vì đó cũng chính là chỗ lỗi im
lặng nhất: một regex sai không làm gì vỡ cả, nó chỉ lặng lẽ để dữ liệu cá nhân đi ra ngoài.

### Kho tri thức: prompt → database

Đóng `TODO` từng nằm ở `server/prompts.ts:9`. Khối dữ kiện Hà Giang (đèo, nguyên tắc lái đèo, ẩm
thực, bốn mùa) chuyển sang `scripts/knowledge-source.ts` và đi qua đường ống RAG như mọi tài liệu.
`CONCIERGE_SYSTEM_PROMPT` giờ chỉ còn vai và giọng điệu.

**Nguyên tắc khi sửa prompts.ts về sau: thêm giọng điệu và ràng buộc hành vi thì được, thêm DỮ
KIỆN thì không** — dữ kiện thuộc về `KnowledgeDoc`.

Ranh giới của SRS Mục 11.4 được giữ chặt: RAG chỉ phục vụ tri thức dạng văn bản. Toạ độ, độ cao,
khoảng cách, giá phòng, thời tiết đèo **không** vào kho tri thức mà lấy qua tool layer — nhét số
vào RAG là mở đường cho model đọc sai rồi nói sai.

### Đơn giá chi phí gom về một nguồn

`COST_ASSUMPTIONS` chuyển từ `PocketGuideSection.tsx` sang `server/costs.ts`, phục vụ cả tác tử dự
toán lẫn máy tính chi phí ở tab Cẩm nang qua `GET /api/content/cost-assumptions`. Toàn bộ phép
cộng do code thực hiện; model chỉ nhận bảng kết quả và diễn đạt lại. Hai bảng giá lệch nhau là
đúng loại lỗi Vòng 2 vừa dọn.

Tương tự, `server/itineraryCore.ts` tách ra để `/api/plan-itinerary` và tác tử lịch trình dùng
chung một lõi — hai đường vào, một nguồn sự thật.

### Escalation: ghi DB nhưng không hứa hẹn

Bản tóm tắt có cấu trúc theo Mục 10.6 bước 5–6 ghi vào `ChatEscalation`. **Chưa ai đọc được bảng
này** — chưa có vai trò CSKH, chưa có RBAC (FR-ACC-06), chưa có back-office (FR-ADM). Nên giao
diện tuyệt đối không nói "nhân viên sẽ liên hệ trong X phút", và tình huống khẩn hướng thẳng sang
113/115/114 như Footer đã làm ở Vòng 2. Cùng một nguyên tắc: đừng để giao diện hứa một thứ hệ
thống không thực hiện được.

### Hai cờ mặc định TẮT, và lý do

`RERANK_ENABLED` và `VI_SEGMENT_ENABLED` đều mặc định `false`. SRS Mục 11.4.4 nói rõ "mức cải
thiện phải được đo trực tiếp trên tập đánh giá của dự án trước khi bật mặc định" — bộ câu hỏi vàng
chưa thuộc phạm vi vòng này, nên bật sẵn là làm đúng cái điều SRS cảnh báo.

Riêng tách từ có một cái bẫy phải nhớ: nó **phải đối xứng** giữa ingest và truy vấn. Bật cờ mà
không chạy lại `npm run db:ingest` thì chỉ mục và truy vấn ở hai dạng văn bản khác nhau — không
lỗi, không cảnh báo, chỉ là không khớp được gì.

### Dịch vụ embedding

`embedding-service/` — FastAPI + sentence-transformers, BGE-M3, **chạy CPU**. Máy có RTX 5060
nhưng CPU đã đủ: kho tri thức vài trăm đoạn, một lần embed lúc truy vấn khoảng 50–150ms. Bật GPU
là tối ưu hoá sau khi đo, và cần torch bản cu128 trở lên vì RTX 5060 là Blackwell (sm_120).

Đặt sau interface `Embedder` với hai bản cài (`bge-m3` qua sidecar, `gemini` qua API), **cả hai ra
1024 chiều** nên đổi qua lại không phải migrate cột `vector(1024)` — nhưng phải chạy lại ingest,
vì hai model sinh ra hai không gian vector khác nhau.

Model nạp lazy: `/health` trả lời được ngay trong lúc model 2,2GB còn đang tải lần đầu. Nạp ở
import thì uvicorn treo im lặng vài phút và không có cách nào biết nó đang tải hay đã chết.

### `docker-compose.yml` đổi image

`postgres:16-alpine` → `pgvector/pgvector:pg16`. Đổi được **miễn phí đúng lúc này** vì volume vẫn
rỗng (DB chưa từng chạy). Sau khi có dữ liệu thì đổi ảnh là việc khác hẳn: phải dump, đổi, restore.
Ảnh pgvector chính thức dựa trên Debian, không có biến thể alpine.

### Đã kiểm chứng thật trong vòng này

| Kiểm tra | Kết quả |
|---|---|
| Sidecar `/embed` | 1024 chiều, L2 norm = 1.0 |
| `npm run lint` | 0 lỗi |
| `npx vite build` | thành công, bundle 341 kB |
| Drift schema ↔ migration | 53/53 object khớp, chỉ dư 2 index hybrid search viết tay |
| Chunker + PII (16 kiểm thử) | tất cả đạt, sau khi sửa lỗi ranh giới regex |

### Chưa chạy thật lần nào

`RebootPending` vẫn `True` và `GEMINI_API_KEY` vẫn rỗng, nên: migration mới, `CREATE EXTENSION
vector`, config tìm kiếm `vietnamese`, chỉ mục HNSW, `npm run db:ingest`, và toàn bộ luồng hội
thoại đều **chưa chạy lần nào**. Thứ tự sau khi khởi động lại máy:

```powershell
docker compose up -d db
npx prisma migrate deploy
npm run db:seed
venv\Scripts\python.exe -m uvicorn embedding-service.main:app --port 8000   # cửa sổ riêng
npm run db:ingest
npm run dev
```

### Việc tiếp theo

1. **Bộ đo lường** (SRS Mục 11.4.7) — vòng này đã ghi `ChatMessage.trace` đủ dữ liệu (intent,
   confidence, id đoạn đã truy xuất, độ trễ từng chặng, token). Thiếu bộ 100–200 câu hỏi vàng thì
   ngưỡng 0,5 của NLU, `RERANK_ENABLED` và `VI_SEGMENT_ENABLED` đều không có căn cứ để chỉnh.
2. **Chính sách thời hạn lưu trữ hội thoại và quyền yêu cầu xoá** — phiên khách vãng lai giờ nằm
   trong DB, nên đây là nghĩa vụ Nghị định 13/2023 đã phát sinh thật.
3. Xác minh tên model `gemini-2.5-flash-lite` với API ở lần chạy đầu.

---

## Quy trình review đa công cụ (2026-09-06)

Người dùng muốn mọi thay đổi đáng kể đi theo một luồng cố định: Claude nghiên cứu và lên kế
hoạch → ChatGPT duyệt kế hoạch → PASS thì mới code → Cursor soát code. Mục đích là để kế hoạch
bị một mô hình khác phản biện trước khi tốn công triển khai.

Quy trình đóng gói thành bốn skill trong `.claude/skills/` (`flow-plan`, `flow-review`,
`flow-build`, `flow-cursor`), mô tả ở `docs/dev-flow.md`, hồ sơ từng task ở
`docs/plans/<YYYYMMDD>-<slug>/`.

Hai script tự động hoá phần gửi–nhận:

- `npm run flow:review` — POST gói prompt sang OpenAI Responses API, ghi phản hồi vào `chatgpt.md`.
- `npm run flow:cursor` — chạy Cursor CLI (`agent -p`) ở chế độ headless, ghi kết quả vào `cursor.md`.

Bốn quyết định đáng nhớ:

- **Không thêm SDK.** Cả hai script gọi bằng `fetch`/`spawnSync` có sẵn của Node — cùng lý do đã
  ghi cho `MarkdownMessage`: một lần POST JSON không đáng đánh đổi thêm cây phụ thuộc.
- **Script không tự mở cổng.** Chúng chỉ lấy phản hồi về và in `VERDICT`; việc đối chiếu từng
  điểm chặn với code thật rồi quyết định PASS vẫn do skill làm. Tự động hoá phần cơ khí, không
  tự động hoá phần phán đoán.
- **Cursor chạy không có `--force`**, nên nó chỉ báo cáo chứ không sửa file. Prompt truyền qua
  dòng lệnh giữ nguyên ASCII tiếng Anh để không phụ thuộc bảng mã console Windows; nội dung
  tiếng Việt nằm trong `cursor.md` để Cursor tự đọc.
- **Không gọi `process.exit()` sau `fetch`.** Node 24 trên Windows văng
  `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` khi thoát cưỡng bức lúc socket
  keep-alive của undici còn mở — thông báo đó in đè lên lỗi thật vừa in. Dùng `process.exitCode`.

Chọn Cursor CLI headless thay vì Bugbot API vì Bugbot cần gói Enterprise và một pull request
thật trên GitHub/GitLab, trong khi repo này làm việc trên cây làm việc cục bộ.
