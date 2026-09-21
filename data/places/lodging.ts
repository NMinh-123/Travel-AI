/**
 * DANH SÁCH ỨNG VIÊN CƠ SỞ LƯU TRÚ — homestay, nhà nghỉ và khách sạn dọc cung Hà Giang.
 *
 * VÌ SAO KHÔNG NẰM CHUNG VỚI geography.ts. Cây địa lý gần như bất biến: một con đèo không đổi
 * chủ, một bản làng không ngừng nhận khách. Cơ sở lưu trú thì ngược hẳn — đổi tên, sang nhượng,
 * đóng cửa sau một mùa ế, và mỗi lần như vậy là một lần phải sửa dữ liệu. Nếu để chung, mọi lần
 * cập nhật danh sách homestay đều là một lần chạm vào chính file mà bộ phân giải địa danh và
 * toàn bộ `entityId` của kho tri thức đang tựa vào. Tách ra, file này được phép thay đổi hằng
 * tháng mà không ai phải lo cây địa danh gãy theo.
 *
 * ĐÂY LÀ DANH SÁCH ỨNG VIÊN, KHÔNG PHẢI DANH BẠ ĐÃ XÁC MINH. Không có nguồn chính thức nào công
 * bố cơ sở lưu trú của địa bàn này, nên mọi mục dưới đây là nơi được nhắc đi nhắc lại trên báo,
 * trên các trang đặt phòng và trong hội nhóm đi cung — chứ không phải nơi người viết đã gọi điện
 * xác nhận. Hệ quả bắt buộc: mỗi mục đều mang tag "can-xac-minh-places" và `geo.precision` là
 * "approximate", và tầng trên phải coi một mục mà Google Places không khớp được là CHƯA XÁC NHẬN
 * thay vì đọc thẳng tên đó ra cho khách. Sự tồn tại, giờ nhận phòng và tình trạng còn hoạt động
 * là dữ liệu động, thuộc về adapter Places lúc chạy, không thuộc về file tĩnh này.
 *
 * VÌ SAO SỐ MỤC ÍT HƠN NHIỀU SO VỚI SỐ CHỖ NGỦ CÓ THẬT. Riêng thị trấn Đồng Văn và Mèo Vạc đã có
 * hàng trăm chỗ ngủ, và viết dài ra thì rất dễ. Nhưng một cái tên bịa nghe hợp lý sẽ được khách
 * gõ vào Google, không ra kết quả nào, và từ giây đó toàn bộ phần còn lại của câu trả lời mất
 * tín nhiệm — kể cả những phần đúng. Nên nguyên tắc ở đây là thà thiếu còn hơn sai: chỉ giữ
 * những cái tên mà người viết thực sự gặp nhiều lần ở nguồn độc lập với nhau.
 *
 * CHỈ CÒN MỘT MỤC "CỤM", VÀ ĐÂY LÀ LÝ DO. Ban đầu Lô Lô Chải, Pả Vi và Thôn Tha đều được gộp
 * thành mục cụm, với lập luận: vài chục hộ trong cùng một bản có cùng kiểu nhà, CÙNG MẶT BẰNG
 * GIÁ và cùng điều kiện sinh hoạt, nên đặt tên bừa một hộ là vừa bịa vừa bất công với các hộ
 * còn lại.
 *
 * Vế "cùng mặt bằng giá" đã bị chính dữ liệu bác bỏ. Đọc giá thật trên iVIVU ngày 2026-09-10:
 * trong cùng bản Lô Lô Chải, À Lôi 857.912đ còn Mùa Pửi 362.448đ; ở Pả Vi, Beehive House
 * 1.021.583đ còn O'Chau 1.707.686đ. Chênh hơn gấp đôi trong cùng một bản, tức một khoảng giá gộp
 * che mất đúng khác biệt mà khách cần để chọn. Hai nơi đó nay là các mục CÓ TÊN.
 *
 * Thôn Tha vẫn là mục cụm vì iVIVU không liệt kê hộ nào ở đó — và giữ nó là có chủ đích: một bản
 * có thật mà sàn OTA không phủ thì vẫn phải có mặt trong danh mục, nếu không thì danh mục chỉ
 * còn phản ánh những gì bán được online.
 *
 * Ràng buộc của mục cụm giữ nguyên: KHÔNG bao giờ gán `googlePlaceId`, và tầng trả lời phải
 * trình bày nó như một khu vực để tìm chỗ ngủ chứ không phải một cơ sở để đặt phòng. Đọc nhầm
 * một cụm thành một khách sạn là hứa với khách một thứ không có số điện thoại để gọi.
 *
 * THIÊN LỆCH PHẢI NHẬN sau khi chuyển sang mục có tên: danh mục giờ nghiêng về hộ nào có mặt
 * trên sàn OTA. Những hộ chỉ nhận khách tới nơi mới hỏi vẫn tồn tại và vẫn đông. Vì vậy tầng trả
 * lời không được nói "bản này có hai chỗ nghỉ" — đúng phải là "hai chỗ đặt trước được".
 *
 * HAI LOẠI `sourceUrls`, VÀ CHÚNG NÓI HAI ĐIỀU KHÁC NHAU. Mục mang `basis: "market_estimate"` trỏ
 * tới TRANG TÌM KIẾM THEO ĐỊA BÀN, vì việc đã làm đúng là xem mặt bằng giá của cả vùng trong một
 * ngày rồi lấy khoảng — một đường dẫn tới đúng phòng của một cơ sở sẽ trông như bằng chứng đã
 * kiểm chứng cơ sở đó, mà việc kiểm chứng thì để dành cho Places lúc chạy. Ngược lại, mục mang
 * `basis: "ota_observed"` trỏ THẲNG tới trang cơ sở đó trên iVIVU, vì ở đó con số thật sự được
 * đọc từ đúng trang ấy vào đúng ngày ghi trong `surveyedAt`.
 *
 * VỀ ĐỊA CHỈ. Chỉ ghi tới mức thôn/xã. Số nhà và tên đường ở đây phần lớn là thứ người viết
 * không kiểm chứng được, mà một địa chỉ sai tới từng số nhà thì tệ hơn hẳn một địa chỉ đúng tới
 * mức xã: khách sẽ tin nó và chạy tới tận nơi. Tên tỉnh trong địa chỉ là Tuyên Quang theo địa
 * giới sau 01/7/2025, dù mọi trang đặt phòng vẫn còn ghi "Hà Giang" — chỗ này cố tình lệch với
 * nguồn, vì danh mục phải đúng địa giới hiện hành, còn việc khách quen tên cũ đã được `aliases`
 * và cây vùng ở @data/places/geography lo.
 *
 * VỀ TOẠ ĐỘ. Gần như mọi mục dùng lại toạ độ của xã hoặc bản chứa nó thay vì một điểm riêng.
 * Đó là lựa chọn có chủ ý: một toạ độ riêng cho từng nhà sẽ ngụ ý độ chính xác tới từng công
 * trình mà người viết không có. Ở mức xã thì toạ độ vẫn đủ dùng cho đúng hai việc mà tầng trên
 * cần — gọi dự báo thời tiết theo độ cao và ước lượng chặng đường — và không đủ để ai đó lỡ tay
 * dùng làm điểm dẫn đường.
 *
 * VỀ GIÁ. Mọi mục là `PriceEstimate` với `unit: "per_night"`, nhưng XUẤT XỨ KHÔNG ĐỒNG NHẤT và
 * đừng đọc chúng như nhau:
 *
 *   - `market_estimate` (phần lớn, khảo 2026-09-09) — SUY từ mặt bằng các cơ sở tương đương.
 *     Khoảng giá là phòng đôi mùa thường.
 *   - `ota_observed` (2026-09-10) — ĐỌC ĐƯỢC trên iVIVU vào một ngày cụ thể. Mạnh hơn hẳn, nhưng
 *     một lần đọc chỉ cho MỘT ĐIỂM, nên các mục này thường có `minVnd` bằng `maxVnd` thay vì bịa
 *     ra một dải. Chạy `npx tsx scripts/fetch-ivivu-prices.ts` để đọc lại.
 *
 * Dù xuất xứ nào, trường `note` của từng mục ghi rõ mùa hoa tam giác mạch tháng 10–11 đẩy giá lên
 * bao nhiêu — đó là sai lệch lớn nhất và cũng là lúc nhiều khách hỏi giá nhất. Bỏ ghi chú đó đi
 * thì tác tử sẽ báo giá mùa thấp điểm cho một người đang định đi đúng cao điểm.
 *
 * QUY ƯỚC `sortOrder`. Theo thứ tự hành trình như geography.ts — thành phố Hà Giang, Quản Bạ,
 * Yên Minh và Du Già, Đồng Văn, Lũng Cú, rồi Mèo Vạc — và cố ý dùng CHUNG thang số với file đó,
 * để khi màn hình gợi ý trộn hai mảng lại thì chỗ ngủ rơi đúng vào chặng của nó thay vì dồn hết
 * xuống cuối danh sách.
 */

import type { Place } from "./types";

export const LODGING_PLACES: Place[] = [
  // ---------------------------------------------------------------------------------------------
  // THÀNH PHỐ HÀ GIANG — ĐÊM ĐẦU VÀ ĐÊM CUỐI
  //
  // Đây là chặng có nhiều phòng nhất và cũng là chặng ít rủi ro dữ liệu nhất: cơ sở ở đây là
  // khách sạn đúng nghĩa, có mặt trên các trang đặt phòng quốc tế, tồn tại lâu năm. Phần lớn
  // khách ngủ ở đây một đêm trước khi lên cung và một đêm sau khi về, nên câu hỏi thật thường là
  // "gần bến xe không" và "có gửi được đồ thừa trong lúc chạy cung không".
  // ---------------------------------------------------------------------------------------------
  {
    slug: "ks-yen-bien-luxury",
    name: "Khách sạn Yên Biên Luxury",
    nameEn: "Yen Bien Luxury Hotel",
    aliases: ["yen bien luxury", "khach san yen bien luxury", "yen bien hotel", "yen bien luxury hotel ha giang"],
    kind: "hotel",
    parentSlug: "tp-ha-giang",
    address: "Khu trung tâm thành phố Hà Giang, ven sông Lô, tỉnh Tuyên Quang",
    // Đây là mức cao nhất mà thành phố có, và tên nó được nhắc nhiều vì các đoàn khách đi tour
    // trọn gói hay được xếp về đây. Không đặt `openingHours`: lễ tân khách sạn trực suốt đêm nên
    // một khung giờ tĩnh ở đây chỉ gây hiểu nhầm là ngoài giờ đó thì không nhận phòng được.
    geo: { lat: 22.8233, lng: 104.9836, elevationM: 100, precision: "area_only" },
    price: {
      minVnd: 600000,
      maxVnd: 1200000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Ha+Giang",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Khoảng giá phòng đôi mùa thường, lấy từ mặt bằng nhóm khách sạn trung tâm thành phố. Vào mùa hoa tam giác mạch tháng 10–11 và các dịp lễ, nhóm này thường tăng khoảng rưỡi tới gấp đôi và hết phòng cuối tuần từ sớm.",
    },
    tags: ["vi-tri-khu-vuc", "diem-ngu-dem", "dem-dau-tien", "gan-ben-xe", "can-xac-minh-places"],
    sortOrder: 70,
  },
  {
    slug: "ks-ha-an",
    name: "Khách sạn Hà An",
    nameEn: "Ha An Hotel",
    aliases: ["ha an hotel", "khach san ha an", "ha an ha giang", "haan hotel"],
    kind: "hotel",
    parentSlug: "tp-ha-giang",
    address: "Khu trung tâm thành phố Hà Giang, tỉnh Tuyên Quang",
    // Mức trung bình của thành phố, và là cái tên xuất hiện đều đặn trong lịch trình các công ty
    // lữ hành bán cung Hà Giang. Giữ lại vì nó lấp đúng khoảng giữa: khách không muốn ngủ phòng
    // tập thể nhưng cũng không trả tiền cho khách sạn cao cấp.
    geo: { lat: 22.8233, lng: 104.9836, elevationM: 100, precision: "area_only" },
    price: {
      minVnd: 450000,
      maxVnd: 900000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Ha+Giang",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Phòng đôi mùa thường. Tháng 10–11 mùa hoa tam giác mạch giá nhóm khách sạn hạng trung ở thành phố thường nhích lên sát trần của khoảng này và cao hơn vào cuối tuần.",
    },
    tags: ["vi-tri-khu-vuc", "diem-ngu-dem", "dem-dau-tien", "can-xac-minh-places"],
    sortOrder: 72,
  },
  {
    slug: "bui-hostel-ha-giang",
    name: "Bụi Hostel & Bar Hà Giang",
    nameEn: "Bui Hostel Ha Giang",
    aliases: ["bui hostel", "bui hostel ha giang", "bui hostel and bar", "hostel bui"],
    // PlaceKind không có "hostel". Xếp vào "guesthouse" chứ không phải "hotel" là lựa chọn ít sai
    // nhất: khách đọc "hotel" sẽ hình dung phòng riêng có khoá, còn phần lớn giường ở đây là
    // giường trong phòng tập thể. Sai kiểu ở chỗ này không chỉ là sai nhãn — nó làm hỏng cả bộ
    // lọc giá lẫn kỳ vọng về sự riêng tư.
    kind: "guesthouse",
    parentSlug: "tp-ha-giang",
    address: "Khu trung tâm thành phố Hà Giang, tỉnh Tuyên Quang",
    // Đây là điểm tập kết của khách đi cung bằng xe máy và của dịch vụ easy rider, nên nó được
    // nhắc tới nhiều hơn hẳn quy mô thật của nó. Giữ lại vì nhóm khách hỏi "đi một mình thì ghép
    // đoàn ở đâu" gần như luôn được chỉ về những chỗ kiểu này.
    geo: { lat: 22.8233, lng: 104.9836, elevationM: 100, precision: "area_only" },
    price: {
      minVnd: 150000,
      maxVnd: 500000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Ha+Giang",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Cận dưới là một giường trong phòng tập thể, cận trên là phòng riêng hai người — khoảng này rộng vì hai loại chỗ ngủ khác hẳn nhau chứ không phải vì giá dao động. Mùa hoa tam giác mạch tháng 10–11 giường tập thể tăng nhẹ nhưng phòng riêng thì hết sớm.",
    },
    tags: ["vi-tri-khu-vuc", "gia-re", "phong-tap-the", "diem-ghep-doan", "thue-xe-may", "can-xac-minh-places"],
    sortOrder: 74,
  },
  {
    /**
     * THAY CHO MỘT MỤC CỤM TÔI ĐÃ TỰ ĐẶT RA. Bản trước ở đây là "Cụm nhà nghỉ thị trấn Yên Minh"
     * — một mục gộp, không tên riêng, lý do ghi trong comment là "không xác minh được tên riêng
     * nào đủ chắc". Lý do đó SAI: nó dựa trên kết luận rằng iVIVU chỉ có năm cơ sở ở Hà Giang,
     * mà kết luận ấy lại đến từ việc đọc sitemap của họ thay vì trang danh sách. Trang danh sách
     * khai 69 cơ sở, và Yên Minh có cơ sở thật, có tên, có giá.
     *
     * Bài học đáng giữ: khi danh mục thiếu một vùng, hãy nghi ngờ PHƯƠNG PHÁP TÌM trước khi kết
     * luận là vùng đó không có gì. Một mục gộp tự đặt ra trông vô hại nhưng nó che mất đúng chỗ
     * dữ liệu đang thiếu, và tác tử thì trình bày nó cho khách như một chỗ nghỉ có thật.
     */
    slug: "ks-thien-an-yen-minh",
    name: "Khách sạn Thiên Ân Yên Minh",
    aliases: ["thien an yen minh", "khach san thien an", "thien an hotel yen minh"],
    kind: "hotel",
    parentSlug: "yen-minh",
    address: "245 Trần Hưng Đạo, thị trấn Yên Minh, tỉnh Tuyên Quang",
    geo: { lat: 23.11779, lng: 105.14305, elevationM: 900, precision: "approximate" },
    price: {
      minVnd: 266427,
      maxVnd: 266427,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/khach-san-thien-an-ha-giang"],
      note: "MỘT ĐIỂM, KHÔNG PHẢI MỘT KHOẢNG: 266.427đ là mức duy nhất iVIVU trả về ngày 2026-09-10, nên hai đầu đặt bằng nhau thay vì bịa ra một dải. Yên Minh là chặng nghỉ đêm đầu của phần lớn lịch trình ba ngày nên cuối tuần mùa cao điểm rất dễ hết phòng và giá sẽ khác hẳn — đọc lại vào tháng 10–11 để có cận trên thật.",
    },
    tags: ["chang-nghi-dem-dau", "thi-tran", "gia-thap", "can-xac-minh-places"],
    sortOrder: 75,
  },
  {
    slug: "meo-vac-giac-xua-homestay",
    name: "Mèo Vạc Giấc Xưa Homestay",
    aliases: ["giac xua homestay", "meo vac giac xua", "homestay giac xua meo vac"],
    kind: "homestay",
    parentSlug: "meo-vac",
    address: "43 tổ 1, thị trấn Mèo Vạc, tỉnh Tuyên Quang",
    // Homestay ĐẦU TIÊN trong danh mục có giá quan sát được thay vì ước lượng. Cả nhóm homestay
    // trước đó đều mang `market_estimate`, nên mục này cũng là mốc để soi lại mặt bằng nhóm ấy:
    // 383.548đ nằm giữa khoảng 200.000–700.000đ đang gán cho cụm Pả Vi cùng thị trấn, tức mặt
    // bằng ước lượng của nhóm homestay không lệch xa.
    geo: { lat: 23.16231, lng: 105.41205, elevationM: 1000, precision: "approximate" },
    price: {
      minVnd: 383548,
      maxVnd: 383548,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/meo-vac-giac-xua-homestay"],
      note: "Một điểm quan sát ngày 2026-09-10, không phải khoảng. Nằm trong thị trấn Mèo Vạc nên tiện cho đêm sau khi vượt Mã Pí Lèng, khác với cụm Pả Vi nằm ngay chân đèo.",
    },
    tags: ["homestay", "thi-tran", "sau-ma-pi-leng", "can-xac-minh-places"],
    sortOrder: 84,
  },
  {
    slug: "cum-homestay-thon-tha",
    name: "Cụm homestay Thôn Tha",
    aliases: ["homestay thon tha", "cum homestay thon tha", "nha san thon tha", "homestay ban tha"],
    kind: "homestay",
    parentSlug: "thon-tha",
    address: "Thôn Tha, rìa tây thành phố Hà Giang, tỉnh Tuyên Quang",
    // Mục cụm. Đây là bản Tày nhà sàn ngay rìa thành phố, và giá trị của nó với khách là một thứ
    // rất cụ thể: đoàn nào lên tới Hà Giang lúc đêm muộn thì đây là chỗ ngủ có không khí bản làng
    // mà không phải chạy thêm đèo trong đêm. Vài chục hộ trong bản cùng kiểu nhà sàn gỗ, cùng
    // mặt bằng giá, nên gọi tên một hộ là bịa.
    geo: { lat: 22.81, lng: 104.95, elevationM: 120, precision: "area_only" },
    price: {
      minVnd: 150000,
      maxVnd: 350000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: ["https://www.booking.com/searchresults.vi.html?ss=Ha+Giang"],
      note: "Mức nhà sàn cộng đồng: cận dưới là chỗ nằm trong nhà sàn chung, cận trên là phòng riêng ngăn vách. Tháng 10–11 mùa hoa tam giác mạch cả bản kín chỗ vào cuối tuần và chủ nhà thường chỉ nhận khách đã hẹn trước.",
    },
    tags: ["vi-tri-khu-vuc", "cum-co-so", "homestay-cong-dong", "nha-san-tay", "gan-thanh-pho", "can-xac-minh-places"],
    sortOrder: 76,
  },

  // ---------------------------------------------------------------------------------------------
  // QUẢN BẠ — CHẶNG NGHỈ ĐẦU TIÊN TRÊN CUNG
  //
  // Hai mục ở đây nằm ở hai đầu đối lập của thang giá, và đó là lý do giữ cả hai: khách hỏi
  // "ngủ ở Quản Bạ" có thể đang hỏi một khu nghỉ dưỡng có bể bơi, cũng có thể đang hỏi một nhà
  // trình tường của người Dao. Trả lời bằng đúng một loại là bỏ sót một nửa số người hỏi.
  // ---------------------------------------------------------------------------------------------
  {
    /**
     * THÊM SAU KHI ĐỌC GIÁ THẬT TỪ IVIVU (2026-09-10), và nó lấp một khoảng trống cùng loại với
     * Yên Minh trước đó: nhánh Hoàng Su Phì không có cơ sở lưu trú nào trong danh mục, nên tác tử
     * dựng lịch trình mùa lúa chín sẽ phải bịa tên. Một khoảng trống không biểu hiện thành lỗi;
     * nó biểu hiện thành bịa đặt.
     *
     * Đây là cơ sở duy nhất trong danh mục nằm ở nhánh tây, và cũng là cơ sở duy nhất có giá
     * QUAN SÁT ĐƯỢC chứ không ước lượng — xem `basis`.
     */
    slug: "panhou-retreat",
    name: "Panhou Retreat Hà Giang",
    nameEn: "Panhou Retreat",
    aliases: ["panhou retreat", "panhou", "pan hou retreat", "panhou village"],
    kind: "hotel",
    parentSlug: "hoang-su-phi",
    address: "Thôn Làng Giang, xã Thông Nguyên, khu vực Hoàng Su Phì, tỉnh Tuyên Quang",
    // Khu nghỉ dưỡng sinh thái nằm sâu trong thung lũng, cách trung tâm Hoàng Su Phì một quãng
    // đường núi. Toạ độ lấy ở khu vực xã Thông Nguyên chứ không phải ở khối nhà.
    geo: { lat: 22.57637, lng: 104.74228, elevationM: 500, precision: "approximate" },
    price: {
      minVnd: 2310000,
      maxVnd: 2310000,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/khu-nghi-duong-panhou-retreat-ha-giang"],
      note: "MỘT ĐIỂM, KHÔNG PHẢI MỘT KHOẢNG: 2.310.000đ là mức duy nhất iVIVU trả về ngày 2026-09-10 cho ngày nhận phòng mặc định, nên cận dưới và cận trên đặt bằng nhau thay vì bịa ra một dải. Đọc lại vào mùa lúa chín tháng 9 và mùa thấp điểm để có khoảng thật. Giá sàn đã gồm hoa hồng, có thể khác giá đặt trực tiếp.",
    },
    tags: ["nghi-duong", "gia-cao", "nhanh-hoang-su-phi", "mua-lua-chin", "can-xac-minh-places"],
    sortOrder: 103,
  },
  {
    /**
     * Cơ sở thứ hai ở nhánh Hoàng Su Phì, thêm từ dữ liệu iVIVU 2026-09-10. Có hai mục ở đây là
     * đáng kể: trước đó cả nhánh tây chỉ có Panhou ở mức 2,5 triệu, nên tác tử buộc phải giới
     * thiệu một chỗ nghỉ cao cấp cho mọi khách đi mùa lúa chín, kể cả người đi tiết kiệm.
     */
    slug: "hoang-su-phi-lodge",
    name: "Hoàng Su Phì Lodge",
    aliases: ["hoang su phi lodge", "hsp lodge", "lodge hoang su phi"],
    kind: "hotel",
    parentSlug: "hoang-su-phi",
    address: "Thôn Nam Hồng, xã Thông Nguyên, khu vực Hoàng Su Phì, tỉnh Tuyên Quang",
    geo: { lat: 22.56763, lng: 104.72311, elevationM: 500, precision: "approximate" },
    price: {
      minVnd: 902694,
      maxVnd: 902694,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/hoang-su-phi-lodge"],
      note: "Một điểm quan sát ngày 28/10. Cùng xã Thông Nguyên với Panhou Retreat nhưng chỉ bằng khoảng một phần ba giá — hai mục này cho khách hai lựa chọn thật ở nhánh tây thay vì một.",
    },
    tags: ["nhanh-hoang-su-phi", "mua-lua-chin", "can-xac-minh-places"],
    sortOrder: 104,
  },
  {
    slug: "hmong-village-resort",
    name: "H'Mong Village Resort",
    nameEn: "H'Mong Village Resort",
    aliases: ["hmong village", "h mong village resort", "hmong village resort quan ba", "resort hmong village"],
    kind: "hotel",
    parentSlug: "quan-ba",
    address: "Ven quốc lộ 4C đoạn Tráng Kìm, trên đường từ thành phố Hà Giang lên Quản Bạ, tỉnh Tuyên Quang",
    // Xếp "hotel" chứ không phải "homestay" dù kiến trúc mô phỏng nhà trình tường của người Mông:
    // khách ở đây không sinh hoạt cùng chủ nhà, và đó mới là ranh giới thật giữa hai kiểu lưu trú.
    // Toạ độ đặt ở đoạn quốc lộ chứ không phải ở khối nhà, vì đây là một khu trải rộng trên sườn
    // đồi và người viết không có điểm chuẩn nào đáng tin hơn.
    geo: { lat: 23.07098, lng: 105.02799, elevationM: 700, precision: "approximate" },
    price: {
      // Cận dưới hạ từ 1.500.000 xuống 1.430.000: con số cũ là ước lượng và nó đặt CAO HƠN giá
      // thật, tức sai theo hướng bất lợi cho khách. Giá mới là giá đọc được trên iVIVU.
      minVnd: 1430000,
      maxVnd: 3500000,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/khu-nghi-duong-h-mong-village-ha-giang"],
      note: "HAI ĐẦU KHOẢNG CÓ XUẤT XỨ KHÁC NHAU, đừng đọc như một dải đã xác minh. Cận dưới 1.430.000đ là giá QUAN SÁT ĐƯỢC trên iVIVU ngày 2026-09-10 cho ngày nhận phòng mặc định — giá sàn, đã gồm hoa hồng. Cận trên 3.500.000đ vẫn là ƯỚC LƯỢNG cho cao điểm tháng 10–11 mùa hoa tam giác mạch, chưa quan sát được vì lần đọc đó chỉ trả về một mức. Muốn xác minh cận trên thì chạy lại script với ngày nhận phòng trong mùa cao điểm. Đây là hạng nghỉ dưỡng nên khoảng giá cao hơn hẳn khách sạn thành phố là đúng, không phải lỗi dữ liệu.",
    },
    tags: ["nghi-duong", "gia-cao", "vong-cung-chinh", "can-xac-minh-places"],
    sortOrder: 104,
  },
  {
    slug: "dao-lodge-nam-dam",
    name: "Dao Lodge Nặm Đăm",
    nameEn: "Dao Lodge",
    aliases: ["dao lodge", "dao lodge nam dam", "homestay dao lodge", "dao lodge quan ba"],
    kind: "homestay",
    parentSlug: "nam-dam",
    address: "Thôn Nặm Đăm, xã Quản Bạ, tỉnh Tuyên Quang",
    // Nặm Đăm là làng du lịch cộng đồng được nhắc tới nhiều nhất của Quản Bạ, và trong làng thì
    // đây là cơ sở có tên riêng xuất hiện đều đặn ở nguồn ngoài — đủ để tách khỏi mục cụm. Điểm
    // đáng nói với khách không phải là phòng mà là tắm lá thuốc của người Dao, thứ phải hẹn trước
    // vì chủ nhà cần thời gian đun nước.
    geo: { lat: 23.07, lng: 104.97, elevationM: 1050, precision: "area_only" },
    price: {
      minVnd: 400000,
      maxVnd: 900000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Nam+Dam%2C+Quan+Ba",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Mức homestay đã cải tạo có phòng riêng và bữa tối tính thêm, cao hơn nhà dân thường trong cùng làng. Tháng 10–11 mùa hoa tam giác mạch cả làng gần như kín, giá cuối tuần cao hơn ngày thường một bậc rõ rệt.",
    },
    tags: ["vi-tri-khu-vuc", "homestay-cong-dong", "nguoi-dao", "tam-la-thuoc", "diem-ngu-dem", "can-xac-minh-places"],
    sortOrder: 118,
  },

  // ---------------------------------------------------------------------------------------------
  // DU GIÀ — CHẶNG NGỦ CỦA CUNG PHÍA ĐÔNG
  //
  // Chỉ một mục, và đó là con số trung thực. Du Già có vài chục nhà nhận khách nhưng gần như
  // không nhà nào có mặt ổn định trên các trang đặt phòng, nên thêm tên vào đây là đoán. Điều
  // khách cần biết về chặng này nằm ở @data/knowledge/accommodation chứ không phải ở số lượng mục.
  // ---------------------------------------------------------------------------------------------
  {
    /**
     * Thêm từ dữ liệu iVIVU 2026-09-10. Du Già trước đó chỉ có một mục với giá ước lượng; nay có
     * hai mục nữa với giá quan sát được, và ba mức 306k / 415k / (ước lượng 150–400k) cho thấy
     * mặt bằng ở đây thấp hơn hẳn các chặng khác — đúng với việc Du Già nằm ngoài trục chính.
     */
    slug: "du-gia-thu-homestay",
    name: "Du Gia Thu's Homestay",
    aliases: ["du gia thu homestay", "thu homestay du gia", "thus homestay du gia"],
    kind: "homestay",
    parentSlug: "du-gia",
    address: "Xã Du Già, tỉnh Tuyên Quang",
    geo: { lat: 22.93067, lng: 105.2236, elevationM: 700, precision: "approximate" },
    price: {
      minVnd: 306823,
      maxVnd: 306823,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/du-gia-thu-s-homestay"],
      note: "Một điểm quan sát cho ngày nhận phòng 28/10, cao điểm hoa tam giác mạch — và vẫn là mức thấp, cho thấy Du Già ít chịu ảnh hưởng của mùa cao điểm vì nằm ngoài trục Đồng Văn – Mèo Vạc.",
    },
    tags: ["homestay", "ngoai-truc-chinh", "gia-thap", "can-xac-minh-places"],
    sortOrder: 178,
  },
  {
    slug: "to-day-du-gia-village",
    name: "Tớ Dày Du Già Village",
    aliases: ["to day du gia", "to day village", "to day du gia village"],
    kind: "homestay",
    parentSlug: "du-gia",
    address: "Xã Du Già, tỉnh Tuyên Quang",
    geo: { lat: 22.93402, lng: 105.2019, elevationM: 700, precision: "approximate" },
    price: {
      minVnd: 415053,
      maxVnd: 415053,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/to-day-du-gia-village"],
      note: "Một điểm quan sát ngày 28/10. Mức này trùng đúng phân vị 25 của cả địa bàn trong ngày đó, nên nó là mốc tốt để so các chỗ nghỉ khác.",
    },
    tags: ["homestay", "ngoai-truc-chinh", "can-xac-minh-places"],
    sortOrder: 179,
  },
  {
    slug: "du-gia-backpackers-hostel",
    name: "Du Già Backpackers Hostel",
    nameEn: "Du Gia Backpackers Hostel",
    aliases: ["du gia backpackers", "du gia hostel", "backpacker du gia", "du gia backpacker hostel"],
    // Lại là một hostel phải xếp vào "guesthouse" vì cùng lý do như Bụi Hostel: phần lớn chỗ ngủ
    // là giường tập thể, và gọi nó là khách sạn sẽ đặt sai kỳ vọng của khách đi cùng gia đình.
    kind: "guesthouse",
    parentSlug: "du-gia",
    address: "Thung lũng Du Già, tỉnh Tuyên Quang",
    // Đây là cái tên gắn liền với cung phía đông trong cộng đồng khách nước ngoài đi xe máy, và
    // cũng là lý do Du Già từ một thung lũng ít người biết trở thành chặng ngủ cố định. Cần nhớ
    // khi trả lời: sóng điện thoại và đường vào đây kém hơn hẳn trục chính, nên xác nhận đặt
    // phòng qua tin nhắn có thể không tới nơi.
    geo: { lat: 22.93264, lng: 105.22237, elevationM: 700, precision: "area_only" },
    price: {
      minVnd: 150000,
      maxVnd: 400000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: ["https://www.booking.com/searchresults.vi.html?ss=Du+Gia%2C+Ha+Giang"],
      note: "Cận dưới là giường tập thể, cận trên là phòng riêng đơn sơ; nhiều nơi trong thung lũng bán kèm bữa tối chung với giá tính riêng. Tháng 10–11 mùa hoa tam giác mạch Du Già chịu ảnh hưởng nhẹ hơn trục chính vì nằm lệch tuyến, nhưng cuối tuần vẫn kín.",
    },
    tags: ["vi-tri-khu-vuc", "gia-re", "phong-tap-the", "nhanh-phia-dong", "song-dien-thoai-kem", "can-xac-minh-places"],
    sortOrder: 148,
  },

  // ---------------------------------------------------------------------------------------------
  // LŨNG CÚ VÀ ĐỒNG VĂN — ĐÊM Ở CỰC BẮC
  //
  // Hai chỗ ngủ ở đây phục vụ hai quyết định khác nhau. Ngủ lại Lô Lô Chải là để có buổi sáng
  // dưới chân cột cờ khi chưa có đoàn nào lên; ngủ ở thị trấn Đồng Văn là để tối còn đi bộ ra
  // phố cổ và sáng hôm sau kịp phiên chợ. Không nơi nào thay được nơi nào, nên khi khách hỏi
  // "ngủ đâu ở Đồng Văn" thì phải hỏi lại họ định làm gì sáng hôm sau.
  // ---------------------------------------------------------------------------------------------
  /**
   * BA MỤC CÓ TÊN THAY CHO MỘT MỤC CỤM.
   *
   * Trước đây Lô Lô Chải là một mục gộp, lý do ghi trong comment là "vài chục hộ cùng kiểu nhà,
   * cùng mặt bằng giá, nên đặt tên bừa một hộ là vừa bịa vừa bất công". Vế đầu vẫn đúng, nhưng
   * vế "cùng mặt bằng giá" thì SAI — và số liệu đọc được từ iVIVU ngày 2026-09-10 chứng minh:
   * trong cùng bản, À Lôi 857.912đ còn Mùa Pửi 362.448đ, chênh nhau hơn gấp đôi. Một khoảng giá
   * gộp che mất đúng khác biệt mà khách cần biết để chọn.
   *
   * Đổi lại có một thiên lệch phải nhận: danh mục giờ nghiêng về hộ nào có mặt trên sàn OTA.
   * Những hộ chỉ nhận khách tới nơi mới hỏi vẫn tồn tại và vẫn đông, chỉ là không xuất hiện ở
   * đây. Vì vậy tầng trả lời KHÔNG được nói "Lô Lô Chải có hai chỗ nghỉ" — đúng phải là "hai chỗ
   * đặt trước được", còn bản thì còn nhiều nhà khác.
   */
  {
    slug: "a-loi-homestay-lo-lo-chai",
    name: "À Lôi Homestay Lô Lô Chải",
    aliases: ["a loi homestay", "a loi lo lo chai", "aloi homestay lo lo chai"],
    kind: "homestay",
    parentSlug: "lung-cu",
    address: "Bản Lô Lô Chải, xã Lũng Cú, tỉnh Tuyên Quang",
    geo: { lat: 23.36375, lng: 105.31009, elevationM: 1400, precision: "approximate" },
    price: {
      minVnd: 857912,
      maxVnd: 857912,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/a-loi-homestay-lo-lo-chai"],
      note: "Một điểm quan sát cho ngày nhận phòng 28/10 — đúng cao điểm mùa hoa tam giác mạch, nên đây gần với mức TRẦN của bản chứ không phải mức thường. Đọc lại ngày thấp điểm để có đầu còn lại.",
    },
    tags: ["homestay", "nguoi-lo-lo", "gan-bien-gioi", "khai-bao-tam-tru", "mua-hoa-tam-giac-mach", "can-xac-minh-places"],
    sortOrder: 202,
  },
  {
    slug: "long-co-tran-lung-cu",
    name: "Long Cổ Trấn",
    aliases: ["long co tran", "long co tran lung cu", "longcotran"],
    kind: "homestay",
    parentSlug: "lung-cu",
    address: "Xã Lũng Cú, tỉnh Tuyên Quang",
    geo: { lat: 23.36467, lng: 105.3096, elevationM: 1400, precision: "approximate" },
    price: {
      minVnd: 709732,
      maxVnd: 709732,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/long-co-tran"],
      note: "Một điểm quan sát ngày cao điểm 28/10. Nằm ở Lũng Cú nhưng nguồn không ghi rõ có thuộc bản Lô Lô Chải hay không — đừng khẳng định điều đó với khách.",
    },
    tags: ["homestay", "gan-bien-gioi", "khai-bao-tam-tru", "can-xac-minh-places"],
    sortOrder: 203,
  },
  {
    slug: "ks-hoa-cuong-dong-van",
    name: "Khách sạn Hoa Cương",
    nameEn: "Hoa Cuong Hotel Dong Van",
    aliases: ["hoa cuong hotel", "khach san hoa cuong", "hoa cuong dong van", "hoacuong hotel"],
    kind: "hotel",
    parentSlug: "dong-van",
    address: "Thị trấn Đồng Văn, tỉnh Tuyên Quang",
    // Khách sạn lớn nhất thị trấn và gần như là nơi duy nhất ở Đồng Văn nhận được đoàn đông cùng
    // lúc, nên tên nó xuất hiện trong hầu hết lịch trình tour bán sẵn. Đó cũng là điểm cần cảnh
    // báo khi trả lời: đúng dịp lễ và mùa hoa thì nơi này bị các đoàn giữ chỗ trước, khách lẻ hỏi
    // sát ngày thường không còn phòng.
    geo: { lat: 23.2783, lng: 105.3625, elevationM: 1025, precision: "area_only" },
    price: {
      minVnd: 450000,
      maxVnd: 1000000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Dong+Van%2C+Ha+Giang",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Phòng đôi mùa thường ở mặt bằng khách sạn thị trấn Đồng Văn. Tháng 10–11 mùa hoa tam giác mạch và các đêm sát phiên chợ Chủ nhật, mặt bằng này tăng rõ rệt và các đoàn tour giữ chỗ trước nên phòng lẻ khan.",
    },
    tags: ["vi-tri-khu-vuc", "diem-ngu-dem", "vong-cung-chinh", "nhan-doan-dong", "can-xac-minh-places"],
    sortOrder: 212,
  },
  {
    slug: "ks-lam-tung-dong-van",
    name: "Khách sạn Lâm Tùng",
    nameEn: "Lam Tung Hotel Dong Van",
    aliases: ["lam tung hotel", "khach san lam tung", "lam tung dong van", "lamtung hotel"],
    kind: "hotel",
    parentSlug: "dong-van",
    address: "Thị trấn Đồng Văn, gần khu phố cổ, tỉnh Tuyên Quang",
    // Giữ lại vì vị trí: đi bộ được ra khu phố cổ và ra chợ, tức là nó trả lời đúng câu hỏi thật
    // của người hỏi chỗ ngủ ở Đồng Văn — không phải "phòng đẹp không" mà "tối có ra phố cổ được
    // không". Hạng phòng đơn giản hơn Hoa Cương và giá cũng thấp hơn một bậc.
    geo: { lat: 23.27735, lng: 105.36143, elevationM: 1025, precision: "approximate" },
    price: {
      minVnd: 350000,
      maxVnd: 800000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: ["https://www.booking.com/searchresults.vi.html?ss=Dong+Van%2C+Ha+Giang"],
      note: "Mức khách sạn hạng phổ thông trong thị trấn, khảo cùng đợt với các cơ sở lân cận. Cao điểm tháng 10–11 mùa hoa tam giác mạch giá nhích lên gần mức khách sạn hạng trên và hết phòng vào các đêm thứ Bảy.",
    },
    tags: ["diem-ngu-dem", "di-bo-ra-pho-co", "vong-cung-chinh", "can-xac-minh-places"],
    sortOrder: 214,
  },

  // ---------------------------------------------------------------------------------------------
  // MÈO VẠC — NGỦ SAU KHI QUA MÃ PÍ LÈNG
  //
  // Chặng này có một đặc điểm mà dữ liệu phải phản ánh: gần như ai cũng tới đây vào cuối buổi
  // chiều, sau khi đã chạy hết đèo. Nghĩa là khách không còn sức đi tìm chỗ ngủ, và một câu trả
  // lời mơ hồ về Mèo Vạc gây hậu quả nặng hơn cùng câu đó về thành phố Hà Giang.
  // ---------------------------------------------------------------------------------------------
  /**
   * HAI MỤC CÓ TÊN THAY CHO MỤC CỤM PẢ VI — cùng lý do như Lô Lô Chải, xem chú thích ở đó.
   *
   * Ở đây chênh lệch còn rõ hơn: 1.021.583đ và 1.707.686đ trong cùng làng văn hoá du lịch. Cả
   * hai đều cao hơn hẳn khoảng 200.000–700.000đ mà mục cụm cũ ước lượng, và lý do gần như chắc
   * chắn là ngày đọc rơi đúng cao điểm hoa tam giác mạch — chứ không phải ước lượng cũ sai hẳn.
   * Đây là ví dụ vì sao `surveyedAt` của `ota_observed` quan trọng hơn hẳn hai mức xuất xứ kia.
   */
  {
    slug: "meo-vac-beehive-house",
    name: "Mèo Vạc Beehive House",
    aliases: ["beehive house", "meo vac beehive", "beehive meo vac"],
    kind: "homestay",
    parentSlug: "pa-vi",
    address: "B6 Hạ, Làng văn hoá du lịch Pả Vi, tỉnh Tuyên Quang",
    geo: { lat: 23.20516, lng: 105.41666, elevationM: 950, precision: "approximate" },
    price: {
      minVnd: 1021583,
      maxVnd: 1021583,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/meo-vac-beehive-house"],
      note: "Một điểm quan sát cho ngày 28/10, cao điểm mùa hoa tam giác mạch. Nằm ngay chân Mã Pí Lèng nên đây là chỗ hợp lý cho đêm sau khi vượt đèo.",
    },
    tags: ["homestay", "chan-ma-pi-leng", "lang-van-hoa-pa-vi", "mua-hoa-tam-giac-mach", "can-xac-minh-places"],
    sortOrder: 248,
  },
  {
    slug: "o-chau-meo-vac-homestay",
    name: "O'Chau Mèo Vạc Homestay",
    aliases: ["o chau homestay", "ochau meo vac", "o chau meo vac homestay"],
    kind: "homestay",
    parentSlug: "pa-vi",
    address: "Quốc lộ 4C, Làng văn hoá du lịch Pả Vi, tỉnh Tuyên Quang",
    geo: { lat: 23.20679, lng: 105.41668, elevationM: 950, precision: "approximate" },
    price: {
      minVnd: 1707686,
      maxVnd: 1707686,
      unit: "per_night",
      basis: "ota_observed",
      surveyedAt: "2026-09-10",
      sourceUrls: ["https://www.ivivu.com/khach-san-ha-giang/o-chau-meo-vac-homestay"],
      note: "Một điểm quan sát ngày cao điểm 28/10 và là mức cao nhất trong nhóm homestay của danh mục. Ngay mặt quốc lộ 4C nên tiện xe nhưng ồn hơn các nhà phía trong làng.",
    },
    tags: ["homestay", "chan-ma-pi-leng", "lang-van-hoa-pa-vi", "mat-quoc-lo", "can-xac-minh-places"],
    sortOrder: 249,
  },
  {
    slug: "auberge-de-meo-vac",
    name: "Auberge de Mèo Vạc",
    nameEn: "Auberge de Meo Vac",
    aliases: ["auberge de meo vac", "auberge meo vac", "nha co meo vac", "auberge"],
    // Xếp "hotel" vì đây là cơ sở lưu trú có người vận hành chuyên nghiệp, không phải nhà dân
    // nhận khách — dù nó nằm trong một ngôi nhà trình tường cũ đã được phục dựng.
    kind: "hotel",
    parentSlug: "meo-vac",
    address: "Thị trấn Mèo Vạc, tỉnh Tuyên Quang",
    // Giữ lại vì nó là lựa chọn duy nhất ở phân khúc này trong cả vùng và vì khách hỏi "có chỗ
    // nào ở Mèo Vạc tử tế hơn homestay không" thì không còn tên nào khác để nói. Số phòng rất ít,
    // nên câu trả lời phải kèm cảnh báo đặt sớm chứ không chỉ nêu tên.
    geo: { lat: 23.1611, lng: 105.4128, elevationM: 1000, precision: "area_only" },
    price: {
      minVnd: 900000,
      maxVnd: 2200000,
      unit: "per_night",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.booking.com/searchresults.vi.html?ss=Meo+Vac%2C+Ha+Giang",
        "https://www.agoda.com/vi-vn/city/ha-giang-vn.html",
      ],
      note: "Phân khúc cao nhất của Mèo Vạc, cách biệt hẳn mặt bằng chung của thị trấn nên không lấy trung vị vùng làm chuẩn được. Cao điểm tháng 10–11 mùa hoa tam giác mạch, số phòng ít khiến nơi này hết trước các cơ sở khác nhiều tuần chứ không chỉ tăng giá.",
    },
    tags: ["vi-tri-khu-vuc", "nha-trinh-tuong-phuc-dung", "gia-cao", "it-phong", "can-xac-minh-places"],
    sortOrder: 254,
  },
];
