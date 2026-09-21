/**
 * KHO TRI THỨC ẨM THỰC — phần văn bản đi kèm mọi món ăn và đặc sản trong @data/places/food.
 *
 * QUY TẮC MỘT–MỘT VÀ VÌ SAO NÓ ĐÁNG GIỮ. Mỗi thực thể `local_food` và `specialty` ở food.ts có
 * đúng một tài liệu ở đây, và `entityId` luôn bằng `slug` bên đó. Đổi lấy sự cứng nhắc ấy, ta có
 * một tính chất rất tiện: hỏi "bánh tam giác mạch là gì" thì bộ lọc metadata chạy trước semantic
 * search (Mục 11.1.1.5) lọc được `domain: "food"` cộng `entityId` là ra đúng một tài liệu, không
 * cần để vector mò trong toàn kho rồi trả về nhầm sang mật ong. Viết gộp hai món vào một tài liệu
 * "các món từ tam giác mạch" sẽ phá đúng tính chất đó, và tài liệu gộp còn bị cắt tuỳ tiện lúc
 * chunk nên nửa nói về bánh, nửa nói về rượu, không nửa nào đủ để trả lời.
 *
 * VÌ SAO KHÔNG CÓ MỘT CON SỐ GIÁ NÀO Ở ĐÂY. Giá nằm ở `PriceEstimate` trong food.ts, nơi nó mang
 * theo cơ sở ước lượng, ngày khảo sát và nguồn. Chép con số ấy vào văn bản là tạo ra một bản sao
 * không có ngày và không có nguồn, rồi bản sao đó sẽ được trích ra như giá thật khi bản gốc đã
 * được cập nhật. Cũng vì lý do đó mà văn bản dưới đây nói "đắt hơn hẳn mặt bằng" chứ không nói
 * đắt hơn bao nhiêu — công việc của số là của tool layer, công việc của chữ là của chỗ này.
 *
 * VỀ TRƯỜNG `season`, ĐIỀU DỄ ĐẶT SAI NHẤT. Bảng `Season` được dựng theo cách khách hỏi về CẢNH,
 * không theo lịch nông vụ, nên nhiều món không có ô nào khớp hoàn hảo. Nguyên tắc xử lý ở file
 * này: chỉ gắn một mùa khi mùa đó thực sự đổi câu trả lời cho khách; còn khi món có quanh năm mà
 * chỉ "ngon hơn" vào một mùa thì để `quanh_nam`, vì gắn bừa sẽ khiến câu hỏi "tháng này ăn gì" trả
 * về một danh sách dài đúng bằng toàn bộ kho, tức là vô dụng. Vài chỗ buộc phải mượn ô gần đúng
 * và đều có chú thích riêng ngay tại mục.
 *
 * VỀ CẢNH BÁO AN TOÀN. Ấu tẩu là củ độc và rượu ngô là rượu nấu thủ công; hai điều đó phải nằm
 * trong chính `content` chứ không nằm trong `tags`, vì chỉ `content` mới được trích vào câu trả
 * lời. Một cảnh báo chỉ tồn tại ở nhãn là một cảnh báo khách không bao giờ đọc được.
 */

import type { KnowledgeSourceDoc } from "./types";

export const CUISINE_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // ---------------------------------------------------------------------------------------------
  // MÓN ĂN
  // ---------------------------------------------------------------------------------------------
  {
    slug: "food-thang-co",
    domain: "food",
    entityType: "local_food",
    entityId: "thang-co",
    title: "Thắng cố — món chảo của phiên chợ vùng cao",
    content:
      "Thắng cố là món của người Mông, nấu trong một chiếc chảo lớn đặt ngay giữa phiên chợ và " +
      "múc ra bát cho khách ngồi quanh. Nguyên liệu gốc là thịt và toàn bộ nội tạng ngựa ninh nhừ " +
      "cùng thảo quả, quế chi, gừng, lá chanh nướng và hạt dổi; ngày nay phần lớn hàng ở chợ nấu " +
      "bằng thịt bò hoặc thịt trâu vì dễ mua hơn, nên nếu muốn ăn bản gốc thì phải hỏi rõ người " +
      "bán trước khi gọi. Ăn thắng cố đúng nghĩa là ăn ở phiên chợ, đông nhất là chợ phiên Mèo Vạc " +
      "và chợ phiên Đồng Văn họp buổi sáng, khi chảo đã sôi từ tờ mờ sáng và mọi người đứng quanh " +
      "uống rượu ngô. Món này hợp với trời rét cắt da hơn hẳn trời nóng, và đó cũng là lúc khách " +
      "thấy được vì sao cả chợ ngồi quanh một cái chảo. Người lạ miệng nên chuẩn bị trước cho ba " +
      "thứ: mùi thảo quả rất nồng, vị nội tạng rõ, và nước dùng béo ngậy chứ không trong. Cách vào " +
      "món nhẹ nhàng nhất là gọi một bát nhỏ ăn chung, chan thêm nước, và ăn kèm rau cải mèo cho " +
      "đỡ ngấy thay vì gọi hẳn một bát đầy cho riêng mình.",
    tags: ["nguoi-mong", "cho-phien", "mon-nuoc", "khau-vi-la", "meo-vac", "dong-van"],
    // Thắng cố thật ra bán quanh năm ở mọi phiên chợ. Vẫn đặt `mua_lanh` vì đây là mùa duy nhất
    // món này nên được chủ động gợi ý: giữa mùa hè, một bát nước dùng béo nóng giữa chợ là gợi ý
    // mà phần lớn khách sẽ bỏ dở.
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "food-chao-au-tau",
    domain: "food",
    entityType: "local_food",
    entityId: "chao-au-tau",
    title: "Cháo ấu tẩu — món đêm nấu từ một củ độc",
    content:
      "Cháo ấu tẩu là món riêng của thành phố Hà Giang, nấu từ gạo nếp nương, chân giò lợn và củ " +
      "ấu tẩu đã ninh rất lâu cho nhừ, khi múc ra rắc thêm trứng gà, hành hoa và tía tô. Điều phải " +
      "nói trước bất cứ điều gì khác: củ ấu tẩu tươi có độc, chất độc chỉ phân huỷ khi được ngâm " +
      "kỹ rồi ninh nhiều giờ, nên đây là món chỉ nên ăn ở hàng quán có nghề chứ tuyệt đối không tự " +
      "mua củ về nấu. Vị của nó đắng nhẹ và ngậm lâu ở cuống lưỡi, khác hẳn mọi loại cháo dưới " +
      "xuôi, và chính vị đắng ấy là thứ người địa phương tìm đến. Cháo được bán vào buổi tối và " +
      "khuya, khi trời lạnh, bởi người ta ăn nó như một món giải mỏi sau ngày đường chứ không phải " +
      "món lót dạ buổi sáng. Muốn ăn đúng chỗ thì phải ăn ngay trong thành phố Hà Giang; càng lên " +
      "cao nguyên đá càng khó tìm, nên đoàn nào định ăn mà để tới Đồng Văn mới nhớ ra thì thường " +
      "là lỡ. Người ăn lần đầu nên gọi bát nhỏ, và nếu thấy tê môi hay tê lưỡi sau khi ăn thì đó " +
      "không phải chuyện bình thường của món, cần đi khám ngay.",
    tags: ["tp-ha-giang", "an-dem", "mon-nuoc", "co-canh-bao-an-toan", "vi-dang"],
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "food-cu-au-tau",
    domain: "food",
    entityType: "local_food",
    entityId: "cu-au-tau",
    title: "Củ ấu tẩu — nguyên liệu độc và những điều không được làm với nó",
    content:
      "Ấu tẩu là củ của một loài cây họ hoàng liên mọc trên núi cao, người vùng cao Hà Giang gọi " +
      "là củ gấu tàu, còn trong đông y thì đây chính là vị ô đầu, phụ tử. Củ tươi chứa aconitin, " +
      "một chất độc tác động lên tim và thần kinh, và ngộ độc ấu tẩu là ca cấp cứu có thật ở các " +
      "bệnh viện trong vùng chứ không phải lời doạ để bán hàng. Nó chỉ trở thành thức ăn được sau " +
      "khi ngâm nước gạo rồi ninh liên tục nhiều giờ đến khi bở tơi, và đó là lý do món cháo ấu " +
      "tẩu là việc của người nấu chuyên nghiệp chứ không phải việc của khách du lịch mang củ về " +
      "nhà. Rượu ngâm ấu tẩu bán ở nhiều nơi trong vùng là rượu dùng để xoa bóp ngoài da, không " +
      "phải rượu uống, và uống nhầm là tình huống ngộ độc phổ biến nhất liên quan tới củ này. Dấu " +
      "hiệu cần đi cấp cứu ngay là tê môi, tê lưỡi, tê đầu ngón tay, buồn nôn hoặc loạn nhịp tim " +
      "sau khi ăn uống thứ gì có ấu tẩu. Nói ngắn gọn cho khách: ăn cháo ấu tẩu ở quán thì được, " +
      "mua củ về tự chế biến hoặc tự ngâm rượu thì không.",
    tags: ["nguyen-lieu", "co-canh-bao-an-toan", "cay-thuoc", "khong-tu-che-bien", "ngo-doc"],
    // Gắn `mua_lanh` để tài liệu này đi kèm cháo ấu tẩu khi khách hỏi theo mùa. Bản thân cảnh báo
    // an toàn thì không có mùa, nhưng tách nó ra `quanh_nam` sẽ khiến nó rơi khỏi đúng ngữ cảnh
    // mà người ta cần đọc nó nhất.
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "food-banh-cuon-dong-van",
    domain: "food",
    entityType: "local_food",
    entityId: "banh-cuon-dong-van",
    title: "Bánh cuốn Đồng Văn — chấm nước xương chứ không chấm nước mắm",
    content:
      "Bánh cuốn Đồng Văn tráng mỏng tại chỗ trên nồi hấp, nhân mộc nhĩ thịt băm hoặc trứng gà đập " +
      "thẳng lên lá bánh rồi cuốn lại khi trứng còn lòng đào. Khác biệt nằm ở bát nước chấm: thay " +
      "cho nước mắm pha chua ngọt của dưới xuôi, ở đây là một bát nước ninh xương nóng thả giò và " +
      "hành mùi, ăn tới đâu chan tới đó. Đó không phải chi tiết trang trí mà là lý do món này tồn " +
      "tại ở độ cao này: buổi sáng phố cổ Đồng Văn lạnh và ẩm, một bát nước xương nóng làm được " +
      "việc mà chén nước mắm không làm được. Hàng bán từ sáng sớm và thường hết trước trưa, đông " +
      "nhất là sáng Chủ nhật khi cả vùng đổ về phiên chợ. Đây là món dễ ăn nhất trong nhóm ẩm thực " +
      "Hà Giang, hợp cho bữa đầu tiên của người chưa quen đồ vùng cao và cho trẻ nhỏ đi cùng đoàn. " +
      "Một lưu ý nhỏ để khỏi bị hụt: khách hay gọi thêm nước mắm theo thói quen, nhưng chan nước " +
      "mắm vào là mất đúng cái đáng lên tới đây để ăn.",
    tags: ["dong-van", "an-sang", "de-an", "pho-co-dong-van", "hop-tre-em"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-men-men",
    domain: "food",
    entityType: "local_food",
    entityId: "men-men",
    title: "Mèn mén — hạt ngô thay hạt gạo trên cao nguyên đá",
    content:
      "Mèn mén là ngô tẻ xay nhỏ rồi hấp cách thuỷ hai lượt cho tơi, món lương thực chính của " +
      "người Mông trên cao nguyên đá. Nó tồn tại vì đất ở đây là đá tai mèo, ruộng nước gần như " +
      "không có, và cây ngô là thứ duy nhất chịu được việc trồng trong hốc đá — nên hiểu mèn mén " +
      "là hiểu vì sao cả vùng này trông như vậy. Làm ra một mẻ rất công phu: ngô phải xay bằng cối " +
      "đá, sàng bỏ mày, vẩy nước cho ẩm đều rồi hấp, để nguội, đảo lại và hấp lần hai. Khách " +
      "thường gặp mèn mén ở phiên chợ, ăn cùng bát thắng cố hoặc canh rau, và đó cũng là cách ăn " +
      "đúng nhất vì bản thân nó khô và bở, nuốt không trôi nếu ăn chay một mình. Người lạ miệng " +
      "nên biết trước rằng vị của nó nhạt và ngòn ngọt mùi ngô, không đậm đà như cơm, và cảm giác " +
      "hơi ráp ở cổ họng là bình thường chứ không phải hàng làm dối. Ăn mèn mén nên ăn ít một, " +
      "chan cùng nước canh nóng, và đừng gọi nó là món ăn chơi trước mặt chủ nhà.",
    tags: ["nguoi-mong", "cao-nguyen-da", "cho-phien", "luong-thuc-chinh", "van-hoa"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-banh-tam-giac-mach",
    domain: "food",
    entityType: "local_food",
    entityId: "banh-tam-giac-mach",
    title: "Bánh tam giác mạch — thứ còn lại sau khi hoa tàn",
    content:
      "Bánh tam giác mạch làm từ hạt của chính loài hoa mà khách kéo lên Hà Giang để chụp: hạt " +
      "được phơi khô, xay thành bột mịn, nhào nước rồi đúc thành khuôn tròn dẹt, hấp chín và nướng " +
      "lại trên than hoa cho dậy mùi. Bánh có màu tím xám nhạt, xốp, vị bùi và ngọt rất nhẹ, ăn " +
      "nóng ngay tại lò thì mềm còn để nguội thì cứng lại và bã đi trông thấy. Đây là món ăn chơi " +
      "bán dọc các điểm dừng trên cao nguyên đá và trong phiên chợ, mua một chiếc cầm tay vừa đi " +
      "vừa ăn chứ không phải món ngồi vào bàn. Mùa hoa tam giác mạch tháng mười và tháng mười một " +
      "là lúc bánh có nhiều nhất và tươi nhất, tuy hạt để dành được nên ngoài mùa vẫn tìm được " +
      "hàng. Người ăn lần đầu hay kỳ vọng một vị ngọt rõ như bánh dưới xuôi rồi thấy hụt hẫng; " +
      "cách công bằng với món này là coi nó như một thứ bánh bột ngũ cốc mộc, ăn kèm chén trà nóng. " +
      "Nếu định mua về làm quà thì đừng mua bánh nướng bán tại chỗ mà mua loại đóng gói, vì bánh " +
      "nướng để qua ngày là hỏng.",
    tags: ["dong-van", "an-vat", "mua-hoa-tam-giac-mach", "cho-phien", "de-an"],
    season: ["hoa_tam_giac_mach"],
    sourceClass: "editorial",
  },
  {
    slug: "food-thit-trau-gac-bep",
    domain: "food",
    entityType: "local_food",
    entityId: "thit-trau-gac-bep",
    title: "Thịt trâu gác bếp — cách giữ thịt qua mùa đông thành món nhắm",
    content:
      "Thịt trâu gác bếp là thịt bắp trâu thái dọc thớ, ướp muối, ớt, gừng và mắc khén rồi treo " +
      "lên gác bếp cho khói củi hun khô dần trong nhiều ngày. Nguồn gốc của nó là cách bảo quản " +
      "thực phẩm qua mùa đông của các gia đình vùng cao, chứ ban đầu không phải món đãi khách, và " +
      "vị khói đậm cùng độ dai xé sợi chính là dấu vết của cách làm đó. Khi ăn, thịt được nướng " +
      "hoặc hấp lại cho mềm rồi xé dọc thớ, chấm chẩm chéo, thường dọn ra như món nhắm cùng rượu " +
      "ngô trong bữa tối. Món này có quanh năm ở nhà hàng và ở chợ nên không phải đợi mùa, nhưng " +
      "ngon nhất vẫn là mẻ hun trong mùa lạnh khi bếp đỏ lửa cả ngày. Điều người lạ miệng cần biết " +
      "là vị mắc khén tê tê đầu lưỡi rất khác hạt tiêu, và miếng thịt thật thì khô, sẫm và phải xé " +
      "được thành sợi chứ không mềm mọng. Nếu miếng thịt mềm ướt, màu đỏ tươi đều và ngọt lịm thì " +
      "nhiều khả năng đó là thịt tẩm gia vị rồi sấy công nghiệp, không phải hàng gác bếp.",
    tags: ["mon-nhau", "mac-khen", "quanh-nam", "mang-ve-duoc", "de-bi-lam-gia"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-xoi-ngu-sac",
    domain: "food",
    entityType: "local_food",
    entityId: "xoi-ngu-sac",
    title: "Xôi ngũ sắc — năm màu đều từ lá rừng",
    content:
      "Xôi ngũ sắc là món của người Tày và người Nùng, gạo nếp nương được ngâm với nước lá và củ " +
      "rừng để lấy màu rồi đồ lên thành từng phần trắng, đỏ, vàng, xanh, tím. Điều đáng nói nhất " +
      "về món này là toàn bộ màu đều là màu thực vật: lá cẩm cho tím và đỏ, nghệ hoặc hoa bồ cắp " +
      "cho vàng, lá gừng hoặc lá dứa cho xanh, còn trắng là màu nguyên của nếp. Năm màu không phải " +
      "để cho đẹp mắt mà mang ý nghĩa ngũ hành và lòng biết ơn trời đất, nên món này gắn với ngày " +
      "lễ, ngày hội và mâm cỗ cưới hơn là với bữa cơm thường. Khách gặp xôi ngũ sắc nhiều nhất ở " +
      "phiên chợ và ở các bản làm du lịch cộng đồng như Nặm Đăm hay Thôn Tha, nơi chủ nhà nấu theo " +
      "đơn đặt của đoàn. Đây là món hiền, không cay không nồng, hợp cả với trẻ con và với người ăn " +
      "chay nếu không kèm thịt. Nếu thấy màu quá rực và đều tăm tắp thì nên hỏi lại, vì nếp nhuộm " +
      "lá thật cho màu trầm và hơi loang chứ không tươi như phẩm.",
    tags: ["nguoi-tay", "le-hoi", "de-an", "mon-chay-duoc", "du-lich-cong-dong"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-com-lam",
    domain: "food",
    entityType: "local_food",
    entityId: "com-lam",
    title: "Cơm lam — gạo nếp nướng trong ống tre",
    content:
      "Cơm lam là gạo nếp nương ngâm nước rồi cho vào ống tre non còn tươi, nút lá chuối và nướng " +
      "xoay đều trên than cho tới khi ống cháy sém và mùi nếp bốc ra. Ống tre không chỉ là dụng cụ " +
      "nấu: lớp màng lụa bên trong ống bám vào hạt cơm khi bóc, và chính lớp màng ấy cùng nước tre " +
      "tiết ra khi nướng tạo nên mùi thơm mà nồi cơm không có. Món này là cách nấu ăn của người đi " +
      "rừng đi nương, phổ biến ở các nhóm người Tày vùng thấp mà rõ nhất là quanh Bắc Mê, tuy ngày " +
      "nay bán dọc cả cung đường du lịch. Cơm lam ăn chấm muối vừng hoặc ăn cùng thịt nướng, gà " +
      "nướng, và ngon nhất là lúc vừa bóc ống còn nóng, để nguội thì hạt cứng lại. Đây là món dễ " +
      "ăn với mọi khẩu vị, ăn chay được, và tiện cho bữa trưa dọc đường vì cầm tay được và không " +
      "cần bát đũa. Chỉ cần lưu ý một điều: ống tre bán sẵn nguội ngắt ở các điểm dừng thường đã " +
      "nướng từ sáng, nên hỏi ống mới nướng nếu muốn ăn đúng vị.",
    tags: ["nguoi-tay", "bac-me", "de-an", "mon-chay-duoc", "ban-doc-duong"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-lau-ga-den",
    domain: "food",
    entityType: "local_food",
    entityId: "lau-ga-den",
    title: "Lẩu gà đen — bữa tối của cả đoàn sau ngày đèo",
    content:
      "Gà đen là giống gà bản của người Mông, nhỏ con, da và xương đều thẫm màu, nuôi thả trên núi " +
      "nên thịt chắc và ngọt hơn hẳn gà nuôi nhốt. Nấu lẩu là cách phổ biến nhất: gà chặt miếng " +
      "ninh cùng gừng, sả, thảo quả và thuốc bắc, nồi nước đặt giữa bàn rồi nhúng rau cải mèo, " +
      "rau rừng ăn dần. Đây là món của bữa tối đông người sau một ngày chạy đèo, và nó được ưa " +
      "chuộng đúng vì lẽ đó chứ không phải vì lạ miệng: cả đoàn ngồi quanh một nồi nóng là cách " +
      "sưởi ấm hiệu quả nhất ở thị trấn vùng cao vào ban đêm. Có thể ăn quanh năm nhưng vào mùa " +
      "lạnh thì hợp cảnh hơn nhiều. Hai điều nên nói trước với khách: thịt gà đen dai hơn gà công " +
      "nghiệp và cần ninh lâu, ai quen thịt mềm sẽ thấy khó xé; và đây là món đắt hơn hẳn mặt bằng " +
      "các món khác trong vùng vì tính theo cả con, nên đoàn ít người thì hỏi giá trước khi gọi. " +
      "Ở các thị trấn như Đồng Văn hay Mèo Vạc nên đặt trước vào buổi chiều, vì nhà hàng phải bắt " +
      "gà và ninh chứ không có sẵn.",
    tags: ["nguoi-mong", "an-toi", "di-nhom", "mon-dat-tien", "dat-truoc"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-pho-chua",
    domain: "food",
    entityType: "local_food",
    entityId: "pho-chua",
    title: "Phở chua — món trộn ăn nguội của vùng biên giới đông bắc",
    content:
      "Phở chua là bánh phở trộn nguội cùng thịt xá xíu, lạp xưởng, khoai hoặc đậu phộng rang, rau " +
      "thơm và dưa chuột, chan lên một thứ nước sốt chua ngọt sánh pha từ giấm đường và bột năng. " +
      "Cần nói rõ để khỏi gây hiểu nhầm về xuất xứ: đây là món chung của cả dải biên giới đông " +
      "bắc, Cao Bằng và Lạng Sơn cũng có phiên bản riêng và mỗi nơi đều có người nhận là gốc, nên " +
      "cách nói đúng là khách ăn được món này ở Hà Giang chứ không phải món này chỉ Hà Giang mới " +
      "có. Vì ăn nguội và có vị chua nên nó hợp buổi trưa và hợp trời nóng, ngược hẳn với thắng cố " +
      "hay cháo ấu tẩu. Khách thường gặp phở chua ở các quán trong thành phố Hà Giang và ở hàng " +
      "quán quanh phiên chợ, gọi như một suất ăn nhẹ giữa ngày. Món này dễ ăn với đa số người, " +
      "nhưng ai không quen vị chua ngọt đậm của nước sốt thì nên xin chan riêng để tự điều chỉnh. " +
      "Đây cũng là lựa chọn an toàn cho khách vừa ăn quá nhiều đồ béo và cần một bữa nhẹ.",
    tags: ["mon-tron", "an-trua", "mon-mat", "co-o-tinh-khac", "de-an"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-ca-bong",
    domain: "food",
    entityType: "local_food",
    entityId: "ca-bong",
    title: "Cá bỗng — cá nuôi lâu năm của người Tày vùng thấp",
    content:
      "Cá bỗng là giống cá nước ngọt vảy to, thịt chắc và giòn, được người Tày ở vùng thấp Hà " +
      "Giang nuôi trong ao và trong lồng bè nhiều đời, quanh lưu vực sông Lô, sông Gâm và sông " +
      "Miện. Đặc điểm khiến nó thành đặc sản là cá lớn rất chậm, nhiều con được nuôi hàng chục năm " +
      "mới đạt cỡ, nên thịt săn và không bở như cá nuôi thương phẩm. Cách chế biến quen thuộc là " +
      "nướng than nguyên con, nấu canh chua với măng, hoặc làm gỏi trộn thính và lá rừng ở những " +
      "gia đình có nghề. Cần nói lại một điều mà nhiều người hiểu nhầm: khách hay gọi món này là " +
      "cá bỗng sông Nho Quế, nhưng thứ bán ở bến thuyền Nho Quế là cá nướng phục vụ khách đi " +
      "thuyền chứ Nho Quế không phải nơi nuôi cá bỗng; muốn ăn đúng thì tìm ở vùng thấp quanh " +
      "thành phố Hà Giang, Vị Xuyên và Bắc Mê. Món này ăn được quanh năm và không kén khẩu vị, chỉ " +
      "cần lưu ý là cá có nhiều xương dăm nên không tiện cho trẻ nhỏ. Với món gỏi cá sống thì nên " +
      "cân nhắc, vì đó là món phụ thuộc hoàn toàn vào tay nghề và độ sạch của chỗ làm.",
    tags: ["nguoi-tay", "ca-nuoc-ngot", "vung-thap", "mon-nhau", "hieu-nham-pho-bien"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-rau-cai-meo",
    domain: "food",
    entityType: "local_food",
    entityId: "rau-cai-meo",
    title: "Rau cải mèo — vị đắng hợp với mọi món béo trong vùng",
    content:
      "Cải mèo là giống cải bản địa lá dài, có răng cưa và phủ lông tơ, người Mông trồng xen trong " +
      "nương ngô trên các sườn núi cao. Vị của nó đắng nhẹ và hăng, khác hẳn cải ngọt dưới xuôi, " +
      "và chính vị đắng ấy làm nên vai trò của nó trong mâm cơm vùng cao: cân lại độ béo của thắng " +
      "cố, của lẩu gà đen và của thịt nướng. Cách nấu thường gặp nhất là luộc chấm trứng dầm, nấu " +
      "canh với gừng, xào tỏi, hoặc nhúng lẩu. Rau ngon nhất vào mùa lạnh, khi sương muối và rét " +
      "làm lá dày lên và vị ngọt hậu rõ hơn; giữa mùa nóng thì cải già nhanh và đắng gắt. Đây là " +
      "món rẻ, có ở mọi quán và mọi phiên chợ, nên là thứ nên gọi kèm trong bữa nào cũng được. Với " +
      "người chưa quen, cách vào món dễ chịu nhất là ăn cải nhúng lẩu chứ không phải cải luộc, vì " +
      "nước lẩu làm dịu bớt vị hăng.",
    tags: ["rau", "nguoi-mong", "mon-chay-duoc", "gia-re", "an-kem"],
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "food-thit-lon-cap-nach",
    domain: "food",
    entityType: "local_food",
    entityId: "thit-lon-cap-nach",
    title: "Thịt lợn cắp nách — lợn bản nhỏ con nuôi thả",
    content:
      "Lợn cắp nách là lợn bản nuôi thả rông trên núi, ăn rau củ và cây rừng, lớn chậm nên khi bán " +
      "vẫn nhỏ tới mức người ta kẹp được vào nách mà mang ra chợ — cái tên đến từ đúng hình ảnh " +
      "đó. Thịt loại lợn này ít mỡ, bì dày và giòn, thớ săn, mùi thơm rõ hơn lợn nuôi cám. Món " +
      "quen thuộc nhất là nướng nguyên tảng trên than rồi thái miếng chấm chẩm chéo, ngoài ra còn " +
      "hấp, xào lăn hoặc nấu giả cầy trong mâm cỗ nhà. Khách gặp nhiều nhất ở phiên chợ, nơi thịt " +
      "được quay hoặc nướng ngay tại chỗ, và ở các bữa tối đặt theo đoàn tại homestay. Đây là món " +
      "hợp đông người vì thường bán theo tảng hoặc theo mâm chứ không theo suất lẻ. Người quen ăn " +
      "thịt mềm nên biết trước rằng bì giòn và thịt săn là đặc điểm chứ không phải nướng quá tay, " +
      "và phần mỡ ở đây rất mỏng nên miếng thịt khô hơn kỳ vọng.",
    tags: ["cho-phien", "mon-nuong", "di-nhom", "mon-nhau", "homestay"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-banh-chung-gu",
    domain: "food",
    entityType: "local_food",
    entityId: "banh-chung-gu",
    title: "Bánh chưng gù — chiếc bánh gói vừa một bữa",
    content:
      "Bánh chưng gù là bánh chưng của người Tày và người Dao ở Hà Giang, gói thuôn dài và gồ lên " +
      "ở lưng nên có tên như vậy, nhân đỗ xanh thịt lợn giống bánh chưng vuông nhưng nhỏ hơn " +
      "nhiều. Người địa phương giải thích dáng gù là hình ảnh người phụ nữ vùng cao đeo gùi cúi " +
      "lưng lên nương, và dù có nhiều cách kể khác nhau thì đây vẫn là chi tiết khách hỏi nhiều " +
      "nhất về chiếc bánh. Bánh được gói bằng lá dong rừng và luộc nhiều giờ, nếp nương làm bánh " +
      "dẻo và có màu xanh trong từ lá chứ không cần phẩm. Nghề gói tập trung ở các làng nghề ven " +
      "thành phố Hà Giang, và đó cũng là chỗ mua đúng nhất — bánh bán ở đây là bánh mới luộc trong " +
      "ngày. Bánh gắn với Tết và lễ hội nhưng nay được gói bán quanh năm, nên khách nào cũng mua " +
      "được. Điểm tiện nhất của nó với người đi đường là cỡ bánh vừa đúng một bữa cho một người, " +
      "bóc ra ăn ngay không cần cắt, và để được vài ngày nếu trời mát.",
    tags: ["nguoi-tay", "nguoi-dao", "lang-nghe", "tp-ha-giang", "mang-ve-duoc"],
    // Gắn kèm `hoa_dao_man` vì đó là khung tháng phủ dịp Tết — lúc chiếc bánh này thực sự đổi vai
    // từ món ăn đường thành món lễ, và cũng là lúc khách hỏi về nó nhiều nhất.
    season: ["hoa_dao_man", "quanh_nam"],
    sourceClass: "editorial",
  },

  // ---------------------------------------------------------------------------------------------
  // ĐẶC SẢN MANG VỀ
  //
  // Nhóm này có một nhiệm vụ mà nhóm món ăn không có: giúp khách không mua nhầm. Mật ong bạc hà,
  // chè Shan tuyết cổ thụ và thịt trâu gác bếp đều là những mặt hàng mà hàng giả có mặt ngay tại
  // chỗ bán hàng thật, nên mỗi tài liệu dưới đây đều dành phần cuối để nói dấu hiệu nhận biết.
  // Phần đó phải nằm trong `content`, vì nhãn thì không được trích ra câu trả lời.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "food-mat-ong-bac-ha",
    domain: "food",
    entityType: "specialty",
    entityId: "mat-ong-bac-ha",
    title: "Mật ong bạc hà — đặc sản chỉ có được nhờ một loài hoa dại",
    content:
      "Mật ong bạc hà là mật ong lấy từ hoa cây bạc hà dại, một loài hoa nhỏ màu tím nhạt mọc tự " +
      "nhiên trong hốc đá trên cao nguyên đá Đồng Văn và nhiều nhất là quanh Mèo Vạc. Vì cây chỉ " +
      "mọc ở địa hình ấy và chỉ nở trong một quãng ngắn cuối năm nên sản lượng rất hạn chế, và đó " +
      "là toàn bộ lý do mặt hàng này đắt hơn hẳn các loại mật ong khác. Mật thật có màu vàng xanh " +
      "nhạt trong, sánh vừa, mùi thơm dịu mát đặc trưng và vị ngọt thanh chứ không gắt cổ. Vụ mật " +
      "rơi vào quãng cuối năm khi hoa bạc hà nở, nên mua vào đúng dịp đó thì hàng tươi và người " +
      "bán còn nhiều lựa chọn; các tháng còn lại vẫn có bán nhưng phần lớn là mật đã để dành. Nơi " +
      "mua đáng tin hơn cả là các cơ sở nuôi ong có nhãn mác và tem truy xuất trong địa bàn Mèo " +
      "Vạc, hoặc hợp tác xã tại chỗ, thay vì các sạp bày chai không nhãn dọc đường. Dấu hiệu cần " +
      "cảnh giác là mật quá đặc quánh, màu vàng sậm như cánh gián, mùi hắc hoặc ngọt gắt, và giá " +
      "thấp bất thường so với mặt bằng — đây là mặt hàng mà rẻ gần như luôn đồng nghĩa với không " +
      "phải hoa bạc hà.",
    tags: ["meo-vac", "chi-dan-dia-ly", "mang-ve-duoc", "de-bi-lam-gia", "qua-tang"],
    // Bảng `Season` không có ô nào cho vụ hoa bạc hà, và thêm ô mới là chạm vào hợp đồng kiểu mà
    // các tác tử khác đang dùng. Hai ô dưới đây là cách kẹp đúng quãng thật: hoa bắt đầu nở vào
    // cuối quãng hoa tam giác mạch và vụ mật kéo sang mùa rét. Ghi rõ ở đây để người sau đọc
    // `season` này không tưởng là gán nhầm rồi "sửa cho đúng".
    season: ["hoa_tam_giac_mach", "mua_lanh"],
    sourceClass: "editorial",
  },
  {
    slug: "food-che-shan-tuyet",
    domain: "food",
    entityType: "specialty",
    entityId: "che-shan-tuyet",
    title: "Chè Shan tuyết — trà hái trên cây cổ thụ",
    content:
      "Chè Shan tuyết là trà hái từ những cây chè thân gỗ mọc trên núi cao, nhiều cây hàng trăm " +
      "tuổi và cao tới mức người hái phải trèo lên cành. Tên gọi đến từ lớp lông tơ trắng như " +
      "tuyết phủ trên búp non, và chính lớp tơ ấy cùng độ cao, sương mù quanh năm làm nên vị chát " +
      "dịu, hậu ngọt sâu và nước vàng sánh của loại trà này. Ở Hà Giang có hai vùng chè Shan có " +
      "tiếng theo hai hướng khác nhau: nhánh phía tây quanh Hoàng Su Phì và Xín Mần với các vùng " +
      "chè cổ thụ, và Lũng Phìn bên phía cao nguyên đá. Trà được hái nhiều vụ trong năm nên mua " +
      "lúc nào cũng có, tuy người sành thường đợi vụ xuân vì búp mập và hương rõ nhất. Muốn mua " +
      "đúng thì nên mua tại hợp tác xã hoặc cơ sở chế biến ngay trong vùng chè, nơi nói được cây " +
      "chè ở đâu và hái vụ nào, thay vì mua gói không rõ nguồn ở điểm dừng chân. Dấu hiệu của trà " +
      "cổ thụ thật là cánh trà to, xoăn không đều, còn thấy lông trắng, nước pha trong và uống " +
      "nhiều nước vẫn còn vị; trà vụn đều tăm tắp, nước đục và hết vị sau một hai lần pha thì " +
      "không phải thứ đáng trả giá cổ thụ.",
    tags: ["hoang-su-phi", "xin-man", "lung-phin", "mang-ve-duoc", "de-bi-lam-gia"],
    // Vụ xuân ngon nhất, nhưng `hoa_dao_man` là ô mô tả cảnh hoa đào hoa mận chứ không phải vụ
    // chè. Gán vào đó sẽ khiến câu hỏi "tháng hai đi Hà Giang có gì" trả về chè như một điểm đến
    // theo mùa, điều không đúng. Để `quanh_nam` và nói chuyện vụ xuân bằng lời trong nội dung.
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-ruou-ngo-thanh-van",
    domain: "food",
    entityType: "specialty",
    entityId: "ruou-ngo-thanh-van",
    title: "Rượu ngô Thanh Vân — rượu men lá của Quản Bạ",
    content:
      "Rượu ngô Thanh Vân là rượu nấu từ ngô địa phương ủ bằng men lá, gắn với địa bàn Thanh Vân " +
      "thuộc vùng Quản Bạ và là loại rượu ngô có tiếng nhất trong vùng. Khác biệt nằm ở men: men " +
      "được làm từ nhiều loại lá và rễ cây rừng theo bài riêng của từng gia đình, chứ không dùng " +
      "men công nghiệp, nên rượu có mùi thơm ngô rõ, uống êm và ít gắt cổ hơn. Đây là thứ đi cùng " +
      "mọi bữa ăn có khách trong vùng, từ bát thắng cố ở phiên chợ tới mâm cơm tối ở homestay, nên " +
      "khách hầu như chắc chắn sẽ gặp nó dù không chủ động tìm. Rượu nấu và bán quanh năm, mua " +
      "được ở phiên chợ, ở các hộ nấu trong vùng Quản Bạ và ở cửa hàng đặc sản dọc đường. Có hai " +
      "điều nên nói thẳng với khách: rượu này êm nên rất dễ uống quá tay mà không nhận ra, và " +
      "tuyệt đối không uống rượu rồi lái xe máy trên cung đường đèo này. Ngoài ra, rượu bán rời " +
      "theo can ở chợ không có gì bảo đảm về nồng độ hay chất lượng men, nên nếu mua về làm quà " +
      "thì chọn hàng đóng chai có nhãn của cơ sở sản xuất.",
    tags: ["quan-ba", "do-uong-co-con", "men-la", "mang-ve-duoc", "co-canh-bao-an-toan"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-banh-tam-giac-mach-kho",
    domain: "food",
    entityType: "specialty",
    entityId: "banh-tam-giac-mach-kho",
    title: "Bánh tam giác mạch đóng gói — bản mang về được của món bánh nướng",
    content:
      "Đây là bánh tam giác mạch làm khô và đóng túi để bán mang về, khác với chiếc bánh nướng " +
      "nóng ăn ngay tại chợ phiên. Bột vẫn xay từ hạt tam giác mạch của vụ hoa cuối năm, nhưng " +
      "bánh được nướng kỹ hơn cho khô hẳn nên giòn, nhẹ và để được lâu thay vì cứng lại sau vài " +
      "giờ như bánh tươi. Hạt để dành được cả năm nên loại đóng gói bán quanh năm, không phải chỉ " +
      "trong mùa hoa. Đây là món quà tiện nhất trong nhóm đặc sản Hà Giang vì nhẹ, không sợ vỡ, " +
      "không rò rỉ và qua được cả chuyến bay, khác hẳn mật ong hay hoa quả tươi. Mua ở cửa hàng " +
      "đặc sản trong thị trấn Đồng Văn hoặc tại các cơ sở sản xuất có bao bì ghi hạn dùng thì yên " +
      "tâm hơn mua túi không nhãn bày ở điểm dừng chân. Một lưu ý về kỳ vọng: bánh khô bùi và ngọt " +
      "rất nhẹ, ăn không sẽ thấy nhạt, nên nó hợp để nhâm nhi cùng trà hơn là để ăn như bánh ngọt.",
    tags: ["dong-van", "mang-ve-duoc", "qua-tang", "de-van-chuyen", "mua-hoa-tam-giac-mach"],
    // Hai ô cùng lúc là cố ý: bột đến từ vụ hoa tháng mười và tháng mười một nên câu hỏi theo mùa
    // hoa phải gặp được nó, nhưng hàng đóng gói thì bán cả năm nên không được rơi khỏi câu hỏi
    // ngoài mùa. Đây là chỗ khác biệt duy nhất giữa tài liệu này và tài liệu bánh nướng ăn tại chỗ.
    season: ["hoa_tam_giac_mach", "quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-thit-trau-gac-bep-dong-goi",
    domain: "food",
    entityType: "specialty",
    entityId: "thit-trau-gac-bep-dong-goi",
    title: "Thịt trâu gác bếp đóng gói — mua về thế nào cho khỏi nhầm",
    content:
      "Thịt trâu gác bếp bán mang về là cùng một món với thứ dọn ra bàn nhắm, nhưng đã được hút " +
      "chân không và đóng túi để đi đường xa. Hàng làm đúng thì miếng thịt sẫm màu nâu đen bên " +
      "ngoài, đỏ thẫm bên trong, khô và cứng, xé dọc thớ thì ra sợi, mùi khói củi rõ và vị mắc " +
      "khén tê nhẹ đầu lưỡi. Đây là mặt hàng bị làm giả nhiều: thịt bò hoặc thịt lợn tẩm gia vị " +
      "rồi sấy công nghiệp và gắn nhãn trâu gác bếp là chuyện thường gặp, dấu hiệu là miếng thịt " +
      "mềm ướt, màu đỏ tươi đều, ngọt lịm và gần như không có mùi khói. Cần nhớ thêm rằng thịt " +
      "trâu hao rất nhiều khi hun khô, nên một mức giá thấp bất thường tự nó đã là lời cảnh báo. " +
      "Nơi mua đáng tin là cơ sở chế biến có địa chỉ và hạn dùng in trên bao bì, mua tại thành phố " +
      "Hà Giang trước lúc về thì tiện hơn mua dọc đường. Về bảo quản, túi hút chân không chưa mở " +
      "để ngăn mát được lâu, còn mở rồi thì nên cấp đông và mỗi lần ăn hấp hoặc nướng lại cho mềm; " +
      "để nhiệt độ phòng nhiều ngày sau khi mở là hỏng và mốc.",
    tags: ["mang-ve-duoc", "de-bi-lam-gia", "hut-chan-khong", "qua-tang", "bao-quan"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "food-hong-khong-hat-quan-ba",
    domain: "food",
    entityType: "specialty",
    entityId: "hong-khong-hat-quan-ba",
    title: "Hồng không hạt Quản Bạ — quả giòn của thung lũng Tam Sơn",
    content:
      "Hồng không hạt Quản Bạ là giống hồng bản địa trồng trên các sườn núi quanh thung lũng Tam " +
      "Sơn, quả không có hạt, khi chín ngâm khử chát xong thì giòn, ngọt đậm và nhiều cát đường. " +
      "Cây hồng ở đây trồng lâu năm và không cần chăm nhiều, nhiều vườn là hồng cổ do các gia đình " +
      "người Dao, người Mông giữ lại, nên đây là thứ nông sản gắn với vùng chứ không phải cây mới " +
      "đưa vào. Hồng thu hoạch vào quãng cuối thu, trùng đúng lúc khách lên đông nhất để xem hoa " +
      "tam giác mạch, nên mùa hồng và mùa du lịch cao điểm gần như chồng lên nhau. Mua thì mua " +
      "ngay tại vườn hoặc tại chợ trong vùng Quản Bạ, chỗ người bán nói được vườn nhà mình ở đâu. " +
      "Quả hồng ngon là quả vỏ căng, màu vàng cam đều, cầm chắc tay và không dập; hồng đã mềm nhũn " +
      "thì thường là hàng để lâu chứ không phải hồng chín tới. Điều bất tiện duy nhất là quả tươi " +
      "dễ dập khi đi xe máy đường đèo, nên nếu mua nhiều thì nên mua vào chặng cuối hành trình.",
    tags: ["quan-ba", "chi-dan-dia-ly", "trai-cay", "theo-vu", "kho-van-chuyen"],
    // Vụ hồng rơi vào quãng cuối thu, chồng lên cả tháng lúa chín và đầu mùa hoa tam giác mạch.
    // Gắn cả hai ô để câu hỏi theo mùa từ hai phía đều gặp được, thay vì chọn một ô rồi bỏ mất
    // một nửa số khách hỏi đúng lúc quả đang có.
    season: ["lua_chin", "hoa_tam_giac_mach"],
    sourceClass: "editorial",
  },
  {
    slug: "food-cam-sanh-ha-giang",
    domain: "food",
    entityType: "specialty",
    entityId: "cam-sanh-ha-giang",
    title: "Cam sành Hà Giang — nông sản của vùng thấp phía nam",
    content:
      "Cam sành Hà Giang là cam vỏ sần dày, múi mọng, vị ngọt đậm pha chua nhẹ, trồng ở vùng đồi " +
      "thấp phía nam địa bàn chứ không phải trên cao nguyên đá. Đây là nông sản chủ lực của vùng " +
      "trồng ấy và là một trong số ít mặt hàng Hà Giang mà người dưới xuôi biết tới trước cả khi " +
      "đi du lịch. Mùa cam rơi vào cuối năm và kéo sang đầu năm sau, tức đúng những tháng rét, và " +
      "ngoài quãng đó thì cam bày bán gắn nhãn Hà Giang phần lớn là cam vùng khác. Điều cần lưu ý " +
      "về hành trình: vùng trồng nằm trên đường từ Hà Nội lên, trước khi tới thành phố Hà Giang, " +
      "nên khách đi ô tô dễ mua dọc quốc lộ còn khách đã lên tới cao nguyên đá thì đã đi qua mất " +
      "rồi. Cam ngon là quả nặng tay so với cỡ, vỏ sần đều và còn cuống lá tươi; vỏ bóng nhẵn bất " +
      "thường thì nên xem lại. Mua tại vườn hoặc ven quốc lộ vùng trồng rẻ hơn nhiều so với mua " +
      "khi đã về tới thành phố lớn, vì phần lớn chênh lệch là cước vận chuyển.",
    tags: ["vung-thap", "chi-dan-dia-ly", "trai-cay", "theo-vu", "duong-tu-ha-noi"],
    season: ["mua_lanh"],
    sourceClass: "editorial",
  },
];
