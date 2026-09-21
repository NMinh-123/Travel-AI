/**
 * CHÍNH SÁCH SẢN PHẨM — nhánh `policy` của kho tri thức.
 *
 * Đây là nhánh duy nhất trong kho không nói về Hà Giang. Nó nói về chính hệ thống đặt chỗ của dự
 * án: đặt thế nào, huỷ ra sao, tiền quay lại lúc nào. Vì thế toàn bộ tài liệu ở đây đều KHÔNG có
 * `entityId` — chúng không thuộc về một địa danh nào, và gắn chúng vào một homestay cụ thể sẽ
 * khiến bộ lọc theo thực thể giấu mất chính sách ở mọi chỗ đặt phòng khác.
 *
 * VÌ SAO TOÀN BỘ FILE LÀ `editorial` VÀ KHÔNG CÓ NGOẠI LỆ. Theo Mục 11.1.1.10, dữ kiện loại suy
 * luận bị cấm đứng ở vị trí giá và chính sách. Một điều khoản huỷ phòng “ước lượng từ mặt bằng
 * thị trường” là thứ vô nghĩa và nguy hiểm: khách đọc nó như cam kết của bên bán, rồi khi mất
 * tiền thì bên bán không hề hứa điều đó. Nên mọi câu trong file này phải là điều dự án tự đặt ra
 * và tự chịu trách nhiệm; câu nào không tự tin đứng tên thì bỏ hẳn chứ không hạ xuống `estimated`.
 *
 * VÌ SAO KHÔNG CÓ MỘT CON SỐ NÀO — KHÔNG PHẦN TRĂM, KHÔNG SỐ NGÀY CỨNG, KHÔNG SỐ TIỀN. Đây là
 * quyết định quan trọng nhất của file và cũng là chỗ dễ bị “sửa cho hữu ích hơn” nhất. Một câu
 * như “huỷ trước 48 giờ được hoàn 100%” khi bị cắt thành chunk sẽ tách rời khỏi mọi điều kiện đi
 * kèm, rồi tác tử trích ra như một lời hứa tuyệt đối cho một cơ sở lưu trú vốn có điều khoản khác
 * hẳn. Đó là tranh chấp tiền bạc, không phải một câu trả lời hơi lệch. Cách xử lý thống nhất:
 * văn bản ở đây mô tả CƠ CHẾ và THỨ TỰ ƯU TIÊN của các điều khoản, còn mốc thời gian và tỷ lệ cụ
 * thể thì luôn được dẫn về bản xác nhận đặt chỗ của từng giao dịch, nơi con số gắn với đúng cơ sở
 * và đúng ngày.
 *
 * NGUYÊN TẮC XUYÊN SUỐT: mọi điều khoản ở đây là MỨC MẶC ĐỊNH của hệ thống. Từng cơ sở lưu trú và
 * từng nhà cung cấp dịch vụ được phép đặt điều khoản riêng chặt hơn, và khi hai bên khác nhau thì
 * điều khoản hiển thị trên trang đặt chỗ cùng bản xác nhận là cái có hiệu lực. Câu này lặp lại
 * trong hầu hết tài liệu dưới đây một cách cố ý: vì chunk bị cắt rời, mỗi đoạn phải tự mang theo
 * cảnh báo đó thay vì trông chờ khách đã đọc đoạn khác.
 */

import type { KnowledgeSourceDoc } from "./types";

export const POLICY_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // ===============================================================================================
  // BOOKING_POLICY — từ lúc bấm đặt tới lúc có chỗ chắc chắn
  // ===============================================================================================
  {
    slug: "policy-quy-trinh-dat-cho-qua-he-thong",
    domain: "policy",
    entityType: "booking_policy",
    title: "Quy trình đặt chỗ qua hệ thống và thời điểm yêu cầu trở thành đặt chỗ",
    content:
      "Một yêu cầu đặt chỗ gửi đi từ hệ thống chưa phải là một chỗ đã giữ. Quy trình có hai bước " +
      "tách bạch và khách cần phân biệt được, vì phần lớn hiểu lầm về sau đều bắt nguồn từ chỗ " +
      "này. Bước một là khách chọn dịch vụ, điền thông tin và gửi yêu cầu; hệ thống ghi nhận và " +
      "chuyển tới cơ sở cung cấp. Bước hai là cơ sở xác nhận còn chỗ và hệ thống phát hành bản xác " +
      "nhận đặt chỗ có mã tra cứu. Chỉ từ thời điểm có bản xác nhận đó thì chỗ mới được coi là đã " +
      "giữ, và cũng chỉ từ thời điểm đó các điều khoản huỷ và hoàn tiền mới bắt đầu áp dụng.\n\n" +
      "Trong khoảng giữa hai bước, chỗ vẫn có thể không còn. Điều này hay xảy ra vào cuối tuần và " +
      "mùa cao điểm ở vùng cao, nơi số phòng của mỗi cơ sở rất ít và cùng lúc được bán trên nhiều " +
      "kênh. Nếu cơ sở báo hết chỗ, hệ thống thông báo lại cho khách và không thu tiền; nếu khoản " +
      "thanh toán đã được ghi nhận thì nó được hoàn theo chính sách hoàn tiền.\n\n" +
      "Bản xác nhận là tài liệu có hiệu lực cao nhất của giao dịch. Nó ghi rõ tên cơ sở, loại dịch " +
      "vụ, thời gian, số khách, tổng tiền, cùng điều khoản huỷ và hoàn tiền áp dụng riêng cho lần " +
      "đặt đó. Những gì viết trong tài liệu chính sách chung này là mức mặc định; khi bản xác nhận " +
      "ghi khác thì bản xác nhận thắng.",
    tags: ["chinh-sach", "dat-cho", "xac-nhan", "ma-tra-cuu", "muc-mac-dinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-thong-tin-khach-va-giay-to-khi-nhan-phong",
    domain: "policy",
    entityType: "booking_policy",
    title: "Thông tin khách cần khai và giấy tờ phải xuất trình khi nhận phòng",
    content:
      "Thông tin khai lúc đặt phải khớp với giấy tờ tuỳ thân mang theo, vì cơ sở lưu trú tại Việt " +
      "Nam có nghĩa vụ khai báo lưu trú cho khách với cơ quan công an. Sai lệch về họ tên hoặc số " +
      "giấy tờ không phải chuyện hình thức: nó có thể khiến cơ sở từ chối nhận phòng dù đã có xác " +
      "nhận, và trường hợp đó được xử lý như khách không đến chứ không như huỷ hợp lệ.\n\n" +
      "Yêu cầu này chặt hơn ở các cơ sở nằm trong khu vực biên giới, nơi ngoài khai báo lưu trú " +
      "thông thường còn có thủ tục thông báo với đồn biên phòng. Với khách nước ngoài, hộ chiếu và " +
      "thị thực còn hiệu lực là bắt buộc, và một số điểm sát biên còn cần giấy phép riêng — phần " +
      "này thuộc quy định về khu vực biên giới, không phải điều hệ thống đặt chỗ quyết định được.\n\n" +
      "Khi cần đổi tên người ở hoặc số lượng khách sau khi đã có xác nhận, hãy báo qua hệ thống " +
      "trước ngày nhận phòng thay vì tự xử lý tại chỗ. Cơ sở có quyền từ chối hoặc thu thêm nếu số " +
      "khách vượt sức chứa đã đặt, và mức thu thêm đó do cơ sở quy định chứ không nằm trong biểu " +
      "phí mặc định của hệ thống.",
    tags: ["chinh-sach", "dat-cho", "giay-to", "khai-bao-luu-tru", "khu-vuc-bien-gioi"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-thay-doi-va-chuyen-ngay-dat-cho",
    domain: "policy",
    entityType: "booking_policy",
    title: "Thay đổi ngày hoặc dịch vụ của một đặt chỗ đã xác nhận",
    content:
      "Đổi ngày không giống huỷ rồi đặt lại, và trong đa số trường hợp thì đổi có lợi hơn cho " +
      "khách. Hệ thống tiếp nhận yêu cầu thay đổi và chuyển tới cơ sở; nếu cơ sở còn chỗ vào ngày " +
      "mới thì bản xác nhận được phát hành lại với cùng mã tra cứu, và phần đã thanh toán được " +
      "chuyển sang giữ nguyên thay vì đưa vào quy trình hoàn tiền.\n\n" +
      "Có hai điều kiện luôn đi kèm. Thứ nhất, thay đổi phải được cơ sở chấp thuận — hệ thống " +
      "không tự quyết thay họ, và ở mùa cao điểm khả năng còn chỗ vào ngày mới là thấp. Thứ hai, " +
      "nếu giá của ngày mới cao hơn thì khách bù phần chênh; nếu thấp hơn thì phần chênh được xử " +
      "lý theo chính sách hoàn tiền chứ không đương nhiên trả lại ngay.\n\n" +
      "Yêu cầu thay đổi gửi càng sớm càng dễ được chấp thuận. Nếu gửi vào sát ngày nhận phòng, " +
      "nhiều cơ sở sẽ xử lý nó như một lần huỷ, tức là áp điều khoản huỷ sát ngày thay vì điều " +
      "khoản đổi lịch. Mốc thời gian phân định hai trường hợp này khác nhau theo từng cơ sở và " +
      "được ghi trong bản xác nhận của chính lần đặt đó.",
    tags: ["chinh-sach", "dat-cho", "doi-ngay", "cao-diem", "muc-mac-dinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // CANCELLATION_POLICY — huỷ chủ động, huỷ sát ngày, và huỷ vì lý do không ai chọn
  //
  // Ba tài liệu tách riêng chứ không gộp làm một, vì đây là ba tình huống có cách xử lý khác hẳn
  // nhau và khách hỏi bằng ba kiểu câu khác hẳn nhau. Gộp lại thì đoạn được truy hồi cho câu “xe
  // không lên được vì sạt lở thì sao” sẽ là đoạn nói về phí huỷ tự nguyện — đúng chủ đề nhưng sai
  // hoàn toàn về nội dung.
  // ===============================================================================================
  {
    slug: "policy-huy-dat-cho-truoc-han",
    domain: "policy",
    entityType: "cancellation_policy",
    title: "Huỷ đặt chỗ trước hạn miễn phí",
    content:
      "Mỗi bản xác nhận đặt chỗ đều ghi một mốc thời gian trước ngày sử dụng dịch vụ, và huỷ trước " +
      "mốc đó thì khách không phải chịu phí huỷ. Mốc này không giống nhau giữa các cơ sở: một " +
      "homestay nhỏ ở vùng cao thường đặt hạn xa hơn một khách sạn ở thành phố, đơn giản vì họ chỉ " +
      "có vài phòng và một lần huỷ sát ngày là mất trắng đêm đó. Đây chính là lý do tài liệu này " +
      "không ghi một con số chung: con số duy nhất đúng là con số trên bản xác nhận của lần đặt " +
      "đang nói tới.\n\n" +
      "Huỷ phải thực hiện qua hệ thống bằng mã tra cứu để có dấu vết thời gian. Nhắn tin riêng cho " +
      "chủ cơ sở có thể được họ đồng ý, nhưng khi đối chiếu về sau thì thứ có giá trị là bản ghi " +
      "của hệ thống; thiếu nó, một lần huỷ đúng hạn vẫn có thể bị tính như huỷ muộn.\n\n" +
      "Huỷ hợp lệ trước hạn sẽ kích hoạt quy trình hoàn tiền cho phần đã thanh toán. Tiền không " +
      "quay về ngay lập tức mà đi theo đường của kênh thanh toán ban đầu; xem tài liệu về thời hạn " +
      "hoàn tiền trong cùng nhóm chính sách này.",
    tags: ["chinh-sach", "huy-dat-cho", "mien-phi-huy", "ma-tra-cuu", "muc-mac-dinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-huy-sat-ngay-va-khong-den-nhan-phong",
    domain: "policy",
    entityType: "cancellation_policy",
    title: "Huỷ sát ngày và trường hợp không đến nhận phòng",
    content:
      "Sau khi đã qua mốc huỷ miễn phí, một lần huỷ sẽ phát sinh phí huỷ, và mức phí tăng dần khi " +
      "càng gần ngày sử dụng dịch vụ. Cơ chế này không nhằm phạt khách mà phản ánh một thực tế: " +
      "càng sát ngày thì cơ sở càng khó bán lại chỗ đó cho người khác, và ở vùng cao thì gần như " +
      "không bán lại được.\n\n" +
      "Không đến nhận phòng mà không báo trước là trường hợp nặng nhất và thường bị tính toàn bộ " +
      "giá trị đêm đầu tiên hoặc toàn bộ đặt chỗ, tuỳ điều khoản của cơ sở. Kèm theo đó, những đêm " +
      "còn lại của cùng lần đặt có thể bị huỷ tự động vì cơ sở không biết khách có tới hay không. " +
      "Vì vậy, ngay cả khi biết chắc mình sẽ mất tiền, việc báo huỷ vẫn có ích: nó giữ lại những " +
      "đêm sau và tránh biến một sự cố một ngày thành hỏng cả chuyến.\n\n" +
      "Đến muộn thì không phải là không đến, nhưng phải báo. Nhiều cơ sở chỉ giữ phòng tới một giờ " +
      "nhất định trong tối; đường lên cao nguyên hay chậm hơn dự tính nên chỉ cần một tin nhắn báo " +
      "giờ tới muộn là đủ giữ chỗ. Mọi mức phí và mốc giờ nêu ở đây là mức mặc định của hệ thống " +
      "và có thể khác theo từng cơ sở — điều khoản in trên bản xác nhận là điều khoản có hiệu lực.",
    tags: ["chinh-sach", "huy-dat-cho", "phi-huy", "khong-den", "den-muon"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-huy-do-thoi-tiet-sat-lo-va-bat-kha-khang",
    domain: "policy",
    entityType: "cancellation_policy",
    title: "Huỷ vì thời tiết xấu, sạt lở đường và các sự kiện bất khả kháng",
    content:
      "Đây là điều khoản đặc thù của một sản phẩm du lịch vùng núi và nó tồn tại vì rủi ro đường " +
      "sá ở đây là rủi ro thật, không phải giả định. Mưa lớn kéo dài, sạt lở làm tắc tuyến, lệnh " +
      "cấm đường của cơ quan chức năng hay thiên tai đều có thể khiến khách không tới được nơi đã " +
      "đặt dù không ai làm gì sai.\n\n" +
      "Nguyên tắc xử lý của hệ thống trong nhóm tình huống này là ưu tiên chuyển ngày thay vì huỷ. " +
      "Chuyển ngày giữ lại toàn bộ giá trị đã thanh toán cho khách và giữ lại doanh thu cho cơ sở, " +
      "nên đó là phương án cả hai bên đều nhận. Khi không thể chuyển được, hệ thống sẽ làm việc " +
      "với cơ sở để miễn hoặc giảm phí huỷ, nhưng cần nói rõ rằng đây là kết quả của thương lượng " +
      "theo từng trường hợp chứ không phải quyền hoàn tiền tự động — dịch vụ đã đặt vẫn sẵn sàng, " +
      "và cơ sở lưu trú ở vùng cao thường không có khả năng gánh toàn bộ phần mất.\n\n" +
      "Để yêu cầu được xem xét, hãy báo càng sớm càng tốt, ngay khi biết đường bị chặn hoặc chuyến " +
      "xe bị huỷ, và gửi kèm bằng chứng như thông báo của nhà xe hoặc thông tin cấm đường. Báo sau " +
      "khi giờ nhận phòng đã trôi qua thì trường hợp sẽ được xử lý như không đến nhận phòng.\n\n" +
      "Điều khoản này không thay thế bảo hiểm du lịch. Với chuyến đi dài ngày hoặc đặt trước xa, " +
      "bảo hiểm có điều khoản gián đoạn hành trình là cách bù đắp đầy đủ hơn nhiều so với chính " +
      "sách của một hệ thống đặt chỗ.",
    tags: ["chinh-sach", "huy-dat-cho", "bat-kha-khang", "sat-lo", "chuyen-ngay", "bao-hiem"],
    season: ["mua_mua"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // PAYMENT_POLICY — tiền đi đường nào và trả vào lúc nào
  // ===============================================================================================
  {
    slug: "policy-phuong-thuc-thanh-toan-duoc-chap-nhan",
    domain: "policy",
    entityType: "payment_policy",
    title: "Các phương thức thanh toán và nguyên tắc chỉ trả qua kênh chính thức",
    content:
      "Hệ thống nhận thanh toán trực tuyến qua các kênh được tích hợp sẵn trên trang thanh toán, " +
      "và một phần dịch vụ cho phép trả trực tiếp tại cơ sở khi nhận phòng. Loại nào áp dụng cho " +
      "lần đặt nào thì hiển thị ngay ở bước đặt chỗ, trước khi khách xác nhận, chứ không thay đổi " +
      "về sau.\n\n" +
      "Có một nguyên tắc an toàn quan trọng hơn mọi điều khoản khác trong tài liệu này: chỉ chuyển " +
      "tiền qua đúng kênh mà hệ thống hiển thị. Hệ thống không bao giờ yêu cầu khách chuyển khoản " +
      "vào tài khoản cá nhân, không nhắn tin đòi thanh toán gấp qua đường dẫn lạ, và không yêu cầu " +
      "cung cấp mã xác thực giao dịch cho bất kỳ ai. Mọi lời đề nghị như vậy, kể cả khi nhắc đúng " +
      "tên và ngày đặt phòng của khách, đều phải bị coi là lừa đảo và nên báo lại cho bộ phận hỗ " +
      "trợ.\n\n" +
      "Giao dịch được ghi bằng đồng Việt Nam. Nếu khách trả bằng thẻ phát hành ở nước ngoài, ngân " +
      "hàng phát hành có thể áp tỷ giá riêng và phí chuyển đổi ngoại tệ; khoản đó thuộc về ngân " +
      "hàng, không phải khoản hệ thống thu, nên nó cũng không nằm trong phần được hoàn khi huỷ.",
    tags: ["chinh-sach", "thanh-toan", "kenh-chinh-thuc", "canh-bao-lua-dao", "ngoai-te"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-dat-coc-va-phan-tien-con-lai",
    domain: "policy",
    entityType: "payment_policy",
    title: "Đặt cọc, phần tiền còn lại và tiền giữ chỗ tại cơ sở",
    content:
      "Nhiều dịch vụ chỉ thu một phần giá trị lúc đặt để giữ chỗ, phần còn lại trả khi nhận phòng " +
      "hoặc trước ngày sử dụng dịch vụ một khoảng nhất định. Tỷ lệ đặt cọc và thời điểm phải trả " +
      "nốt được ghi rõ ở bước thanh toán và trên bản xác nhận, và chúng khác nhau giữa các cơ sở " +
      "nên tài liệu này không nêu một mức chung.\n\n" +
      "Điều cần nắm là hệ quả khi không trả nốt đúng hạn: đặt chỗ có thể bị huỷ tự động và khoản " +
      "đã cọc được xử lý theo điều khoản huỷ đang áp dụng tại thời điểm đó, tức là có thể không " +
      "hoàn lại. Nếu sắp tới hạn mà chưa thu xếp được, hãy báo trước qua hệ thống thay vì để hạn " +
      "trôi qua.\n\n" +
      "Riêng khoản tiền giữ chỗ hoặc tiền đặt cọc thiệt hại mà một số khách sạn thu tại quầy khi " +
      "nhận phòng là khoản của cơ sở, không đi qua hệ thống. Nó được hoàn trực tiếp tại cơ sở khi " +
      "trả phòng, và mọi vướng mắc về khoản này phải giải quyết với cơ sở — hệ thống chỉ hỗ trợ " +
      "liên hệ chứ không đứng ra hoàn thay.",
    tags: ["chinh-sach", "thanh-toan", "dat-coc", "tien-giu-cho", "muc-mac-dinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-phu-thu-thue-va-khoan-tra-tai-cho",
    domain: "policy",
    entityType: "payment_policy",
    title: "Phụ thu mùa cao điểm, thuế phí và những khoản trả tại chỗ",
    content:
      "Giá hiển thị ở bước cuối cùng trước khi xác nhận là giá đã gồm các khoản thuế và phí dịch " +
      "vụ mà hệ thống thu hộ; nếu còn khoản nào phải trả riêng thì nó được liệt kê ngay tại bước " +
      "đó chứ không xuất hiện sau. Nguyên tắc này quan trọng vì nó cho khách một con số duy nhất " +
      "để so sánh và để đối chiếu về sau.\n\n" +
      "Phụ thu mùa cao điểm là chuyện có thật ở vùng này và không nên coi là bất thường. Cuối " +
      "tuần, dịp lễ, mùa hoa tam giác mạch và những ngày có chợ tình đều đẩy giá phòng lên, và " +
      "mức chênh ở các thị trấn nhỏ có thể rất lớn vì tổng số phòng ít. Giá đã chốt trên bản xác " +
      "nhận thì không bị điều chỉnh về sau, kể cả khi giá thị trường của đêm đó tăng tiếp — đây " +
      "chính là lợi ích của việc đặt sớm.\n\n" +
      "Một số khoản luôn nằm ngoài giá đặt phòng vì chúng phát sinh tại chỗ và do khách quyết " +
      "định: bữa ăn không nằm trong gói, đồ uống, giặt là, thuê xe, vé tham quan và phí gửi xe ở " +
      "các điểm. Ở vùng cao thì phần lớn những khoản này vẫn trả bằng tiền mặt.",
    tags: ["chinh-sach", "thanh-toan", "phu-thu", "cao-diem", "khoan-tra-tai-cho"],
    season: ["hoa_tam_giac_mach", "quanh_nam"],
    sourceClass: "editorial",
  },

  // ===============================================================================================
  // REFUND_POLICY — tiền quay lại bằng đường nào và mất bao lâu
  // ===============================================================================================
  {
    slug: "policy-thoi-han-va-duong-di-cua-tien-hoan",
    domain: "policy",
    entityType: "refund_policy",
    title: "Tiền hoàn đi đường nào và vì sao không về ngay lập tức",
    content:
      "Khoản hoàn luôn quay về đúng kênh thanh toán ban đầu: trả bằng thẻ thì hoàn về thẻ đó, " +
      "chuyển khoản thì hoàn về tài khoản đã chuyển. Hệ thống không hoàn sang một tài khoản khác " +
      "theo yêu cầu, và quy tắc này không có ngoại lệ — nó là hàng rào chống việc chiếm đoạt bằng " +
      "cách mạo danh khách để đổi số nhận tiền.\n\n" +
      "Thời gian nhận được tiền gồm hai chặng và khách thường chỉ tính chặng đầu. Chặng một là hệ " +
      "thống duyệt và phát lệnh hoàn sau khi lần huỷ đã được ghi nhận hợp lệ. Chặng hai là ngân " +
      "hàng hoặc đơn vị thanh toán xử lý lệnh đó, và chặng này nằm ngoài tầm kiểm soát của hệ " +
      "thống; với thẻ quốc tế nó thường lâu hơn thẻ nội địa, và một kỳ sao kê có thể trôi qua " +
      "trước khi khoản hoàn hiện lên.\n\n" +
      "Cách kiểm tra đúng khi tiền chưa về là đối chiếu mã tra cứu của đặt chỗ với thông báo hoàn " +
      "tiền mà hệ thống gửi, rồi đưa mã giao dịch đó cho ngân hàng của mình. Mở một yêu cầu hỗ trợ " +
      "mới hoặc đặt lại rồi huỷ lần nữa đều không làm khoản cũ về nhanh hơn.",
    tags: ["chinh-sach", "hoan-tien", "kenh-thanh-toan", "thoi-han", "ma-tra-cuu"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-hoan-tien-mot-phan-va-cac-khoan-khong-hoan",
    domain: "policy",
    entityType: "refund_policy",
    title: "Hoàn một phần, phí đã khấu trừ và những khoản không hoàn lại",
    content:
      "Không phải lần huỷ nào cũng hoàn toàn bộ. Khi lần huỷ rơi vào khoảng đã phát sinh phí, số " +
      "tiền hoàn bằng phần đã thanh toán trừ đi phí huỷ theo điều khoản áp dụng cho chính lần đặt " +
      "đó. Thông báo hoàn tiền của hệ thống luôn tách rõ ba con số — đã trả, đã khấu trừ, thực " +
      "hoàn — để khách đối chiếu được thay vì chỉ thấy một số cuối cùng không hiểu từ đâu ra.\n\n" +
      "Có những khoản về nguyên tắc không nằm trong phần hoàn. Phí chuyển đổi ngoại tệ và phí giao " +
      "dịch do ngân hàng phát hành thẻ thu là khoản của ngân hàng chứ không phải của hệ thống. Các " +
      "dịch vụ đã sử dụng một phần thì phần đã dùng không hoàn, ví dụ khách đã ở hai đêm rồi huỷ " +
      "những đêm còn lại. Và một số hạng đặt chỗ được bán với giá thấp hơn hẳn đúng vì chúng không " +
      "hoàn huỷ; hạng này được đánh dấu rõ ở bước đặt và khách nên cân nhắc trước khi chọn thay vì " +
      "sau khi cần huỷ.\n\n" +
      "Khi đã đổi ngày thay vì huỷ, phần tiền được chuyển sang đặt chỗ mới và không hoàn về tài " +
      "khoản; nếu sau đó khách lại huỷ tiếp thì điều khoản áp dụng là điều khoản của lần đặt mới. " +
      "Toàn bộ những gì nêu ở đây là mức mặc định, còn tỷ lệ khấu trừ cụ thể thì thuộc về bản xác " +
      "nhận của từng giao dịch.",
    tags: ["chinh-sach", "hoan-tien", "hoan-mot-phan", "khong-hoan-huy", "muc-mac-dinh"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
  {
    slug: "policy-khieu-nai-chat-luong-va-tranh-chap",
    domain: "policy",
    entityType: "refund_policy",
    title: "Khiếu nại về chất lượng dịch vụ và cách xử lý tranh chấp",
    content:
      "Khi dịch vụ nhận được khác với những gì đã đặt — sai hạng phòng, thiếu tiện nghi đã cam " +
      "kết, cơ sở không giữ chỗ dù đã có xác nhận — thì đó là khiếu nại chất lượng, và nó đi theo " +
      "một đường khác với việc huỷ. Việc đầu tiên và có hiệu quả nhất là nêu ngay với cơ sở tại " +
      "chỗ, vì phần lớn trường hợp được giải quyết bằng cách đổi phòng hoặc bù dịch vụ trong vài " +
      "phút.\n\n" +
      "Nếu không giải quyết được tại chỗ, hãy mở khiếu nại qua hệ thống kèm mã tra cứu, càng sớm " +
      "càng tốt và tốt nhất là trong lúc còn đang lưu trú. Ảnh chụp hiện trạng, tin nhắn trao đổi " +
      "với cơ sở và biên nhận là những thứ quyết định kết quả; khiếu nại gửi nhiều ngày sau khi " +
      "trả phòng rất khó xác minh vì hiện trạng đã thay đổi.\n\n" +
      "Hệ thống đóng vai trò trung gian đối chiếu giữa hai bên và có thể xử lý bằng hoàn một phần, " +
      "hoàn toàn bộ hoặc bù bằng dịch vụ khác, tuỳ mức độ và tuỳ bằng chứng. Cần nói rõ giới hạn: " +
      "hệ thống không phải bên cung cấp dịch vụ lưu trú và không quyết định thay cơ sở trong mọi " +
      "trường hợp. Với những tranh chấp không thoả thuận được, khách vẫn giữ nguyên quyền khiếu " +
      "nại theo pháp luật bảo vệ quyền lợi người tiêu dùng, và bản xác nhận đặt chỗ cùng chứng từ " +
      "thanh toán là hồ sơ gốc của giao dịch.",
    tags: ["chinh-sach", "khieu-nai", "tranh-chap", "bang-chung", "trung-gian"],
    season: ["quanh_nam"],
    sourceClass: "editorial",
  },
];
