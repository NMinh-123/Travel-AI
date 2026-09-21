import type { KnowledgeSourceDoc } from "@data/knowledge/types";

/**
 * MẶT "KINH NGHIỆM NGẮM CẢNH" — tri thức VẬN HÀNH, khác hẳn mặt "điểm ngắm cảnh".
 *
 * Phân biệt này là phân biệt đáng nhớ nhất của cả tầng data, và nó quyết định vì sao có file
 * này. "Điểm ngắm cảnh" là THỰC THỂ: nó có slug, toạ độ, độ cao, và nằm trong
 * @data/places/geography với `kind: "scenic_view"`. Khách hỏi "đứng ở đâu chụp được hẻm Tu Sản"
 * thì cần một khoá tra cứu để tool layer lấy toạ độ rồi dẫn đường. Còn "kinh nghiệm ngắm cảnh"
 * là thứ không dẫn đường được: giờ nào ánh sáng thuận, mùa nào tới chỉ thấy sương, chỗ nào dừng
 * xe được mà không chắn đường, khi nào thì đi xuống thêm mấy trăm mét là đáng và khi nào không.
 *
 * VÌ SAO ĐÂY LÀ FILE CÓ GIÁ TRỊ THỰC TẾ CAO NHẤT TRONG KHO. Mô tả cảnh quan thì khách đọc ở đâu
 * cũng có; còn "tam giác mạch tháng mười một ở Sủng Là đã tàn, phải lên Lũng Cú" là loại thông
 * tin quyết định một chuyến đi thành công hay thất vọng, và nó chỉ đến từ người đã đi. Khi viết
 * thêm vào file này, ưu tiên thứ dùng được ngay: một câu nói rõ giờ, hướng, mùa hoặc chỗ đứng
 * đáng giá hơn một đoạn tả cảnh.
 *
 * VÌ SAO `season` Ở ĐÂY PHẢI ĐẶT CHÍNH XÁC. Đây là file mà bộ lọc mùa dùng nhiều nhất. Bộ lọc
 * chạy TRƯỚC semantic search, nên đặt sai mùa gây ra hai lỗi ngược nhau và cả hai đều im lặng:
 * gắn `quanh_nam` cho tài liệu thực ra chỉ đúng một tháng thì tác tử khuyên khách đi ngắm hoa
 * vào lúc không có hoa; còn gắn một mùa cụ thể cho tài liệu vốn đúng cả năm thì tài liệu đó biến
 * mất khỏi mọi câu hỏi ở các tháng khác. Quy tắc: chỉ gắn mùa cụ thể khi lời khuyên THAY ĐỔI
 * theo mùa, còn cách đứng và chỗ đứng thì gắn `quanh_nam`.
 *
 * VỀ AN TOÀN. Vài tài liệu ở đây mang nội dung cảnh báo, và chúng cố tình nằm trong mặt ngắm
 * cảnh chứ không dồn hết sang cẩm nang an toàn. Lý do thực dụng: người tìm chỗ đẹp để chụp ảnh
 * không đi đọc mục an toàn, nên cảnh báo phải nằm đúng chỗ họ đang đọc. Cảnh báo mang tính hệ
 * thống — thời tiết, sạt lở, giấy tờ — thì vẫn ở @data/knowledge/travel-guide.
 */
export const SIGHTSEEING_KNOWLEDGE: KnowledgeSourceDoc[] = [
  {
    slug: "kinh-nghiem-diem-ngam-ma-pi-leng",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "diem-ngam-ma-pi-leng",
    title: "Ngắm Mã Pí Lèng ở đâu và vào giờ nào",
    content:
      "Điểm dừng chính trên đèo là khoảng sân rộng bên phía vực, nơi có bia đá ghi lịch sử con " +
      "đường và chỗ đậu được cả xe máy lẫn ô tô. Đây là nơi nhìn được trọn khúc sông phía dưới và " +
      "cũng là nơi đông nhất, nên nếu muốn có ảnh không người thì phải tới sớm. Về ánh sáng, buổi " +
      "sáng là lựa chọn tốt hơn hẳn: mặt trời từ phía đông rọi vào lòng vực nên thấy được nước " +
      "sông và các lớp vách đá, còn buổi chiều thì lòng vực chìm trong bóng của chính dãy núi và " +
      "ảnh chỉ còn hai khối tối sáng. Giữa trưa là lúc tệ nhất vì nắng gắt từ trên đỉnh làm mất " +
      "hết chiều sâu. Một điểm mà ít ai nói trước: khoảng thời gian đẹp nhất thường rất ngắn, vì " +
      "sương ở khe núi tan dần theo nắng lên, và cái làm nên ảnh đẹp ở đây là lúc sương còn đọng " +
      "dưới thấp trong khi đỉnh đã sáng. Chạy xe qua đèo mà không dừng thì gần như không thấy gì: " +
      "đường sát vách, người lái phải nhìn đường, và các khúc mở tầm nhìn đều rất ngắn.",
    tags: ["kinh-nghiem-ngam-canh", "ma-pi-leng", "gio-dep", "anh-sang", "chup-anh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-mom-da-tu-san",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "mom-da-tu-san",
    title: "Mỏm đá ngắm hẻm Tu Sản và cái giá của bức ảnh đó",
    content:
      "Mỏm đá nhô ra khỏi vách, nhìn thẳng xuống chỗ hẻm vực hẹp nhất — đây là khung ảnh đã làm " +
      "nên hình dung của phần lớn người về Mã Pí Lèng. Cần biết ba điều trước khi ra đó. Thứ nhất, " +
      "mỏm đá không có rào chắn và mặt đá nghiêng ra phía vực; đá vôi ẩm thì rất trơn, nên sau mưa " +
      "hoặc trong sương mù thì không nên ra. Thứ hai, chỗ đứng rất nhỏ, và vào giờ cao điểm sẽ có " +
      "người xếp hàng chờ chụp — chen nhau ở một chỗ như vậy là kiểu rủi ro không cần thiết, tốt " +
      "nhất là chờ. Thứ ba, đã có những mỏm được người dân địa phương dựng thêm sàn hoặc thu phí " +
      "chụp ảnh; chất lượng và độ an toàn của các kết cấu tự dựng đó không được kiểm định, nên " +
      "đừng mặc định có sàn là chắc chắn. Về ánh sáng thì cùng nguyên tắc với điểm dừng chính: " +
      "sáng sớm tới trước giữa buổi sáng là khoảng có nắng vào lòng vực mà chưa gắt.",
    tags: ["kinh-nghiem-ngam-canh", "hem-tu-san", "an-toan", "chup-anh", "canh-bao"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-vach-da-trang",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "vach-da-trang-ma-pi-leng",
    title: "Đường đi bộ vách đá trắng — đi hay không đi",
    content:
      "Đây là con đường mòn đi bộ men theo sườn núi phía trên vực, dẫn tới đoạn vách đá màu sáng " +
      "nhìn xuống sông. Nó cho góc nhìn khác hẳn mọi điểm dừng bằng xe: thấy được cả chiều dài của " +
      "vực thay vì một khúc, và không có tiếng xe. Đổi lại, nó là một chuyến đi bộ thật sự chứ " +
      "không phải một chỗ dừng chân — đường hẹp, một bên là vực, nhiều đoạn không có gì để bám, và " +
      "quãng đi về chiếm phần lớn một buổi. Nên đi khi có đủ ba điều kiện: thời tiết khô và tầm " +
      "nhìn tốt, giày có đế bám, và còn dư thời gian trong ngày để không phải quay về trong lúc " +
      "trời tối. Không nên đi khi đang mưa, khi vừa mưa xong, khi có sương mù, hoặc khi đi một " +
      "mình mà không ai biết mình đi đâu. Về thời điểm trong ngày, buổi sáng vẫn thuận hơn cho cả " +
      "ánh sáng lẫn nhiệt độ, vì phần lớn đường không có bóng cây.",
    tags: ["kinh-nghiem-ngam-canh", "di-bo", "vach-da-trang", "an-toan", "the-luc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-ben-thuyen-ta-lang",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "ben-thuyen-ta-lang",
    title: "Đi thuyền trên sông Nho Quế vào hẻm Tu Sản",
    content:
      "Từ trên đèo nhìn xuống thì hẻm vực là một khe hẹp; xuống tận mặt nước rồi đi thuyền vào " +
      "trong thì mới thấy được chiều cao của hai bên vách, và đó là trải nghiệm không thay thế " +
      "được bằng bất cứ điểm ngắm nào ở trên. Đường xuống bến là đường dốc liên tục, hẹp, nhiều " +
      "khúc gấp; đi xe máy thì phải chắc tay phanh, còn ô tô gầm thấp thì nên hỏi tình trạng đường " +
      "trước. Về giờ, nên đi trong buổi sáng: gió trên mặt nước thường lên vào buổi chiều, và " +
      "trong lòng vực thì mặt trời tắt rất sớm do vách cao che, nên đi muộn là vào chỗ tối. Mùa " +
      "ảnh hưởng nhiều tới chuyến này — mùa mưa nước đục và có thể dừng chạy thuyền vì dòng chảy " +
      "mạnh, còn mùa khô nước trong và xanh hơn nhưng mực nước thấp. Luôn hỏi lại tình trạng chạy " +
      "thuyền trong ngày trước khi xuống, vì xuống tới bến rồi mới biết không có thuyền là mất cả " +
      "buổi. Mặc áo phao là điều kiện bắt buộc, không phải khuyến nghị.",
    tags: ["kinh-nghiem-ngam-canh", "song-nho-que", "thuyen", "gio-dep", "an-toan"],
    season: ["mua_mua", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-dinh-doc-tham-ma",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-doc-tham-ma",
    title: "Đỉnh dốc Thẩm Mã và chuyện những đứa trẻ bán hoa",
    content:
      "Đỉnh dốc là chỗ dừng quen của mọi chuyến đi lên Đồng Văn, vì từ đây nhìn lại được toàn bộ " +
      "các khúc cua vừa vượt qua xếp thành hình dải uốn dưới chân. Ánh sáng thuận nhất là buổi " +
      "chiều, khi nắng từ phía tây rọi ngang làm nổi rõ từng khúc cua và bóng của bờ vực; buổi " +
      "sáng thì cả sườn nằm trong bóng núi. Ở đây thường có trẻ em địa phương đội vòng hoa lên " +
      "chào khách và mời chụp ảnh. Đây là chỗ nên dừng lại một nhịp để nghĩ: đưa tiền hay bánh kẹo " +
      "trực tiếp cho trẻ em duy trì đúng việc khiến các em bỏ học để ra đường, và điều này đã được " +
      "chính quyền địa phương cùng nhiều tổ chức khuyến cáo. Muốn giúp thì mua hàng của người lớn " +
      "trong bản hoặc đóng góp qua các điểm chính thức. Chụp ảnh có người thì xin phép trước, và " +
      "khi được từ chối thì thôi.",
    tags: ["kinh-nghiem-ngam-canh", "doc-tham-ma", "anh-sang", "quy-tac-ung-xu", "tre-em"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-dinh-doc-chin-khoanh",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-doc-chin-khoanh",
    title: "Đỉnh dốc Chín Khoanh và thung lũng Sủng Là",
    content:
      "Từ đỉnh dốc nhìn xuống là thung lũng Sủng Là với những mảnh ruộng nhỏ ghép lại quanh mấy " +
      "nếp nhà trình tường — khung cảnh này là lý do Sủng Là hay được gọi là bông hoa giữa cao " +
      "nguyên đá. Chỗ dừng ở đỉnh khá rộng nhưng nằm ngay khúc cua, nên phải đỗ hẳn vào phía trong " +
      "và không đứng chụp ở mép đường. Thời điểm quyết định ở đây là mùa chứ không phải giờ: khi " +
      "thung lũng đang có hoa hoặc ruộng đang xanh thì các mảnh ruộng hiện rõ thành từng ô màu " +
      "khác nhau, còn sau vụ thu hoạch thì cả thung chỉ còn một màu đất và ảnh mất hẳn cấu trúc. " +
      "Trong ngày thì buổi sáng muộn tới đầu chiều là lúc nắng đủ chiếu xuống đáy thung, vì thung " +
      "kín nên sáng sớm và chiều muộn đều bị núi che.",
    tags: ["kinh-nghiem-ngam-canh", "doc-chin-khoanh", "sung-la", "mua-vu", "do-xe-an-toan"],
    season: ["hoa_tam_giac_mach", "hoa_cai", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-cong-troi-quan-ba",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dai-quan-sat-cong-troi-quan-ba",
    title: "Đài quan sát Cổng Trời Quản Bạ và Núi Đôi",
    content:
      "Đây là điểm nhìn đầu tiên trên hành trình cho cảm giác đã vào vùng cao thật: từ đài quan " +
      "sát thấy được cả thị trấn Tam Sơn nằm dưới thung lũng và hai quả núi tròn đặc trưng nhô lên " +
      "giữa cánh đồng. Giờ tốt nhất là sáng sớm, và lý do không phải ánh sáng mà là sương: thung " +
      "lũng phía dưới thường đọng sương vào đầu ngày, nên có những buổi thấy hai quả núi nổi lên " +
      "trên một lớp mây trắng phủ kín đáy thung. Lớp sương đó tan khá nhanh khi nắng lên. Ngược " +
      "lại, tới đây vào giữa trưa thì chỉ còn một thung lũng sáng đều và ảnh khá phẳng. Cần biết " +
      "trước một điều để không thất vọng: vào những ngày mù dày đặc, đứng ở đài quan sát có thể " +
      "không thấy gì ngoài màn trắng, và đó là chuyện thường xảy ra trong các tháng lạnh. Khi đó " +
      "chờ thêm nửa giờ đôi khi có tác dụng, vì sương ở đây đổi rất nhanh.",
    tags: ["kinh-nghiem-ngam-canh", "cong-troi-quan-ba", "nui-doi", "suong-mu", "gio-dep"],
    season: ["mua_lanh", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-diem-ngam-bac-sum",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "diem-ngam-bac-sum",
    title: "Điểm dừng đỉnh dốc Bắc Sum — cửa vào vùng núi đá",
    content:
      "Dốc Bắc Sum là đoạn leo dài đầu tiên sau khi rời thành phố, và điểm dừng ở đỉnh là nơi cảnh " +
      "chuyển hẳn: phía sau còn là đồi thấp và ruộng nước, phía trước bắt đầu là núi đá xếp lớp. " +
      "Vì vậy đây là chỗ đáng dừng dù nó không nổi tiếng bằng các điểm phía trên — nó cho thấy " +
      "ranh giới của hai vùng địa hình trong cùng một khung nhìn. Buổi sáng sớm là lúc hay gặp " +
      "biển mây phủ các thung lũng phía dưới, nhất là trong những tháng lạnh và khô. Lưu ý thực " +
      "tế: đây là đoạn dốc dài nên nhiều xe dừng nghỉ máy ở đỉnh, chỗ đỗ có thể chật, và phần lề " +
      "sát vực không có rào ở nhiều đoạn.",
    tags: ["kinh-nghiem-ngam-canh", "deo-bac-sum", "bien-may", "gio-dep"],
    season: ["mua_lanh", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-dinh-lung-cu",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-lung-cu",
    title: "Lên đỉnh cột cờ Lũng Cú",
    content:
      "Lên tới chân cột phải đi bộ theo bậc thang, rồi lên đài quan sát bằng cầu thang xoáy trong " +
      "lòng cột. Quãng bậc thang không dài nhưng dốc liên tục và không có bóng mát, nên đi vào " +
      "giữa trưa mùa hè khá mệt; sáng sớm hoặc cuối chiều dễ chịu hơn nhiều. Từ đài quan sát nhìn " +
      "được ra cả hai phía thung lũng và về hướng đường biên. Yếu tố quyết định ở đây là tầm nhìn " +
      "chứ không phải ánh sáng: vào ngày trong thì thấy rất xa, còn vào ngày mù thì đứng trên đỉnh " +
      "chỉ thấy một khoảng trắng và toàn bộ ý nghĩa của việc lên cao mất hẳn. Nếu đã ở Đồng Văn " +
      "hoặc Lũng Cú qua đêm thì nên xem trời rồi mới quyết định lên vào buổi nào, thay vì xếp cứng " +
      "vào lịch trình. Gió trên đỉnh mạnh và lạnh hơn dưới chân rõ rệt, kể cả trong ngày nắng, nên " +
      "mang thêm một lớp áo.",
    tags: ["kinh-nghiem-ngam-canh", "cot-co-lung-cu", "tam-nhin", "the-luc", "gio-lanh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-bien-may-cao-nguyen-da",
    domain: "seasonal_recommendation",
    entityType: "local_tips",
    entityId: "cao-nguyen-da-dong-van",
    title: "Săn biển mây trên cao nguyên đá",
    content:
      "Biển mây ở vùng này không phải hiện tượng hiếm nhưng cũng không phải thứ đặt lịch được. Nó " +
      "hình thành khi đêm lạnh và trời quang làm hơi nước đọng lại trong các thung lũng kín, rồi " +
      "sáng ra lớp mây đó nằm dưới thấp trong khi đỉnh núi đã ra khỏi mây. Vì vậy điều kiện cần " +
      "là: đang trong các tháng lạnh và khô, đêm trước trời quang, và người xem phải ở trên cao " +
      "vào lúc rất sớm — thường là trước và quanh lúc mặt trời mọc, vì mây tan nhanh khi nắng lên. " +
      "Ba yếu tố đó cộng lại nghĩa là muốn thấy biển mây thì phải ngủ đêm ở vùng cao và dậy sớm, " +
      "chứ đi từ thành phố lên trong buổi sáng là gần như chắc chắn tới muộn. Ngược lại, cùng thời " +
      "tiết lạnh đó nhưng trời không quang thì sẽ ra sương mù dày ở mọi độ cao — nhìn từ trên cao " +
      "cũng chỉ thấy trắng, và đó là kết quả hay gặp hơn. Nên coi biển mây là phần thưởng nếu gặp, " +
      "không phải mục tiêu để lên kế hoạch cả chuyến quanh nó.",
    tags: ["kinh-nghiem-ngam-canh", "bien-may", "sang-som", "mua-lanh", "ky-vong-thuc-te"],
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-tam-giac-mach-o-dau",
    domain: "seasonal_recommendation",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Tam giác mạch nở ở đâu và vào lúc nào trong mùa",
    content:
      "Tam giác mạch là lý do mùa cao điểm của vùng này rơi vào các tháng cuối năm, và có hai điều " +
      "khách hay hiểu sai. Thứ nhất, hoa không nở đồng loạt trên cả vùng: các thung lũng ở độ cao " +
      "và hướng phơi khác nhau nở lệch nhau, và người dân cũng gieo lệch vụ, nên trong cùng một " +
      "thời điểm có nơi đang rộ, nơi mới ra nụ, nơi đã tàn. Thứ hai, màu hoa đổi theo tuổi: lúc " +
      "mới nở là trắng phớt, về sau chuyển hồng rồi đỏ sẫm trước khi tàn, nên ảnh trắng và ảnh " +
      "hồng là hai thời điểm khác nhau của cùng một ruộng, không phải hai giống khác nhau. Các " +
      "vùng hay có ruộng hoa đẹp gồm thung lũng Sủng Là, khu vực quanh Lũng Cú và Sà Phìn, các " +
      "sườn dọc đường lên Đồng Văn và một số thung ở Mèo Vạc. Cách làm đúng là hỏi tại chỗ khi " +
      "tới: chủ homestay và người bán hàng ở chợ biết tuần đó ruộng nào đang rộ, và thông tin đó " +
      "đổi theo tuần nên không bài viết nào giữ được. Lưu ý cuối: phần lớn ruộng hoa là ruộng canh " +
      "tác của người dân, nhiều nơi thu phí vào chụp ảnh, và đi vào ruộng mà không xin phép là " +
      "làm hỏng vụ của người ta.",
    tags: ["kinh-nghiem-ngam-canh", "tam-giac-mach", "mua-cao-diem", "hoi-tai-cho", "quy-tac-ung-xu"],
    season: ["hoa_tam_giac_mach"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-lua-chin-hoang-su-phi",
    domain: "seasonal_recommendation",
    entityType: "scenic_view",
    entityId: "diem-ngam-ban-phung",
    title: "Ngắm ruộng bậc thang mùa lúa chín ở Hoàng Su Phì",
    content:
      "Nhánh Hoàng Su Phì là một chuyến đi khác hẳn vòng cung phía bắc: ở đây là núi đất, ruộng " +
      "bậc thang trải kín các sườn, và điểm nhấn nằm ở một mùa duy nhất trong năm. Lúa chín thường " +
      "vào khoảng tháng chín, nhưng thời điểm chính xác lệch theo từng xã và theo thời tiết năm " +
      "đó, nên đi quá sớm thì ruộng còn xanh, đi muộn thì đã thu hoạch xong và cả sườn núi chỉ còn " +
      "gốc rạ. Khoảng đẹp nhất khá ngắn, thường tính bằng một hai tuần. Về chỗ đứng, các điểm ngắm " +
      "tốt nhất nằm ở phía Bản Phùng và các sườn có tầm nhìn mở; ánh sáng ngang vào sáng sớm hoặc " +
      "cuối chiều làm nổi rõ từng bờ ruộng, còn giữa trưa thì các bậc bị nắng đổ thẳng làm mất " +
      "hết đường nét. Cần chuẩn bị tinh thần là đường ở nhánh này xấu hơn và ít dịch vụ hơn hẳn " +
      "so với trục Đồng Văn – Mèo Vạc.",
    tags: ["kinh-nghiem-ngam-canh", "lua-chin", "hoang-su-phi", "ban-phung", "anh-sang"],
    season: ["lua_chin"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-hoa-cai-hoa-dao",
    domain: "seasonal_recommendation",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Mùa hoa cải và hoa đào hoa mận",
    content:
      "Sau khi tam giác mạch tàn thì vùng này không hết mùa hoa, chỉ đổi loại, và đây là điều ít " +
      "được nói nên nhiều người bỏ qua các tháng đầu năm. Hoa cải vàng nở trên các thửa ruộng đã " +
      "thu hoạch vào quãng cuối năm sang đầu năm, thường thành từng vạt lớn trong thung lũng. Sau " +
      "đó tới hoa đào và hoa mận quanh các bản và trong sân nhà, kéo dài qua dịp Tết tới đầu xuân. " +
      "Khác biệt về trải nghiệm so với mùa tam giác mạch là đáng kể: các tháng này lạnh hơn nhiều, " +
      "có thời điểm rét đậm và trên đèo có thể có băng giá, nhưng bù lại vắng khách hơn hẳn và giá " +
      "phòng không bị đẩy lên như mùa cao điểm. Nếu chọn đi dịp này thì phải chuẩn bị áo đủ ấm và " +
      "tính tới khả năng sương mù làm giảm tầm nhìn trên đèo — cùng thời tiết tạo ra hoa và không " +
      "khí trong cũng là thời tiết tạo ra hai rủi ro đó.",
    tags: ["kinh-nghiem-ngam-canh", "hoa-cai", "hoa-dao-man", "mua-thap-diem", "mua-lanh"],
    season: ["hoa_cai", "hoa_dao_man", "mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-rung-thong-yen-minh",
    domain: "attraction",
    entityType: "landmark",
    entityId: "rung-thong-yen-minh",
    title: "Rừng thông Yên Minh — chỗ nghỉ giữa hai chặng đá",
    content:
      "Đoạn rừng thông trên đường qua Yên Minh khác hẳn phần còn lại của hành trình: đường bằng " +
      "hơn, hai bên là thông và đồi cỏ, và nhiều người gọi đây là khúc Đà Lạt của Hà Giang. Giá " +
      "trị thực tế của nó với một chuyến đi dài là chỗ nghỉ: sau chặng đá liên tục từ Quản Bạ lên, " +
      "đây là quãng dễ lái nhất và là nơi hợp lý để dừng ăn trưa hoặc nghỉ chân trước khi vào đoạn " +
      "khó phía Đồng Văn. Về ảnh, ánh sáng xuyên qua tán thông vào sáng sớm hoặc cuối chiều cho " +
      "kết quả tốt hơn giữa trưa, và nếu đi vào buổi sáng có sương thì các hàng thông tách lớp rất " +
      "rõ. Đây cũng là một trong ít đoạn có thể dừng xe bên lề khá an toàn, vì đường rộng và tầm " +
      "nhìn thoáng.",
    tags: ["kinh-nghiem-ngam-canh", "rung-thong-yen-minh", "cho-nghi", "anh-sang"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-dung-xe-chup-anh-tren-deo",
    domain: "attraction",
    entityType: "safety",
    entityId: "deo-ma-pi-leng",
    title: "Dừng xe chụp ảnh trên đường đèo hẹp",
    content:
      "Phần lớn tai nạn và va chạm mà khách gặp trên các đoạn đèo ở đây không xảy ra lúc đang chạy " +
      "mà xảy ra lúc dừng lại. Nguyên nhân thì lặp đi lặp lại: dừng ngay trong khúc cua nơi xe từ " +
      "phía sau không thấy trước, dựng xe chiếm nửa phần đường, hoặc bước ra giữa lòng đường để " +
      "lấy góc. Đường đèo ở đây hẹp, gần như không có lề, và có xe khách cùng xe tải chạy suốt " +
      "ngày — tài xế của họ đã quen đường và đi với tốc độ mà một chiếc xe đỗ bất ngờ là vấn đề " +
      "thật. Quy tắc thực dụng: chỉ dừng ở những khoảng mở rộng có chủ đích, mà trên các đoạn " +
      "nổi tiếng thì luôn có; dừng thì đưa xe hẳn vào phía trong, tắt máy, và nếu là nhóm nhiều xe " +
      "thì xếp dọc chứ không dàn ngang. Không bao giờ dừng trong khúc cua hoặc ngay sau đỉnh dốc. " +
      "Khi trời có sương mù thì bỏ hẳn ý định dừng chụp ảnh ngoài các điểm dừng chính thức, vì lúc " +
      "đó xe tới sau không thấy được gì cho tới khi đã rất gần.",
    tags: ["kinh-nghiem-ngam-canh", "an-toan", "do-xe-an-toan", "deo-hep", "suong-mu"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "kinh-nghiem-suong-mu-va-ky-vong",
    domain: "seasonal_recommendation",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Khi sương mù làm việc ngắm cảnh trở nên vô nghĩa",
    content:
      "Đây là điều nên nói thẳng trước khi khách đặt vé: có những ngày ở vùng này không ngắm được " +
      "gì cả. Sương mù dày có thể phủ kín các đoạn đèo và các điểm cao suốt cả ngày, nhất là trong " +
      "các tháng lạnh và trong những đợt mưa phùn, và khi đó đứng ở điểm ngắm nổi tiếng nhất cũng " +
      "chỉ thấy một màn trắng cách mặt mình vài mét. Điều này không phải rủi ro nhỏ vì nó ảnh " +
      "hưởng tới hai thứ cùng lúc: mất phần cảnh, và tăng đáng kể độ nguy hiểm khi lái trên đường " +
      "hẹp. Cách xử lý hợp lý gồm ba việc. Một là đừng xếp lịch trình quá chặt: để dư một buổi để " +
      "quay lại điểm quan trọng nếu buổi đầu bị mù. Hai là đổi thứ tự trong ngày theo trời thực " +
      "tế thay vì theo kế hoạch — mù trên cao thì xuống thấp, đi chợ, đi bản, để dành điểm cao cho " +
      "lúc trời mở. Ba là tra dự báo theo đúng độ cao của điểm mình sắp tới, vì thời tiết ở thị " +
      "trấn dưới chân đèo và trên đỉnh đèo có thể khác nhau hoàn toàn trong cùng một giờ.",
    tags: ["kinh-nghiem-ngam-canh", "suong-mu", "ky-vong-thuc-te", "lich-trinh-linh-hoat", "an-toan"],
    season: ["mua_lanh", "mua_mua"],
    sourceClass: "editorial",
  },
];
