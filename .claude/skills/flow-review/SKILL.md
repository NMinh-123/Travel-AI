---
name: flow-review
description: Bước 2 của quy trình 4 bước (plan → ChatGPT duyệt kế hoạch → Claude code → ChatGPT soát code). Nhận phản hồi review kế hoạch từ ChatGPT, phân loại PASS/FAIL, mở khoá bước code hoặc quay lại lập kế hoạch. Dùng khi người dùng dán phản hồi ChatGPT về một kế hoạch trong docs/plans/.
---

# Bước 2 — Cổng duyệt kế hoạch (ChatGPT)

Đầu vào: phản hồi ChatGPT do người dùng dán vào, hoặc đã được ghi sẵn vào
`docs/plans/<task>/chatgpt.md`. Nếu chưa rõ phản hồi thuộc task nào, hỏi lại — đừng đoán.

## 0. Lấy phản hồi

Nếu người dùng đã dán sẵn phản hồi thì dùng luôn. Nếu chưa, chạy `npm run flow:review -- <slug>` —
script gọi Codex CLI ở chế độ chỉ đọc và ghi phản hồi nguyên văn vào `chatgpt.md` (mã thoát
0 = PASS, 2 = FAIL). Chạy không được thì nhắc người dùng copy tay sang ChatGPT, đừng tự bịa
phản hồi.

Script chỉ lấy phản hồi về; nó không mở cổng. Các bước dưới đây vẫn phải làm đủ.

## 1. Lưu phản hồi

Ghi nguyên văn phản hồi vào mục "Vòng N — phản hồi nhận về" trong `chatgpt.md`. Nguyên
văn, không tóm tắt: vòng sau còn phải đối chiếu.

## 2. Phân loại từng điểm

Không nuốt trọn kết luận của ChatGPT, cũng không tự động bác bỏ. Với **mỗi** điểm
BLOCKER, tự kiểm chứng lại bằng code trong repo rồi xếp vào một trong ba nhóm:

- **Đúng** — kế hoạch thật sự sai hoặc thiếu. Phải sửa.
- **Sai** — dựa trên giả định không đúng về codebase. Ghi rõ file:dòng chứng minh.
- **Không rõ** — cần người dùng quyết định (đánh đổi sản phẩm, phạm vi, ưu tiên).

Ghi bảng phân loại này vào cuối `chatgpt.md`.

## 3. Ra quyết định cổng

- **Còn ít nhất một BLOCKER "Đúng"** → cổng FAIL. Ghi nguyên nhân vào mục "Lịch sử vòng
  lặp" trong `plan.md`, giữ `status: cho-duyet`, rồi quay lại `/flow-plan` cho vòng
  N+1. Không được code.
- **Mọi BLOCKER đều "Sai"** → chưa PASS ngay. Viết phần phản biện có dẫn chứng vào gói
  prompt vòng N+1 và gửi lại ChatGPT. ChatGPT phải là bên chốt PASS, không phải mình.
- **Có BLOCKER "Không rõ"** → dừng, hỏi người dùng, kèm khuyến nghị của mình.
- **VERDICT PASS và không còn BLOCKER nào** → đặt `status: da-duyet` trong `plan.md`,
  ghi ngày duyệt vào "Lịch sử vòng lặp". Các điểm NON-BLOCKER đáng làm thì thêm vào
  mục "Các bước thực hiện"; điểm nào bỏ qua thì ghi lý do.

## 4. Chống lặp vô hạn

Nếu tới vòng 3 vẫn FAIL: dừng lại, tóm tắt cho người dùng những điểm còn tranh chấp
giữa hai vòng gần nhất và xin quyết định. Đừng gửi vòng 4 một cách máy móc.

## 5. Kết thúc bước

Báo trạng thái mới của task và bước kế tiếp. Nếu PASS thì nhắc chạy `/flow-build`.
