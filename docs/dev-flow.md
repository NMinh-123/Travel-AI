# Quy trình phát triển: Claude lên kế hoạch — ChatGPT duyệt — Claude code — ChatGPT soát

Quy trình bắt buộc cho mọi thay đổi đáng kể trên Travel AI Hà Giang. Ba ý tưởng nền:

1. **Kế hoạch phải bị một mô hình khác phản biện trước khi tốn công code.**
2. **Code phải được rà lại sau khi viết, bởi một bên có quyền đọc repo.**
3. **Bên rà chỉ báo cáo, không sửa.** Toàn bộ code — kể cả các bản vá cho đúng những lỗi
   vừa bị chỉ ra — do Claude viết. Giữ quyền sửa ở một chỗ thì không có thay đổi nào lọt
   vào cây làm việc mà không ai rà lại được.

Claude là bên lên kế hoạch và viết code duy nhất; ChatGPT là bên kiểm thử độc lập ở cả hai
cổng.

## Sơ đồ

```
        ┌──────────────────────────────┐
        │ 1. Claude: nghiên cứu + plan │◄─────────────┐
        └──────────────┬───────────────┘              │
                       │ plan.md + gói prompt         │ FAIL: ghi nguyên nhân,
                       ▼                              │ vòng N+1
        ┌──────────────────────────────┐              │
        │ 2. ChatGPT: duyệt kế hoạch   │──────────────┘
        └──────────────┬───────────────┘
                       │ PASS
                       ▼
        ┌──────────────────────────────┐
        │ 3. Claude: code theo kế hoạch│◄─────────────┐
        └──────────────┬───────────────┘              │
                       │ gói prompt + file đã đổi     │ lỗi thật:
                       ▼                              │ CLAUDE sửa
        ┌──────────────────────────────┐              │
        │ 4. ChatGPT: soát lỗi code    │──────────────┘
        │    chỉ đọc — không sửa file  │
        └──────────────┬───────────────┘
                       │ CLEAN
                       ▼
                   xong / commit
```

Đổi thiết kế ở bước 3 hoặc 4 (không chỉ vá lỗi) thì quay lại bước 1, không tự quyết.

## Bốn skill

| Bước | Lệnh | Việc |
|---|---|---|
| 1 | `/flow-plan <yêu cầu>` | Đọc code, viết `plan.md`, sinh gói prompt tự chứa cho ChatGPT |
| 2 | `/flow-review <phản hồi ChatGPT>` | Phân loại từng điểm, PASS thì mở khoá, FAIL thì quay về bước 1 |
| 3 | `/flow-build` | Code theo kế hoạch đã duyệt, kiểm chứng, ghi `history.md`, sinh gói prompt soát code |
| 4 | `/flow-review-code <kết quả soát>` | Xác minh từng phát hiện, tự tay sửa lỗi thật, đóng task |

Định nghĩa nằm ở [.claude/skills/](../.claude/skills/); mẫu prompt nằm trong thư mục
`templates/` của từng skill.

## Hồ sơ mỗi task

```
docs/plans/<YYYYMMDD>-<slug>/
  plan.md      kế hoạch hiện hành + frontmatter trạng thái + lịch sử các vòng
  chatgpt.md   từng vòng: gói prompt gửi đi, phản hồi nguyên văn, bảng phân loại
  review-code.md  gói prompt soát code, kết quả nguyên văn, kết luận từng phát hiện
```

Vòng lặp lại **dùng lại đúng thư mục cũ**, chỉ tăng `round`. Trạng thái trong
frontmatter `plan.md`:

`cho-duyet` → `da-duyet` → `dang-code` → `cho-soat-code` → `xong` (hoặc `huy`).

Cổng duy nhất chặn thật là `da-duyet`: bước 3 không được bắt đầu khi `status` chưa phải
`da-duyet`, trừ khi người dùng nói rõ bỏ qua cho lần này.

## Vì sao prompt hai bước khác nhau

Gói prompt bước 2 **tự chứa**: dán thẳng trích đoạn code liên quan vào. Giữ như vậy dù
Codex đọc được repo, vì hai lẽ — nó vẫn phải copy tay sang ChatGPT web được khi cần, và
một kế hoạch tự đứng vững trên mô tả của chính nó là điều đáng kiểm. Quyền đọc repo ở
bước 2 dùng để **đối chiếu** các khẳng định về hiện trạng, không thay cho gói prompt.

Gói prompt bước 4 chỉ cần **chỉ đường**: kế hoạch, danh sách file đã đổi, và những nhóm
lỗi cần soi. Người soát tự đọc code trong repo.

Cả hai đều được yêu cầu trả lời theo định dạng cố định (`VERDICT` + các mục phân loại)
để bước sau xử lý được một cách máy móc, thay vì phải đoán ý một đoạn văn xuôi.

## Hai chế độ chạy: thủ công và tự động

Quy trình chạy được **không cần cấu hình gì cả**: mở ChatGPT như bình thường, copy gói
prompt trong `docs/plans/<task>/` sang, dán kết quả trở lại.

Máy có Codex CLI đã đăng nhập thì hai bước gửi–nhận đó tự động hoá được:

| Bước | Lệnh | Ghi vào |
|---|---|---|
| 2 | `npm run flow:review -- <slug>` | `chatgpt.md` |
| 4 | `npm run flow:review-code -- <slug>` | `review-code.md` |

Bỏ `<slug>` thì script lấy task có `plan.md` sửa gần nhất và in tên ra trước khi gửi.

Cả hai script chỉ làm đúng phần cơ khí: gửi gói prompt đi, ghi phản hồi nguyên văn vào
file, và in `VERDICT`. **Chúng không tự mở cổng.** Việc đối chiếu từng điểm chặn với code
thật rồi quyết định PASS vẫn thuộc `/flow-review` và `/flow-review-code` — đó là chỗ giá
trị của quy trình nằm, không phải ở thao tác copy-paste.

Mã thoát để dùng trong script khác: `flow:review` trả 0 khi PASS, 2 khi FAIL, 3 khi không
đọc được VERDICT, 1 khi lỗi cấu hình. `flow:review-code` trả 0 khi CLEAN, 2 khi ISSUES.

### Vì sao gọi Codex CLI chứ không gọi REST

Codex CLI trên máy này đăng nhập bằng **thuê bao ChatGPT** (`auth_mode = "chatgpt"` trong
`~/.codex/auth.json`, `OPENAI_API_KEY` để null). Khoá API của OpenAI là thứ tách rời: nó
**không đi kèm gói ChatGPT**, tài khoản API phải nạp credit riêng. Bản trước của
`flow-review.ts` gọi thẳng `api.openai.com` nên chưa từng chạy được trên máy này.

Token OAuth trong `auth.json` **không dùng thay khoá API được** — khác realm xác thực, lại
xoay vòng liên tục, và moi nó ra để gọi API là vùng xám về điều khoản. Đường được hỗ trợ
là gọi chính CLI ở chế độ headless: `codex exec`. Chi tiết ở `scripts/flow-codex.ts`.

Ba lựa chọn trong module đó cần giữ nguyên:

- **`-s read-only`** — người soát không được sửa file. Đây là ràng buộc của quy trình, bỏ
  cờ này là phá cổng kiểm tra.
- **Chỉ dẫn đi qua stdin, không qua tham số dòng lệnh** — gói prompt dài vài chục nghìn ký
  tự tiếng Việt, truyền qua argv trên Windows vướng cả giới hạn độ dài lẫn bảng mã console.
- **Đọc kết quả từ `-o <file>`** — stdout còn lẫn log tiến trình.

Cursor CLI từng giữ vai bước 4 và đã được thay: nó cần `CURSOR_API_KEY` riêng, trong khi
Codex đã đăng nhập sẵn và cũng đọc được repo — vốn là năng lực duy nhất khiến Cursor được
chọn cho bước đó.

## Quy tắc chống kẹt

- Không nuốt trọn kết luận của bên soát. Mỗi điểm chặn phải được đối chiếu lại với code
  thật rồi xếp Đúng / Sai / Không rõ, kèm dẫn chứng `file:dòng`.
- Nếu thấy cây làm việc có thay đổi mà Claude không thực hiện: dừng, báo người dùng. Bên
  soát đã chạy sai chế độ và kết luận của lượt đó không còn đáng tin.
- Mọi điểm chặn đều sai → phản biện có dẫn chứng rồi gửi lại; ChatGPT vẫn là bên chốt
  PASS, không phải tự mình chốt.
- Điểm "Không rõ" (đánh đổi sản phẩm, phạm vi) → hỏi người dùng, kèm khuyến nghị.
- Đến vòng 3 vẫn FAIL → dừng, tóm tắt điểm còn tranh chấp và xin quyết định.

## Việc nhỏ

Sửa một dòng chữ, đổi màu, sửa lỗi chính tả thì không cần chạy hết bốn bước. Ngưỡng gợi
ý: đụng từ hai file trở lên, hoặc chạm vào schema, prompt của model, hay ranh giới
client/server, thì đi theo quy trình.
