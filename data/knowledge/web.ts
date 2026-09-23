import type { KnowledgeSourceDoc } from "@data/knowledge/types";

/**
 * TRI THỨC CHẮT LỌC TỪ BẢN THÔ THU THẬP ĐƯỢC.
 *
 * Mọi mục ở đây mang `sourceClass: "crawled_verified"`: nội dung bắt nguồn từ một trang trong
 * @data/knowledge/web-sources, nhưng đã được đọc, viết lại bằng lời của dự án và đối chiếu ngày.
 * Bản thô trong `data/raw-web/` KHÔNG bao giờ đi thẳng vào đây — đó là ranh giới FR-BOT-05.
 *
 * VÌ SAO CÓ TỆP NÀY. Đo ngày 2026-09-22 trên đủ 67 kịch bản holdout cho thấy kho có 162 đoạn phủ
 * 86 trên 114 Place, và 28 nơi không có đoạn nào. Phần lớn 28 nơi ấy là cơ sở lưu trú và quán ăn
 * — loại mà dự án CỐ TÌNH không đưa vào kho vì tên và giá đổi liên tục, giá thuộc về tầng công cụ
 * chứ không phải tầng tri thức. Nhưng năm nơi còn lại là điểm tham quan thật sự, và bốn trong số
 * đó nằm ở PHÍA TÂY tỉnh — Hoàng Su Phì, Xín Mần, Quản Bạ — vùng gần như vắng mặt trong kho so
 * với trục Đồng Văn – Mèo Vạc. Năm mục đầu tiên của tệp này lấp đúng năm chỗ đó.
 *
 * QUY TẮC KHI HAI NGUỒN NÓI KHÁC NHAU: theo `tier` trong web-sources.ts. Đã dùng đúng một lần ở
 * đây — niên đại Bãi đá cổ Nấm Dẩn, xem ghi chú tại mục đó.
 *
 * KHÔNG CHÉP GIÁ VÉ VÀO ĐÂY. Bài về động Lùng Khúy có nêu một mức giá, và một nguồn khác cùng
 * thời điểm nêu mức khác hẳn. Giá vé là số đổi theo năm và theo mùa, nên nó thuộc tầng công cụ
 * như giá phòng và giá xe, không thuộc kho tri thức: một con số sai nằm trong kho sẽ được chatbot
 * trích dẫn kèm nguồn, và trông đáng tin hơn hẳn mức độ đáng tin thật của nó.
 */
export const WEB_KNOWLEDGE: KnowledgeSourceDoc[] = [
  {
    slug: "mo-ta-dinh-chieu-lau-thi",
    domain: "attraction",
    entityType: "landmark",
    entityId: "dinh-chieu-lau-thi",
    title: "Đỉnh Chiêu Lầu Thi — đường lên và thời điểm săn mây",
    content:
      "Chiêu Lầu Thi, còn gọi Kiêu Liều Ti, cao 2.402 m và là đỉnh cao thứ hai của Hà Giang, nằm " +
      "trong dãy Tây Côn Lĩnh thuộc thôn Tân Minh và thôn Chiến Thắng, xã Hồ Thầu, huyện Hoàng " +
      "Su Phì. Tên núi theo tiếng Hán ghép từ Chiêu Lầu nghĩa là chín bậc và Thi nghĩa là tảng đá " +
      "lớn, nên được hiểu là chín tầng thang. Nơi đây cách thành phố Hà Giang khoảng 130 km, tức " +
      "nằm hẳn về phía tây tỉnh chứ không nằm trên vòng cung Đồng Văn – Mèo Vạc mà phần lớn lịch " +
      "trình bốn ngày đi qua; muốn lên Chiêu Lầu Thi thì phải tính thành một nhánh riêng. " +
      "Khách từ Hà Nội thường đi ô tô đêm tới Hoàng Su Phì rồi thuê xe máy chạy tiếp gần 40 km " +
      "tới chân núi. Đường lên đã đổ bê tông gần hết và ô tô dưới 9 chỗ đi được tới chân núi, " +
      "nhưng khoảng 15 km cuối ngoằn ngoèo và cua liên tục nên tay lái chưa chắc thì không nên tự " +
      "cầm lái đoạn đó. Từ chỗ đỗ xe còn phải leo bộ thêm hàng trăm bậc thang lên xuống liên tục " +
      "mới tới cột mốc trên đỉnh, nên cần mang theo nước và đồ ăn nhẹ. " +
      "Mùa săn mây đẹp nhất là từ tháng 9 đến tháng 2, trùng với mùa lúa chín và sau đó là mùa " +
      "hoa xuân. Trên đỉnh nhiều gió và lạnh hơn hẳn dưới thấp kể cả khi trời khô ráo, nên áo ấm " +
      "là thứ phải mang chứ không phải thứ mang cho chắc.",
    tags: ["chieu-lau-thi", "hoang-su-phi", "san-may", "trekking", "phia-tay", "tay-con-linh"],
    season: ["lua_chin", "mua_lanh"],
    sourceClass: "crawled_verified",
    sourceUrl: "https://vnexpress.net/san-may-tren-dinh-chieu-lau-thi-4246378.html",
    retrievedAt: "2026-09-23",
  },
  {
    slug: "mo-ta-thao-nguyen-suoi-thau",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "thao-nguyen-suoi-thau",
    title: "Thảo nguyên Suôi Thầu — cảnh sắc bốn mùa ở Xín Mần",
    content:
      "Thảo nguyên Suôi Thầu nằm cách thị trấn Cốc Pài, huyện Xín Mần khoảng 5 km, ở độ cao trên " +
      "1.200 m, một phần thuộc địa phận xã Nàn Ma. Vùng thảo nguyên rộng hơn 90 ha, còn tổng diện " +
      "tích đất quy hoạch cho khu vực thôn Suôi Thầu là 146 ha, trải trên cả địa giới thị trấn Cốc " +
      "Pài lẫn xã Nàn Ma. Đây là cửa ngõ nối Xín Mần với huyện Bắc Hà của tỉnh Lào Cai, nên khách " +
      "đi vòng cung phía tây thường ghép Suôi Thầu vào cùng chặng với Bắc Hà chứ không quay ngược " +
      "về trục cao nguyên đá. " +
      "Cảnh đổi hẳn theo mùa, và đây là điểm đáng cân nhắc khi chọn thời gian đi. Mùa xuân có hoa " +
      "cải vàng nở rộ. Mùa hè là màu xanh của nương ngô và ruộng lúa. Mùa thu thảo nguyên chuyển " +
      "sang những gam màu mộc mạc hơn. Cuối đông là lúc hoa tam giác mạch nở xen giữa những hàng " +
      "sa mộc vươn cao, và đó cũng là hình ảnh khiến nơi này được gọi là thảo nguyên châu Âu của " +
      "Việt Nam. Người Mông ở đây trồng lúa, ngô và cây dược liệu; hết vụ lương thực thì trồng " +
      "thêm tam giác mạch và hoa cải, nên sắc hoa cuối đông là kết quả của mùa vụ chứ không phải " +
      "của một khu vườn trồng riêng cho khách chụp ảnh.",
    tags: ["suoi-thau", "xin-man", "coc-pai", "thao-nguyen", "phia-tay", "chup-anh"],
    season: ["hoa_tam_giac_mach", "hoa_cai", "lua_chin"],
    sourceClass: "crawled_verified",
    sourceUrl: "https://vnexpress.net/suoi-thau-thao-nguyen-chau-au-o-ha-giang-4462972.html",
    retrievedAt: "2026-09-23",
  },
  {
    slug: "lich-su-bai-da-co-nam-dan",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "bai-da-co-nam-dan",
    title: "Bãi đá cổ Nấm Dẩn — di tích cấp quốc gia ở Xín Mần",
    content:
      "Bãi đá cổ Nấm Dẩn, còn gọi Bãi đá cổ Xín Mần, thuộc xã Nấm Dẩn, huyện Xín Mần, là di tích " +
      "khảo cổ cấp quốc gia. Người địa phương gọi nơi này là Nà Lai, nghĩa là ruộng nhiều chữ. " +
      "Quần thể nằm giữa một thung lũng được bao bọc bởi hai dãy núi Tây Đản và Nấm Dẩn, gồm 8 " +
      "phiến đá lớn và 2 phiến cự thạch với hình thù khác nhau — có tảng phẳng như bàn cờ, có tảng " +
      "giống tấm phản nằm hoặc chiếc ghế. Bề mặt và rìa cạnh các phiến đá vẫn giữ nguyên trạng " +
      "phong hoá tự nhiên. Trên đá là các hình khắc đa dạng gồm hình tròn, hình vuông, hình đồi " +
      "núi, được cho là mang dấu ấn tín ngưỡng thờ thần sông núi của các dân tộc thiểu số trong " +
      "vùng. " +
      "Di tích được phát hiện năm 2004 và sau đó trải qua nhiều đợt nghiên cứu về ý nghĩa các ký " +
      "tự. Niên đại được xác định khoảng 2.000 năm, và đây là loại hình di tích rất hiếm ở Việt " +
      "Nam. " +
      "Muốn lên tới khu di tích thì phải đi bộ, băng qua suối và leo một đoạn đồi chừng 1 km, nên " +
      "cần tính thêm thời gian và không phù hợp với người ngại đi bộ đường dốc. Thời điểm thuận " +
      "lợi nhất là từ tháng 11 đến tháng 3, khi Hà Giang bước vào mùa khô nên đường đi dễ hơn — " +
      "cũng trùng mùa tam giác mạch và sau đó là mùa hoa mận.",
    // Hai nguồn nói khác nhau về niên đại: trang của Cục Du lịch ghi khoảng 2.000 năm, một số
    // trang du lịch thương mại ghi khoảng 1.000 năm. Theo quy tắc `tier` trong web-sources.ts,
    // nguồn nhà nước thắng, nên con số ở trên là 2.000 năm.
    tags: ["nam-dan", "xin-man", "bai-da-co", "khao-co", "di-tich-quoc-gia", "phia-tay"],
    season: ["hoa_tam_giac_mach", "hoa_dao_man"],
    sourceClass: "crawled_verified",
    sourceUrl: "https://nongthon.vietnamtourism.gov.vn/ve-dep-bi-an-cua-bai-da-co-nam-dan-ha-giang/",
    retrievedAt: "2026-09-23",
  },
  {
    slug: "van-hoa-lang-van-hoa-pa-vi-ha",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "lang-van-hoa-pa-vi-ha",
    title: "Làng văn hoá du lịch cộng đồng dân tộc Mông thôn Pả Vi Hạ",
    content:
      "Làng văn hoá du lịch cộng đồng dân tộc Mông ở thôn Pả Vi Hạ, thường gọi là làng H'Mông Pả " +
      "Vi, nằm ngay dưới chân đèo Mã Pí Lèng thuộc xã Mèo Vạc. Bao quanh làng là núi đá tai mèo, " +
      "dòng Nho Quế và những cánh đồng tam giác mạch. Vị trí này khiến Pả Vi là chỗ nghỉ chân hợp " +
      "lý cho chặng vượt Mã Pí Lèng, thay vì chạy thẳng tiếp sau khi qua đèo. " +
      "Kiến trúc trong làng tái hiện nếp nhà trình tường, mái ngói âm dương và hàng rào đá của " +
      "người Mông. Làng khởi công cuối năm 2016 trên một bãi đất trống lầy lội, đi vào hoạt động " +
      "từ tháng 4/2019, với tổng diện tích quy hoạch hơn 27.000 m² chia làm ba khu gồm 26 căn do " +
      "19 hộ gia đình quản lý. Ngoài lưu trú, các hộ còn làm dịch vụ ăn uống, bán sản phẩm địa " +
      "phương và tắm lá thuốc. Đề án ban đầu chỉ dành cho người Mông, sau mở rộng cho cả các dân " +
      "tộc khác và hình thức liên danh liên kết. " +
      "Pả Vi được Cục Du lịch Quốc gia bình chọn là điểm du lịch cộng đồng tốt nhất Việt Nam năm " +
      "2025. Theo ban quản lý, chín tháng đầu năm 2025 làng đón hơn 58.000 lượt khách, trong đó " +
      "trên 40.000 lượt lưu trú qua đêm — con số đáng lưu ý khi định đặt phòng vào mùa cao điểm.",
    tags: ["pa-vi", "meo-vac", "nguoi-mong", "du-lich-cong-dong", "ma-pi-leng", "homestay"],
    season: ["quanh_nam"],
    sourceClass: "crawled_verified",
    sourceUrl:
      "https://vnexpress.net/tu-bai-dat-lay-thanh-lang-du-lich-pa-vi-noi-tieng-the-gioi-4951713.html",
    retrievedAt: "2026-09-23",
  },
  {
    slug: "mo-ta-dong-lung-khuy",
    domain: "attraction",
    entityType: "landmark",
    entityId: "dong-lung-khuy",
    title: "Động Lùng Khúy ở Quản Bạ — đường vào và những gì thấy trong hang",
    content:
      "Động Lùng Khúy nằm ở thôn Lùng Khúy, xã Quản Bạ, huyện Quản Bạ, cách trung tâm thị trấn " +
      "Tam Sơn hơn 10 km và nằm ở lưng chừng núi. Hang được phát hiện và công bố năm 2015, sau đó " +
      "được bổ sung vào danh sách di sản của Công viên địa chất toàn cầu Cao nguyên đá Đồng Văn. " +
      "Giới chuyên môn đánh giá hang hình thành từ hàng triệu năm trước. " +
      "Bên trong là hệ thống thạch nhũ trải dài hơn 400 m với nhiều dạng khác nhau — chuông đá, " +
      "măng đá, cột đá — nên đây là điểm khác hẳn về loại hình so với phần lớn điểm tham quan ở " +
      "Hà Giang, vốn là đèo, thung lũng và điểm ngắm cảnh ngoài trời. " +
      "Đường vào phải đi qua một đoạn đường nhỏ rẽ từ trục chính, gửi xe ở chân núi rồi đi bộ theo " +
      "đường mòn xuyên rừng thông và triền núi để lên cửa hang. Đoạn đi bộ này là thứ cần tính " +
      "trước: nó biến một điểm dừng tưởng như ghé nhanh thành một chặng chiếm kha khá thời gian " +
      "trong ngày. Trên đường đi nhìn thấy nhà của bà con người Mông bên sườn núi và ruộng nương, " +
      "xa xa là Núi Đôi Quản Bạ. " +
      "Giá vé không ghi ở đây: các nguồn cùng thời điểm nêu những mức chênh nhau, nên đây là số " +
      "cần hỏi lại tại chỗ chứ không phải số nên tin từ một bài viết.",
    tags: ["lung-khuy", "quan-ba", "hang-dong", "thach-nhu", "cao-nguyen-da", "tam-son"],
    season: ["quanh_nam"],
    sourceClass: "crawled_verified",
    sourceUrl:
      "https://mia.vn/cam-nang-du-lich/kham-pha-dong-lung-khuy-muon-mau-muon-ve-de-nhat-dong-ha-giang-3587",
    retrievedAt: "2026-09-23",
  },
];
