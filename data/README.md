# `data/` — tầng nội dung

Thư mục này chứa **nội dung, không chứa logic**. Không có lượt gọi mạng, không truy vấn database,
không nhánh rẽ theo cấu hình. Mọi file ở đây đều là hằng số đã gõ kiểu, được `server/`, `db/seed.ts`
và `scripts/` đọc vào. Đó là lý do `vite.config.ts` cố tình **không** khai alias `@data` cho client:
một import nhầm từ giao diện sang đây sẽ hỏng ngay lúc build, thay vì lặng lẽ kéo cả kho nội dung
vào bundle trình duyệt.

## Ba tầng, ba trách nhiệm tách bạch

| Thư mục | Trả lời câu hỏi | Ai đọc |
| --- | --- | --- |
| `places/` | *Cái đó là gì, ở đâu, thuộc về cái gì* | `db/seed.ts`, bộ phân giải địa danh, tool layer |
| `knowledge/` | *Vì sao nên đến, nên đi lúc nào, cần biết trước điều gì* | `scripts/ingest-knowledge.ts` → RAG |
| `realtime/` | *Cần hỏi API cái gì, hỏi ở đâu, dữ liệu sống được bao lâu* | `server/infra/realtime/` |

Ranh giới giữa `places/` và `knowledge/` là ranh giới giữa **số liệu có cấu trúc** và **văn bản
được trích dẫn**. Toạ độ, độ cao, khoảng cách, giá — thuộc `places/`, và tác tử lấy chúng qua tool
layer. Chúng **không được chép vào nội dung tri thức**: một con số nằm trong đoạn văn RAG thì không
truy ngược về nguồn được, và model đọc sai nó lúc nào cũng có thể.

Ranh giới giữa `places/` + `knowledge/` và `realtime/` là ranh giới **tĩnh / động** của SRS Mục
11.1.1.3. Thứ gì đổi theo giờ hoặc theo ngày thì không được đóng băng vào file tĩnh — trước đây
thời tiết là một bảng cứng trong database, và đó là vi phạm trực tiếp mục này.

## Bốn quy tắc không được phá

**1. Slug đặt một lần rồi thôi.** `Place.slug` là `entityId` mà mọi tài liệu tri thức trỏ tới. Đổi
slug là làm mồ côi toàn bộ tri thức đã gắn — và mồ côi ở đây không gây lỗi: tài liệu vẫn nằm trong
kho, chỉ là không bộ lọc nào khớp nó nữa, nên nó biến mất khỏi mọi câu trả lời mà không ai biết.
Tên hiển thị đổi thoải mái; slug thì không.

**2. Không có cấp huyện.** Từ 01/7/2025 Việt Nam bỏ cấp huyện, và Hà Giang sáp nhập vào tỉnh Tuyên
Quang. Trong danh mục, `province` là Tuyên Quang, còn "Đồng Văn", "Mèo Vạc", "Quản Bạ" là
`kind: "region"` — vùng du lịch theo cách gọi quen thuộc, không phải đơn vị hành chính. Chúng vẫn
phải tra cứu được vì khách vẫn hỏi bằng tên đó.

**3. Giá không bao giờ là một số trần.** Mọi giá trong repo này là `PriceEstimate` với
`basis: "market_estimate"`, kèm ngày khảo sát và nguồn tham chiếu. Dự án chấp nhận ước lượng giá từ
mặt bằng các trang bán hàng vì không có nguồn chính thức cho địa bàn này — nhưng một con số ước
lượng trông giống hệt một con số đã kiểm chứng thì sớm muộn sẽ được trích như giá thật, và khách
chỉ phát hiện lúc thanh toán. Cấu trúc dữ liệu phải làm cho việc đó bất khả thi, chứ không trông
chờ vào kỷ luật của người viết prompt. Ở giai đoạn G, giá ước lượng được đăng ký với
`sourceClass: "inference"` và theo Mục 11.1.1.10 thì loại đó bị cấm đứng ở vị trí giá.

**4. Bản thô không phải tri thức.** `data/raw-web/` là thứ crawler tải về, và nó **không commit**
(xem `.gitignore`). Nó chỉ là nguyên liệu để người biên tập đọc rồi chắt lọc thành
`KnowledgeSourceDoc` mang `sourceClass: "crawled_verified"`. Đổ thẳng HTML của mấy chục trang du
lịch vào vector store là mời chatbot trích dẫn quảng cáo và giá đã lạc hậu — trái FR-BOT-05, vốn
nói chatbot chỉ được nói trong phạm vi tri thức đã kiểm duyệt.

## Sáu mặt nội dung được tổ chức thế nào

Yêu cầu nêu sáu mặt: mô tả, lịch sử, văn hoá, ẩm thực, điểm ngắm cảnh, kinh nghiệm ngắm cảnh.
Chúng **không phải sáu trường của một bản ghi**, mà là sáu tổ hợp `domain` × `entityType`:

| Mặt nội dung | Nằm ở đâu | `domain` / `entityType` |
| --- | --- | --- |
| Mô tả | `knowledge/descriptions.ts` | `destination` / `attraction` |
| Lịch sử | `knowledge/history.ts` | `attraction` / `historical_site` |
| Văn hoá | `knowledge/culture.ts` | `attraction` / `cultural_site` |
| Ẩm thực | `places/food.ts` + `knowledge/cuisine.ts` | `food` / `local_food`, `specialty`, `restaurant` |
| Điểm ngắm cảnh | `places/geography.ts` | thực thể `kind: "scenic_view"` |
| Kinh nghiệm ngắm cảnh | `knowledge/sightseeing.ts` | `attraction` / `scenic_view`, `local_tips` |

Hai mặt cuối cố tình nằm ở hai chỗ khác nhau, và đây là phân biệt đáng nhớ: **điểm ngắm cảnh là
một thực thể** có slug, toạ độ và độ cao riêng — khách hỏi "đứng ở đâu chụp được hẻm Tu Sản" thì
cần một khoá tra cứu, không phải một đoạn văn. Còn **kinh nghiệm ngắm cảnh là tri thức vận hành**
gắn vào thực thể đó: giờ nào đẹp, mùa nào chỉ thấy sương mù, chỗ nào dừng xe được.

Cách chia này để bộ lọc metadata chạy **trước** semantic search (Mục 11.1.1.5): hỏi "ăn gì ở Đồng
Văn" thì lọc `domain: "food"` cộng cây con của Đồng Văn xong mới tính tương đồng, thay vì thả
vector đi mò trong toàn kho.

## Sửa nội dung xong thì phải chạy gì

| Sửa ở đâu | Lệnh phải chạy | Không chạy thì sao |
| --- | --- | --- |
| `places/` | `npm run db:seed` | Web và tool layer vẫn thấy dữ liệu cũ |
| `knowledge/` | `npm run db:ingest` | Chatbot vẫn trả lời theo bản cũ |
| `knowledge/web-sources.ts` | `npm run db:crawl` rồi biên tập tay | Không có bản thô mới để chắt lọc |
| `realtime/` | không cần lệnh nào | Adapter đọc trực tiếp lúc chạy |

Riêng `realtime/` không cần nạp lại vì nó là tham số cho lượt gọi API, không phải dữ liệu lưu trữ.
Nhưng đổi `ttlSeconds` thì các bản ghi cache cũ vẫn giữ hạn cũ cho tới khi hết — chúng mang
`expiresAt` đã tính sẵn lúc ghi, không tính lại theo cấu hình hiện tại.
