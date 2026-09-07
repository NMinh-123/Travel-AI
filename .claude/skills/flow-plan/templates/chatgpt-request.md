## Vòng <N> — gửi đi (<ngày>)

> Dán toàn bộ khối dưới đây sang ChatGPT.

---

Bạn đang review **kế hoạch kỹ thuật**, chưa phải code. Hãy phản biện thẳng thắn;
việc của bạn là chặn kế hoạch sai trước khi nó tốn công triển khai.

### Bối cảnh dự án

Travel AI Hà Giang — React + Vite (TypeScript) ở `src/`, server Express ở `server.ts`
và `server/`, Postgres + pgvector qua Prisma ở `prisma/`, một embedding service riêng ở
`embedding-service/`. Model sinh nội dung gọi qua biến môi trường, không hard-code.

### Yêu cầu cần giải quyết

<dán mục "Yêu cầu" của plan.md>

### Hiện trạng code

<dán trích đoạn code thật sự liên quan — ChatGPT không đọc được repo>

### Kế hoạch đề xuất

<dán từ mục "Phương án chọn" đến hết "Ngoài phạm vi" của plan.md>

### Phản hồi vòng trước (nếu có)

<dán các điểm FAIL của vòng trước và cách kế hoạch này xử lý từng điểm>

### Việc của bạn

Kiểm tra: kế hoạch có thực sự giải quyết yêu cầu không; có sai giả định về code hiện
tại không; có bỏ sót trường hợp biên, lỗi bảo mật, hay ảnh hưởng tới phần khác không;
có cách làm đơn giản hơn rõ rệt không; các bước có kiểm chứng được không.

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

Chỉ trả `PASS` khi mục BLOCKER trống. Nếu thiếu thông tin để kết luận, trả `FAIL` và
đặt câu hỏi thay vì đoán.

---

## Vòng <N> — phản hồi nhận về (<ngày>)

<dán nguyên văn phản hồi của ChatGPT vào đây>
