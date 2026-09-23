import type { WebSource } from "@data/knowledge/types";

/**
 * DANH SÁCH NGUỒN THU THẬP — đầu vào của `npm run db:crawl`.
 *
 * File này CỐ TÌNH không nối thẳng vào đường ống ingest. Crawler chỉ tải văn bản đã bóc ra
 * `data/raw-web/` để người biên tập đọc rồi chắt lọc thành `KnowledgeSourceDoc` mang
 * `sourceClass: "crawled_verified"`. Ranh giới này là FR-BOT-05: chatbot chỉ được nói trong phạm
 * vi tri thức đã kiểm duyệt. Đổ thẳng nội dung của mười mấy trang du lịch vào vector store là
 * mời chatbot trích dẫn quảng cáo, giá đã lạc hậu và những câu mà không ai trong dự án từng đọc.
 *
 * VỀ ĐỘ TIN CẬY CỦA CHÍNH DANH SÁCH NÀY. Đây là điều phải nói thẳng: các URL dưới đây là điểm
 * KHỞI ĐẦU, không phải danh sách đã xác minh từng đường dẫn. Cấu trúc URL của báo và của trang
 * thương mại đổi khá thường xuyên, nên một số mục có thể đã dời hoặc đổi dạng. Đây không phải lỗ
 * hổng im lặng: `scripts/crawl-web.ts` ghi `manifest.json` kèm trạng thái từng URL, nên nguồn
 * nào chết sẽ hiện ra ở lần crawl đầu tiên. Việc cần làm sau lần crawl đó là sửa hoặc bỏ các mục
 * lỗi ngay trong file này, chứ đừng để crawler báo lỗi lặp lại mỗi lần chạy.
 *
 * VÌ SAO PHÂN TIER. Khi hai trang nói khác nhau về cùng một điều — giờ mở cửa, giá vé, quy định
 * giấy tờ biên giới — thì phải có quy tắc chọn, và quy tắc đó là `tier`. Trang của cơ quan nhà
 * nước thắng báo chí, báo chí thắng đơn vị lữ hành, và đơn vị lữ hành thắng blog. Thứ tự này
 * KHÔNG áp cho mọi loại thông tin: về kinh nghiệm thực tế trên đường thì blog và diễn đàn thường
 * đúng hơn trang chính thức, còn trang của đơn vị lữ hành thì có lợi ích thương mại nên phần giá
 * và phần "tour của chúng tôi tốt nhất" cần đọc rất dè dặt. Đó là lý do `tier` là dữ liệu để
 * người biên tập cân nhắc, không phải một trọng số tự động.
 *
 * VÌ SAO CÓ CẢ BOOKING VÀ AGODA TRONG DANH SÁCH. Hai trang này không dùng để lấy tri thức mà để
 * ĐỐI CHIẾU MẶT BẰNG GIÁ cho các `PriceEstimate` trong @data/places/lodging. Chúng là nguồn được
 * dẫn trong `sourceUrls` của giá ước lượng, nên phải có mặt ở đây để người soát lại biết giá đã
 * suy từ đâu. Cả hai đều dựng bằng JavaScript và chặn bot, nên `crawlable` đặt false — crawler sẽ
 * bỏ qua và ghi log, thay vì thử rồi nhận về một trang rỗng trông như đã tải thành công.
 */
export const WEB_SOURCES: WebSource[] = [
  // ---------------------------------------------------------------------------
  // official — cơ quan nhà nước và ban quản lý. Thắng mọi nguồn khác về quy định và địa giới.
  // ---------------------------------------------------------------------------
  {
    id: "tuyenquang-cong-thong-tin",
    url: "https://tuyenquang.gov.vn",
    purpose:
      "Cổng thông tin tỉnh Tuyên Quang. Nguồn duy nhất đáng tin về địa giới và tên đơn vị hành " +
      "chính sau đợt sáp nhập 01/7/2025 — đúng nhóm câu hỏi mà mọi bài viết cũ trên mạng đều trả " +
      "lời sai vì được viết trước mốc đó.",
    domain: "travel_guide",
    tier: "official",
    crawlable: true,
  },
  {
    id: "vietnamtourism-cuc-du-lich",
    url: "https://vietnamtourism.gov.vn",
    purpose:
      "Cục Du lịch Quốc gia Việt Nam. Dùng cho quy định chung về khách du lịch, thủ tục với khách " +
      "nước ngoài và các thông báo chính thức về điểm đến.",
    domain: "policy",
    tier: "official",
    crawlable: true,
  },
  {
    id: "dongvan-geopark",
    url: "https://dongvangeopark.com",
    purpose:
      "Trang của Công viên địa chất toàn cầu Cao nguyên đá Đồng Văn. Nguồn cho phần địa chất, " +
      "danh hiệu UNESCO và các điểm trong vùng công viên. Cấu trúc trang này hay đổi — kiểm " +
      "manifest sau lần crawl đầu.",
    domain: "attraction",
    tier: "official",
    crawlable: true,
  },

  {
    id: "vietnamtourism-nongthon-bai-da-co-nam-dan",
    url: "https://nongthon.vietnamtourism.gov.vn/ve-dep-bi-an-cua-bai-da-co-nam-dan-ha-giang/",
    purpose:
      "Chuyên trang du lịch nông thôn của Cục Du lịch, bài về di tích khảo cổ cấp quốc gia Bãi " +
      "đá cổ Nấm Dẩn. Chọn nguồn nhà nước vì niên đại và xếp hạng di tích là đúng chỗ mà blog du " +
      "lịch hay chép lệch nhau. Lấp khoảng trống của Place `bai-da-co-nam-dan`. " +
      "Đã thử `tuyengiao.hagiang.gov.vn` trước: trang dựng bằng JavaScript, crawler chỉ bóc được " +
      "27 ký tự nên không dùng được.",
    domain: "attraction",
    tier: "official",
    crawlable: true,
  },
  // ---------------------------------------------------------------------------
  // press — báo chí chính thống. Mạnh nhất ở tin thời sự: sạt lở, cấm đường, sự kiện, lễ hội.
  // ---------------------------------------------------------------------------
  {
    id: "vnexpress-du-lich",
    url: "https://vnexpress.net/du-lich",
    purpose:
      "Chuyên mục du lịch VnExpress. Bổ khuyết nhóm câu hỏi về lịch trình thực tế và về tình " +
      "hình đường sá theo mùa, vì đây là nơi đưa tin nhanh khi có sạt lở hay cấm đường.",
    domain: "travel_guide",
    tier: "press",
    crawlable: true,
  },
  {
    id: "dantri-du-lich",
    url: "https://dantri.com.vn/du-lich.htm",
    purpose:
      "Chuyên mục du lịch Dân trí. Dùng đối chiếu với VnExpress cho cùng một sự kiện — hai nguồn " +
      "độc lập nói giống nhau thì mới đưa vào tri thức.",
    domain: "travel_guide",
    tier: "press",
    crawlable: true,
  },
  {
    id: "laodong-du-lich",
    url: "https://laodong.vn/du-lich",
    purpose:
      "Chuyên mục du lịch báo Lao Động. Hay có bài về mùa hoa và mùa lúa kèm thời điểm cụ thể " +
      "của từng năm, là loại dữ liệu mà bảng mùa tĩnh không nắm được.",
    domain: "seasonal_recommendation",
    tier: "press",
    crawlable: true,
  },
  {
    id: "baotuyenquang",
    url: "https://baotuyenquang.com.vn",
    purpose:
      "Báo Tuyên Quang — báo địa phương của tỉnh sau sáp nhập. Nguồn tốt nhất cho tin cấp xã: " +
      "lịch chợ phiên thay đổi, lễ hội trong năm, đường liên xã bị hỏng. Những thứ này không lên " +
      "báo trung ương.",
    domain: "travel_guide",
    tier: "press",
    crawlable: true,
  },
  {
    id: "baodantoc",
    url: "https://baodantoc.vn",
    purpose:
      "Báo Dân tộc và Phát triển. Nguồn chủ lực cho mặt văn hoá: phong tục, lễ hội, nghề truyền " +
      "thống của các dân tộc trong vùng, viết bởi người theo dõi lĩnh vực này lâu dài. Ưu tiên " +
      "nguồn này hơn blog du lịch khi nói về văn hoá dân tộc, vì đây là nhóm nội dung dễ bị viết " +
      "theo lối kỳ lạ hoá nhất.",
    domain: "attraction",
    tier: "press",
    crawlable: true,
  },
  {
    id: "nhandan-du-lich",
    url: "https://nhandan.vn/du-lich",
    purpose:
      "Chuyên mục du lịch báo Nhân Dân. Dùng cho các nội dung mang tính chính sách và các sự kiện " +
      "cấp tỉnh được công bố chính thức.",
    domain: "policy",
    tier: "press",
    crawlable: true,
  },
  {
    id: "thanhnien-du-lich",
    url: "https://thanhnien.vn/du-lich",
    purpose:
      "Chuyên mục du lịch báo Thanh Niên. Nhiều bài dạng trải nghiệm của người đi thật, nằm giữa " +
      "báo chí và nội dung cộng đồng, hữu ích cho mặt kinh nghiệm ngắm cảnh.",
    domain: "attraction",
    tier: "press",
    crawlable: true,
  },
  {
    id: "vov-du-lich",
    url: "https://vov.vn/du-lich",
    purpose:
      "Chuyên mục du lịch của VOV. Nguồn dự phòng cho tin sự kiện và lễ hội khi hai nguồn báo " +
      "chính không phủ.",
    domain: "travel_guide",
    tier: "press",
    crawlable: true,
  },

  {
    id: "vnexpress-lang-du-lich-pa-vi",
    url: "https://vnexpress.net/tu-bai-dat-lay-thanh-lang-du-lich-pa-vi-noi-tieng-the-gioi-4951713.html",
    purpose:
      "Làng văn hoá du lịch cộng đồng dân tộc Mông thôn Pả Vi Hạ, ngay chân đèo Mã Pí Lèng. Lấp " +
      "khoảng trống của Place `lang-van-hoa-pa-vi-ha`. " +
      "Đã thử trang Cục Du lịch `vietnamtourism.gov.vn/post/60465` trước — đúng tier hơn — nhưng " +
      "nó dựng bằng JavaScript và crawler chỉ bóc được 6 ký tự.",
    domain: "attraction",
    tier: "press",
    crawlable: true,
  },
  {
    id: "vnexpress-chieu-lau-thi",
    url: "https://vnexpress.net/san-may-tren-dinh-chieu-lau-thi-4246378.html",
    purpose:
      "Bài về đỉnh Chiêu Lầu Thi, ngọn cao thứ hai Hà Giang và là điểm săn mây chính của Hoàng " +
      "Su Phì. Lấp khoảng trống của Place `dinh-chieu-lau-thi`, đồng thời bù cho phía TÂY tỉnh — " +
      "vùng gần như vắng mặt trong kho hiện tại so với trục Đồng Văn – Mèo Vạc.",
    domain: "attraction",
    tier: "press",
    crawlable: true,
  },
  {
    id: "vnexpress-suoi-thau",
    url: "https://vnexpress.net/suoi-thau-thao-nguyen-chau-au-o-ha-giang-4462972.html",
    purpose:
      "Bài về thảo nguyên Suôi Thầu ở Xín Mần. Lấp khoảng trống của Place `thao-nguyen-suoi-thau`, " +
      "cùng nhóm phía tây với Chiêu Lầu Thi.",
    domain: "attraction",
    tier: "press",
    crawlable: true,
  },
  {
    id: "vnexpress-tam-giac-mach-suoi-thau",
    url: "https://vnexpress.net/mua-hoa-tam-giac-mach-tren-thao-nguyen-suoi-thau-4666124.html",
    purpose:
      "Mùa hoa tam giác mạch trên Suôi Thầu. Nhắm vào lĩnh vực `seasonal_recommendation` — lĩnh " +
      "vực mỏng nhất kho, chỉ 5 đoạn trên tổng 162, trong khi 'đi mùa nào' là một trong những " +
      "câu khách hỏi nhiều nhất.",
    domain: "seasonal_recommendation",
    tier: "press",
    crawlable: true,
  },
  // ---------------------------------------------------------------------------
  // operator — đơn vị lữ hành và nhà cung cấp dịch vụ. Có lợi ích thương mại: đọc dè dặt.
  // ---------------------------------------------------------------------------
  {
    id: "vietravel",
    url: "https://travel.com.vn",
    purpose:
      "Vietravel. Dùng cho cấu trúc lịch trình tour nhiều ngày và mặt bằng giá tour — phần khung " +
      "chương trình thì đáng tham khảo, phần quảng cáo thì bỏ.",
    domain: "tour",
    tier: "operator",
    crawlable: true,
  },
  {
    id: "ivivu",
    url: "https://www.ivivu.com",
    purpose:
      "iVIVU. Nguồn đối chiếu giá phòng và danh sách cơ sở lưu trú ở thành phố Hà Giang và các " +
      "thị trấn, nơi có nhiều khách sạn thương mại.",
    domain: "accommodation",
    tier: "operator",
    crawlable: true,
  },
  {
    id: "traveloka-vi",
    url: "https://www.traveloka.com/vi-vn",
    purpose:
      "Traveloka bản tiếng Việt. Dùng làm nguồn dẫn trong sourceUrls của các PriceEstimate về " +
      "lưu trú, cùng vai trò với Booking và Agoda.",
    domain: "accommodation",
    tier: "operator",
    crawlable: false,
  },
  {
    id: "booking-com",
    url: "https://www.booking.com",
    purpose:
      "Đối chiếu mặt bằng giá phòng, KHÔNG dùng để lấy tri thức. Là nguồn được dẫn trong " +
      "sourceUrls của PriceEstimate. KHÔNG crawl được, và lý do đã đo cụ thể ngày 2026-09-10: " +
      "robots.txt của họ KHÔNG cấm /searchresults với User-agent * (ba nhóm Disallow: / trong đó " +
      "thuộc psbot, TurnitinBot, NPBot và Yandex), nhưng phản hồi thực tế là trang thử thách " +
      "JavaScript của AWS WAF — 3.962 byte, chứa awsWafCookieDomainList và chal_t, tham số ss= bị " +
      "cắt khi redirect, không một dòng giá. Vượt thử thách đó là né hệ thống chống bot nên không " +
      "làm. Đường chính thức là Booking.com Demand API, cần xét duyệt đối tác. Trong lúc chưa có, " +
      "dùng `npx tsx scripts/verify-lodging-prices.ts` để đối chiếu giá bằng tay.",
    domain: "accommodation",
    tier: "operator",
    crawlable: false,
  },
  {
    id: "agoda-com",
    url: "https://www.agoda.com",
    purpose:
      "Cùng vai trò với Booking: đối chiếu giá phòng cho PriceEstimate. Độ phủ Đông Nam Á tốt " +
      "hơn nhưng vẫn thiếu phần lớn homestay bản. Không crawl được.",
    domain: "accommodation",
    tier: "operator",
    crawlable: false,
  },
  {
    id: "motogo-thue-xe",
    url: "https://motogo.vn",
    purpose:
      "Đơn vị cho thuê xe máy đi tuyến phía Bắc. Dùng cho mặt bằng giá thuê xe, loại xe phù hợp " +
      "đường đèo và các điều khoản thuê — nhóm câu hỏi mà không nguồn chính thức nào trả lời.",
    domain: "travel_guide",
    tier: "operator",
    crawlable: true,
  },

  // ---------------------------------------------------------------------------
  // community — blog và nền tảng đánh giá. Tốt cho kinh nghiệm thực tế, kém cho số liệu.
  // ---------------------------------------------------------------------------
  {
    id: "mia-dong-lung-khuy",
    url: "https://mia.vn/cam-nang-du-lich/kham-pha-dong-lung-khuy-muon-mau-muon-ve-de-nhat-dong-ha-giang-3587",
    purpose:
      "Động Lùng Khúy ở Quản Bạ. Lấp khoảng trống của Place `dong-lung-khuy`. Đặt ở tier " +
      "`community` vì không tìm được bài của cơ quan nhà nước hay báo chính thống về điểm này — " +
      "nghĩa là phần GIÁ VÉ và giờ mở cửa trong bài phải đối chiếu lại trước khi biên tập, còn " +
      "phần mô tả hang và đường đi thì dùng được.",
    domain: "attraction",
    tier: "community",
    crawlable: true,
  },
  {
    id: "mia-cam-nang",
    url: "https://mia.vn/cam-nang-du-lich",
    purpose:
      "Cẩm nang du lịch MIA.vn. Nhiều bài chi tiết về chỗ ăn, chỗ nghỉ và lộ trình theo ngày. Là " +
      "nguồn tốt để lập danh sách ứng viên quán ăn và homestay, nhưng mọi giá và mọi giờ mở cửa " +
      "lấy từ đây đều phải đối chiếu lại.",
    domain: "food",
    tier: "community",
    crawlable: true,
  },
  {
    id: "tripadvisor-vn",
    url: "https://www.tripadvisor.com.vn",
    purpose:
      "KHÔNG ĐƯỢC THU THẬP, và đây là lý do mạnh hơn mọi lý do kỹ thuật: robots.txt của " +
      "TripAdvisor liệt kê đích danh ClaudeBot trong nhóm bot AI kèm `Disallow: /`, tức cấm toàn " +
      "bộ site — cùng nhóm với GPTBot, CCBot, Bytespider, meta-externalagent. Kiểm ngày " +
      "2026-09-10. Khác với Booking.com (robots.txt cho phép, chỉ WAF chặn), ở đây chủ site đã " +
      "nói rõ bằng văn bản máy đọc được, nên không tải bất kỳ đường dẫn nào kể cả những chỗ nhóm " +
      "`*` được phép. Giữ mục này lại chính là để lần sau không ai nối crawler vào đây. " +
      "Ngoài ra, ngay cả khi được phép thì review vẫn không dùng được: đó là nội dung người dùng " +
      "tạo, đúng loại mà FR-BOT-05 loại trừ.",
    domain: "food",
    tier: "community",
    crawlable: false,
  },
];

/**
 * Kiểu được xuất lại ở đây để `scripts/crawl-web.ts` chỉ cần import một nơi: nó vốn đã đọc
 * WEB_SOURCES từ file này, và bắt nó lấy thêm kiểu từ @data/knowledge/types là chia một khái
 * niệm sang hai đường import mà không được gì.
 */
export type { WebSource } from "@data/knowledge/types";
