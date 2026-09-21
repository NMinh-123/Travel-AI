/**
 * DANH SÁCH ĐỊA DANH NGOÀI ĐỊA BÀN — lớp phòng vệ thứ hai của cổng chặn chủ đề.
 *
 * VÌ SAO PHẢI LIỆT KÊ TƯỜNG MINH thay vì suy ra từ "không có trong từ điển". Suy ngược như vậy
 * nghe gọn nhưng sai: bộ nhận diện địa danh của NLU trả về cả những cụm không phải địa danh, và
 * mọi lỗi chính tả của khách cũng thành "không có trong từ điển". Nếu lấy điều đó làm căn cứ
 * chuyển tiếp cả lượt hội thoại thì mỗi lần khách gõ sai tên một địa danh HỢP LỆ, chatbot sẽ báo
 * là câu hỏi ngoài địa bàn. Một danh sách tường minh thì chỉ khớp khi khách thật sự nhắc tới nơi
 * khác, và đó là điều kiện đúng để chuyển tiếp.
 *
 * VÌ SAO DANH SÁCH NÀY LÀ CẦN THIẾT, chứ không chỉ là tối ưu. Đo trên kho tri thức của dự án,
 * câu "chợ phiên Bắc Hà họp ngày nào" đạt tương đồng cosine 0,632 và ts_rank 0,587 — cao hơn
 * phần lớn câu hỏi HỢP LỆ. Cả hai tín hiệu truy hồi đều bỏ qua đúng một từ quyết định, là tên
 * địa danh, vì phần còn lại của câu ("chợ phiên", "họp ngày nào") khớp hoàn hảo với tri thức về
 * chợ phiên Hà Giang. Không ngưỡng số nào tách được hai nhóm đó: quét ngưỡng cho thấy muốn chặn
 * thêm hai câu ngoài địa bàn thì phải hy sinh mười một trên hai mươi câu hợp lệ. Một phép tra
 * bảng giải đúng việc mà ngưỡng không giải được.
 *
 * DẠNG DỮ LIỆU. Mọi mục đã ở dạng CHUẨN HOÁ — chữ thường, bỏ dấu, không dấu câu — vì hàm
 * `findOutOfAreaPlaces` chuẩn hoá câu của khách rồi mới so. Thêm mục mới thì phải tự bỏ dấu; một
 * mục còn dấu sẽ không bao giờ khớp và âm thầm vô hiệu.
 *
 * SO KHỚP THEO RANH GIỚI TỪ, KHÔNG PHẢI CHUỖI CON. Việc này do `server/domain/rag/places.ts` lo,
 * nhưng lý do thì thuộc về dữ liệu ở đây nên ghi lại: "hue" là chuỗi con của rất nhiều từ tiếng
 * Việt bỏ dấu — "thue" trong "thuê xe" — nên `includes` trần sẽ biến câu "thuê xe máy ở Hà Giang"
 * thành câu hỏi về Huế. Danh sách này có quyền chuyển tiếp cả lượt hội thoại, nên nó không được
 * phép khớp bừa.
 *
 * Nhờ so khớp theo ranh giới từ mà một mục ngắn như "hue" vẫn dùng được: " thue " không chứa
 * " hue ", nên câu về thuê xe không bị bắt. Rủi ro còn lại của mục này là những cụm mà bỏ dấu
 * xong trùng đúng cả từ — "hoa huệ" thành "hoa hue" và sẽ khớp. Đây là đánh đổi có ý thức: câu
 * hỏi về hoa huệ trong một trợ lý du lịch Hà Giang dù sao cũng ngoài phạm vi, nên hậu quả của
 * dương tính giả ở đây bằng không, trong khi bỏ mục này thì mất hẳn khả năng bắt câu hỏi về Huế.
 * Tiêu chí đúng khi thêm mục mới KHÔNG phải độ dài, mà là: sau khi bỏ dấu, cụm này có trùng một
 * từ tiếng Việt thông dụng nào mà khách có thể dùng trong câu hỏi HỢP LỆ hay không.
 *
 * PHẠM VI. Chỉ liệt kê những nơi khách THẬT SỰ hỏi nhầm sang. Nhóm dễ nhầm nhất là các điểm du
 * lịch vùng núi phía Bắc, vì chúng cùng loại hình với Hà Giang và hay xuất hiện chung trong một
 * bài viết. Nhóm ngoài miền Bắc thì hỏi nhầm ít hơn nhưng vẫn gặp, thường là khi khách so sánh
 * hai điểm đến. Không cần liệt kê toàn bộ địa danh Việt Nam: nơi nào không có trong danh sách mà
 * cũng không có trong từ điển thì vẫn bị chặn ở lớp ngưỡng liên quan của tầng truy hồi.
 */
export const OUT_OF_AREA_PLACES: string[] = [
  // --- Vùng núi phía Bắc: nhóm dễ nhầm nhất vì cùng loại hình du lịch ---
  "sa pa",
  "sapa",
  "lao cai",
  "bac ha",
  "y ty",
  "o quy ho",
  "fansipan",
  "muong hoa",
  "mu cang chai",
  "yen bai",
  "nghia lo",
  "tu le",
  "khau pha",
  "moc chau",
  "son la",
  "ta xua",
  "cao bang",
  "ban gioc",
  "bao lac",
  "ba be",
  "bac kan",
  "lang son",
  "mau son",
  "dien bien",
  "lai chau",
  "sin ho",
  "pu luong",
  "mai chau",
  "hoa binh",
  "tam dao",
  "ba vi",
  "thai nguyen",

  // --- Ngoài miền Bắc: gặp khi khách so sánh hai điểm đến ---
  "da lat",
  "da nang",
  "hoi an",
  "hue",
  "nha trang",
  "phu quoc",
  "con dao",
  "ha long",
  "cat ba",
  "ninh binh",
  "trang an",
  "tam coc",
  "phong nha",
  "quy nhon",
  "vung tau",
  "can tho",
  "sai gon",
  "ho chi minh",
  "phan thiet",
  "mui ne",
  "buon ma thuot",
  "pleiku",
];
