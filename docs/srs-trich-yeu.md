# SRS v1.2 — trích yếu các điều khoản được viện dẫn

Bản đầy đủ là `SRS_Website_Tour_Du_Lich_Chatbot_AI_v1.2.pdf` (55 trang, Ban Phân tích Nghiệp vụ,
05/09/2026). File đó **chưa có trong repo** — nó tồn tại dưới dạng tài liệu người dùng gửi kèm.
Vòng duyệt kế hoạch đầu tiên đã vấp đúng chỗ này: người soát không đối chiếu được nguyên văn nên
phải tin vào phần trích trong gói prompt.

File này chép **nguyên văn** những điều khoản mà kế hoạch trong `docs/plans/` viện dẫn, để việc
soát không phụ thuộc vào trí nhớ của ai. Nó **không thay thế** bản PDF: khi cần đối chiếu toàn
văn (sơ đồ, ma trận truy vết, các mục không trích ở đây) vẫn phải mở bản gốc.

> Quy ước của chính SRS (Mục 1.1): *"các bảng yêu cầu tại Mục 3, Mục 5 và ma trận phân quyền tại
> Mục 6 là nguồn chuẩn (source of truth). Các sơ đồ tại Mục 7, 8, 9, 10 là cách biểu diễn trực
> quan của những yêu cầu đó; khi phát hiện mâu thuẫn, lấy nội dung bảng yêu cầu làm chuẩn."*

---

## Mục 12 — Lộ trình triển khai theo giai đoạn (phần Giai đoạn 1)

> **Giai đoạn 1 — Chatbot AI (≈ 3 tháng)**
>
> Xây dựng hoàn chỉnh chatbot AI với đủ 6 tác tử (1 điều phối + 5 tác tử chuyên biệt: tư vấn tìm
> tour, tạo tour tự do, lập kế hoạch kinh phí, giới thiệu địa danh & FAQ, hỗ trợ & chuyển tiếp
> nhân viên) theo kiến trúc tại Hình 9.2. Chatbot hoạt động trên dữ liệu tour/dịch vụ mẫu (seed
> data, có thể lấy từ nguồn công khai hoặc API đối tác dùng thử), có widget chat nhúng trên trang
> landing đơn giản, lưu và đồng bộ lịch sử hội thoại. Giai đoạn này CHƯA có giỏ hàng, thanh toán
> hay đặt chỗ tự động — khi khách muốn đặt tour thật, chatbot chuyển tiếp thông tin cho nhân viên
> xử lý thủ công theo luồng tại Hình 10.6.

## Mục 11.4.7 — Đánh giá và giám sát chất lượng

> Chất lượng RAG không thể đánh giá bằng cảm tính, vì vậy bộ công cụ đo lường là một phần **bắt
> buộc** của phạm vi Giai đoạn 1 chứ không phải hạng mục tuỳ chọn:
>
> - Langfuse (tự triển khai được) làm lớp ghi vết: lưu câu hỏi, các đoạn tri thức được truy xuất,
>   câu trả lời, chi phí và độ trễ của từng lượt. Đây là nguồn dữ liệu duy nhất để phân tích chất
>   lượng.
> - RAGAS chạy định kỳ trên mẫu 1–5% lượt hội thoại thật, tính bốn chỉ số: mức độ bám nguồn
>   (faithfulness), độ liên quan của câu trả lời, độ chính xác và độ bao phủ của ngữ cảnh truy xuất.
> - DeepEval làm cổng chất lượng trong quy trình tích hợp liên tục: một bộ câu hỏi vàng có đáp án
>   chuẩn, chạy như kiểm thử đơn vị, chặn triển khai nếu chất lượng suy giảm.
> - Chỉ số vận hành cần theo dõi trên bảng điều khiển: tỷ lệ trả lời không tìm thấy căn cứ, tỷ lệ
>   chuyển tiếp nhân viên, độ trễ p95, chi phí trung bình mỗi phiên hội thoại.
>
> Cần xây dựng bộ câu hỏi vàng tiếng Việt cho miền du lịch với khoảng 100–200 câu, lấy từ log hỗ
> trợ thực tế và từ kịch bản nghiệp vụ (hỏi chính sách huỷ đổi, hỏi địa danh, hỏi thủ tục thanh
> toán), **có đáp án và đoạn tri thức đúng kèm theo**. Ngưỡng cảnh báo đề xuất: chỉ số bám nguồn
> dưới 0,80 thì dừng phát hành và rà soát.

## Mục 11.4.4 — Tìm kiếm lai và xếp hạng lại (phần ràng buộc đo lường)

> Quyết định: bắt buộc dùng hybrid search kết hợp tìm kiếm vector và tìm kiếm toàn văn, hợp nhất
> bằng thuật toán Reciprocal Rank Fusion; bật thêm bước xếp hạng lại có điều kiện.
>
> [...] Xếp hạng lại: lấy khoảng 50 ứng viên từ mỗi nhánh, hợp nhất còn khoảng 20, rồi dùng
> cross-encoder chọn ra 3–5 đoạn tốt nhất đưa vào ngữ cảnh. Chọn BGE-reranker-v2-m3 vì dưới 600
> triệu tham số, hỗ trợ tiếng Việt, chạy được trên CPU thông qua ONNX và có giấy phép mở.
>
> *Ràng buộc độ trễ: bước xếp hạng lại tiêu tốn khoảng 80–150 ms. Chiến lược áp dụng là bật cho
> nhóm câu hỏi cần độ chính xác cao (chính sách, thủ tục, huỷ đổi) và giảm số ứng viên hoặc tắt
> cho nhóm câu hỏi giới thiệu chung. **Mức cải thiện phải được đo trực tiếp trên tập đánh giá của
> dự án trước khi bật mặc định**, thay vì dựa vào con số công bố chung.*

## Mục 11.4.3 — Chunking và tiền xử lý tiếng Việt (phần liên quan tách từ)

> - Dùng công cụ tách câu và tách từ tiếng Việt (underthesea hoặc VnCoreNLP) ở khâu tiền xử lý.
>   Với nhánh embedding, BGE-M3 dùng tokenizer subword nên không bắt buộc tách từ; nhưng với nhánh
>   tìm kiếm từ khoá, tách từ cải thiện rõ độ chính xác vì tiếng Việt là ngôn ngữ đơn lập, ranh
>   giới từ không trùng ranh giới khoảng trắng.
> - Chuẩn hoá bỏ dấu bằng hàm unaccent và đánh chỉ mục cả bản có dấu lẫn không dấu, vì một tỷ lệ
>   đáng kể người dùng gõ không dấu trên di động.

## Mục 10.6 — Ba trường hợp buộc chuyển tiếp

> Ngoài khiếu nại và sự cố khẩn, hệ thống buộc chuyển tiếp trong ba trường hợp: độ tin cậy nhận
> diện ý định thấp hơn ngưỡng, câu hỏi nằm ngoài phạm vi kho tri thức, và khách yêu cầu gặp người
> thật. Việc luôn duy trì lối thoát sang nhân viên là điều kiện để chấp nhận rủi ro còn lại của
> chatbot.

## Mục 10.4 — Ràng buộc thứ tự bắt buộc (chống ảo giác)

> Thứ tự các bước 8 đến 12 là ràng buộc thiết kế bắt buộc, không phải gợi ý: tác tử truy vấn dữ
> liệu thật trước, rồi mới đưa dữ liệu đó cho mô hình ngôn ngữ diễn đạt. Mô hình không được phép
> tự sinh giá, số chỗ hay chính sách.

## Mục 11.3 — Lịch sử trò chuyện

> Toàn bộ phiên hội thoại được lưu trữ gắn với tài khoản người dùng (khi đã đăng nhập), cho phép
> khách xem lại các gợi ý/lịch trình/kế hoạch kinh phí đã nhận trước đó và tiếp tục hội thoại trên
> bất kỳ thiết bị nào. Mô hình dữ liệu tương ứng gồm hai thực thể ChatSession và ChatMessage (xem
> Hình 8.1); dữ liệu hội thoại chứa thông tin cá nhân nên phải tuân thủ NFR-SEC-05 về bảo vệ dữ
> liệu cá nhân, **bao gồm chính sách thời hạn lưu trữ và quyền yêu cầu xoá của người dùng**.

Ghi chú cho người soát: câu trên là căn cứ để yêu cầu **lịch trình do chatbot sinh ra cũng phải
khôi phục được** khi xem lại phiên — SRS nói rõ "xem lại các gợi ý/lịch trình/kế hoạch kinh phí
đã nhận trước đó".

## Mục 11.4.8 — Ràng buộc pháp lý về dữ liệu

> - Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân có hiệu lực ngoài lãnh thổ, phân biệt dữ
>   liệu cá nhân cơ bản và nhạy cảm, yêu cầu sự đồng ý rõ ràng của chủ thể dữ liệu, yêu cầu thông
>   báo mục đích và phương thức xử lý, và đặt **nghĩa vụ xoá dữ liệu trong 72 giờ** khi có yêu cầu
>   hợp lệ.
> - Nghị định 53/2022/NĐ-CP hướng dẫn Luật An ninh mạng đặt yêu cầu lưu trữ dữ liệu người dùng
>   Việt Nam trong nước đối với một số nhóm doanh nghiệp, với **thời hạn lưu trữ tối thiểu 24
>   tháng**.
>
> Áp dụng cho thiết kế RAG:
>
> - Bản thân kho tri thức RAG chứa nội dung đã kiểm duyệt và mang tính công khai, không chứa dữ
>   liệu cá nhân, nên rủi ro khi sinh embedding qua dịch vụ bên ngoài là thấp.
> - Ngược lại, nội dung hội thoại của khách có thể chứa dữ liệu cá nhân (họ tên, số điện thoại, số
>   giấy tờ, mã đặt chỗ). Vì vậy bắt buộc có bước che dữ liệu cá nhân trước khi đưa vào lời nhắc
>   gửi ra API nước ngoài, thay bằng ký hiệu thay thế và chỉ khôi phục ở phía hệ thống.
> - Đi kèm là các nghĩa vụ hồ sơ: thu thập sự đồng ý trong luồng đăng ký/bắt đầu hội thoại, ký
>   thoả thuận xử lý dữ liệu với nhà cung cấp, lập báo cáo đánh giá tác động xử lý dữ liệu cá
>   nhân, và thiết lập cơ chế xoá dữ liệu theo yêu cầu.

> *Các quy định pháp lý trong mục này cần được rà soát cùng bộ phận pháp chế tại thời điểm triển
> khai [...]. Nội dung ở đây là định hướng kỹ thuật, không thay thế ý kiến tư vấn pháp lý.*

## Yêu cầu phi chức năng được viện dẫn

| Mã | Nguyên văn | Ưu tiên |
|---|---|---|
| NFR-PERF-03 | Chatbot phải phản hồi trong vòng ≤ 3 giây cho 95% yêu cầu hội thoại thông thường. | Nên có |
| NFR-SEC-05 | Dữ liệu cá nhân khách hàng phải được bảo vệ theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. | Bắt buộc |
| NFR-SEC-06 | Hệ thống phải giới hạn tần suất truy vấn (rate limiting) và chống tấn công brute-force, bot spam vào chatbot. | Nên có |
| NFR-MAINT-01 | Mã nguồn phải tuân thủ quy ước lập trình, có tài liệu API (OpenAPI/Swagger) và độ phủ kiểm thử tự động tối thiểu 70% cho các module nghiệp vụ cốt lõi. | Nên có |

## Yêu cầu chức năng chatbot (Mục 3.6) — trích các mã được viện dẫn

| Mã | Nguyên văn | Ưu tiên |
|---|---|---|
| FR-BOT-01 | Chatbot phải tiếp nhận và trả lời câu hỏi thường gặp (FAQ) về chính sách, thủ tục, thanh toán, huỷ/đổi. | Bắt buộc |
| FR-BOT-02 | Chatbot phải hỗ trợ tìm tour phù hợp qua hội thoại nhiều lượt [...] và trả về danh sách tour sắp xếp theo độ phù hợp. | Bắt buộc |
| FR-BOT-03 | Chatbot phải hỗ trợ tạo "tour tự do" (lịch trình cá nhân hoá) [...] gợi ý lịch trình theo ngày, phương tiện di chuyển, chỗ ở, ăn uống, hoạt động. | Bắt buộc |
| FR-BOT-04 | Chatbot phải lập kế hoạch kinh phí dự kiến khi được yêu cầu [...] tổng hợp thành bảng dự trù ngân sách. | Bắt buộc |
| FR-BOT-05 | Chatbot phải giới thiệu địa danh/điểm đến khi được yêu cầu [...] dựa trên kho tri thức đã được kiểm duyệt. | Bắt buộc |
| FR-BOT-07 | Chatbot phải lưu trữ và hiển thị lịch sử trò chuyện theo từng người dùng, đồng bộ giữa các thiết bị khi đã đăng nhập. | Bắt buộc |
| FR-BOT-08 | Chatbot phải nhận diện tình huống vượt khả năng xử lý [...] và chuyển tiếp cho nhân viên CSKH kèm toàn bộ ngữ cảnh hội thoại. | Bắt buộc |
| FR-BOT-09 | Chatbot phải hỗ trợ tối thiểu hai ngôn ngữ: Tiếng Việt và Tiếng Anh. | Nên có |
| FR-BOT-10 | Chatbot phải hoạt động được trên nhiều kênh: widget trên website ở giai đoạn đầu; tích hợp Zalo OA/Messenger ở giai đoạn sau. | Có thể |
| FR-BOT-11 | Chatbot phải thu thập phản hồi (hài lòng/không hài lòng) sau mỗi phiên hỗ trợ để phục vụ cải tiến liên tục. | Nên có |
| FR-ADM-02 | Trang quản trị phải cho phép quản lý và huấn luyện kịch bản/kho tri thức của chatbot. | Bắt buộc |

## Mục 14 — Tiêu chí nghiệm thu tổng quát (phần liên quan chatbot)

> - 100% yêu cầu chức năng có mức ưu tiên "Bắt buộc" được triển khai và kiểm thử đạt (pass) theo
>   kịch bản kiểm thử tương ứng.
> - Các chỉ tiêu phi chức năng bắt buộc (hiệu năng, bảo mật, độ khả dụng) được đo lường và đáp ứng
>   ngưỡng đã nêu tại Mục 5.
> - Chatbot đạt tỷ lệ giải quyết yêu cầu mà không cần chuyển tiếp nhân viên (self-service
>   resolution rate) tối thiểu theo mục tiêu kinh doanh thống nhất giữa các bên (**đề xuất khởi
>   điểm ≥ 60%**, điều chỉnh theo dữ liệu thực tế sau khi vận hành).
> - Tài liệu vận hành, hướng dẫn sử dụng cho quản trị viên và nhân viên CSKH được bàn giao đầy đủ.
