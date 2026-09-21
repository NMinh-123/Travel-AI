# Travel-AI — Triển khai hai hạng mục P0 về evaluation và grounding

Ngày làm việc: 21/09/2026.

## Mục tiêu phiên làm việc

Hiện thực hai hạng mục P0 mà [codex_fix.md](codex_fix.md) đã đánh giá nhưng chưa triển khai:

- Mục 1 — Hoàn thiện evaluation.
- Mục 2 — Làm rõ căn cứ của câu trả lời.

Khác với phiên đánh giá trước, phiên này **có sửa mã ứng dụng, dữ liệu bộ vàng và tài liệu**. Các
mục 3–7 của codex_fix.md chưa động tới.

## Kết quả kiểm tra

- `npm run lint` (`tsc --noEmit`): **pass**.
- `npm test`: **198 tests pass, 14 test files** (trước phiên: 133 tests, 12 files).
- Python tests của bộ chấm: **4 tests pass**.
- Chạy thử toàn tuyến evaluation offline bằng dataset tổng hợp: bản "hệ thống làm đúng" cho
  PASS/exit 0, bản có tiêm lỗi cho FAIL/exit 2 và gọi đúng tên các chiều bị hỏng.
- **Chưa chạy evaluation với model thật.** Việc đó cần database, sidecar embedding và API key;
  mọi con số trong phiên này đến từ dữ liệu tổng hợp hoặc từ unit test.

---

## 1. Hoàn thiện evaluation

### 1.1 Cổng quyết định bằng sáu nhóm chỉ số, không còn một ngưỡng

[eval/gate.ts](eval/gate.ts) chuyển từ một phép so `faithfulness >= 0.8` sang bảng **22 luật**, mỗi
luật có hướng `min`/`max`, một biến môi trường riêng và một khoá đếm cỡ mẫu. 17 luật có ngưỡng
mặc định, 5 luật còn lại chỉ báo cáo.

Hai tính chất đáng nhớ của bảng luật:

- **Luật có cỡ mẫu 0 bị BỎ QUA chứ không FAIL.** Thiếu điều này thì `npm run eval -- --ids GS-001`
  luôn trượt cổng, vì một lần chạy thử một câu trong phạm vi không có câu ngoài phạm vi nào và
  `correct_refusal_rate` bằng 0 theo định nghĩa.
- **Ngưỡng chỉnh bằng biến môi trường, không sửa mã.** `EVAL_MIN_*`, `EVAL_MAX_*`, và
  `EVAL_GATE_OFF=<khoá,khoá>` để tắt hẳn một luật.

| Tầng | Chỉ số | Tính ở đâu |
| --- | --- | --- |
| Nhận diện ý định | Macro-F1 theo intent, độ chính xác slot | [eval/metrics/intent.ts](eval/metrics/intent.ts) |
| Truy xuất | Recall@k, Precision@k, MRR, nDCG@k, tỷ lệ truy xuất rỗng | [eval/metrics/retrieval.ts](eval/metrics/retrieval.ts) |
| Câu trả lời | faithfulness, answer_relevancy, context_precision, context_recall | [eval/score/ragas_score.py](eval/score/ragas_score.py) |
| Căn cứ | Tỷ lệ dẫn được nguồn, dữ kiện số không kiểm được, độ chính xác nguồn | [eval/metrics/grounding.ts](eval/metrics/grounding.ts) |
| Hội thoại | Giữ slot, ghi đè slot, hỏi lặp, hoàn thành yêu cầu | [eval/metrics/conversation.ts](eval/metrics/conversation.ts) |
| Từ chối/chuyển tiếp | Từ chối đúng lý do, từ chối nhầm, chuyển tiếp do lỗi hạ tầng | [eval/metrics/refusal.ts](eval/metrics/refusal.ts) |
| Vận hành | p50/p95 độ trễ, token, số lần gọi lại | [eval/metrics/operational.ts](eval/metrics/operational.ts) |

Năm nhóm tất định tính thẳng từ `dataset.jsonl`, không tốn một lượt gọi model nào. Vì vậy
`--skip-score` vẫn ra được phán quyết: phần lớn hồi quy thật — truy xuất trượt, từ chối nhầm,
chậm quá ngưỡng — không cần bộ chấm mới phát hiện được.

### 1.2 "Có chuyển tiếp" không còn được tính là "từ chối đúng"

Đây là lỗ hổng nghiêm trọng nhất của bản cũ. Khi một tác tử ném lỗi, orchestrator cũng chuyển sang
support với lý do `OUT_OF_SCOPE`. Nghĩa là một hệ thống hỏng toàn bộ — mất API key, sập sidecar,
hết hạn mức — sẽ chuyển tiếp mọi lượt và đạt 100% "từ chối đúng", đúng lúc nó tệ nhất.

[eval/metrics/refusal.ts](eval/metrics/refusal.ts) chỉ tính một lượt từ chối là ĐÚNG khi hội đủ ba
điều: có chuyển tiếp, lý do khớp nhãn `expected_escalation_reason`, và trace không có nút
`agent.threw`. Lượt chuyển tiếp vì lỗi được đếm riêng thành `infra_escalation_rate` — chỉ số vận
hành, không phải điểm cộng. Đối trọng là `false_refusal_rate` trên câu hợp lệ: hai chỉ số phải đọc
cùng nhau, vì đẩy một cái lên bằng cách nới ngưỡng thì cái kia xấu đi.

Phán quyết từ chối đã **chuyển hẳn khỏi Python sang TypeScript**, vì chỉ phía TypeScript đọc được
trace. `scores.json` không còn trường `refusal_pass`.

### 1.3 Chỉ số truy xuất tính trực tiếp từ `expected_docs`

Recall@k, Precision@k, MRR, nDCG@k và tỷ lệ truy xuất rỗng, không qua model chấm. Hai chi tiết hay
bị làm sai:

- **Khử trùng lặp `sourceRef` giữ nguyên thứ hạng.** Một tài liệu nguồn bị cắt thành nhiều đoạn nên
  cùng một `sourceRef` xuất hiện nhiều lần; không khử thì Recall@5 đọc "5 đoạn" thành "5 tài liệu".
- **Precision@k chia cho số tài liệu THỰC SỰ trích dẫn, không chia cho k.** Trích 2 tài liệu và cả
  hai đều đúng là chính xác 100%; chia cho k biến nó thành 40% một cách vô nghĩa.

### 1.4 Hội thoại nhiều lượt

`runCase` trong [eval/run-eval.ts](eval/run-eval.ts) chạy các lượt nối tiếp nhau, mang theo slot và
lịch sử. Với câu đơn lượt thì kết quả y hệt cách cũ; với kịch bản nhiều lượt thì cách cũ không bao
giờ chạm tới vòng lặp hỏi bổ sung của Dialog Manager.

[eval/metrics/conversation.ts](eval/metrics/conversation.ts) tách **giữ slot** khỏi **ghi đè slot**
vì chúng hỏng ngược nhau: một bộ gộp slot ghi đè tất cả và một bộ chỉ cộng dồn đều sai đúng một
nửa số cặp. Kịch bản mẫu `Đi 3 ngày` → `4 người` → `Đổi thành 2 ngày` là GS-182.

### 1.5 Tách model chấm khỏi model sinh

`EVAL_JUDGE_MODEL` đặt model chấm khác model sinh. Khi hai bên trùng nhau, `meta.json` ghi
`self_judging_bias: true` và bản tóm tắt nói rõ thay vì im lặng. `scores.json` giờ bắt buộc ghi
`judge_model`, và run-eval từ chối file điểm ghi model khác model đã yêu cầu.

### 1.6 Bộ vàng: 30 → 198 kịch bản

[eval/golden/ha-giang.jsonl](eval/golden/ha-giang.jsonl), một dòng JSON là một KỊCH BẢN chứ không
nhất thiết là một câu hỏi.

| Chiều | Phân bố |
| --- | --- |
| Dạng | qa 155 · refusal 26 · conversation 17 |
| Tập | dev 134 · holdout 64 |
| Biến thể | clean 173 · no_diacritics 6 · typo 6 · near_miss_place 8 · underspecified 5 |
| Lý do chuyển tiếp | OUT_OF_SCOPE 15 · USER_REQUEST 5 · COMPLAINT 3 · LOW_CONFIDENCE 3 |
| Độ phủ tri thức | 131/162 tài liệu trong `data/knowledge/` |

Quy ước tập: đọc, phân tích lỗi và vặn prompt CHỈ trên `dev`; `holdout` chạy để lấy con số báo cáo.

Nhóm `near_miss_place` cố tình trộn hai chiều: địa danh Hà Giang viết lệch (Mã Pì Lèng, Nậm Đăm,
Phó Bảng — phải trả lời được) và nơi khác mang tên na ná (Mù Cang Chải, Ô Quy Hồ, chợ tình Sa Pa,
đèo Mã Phục — phải bị từ chối). Hệ thống chỉ giỏi một chiều thì lộ ngay qua cột từ chối nhầm.

[eval/golden/schema.ts](eval/golden/schema.ts) chặn nhãn tự mâu thuẫn ngay khi đọc file: nguồn
không có thật, câu trong phạm vi mang lý do chuyển tiếp, kịch bản từ chối thiếu lý do, nhãn
`no_diacritics` mà câu vẫn có dấu. Nhãn tự mâu thuẫn là kiểu hỏng khó thấy nhất của một bộ vàng vì
chỉ số tính ra vẫn có vẻ hợp lệ.

### 1.7 Cắt bớt khi chạy thử lấy cách đều

`--limit` mặc định 30 nên KHÔNG chạy hết bộ vàng. Bộ vàng xếp theo nhóm, nên `slice(0, 30)` chỉ ra
toàn câu ẩm thực: một lần chạy thử như vậy không chạm tới kịch bản từ chối lẫn kịch bản hội thoại,
và bảng cổng bỏ qua đúng những luật đáng xem nhất trong khi vẫn in chữ PASS. `sample()` trong
[eval/options.ts](eval/options.ts) lấy cách đều, và run-eval cảnh báo rõ khi có cắt bớt.

---

## 2. Làm rõ căn cứ của câu trả lời

### 2.1 Chứng cứ là đối tượng có mã, không còn là một chuỗi

[server/domain/agents/grounding.ts](server/domain/agents/grounding.ts) định nghĩa `EvidenceBlock`:
mọi thứ đưa vào lời nhắc đều có mã (`K1`, `W1`, `B1`), nhãn, nội dung và `sourceRef`. Danh sách
chứng cứ là nguồn sự thật duy nhất cho ba việc từng dùng ba nguồn khác nhau: dựng lời nhắc, đối
chiếu mã model khai, và ghi ngữ cảnh cho bộ đo.

Nội dung chứng cứ **không kèm chỉ dẫn trình bày**. Bản cũ gộp số đo thời tiết và câu lệnh "hãy mở
đầu bằng một dòng tóm tắt" vào cùng một chuỗi, nên không có cách nào nói đâu là bằng chứng: bộ đo
lấy nguyên chuỗi đó làm ngữ cảnh chấm faithfulness, và lớp đối chiếu số coi mọi con số trong phần
ví dụ của chỉ dẫn ("Thời tiết Đồng Văn: 24,5°C") là số liệu thật.

### 2.2 Ba lớp kiểm chạy bằng code

1. **`verifyCitations`** — model khai nguồn theo từng ý qua `GROUNDED_CHAT_RESPONSE_SCHEMA`
   ([server/domain/prompts.ts](server/domain/prompts.ts)), rồi mã khai ra được đối chiếu với danh
   sách chứng cứ thật. Mã bịa bị loại, ý không có nguồn bị đếm. Phép kiểm này rẻ nhưng bắt đúng
   kiểu hỏng nguy hiểm nhất của lối trích dẫn do model tự khai: model học được rằng câu trả lời nên
   có nguồn, nên nó gắn nguồn kể cả khi không có nguồn nào.
2. **`checkNumericFacts`** — quét mọi con số **có đơn vị** trong câu trả lời và tìm chỗ chống lưng
   trong chứng cứ. Đây là lớp bắt "ảo giác số" mà hai lớp kia không thấy: model hoàn toàn có thể
   dẫn đúng nguồn rồi viết sai con số trong chính nguồn ấy.
3. **`resolveGrounding`** — chốt trạng thái từ ba tín hiệu.

Chi tiết của lớp đối chiếu số:

- Chỉ kiểm **giá, nhiệt độ, khoảng cách và tốc độ**. Số ngày, số người đến từ slot của khách chứ
  không từ chứng cứ; phần trăm độ ẩm hay lượng mưa sai lệch do làm tròn thì gần như vô hại.
- Đọc số kiểu Việt: `1.250.000` là một triệu hai trăm năm mươi nghìn, `24,5` là hai tư phẩy năm.
- Hiểu dải: chứng cứ ghi `18–24°C` thì mọi giá trị trong dải đều được chống lưng.
- Biên sai số theo nhóm: tiền 1% (vì lời nhắc yêu cầu giữ nguyên từng con số), nhiệt độ 0,5°C (vì
  viết lại cho người đọc thì phải làm tròn).
- **Chứng cứ gồm cả tri thức biên tập lẫn kết quả tool.** Câu "quãng đường 300 km" lấy từ cẩm nang
  có căn cứ đúng như con số 24,5°C lấy từ Open-Meteo; điều duy nhất bị cấm là một con số không có
  ở đâu cả.

Trong lúc viết test đã bắt được một lỗi thật: `45 km/h` bị đếm hai lần thành cả tốc độ lẫn quãng
đường 45 km, sinh ra một "dữ kiện không có căn cứ" hoàn toàn ma. Đã sửa bằng cách đánh dấu đoạn văn
bản đã dùng khi quét.

### 2.3 Năm trạng thái thay cho một cờ nhị phân

`grounded: reply.length > 0` biến mất. `AgentResult.grounding` giờ là:

| Trạng thái | Nghĩa | Guardrail |
| --- | --- | --- |
| `grounded` | Có chứng cứ, dẫn được nguồn, mọi dữ kiện số đối chiếu được | cho qua |
| `insufficient` | Chứng cứ không đủ, hoặc câu trả lời không dẫn được nguồn nào | chặn (chỉ tác tử tri thức) |
| `unsupported` | Câu trả lời nêu dữ kiện số không có trong chứng cứ | **chặn ở mọi tác tử** |
| `tool_failed` | Dữ kiện phải lấy từ tool mà tool hỏng | **cho qua** |
| `no_source` | Không tìm được chứng cứ nào | chặn (chỉ tác tử tri thức) |

Hai quyết định về phạm vi:

- **`tool_failed` cố ý không bị chặn.** Open-Meteo hỏng thì câu trả lời đúng là nói với khách rằng
  chưa tra được thời tiết, không phải chuyển tiếp sang người thật với lý do ngoài phạm vi. Gộp hai
  thứ đó là cách một sự cố hạ tầng bị ghi nhận thành một câu hỏi khó.
- **`insufficient`/`no_source` chỉ áp cho tác tử tri thức**, giữ nguyên phạm vi cũ của phép kiểm
  `ungrounded`: bốn tác tử còn lại lấy dữ liệu thẳng từ database hoặc từ máy tính chi phí, và một
  danh mục rỗng ở đó là câu trả lời hợp lệ chứ không phải câu không có căn cứ.
- **`unsupported` áp cho mọi tác tử.** Tác tử ngân sách cần nó nhất: lời nhắc ở đó yêu cầu giữ
  nguyên từng con số, nên một con số lệch là dấu hiệu model đã tự tính lại.

### 2.4 `retrievedDocIds` tách khỏi `citedDocIds`

`AgentResult` và `TurnTrace` mang cả hai, cộng `evidence` và `unsupportedFacts`. `citedDocIds` giờ
chỉ chứa đoạn ĐÃ ĐƯỢC DẪN và đã đối chiếu, không còn là toàn bộ kết quả truy xuất.

### 2.5 Evaluation lưu đúng ngữ cảnh model đã thấy

`dataset.jsonl` lấy `contexts` thẳng từ `trace.evidence` thay vì tra ngược `citedDocIds` rồi đọc
lại KnowledgeDoc từ database. Cách cũ sai hai chỗ:

- Bỏ mất số liệu tool. Một câu trả lời về thời tiết bị chấm faithfulness so với mấy đoạn văn bản,
  còn khối số đo quyết định câu trả lời thì không có trong ngữ cảnh.
- Nội dung trong database có thể đã đổi sau lần chạy, nên cùng một dataset chấm lại hai lần có thể
  ra hai kết quả.

`retrieved_docs` chỉ lấy chứng cứ tri thức — khối thời tiết mang khoá nhà cung cấp chứ không phải
một tài liệu trong bộ vàng, gộp vào sẽ kéo Precision@k xuống vô nghĩa. `cited_docs` là tập con đã
được câu trả lời thật sự dẫn.

---

## 3. Hai lỗi có sẵn phát hiện trong phiên

### 3.1 Bộ chấm RAGAS không chạy được vì thiếu gói phụ thuộc

`eval/.venv` thiếu `jsonref`. `instructor` 2.x dựng schema Gemini qua gói này nhưng KHÔNG kéo nó
theo extra `google-genai`. Hệ quả: mọi lượt chấm ném `ConfigurationError`, và lỗi đó bị gói lại
thành `PROVIDER_ERROR` nên **nhìn giống lỗi mạng chứ không giống lỗi cài đặt**. Đã ghim vào
[eval/score/requirements.txt](eval/score/requirements.txt) và cài; 4 test Python xanh trở lại.

### 3.2 `tsconfig.json` có dòng làm hỏng build

Trong phiên xuất hiện `"ignoreDeprecations": "6.0"` trong [tsconfig.json](tsconfig.json). Giá trị
đó chỉ hợp lệ với TypeScript 6.x, còn dự án ghim `~5.8`, nên `npm run lint` và `npm run build` hỏng
hoàn toàn với `error TS5103`. Đã gỡ. Nếu nó đến từ một công cụ đang chạy song song thì cần tắt, vì
nó sẽ quay lại.

---

## 4. Rủi ro đã biết và việc còn lại

### 4.1 Tỷ lệ từ chối nhầm nhiều khả năng tăng — có chủ đích

Model không khai được trích dẫn thì `insufficient` → guardrail chặn → chuyển tiếp. Nguyên nhân hay
gặp nhất không phải model lười mà là **điểm cuối không thực thi `responseSchema`** — chính vấn đề
đã ghi trong `generateStructured` và là lý do có nhánh cứu văn xuôi. Nhánh đó dựng lại
`{reply, suggestions}` **không kèm `citations`**, nên trên proxy, một câu trả lời hợp lý vẫn bị
chặn.

Đây là hành vi ĐÚNG theo hợp đồng mới (không chứng minh được nguồn thì không hiển thị), nhưng phải
đo trước khi kết luận. Đã thêm một cảnh báo log riêng trong tác tử tri thức để phân biệt nó với
"câu hỏi ngoài phạm vi". Con số thật lấy bằng `false_refusal_rate` trên bộ vàng.

### 4.2 Bộ vàng chưa được người duyệt nội dung

168 kịch bản mới được soạn bám theo `data/knowledge/`, nhưng phần duyệt nội dung vẫn là việc của
người phụ trách dữ liệu. Đây là lý do codex_fix.md ghi "150–200 tình huống **được duyệt**".

### 4.3 Một chỗ đặt tên lệch nghĩa trong mã hiện tại

Câu ngoài phạm vi không nêu địa danh đi vào `runSupport(context, "COMPLAINT")`, tức được ghi là
"khiếu nại". 3 kịch bản trong bộ vàng đã gắn nhãn theo hành vi hiện tại kèm ghi chú. Nếu đo ra
`LOW_CONFIDENCE` thì nghĩa là ngưỡng tin cậy đang chặn trước bộ phân loại — cũng là một phát hiện
thật.

Liên quan: enum `EscalationReason` trong Prisma chưa có giá trị nào cho ảo giác, nên `unsupported`
hiện ánh xạ sang `OUT_OF_SCOPE`. Lý do chính xác không mất — nó nằm ở nút guardrail trong trace
cùng danh sách dữ kiện không kiểm được. Thêm một giá trị enum là một migration cơ sở dữ liệu, chưa
làm trong phiên này.

### 4.4 Ngưỡng cổng chưa hiệu chỉnh

17 ngưỡng mặc định là **điểm khởi đầu để bắt hồi quy và hỏng hóc**, không phải mục tiêu chất lượng
đã chứng minh — cùng tinh thần với ghi chú ở `MIN_INTENT_CONFIDENCE`. Riêng `p95_latency_ms = 3000`
lấy từ NFR-PERF-03 chứ không phải con số đoán.

### 4.5 Độ phủ ý định còn mỏng ở hai lớp

`discovery` có 1 mẫu và `budget` có 2 trong bộ vàng, nên macro-F1 của hai lớp đó sẽ rất nhiễu. Cần
bổ sung kịch bản trước khi đọc con số của chúng một cách nghiêm túc.

---

## 5. Danh sách file

### File mới

| File | Vai trò |
| --- | --- |
| [server/domain/agents/grounding.ts](server/domain/agents/grounding.ts) | Chứng cứ, xác thực trích dẫn, đối chiếu dữ kiện số |
| [server/domain/agents/grounding.test.ts](server/domain/agents/grounding.test.ts) | Test cho ba lớp kiểm và cho guardrail |
| [eval/dataset.ts](eval/dataset.ts) | Hình dạng và bộ xác thực của `dataset.jsonl` |
| [eval/report.ts](eval/report.ts) | Gộp các nhóm chỉ số thành báo cáo và phán quyết |
| [eval/metrics/](eval/metrics/) | Sáu module chỉ số tất định, fixture và test |
| [eval/README.md](eval/README.md) | Hướng dẫn chạy và diễn giải bộ đo |

### File sửa chính

`eval/`: [gate.ts](eval/gate.ts), [run-eval.ts](eval/run-eval.ts), [options.ts](eval/options.ts),
[golden/schema.ts](eval/golden/schema.ts), [golden/ha-giang.jsonl](eval/golden/ha-giang.jsonl),
[score/ragas_score.py](eval/score/ragas_score.py), [score/requirements.txt](eval/score/requirements.txt)
cùng các file test tương ứng.

`server/`: [domain/agents/types.ts](server/domain/agents/types.ts),
[domain/agents/guardrail.ts](server/domain/agents/guardrail.ts),
[domain/agents/orchestrator.ts](server/domain/agents/orchestrator.ts),
[domain/prompts.ts](server/domain/prompts.ts),
[infra/gemini.ts](server/infra/gemini.ts) (thêm `retries` vào `CallMetrics`),
và cả năm specialist trong [domain/agents/specialists/](server/domain/agents/specialists/).

Khác: [scripts/trace-format.ts](scripts/trace-format.ts), [README.md](README.md),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> Workspace có sẵn nhiều thay đổi từ trước phiên (`docs/history.md`, `scripts/crawl-web.ts`,
> `server/domain/agents/specialists/shared.ts`, thư mục `.ua/`…). Những file đó không thuộc phiên
> này.

---

## 6. Bước tiếp theo

1. `npm run eval -- --split dev` để lấy số nền cho toàn bộ bảng cổng, đặc biệt là
   `false_refusal_rate` và hai luật mới về căn cứ.
2. Hiệu chỉnh ngưỡng bằng biến môi trường dựa trên số nền đó, giữ `holdout` không bị nhìn trước.
3. Người phụ trách dữ liệu duyệt 168 kịch bản mới của bộ vàng.
4. Bổ sung kịch bản cho hai ý định `discovery` và `budget`.
5. Cân nhắc thêm giá trị enum `EscalationReason` cho trường hợp ảo giác, kèm migration.
6. Các mục 3–7 của [codex_fix.md](codex_fix.md) vẫn còn nguyên, theo đúng thứ tự đã đề xuất ở đó.

## Trạng thái bàn giao

- Đã triển khai đầy đủ mục 1 và mục 2 của codex_fix.md.
- `tsc --noEmit` sạch; 198 test TypeScript và 4 test Python đều pass.
- Đã chạy thử toàn tuyến evaluation offline theo cả hai chiều PASS và FAIL.
- Chưa chạy evaluation với model thật, chưa thay đổi database, chưa động tới mục 3–7.
