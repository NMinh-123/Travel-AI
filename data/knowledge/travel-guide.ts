/**
 * CẨM NANG ĐI ĐƯỜNG — nhánh `travel_guide` của kho tri thức.
 *
 * Bốn nhánh con ở đây (`transportation`, `safety`, `local_tips`, `faq`) trả lời loại câu hỏi mà
 * danh mục thực thể ở @data/places không bao giờ trả lời được. Danh mục biết đèo Mã Pí Lèng nằm
 * ở đâu và cao bao nhiêu; nó không biết rằng đi đèo đó lúc chạng vạng là một quyết định tồi. Tách
 * ra thành tài liệu tri thức có `entityType` riêng là để bộ lọc metadata chặn trước semantic
 * search: câu hỏi “có nguy hiểm không” lọc `entityType: "safety"` rồi mới tính tương đồng, thay
 * vì để vector mò trong cả kho rồi trả về một đoạn mô tả phong cảnh nghe hay mà vô dụng.
 *
 * VÌ SAO NHÓM `safety` DÀI HƠN CÁC NHÓM KHÁC. Ba nhóm còn lại mà sai thì khách mất thời gian hoặc
 * mất tiền; nhóm này mà thiếu thì khách đi vào một khúc cua mù trong sương ở độ cao gần hai nghìn
 * mét mà không được cảnh báo trước. Đó là lý do các tài liệu an toàn ở đây được viết dài hơn mức
 * cần thiết cho một đoạn chunk: khi bị cắt đoạn, mỗi nửa vẫn phải còn đủ ngữ cảnh để đứng một
 * mình mà không biến thành một lời khuyên cụt nghĩa.
 *
 * VÌ SAO KHÔNG CÓ MỘT CON SỐ TIỀN NÀO TRONG FILE NÀY. Giá vé xe, giá thuê xe máy, giá thuê xe có
 * lái đều là thứ khách hỏi nhiều nhất, và đúng vì thế mà chúng không được nằm trong văn bản RAG.
 * Một con số viết vào đây sẽ bị đóng băng trong một đoạn chunk, rồi sáu tháng sau vẫn được trích
 * ra như giá hiện hành mà không có cách nào truy ngược về ngày khảo sát. Giá thuộc về
 * `PriceEstimate` ở @data/places — kiểu bắt buộc mang theo cơ sở, ngày khảo sát và nguồn — hoặc
 * thuộc về tầng công cụ hỏi nhà cung cấp lúc chạy. Ở đây chỉ mô tả CƠ CẤU giá: có mấy hạng dịch
 * vụ, hạng nào đắt hơn hạng nào, và cái gì làm giá đội lên.
 *
 * VÌ SAO ĐỊA DANH VẪN GỌI LÀ “HÀ GIANG”. Từ 01/7/2025 Hà Giang đã sáp nhập vào tỉnh Tuyên Quang
 * và cấp huyện bị bỏ, nên về hành chính thì Đồng Văn hay Mèo Vạc không còn là huyện nữa. Nhưng
 * văn bản trong kho tri thức là thứ khách đọc, và khách vẫn nói “đi Hà Giang”, “lên Đồng Văn”.
 * Cách xử lý thống nhất trong file này: dùng tên gọi du lịch trong `content`, còn `entityId` thì
 * luôn trỏ về slug trong danh mục — nơi đã ghi rõ Hà Giang là `region` chứ không phải `province`.
 */

import type { KnowledgeSourceDoc } from "./types";

export const TRAVEL_GUIDE_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // ===============================================================================================
  // TRANSPORTATION — làm sao lên tới nơi, và lên rồi thì đi bằng gì
  //
  // Thứ tự các tài liệu trong nhóm này đi theo đúng thứ tự khách phải quyết định: trước hết là
  // chặng Hà Nội – Hà Giang, sau đó mới tới chuyện di chuyển trong vùng, rồi cuối cùng là nhiên
  // liệu. Xếp ngược lại thì đoạn nói về trạm xăng sẽ được truy hồi cho một người còn chưa biết
  // mình sẽ đi bằng xe gì.
  // ===============================================================================================
  {
    slug: "guide-xe-khach-giuong-nam-ha-noi-ha-giang",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "tp-ha-giang",
    title: "Đi xe khách giường nằm ban đêm từ Hà Nội lên thành phố Hà Giang",
    content:
      "Chặng Hà Nội đi Hà Giang không có đường sắt và không có sân bay, nên gần như toàn bộ khách " +
      "đi bằng xe khách đường dài, và tuyệt đại đa số chọn chuyến chạy đêm. Xe xuất phát từ khu vực " +
      "bến Mỹ Đình vào buổi tối, chạy khoảng sáu đến bảy tiếng nếu đường thông thoáng, và tới thành " +
      "phố Hà Giang vào lúc trời còn chưa sáng hẳn. Cách xếp giờ này là có chủ ý của các nhà xe: " +
      "khách ngủ trọn một đêm trên xe, xuống bến là ăn sáng rồi nhận xe máy đi luôn, coi như tiết " +
      "kiệm được một đêm phòng và một ngày hành trình.\n\n" +
      "Có ba hạng dịch vụ mà khách sẽ gặp khi tìm vé. Thấp nhất là giường nằm hai tầng loại phổ " +
      "thông, chỗ nằm hẹp và nằm chung khoang với cả xe. Ở giữa là giường nằm có vách ngăn, rộng " +
      "hơn và kín hơn một chút. Cao nhất là limousine dạng cabin hoặc phòng đôi, mỗi khách một " +
      "khoang riêng có cửa, và giá cách khá xa hai hạng dưới. Người say xe hoặc ngủ khó nên cân " +
      "nhắc hạng cabin, vì đường từ Tuyên Quang trở lên đã bắt đầu quanh co và nằm tầng trên của " +
      "xe giường nằm phổ thông là một đêm không ngủ được.\n\n" +
      "Có hai điều đặt vé cần biết trước. Thứ nhất, cuối tuần và mùa hoa tam giác mạch thì vé bán " +
      "hết trước cả tuần, nên đừng để tới sát ngày. Thứ hai, nhiều nhà xe nhận đón khách tại điểm " +
      "trong nội thành Hà Nội thay vì bắt ra bến, nhưng chỉ trong một khung giờ hẹp và phải báo " +
      "trước; hỏi kỹ điểm đón lúc đặt sẽ đỡ được một cuốc taxi lúc mười giờ đêm.",
    tags: ["di-chuyen", "xe-khach", "ha-noi-ha-giang", "chay-dem", "dat-truoc"],
    season: ["quanh_nam"],
    // Nội dung chắt lọc từ bài tổng hợp nhà xe của một sàn bán vé, đã bỏ toàn bộ tên nhà xe và số
    // tiền: tên nhà xe đổi liên tục còn giá thì thuộc về tầng công cụ, nên giữ lại chỉ tổ sai.
    sourceClass: "crawled_verified",
    sourceUrl: "https://blog.vexere.com/xe-giuong-nam-di-ha-giang-tu-ha-noi-12-nha-xe-uy-tin-gia-tot/",
    retrievedAt: "2026-09-09",
  },
  {
    slug: "guide-thue-xe-may-tai-thanh-pho-ha-giang",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "tp-ha-giang",
    title: "Thuê xe máy ở thành phố Hà Giang",
    content:
      "Thành phố Hà Giang là điểm thuê xe máy của gần như toàn bộ hành trình cao nguyên đá, vì đây " +
      "là nơi cuối cùng trên đường lên còn có nhiều cửa hàng để chọn và có thợ sửa xe tử tế. Phần " +
      "lớn cửa hàng nằm quanh khu trung tâm và nhiều nhà nghỉ, homestay cũng nhận cho thuê hoặc " +
      "gọi hộ. Giá tính theo ngày, và mức chênh giữa các loại xe lớn hơn mức chênh giữa các cửa " +
      "hàng, nên chọn đúng loại xe quan trọng hơn mặc cả.\n\n" +
      "Trước khi ký, có mấy việc nên làm mà rất nhiều người bỏ qua. Nổ máy nghe tiếng, bóp thử cả " +
      "hai phanh khi xe đang lăn bánh chậm chứ đừng bóp lúc dựng chân chống, kiểm tra gai lốp và " +
      "độ căng xích, bật thử đèn pha và còi. Quay một vòng video quanh xe trước khi rời cửa hàng " +
      "để tránh tranh cãi về vết xước lúc trả. Hỏi rõ cửa hàng xử lý thế nào nếu xe hỏng giữa " +
      "đường ở Đồng Văn hay Mèo Vạc, vì đó là tình huống hay xảy ra nhất và cũng là điều hợp đồng " +
      "thuê hay bỏ trống.\n\n" +
      "Chuyện giấy tờ cần nói thẳng: nhiều cửa hàng chỉ giữ giấy tờ tuỳ thân hoặc một khoản đặt " +
      "cọc mà không hỏi bằng lái. Việc họ không hỏi không có nghĩa là khách được miễn — cảnh sát " +
      "giao thông trên tuyến vẫn kiểm tra, và bảo hiểm thì nhìn vào bằng lái chứ không nhìn vào " +
      "hợp đồng thuê xe. Xem tài liệu về bằng lái và bảo hiểm trong cùng nhóm cẩm nang này.",
    tags: ["di-chuyen", "thue-xe-may", "kiem-tra-xe", "dat-coc"],
    season: ["quanh_nam"],
    sourceClass: "crawled_verified",
    sourceUrl: "https://motogo.vn/phuot-ha-giang/",
    retrievedAt: "2026-09-09",
  },
  {
    slug: "guide-chon-xe-so-hay-xe-con-tay-cho-duong-deo",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "ha-giang",
    title: "Chọn xe số, xe tay ga hay xe côn tay cho đường đèo Hà Giang",
    content:
      "Đây là quyết định ảnh hưởng tới an toàn nhiều hơn khách thường nghĩ, vì đặc điểm của đường " +
      "Hà Giang không phải là dốc dài mà là dốc gắt nối nhau liên tục, xen kẽ những khúc cua tay " +
      "áo phải đổ đèo bằng số thấp suốt nhiều cây số.\n\n" +
      "Xe số là lựa chọn hợp lý cho đa số khách. Nó ghì được máy khi xuống dốc, tức là dùng chính " +
      "động cơ để hãm bớt thay vì rà phanh liên tục, nên phanh không bị nóng và mất tác dụng ở " +
      "cuối một con dốc dài. Xe số cũng dễ mượn thợ sửa nhất dọc tuyến vì đây là loại xe người " +
      "dân địa phương dùng.\n\n" +
      "Xe côn tay cho cảm giác chủ động nhất và ghì máy tốt nhất, nhưng chỉ nên chọn nếu đã đi côn " +
      "tay thành thạo từ trước. Đường đèo Hà Giang không phải chỗ để tập côn: một lần chết máy " +
      "giữa khúc cua tay áo đang lên dốc là đủ để xe trôi ngược.\n\n" +
      "Xe tay ga là loại nên tránh, và lý do rất cụ thể chứ không phải định kiến. Tay ga không ghì " +
      "được máy khi đổ đèo nên người lái buộc phải bóp phanh gần như liên tục; phanh nóng lên thì " +
      "hiệu quả giảm dần, và người lái thường chỉ nhận ra khi cần phanh gấp. Bánh nhỏ cũng bám kém " +
      "hơn trên đoạn đường đang sửa rải đá dăm, thứ luôn có ở đâu đó trên cung này. Nếu bắt buộc " +
      "phải đi tay ga thì chỉ nên chạy quãng ngắn quanh thành phố Hà Giang và Quản Bạ, đừng đưa nó " +
      "lên Mã Pí Lèng.",
    tags: ["di-chuyen", "xe-may", "duong-deo", "phu-hop-xe-may", "an-toan"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-thue-xe-may-co-nguoi-lai-easy-rider",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "ha-giang",
    title: "Thuê xe máy có người lái (easy rider) đi cao nguyên đá",
    content:
      "Thuê xe kèm người lái bản địa là cách đi phổ biến thứ hai sau tự lái, và với một nhóm khách " +
      "nhất định thì đây mới là lựa chọn đúng: người không có bằng lái xe máy, người chưa từng đi " +
      "đường đèo, người muốn vừa đi vừa ngắm và chụp ảnh mà không phải dán mắt vào mặt đường, hoặc " +
      "khách nước ngoài không muốn dính rắc rối giấy tờ. Khách ngồi sau, tài xế lo toàn bộ phần " +
      "cầm lái và thường kiêm luôn việc dẫn đường, chỉ chỗ ăn và chỗ dừng chụp.\n\n" +
      "Dịch vụ này bán theo ngày hoặc theo trọn gói hành trình ba tới bốn ngày, và cần hỏi rõ ba " +
      "điều trước khi chốt vì đó là ba chỗ hay phát sinh nhất: gói đã gồm xăng chưa, đã gồm chỗ ăn " +
      "chỗ nghỉ của chính người lái chưa, và nếu đoàn muốn đổi lịch trình giữa chừng thì tính thế " +
      "nào. Nên xác nhận bằng tin nhắn chứ đừng chỉ thoả thuận miệng.\n\n" +
      "Một điểm cần cân nhắc thật lòng: đi xe ôm đường dài nhiều ngày mỏi hơn khách hình dung, đặc " +
      "biệt với người có vấn đề về lưng hoặc cổ. Nếu trong nhóm có người lớn tuổi hoặc trẻ nhỏ thì " +
      "ô tô là phương án hợp lý hơn, dù mất đi phần lớn cái hay của cung đường này.",
    tags: ["di-chuyen", "easy-rider", "xe-om", "khong-can-bang-lai"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-di-o-to-cho-gia-dinh-va-nhom-dong",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "cao-nguyen-da-dong-van",
    title: "Đi ô tô cho gia đình có trẻ nhỏ và người lớn tuổi",
    content:
      "Ô tô là phương án bắt buộc phải tính tới khi trong đoàn có trẻ nhỏ, người lớn tuổi hoặc " +
      "người không đi được xe máy đường dài, và nó đổi lại được sự an toàn cùng khả năng dừng nghỉ " +
      "bất cứ lúc nào. Cái mất là khách sẽ không dừng được ở những mỏm đá ven đường mà người đi xe " +
      "máy tạt vào thoải mái, và trên các đoạn hẹp thì việc tránh xe ngược chiều làm hành trình " +
      "chậm hơn hẳn so với dự tính trên bản đồ.\n\n" +
      "Nếu tự lái ô tô lên đây, hãy thành thật với chính mình về kinh nghiệm đổ đèo. Đường có nhiều " +
      "đoạn chỉ vừa đủ hai xe con tránh nhau, một bên là vách núi và bên kia là vực không có hộ " +
      "lan liên tục; xe gầm thấp qua được nhưng người lái phải quen ôm cua hẹp và quen về số thấp " +
      "khi xuống dốc thay vì rà phanh. Xe bảy chỗ gầm cao là lựa chọn cân bằng nhất cho gia đình.\n\n" +
      "Với nhóm đông và với người mới, thuê xe kèm lái xe địa phương gần như luôn là quyết định " +
      "đúng. Lái xe bản địa biết chỗ nào tránh nhau được, biết giờ nào đoạn nào hay có xe tải chở " +
      "vật liệu, và biết đường vòng khi một đoạn bị chặn vì sạt lở — ba thứ mà bản đồ dẫn đường " +
      "không biết.",
    tags: ["di-chuyen", "o-to", "gia-dinh", "nhom-dong", "thue-xe-co-lai"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-tram-xang-doc-cung-duong-cao-nguyen-da",
    domain: "travel_guide",
    entityType: "transportation",
    entityId: "cao-nguyen-da-dong-van",
    title: "Trạm xăng dọc cung đường và nguyên tắc đổ đầy khi có thể",
    content:
      "Trạm xăng trên cao nguyên đá tập trung ở các thị trấn — thành phố Hà Giang, Tam Sơn của Quản " +
      "Bạ, Yên Minh, Đồng Văn và Mèo Vạc — còn giữa các thị trấn đó thì gần như không có gì. Nghĩa " +
      "là nhiên liệu ở đây không phải chuyện mua khi cần, mà là chuyện lên kế hoạch theo thị trấn: " +
      "mỗi lần đi qua một thị trấn thì đổ đầy, kể cả khi bình còn quá nửa. Con số cây số chính xác " +
      "giữa hai điểm thì hỏi qua công cụ tra chặng đường, đừng nhớ theo cảm giác — cảm giác về " +
      "khoảng cách trên đường đèo luôn sai theo hướng nguy hiểm.\n\n" +
      "Có ba đoạn cần chú ý hơn cả. Đoạn từ Yên Minh lên Đồng Văn dài và vắng. Đoạn Đồng Văn đi " +
      "Lũng Cú rồi vòng về là một nhánh cụt, tức là đi bao nhiêu phải về bấy nhiêu trên cùng lượng " +
      "xăng. Và đoạn Đồng Văn qua Mã Pí Lèng xuống Mèo Vạc thì tuyệt đối không nên vào với bình " +
      "gần cạn, vì hết xăng giữa đèo là tình huống không có cách nào tự xử lý.\n\n" +
      "Dọc đường vẫn có những nhà dân bán xăng lẻ bằng chai hoặc can. Đó là cứu cánh khi bí, nhưng " +
      "không nên coi là kế hoạch: lượng bán ra ít, chất lượng không kiểm soát được, và bơm xăng " +
      "bẩn vào xe thuê giữa cao nguyên đá là cách nhanh nhất để hỏng nốt cả buổi chiều.",
    tags: ["di-chuyen", "tram-xang", "nhien-lieu", "lap-ke-hoach", "duong-deo"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // SAFETY — nhóm quan trọng nhất của cả file
  //
  // Nguyên tắc viết cho nhóm này: mỗi tài liệu phải nói rõ ĐIỀU GÌ HỎNG chứ không dừng ở lời
  // khuyên. “Không nên đi đèo ban đêm” là một câu ai cũng gật rồi vẫn đi; “đèn pha xe máy chiếu
  // được chừng nào thì trên đường không hộ lan liên tục nó chiếu ra khoảng không” là câu làm người
  // ta đổi kế hoạch. Tác tử trích nguyên văn được cả hai, nên viết câu thứ hai.
  // ===============================================================================================
  {
    slug: "guide-bang-lai-a1-va-bao-hiem-khi-thue-xe",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "ha-giang",
    title: "Bằng lái xe máy và bảo hiểm — điều dễ bỏ qua nhất và tốn kém nhất",
    content:
      "Điều khiển xe máy trên tuyến Hà Giang là hoạt động giao thông bình thường trên đường công " +
      "cộng, nên vẫn phải có giấy phép lái xe hợp lệ với loại xe đang đi. Khách Việt Nam đi xe " +
      "phân khối phổ thông cần hạng A1 trở lên; khách nước ngoài cần bằng lái được công nhận tại " +
      "Việt Nam, thường là giấy phép quốc tế theo Công ước Vienna kèm bằng gốc, và giấy phép quốc " +
      "tế cấp theo Công ước Geneva thì không đương nhiên dùng được. Đây là chỗ rất nhiều khách " +
      "nước ngoài hiểu sai.\n\n" +
      "Chuyện đáng nói không nằm ở mức phạt. Nó nằm ở bảo hiểm. Nếu xảy ra tai nạn mà người điều " +
      "khiển không có bằng lái hợp lệ, phần lớn hợp đồng bảo hiểm du lịch sẽ từ chối chi trả toàn " +
      "bộ chi phí y tế, bao gồm cả chi phí vận chuyển cấp cứu. Trên địa hình này, một ca phải " +
      "chuyển tuyến từ Đồng Văn hoặc Mèo Vạc về bệnh viện tỉnh rồi về Hà Nội là một khoản tiền lớn " +
      "và một quãng đường dài; tự chi trả toàn bộ là kịch bản mà không ai chuẩn bị trước.\n\n" +
      "Việc cửa hàng cho thuê không hỏi bằng lái không thay đổi gì cả. Họ chịu rủi ro về chiếc xe, " +
      "còn khách chịu rủi ro về chính mình. Nếu không có bằng phù hợp, phương án đúng là thuê xe " +
      "có người lái hoặc đi ô tô, chứ không phải hy vọng không bị kiểm tra. Trên tuyến này có chốt " +
      "kiểm tra và vị trí chốt thay đổi theo thời điểm.",
    tags: ["an-toan", "bang-lai", "bao-hiem", "phap-ly", "khach-nuoc-ngoai"],
    season: ["quanh_nam"],
    sourceClass: "crawled_verified",
    sourceUrl: "https://www.vietnamcoracle.com/ha-giang-extreme-north-motorbike-loop/",
    retrievedAt: "2026-09-09",
  },
  {
    slug: "guide-an-toan-duong-deo-mua-mua-va-sat-lo",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "duong-hanh-phuc",
    title: "Đường đèo mùa mưa, đá lăn và sạt lở",
    content:
      "Từ khoảng tháng sáu tới tháng tám là mùa mưa của vùng núi phía bắc, và đây là mùa duy nhất " +
      "mà rủi ro trên cung Hà Giang không đến từ tay lái mà đến từ chính con đường. Nền địa chất " +
      "cao nguyên đá vôi bị ngấm nước lâu ngày sẽ trượt theo mảng, nên sạt lở ở đây không báo " +
      "trước bằng nứt nẻ như đường đất mà thường đổ xuống trong hoặc ngay sau một trận mưa lớn.\n\n" +
      "Hai dạng nguy hiểm khác nhau và cần xử lý khác nhau. Dạng thứ nhất là đất đá lấp mặt đường: " +
      "khó chịu nhưng nhìn thấy được, thường có xe máy xúc tới dọn trong ngày, và cách xử lý là " +
      "chờ hoặc quay lại chứ tuyệt đối không tìm cách trèo qua đống đất còn đang ẩm. Dạng thứ hai " +
      "nguy hiểm hơn nhiều là đá lăn đơn lẻ từ taluy dương xuống, không có dấu hiệu gì và rơi đúng " +
      "vào lúc có người đi qua. Đó là lý do quy tắc quan trọng nhất mùa mưa là không dừng lại nghỉ " +
      "ngay dưới chân một vách taluy dựng đứng, dù chỗ đó có bóng mát và trông rất tiện.\n\n" +
      "Còn hai điều nữa của mùa này. Nước chảy tràn ngang mặt đường ở các khe suối cạn: nhìn nông " +
      "nhưng đáy trơn rêu và dòng đẩy ngang bánh xe, nên xuống dắt bộ chứ đừng phóng qua. Và mặt " +
      "đường bê tông ở các đoạn dốc trong bản, khi ướt, trơn hơn nhựa đường rất nhiều — nhiều cú " +
      "ngã trên cung này xảy ra ở tốc độ chậm trên đúng loại mặt đường đó.\n\n" +
      "Trước khi khởi hành mỗi buổi sáng của mùa mưa, nên hỏi chủ homestay về tình trạng đoạn " +
      "đường định đi trong ngày. Thông tin sạt lở ở đây lan bằng miệng và bằng nhóm tin nhắn của " +
      "người địa phương nhanh hơn bất kỳ ứng dụng bản đồ nào.",
    tags: ["an-toan", "mua-mua", "sat-lo", "da-lan", "duong-tron", "canh-bao"],
    season: ["mua_mua"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-an-toan-suong-mu-tam-nhin-gan",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "deo-ma-pi-leng",
    title: "Sương mù trên đèo và cách đi khi tầm nhìn chỉ còn vài mét",
    content:
      "Sương mù là hiện tượng đặc trưng của các đoạn đèo cao ở đây và nó không chỉ có vào mùa " +
      "lạnh. Mây thấp trườn qua yên đèo bất cứ lúc nào trong năm, hay gặp nhất vào sáng sớm, chiều " +
      "muộn và ngay sau mưa. Điều làm nó nguy hiểm là tính đột ngột: khách đang đi trong nắng, " +
      "vòng qua một sườn núi, và tầm nhìn tụt xuống còn vài mét trong vòng vài chục giây.\n\n" +
      "Trong sương thì bật đèn để người khác thấy mình chứ đừng trông vào đèn để mình nhìn thấy " +
      "đường; ánh sáng trắng mạnh hắt ngược lại từ hạt sương còn làm chói thêm, nên đèn vàng hoặc " +
      "đèn cốt tốt hơn đèn pha. Đi chậm hẳn lại, bám vạch sơn bên phải làm mốc, và giữ khoảng cách " +
      "lớn hơn bình thường vì xe trước có thể dừng đột ngột mà không có gì báo trước.\n\n" +
      "Nếu sương dày tới mức không thấy vạch đường nữa thì lựa chọn đúng là dừng lại, nhưng phải " +
      "dừng cho đúng chỗ. Tuyệt đối không dừng giữa lòng đường hay ở khúc cua: xe sau cũng đang " +
      "mù và sẽ không thấy. Tìm một điểm mở rộng, tấp hẳn vào trong, bật đèn khẩn cấp nếu là ô tô, " +
      "và đứng ra khỏi phần đường xe chạy. Sương ở đây thường tan hoặc loãng đi trong vòng nửa " +
      "tiếng tới một tiếng khi nắng lên, nên chờ gần như luôn là quyết định rẻ hơn liều.\n\n" +
      "Hệ quả cho việc lập lịch trình: đừng xếp đoạn đèo dài vào sáng sớm tinh mơ của mùa lạnh, và " +
      "đừng xếp nó vào cuối ngày. Khoảng giữa buổi sáng tới đầu giờ chiều là khung giờ tầm nhìn " +
      "tốt nhất và cũng là lúc cảnh đẹp nhất.",
    tags: ["an-toan", "suong-mu", "tam-nhin", "duong-deo", "khung-gio-di"],
    season: ["mua_lanh", "mua_mua", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-an-toan-khong-di-deo-ban-dem",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "deo-ma-pi-leng",
    title: "Không đi đèo sau khi trời tối — vì sao đây là quy tắc cứng",
    content:
      "Nguyên tắc thực tế của cả cung đường này là kết thúc việc di chuyển trước lúc mặt trời " +
      "lặn, và nó là quy tắc cứng chứ không phải lời khuyên cho người nhát tay. Lý do rất cụ thể: " +
      "phần lớn các đoạn đèo ở đây không có đèn đường, không có hộ lan liên tục và không có vạch " +
      "phản quang. Đèn xe máy chiếu thẳng về phía trước, nhưng đường thì cong liên tục, nên ở " +
      "trước mỗi khúc cua ánh đèn chiếu ra khoảng không của vực chứ không chiếu vào mặt đường sắp " +
      "tới. Người lái mất hoàn toàn khả năng đọc trước hình dạng con đường, và đó là thứ giữ cho " +
      "họ an toàn suốt cả ban ngày.\n\n" +
      "Ba yếu tố nữa cộng vào cùng lúc sau khi tối. Trâu bò được thả về bản đi trên đường và chúng " +
      "màu sẫm, đứng im, không phản quang. Xe tải chở vật liệu chạy nhiều hơn vào ban đêm và đèn " +
      "pha của chúng làm người đi xe máy loá hẳn trong vài giây ở đúng chỗ không được phép loá. Và " +
      "sương xuống dày hơn hẳn sau khi mặt trời lặn vì chênh lệch nhiệt độ.\n\n" +
      "Hệ quả cho lịch trình: tính giờ đến của mỗi ngày sớm hơn ít nhất một tiếng so với mức khách " +
      "nghĩ là vừa đủ, vì trên cung này mọi thứ đều lâu hơn dự tính — dừng chụp ảnh, chờ tránh xe, " +
      "một đoạn đang sửa. Nếu trời sắp tối mà vẫn còn cách điểm nghỉ một đoạn đèo, phương án đúng " +
      "là tìm chỗ ngủ ở thị trấn gần nhất, kể cả khi phòng không ưng ý. Cao nguyên đá không thiếu " +
      "chỗ ngủ ở các thị trấn, và một đêm ở nhà nghỉ xoàng rẻ hơn mọi thứ khác.",
    tags: ["an-toan", "di-dem", "lap-ke-hoach", "duong-deo", "quy-tac-cung"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-an-toan-song-dien-thoai-va-cuu-ho-vung-sau",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "cao-nguyen-da-dong-van",
    title: "Sóng điện thoại, mất liên lạc và thực tế của việc cứu hộ ở vùng sâu",
    content:
      "Sóng di động trên cao nguyên đá phủ tốt ở các thị trấn và dọc trục chính, nhưng đứt quãng " +
      "ở đáy các thung lũng, trong hẻm vực và trên những nhánh đường vào bản. Điều cần hiểu là các " +
      "khoảng mất sóng đó không dài lắm về cây số nhưng lại rơi đúng vào những nơi dễ gặp sự cố " +
      "nhất, tức là đúng lúc cần gọi thì không gọi được.\n\n" +
      "Cách chuẩn bị hiệu quả nhất không phải là mua thêm thiết bị mà là tải sẵn bản đồ ngoại " +
      "tuyến của toàn vùng trước khi rời thành phố Hà Giang, mang theo pin dự phòng đã sạc đầy, và " +
      "quan trọng nhất là báo lộ trình trong ngày cho một người không đi cùng — chủ homestay đêm " +
      "trước hoặc người nhà. Nếu tối mà không thấy tin nhắn, sẽ có người biết cần tìm ở đoạn nào. " +
      "Đi theo nhóm ít nhất hai xe cũng giải quyết được phần lớn vấn đề này, vì một người ở lại " +
      "với xe hỏng thì người kia chạy tới chỗ có sóng.\n\n" +
      "Về cứu hộ, cần nói thật để khách tự cân nhắc mức rủi ro. Đây là địa hình núi cao, đường độc " +
      "đạo và nhiều đoạn hẹp, nên xe cấp cứu tới nơi mất thời gian và việc chuyển tuyến về tới " +
      "bệnh viện tuyến trên là một quãng đường dài. Trạm y tế xã và trung tâm y tế ở các thị trấn " +
      "xử lý được sơ cứu và những chấn thương thông thường, còn ca nặng thì phải chuyển. Kết luận " +
      "rút ra không phải là đừng đi, mà là đi chậm hơn mức mình nghĩ là an toàn, vì ở đây cái giá " +
      "của một tai nạn nhỏ cao hơn ở đồng bằng rất nhiều.",
    tags: ["an-toan", "song-dien-thoai", "cuu-ho", "ban-do-offline", "di-theo-nhom"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-an-toan-so-dien-thoai-khan-cap",
    domain: "travel_guide",
    entityType: "safety",
    title: "Số điện thoại khẩn cấp và gọi ai trong trường hợp nào",
    content:
      "Ba số khẩn cấp dùng chung toàn quốc, gọi được cả khi máy không có tiền và trong nhiều " +
      "trường hợp cả khi không có sim của nhà mạng đó. Số 113 là cảnh sát, gọi khi có tai nạn giao " +
      "thông, mất trộm hoặc xô xát. Số 114 là cảnh sát phòng cháy chữa cháy và cứu nạn cứu hộ, tức " +
      "là số cần gọi khi có người mắc kẹt, rơi xuống vực hoặc bị nạn ở địa hình khó tiếp cận — " +
      "đây là số mà khách hay quên nhất mà lại là số đúng cho phần lớn tình huống nghiêm trọng " +
      "trên cung này. Số 115 là cấp cứu y tế.\n\n" +
      "Ở khu vực biên giới, đồn biên phòng gần nhất trên thực tế thường là lực lượng tới được sớm " +
      "nhất, vì họ đóng ngay trên địa bàn và thuộc đường. Khi đi các nhánh sát biên như Lũng Cú, " +
      "Phó Bảng hay các đoạn dọc cột mốc, nên biết đồn biên phòng nằm ở đâu trên đường mình đi.\n\n" +
      "Hai việc nên làm trước khi khởi hành mà mất chưa tới năm phút. Thứ nhất, lưu số điện thoại " +
      "của chủ homestay từng đêm và của cửa hàng cho thuê xe vào máy, vì đó là hai đầu mối xử lý " +
      "nhanh nhất cho những sự cố không tới mức gọi 113. Thứ hai, khi gọi khẩn cấp thì việc đầu " +
      "tiên là nói được mình đang ở đâu: mốc gần nhất, tên bản, tên đoạn đèo, hoặc toạ độ đọc từ " +
      "bản đồ ngoại tuyến. Ở địa hình này, xác định vị trí mất nhiều thời gian hơn cả quãng đường " +
      "di chuyển.",
    tags: ["an-toan", "khan-cap", "so-dien-thoai", "bien-phong", "cuu-nan"],
    season: ["quanh_nam"],
    // Cố tình không gắn `entityId`: số khẩn cấp có giá trị ở mọi điểm trên hành trình, gắn nó vào
    // một thực thể cụ thể sẽ khiến bộ lọc theo địa danh giấu mất tài liệu này ở tất cả nơi khác.
    sourceClass: "editorial",
  },
  {
    slug: "guide-an-toan-di-thuyen-song-nho-que",
    domain: "travel_guide",
    entityType: "safety",
    entityId: "song-nho-que",
    title: "An toàn khi xuống bến và đi thuyền trên sông Nho Quế",
    content:
      "Đi thuyền vào hẻm Tu Sản là hoạt động dưới nước duy nhất mà đa số khách tham gia trên cung " +
      "này, và nó có hai phần rủi ro tách biệt nhau mà khách hay chỉ nghĩ tới phần thứ hai.\n\n" +
      "Phần thứ nhất là đoạn đường xuống bến. Từ trên đường lớn xuống mặt nước là một con dốc rất " +
      "gắt với nhiều khúc cua liền nhau, mặt đường hẹp và có đoạn bê tông trơn khi ẩm. Đây là đoạn " +
      "xảy ra nhiều sự cố hơn hẳn bản thân chuyến thuyền. Nếu tay lái chưa vững thì gửi xe ở trên " +
      "và đi xe ôm địa phương xuống là quyết định hợp lý; lúc lên dốc quay ra cũng là lúc xe dễ " +
      "chết máy giữa cua nhất, nên chở đôi trên đoạn này là điều nên tránh.\n\n" +
      "Phần thứ hai là trên thuyền. Mặc áo phao và mặc cho đúng chứ đừng vắt lên vai để chụp ảnh, " +
      "vì nước ở hẻm vực sâu và lạnh, hai bên là vách đá dựng đứng không có chỗ bám. Không đứng " +
      "dậy hay đổi chỗ khi thuyền đang chạy, và giữ trẻ nhỏ ngồi giữa lòng thuyền. Nếu chủ thuyền " +
      "nhận thêm khách quá số ghế thì đợi chuyến sau.\n\n" +
      "Cuối cùng là chuyện thời tiết. Sau mưa lớn, nước đục và dòng mạnh hơn, và có những ngày " +
      "thuyền không chạy. Đó là quyết định của người vận hành dựa trên mặt nước hôm đó, không phải " +
      "chuyện có thể thương lượng; ai gợi ý chạy trong điều kiện người khác đã dừng thì càng nên " +
      "tránh.",
    tags: ["an-toan", "duong-thuy", "ao-phao", "duong-xuong-ben", "mua-mua"],
    season: ["mua_mua", "quanh_nam"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // LOCAL_TIPS — những thứ nhỏ mà thiếu thì hỏng cả chuyến
  // ===============================================================================================
  {
    slug: "guide-doi-tien-tien-mat-va-atm",
    domain: "travel_guide",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Tiền mặt, ATM và chuyện thanh toán trên cao nguyên đá",
    content:
      "Nguyên tắc gọn nhất cho vùng này: rút đủ tiền mặt ở thành phố Hà Giang trước khi lên cao " +
      "nguyên. Thành phố có đầy đủ chi nhánh ngân hàng và cây rút tiền của nhiều nhà băng; các thị " +
      "trấn Tam Sơn, Yên Minh, Đồng Văn, Mèo Vạc có cây nhưng ít, thuộc số ít ngân hàng, và thỉnh " +
      "thoảng hết tiền vào đúng cuối tuần đông khách hoặc lỗi mạng. Còn ngoài các thị trấn đó thì " +
      "gần như không có gì.\n\n" +
      "Chuyển khoản bằng mã QR đã phổ biến hơn nhiều so với vài năm trước và phần lớn homestay, " +
      "quán ăn ở thị trấn đều nhận. Nhưng cách thanh toán đó phụ thuộc vào sóng, mà sóng thì không " +
      "phủ đều — nên nó là phương án bổ sung chứ không thay được tiền mặt. Máy quẹt thẻ thì chỉ " +
      "có ở khách sạn lớn và vài cơ sở du lịch.\n\n" +
      "Có ba khoản gần như luôn phải trả bằng tiền mặt và nên chuẩn bị tiền lẻ: vé tham quan và " +
      "vé gửi xe ở các điểm, chợ phiên, và tiền mua đồ ở các hàng quán nhỏ ven đường. Với khách " +
      "nước ngoài, đổi ngoại tệ nên làm từ Hà Nội; ở đây việc đổi tiền không thuận tiện và tỷ giá " +
      "không tốt.",
    tags: ["kinh-nghiem", "tien-mat", "atm", "chuyen-khoan", "chuan-bi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-mang-gi-theo-nguoi-khi-di-ha-giang",
    domain: "travel_guide",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Mang gì theo người cho chuyến đi cao nguyên đá",
    content:
      "Hành lý cho cung này nên gọn hơn khách thường nghĩ, vì phần lớn thời gian nó buộc sau xe " +
      "máy trên đường xóc. Một balo vừa phải chống nước, hoặc túi được bọc thêm áo mưa, hơn hẳn " +
      "vali kéo — mặt đường ở nhiều điểm dừng và lối vào homestay không kéo vali được.\n\n" +
      "Nhóm bắt buộc gồm giấy tờ tuỳ thân và bằng lái bản gốc, sạc dự phòng đã sạc đầy, áo mưa " +
      "loại bộ hai mảnh chứ không phải áo mưa cánh dơi vì loại cánh dơi rất dễ cuốn vào bánh xe, " +
      "và một đôi giày kín mũi có đế bám. Dép lê đi xe máy đường đèo là một trong những sai lầm " +
      "phổ biến nhất và cũng dễ sửa nhất.\n\n" +
      "Nhóm nên có vì mua tại chỗ khó: thuốc cá nhân đang dùng, gói sơ cứu nhỏ có băng gạc và " +
      "sát trùng, thuốc say xe, kem chống nắng vì nắng vùng cao gắt hơn cảm giác, khăn đa năng che " +
      "cổ và mũi khỏi bụi với gió, cùng găng tay dài ngón. Đèn pin nhỏ có ích hơn tưởng tượng ở " +
      "những bản chưa có đèn đường.\n\n" +
      "Nhóm nên bỏ lại: đồ điện tử cồng kềnh không dùng tới, quần áo mang dư, và các chai lọ lớn. " +
      "Đổi lại, mang thêm vài túi nilon để bọc đồ điện tử phòng mưa — mưa ở đây đến rất nhanh, " +
      "thường không kịp tấp vào đâu.",
    tags: ["kinh-nghiem", "hanh-ly", "chuan-bi", "so-cuu", "ao-mua"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-quan-ao-theo-tung-mua",
    domain: "travel_guide",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Mặc gì theo từng mùa ở vùng cao Hà Giang",
    content:
      "Quy tắc chung đúng cho cả bốn mùa là mặc nhiều lớp mỏng thay vì một lớp dày. Trong cùng một " +
      "ngày, khách sẽ đi từ thị trấn dưới thấp lên yên đèo rồi lại xuống, và chênh lệch nhiệt độ " +
      "theo độ cao đủ lớn để một chiếc áo khoác duy nhất luôn sai ở một trong hai đầu. Lớp ngoài " +
      "nên cản gió và cản nước, vì trên xe máy thì gió mới là thứ làm lạnh chứ không phải nhiệt độ " +
      "trong dự báo.\n\n" +
      "Mùa xuân, khoảng tháng một tới tháng ba, là mùa hoa đào hoa mận và cũng là mùa ẩm với mưa " +
      "phùn. Cần áo khoác gió, thêm một lớp giữ nhiệt mỏng, và chấp nhận rằng quần áo phơi qua đêm " +
      "có thể không khô.\n\n" +
      "Mùa hè và mùa mưa, khoảng tháng sáu tới tháng tám, thì ban ngày nắng gắt còn mưa rào đến " +
      "bất chợt. Mặc đồ nhanh khô, đội mũ, bôi kem chống nắng, và luôn có bộ áo mưa trong tầm với " +
      "chứ đừng cất dưới đáy balo.\n\n" +
      "Mùa thu, khoảng tháng chín tới tháng mười một, là mùa lúa chín rồi tới mùa hoa tam giác " +
      "mạch, cũng là mùa đẹp và đông khách nhất. Ban ngày dễ chịu nhưng sáng sớm và chiều muộn " +
      "trên đèo đã se lạnh, nên vẫn cần một lớp ấm.\n\n" +
      "Mùa đông, khoảng tháng mười hai tới tháng một, là mùa cần chuẩn bị nghiêm túc nhất. Trên " +
      "các điểm cao có những đợt rét đậm kèm băng giá, và người đi xe máy sẽ thấy tay là bộ phận " +
      "chịu không nổi trước tiên. Găng tay dày cản gió, khăn ống che cổ, mũ len đội dưới mũ bảo " +
      "hiểm và tất dày là bốn thứ tạo ra khác biệt lớn nhất.",
    tags: ["kinh-nghiem", "quan-ao", "mac-nhieu-lop", "theo-mua"],
    season: ["hoa_dao_man", "mua_mua", "lua_chin", "hoa_tam_giac_mach", "mua_lanh", "hoa_cai"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-do-am-va-lanh-sau-tren-deo",
    domain: "travel_guide",
    entityType: "local_tips",
    entityId: "deo-ma-pi-leng",
    title: "Vì sao trên đèo lạnh hơn nhiều so với con số trong dự báo",
    content:
      "Khách hay xem dự báo thời tiết cho thành phố Hà Giang rồi mặc theo con số đó, và đến trưa " +
      "trên yên đèo thì run. Có ba thứ cộng lại làm cảm giác lạnh khác hẳn nhiệt độ đo được, và " +
      "hiểu chúng thì mới chuẩn bị đúng.\n\n" +
      "Thứ nhất là độ cao. Thị trấn dưới thấp và đỉnh đèo cách nhau cả nghìn mét, mà không khí thì " +
      "cứ lên cao là lạnh đi, nên một dự báo lấy theo điểm dưới thấp luôn ấm hơn thực tế trên đèo. " +
      "Đây chính là lý do dữ liệu thời tiết của dự án gắn độ cao vào từng điểm thay vì hỏi chung " +
      "cho cả vùng.\n\n" +
      "Thứ hai là gió. Trên yên đèo và các mỏm ngắm cảnh gió gần như không bao giờ ngớt, và khi " +
      "ngồi trên xe máy thì còn cộng thêm tốc độ chạy. Gió cuốn đi lớp không khí ấm sát da nên cơ " +
      "thể mất nhiệt nhanh hơn hẳn; đó là lý do một chiếc áo gió mỏng nhưng kín lại ấm hơn một " +
      "chiếc áo len dày mà hở cổ và hở cổ tay.\n\n" +
      "Thứ ba là độ ẩm. Vùng này ẩm quanh năm, sương và mưa phùn làm quần áo ngấm nước mà người " +
      "mặc không nhận ra, và vải ẩm thì không giữ nhiệt được nữa. Cái lạnh ẩm ở đây buốt hơn cái " +
      "lạnh khô ở cùng nhiệt độ, và nó là kiểu lạnh mà mặc thêm một lớp ướt nữa cũng không giải " +
      "quyết được. Cách xử lý duy nhất có tác dụng là lớp ngoài chống nước và thay đồ khô ngay khi " +
      "về tới chỗ nghỉ.",
    tags: ["kinh-nghiem", "thoi-tiet", "do-cao", "gio", "do-am", "giu-am"],
    season: ["mua_lanh", "mua_mua", "quanh_nam"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // FAQ — ba câu hỏi khách gửi tới nhiều hơn tất cả các câu còn lại cộng lại
  //
  // Nhóm này cố tình không gắn `entityId` cho câu hỏi mang tính toàn hành trình. Gắn “đi mấy ngày”
  // vào một địa danh cụ thể sẽ khiến nó chỉ nổi lên khi khách nhắc đúng địa danh đó, trong khi câu
  // hỏi ấy thường được đặt lúc khách còn chưa biết mình sẽ tới đâu.
  // ===============================================================================================
  {
    slug: "guide-faq-giay-phep-vao-khu-vuc-bien-gioi",
    domain: "travel_guide",
    entityType: "faq",
    entityId: "cot-moc-bien-gioi",
    title: "Đi Lũng Cú, Phó Bảng và các điểm sát biên có cần giấy phép không",
    content:
      "Câu trả lời ngắn là có, khu vực biên giới không phải nơi cứ đi tới là vào được, và mức thủ " +
      "tục khác nhau giữa khách Việt Nam với khách nước ngoài. Các điểm nằm trong diện này gồm " +
      "vùng Lũng Cú, Phó Bảng và những đoạn men theo đường biên hoặc dẫn tới cột mốc.\n\n" +
      "Với công dân Việt Nam, đi tham quan ban ngày ở những điểm du lịch đã mở như cột cờ Lũng Cú " +
      "thì mang theo giấy tờ tuỳ thân là đủ trong thực tế, nhưng phải luôn có sẵn để xuất trình " +
      "khi được yêu cầu. Nếu nghỉ qua đêm trong khu vực biên giới thì phải khai báo lưu trú với " +
      "công an cấp xã như mọi nơi khác, và với các thôn bản nằm sát vành đai biên giới thì cơ sở " +
      "lưu trú còn phải báo đồn biên phòng — việc này chủ homestay làm giúp, khách chỉ cần đưa " +
      "giấy tờ và đừng nhận ngủ ở nơi không nhận đăng ký.\n\n" +
      "Với người nước ngoài, quy định chặt hơn: vào khu vực biên giới đất liền cần giấy phép do cơ " +
      "quan công an cấp, và tour do đơn vị lữ hành tổ chức thường lo phần này. Đây là lý do khách " +
      "nước ngoài đi tự túc đôi khi bị dừng ở một số nhánh đường mà khách Việt Nam đi qua bình " +
      "thường.\n\n" +
      "Ba việc nên nhớ ở bất kỳ đoạn nào sát biên. Không vượt qua vành đai được đánh dấu và không " +
      "trèo qua cột mốc để chụp ảnh sang phía bên kia. Chấp hành yêu cầu của bộ đội biên phòng " +
      "ngay cả khi thấy vô lý, vì họ mới là người nắm tình hình biên giới hôm đó. Và vì quy định " +
      "cùng danh sách khu vực có thể thay đổi, cách chắc chắn nhất vẫn là hỏi trước chủ cơ sở lưu " +
      "trú hoặc đồn biên phòng gần nhất về đúng cung đường mình định đi.",
    tags: ["faq", "khu-vuc-bien-gioi", "giay-phep", "khai-bao-luu-tru", "khach-nuoc-ngoai"],
    season: ["quanh_nam"],
    // Cố ý để `editorial` chứ không gắn một đường dẫn văn bản pháp luật cụ thể. Quy định về khu vực
    // biên giới được sửa nhiều lần và danh sách địa bàn thay đổi theo đợt sắp xếp hành chính; trích
    // dẫn một điều khoản cứng ở đây sẽ biến một hướng dẫn còn đúng thành một câu trả lời sai mà
    // nghe rất chắc chắn. Nội dung vì vậy dừng ở mức hướng người hỏi tới nơi xác nhận được.
    sourceClass: "editorial",
  },
  {
    slug: "guide-faq-ve-tham-quan-mua-o-dau",
    domain: "travel_guide",
    entityType: "faq",
    entityId: "cao-nguyen-da-dong-van",
    title: "Điểm nào phải mua vé tham quan và mua ở đâu",
    content:
      "Phần lớn cảnh đẹp trên cung Hà Giang là cảnh nhìn từ đường và không phải mua vé, gồm các " +
      "đỉnh đèo, các điểm dừng ngắm cảnh ven đường và bản thân con đường Hạnh Phúc. Vé chỉ xuất " +
      "hiện ở những nơi có ban quản lý hoặc có hạ tầng phục vụ, và ở đó thì gần như luôn có thêm " +
      "khoản gửi xe tính riêng.\n\n" +
      "Những nơi khách hay phải mua vé gồm khu di tích kiến trúc nghệ thuật nhà Vương ở Sà Phìn, " +
      "khu vực cột cờ Lũng Cú, chuyến thuyền trên sông Nho Quế vào hẻm Tu Sản, và một số điểm ngắm " +
      "cảnh hoặc vườn hoa do hộ dân tự tổ chức thu tiền chụp ảnh. Nhóm cuối cùng này khác hẳn ba " +
      "nhóm trên: đó là thoả thuận dân sự tại chỗ chứ không phải vé của cơ quan quản lý, nên hỏi " +
      "giá trước khi bước vào là điều nên làm.\n\n" +
      "Vé bán trực tiếp tại quầy ở cổng vào, thanh toán bằng tiền mặt là chắc ăn nhất, và không có " +
      "hệ thống bán vé trực tuyến chung cho các điểm này. Vé thuyền sông Nho Quế bán tại bến, và " +
      "vào cuối tuần mùa cao điểm thì có thể phải chờ chuyến.\n\n" +
      "Về mức tiền, tài liệu này cố tình không ghi con số. Giá vé thay đổi theo quyết định của đơn " +
      "vị quản lý và theo mùa, nên con số duy nhất đáng tin là con số hỏi được tại thời điểm đi — " +
      "qua công cụ tra cứu của trợ lý hoặc hỏi thẳng chủ cơ sở lưu trú tối hôm trước.",
    tags: ["faq", "ve-tham-quan", "gui-xe", "tien-mat"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "guide-faq-di-may-ngay-la-du",
    domain: "travel_guide",
    entityType: "faq",
    title: "Đi Hà Giang mấy ngày là đủ",
    content:
      "Không có một con số đúng cho mọi người, nhưng có một cách nghĩ đúng: đếm số đêm ngủ ở trên " +
      "cao nguyên chứ đừng đếm tổng số ngày, vì hai đêm xe khách chạy đêm không phải là hai ngày " +
      "chơi.\n\n" +
      "Hai đêm trên cao nguyên là mức tối thiểu và chỉ vừa đủ cho vòng cơ bản: từ thành phố Hà " +
      "Giang qua Quản Bạ và Yên Minh lên Đồng Văn ngủ một đêm, hôm sau qua Mã Pí Lèng xuống Mèo " +
      "Vạc, rồi vòng về. Lịch này đi được những điểm nổi tiếng nhất nhưng phải chạy khá gấp và gần " +
      "như không có chỗ để hỏng việc — chỉ cần một buổi mưa là phải bỏ bớt điểm.\n\n" +
      "Ba đêm là mức hợp lý nhất cho đa số khách. Nó cho phép thêm nhánh Lũng Cú, thêm chuyến " +
      "thuyền sông Nho Quế, và quan trọng hơn là cho phép đi chậm — mà đi chậm mới là cách hưởng " +
      "cung đường này. Bốn đêm trở lên thì mở thêm được Du Già hoặc rẽ sang ruộng bậc thang Hoàng " +
      "Su Phì, vốn là một hướng khác hẳn và cần thêm thời gian di chuyển.\n\n" +
      "Hai lưu ý làm thay đổi con số. Nếu muốn đi chợ phiên thì phải xếp lịch quanh ngày họp chợ " +
      "chứ không xếp theo ý mình, và điều đó thường buộc phải thêm một đêm. Còn nếu đi vào mùa " +
      "mưa, hãy để dư nửa ngày trong lịch trình cho một đoạn đường bị chặn; không dùng tới thì " +
      "được nghỉ, mà cần tới thì đỡ phải chọn giữa lỡ chuyến xe về và chạy đèo lúc trời tối.",
    tags: ["faq", "lap-lich-trinh", "so-ngay", "cho-phien", "mua-mua"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
