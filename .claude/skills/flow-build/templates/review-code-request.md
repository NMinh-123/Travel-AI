# Gói soát code — <slug>

> Chạy `npm run flow:review-code -- <slug>`, hoặc mở ChatGPT và dán khối dưới đây.
> Người soát đọc được repo nên không cần dán code.

---

Soát phần code vừa thay đổi trong repo này. Đây là review tìm lỗi, không phải review phong
cách — bỏ qua góp ý thẩm mỹ trừ khi nó dẫn tới bug thật.

**Ràng buộc tuyệt đối: chỉ báo cáo, không sửa.** Không sửa, tạo hay xoá bất kỳ file nào, kể cả
khi lỗi hiển nhiên và sửa được trong một dòng. Việc sửa do người khác làm sau khi từng phát
hiện đã được xác minh lại với code; một bản vá lọt vào cây làm việc mà họ không biết sẽ phá
đúng cơ chế kiểm tra đó.

### Kế hoạch mà code này triển khai

<dán mục "Phương án chọn" và "Các bước thực hiện" của plan.md>

### File đã thay đổi

<dán `git status --short` và `git diff --stat`>

### Cần bạn kiểm

1. Code có làm đúng kế hoạch trên không, có bước nào bị bỏ sót không.
2. Lỗi đúng/sai thật sự: trường hợp biên, `null`/`undefined`, lỗi bất đồng bộ, rò rỉ tài
   nguyên, truy vấn Prisma sai, xử lý lỗi HTTP thiếu.
3. Bảo mật: đầu vào chưa kiểm tra, nội dung do model sinh ra bị render thành HTML, rò rỉ khoá
   bí mật, thiếu kiểm tra quyền.
4. Ảnh hưởng lan sang chỗ khác trong repo mà thay đổi này làm hỏng.

Trả lời **đúng định dạng sau**, không thêm lời dẫn:

```
VERDICT: CLEAN | ISSUES

BUG (sai thật, có kịch bản tái hiện)
1. <file:dòng> — <mô tả> — tái hiện: <đầu vào/trạng thái dẫn tới sai>

RỦI RO (có thể sai, chưa chắc)
1. <file:dòng> — <mô tả> — vì sao chưa chắc: <lý do>

GÓP Ý (không chặn)
1. <góp ý>
```

Mỗi mục BUG bắt buộc có kịch bản tái hiện cụ thể. Không có kịch bản thì xếp xuống RỦI RO.

---

## Kết quả nhận về (<ngày>)

<dán nguyên văn kết quả soát code vào đây>
