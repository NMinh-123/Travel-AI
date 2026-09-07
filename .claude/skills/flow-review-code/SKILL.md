---
name: flow-review-code
description: Bước 4 của quy trình 4 bước (plan → ChatGPT duyệt kế hoạch → Claude code → ChatGPT soát code). Xử lý kết quả soát code của ChatGPT, xác minh từng phát hiện, tự tay sửa lỗi thật và đóng task. Dùng khi người dùng dán kết quả soát code cho một task trong docs/plans/.
---

# Bước 4 — Xử lý kết quả soát code của ChatGPT

Nguyên tắc chi phối cả bước này: **người soát chỉ báo cáo, Claude sửa.** ChatGPT không được
đụng vào file — kể cả khi nó chỉ ra một lỗi hiển nhiên sửa được trong một dòng. Nếu phát hiện
cây làm việc có thay đổi mà mình không thực hiện, dừng lại và báo người dùng ngay: đó là dấu
hiệu người soát đã chạy sai chế độ, và mọi kết luận của lượt đó không còn đáng tin.

## 0. Lấy kết quả

Nếu người dùng đã dán sẵn kết quả thì dùng luôn. Nếu chưa, chạy
`npm run flow:review-code -- <slug>` — script gọi `codex exec -s read-only` và ghi kết quả
vào `review-code.md` (mã thoát 0 = CLEAN, 2 = ISSUES). Không chạy được thì nhắc người dùng
chạy tay, **đừng tự bịa kết quả review**.

## 1. Lưu kết quả

Ghi nguyên văn phản hồi vào mục "Kết quả nhận về" trong `docs/plans/<task>/review-code.md`.

## 2. Xác minh từng phát hiện trước khi sửa

Công cụ review hay báo lỗi không có thật. Với mỗi mục BUG, tự đọc lại code và thử tái hiện
theo đúng kịch bản người soát đưa ra, rồi kết luận:

- **Xác nhận** — sửa.
- **Bác bỏ** — ghi rõ `file:dòng` chứng minh vì sao kịch bản đó không xảy ra được.
- **Đúng nhưng ngoài phạm vi** — ghi vào mục "Phát sinh" của `plan.md`, không tự sửa kèm;
  hỏi người dùng có muốn làm tiếp không.

Mục RỦI RO xử lý cùng cách nhưng ngưỡng thấp hơn: nếu rẻ và an toàn thì cứ sửa.

Ghi bảng kết luận này vào `review-code.md` — lần sau khỏi tranh luận lại.

## 3. Sửa và kiểm chứng lại

Tự tay sửa các mục đã xác nhận, rồi chạy lại đúng phần kiểm chứng ở `plan.md`. Nếu bản sửa
làm thay đổi thiết kế ở mức đáng kể (không chỉ vá lỗi), quay lại `/flow-plan` cho một vòng mới
thay vì tự quyết.

Sửa xong mà số lượng thay đổi đáng kể thì gửi lại một lượt soát nữa — vòng lặp
**code → soát → sửa** được phép lặp, cổng chặn duy nhất vẫn là bước 2.

## 4. Đóng task

- Bổ sung vào mục `history.md` của thay đổi này những gì đã sửa sau review, nếu đáng ghi.
- Đặt `status: xong` trong `plan.md` và ghi ngày đóng vào "Lịch sử vòng lặp".
- Còn mục chưa xử lý (bác bỏ hoặc hoãn) thì liệt kê ra cho người dùng thấy.

## 5. Kết thúc bước

Tóm tắt: đã sửa gì, bác bỏ gì kèm lý do, còn treo gì. Việc commit chỉ làm khi người dùng
yêu cầu.
