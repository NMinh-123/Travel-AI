import type { KnowledgeSourceDoc } from "@data/knowledge/types";

/**
 * MẶT "LỊCH SỬ" của kho tri thức — trả lời câu hỏi vì sao nơi đó thành ra như bây giờ.
 *
 * Đây là mặt duy nhất trong sáu mặt mà một câu sai không tự lộ ra. Mô tả cảnh quan sai thì khách
 * đến nơi là biết ngay; giá sai thì phát hiện lúc thanh toán; còn một cái tên người gán lệch hay
 * một mốc năm chệch đi thì được đọc, được tin, và được kể lại. Vì vậy nguyên tắc viết ở file này
 * khác hẳn các file kia: **thà khái quát mà đúng còn hơn cụ thể mà đoán**. Chỗ nào chỉ nắm được
 * đại thể thì viết ở mức đại thể; tuyệt đối không lấy một con số nghe hợp lý để lấp chỗ trống,
 * vì con số đó sẽ đi tiếp vào câu trả lời của khách mà không còn ai truy được nó từ đâu ra.
 *
 * HAI LOẠI NỘI DUNG BỊ LOẠI KHỎI ĐÂY. Thứ nhất là những gì thuộc cảnh quan hiện tại — chúng nằm
 * ở @data/knowledge/descriptions. Thứ hai là phong tục và đời sống đang diễn ra: chợ phiên họp
 * theo con giáp, nghề dệt lanh, lễ hội. Những thứ đó là **văn hoá đang sống**, không phải lịch
 * sử, và chúng nằm ở @data/knowledge/culture. Ranh giới thực dụng: nếu điều đó vẫn đang xảy ra
 * mỗi tuần hoặc mỗi năm thì nó là văn hoá; nếu nó đã kết thúc và để lại dấu vết thì nó là lịch sử.
 *
 * VÌ SAO `season` LUÔN LÀ `["quanh_nam"]`. Một sự kiện đã xảy ra thì không đổi theo tháng khách
 * đến. Gắn mùa cụ thể sẽ khiến bộ lọc mùa — vốn chạy TRƯỚC semantic search — cắt mất chính tài
 * liệu lịch sử khi khách hỏi vào tháng khác, và tác tử sẽ trả lời như thể không có dữ liệu.
 *
 * VÌ SAO KHÔNG CÓ KHOẢNG CÁCH HAY ĐỘ CAO NÀO. Cùng quy tắc với toàn bộ kho tri thức: số liệu địa
 * lý sống ở @data/places/geography và ở tầng `RouteSegment`, tác tử lấy chúng qua tool layer.
 * Chép vào văn xuôi là tạo bản sao thứ hai không ai đồng bộ, và tệ hơn là khiến tác tử trích số
 * thẳng từ đoạn văn mà không gọi tool — mất luôn khả năng truy nguồn. Riêng MỐC NĂM thì được
 * giữ, vì năm là bản chất của tài liệu lịch sử và nó không tồn tại ở bất cứ bảng nào khác.
 */
export const HISTORY_KNOWLEDGE: KnowledgeSourceDoc[] = [
  {
    slug: "lich-su-duong-hanh-phuc",
    domain: "attraction",
    entityType: "landmark",
    entityId: "duong-hanh-phuc",
    title: "Con đường Hạnh Phúc được làm ra như thế nào",
    content:
      "Trước năm 1959, bốn vùng núi đá phía bắc Hà Giang gần như không có đường cho xe. Muốn lên " +
      "Đồng Văn hay Mèo Vạc thì đi bộ hoặc dắt ngựa theo đường mòn, và một chuyến ra tới tỉnh mất " +
      "nhiều ngày. Con đường Hạnh Phúc — nay là quốc lộ 4C — được khởi công tháng 9 năm 1959 để " +
      "phá thế cô lập đó, và hoàn thành năm 1965. Điều làm con đường này khác mọi con đường khác " +
      "trong vùng là cách nó được làm: gần như hoàn toàn bằng tay. Lực lượng chính là thanh niên " +
      "xung phong và dân công từ nhiều tỉnh miền Bắc cùng đồng bào các dân tộc tại chỗ, làm việc " +
      "với búa, choòng, xà beng và thuốc nổ, trên vách đá vôi dựng đứng. Đoạn khó nhất là đoạn " +
      "vượt Mã Pí Lèng: ở đó vách đá gần như thẳng, không có chỗ đặt chân để mở taluy, nên công " +
      "nhân phải buộc dây treo mình lơ lửng bên sườn núi mà đục từng hốc đá một. Đoạn ấy ngốn " +
      "khoảng mười một tháng cho một quãng rất ngắn, và tổ làm việc trên vách được gọi là đội cảm " +
      "tử. Có người đã chết trong quá trình thi công. Hiểu điều này rồi thì cảm giác khi đi Mã Pí " +
      "Lèng đổi hẳn: mặt đường mà xe đang chạy không phải một công trình kỹ thuật thông thường mà " +
      "là kết quả của sáu năm lao động thủ công ở một nơi máy móc không vào được. Tên gọi Hạnh " +
      "Phúc cũng từ đó — nó đặt theo điều con đường mang lại cho vùng, không phải theo địa danh nào.",
    tags: ["lich-su", "duong-hanh-phuc", "thanh-nien-xung-phong", "ma-pi-leng", "vi-sao-dang-di"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-dinh-thu-ho-vuong",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "dinh-thu-ho-vuong",
    title: "Dinh thự họ Vương và thời kỳ vua Mèo",
    content:
      "Dinh thự nằm ở Sà Phìn là nhà của Vương Chính Đức, người được gọi là vua Mèo — thủ lĩnh " +
      "người Mông có thế lực lớn nhất vùng cao nguyên đá vào những thập niên đầu thế kỷ 20. Quyền " +
      "lực của dòng họ này dựa trên việc kiểm soát vùng biên và nguồn thu từ thuốc phiện, thứ hàng " +
      "hoá chi phối kinh tế miền núi phía bắc thời thuộc Pháp. Công trình được xây trong khoảng " +
      "những năm 1920, mất nhiều năm mới xong, và tiền công thời đó được kể lại là trả bằng bạc " +
      "trắng. Giá trị của nó nằm ở chỗ nó là một hồ sơ vật chất về sự pha trộn văn hoá ở vùng " +
      "biên: bố cục sân trong nhiều lớp theo lối nhà quan Trung Hoa, mái ngói âm dương và các chi " +
      "tiết chạm đá mang mô típ á đông, nhưng lại có những phần vay mượn kỹ thuật và vật liệu " +
      "phương Tây do người Pháp đưa vào. Vị trí đặt nhà cũng là một chọn lựa có tính toán, nằm " +
      "trên một thế đất trung tâm thung lũng, quan sát được lối vào từ nhiều phía. Sau này con " +
      "trai ông là Vương Chí Sình tham gia chính quyền cách mạng, và dinh thự trở thành di tích " +
      "được nhà nước xếp hạng, mở cho khách tham quan. Đến đây mà chỉ xem kiến trúc thì bỏ mất " +
      "phần quan trọng nhất: đây là nơi cho thấy quyền lực địa phương ở vùng biên từng vận hành " +
      "như thế nào khi nhà nước trung ương còn ở rất xa.",
    tags: ["lich-su", "vua-meo", "vuong-chinh-duc", "sa-phin", "kien-truc", "di-tich"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-pho-co-dong-van",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "pho-co-dong-van",
    title: "Phố cổ Đồng Văn hình thành từ đâu",
    content:
      "Khu phố cổ ở trung tâm Đồng Văn hình thành từ những thập niên đầu thế kỷ 20, khi nơi này " +
      "trở thành điểm tụ họp buôn bán của cả một vùng núi đá rộng. Ban đầu chỉ có vài hộ người " +
      "Mông, người Tày và người Hoa dựng nhà quanh một khoảng đất trống dùng làm chợ; dần dần dãy " +
      "nhà kéo dài thành phố. Kiểu nhà ở đây phản ánh đúng thành phần cư dân đó: tường trình đất " +
      "hoặc xếp đá, mái ngói âm dương, nhà hai tầng với tầng dưới mở ra đường để bán hàng và tầng " +
      "trên để ở — một dạng nhà phố thương mại kiểu Hoa nam thích ứng với vật liệu và khí hậu núi " +
      "đá. Cái đáng chú ý về mặt lịch sử là khu phố này không được quy hoạch mà lớn lên quanh chợ, " +
      "nên hình dạng của nó chính là hình dạng của hoạt động thương mại vùng biên: chợ là hạt " +
      "nhân, phố là thứ mọc theo. Chợ Đồng Văn tới nay vẫn họp ngay tại đó, tức là chức năng đã " +
      "sinh ra khu phố vẫn còn hoạt động sau hơn một trăm năm — điều không có nhiều ở các khu phố " +
      "cổ khác. Vài dãy nhà đã được trùng tu và một số căn chuyển thành quán cà phê, nhưng cấu " +
      "trúc phố và quảng trường chợ thì còn nguyên.",
    tags: ["lich-su", "pho-co", "dong-van", "kien-truc", "thuong-mai-vung-bien"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-cot-co-lung-cu",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cot-co-lung-cu",
    title: "Cột cờ Lũng Cú qua các lần dựng lại",
    content:
      "Cột cờ đứng trên đỉnh núi Rồng ở Lũng Cú, và điều làm nó có ý nghĩa không phải chiều cao " +
      "của cây cột mà vị trí của nó: đây là điểm đánh dấu vùng đất cực bắc, nơi lá cờ được dựng " +
      "lên như một tuyên bố về chủ quyền chứ như một mốc du lịch. Truyền thống dựng cờ ở khu vực " +
      "này được kể lại là có từ rất lâu, và bản thân cây cột đã qua nhiều lần thay thế: những bản " +
      "đầu tiên đơn giản, làm bằng vật liệu tại chỗ; các lần sau kiên cố dần lên. Bản đang đứng " +
      "hiện nay được xây lại và khánh thành vào năm 2010, dạng cột bát giác, chân cột gắn các mặt " +
      "trống đồng và hoa văn theo mô típ trống đồng Đông Sơn, lá cờ lớn treo trên đỉnh. Có đường " +
      "bậc thang dẫn lên và một cầu thang xoáy trong lòng cột để lên đài quan sát. Lũng Cú thường " +
      "bị gọi là điểm cực bắc, nhưng nói cho chính xác thì điểm cực bắc trên thực địa là khu vực " +
      "cột mốc biên giới nằm xa hơn về phía bắc; cột cờ là công trình biểu tượng đặt ở nơi lên " +
      "được và quan sát được, không phải mốc toạ độ. Phân biệt này đáng nói vì nó là điều khách " +
      "hay hiểu sai.",
    tags: ["lich-su", "cot-co-lung-cu", "cuc-bac", "chu-quyen", "bieu-tuong"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-cot-moc-428",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "cot-moc-428",
    title: "Cột mốc 428 và ý nghĩa của một cột mốc biên giới",
    content:
      "Cột mốc 428 nằm ở khu vực bắc nhất của tuyến biên giới đoạn Hà Giang, dưới chân dốc từ phía " +
      "cột cờ Lũng Cú đi xuống. Nó thuộc hệ thống mốc giới cắm theo kết quả phân giới cắm mốc giữa " +
      "Việt Nam và Trung Quốc, công việc kéo dài nhiều năm và hoàn tất vào cuối những năm 2000. " +
      "Hiểu bối cảnh đó thì mới thấy một cột đá nhỏ có gì đáng đi bộ xuống xem: mỗi cột mốc là một " +
      "điểm đã được hai nhà nước cùng xác định trên thực địa, đo đạc và ký nhận, nên nó là hiện " +
      "vật của một quá trình đàm phán chứ không phải một vật trang trí. Đây cũng là lý do khu vực " +
      "quanh mốc nằm trong vành đai biên giới và chịu quy định riêng: khách tới được nhưng phải " +
      "tuân thủ hướng dẫn của lực lượng biên phòng, không tự ý vượt qua mốc, và ở một số thời điểm " +
      "đường xuống có thể bị hạn chế. Quy định cụ thể về giấy tờ và ra vào khu vực biên giới thuộc " +
      "phần cẩm nang, không phải phần lịch sử.",
    tags: ["lich-su", "cot-moc-428", "bien-gioi", "phan-gioi-cam-moc", "cuc-bac"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-tuyen-cot-moc-bien-gioi",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cot-moc-bien-gioi",
    title: "Tuyến cột mốc biên giới đoạn Hà Giang",
    content:
      "Đoạn biên giới đi qua vùng núi đá phía bắc Hà Giang là một trong những đoạn địa hình khó " +
      "nhất của toàn tuyến biên giới trên đất liền Việt Nam – Trung Quốc: phần lớn chạy trên sống " +
      "núi đá vôi, nhiều chỗ không có đường tiếp cận. Việc phân giới và cắm mốc trên thực địa được " +
      "hai nước tiến hành trong nhiều năm và hoàn tất vào cuối những năm 2000, thay thế hệ thống " +
      "mốc cũ từ thời Pháp bằng một hệ thống mốc mới được đo đạc và ghi nhận đầy đủ. Với khách đi " +
      "vùng này, tuyến mốc có hai ý nghĩa thực tế. Thứ nhất, nhiều điểm đến nổi tiếng nhất — Lũng " +
      "Cú, Phố Bảng, các đoạn đường ven biên — nằm trong vành đai biên giới, nên chúng đi kèm quy " +
      "định về khai báo và về việc được đi tới đâu. Thứ hai, sự hiện diện của lực lượng biên phòng " +
      "trong đời sống vùng này là một phần của bối cảnh: các đồn biên phòng vừa làm nhiệm vụ quản " +
      "lý biên giới, vừa là nơi hỗ trợ dân và hỗ trợ khách gặp sự cố ở những xã xa nhất.",
    tags: ["lich-su", "bien-gioi", "bien-phong", "vanh-dai-bien-gioi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-don-bien-phong-lung-cu",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "don-bien-phong-lung-cu",
    title: "Đồn Biên phòng Lũng Cú",
    content:
      "Đồn Biên phòng Lũng Cú quản lý đoạn biên giới ở khu vực cực bắc, gồm cả vùng quanh cột cờ " +
      "và cột mốc 428. Đây là một đơn vị đang hoạt động chứ không phải di tích, nhưng nó có mặt " +
      "trong phần lịch sử vì hai lẽ. Một là bản thân sự tồn tại liên tục của các đồn biên phòng ở " +
      "tuyến này là phần kể tiếp của câu chuyện phân giới: sau khi mốc được cắm thì việc giữ mốc " +
      "và quản lý qua lại là công việc thường ngày, kéo dài từ đó tới nay. Hai là trong ký ức của " +
      "người dân và của khách đi lâu năm, các đồn biên phòng gắn với những lần cứu hộ ở nơi không " +
      "có lực lượng nào khác kịp tới. Với khách, điều cần biết là đồn không phải điểm tham quan: " +
      "tới khu vực này thì tuân thủ hướng dẫn, xuất trình giấy tờ khi được yêu cầu, và không chụp " +
      "ảnh công trình, phương tiện hay hoạt động của đơn vị. Đây là loại quy tắc mà vi phạm không " +
      "phải vì cố ý mà vì không ai nói trước.",
    tags: ["lich-su", "bien-phong", "lung-cu", "quy-tac-ung-xu", "cuu-ho"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-cang-bac-me",
    domain: "attraction",
    entityType: "historical_site",
    entityId: "cang-bac-me",
    title: "Căng Bắc Mê — nhà tù thời thuộc Pháp",
    content:
      "Căng Bắc Mê là di tích của một cơ sở giam giữ do chính quyền thực dân Pháp lập ở vùng Bắc " +
      "Mê, hoạt động trong khoảng cuối những năm 1930 đến đầu những năm 1940. Chữ căng trong tên " +
      "gọi là cách phiên âm tiếng Việt của từ camp trong tiếng Pháp, tức trại. Nơi này được dùng " +
      "để giam giữ tù chính trị, và việc chọn đặt nó ở đây là một chọn lựa có chủ đích: vùng núi " +
      "hiểm, xa các trung tâm, đường tiếp cận khó, nên khả năng trốn thoát và khả năng liên lạc ra " +
      "ngoài đều thấp. Ngày nay còn lại dấu vết nền móng, tường đá và một số công trình phụ trên " +
      "một thế đất cao nhìn xuống thung lũng. Di tích này được xếp hạng và nằm khá xa trục hành " +
      "trình chính lên Đồng Văn – Mèo Vạc, nên phần lớn khách đi vòng cung phía bắc không qua đây; " +
      "nó phù hợp với người đi nhánh Bắc Mê hoặc muốn tìm phần lịch sử thuộc địa của vùng, thứ ít " +
      "được nhắc so với phần lịch sử về cao nguyên đá.",
    tags: ["lich-su", "thoi-thuoc-phap", "nha-tu", "bac-me", "di-tich"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-cao-nguyen-da-dong-van",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cao-nguyen-da-dong-van",
    title: "Cao nguyên đá Đồng Văn và tư cách công viên địa chất toàn cầu",
    content:
      "Cao nguyên đá Đồng Văn được UNESCO công nhận là Công viên địa chất toàn cầu vào năm 2010, " +
      "trở thành công viên địa chất toàn cầu đầu tiên của Việt Nam. Đây là loại danh hiệu đánh giá " +
      "giá trị của chính nền đá chứ không phải cảnh đẹp: phần lớn cao nguyên là đá vôi hình thành " +
      "từ trầm tích biển cổ, tuổi tính bằng hàng trăm triệu năm, và trong lớp đá đó còn lưu hoá " +
      "thạch của các sinh vật biển đã tuyệt diệt. Nói cách khác, vùng núi đá mà khách đang đi qua " +
      "từng là đáy biển, rồi được nâng lên và bị nước mưa khoét suốt thời gian dài thành dạng địa " +
      "hình karst đặc trưng — chóp đá nhọn, phễu sụt, hang động, những thung lũng kín không có " +
      "dòng chảy mặt. Điều này giải thích một đặc điểm ảnh hưởng trực tiếp tới đời sống ở đây: đá " +
      "vôi thấm nước, nên vùng này thiếu nước mặt nghiêm trọng dù lượng mưa không ít, và nhiều bản " +
      "phải trữ nước mưa. Danh hiệu của UNESCO đi kèm nghĩa vụ bảo tồn và phải tái đánh giá định " +
      "kỳ, nên nó không phải một tấm biển cấp một lần rồi thôi.",
    tags: ["lich-su", "dia-chat", "unesco", "cao-nguyen-da", "karst", "thieu-nuoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-ruong-bac-thang-hoang-su-phi",
    domain: "attraction",
    entityType: "landmark",
    entityId: "ruong-bac-thang-hoang-su-phi",
    title: "Ruộng bậc thang Hoàng Su Phì được tạo ra qua nhiều đời",
    content:
      "Ruộng bậc thang ở Hoàng Su Phì không phải một cảnh quan tự nhiên mà là một công trình nông " +
      "nghiệp được bồi đắp qua nhiều thế hệ. Các dân tộc sống ở đây — chủ yếu là người Dao, người " +
      "Nùng, người La Chí và người Mông — khoét sườn núi đất thành từng bậc để giữ nước cho lúa, " +
      "mỗi bậc là một mặt phẳng nhỏ có bờ giữ nước, và toàn bộ hệ thống phụ thuộc vào việc dẫn " +
      "nước từ trên cao xuống theo trọng lực. Việc mở một khoảnh ruộng mới mất rất nhiều công và " +
      "thường không hoàn thành trong một đời người, nên hình dạng của các thửa ruộng hiện nay là " +
      "kết quả tích lũy của nhiều đời trong cùng một dòng họ. Ruộng bậc thang Hoàng Su Phì đã được " +
      "công nhận là di tích quốc gia vào năm 2012, tức nó được xếp hạng như một di sản do con người " +
      "tạo ra chứ không như một thắng cảnh thiên nhiên. Nhìn theo cách đó thì cảnh vàng rực vào " +
      "mùa lúa chín là mặt biểu hiện của một hệ thống canh tác vẫn đang hoạt động — ruộng vẫn được " +
      "cấy để lấy gạo ăn, không phải để làm phông ảnh.",
    tags: ["lich-su", "ruong-bac-thang", "hoang-su-phi", "di-tich-quoc-gia", "canh-tac"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "lich-su-sap-nhap-hanh-chinh-2025",
    domain: "travel_guide",
    entityType: "province",
    entityId: "tuyen-quang",
    title: "Vì sao Hà Giang không còn là một tỉnh",
    content:
      "Từ ngày 1 tháng 7 năm 2025, Việt Nam thực hiện một đợt sắp xếp đơn vị hành chính quy mô " +
      "lớn: bỏ cấp huyện trong hệ thống ba cấp cũ và hợp nhất nhiều tỉnh. Trong đợt này, tỉnh Hà " +
      "Giang được sáp nhập vào tỉnh Tuyên Quang, nên về mặt hành chính hiện nay không còn tỉnh Hà " +
      "Giang, và những đơn vị từng là huyện — Đồng Văn, Mèo Vạc, Quản Bạ, Yên Minh, Hoàng Su Phì, " +
      "Xín Mần, Bắc Mê, Vị Xuyên — cũng không còn là cấp hành chính. Cấp dưới tỉnh bây giờ là xã, " +
      "phường và thị trấn. Điều này gây ra hai hệ quả mà khách hay gặp. Thứ nhất, giấy tờ, biển " +
      "hiệu, bài viết trên mạng và cả trí nhớ của mọi người vẫn dùng tên cũ, nên cùng một chỗ có " +
      "thể được gọi bằng hai hệ tên khác nhau tùy nguồn viết trước hay sau mốc đó. Thứ hai, tên " +
      "Hà Giang vẫn được dùng rộng rãi như tên một VÙNG DU LỊCH, và đó là cách dùng vẫn đúng: khi " +
      "người ta nói đi Hà Giang thì họ nói về vùng núi đá phía bắc, không nói về một đơn vị hành " +
      "chính. Trong hệ thống này, tên vùng được giữ để tra cứu được, còn cấp tỉnh thì ghi theo " +
      "hiện trạng là Tuyên Quang.",
    tags: ["lich-su", "hanh-chinh", "sap-nhap-2025", "bo-cap-huyen", "ten-goi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
