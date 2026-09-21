/**
 * CÂY THỰC THỂ ĐỊA LÝ — gốc của toàn bộ tầng `data/`.
 *
 * Mọi thứ khác trong repo đều trỏ về file này bằng `slug`: tài liệu tri thức lấy `entityId` từ
 * đây, điểm đo thời tiết lấy `servesPlaceSlugs` từ đây, chặng đường lấy `fromSlug`/`toSlug` từ
 * đây. Vì vậy file này phải xong và phải đúng trước các file khác — thêm một thực thể muộn thì
 * chỉ là thêm một dòng, nhưng đổi một slug đã có thì làm mồ côi mọi tri thức đã gắn vào nó.
 *
 * VÌ SAO DANH MỤC TÁCH KHỎI TRI THỨC. Ở đây chỉ có xương: thứ đó tên gì, khách gọi nó bằng những
 * cách nào, nó nằm ở đâu, nó thuộc về cái gì. Không có mô tả cảm xúc, không có gợi ý lịch trình,
 * không có "nên đi mùa nào" — những thứ đó nằm ở @data/knowledge vì chúng thay đổi theo mùa,
 * theo nguồn, theo lần biên tập, và vì chúng cần được truy hồi bằng vector chứ không bằng khoá.
 * Nếu trộn hai thứ vào một file thì mỗi lần sửa một câu mô tả là một lần rủi ro chạm vào khoá
 * của cả cây, và bộ phân giải địa danh — thứ chỉ cần đọc `name` với `aliases` — sẽ phải nạp kèm
 * hàng chục nghìn ký tự văn xuôi mà nó không dùng đến.
 *
 * VÌ SAO KHÔNG CÒN CẤP HUYỆN. Từ 01/7/2025 Việt Nam bỏ cấp huyện, và cùng đợt sắp xếp đó tỉnh Hà
 * Giang sáp nhập vào tỉnh Tuyên Quang. Nghĩa là cấp tỉnh hiện hành ở đây là "Tuyên Quang", còn
 * "Đồng Văn", "Mèo Vạc", "Quản Bạ", "Yên Minh" không còn là huyện nữa. Nhưng khách vẫn hỏi
 * "đi Đồng Văn có gì", chứ không ai hỏi bằng tên xã, nên bỏ hẳn các tên đó khỏi danh mục là tự
 * cắt phần lớn đầu vào thực tế. Cách xử lý: chúng ở lại với `kind: "region"` — vùng du lịch theo
 * cách gọi quen thuộc, KHÔNG phải đơn vị hành chính — còn xã/thị trấn thì ở `kind: "commune"`.
 * Hệ quả cần nhớ khi đọc cây này: quan hệ cha–con ở đây là cây TRA CỨU, không phải sơ đồ hành
 * chính. Về mặt hành chính, xã gắn thẳng vào tỉnh; ở đây xã gắn vào vùng, vì tầng vùng là tầng
 * mà câu hỏi của khách rơi vào.
 *
 * VÌ SAO `scenic_view` LÀ THỰC THỂ RIÊNG CHỨ KHÔNG PHẢI TRƯỜNG CON CỦA LANDMARK. Câu hỏi thật mà
 * khách hỏi không phải "hẻm Tu Sản là gì" mà là "đứng ở đâu thì chụp được hẻm Tu Sản". Hai câu
 * đó cần hai câu trả lời khác nhau và hai toạ độ khác nhau: hẻm Tu Sản nằm ở mặt nước khoảng
 * 280 m, còn mỏm đá để đứng ngắm nó ở khoảng 900 m, cách nhau hơn 600 m độ cao và một đoạn đường
 * đất. Nếu điểm ngắm chỉ là một chuỗi mô tả nằm trong landmark thì nó không có slug, không gắn
 * được tri thức riêng, không gắn được điểm đo thời tiết riêng, không xuất hiện được như một chặng
 * trong lịch trình, và không trả lời được câu hỏi "chỗ đó có xe máy lên được không". Tách ra
 * thành thực thể là chấp nhận cây sâu thêm một tầng để đổi lấy đúng nhóm câu hỏi phổ biến nhất.
 *
 * QUY ƯỚC `sortOrder`. Thứ tự phần tử trong mảng được xếp theo KIỂU (tỉnh → vùng → xã → địa danh
 * → điểm ngắm → di tích văn hoá → di tích lịch sử) để cha luôn được khai trước con, nhờ vậy dựng
 * được cây trong một lượt duyệt duy nhất mà không cần sắp xếp lại. Còn `sortOrder` mang thứ tự
 * HÀNH TRÌNH: đi từ thành phố Hà Giang lên Quản Bạ, Yên Minh, Đồng Văn, qua Mã Pí Lèng xuống Mèo
 * Vạc, rồi mới tới các nhánh rẽ Bắc Mê, Hoàng Su Phì, Xín Mần. Hai thứ tự này cố tình khác nhau,
 * nên đừng "sửa cho khớp": xếp theo bảng chữ cái thì màn hình gợi ý sẽ dẫn khách chạy ngược
 * đường, còn xếp theo cây thì đèo Mã Pí Lèng bị đẩy xuống dưới thị trấn Mèo Vạc dù trên đường
 * thật khách gặp đèo trước. Khoảng cách giữa các số được để thưa để chèn thực thể mới về sau mà
 * không phải đánh số lại cả file.
 *
 * QUY ƯỚC ĐỘ TIN CẬY TOẠ ĐỘ. Gần như toàn bộ toạ độ ở đây là `approximate`, và đó là lựa chọn có
 * chủ ý chứ không phải sự lười. `surveyed` chỉ dành cho điểm có toạ độ công bố mà người viết thực
 * sự kiểm chứng được; trong file này chỉ có cột cờ Lũng Cú đạt mức đó. Toạ độ `approximate` đủ
 * chính xác để gọi Open-Meteo và để ước lượng chặng đường, nhưng KHÔNG được dùng làm điểm dẫn
 * đường từng mét — nhầm lẫn đó trên đường đèo Hà Giang không chỉ là bất tiện.
 *
 * VÌ SAO FILE NÀY KHÔNG CÓ MỘT TRƯỜNG `price` NÀO. Theo chú thích của `PriceEstimate`, trường giá
 * chỉ dành cho quán ăn và cơ sở lưu trú. Vài thực thể ở đây có bán vé (dinh thự họ Vương, cột cờ
 * Lũng Cú), nhưng một con số vé viết vào đây sẽ là con số không có nguồn và không có ngày khảo
 * sát — đúng thứ mà `PriceEstimate` sinh ra để chặn. Giá vé thuộc về tài liệu tri thức có trích
 * dẫn, không thuộc về xương sống danh mục.
 */

import type { Place } from "./types";

export const GEOGRAPHY: Place[] = [
  // ---------------------------------------------------------------------------------------------
  // CẤP TỈNH
  //
  // Chỉ có đúng một. Sau sáp nhập 01/7/2025 thì toàn bộ địa bàn trong file này nằm trong tỉnh
  // Tuyên Quang, kể cả những nơi mà mọi tấm biển và mọi bài viết du lịch vẫn ghi là "Hà Giang".
  // ---------------------------------------------------------------------------------------------
  {
    slug: "tuyen-quang",
    name: "Tỉnh Tuyên Quang",
    nameEn: "Tuyen Quang Province",
    // Khách gần như không bao giờ gõ "Tuyên Quang" khi hỏi về Hà Giang, nhưng vẫn phải bắt được
    // vì đây là tên xuất hiện trên giấy tờ, biển số và các nguồn hành chính sau sáp nhập.
    aliases: ["tuyen quang", "tinh tuyen quang", "tuyen quang province", "tq"],
    kind: "province",
    // Cố tình không có `geo`. Một tỉnh sau sáp nhập trải từ vùng trung du dưới 50 m tới đỉnh núi
    // trên 2.400 m; gán cho nó một toạ độ trọng tâm là mời công cụ thời tiết trả lời câu hỏi
    // "Tuyên Quang hôm nay thế nào" bằng một con số đúng cho không nơi nào cả.
    tags: ["hanh-chinh"],
    sortOrder: 10,
  },

  // ---------------------------------------------------------------------------------------------
  // VÙNG DU LỊCH
  //
  // Tất cả đều là con trực tiếp của "tuyen-quang", kể cả "ha-giang". Có thể thấy hơi lạ khi
  // "dong-van" không nằm dưới "ha-giang", nhưng lồng thêm một tầng như vậy sẽ dựng lên một quan
  // hệ hành chính không tồn tại: Hà Giang không còn là cấp trên của Đồng Văn nữa. Ở đây
  // "ha-giang" là cái ô che tên gọi — thứ khách dùng khi nói "đi Hà Giang" mà chưa biết mình sẽ
  // tới vùng nào — chứ không phải cấp quản lý của các vùng còn lại.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "ha-giang",
    name: "Hà Giang",
    nameEn: "Ha Giang",
    aliases: ["ha giang", "hagiang", "tinh ha giang", "vung ha giang", "ha giang cu", "ha giang loop"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Không gán `geo` vì lý do giống cấp tỉnh: vùng này trải hơn 100 km theo trục bắc–nam và
    // chênh nhau 1.400 m độ cao giữa thành phố với đỉnh đèo. Câu hỏi "thời tiết Hà Giang" phải
    // được phân giải xuống một vùng con hoặc một điểm cụ thể trước khi gọi API, chứ không được
    // trả lời bằng một điểm đại diện lặng lẽ chọn thay khách.
    tags: ["ten-goi-cu", "diem-xuat-phat"],
    sortOrder: 20,
  },
  {
    slug: "vi-xuyen",
    name: "Vị Xuyên",
    aliases: ["vi xuyen", "vixuyen", "huyen vi xuyen", "vung vi xuyen"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Đây là cửa ngõ phía nam: xe từ Hà Nội lên đi hết Vị Xuyên mới tới thành phố Hà Giang. Nhiều
    // khách đi qua mà không biết mình đã ở trong vùng, nên vẫn cần tra cứu được.
    geo: { lat: 22.7025, lng: 104.9814, elevationM: 110, precision: "approximate" },
    tags: ["ten-goi-cu", "cua-ngo-phia-nam"],
    sortOrder: 40,
  },
  {
    slug: "tp-ha-giang",
    name: "Thành phố Hà Giang",
    nameEn: "Ha Giang City",
    aliases: ["thanh pho ha giang", "tp ha giang", "tphg", "ha giang city", "trung tam ha giang", "thanh pho hagiang"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Mốc độ cao quan trọng nhất của cả file nằm ở đây: khoảng 100 m. Mọi con số độ cao khác nên
    // được đọc trong tương quan với nó — khách rời thành phố lúc trời 30 độ và lên tới Cổng Trời
    // ở 1.500 m sau chưa đầy hai giờ chạy xe.
    geo: { lat: 22.8233, lng: 104.9836, elevationM: 100, precision: "approximate" },
    tags: ["diem-xuat-phat", "vong-cung-chinh"],
    sortOrder: 60,
  },
  {
    slug: "quan-ba",
    name: "Quản Bạ",
    aliases: ["quan ba", "quanba", "huyen quan ba", "vung quan ba"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Toạ độ đặt ở thung lũng Tam Sơn — trung tâm của vùng và là nơi khách thực sự dừng lại.
    geo: { lat: 23.0553, lng: 104.9436, elevationM: 1000, precision: "approximate" },
    tags: ["ten-goi-cu", "vong-cung-chinh"],
    sortOrder: 100,
  },
  {
    slug: "yen-minh",
    name: "Yên Minh",
    aliases: ["yen minh", "yenminh", "huyen yen minh", "vung yen minh"],
    kind: "region",
    parentSlug: "tuyen-quang",
    geo: { lat: 23.1181, lng: 105.1508, elevationM: 900, precision: "approximate" },
    tags: ["ten-goi-cu", "vong-cung-chinh"],
    sortOrder: 140,
  },
  {
    slug: "dong-van",
    name: "Đồng Văn",
    aliases: ["dong van", "dongvan", "huyen dong van", "thi tran dong van", "vung dong van"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Cố ý KHÔNG nhận alias "cao nguyen dong van": cụm đó phải phân giải về
    // "cao-nguyen-da-dong-van", một thực thể trải trên bốn vùng chứ không riêng vùng này.
    geo: { lat: 23.2783, lng: 105.3625, elevationM: 1025, precision: "approximate" },
    tags: ["ten-goi-cu", "vong-cung-chinh", "mua-hoa-tam-giac-mach"],
    sortOrder: 180,
  },
  {
    slug: "meo-vac",
    name: "Mèo Vạc",
    aliases: ["meo vac", "meovac", "huyen meo vac", "thi tran meo vac", "vung meo vac"],
    kind: "region",
    parentSlug: "tuyen-quang",
    geo: { lat: 23.1611, lng: 105.4128, elevationM: 1000, precision: "approximate" },
    tags: ["ten-goi-cu", "vong-cung-chinh"],
    sortOrder: 230,
  },
  {
    slug: "bac-me",
    name: "Bắc Mê",
    aliases: ["bac me", "bacme", "huyen bac me", "vung bac me"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Nằm trên đường về: nhiều đoàn chạy Mèo Vạc – Bắc Mê – Hà Giang để khỏi đi lại đúng cung đã
    // đi lên. Đó là lý do Bắc Mê xếp sau Mèo Vạc chứ không xếp cạnh thành phố dù nó ở phía nam.
    geo: { lat: 22.735, lng: 105.305, elevationM: 200, precision: "approximate" },
    tags: ["ten-goi-cu", "nhanh-phia-dong", "duong-ve"],
    sortOrder: 280,
  },
  {
    slug: "hoang-su-phi",
    name: "Hoàng Su Phì",
    aliases: ["hoang su phi", "hoangsuphi", "huyen hoang su phi", "vung hoang su phi"],
    kind: "region",
    parentSlug: "tuyen-quang",
    // Nhánh phía tây là một chuyến đi khác hẳn: không đá tai mèo mà là ruộng bậc thang, và mùa
    // đẹp lệch hẳn so với vòng cung chính (tháng 9 lúa chín, không phải tháng 10–11 hoa tam giác
    // mạch). Gộp chung vào một lịch trình thường là gợi ý sai.
    geo: { lat: 22.7472, lng: 104.6853, elevationM: 550, precision: "approximate" },
    tags: ["ten-goi-cu", "nhanh-phia-tay", "mua-lua-chin"],
    sortOrder: 320,
  },
  {
    slug: "xin-man",
    name: "Xín Mần",
    aliases: ["xin man", "xinman", "huyen xin man", "coc pai", "vung xin man"],
    kind: "region",
    parentSlug: "tuyen-quang",
    geo: { lat: 22.6606, lng: 104.4869, elevationM: 600, precision: "approximate" },
    tags: ["ten-goi-cu", "nhanh-phia-tay", "mua-lua-chin"],
    sortOrder: 340,
  },

  // ---------------------------------------------------------------------------------------------
  // XÃ / THỊ TRẤN / BẢN ĐƯỢC GỌI TÊN NHƯ MỘT ĐIỂM ĐẾN
  //
  // Một lưu ý về độ chính xác hành chính: vài mục dưới đây (Thôn Tha, Nặm Đăm) về giấy tờ là thôn
  // nằm trong một xã lớn hơn, không phải xã. Chúng vẫn được xếp ở `commune` vì đó là mức chi tiết
  // mà khách gọi tên và mà cơ sở lưu trú lấy làm địa chỉ; đẩy chúng xuống một `kind` riêng chỉ để
  // đúng thuật ngữ hành chính sẽ tạo ra một tầng cây mà không câu hỏi nào của khách rơi vào.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "thon-tha",
    name: "Thôn Tha",
    aliases: ["thon tha", "thontha", "ban tha", "lang thon tha", "lang van hoa thon tha"],
    kind: "commune",
    parentSlug: "tp-ha-giang",
    // Bản Tày ngay rìa thành phố, thường là chỗ ngủ đêm đầu tiên của đoàn lên muộn. Về hành chính
    // nó thuộc xã Phương Độ.
    geo: { lat: 22.81, lng: 104.95, elevationM: 120, precision: "approximate" },
    tags: ["lang-van-hoa-du-lich", "gan-thanh-pho"],
    sortOrder: 62,
  },
  {
    slug: "tam-son",
    name: "Tam Sơn",
    aliases: ["tam son", "tamson", "thi tran tam son", "tt tam son", "thung lung tam son"],
    kind: "commune",
    parentSlug: "quan-ba",
    // Toạ độ trùng với toạ độ vùng Quản Bạ, và đó không phải lỗi sao chép: vùng được đặt tên theo
    // địa bàn cũ mà trung tâm chính là thị trấn này, nên hai thực thể chỉ cùng một điểm. Vẫn giữ
    // cả hai vì khách hỏi "ngủ ở Tam Sơn" thì đang hỏi thị trấn, còn hỏi "đi Quản Bạ" thì đang
    // hỏi cả vùng.
    geo: { lat: 23.0553, lng: 104.9436, elevationM: 1000, precision: "approximate" },
    tags: ["diem-ngu-dem", "vong-cung-chinh"],
    sortOrder: 108,
  },
  {
    slug: "nam-dam",
    name: "Nặm Đăm",
    aliases: ["nam dam", "namdam", "thon nam dam", "xa nam dam"],
    kind: "commune",
    parentSlug: "quan-ba",
    // Chỉ đặt các biến thể gọi tên địa bàn ở đây. Cụm "bản Nặm Đăm", "làng văn hoá Nặm Đăm" được
    // để dành cho thực thể `ban-nam-dam` bên dưới — nếu hai thực thể cùng nhận một alias thì bộ
    // phân giải phải chọn bừa một trong hai.
    geo: { lat: 23.07, lng: 104.97, elevationM: 1050, precision: "approximate" },
    tags: ["homestay-cong-dong"],
    sortOrder: 110,
  },
  {
    slug: "lung-tam",
    name: "Lùng Tám",
    aliases: ["lung tam", "lungtam", "xa lung tam", "thung lung lung tam"],
    kind: "commune",
    parentSlug: "quan-ba",
    geo: { lat: 22.9989, lng: 104.9317, elevationM: 900, precision: "approximate" },
    tags: ["lang-nghe"],
    sortOrder: 114,
  },
  {
    slug: "mau-due",
    name: "Mậu Duệ",
    aliases: ["mau due", "maudue", "xa mau due", "thi tran mau due"],
    kind: "commune",
    parentSlug: "yen-minh",
    // Ngã ba quan trọng: từ đây rẽ đi Du Già để về Hà Giang theo cung phía đông, hoặc đi tiếp lên
    // Đồng Văn. Khách hay nhắc tên nơi này lúc hỏi đường chứ không phải lúc hỏi cảnh.
    geo: { lat: 23.1447, lng: 105.2211, elevationM: 800, precision: "approximate" },
    tags: ["nga-ba-quan-trong"],
    sortOrder: 144,
  },
  {
    slug: "du-gia",
    name: "Du Già",
    aliases: ["du gia", "dugia", "xa du gia", "thung lung du gia", "lang du gia"],
    kind: "commune",
    parentSlug: "yen-minh",
    geo: { lat: 22.93264, lng: 105.22237, elevationM: 700, precision: "surveyed" },
    tags: ["homestay-cong-dong", "duong-ve", "trekking"],
    sortOrder: 146,
  },
  {
    slug: "sung-la",
    name: "Sủng Là",
    aliases: ["sung la", "sungla", "xa sung la", "thung lung sung la", "thung lung nuoc mat"],
    kind: "commune",
    parentSlug: "dong-van",
    geo: { lat: 23.25806, lng: 105.24861, elevationM: 1100, precision: "surveyed" },
    tags: ["mua-hoa-tam-giac-mach", "diem-check-in"],
    sortOrder: 186,
  },
  {
    slug: "pho-bang",
    name: "Phố Bảng",
    aliases: ["pho bang", "phobang", "thi tran pho bang", "pho bang dong van"],
    kind: "commune",
    parentSlug: "dong-van",
    // Thị trấn biên giới nằm trên một nhánh cụt rẽ khỏi quốc lộ 4C, nên khách chỉ tới nếu chủ
    // đích đi — đây là chi tiết cần nhớ khi xếp lịch, vì phải tính cả chiều quay ra.
    geo: { lat: 23.24639, lng: 105.19278, elevationM: 1300, precision: "surveyed" },
    tags: ["nhanh-cut", "gan-bien-gioi"],
    sortOrder: 188,
  },
  {
    slug: "sa-phin",
    name: "Sà Phìn",
    aliases: ["sa phin", "saphin", "xa sa phin", "sa phin dong van"],
    kind: "commune",
    parentSlug: "dong-van",
    geo: { lat: 23.2694, lng: 105.2861, elevationM: 1200, precision: "approximate" },
    tags: ["di-tich-quoc-gia"],
    sortOrder: 190,
  },
  {
    slug: "lung-cu",
    name: "Lũng Cú",
    aliases: ["lung cu", "lungcu", "xa lung cu", "thi tran lung cu"],
    kind: "commune",
    parentSlug: "dong-van",
    // "cuc bac", "diem cuc bac" cố tình không nằm ở đây mà nằm ở cột cờ: khách nói "đi cực bắc"
    // là đang nói tới cột cờ, không phải tới địa bàn xã.
    geo: { lat: 23.3492, lng: 105.3175, elevationM: 1400, precision: "approximate" },
    tags: ["gan-bien-gioi", "vong-cung-chinh"],
    sortOrder: 194,
  },
  {
    slug: "lung-phin",
    name: "Lũng Phìn",
    aliases: ["lung phin", "lungphin", "xa lung phin"],
    kind: "commune",
    parentSlug: "dong-van",
    geo: { lat: 23.12917, lng: 105.27583, elevationM: 1300, precision: "surveyed" },
    tags: ["cho-phien"],
    sortOrder: 210,
  },
  {
    slug: "pa-vi",
    name: "Pả Vi",
    aliases: ["pa vi", "pavi", "xa pa vi", "lang van hoa pa vi", "lang pa vi", "pa vi ha"],
    kind: "commune",
    parentSlug: "meo-vac",
    // Nằm ngay chân Mã Pí Lèng phía Mèo Vạc và là nơi tập trung phần lớn homestay của vùng, nên
    // hầu hết câu hỏi "ngủ gần Mã Pí Lèng ở đâu" cuối cùng đều rơi về đây.
    geo: { lat: 23.1525, lng: 105.40583, elevationM: 900, precision: "surveyed" },
    tags: ["lang-van-hoa-du-lich", "diem-ngu-dem"],
    sortOrder: 246,
  },
  {
    slug: "khau-vai",
    name: "Khâu Vai",
    aliases: ["khau vai", "khauvai", "xa khau vai"],
    kind: "commune",
    parentSlug: "meo-vac",
    // Đường vào Khâu Vai xấu và xa hơn khách hình dung; ngoài dịp chợ tình thì gần như không có
    // lý do đi, và điều đó phải được nói ra khi ai đó hỏi ghé ngang.
    geo: { lat: 23.0664, lng: 105.4869, elevationM: 700, precision: "approximate" },
    tags: ["duong-kho", "cho-phien"],
    sortOrder: 250,
  },

  // ---------------------------------------------------------------------------------------------
  // ĐỊA DANH
  //
  // Mọi mục ở khối này bắt buộc có `geo` đầy đủ, và `elevationM` mới là trường đáng giá nhất chứ
  // không phải kinh vĩ độ: Open-Meteo nội suy dự báo theo độ cao, mà chênh lệch giữa đáy sông Nho
  // Quế với đỉnh Mã Pí Lèng ở đây là hơn 1.200 m — tức là hai kiểu thời tiết khác nhau cách nhau
  // vài phút đi xe.
  //
  // Ba mục đầu là thực thể TRẢI RỘNG, không nằm gọn trong một vùng nào, nên chúng treo thẳng vào
  // "ha-giang".
  // ---------------------------------------------------------------------------------------------
  {
    slug: "cao-nguyen-da-dong-van",
    name: "Cao nguyên đá Đồng Văn",
    nameEn: "Dong Van Karst Plateau Geopark",
    aliases: [
      "cao nguyen da dong van",
      "cao nguyen da",
      "cao nguyen dong van",
      "cong vien dia chat dong van",
      "cong vien dia chat toan cau cao nguyen da dong van",
      "geopark dong van",
      "dong van karst plateau",
    ],
    kind: "landmark",
    // Cha là "ha-giang" chứ KHÔNG phải "dong-van", dù tên nghe như vậy. Cao nguyên đá trải trên cả
    // Quản Bạ, Yên Minh, Đồng Văn và Mèo Vạc; treo nó vào vùng Đồng Văn thì câu hỏi "có gì ở Đồng
    // Văn" sẽ gom về cả cao nguyên rồi kéo theo mọi thứ nằm trên đó, kể cả những nơi cách Đồng Văn
    // sáu bảy chục cây số.
    parentSlug: "ha-giang",
    // Toạ độ là một điểm đại diện giữa cao nguyên, không phải trọng tâm đo đạc. Độ cao 1.400 m là
    // mức phổ biến của mặt cao nguyên, còn thung lũng và đỉnh núi lệch khỏi con số này khá xa.
    // Tương tự sông Nho Quế: đây là một cao nguyên trải khắp bốn vùng, nên Wikipedia đặt điểm ở
    // 23.2809, 105.3640 (gần thị trấn Đồng Văn) còn ở đây đặt gần trọng tâm cao nguyên. Cả hai
    // đều đúng theo cách hiểu riêng; giữ điểm trọng tâm vì nó dùng cho câu hỏi về cả vùng.
    geo: { lat: 23.18, lng: 105.28, elevationM: 1400, precision: "approximate" },
    tags: ["unesco-geopark", "thuc-the-trai-rong"],
    sortOrder: 22,
  },
  {
    slug: "duong-hanh-phuc",
    name: "Con đường Hạnh Phúc (quốc lộ 4C)",
    nameEn: "Happiness Road",
    aliases: [
      "duong hanh phuc",
      "con duong hanh phuc",
      "happiness road",
      "quoc lo 4c",
      "ql4c",
      "ql 4c",
      "duong 4c",
    ],
    kind: "landmark",
    parentSlug: "ha-giang",
    // Một tuyến đường dài khoảng 185 km thì không có "một toạ độ" nào đúng. Điểm đặt ở đây là đoạn
    // Mã Pí Lèng, vì khi khách nói "chạy Con đường Hạnh Phúc" thì đoạn họ hình dung trong đầu gần
    // như luôn là đoạn này. Bất kỳ tính toán khoảng cách nào cũng phải dùng `RouteSegment` chứ
    // không được lấy điểm này làm đầu hay cuối chặng.
    geo: { lat: 23.2358, lng: 105.3867, elevationM: 1500, precision: "approximate" },
    tags: ["thuc-the-trai-rong", "di-tich-quoc-gia", "phu-hop-xe-may"],
    sortOrder: 24,
  },
  {
    slug: "cot-moc-bien-gioi",
    name: "Tuyến cột mốc biên giới Việt – Trung (đoạn Hà Giang)",
    aliases: [
      "cot moc bien gioi",
      "moc bien gioi",
      "cot moc bien gioi viet trung",
      "duong bien gioi",
      "bien gioi viet trung",
      "di cot moc",
    ],
    kind: "landmark",
    parentSlug: "ha-giang",
    // Đây là một thực thể GỘP, và cần nói thẳng điều đó. Đoạn biên giới này có hàng trăm cột mốc
    // đánh số; danh mục không kê từng cái vì người viết không kiểm chứng được vị trí của chúng, và
    // bịa ra một danh sách số hiệu là kiểu sai nguy hiểm nhất — khách sẽ đi tìm một cột mốc không
    // tồn tại ở nơi họ được chỉ. Mục này tồn tại để bắt câu hỏi chung chung "cho em đi cột mốc
    // biên giới với"; cột mốc duy nhất được kê riêng là mốc 428 ở khối di tích lịch sử. Câu hỏi về
    // một số hiệu khác phải được trả lời là chưa có dữ liệu, không được suy đoán.
    geo: { lat: 23.3706, lng: 105.3175, elevationM: 1300, precision: "approximate" },
    tags: ["thuc-the-gop", "can-giay-phep-bien-gioi", "gan-bien-gioi"],
    sortOrder: 26,
  },
  {
    slug: "ho-noong",
    name: "Hồ Noong",
    aliases: ["ho noong", "honoong", "ho noong vi xuyen"],
    kind: "landmark",
    parentSlug: "vi-xuyen",
    geo: { lat: 22.7519, lng: 105.0353, elevationM: 200, precision: "approximate" },
    tags: ["ho-nuoc", "cua-ngo-phia-nam"],
    sortOrder: 42,
  },
  {
    slug: "deo-bac-sum",
    name: "Dốc Bắc Sum",
    aliases: ["deo bac sum", "doc bac sum", "bac sum", "bacsum", "deo bacsum"],
    kind: "landmark",
    // Bắc Sum nằm vắt qua ranh giới Vị Xuyên – Quản Bạ. Treo vào Quản Bạ vì nó là cửa lên vùng
    // này: leo hết dốc là bắt đầu địa hình cao nguyên, và đó là cách khách trải nghiệm nó.
    parentSlug: "quan-ba",
    // Con dốc dài này là chỗ đầu tiên nhiệt độ tụt rõ so với thành phố — từ khoảng 100 m lên
    // khoảng 800 m chỉ trong vài cây số đường vòng.
    geo: { lat: 22.98817, lng: 104.9359, elevationM: 800, precision: "surveyed" },
    tags: ["duong-deo", "phu-hop-xe-may", "vong-cung-chinh"],
    sortOrder: 80,
  },
  {
    slug: "cong-troi-quan-ba",
    name: "Cổng Trời Quản Bạ",
    nameEn: "Quan Ba Heaven Gate",
    aliases: ["cong troi quan ba", "cong troi", "cong troi quanba", "heaven gate quan ba", "deo quan ba"],
    kind: "landmark",
    parentSlug: "quan-ba",
    geo: { lat: 23.04932, lng: 104.99302, elevationM: 1500, precision: "surveyed" },
    tags: ["duong-deo", "diem-ngam-canh", "vong-cung-chinh"],
    sortOrder: 102,
  },
  {
    slug: "nui-doi-co-tien",
    name: "Núi Đôi Cô Tiên",
    nameEn: "Fairy Twin Mountains",
    aliases: [
      "nui doi co tien",
      "nui doi",
      "nui doi quan ba",
      "nui doi quanba",
      "nui co tien",
      "fairy mountain",
      "twin mountain",
    ],
    kind: "landmark",
    parentSlug: "quan-ba",
    // Độ cao ghi ở đây là đỉnh của hai quả đồi, tức khoảng 100 m trên mặt thung lũng Tam Sơn.
    geo: { lat: 23.0508, lng: 104.9411, elevationM: 1100, precision: "approximate" },
    tags: ["diem-check-in", "vong-cung-chinh"],
    sortOrder: 106,
  },
  {
    slug: "rung-thong-yen-minh",
    name: "Rừng thông Yên Minh",
    aliases: ["rung thong yen minh", "rung thong", "rung thong yenminh", "doi thong yen minh", "da lat cua ha giang"],
    kind: "landmark",
    parentSlug: "yen-minh",
    // Giữ alias "da lat cua ha giang" vì đó là cách gọi lan truyền rộng trên mạng xã hội, dù nó
    // gây kỳ vọng sai về quy mô — bắt được tên khách gõ là việc của bộ phân giải, còn chỉnh kỳ
    // vọng là việc của câu trả lời.
    geo: { lat: 23.0894, lng: 105.1017, elevationM: 1100, precision: "approximate" },
    tags: ["diem-dung-nghi", "vong-cung-chinh"],
    sortOrder: 142,
  },
  {
    slug: "thac-du-gia",
    name: "Thác Du Già",
    aliases: ["thac du gia", "thac dugia", "thac nuoc du gia", "du gia waterfall"],
    kind: "landmark",
    parentSlug: "du-gia",
    geo: { lat: 22.9803, lng: 105.2392, elevationM: 650, precision: "approximate" },
    tags: ["thac-nuoc", "trekking", "duong-ve"],
    sortOrder: 148,
  },
  {
    slug: "doc-tham-ma",
    name: "Dốc Thẩm Mã",
    aliases: ["doc tham ma", "deo tham ma", "tham ma", "docthamma", "doc tham ma ha giang"],
    kind: "landmark",
    // Con dốc nằm đúng trên đoạn giáp ranh Yên Minh – Đồng Văn và các nguồn xếp nó về hai bên khác
    // nhau. Ở đây treo vào Yên Minh theo hướng đi lên: khách gặp nó khi vừa rời Yên Minh. Nếu sau
    // này xác minh được địa giới chính xác thì đổi `parentSlug`, đừng đổi `slug`.
    parentSlug: "yen-minh",
    geo: { lat: 23.169, lng: 105.19417, elevationM: 1200, precision: "surveyed" },
    tags: ["duong-deo", "diem-check-in", "vong-cung-chinh"],
    sortOrder: 152,
  },
  {
    slug: "doc-chin-khoanh",
    name: "Dốc Chín Khoanh",
    aliases: ["doc chin khoanh", "chin khoanh", "deo chin khoanh", "doc 9 khoanh", "doc chinkhoanh"],
    kind: "landmark",
    parentSlug: "dong-van",
    geo: { lat: 23.20986, lng: 105.19517, elevationM: 1300, precision: "surveyed" },
    tags: ["duong-deo", "diem-check-in", "vong-cung-chinh"],
    sortOrder: 182,
  },
  {
    slug: "cot-co-lung-cu",
    name: "Cột cờ Lũng Cú",
    nameEn: "Lung Cu Flag Tower",
    aliases: [
      "cot co lung cu",
      "cot co",
      "cuc bac",
      "diem cuc bac",
      "cot co quoc gia lung cu",
      "nui rong lung cu",
      "lung cu flag tower",
    ],
    kind: "landmark",
    parentSlug: "lung-cu",
    // Thực thể DUY NHẤT trong file được đánh `surveyed`: đây là điểm có toạ độ công bố rộng rãi và
    // kiểm chứng được, đứng trên núi Rồng ở khoảng 1.470 m. Mọi mục khác đều là ước lượng đọc bản
    // đồ, và trộn lẫn hai loại đó dưới cùng một nhãn sẽ khiến người sau tin nhầm toàn bộ file.
    geo: { lat: 23.3634, lng: 105.3225, elevationM: 1470, precision: "surveyed" },
    tags: ["di-tich-quoc-gia", "gan-bien-gioi", "co-thu-ve", "vong-cung-chinh"],
    sortOrder: 196,
  },
  {
    slug: "deo-ma-pi-leng",
    name: "Đèo Mã Pí Lèng",
    nameEn: "Ma Pi Leng Pass",
    aliases: [
      "ma pi leng",
      "mapileng",
      "deo ma pi leng",
      "deo mapileng",
      "ma pileng",
      "ma pi lang",
      "ma pi leng pass",
      "ma pi leng ha giang",
    ],
    kind: "landmark",
    // Đèo nối Đồng Văn với Mèo Vạc nên có thể treo về bên nào cũng biện luận được; chọn Mèo Vạc vì
    // phần lớn thân đèo và các điểm dừng nằm về phía này.
    parentSlug: "meo-vac",
    geo: { lat: 23.24081, lng: 105.41094, elevationM: 1500, precision: "surveyed" },
    tags: ["duong-deo", "duong-deo-nguy-hiem", "diem-ngam-canh", "vong-cung-chinh"],
    sortOrder: 232,
  },
  {
    slug: "song-nho-que",
    name: "Sông Nho Quế",
    nameEn: "Nho Que River",
    aliases: ["song nho que", "nho que", "nhoque", "dong song nho que", "nho que river"],
    kind: "landmark",
    parentSlug: "meo-vac",
    // Độ cao 270 m là mặt nước đoạn lòng hồ dưới Mã Pí Lèng, không phải cao độ nguồn. Đặt đúng con
    // số này quan trọng vì nó chênh với đỉnh đèo hơn 1.200 m: dự báo lấy theo đỉnh đèo mà áp cho
    // người đang ngồi thuyền dưới sông thì lệch cả một mùa.
    // TOẠ ĐỘ CÓ CHỦ ĐÍCH LỆCH VỚI WIKIPEDIA. Wikipedia đặt điểm của sông ở 23.1368, 105.5304 —
    // cách đây gần 18 km về phía đông, tức khúc hạ lưu. Với một con sông dài mấy chục km thì
    // "toạ độ của sông" là khái niệm tuỳ chọn, và điểm hữu ích cho sản phẩm này là khúc khách
    // thực sự tới: đoạn dưới hẻm Tu Sản, nơi có bến thuyền. Đừng "sửa" về theo Wikipedia.
    geo: { lat: 23.2247, lng: 105.3856, elevationM: 270, precision: "approximate" },
    tags: ["song", "di-chuyen-bang-thuyen"],
    sortOrder: 238,
  },
  {
    slug: "hem-tu-san",
    name: "Hẻm vực Tu Sản",
    nameEn: "Tu San Canyon",
    aliases: [
      "hem tu san",
      "hem vuc tu san",
      "tu san",
      "tusan",
      "hem nui tu san",
      "tu san canyon",
      "hem vuc sau nhat dong nam a",
    ],
    kind: "landmark",
    // Cha là con sông chứ không phải vùng: hẻm vực là một đoạn của Nho Quế, và cây này cho phép
    // câu hỏi về sông kéo theo cả hẻm mà không cần khai trùng.
    parentSlug: "song-nho-que",
    geo: { lat: 23.2331, lng: 105.3708, elevationM: 280, precision: "approximate" },
    tags: ["di-chuyen-bang-thuyen", "diem-check-in"],
    sortOrder: 240,
  },
  {
    slug: "ruong-bac-thang-hoang-su-phi",
    name: "Ruộng bậc thang Hoàng Su Phì",
    nameEn: "Hoang Su Phi Rice Terraces",
    aliases: [
      "ruong bac thang hoang su phi",
      "ruong bac thang",
      "ruong bac thang hoangsuphi",
      "ruong bac thang ha giang",
      "hoang su phi rice terraces",
    ],
    kind: "landmark",
    parentSlug: "hoang-su-phi",
    geo: { lat: 22.7331, lng: 104.6528, elevationM: 900, precision: "approximate" },
    tags: ["di-tich-quoc-gia", "mua-lua-chin", "nhanh-phia-tay"],
    sortOrder: 322,
  },
  {
    slug: "thac-tien-deo-gio",
    name: "Thác Tiên – Đèo Gió",
    aliases: ["thac tien", "deo gio", "thac tien deo gio", "thac tien xin man", "deo gio xin man"],
    kind: "landmark",
    parentSlug: "xin-man",
    geo: { lat: 22.58091, lng: 104.49356, elevationM: 1100, precision: "surveyed" },
    tags: ["thac-nuoc", "nhanh-phia-tay"],
    sortOrder: 342,
  },

  // ---------------------------------------------------------------------------------------------
  // ĐIỂM NGẮM CẢNH
  //
  // Khối này trả lời đúng một dạng câu hỏi: "đứng ở đâu". Mỗi mục là một chỗ có thể dừng xe, đặt
  // chân xuống và nhìn — cha của nó là địa danh mà nó nhìn vào, chứ không phải vùng chứa nó. Nhờ
  // vậy khi khách hỏi "ngắm hẻm Tu Sản ở đâu" thì chỉ cần lấy con của `hem-tu-san` là ra, không
  // phải quét mô tả văn xuôi.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "diem-ngam-bac-sum",
    name: "Điểm dừng đỉnh dốc Bắc Sum",
    aliases: ["diem ngam bac sum", "dinh doc bac sum", "diem dung bac sum", "view bac sum"],
    kind: "scenic_view",
    parentSlug: "deo-bac-sum",
    geo: { lat: 22.953, lng: 104.97, elevationM: 820, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-dung-nghi"],
    sortOrder: 82,
  },
  {
    slug: "dai-quan-sat-cong-troi-quan-ba",
    name: "Đài quan sát Cổng Trời Quản Bạ",
    aliases: [
      "dai quan sat cong troi quan ba",
      "dai quan sat quan ba",
      "dai quan sat cong troi",
      "diem ngam nui doi",
      "view nui doi",
      "cho dung ngam nui doi",
    ],
    kind: "scenic_view",
    // Cha là Cổng Trời chứ không phải Núi Đôi, dù thứ nhìn thấy từ đây chủ yếu là Núi Đôi: đài
    // quan sát nằm trên đỉnh Cổng Trời, và cây này mô tả VỊ TRÍ ĐỨNG. Các alias "diem ngam nui
    // doi", "view nui doi" được gắn vào đây chính vì lý do đó — khách hỏi chỗ ngắm Núi Đôi thì
    // phải ra được cái đài này, không phải ra được quả núi.
    parentSlug: "cong-troi-quan-ba",
    geo: { lat: 23.0408, lng: 104.9503, elevationM: 1500, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-check-in", "co-thu-ve"],
    sortOrder: 104,
  },
  {
    slug: "chan-thac-du-gia",
    name: "Chân thác Du Già",
    aliases: ["chan thac du gia", "bai tam du gia", "ho boi du gia", "diem tam thac du gia", "ho nuoc thac du gia"],
    kind: "scenic_view",
    parentSlug: "thac-du-gia",
    // Hồ nước dưới chân thác, phải đi bộ một đoạn đường mòn mới xuống tới nơi. Tách khỏi bản thân
    // con thác vì hai chỗ này đòi hai câu trả lời khác nhau: nhìn thác thì đứng trên đường cũng
    // thấy, còn tắm thì phải xuống tận đây và phải tính thêm thời gian cả đi lẫn về.
    geo: { lat: 22.98, lng: 105.239, elevationM: 640, precision: "approximate" },
    tags: ["diem-ngam-canh", "leo-bo", "trekking", "duong-ve"],
    sortOrder: 150,
  },
  {
    slug: "dinh-doc-tham-ma",
    name: "Đỉnh dốc Thẩm Mã",
    aliases: ["dinh doc tham ma", "diem ngam doc tham ma", "diem dung tham ma", "cho chup anh tham ma", "view tham ma"],
    kind: "scenic_view",
    parentSlug: "doc-tham-ma",
    geo: { lat: 23.2011, lng: 105.25, elevationM: 1230, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-check-in"],
    sortOrder: 154,
  },
  {
    slug: "dinh-doc-chin-khoanh",
    name: "Đỉnh dốc Chín Khoanh",
    aliases: ["dinh doc chin khoanh", "diem ngam chin khoanh", "diem dung chin khoanh", "view chin khoanh"],
    kind: "scenic_view",
    parentSlug: "doc-chin-khoanh",
    geo: { lat: 23.2192, lng: 105.2719, elevationM: 1330, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-check-in"],
    sortOrder: 184,
  },
  {
    slug: "dinh-lung-cu",
    name: "Đỉnh cột cờ Lũng Cú",
    aliases: [
      "dinh lung cu",
      "dinh cot co lung cu",
      "dai quan sat lung cu",
      "tren dinh cot co",
      "lan can cot co lung cu",
      "diem ngam lung cu",
    ],
    kind: "scenic_view",
    parentSlug: "cot-co-lung-cu",
    // Đây là ví dụ rõ nhất cho việc vì sao điểm ngắm phải là thực thể riêng: cùng một kinh vĩ độ
    // với chân cột cờ, nhưng khách phải leo 389 bậc rồi thêm cầu thang xoắn trong thân cột mới lên
    // tới lan can quan sát. Độ cao ghi 1.500 m là mặt lan can, tức cao hơn chân cột khoảng 30 m —
    // và quan trọng hơn con số là thông tin "phải leo bộ", thứ chỉ tồn tại được nếu điểm ngắm có
    // chỗ riêng để gắn tri thức vào. `precision` để `approximate` dù chân cột là `surveyed`, vì
    // độ cao ở đây là suy ra từ chiều cao công trình chứ không phải số đo công bố.
    geo: { lat: 23.3634, lng: 105.3225, elevationM: 1500, precision: "approximate" },
    tags: ["diem-ngam-canh", "leo-bo", "co-thu-ve"],
    sortOrder: 198,
  },
  {
    slug: "diem-ngam-ma-pi-leng",
    name: "Điểm dừng ngắm Mã Pí Lèng",
    aliases: [
      "diem ngam ma pi leng",
      "diem dung ma pi leng",
      "dai quan sat ma pi leng",
      "tuong dai thanh nien xung phong",
      "ben xe ma pi leng",
      "view ma pi leng",
    ],
    kind: "scenic_view",
    parentSlug: "deo-ma-pi-leng",
    // Bãi dừng rộng có tượng đài thanh niên xung phong, gần đỉnh đèo. Đây là chỗ mà xe khách và xe
    // giường nằm dừng được, khác hẳn mỏm đá Tu Sản bên dưới vốn chỉ vào được bằng xe máy.
    geo: { lat: 23.2381, lng: 105.3839, elevationM: 1470, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-dung-nghi", "xe-o-to-vao-duoc"],
    sortOrder: 234,
  },
  {
    slug: "vach-da-trang-ma-pi-leng",
    name: "Đường đi bộ vách đá trắng Mã Pí Lèng",
    aliases: [
      "vach da trang",
      "vach da trang ma pi leng",
      "duong di bo vach da trang",
      "duong vach da trang",
      "skywalk ma pi leng",
    ],
    kind: "scenic_view",
    parentSlug: "deo-ma-pi-leng",
    // Không phải điểm dừng xe mà là một lối mòn men theo vách, đi bộ mất khoảng một tiếng mỗi
    // chiều và không có lan can suốt tuyến. Tách riêng khỏi điểm dừng tượng đài chính là để hai
    // nơi này không bị gợi ý lẫn cho nhau: một chỗ hợp với đoàn có người lớn tuổi, một chỗ thì
    // không.
    geo: { lat: 23.24, lng: 105.38, elevationM: 1400, precision: "approximate" },
    tags: ["diem-ngam-canh", "leo-bo", "khong-hop-nguoi-so-do-cao"],
    sortOrder: 236,
  },
  {
    slug: "mom-da-tu-san",
    name: "Mỏm đá ngắm hẻm Tu Sản",
    aliases: [
      "mom da tu san",
      "mom da",
      "mom da ma pi leng",
      "mom da song nho que",
      "diem ngam hem tu san",
      "view hem tu san",
      "cho chup hem tu san",
    ],
    kind: "scenic_view",
    parentSlug: "hem-tu-san",
    // Mỏm đá nhô ra trên đường Mã Pí Lèng nhánh dưới, cao hơn mặt nước hẻm vực khoảng 600 m. Đây
    // đúng là câu trả lời cho "đứng ở đâu để chụp được hẻm Tu Sản", và cũng là lý do khối
    // `scenic_view` tồn tại: bản thân hẻm vực nằm dưới nước, không đứng lên được.
    geo: { lat: 23.235, lng: 105.375, elevationM: 900, precision: "approximate" },
    tags: ["diem-ngam-canh", "diem-check-in", "duong-kho", "phu-hop-xe-may"],
    sortOrder: 242,
  },
  {
    slug: "ben-thuyen-ta-lang",
    name: "Bến thuyền Tà Làng",
    aliases: [
      "ben thuyen ta lang",
      "ben ta lang",
      "ta lang",
      "doc ta lang",
      "ben thuyen nho que",
      "ben thuyen di hem tu san",
    ],
    kind: "scenic_view",
    parentSlug: "song-nho-que",
    // Xếp vào `scenic_view` chứ không phải một loại "bến bãi" riêng, vì đối với khách đây là điểm
    // dừng để nhìn hẻm vực từ mặt nước — góc nhìn hoàn toàn khác với mỏm đá phía trên. Đường xuống
    // bến là con dốc đất dựng, và đó là thông tin phải đi kèm mọi gợi ý tới đây.
    geo: { lat: 23.2039, lng: 105.3892, elevationM: 270, precision: "approximate" },
    tags: ["di-chuyen-bang-thuyen", "duong-kho", "can-xac-minh-places"],
    sortOrder: 244,
  },
  {
    slug: "diem-ngam-ban-phung",
    name: "Điểm ngắm ruộng bậc thang Bản Phùng",
    aliases: ["diem ngam ban phung", "ban phung", "ban phung hoang su phi", "view ruong bac thang ban phung"],
    kind: "scenic_view",
    parentSlug: "ruong-bac-thang-hoang-su-phi",
    geo: { lat: 22.7014, lng: 104.6019, elevationM: 1100, precision: "approximate" },
    tags: ["diem-ngam-canh", "mua-lua-chin", "nhanh-phia-tay", "duong-kho"],
    sortOrder: 324,
  },

  // ---------------------------------------------------------------------------------------------
  // DI TÍCH VĂN HOÁ ĐANG SỐNG
  //
  // Về `openingHours` của chợ phiên: cadence được đặt là "market_cycle" cho cả khối chợ, kể cả
  // những phiên rơi đúng Chủ nhật. Lý do là "weekly" ngụ ý một khung giờ làm việc cố định lặp lại
  // hằng tuần, còn chợ phiên thì không phải vậy — nó là một phiên có mở có tan, ngoài ngày phiên
  // thì mặt bằng gần như trống. Quan trọng hơn, cả họ này phải truy vấn được như một lớp: chợ
  // Lũng Phìn họp lùi dần theo chu kỳ, chợ tình Khâu Vai mỗi năm một lần theo âm lịch, chợ Đồng
  // Văn và Mèo Vạc rơi vào Chủ nhật. Gán ba cadence khác nhau thì câu hỏi "cuối tuần này có phiên
  // chợ nào không" phải hỏi ba lần. Ngày họp cụ thể và trung thực nằm ở trường `text`.
  //
  // Cả khối đều mang "can-xac-minh-places": giờ họp thật, và cả việc phiên chợ còn duy trì hay
  // không, phải để Google Places xác nhận lúc chạy. Dữ liệu ở đây chỉ là giá trị dự phòng.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "ban-nam-dam",
    name: "Làng văn hoá du lịch Nặm Đăm",
    aliases: ["ban nam dam", "lang nam dam", "lang van hoa nam dam", "lang du lich nam dam", "homestay nam dam"],
    kind: "cultural_site",
    parentSlug: "nam-dam",
    geo: { lat: 23.07, lng: 104.97, elevationM: 1050, precision: "approximate" },
    // Không đặt `openingHours`: một bản làng có người ở thì không có giờ mở cửa, và điền bừa
    // "08:00–17:00" vào đây sẽ khiến câu trả lời ngụ ý rằng ngoài khung đó thì không vào được.
    tags: ["lang-van-hoa-du-lich", "homestay-cong-dong", "can-xac-minh-places"],
    sortOrder: 112,
  },
  {
    slug: "lang-det-lanh-lung-tam",
    name: "Làng dệt lanh Lùng Tám",
    aliases: [
      "lang det lanh lung tam",
      "det lanh lung tam",
      "hop tac xa lanh lung tam",
      "lang lanh lung tam",
      "lung tam linen",
    ],
    kind: "cultural_site",
    parentSlug: "lung-tam",
    geo: { lat: 22.9989, lng: 104.9317, elevationM: 900, precision: "approximate" },
    // Khác với bản làng, hợp tác xã dệt là một cơ sở có giờ làm việc thật, và khách tới ngoài giờ
    // thì chỉ nhìn được nhà đóng cửa. Cadence "daily" vì xưởng mở các ngày trong tuần, nhưng vẫn
    // gắn nhãn cần xác minh vì khung giờ dưới đây là mặt bằng chung chứ không phải bảng niêm yết.
    openingHours: {
      text: "Khoảng 08:00–17:00 hằng ngày, thường nghỉ trưa; nên hỏi trước nếu muốn xem thợ dệt và nhuộm chàm tại chỗ.",
      cadence: "daily",
    },
    tags: ["lang-nghe", "can-xac-minh-places"],
    sortOrder: 116,
  },
  {
    slug: "cho-phien-dong-van",
    name: "Chợ phiên Đồng Văn",
    nameEn: "Dong Van Sunday Market",
    aliases: ["cho phien dong van", "cho dong van", "phien cho dong van", "cho chu nhat dong van", "dong van market"],
    kind: "cultural_site",
    parentSlug: "dong-van",
    geo: { lat: 23.2783, lng: 105.3625, elevationM: 1025, precision: "approximate" },
    openingHours: {
      text: "Phiên chính họp sáng Chủ nhật hằng tuần, đông nhất khoảng 06:00–10:00 rồi tan dần; các ngày khác khu chợ vẫn có hàng quán nhưng không còn là phiên.",
      cadence: "market_cycle",
    },
    tags: ["cho-phien", "vong-cung-chinh", "can-xac-minh-places"],
    sortOrder: 208,
  },
  {
    slug: "cho-lui-lung-phin",
    name: "Chợ lùi Lũng Phìn",
    aliases: ["cho lui lung phin", "cho lung phin", "cho phien lung phin", "cho lui", "lung phin market"],
    kind: "cultural_site",
    parentSlug: "lung-phin",
    geo: { lat: 23.12917, lng: 105.27583, elevationM: 1300, precision: "approximate" },
    // Đây là phiên chợ minh hoạ rõ nhất vì sao cadence phải là "market_cycle": ngày họp trôi lùi
    // qua từng tuần thay vì cố định vào một thứ, nên bất kỳ mô hình "thứ mấy trong tuần" nào cũng
    // sai sau vài tuần. Không ghi ngày họp cụ thể ở đây vì phải tính theo chu kỳ tại thời điểm
    // hỏi, và một ngày viết cứng vào file sẽ nhanh chóng thành thông tin sai.
    openingHours: {
      text: "Chợ lùi: mỗi phiên họp sớm hơn phiên trước một ngày trong tuần nên ngày họp trôi dần; phiên bắt đầu từ tờ mờ sáng và tan trước trưa. Cần tra ngày phiên gần nhất trước khi đi.",
      cadence: "market_cycle",
    },
    tags: ["cho-phien", "can-xac-minh-places"],
    sortOrder: 212,
  },
  {
    slug: "cho-phien-meo-vac",
    name: "Chợ phiên Mèo Vạc",
    nameEn: "Meo Vac Sunday Market",
    aliases: ["cho phien meo vac", "cho meo vac", "cho bo meo vac", "cho trau bo meo vac", "meo vac market"],
    kind: "cultural_site",
    parentSlug: "meo-vac",
    geo: { lat: 23.1611, lng: 105.4128, elevationM: 1000, precision: "approximate" },
    // Khu chợ bò họp sớm hơn hẳn phần còn lại. Chi tiết này đáng ghi vì khách đặt báo thức theo
    // giờ chợ thường sẽ tới lúc phần đáng xem nhất đã gần tan.
    openingHours: {
      text: "Họp sáng Chủ nhật hằng tuần; khu chợ bò nhóm sớm nhất, từ khoảng 04:30–05:00, còn chợ chính đông khoảng 06:00–10:00.",
      cadence: "market_cycle",
    },
    tags: ["cho-phien", "vong-cung-chinh", "can-xac-minh-places"],
    sortOrder: 248,
  },
  {
    slug: "cho-tinh-khau-vai",
    name: "Chợ tình Khâu Vai",
    nameEn: "Khau Vai Love Market",
    aliases: ["cho tinh khau vai", "cho tinh", "cho tinh khauvai", "cho phong luu khau vai", "khau vai love market"],
    kind: "cultural_site",
    parentSlug: "khau-vai",
    geo: { lat: 23.0664, lng: 105.4869, elevationM: 700, precision: "approximate" },
    // Mỗi năm đúng một phiên, tính theo âm lịch nên ngày dương lịch xê dịch hàng năm. Đây là lý do
    // không được viết một ngày dương lịch cố định vào file: viết "tháng 4" thì có năm sai hẳn.
    openingHours: {
      text: "Mỗi năm một phiên, vào ngày 27 tháng Ba âm lịch (những năm gần đây tổ chức kéo dài từ 26/3 âm lịch). Ngày dương lịch đổi theo từng năm nên phải quy đổi tại thời điểm hỏi.",
      cadence: "market_cycle",
    },
    tags: ["cho-phien", "le-hoi", "duong-kho", "can-xac-minh-places"],
    sortOrder: 252,
  },
  {
    slug: "ban-lo-lo-chai",
    name: "Bản Lô Lô Chải",
    aliases: ["ban lo lo chai", "lo lo chai", "lolo chai", "lang lo lo chai", "thon lo lo chai"],
    kind: "cultural_site",
    parentSlug: "lung-cu",
    // Nằm ngay dưới chân núi Rồng, đi bộ được từ cột cờ. Vị trí đó là lý do bản này gần như luôn
    // xuất hiện cùng cột cờ Lũng Cú trong một buổi.
    geo: { lat: 23.36, lng: 105.3247, elevationM: 1450, precision: "approximate" },
    tags: ["lang-van-hoa-du-lich", "homestay-cong-dong", "gan-bien-gioi", "can-xac-minh-places"],
    sortOrder: 200,
  },

  // ---------------------------------------------------------------------------------------------
  // DI TÍCH LỊCH SỬ
  //
  // Khác với khối trên, những nơi này không còn vận hành theo chức năng gốc — chúng là công trình
  // để xem. Hai mục cuối nằm sát đường biên và mang nhãn "can-giay-phep-bien-gioi": khách nước
  // ngoài và cả khách trong nước đều phải khai báo trước, và bỏ sót chi tiết này là để người ta
  // chạy hơn hai trăm cây số rồi bị mời quay lại.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "dinh-thu-ho-vuong",
    name: "Dinh thự họ Vương",
    nameEn: "Vuong Family Mansion",
    aliases: [
      "dinh thu ho vuong",
      "dinh vua meo",
      "dinh thu vua meo",
      "dinh vua meo sa phin",
      "nha vua meo",
      "dinh ho vuong",
      "nha vuong",
      "vuong palace",
    ],
    kind: "historical_site",
    parentSlug: "sa-phin",
    geo: { lat: 23.25649, lng: 105.26215, elevationM: 1200, precision: "surveyed" },
    openingHours: {
      text: "Mở cửa ban ngày hằng ngày, thường khoảng 07:00–17:00 và có bán vé tại cổng.",
      cadence: "daily",
    },
    // Cố tình không có `price` dù nơi này bán vé — xem giải thích ở đầu file. Giá vé thuộc về tài
    // liệu tri thức có trích dẫn nguồn và có ngày, không thuộc về danh mục.
    tags: ["di-tich-quoc-gia", "co-thu-ve", "vong-cung-chinh", "can-xac-minh-places"],
    sortOrder: 192,
  },
  {
    slug: "don-bien-phong-lung-cu",
    name: "Đồn Biên phòng Lũng Cú",
    aliases: ["don bien phong lung cu", "tram bien phong lung cu", "don bp lung cu", "bien phong lung cu"],
    kind: "historical_site",
    parentSlug: "lung-cu",
    // Không nhận alias trơ "don bien phong": dọc tuyến biên giới này có nhiều đồn, và một alias
    // chung chung sẽ kéo mọi câu hỏi về đúng một chỗ.
    geo: { lat: 23.3567, lng: 105.32, elevationM: 1400, precision: "approximate" },
    tags: ["gan-bien-gioi", "can-giay-phep-bien-gioi"],
    sortOrder: 202,
  },
  {
    slug: "cot-moc-428",
    name: "Cột mốc 428",
    aliases: ["cot moc 428", "moc 428", "cot moc so 428", "428", "diem cuc bac 428"],
    kind: "historical_site",
    parentSlug: "lung-cu",
    // Cột mốc duy nhất được kê riêng trong file, vì nó là điểm mà khách chủ đích đi tới chứ không
    // phải một mốc gặp dọc đường. Đường xuống là lối mòn dốc và phải khai báo với biên phòng
    // trước; toạ độ dưới đây là ước lượng đoạn cuối lối mòn, đừng dùng để dẫn đường.
    geo: { lat: 23.3892, lng: 105.3239, elevationM: 1000, precision: "approximate" },
    tags: ["gan-bien-gioi", "can-giay-phep-bien-gioi", "leo-bo", "duong-kho"],
    sortOrder: 204,
  },
  {
    slug: "pho-co-dong-van",
    name: "Phố cổ Đồng Văn",
    nameEn: "Dong Van Old Quarter",
    aliases: ["pho co dong van", "khu pho co dong van", "pho co", "dem pho co dong van", "dong van old quarter"],
    kind: "historical_site",
    parentSlug: "dong-van",
    geo: { lat: 23.2778, lng: 105.3617, elevationM: 1025, precision: "approximate" },
    // Cadence "market_cycle" ở đây không phải chợ mà là nhịp âm lịch của "Đêm phố cổ" — kiểu lịch
    // duy nhất trong `StaticOpeningHours` diễn tả được một sự kiện lặp theo tuần trăng. Bản thân
    // dãy phố thì đi lại tự do mọi lúc, và câu văn dưới đây phải nói rõ cả hai điều đó để khách
    // không tưởng rằng ngoài đêm hội thì phố đóng.
    openingHours: {
      text: "Dãy phố đi lại tự do mọi ngày; riêng 'Đêm phố cổ' với hát dân ca và ẩm thực được tổ chức vào các đêm 14–16 âm lịch hằng tháng.",
      cadence: "market_cycle",
    },
    tags: ["di-tich-quoc-gia", "vong-cung-chinh", "diem-ngu-dem"],
    sortOrder: 206,
  },
  {
    slug: "cang-bac-me",
    name: "Căng Bắc Mê",
    aliases: ["cang bac me", "di tich cang bac me", "nha tu cang bac me", "cang bac me ha giang"],
    kind: "historical_site",
    parentSlug: "bac-me",
    // Nhà tù thời Pháp thuộc, nằm trên đường về theo cung phía đông. Đưa vào danh mục vì đây gần
    // như là lý do duy nhất khách dừng lại ở Bắc Mê thay vì chạy thẳng.
    geo: { lat: 22.73091, lng: 105.37421, elevationM: 220, precision: "surveyed" },
    tags: ["di-tich-quoc-gia", "nhanh-phia-dong", "duong-ve"],
    sortOrder: 302,
  },
  {
  "slug": "dong-lung-khuy",
  "name": "Động Lùng Khúy",
  "aliases": [
    "dong lung khuy",
    "hang lung khuy"
  ],
  "kind": "landmark",
  "parentSlug": "quan-ba",
  "tags": [
    "explore-expanded-20260918"
  ],
  "sortOrder": 310
},
  {
  "slug": "lang-van-hoa-pa-vi-ha",
  "name": "Làng văn hóa du lịch Pả Vi Hạ",
  "aliases": [
    "lang pa vi ha"
  ],
  "kind": "cultural_site",
  "parentSlug": "pa-vi",
  "tags": [
    "explore-expanded-20260918"
  ],
  "sortOrder": 311
},
  {
  "slug": "dinh-chieu-lau-thi",
  "name": "Đỉnh Chiêu Lầu Thi",
  "aliases": [
    "chieu lau thi",
    "dinh chieu lau thi"
  ],
  "kind": "landmark",
  "parentSlug": "hoang-su-phi",
  "tags": [
    "explore-expanded-20260918"
  ],
  "sortOrder": 312
},
  {
  "slug": "bai-da-co-nam-dan",
  "name": "Bãi đá cổ Nấm Dẩn",
  "aliases": [
    "bai da co nam dan",
    "bai da co xin man"
  ],
  "kind": "historical_site",
  "parentSlug": "xin-man",
  "tags": [
    "explore-expanded-20260918"
  ],
  "sortOrder": 313
},
  {
  "slug": "thao-nguyen-suoi-thau",
  "name": "Thảo nguyên Suôi Thầu",
  "aliases": [
    "suoi thau",
    "thao nguyen suoi thau"
  ],
  "kind": "landmark",
  "parentSlug": "xin-man",
  "tags": [
    "explore-expanded-20260918"
  ],
  "sortOrder": 314
},
];
