/**
 * MẶT "MÔ TẢ" của kho tri thức — trả lời đúng một câu hỏi: chỗ đó trông như thế nào.
 *
 * Đây là mặt đầu tiên trong sáu mặt nội dung của SRS Mục 11.1.1.5, và cũng là mặt dễ bị viết
 * hỏng nhất vì nó là mặt duy nhất không có sự kiện nào neo lại. Lịch sử có năm tháng, ẩm thực có
 * tên món, giá có nguồn; còn mô tả thì chỉ có chữ, nên nếu người viết không thực sự hình dung
 * được nơi đó thì cái ra lò sẽ là một đoạn văn du lịch chung chung dùng cho chỗ nào cũng được.
 * Một đoạn như vậy tệ hơn là không có: nó vẫn khớp semantic search với mọi câu hỏi về cảnh quan,
 * chiếm chỗ trong top-k, và đẩy những đoạn thật sự có thông tin ra ngoài.
 *
 * VÌ SAO MỖI THỰC THỂ ĐÚNG MỘT TÀI LIỆU. Ràng buộc "một" là ràng buộc quan trọng nhất của file
 * này. Hai tài liệu mô tả cho cùng một nơi thì gần như chắc chắn nói những điều na ná nhau, và
 * khi truy hồi chúng sẽ cùng lọt vào top-k rồi chiếm hai suất — tức là câu trả lời về Đồng Văn
 * mất chỗ cho tài liệu ẩm thực hoặc lịch sử về chính Đồng Văn. Cần bổ sung ý thì sửa tài liệu đã
 * có, đừng thêm tài liệu thứ hai.
 *
 * VÌ SAO KHÔNG CÓ MỘT CON SỐ ĐỘ CAO HAY KHOẢNG CÁCH NÀO Ở ĐÂY. Quy tắc này viết sẵn trong chú
 * thích của @data/knowledge/types và nó nghiêm ngặt hơn vẻ ngoài. Độ cao của mọi thực thể đã nằm
 * ở `geo.elevationM` trong @data/places/geography, khoảng cách nằm ở tầng `RouteSegment`. Chép
 * chúng vào văn xuôi tạo ra bản sao thứ hai không ai đồng bộ, và tệ hơn: khi tác tử đọc được một
 * con số trong đoạn văn nó sẽ trích thẳng ra mà không gọi tool, nên câu trả lời mất luôn khả
 * năng truy về nguồn. Ở đây chỉ nói tương quan — cao hơn, thấp hơn, xa hơn — còn con số để tầng
 * dữ liệu lo.
 *
 * VÌ SAO TẤT CẢ ĐỀU `season: ["quanh_nam"]`. Hình dạng một con đèo, độ dựng của một vách đá, thế
 * nằm của một thung lũng không đổi theo tháng. Gắn mùa cụ thể cho tài liệu mô tả sẽ gây một lỗi
 * lặng lẽ và khó truy: khách hỏi "Sủng Là có gì" vào tháng năm, bộ lọc mùa chạy trước semantic
 * search cắt mất chính tài liệu mô tả Sủng Là, và tác tử trả lời như thể không có dữ liệu. Phần
 * "tháng mấy thì đẹp" thuộc về `domain: "seasonal_recommendation"` ở tài liệu khác.
 *
 * PHẠM VI. File này phủ vùng du lịch, xã/thôn được gọi tên như điểm đến, địa danh và điểm ngắm
 * cảnh. Di tích văn hoá (chợ phiên, làng nghề, bản) và di tích lịch sử KHÔNG có mặt ở đây dù
 * chúng cũng là nơi có cảnh: chúng thuộc mặt văn hoá và mặt lịch sử, và mô tả chúng ở cả hai chỗ
 * là tái lập đúng cái trùng lặp mà ràng buộc "một tài liệu" muốn tránh. Cấp tỉnh cũng không có
 * tài liệu mô tả, vì một tỉnh sau sáp nhập trải quá rộng để mô tả cảnh quan mà không nói sai.
 *
 * THỨ TỰ. Xếp theo đúng thứ tự khối của @data/places/geography — vùng, xã, địa danh, điểm ngắm —
 * để hai file soát chéo được bằng mắt. Lệch thứ tự thì việc kiểm "thực thể nào còn thiếu mô tả"
 * phải làm bằng script thay vì bằng cách đọc song song hai cột.
 */

import type { KnowledgeSourceDoc } from "./types";

export const DESCRIPTION_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // ---------------------------------------------------------------------------------------------
  // VÙNG DU LỊCH
  //
  // Mô tả cấp vùng phải làm được một việc mà mô tả cấp điểm không làm được: nói cho khách biết
  // vùng này KHÁC các vùng còn lại ở chỗ nào. Phần lớn câu hỏi mở đầu của khách là câu hỏi so
  // sánh ngầm ("nên đi Đồng Văn hay Hoàng Su Phì"), nên nếu tám tài liệu vùng đều tả "núi non
  // hùng vĩ, bản làng yên bình" thì tác tử không có gì để phân biệt và sẽ gợi ý bừa.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "mo-ta-ha-giang",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Hà Giang trông như thế nào",
    content:
      "Hà Giang mà khách nói tới là cả một vùng núi đá ở cực bắc chứ không còn là một tỉnh, và điều " +
      "đầu tiên nhận ra khi vào vùng là cảnh đổi rất nhanh theo độ cao. Rời thành phố thì hai bên " +
      "vẫn là đồi thấp, ruộng nước và nhà xây bình thường; chạy thêm một quãng, vách đá xám bắt đầu " +
      "dựng sát mép đường; rồi tới đoạn mà đất gần như biến mất, chỉ còn đá tai mèo nhọn phủ kín từ " +
      "chân núi lên tận đỉnh. Cảm giác đặc trưng nhất của vùng là sự liên tục của núi: nhìn về hướng " +
      "nào cũng là lớp núi này chồng lên lớp núi kia cho tới khi mờ hẳn, không có một khoảng bằng " +
      "phẳng nào đủ rộng để mắt nghỉ. Con người sống chen vào giữa những chỗ hiếm hoi còn đất — ngô " +
      "mọc trong hốc đá, nhà trình tường màu đất nép sau hàng rào đá xếp khan, một mảnh ruộng bậc " +
      "thang bé bằng manh chiếu vắt ngang sườn dốc. Đường thì gần như không có đoạn thẳng nào dài, " +
      "nên đi Hà Giang là đi chậm, và mọi ước lượng thời gian theo kiểu đường đồng bằng đều sai. " +
      "Khách thường hình dung vùng này thành một vòng cung: xuất phát từ thành phố Hà Giang, ngược " +
      "lên Quản Bạ, Yên Minh, Đồng Văn, vượt Mã Pí Lèng xuống Mèo Vạc rồi vòng về. Hai nhánh Hoàng " +
      "Su Phì và Xín Mần ở phía tây gần như là một chuyến đi khác hẳn, nơi đá nhường chỗ cho núi " +
      "đất và ruộng bậc thang.",
    tags: ["mo-ta", "tong-quan-vung", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-vi-xuyen",
    domain: "destination",
    entityType: "region",
    entityId: "vi-xuyen",
    title: "Vị Xuyên trông như thế nào",
    content:
      "Vị Xuyên là đoạn cuối cùng còn mang dáng trung du trước khi đường bắt đầu leo. Cảnh hai bên " +
      "quốc lộ là đồi thấp phủ rừng trồng, ruộng lúa chạy dọc theo sông Lô và những thị tứ bám sát " +
      "mặt đường, tức là vẫn giống phần lớn miền núi phía Bắc chứ chưa có gì báo trước cao nguyên " +
      "đá. Chính vì thế đây là vùng bị đi lướt nhiều nhất: xe từ Hà Nội lên chạy hết Vị Xuyên mới " +
      "tới thành phố Hà Giang, và hầu hết khách không nhận ra mình đã đi qua một vùng riêng. Thứ " +
      "đáng dừng ở đây không phải cảnh mà là ký ức — địa danh Vị Xuyên gắn liền với cuộc chiến bảo " +
      "vệ biên giới phía Bắc, và vùng có một nghĩa trang liệt sĩ quốc gia mà nhiều đoàn ghé thắp " +
      "hương trên đường lên. Ngoài ra Vị Xuyên còn giữ Hồ Noong, một hồ nước nằm khuất trong rừng " +
      "mà rất ít khách đi vòng cung chính biết tới. Nếu đã lỡ hẹn giờ thì bỏ qua vùng này là hợp " +
      "lý, nhưng nên bỏ qua vì biết mình bỏ qua cái gì.",
    tags: ["mo-ta", "cua-ngo-phia-nam", "it-khach"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-tp-ha-giang",
    domain: "destination",
    entityType: "region",
    entityId: "tp-ha-giang",
    title: "Thành phố Hà Giang trông như thế nào",
    content:
      "Thành phố Hà Giang là một đô thị nhỏ nằm lọt trong thung lũng hẹp hai bên sông Lô, với núi " +
      "dựng gần như sát mép phố ở cả hai phía. Phố xá ở đây bình thường theo đúng nghĩa: vài trục " +
      "đường chính, nhà ống, quán ăn, cửa hàng sửa xe, và một quảng trường trung tâm nơi có cột mốc " +
      "số 0 mà hầu hết đoàn đều dừng chụp một kiểu trước khi lên đường. Không nên tới đây để tìm " +
      "cảnh đẹp, vì cảnh của cả vùng bắt đầu ở phía trên chứ không phải ở đây. Giá trị thật của " +
      "thành phố là chức năng hậu cần: đây là nơi cuối cùng còn đủ dịch vụ để thuê xe máy, mua đồ " +
      "bảo hộ, rút tiền mặt, sửa xe và ăn một bữa tử tế trước khi vào những vùng mà mọi thứ đều " +
      "thưa thớt hơn. Về đêm phố khá yên, hàng quán đóng sớm và không có nhịp sống về khuya như " +
      "khách quen ở thành phố lớn hình dung. Cũng cần nhớ đây là mốc thấp nhất của cả hành trình " +
      "về độ cao, nên cái nóng cảm nhận được ở đây không nói gì về thời tiết mà khách sẽ gặp sau " +
      "vài giờ chạy xe.",
    tags: ["mo-ta", "diem-xuat-phat", "hau-can"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-quan-ba",
    domain: "destination",
    entityType: "region",
    entityId: "quan-ba",
    title: "Quản Bạ trông như thế nào",
    content:
      "Quản Bạ là vùng đầu tiên của cao nguyên đá tính từ dưới lên, và nó là vùng dễ chịu nhất " +
      "trong bốn vùng cao nguyên. Cách vào vùng có tính sân khấu: đường leo hết một con dốc dài " +
      "trong tầm nhìn bị núi chắn, rồi đột ngột mở ra ở khe Cổng Trời, bên dưới là thung lũng Tam " +
      "Sơn phẳng phiu với hai quả đồi tròn của Núi Đôi nằm giữa ruộng. Cảnh ở đây còn mềm — vẫn có " +
      "ruộng nước, vẫn có cây xanh phủ sườn núi, đá đã nhiều nhưng chưa tới mức trơ trọi như Đồng " +
      "Văn hay Mèo Vạc. Rời trục chính vài cây số là các thung lũng nhỏ với bản người Dao ở Nặm Đăm " +
      "và làng dệt lanh Lùng Tám, nơi nhịp sinh hoạt còn chậm và ít bị du lịch làm biến dạng. Vì " +
      "nằm gần thành phố nên Quản Bạ thường chỉ là chặng nghỉ trưa của ngày thứ nhất chứ ít đoàn " +
      "ngủ lại, và đó là chỗ đáng cân nhắc: chạy vội qua đây để kịp Đồng Văn nghĩa là bỏ mất phần " +
      "duy nhất của cao nguyên còn nhìn thấy màu xanh.",
    tags: ["mo-ta", "vong-cung-chinh", "cua-len-cao-nguyen"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-yen-minh",
    domain: "destination",
    entityType: "region",
    entityId: "yen-minh",
    title: "Yên Minh trông như thế nào",
    content:
      "Yên Minh là đoạn chuyển tiếp, và cảnh của nó lạc điệu một cách dễ chịu so với phần còn lại " +
      "của cao nguyên. Thay vì đá tai mèo, phần lớn quãng đường qua đây chạy giữa những đồi thông " +
      "trên nền đất đỏ, không khí khô và mát, đến mức nhiều người gọi đây là chỗ nghỉ mắt giữa hai " +
      "vùng đá. Thị trấn nằm trong một thung lũng rộng, đường sá tương đối bằng và thẳng hơn hẳn " +
      "các đoạn trước lẫn sau, nên đây cũng là nơi tay lái được nghỉ. Đa số đoàn chỉ ăn trưa ở thị " +
      "trấn rồi đi tiếp, vì Yên Minh không có một điểm ngắm nào đủ nổi để giữ chân. Từ Mậu Duệ phía " +
      "đông vùng có ngã rẽ đi Du Già — nhánh này dẫn sang một kiểu cảnh khác hẳn, thấp hơn và ẩm " +
      "hơn, với rừng và thác thay cho đá. Ai muốn hiểu vì sao cao nguyên đá lại khắc nghiệt đến thế " +
      "thì nên để ý chính đoạn Yên Minh, bởi đây là mốc so sánh: cùng một vùng núi mà chỉ cần đổi " +
      "nền địa chất là cây cối mọc lại được.",
    tags: ["mo-ta", "vong-cung-chinh", "diem-dung-nghi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-dong-van",
    domain: "destination",
    entityType: "region",
    entityId: "dong-van",
    title: "Đồng Văn trông như thế nào",
    content:
      "Đồng Văn là nơi cao nguyên đá thể hiện rõ nhất bản chất của nó: đá nhiều tới mức đất trở " +
      "thành thứ hiếm, và mọi thứ con người làm ở đây đều là cách xoay xở với sự thiếu đất đó. " +
      "Dọc đường trong vùng, cái đập vào mắt là những nương ngô trồng lọt thỏm trong hốc đá và " +
      "những bức tường rào bằng đá xếp không vữa, thẳng thớm, chạy quanh từng mảnh sân. Thị trấn " +
      "nằm trong một lòng chảo khép kín, bốn bề là vách núi, và khu phố cổ với dãy nhà trình tường " +
      "mái ngói âm dương nằm ngay giữa lòng chảo ấy khiến buổi tối ở đây có cảm giác tách biệt hẳn " +
      "với bên ngoài. Sáng sớm sương thường đọng lại trong lòng chảo lâu hơn các nơi khác, và đó là " +
      "khoảng thời gian đẹp nhất trong ngày ở thị trấn. Đồng Văn cũng là trung tâm hậu cần của nửa " +
      "trên hành trình: từ đây rẽ đi Lũng Cú, đi Sà Phìn, đi Sủng Là, và cũng từ đây bắt đầu Mã Pí " +
      "Lèng. Vào cuối thu, khi tam giác mạch nở, các thửa nương quanh vùng đổi màu và lượng khách " +
      "tăng vọt tới mức thị trấn nhỏ này chật kín — đó là điều nên biết trước khi chọn ngày.",
    tags: ["mo-ta", "vong-cung-chinh", "trung-tam-hau-can"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-meo-vac",
    domain: "destination",
    entityType: "region",
    entityId: "meo-vac",
    title: "Mèo Vạc trông như thế nào",
    content:
      "Mèo Vạc nằm bên kia Mã Pí Lèng và khắc nghiệt hơn Đồng Văn một bậc. Thị trấn lọt trong một " +
      "lòng chảo hẹp, bốn phía là núi đá dựng đứng vây kín, nên đứng ở trung tâm nhìn ra hướng nào " +
      "cũng thấy tường đá chắn tầm mắt. Địa hình quanh thị trấn gần như không còn thung lũng bằng " +
      "nào đáng kể, và đây là vùng mà cụm từ sống trên đá không phải là lối nói văn vẻ. Điều làm " +
      "Mèo Vạc khác biệt lại không nằm ở cảnh mà ở con người: phiên chợ chủ nhật ở đây, đặc biệt " +
      "khu mua bán trâu bò, là nơi tập trung đông và thật nhất mà khách có thể gặp trong cả hành " +
      "trình. Sát chân đèo về phía thị trấn là Pả Vi, nơi tập trung phần lớn cơ sở lưu trú của " +
      "vùng, nên hầu hết câu hỏi ngủ ở đâu để sáng sớm còn kịp lên đèo cuối cùng đều dẫn về đó. " +
      "Về phía đông nam, đường đi Khâu Vai xấu và vắng, và ngoài dịp chợ tình thì gần như không có " +
      "lý do để rẽ vào.",
    tags: ["mo-ta", "vong-cung-chinh", "cho-phien"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-bac-me",
    domain: "destination",
    entityType: "region",
    entityId: "bac-me",
    title: "Bắc Mê trông như thế nào",
    content:
      "Bắc Mê nằm ở phía đông nam và thuộc về một thế giới địa hình khác với cao nguyên đá: ở đây " +
      "là núi đất, rừng còn khá dày, và trục cảnh chính là dòng sông Gâm cùng mặt nước lặng của " +
      "lòng hồ thuỷ điện. Sau nhiều ngày trong vùng đá xám, đi vào Bắc Mê giống như đổi hẳn tông " +
      "màu — xanh trở lại, không khí ẩm hơn, và đường bớt gấp khúc. Vùng này gần như không có khách " +
      "du lịch đại trà, hàng quán thưa, dịch vụ ít, nên nó chỉ hợp với người chấp nhận đi qua một " +
      "đoạn không có gì để check-in. Lý do phổ biến nhất để chọn đường này là để về Hà Giang mà " +
      "không phải chạy lại đúng cung đã đi lên, và trên đường về thì di tích Căng Bắc Mê là chỗ " +
      "đáng dừng chân duy nhất được nhiều người nhắc tới. Nếu đoàn đã mệt sau Mã Pí Lèng thì đây là " +
      "một lựa chọn hợp lý về mặt tinh thần: cảnh nhẹ đi đúng lúc người cần nhẹ.",
    tags: ["mo-ta", "nhanh-phia-dong", "duong-ve", "it-khach"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-hoang-su-phi",
    domain: "destination",
    entityType: "region",
    entityId: "hoang-su-phi",
    title: "Hoàng Su Phì trông như thế nào",
    content:
      "Hoàng Su Phì nằm ở nhánh phía tây và cần được hiểu là một chuyến đi riêng chứ không phải một " +
      "chặng ghé thêm của vòng cung đá. Nền địa hình ở đây là núi đất chứ không phải núi đá vôi, " +
      "nên sườn núi giữ được nước và người dân đã bạt chúng thành ruộng bậc thang leo từ chân thung " +
      "lũng lên gần tới đỉnh, tầng nọ nối tầng kia liên tục. Nhìn từ một sườn núi sang sườn đối " +
      "diện, cả quả núi trông như bị khắc thành những đường vân song song ôm theo đường đồng mức, " +
      "và quy mô của nó là thứ khiến người ta im lặng chứ không phải độ hiểm. Đây là địa bàn của " +
      "người La Chí, người Dao và người Nùng, những cộng đồng đã bồi đắp các thửa ruộng ấy qua " +
      "nhiều đời. Đổi lại, đường vào các xã có ruộng đẹp thường hẹp, dốc và xấu hơn hẳn quốc lộ ở " +
      "vòng cung chính, có đoạn chỉ đi được bằng xe máy và tay lái phải chắc. Mùa đẹp của Hoàng Su " +
      "Phì cũng lệch hẳn so với cao nguyên đá, nên ghép hai nơi vào một chuyến với kỳ vọng cả hai " +
      "đều đúng mùa thường là kỳ vọng sai.",
    tags: ["mo-ta", "nhanh-phia-tay", "ruong-bac-thang", "duong-kho"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-xin-man",
    domain: "destination",
    entityType: "region",
    entityId: "xin-man",
    title: "Xín Mần trông như thế nào",
    content:
      "Xín Mần là vùng xa nhất về phía tây và cũng là vùng ít khách nhất trong toàn bộ danh mục " +
      "này. Cảnh quan cùng họ với Hoàng Su Phì — núi đất, ruộng bậc thang, bản làng nằm rải trên " +
      "sườn — nhưng thưa người và ít hàng quán hơn, nên cảm giác chung là vắng chứ không phải hùng " +
      "vĩ. Trung tâm vùng là thị trấn Cốc Pài, một phố nhỏ bám theo sườn dốc bên dòng sông, và tên " +
      "Cốc Pài được người địa phương dùng nhiều hơn cả tên Xín Mần. Điểm được nhắc tới nhiều nhất " +
      "là khu Thác Tiên trên đèo Gió, nơi còn giữ được một mảng rừng già ẩm và mát. Đường từ Hoàng " +
      "Su Phì sang khá xấu và dài, nên chọn đi Xín Mần đồng nghĩa với việc dành hẳn thêm thời gian " +
      "cho nó chứ không thể xem là đường tạt ngang. Người viết chỉ nắm được vùng này ở mức khái " +
      "quát, nên với câu hỏi về từng điểm cụ thể trong vùng thì nên nói rõ là chưa đủ dữ liệu thay " +
      "vì suy đoán.",
    tags: ["mo-ta", "nhanh-phia-tay", "it-khach", "du-lieu-so-luoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // ---------------------------------------------------------------------------------------------
  // XÃ / THỊ TRẤN / BẢN
  //
  // Mô tả ở cấp này phải nói được nơi đó dùng để làm gì trong một hành trình, vì đó mới là câu
  // khách thực sự hỏi. "Tam Sơn thế nào" gần như luôn có nghĩa là "ngủ ở Tam Sơn có ổn không",
  // chứ hiếm khi là một câu hỏi thẩm mỹ thuần tuý.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "mo-ta-thon-tha",
    domain: "destination",
    entityType: "commune",
    entityId: "thon-tha",
    title: "Thôn Tha trông như thế nào",
    content:
      "Thôn Tha là một bản người Tày nằm ngay rìa thành phố Hà Giang, tách khỏi phố bằng một quãng " +
      "đường ngắn chạy giữa ruộng. Bản gồm những nếp nhà sàn gỗ dựng thưa trên nền ruộng bằng, có " +
      "con suối chảy qua và núi thấp bao quanh ở phía xa, nên khung cảnh nhẹ nhàng chứ không hiểm " +
      "trở. Vì cách trung tâm chỉ một đoạn ngắn nên đây là lựa chọn quen thuộc cho đêm đầu tiên của " +
      "những đoàn lên tới nơi lúc trời đã tối: vẫn ngủ được ở chỗ yên tĩnh mà sáng hôm sau không " +
      "mất thời gian quay ra. Nhịp ở bản chậm, buổi tối gần như không có gì diễn ra ngoài bữa cơm " +
      "và tiếng côn trùng, và đó chính là thứ khách tìm tới. Nên nhớ đây là một làng đang sống chứ " +
      "không phải khu du lịch được dựng lên, nên tiện nghi ở mức vừa phải và sinh hoạt của chủ nhà " +
      "diễn ra ngay bên cạnh.",
    tags: ["mo-ta", "gan-thanh-pho", "diem-ngu-dem", "lang-van-hoa-du-lich"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-tam-son",
    domain: "destination",
    entityType: "commune",
    entityId: "tam-son",
    title: "Tam Sơn trông như thế nào",
    content:
      "Tam Sơn là thị trấn nằm giữa thung lũng của vùng Quản Bạ, và đây chính là cái thị trấn mà " +
      "khách nhìn thấy từ trên Cổng Trời trước khi đổ đèo xuống. Nhìn từ trên cao thì nó gọn gàng " +
      "một cách khác thường so với phần còn lại của cao nguyên: một khoảnh đất bằng hiếm hoi, ruộng " +
      "vuông vắn, đường ngang dọc rõ nét, và hai quả đồi tròn của Núi Đôi nằm ngay rìa. Xuống tới " +
      "nơi thì thị trấn chỉ có vài dãy phố, đủ nhà nghỉ, quán ăn, cây xăng và cửa hàng tạp hoá, " +
      "không có gì đặc biệt để xem. Vai trò của Tam Sơn trong hành trình là chỗ dừng chân: ăn trưa " +
      "ngày thứ nhất, hoặc ngủ lại nếu đoàn xuất phát muộn và không muốn chạy đèo trong đêm. Thung " +
      "lũng này thấp hơn phần cao nguyên phía trên nên buổi tối cũng dễ chịu hơn Đồng Văn hay Mèo " +
      "Vạc, một điểm cộng cho những người không quen rét.",
    tags: ["mo-ta", "diem-ngu-dem", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-nam-dam",
    domain: "destination",
    entityType: "commune",
    entityId: "nam-dam",
    title: "Nặm Đăm trông như thế nào",
    content:
      "Nặm Đăm là một thôn của người Dao chàm nằm trong thung lũng nhỏ cách thị trấn Tam Sơn không " +
      "xa, khuất sau một quãng đường vòng nên yên tĩnh hơn hẳn trục chính. Nhà ở đây là nhà trình " +
      "tường: tường đất nện dày màu vàng nâu, mái lợp ngói âm dương, cửa gỗ thấp, và cả thôn giữ " +
      "được sự đồng đều về kiểu dáng chứ chưa bị xen nhà bê tông làm vỡ. Thung lũng quanh thôn có " +
      "ruộng và vườn thuốc, còn phía sau là sườn núi đá dựng lên làm nền. Đây là một trong những " +
      "nơi làm du lịch cộng đồng bài bản và sớm nhất của vùng, nên khách ở lại thường ăn cơm cùng " +
      "chủ nhà và có thể tắm lá thuốc theo cách của người Dao — thứ được nhắc tới nhiều nhất khi " +
      "người ta kể về Nặm Đăm. Cảm giác ở đây thiên về tĩnh và ấm chứ không phải choáng ngợp, nên " +
      "nó hợp với người muốn ngủ lại một đêm hơn là người chỉ ghé chụp ảnh rồi đi.",
    tags: ["mo-ta", "homestay-cong-dong", "nguoi-dao"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-lung-tam",
    domain: "destination",
    entityType: "commune",
    entityId: "lung-tam",
    title: "Lùng Tám trông như thế nào",
    content:
      "Lùng Tám nằm trong một thung lũng hẹp bên dòng sông Miện, ở nhánh rẽ khỏi trục chính của " +
      "vùng Quản Bạ. Đường vào chạy men theo sông, một bên là nước, một bên là vách núi, và thung " +
      "lũng mở ra thành những khoảnh ruộng nhỏ kẹp giữa hai dãy núi. Bản thân khung cảnh không " +
      "thuộc loại gây choáng, nhưng nó có cái yên của một nơi nằm ngoài đường đi của số đông. Lý do " +
      "khách tới đây gần như luôn là nghề dệt lanh của người Mông: cả quy trình từ cây lanh tới tấm " +
      "vải nhuộm chàm vẫn được làm thủ công ngay tại chỗ, và có thể nhìn thấy các công đoạn đang " +
      "diễn ra chứ không phải xem trưng bày. Vì là nhánh rẽ nên phải tính cả chiều quay ra khi xếp " +
      "lịch, và đây là chi tiết hay bị bỏ sót ở ngày đầu tiên vốn đã kín.",
    tags: ["mo-ta", "lang-nghe", "nhanh-re"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-mau-due",
    domain: "destination",
    entityType: "commune",
    entityId: "mau-due",
    title: "Mậu Duệ trông như thế nào",
    content:
      "Mậu Duệ là một thị tứ nhỏ nằm ở ngã ba phía đông vùng Yên Minh, và cần nói thẳng rằng nó " +
      "không có cảnh gì để xem. Phố chỉ là một dãy nhà bám hai bên đường với quán ăn, tạp hoá và " +
      "cây xăng, đủ để dừng lại chứ không đủ để ở lại. Giá trị của nơi này hoàn toàn nằm ở vị trí: " +
      "đây là điểm rẽ, đi thẳng thì lên Đồng Văn theo trục chính, còn rẽ xuống thì vào Du Già để " +
      "về Hà Giang theo cung phía đông. Khách nhắc tên Mậu Duệ chủ yếu lúc hỏi đường và lúc tính " +
      "xem còn đủ xăng tới chặng sau hay không, chứ hiếm khi hỏi ở đó có gì đẹp. Mô tả trung thực " +
      "về một nơi như vậy chính là nói rõ nó là điểm hậu cần, bởi gán cho nó vẻ đẹp không có thật " +
      "sẽ khiến ai đó bố trí thời gian dừng ở đây một cách vô ích.",
    tags: ["mo-ta", "nga-ba-quan-trong", "hau-can"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-du-gia",
    domain: "destination",
    entityType: "commune",
    entityId: "du-gia",
    title: "Du Già trông như thế nào",
    content:
      "Du Già nằm trong một thung lũng thấp và ấm hơn hẳn phần cao nguyên đá, nên cảnh ở đây xanh " +
      "trở lại: ruộng lúa dưới đáy thung, rừng phủ sườn núi, suối chảy qua bản và một con thác nằm " +
      "cách khu dân cư không xa. Kiểu đẹp của Du Già là kiểu đẹp của một cái làng chứ không phải " +
      "của một kỳ quan — không có điểm ngắm nào để đứng chụp, cái đáng nhớ là nhịp sống chậm và " +
      "khoảng thời gian buổi chiều khi trâu về bản. Đây là điểm dừng quen thuộc của khách nước " +
      "ngoài đi cung phía đông, nên các homestay ở đây quen phục vụ khách ở lại nhiều đêm và không " +
      "khí buổi tối thường đông vui hơn những bản khác. Đường vào Du Già từ cả hai phía đều xấu và " +
      "dài hơn khách hình dung, nhất là đoạn nối về phía Hà Giang, nên đừng xếp nó vào một ngày đã " +
      "kín lịch. Ai muốn đi bộ trong rừng hoặc tắm suối thì đây là chỗ hợp nhất trong toàn vùng.",
    tags: ["mo-ta", "homestay-cong-dong", "duong-ve", "trekking"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-sung-la",
    domain: "destination",
    entityType: "commune",
    entityId: "sung-la",
    title: "Sủng Là trông như thế nào",
    content:
      "Sủng Là là một thung lũng nhỏ nằm lọt giữa vòng vây núi đá, ngay sát trục quốc lộ nên rất " +
      "dễ ghé. Điều làm nơi này được nhắc nhiều là sự tương phản trong một khuôn hình: đáy thung " +
      "bằng phẳng với ruộng và những mái ngói âm dương của bản người Mông, còn viền quanh là đá xám " +
      "dựng đứng, khiến cả thung lũng trông như một ốc đảo. Trong bản có ngôi nhà trình tường từng " +
      "là bối cảnh phim Chuyện của Pao, và ngôi nhà đó đã trở thành lý do chính khiến khách rẽ vào, " +
      "kèm theo hệ quả là khu vực quanh nó khá đông và đã mang màu sắc thương mại. Nếu đi vào cuối " +
      "thu thì các thửa nương quanh thung lũng phủ tam giác mạch và đây là một trong những chỗ " +
      "chụp được cả hoa lẫn nền đá trong cùng một khung. Sủng Là hợp với một lần dừng ngắn trên " +
      "đường đi Đồng Văn hơn là một điểm dành hẳn nửa ngày.",
    tags: ["mo-ta", "diem-check-in", "thung-lung", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-pho-bang",
    domain: "destination",
    entityType: "commune",
    entityId: "pho-bang",
    title: "Phố Bảng trông như thế nào",
    content:
      "Phố Bảng là một thị trấn biên giới nhỏ nằm khuất trong thung lũng, cuối một nhánh cụt rẽ " +
      "khỏi quốc lộ, nên chỉ ai chủ đích đi mới tới. Chính vì nằm ngoài dòng chảy của khách mà nó " +
      "giữ được vẻ cũ kỹ hiếm thấy: một dãy phố ngắn với những ngôi nhà tường trình quét màu vàng " +
      "đã bạc, cửa gỗ hai cánh, mái ngói rêu và đèn lồng treo trước hiên. Không khí ở đây tĩnh tới " +
      "mức nhiều người mô tả cảm giác như bước vào một thị trấn đang ngủ, và điều đó đúng cả vào " +
      "ban ngày chứ không riêng buổi tối. Kiến trúc và cách bài trí phố phản ánh dấu ấn của cộng " +
      "đồng người Hoa từng buôn bán ở vùng biên này, bên cạnh cư dân người Mông trong các bản quanh " +
      "thung lũng. Đây là nơi dành cho người thích đi bộ chậm và nhìn ngắm chứ không có điểm ngắm " +
      "cảnh nào để dừng xe, và vì là nhánh cụt nên phải tính cả quãng quay ra khi xếp lịch.",
    tags: ["mo-ta", "nhanh-cut", "gan-bien-gioi", "it-khach"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-sa-phin",
    domain: "destination",
    entityType: "commune",
    entityId: "sa-phin",
    title: "Sà Phìn trông như thế nào",
    content:
      "Sà Phìn là một thung lũng nằm giữa vùng đá, và gần như toàn bộ sự chú ý dành cho nơi này đều " +
      "hướng về khu dinh thự họ Vương nằm ở giữa thung. Nhìn từ đường vào, cụm công trình mái ngói " +
      "sẫm màu nổi bật lên trên nền ruộng, còn xung quanh là hàng cây sa mộc thân thẳng cao vút " +
      "trồng thành hàng — chi tiết khiến khung cảnh ở đây khác hẳn mọi thung lũng khác trên cao " +
      "nguyên. Phần còn lại của xã là bản người Mông nằm rải trên sườn, với ruộng bậc thang nhỏ và " +
      "tường đá xếp quanh nương. Cạnh khu dinh thự có một khu chợ họp theo phiên, và vào ngày chợ " +
      "thì cả thung lũng đông hẳn lên trong buổi sáng rồi lại vắng vào buổi trưa. Sà Phìn nằm trên " +
      "đường từ Yên Minh đi Đồng Văn nên ghé được mà không phải đi vòng, và phần lớn khách dành cho " +
      "nó khoảng một buổi.",
    tags: ["mo-ta", "di-tich-quoc-gia", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-lung-cu",
    domain: "destination",
    entityType: "commune",
    entityId: "lung-cu",
    title: "Lũng Cú trông như thế nào",
    content:
      "Lũng Cú là xã nằm ở phần trên cùng của cao nguyên, sát đường biên, và cảnh ở đây trơ trọi " +
      "hơn hầu hết những nơi khách đã đi qua trước đó. Mặt đất phần lớn là đá và cỏ thấp, cây to " +
      "thưa thớt, gió gần như lúc nào cũng có, nên cảm giác chung là rộng và trống chứ không phải " +
      "bị núi ép như ở Mèo Vạc. Giữa vùng đất ấy, núi Rồng nhô lên thành một khối tròn dễ nhận, và " +
      "trên đỉnh nó là cột cờ mà mọi người tới đây để nhìn thấy. Dưới chân núi có hai hồ nước nhỏ " +
      "mà người địa phương gọi là mắt rồng, cùng vài bản nằm nép vào sườn, trong đó Lô Lô Chải là " +
      "bản được nhắc tới nhiều nhất và đi bộ được từ chân cột cờ. Cần nhớ rằng đây là khu vực biên " +
      "giới: có những lối đi và những điểm chỉ tới được sau khi khai báo, và việc đó không phải thủ " +
      "tục hình thức.",
    tags: ["mo-ta", "gan-bien-gioi", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-lung-phin",
    domain: "destination",
    entityType: "commune",
    entityId: "lung-phin",
    title: "Lũng Phìn trông như thế nào",
    content:
      "Lũng Phìn là một xã nhỏ nằm trên đoạn đường nối Đồng Văn với Mèo Vạc, ở phần cao nguyên khá " +
      "cao và lộng gió. Cảnh ở đây là cảnh cao nguyên điển hình: sườn đồi thoải phủ cỏ và đá, nương " +
      "ngô xen giữa, nhà nằm rải chứ không tụ thành phố. Nơi này được biết tới nhờ hai thứ, và cả " +
      "hai đều không phải phong cảnh. Thứ nhất là phiên chợ lùi, một phiên chợ mà ngày họp trôi dần " +
      "qua các thứ trong tuần nên muốn gặp thì phải tính trước. Thứ hai là chè Shan tuyết mọc trên " +
      "những cây chè cổ ở vùng này, thứ đặc sản được người sành trà tìm mua và được bán ngay tại " +
      "phiên chợ. Ngoài ngày chợ thì Lũng Phìn khá vắng và không có lý do rõ ràng để dừng lâu.",
    tags: ["mo-ta", "cho-phien", "che-shan-tuyet"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-pa-vi",
    domain: "destination",
    entityType: "commune",
    entityId: "pa-vi",
    title: "Pả Vi trông như thế nào",
    content:
      "Pả Vi nằm ngay dưới chân Mã Pí Lèng về phía Mèo Vạc, trong một khoảnh đất tương đối bằng kẹp " +
      "giữa vách núi và dòng Nho Quế ở phía dưới. Điều cần nói ngay để khách khỏi hiểu nhầm: khu " +
      "làng văn hoá du lịch ở đây là một quần thể được quy hoạch và xây mới, với cổng đá, đường nội " +
      "bộ và những dãy nhà mô phỏng kiểu trình tường của người Mông, chứ không phải một bản cổ còn " +
      "nguyên trạng. Nhìn nhận đúng bản chất đó thì nó vẫn là chỗ ở tốt: sạch, tiện, nhiều lựa " +
      "chọn, và tối đến các sân trong khu khá đông vui. Vị trí mới là thứ đáng giá nhất — ngủ ở đây " +
      "thì sáng sớm lên đèo hoặc xuống bến thuyền đều gần, và đó là lý do phần lớn câu hỏi ngủ gần " +
      "Mã Pí Lèng ở đâu đều dẫn về Pả Vi. Ai muốn không khí bản làng thật thì nên tìm nhà dân ở các " +
      "thôn xung quanh thay vì trong khu quy hoạch.",
    tags: ["mo-ta", "diem-ngu-dem", "lang-van-hoa-du-lich", "gan-ma-pi-leng"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-khau-vai",
    domain: "destination",
    entityType: "commune",
    entityId: "khau-vai",
    title: "Khâu Vai trông như thế nào",
    content:
      "Khâu Vai là một xã nằm sâu về phía đông nam của vùng Mèo Vạc, và điều quan trọng nhất cần " +
      "biết là đường vào xấu và xa hơn hẳn những gì bản đồ gợi ý. Cảnh dọc đường là núi đá và nương " +
      "ngô, đẹp theo kiểu quen thuộc của cao nguyên chứ không có gì khác biệt đủ để bù cho quãng " +
      "đường. Bản thân trung tâm xã là một cụm dân cư nhỏ với khu chợ nằm trên sườn dốc, ngày " +
      "thường thì gần như trống. Cả năm nơi này chỉ thực sự sống dậy vào đúng dịp phiên chợ tình, " +
      "khi người từ khắp các xã quanh vùng đổ về và cả khu vực chật kín trong một hai ngày. Vì vậy " +
      "câu trả lời trung thực cho người hỏi có nên ghé Khâu Vai hay không phụ thuộc gần như hoàn " +
      "toàn vào ngày đi: ngoài dịp chợ, đây là một chuyến đi dài để tới một nơi không có gì đang " +
      "diễn ra.",
    tags: ["mo-ta", "duong-kho", "cho-phien", "it-khach"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // ---------------------------------------------------------------------------------------------
  // ĐỊA DANH
  //
  // Từ khối này trở xuống `domain` chuyển sang "attraction". Ranh giới giữa hai domain không phải
  // chuyện đặt tên cho đẹp: bộ lọc metadata chạy trước semantic search, nên câu "ở Đồng Văn có
  // điểm nào đáng xem" lọc `attraction` trong cây Đồng Văn, còn câu "Đồng Văn thế nào" lọc
  // `destination`. Gắn nhầm domain cho một địa danh là làm nó biến mất khỏi đúng loại câu hỏi mà
  // nó sinh ra để trả lời.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "mo-ta-cao-nguyen-da-dong-van",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cao-nguyen-da-dong-van",
    title: "Cao nguyên đá Đồng Văn trông như thế nào",
    content:
      "Cao nguyên đá Đồng Văn không phải một điểm để tới mà là cái nền mà gần như toàn bộ hành " +
      "trình diễn ra bên trên, trải qua cả bốn vùng Quản Bạ, Yên Minh, Đồng Văn và Mèo Vạc. Bề mặt " +
      "của nó là đá vôi bị nước bào mòn qua thời gian rất dài thành thứ mà người địa phương gọi là " +
      "đá tai mèo: những phiến đá xám sẫm, sắc cạnh, dựng chi chít như răng cưa và phủ kín sườn núi " +
      "từ chân lên đỉnh. Xen giữa các dãy núi là những phễu sụt và thung lũng kín đáy bằng, nơi đất " +
      "gom lại được và con người dựng bản, nên nhìn từ trên cao thì các khu dân cư trông như những " +
      "vũng xanh nhỏ trong một biển đá. Cảm giác khi đi giữa nó là cảm giác về sự khô cằn có tổ " +
      "chức: đá ở khắp nơi nhưng mọi mảnh đất hiếm hoi đều đã được tận dụng, kể cả một hốc đá vừa " +
      "đủ cho một gốc ngô. Đây cũng là lý do vùng này được công nhận là công viên địa chất toàn " +
      "cầu, và là lý do khiến nó không giống bất kỳ vùng núi nào khác ở Việt Nam. Với người đi " +
      "đường, điều thiết thực nhất cần nhớ là nền đá không giữ nước, nên nguồn nước ở đây khan hiếm " +
      "và mùa khô là mùa vất vả của người dân chứ không chỉ là mùa đẹp của khách.",
    tags: ["mo-ta", "unesco-geopark", "thuc-the-trai-rong"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-duong-hanh-phuc",
    domain: "attraction",
    entityType: "landmark",
    entityId: "duong-hanh-phuc",
    title: "Con đường Hạnh Phúc trông như thế nào",
    content:
      "Con đường Hạnh Phúc là trục xương sống nối thành phố Hà Giang với Đồng Văn rồi Mèo Vạc, và " +
      "trên thực tế nó chính là hành trình chứ không phải một điểm nằm trong hành trình. Đặc điểm " +
      "dễ nhận nhất là con đường hầu như không có đoạn thẳng nào đáng kể: nó bám theo sườn núi, " +
      "lượn vào từng khe rồi vòng ra từng mũi, và tầm nhìn phía trước thường bị chính vách đá bên " +
      "trái hoặc bên phải chắn lại. Mặt đường được duy trì khá tốt trên phần lớn tuyến, nhưng lề " +
      "hẹp, nhiều đoạn một bên là vách dựng đứng còn bên kia là vực không có gì che chắn. Cảnh dọc " +
      "đường thay đổi liên tục theo từng đoạn — rừng thông, thung lũng ruộng, phố huyện, rồi biển " +
      "đá — nên cảm giác đi trên nó là cảm giác bị đổi khung hình liên tục chứ không phải sự đơn " +
      "điệu. Đoạn được nhắc tới nhiều nhất, và cũng là đoạn hiểm nhất, là khúc vắt ngang vách Mã " +
      "Pí Lèng. Điều đáng nói nhất về con đường này không nằm ở cảnh mà ở cách nó ra đời, và phần " +
      "đó thuộc về tài liệu lịch sử.",
    tags: ["mo-ta", "thuc-the-trai-rong", "phu-hop-xe-may", "duong-deo"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-cot-moc-bien-gioi",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cot-moc-bien-gioi",
    title: "Tuyến cột mốc biên giới đoạn Hà Giang trông như thế nào",
    content:
      "Đây là một thực thể gộp chứ không phải một địa điểm, và mô tả phải nói rõ điều đó trước khi " +
      "nói bất cứ điều gì khác. Đoạn biên giới chạy qua vùng này men theo sống núi và các đỉnh cao, " +
      "và các cột mốc là những khối đá granite vuông vắn có khắc quốc huy cùng số hiệu, đặt ở những " +
      "điểm đã được hai bên xác định. Khung cảnh quanh phần lớn cột mốc là cỏ tranh, đá và gió, với " +
      "tầm nhìn rất rộng vì mốc thường nằm ở chỗ cao; cảm giác đứng ở đó thiên về sự trang nghiêm " +
      "và trống trải hơn là vẻ đẹp thị giác. Đường tới mốc hầu như không phải đường xe: chủ yếu là " +
      "lối mòn đi bộ men theo triền dốc, trơn khi ẩm và không có chỉ dẫn rõ ràng. Điều bắt buộc " +
      "phải nói kèm là thủ tục: khu vực biên giới đòi hỏi khai báo với đồn biên phòng, có nơi cần " +
      "giấy phép, và việc tự ý đi vào là vi phạm chứ không phải phiêu lưu. Danh mục này chỉ kê " +
      "riêng cột mốc 428, nên nếu khách hỏi về một số hiệu khác thì câu trả lời đúng là chưa có dữ " +
      "liệu, tuyệt đối không suy đoán vị trí.",
    tags: ["mo-ta", "thuc-the-gop", "can-giay-phep-bien-gioi", "gan-bien-gioi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-ho-noong",
    domain: "attraction",
    entityType: "landmark",
    entityId: "ho-noong",
    title: "Hồ Noong trông như thế nào",
    content:
      "Hồ Noong là một hồ nước nằm khuất giữa rừng ở vùng Vị Xuyên, cách trục quốc lộ một quãng " +
      "đường nhỏ nên rất ít khách đi vòng cung chính ghé qua. Thứ khiến hồ này khác những hồ khác " +
      "là những thân cây khô đứng thẳng giữa mặt nước, xám bạc và trơ cành, tạo nên một khung cảnh " +
      "lặng lẽ đến mức nhiều người mô tả là hơi liêu trai. Mặt nước thường phẳng, và vào buổi sáng " +
      "sớm khi sương còn đọng trên hồ thì ranh giới giữa nước, cây và núi phía sau gần như tan vào " +
      "nhau. Diện tích mặt nước thay đổi theo mùa: mùa mưa hồ dâng rộng, mùa khô nước rút để lộ " +
      "phần bãi quanh bờ, nên cùng một chỗ đứng mà hai mùa cho hai khung cảnh khác nhau. Quanh hồ " +
      "là rừng và một vài nếp nhà của người Tày, dịch vụ gần như không có, nên đây là nơi để ngồi " +
      "yên chứ không phải nơi để tìm tiện nghi. Ai đi cung phía nam hoặc có thừa nửa buổi ở thành " +
      "phố Hà Giang thì đây là lựa chọn hợp lý.",
    tags: ["mo-ta", "ho-nuoc", "it-khach", "cua-ngo-phia-nam"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-deo-bac-sum",
    domain: "attraction",
    entityType: "landmark",
    entityId: "deo-bac-sum",
    title: "Dốc Bắc Sum trông như thế nào",
    content:
      "Bắc Sum là con dốc đầu tiên thật sự đáng gọi là dốc trên đường từ thành phố lên cao nguyên, " +
      "và nó đóng vai trò cánh cửa: leo hết nó là địa hình đổi hẳn. Con dốc gồm nhiều tầng cua gấp " +
      "xếp chồng lên nhau trên một sườn núi trọc, nên khi đứng ở phần trên nhìn xuống thì thấy rõ " +
      "cả dải đường mình vừa đi vắt qua vắt lại bên dưới. Hai bên đường chủ yếu là cỏ tranh và đá " +
      "lộ, cây thấp, tầm nhìn thoáng chứ không bị rừng che, đó là lý do đây là một trong những chỗ " +
      "chụp được toàn cảnh khúc cua rõ nhất trong cả tuyến. Với người đi xe máy, đây cũng là đoạn " +
      "đầu tiên cảm nhận được nhiệt độ tụt xuống rõ rệt so với lúc rời thành phố, và nhiều người " +
      "dừng lại đúng ở đây để mặc thêm áo. Mặt đường tốt nhưng cua liên tục và có xe tải chạy, nên " +
      "đây là nơi tập dượt thói quen bám làn và không cắt cua cho cả những đoạn hiểm hơn phía sau.",
    tags: ["mo-ta", "duong-deo", "phu-hop-xe-may", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-cong-troi-quan-ba",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cong-troi-quan-ba",
    title: "Cổng Trời Quản Bạ trông như thế nào",
    content:
      "Cổng Trời Quản Bạ là một khe hẹp giữa hai khối núi mà con đường phải luồn qua, và cái tên " +
      "mô tả đúng cảm giác đi qua nó. Trước khi tới cổng, đường leo trong không gian bị núi khép " +
      "lại và tầm nhìn ngắn; qua khỏi khe thì toàn bộ thung lũng Tam Sơn mở ra bên dưới cùng một " +
      "lúc, và sự đột ngột đó mới là thứ đáng nhớ chứ không phải bản thân cái khe. Tại chỗ hẹp nhất " +
      "vẫn còn dấu vết của hai bên vách được xẻ ra để mở đường, và khu vực này từ lâu được coi là " +
      "ranh giới tự nhiên giữa vùng thấp phía dưới với cao nguyên phía trên. Gió ở đây gần như lúc " +
      "nào cũng mạnh vì cả khối không khí phải dồn qua một chỗ hẹp, nên dù trời nắng thì đứng lâu " +
      "vẫn lạnh. Ngay cạnh cổng có chỗ đỗ xe và một đài quan sát xây trên mỏm cao, và hầu hết khách " +
      "dừng lại đúng ở đó chứ không phải ở lòng khe.",
    tags: ["mo-ta", "duong-deo", "diem-ngam-canh", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-nui-doi-co-tien",
    domain: "attraction",
    entityType: "landmark",
    entityId: "nui-doi-co-tien",
    title: "Núi Đôi Cô Tiên trông như thế nào",
    content:
      "Núi Đôi Cô Tiên là hai quả đồi tròn đều nằm sát nhau ngay giữa cánh đồng của thung lũng Tam " +
      "Sơn, và điều khiến chúng nổi bật là hình dáng cân đối một cách bất thường giữa một vùng mà " +
      "núi non chỗ nào cũng lởm chởm. Hai quả đồi phủ cỏ và cây bụi nên đổi màu theo mùa vụ của " +
      "ruộng xung quanh, từ xanh mạ tới vàng rồi nâu đất sau gặt. Nhìn từ dưới thung lũng thì chúng " +
      "chỉ là hai gò đất khá bình thường; toàn bộ giá trị thị giác nằm ở góc nhìn từ trên cao xuống, " +
      "nơi thấy được cả hình dáng lẫn tương quan của chúng với ruộng và thị trấn. Vì vậy câu hỏi " +
      "đúng khi tới đây không phải leo lên núi thế nào mà đứng ở đâu để nhìn, và câu trả lời là " +
      "đài quan sát trên Cổng Trời. Đây là một trong số ít cảnh ở Hà Giang mà ảnh chụp gần như luôn " +
      "đẹp hơn cảm nhận tại chỗ, nên cần nói trước để khách không hụt hẫng.",
    tags: ["mo-ta", "diem-check-in", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-rung-thong-yen-minh",
    domain: "attraction",
    entityType: "landmark",
    entityId: "rung-thong-yen-minh",
    title: "Rừng thông Yên Minh trông như thế nào",
    content:
      "Rừng thông Yên Minh là một đoạn đường chạy giữa những quả đồi phủ thông trên nền đất đỏ, và " +
      "nó là chỗ lạc điệu dễ chịu nhất trên cả tuyến. Thân thông thẳng, tán thưa, ánh nắng lọt " +
      "xuống thành từng vệt trên mặt đất, và không khí có mùi nhựa thông khô hẳn so với đoạn đá " +
      "trước đó. Vì đường ở đây tương đối bằng và ít cua gắt nên đây cũng là quãng hiếm hoi mà " +
      "người lái được thả lỏng. Cần nói rõ về quy mô để khách khỏi kỳ vọng sai: đây là những vạt " +
      "thông ven đường chứ không phải một cánh rừng lớn đi sâu vào được, và biệt danh Đà Lạt của Hà " +
      "Giang mà mạng xã hội hay dùng gợi ra một hình dung lớn hơn thực tế nhiều. Cái hợp lý để làm " +
      "ở đây là dừng xe, đứng một lát cho hạ nhiệt rồi đi tiếp, chứ không phải dành hẳn một mục " +
      "trong lịch trình.",
    tags: ["mo-ta", "diem-dung-nghi", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-thac-du-gia",
    domain: "attraction",
    entityType: "landmark",
    entityId: "thac-du-gia",
    title: "Thác Du Già trông như thế nào",
    content:
      "Thác Du Già nằm trong rừng cách khu dân cư của thung lũng Du Già một quãng đi bộ ngắn, và nó " +
      "thuộc loại thác nhiều bậc chứ không phải một dải nước đổ thẳng. Nước chảy qua các bậc đá rồi " +
      "tụ lại thành vũng ở phía dưới, màu nước xanh trong vào mùa khô và đục hơn sau những trận mưa " +
      "lớn. Cảnh quanh thác là rừng ẩm với cây to, rêu và dây leo, khác hẳn kiểu khô cằn của cao " +
      "nguyên đá chỉ cách đó không xa, và chính sự tương phản này khiến nhiều người nhớ Du Già. " +
      "Tiếng nước ở đây đủ lớn để át tiếng nói chuyện khi đứng gần, nên cảm giác chung là mát và " +
      "ồn theo kiểu dễ chịu. Lượng nước thay đổi rõ theo mùa: cuối mùa khô thác mảnh đi trông thấy, " +
      "còn giữa mùa mưa thì nước xiết và không nên xuống. Muốn xuống tới vũng nước phía dưới thì " +
      "phải đi thêm một đoạn đường mòn, và đó là một điểm riêng chứ không phải cùng chỗ đứng.",
    tags: ["mo-ta", "thac-nuoc", "trekking", "duong-ve"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-doc-tham-ma",
    domain: "attraction",
    entityType: "landmark",
    entityId: "doc-tham-ma",
    title: "Dốc Thẩm Mã trông như thế nào",
    content:
      "Dốc Thẩm Mã là đoạn đường gấp khúc liên tục trên sườn núi trọc, nằm ở khoảng giữa Yên Minh " +
      "và Đồng Văn, và nó là một trong những hình ảnh được chụp nhiều nhất của cả vùng. Từ trên " +
      "đỉnh nhìn xuống, con đường hiện ra thành nhiều nhánh chữ chi xếp lớp trên nền đá xám và cỏ " +
      "vàng, mỗi khúc cua lại lộ ra một mặt sườn khác, nên hình khối rõ ràng hơn hẳn những con dốc " +
      "khác vốn bị cây che. Cảnh không có màu sắc rực rỡ mà thiên về đường nét, vì thế nó đẹp ngay " +
      "cả vào những ngày trời xám. Trên đỉnh dốc có bãi đất rộng để dừng xe, và ở đó thường có trẻ " +
      "em địa phương mang gùi hoa đứng chờ chụp ảnh cùng khách — một chi tiết nên được nói ra thay " +
      "vì lờ đi, bởi nó liên quan tới cách ứng xử chứ không chỉ tới cảnh. Với người lái xe, đây là " +
      "đoạn cua liên tiếp và có xe khách đi ngược, nên tầm nhìn ở mỗi khúc cua đều ngắn.",
    tags: ["mo-ta", "duong-deo", "diem-check-in", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-doc-chin-khoanh",
    domain: "attraction",
    entityType: "landmark",
    entityId: "doc-chin-khoanh",
    title: "Dốc Chín Khoanh trông như thế nào",
    content:
      "Dốc Chín Khoanh là con dốc nằm cùng đoạn với Thẩm Mã nhưng ở phía Đồng Văn hơn, và cái tên " +
      "nói đúng hình dáng của nó: một chuỗi khúc cua xếp chồng lên nhau trên một sườn núi dựng. " +
      "Khác với Thẩm Mã vốn trải rộng ra, Chín Khoanh dồn các khúc cua lại gần nhau theo chiều dọc " +
      "nên nhìn từ trên xuống có cảm giác con đường đang cuộn lại. Bên dưới dốc là thung lũng với " +
      "những nương ngô và mái nhà nằm rải, còn phía trên là mặt cao nguyên mở ra dẫn về hướng Sủng " +
      "Là và Phố Cáo. Đây là một trong những chỗ mà sự chênh lệch độ cao được cảm nhận rõ nhất " +
      "trong thời gian ngắn nhất, vì chỉ vài phút chạy xe là khung cảnh dưới chân đã lùi hẳn xuống. " +
      "Bãi dừng trên đỉnh không rộng và nằm sát mép đường, nên dừng lại cần chọn chỗ chứ không tấp " +
      "bừa vào lề.",
    tags: ["mo-ta", "duong-deo", "diem-check-in", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-cot-co-lung-cu",
    domain: "attraction",
    entityType: "landmark",
    entityId: "cot-co-lung-cu",
    title: "Cột cờ Lũng Cú trông như thế nào",
    content:
      "Cột cờ Lũng Cú đứng trên đỉnh núi Rồng, một khối núi tròn nhô hẳn lên giữa vùng đất trống " +
      "nên nhìn thấy được từ rất xa trước khi tới nơi. Thân cột hình bát giác ốp đá, chân cột có " +
      "phù điêu trống đồng, và trên đỉnh là lá cờ đỏ sao vàng cỡ lớn — lá cờ đó gần như lúc nào " +
      "cũng căng vì trên đỉnh núi gió không bao giờ ngớt, và tiếng vải đập trong gió là thứ nhiều " +
      "người nhớ nhất khi kể lại. Muốn lên tới chân cột phải leo một dãy bậc đá dài men theo sườn " +
      "núi, và với người không quen thì đoạn này mất sức hơn tưởng tượng. Từ trên nhìn xuống là " +
      "toàn cảnh vùng đất cực bắc: nương ngô, bản làng, hai hồ nước nhỏ mà người địa phương gọi là " +
      "mắt rồng, và xa hơn là đường phân thuỷ bên kia biên giới. Có một điều cần nói cho đúng và " +
      "hay bị nói sai: cột cờ là biểu tượng của điểm cực bắc chứ bản thân nó không nằm đúng tại " +
      "điểm cực bắc của lãnh thổ, chỗ đó nằm xa hơn về phía bắc gần khu vực cột mốc 428.",
    tags: ["mo-ta", "di-tich-quoc-gia", "gan-bien-gioi", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-deo-ma-pi-leng",
    domain: "attraction",
    entityType: "landmark",
    entityId: "deo-ma-pi-leng",
    title: "Đèo Mã Pí Lèng trông như thế nào",
    content:
      "Mã Pí Lèng là đoạn đèo nối Đồng Văn với Mèo Vạc, và nó là nơi mà toàn bộ vùng này dồn lại " +
      "thành một hình ảnh duy nhất. Con đường được đục vào lưng chừng một vách đá gần như dựng " +
      "đứng, phía trên là khối núi treo trên đầu, phía dưới là vực hẹp mà dưới đáy dòng Nho Quế " +
      "hiện ra như một sợi chỉ màu xanh ngọc. Điều làm đoạn này khác mọi con đèo khác không phải " +
      "độ dài mà là tỷ lệ: người và xe trở nên rất nhỏ so với mặt vách, và cảm giác đó rõ nhất khi " +
      "nhìn một chiếc xe khác đang chạy ở khúc cua phía trước. Mặt đường ở đây tương đối tốt nhưng " +
      "hẹp, nhiều đoạn không có lan can hoặc chỉ có mốc bê tông thấp, và sương có thể ập xuống làm " +
      "tầm nhìn ngắn lại chỉ trong ít phút. Trên tuyến có vài chỗ dừng được, mỗi chỗ cho một góc " +
      "nhìn khác nhau và không thay thế cho nhau, nên chúng được kê thành các điểm riêng trong danh " +
      "mục. Ai sợ độ cao nên biết trước rằng ở đây không có cách nào tránh nhìn xuống.",
    tags: ["mo-ta", "duong-deo", "duong-deo-nguy-hiem", "diem-ngam-canh", "vong-cung-chinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-song-nho-que",
    domain: "attraction",
    entityType: "landmark",
    entityId: "song-nho-que",
    title: "Sông Nho Quế trông như thế nào",
    content:
      "Sông Nho Quế chảy trong một khe hẹp dưới chân Mã Pí Lèng, và thứ khiến ai cũng nhận ra nó là " +
      "màu nước: một sắc xanh ngọc đặc, đậm hơn hẳn màu nước sông thường gặp, nổi bật trên nền đá " +
      "xám hai bên. Ở đoạn dưới hẻm vực, việc chặn dòng làm thuỷ điện đã biến khúc sông này thành " +
      "mặt nước gần như phẳng lặng, nên nhìn từ trên đèo xuống thì nó giống một dải lụa hơn là một " +
      "dòng chảy. Nhìn từ trên cao và ngồi trên mặt nước là hai trải nghiệm hoàn toàn khác nhau: ở " +
      "trên thì thấy hình dáng và màu sắc, còn ở dưới thì thấy chiều cao của vách đá dựng lên hai " +
      "bên và cảm giác bị bao bọc. Dưới đáy khe không khí mát hơn hẳn trên đèo và gió cũng lặng " +
      "hơn, nên hai nơi cách nhau vài phút chạy xe mà thời tiết cảm nhận được lại khác nhau rõ rệt. " +
      "Muốn xuống tới mặt nước thì phải đi qua một bến thuyền, và đường xuống bến là phần vất vả " +
      "nhất của cả chuyến.",
    tags: ["mo-ta", "song", "di-chuyen-bang-thuyen"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-hem-tu-san",
    domain: "attraction",
    entityType: "landmark",
    entityId: "hem-tu-san",
    title: "Hẻm vực Tu Sản trông như thế nào",
    content:
      "Hẻm Tu Sản là đoạn mà hai vách đá hai bên sông Nho Quế khép lại gần nhất, tạo thành một khe " +
      "rất sâu và rất hẹp so với chiều cao của nó. Đi thuyền tới đoạn này thì cảm giác đổi hẳn: " +
      "vách đá dựng thẳng đứng lên khỏi mặt nước ở cả hai phía, ánh sáng chỉ lọt xuống từ một dải " +
      "trời hẹp phía trên, và tiếng động vọng lại giữa hai bên vách. Mặt nước trong hẻm thường rất " +
      "lặng, màu xanh sẫm hơn đoạn ngoài, và điều gây ấn tượng mạnh nhất chính là sự im lặng chứ " +
      "không phải quy mô. Cần nói rõ một điều thực tế: bản thân hẻm vực nằm dưới mặt nước và giữa " +
      "hai vách, không có chỗ nào để đứng, nên mọi cách tiếp cận đều là hoặc nhìn từ trên xuống, " +
      "hoặc đi thuyền vào. Đoạn hẻm đẹp nhất chỉ dài vừa phải, và chuyến thuyền thường quay đầu " +
      "ngay sau khi qua khỏi nó, nên đừng kỳ vọng một hành trình dài trên sông.",
    tags: ["mo-ta", "di-chuyen-bang-thuyen", "diem-check-in"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-ruong-bac-thang-hoang-su-phi",
    domain: "attraction",
    entityType: "landmark",
    entityId: "ruong-bac-thang-hoang-su-phi",
    title: "Ruộng bậc thang Hoàng Su Phì trông như thế nào",
    content:
      "Ruộng bậc thang Hoàng Su Phì không tập trung ở một chỗ mà rải trên nhiều sườn núi thuộc " +
      "nhiều xã, nên nói tới nó là nói tới một vùng cảnh quan chứ không phải một điểm ngắm. Đặc " +
      "trưng của ruộng ở đây là độ dốc: các thửa mỏng và hẹp, bám theo đường đồng mức từ gần đáy " +
      "thung lũng leo lên tới sát đỉnh núi, có nơi xếp thành hàng trăm bậc chồng lên nhau trên cùng " +
      "một sườn. Nhìn từ sườn đối diện, cả quả núi trông như bị khắc thành những đường vân song " +
      "song uốn lượn, và điều gây choáng là quy mô của công sức bỏ ra chứ không phải sự hùng vĩ của " +
      "địa hình. Cảnh đổi màu rất mạnh theo chu kỳ canh tác: mùa đổ nước thì các thửa thành những " +
      "tấm gương hắt trời, giữa vụ thì xanh kín, tới kỳ chín thì cả sườn núi chuyển vàng rồi bị gặt " +
      "loang lổ chỉ trong ít ngày. Vì vậy cùng một chỗ đứng có thể cho hai bức ảnh không liên quan " +
      "gì tới nhau, và việc chọn thời điểm ở đây quan trọng hơn việc chọn chỗ đứng. Đường tới các " +
      "sườn ruộng đẹp thường hẹp và dốc, có đoạn phải đi bộ.",
    tags: ["mo-ta", "ruong-bac-thang", "nhanh-phia-tay", "di-tich-quoc-gia"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-thac-tien-deo-gio",
    domain: "attraction",
    entityType: "landmark",
    entityId: "thac-tien-deo-gio",
    title: "Thác Tiên và đèo Gió trông như thế nào",
    content:
      "Thác Tiên nằm trong khu rừng trên đèo Gió thuộc vùng Xín Mần, và điểm đáng nói nhất của nơi " +
      "này là mảng rừng già còn giữ được quanh thác. Lối vào là đường mòn đi dưới tán cây lớn, ẩm " +
      "và mát quanh năm, với rêu phủ trên đá và trên gốc cây — một kiểu cảnh rừng mà phần còn lại " +
      "của hành trình Hà Giang hầu như không có. Thác đổ xuống thành dải nước chia làm hai nhánh " +
      "song song, và tên gọi dân gian gắn với hình ảnh đó. Vì nằm ở nhánh tây xa xôi nên nơi này " +
      "rất vắng, hàng quán gần như không có, và phần lớn thời gian khách sẽ ở đó một mình. Đèo Gió " +
      "trên đường tới thác đúng như tên: đoạn qua yên đèo lộng gió và nhiệt độ thấp hơn hẳn thung " +
      "lũng phía dưới. Người viết không nắm được nơi này ở mức chi tiết, nên với câu hỏi cụ thể về " +
      "lối đi hay dịch vụ tại chỗ thì nên nói rõ là chưa có dữ liệu.",
    tags: ["mo-ta", "thac-nuoc", "nhanh-phia-tay", "it-khach", "du-lieu-so-luoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // ---------------------------------------------------------------------------------------------
  // ĐIỂM NGẮM CẢNH
  //
  // Mô tả điểm ngắm phải trả lời hai câu mà mô tả địa danh không trả lời được: đứng ở đó thì NHÌN
  // THẤY gì, và ĐẾN ĐƯỢC bằng cách nào. Nếu một tài liệu ở khối này lại đi tả bản thân ngọn núi
  // hay con sông thì nó trùng với tài liệu của thực thể cha, và khi truy hồi hai đoạn gần giống
  // nhau sẽ cùng lọt vào top-k — đúng cái lãng phí mà ràng buộc một-tài-liệu-một-thực-thể muốn
  // tránh.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "mo-ta-diem-ngam-bac-sum",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "diem-ngam-bac-sum",
    title: "Đứng ở điểm dừng đỉnh dốc Bắc Sum nhìn thấy gì",
    content:
      "Điểm dừng nằm ở phần trên của dốc Bắc Sum, là một khoảnh lề rộng ra đủ để tấp xe vào mà " +
      "không cản đường. Hướng nhìn chính là ngoảnh lại phía sau: cả con dốc vừa leo hiện ra bên " +
      "dưới với những khúc cua vắt qua vắt lại trên sườn núi trọc, và xa hơn là thung lũng dẫn về " +
      "phía thành phố. Vì sườn núi ở đây ít cây nên tầm nhìn thoáng và không bị che ở bất kỳ mùa " +
      "nào, trừ khi có sương. Đây là chỗ dừng đầu tiên mà phần lớn đoàn thực hiện sau khi rời thành " +
      "phố, thường là để mặc thêm áo và để nhìn lại quãng đường đã đi. Chỗ đỗ nằm ngay sát mặt " +
      "đường có xe tải lên xuống, nên đứng chụp cần để ý phía sau lưng.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-dung-nghi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-dai-quan-sat-cong-troi-quan-ba",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dai-quan-sat-cong-troi-quan-ba",
    title: "Đứng ở đài quan sát Cổng Trời Quản Bạ nhìn thấy gì",
    content:
      "Đài quan sát được xây trên mỏm cao ngay cạnh Cổng Trời, và đây là câu trả lời thực tế cho " +
      "câu hỏi đứng ở đâu để ngắm Núi Đôi. Từ trên sàn quan sát, cả thung lũng Tam Sơn nằm gọn " +
      "trong tầm mắt: ruộng chia ô, thị trấn ở giữa, con đường ngoằn ngoèo dẫn xuống, và hai quả " +
      "đồi tròn của Núi Đôi nằm ở rìa phải khung nhìn. Đây là góc duy nhất trong vùng cho thấy được " +
      "quan hệ giữa các thành phần đó với nhau, và cũng vì thế mà hầu hết ảnh chụp Quản Bạ đều được " +
      "chụp từ đây. Muốn lên tới sàn phải leo một đoạn bậc thang ngắn từ bãi đỗ xe, không mất nhiều " +
      "sức nhưng cũng không phải chỗ dừng chân rồi chụp ngay từ trên yên xe. Gió trên này mạnh và " +
      "lạnh hơn dưới bãi đỗ, còn buổi sáng sớm thì thung lũng hay có sương phủ khiến tầm nhìn bị " +
      "che hoàn toàn, nên giữa buổi sáng trở đi thường ăn chắc hơn.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-check-in", "co-thu-ve"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-chan-thac-du-gia",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "chan-thac-du-gia",
    title: "Đứng ở chân thác Du Già nhìn thấy gì",
    content:
      "Chân thác là vũng nước nằm dưới bậc đổ cuối cùng, và phải đi bộ theo một đường mòn trong " +
      "rừng mới xuống tới nơi. Ở dưới này khung nhìn khép lại: chỉ còn vách đá ướt, tán cây phía " +
      "trên và dải nước đổ xuống ngay trước mặt, khác hẳn cảm giác nhìn thác từ trên đường. Vũng " +
      "nước đủ sâu để bơi vào mùa nước vừa, đáy nhiều đá và trơn, còn nước thì lạnh hơn nhiều so " +
      "với nhiệt độ không khí trong thung lũng. Đây là lý do chính khiến khách ở lại Du Già thêm " +
      "một đêm, và cũng là chỗ mà buổi chiều thường có người tắm. Cần tính cả thời gian đi lẫn về " +
      "khi xếp lịch, vì đoạn đường mòn tuy ngắn nhưng dốc và trơn sau mưa. Vào giữa mùa mưa thì " +
      "nước xiết và đục, lúc đó xuống tắm là không nên.",
    tags: ["mo-ta", "diem-ngam-canh", "leo-bo", "trekking", "duong-ve"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-dinh-doc-tham-ma",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-doc-tham-ma",
    title: "Đứng ở đỉnh dốc Thẩm Mã nhìn thấy gì",
    content:
      "Đỉnh dốc Thẩm Mã có một bãi đất rộng bên lề, đủ chỗ cho cả xe khách dừng, và đây là điểm " +
      "ngắm chính của con dốc. Nhìn ngược xuống, toàn bộ chuỗi khúc cua trải ra bên dưới thành " +
      "những vệt đường xếp lớp trên sườn núi, với thung lũng và các nương ngô làm nền phía xa. Bố " +
      "cục ở đây rất rõ ràng nên ảnh chụp từ điểm này gần như luôn ra hình, kể cả khi trời không " +
      "đẹp. Đây cũng là chỗ mà khách gặp trẻ em địa phương mang gùi hoa tới mời chụp ảnh cùng; đó " +
      "là một phần thực tế của nơi này và nên được nói trước để mỗi người tự quyết định cách ứng " +
      "xử. Bãi dừng nằm ngay khúc cua nên xe từ dưới lên xuất hiện khá đột ngột, cần đỗ hẳn vào " +
      "trong thay vì đứng sát mép đường để lấy góc.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-check-in"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-dinh-doc-chin-khoanh",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-doc-chin-khoanh",
    title: "Đứng ở đỉnh dốc Chín Khoanh nhìn thấy gì",
    content:
      "Điểm dừng ở đỉnh Chín Khoanh cho một góc nhìn dọc xuống chuỗi khúc cua cuộn lại bên dưới, " +
      "chặt hơn và dựng hơn so với góc thoáng ở Thẩm Mã. Phía dưới là thung lũng với nương ngô, " +
      "tường đá xếp quanh nương và vài mái nhà nằm rải; phía sau lưng là mặt cao nguyên mở dần ra " +
      "hướng Sủng Là. Vì hai bên đều là sườn dốc trọc nên không có gì che tầm mắt, và độ chênh giữa " +
      "chỗ đứng với đáy thung lũng cảm nhận được ngay chứ không cần nhìn bản đồ. Bãi dừng ở đây nhỏ " +
      "hơn Thẩm Mã và nằm sát mép đường, chỉ vừa vài xe máy, nên nhóm đông cần dồn xe gọn lại. Đây " +
      "là điểm hay bị bỏ qua vì nằm gần Thẩm Mã và nhiều người nghĩ hai chỗ giống nhau, trong khi " +
      "thực tế góc nhìn của chúng khác hẳn.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-check-in"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-dinh-lung-cu",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "dinh-lung-cu",
    title: "Đứng trên đỉnh cột cờ Lũng Cú nhìn thấy gì",
    content:
      "Đây là lan can quan sát chạy quanh phần trên của thân cột cờ, không phải chân cột, và muốn " +
      "lên được thì sau khi leo hết bậc đá ngoài trời còn phải đi tiếp một cầu thang xoắn hẹp bên " +
      "trong lòng cột. Lối thang trong đó tối, dốc và chỉ đủ một người, nên vào lúc đông khách thì " +
      "phải xếp hàng và chờ lượt xuống. Bù lại, từ trên lan can tầm nhìn mở ra bốn phía không bị " +
      "vướng: nương ngô và bản làng của vùng đất cực bắc trải bên dưới, hai hồ nước nhỏ dưới chân " +
      "núi Rồng hiện rõ, và về phía bắc thấy được dải đồi bên kia đường biên. Gió trên này rất " +
      "mạnh, mạnh hơn hẳn ở chân cột, và ngay trên đầu là lá cờ lớn đập liên hồi. Đây là chỗ không " +
      "hợp với người sợ độ cao hoặc người ngại không gian hẹp, và cũng không có cách nào lên bằng " +
      "thang máy — điều đáng nói trước với đoàn có người lớn tuổi.",
    tags: ["mo-ta", "diem-ngam-canh", "leo-bo", "co-thu-ve"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-diem-ngam-ma-pi-leng",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "diem-ngam-ma-pi-leng",
    title: "Đứng ở điểm dừng ngắm Mã Pí Lèng nhìn thấy gì",
    content:
      "Đây là bãi dừng chính thức trên đèo, một khoảnh sân rộng có tượng đài tưởng niệm thanh niên " +
      "xung phong và chỗ đỗ đủ cho cả ô tô lẫn xe giường nằm. Từ lan can, tầm nhìn mở ra theo chiều " +
      "dọc của hẻm vực: vách đá dựng ở cả hai bên, con đường vắt ngang sườn núi phía trước, và dưới " +
      "sâu là dòng Nho Quế xanh ngọc. Đây là góc nhìn dễ tiếp cận nhất trên toàn tuyến, và cũng vì " +
      "vậy mà nó là chỗ đông người nhất, nhất là vào buổi trưa khi các đoàn xe lớn tới cùng lúc. " +
      "Xung quanh có vài hàng nước và chỗ ngồi, nên nó vừa là điểm ngắm vừa là chỗ nghỉ giữa chặng. " +
      "Ai đi ô tô hoặc đi cùng người không leo trèo được thì đây là điểm ngắm Mã Pí Lèng khả thi " +
      "duy nhất, và điều đó đáng nói rõ vì hai điểm còn lại trên đèo đều đòi hỏi đi bộ hoặc xe máy.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-dung-nghi", "xe-o-to-vao-duoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-vach-da-trang-ma-pi-leng",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "vach-da-trang-ma-pi-leng",
    title: "Đi đường vách đá trắng Mã Pí Lèng thấy gì",
    content:
      "Đây không phải một chỗ dừng xe mà là một lối mòn men theo vách núi, và phải đi bộ hết lượt " +
      "đi lẫn lượt về mới trải nghiệm được. Lối đi bám vào mặt vách ở lưng chừng, một bên là đá " +
      "dựng sát vai, bên kia là vực mở thẳng xuống hẻm sông mà suốt tuyến gần như không có lan can " +
      "hay bất cứ thứ gì chắn. Đổi lại, đây là góc nhìn liên tục chứ không phải một khung hình cố " +
      "định: càng đi thì hẻm vực càng mở ra theo hướng khác, và có những đoạn nhìn được cả dải Mã " +
      "Pí Lèng phía sau lẫn dòng sông phía dưới trong cùng một tầm mắt. Mặt đường mòn nhiều chỗ hẹp " +
      "và có đá dăm, trơn khi ẩm, còn gió tạt ngang thì mạnh. Cần chuẩn bị giày bám, nước uống và " +
      "quan trọng nhất là đủ thời gian, vì quay đầu giữa chừng khi trời sắp tối là tình huống hay " +
      "gặp. Người sợ độ cao và trẻ nhỏ thì không nên đi tuyến này.",
    tags: ["mo-ta", "diem-ngam-canh", "leo-bo", "khong-hop-nguoi-so-do-cao"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-mom-da-tu-san",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "mom-da-tu-san",
    title: "Đứng ở mỏm đá ngắm hẻm Tu Sản nhìn thấy gì",
    content:
      "Mỏm đá này nhô ra khỏi sườn núi trên nhánh đường thấp của Mã Pí Lèng, và nó là chỗ đứng cho " +
      "góc nhìn thẳng xuống hẻm Tu Sản mà ai cũng đã thấy trong ảnh. Từ trên mỏm, hai vách đá của " +
      "hẻm vực khép lại ngay phía dưới và dòng Nho Quế hiện ra như một vệt xanh nằm giữa, còn xung " +
      "quanh không có gì che nên cảm giác chênh vênh là có thật chứ không phải hiệu ứng của ống " +
      "kính. Đây là kiểu điểm ngắm mà bản thân chỗ đứng hẹp: mặt mỏm chỉ vừa vài người, không lan " +
      "can, và mép đá thì nhẵn. Đường tới đây rẽ khỏi tuyến chính và là đường nhỏ, xấu, nhiều đoạn " +
      "chỉ hợp xe máy hoặc phải gửi xe rồi đi bộ một quãng. Vì tất cả những lý do đó, đây là điểm " +
      "cần được gợi ý một cách có điều kiện chứ không phải gợi ý mặc định cho mọi đoàn.",
    tags: ["mo-ta", "diem-ngam-canh", "diem-check-in", "duong-kho", "phu-hop-xe-may"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-ben-thuyen-ta-lang",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "ben-thuyen-ta-lang",
    title: "Xuống bến thuyền Tà Làng thấy gì",
    content:
      "Bến Tà Làng nằm dưới đáy khe, sát mặt nước sông Nho Quế, và điều đầu tiên phải nói về nó là " +
      "đường xuống. Con dốc dẫn xuống bến đổ liên tục theo sườn núi, mặt đường xấu, nhiều đoạn cua " +
      "gấp và hẹp, nên đây là quãng khiến nhiều người lái xe máy căng thẳng nhất trong cả chuyến; " +
      "chiều lên còn nặng hơn chiều xuống. Tới nơi thì khung cảnh đổi hoàn toàn so với trên đèo: " +
      "đứng ở mép nước nhìn lên chỉ thấy hai bờ vách đá dựng cao vút và một dải trời hẹp phía trên, " +
      "và tỷ lệ giữa người với vách đá lúc này rõ hơn mọi góc nhìn từ trên xuống. Không khí dưới " +
      "đáy khe mát và lặng gió hơn hẳn, mặt nước thường phẳng. Bến là nơi xuất phát của các chuyến " +
      "thuyền vào hẻm Tu Sản, nên phần lớn thời gian ở đây là thời gian chờ và lên xuống thuyền chứ " +
      "không phải ngắm cảnh tại chỗ.",
    tags: ["mo-ta", "di-chuyen-bang-thuyen", "duong-kho", "can-xac-minh-places"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "mo-ta-diem-ngam-ban-phung",
    domain: "attraction",
    entityType: "scenic_view",
    entityId: "diem-ngam-ban-phung",
    title: "Đứng ở điểm ngắm Bản Phùng nhìn thấy gì",
    content:
      "Điểm ngắm Bản Phùng là một khoảnh sườn núi nhìn sang những thửa ruộng bậc thang dựng đứng " +
      "bậc nhất của Hoàng Su Phì. Ruộng ở đây leo gần như kín cả mặt núi đối diện, các thửa mảnh và " +
      "sát nhau, nên khi nhìn sang thì thấy hàng loạt đường vân uốn theo đường đồng mức chồng lên " +
      "nhau từ chân lên tới sát đỉnh. Xen giữa ruộng là những nếp nhà đơn lẻ nằm rải, và chính " +
      "chúng cho thấy quy mô thật của sườn ruộng khi so sánh kích thước. Đường tới đây từ trung tâm " +
      "vùng khá xa và xấu, đi mất nhiều thời gian hơn khách hình dung, nên chỗ này chỉ hợp với " +
      "người đã chủ đích dành hẳn thời gian cho ruộng bậc thang. Vào kỳ lúa chín thì đây là một " +
      "trong những sườn được nhắc tới nhiều nhất, còn ngoài kỳ đó thì cảnh vẫn có nhưng không còn " +
      "màu.",
    tags: ["mo-ta", "diem-ngam-canh", "ruong-bac-thang", "nhanh-phia-tay", "duong-kho"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
