# Travel-AI — Đánh giá codebase và kế hoạch cải tiến

Ngày làm việc: 21/09/2026.

## Mục tiêu phiên làm việc

Đọc codebase dưới góc nhìn AI engineer và software engineer, đề xuất chỉnh sửa về dữ liệu, kiểm thử, evaluation và chất lượng hệ thống. Tài liệu này lưu kết quả đánh giá và hướng triển khai; các đề xuất bên dưới chưa được thực hiện trong phiên.

Phạm vi đã đọc: cấu trúc dự án, dữ liệu, pipeline ingest, RAG, điều phối agent, sinh lịch trình, API chat, cấu hình TypeScript và pipeline evaluation.

## Hiện trạng và kết quả kiểm tra

- Stack: React/Vite, Express/TypeScript, PostgreSQL/pgvector qua Prisma, Gemini và sidecar Python BGE-M3.
- Đã có tìm kiếm lai vector + keyword, RRF, reranker tùy chọn, bộ định tuyến hội thoại, dữ liệu có xuất xứ và pipeline RAGAS.
- `npm test`: **133 tests pass, 12 test files**.
- `npm run lint`: **pass**. Lệnh này chạy `tsc --noEmit`, tức kiểm tra kiểu TypeScript.
- Chưa chạy evaluation với model thật, Python tests, build hoặc kiểm thử tích hợp database trong phiên này.
- Chưa có kết luận định lượng về chất lượng AI thực tế.
- Workspace có nhiều thay đổi tồn tại sẵn. Phiên đánh giá không chỉnh sửa code ứng dụng hay dữ liệu.

**Định hướng chính:** làm chất lượng đầu ra đo được và kiểm chứng được trước khi mở rộng agent hoặc dữ liệu.

## 1. Hoàn thiện evaluation — P0

File liên quan:

- [eval/gate.ts](eval/gate.ts)
- [eval/run-eval.ts](eval/run-eval.ts)
- [eval/golden/schema.ts](eval/golden/schema.ts)
- [eval/golden/ha-giang.jsonl](eval/golden/ha-giang.jsonl)
- [eval/score/ragas_score.py](eval/score/ragas_score.py)

### Phát hiện

- Bộ vàng hiện có 30 câu: food 4, attraction 9, destination 6, travel_guide 2, accommodation 2, policy 1, seasonal_recommendation 1 và out_of_scope 5.
- Gate mặc định chỉ yêu cầu `faithfulness >= 0.8`. Các ngưỡng RAGAS khác có thể cấu hình nhưng mặc định chưa bật.
- Kết quả từ chối câu ngoài phạm vi được báo cáo nhưng không quyết định PASS/FAIL của gate.
- Scorer xem `escalated=true` là từ chối thành công; chưa phân biệt chuyển tiếp đúng vì ngoài phạm vi với chuyển tiếp do lỗi hạ tầng.
- Có nhãn `expected_docs`, nhưng chưa tính trực tiếp Recall@k, MRR hoặc nDCG từ nhãn này.
- Mỗi câu chạy với `slots: {}` và `history: []`, nên chưa đánh giá hội thoại nhiều lượt.
- Model chấm dùng cùng model cấu hình cho sinh nội dung; metadata đã ghi nhận thiên lệch tự chấm.

### Đề xuất

| Lớp đánh giá | Chỉ số cần bổ sung |
| --- | --- |
| Nhận diện ý định | Macro-F1 theo intent, độ chính xác slot |
| Truy xuất | Recall@5, MRR, tỷ lệ truy xuất rỗng |
| Câu trả lời | Faithfulness, độ đúng nội dung, độ chính xác trích dẫn |
| Hội thoại | Hoàn thành yêu cầu, hỏi lặp, mất hoặc ghi đè slot |
| Từ chối/chuyển tiếp | Đúng lý do, từ chối nhầm câu hợp lệ |
| Vận hành | p50/p95 latency, token, số lần retry |

- Bổ sung gate cho câu ngoài phạm vi và báo cáo lỗi theo nguyên nhân.
- Mở bộ vàng lên khoảng 150–200 tình huống được duyệt. Đây là quy mô đề xuất, chưa phải dữ liệu đã có.
- Tách tập dùng để tinh chỉnh khỏi tập kiểm tra giữ riêng.
- Bổ sung tiếng Việt không dấu, lỗi gõ, tên địa danh gần giống, câu thiếu thông tin và hội thoại sửa yêu cầu.
- Hiệu chỉnh ngưỡng sau khi đo baseline; tránh xem ngưỡng đề xuất là kết quả đã chứng minh.

Ví dụ hội thoại: “Đi 3 ngày” → “4 người” → “Đổi thành 2 ngày” phải giữ số người và cập nhật đúng số ngày.

## 2. Làm rõ căn cứ của câu trả lời — P0

File liên quan:

- [server/domain/agents/specialists/knowledge.ts](server/domain/agents/specialists/knowledge.ts)
- [server/domain/agents/guardrail.ts](server/domain/agents/guardrail.ts)

### Phát hiện

Kết quả của specialist knowledge đang đặt:

```ts
grounded: reply.length > 0
citedDocIds: chunks.map((chunk) => chunk.id)
```

Câu trả lời không rỗng được đánh dấu grounded; toàn bộ chunk truy xuất được xem là tài liệu trích dẫn. Điều này chưa chứng minh nội dung câu trả lời được nguồn hỗ trợ. Guardrail hiện chủ yếu kiểm tra câu trả lời rỗng, placeholder PII và cờ grounded.

Dataset evaluation chủ yếu lấy nội dung `KnowledgeDoc`, chưa phản ánh đầy đủ ngữ cảnh từ tool thời tiết mà model có thể đã sử dụng.

### Đề xuất

- Tách `retrievedDocIds` khỏi `citedDocIds`.
- Cho model trả tham chiếu nguồn theo từng ý hoặc đoạn trả lời.
- Kiểm tra ID trích dẫn thuộc nguồn thực sự đưa vào prompt.
- Với giá, thời tiết, khoảng cách: đối chiếu dữ kiện với kết quả tool bằng code.
- Phân biệt trạng thái “có nguồn”, “nguồn không đủ trả lời” và “tool gặp lỗi”.
- Evaluation cần lưu đúng ngữ cảnh model đã thấy, bao gồm kết quả tool.

## 3. Hoàn thiện dữ liệu và pipeline ingest — P1

File liên quan:

- [data/knowledge/types.ts](data/knowledge/types.ts)
- [data/places/types.ts](data/places/types.ts)
- [scripts/ingest-knowledge.ts](scripts/ingest-knowledge.ts)
- [db/schema.prisma](db/schema.prisma)

### Phát hiện

- Dự án đã phân biệt dữ liệu thực thể, tri thức và realtime, có metadata xuất xứ ở dữ liệu nguồn.
- Pipeline ingest embed lại toàn bộ dữ liệu và tăng version mỗi lần cập nhật.
- Nội dung và vector được ghi bằng các thao tác riêng, có nguy cơ không đồng bộ nếu lỗi giữa chừng.
- `deleteMany` xóa mọi slug không nằm trong danh sách ingest hiện tại.

### Đề xuất

- Kiểm định dữ liệu: slug trùng, alias mơ hồ, cây địa danh có chu trình, tọa độ bất hợp lý, khoảng giá đảo ngược, thiếu nguồn hoặc ngày đối chiếu.
- Bổ sung metadata có cấu trúc trong DB: `sourceUrl`, `sourceClass`, `verifiedAt`, `validUntil`, `contentHash`, phiên bản embedding/chunker.
- Ingest tăng dần: chỉ embed tài liệu thay đổi.
- Xuất bản nhất quán: dùng transaction phù hợp hoặc tạo phiên bản corpus mới, kiểm tra xong mới chuyển sang sử dụng.
- Giới hạn việc xóa chunk cũ theo corpus/nguồn quản lý.

Tiêu chí nghiệm thu: chạy lại cùng dữ liệu không tạo thay đổi không cần thiết; ingest lỗi giữa chừng không để nội dung mới đi cùng vector cũ.

## 4. Đưa metadata vào truy xuất thực tế — P1

File liên quan: [server/domain/rag/retrieval.ts](server/domain/rag/retrieval.ts).

### Phát hiện

- Đã có vector + keyword + RRF + reranker tùy chọn.
- Bộ lọc hiện chủ yếu dùng `docType`, `scope`, `placeSlug`; chưa sử dụng trực tiếp `domain`, `entityType`, `season` như metadata đã chuẩn bị.
- Hai nhánh tìm kiếm dùng `Promise.all`: embedding lỗi có thể làm cả retrieval thất bại dù keyword vẫn có thể hoạt động.
- Lời gọi reranker trong file này chưa có timeout tường minh.

### Đề xuất

- Truy vấn theo thực thể và cây địa danh, có chính sách giữ tài liệu chung liên quan.
- Dùng domain/mùa khi tín hiệu đủ rõ; tránh lọc cứng làm mất nguồn cần thiết.
- Thử nghiệm có đối chứng: vector-only → hybrid → hybrid + metadata → thêm reranker.
- Chọn cấu hình dựa trên Recall@5, chất lượng trả lời và p95 latency.
- Có chế độ suy giảm khi một nhánh lỗi, ghi rõ trong trace.
- Bổ sung timeout cho reranker.

## 5. Kiểm chứng tính khả thi của lịch trình — P0

File liên quan:

- [server/domain/itinerary.ts](server/domain/itinerary.ts)
- [server/routes/itinerary.ts](server/routes/itinerary.ts)

### Phát hiện

Code đã ràng buộc chỗ nghỉ vào danh mục. Tuy nhiên, kiểm tra đầu ra ban đầu mới yêu cầu `days` là mảng không rỗng; `plan` vẫn là `any`.

### Đề xuất

Thêm bộ kiểm tra độc lập với model:

- Đúng số ngày người dùng yêu cầu.
- Điểm đến tồn tại, không trùng bất hợp lý.
- Thời gian di chuyển + tham quan + nghỉ phù hợp từng ngày.
- Chỗ nghỉ phù hợp điểm kết thúc ngày.
- Chi phí tính bằng code, ghi rõ giả định và đơn vị.
- Thiếu dữ liệu tuyến đường phải thể hiện là chưa xác minh.

Cho model sửa lịch trình theo danh sách lỗi với số lần thử giới hạn. Đo tỷ lệ lịch trình hợp lệ, không chỉ chấm văn phong.

## 6. Mở rộng test theo rủi ro thực tế — P1

Bộ test hiện có tập trung vào temporal, slots, orchestrator, evaluation và một phần API chat. API chat đã có test HTTP nhưng mock database và orchestrator; cần bổ sung kiểm thử tích hợp với thành phần thật.

| Nhóm | Ca kiểm thử quan trọng |
| --- | --- |
| Database/RAG integration | pgvector, tìm kiếm không dấu, chỉ lấy APPROVED, lọc địa danh |
| Ingest | Chạy lại không đổi, lỗi giữa chừng, cập nhật/xóa đúng nguồn |
| Model output | JSON đúng cú pháp nhưng sai kiểu, thiếu trường, địa điểm bịa |
| Realtime | Timeout, dữ liệu cũ, provider lỗi, hết hạn cache |
| Hội thoại | Đổi ngày, đổi ngân sách, nhắc lại “ở đó”, hai lượt gửi đồng thời |
| UI end-to-end | Đăng nhập → chat → tải lại → khôi phục lịch sử; tạo và lưu lịch trình |

Đề xuất CI:

- Mỗi PR: test nhanh và typecheck.
- Job riêng: database integration và Python tests.
- Theo lịch hoặc trước phát hành: evaluation dùng model thật.

## 7. Cải thiện kiểm tra kiểu và đầu ra model

File liên quan:

- [tsconfig.json](tsconfig.json)
- [server/infra/gemini.ts](server/infra/gemini.ts)

- Bật dần `strictNullChecks`.
- Thay `any` ở biên API/model bằng kiểu dữ liệu cùng kiểm tra runtime.
- `generateStructured<T>` hiện ép kiểu JSON sang `T`, chưa xác thực đầy đủ cấu trúc lúc chạy. JSON parse thành công không đồng nghĩa với đúng schema nghiệp vụ.
- Thêm test phản hồi đúng JSON nhưng sai kiểu hoặc thiếu trường bắt buộc.

## Thứ tự triển khai đề xuất

1. Sửa gate evaluation, bổ sung chỉ số truy xuất và thiết lập baseline.
2. Kiểm chứng grounding và tính hợp lệ của lịch trình.
3. Chuẩn hóa ingest, metadata và kiểm định dữ liệu.
4. Tối ưu retrieval bằng thử nghiệm có đối chứng.
5. Mở rộng CI và kiểm thử toàn luồng.

Mỗi bước cần ghi lại cấu hình, phiên bản dữ liệu và kết quả đo để xác định thay đổi có thực sự cải thiện hệ thống hay không.

## Trạng thái bàn giao

- Đã hoàn thành đọc và đánh giá các phần chính của codebase.
- Đã chạy thành công Vitest và TypeScript typecheck.
- Đã lưu kết quả phiên làm việc vào tài liệu này theo yêu cầu.
- Chưa triển khai các thay đổi đề xuất, chưa chạy evaluation trực tuyến hoặc thay đổi database.
