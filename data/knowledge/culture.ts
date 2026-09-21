/**
 * MẶT "VĂN HOÁ" CỦA KHO TRI THỨC — nói về NGƯỜI ở Hà Giang, không nói về cảnh ở Hà Giang.
 *
 * Ranh giới với @data/places/geography phải giữ đúng như chú thích của `KnowledgeSourceDoc` đã
 * đặt ra. Danh mục trả lời "chợ Đồng Văn ở đâu, họp ngày nào"; file này trả lời "vì sao người ta
 * đi bộ mấy tiếng xuống chợ rồi về mà không mua gì". Hai câu hỏi đó cần hai đường truy hồi khác
 * nhau: câu đầu là tra khoá, câu sau là tìm theo ngữ nghĩa. Chép giờ họp hay toạ độ vào `content`
 * ở đây là tạo ra một bản sao thứ hai của sự thật, và bản sao đó sẽ lạc hậu trước bản gốc.
 *
 * GIỌNG VĂN LÀ RÀNG BUỘC KỸ THUẬT CHỨ KHÔNG PHẢI SỞ THÍCH. Mọi câu trong file này sẽ bị cắt thành
 * đoạn rồi ghép thẳng vào câu trả lời của chatbot, không có ai đọc lại trước khi nó tới tay khách.
 * Một câu viết theo lối kỳ lạ hoá — coi người dân như một phần của phong cảnh, coi tập quán như
 * một thứ bày ra để xem — lúc nằm trong bài dài còn được các câu xung quanh đỡ cho, nhưng khi bị
 * cắt ra đứng một mình thì trần trụi đúng như nó vốn là. Vì vậy quy ước ở đây là viết về người
 * như viết về chủ nhà: có thể mô tả, có thể giải thích, nhưng không trưng bày.
 *
 * VÌ SAO KHÔNG CÓ MỘT CON SỐ TIỀN NÀO TRONG FILE NÀY. Phí vào ruộng hoa, phí trông xe ở điểm dừng,
 * giá một tấm vải lanh dệt tay đều có thật và khách đều hỏi. Nhưng `KnowledgeSourceDoc` không có
 * trường giá, và đó là chủ ý: giá chỉ được phép sống trong `PriceEstimate` ở danh mục, nơi nó buộc
 * phải mang theo cơ sở, ngày khảo sát và nguồn. Một con số trần nằm giữa đoạn văn RAG thì không
 * truy ngược được về đâu cả, mà lại được model trích ra với đúng giọng chắc nịch như mọi câu khác.
 * Nên ở đây chỉ viết "có thu phí" và để tầng giá lo phần còn lại.
 *
 * VÌ SAO TOÀN BỘ `sourceClass` LÀ "editorial". Đây là tri thức người trong dự án viết và chịu
 * trách nhiệm, không phải bản chắt lọc từ một trang cụ thể. Gắn nhãn `crawled_verified` kèm một
 * URL mà thực ra không ai đối chiếu câu chữ là nói dối về xuất xứ, và cái giá phải trả không phải
 * là một dòng metadata sai: giai đoạn G xếp hạng độ tin cậy theo trường này, nên một tài liệu
 * mang nhãn cao hơn thực chất sẽ thắng cả những tài liệu có nguồn thật khi hai bên nói khác nhau.
 *
 * QUY ƯỚC `season` CHO NHÓM VĂN HOÁ. Tập quán không đổi theo tháng nên phần lớn tài liệu ở đây là
 * `quanh_nam`, và `quanh_nam` luôn đứng MỘT MÌNH — trộn nó với một mùa cụ thể là vô hiệu hoá bộ
 * lọc, vì tài liệu sẽ khớp cả câu hỏi có tháng lẫn câu hỏi không tháng. Riêng lễ hội tính theo âm
 * lịch thì xem chú thích tại chỗ: bảng `Season` được dựng theo mùa cảnh quan, và có lễ hội rơi
 * vào khoảng trống mà bảng đó không phủ.
 */

import type { KnowledgeSourceDoc } from "./types";

export const CULTURE_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // -----------------------------------------------------------------------------------------------
  // NGƯỜI VÀ ĐẤT
  //
  // Ba tài liệu mở đầu này là nền cho mọi tài liệu còn lại. Thiếu chúng thì các bài về chợ, về
  // nghề, về lễ hội đều treo lơ lửng: khách đọc xong biết có một phiên chợ họp ngày Chủ nhật mà
  // không biết ai xuống chợ và họ xuống từ đâu.
  // -----------------------------------------------------------------------------------------------
  {
    slug: "van-hoa-thanh-phan-dan-toc-ha-giang",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Các dân tộc ở Hà Giang và cách họ chia nhau độ cao",
    // Bài này cố tình không có một tỷ lệ phần trăm nào. Số liệu thành phần dân tộc thay đổi theo
    // từng kỳ điều tra và lại càng khó dẫn sau khi địa giới được sắp xếp lại năm 2025; viết một
    // con số không có nguồn vào đây thì nó sẽ được trích như số liệu thống kê. Cái mà khách thực
    // sự dùng được không phải tỷ lệ, mà là quy luật cư trú theo độ cao — nó giải thích vì sao đi
    // một ngày trên cùng một cung đường lại gặp mấy nếp sống khác nhau.
    content:
      "Hà Giang là nơi cư trú lâu đời của gần hai chục dân tộc, trong đó người Mông đông hơn cả, " +
      "rồi đến người Tày, người Dao, người Nùng, người Giáy, cùng những dân tộc rất ít người như " +
      "Lô Lô, Pu Péo, Cờ Lao, La Chí. Cách họ phân bố không ngẫu nhiên mà đi theo độ cao và theo " +
      "nguồn nước. Người Tày, người Nùng và người Giáy ở các thung lũng bằng phẳng ven sông suối, " +
      "làm ruộng nước, dựng nhà sàn gỗ; người Dao ở lưng chừng núi; còn người Mông ở những nơi cao " +
      "nhất và khô nhất, trên chính vùng cao nguyên đá mà khách đi qua. Người Lô Lô tập trung ở " +
      "vùng Lũng Cú và Mèo Vạc, còn ruộng bậc thang phía Hoàng Su Phì phần lớn là công của người " +
      "La Chí, người Dao và người Nùng. Biết được nếp phân bố này thì hiểu ngay vì sao nhà cửa, " +
      "ruộng nương và cả món ăn đổi khác chỉ sau vài chục cây số đường đèo, và cũng tránh được " +
      "cách nói gộp tất cả thành 'người dân tộc' — một cách gọi vừa thiếu chính xác vừa xoá mất " +
      "chính điều làm vùng này đáng đi.",
    tags: ["dan-toc", "tong-quan-van-hoa", "nguoi-mong", "nguoi-dao", "nguoi-tay", "nguoi-lo-lo"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-tho-canh-hoc-da-nguoi-mong",
    domain: "destination",
    // `entityType` ở đây là "landmark" chứ không phải "cultural_site", dù nội dung là văn hoá.
    // Trường này phải soi đúng loại của thực thể trong danh mục, vì bộ lọc metadata ghép
    // `entityType` với `entityId`: cao nguyên đá được khai là `landmark` ở geography.ts, nên khai
    // "cultural_site" tại đây sẽ tạo ra một cặp không bao giờ khớp, và bài này lặng lẽ biến mất.
    entityType: "landmark",
    entityId: "cao-nguyen-da-dong-van",
    title: "Thổ canh hốc đá: người Mông trồng ngô trên một cao nguyên không có đất",
    content:
      "Cao nguyên đá là đá vôi, nghĩa là mặt đất gần như không giữ được đất trồng và nước mưa rơi " +
      "xuống thì tụt thẳng vào lòng núi. Cách người Mông sống được ở đây là thổ canh hốc đá: tìm " +
      "những hốc giữa các chóp đá tai mèo, gùi đất từ nơi khác tới đổ vào, xếp đá vòng quanh miệng " +
      "hốc để mưa không cuốn đất đi, rồi tra ngô vào từng hốc một. Một nương ngô như vậy không " +
      "phải một thửa liền mà là hàng trăm hốc rời rạc, và mỗi vụ lại phải gùi đất bù cho phần đã " +
      "trôi. Vì lúa nước gần như không trồng được nên ngô mới là lương thực chính, và mèn mén — " +
      "ngô xay nhỏ rồi đồ chín — mới là bữa cơm hằng ngày chứ không phải một món lạ dọn cho khách. " +
      "Nước cũng phải trữ chứ không có sẵn, đó là lý do trên các sườn núi có những hồ treo xây để " +
      "hứng nước mưa cho cả thôn dùng qua mùa khô. Khi đã nhìn thấy một hốc đá có mấy cây ngô mọc " +
      "trong đó thì cả cao nguyên này hiện ra khác hẳn: những gì trông như phong cảnh hoang sơ " +
      "thực ra là một vùng đã được canh tác từng mét một, bằng tay, qua nhiều đời.",
    tags: ["nguoi-mong", "canh-tac", "cao-nguyen-da", "am-thuc-ban-dia"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-nha-trinh-tuong-va-hang-rao-da",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Nhà trình tường, mái ngói âm dương và hàng rào đá xếp khan",
    content:
      "Ngôi nhà đặc trưng của người Mông và người Dao trên cao nguyên đá là nhà trình tường: đất " +
      "được đổ vào giữa hai tấm ván khuôn rồi nện chặt từng lớp cho tới khi thành bức tường dày " +
      "vài gang tay, phơi nắng cho khô rồi tháo khuôn dịch lên làm lớp tiếp theo. Bức tường dày ấy " +
      "giữ cho trong nhà mát vào mùa hè và ấm vào những đợt rét mà ngoài trời có sương muối, thứ " +
      "mà tường gạch mỏng không làm được. Mái thường lợp ngói âm dương, hai hàng ngói úp ngửa cài " +
      "vào nhau không cần vữa. Quanh nhà là hàng rào đá xếp khan, tức đá được chọn và kê vào nhau " +
      "sao cho tự chèn lấy nhau, hoàn toàn không có xi măng; hàng rào ấy vừa dọn đá khỏi nương vừa " +
      "giữ gia súc, và nó đứng được nhiều chục năm nhờ tay người xếp chứ không nhờ chất kết dính. " +
      "Bên trong, vách giữa của gian chính là nơi đặt bàn thờ và cột thiêng của gia đình — chi " +
      "tiết này quan trọng với khách hơn cả kiến trúc, vì nó là chỗ tuyệt đối không được treo đồ, " +
      "dựa ba lô hay đứng chụp ảnh.",
    tags: ["kien-truc-ban-dia", "nha-trinh-tuong", "nguoi-mong", "nguoi-dao"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // -----------------------------------------------------------------------------------------------
  // CHỢ PHIÊN
  //
  // Nhóm này tách thành một bài tổng quan rồi mới tới từng phiên chợ, thay vì nhồi tất cả vào một
  // bài dài. Lý do nằm ở bước cắt đoạn: một bài gộp bốn phiên chợ khi bị chunk sẽ cho ra những
  // đoạn nửa nói chợ Đồng Văn nửa nói chợ Khâu Vai, và câu trả lời về một phiên chợ sẽ kéo theo
  // chi tiết của phiên chợ khác. Tách theo `entityId` thì mỗi đoạn còn nguyên một chủ thể.
  // -----------------------------------------------------------------------------------------------
  {
    slug: "van-hoa-cho-phien-vung-cao-la-gi",
    domain: "attraction",
    entityType: "region",
    entityId: "ha-giang",
    title: "Chợ phiên vùng cao là cuộc hẹn của cả vùng, không chỉ là chỗ mua bán",
    // Đây là bài chống hiểu lầm phổ biến nhất trong cả nhóm văn hoá. Khách quen với chợ ở đồng
    // bằng sẽ xếp chợ phiên vào ô "tham quan ba mươi phút, chụp vài kiểu rồi đi", và lịch trình
    // dựng theo cách hiểu đó sẽ hỏng đúng phần đáng giá nhất của buổi sáng hôm ấy.
    content:
      "Chợ phiên ở vùng cao không họp theo thứ trong tuần mà nhiều phiên họp theo ngày con giáp, " +
      "nên lịch chợ trôi so với lịch dương và phải tra lại cho đúng tuần mình đi. Nhưng điều đáng " +
      "nói hơn lịch là chức năng của nó. Người ở các thôn xa đi bộ hoặc đi xe máy từ tờ mờ sáng " +
      "xuống chợ, mặc bộ đồ đẹp nhất, và phần lớn thời gian ở chợ là để gặp nhau: hỏi thăm họ " +
      "hàng, uống với nhau bát rượu ngô bên nồi thắng cố, để đám thanh niên nhìn thấy nhau. Có " +
      "người xuống chợ cả buổi mà không mua gì, và điều đó hoàn toàn bình thường. Vì vậy chợ tan " +
      "sớm — phần đông vui nhất thường nằm trong khoảng vài tiếng đầu buổi sáng, tới trưa thì hàng " +
      "quán dọn dần và người ta về để kịp đường núi. Khách muốn thấy đúng một phiên chợ thì phải " +
      "đến sớm và phải chấp nhận đi chậm trong đó; ghé lúc mười một giờ rồi kết luận chợ vắng là " +
      "đã bỏ lỡ chính cái mình đi tìm.",
    tags: ["cho-phien", "nhip-song", "tong-quan-van-hoa"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-cho-phien-dong-van",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "cho-phien-dong-van",
    title: "Chợ phiên Đồng Văn trong khu chợ đá cũ",
    content:
      "Phiên chính của chợ Đồng Văn họp sáng Chủ nhật, ngay trong khu nhà chợ xây bằng đá từ thời " +
      "Pháp nằm sát phố cổ, nên đây là một trong số ít phiên chợ mà bản thân cái chợ cũng là công " +
      "trình đáng xem. Người từ các xã quanh vùng đổ về từ sớm, hàng bày thành từng khu rõ rệt: " +
      "một góc là rau củ và giống cây, một góc là vải vóc, kim chỉ và váy áo, một góc là nông cụ " +
      "và đồ rèn, còn phía ngoài là các quầy ăn với chảo thắng cố và can rượu ngô. Người bán phần " +
      "lớn là phụ nữ Mông, Tày, Giáy ở gần đó, mang đúng số hàng mình làm ra được trong tuần chứ " +
      "không phải hàng nhập về bán buôn. Muốn thấy chợ lúc còn đủ người thì nên có mặt trong " +
      "khoảng thời gian đầu buổi sáng; càng về trưa thì hàng vãn và phần nhộn nhịp chỉ còn ở mấy " +
      "quầy ăn. Vào chợ nên đi chậm và nhường lối, vì lối đi giữa các sạp rất hẹp và người ta còn " +
      "phải khiêng hàng qua.",
    tags: ["cho-phien", "dong-van", "am-thuc-ban-dia"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-cho-bo-meo-vac",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "cho-phien-meo-vac",
    title: "Chợ bò Mèo Vạc và cách xem một phiên chợ gia súc mà không cản đường ai",
    // Nhấn vào chỗ đứng và vào con bò như một tài sản, thay vì tả cảnh nhộn nhịp. Đây là phiên chợ
    // mà khách dễ gây phiền nhất: người ta đang giao dịch bằng cả gia sản của gia đình, còn khách
    // thì đứng giữa lối dắt bò để chụp ảnh.
    content:
      "Khu chợ bò của Mèo Vạc nhóm sớm hơn hẳn phần còn lại của phiên chợ, từ lúc trời còn chưa " +
      "sáng, vì nhiều người phải dắt bò đi bộ từ đêm hôm trước mới kịp. Với các gia đình ở đây một " +
      "con bò là tài sản lớn, thường là khoản tích luỹ nhiều năm, nên việc mua bán diễn ra rất kỹ: " +
      "người mua xem răng đoán tuổi, xem chân, xem lưng, đi vòng quanh con bò nhiều lượt rồi mới " +
      "ngã giá, và cuộc ngã giá đó có thể kéo dài. Với khách, đây là phần đáng xem nhất của buổi " +
      "sáng Chủ nhật ở Mèo Vạc, nhưng cũng là nơi cần đứng đúng chỗ nhất: nên đứng ngoài rìa bãi, " +
      "không len vào giữa các con bò đang buộc, không đứng chắn lối dắt bò ra vào, và tuyệt đối " +
      "không lại gần phía sau con vật. Bò ở đây không quen người lạ và một cú đá hay một cú giật " +
      "dây trong đám đông đủ gây thương tích cho cả người lẫn vật.",
    tags: ["cho-phien", "meo-vac", "an-toan", "cho-gia-suc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-cho-lui-lung-phin",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "cho-lui-lung-phin",
    title: "Chợ lùi Lũng Phìn: vì sao ngày họp trôi dần và vì sao dễ đi trượt",
    // Bài này cố tình không nêu ngày họp cụ thể, cùng lý do đã ghi ở `openingHours` của thực thể
    // trong geography.ts: bất kỳ ngày nào viết cứng vào văn bản cũng sẽ sai sau vài tuần, mà văn
    // bản RAG thì không có ai rà lại định kỳ như dữ liệu có cấu trúc.
    content:
      "Lũng Phìn họp chợ lùi, nghĩa là mỗi phiên lại lùi lại một ngày so với phiên trước thay vì " +
      "cố định vào một thứ trong tuần, nên ngày họp cứ trôi dần qua các tuần và một lịch chép lại " +
      "từ năm ngoái thì chắc chắn sai. Cách duy nhất chắc chắn là hỏi người địa phương hoặc chủ " +
      "nhà nghỉ ngay trong tuần mình đi, chứ không phải tra một bài viết cũ. Đổi lại công tra " +
      "lịch, đây là phiên chợ còn giữ được nhịp cũ hơn hẳn Đồng Văn hay Mèo Vạc vì nằm xa tuyến " +
      "khách chính và ít bị du lịch chạm vào: hàng bán vẫn chủ yếu là thứ người trong vùng cần " +
      "dùng, và người đi chợ vẫn đi chợ chứ không đi ngang qua ống kính. Chợ nhóm từ tờ mờ sáng và " +
      "tan trước trưa, sớm hơn cảm giác thông thường của khách, nên đến muộn là gần như không còn " +
      "gì để xem.",
    tags: ["cho-phien", "cho-lui", "yen-minh", "it-khach-du-lich"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-cho-tinh-khau-vai",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "cho-tinh-khau-vai",
    title: "Chợ tình Khâu Vai: một phiên mỗi năm và cách gọi tên cho đúng",
    // `season` để `quanh_nam` là một lựa chọn có chủ ý và cần giải thích, vì nhìn qua thì nó trái
    // với bản chất một phiên chợ mỗi năm chỉ họp một lần. Ngày 27 tháng Ba âm lịch rơi vào quãng
    // cuối tháng Tư đầu tháng Năm dương lịch, mà bảng `Season` được dựng theo mùa cảnh quan nên
    // không có ô nào phủ quãng đó. Gán bừa `hoa_dao_man` cho gần đúng sẽ khiến câu hỏi "tháng Hai
    // đi Hà Giang có gì" lôi ra một phiên chợ còn cách đó hơn hai tháng, tức là sai theo cách khó
    // phát hiện. Ngày họp thật nằm ở `openingHours` của thực thể, nơi nó được quy đổi tại thời
    // điểm hỏi thay vì bị đóng băng trong văn bản.
    content:
      "Chợ tình Khâu Vai mỗi năm chỉ họp một phiên, vào ngày 27 tháng Ba âm lịch, nên ngày dương " +
      "lịch xê dịch theo từng năm và phải quy đổi lại trước khi xếp lịch. Gốc của phiên chợ này " +
      "không phải là một chỗ tìm bạn tình như cách gọi tắt vẫn khiến người ta hiểu nhầm, mà là " +
      "ngày những người từng thương nhau nhưng không nên duyên được phép gặp lại nhau một lần " +
      "trong năm, gặp trong sự biết và sự chấp nhận của gia đình hai bên, rồi hôm sau ai về nhà " +
      "nấy. Ở Khâu Vai có miếu Ông và miếu Bà gắn với sự tích ấy, và người ta tới thắp hương trước " +
      "khi xuống chợ. Ngày nay phiên chợ đã thành một lễ hội lớn có sân khấu, có khách thập phương " +
      "và có cả hàng quán, còn phần nguyên bản thì chủ yếu nằm ở lớp người lớn tuổi và nằm ngoài " +
      "khu vực sân khấu. Khách đến nên biết trước điều đó để không đi tìm một thứ đã khác, và nhất " +
      "là không biến những cuộc gặp riêng tư của người khác thành đề tài chụp ảnh.",
    tags: ["cho-phien", "le-hoi", "khau-vai", "ung-xu"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // -----------------------------------------------------------------------------------------------
  // NGHỀ, NHẠC VÀ LỄ HỘI
  //
  // Ba mặt này gộp thành một khối vì chúng chung một rủi ro khi viết: đều dễ bị kể như tiết mục
  // biểu diễn dành cho khách. Mỗi bài dưới đây vì thế đều nói rõ thứ đó dùng vào việc gì trong
  // đời sống thật trước khi nói khách xem được ở đâu.
  // -----------------------------------------------------------------------------------------------
  {
    slug: "van-hoa-det-lanh-lung-tam",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "lang-det-lanh-lung-tam",
    title: "Nghề dệt lanh Lùng Tám: từ cây lanh tới tấm vải nhuộm chàm",
    content:
      "Vải lanh của người Mông đi qua một chuỗi việc dài tới mức nhìn thành phẩm khó mà đoán ra. " +
      "Cây lanh được trồng, cắt về phơi rồi tước lấy vỏ; sợi vỏ được nối tay thành từng cuộn dài, " +
      "luộc qua nước tro cho mềm và sáng, rồi đem lăn dưới một phiến đá nặng cho tới khi sợi bóng " +
      "và không còn xơ. Dệt xong tấm mộc, người thợ mới dùng bút đồng chấm sáp ong nóng vẽ hoa văn " +
      "lên mặt vải, đem nhuộm chàm nhiều lượt, mỗi lượt lại phơi rồi nhuộm tiếp cho màu ăn sâu; " +
      "cuối cùng nhúng nước nóng cho sáp chảy ra, chỗ có sáp không ăn màu nên hoa văn hiện lên " +
      "trắng trên nền chàm. Cả quá trình cho một tấm vải tính bằng tuần bằng tháng chứ không tính " +
      "bằng buổi, và đó là lý do vải lanh dệt tay không thể rẻ ngang vải in hoa văn tương tự. Ở " +
      "Lùng Tám nghề này được tổ chức thành hợp tác xã do chính phụ nữ trong xã lập ra, nên khách " +
      "vào xem là xem người đang làm việc thật; nếu muốn xem đủ các công đoạn thì nên hỏi trước, " +
      "vì không phải lúc nào cũng có người đang nhuộm hay đang lăn đá.",
    tags: ["lang-nghe", "det-lanh", "nguoi-mong", "quan-ba"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-khen-mong",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Khèn Mông: một nhạc cụ vừa để hội vừa để tang",
    // Bài này tồn tại chủ yếu vì đoạn cuối. Khách gặp tiếng khèn ở đám tang rất dễ tưởng là đang
    // gặp may — một cảnh sinh hoạt hiếm để quay lại — và đó là một trong những cách xúc phạm nặng
    // nhất mà một người khách có thể gây ra mà không hề biết.
    content:
      "Khèn của người Mông là một bó ống trúc cắm vào bầu gỗ, người thổi vừa thổi vừa múa nên nhạc " +
      "và động tác là một, không tách rời được. Con trai Mông học khèn từ nhỏ, và tiếng khèn xuất " +
      "hiện ở gần như mọi việc lớn của đời người: trong hội xuân, trong lúc tỏ tình, khi đi chợ, " +
      "và trong tang lễ. Ở đám tang, bài khèn không phải để nghe cho vui mà để dẫn đường cho người " +
      "đã khuất, và người thổi có thể phải thổi rất lâu. Đây là chỗ khách cần phân biệt cho rõ: " +
      "tiếng khèn trên sân khấu lễ hội hay ở một homestay là phần người ta chủ động mở ra cho " +
      "khách xem, còn tiếng khèn vọng ra từ một ngôi nhà có tang thì không phải. Nếu đi ngang một " +
      "đám tang, cách hành xử đúng là đi chậm, không dừng lại xem, không quay phim và không chụp " +
      "ảnh, kể cả từ xa.",
    tags: ["nguoi-mong", "am-nhac", "khen-mong", "ung-xu"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-le-hoi-gau-tao",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Lễ hội Gầu Tào: lễ của một gia đình mở thành hội của cả vùng",
    content:
      "Gầu Tào là lễ hội đầu năm của người Mông, thường tổ chức trong khoảng nửa đầu tháng Giêng " +
      "âm lịch nên rơi vào quãng cuối tháng Một tới tháng Hai dương lịch tuỳ năm. Điểm đặc biệt " +
      "của nó là gốc gác: đây vốn là lễ tạ của một gia đình hiếm muộn con hoặc có người ốm lâu, " +
      "gia đình ấy đứng ra dựng một cây nêu bằng tre còn nguyên ngọn trên bãi đất rộng và mời cả " +
      "vùng tới. Phần lễ diễn ra quanh cây nêu, xong phần lễ thì thành hội, với múa khèn, hát đối, " +
      "ném pao, đánh yến, kéo co, đẩy gậy và bắn nỏ; cây nêu sau đó được hạ xuống và chia cho gia " +
      "chủ mang về. Vì lễ gắn với việc riêng của một gia đình nên năm nào có nhà đứng ra thì mới " +
      "có hội, và địa điểm thay đổi theo năm — không có một bãi hội cố định để cứ tới mùa là đến. " +
      "Khách muốn gặp Gầu Tào thì phải hỏi tại chỗ trong dịp đầu năm, và nếu gặp thì nên nhớ mình " +
      "đang là người được mời chứ không phải người mua vé.",
    tags: ["le-hoi", "nguoi-mong", "dau-nam", "ung-xu"],
    // Rơi vào quãng cuối tháng Một tới tháng Hai dương lịch nên `hoa_dao_man` là ô phủ đúng nhất
    // trong bảng mùa, và cũng trùng với thứ khách nhìn thấy ngoài đường lúc đó là hoa đào hoa mận.
    season: ["hoa_dao_man"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-trang-phuc-va-hoa-van",
    domain: "destination",
    entityType: "region",
    entityId: "ha-giang",
    title: "Trang phục và hoa văn: đọc được người ta thuộc nhóm nào",
    content:
      "Bộ váy áo ở vùng này không phải trang phục chung của một 'dân tộc thiểu số' mà là dấu hiệu " +
      "khá chính xác về nhóm và về vùng. Người Mông đã chia thành nhiều nhóm với váy áo khác hẳn " +
      "nhau, người Dao mỗi nhánh một kiểu khăn và một lối thêu, còn bộ đồ của người Lô Lô được " +
      "ghép từ hàng trăm miếng vải nhỏ, mỗi bộ là công của nhiều tháng. Hoa văn cũng vậy: những " +
      "hình hình học lặp lại trên váy không phải để trang trí cho đẹp mắt mà là vốn hình của từng " +
      "nhóm, được truyền lại qua tay mẹ dạy con, và được làm bằng ba lối chính là vẽ sáp ong, thêu " +
      "chữ thập và ghép vải. Khách muốn mua thì nên biết rằng phần lớn bộ đồ bày bán ở các điểm " +
      "du lịch là hàng may sẵn in hoa văn từ nơi khác chuyển lên, còn đồ thêu tay thật thì nằm ở " +
      "hợp tác xã, ở chợ phiên và ở chính nhà người làm ra nó — mua đúng chỗ thì tiền về đúng tay " +
      "người bỏ công. Nếu thuê váy áo để chụp ảnh, nên thuê của người địa phương, hỏi cho rõ bộ đó " +
      "mặc dịp nào, và tránh mượn những bộ dùng cho việc tang hay việc lễ.",
    tags: ["trang-phuc", "hoa-van", "nghe-thu-cong", "mua-sam"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // -----------------------------------------------------------------------------------------------
  // HAI BẢN LÀNG ĐANG LÀM DU LỊCH
  //
  // Cả hai đều là nơi có người ở thật chứ không phải làng dựng cho khách, và cả hai bài đều phải
  // nói ra điều đó. Đây cũng là lý do chúng nằm cạnh khối ứng xử ngay bên dưới.
  // -----------------------------------------------------------------------------------------------
  {
    slug: "van-hoa-nguoi-lo-lo-o-lo-lo-chai",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "ban-lo-lo-chai",
    title: "Người Lô Lô ở Lô Lô Chải, một bản vừa là nhà vừa là điểm đến",
    content:
      "Lô Lô là một trong những dân tộc rất ít người của Việt Nam, và Lô Lô Chải dưới chân núi " +
      "Rồng là một trong số ít bản còn giữ được khá nguyên nếp ở của họ: nhà trình tường tường " +
      "đất, mái ngói âm dương, tường rào đá quanh sân. Trong đời sống tín ngưỡng của người Lô Lô, " +
      "trống đồng vẫn giữ vai trò thật chứ không phải hiện vật trưng bày — nó được dùng trong tang " +
      "lễ, được cất giữ cẩn thận và không phải thứ mang ra gõ thử. Vì nằm ngay cạnh cột cờ Lũng Cú " +
      "nên bản này đón khách quanh năm, nhiều nhà đã sửa thành homestay và trong bản có cả quán cà " +
      "phê, nhưng phần lớn những ngôi nhà mà khách đi ngang vẫn chỉ là nhà ở bình thường. Điều đó " +
      "dẫn tới một quy tắc rất đơn giản khi đi trong bản: lối đi giữa các nhà là đường chung, còn " +
      "sân và hiên là của từng nhà, nên muốn vào sân chụp bức tường đất hay cây đào trước cửa thì " +
      "phải hỏi chủ nhà trước.",
    tags: ["nguoi-lo-lo", "lang-van-hoa-du-lich", "lung-cu", "ung-xu"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-nguoi-dao-o-nam-dam",
    domain: "attraction",
    entityType: "cultural_site",
    entityId: "ban-nam-dam",
    title: "Nặm Đăm, làng người Dao và bài thuốc tắm lá",
    content:
      "Nặm Đăm nằm trong thung lũng Quản Bạ và là làng của người Dao, nơi du lịch cộng đồng được " +
      "tổ chức tương đối bài bản: nhiều hộ trong làng cùng làm homestay và cùng chia khách thay vì " +
      "để một vài nhà lấy hết. Nhà ở đây cũng là nhà trình tường lợp ngói, nhưng bố cục và cách " +
      "bài trí bên trong khác nhà người Mông, và chủ nhà thường sẵn lòng giải thích nếu khách hỏi " +
      "một cách tử tế. Thứ đáng thử nhất ở đây không phải một cảnh đẹp mà là bài thuốc tắm lá của " +
      "người Dao: nhiều loại cây thuốc hái trên rừng được nấu lên rồi ngâm trong thùng gỗ, vốn là " +
      "cách người trong vùng phục hồi sau những ngày làm nương lạnh và ẩm. Người có bệnh tim mạch, " +
      "huyết áp hoặc đang mang thai nên hỏi kỹ trước khi ngâm, vì nước rất nóng và ngâm lâu, đó là " +
      "thông tin mà chủ nhà sẽ nói nếu được hỏi nhưng không phải lúc nào cũng chủ động nhắc.",
    tags: ["nguoi-dao", "lang-van-hoa-du-lich", "quan-ba", "tam-la-thuoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // -----------------------------------------------------------------------------------------------
  // ỨNG XỬ
  //
  // Ba tài liệu dưới đây là phần hữu ích nhất của cả nhóm văn hoá và cũng là phần được viết kỹ
  // nhất, vì chúng là loại tri thức mà khách không tự tra được và thường chỉ biết mình cần sau khi
  // đã lỡ. Chúng cố tình được viết dưới dạng "làm thế này, vì nếu làm khác thì hỏng ở chỗ này",
  // chứ không phải một danh sách điều cấm — một đoạn văn bị cắt ra khỏi danh sách điều cấm thì chỉ
  // còn là một mệnh lệnh cụt lủn không có lý do, và model sẽ trả nó ra đúng như vậy.
  // -----------------------------------------------------------------------------------------------
  {
    slug: "van-hoa-ung-xu-khi-vao-ban-vao-nha",
    domain: "destination",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Ứng xử khi vào bản và khi được mời vào nhà",
    content:
      "Điều cần nhớ trước tiên là một bản không phải khu tham quan: con đường chạy giữa các nếp " +
      "nhà là lối đi chung, nhưng sân, hiên và vườn là của từng gia đình, nên đi trong bản thì đi " +
      "trên đường và muốn bước vào sân nhà ai thì hỏi trước. Nếu thấy trước cửa một nhà có cắm " +
      "cành lá xanh, cành gai hoặc treo một tấm phên chắn ngang thì đó là dấu nhà đang kiêng, có " +
      "thể vì nhà mới có trẻ sinh hoặc đang có lễ, và tuyệt đối không được vào, kể cả khi cửa mở " +
      "và có người trong nhà. Khi được mời vào, hãy đợi chủ nhà chỉ chỗ rồi mới ngồi, đừng tự chọn " +
      "chỗ; vách giữa của gian chính là nơi đặt bàn thờ và cột thiêng nên không treo đồ, không dựa " +
      "ba lô và không đứng chụp ảnh ở đó. Bếp lửa giữa nhà cũng là chỗ thiêng chứ không phải chỗ " +
      "sưởi thông thường, nên không bước qua bếp, không gác chân lên kiềng và không ném rác vào " +
      "lửa. Nhà có tang thì không vào. Nếu muốn mang quà, hãy mang thứ cả nhà dùng được như chè, " +
      "muối, dầu ăn, hoặc gửi vở và bút qua điểm trường trong thôn, thay vì phát lẻ cho từng đứa " +
      "trẻ gặp ngoài đường. Cuối cùng, đi xe thật chậm trong bản: đường hẹp, trẻ con và gia súc " +
      "đều ra đường, và tiếng nẹt pô trong một cái thung lũng kín vang xa hơn nhiều so với ở phố.",
    tags: ["ung-xu", "vao-ban", "an-toan", "du-lich-co-trach-nhiem"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-ung-xu-khi-chup-anh-nguoi-dan",
    domain: "destination",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Chụp ảnh người dân: xin phép trước, và vì sao không nên cho tiền trẻ em",
    // Đoạn về việc cho tiền là đoạn quan trọng nhất trong cả file và cũng là đoạn hay bị phản đối
    // nhất, nên nó phải nêu được cơ chế chứ không chỉ nêu điều cấm. Người đọc chỉ đổi hành vi khi
    // thấy được chuỗi hệ quả; nói suông "đừng cho tiền" thì nghe như một lời khuyên khô khan và
    // người ta vẫn cho, vì trước mắt họ là một đứa trẻ chìa tay chứ không phải một cơ chế.
    content:
      "Nguyên tắc gốc là xin phép trước khi chụp. Không nói được tiếng thì đưa máy lên và ra hiệu " +
      "hỏi, rồi đọc phản ứng: người quay đi, lấy nón che mặt hay lắc đầu là đã từ chối, và dùng " +
      "ống tele chụp trộm từ xa cũng vẫn là chụp trộm. Với trẻ em thì phải có người lớn đi cùng " +
      "đồng ý, và nếu định đăng lên mạng thì đừng ghép mặt trẻ với tên thôn bản cụ thể. Việc " +
      "không nên làm, dù nó xuất phát từ thiện ý, là cho tiền hay cho kẹo cho trẻ em ngoài đường. " +
      "Chuỗi hệ quả rất dễ thấy nếu đi vài lần: khi đứng ở một khúc cua chìa tay được nhiều hơn " +
      "một buổi lên nương, trẻ sẽ bỏ buổi học ra đứng đường đợi xe khách, và quan hệ giữa người " +
      "địa phương với khách chuyển thành quan hệ xin và cho. Ở vài điểm dừng đông khách, chuyện " +
      "trẻ em đội gùi hoa đứng sẵn cho khách chụp rồi ngửa tay chính là sản phẩm hoàn chỉnh của " +
      "thói quen ấy; cách hành xử tốt hơn là không chụp và không cho. Muốn giúp thật thì mua hàng " +
      "của người bán tại chỗ, ăn và ngủ trong bản, hoặc gửi đồ dùng học tập qua điểm trường. Ngoài " +
      "ra có ba nơi không chụp trong bất kỳ hoàn cảnh nào: đám tang, nghi lễ đang diễn ra, và bên " +
      "trong khu vực thờ cúng của một gia đình. Nếu muốn một bức chân dung tử tế thì cách hiệu quả " +
      "nhất không phải là ống kính dài hơn mà là ngồi lại mua một thứ gì đó, nói vài câu, rồi mới " +
      "hỏi xin chụp — và nếu đã hứa gửi ảnh về thì nhớ gửi.",
    tags: ["ung-xu", "chup-anh", "tre-em", "du-lich-co-trach-nhiem"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "van-hoa-ngon-ngu-va-cach-xung-ho",
    domain: "destination",
    entityType: "local_tips",
    entityId: "ha-giang",
    title: "Ngôn ngữ và cách xưng hô khi nói chuyện với người trong vùng",
    content:
      "Ở các thôn xa, nhiều người lớn tuổi, nhất là phụ nữ, nói tiếng Việt không thạo, và điều dễ " +
      "gây hiểu lầm nhất là một cái gật đầu kèm nụ cười thường có nghĩa là đang giữ hoà khí chứ " +
      "chưa chắc là đã hiểu và đồng ý. Vì vậy khi thoả thuận việc gì có hệ quả thật — thuê xe ôm, " +
      "đặt bữa cơm, hỏi đường xuống bến — nên nói chậm, dùng câu ngắn, tránh tiếng lóng, và hỏi " +
      "lại bằng một câu khác cách để chắc rằng hai bên hiểu giống nhau. Trẻ con trong nhà thường " +
      "là người phiên dịch giỏi nhất, nhưng đừng đẩy cho chúng việc thương lượng tiền nong. Về " +
      "xưng hô, cứ gọi theo tuổi như với người Kinh là ổn, tức bác, cô, chú, anh, chị, và tránh " +
      "gọi 'em ơi' với người rõ ràng lớn tuổi hơn mình. Một chi tiết nhỏ nhưng đáng nhớ: nên gọi " +
      "đúng tên dân tộc — người Mông, người Dao, người Lô Lô, người Tày — thay vì gọi gộp là " +
      "'người dân tộc'; và tuyệt đối không dùng chữ 'Mèo', vốn là tên gọi cũ mang sắc thái miệt " +
      "thị mà một số nguồn viết trước đây vẫn còn để lại.",
    tags: ["ung-xu", "giao-tiep", "ngon-ngu", "du-lich-co-trach-nhiem"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
