# Đánh giá chất lượng trợ lý

Bộ đo chạy hệ thống thật trên một bộ vàng đã duyệt, rồi ra một phán quyết PASS/FAIL duy nhất.

```bash
npm run eval -- --help
npm run eval -- --split dev --limit 20      # vặn prompt và ngưỡng trên tập này
npm run eval -- --split holdout             # con số báo cáo, chạy sau khi đã chốt thay đổi
npm run eval -- --results eval/results/<mốc>  # áp lại cổng từ kết quả cũ, không gọi model
```

Mỗi lần chạy ghi ra một thư mục mới trong `eval/results/`, không bao giờ ghi đè:

| File            | Nội dung                                                             |
| --------------- | -------------------------------------------------------------------- |
| `dataset.jsonl` | Nhật ký thô: một dòng mỗi kịch bản, có đủ từng lượt và từng nút trace |
| `scores.json`   | Bốn điểm RAGAS, do bộ chấm Python ghi                                 |
| `metrics.json`  | Toàn bộ chỉ số đã tính, dạng máy đọc                                  |
| `summary.md`    | Bản cho người đọc, kèm bảng cổng và các bảng phân rã                  |
| `meta.json`     | Revision, model sinh, model chấm, ngưỡng, trạng thái                  |

## Năm tầng được đo

| Tầng               | Chỉ số                                                            | Tính ở đâu                 |
| ------------------ | ----------------------------------------------------------------- | -------------------------- |
| Nhận diện ý định   | Macro-F1 theo intent, độ chính xác slot                            | `metrics/intent.ts`        |
| Truy xuất          | Recall@k, Precision@k, MRR, nDCG@k, tỷ lệ truy xuất rỗng            | `metrics/retrieval.ts`     |
| Câu trả lời        | faithfulness, answer_relevancy, context_precision, context_recall  | `score/ragas_score.py`     |
| Căn cứ             | Tỷ lệ dẫn được nguồn, dữ kiện số không kiểm được, độ chính xác nguồn | `metrics/grounding.ts`    |
| Hội thoại          | Giữ slot, ghi đè slot, hỏi lặp, hoàn thành yêu cầu                 | `metrics/conversation.ts`  |
| Từ chối/chuyển tiếp| Từ chối đúng lý do, từ chối nhầm, chuyển tiếp do lỗi hạ tầng       | `metrics/refusal.ts`       |
| Vận hành           | p50/p95 độ trễ, token, số lần gọi lại                              | `metrics/operational.ts`   |

Bốn tầng tất định tính thẳng từ `dataset.jsonl`, không tốn một lượt gọi model nào. Vì vậy
`--skip-score` vẫn ra được phán quyết: phần lớn hồi quy thật — truy xuất trượt, từ chối nhầm,
chậm quá ngưỡng — không cần bộ chấm mới phát hiện được.

### Ngữ cảnh ghi lại là ngữ cảnh model ĐÃ THẤY

`dataset.jsonl` lấy `contexts` thẳng từ `trace.evidence` — đúng các khối chứng cứ đã đưa vào lời
nhắc, gồm cả số liệu tool — chứ không đọc lại KnowledgeDoc từ database. Cách cũ sai ở hai chỗ:
một câu trả lời về thời tiết bị chấm faithfulness so với mấy đoạn văn bản trong khi khối số đo
quyết định câu trả lời lại không có trong ngữ cảnh, và nội dung trong database đổi sau lần chạy
thì cùng một dataset chấm lại hai lần ra hai kết quả.

`retrieved_docs` chỉ lấy chứng cứ TRI THỨC, vì khối thời tiết mang khoá nhà cung cấp chứ không
phải một tài liệu trong bộ vàng; gộp nó vào sẽ kéo Precision@k xuống một cách vô nghĩa.
`cited_docs` là tập con đã được câu trả lời thật sự dẫn.

### Vì sao "có chuyển tiếp" không phải là "từ chối đúng"

Khi một tác tử ném lỗi, orchestrator cũng chuyển sang support với lý do `OUT_OF_SCOPE`. Nghĩa là
một hệ thống hỏng toàn bộ — mất API key, sập sidecar, hết hạn mức — sẽ chuyển tiếp mọi lượt và
đạt 100% nếu chỉ đếm `escalated === true`. Nên một lượt từ chối chỉ được tính là ĐÚNG khi hội đủ
ba điều: có chuyển tiếp, lý do khớp nhãn `expected_escalation_reason`, và trace không có nút
`agent.threw`. Lượt chuyển tiếp vì lỗi được đếm riêng thành `infra_escalation_rate`.

Đối trọng của chỉ số đó là `false_refusal_rate` trên câu hợp lệ. Hai chỉ số này phải đọc cùng
nhau: đẩy một cái lên bằng cách nới ngưỡng thì cái kia xấu đi.

## Cổng

`gate.ts` giữ một bảng luật; mỗi luật có hướng `min`/`max`, một ngưỡng mặc định và một khoá đếm
cỡ mẫu. **Luật có cỡ mẫu 0 bị bỏ qua chứ không FAIL** — nhờ vậy `--ids GS-001` không bị báo là
hồi quy chỉ vì lần chạy đó không có câu ngoài phạm vi nào.

Ngưỡng đặt qua biến môi trường, không sửa mã:

```bash
EVAL_MIN_FAITHFULNESS=0.85 npm run eval -- --split holdout
EVAL_MAX_P95_LATENCY_MS=4000 npm run eval
EVAL_GATE_OFF=retrieval.mrr,conversation.repeat_ask_rate npm run eval   # tắt hẳn một luật
```

Các ngưỡng mặc định là điểm khởi đầu để bắt hồi quy và hỏng hóc, **không phải mục tiêu chất
lượng đã hiệu chỉnh**. Hiệu chỉnh trên `dev` rồi siết bằng biến môi trường, để `holdout` không bị
nhìn trước. Riêng `p95_latency_ms = 3000` là NFR-PERF-03 chốt sẵn chứ không phải con số đoán.

## Bộ vàng

`golden/ha-giang.jsonl`, một dòng JSON là một KỊCH BẢN. Ba dạng theo `kind`:

- `qa` — một câu hỏi trong phạm vi, bắt buộc có `expected_docs`.
- `refusal` — câu phải bị từ chối, bắt buộc có `expected_escalation_reason`.
- `conversation` — từ hai lượt trở lên, mỗi lượt có thể mang `expected_slots`.

`split` chia `dev` và `holdout`. Quy ước: đọc, phân tích lỗi và vặn prompt CHỈ trên `dev`.

`variant` ghi kiểu nhiễu của câu hỏi — `clean`, `no_diacritics`, `typo`, `near_miss_place`,
`underspecified`. Nó không đổi cách chấm, chỉ để bảng phân rã chỉ ra hệ thống hỏng ở nhóm đầu vào
nào. `near_miss_place` cố tình trộn hai chiều: địa danh Hà Giang viết lệch (phải trả lời được) và
nơi khác mang tên na ná (phải từ chối). Hệ thống chỉ giỏi một chiều thì thấy ngay qua cột từ chối
nhầm.

`golden/schema.ts` chặn nhãn tự mâu thuẫn ngay khi đọc file — nguồn không có thật, câu trong phạm
vi mang lý do chuyển tiếp, nhãn `no_diacritics` mà câu vẫn có dấu. Nhãn tự mâu thuẫn là kiểu hỏng
khó thấy nhất của một bộ vàng vì chỉ số tính ra vẫn có vẻ hợp lệ.

## Giữ tập holdout còn giá trị

Tập giữ riêng chỉ đáng tin chừng nào nó còn LẠ với hệ thống, và nó mất tính chất đó rất dễ — không
lệnh nào báo lỗi, không test nào đỏ, chỉ có điểm số đẹp lên một cách không giải thích được.

`npm run eval:leakage` soát bốn đường rò mà mã tự canh được:

| Báo | Mức | Nghĩa |
| --- | --- | --- |
| `DUPLICATE_QUESTION` | chặn | Cùng một câu (kể cả chỉ khác dấu) ở cả hai tập |
| `NEAR_DUPLICATE` | cảnh báo | Trùng ≥80% từ vựng với một câu ở `dev` |
| `REFERENCE_COPIED` | cảnh báo | Quá nửa đáp án mẫu là một đoạn lấy nguyên từ nguồn |
| `SHARED_LABEL` | cảnh báo | Cùng nhãn tài liệu VÀ cùng chủ đề với một câu ở `dev` |

Nhóm chặn cũng là một bài trong `npm test`, nên một lần sao chép nhầm giữa hai tập không thể lọt
vào nhánh chính.

**Bốn quy ước còn lại mã không canh được**, và chúng quan trọng không kém:

1. **Chỉ vặn ngưỡng trên `dev`.** Ngưỡng đặt qua biến môi trường chứ không sửa `gate.ts`, đúng để
   không ai vặn theo con số vừa thấy ở `holdout`.
2. **Không đọc từng câu `holdout` để phân tích lỗi.** Nhìn một câu là học thuộc nó. Phân tích lỗi
   làm trên `dev`; `holdout` chỉ đọc con số tổng.
3. **`expected_docs` phải gán TRƯỚC khi xem kết quả truy xuất.** Gán sau khi nhìn kết quả là chép
   lại đầu ra của hệ thống rồi chấm hệ thống bằng chính đầu ra ấy.
4. **Đáp án mẫu viết bằng lời người soạn.** `REFERENCE_COPIED` bắt được ca nặng, nhưng một đáp án
   chép ý mà đổi chữ thì nó không thấy.

**Đã biết, chưa sửa:** 15 trên 53 kịch bản `holdout` có nhãn — và 30 trên 108 ở `dev` — đang bị
`REFERENCE_COPIED`. Chúng cần viết lại bằng lời người soạn. Ảnh hưởng bị chặn ở một chỗ:
`reference` chỉ được RAGAS dùng cho `context_precision` và `context_recall`, nên hai chỉ số đó
đang cao hơn thực tế, còn `faithfulness`, `answer_relevancy` và toàn bộ nhóm chỉ số tất định không
đọc trường này.

## Model chấm

Đặt `EVAL_JUDGE_MODEL` sang một model khác model sinh. Cùng một model vừa viết câu trả lời vừa
chấm câu trả lời của chính nó thì faithfulness nói về mức nhất quán nội bộ của model chứ không
nói về mức bám nguồn. Khi hai bên trùng nhau, `meta.json` ghi `self_judging_bias: true` và bản
tóm tắt nói rõ điều đó thay vì im lặng.

## Cài bộ chấm Python

```bash
npm run eval:setup    # dựng eval/.venv, cài đúng bộ đã ghim, rồi xác nhận bộ chấm nạp được
npm run test:python   # test của bộ chấm; không cần venv và không gọi model
```

Chi tiết và lý do ghim từng phiên bản: [score/README.md](score/README.md).

Bộ chấm cần sidecar embedding đang chạy và `EMBEDDER=bge-m3`; run-eval kiểm cả hai trước khi gọi
model, để không tốn lượt gọi rồi mới hỏng.
