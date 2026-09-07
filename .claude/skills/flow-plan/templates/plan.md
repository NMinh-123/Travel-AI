---
task: <slug>
tieu-de: <một dòng mô tả yêu cầu>
status: cho-duyet   # cho-duyet | da-duyet | dang-code | cho-soat-code | xong | huy
round: 1            # số vòng đã gửi ChatGPT
ngay-tao: <YYYY-MM-DD>
---

# <Tiêu đề>

## Yêu cầu

Nguyên văn (hoặc diễn giải sát) điều người dùng muốn, kèm những gì họ nói rõ là
**không** làm.

## Hiện trạng

Code hiện tại đang làm gì, ở đâu. Mỗi khẳng định kèm `đường-dẫn:dòng`. Nếu `history.md`
có giải thích lý do của thiết kế hiện tại thì trích ra.

## Phương án chọn

Mô tả cách làm. Nếu có đánh đổi thì nói rõ đánh đổi cái gì lấy cái gì.

## Phương án đã loại

| Phương án | Lý do loại |
|---|---|

## Các bước thực hiện

1. **<Bước>** — file đụng tới: `...`. Kết quả mong đợi: ...
2. ...

## Rủi ro

- <rủi ro> → cách giảm thiểu / cách phát hiện sớm.

## Cách kiểm chứng

Câu lệnh cụ thể (`npm run ...`), hoặc thao tác tay từng bước, hoặc test cần thêm.

## Ngoài phạm vi

Những thứ cố tình không làm trong lần này, để người duyệt không tưởng là bỏ sót.

## Lịch sử vòng lặp

- Vòng 1: <ngày> — gửi ChatGPT.
