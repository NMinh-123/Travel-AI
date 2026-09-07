---
task: bao-mat-phien-chat
tieu-de: Tách quyền truy cập phiên chat khỏi sessionId — dùng secret riêng trong cookie httpOnly
status: cho-duyet
round: 5
ngay-tao: 2026-09-06
---

# Bảo mật phiên chat khách vãng lai

## Yêu cầu

Đóng lỗ hổng: **ai lấy được `sessionId` của một khách vãng lai đều đọc được toàn bộ transcript
kèm dữ liệu cá nhân chưa che**, chỉ bằng một lệnh `GET /api/chat/sessions/:id`.

Phát hiện ở vòng duyệt kế hoạch thứ hai của task
[`20260906-giai-doan-1-hoan-tat`](../20260906-giai-doan-1-hoan-tat/plan.md). Người dùng quyết
định tách thành task riêng, rồi sau vòng ba quyết định **làm task này trước** — nó thành điều
kiện tiên quyết của mảng E (quyền xoá hội thoại) trong kế hoạch Giai đoạn 1, vì endpoint
`DELETE` sắp thêm sẽ dùng lại đúng cơ chế quyền đang hỏng.

Ràng buộc phải giữ nguyên:

- **SRS Mục 7.2**: khách vãng lai phải trò chuyện được với chatbot **mà không cần tài khoản**.
  Mọi phương án buộc đăng nhập đều bị loại.
- **FR-BOT-07**: lịch sử hội thoại lưu theo người dùng và đồng bộ giữa các thiết bị khi đã đăng
  nhập. Không được làm hỏng phần này.
- **NFR-PERF-03**: chatbot phản hồi ≤ 3 giây cho 95% lượt. Cơ chế xác thực mới nằm trên đường
  chạy của **mọi** lượt chat nên không được tốn kể.
- **NFR-SEC-05 / NĐ 13/2023**: dữ liệu cá nhân trong hội thoại phải được bảo vệ.

## Thay đổi so với vòng 1

Vòng 1 bị **FAIL** với 2 điểm chặn; đối chiếu lại thì cả hai đều đúng:

| # | Điểm chặn | Xử lý ở vòng 2 |
|---|---|---|
| 1 | Kế hoạch kiểm chứng bằng `npm test` nhưng repo **chưa có** vitest, chưa có script `test`, chưa có harness DB test | Dựng hạ tầng test **trong task này** (bước 1–2 mới), gồm cả cô lập schema và cách tránh gọi Gemini thật. Task Giai đoạn 1 dùng lại thay vì tự dựng |
| 2 | `maxAge` của cookie nói là "khớp thời hạn lưu trữ hội thoại" — giá trị chưa ai quyết | **Chốt 30 ngày** làm giá trị tạm, kèm lý do; đồng bộ lại khi chính sách lưu trữ được duyệt |

Năm điểm NON-BLOCKER đều được nhận, trong đó **hai điểm sửa lập luận sai của vòng 1**:

- `rateLimit` hiện khoá theo `${req.ip}:${req.path}`, mà `req.path` của `GET /sessions/:id`
  chứa luôn id → **mỗi id một bucket**, kẻ đổi id né được giới hạn hoàn toàn. Bước 5 của vòng 1
  vì vậy không đạt mục tiêu chống dò. Đã kiểm chứng ở `server/rateLimit.ts:34`.
- Lý do "giữ `guestSecretHash` để tab khác chưa đăng nhập không mất phiên" **sai**: cookie dùng
  chung trong cùng trình duyệt nên không có chuyện tab này có tab kia không. Đổi thành **xoá
  hash khi gắn tài khoản** để tối thiểu hoá dữ liệu.

Người soát cũng đã rà toàn bộ mã nguồn và xác nhận **chỉ ba đường vào** dùng `loadSession()`:
`POST /api/chat`, `GET /api/chat/sessions/:id`, `POST /api/chat/feedback`. Không có endpoint nào
khác đọc `ChatSession`/`ChatMessage`.

## Thay đổi so với vòng 2

Vòng 2 bị **FAIL** với 2 điểm chặn; đối chiếu lại thì cả hai đều đúng và đều là thiếu sót thật:

| # | Điểm chặn | Xử lý ở vòng 3 |
|---|---|---|
| 1 | Kế hoạch nói "xoá hash khi khách đăng nhập giữa chừng", nhưng việc gắn `userId` **chỉ xảy ra ở `POST /api/chat`** (`server/routes/chat.ts:67`), không ở `/api/auth/login|register|google`. Đăng nhập rồi đăng xuất trước lượt chat kế tiếp để phiên ở trạng thái vãng lai với secret cũ — hành vi chưa được định nghĩa | **Chốt quy tắc tường minh**: việc gắn phiên **chỉ** xảy ra ở lượt chat kế tiếp, và hash bị xoá **đúng tại thời điểm gắn**, không sớm hơn. Bổ sung test cho luồng đăng nhập → đăng xuất → chưa chat |
| 2 | Hạ tầng test thiếu mắt xích gửi request HTTP qua router kèm cookie: `server.ts:22` khai `app` là const cục bộ, gọi `startServer()` ngay khi import (`:203`), không export gì | Tách `createApp()` ra file mới `server/app.ts`; `server.ts` dùng lại rồi mới thêm Vite/static và `listen`. Test import `createApp()` và gọi qua **supertest** (devDependency mới) để đặt được header `Cookie` |

Bốn điểm NON-BLOCKER cũng được nhận, xem các mục tương ứng bên dưới.

## Thay đổi so với vòng 3

Vòng 3 bị **FAIL** với 3 điểm chặn; cả ba đối chiếu lại đều đúng:

| # | Điểm chặn | Xử lý ở vòng 4 |
|---|---|---|
| 1 | Phiên tạo khi **đã đăng nhập** vẫn được phát guest secret, ghi đè cookie guest đang có | Chỉ phát và lưu secret khi `userId === null`. Bước 7 viết lại |
| 2 | **Race TOCTOU**: `loadSession()` kiểm quyền ở đầu request, ghi nằm trong transaction ở cuối | Thêm bước 8 mới: **tái kiểm quyền nguyên tử** bằng `updateMany` mang theo vị từ phân quyền, ngay trong transaction ghi |
| 3 | `createApp()` liệt kê thiếu ba endpoint inline và ràng buộc thứ tự error handler | Bước 2 viết lại, liệt kê **đầy đủ và đúng thứ tự**, kèm smoke test |

Ba điểm NON-BLOCKER cũng được nhận: `clearCookie` phải dùng cùng thuộc tính lúc phát (gom thành
hàm riêng); test phải phân biệt request bắt đầu **trước** và **sau** thời điểm gắn; xác nhận
`server.ts` nằm ở gốc repo.

## Thay đổi so với vòng 4

Vòng 4 bị **FAIL** với 2 điểm chặn; cả hai đúng, và cả hai là **hệ quả bậc hai của chính bản sửa
vòng 4** chứ không phải vấn đề của kế hoạch gốc:

| # | Điểm chặn | Xử lý ở vòng 5 |
|---|---|---|
| 1 | Vị từ "theo chế độ `loadSession()` đã dùng" mâu thuẫn với luồng gắn tài khoản: request đã đăng nhập nạp phiên vãng lai rồi gắn `userId` sẽ **tự chặn chính mình** vì vị từ guest luôn `count === 0` | Bước 8 viết lại theo **ba trường hợp**, trong đó trường hợp gắn tài khoản dùng **một lệnh `updateMany` làm cả hai việc**: vừa là hàng rào quyền, vừa là hành động gắn |
| 2 | `chatEscalation.create` (dòng 123) nằm **ngoài** `$transaction` (đóng ở dòng 120) nên thoát khỏi hàng rào | Chuyển `$transaction` sang **dạng callback** và đưa **mọi** lệnh ghi của lượt chat vào trong, gồm cả escalation |

Người soát **xác nhận** hướng `updateMany` mang vị từ quyền là nguyên tử ở Postgres và không cần
`SELECT ... FOR UPDATE`, miễn mọi lệnh ghi liên quan nằm sau nó trong cùng transaction. Mục
CÂU HỎI lần đầu trống.

## Hiện trạng

Ba quyết định thiết kế, mỗi cái riêng lẻ đều có lý do chính đáng, cộng lại thành lỗ hổng.

### 1. `sessionId` nằm ở `localStorage` và được gửi trong body

`src/hooks/useChatSession.tsx:30-34` lưu id, `:175-178` gửi kèm mỗi lượt:

```ts
const SESSION_KEY = 'travel_ai_chat_session';
// ...
const data = await apiRequest<ChatResponse>('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: query, sessionId: sessionId.current })
});
```

Chú thích gốc giải thích vì sao không dùng cookie: SRS Mục 7.2 cho khách vãng lai chat mà không
cần tài khoản, nên phải có cách nhận lại phiên khi chưa đăng nhập.

### 2. Phiên chưa gắn tài khoản thì ai giữ id cũng đọc được

`server/routes/chat.ts:38-46`:

```ts
async function loadSession(sessionId: string, userId: string | null) {
  const session = await prisma.chatSession.findUnique({ ... });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;   // chỉ chặn khi ĐÃ gắn user
  return session;
}
```

Nhánh `session.userId` rỗng không có kiểm tra nào. Tức `sessionId` đang đóng vai **bearer
token** chứ không phải định danh. Hàm này được dùng bởi cả `GET /sessions/:id`,
`POST /feedback`, và `POST /` (khi nhận lại phiên cũ).

### 3. `ChatMessage.content` lưu bản gốc chưa che PII

Chú thích trong `prisma/schema.prisma` ghi rõ, và đó là quyết định đúng: việc che
(`server/agents/pii.ts`) chỉ áp ở biên gửi ra API ngoài theo SRS Mục 11.4.8, còn transcript nội
bộ phải giữ nguyên văn để phục vụ hỗ trợ khách. Hệ quả là transcript chứa họ tên, số điện thoại,
số giấy tờ, mã đặt chỗ ở dạng rõ.

### Hệ quả

Ai lấy được `sessionId` — qua XSS ở bất kỳ đâu trên trang, qua máy dùng chung, qua log, qua ảnh
chụp màn hình devtools — đọc được toàn bộ transcript kèm PII. Và `sessionId` là `cuid()` nằm
trong `localStorage`, tức **mọi script chạy trên trang đều đọc được**.

Chưa có dữ liệu nào bị phơi vì DB chưa từng chạy. Nhưng phải đóng trước khi hệ thống nhận khách
thật.

### Những gì đã có sẵn để dùng lại

`server/auth.ts` đã có đúng khuôn mẫu cookie cần thiết:

```ts
res.cookie(SESSION_COOKIE, token, {
  httpOnly: true,
  sameSite: "lax",
  secure: config.isProduction,
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
});
```

`src/lib/api.ts:21` đã đặt `credentials: 'same-origin'`, và server phục vụ cả API lẫn frontend
từ cùng một origin — nên cookie tự đi kèm mọi request, **không phải sửa gì ở tầng gọi API**.

`server/rateLimit.ts` đã có `rateLimit({ windowMs, max, message })` dùng được ngay.

## Phương án chọn

**Tách định danh khỏi quyền truy cập.** `sessionId` hạ xuống chỉ còn là định danh; quyền đọc/ghi
một phiên vãng lai do một **secret riêng nằm trong cookie `httpOnly`** quyết định.

### Luồng

1. Khi `POST /api/chat` tạo phiên mới: sinh secret ngẫu nhiên 32 byte, trả về client **chỉ
   trong cookie** `travel_ai_chat` (tên khác cookie đăng nhập `travel_ai_session`), lưu **hash**
   của nó vào `ChatSession.guestSecretHash`.
2. Mọi thao tác trên phiên **chưa gắn tài khoản** đều yêu cầu secret trong cookie khớp hash.
3. Phiên **đã gắn tài khoản** giữ nguyên cơ chế hiện tại: bắt buộc đúng `userId` từ cookie đăng
   nhập. Không cần secret — người đã đăng nhập là chủ sở hữu thật.
4. `sessionId` vẫn ở `localStorage` và vẫn gửi trong body như hiện nay. Giữ nguyên vì nó **không
   còn đủ quyền**, và đổi chỗ lưu của nó là một thay đổi client lớn không mua thêm được gì.

### Phương án này KHÔNG chống được gì

Nói rõ để không ai hiểu nhầm phạm vi: cookie `httpOnly` chặn việc **đọc trộm credential** bằng
script, nhưng **không chặn XSS**. Mã độc chạy cùng origin vẫn gọi được `GET /api/chat/sessions/:id`
và cookie tự đính kèm, rồi đọc response. Chống XSS là lớp riêng — CSP, kiểm soát script bên thứ
ba, và nguyên tắc "không `dangerouslySetInnerHTML`" đã áp ở `src/components/MarkdownMessage.tsx`.

Cái task này đóng là **lỗ hổng chỉ cần lộ ID**: id nằm trong `localStorage`, đi qua body request,
có thể lọt vào log hay ảnh chụp màn hình — và trước khi sửa thì chỉ cần ngần đó là đọc được
transcript.

### Bảng quyền sau khi sửa

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không tồn tại, hoặc không thoả điều kiện trên | 404 — **không phân biệt hai trường hợp**, để không biến endpoint thành công cụ dò id nào có thật |

### Hàm băm: SHA-256, **không** phải bcrypt

Đây là quyết định dễ làm sai nhất trong task này. `server/auth.ts` dùng bcrypt cost 12 cho mật
khẩu, và phản xạ tự nhiên là dùng lại. **Không được.**

- bcrypt cost 12 tốn khoảng **200–300 ms mỗi lần** (chú thích ngay trong `server/auth.ts`).
  Kiểm tra secret nằm trên đường chạy của **mọi lượt chat và mọi lần khôi phục lịch sử**, nên nó
  ăn thẳng vào ngân sách 3 giây của NFR-PERF-03, và biến chính endpoint chat thành cửa ngõ tấn
  công từ chối dịch vụ.
- Lý do bcrypt tồn tại là để chống dò **mật khẩu do người đặt** — thứ có entropy thấp và nằm
  trong từ điển. Secret ở đây là **32 byte ngẫu nhiên từ `crypto.randomBytes`**, không gian
  khoá 2^256; không có tấn công từ điển nào áp dụng được, nên làm chậm phép băm không mua được
  gì cả.

SHA-256 là lựa chọn đúng cho token ngẫu nhiên entropy cao. So sánh phải dùng
`crypto.timingSafeEqual` để không rò rỉ thông tin qua thời gian so sánh.

**Hai chi tiết bắt buộc khi hiện thực** (bổ sung sau vòng 1):

- **Chốt một encoding duy nhất**: secret ở dạng `base64url`, hash ở dạng `hex` viết thường.
  Trộn encoding là cách tạo ra một lỗi so sánh im lặng.
- **Chặn đầu vào sai định dạng TRƯỚC khi gọi `timingSafeEqual`**: hàm này **ném lỗi** khi hai
  buffer khác độ dài. Cookie do người dùng gửi lên nên hoàn toàn có thể sai định dạng hoặc rỗng.
  Kiểm độ dài và ký tự hợp lệ trước, sai thì trả 404 như mọi trường hợp không thoả quyền — không
  để một cookie rác làm văng 500.

### Thời hạn cookie: 30 ngày

Vòng 1 viết `maxAge` "khớp thời hạn lưu trữ hội thoại", nhưng thời hạn đó là một trong những
đầu vào **người dùng chưa quyết** ở task Giai đoạn 1. Không thể triển khai một thuộc tính bảo
mật theo một giá trị chưa tồn tại, nên chốt một giá trị tạm kèm lý do:

- **30 ngày.** Đủ dài để khách quay lại trong vòng một tháng vẫn thấy hội thoại cũ; đủ ngắn để
  một cookie bị bỏ quên trên máy dùng chung không sống vô hạn.
- **Cookie sống lâu hơn dữ liệu là vô hại.** Nếu chính sách lưu trữ sau này ngắn hơn 30 ngày,
  bản ghi phiên bị xoá trước và cookie chỉ còn trỏ vào một phiên không tồn tại → 404, client tự
  mở phiên mới. Nên **không cần** ràng buộc `maxAge` ≤ thời hạn lưu trữ.
- **Chiều ngược lại mới cần chú ý:** nếu chính sách lưu trữ dài hơn nhiều (ví dụ 24 tháng theo
  NĐ 53/2022), cookie 30 ngày nghĩa là khách vãng lai mất quyền truy cập vào hội thoại vẫn còn
  trong DB. Đó là hành vi **đúng** với một phiên vãng lai, không phải lỗi — nhưng phải ghi vào
  tài liệu chính sách dữ liệu để không ai coi là mất dữ liệu.

Hệ quả về trải nghiệm phải xử lý: cookie hết hạn, hoặc phiên đã bị xoá, đều dẫn tới 404 khi
khôi phục. Client **đã** xử lý đúng đường này — `src/hooks/useChatSession.tsx` bắt riêng 404 để
bỏ id và mở phiên mới, còn mọi lỗi khác thì giữ id. Bước kiểm chứng số 4 kiểm lại sau khi sửa.

Khi chính sách lưu trữ được duyệt thì quay lại đối chiếu con số này một lần, không tự động
đồng bộ.

### Thay đổi lược đồ

```prisma
model ChatSession {
  // ...
  /// Băm SHA-256 của secret phiên khách vãng lai. Null với phiên tạo trước khi có cơ chế này,
  /// và với phiên chỉ truy cập qua tài khoản. KHÔNG lưu bản rõ.
  guestSecretHash String?
}
```

Không đặt `@unique`: hash của giá trị ngẫu nhiên 32 byte thì trùng nhau là chuyện không xảy ra,
còn chỉ mục unique lại tạo thêm một đường dò.

### Phiên tạo trước khi có cơ chế này

`guestSecretHash` null nghĩa là phiên vãng lai đó **không ai truy cập được nữa** — quy tắc chặt,
không có giai đoạn quá độ. Chấp nhận được vì **DB chưa từng chạy**, nên hiện không có phiên nào
tồn tại. Nếu vì lý do nào đó task này bị hoãn tới sau khi có dữ liệu thật thì phải quay lại
quyết định lại điểm này, không được cứ thế triển khai.

## Phương án đã loại

| Phương án | Lý do loại |
|---|---|
| Che PII ngay khi lưu `ChatMessage.content` | Lật ngược một quyết định thiết kế có lý do đã ghi trong `prisma/schema.prisma` (giữ nguyên văn để hỗ trợ khách), và không đóng được lỗ hổng: kẻ có id vẫn đọc được toàn bộ nội dung hội thoại, chỉ là thiếu vài trường. Người dùng đã cân nhắc và không chọn hướng này. |
| Bắt khách vãng lai đăng nhập mới được lưu lịch sử | Vi phạm trực tiếp SRS Mục 7.2 |
| Ký `sessionId` bằng JWT như `server/auth.ts` | JWT chứng minh "id này do server phát", nhưng token vẫn phải nằm đâu đó ở client và ai lấy được token vẫn dùng được — đúng vấn đề đang có. Thứ giải quyết là **cookie httpOnly**, không phải định dạng token. Dùng cookie httpOnly thì secret trần đã đủ, thêm JWT chỉ thêm một lớp. |
| Chuyển hẳn `sessionId` vào cookie, bỏ `localStorage` | Sạch hơn về khái niệm nhưng phải sửa cả luồng tạo/khôi phục phiên ở client, trong khi vấn đề an toàn đã được đóng bởi secret. Ghi lại làm việc dọn dẹp tuỳ chọn, không gộp vào task an toàn. |
| bcrypt cho secret | Lý do đã nêu ở trên: 200–300 ms trên mọi lượt chat, không mua được gì vì secret có entropy cao |
| Gắn secret vào IP hoặc User-Agent | Khách đổi mạng (rất thường gặp trên di động) là mất phiên; đổi lại chỉ được một lớp mỏng manh vì cả hai đều giả mạo được |

## Các bước thực hiện

Hai bước đầu là hạ tầng test. Vòng 1 giả định vitest đã có — **sai**: repo không có script
`test`, không có vitest, không có harness DB. Task Giai đoạn 1 định dựng ở mảng C, nhưng task
này chạy trước nên phải dựng ở đây; task kia dùng lại.

1. **Dựng vitest + supertest** — `package.json` (script `test`, hai devDependency),
   `vitest.config.ts` (mới). Supertest là thứ cho phép đặt header `Cookie` và đọc `Set-Cookie`,
   tức điều kiện cần để kiểm được toàn bộ bảng quyền.
2. **Tách `createApp()`** — file mới `server/app.ts`. Cần bước này vì `server.ts:22` khai `app`
   là const cục bộ và `server.ts:203` gọi `startServer()` ngay khi import — test không import
   được gì cả.

   `createApp()` phải chứa **toàn bộ** middleware và **mọi** route `/api`, theo **đúng thứ tự
   hiện tại**. Liệt kê đầy đủ vì vòng 3 chỉ nói "gom các router" và làm rơi ba endpoint khai
   inline:

   1. `express.json({ limit: "5mb" })`
   2. `cookieParser()`
   3. `GET /api/health`
   4. `GET /api/config`
   5. `app.use("/api/auth" | "/api/me" | "/api/content" | "/api/chat", ...)` — bốn router
   6. `POST /api/plan-itinerary`
   7. `app.use("/api", errorHandler)` — **phải đứng sau cùng**; mount trước thì lỗi từ các
      router lọt qua và Express trả trang HTML thay vì JSON (lý do đã ghi trong `server.ts`)

   `server.ts` chỉ còn: gọi `createApp()`, thêm Vite middleware ở dev hoặc `express.static` +
   fallback `index.html` ở production, rồi `listen`. Refactor thuần, không đổi hành vi.

   Smoke test kèm theo: `GET /api/health` trả 200, `GET /api/config` trả 200, và một request
   `/api` với JSON hỏng trả **400 dạng JSON** (không phải HTML) — ca cuối chính là thứ chứng minh
   error handler còn đứng đúng chỗ.
3. **Harness DB test** — file setup dùng `DATABASE_URL` có `?schema=test`, chạy
   `prisma migrate deploy` lên schema đó, truncate giữa các ca, gọi `resetRateLimit()`, và **tự
   từ chối chạy nếu schema trỏ vào `public`**. Với các ca đụng `POST /api/chat`, **mock module
   `server/agents/orchestrator`**: bài test kiểm phân quyền chứ không kiểm chất lượng trả lời,
   nên một `handleTurn` giả trả hằng số là đủ và làm test chạy được khi không có
   `GEMINI_API_KEY`.
4. **Lược đồ + migration** — `prisma/schema.prisma`: thêm `guestSecretHash String?` vào
   `ChatSession`. Sinh migration bằng `prisma migrate dev` khi DB chạy; nếu chưa có DB thì sinh
   offline bằng `prisma migrate diff` và đối chiếu lại như `history.md` Vòng 4 đã làm.
5. **Module secret phiên** — file mới `server/chatSession.ts`, gồm cả `clearGuestSecret(res)`.
   Hàm xoá **phải truyền đúng `path`, `sameSite`, `secure`** như lúc phát, nếu không trình duyệt
   không xoá cookie — đó là lý do gom cả hai vào một module thay vì gọi `res.clearCookie` rải
   rác. `issueGuestSecret(res)` sinh 32
   byte ngẫu nhiên, đặt cookie, trả hash; `readGuestSecret(req)` đọc cookie;
   `matchesGuestSecret(secret, hash)` so sánh bằng `crypto.timingSafeEqual`. Cookie đặt cùng
   thuộc tính với `server/auth.ts` (`httpOnly`, `sameSite: "lax"`, `secure` khi production,
   `path: "/"`), tên `travel_ai_chat`, **`maxAge` 30 ngày** — xem lý do ở mục dưới.
6. **Sửa `loadSession()`** — `server/routes/chat.ts`: nhận thêm secret từ cookie; áp đúng bảng
   quyền ở trên; mọi trường hợp không thoả trả **404 giống nhau**.
7. **Phát secret khi tạo phiên, và quy tắc chuyển trạng thái** — `server/routes/chat.ts` trong
   `POST /`: sau khi `prisma.chatSession.create`, gọi `issueGuestSecret(res)` và lưu hash.

   Quy tắc chuyển từ vãng lai sang có chủ, chốt tường minh vì vòng 2 để nó mơ hồ:

   - **Chỉ phiên vãng lai mới có secret.** `server/routes/chat.ts:62` tạo phiên bằng
     `create({ data: { userId } })`, và `userId` ở đó **có thể khác null** khi khách đã đăng
     nhập. Vòng 3 nói "mọi phiên mới đều phát secret" là sai: phiên đã có chủ sẽ nhận một cookie
     và một hash vô nghĩa, tệ hơn là **ghi đè cookie guest đang có của trình duyệt**, làm khách
     mất quyền vào phiên vãng lai cũ. Điều kiện đúng: chỉ gọi `issueGuestSecret()` và lưu hash
     khi `userId === null`.
   - Việc gắn `userId` vào phiên có sẵn **chỉ xảy ra ở `POST /api/chat`** — đó là hành vi hiện
     có (`server/routes/chat.ts:67`); các route `/api/auth/*` không đụng tới `ChatSession`. Vòng
     này **không đổi** điều đó.
   - `guestSecretHash` bị xoá về null **đúng tại thời điểm gắn**, trong cùng lệnh `update`, kèm
     xoá cookie. Không xoá sớm hơn ở luồng đăng nhập.
   - **Hệ quả có chủ ý:** khách đăng nhập rồi đăng xuất mà chưa gửi lượt chat nào thì phiên
     **vẫn là vãng lai** và secret cũ vẫn dùng được. Đây là giữ nguyên hành vi hiện tại, và an
     toàn: trước thời điểm gắn, phiên đó vốn thuộc về người đang giữ trình duyệt. Ghi vào
     `history.md` để không ai coi là lỗi.
8. **Tái kiểm quyền nguyên tử, và gộp toàn bộ lệnh ghi vào một transaction** — phần khó nhất
   của task, đã qua hai vòng phản biện.

   **Vấn đề gốc.** `loadSession()` kiểm quyền ở **đầu** request, còn ghi nằm ở **cuối**, giữa hai
   thời điểm là một lượt gọi model kéo dài hàng giây. Request khác trong khoảng đó có thể gắn
   `userId` và thu hồi secret — request cũ vẫn ghi và vẫn trả kết quả.

   **Vấn đề thứ hai** (vòng 4 phát hiện): `chatEscalation.create` (`server/routes/chat.ts:123`)
   nằm **ngoài** `$transaction` (đóng ở dòng 120), nên dù có hàng rào thì nó vẫn thoát ra.

   **Cách làm.** Đổi `$transaction` từ dạng mảng sang **dạng callback**
   `prisma.$transaction(async (tx) => { ... })` — bắt buộc, vì cần kiểm `count` giữa chừng rồi
   mới quyết có chạy tiếp không, điều mà dạng mảng không làm được.

   Lệnh **đầu tiên** trong callback là một `updateMany` mang vị từ phân quyền. Ba trường hợp,
   phân theo trạng thái phiên và trạng thái đăng nhập của request:

   | | Vị từ `where` | `data` kèm theo |
   |---|---|---|
   | **A. Phiên đã có chủ** | `{ id, userId: <userId đã xác thực> }` | cập nhật `slots`, `escalated` |
   | **B. Phiên vãng lai, request chưa đăng nhập** | `{ id, userId: null, guestSecretHash: <hash từ cookie> }` | cập nhật `slots`, `escalated` |
   | **C. Phiên vãng lai, request đã đăng nhập** — đây là lúc **gắn tài khoản** | `{ id, userId: null, guestSecretHash: <hash từ cookie> }` | `userId`, **`guestSecretHash: null`**, cùng `slots`, `escalated` |

   Trường hợp C là chỗ vòng 4 sai. Ở đây **một lệnh `updateMany` làm cả hai việc**: vị từ guest
   vừa là hàng rào quyền, vừa bảo đảm chỉ đúng một request gắn được tài khoản. Sau khi nó thành
   công, ngữ cảnh quyền của request **chuyển sang chế độ owner**; các lệnh ghi còn lại trong cùng
   transaction không phải kiểm lại, vì đã nằm sau hàng rào.

   `count === 0` ở bất kỳ trường hợp nào → **ném lỗi để transaction cuộn lại**, route trả 404 như
   mọi trường hợp không thoả quyền.

   **Mọi lệnh ghi của lượt chat nằm sau nó, trong cùng callback**: hai `chatMessage.create`, và
   `chatEscalation.create` khi có escalation. Không còn lệnh ghi nào của lượt chat nằm ngoài.

   **Xoá cookie chỉ sau khi transaction commit thành công** (trường hợp C). Xoá trước mà
   transaction cuộn lại thì khách mất quyền vào một phiên vẫn còn là vãng lai.

   **Giới hạn phải nói rõ:** lượt gọi model **đã xảy ra** và không thu hồi được — ta chỉ bảo đảm
   **không ghi và không trả dữ liệu**. Chi phí một lượt gọi bị bỏ là cái giá chấp nhận được cho
   tình huống hiếm.

   Áp cùng cách cho `POST /feedback` (`server/routes/chat.ts:182`), vốn cũng theo mẫu "đọc rồi
   ghi".

   **Về `GET /sessions/:id`:** quyền được kiểm trước khi dựng response, và đó là ngữ nghĩa đọc
   thông thường — chấp nhận được. Ghi rõ trong chú thích để không ai diễn giải "thu hồi secret"
   là huỷ được một response đã bắt đầu gửi; muốn thế thì phải có cơ chế phiên bản hoặc huỷ giữa
   chừng, không tương xứng với rủi ro ở đây.

9. **Giới hạn tần suất — và sửa cách khoá bucket** — `server/rateLimit.ts:34` hiện khoá theo
   `` `${req.ip}:${req.path}` ``. Với `GET /sessions/:id` thì `req.path` chứa luôn id, nên **mỗi
   id là một bucket riêng** và kẻ đổi id né được giới hạn hoàn toàn. Thêm tuỳ chọn `scope?: string`
   vào `rateLimit`: có `scope` thì khoá theo `` `${req.ip}:${scope}` `` thay vì theo `req.path`.
   Áp cho `GET /sessions/:id` với một `scope` cố định. Các chỗ dùng hiện có không truyền `scope`
   nên hành vi giữ nguyên.

   Kèm một quy ước ghi vào chú thích của `rateLimit`: **route nào có tham số đường dẫn thì bắt
   buộc truyền `scope`**. Mặc định theo `req.path` chỉ đúng với route tĩnh, và đây đúng là cái
   bẫy vừa mắc phải.

   Thêm `resetRateLimit()` chỉ dùng cho test, để các ca không phụ thuộc thứ tự chạy vì dùng
   chung một `Map` bộ đếm ở cấp module.
10. **Không ghi `sessionId` và secret ra log** — rà `server/` xem có chỗ nào log chúng không, và
   ghi quy ước này vào chú thích của `server/chatSession.ts`.
11. **Test** — `server/routes/chat.test.ts` (cần DB, schema `?schema=test`): phiên vãng lai có
   secret đúng thì đọc được; **không có cookie thì 404**; **cookie sai thì 404**; **cookie sai
   định dạng (rỗng, độ dài lệch) thì 404 chứ không phải 500**; phiên đã gắn tài khoản thì chủ
   đọc được, người khác 404, và khách vãng lai giữ secret cũ cũng 404; hai phiên khác nhau không
   dùng chéo secret được; áp cho **cả ba endpoint** `POST /`, `GET /sessions/:id`,
   `POST /feedback`. Thêm hai ca mà vòng 2 chỉ ra:

   - **Đăng nhập → đăng xuất → chưa gửi lượt chat nào**: phiên vẫn là vãng lai, secret cũ vẫn
     dùng được (hành vi có chủ ý ở bước 7).
   - **`POST /` với `sessionId` không có quyền**: endpoint **tạo phiên mới** chứ không trả 404.
     An toàn, nhưng khác câu "không thoả quyền → 404" nên phải có test ghim lại, để người sau
     không "sửa cho nhất quán" thành 404 — trả 404 ở đây sẽ biến `POST` thành công cụ dò id.

   Ba ca của vòng 4:

   - **Tạo phiên khi đã đăng nhập**: `guestSecretHash` phải null, và cookie guest đang có
     **không bị đổi**.
   - **Race** (điểm chặn vòng 3): bắt đầu một request vãng lai, giữ nó lại ở bước gọi model bằng
     `handleTurn` giả có thể điều khiển thời điểm trả về; trong lúc đó chạy xong một request thứ
     hai gắn `userId` cho phiên; rồi thả request thứ nhất → phải trả **404**, **không message
     nào được ghi**, và **không bản ghi `ChatEscalation` nào được tạo**. Ca tuần tự không bắt
     được lỗi này, nên phải là ca có điều phối thời điểm.
   - **Gắn tài khoản đồng thời** (trường hợp C, điểm chặn vòng 4): hai request cùng mang guest
     secret hợp lệ, cùng đã đăng nhập, chạy song song → **đúng một** request gắn được `userId`,
     request kia trả 404. Kiểm `guestSecretHash` đã về null và cookie đã bị xoá.
   - **Escalation nằm trong hàng rào**: dựng một lượt có escalation, thu hồi quyền giữa chừng →
     không có bản ghi `ChatEscalation` nào sót lại.
   - **Smoke test `createApp()`**: `/api/health` 200, `/api/config` 200, JSON hỏng trả 400 dạng
     JSON.
12. **Cập nhật `history.md`** — ghi lý do chọn SHA-256 thay bcrypt, vì đây đúng là chỗ người sau
   sẽ "sửa cho nhất quán" nếu không có ghi chú.

## Rủi ro

- **Dùng bcrypt vì thấy `server/auth.ts` dùng bcrypt.** → Lý do đã ghi trong kế hoạch và sẽ ghi
  cả trong chú thích của `server/chatSession.ts` lẫn `history.md`. Nếu thấy độ trễ lượt chat
  tăng vài trăm ms sau khi triển khai thì đây là chỗ nhìn đầu tiên.
- **Trình duyệt chặn cookie** (chế độ riêng tư, thiết lập chặn bên thứ ba). → Cookie này là
  first-party nên phần lớn thiết lập không chặn. Trường hợp bị chặn thì khách vẫn chat được,
  chỉ không khôi phục được phiên sau khi tải lại trang — **đúng bằng mức suy giảm mà
  `localStorage` bị chặn đang gây ra hôm nay**, không phải hồi quy mới.
- **Một trình duyệt chỉ giữ một secret phiên vãng lai.** Mở phiên mới thì cookie bị ghi đè và
  phiên cũ không truy cập lại được. → Đúng bằng hành vi hiện tại của `localStorage`, không phải
  thay đổi. Ghi vào `history.md` để không ai tưởng là lỗi.
- **`sameSite: "lax"` và widget nhúng.** Nếu sau này nhúng widget chat lên tên miền khác
  (FR-BOT-10 giai đoạn sau), `lax` sẽ chặn cookie. → Ngoài phạm vi hiện tại vì widget đang chạy
  cùng origin; ghi thành điều kiện phải xem lại khi làm đa kênh.
- **Test cần DB thật có thể xoá nhầm dữ liệu dev.** → Bắt buộc `?schema=test`; script tự từ chối
  chạy nếu schema trỏ vào `public`.
- **Quên áp quyền mới cho một endpoint.** `loadSession()` hiện được ba chỗ dùng (`POST /`,
  `GET /sessions/:id`, `POST /feedback`), và mảng E của Giai đoạn 1 sắp thêm `DELETE`. → Đặt
  toàn bộ logic quyền **bên trong** `loadSession()` thay vì rải ở từng route, để endpoint mới tự
  kế thừa. Test ở bước 7 kiểm cả ba endpoint hiện có.

## Cách kiểm chứng

```bash
npm run lint          # tsc --noEmit
npm test              # vitest — dựng ở bước 1-2 của chính task này
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
                      # đối chiếu migration khớp schema
```

Kiểm chứng tay, sau khi `npm run dev`:

1. Mở trang, chat một câu → phản hồi bình thường, DevTools → Application → Cookies thấy
   `travel_ai_chat`, và cookie đó **không đọc được bằng `document.cookie`** (httpOnly).
2. F5 → lịch sử được nạp lại.
3. Copy `sessionId` từ `localStorage`, mở **cửa sổ ẩn danh**, gọi
   `GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả về toàn bộ
   transcript — đây là kiểm chứng trung tâm của cả task.
4. Xoá cookie `travel_ai_chat` nhưng giữ `localStorage` → khôi phục phiên phải trả 404, và client
   bắt đầu phiên mới thay vì kẹt ở lỗi.
5. Đăng nhập, chat, rồi thử đọc phiên đó từ một tài khoản khác → 404.
6. Đo độ trễ một lượt chat trước và sau khi sửa → chênh lệch phải ở mức không đáng kể (SHA-256
   tính bằng micro giây). Nếu thấy tăng hàng trăm ms thì đã lỡ dùng bcrypt.

## Ngoài phạm vi

- **Chuyển `sessionId` khỏi `localStorage` vào cookie** — dọn dẹp tuỳ chọn, không cần cho an
  toàn sau khi đã có secret.
- **Che PII khi lưu transcript** — người dùng đã cân nhắc và không chọn.
- **Đồng bộ lịch sử đa thiết bị cho người đã đăng nhập.** Hôm nay client tìm phiên bằng
  `localStorage`, nên máy mới là bắt đầu phiên mới dù đã đăng nhập — FR-BOT-07 chưa đạt trọn vẹn.
  Đây là khoảng trống **có sẵn**, không do task này tạo ra; cần một endpoint kiểu "phiên gần nhất
  của tôi". Ghi lại để không bị quên.
- **Quyền xoá hội thoại (`DELETE`), job dọn, chính sách lưu trữ** — thuộc mảng E của
  [`20260906-giai-doan-1-hoan-tat`](../20260906-giai-doan-1-hoan-tat/plan.md), làm sau task này.
- **`sameSite` cho widget đa kênh** — khi làm FR-BOT-10.

## Lịch sử vòng lặp

- 2026-09-06 — tạo hồ sơ từ điểm chặn số 3 của vòng duyệt thứ hai, task
  `20260906-giai-doan-1-hoan-tat` (mới chỉ ghi lại phát hiện, chưa lập kế hoạch).
- Vòng 1: 2026-09-06 — lập kế hoạch đầy đủ sau khi người dùng quyết **làm task này trước** và
  coi nó là điều kiện tiên quyết của mảng E. Gửi ChatGPT duyệt.
- Vòng 1: 2026-09-06 — gửi ChatGPT. **FAIL**, 2 điểm chặn, cả hai đều Đúng: (1) kế hoạch kiểm
  chứng bằng `npm test` nhưng repo chưa có vitest lẫn harness DB test; (2) `maxAge` của cookie
  neo vào một thời hạn lưu trữ chưa ai quyết. Năm điểm NON-BLOCKER được nhận, trong đó hai điểm
  sửa lập luận sai của kế hoạch: cách khoá bucket của `rateLimit` và lý do giữ `guestSecretHash`.
- Vòng 2: 2026-09-06 — lập lại kế hoạch: dựng hạ tầng test trong chính task này, chốt cookie 30
  ngày kèm lý do, sửa cách khoá `rateLimit`, đổi sang xoá `guestSecretHash` khi gắn tài khoản,
  chốt encoding và chặn đầu vào sai định dạng trước `timingSafeEqual`, và nói rõ phương án này
  không phải biện pháp chống XSS.
- Vòng 2: 2026-09-06 — gửi ChatGPT. **FAIL**, 2 điểm chặn, cả hai Đúng: (1) quy tắc xoá
  `guestSecretHash` mơ hồ vì việc gắn `userId` chỉ xảy ra ở `POST /api/chat`, không ở luồng
  đăng nhập; (2) hạ tầng test thiếu mắt xích gửi request HTTP kèm cookie vì `server.ts` không
  export `app`. Bốn NON-BLOCKER đều nhận.
- Vòng 3: 2026-09-06 — lập lại: chốt quy tắc chuyển trạng thái tường minh kèm hệ quả có chủ ý,
  tách `createApp()` sang `server/app.ts` và thêm supertest, yêu cầu `scope` tường minh cho
  route có tham số, thêm `resetRateLimit()` cho test, và ghim hành vi `POST /` tạo phiên mới khi
  `sessionId` không có quyền.

- Vòng 3: 2026-09-06 — gửi ChatGPT. **FAIL**, 3 điểm chặn, cả ba Đúng: (1) phiên tạo khi đã
  đăng nhập vẫn được phát guest secret và ghi đè cookie guest đang có; (2) **race TOCTOU** —
  `loadSession()` kiểm quyền ở đầu request còn ghi nằm trong transaction ở cuối, nên request cũ
  vẫn chạy tiếp sau khi secret đã bị thu hồi; (3) `createApp()` liệt kê thiếu `/api/health`,
  `/api/config`, `/api/plan-itinerary` và ràng buộc thứ tự error handler.
  **Vòng FAIL thứ ba** → dừng theo quy tắc chống lặp, báo người dùng trước khi lập vòng 4.
  Cả ba đều cụ thể và sửa được, không điểm nào cần người dùng quyết.
- Vòng 4: 2026-09-06 — lập lại: chỉ phát guest secret khi `userId === null`; thêm bước tái kiểm
  quyền nguyên tử bằng `updateMany` mang vị từ phân quyền làm lệnh đầu của transaction (đóng
  race TOCTOU); liệt kê đầy đủ và đúng thứ tự mọi route trong `createApp()` kèm smoke test;
  thêm `clearGuestSecret()` dùng đúng thuộc tính cookie lúc phát; thêm ca test có điều phối thời
  điểm cho race.

- Vòng 4: 2026-09-06 — gửi ChatGPT. **FAIL**, 2 điểm chặn, cả hai Đúng và cả hai là hệ quả bậc
  hai của chính bản sửa vòng 4: (1) vị từ "theo chế độ `loadSession()` đã dùng" mâu thuẫn với
  luồng gắn tài khoản — request đã đăng nhập nạp phiên vãng lai rồi gắn `userId` sẽ tự chặn
  chính mình vì vị từ guest luôn `count === 0`; (2) `chatEscalation.create` (dòng 123) nằm
  **ngoài** `$transaction` (đóng ở dòng 120) nên thoát khỏi hàng rào quyền nguyên tử.
  Người soát **xác nhận** hướng `updateMany` mang vị từ quyền là đúng và đủ nguyên tử; mục
  CÂU HỎI lần đầu trống. Cách sửa cho vòng 5 đã ghi trong `chatgpt.md`.
- Vòng 5: 2026-09-06 — lập lại: bước 8 viết lại theo ba trường hợp A/B/C, trong đó trường hợp
  gắn tài khoản dùng một `updateMany` vừa làm hàng rào quyền vừa làm hành động gắn (đóng mâu
  thuẫn vòng 4); chuyển `$transaction` sang dạng callback và đưa mọi lệnh ghi của lượt chat vào
  trong, gồm cả `chatEscalation.create`; xoá cookie chỉ sau khi commit; ghi rõ ngữ nghĩa đọc của
  `GET /sessions/:id`; thêm hai ca test cho gắn tài khoản đồng thời và cho escalation.

