---
name: flow-plan
description: Bước 1 của quy trình 4 bước (plan → ChatGPT duyệt kế hoạch → Claude code → ChatGPT soát code). Nghiên cứu codebase cho một yêu cầu mới và viết kế hoạch vào docs/plans/, kèm gói prompt tự chứa để dán sang ChatGPT. Dùng khi người dùng giao một việc mới cần làm theo quy trình, hoặc khi ChatGPT trả FAIL và cần lập lại kế hoạch cho vòng tiếp theo.
---

# Bước 1 — Nghiên cứu và lên kế hoạch

Đầu vào: mô tả yêu cầu do người dùng đưa (tham số của skill). Nếu người dùng chỉ nói
"làm lại kế hoạch" thì đầu vào là hồ sơ task đang dở trong `docs/plans/`.

## 1. Xác định hồ sơ task

Slug đặt theo `docs/plans/<YYYYMMDD>-<slug-ngắn>/`, ví dụ `20260906-chat-streaming`.
Nếu đây là vòng lặp lại sau khi ChatGPT trả FAIL thì **dùng lại đúng thư mục cũ**,
không tạo thư mục mới — lịch sử các vòng phải nằm cùng một chỗ.

## 2. Nghiên cứu trước khi viết

Chưa được sửa file nguồn nào ở bước này. Việc cần làm:

- Đọc code thật sự liên quan, không đoán. Ghi lại đường dẫn kèm số dòng.
- Kiểm tra ràng buộc sẵn có: `package.json`, `prisma/schema.prisma`, `server/`,
  biến môi trường trong `.env.example`, và `history.md` (giải thích vì sao code hiện
  tại trông như vậy — đọc phần liên quan trước khi định lật ngược một quyết định cũ).
- Nếu là vòng lặp lại: đọc phản hồi FAIL gần nhất trong `chatgpt.md` và xử lý **từng**
  điểm chặn, không được lờ đi điểm nào.

## 3. Viết `plan.md`

Ghi (hoặc ghi đè) `docs/plans/<task>/plan.md` theo mẫu
`templates/plan.md` trong thư mục skill này. Nguyên tắc:

- Nêu phương án đã chọn **và** phương án đã loại, kèm lý do loại.
- Chia thành các bước có thể kiểm chứng được, mỗi bước nói rõ đụng file nào.
- Nêu rủi ro và cách kiểm chứng (test, chạy tay, câu lệnh cụ thể).
- Trường `status` trong frontmatter đặt là `cho-duyet`, `round` tăng thêm 1 nếu là
  vòng lặp lại.

## 4. Viết gói prompt cho ChatGPT

Gói prompt này được cả người dùng (copy tay) lẫn `npm run flow:review` dùng chung, nên
phải đặt đúng dưới tiêu đề `## Vòng N — gửi đi` và không được để sót chỗ trống `<dán ...>`
của mẫu — script sẽ từ chối gửi nếu còn.

Ghi thêm một mục "Vòng N — gửi đi" vào `docs/plans/<task>/chatgpt.md` theo mẫu
`templates/chatgpt-request.md`.

Điểm quan trọng: **ChatGPT không đọc được repo**. Gói prompt phải tự chứa — dán trích
đoạn code liên quan vào thẳng trong đó, kể cả khi dài. Kế hoạch mà thiếu ngữ cảnh sẽ
nhận về phản hồi chung chung vô dụng.

## 5. Kết thúc bước

Báo cho người dùng: đường dẫn `plan.md`, đường dẫn `chatgpt.md`, và câu nhắc "dán mục
'Vòng N — gửi đi' sang ChatGPT, rồi chạy `/flow-review` với phản hồi nhận được".

Không được tự chuyển sang bước code. Cổng ChatGPT là bắt buộc.
