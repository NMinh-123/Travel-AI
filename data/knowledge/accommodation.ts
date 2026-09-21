/**
 * TRI THỨC VỀ LƯU TRÚ — nhánh `accommodation` của SRS Mục 11.1.1.5.
 *
 * RANH GIỚI VỚI @data/places/lodging. Bên đó là danh mục: cơ sở nào tên gì, nằm ở đâu, khoảng
 * giá bao nhiêu, có cần Places xác minh không. Bên này trả lời loại câu hỏi mà một hàng trong
 * bảng không trả lời được: nên chia mấy đêm cho cung này, ngủ ở bản khác ngủ ở khách sạn chỗ nào,
 * vì sao đặt trước lại quan trọng đến thế vào tháng 10, đêm ở trên cao lạnh tới mức nào. Số liệu
 * có cấu trúc — toạ độ, độ cao, khoảng cách — không được chép sang đây, vì tác tử lấy chúng qua
 * tool layer và một con số nằm lẫn trong văn xuôi thì không truy ngược về nguồn được.
 *
 * VÌ SAO CÁC TÀI LIỆU Ở ĐÂY GẦN NHƯ KHÔNG GỌI TÊN CƠ SỞ NÀO. Một đoạn tri thức được truy hồi rồi
 * trích gần như nguyên văn vào câu trả lời. Nếu tên một homestay nằm sẵn trong đoạn văn, nó sẽ đi
 * thẳng tới khách mà KHÔNG đi qua bước xác minh bằng Google Places — đúng cái bước mà mỗi mục ở
 * @data/places/lodging đều mang tag "can-xac-minh-places" để bắt buộc phải chạy. Nói cách khác,
 * nhét tên cơ sở vào văn bản RAG là mở một đường vòng qua hàng rào kiểm chứng. Nên các tài liệu
 * dưới đây mô tả KIỂU chỗ ở và KHU VỰC, còn việc gọi tên cụ thể để dành cho tầng danh mục.
 *
 * VÌ SAO CHỈ MỘT TÀI LIỆU MANG `sourceClass: "estimated"`. Toàn bộ phần còn lại là `editorial` —
 * người trong dự án viết và chịu trách nhiệm. Riêng tài liệu về mặt bằng giá là suy từ các trang
 * bán phòng, nên nó phải mang `estimated` kèm `sourceUrl` và `retrievedAt`; theo Mục 11.1.1.10
 * thì loại này tương ứng `sourceClass: "inference"` và bị cấm đứng ở vị trí giá, tức tác tử buộc
 * phải nói "khoảng" chứ không được nói "giá là". Nếu về sau có người thấy tiện tay mà thêm một
 * con số giá vào một tài liệu `editorial` khác, con số đó sẽ lọt qua hàng rào ấy — đừng làm vậy.
 *
 * VỀ `entityId`. Chỉ trỏ tới slug của cây địa lý ở @data/places/geography, không trỏ tới slug của
 * cơ sở lưu trú. Lý do thực dụng: cơ sở lưu trú có thể đóng cửa và bị gỡ khỏi danh mục, và khi đó
 * mọi tài liệu gắn vào nó thành mồ côi, âm thầm không khớp bộ lọc nào nữa. Xã và vùng thì không
 * biến mất.
 *
 * VỀ CÁCH VIẾT. Mỗi tài liệu là văn xuôi liền mạch, không gạch đầu dòng. Bước ingest sẽ cắt tài
 * liệu dài thành nhiều đoạn, và một đoạn bị cắt ra giữa chừng vẫn phải đọc thành câu — một dòng
 * cụt kiểu "— nước nóng: có" khi đứng lẻ trong kết quả truy hồi thì vô nghĩa với cả model lẫn
 * người đọc.
 */

import type { KnowledgeSourceDoc } from "./types";

export const ACCOMMODATION_KNOWLEDGE: KnowledgeSourceDoc[] = [
  {
    slug: "luu-tru-chia-dem-theo-chang-duong",
    domain: "accommodation",
    entityType: "region",
    entityId: "ha-giang",
    title: "Chia đêm ngủ theo từng chặng của cung Hà Giang",
    content:
      "Quyết định quan trọng nhất về chỗ ở trên cung Hà Giang không phải là chọn cơ sở nào, mà là chia các đêm vào đúng chặng. Cung phổ biến nhất chạy ba ngày hai đêm, và cách chia được nhiều người đi lại nhất là ngủ đêm đầu ở khu vực Đồng Văn rồi đêm sau ở Mèo Vạc, vì như vậy khách đi qua Mã Pí Lèng vào buổi sáng khi trời còn trong và không phải chạy đèo lúc chập tối. Nếu có bốn ngày, đêm được chèn thêm hợp lý nhất là ở Quản Bạ hoặc Yên Minh, tức là chặng đầu, để hôm sau lên cao nguyên đá với một ngày trọn vẹn thay vì nửa ngày. "
      + "Chiều ngược lại hay bị chọn sai: nhiều người muốn tiết kiệm nên định ngủ luôn ở thành phố Hà Giang rồi sáng hôm sau chạy một mạch lên Lũng Cú và quay về trong ngày. Việc đó khả thi về mặt thời gian nhưng đánh mất chính thứ khiến chuyến đi đáng giá, vì toàn bộ buổi sáng và buổi chiều muộn trên cao nguyên đá đều bị dùng để di chuyển. "
      + "Với người đi theo cung phía đông qua Du Già, thứ tự thường đảo lại: Đồng Văn hoặc Mèo Vạc trước, Du Già là đêm cuối trước khi về thành phố, vì đoạn Du Già dễ chạy hơn khi trời còn sáng và khó chịu hẳn nếu phải đi trong đêm.",
    tags: ["lich-trinh", "chia-dem", "vong-cung-chinh", "nhanh-phia-dong"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-homestay-ban-khac-gi-khach-san",
    domain: "accommodation",
    entityType: "homestay",
    title: "Homestay bản và khách sạn khác nhau ở chỗ nào",
    content:
      "Hai chữ homestay ở Hà Giang được dùng cho hai thứ rất khác nhau, và nhầm lẫn giữa chúng là nguyên nhân của phần lớn thất vọng về chỗ ở. Loại thứ nhất là nhà dân thật: khách ngủ trong chính ngôi nhà trình tường hoặc nhà sàn của chủ, thường là chỗ nằm kê sát nhau trong gian chung có rèm ngăn, dùng nhà tắm chung, ăn bữa tối cùng mâm với gia đình. Loại thứ hai là cơ sở xây mới đặt tên homestay cho hợp không khí nhưng vận hành hệt một nhà nghỉ, phòng riêng khép kín, chủ nhà ở khu khác. "
      + "Khách sạn ở đây chỉ tập trung tại thành phố Hà Giang và hai thị trấn Đồng Văn, Mèo Vạc; ra khỏi ba nơi đó thì gần như không còn lựa chọn nào ngoài homestay. Đổi lại, khách sạn cho sự riêng tư và giấc ngủ chắc chắn, còn homestay bản cho thứ mà khách sạn không có: bữa cơm với chủ nhà, buổi tối bên bếp lửa, và cơ hội hỏi chuyện người sống ở đó. "
      + "Cách chọn thực dụng là chia theo nhóm người đi. Người đi cùng trẻ nhỏ hoặc người lớn tuổi nên ưu tiên phòng riêng khép kín vì đêm ở trên cao lạnh và việc dậy giữa đêm trong một gian nhà chung là bất tiện thật sự. Nhóm bạn trẻ đi xe máy thường thấy homestay bản đáng giá hơn hẳn số tiền bỏ ra. Người nhạy cảm với tiếng ồn nên biết trước rằng gian chung có nghĩa là nghe thấy mọi thứ.",
    tags: ["homestay", "khach-san", "chon-cho-o", "ky-vong-thuc-te"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-vi-sao-phai-dat-truoc-mua-cao-diem",
    domain: "accommodation",
    entityType: "booking_policy",
    entityId: "ha-giang",
    title: "Vì sao mùa cao điểm bắt buộc phải đặt phòng trước",
    content:
      "Sức chứa của cả cung Hà Giang nhỏ hơn nhiều so với hình dung của khách. Đồng Văn và Mèo Vạc là hai thị trấn nhỏ, còn các bản làm du lịch cộng đồng thì mỗi bản chỉ có vài chục chỗ nằm. Vào mùa hoa tam giác mạch tháng mười và tháng mười một, lượng khách đổ lên trong hai ngày cuối tuần vượt xa số chỗ ngủ có sẵn, nên chuyện hết phòng ở đây không phải là hiếm mà là mặc định. "
      + "Hệ quả rất cụ thể và không dễ chịu: khách đến nơi lúc chiều muộn mà chưa đặt trước thường phải chạy tiếp sang thị trấn khác trong lúc trời tối và đường đèo không có đèn. Đó là lý do lời khuyên đặt trước ở vùng này nghiêm túc hơn hẳn ở các điểm du lịch khác, chứ không phải một câu nhắc lấy lệ. "
      + "Cùng loại rủi ro nhưng ít người biết là các dịp phiên chợ và lễ hội: đêm trước phiên chợ Đồng Văn và phiên chợ Mèo Vạc, cũng như dịp chợ tình Khâu Vai, phòng ở thị trấn tương ứng khan hơn cả cuối tuần thường. Ngoài mùa cao điểm thì tình hình đảo ngược hẳn, giữa tuần vào mùa hè hay mùa mưa thì đến nơi mới tìm chỗ vẫn thoải mái, thậm chí còn mặc cả được.",
    tags: ["dat-truoc", "cao-diem", "het-phong", "cho-phien"],
    season: ["hoa_tam_giac_mach", "lua_chin"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-mat-bang-gia-theo-hang-va-theo-mua",
    domain: "accommodation",
    entityType: "homestay",
    entityId: "ha-giang",
    title: "Mặt bằng giá chỗ ở và mức chênh giữa mùa thường với cao điểm",
    content:
      "Giá chỗ ở trên cung Hà Giang chia thành ba bậc khá rõ. Bậc thấp nhất là chỗ nằm trong nhà sàn hoặc nhà trình tường chung của các bản làm du lịch cộng đồng, cùng bậc với giường trong phòng tập thể của các nhà nghỉ kiểu hostel ở thành phố, và thường rơi vào khoảng một trăm năm mươi tới ba trăm năm mươi nghìn đồng mỗi đêm. Bậc giữa là homestay đã cải tạo có phòng riêng và cửa khoá, khoảng bốn trăm tới chín trăm nghìn mỗi đêm, chênh nhau chủ yếu ở việc phòng có hướng nhìn ra thung lũng hay không. Bậc trên là khách sạn ở thành phố Hà Giang và hai thị trấn, phổ biến từ ba trăm năm mươi nghìn tới khoảng một triệu hai mỗi đêm cho phòng đôi; riêng vài cơ sở hạng nghỉ dưỡng nằm hẳn trên khoảng này và không nên lấy mặt bằng chung để suy ra. "
      + "Mức chênh theo mùa lớn hơn mức chênh giữa các cơ sở cùng hạng. Vào tháng mười và tháng mười một mùa hoa tam giác mạch, cũng như các dịp lễ dài ngày, giá cuối tuần thường tăng khoảng một nửa so với ngày thường và ở những nơi ít phòng thì có thể gấp đôi. Chiều ngược lại, mùa mưa từ tháng sáu tới tháng tám là lúc rẻ nhất và cũng là lúc dễ thương lượng nhất. "
      + "Mọi con số ở đây là khoảng ước lượng từ mặt bằng các trang bán phòng tại một thời điểm, không phải giá niêm yết của bất kỳ cơ sở nào, nên khi trả lời khách phải nói rõ đây là giá tham khảo và giá thật cần hỏi lại nơi ở.",
    tags: ["gia-phong", "mat-bang-gia", "cao-diem", "uoc-luong"],
    season: ["hoa_tam_giac_mach", "mua_mua", "quanh_nam"],
    sourceClass: "estimated",
    sourceUrl: "https://www.booking.com/searchresults.vi.html?ss=Ha+Giang",
    retrievedAt: "2026-09-09",
  },
  {
    slug: "luu-tru-dieu-kien-sinh-hoat-thuc-te",
    domain: "accommodation",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Điều kiện sinh hoạt thật ở chỗ ngủ vùng cao",
    content:
      "Phần lớn thất vọng về chỗ ở trên cung Hà Giang đến từ kỳ vọng chứ không đến từ chất lượng, nên nói trước những điều kiện thật là việc nên làm chứ không phải việc làm mất khách. Nước nóng ở các bản thường do bình đun bằng điện hoặc bằng năng lượng mặt trời, nghĩa là có thật nhưng có hạn: cả nhà cùng tắm vào một khung giờ buổi tối thì người tắm sau chỉ còn nước nguội, và những hôm nhiều mây thì bình dùng năng lượng mặt trời gần như không nóng. Tắm sớm là cách xử lý đơn giản nhất và ít ai nghĩ ra. "
      + "Sưởi ấm hầu như không có dạng thiết bị cố định. Cái giữ ấm thật sự là chăn bông dày mà chủ nhà phát thêm khi khách hỏi, và bếp lửa ở gian chung vào buổi tối. Vào những đợt rét đậm cuối năm, đêm trên cao nguyên đá lạnh hơn rất nhiều so với ban ngày cùng ngày hôm đó, nên áo ấm mặc lúc chạy xe không đủ để ngủ. "
      + "Sóng điện thoại và mạng không dây tốt ở thành phố và hai thị trấn, chập chờn ở các bản nằm sâu trong thung lũng, và có những nơi mất hẳn sóng vào buổi tối khi cả bản cùng dùng. Điều này quan trọng hơn vẻ ngoài của nó: xác nhận đặt phòng gửi qua tin nhắn có thể không tới nơi, bản đồ số có thể không tải được đúng lúc cần, nên hẹn giờ đến với chủ nhà từ trước và tải sẵn bản đồ ngoại tuyến là thói quen đáng có. Mất điện vài giờ vào mùa mưa cũng là chuyện bình thường, và một cục sạc dự phòng giải quyết được gần hết phiền toái đó.",
    tags: ["nuoc-nong", "giu-am", "song-dien-thoai", "dien", "ky-vong-thuc-te"],
    season: ["mua_lanh", "mua_mua", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-khai-bao-tam-tru-khu-vuc-bien-gioi",
    domain: "accommodation",
    entityType: "safety",
    entityId: "ha-giang",
    title: "Đăng ký tạm trú cho khách nước ngoài ở khu vực biên giới",
    content:
      "Mọi cơ sở lưu trú ở Việt Nam đều phải khai báo tạm trú cho khách nước ngoài, nhưng ở dải xã giáp biên phía bắc Hà Giang thì việc này được thực hiện chặt hơn hẳn và có thêm lớp quản lý của bộ đội biên phòng. Trên thực tế, khách nước ngoài ngủ lại các bản sát đường biên như khu vực Lũng Cú cần đưa hộ chiếu cho chủ nhà ngay khi nhận phòng để họ kịp khai báo trong ngày, chứ không phải lúc trả phòng. "
      + "Hai hệ quả cần nói trước với khách. Thứ nhất, chủ nhà giữ hộ chiếu một khoảng thời gian ngắn để ghi thông tin là chuyện bình thường và đúng quy định, không phải dấu hiệu bất thường. Thứ hai, có những cơ sở nhỏ chưa đăng ký đón khách nước ngoài, và họ sẽ từ chối nhận dù còn chỗ trống; điều này hay xảy ra với nhà dân mới làm du lịch, nên khách nước ngoài đặt phòng ở bản nên hỏi rõ trước thay vì đến nơi mới biết. "
      + "Ngoài chuyện tạm trú, khu vực sát cột mốc và một số điểm dọc đường biên còn có thể yêu cầu giấy phép vào khu vực biên giới; đó là thủ tục riêng cho việc đi lại chứ không phải cho việc ngủ lại, nhưng hai thứ hay bị hỏi cùng nhau nên trả lời cần tách bạch. Người đi nên mang theo giấy tờ tuỳ thân bản gốc suốt chuyến, vì trạm kiểm soát ở vùng biên không nhận ảnh chụp.",
    tags: ["khai-bao-tam-tru", "khach-nuoc-ngoai", "gan-bien-gioi", "giay-to"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-thanh-pho-ha-giang-dem-dau-dem-cuoi",
    domain: "accommodation",
    entityType: "region",
    entityId: "tp-ha-giang",
    title: "Ngủ ở thành phố Hà Giang: đêm đầu và đêm cuối của chuyến đi",
    content:
      "Thành phố Hà Giang hiếm khi là điểm đến, nhưng gần như luôn là chỗ ngủ của đêm đầu và đêm cuối. Xe khách giường nằm từ Hà Nội thường tới nơi vào lúc sáng sớm, còn xe chạy đêm chiều ngược lại rời thành phố lúc khuya, nên hai đầu chuyến đi đều rơi vào những khung giờ mà khách cần một chỗ tắm rửa và chợp mắt hơn là một phòng đẹp. "
      + "Vì lý do đó, tiêu chí chọn chỗ ở đây khác hẳn trên cung. Thứ đáng hỏi là cơ sở có nhận khách nhận phòng sớm buổi sáng không, có cho gửi lại hành lý thừa trong lúc chạy cung không, và có gần chỗ thuê xe máy hay điểm đón của nhà xe không. Nhiều nhà nghỉ trong thành phố phục vụ đúng nhóm khách này nên sẵn sàng cả ba việc, nhưng phải hỏi trước chứ không mặc nhiên. "
      + "Thành phố cũng là nơi duy nhất trong vùng có đủ hạng phòng để chọn, từ giường trong phòng tập thể cho khách đi một mình muốn ghép đoàn, tới khách sạn đầy đủ tiện nghi cho người vừa xuống xe sau một đêm không ngủ. Nếu chuyến đi kết thúc bằng chuyến xe đêm về xuôi, giữ phòng thêm nửa ngày để tắm rửa trước khi lên xe là khoản chi nhỏ nhưng đáng, vì sau ba ngày đường đèo thì việc lên xe giường nằm trong tình trạng bụi bặm là cực hình dài mấy tiếng.",
    tags: ["dem-dau-tien", "dem-cuoi", "gui-hanh-ly", "nhan-phong-som"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-nam-dam-homestay-cong-dong-nguoi-dao",
    domain: "accommodation",
    entityType: "commune",
    entityId: "nam-dam",
    title: "Ngủ lại Nặm Đăm: homestay cộng đồng của người Dao",
    content:
      "Nặm Đăm là nơi thường được nhắc tới đầu tiên khi ai đó hỏi về homestay cộng đồng ở Hà Giang, và lý do không nằm ở cảnh mà nằm ở cách làm. Cả thôn cùng làm du lịch theo một quy ước chung, nhà cửa giữ nguyên lối trình tường mái ngói của người Dao chứ không xây mới theo kiểu nhà nghỉ, và khách ở lại được mời ăn cùng mâm với gia đình thay vì ăn suất riêng. "
      + "Thứ đáng để dặn khách trước là tắm lá thuốc của người Dao, vốn là lý do nhiều người chọn ngủ lại đây. Nồi lá phải đun khá lâu nên chủ nhà cần được báo trước trong ngày, và khách tới nơi lúc tối muộn rồi mới hỏi thì thường không kịp. Đây cũng là dịch vụ tính tiền riêng ngoài tiền phòng chứ không kèm sẵn. "
      + "Về vị trí trong hành trình, Nặm Đăm hợp làm đêm đầu tiên trên cung cho người có bốn ngày, vì nó nằm ở chặng Quản Bạ, đủ xa thành phố để đã cảm thấy mình lên tới vùng cao nhưng chưa xa tới mức phải chạy vội. Với người chỉ có ba ngày thì ngủ ở đây thường khiến chặng hôm sau lên Đồng Văn bị dài; trường hợp đó nên ghé chơi và ăn trưa rồi đi tiếp thay vì cố ngủ lại.",
    tags: ["homestay-cong-dong", "nguoi-dao", "tam-la-thuoc", "chang-quan-ba"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-lo-lo-chai-ngu-duoi-chan-cot-co",
    domain: "accommodation",
    entityType: "cultural_site",
    entityId: "ban-lo-lo-chai",
    title: "Ngủ lại Lô Lô Chải dưới chân cột cờ Lũng Cú",
    content:
      "Lô Lô Chải là bản của người Lô Lô nằm ngay dưới chân núi có cột cờ Lũng Cú, và toàn bộ giá trị của việc ngủ lại đây nằm ở khung giờ. Phần lớn khách lên cột cờ vào giữa trưa rồi đi tiếp trong ngày, nên buổi chiều muộn và buổi sáng sớm là hai khoảng thời gian mà bản gần như chỉ còn người ở lại: sương chưa tan, bếp lửa trong các nhà trình tường vừa nhóm, và trên đường lên cột cờ chưa có đoàn nào. Người đã ngủ lại thường nói đó là buổi sáng đáng nhớ nhất cả chuyến. "
      + "Chỗ ở trong bản gần như đều là nhà trình tường mái ngói âm dương của chính các hộ dân, một số nhà đã ngăn phòng riêng, số còn lại giữ gian chung. Vì nhà nào cũng cùng một kiểu và cùng mặt bằng, việc chọn nhà nào không quan trọng bằng việc hẹn trước, nhất là vào mùa hoa tam giác mạch khi cả bản kín chỗ từ nhiều ngày trước cuối tuần. "
      + "Hai điều phải nói kèm mỗi khi giới thiệu nơi này. Thứ nhất, bản nằm ở dải sát đường biên nên khách nước ngoài phải đưa hộ chiếu cho chủ nhà khai báo tạm trú ngay khi tới. Thứ hai, đêm ở đây lạnh hơn hẳn thị trấn Đồng Văn vì địa hình cao và trống gió, nên chuẩn bị đồ ấm cho buổi tối chứ đừng tính theo cảm giác ban ngày.",
    tags: ["homestay-cong-dong", "nguoi-lo-lo", "gan-bien-gioi", "buoi-sang-som", "khai-bao-tam-tru"],
    season: ["hoa_tam_giac_mach", "mua_lanh", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-dong-van-ngu-trong-thi-tran",
    domain: "accommodation",
    entityType: "region",
    entityId: "dong-van",
    title: "Ngủ ở thị trấn Đồng Văn và chuyện đi bộ ra phố cổ",
    content:
      "Đồng Văn là chặng ngủ có nhiều lựa chọn nhất trên cao nguyên đá, và câu hỏi thật của khách khi hỏi ngủ ở đâu tại đây thường không phải phòng có đẹp không mà là tối có ra được khu phố cổ hay không. Khu phố cổ với dãy nhà trình tường và chợ cũ nằm gọn trong thị trấn, nên chỗ ở quanh khu trung tâm đi bộ ra được, còn những cơ sở nằm ngoài rìa thì buổi tối phải lấy xe. "
      + "Đêm thứ Bảy là đêm khác biệt trong tuần vì sáng Chủ nhật có phiên chợ, và phiên chợ vùng cao họp từ rất sớm rồi tan trước trưa. Ai muốn xem chợ đúng lúc đông nhất thì phải ngủ ngay trong thị trấn từ đêm hôm trước, chứ chạy từ Mèo Vạc hay Yên Minh sang vào sáng hôm sau thường tới nơi khi phiên đã vãn. Chính vì vậy phòng ở Đồng Văn đêm thứ Bảy khan hơn các đêm khác, và mùa hoa tam giác mạch thì khan gấp bội. "
      + "Về hạng phòng, đây là một trong ba nơi hiếm hoi của vùng có khách sạn đúng nghĩa với phòng khép kín và nước nóng ổn định, bên cạnh lớp homestay và nhà nghỉ nhỏ trong các ngõ quanh chợ. Đoàn đông nên hỏi sớm vì số cơ sở nhận được nhiều phòng cùng lúc ở thị trấn này rất ít, và các công ty lữ hành thường giữ chỗ trước cả mùa.",
    tags: ["chang-dong-van", "pho-co", "cho-phien", "dat-truoc"],
    season: ["hoa_tam_giac_mach", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-pa-vi-ngu-gan-ma-pi-leng",
    domain: "accommodation",
    entityType: "commune",
    entityId: "pa-vi",
    title: "Ngủ ở Pả Vi khi muốn ở gần Mã Pí Lèng",
    content:
      "Khi khách hỏi ngủ ở đâu để gần Mã Pí Lèng, câu trả lời trên thực tế gần như luôn là khu làng văn hoá du lịch Pả Vi ở phía Mèo Vạc, vì bản thân con đèo không có chỗ ngủ hợp pháp nào đáng giới thiệu và cũng không nên có. Khu này được quy hoạch thành nhiều căn nhà trình tường dựng theo cùng một mẫu quây quanh sân chung, mỗi căn do một hộ kinh doanh, nên trải nghiệm giữa các căn gần như giống nhau và việc chọn căn nào ít quan trọng hơn việc đặt trước. "
      + "Điểm mạnh của chặng này là buổi sáng: từ đây quay ngược lên đèo vào lúc sớm thì ánh sáng đẹp và đường vắng, còn nếu định đi thuyền trên sông Nho Quế thì xuất phát sớm là cách duy nhất để tránh cảnh xếp hàng ở bến vào giữa trưa. Điểm yếu là khu này khá đơn điệu vào buổi tối và cách trung tâm thị trấn Mèo Vạc một quãng, nên ai muốn ăn tối ở hàng quán thị trấn thì phải tính thêm chặng đi lại. "
      + "Điều cần cảnh báo là thời điểm đến. Hầu hết khách tới Mèo Vạc vào cuối buổi chiều sau khi đã chạy hết đèo và không còn sức tìm chỗ, mà đúng lúc đó thì khu Pả Vi đã kín nếu là cuối tuần mùa cao điểm. Người đến muộn không đặt trước thường phải quay ngược ra thị trấn tìm nhà nghỉ, và đoạn đường đó trong đêm là thứ hoàn toàn tránh được chỉ bằng một cuộc gọi từ sáng.",
    tags: ["chang-meo-vac", "gan-ma-pi-leng", "song-nho-que", "dat-truoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-du-gia-chang-ngu-cung-phia-dong",
    domain: "accommodation",
    entityType: "commune",
    entityId: "du-gia",
    title: "Ngủ ở Du Già trên cung phía đông",
    content:
      "Du Già không nằm trên vòng cung chính mà trên nhánh phía đông, đường về từ Mèo Vạc qua Mậu Duệ, và nó tồn tại như một chặng ngủ chủ yếu nhờ cộng đồng khách nước ngoài đi xe máy. Thung lũng này yên hơn hẳn các thị trấn trên cao nguyên đá, chỗ ngủ phần lớn là nhà dân và nhà nghỉ nhỏ kiểu phòng tập thể, và buổi tối thường có bữa cơm chung cho cả nhà cùng ăn — thứ khiến người đi một mình dễ làm quen với nhóm khác. "
      + "Có ba điều nên nói trước với người định ngủ lại đây. Đường vào thung lũng xấu hơn trục chính và dài hơn cảm giác nhìn trên bản đồ, nên phải xuất phát sớm để không phải chạy đoạn cuối trong lúc nhá nhem. Sóng điện thoại chập chờn, vì vậy tin nhắn đặt phòng có thể không được đọc kịp và gọi điện từ chỗ có sóng vẫn chắc chắn hơn. Và vì hầu hết cơ sở ở đây không bán phòng trên các trang đặt phòng quốc tế một cách ổn định, thông tin về chúng khó kiểm chứng hơn hẳn so với các thị trấn. "
      + "Đổi lại, đây là chặng dễ chịu nhất để làm đêm cuối trước khi về thành phố: buổi sáng có thể đi bộ ra thác gần bản tắm rồi mới lên xe, và quãng đường còn lại về Hà Giang đủ ngắn để không phải vội.",
    tags: ["nhanh-phia-dong", "homestay-cong-dong", "song-dien-thoai-kem", "duong-kho"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "luu-tru-dat-coc-va-huy-phong",
    domain: "accommodation",
    entityType: "cancellation_policy",
    title: "Đặt cọc, huỷ phòng và cách xác nhận chỗ ở cho chắc",
    content:
      "Cách đặt phòng ở vùng này chia làm hai kiểu và chúng có rủi ro khác nhau. Đặt qua các trang bán phòng quốc tế thì có xác nhận bằng văn bản và có chính sách huỷ ghi rõ theo từng phòng, nhưng chỉ áp dụng được với khách sạn ở thành phố và hai thị trấn, cùng một số homestay đã lên trang. Đặt trực tiếp với chủ nhà qua điện thoại hoặc tin nhắn là cách duy nhất với phần lớn nhà dân ở các bản, đổi lại thì thoả thuận chỉ tồn tại trong cuộc trò chuyện đó. "
      + "Với kiểu thứ hai, thông lệ phổ biến là chuyển trước một phần tiền phòng để giữ chỗ vào mùa cao điểm, còn ngày thường thì nhiều chủ nhà giữ chỗ chỉ bằng lời hẹn. Việc huỷ hầu như không có quy định thành văn, phụ thuộc vào chủ nhà và vào việc khách báo sớm hay muộn. Không báo mà không đến là điều gây thiệt hại thật cho một hộ chỉ có vài phòng, và cũng là lý do nhiều nơi bắt đầu yêu cầu đặt cọc. "
      + "Ba thói quen làm giảm gần hết rủi ro. Xin xác nhận lại bằng tin nhắn có ghi ngày, số người và giá đã thoả thuận, để hai bên cùng có một mốc đối chiếu. Gọi lại xác nhận vào buổi sáng của ngày sẽ tới, vì lịch của các hộ nhỏ thay đổi và tin nhắn cũ dễ trôi. Và khi biết chắc mình không tới nữa thì báo sớm, kể cả khi đã mất tiền cọc, vì chỗ đó còn bán được cho người khác. Với khách hỏi về chính sách huỷ cụ thể của một cơ sở, phải nói rõ rằng điều đó do từng nơi tự quyết và cần hỏi thẳng nơi ở chứ không thể suy từ thông lệ chung.",
    tags: ["dat-coc", "huy-phong", "xac-nhan-dat-phong", "thong-le"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
