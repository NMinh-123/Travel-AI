# Hồ sơ duyệt kế hoạch — Bảo mật phiên chat

Kế hoạch: [plan.md](plan.md). Quy trình: [../../dev-flow.md](../../dev-flow.md).

---

## Vòng 1 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật**, chưa phải code. Hãy phản biện thẳng thắn; việc của bạn là
chặn kế hoạch sai trước khi nó tốn công triển khai.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-bao-mat-phien-chat/plan.md`. Hãy
đọc trực tiếp và đối chiếu với code thật.

### Bối cảnh

Travel AI Hà Giang — React + Vite (TypeScript) ở `src/`, Express ở `server.ts` và `server/`,
Postgres qua Prisma ở `prisma/`. Sản phẩm bám theo SRS v1.2; các điều khoản được viện dẫn chép
nguyên văn ở `docs/srs-trich-yeu.md`.

Task này **tách ra từ** `docs/plans/20260906-giai-doan-1-hoan-tat/`. Ở vòng duyệt thứ hai của
task đó, người soát chỉ ra một lỗ hổng đang tồn tại trong code. Người dùng quyết định tách
riêng, rồi sau vòng ba quyết định **làm task này trước** — vì mảng "quyền xoá hội thoại" của kế
hoạch Giai đoạn 1 sắp thêm `DELETE /api/chat/sessions/:id` dùng lại đúng cơ chế quyền đang hỏng.

### Vấn đề cần giải quyết

Ai lấy được `sessionId` của một khách vãng lai đều **đọc được toàn bộ transcript kèm dữ liệu cá
nhân chưa che**, chỉ bằng `GET /api/chat/sessions/:id`.

Ba quyết định thiết kế, mỗi cái riêng lẻ đều có lý do chính đáng, cộng lại thành lỗ hổng:

**1. `sessionId` ở `localStorage`, gửi trong body** — `src/hooks/useChatSession.tsx:30-34`:

```ts
const SESSION_KEY = 'travel_ai_chat_session';
function readStoredSession(): string | null {
  try { return window.localStorage.getItem(SESSION_KEY); } catch { return null; }
}
```

Chú thích gốc: SRS Mục 7.2 cho khách vãng lai chat mà không cần tài khoản, nên phải có cách nhận
lại phiên khi chưa đăng nhập.

**2. Phiên chưa gắn tài khoản thì ai giữ id cũng đọc được** — `server/routes/chat.ts:38-46`:

```ts
async function loadSession(sessionId: string, userId: string | null) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!session) return null;
  if (session.userId && session.userId !== userId) return null;   // chi chan khi DA gan user
  return session;
}
```

Nhánh `session.userId` rỗng không có kiểm tra nào. Hàm này được dùng bởi `POST /`,
`GET /sessions/:id` và `POST /feedback`.

**3. Transcript lưu bản gốc chưa che PII** — `prisma/schema.prisma`, model `ChatMessage`:

```prisma
  /// Lưu bản GỐC chưa che dữ liệu cá nhân. Việc che (server/agents/pii.ts) chỉ áp dụng ở biên
  /// gửi ra API ngoài theo SRS Mục 11.4.8, không phải cho lưu trữ nội bộ.
  content String
```

Đây là quyết định đúng cho mục đích hỗ trợ khách, nhưng nó có nghĩa transcript chứa họ tên, số
điện thoại, số giấy tờ, mã đặt chỗ ở dạng rõ.

Chưa có dữ liệu nào bị phơi vì **DB chưa từng chạy lần nào**. Phải đóng trước khi nhận khách
thật.

### Những gì đã có sẵn

`server/auth.ts` đã có khuôn mẫu cookie cần thiết (dùng cho cookie đăng nhập
`travel_ai_session`):

```ts
res.cookie(SESSION_COOKIE, token, {
  httpOnly: true,
  sameSite: "lax",
  secure: config.isProduction,
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
});
```

Và bcrypt cho mật khẩu, kèm chú thích gốc: *"Cost 12: khoảng 200-300ms mỗi lần băm trên máy
thường."*

`src/lib/api.ts:21` đã đặt `credentials: 'same-origin'`, server phục vụ cả API lẫn frontend từ
cùng origin → cookie tự đi kèm mọi request, **không phải sửa tầng gọi API**.

`server/rateLimit.ts` có `rateLimit({ windowMs, max, message })`. Hiện `POST /api/chat` có áp,
`GET /sessions/:id` **chưa**.

`model ChatSession` hiện có: `id`, `userId String?`, `channel`, `slots Json`, `escalated`,
`satisfaction Int?`, `startedAt`, `lastActiveAt`.

### Kế hoạch đề xuất

**Tách định danh khỏi quyền truy cập.** `sessionId` hạ xuống chỉ còn là định danh; quyền đọc/ghi
một phiên vãng lai do một **secret riêng trong cookie `httpOnly`** quyết định.

Luồng: `POST /api/chat` tạo phiên mới → sinh secret ngẫu nhiên 32 byte → trả về client **chỉ
trong cookie** `travel_ai_chat` (tên khác cookie đăng nhập) → lưu **hash** vào
`ChatSession.guestSecretHash`. `sessionId` vẫn ở `localStorage` và vẫn gửi trong body như hiện
nay, vì nó không còn đủ quyền.

Bảng quyền sau khi sửa:

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không thoả | 404 — **không phân biệt** với "không tồn tại", để không thành công cụ dò id |

**Hàm băm: SHA-256, KHÔNG phải bcrypt.** Đây là quyết định dễ làm sai nhất: `server/auth.ts`
dùng bcrypt cost 12 nên phản xạ là dùng lại. Hai lý do không được:

- bcrypt cost 12 tốn ~200–300 ms mỗi lần, mà kiểm tra secret nằm trên đường chạy của **mọi lượt
  chat và mọi lần khôi phục lịch sử** → ăn thẳng vào ngân sách 3 giây của NFR-PERF-03 và biến
  endpoint chat thành cửa ngõ tấn công từ chối dịch vụ.
- bcrypt tồn tại để chống dò **mật khẩu do người đặt** (entropy thấp, nằm trong từ điển). Secret
  ở đây là 32 byte từ `crypto.randomBytes`, không gian khoá 2^256 — làm chậm phép băm không mua
  được gì.

So sánh dùng `crypto.timingSafeEqual`.

Lược đồ thêm `guestSecretHash String?` vào `ChatSession`, **không** `@unique`.

Phiên tạo trước khi có cơ chế này (`guestSecretHash` null) thì không ai truy cập được nữa —
quy tắc chặt, không có giai đoạn quá độ, chấp nhận được vì DB chưa từng chạy nên chưa có phiên
nào tồn tại.

**Các bước:** (1) lược đồ + migration; (2) module mới `server/chatSession.ts` —
`issueGuestSecret` / `readGuestSecret` / `matchesGuestSecret`; (3) sửa `loadSession()` áp bảng
quyền; (4) phát secret khi tạo phiên, **giữ nguyên** `guestSecretHash` khi phiên vãng lai được
gắn vào tài khoản lúc khách đăng nhập giữa chừng; (5) áp `rateLimit` cho `GET /sessions/:id`;
(6) rà không ghi `sessionId`/secret ra log; (7) test; (8) ghi `history.md` lý do chọn SHA-256.

Toàn bộ logic quyền đặt **bên trong `loadSession()`** thay vì rải ở từng route, để endpoint
`DELETE` sắp thêm ở task Giai đoạn 1 tự kế thừa.

**Phương án đã loại:** che PII khi lưu (lật ngược quyết định thiết kế có lý do, và không đóng
được lỗ hổng — kẻ có id vẫn đọc được nội dung hội thoại; người dùng đã cân nhắc và không chọn);
bắt khách vãng lai đăng nhập (vi phạm Mục 7.2); ký `sessionId` bằng JWT (token vẫn nằm ở client
và ai lấy được vẫn dùng được — thứ giải quyết là cookie httpOnly, không phải định dạng token);
chuyển hẳn `sessionId` vào cookie (sạch hơn nhưng không mua thêm an toàn sau khi đã có secret);
bcrypt cho secret; gắn secret vào IP/User-Agent (khách đổi mạng là mất phiên, đổi lại chỉ được
một lớp giả mạo được).

**Rủi ro đã nêu:** người sau "sửa cho nhất quán" thành bcrypt; trình duyệt chặn cookie (suy giảm
đúng bằng mức `localStorage` bị chặn hôm nay, không phải hồi quy mới); một trình duyệt chỉ giữ
một secret vãng lai (đúng bằng hành vi hiện tại); `sameSite: "lax"` sẽ chặn cookie nếu sau này
nhúng widget lên tên miền khác (FR-BOT-10, ngoài phạm vi nhưng ghi thành điều kiện xem lại);
test cần DB thật; quên áp quyền mới cho một endpoint.

**Kiểm chứng trung tâm:** copy `sessionId` từ `localStorage`, mở cửa sổ ẩn danh, gọi
`GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả về toàn bộ transcript.
Cộng thêm: đo độ trễ một lượt chat trước/sau, chênh lệch phải không đáng kể — thấy tăng hàng
trăm ms tức là đã lỡ dùng bcrypt.

**Ngoài phạm vi:** chuyển `sessionId` khỏi `localStorage`; che PII khi lưu; **đồng bộ lịch sử đa
thiết bị cho người đã đăng nhập** (hôm nay client tìm phiên bằng `localStorage` nên máy mới là
phiên mới dù đã đăng nhập — FR-BOT-07 chưa đạt trọn vẹn; đây là khoảng trống có sẵn, không do
task này tạo ra); quyền xoá/job dọn/chính sách lưu trữ (thuộc mảng E của task Giai đoạn 1, làm
sau task này); `sameSite` cho widget đa kênh.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự đóng được lỗ hổng không; có sai giả định về code hiện tại không
(hãy đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên hay lỗ hổng còn lại không; có
cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Bốn câu hỏi đặc biệt muốn bị phản biện:

1. Lập luận "SHA-256 chứ không bcrypt vì secret có entropy cao" có đúng không, hay còn lý do nào
   khiến phải dùng hàm băm chậm ở đây?
2. Giữ `sessionId` ở `localStorage` (chỉ làm định danh) có còn đường tấn công nào không, so với
   phương án chuyển hẳn vào cookie?
3. Quy tắc "phiên vãng lai được gắn vào tài khoản thì **giữ nguyên** `guestSecretHash`" có tạo
   ra vấn đề gì không — ví dụ máy dùng chung, khách đăng nhập rồi rời đi mà cookie vẫn còn?
4. Có endpoint hay đường vào nào khác chạm tới `ChatSession`/`ChatMessage` mà kế hoạch bỏ sót
   không?

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

## Vòng 1 — phản hồi nhận về (2026-09-06)

VERDICT: FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. Kế hoạch yêu cầu test bằng `npm test`/Vitest nhưng `package.json` hiện không có script `test`, không có dependency Vitest, cũng chưa có harness DB test — vì sao chặn: bước kiểm chứng bắt buộc hiện không chạy được, nhất là các test phân quyền cần Prisma thật và cô lập schema — đề xuất: thêm rõ vào kế hoạch việc chọn/cài test runner, script `test`, setup/teardown DB `?schema=test`, và cách mock AI cho `POST /api/chat`.
2. `travel_ai_chat` là credential cấp quyền nhưng `maxAge` được nói là “khớp thời hạn lưu trữ hội thoại”, trong khi repo và kế hoạch Giai đoạn 1 xác nhận thời hạn này chưa được quyết định — vì sao chặn: không thể triển khai thuộc tính bảo mật quan trọng này theo một giá trị chưa tồn tại; cookie có thể sống quá lâu hoặc hành vi khôi phục phiên trở nên không xác định — đề xuất: quyết định ngay một thời hạn cookie tạm thời, nêu rõ lý do và hành vi khi hết hạn; sau đó đồng bộ lại khi chính sách lưu trữ được phê duyệt.

NON-BLOCKER (nên cân nhắc, không chặn)
1. SHA-256 cho secret ngẫu nhiên 32 byte là đúng; bcrypt không tăng ý nghĩa an toàn trước dò offline mà tăng chi phí/DoS. Cần quy định encoding cố định và xử lý hash/cookie sai định dạng trước khi gọi `timingSafeEqual`.
2. Giữ `sessionId` ở `localStorage` là chấp nhận được cho mục tiêu chống việc chỉ bị lộ ID: ID không còn là bearer token. Nhưng XSS chạy cùng origin vẫn có thể gọi API bằng cookie tự đính kèm và đọc response; kế hoạch cần nói rõ đây không phải biện pháp chống XSS, và CSP/kiểm soát script là lớp riêng.
3. `rateLimit` hiện khóa theo `${req.ip}:${req.path}`; với `GET /sessions/:id`, mỗi ID tạo bucket riêng, nên kẻ đổi ID né được giới hạn route-wide. Điều này không phá quyền mới, nhưng bước 5 không đạt mục tiêu chống dò/DoS như mô tả; nên khóa theo route mẫu hoặc chỉ theo IP cho endpoint này.
4. Giữ `guestSecretHash` sau khi gắn `userId` không cấp quyền thêm theo bảng quyền đề xuất, nhưng lý do “tab khác chưa đăng nhập” không đúng với cookie dùng chung trong cùng browser. Cookie đăng nhập còn hiệu lực trên máy dùng chung mới là quyền truy cập thực tế. Nên xóa hash khi gắn tài khoản để tối thiểu hóa dữ liệu, hoặc ghi rõ nó không còn được dùng để cấp quyền.
5. Đã rà các đường vào mã nguồn: chỉ `POST /api/chat`, `GET /api/chat/sessions/:id`, và `POST /api/chat/feedback` trực tiếp dùng `loadSession`; `ChatEscalation` chỉ được tạo sau luồng chat đã được kiểm tra. Không thấy endpoint đọc `ChatSession`/`ChatMessage` nào khác.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. Thời hạn cụ thể nào được chấp thuận cho cookie quyền của khách vãng lai trước khi chính sách lưu trữ/xóa dữ liệu ở Giai đoạn 1 hoàn tất?

## Vòng 1 — phân loại điểm chặn (2026-09-06)

Đối chiếu với code thật. **Cả hai điểm chặn đều Đúng**, và trong năm điểm NON-BLOCKER có hai
điểm sửa lập luận sai của kế hoạch.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Kiểm chứng bằng `npm test` nhưng repo chưa có vitest, chưa có script `test`, chưa có harness DB | **Đúng** | `package.json` không có `test` trong `scripts`, không có vitest trong `devDependencies`, không có file `*.test.ts` nào. Vòng 1 có ghi chú "nếu task này chạy trước thì dựng vitest ở đây" — nhưng đó là né tránh, không phải kế hoạch |
| 2 | `maxAge` cookie neo vào thời hạn lưu trữ chưa ai quyết | **Đúng** | Thời hạn lưu trữ nằm trong danh sách "đầu vào cần người dùng cung cấp" của task Giai đoạn 1, chưa có câu trả lời. Không thể triển khai thuộc tính bảo mật theo một giá trị chưa tồn tại |

### Hai điểm NON-BLOCKER sửa lập luận sai của kế hoạch

- **Cách khoá bucket của `rateLimit`.** `server/rateLimit.ts:34` khoá theo
  `` `${req.ip}:${req.path}` ``. Với `GET /sessions/:id` thì `req.path` chứa luôn id → **mỗi id
  một bucket**, kẻ đổi id né được giới hạn hoàn toàn. Bước "áp rate limit" của vòng 1 vì vậy
  không đạt mục tiêu chống dò như nó tự mô tả. **Đã kiểm chứng, đúng.**
- **Lý do giữ `guestSecretHash` sau khi gắn tài khoản.** Vòng 1 viết "để tab khác chưa đăng nhập
  không bị mất phiên" — **sai**, vì cookie dùng chung cho cả trình duyệt nên không tồn tại tình
  huống tab này có tab kia không. Đổi thành xoá hash để tối thiểu hoá dữ liệu.

### Ba điểm NON-BLOCKER còn lại, đều nhận

- SHA-256 được xác nhận là đúng; nhưng phải **chốt encoding cố định** và **chặn cookie sai định
  dạng trước khi gọi `timingSafeEqual`** — hàm này ném lỗi khi hai buffer khác độ dài, mà cookie
  là dữ liệu do người dùng gửi lên.
- Giữ `sessionId` ở `localStorage` là chấp nhận được, **nhưng phải nói rõ đây không phải biện
  pháp chống XSS**: mã độc cùng origin vẫn gọi được API với cookie tự đính kèm.
- Người soát đã rà toàn bộ mã nguồn và xác nhận **chỉ ba đường vào** dùng `loadSession()`. Không
  có endpoint nào khác đọc `ChatSession`/`ChatMessage`.

---

## Vòng 2 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 2**, chưa phải code. Vòng 1 bị trả FAIL với 2 điểm
chặn; kế hoạch đã được lập lại. Hãy phản biện thẳng thắn.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-bao-mat-phien-chat/plan.md`, phản
hồi vòng 1 và bảng phân loại ở `chatgpt.md` cùng thư mục. Hãy đọc trực tiếp và đối chiếu code.

### Vấn đề cần giải quyết

Ai lấy được `sessionId` của một khách vãng lai đều **đọc được toàn bộ transcript kèm dữ liệu cá
nhân chưa che**, chỉ bằng `GET /api/chat/sessions/:id`. Nguyên nhân: `loadSession()`
(`server/routes/chat.ts:38-46`) không kiểm gì với phiên chưa gắn tài khoản; `sessionId` nằm ở
`localStorage` (`src/hooks/useChatSession.tsx:30-34`); `ChatMessage.content` lưu bản gốc chưa
che PII theo đúng thiết kế đã ghi trong `prisma/schema.prisma`.

DB chưa từng chạy nên chưa có dữ liệu nào bị phơi. Phải đóng trước khi nhận khách thật. Task này
là **điều kiện tiên quyết** của mảng "quyền xoá hội thoại" ở
`docs/plans/20260906-giai-doan-1-hoan-tat/plan.md`.

### Hai điểm chặn vòng 1 và cách xử lý

| # | Điểm chặn | Xử lý |
|---|---|---|
| 1 | Kiểm chứng bằng `npm test` nhưng repo chưa có vitest, script `test`, hay harness DB | Dựng hạ tầng test **trong task này** thành bước 1–2: vitest + `vitest.config.ts`; harness dùng `?schema=test`, chạy `prisma migrate deploy` lên schema đó, truncate giữa các ca, **tự từ chối chạy nếu schema trỏ vào `public`**; các ca đụng `POST /api/chat` **mock module `server/agents/orchestrator`** thay vì gọi Gemini thật, vì bài test kiểm phân quyền chứ không kiểm chất lượng trả lời |
| 2 | `maxAge` neo vào thời hạn lưu trữ chưa ai quyết | **Chốt 30 ngày** kèm lý do (dưới) |

**Lý do chọn 30 ngày:** đủ dài để khách quay lại trong một tháng vẫn thấy hội thoại cũ, đủ ngắn
để cookie bị bỏ quên trên máy dùng chung không sống vô hạn. Quan trọng hơn: **cookie sống lâu
hơn dữ liệu là vô hại** — nếu chính sách lưu trữ ngắn hơn, bản ghi bị xoá trước và cookie chỉ
còn trỏ vào phiên không tồn tại → 404, client tự mở phiên mới. Nên **không cần** ràng buộc
`maxAge` ≤ thời hạn lưu trữ. Chiều ngược lại mới đáng ghi chú: nếu lưu trữ dài hơn nhiều (24
tháng theo NĐ 53/2022), khách vãng lai mất quyền truy cập vào hội thoại vẫn còn trong DB — đó là
hành vi đúng với một phiên vãng lai, nhưng phải ghi vào tài liệu chính sách để không ai coi là
mất dữ liệu.

### Năm điểm NON-BLOCKER, đều nhận

1. **Chốt encoding và chặn đầu vào sai định dạng.** Secret ở `base64url`, hash ở `hex` viết
   thường. `crypto.timingSafeEqual` **ném lỗi khi hai buffer khác độ dài**, mà cookie là dữ liệu
   người dùng gửi lên → kiểm độ dài và ký tự hợp lệ **trước**, sai thì trả 404 như mọi trường
   hợp không thoả quyền, không để cookie rác làm văng 500.
2. **Nói rõ phương án này không chống XSS.** Cookie `httpOnly` chặn đọc trộm credential bằng
   script, nhưng mã độc cùng origin vẫn gọi được API với cookie tự đính kèm rồi đọc response.
   Chống XSS là lớp riêng (CSP, kiểm soát script bên thứ ba, nguyên tắc không
   `dangerouslySetInnerHTML` đã áp ở `MarkdownMessage.tsx`). Cái task này đóng là **lỗ hổng chỉ
   cần lộ ID**.
3. **Sửa cách khoá bucket của `rateLimit`.** Thêm tuỳ chọn `scope?: string`: có `scope` thì khoá
   theo `` `${req.ip}:${scope}` `` thay vì `req.path`. Áp cho `GET /sessions/:id`. Các chỗ dùng
   hiện có không truyền `scope` nên hành vi giữ nguyên.
4. **Xoá `guestSecretHash` khi gắn tài khoản** thay vì giữ lại, để tối thiểu hoá dữ liệu. Lý do
   cũ của kế hoạch ("tab khác chưa đăng nhập") đã được xác nhận là sai.
5. Xác nhận chỉ ba đường vào dùng `loadSession()` — ghi vào kế hoạch để bước 9 kiểm đủ cả ba.

### Phần cốt lõi của kế hoạch (không đổi so với vòng 1)

**Tách định danh khỏi quyền truy cập.** `POST /api/chat` tạo phiên mới → sinh secret ngẫu nhiên
32 byte → trả về client **chỉ trong cookie `httpOnly`** `travel_ai_chat` → lưu **hash SHA-256**
vào `ChatSession.guestSecretHash`. `sessionId` vẫn ở `localStorage` và vẫn gửi trong body, vì nó
không còn đủ quyền.

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không thoả | 404 — **không phân biệt** với "không tồn tại", để không thành công cụ dò id |

**SHA-256 chứ không bcrypt**: bcrypt cost 12 tốn ~200–300 ms mỗi lần (chú thích trong
`server/auth.ts`), mà kiểm tra secret nằm trên đường chạy của mọi lượt chat → ăn vào ngân sách 3
giây của NFR-PERF-03 và thành cửa ngõ DoS. bcrypt tồn tại để chống dò mật khẩu entropy thấp;
secret ở đây là 32 byte từ `crypto.randomBytes`.

Toàn bộ logic quyền đặt **bên trong `loadSession()`** để endpoint `DELETE` sắp thêm ở task Giai
đoạn 1 tự kế thừa.

`guestSecretHash` null (phiên tạo trước cơ chế này) nghĩa là không ai truy cập được nữa — quy
tắc chặt, chấp nhận được vì DB chưa từng chạy.

**Kiểm chứng trung tâm:** copy `sessionId` từ `localStorage`, mở cửa sổ ẩn danh, gọi
`GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả về toàn bộ transcript.
Cộng thêm: đo độ trễ một lượt chat trước/sau, thấy tăng hàng trăm ms tức là đã lỡ dùng bcrypt.

**Ngoài phạm vi:** chuyển `sessionId` khỏi `localStorage`; che PII khi lưu; đồng bộ lịch sử đa
thiết bị cho người đã đăng nhập (khoảng trống **có sẵn**, không do task này tạo ra); quyền
xoá/job dọn/chính sách lưu trữ (mảng E của task Giai đoạn 1, làm sau); `sameSite` cho widget đa
kênh.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự đóng được lỗ hổng không; có sai giả định về code hiện tại không
(hãy đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên hay lỗ hổng còn lại không; có
cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Bốn câu hỏi vòng này muốn bị phản biện:

1. Hạ tầng test mô tả ở bước 1–2 có đủ để chạy được các ca phân quyền không, hay còn thiếu mắt
   xích nào (ví dụ cách gắn cookie vào request trong test, cách chạy migration lên schema test)?
2. Con số 30 ngày và lập luận "cookie sống lâu hơn dữ liệu là vô hại" có chỗ nào sai không?
3. Việc xoá `guestSecretHash` khi gắn tài khoản có làm hỏng trường hợp nào không — ví dụ khách
   đăng nhập giữa phiên rồi đăng xuất ngay trong cùng tab?
4. Tuỳ chọn `scope` cho `rateLimit` có đủ không, hay nên đổi hẳn cách khoá mặc định vì các route
   khác cũng có thể có tham số đường dẫn trong tương lai?

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
1. Kế hoạch nói xoá `guestSecretHash` khi khách “đăng nhập giữa chừng”, nhưng code hiện tại chỉ gắn `userId` trong `POST /api/chat`, không phải trong `/api/auth/login`, `/register` hay `/google` — vì sao chặn: đăng nhập rồi đăng xuất trước lượt chat kế tiếp vẫn để phiên ở trạng thái guest cùng secret cũ; hành vi chuyển trạng thái và câu trả lời cho trường hợp được hỏi chưa được xác định hay kiểm thử — đề xuất: nêu rõ và triển khai việc gắn phiên theo guest-secret ngay trong các luồng đăng nhập, hoặc chốt rõ rằng việc gắn chỉ xảy ra ở lượt chat kế tiếp và bổ sung test login → logout không gửi chat.
2. Hạ tầng test chưa nêu mắt xích để gửi request HTTP qua router với cookie — vì sao chặn: `server.ts` không export `app` và tự gọi `startServer()`, còn `chatRouter` phụ thuộc `express.json()` và `cookieParser()`; chỉ thêm Vitest/config/harness DB chưa đủ để các ca phân quyền thực thi được — đề xuất: kế hoạch phải chỉ rõ test app/factory export không tự listen, hoặc dựng Express app riêng trong test với hai middleware này và chọn cơ chế HTTP client (ví dụ Supertest, kèm dependency) có cookie jar/khả năng đặt `Cookie` header.

NON-BLOCKER (nên cân nhắc, không chặn)
1. Thêm test riêng cho việc tạo phiên mới khi body mang `sessionId` không được quyền: endpoint hiện tạo phiên mới thay vì trả 404; đây an toàn nhưng khác câu diễn đạt “không thoả quyền → 404”.
2. `scope` cố định là đủ cho GET hiện tại. Với route mới có tham số, nên yêu cầu người tạo route chọn `scope` rõ ràng hoặc dùng route pattern thay vì mặc định theo `req.path`; giữ mặc định hiện tại không bảo vệ các route tham số trong tương lai.
3. Harness nên reset state của `rateLimit` hoặc bảo đảm số request mỗi test không làm đầy bucket dùng chung, tránh test phụ thuộc thứ tự.
4. Lập luận cookie 30 ngày sống lâu hơn dữ liệu là đúng về bảo mật: bản ghi đã xoá sẽ không đọc được. Tuy vậy cần ghi rõ đây vẫn có thể tạo trải nghiệm 404 và client phải xử lý tạo phiên mới như bước kiểm chứng đã nêu.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. Sau khi khách đăng nhập rồi đăng xuất trong cùng tab mà chưa gửi lượt chat mới, sản phẩm muốn phiên cũ tiếp tục là guest hay phải chỉ truy cập lại được sau khi đăng nhập?

## Vòng 2 — phân loại điểm chặn (2026-09-06)

Đối chiếu với code thật. **Cả hai điểm chặn đều Đúng**, và đều là thiếu sót thật của kế hoạch.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Quy tắc xoá `guestSecretHash` mơ hồ vì việc gắn `userId` không nằm ở luồng đăng nhập | **Đúng** | `grep` toàn bộ `server/`: `prisma.chatSession.update(... { userId })` chỉ xuất hiện ở `server/routes/chat.ts:67`, tức bên trong `POST /api/chat`. Các route `/api/auth/*` không đụng `ChatSession`. Nên "xoá hash khi khách đăng nhập giữa chừng" không có thời điểm xác định |
| 2 | Hạ tầng test thiếu mắt xích gửi request HTTP kèm cookie | **Đúng** | `server.ts:22` — `const app = express()` là const cục bộ, không export; `server.ts:203` gọi `startServer()` ngay khi import. Test không có cách nào lấy được app, và kế hoạch cũng chưa chọn HTTP client nào đặt được header `Cookie` |

Bốn điểm NON-BLOCKER đều nhận: ghim hành vi `POST /` tạo phiên mới khi `sessionId` không có
quyền (an toàn nhưng khác câu "404", cần test để người sau không "sửa cho nhất quán"); yêu cầu
`scope` tường minh cho mọi route có tham số đường dẫn; `resetRateLimit()` cho test khỏi phụ
thuộc thứ tự; và ghi rõ hệ quả trải nghiệm 404 → client mở phiên mới.

---

## Vòng 3 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 3**, chưa phải code. Vòng 1 FAIL với 2 điểm chặn, vòng
2 FAIL với 2 điểm chặn. Hãy phản biện thẳng thắn.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-bao-mat-phien-chat/plan.md`; lịch
sử hai vòng trước và bảng phân loại ở `chatgpt.md` cùng thư mục.

### Vấn đề cần giải quyết

Ai lấy được `sessionId` của một khách vãng lai đều **đọc được toàn bộ transcript kèm dữ liệu cá
nhân chưa che**, chỉ bằng `GET /api/chat/sessions/:id`. `loadSession()`
(`server/routes/chat.ts:38-46`) không kiểm gì với phiên chưa gắn tài khoản; `sessionId` nằm ở
`localStorage`; `ChatMessage.content` lưu bản gốc chưa che PII theo thiết kế đã ghi trong
`prisma/schema.prisma`.

DB chưa từng chạy nên chưa có dữ liệu bị phơi. Task này là **điều kiện tiên quyết** của mảng
"quyền xoá hội thoại" ở `docs/plans/20260906-giai-doan-1-hoan-tat/plan.md`.

### Hai điểm chặn vòng 2 và cách xử lý

**1. Quy tắc chuyển trạng thái vãng lai → có chủ, chốt tường minh:**

- Việc gắn `userId` **chỉ xảy ra ở `POST /api/chat`** (`server/routes/chat.ts:67`) — hành vi
  hiện có, vòng này **không đổi**. Các route `/api/auth/*` không đụng `ChatSession`.
- `guestSecretHash` xoá về null **đúng tại thời điểm gắn**, trong cùng lệnh `update`, kèm xoá
  cookie. Không xoá sớm hơn ở luồng đăng nhập.
- **Hệ quả có chủ ý:** khách đăng nhập rồi đăng xuất mà chưa gửi lượt chat nào thì phiên **vẫn
  là vãng lai** và secret cũ vẫn dùng được. Đây là giữ nguyên hành vi hiện tại, và an toàn:
  trước thời điểm gắn, phiên đó vốn thuộc về người đang giữ trình duyệt. Có test riêng cho luồng
  này, và ghi vào `history.md` để không ai coi là lỗi.

**2. Hạ tầng test, ba bước đầu của kế hoạch:**

- **vitest + supertest** (hai devDependency). Supertest là thứ đặt được header `Cookie` và đọc
  `Set-Cookie` — điều kiện cần để kiểm bảng quyền.
- **Tách `createApp()`** sang file mới `server/app.ts`, gom `express.json()`, `cookieParser()`,
  các router và error handler `/api`; `server.ts` import và dùng lại rồi mới thêm Vite/static và
  `listen`. Cần bước này vì `server.ts:22` khai `app` là const cục bộ và `server.ts:203` gọi
  `startServer()` ngay khi import — test không import được gì. Refactor thuần, không đổi hành vi.
- **Harness DB**: `DATABASE_URL` có `?schema=test`, chạy `prisma migrate deploy` lên schema đó,
  truncate giữa các ca, gọi `resetRateLimit()`, **tự từ chối chạy nếu schema trỏ vào `public`**.
  Các ca đụng `POST /api/chat` **mock module `server/agents/orchestrator`** — bài test kiểm phân
  quyền chứ không kiểm chất lượng trả lời, nên `handleTurn` giả trả hằng số là đủ và test chạy
  được khi không có `GEMINI_API_KEY`.

### Bốn điểm NON-BLOCKER vòng 2, đều nhận

1. **Ghim hành vi `POST /` khi `sessionId` không có quyền**: endpoint **tạo phiên mới** chứ
   không trả 404. An toàn, nhưng khác câu "không thoả quyền → 404" nên phải có test ghim lại —
   trả 404 ở đây sẽ biến `POST` thành công cụ dò id nào có thật.
2. **Yêu cầu `scope` tường minh cho mọi route có tham số đường dẫn**, ghi vào chú thích của
   `rateLimit`. Mặc định theo `req.path` chỉ đúng với route tĩnh, và đó đúng là cái bẫy vừa mắc.
3. **`resetRateLimit()` cho test** vì bộ đếm là một `Map` ở cấp module, không reset thì các ca
   phụ thuộc thứ tự chạy.
4. **Hệ quả trải nghiệm của 404**: client đã xử lý đúng — `src/hooks/useChatSession.tsx` bắt
   riêng 404 để bỏ id và mở phiên mới, mọi lỗi khác thì giữ id. Bước kiểm chứng số 4 kiểm lại.

### Phần cốt lõi (không đổi qua ba vòng)

**Tách định danh khỏi quyền truy cập.** `POST /api/chat` tạo phiên mới → sinh secret ngẫu nhiên
32 byte → trả về client **chỉ trong cookie `httpOnly`** `travel_ai_chat`, `maxAge` **30 ngày** →
lưu **hash SHA-256** vào `ChatSession.guestSecretHash`. `sessionId` vẫn ở `localStorage` và vẫn
gửi trong body, vì nó không còn đủ quyền.

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không thoả | 404 — **không phân biệt** với "không tồn tại" |

**SHA-256 chứ không bcrypt**: bcrypt cost 12 tốn ~200–300 ms mỗi lần (chú thích trong
`server/auth.ts`), mà kiểm tra secret nằm trên đường chạy của mọi lượt chat → ăn vào ngân sách
3 giây của NFR-PERF-03 và thành cửa ngõ DoS. bcrypt tồn tại để chống dò mật khẩu entropy thấp;
secret ở đây là 32 byte từ `crypto.randomBytes`. Encoding chốt cứng (secret `base64url`, hash
`hex` thường); **chặn cookie sai định dạng trước khi gọi `timingSafeEqual`** vì hàm này ném lỗi
khi hai buffer khác độ dài.

**Cookie 30 ngày**: đủ dài để khách quay lại trong một tháng vẫn thấy hội thoại, đủ ngắn để
cookie bỏ quên trên máy dùng chung không sống vô hạn. Cookie sống lâu hơn dữ liệu là vô hại —
bản ghi bị xoá trước thì cookie chỉ còn trỏ vào phiên không tồn tại → 404.

**Phương án này KHÔNG chống XSS**: cookie `httpOnly` chặn đọc trộm credential bằng script, nhưng
mã độc cùng origin vẫn gọi được API với cookie tự đính kèm. Cái task này đóng là **lỗ hổng chỉ
cần lộ ID**.

Toàn bộ logic quyền đặt **bên trong `loadSession()`** để endpoint `DELETE` sắp thêm ở task Giai
đoạn 1 tự kế thừa.

**Kiểm chứng trung tâm:** copy `sessionId` từ `localStorage`, mở cửa sổ ẩn danh, gọi
`GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả về toàn bộ transcript.
Cộng thêm: đo độ trễ một lượt chat trước/sau, thấy tăng hàng trăm ms tức là đã lỡ dùng bcrypt.

**Ngoài phạm vi:** chuyển `sessionId` khỏi `localStorage`; che PII khi lưu; đồng bộ lịch sử đa
thiết bị cho người đã đăng nhập (khoảng trống **có sẵn**, không do task này tạo ra); quyền
xoá/job dọn/chính sách lưu trữ (mảng E task Giai đoạn 1); `sameSite` cho widget đa kênh.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự đóng được lỗ hổng không; có sai giả định về code hiện tại không
(đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên hay lỗ hổng còn lại không; có cách
làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Ba câu hỏi vòng này muốn bị phản biện:

1. Việc tách `createApp()` sang `server/app.ts` có làm hỏng gì trong luồng khởi động hiện tại
   không (Vite middleware ở dev, `express.static` ở production, thứ tự mount error handler)?
2. Quy tắc "gắn phiên chỉ ở lượt chat kế tiếp, xoá hash đúng tại thời điểm gắn" có còn khe hở
   nào không?
3. Còn trường hợp biên nào của `loadSession()` chưa được liệt kê — ví dụ phiên vừa được gắn tài
   khoản nhưng request đang bay tới mang cookie vãng lai cũ?

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
1. Luồng tạo phiên khi người dùng đã đăng nhập chưa được định nghĩa đúng — vì sao chặn: `POST /api/chat` hiện tạo `ChatSession` với `userId` khi không có/không dùng được `sessionId`; bước 7 lại nói mọi phiên mới đều phát secret và lưu `guestSecretHash`. Điều này trái bảng quyền và tạo cookie/hash guest vô nghĩa cho phiên đã có chủ, đồng thời có thể ghi đè secret guest của trình duyệt — đề xuất: chỉ phát/lưu guest secret khi `userId === null`; bổ sung test tạo phiên mới khi đã đăng nhập, xác nhận `guestSecretHash` null và không đổi cookie guest.
2. `loadSession()` vẫn có race TOCTOU lúc chuyển guest → có chủ — vì sao chặn: request guest đã qua `loadSession()` trước khi request khác gắn `userId` và xoá hash vẫn tiếp tục gọi AI, ghi message và trả kết quả sau thời điểm secret bị thu hồi. Điều này không thỏa quy tắc phiên đã có chủ chỉ dùng được bởi `userId` — đề xuất: nêu và triển khai tái-kiểm quyền nguyên tử ngay trước transaction ghi dữ liệu (điều kiện `userId IS NULL` và hash còn khớp), rồi trả 404 nếu trạng thái đã đổi; thêm test điều phối hai request song song.
3. Tách `createApp()` chưa liệt kê đủ các endpoint hiện có — vì sao chặn: `server.ts` không chỉ có router; còn `/api/health`, `/api/config`, `/api/plan-itinerary` và error handler. Chỉ “gom router” dễ làm mất endpoint hoặc làm error handler đứng sai thứ tự, trái cam kết refactor không đổi hành vi — đề xuất: quy định `createApp()` chứa toàn bộ middleware và mọi route `/api` hiện hữu theo đúng thứ tự hiện tại, rồi `server.ts` chỉ gắn Vite/static sau app factory và gọi `listen`; thêm smoke test các endpoint này.

NON-BLOCKER (nên cân nhắc, không chặn)
1. `clearCookie` cho `travel_ai_chat` cần dùng cùng `path`, `sameSite`, `secure` như lúc phát cookie; nên là hàm riêng trong module secret.
2. Test cần phân biệt request cũ bắt đầu trước thời điểm gắn và request bắt đầu sau thời điểm gắn; chỉ ca tuần tự không bắt được race.
3. Mô tả `server.ts` là file ở root repo là đúng; không có `server/server.ts`.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)

## Vòng 3 — phân loại điểm chặn (2026-09-06)

Đối chiếu với code thật. **Cả ba điểm chặn đều Đúng.** Đây là vòng FAIL thứ ba của task này nên
theo quy tắc chống lặp ở `docs/dev-flow.md`, dừng lại và báo người dùng trước khi lập vòng 4.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Phiên tạo khi **đã đăng nhập** vẫn được phát guest secret | **Đúng** | `server/routes/chat.ts:62` — `prisma.chatSession.create({ data: { userId } })`, và `userId` ở đây có thể khác null. Bước 7 của kế hoạch nói "mọi phiên mới đều phát secret", nên phiên đã có chủ cũng nhận cookie + hash vô nghĩa, lại còn **ghi đè cookie guest đang có của trình duyệt**. Sửa: chỉ phát và lưu khi `userId === null` |
| 2 | Race TOCTOU khi chuyển vãng lai → có chủ | **Đúng, và là lỗi mình sẽ không tự thấy** | `loadSession()` đọc và kiểm quyền ở đầu request, còn việc ghi nằm trong `prisma.$transaction` ở cuối (`server/routes/chat.ts:110-130`). Giữa hai thời điểm đó, một request khác có thể gắn `userId` và xoá hash. Request cũ vẫn chạy tiếp: gọi model, ghi message, trả kết quả — **sau khi secret đã bị thu hồi**. Sửa: tái kiểm quyền nguyên tử ngay trước transaction (điều kiện `userId IS NULL` và hash còn khớp), đổi trạng thái thì trả 404 |
| 3 | `createApp()` liệt kê thiếu endpoint | **Đúng** | `server.ts` ngoài bốn router còn có `/api/health`, `/api/config`, `/api/plan-itinerary` khai inline, cộng error handler `app.use("/api", ...)` phải đứng **sau** mọi route. Kế hoạch chỉ nói "gom các router và error handler" → dễ làm rơi ba endpoint hoặc đảo thứ tự, trái đúng cam kết "refactor thuần, không đổi hành vi". Sửa: `createApp()` chứa toàn bộ middleware và mọi route `/api` theo đúng thứ tự hiện tại, kèm smoke test |

### Ba điểm NON-BLOCKER

- `clearCookie` cho `travel_ai_chat` phải dùng **cùng `path`, `sameSite`, `secure`** như lúc
  phát, nếu không trình duyệt không xoá. Gom thành một hàm riêng trong module secret.
- Test phải phân biệt request **bắt đầu trước** thời điểm gắn và request **bắt đầu sau**; chỉ ca
  tuần tự không bắt được race ở điểm chặn số 2.
- Xác nhận `server.ts` nằm ở gốc repo, không có `server/server.ts`.

### Trạng thái

Ba vòng, ba lần FAIL, **không điểm chặn nào bị bác** — mỗi vòng người soát tìm ra khiếm khuyết
thật và sâu dần: vòng 1 là hạ tầng còn thiếu, vòng 2 là trạng thái chưa định nghĩa, vòng 3 là
race và thiếu sót phạm vi refactor. Kế hoạch tốt lên thật sau mỗi vòng, nhưng chưa qua cổng.
Cả ba điểm chặn vòng này đều cụ thể và sửa được, không có điểm nào cần người dùng quyết.

---

## Vòng 4 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 4**, chưa phải code. Ba vòng trước đều FAIL; không điểm
chặn nào bị bác, tất cả đã được sửa. Hãy phản biện thẳng thắn.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-bao-mat-phien-chat/plan.md`; lịch
sử ba vòng trước và các bảng phân loại ở `chatgpt.md` cùng thư mục.

### Vấn đề cần giải quyết

Ai lấy được `sessionId` của một khách vãng lai đều **đọc được toàn bộ transcript kèm dữ liệu cá
nhân chưa che**, chỉ bằng `GET /api/chat/sessions/:id`. Nguyên nhân: `loadSession()`
(`server/routes/chat.ts:38-46`) không kiểm gì với phiên chưa gắn tài khoản; `sessionId` nằm ở
`localStorage`; `ChatMessage.content` lưu bản gốc chưa che PII theo thiết kế đã ghi trong
`prisma/schema.prisma`.

DB chưa từng chạy nên chưa có dữ liệu bị phơi. Task này là **điều kiện tiên quyết** của mảng
"quyền xoá hội thoại" ở `docs/plans/20260906-giai-doan-1-hoan-tat/plan.md`.

### Ba điểm chặn vòng 3 và cách xử lý

**1. Chỉ phiên vãng lai mới có secret.** `server/routes/chat.ts:62` tạo phiên bằng
`create({ data: { userId } })`, và `userId` ở đó **có thể khác null** khi khách đã đăng nhập.
Vòng 3 nói "mọi phiên mới đều phát secret" là sai: phiên đã có chủ nhận một cookie và một hash vô
nghĩa, tệ hơn là **ghi đè cookie guest đang có của trình duyệt**, làm khách mất quyền vào phiên
vãng lai cũ. Điều kiện đúng: chỉ `issueGuestSecret()` và lưu hash khi `userId === null`.

**2. Đóng race TOCTOU.** `loadSession()` kiểm quyền ở **đầu** request, còn ghi nằm trong
`prisma.$transaction` ở **cuối** (`server/routes/chat.ts:110-130`), giữa hai thời điểm là một
lượt gọi model kéo dài hàng giây. Request khác trong khoảng ấy có thể gắn `userId` và xoá hash —
request cũ vẫn ghi message và trả kết quả sau khi secret đã bị thu hồi.

Cách sửa: thay `chatSession.update` trong transaction bằng **`updateMany` mang theo vị từ phân
quyền**, đặt làm **lệnh đầu tiên** của transaction, rồi kiểm `count`:

- Phiên vãng lai: `where: { id, userId: null, guestSecretHash: <hash tính từ cookie> }`
- Phiên đã có chủ: `where: { id, userId: <userId đã xác thực> }`

`count === 0` → ném lỗi để transaction cuộn lại, route trả 404. Nhờ `updateMany` chạy như một
lệnh `UPDATE ... WHERE` duy nhất, kiểm và ghi là một thao tác nguyên tử ở tầng Postgres; không
cần `SELECT ... FOR UPDATE` hay nâng mức cô lập. Vị từ dùng cái nào do **chế độ quyền mà
`loadSession()` đã dùng** quyết định, nên `loadSession()` phải trả về cả chế độ đó.

Giới hạn nói rõ: lượt gọi model **đã xảy ra** và không thu hồi được — chỉ bảo đảm **không ghi và
không trả dữ liệu**. Chi phí một lượt gọi bị bỏ là cái giá chấp nhận được cho tình huống hiếm.
Áp cùng cách cho `POST /feedback` (`server/routes/chat.ts:182`), vốn cũng theo mẫu "đọc rồi ghi".

**3. `createApp()` liệt kê đầy đủ và đúng thứ tự.** Vòng 3 chỉ nói "gom các router" và làm rơi ba
endpoint khai inline. Thứ tự bắt buộc:

1. `express.json({ limit: "5mb" })`
2. `cookieParser()`
3. `GET /api/health`
4. `GET /api/config`
5. bốn router: `/api/auth`, `/api/me`, `/api/content`, `/api/chat`
6. `POST /api/plan-itinerary`
7. `app.use("/api", errorHandler)` — **phải đứng sau cùng**; mount trước thì lỗi từ router lọt
   qua và Express trả trang HTML thay vì JSON (lý do đã ghi sẵn trong `server.ts`)

`server.ts` chỉ còn gọi `createApp()`, thêm Vite middleware ở dev hoặc `express.static` +
fallback `index.html` ở production, rồi `listen`. Smoke test: `/api/health` 200, `/api/config`
200, và một request `/api` với JSON hỏng trả **400 dạng JSON** — ca cuối chứng minh error handler
còn đứng đúng chỗ.

### Ba điểm NON-BLOCKER vòng 3, đều nhận

- `clearGuestSecret(res)` nằm cùng module với `issueGuestSecret`, và **phải truyền đúng `path`,
  `sameSite`, `secure`** như lúc phát, nếu không trình duyệt không xoá cookie.
- Test phải phân biệt request bắt đầu **trước** và **sau** thời điểm gắn — ca tuần tự không bắt
  được race. Ca race dùng `handleTurn` giả điều khiển được thời điểm trả về: giữ request vãng lai
  ở bước gọi model, chạy xong request thứ hai gắn `userId`, rồi thả request thứ nhất → phải trả
  **404** và **không message nào được ghi**.
- Xác nhận `server.ts` nằm ở gốc repo, không có `server/server.ts`.

### Phần cốt lõi (không đổi qua bốn vòng)

**Tách định danh khỏi quyền truy cập.** `POST /api/chat` tạo phiên vãng lai → sinh secret ngẫu
nhiên 32 byte → trả về client **chỉ trong cookie `httpOnly`** `travel_ai_chat`, `maxAge` **30
ngày** → lưu **hash SHA-256** vào `ChatSession.guestSecretHash`. `sessionId` vẫn ở `localStorage`
và vẫn gửi trong body, vì nó không còn đủ quyền.

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không thoả | 404 — **không phân biệt** với "không tồn tại" |

**SHA-256 chứ không bcrypt**: bcrypt cost 12 tốn ~200–300 ms mỗi lần (chú thích trong
`server/auth.ts`), mà kiểm secret nằm trên đường chạy của mọi lượt chat → ăn vào ngân sách 3 giây
của NFR-PERF-03 và thành cửa ngõ DoS. bcrypt tồn tại để chống dò mật khẩu entropy thấp; secret ở
đây là 32 byte từ `crypto.randomBytes`. Encoding chốt cứng (secret `base64url`, hash `hex`
thường); **chặn cookie sai định dạng trước khi gọi `timingSafeEqual`** vì hàm này ném lỗi khi hai
buffer khác độ dài.

**Quy tắc chuyển trạng thái:** gắn `userId` **chỉ xảy ra ở `POST /api/chat`**; hash xoá **đúng
tại thời điểm gắn**, kèm xoá cookie. Hệ quả có chủ ý: đăng nhập rồi đăng xuất mà chưa chat thì
phiên vẫn là vãng lai và secret cũ vẫn dùng được — an toàn, vì trước thời điểm gắn phiên đó vốn
thuộc về người đang giữ trình duyệt.

**Phương án này KHÔNG chống XSS**: cookie `httpOnly` chặn đọc trộm credential bằng script, nhưng
mã độc cùng origin vẫn gọi được API với cookie tự đính kèm. Cái task này đóng là **lỗ hổng chỉ
cần lộ ID**.

Toàn bộ logic quyền đặt **bên trong `loadSession()`** để endpoint `DELETE` sắp thêm ở task Giai
đoạn 1 tự kế thừa.

**Kiểm chứng trung tâm:** copy `sessionId` từ `localStorage`, mở cửa sổ ẩn danh, gọi
`GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả toàn bộ transcript.
Cộng thêm: đo độ trễ một lượt chat trước/sau, thấy tăng hàng trăm ms tức đã lỡ dùng bcrypt.

**Ngoài phạm vi:** chuyển `sessionId` khỏi `localStorage`; che PII khi lưu; đồng bộ lịch sử đa
thiết bị cho người đã đăng nhập (khoảng trống **có sẵn**, không do task này tạo ra); quyền
xoá/job dọn/chính sách lưu trữ (mảng E task Giai đoạn 1); `sameSite` cho widget đa kênh.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự đóng được lỗ hổng không; có sai giả định về code hiện tại không
(đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên hay lỗ hổng còn lại không; có cách
làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Hai câu hỏi vòng này muốn bị phản biện:

1. Cách đóng race bằng `updateMany` mang vị từ phân quyền làm lệnh đầu của transaction có đủ
   nguyên tử không, hay còn đường nào lách?
2. Còn trường hợp biên nào của `loadSession()` hoặc luồng tạo phiên chưa được liệt kê?

**Lưu ý về tiêu chí PASS:** chỉ liệt kê vào BLOCKER những vấn đề khiến kế hoạch **sai hoặc không
thực hiện được** — lỗ hổng còn lại, giả định sai về code, bước không kiểm chứng được, hoặc mâu
thuẫn nội tại. Những cải tiến đáng làm nhưng không thuộc các loại đó thì xếp vào NON-BLOCKER.
Một kế hoạch đúng và đủ để bắt tay làm thì trả PASS kèm NON-BLOCKER, không giữ lại chỉ vì còn có
thể chi tiết hơn.

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

## Vòng 4 — phản hồi nhận về (2026-09-06)

VERDICT: FAIL

BLOCKER (phải sửa trước khi code, để trống nếu không có)
1. Vị từ tái kiểm quyền “theo chế độ mà `loadSession()` đã dùng” mâu thuẫn với luồng gắn tài khoản — vì sao chặn: request đã đăng nhập nạp một phiên vãng lai bằng guest secret, rồi xoá `guestSecretHash` khi gắn `userId`; nếu transaction cuối vẫn dùng vị từ guest thì luôn `count === 0`, còn nếu việc gắn không có vị từ nguyên tử thì hai request có thể ghi đè chủ phiên — đề xuất: gắn tài khoản bằng `updateMany` có vị từ guest trong transaction/callback thích hợp, chỉ xoá cookie sau khi thành công; sau gắn, chuyển ngữ cảnh quyền của chính request sang owner và dùng vị từ `userId` ở lần ghi cuối.
2. `ChatEscalation` hiện được ghi sau transaction chứa message/session, nhưng kế hoạch không đưa nó qua hàng rào quyền nguyên tử — vì sao chặn: sau khi `updateMany` hợp lệ commit, request khác có thể gắn `userId` và thu hồi secret, rồi request guest cũ vẫn ghi `ChatEscalation` ngoài transaction và trả kết quả — đề xuất: đưa mọi ghi của lượt chat, gồm cả `chatEscalation.create`, vào cùng transaction có lệnh kiểm quyền đầu tiên; dùng transaction callback để kiểm `count` trước các lệnh ghi tiếp theo.

NON-BLOCKER (nên cân nhắc, không chặn)
1. `updateMany` với vị từ quyền là nguyên tử ở Postgres cho điểm tuyến tính của lần ghi; không cần `SELECT ... FOR UPDATE`, miễn toàn bộ ghi liên quan nằm sau nó trong cùng transaction.
2. Có một cửa sổ rất ngắn ở `GET /sessions/:id`: quyền được kiểm trước khi trả response. Đây là ngữ nghĩa đọc thông thường có thể tuyến tính tại lúc kiểm quyền, nhưng nên ghi rõ để tránh diễn giải “thu hồi” là huỷ được response đã bắt đầu.

CÂU HỎI (thông tin còn thiếu khiến bạn chưa chắc chắn)
1. Không có.

## Vòng 4 — phân loại điểm chặn (2026-09-06)

Đối chiếu với code thật. **Cả hai điểm chặn đều Đúng**, và cả hai là **hệ quả bậc hai của chính
bản sửa vòng 4** — không phải vấn đề mới của kế hoạch gốc.

| # | Điểm chặn | Kết luận | Dẫn chứng |
|---|---|---|---|
| 1 | Vị từ "theo chế độ `loadSession()` đã dùng" mâu thuẫn với luồng gắn tài khoản | **Đúng — mâu thuẫn logic thật** | Kịch bản: khách đã đăng nhập nạp một phiên **vãng lai** bằng guest secret → chế độ là "guest"; cùng request đó gắn `userId` và xoá hash; nhưng lệnh ghi cuối vẫn dùng vị từ guest `{ id, userId: null, guestSecretHash }` → **luôn `count === 0`**, request tự chặn chính mình. Nếu ngược lại việc gắn không có vị từ nguyên tử thì hai request có thể ghi đè chủ phiên |
| 2 | `ChatEscalation` ghi **ngoài** hàng rào quyền nguyên tử | **Đúng** | `server/routes/chat.ts` — `$transaction([...])` đóng ở dòng 120, `prisma.chatEscalation.create` ở dòng 123, tức **sau** transaction. Sau khi `updateMany` hợp lệ commit, một request khác vẫn có thể gắn `userId` và thu hồi secret, rồi request cũ ghi tiếp `ChatEscalation` ngoài mọi kiểm tra |

### Cách sửa cho vòng 5

- **Điểm 1:** thực hiện việc gắn tài khoản bằng chính một `updateMany` có vị từ guest, **bên
  trong** transaction; thành công thì **chuyển ngữ cảnh quyền của request sang chế độ owner** và
  dùng vị từ `userId` cho lệnh ghi cuối. Cookie chỉ xoá **sau khi** transaction thành công.
- **Điểm 2:** đưa **mọi** lệnh ghi của một lượt chat — gồm cả `chatEscalation.create` — vào cùng
  transaction, đặt sau lệnh kiểm quyền. Dùng dạng **transaction callback** (`$transaction(async
  (tx) => ...)`) thay vì mảng, vì cần kiểm `count` giữa chừng rồi mới quyết có chạy tiếp không —
  dạng mảng không làm được điều đó.

### Hai điểm NON-BLOCKER

- Người soát **xác nhận** `updateMany` mang vị từ quyền là nguyên tử ở Postgres và **không cần**
  `SELECT ... FOR UPDATE`, miễn mọi lệnh ghi liên quan nằm sau nó trong cùng transaction. Tức
  hướng đi của vòng 4 là đúng, chỉ chưa áp đủ phạm vi.
- `GET /sessions/:id` có một cửa sổ rất ngắn giữa lúc kiểm quyền và lúc trả response. Đây là ngữ
  nghĩa đọc thông thường, chấp nhận được; chỉ cần ghi rõ để không ai diễn giải "thu hồi secret"
  là huỷ được một response đã bắt đầu gửi.

### Trạng thái

Bốn vòng, bốn lần FAIL, không điểm chặn nào bị bác. Nhưng xu hướng đã đổi rõ: vòng 3 có ba điểm
chặn về thiết kế còn thiếu, vòng 4 chỉ còn hai điểm và cả hai là tinh chỉnh bậc hai của bản sửa
vừa đưa vào; mục CÂU HỎI lần đầu **trống**; và một NON-BLOCKER **xác nhận** hướng đi cốt lõi là
đúng. Hai điểm còn lại đều cụ thể, nằm gọn trong một hàm, và không cần người dùng quyết.

---

## Vòng 5 — gửi đi (2026-09-06)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật vòng 5**, chưa phải code. Bốn vòng trước đều FAIL; không
điểm chặn nào bị bác, tất cả đã được sửa. Hãy phản biện thẳng thắn.

**Bạn đọc được repo.** Kế hoạch đầy đủ ở `docs/plans/20260906-bao-mat-phien-chat/plan.md`; lịch
sử bốn vòng trước và các bảng phân loại ở `chatgpt.md` cùng thư mục.

### Vấn đề cần giải quyết

Ai lấy được `sessionId` của một khách vãng lai đều **đọc được toàn bộ transcript kèm dữ liệu cá
nhân chưa che**, chỉ bằng `GET /api/chat/sessions/:id`. Nguyên nhân: `loadSession()`
(`server/routes/chat.ts:38-46`) không kiểm gì với phiên chưa gắn tài khoản; `sessionId` nằm ở
`localStorage`; `ChatMessage.content` lưu bản gốc chưa che PII theo thiết kế đã ghi trong
`prisma/schema.prisma`. DB chưa từng chạy nên chưa có dữ liệu bị phơi.

### Hai điểm chặn vòng 4 và cách xử lý

Cả hai là hệ quả bậc hai của bản sửa vòng 4, và cả hai đã được sửa trong bước 8 viết lại.

**1. Mâu thuẫn ở luồng gắn tài khoản.** Vòng 4 nói vị từ tái kiểm quyền lấy "theo chế độ mà
`loadSession()` đã dùng". Nhưng khách đã đăng nhập nạp một phiên **vãng lai** thì chế độ là
guest, rồi chính request đó gắn `userId` và xoá hash → lệnh ghi cuối dùng vị từ guest sẽ **luôn
`count === 0`**, request tự chặn chính mình.

Sửa: phân theo **ba trường hợp**, và trường hợp gắn tài khoản dùng **một lệnh `updateMany` làm
cả hai việc**.

| | Vị từ `where` | `data` kèm theo |
|---|---|---|
| **A. Phiên đã có chủ** | `{ id, userId: <userId đã xác thực> }` | `slots`, `escalated` |
| **B. Phiên vãng lai, request chưa đăng nhập** | `{ id, userId: null, guestSecretHash: <hash từ cookie> }` | `slots`, `escalated` |
| **C. Phiên vãng lai, request đã đăng nhập** — lúc **gắn tài khoản** | `{ id, userId: null, guestSecretHash: <hash từ cookie> }` | `userId`, **`guestSecretHash: null`**, `slots`, `escalated` |

Ở trường hợp C, vị từ guest vừa là hàng rào quyền vừa bảo đảm **chỉ đúng một request** gắn được
tài khoản. Sau khi nó thành công, ngữ cảnh quyền của request **chuyển sang owner**; các lệnh ghi
còn lại trong cùng transaction không phải kiểm lại vì đã nằm sau hàng rào.

`count === 0` ở bất kỳ trường hợp nào → ném lỗi để transaction cuộn lại → route trả 404.

**2. `ChatEscalation` thoát khỏi hàng rào.** `chatEscalation.create` ở
`server/routes/chat.ts:123` nằm **ngoài** `$transaction` (đóng ở dòng 120).

Sửa: đổi `$transaction` từ dạng mảng sang **dạng callback** `$transaction(async (tx) => { ... })`
— bắt buộc, vì cần kiểm `count` giữa chừng rồi mới quyết có chạy tiếp không, điều dạng mảng
không làm được. **Mọi** lệnh ghi của lượt chat nằm sau lệnh kiểm quyền, trong cùng callback: hai
`chatMessage.create` và `chatEscalation.create`. Không còn lệnh ghi nào của lượt chat nằm ngoài.

**Xoá cookie chỉ sau khi transaction commit thành công** (trường hợp C) — xoá trước mà transaction
cuộn lại thì khách mất quyền vào một phiên vẫn còn là vãng lai.

**Giới hạn nói rõ:** lượt gọi model **đã xảy ra** và không thu hồi được; ta chỉ bảo đảm **không
ghi và không trả dữ liệu**. Chi phí một lượt gọi bị bỏ là cái giá chấp nhận được cho tình huống
hiếm.

Áp cùng cách cho `POST /feedback` (`server/routes/chat.ts:182`), vốn cũng theo mẫu "đọc rồi ghi".

### Hai điểm NON-BLOCKER vòng 4, đều nhận

- Người soát xác nhận `updateMany` mang vị từ quyền là nguyên tử ở Postgres, **không cần**
  `SELECT ... FOR UPDATE`, miễn mọi lệnh ghi liên quan nằm sau nó trong cùng transaction. Bước 8
  viết lại đúng theo điều kiện đó.
- `GET /sessions/:id` có cửa sổ ngắn giữa lúc kiểm quyền và lúc trả response — ngữ nghĩa đọc
  thông thường, chấp nhận được. Đã ghi rõ vào kế hoạch để không ai diễn giải "thu hồi secret" là
  huỷ được một response đã bắt đầu gửi; muốn thế phải có cơ chế phiên bản hoặc huỷ giữa chừng,
  không tương xứng với rủi ro.

### Phần cốt lõi (không đổi qua năm vòng)

`POST /api/chat` tạo phiên **vãng lai** → sinh secret ngẫu nhiên 32 byte → trả về client **chỉ
trong cookie `httpOnly`** `travel_ai_chat`, `maxAge` **30 ngày** → lưu **hash SHA-256** vào
`ChatSession.guestSecretHash`. Chỉ phát secret khi `userId === null`. `sessionId` vẫn ở
`localStorage` và vẫn gửi trong body, vì nó không còn đủ quyền.

| Phiên | Điều kiện đọc/ghi/xoá |
|---|---|
| Chưa gắn tài khoản | Secret trong cookie khớp `guestSecretHash` |
| Đã gắn tài khoản | `userId` từ cookie đăng nhập khớp `ChatSession.userId` |
| Không thoả | 404 — **không phân biệt** với "không tồn tại" |

**SHA-256 chứ không bcrypt**: bcrypt cost 12 tốn ~200–300 ms mỗi lần (chú thích trong
`server/auth.ts`), mà kiểm secret nằm trên đường chạy của mọi lượt chat → ăn vào ngân sách 3 giây
của NFR-PERF-03 và thành cửa ngõ DoS. Secret là 32 byte từ `crypto.randomBytes` nên không có tấn
công từ điển nào áp dụng được. Encoding chốt cứng (secret `base64url`, hash `hex` thường); chặn
cookie sai định dạng **trước** khi gọi `timingSafeEqual` vì hàm này ném lỗi khi hai buffer khác
độ dài.

`createApp()` tách sang `server/app.ts`, chứa **toàn bộ** middleware và mọi route `/api` theo
đúng thứ tự hiện tại (`express.json` → `cookieParser` → `/api/health` → `/api/config` → bốn
router → `/api/plan-itinerary` → error handler `/api` **sau cùng**), kèm smoke test trong đó có
ca "JSON hỏng trả 400 dạng JSON" để chứng minh error handler còn đúng chỗ.

**Phương án này KHÔNG chống XSS** — cookie `httpOnly` chặn đọc trộm credential bằng script,
nhưng mã độc cùng origin vẫn gọi được API với cookie tự đính kèm. Cái task này đóng là **lỗ hổng
chỉ cần lộ ID**.

**Kiểm chứng trung tâm:** copy `sessionId` từ `localStorage`, mở cửa sổ ẩn danh, gọi
`GET /api/chat/sessions/<id>` → phải trả **404**. Trước khi sửa thì nó trả toàn bộ transcript.

**Ngoài phạm vi:** chuyển `sessionId` khỏi `localStorage`; che PII khi lưu; đồng bộ lịch sử đa
thiết bị cho người đã đăng nhập (khoảng trống **có sẵn**, không do task này tạo ra); quyền
xoá/job dọn/chính sách lưu trữ (thuộc task Giai đoạn 1, làm sau); `sameSite` cho widget đa kênh.

### Việc của bạn

Kiểm tra: kế hoạch có thực sự đóng được lỗ hổng không; có sai giả định về code hiện tại không
(đối chiếu trực tiếp trong repo); có bỏ sót trường hợp biên hay lỗ hổng còn lại không; có cách
làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

Câu hỏi vòng này muốn bị phản biện: ba trường hợp A/B/C ở bước 8 đã phủ hết tổ hợp
(trạng thái phiên × trạng thái đăng nhập) chưa, và trường hợp C có còn khe hở nào không?

**Lưu ý về tiêu chí PASS:** chỉ liệt kê vào BLOCKER những vấn đề khiến kế hoạch **sai hoặc không
thực hiện được** — lỗ hổng còn lại, giả định sai về code, bước không kiểm chứng được, hoặc mâu
thuẫn nội tại. Cải tiến đáng làm nhưng không thuộc các loại đó thì xếp vào NON-BLOCKER. Một kế
hoạch đúng và đủ để bắt tay làm thì trả PASS kèm NON-BLOCKER, không giữ lại chỉ vì còn có thể
chi tiết hơn.

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
