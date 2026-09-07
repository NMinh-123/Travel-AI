---
name: flow-build
description: Bước 3 của quy trình 4 bước (plan → ChatGPT duyệt kế hoạch → Claude code → ChatGPT soát code). Triển khai đúng kế hoạch đã được ChatGPT duyệt, tự kiểm chứng, rồi sinh gói prompt để ChatGPT soát code. Dùng khi một kế hoạch trong docs/plans/ đã có status da-duyet.
---

# Bước 3 — Code theo kế hoạch đã duyệt

Toàn bộ code trong quy trình này do Claude viết. Các công cụ khác chỉ đọc và báo cáo; không
bao giờ giao việc sửa file cho chúng.

## 1. Kiểm tra cổng trước khi gõ dòng code đầu tiên

Đọc frontmatter `plan.md`. Nếu `status` khác `da-duyet`, **dừng** và nói cho người dùng biết
task đang ở bước nào. Chỉ bỏ qua cổng khi người dùng nói rõ là bỏ qua cho lần này.

Đặt `status: dang-code`.

## 2. Triển khai

- Bám theo mục "Các bước thực hiện". Code khớp phong cách file xung quanh: cách đặt tên, mật
  độ comment, ngôn ngữ comment.
- Không mở rộng phạm vi. Nếu phát hiện việc đáng làm nằm ngoài kế hoạch, ghi vào mục "Phát
  sinh" của `plan.md` thay vì tự làm luôn.
- Nếu giữa chừng phát hiện kế hoạch sai ở mức phải đổi hướng: dừng code, ghi lý do vào "Lịch
  sử vòng lặp", đặt lại `status: cho-duyet`, quay về `/flow-plan`. Một kế hoạch đã duyệt không
  phải là giấy phép để đi chệch nó trong im lặng.

## 3. Tự kiểm chứng

Chạy đúng những gì mục "Cách kiểm chứng" của `plan.md` nêu (build, test, chạy tay). Báo kết
quả thật — thất bại thì dán output, bỏ qua bước nào thì nói rõ là đã bỏ qua.

## 4. Ghi nhật ký dự án

Thêm mục cho thay đổi này vào `history.md` theo đúng văn phong sẵn có của file đó: nói **vì
sao** làm vậy, không chỉ làm gì.

## 5. Sinh gói prompt soát code

Ghi `docs/plans/<task>/review-code.md` theo mẫu `templates/review-code-request.md`. Kèm danh
sách file đã đổi (lấy từ `git status --short` và `git diff --stat`). Đặt
`status: cho-soat-code`.

Người soát đọc được repo nên gói này chỉ cần chỉ đường, không phải dán code vào — khác gói
prompt tự chứa của bước 2.

## 6. Kết thúc bước

Báo: đã sửa những file nào, kết quả kiểm chứng, và nhắc chạy
`npm run flow:review-code -- <slug>`, hoặc dán nội dung `review-code.md` sang ChatGPT rồi chạy
`/flow-review-code` với kết quả nhận được.
