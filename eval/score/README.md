# Môi trường Python cho bộ chấm RAGAS

Bộ chấm là mã Python và có phụ thuộc riêng, tách hẳn khỏi Node. Nó chạy trong một virtualenv
ở `eval/.venv` mà `npm run eval` gọi trực tiếp — không dựa vào Python nào đang có trên PATH.

## Dựng lần đầu

```bash
npm run eval:setup
```

Lệnh đó tạo `eval/.venv`, cài đúng những phiên bản trong `requirements.txt`, rồi chạy
`--check` để xác nhận bộ chấm nạp được.

## Vì sao ghim từng phiên bản

Mọi dòng trong `requirements.txt` đều ghim `==`, kể cả phụ thuộc gián tiếp, và mỗi ngoại lệ đều
có chú thích ngay trên dòng ấy. Lý do không phải là sự cẩn thận chung chung mà là một sự cố cụ
thể: `instructor` dựng lược đồ Gemini qua `jsonref` nhưng không kéo gói đó theo extra
`google-genai`. Thiếu nó thì **mọi** lượt chấm ném `ConfigurationError`, và lỗi ấy bị gói lại
thành `PROVIDER_ERROR` — nên nó trông giống hệt một sự cố mạng, và bộ chấm im lặng hỏng trong
một thời gian dài mà không ai nghi ngờ phần cài đặt.

Một `requirements.txt` không ghim sẽ tái tạo đúng loại sự cố đó mỗi lần resolver đổi ý.

## Vì sao eval kiểm virtualenv trước khi chạy

`eval/run-eval.ts` kiểm sự tồn tại của `eval/.venv` và chạy `ragas_score.py --check` **trước**
khi gọi câu hỏi nào. Thứ tự đó có lý do về tiền: chạy hết bộ vàng rồi mới phát hiện không chấm
được nghĩa là đã đốt toàn bộ hạn mức model của lần chạy đó cho một kết quả không dùng được.

Muốn chạy phần tất định mà không cần Python thì dùng `npm run eval -- --skip-score`. Bốn nhóm chỉ
số tính thẳng từ `dataset.jsonl` vẫn chạy đủ, và phần lớn hồi quy thật — truy xuất trượt, từ chối
nhầm, chậm quá ngưỡng — nằm ở đó chứ không nằm ở bốn điểm RAGAS.

## Chạy test của bộ chấm

```bash
npm run test:python
```

Không cần virtualenv: nhóm test này kiểm phần đọc/ghi và phần xác thực đầu vào của
`ragas_score.py`, không gọi model và không cần `ragas`.
