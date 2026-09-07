import type { KnowledgeSourceDoc } from "./knowledge-source";

/**
 * Tri thức thu thập từ web, đã đối chiếu và biên tập lại.
 *
 * Quan hệ với scripts/crawl-web.ts: crawler ghi bản thô ra scripts/raw-web/, file này là thứ
 * còn lại sau khi người biên tập đọc bản thô, đối chiếu giữa các nguồn và viết lại. Không có
 * đoạn nào ở đây được sao chép nguyên khối từ một trang — mỗi mục là tóm tắt bằng lời của dự án,
 * kèm `sourceUrl` để người dùng tự kiểm chứng.
 *
 * Ba quy tắc đã áp khi biên tập, và lý do:
 *
 * 1. Con số nào các nguồn nói khác nhau thì ghi thành KHOẢNG kèm chữ "tham khảo", không chọn bừa
 *    một con số để nghe cho chắc chắn. Ví dụ vé thuyền sông Nho Quế: các trang ghi 100–150k,
 *    120k, và 500–700k/thuyền cho những loại thuyền khác nhau; gộp thành một con số duy nhất là
 *    tự tạo ra một sự chính xác không có thật.
 *
 * 2. Thông tin pháp lý chỉ lấy từ văn bản gốc (Nghị định 34/2014/NĐ-CP), không lấy từ blog du
 *    lịch. Các blog nói ngược nhau về việc người Việt có cần giấy phép vào khu vực biên giới hay
 *    không, và đây đúng là loại câu hỏi mà trả lời sai gây hậu quả thật cho khách.
 *
 * 3. Số điện thoại, tên chủ thuyền, tên nhà xe cụ thể thì KHÔNG đưa vào. Chúng thay đổi liên tục,
 *    không xác minh được, và một chatbot đọc ra số điện thoại sai là chuyện tệ hơn hẳn việc nói
 *    "hỏi lại homestay". Cùng lý do đã ghi trong mục cứu hộ của knowledge-source.ts.
 */

/** Ngày mọi mục trong file này được đối chiếu lần cuối. Đổi nội dung thì đổi luôn ngày. */
const RETRIEVED_AT = "2026-09-06";

export const WEB_KNOWLEDGE: KnowledgeSourceDoc[] = [
  // ── Địa giới hành chính ────────────────────────────────────────────────────────────────
  {
    slug: "hanh-chinh-ha-giang-sap-nhap-tuyen-quang",
    docType: "policy",
    title: "Hà Giang nay thuộc tỉnh Tuyên Quang — tên gọi hành chính đã đổi",
    sourceUrl:
      "https://www.tuyenquang.gov.vn/vi/post/chinh-thuc-sap-nhap-tinh-tuyen-quang-va-tinh-ha-giang-thanh-tinh-tuyen-quang",
    retrievedAt: RETRIEVED_AT,
    content:
      "Từ ngày 01/7/2025, tỉnh Hà Giang và tỉnh Tuyên Quang đã được sáp nhập thành một tỉnh duy nhất mang tên tỉnh Tuyên Quang. " +
      "Cùng đợt sắp xếp này, cấp huyện được bỏ: các địa danh quen thuộc như Đồng Văn, Mèo Vạc, Quản Bạ, Yên Minh, Hoàng Su Phì, Xín Mần " +
      "không còn là huyện mà trở thành các xã, phường trực thuộc tỉnh. " +
      "Về du lịch thì không có gì thay đổi: cao nguyên đá, các con đèo, các điểm tham quan vẫn ở nguyên chỗ cũ và vẫn được gọi bằng tên cũ. " +
      "Nhưng khi tra cứu giấy tờ hành chính, tìm cơ quan nhà nước hay điền địa chỉ, phải dùng tên tỉnh mới là Tuyên Quang. " +
      "Tên gọi 'Hà Giang' vẫn được dùng rộng rãi như một địa danh du lịch và trong ứng dụng này cũng vậy.",
  },

  // ── Giấy tờ, thủ tục ───────────────────────────────────────────────────────────────────
  {
    slug: "giay-to-khu-vuc-bien-gioi",
    docType: "policy",
    title: "Giấy tờ cần mang khi vào khu vực biên giới Đồng Văn, Mèo Vạc, Lũng Cú",
    sourceUrl:
      "http://bienphongvietnam.gov.vn/nghi-dinh-so-34-2014-nd-cp-ngay-29-04-2014-ve-ve-quy-che-khu-vuc-bien-gioi-dat-lien-nuoc-cong-hoa-xa-hoi-chu-nghia-viet-nam.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Quy định gốc nằm ở Nghị định 34/2014/NĐ-CP về Quy chế khu vực biên giới đất liền. " +
      "Công dân Việt Nam vào khu vực biên giới chỉ cần mang theo giấy tờ tùy thân do cơ quan có thẩm quyền cấp, tức căn cước công dân bản gốc còn hạn — " +
      "KHÔNG phải xin giấy phép riêng. Nhiều bài viết du lịch nói ngược lại điều này, nhưng văn bản pháp luật thì rõ. " +
      "Người nước ngoài thì khác: phải có giấy phép vào khu vực biên giới do Công an cấp tỉnh nơi cư trú hoặc Công an cấp tỉnh nơi đến cấp, cùng hộ chiếu và thị thực hợp lệ. " +
      "Khách nước ngoài nên nhờ chính homestay hoặc đơn vị lữ hành làm giúp thủ tục này trước khi lên cao nguyên đá. " +
      "Mọi trường hợp nghỉ qua đêm trong khu vực biên giới đều phải đăng ký lưu trú tại công an cấp xã sở tại, và riêng khi ngủ trong vành đai biên giới thì còn phải thông báo bằng văn bản cho đồn biên phòng sở tại. " +
      "Trên thực tế các homestay làm giúp khách thủ tục đăng ký lưu trú khi nhận phòng — đó là lý do lễ tân luôn giữ giấy tờ để ghi thông tin. " +
      "Vì quy định có thể được sửa đổi, hãy kiểm tra lại với công an địa phương hoặc đồn biên phòng nếu chuyến đi có yếu tố đặc biệt.",
  },
  {
    slug: "giay-to-lai-xe-may",
    docType: "policy",
    title: "Bằng lái và giấy tờ cần có để tự lái xe máy ở Hà Giang",
    sourceUrl: "https://laca.fun/blog/huong-dan-du-lich-ha-giang-bang-xe-may",
    retrievedAt: RETRIEVED_AT,
    content:
      "Để tự lái xe máy hợp pháp, người Việt cần giấy phép lái xe hạng A1 trở lên — hạng này phủ hầu hết các xe cho thuê ở Hà Giang, gồm xe số, xe tay ga và xe côn tay phổ thông. " +
      "Xe phân khối lớn hơn thì cần hạng cao hơn tương ứng. " +
      "Ngoài bằng lái còn phải mang căn cước công dân, giấy đăng ký xe (cửa hàng thuê sẽ đưa bản sao hoặc bản gốc) và mua bảo hiểm trách nhiệm dân sự nếu xe chưa có. " +
      "Khách nước ngoài cần giấy phép lái xe quốc tế theo Công ước Vienna kèm bằng gốc, hoặc bằng lái Việt Nam; " +
      "bằng lái của nhiều nước không tự động có hiệu lực tại Việt Nam, và lái xe không có bằng hợp lệ thì bảo hiểm sẽ từ chối bồi thường khi xảy ra tai nạn. " +
      "Cửa hàng cho thuê có thể vẫn giao xe mà không hỏi bằng — điều đó không làm cho việc lái xe trở nên hợp pháp.",
  },

  // ── Di chuyển ──────────────────────────────────────────────────────────────────────────
  {
    slug: "di-chuyen-ha-noi-den-ha-giang",
    docType: "faq",
    title: "Đi từ Hà Nội lên Hà Giang bằng cách nào",
    sourceUrl: "https://www.vietravel.com/vn/am-thuc-kham-pha/du-lich-ha-giang-v18000.aspx",
    retrievedAt: RETRIEVED_AT,
    content:
      "Quãng đường Hà Nội đến thành phố Hà Giang khoảng 300 km, đi xe khách mất trong khoảng 6 đến 7 tiếng tùy tình hình giao thông. " +
      "Không có sân bay và không có tàu hỏa lên Hà Giang, nên đường bộ là lựa chọn duy nhất. " +
      "Xe giường nằm và xe limousine chạy hằng ngày với tần suất dày, khởi hành rải từ sáng sớm tới khoảng 22h30, giá vé tham khảo khoảng 250.000 đến 400.000 đồng một lượt tùy loại xe và hạng ghế. " +
      "Xe đêm là lựa chọn phổ biến vì tiết kiệm được một đêm khách sạn và sáng hôm sau bắt đầu hành trình được luôn. " +
      "Nên đặt vé trước, đặc biệt vào cuối tuần và mùa cao điểm tháng 10 đến tháng 11. " +
      "Tự chạy xe máy từ Hà Nội lên là chặng đường dài và mệt; phần lớn người đi chọn gửi xe theo xe khách hoặc thuê xe ngay tại thành phố Hà Giang để giữ sức cho cung đèo phía trên. " +
      "Giá vé và giờ chạy là số liệu tham khảo tại thời điểm biên soạn, phải kiểm tra lại với nhà xe.",
  },
  {
    slug: "thue-xe-may-gia-va-luu-y",
    docType: "faq",
    title: "Thuê xe máy ở Hà Giang: giá, loại xe và những điều cần kiểm tra",
    sourceUrl: "https://motogo.vn/thue-xe-may-ha-giang/",
    retrievedAt: RETRIEVED_AT,
    content:
      "Giá thuê xe máy tại Hà Giang tham khảo khoảng 120.000 đến 200.000 đồng một ngày với xe số và xe tay ga, và khoảng 200.000 đến 350.000 đồng một ngày với xe côn tay 150cc trở lên. " +
      "Xe côn tay được ưa chuộng cho cung cao nguyên đá vì phanh động cơ khỏe khi đổ đèo; xe tay ga thì ngược lại, phanh động cơ rất yếu nên không phù hợp với những con đèo dài. " +
      "Trước khi nhận xe phải tự kiểm tra: độ ăn của cả hai phanh, độ mòn lốp, đèn pha và đèn hậu, còi, gương chiếu hậu, độ căng xích, và mức xăng ban đầu. " +
      "Chụp ảnh hoặc quay video toàn bộ xe lúc nhận để tránh tranh cãi về vết xước khi trả xe. " +
      "Hỏi rõ trước ba điều: xe hỏng dọc đường thì cửa hàng hỗ trợ thế nào, có cho đổi xe không, và chính sách đền bù nếu ngã xe ra sao. " +
      "Lưu số điện thoại cửa hàng ngay khi nhận xe. " +
      "Mức tiêu hao xăng tham khảo khoảng 3 lít cho 100 km, tương đương chừng 70.000 đồng cho mỗi 100 km theo mặt bằng giá thời điểm biên soạn.",
  },
  {
    slug: "tu-lai-hay-easy-rider",
    docType: "faq",
    title: "Nên tự lái xe máy hay thuê easy rider chở",
    sourceUrl:
      "https://ducanhtravel.vn/blog/tour-ha-giang/di-tour-ha-giang-bang-xe-may/so-sanh",
    retrievedAt: RETRIEVED_AT,
    content:
      "Easy rider là hình thức thuê một người lái địa phương chở khách ngồi sau suốt hành trình, khác với tự lái ở chỗ khách không phải cầm lái trên đèo. " +
      "Chi phí tham khảo cho lịch trình ba ngày hai đêm: tự lái vào khoảng 2.800.000 đến 4.000.000 đồng một người, đi easy rider vào khoảng 3.500.000 đến 5.500.000 đồng một người tùy chất lượng dịch vụ. " +
      "Nên chọn easy rider nếu chưa từng chạy xe máy đường đèo dài, tay lái chưa vững, đi vào mùa mưa, hoặc đơn giản là muốn rảnh tay ngắm cảnh và chụp ảnh — " +
      "cung đường này có nhiều đoạn cua gấp sát vực và không phải chỗ để tập lái. " +
      "Tự lái phù hợp với người đã quen đường đèo và muốn chủ động dừng nghỉ theo ý mình. " +
      "Đây là các mức giá tham khảo, phải xác nhận lại trực tiếp với đơn vị cung cấp dịch vụ.",
  },

  // ── Chi phí, vé ────────────────────────────────────────────────────────────────────────
  {
    slug: "gia-ve-tham-quan-cac-diem",
    docType: "faq",
    title: "Giá vé tham quan các điểm chính ở Hà Giang",
    sourceUrl: "https://vietsensetravel.com/gia-ve-cac-diem-tham-quan-ha-giang-n.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Mức vé tham khảo cho người lớn: Phố cổ Đồng Văn khoảng 50.000 đồng, Cột cờ Lũng Cú khoảng 25.000 đồng, Dinh thự Vua Mèo khoảng 20.000 đến 25.000 đồng, Nhà của Pao khoảng 10.000 đồng, Động Lùng Khúy khoảng 50.000 đồng. " +
      "Trẻ em dưới 1,2 mét thường được miễn vé. " +
      "Nhiều điểm nổi tiếng không thu vé vào cửa, trong đó có thung lũng Sủng Là, làng dệt lanh Lùng Tám và bản thân các con đèo. " +
      "Riêng Dinh Vua Mèo các nguồn ghi hai mức khác nhau, nên hãy coi mọi con số ở đây là ước tính chứ không phải giá niêm yết. " +
      "Vé tham quan không bao gồm chi phí gửi xe và cũng không bao gồm vé thuyền sông Nho Quế.",
  },
  {
    slug: "thuyen-song-nho-que-tu-san",
    docType: "faq",
    title: "Đi thuyền sông Nho Quế ngắm hẻm Tu Sản: vé, bến và lưu ý",
    // Tài liệu duy nhất trong file này chỉ nói về đúng một nơi. Mọi mục còn lại — giấy tờ, thuê
    // xe, chợ phiên, lễ hội, sạt lở — đều áp cho cả địa bàn nên để trống `place`.
    place: "nho-que-river",
    sourceUrl: "https://pystravel.vn/tin/18196-gia-ve-song-nho-que.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Chuyến thuyền trên sông Nho Quế đi qua hẻm vực Tu Sản, hẻm vực sâu nhất Đông Nam Á, và là trải nghiệm gần như bắt buộc khi đã tới Mã Pí Lèng. " +
      "Giá vé tham khảo khoảng 100.000 đến 150.000 đồng một người cho thuyền máy ghép khách, kayak tự chèo rẻ hơn, còn thuê trọn một thuyền thì cao hơn nhiều và tùy cỡ thuyền cùng thỏa thuận tại bến. " +
      "Chuyến đi thường kéo dài khoảng 30 phút đến một tiếng. " +
      "Đường từ trên đèo xuống bến thuyền là dốc bê tông rất gắt và hẹp; nếu tay lái chưa vững thì gửi xe ở trên và đi xe ôm xuống, đây là chỗ hay xảy ra ngã xe nhất trong cả hành trình. " +
      "Nên đi buổi sáng vì nước lặng và ánh sáng đẹp hơn, và nên đến sớm vào cuối tuần mùa cao điểm để không phải chờ lâu. " +
      "Luôn mặc áo phao trong suốt hành trình. Khi có mưa lớn hoặc gió mạnh thì không xuống thuyền, kể cả khi bến vẫn nhận khách. " +
      "Giá vé là số liệu tham khảo, thay đổi theo bến và theo mùa.",
  },
  {
    slug: "chi-phi-du-kien-chuyen-di",
    docType: "faq",
    title: "Một chuyến Hà Giang ba ngày hai đêm tốn khoảng bao nhiêu",
    sourceUrl: "https://laca.fun/blog/huong-dan-du-lich-ha-giang-bang-xe-may",
    retrievedAt: RETRIEVED_AT,
    content:
      "Ước tính tham khảo cho một người đi tự túc bằng xe máy trong ba ngày hai đêm, chưa tính vé xe khách khứ hồi từ Hà Nội. " +
      "Thuê xe máy khoảng 120.000 đến 350.000 đồng một ngày tùy loại xe. Xăng cho toàn bộ cung cao nguyên đá khoảng 200.000 đến 300.000 đồng. " +
      "Chỗ ngủ dạng giường tập thể trong homestay khoảng 120.000 đến 200.000 đồng một đêm, phòng riêng thì cao hơn. " +
      "Ăn uống khoảng 120.000 đến 200.000 đồng một ngày. Vé tham quan cộng vé thuyền cả chuyến khoảng 200.000 đến 300.000 đồng. " +
      "Cộng lại vào khoảng 1.500.000 đến 2.500.000 đồng một người cho ba ngày hai đêm nếu đi tiết kiệm. " +
      "Nên mang theo tiền mặt dự phòng cho các khoản phát sinh như sửa xe, thuê xe ôm xuống bến thuyền, hay đổi chỗ ngủ khi kế hoạch thay đổi. " +
      "Đây là ước tính theo mặt bằng giá thời điểm biên soạn và sẽ lạc hậu theo thời gian.",
  },

  // ── Hậu cần trên đường ─────────────────────────────────────────────────────────────────
  {
    slug: "tien-mat-atm-song-dien-thoai",
    docType: "policy",
    title: "Tiền mặt, ATM, sóng điện thoại và xăng trên cung cao nguyên đá",
    sourceUrl: "https://laca.fun/blog/huong-dan-du-lich-ha-giang-bang-xe-may",
    retrievedAt: RETRIEVED_AT,
    content:
      "Cây ATM và ngân hàng chỉ có ở thành phố Hà Giang và các thị trấn lớn là Đồng Văn, Mèo Vạc, Yên Minh, Tam Sơn. " +
      "Ở các xã và bản xa thì gần như không có, nên phải rút đủ tiền mặt trước khi rời thị trấn. " +
      "Nhiều homestay nhỏ, quán ăn ven đường và bến thuyền chỉ nhận tiền mặt, và có nơi cũng không quét được mã QR vì không có sóng. " +
      "Sóng điện thoại phủ tốt trong các thị trấn nhưng mất hẳn ở nhiều đoạn đèo và thung lũng sâu; Viettel là nhà mạng có vùng phủ rộng nhất ở khu vực này. " +
      "Vì vậy hãy tải bản đồ ngoại tuyến trước khi lên đường, và không phụ thuộc vào việc sẽ gọi được điện thoại khi đang ở giữa đèo. " +
      "Cây xăng cũng chỉ tập trung ở thị trấn: hãy đổ đầy bình mỗi khi đi qua một thị trấn thay vì chờ đến khi kim xăng xuống thấp, vì khoảng cách giữa hai cây xăng trên cao nguyên đá có thể lên tới vài chục ki lô mét đường đèo. " +
      "Mang theo sạc dự phòng, vì điện thoại tụt pin rất nhanh khi liên tục dò sóng.",
  },

  // ── An toàn ────────────────────────────────────────────────────────────────────────────
  {
    slug: "an-toan-mua-mua-sat-lo",
    docType: "policy",
    title: "Đi Hà Giang mùa mưa: nguy cơ sạt lở và cách xử trí",
    sourceUrl: "https://nhandan.vn/ha-giang-co-hon-250-diem-nguy-co-sat-lo-cao-post884407.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Toàn tỉnh có hơn 250 điểm được xác định là nguy cơ sạt lở cao, và Quốc lộ 4C — trục đường chính lên cao nguyên đá — là tuyến thường xuyên bị sạt lở khi mưa lớn. " +
      "Mùa mưa chính rơi vào khoảng tháng 6 đến tháng 8, là thời gian nên tránh nếu đi bằng xe máy. " +
      "Mưa lớn có thể làm chia cắt đường và khiến khách mắc kẹt nhiều ngày ở giữa hành trình, kể cả những đoạn nổi tiếng như đường đổ đèo Mã Pí Lèng hay đường xuống sông Nho Quế. " +
      "Nguyên tắc xử trí khi gặp mưa lớn: không cố vượt qua đoạn đang sạt hoặc vừa sạt, vì đất đá còn tiếp tục trôi; không đi qua ngầm tràn khi nước đang chảy xiết; " +
      "không trú dưới ta luy dương, tức vách đất đá dựng đứng bên đường; và không xuống thuyền khi có cảnh báo mưa to gió lớn. " +
      "Khi thấy trời chuyển mưa nặng hạt, phương án đúng là dừng lại ở thị trấn gần nhất chờ tạnh, chấp nhận lỡ lịch trình. " +
      "Trước mỗi ngày di chuyển hãy hỏi chủ homestay về tình trạng đường thực tế — họ nắm tin nhanh hơn mọi ứng dụng.",
  },

  // ── Thời điểm, lễ hội, chợ phiên ───────────────────────────────────────────────────────
  {
    slug: "cho-phien-lich-hop",
    docType: "faq",
    title: "Chợ phiên Hà Giang họp vào ngày nào",
    sourceUrl: "https://motogo.vn/cho-phien-ha-giang/",
    retrievedAt: RETRIEVED_AT,
    content:
      "Các chợ phiên lớn nhất đều họp vào sáng chủ nhật, gồm chợ Đồng Văn, chợ Mèo Vạc, chợ Yên Minh, chợ Hoàng Su Phì và chợ Cốc Pài ở Xín Mần. " +
      "Chợ Mèo Vạc được xem là phiên chợ lớn và đông vui nhất vùng, bắt đầu từ rất sớm, khoảng 4 đến 5 giờ sáng, và vãn dần vào đầu giờ chiều. " +
      "Muốn đi chợ phiên thì nên sắp lịch trình sao cho có mặt ở Đồng Văn hoặc Mèo Vạc vào tối thứ bảy. " +
      "Chợ Quyết Tiến và chợ Tam Sơn ở Quản Bạ họp sáng thứ bảy. " +
      "Một số chợ nhỏ họp theo ngày con giáp chứ không theo thứ trong tuần, ví dụ chợ Lũng Phìn, chợ Sủng Trái, chợ Phó Bảng — " +
      "lịch loại này xoay vòng theo chu kỳ mười hai ngày nên phải hỏi người địa phương để biết phiên gần nhất, và các nguồn trên mạng cũng ghi không thống nhất. " +
      "Đến chợ sớm thì mới thấy được không khí thật, vì khoảng 9 đến 10 giờ là chợ đã bắt đầu thưa.",
  },
  {
    slug: "le-hoi-trong-nam",
    docType: "faq",
    title: "Các lễ hội đáng chú ý ở Hà Giang trong năm",
    sourceUrl: "https://hagiangsensetravel.com/le-hoi-tai-ha-giang-a.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Chợ tình Khâu Vai ở Mèo Vạc là lễ hội nổi tiếng nhất, mỗi năm chỉ họp một lần vào ngày 27 tháng 3 âm lịch, thường rơi vào khoảng tháng 4 hoặc tháng 5 dương lịch. " +
      "Đây vốn là nơi hẹn gặp lại của những người từng yêu nhau nhưng không nên duyên, nay đã thành một sự kiện văn hóa lớn thu hút rất đông khách. " +
      "Lễ hội hoa tam giác mạch tổ chức thường niên vào khoảng tháng 11, đúng vào lúc hoa nở rộ nhất trên cao nguyên đá, với các hoạt động trưng bày, nghệ thuật sắp đặt đá và hoa, trò chơi dân gian của người Mông. " +
      "Lễ hội Gầu Tào của người Mông diễn ra vào dịp đầu xuân, là lễ hội cầu phúc cầu mệnh truyền thống. " +
      "Vào các dịp lễ hội, phòng nghỉ ở Đồng Văn và Mèo Vạc thường kín trước cả tháng và giá tăng mạnh, nên phải đặt sớm. " +
      "Ngày âm lịch thay đổi theo từng năm, hãy tra lại lịch của năm định đi.",
  },

  // ── Văn hóa, ứng xử ────────────────────────────────────────────────────────────────────
  {
    slug: "ung-xu-khi-vao-ban-lang",
    docType: "policy",
    title: "Ứng xử khi vào bản làng và gặp người dân địa phương",
    sourceUrl: "https://vietnamnet.vn/lang-van-hoa-nguoi-mong-niu-chan-khach-du-lich-ha-giang-2192557.html",
    retrievedAt: RETRIEVED_AT,
    content:
      "Hà Giang là địa bàn của nhiều dân tộc, đông nhất là người Mông, bên cạnh đó có Tày, Dao, Lô Lô, Giáy, Pu Péo và nhiều nhóm khác, mỗi nhóm có phong tục riêng. " +
      "Nguyên tắc chung khi vào bản: xin phép trước khi chụp ảnh người dân, đặc biệt là trẻ em và người già, và chấp nhận nếu bị từ chối. " +
      "Không cho trẻ em tiền hay bánh kẹo dọc đường — việc này tạo thói quen xin xỏ và khiến trẻ bỏ học ra đứng đường, đây là vấn đề đã được chính quyền địa phương và các tổ chức phát triển nhiều lần nhắc tới. " +
      "Muốn giúp thì mua hàng của người dân hoặc đóng góp qua nhà trường và các tổ chức tại chỗ. " +
      "Nhiều nhà người Mông có cột thiêng, bàn thờ và khu bếp mà khách không được tùy tiện đụng vào hay ngồi lên; khi vào nhà ai thì hỏi chủ nhà trước và đi theo hướng dẫn của họ. " +
      "Không tự ý bước vào nhà khi thấy cành lá xanh hoặc dấu hiệu kiêng cữ treo trước cửa, đó là báo hiệu nhà đang có việc kiêng người lạ. " +
      "Ăn mặc gọn gàng kín đáo khi vào bản và nơi thờ tự. " +
      "Đi lại nhẹ nhàng, giữ trật tự, không mở nhạc lớn và không xả rác — cao nguyên đá gần như không có hệ thống thu gom rác ở các bản xa.",
  },

  // ── Lưu trú, lộ trình ──────────────────────────────────────────────────────────────────
  {
    slug: "luu-tru-ngu-o-dau",
    docType: "faq",
    title: "Nên ngủ ở đâu trên cung cao nguyên đá",
    sourceUrl: "https://laca.fun/blog/huong-dan-du-lich-ha-giang-bang-xe-may",
    retrievedAt: RETRIEVED_AT,
    content:
      "Bốn điểm dừng nghỉ chính dọc cung đường, theo đúng thứ tự đi lên, là Tam Sơn ở Quản Bạ, Yên Minh, Đồng Văn và Mèo Vạc. " +
      "Lịch trình ba ngày hai đêm phổ biến nhất là ngủ đêm đầu ở Đồng Văn và đêm thứ hai ở Mèo Vạc, vì như vậy sáng hôm sau vượt Mã Pí Lèng lúc trời còn trong. " +
      "Loại hình lưu trú gồm homestay nhà sàn hoặc nhà trình tường, nhà nghỉ và khách sạn nhỏ trong thị trấn; giường tập thể trong homestay là lựa chọn rẻ nhất, tham khảo khoảng 120.000 đến 350.000 đồng một đêm. " +
      "Mùa cao điểm tháng 10 đến tháng 11 và các dịp lễ thì phải đặt phòng trước một đến hai tuần, nếu không rất dễ rơi vào cảnh tối đến nơi mà không còn chỗ. " +
      "Nhiều homestay có bữa tối chung và sinh hoạt lửa trại, nên đặt trước cả bữa ăn vì các thị trấn nhỏ hàng quán đóng cửa sớm. " +
      "Khi nhận phòng nhớ lưu số điện thoại chủ nhà — đó là đầu mối hỗ trợ nhanh nhất nếu hỏng xe hay gặp sự cố trên đường hôm sau.",
  },
  {
    slug: "lo-trinh-ba-ngay-hai-dem",
    docType: "faq",
    title: "Lộ trình gợi ý ba ngày hai đêm cho cung cao nguyên đá",
    sourceUrl: "https://www.vietravel.com/vn/am-thuc-kham-pha/du-lich-ha-giang-v18000.aspx",
    retrievedAt: RETRIEVED_AT,
    content:
      "Ngày thứ nhất đi từ thành phố Hà Giang lên Đồng Văn theo Quốc lộ 4C, khoảng 150 ki lô mét đường đèo, lần lượt qua dốc Bắc Sum, Cổng trời Quản Bạ và núi đôi Quản Bạ, rồi Yên Minh, dốc Thẩm Mã, thung lũng Sủng Là và Dinh thự Vua Mèo ở Sà Phìn, nghỉ đêm tại Đồng Văn. " +
      "Ngày thứ hai đi Lũng Cú thăm cột cờ rồi quay về, buổi chiều vượt đèo Mã Pí Lèng sang Mèo Vạc và xuống thuyền sông Nho Quế ngắm hẻm Tu Sản, nghỉ đêm tại Mèo Vạc. " +
      "Ngày thứ ba quay về thành phố Hà Giang, có thể chọn đường Mậu Duệ qua dốc chữ M để đi một cung khác với lúc lên. " +
      "Nếu chuyến đi trùng cuối tuần thì đảo lịch để có mặt ở Mèo Vạc hoặc Đồng Văn vào sáng chủ nhật cho kịp phiên chợ. " +
      "Quãng đường mỗi ngày nhìn trên bản đồ có vẻ ngắn nhưng toàn đường đèo, tốc độ trung bình chỉ khoảng 30 đến 40 ki lô mét một giờ, nên đừng xếp quá nhiều điểm vào một ngày. " +
      "Luôn tính dư thời gian và cố gắng về tới chỗ nghỉ trước khi trời tối, vì đường đèo không có đèn và sương xuống rất nhanh sau hoàng hôn.",
  },
];
