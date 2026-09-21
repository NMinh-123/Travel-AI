/**
 * ĐIỂM ĐO THỜI TIẾT — bảng ánh xạ từ thực thể trong @data/places sang toạ độ sẽ hỏi Open-Meteo.
 *
 * NGUYÊN TẮC CHI PHỐI TOÀN BỘ FILE: Ở ĐỊA BÀN NÀY, KHOẢNG CÁCH NGANG KHÔNG QUYẾT ĐỊNH THỜI TIẾT,
 * ĐỘ CAO MỚI QUYẾT ĐỊNH. Ví dụ sạch nhất nằm ngay trong danh sách dưới đây: lòng sông Nho Quế ở
 * 270 m và đỉnh đèo Mã Pí Lèng ở 1.500 m cách nhau chưa tới 2 km đường chim bay, nhưng chênh
 * nhau khoảng 1.200 m độ cao. Theo gradient nhiệt thông thường của khí quyển, chừng đó độ cao đã
 * là chênh 6–8 độ trong cùng một khoảnh khắc; chưa kể mùa đông đỉnh đèo chìm trong mây mù còn
 * dưới sông vẫn nắng, và mùa hè thì ngược lại, hơi nước dồn trong hẻm vực. Nếu dùng một điểm đo
 * chung cho cả khu Mã Pí Lèng thì bất kể chọn điểm nào cũng sai cho một nửa số khách: người đi
 * thuyền được cảnh báo rét đỉnh đèo, hoặc người dừng xe trên đèo được báo trời quang.
 *
 * Đó là lý do file này tách điểm đo theo TẦNG ĐỘ CAO chứ không theo vùng hành chính hay theo
 * khoảng cách. Ngưỡng làm việc: chênh quá khoảng 300 m thì tách điểm, dưới ngưỡng đó thì dùng
 * chung. Ngưỡng này được áp dụng nhất quán ở cả những chỗ trông có vẻ vô lý — cột mốc 428 chỉ
 * cách chân cột cờ Lũng Cú 3 km đường nhưng thấp hơn 470 m, nên nó có điểm đo riêng.
 *
 * VÌ SAO NHIỀU THỰC THỂ DÙNG CHUNG MỘT ĐIỂM. Hai mươi mốt điểm dưới đây phục vụ 59 thực thể.
 * Gọi API riêng cho từng thực thể là đốt hạn mức để nhận về cùng một câu trả lời — chợ phiên
 * Đồng Văn và phố cổ Đồng Văn nằm cách nhau vài trăm mét trong cùng một thung lũng, không có dự
 * báo nào phân biệt được chúng. Chiều ngược lại là ràng buộc cứng của kiểu `WeatherPoint`: một
 * slug chỉ được xuất hiện ở ĐÚNG MỘT điểm. Trùng thì bộ phân giải chọn theo thứ tự khai báo, tức
 * là chọn bừa, và chọn bừa một cách im lặng.
 *
 * NĂM THỰC THỂ CỐ TÌNH KHÔNG CÓ ĐIỂM ĐO. `tuyen-quang`, `ha-giang`, `cao-nguyen-da-dong-van`,
 * `duong-hanh-phuc` và `cot-moc-bien-gioi` đều không xuất hiện trong `servesPlaceSlugs`, vì
 * chúng cũng không có `geo` trong @data/places và vì lý do giống nhau: chúng trải quá rộng để
 * một con số nói được điều gì đúng. Đường Hạnh Phúc dài hơn 180 km và đi từ 100 m lên 1.500 m
 * rồi xuống lại. Câu hỏi "thời tiết Hà Giang thế nào" phải được phân giải xuống một vùng hoặc
 * một điểm cụ thể TRƯỚC khi gọi công cụ; gán đại cho chúng một điểm đo là biến việc thiếu thông
 * tin thành một câu trả lời tự tin.
 *
 * TIỀN TỐ `wp-` TRONG `id`. Khoá điểm đo và slug thực thể nhìn giống hệt nhau khi nằm trong log
 * hay trong trace, mà hai thứ đó thuộc hai không gian tên khác nhau. Tiền tố làm cho việc nhầm
 * lẫn không thể xảy ra khi đọc, và làm cho việc tìm kiếm chuỗi trong repo trả về đúng nhóm.
 *
 * Toạ độ ở đây lấy thẳng từ @data/places/geography.ts để hai file không trôi khỏi nhau; chỗ nào
 * lệch thì đã ghi rõ lý do trong `rationale` của điểm đó.
 */

import type { WeatherPoint } from "./types";

export const WEATHER_POINTS: WeatherPoint[] = [
  // -----------------------------------------------------------------------------------------
  // TẦNG THẤP PHÍA NAM — thung lũng sông Lô, 100–220 m
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-tp-ha-giang",
    label: "thành phố Hà Giang, 100 m",
    lat: 22.8233,
    lng: 104.9836,
    elevationM: 100,
    servesPlaceSlugs: ["tp-ha-giang", "thon-tha", "vi-xuyen", "ho-noong"],
    rationale:
      "Đặt ở trung tâm thành phố vì đây là mốc thấp nhất và là nơi hầu hết hành trình bắt đầu — mọi con số độ cao khác trong file nên được đọc trong tương quan với nó. Bốn thực thể dùng chung điểm này đều nằm trong thung lũng sông Lô trong bán kính 15 km và chênh nhau chưa tới 100 m, nên tách ra cũng chỉ nhận về cùng một dự báo.",
  },
  {
    id: "wp-bac-me",
    label: "Bắc Mê, 200 m",
    lat: 22.735,
    lng: 105.305,
    elevationM: 200,
    servesPlaceSlugs: ["bac-me", "cang-bac-me"],
    rationale:
      "Bắc Mê nằm ở thung lũng sông Gâm phía đông nam, cách thành phố Hà Giang khoảng 50 km và ở cùng tầng độ cao, nhưng là một lưu vực khác nên vẫn đo riêng. Căng Bắc Mê nằm ngay trong thị trấn, chênh 20 m, dùng chung là hợp lý.",
  },

  // -----------------------------------------------------------------------------------------
  // NHÁNH PHÍA TÂY — Hoàng Su Phì, Xín Mần
  //
  // Nhánh này tách hẳn khỏi vòng cung chính và có nhịp thời tiết riêng: mưa nhiều hơn, mùa lúa
  // chín lệch, và sương xuống sớm hơn trên các sườn ruộng bậc thang.
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-hoang-su-phi",
    label: "sườn ruộng bậc thang Hoàng Su Phì, 1.000 m",
    lat: 22.7331,
    lng: 104.6528,
    elevationM: 1000,
    servesPlaceSlugs: ["hoang-su-phi", "ruong-bac-thang-hoang-su-phi", "diem-ngam-ban-phung"],
    rationale:
      "Điểm đo đặt trên vành ruộng bậc thang ở khoảng 1.000 m chứ không ở trung tâm Hoàng Su Phì (550 m), và slug vùng cũng được gắn vào đây. Lý do là câu hỏi thật: khách hỏi thời tiết Hoàng Su Phì để biết sáng mai còn nhìn thấy ruộng hay chỉ thấy sương, chứ không phải để biết nhiệt độ chỗ mình ngủ. Nếu về sau danh mục có thêm thực thể nằm hẳn dưới thị trấn thì phải mở một điểm đo riêng ở 550 m, vì chênh 450 m đã vượt ngưỡng 300 m của file này.",
  },
  {
    id: "wp-xin-man",
    label: "Xín Mần, 600 m",
    lat: 22.6606,
    lng: 104.4869,
    elevationM: 600,
    servesPlaceSlugs: ["xin-man"],
    rationale:
      "Xín Mần là góc tây nam xa nhất của địa bàn, cách vòng cung chính hơn 100 km. Chỉ phục vụ một thực thể nhưng vẫn phải có điểm riêng, vì điểm gần nhất là Hoàng Su Phì thì chênh 400 m và cách 25 km đường núi.",
  },
  {
    id: "wp-thac-tien-deo-gio",
    label: "Thác Tiên – Đèo Gió, 1.100 m",
    lat: 22.6289,
    lng: 104.5497,
    elevationM: 1100,
    servesPlaceSlugs: ["thac-tien-deo-gio"],
    rationale:
      "Cách trung tâm Xín Mần chưa tới 10 km đường chim bay nhưng cao hơn 500 m và nằm trên một con đèo mang đúng cái tên nói lên vấn đề. Đây là trường hợp áp dụng ngưỡng 300 m một cách máy móc và đúng: rừng nguyên sinh trên đỉnh đèo ẩm và lạnh hơn thị trấn dưới chân rõ rệt.",
  },

  // -----------------------------------------------------------------------------------------
  // VÒNG CUNG CHÍNH, CHẶNG MỘT — từ thành phố lên cao nguyên đá
  //
  // Chỉ trong khoảng 45 km đường, khách đi từ 100 m lên 1.500 m. Ba điểm đo dưới đây nằm trên
  // đúng đoạn dốc đó và tồn tại để mô tả được cú leo ấy.
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-deo-bac-sum",
    label: "đèo Bắc Sum, 820 m",
    lat: 22.953,
    lng: 104.97,
    elevationM: 820,
    servesPlaceSlugs: ["deo-bac-sum", "diem-ngam-bac-sum"],
    rationale:
      "Con đèo đầu tiên của hành trình, cao hơn thành phố 700 m sau chỉ 25 km chạy xe. Đo ở lưng chừng đèo — nơi có bãi dừng ngắm — vì đây là chỗ khách thực sự đứng lại, và cũng là chỗ đầu tiên họ gặp sương mù nếu hôm đó có sương.",
  },
  {
    id: "wp-cong-troi-quan-ba",
    label: "Cổng Trời Quản Bạ, 1.500 m",
    lat: 23.0403,
    lng: 104.9497,
    elevationM: 1500,
    servesPlaceSlugs: ["cong-troi-quan-ba", "dai-quan-sat-cong-troi-quan-ba"],
    rationale:
      "Cửa ngõ lên cao nguyên đá và là một trong hai điểm cao nhất có điểm đo riêng. Không gộp với thung lũng Tam Sơn ngay bên dưới dù hai nơi cách nhau chưa tới 4 km: chênh 500 m, và chính chỗ này là nơi mây thường dừng lại — đứng trên Cổng Trời nhìn xuống thấy thung lũng chìm trong sương là cảnh xảy ra rất nhiều buổi sáng.",
  },
  {
    id: "wp-tam-son",
    label: "thung lũng Tam Sơn (Quản Bạ), 1.000 m",
    lat: 23.0553,
    lng: 104.9436,
    elevationM: 1000,
    servesPlaceSlugs: [
      "quan-ba",
      "tam-son",
      "nui-doi-co-tien",
      "nam-dam",
      "ban-nam-dam",
      "lung-tam",
      "lang-det-lanh-lung-tam",
    ],
    rationale:
      "Đáy thung lũng Tam Sơn, nơi khách thực sự nghỉ đêm và là chỗ tập trung nhiều thực thể nhất trong vùng Quản Bạ. Bảy thực thể dùng chung điểm này nằm trong bán kính 6 km và trong khoảng 900–1.100 m, tức lọt gọn dưới ngưỡng 300 m.",
  },

  // -----------------------------------------------------------------------------------------
  // VÒNG CUNG CHÍNH, CHẶNG HAI — Yên Minh và nhánh rẽ Du Già
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-yen-minh",
    label: "thị trấn Yên Minh, 900 m",
    lat: 23.1181,
    lng: 105.1508,
    elevationM: 900,
    servesPlaceSlugs: ["yen-minh", "mau-due", "rung-thong-yen-minh"],
    rationale:
      "Điểm nghỉ trưa quen thuộc của ngày thứ hai. Rừng thông Yên Minh ở 1.100 m và Mậu Duệ ở 800 m đều nằm trong khoảng 200 m so với thị trấn nên dùng chung; cả ba cùng thuộc một dải thung lũng chạy theo quốc lộ 4C.",
  },
  {
    id: "wp-du-gia",
    label: "thung lũng Du Già, 700 m",
    lat: 22.9847,
    lng: 105.2314,
    elevationM: 700,
    servesPlaceSlugs: ["du-gia", "thac-du-gia", "chan-thac-du-gia"],
    rationale:
      "Du Già nằm sâu trong một thung lũng khuất, thấp hơn Yên Minh 200 m nhưng cách 40 km đường đèo và thuộc lưu vực khác — địa hình lòng chảo kín này giữ ẩm nên mưa rào mùa hè ở đây không suy ra được từ dự báo của Yên Minh. Thác và chân thác chênh nhau chỉ vài chục mét, dùng chung với thung lũng là đủ.",
  },

  // -----------------------------------------------------------------------------------------
  // VÒNG CUNG CHÍNH, CHẶNG BA — dốc Thẩm Mã lên Đồng Văn
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-doc-tham-ma",
    label: "đỉnh dốc Thẩm Mã, 1.230 m",
    lat: 23.2011,
    lng: 105.25,
    elevationM: 1230,
    servesPlaceSlugs: ["doc-tham-ma", "dinh-doc-tham-ma", "doc-chin-khoanh", "dinh-doc-chin-khoanh"],
    rationale:
      "Một điểm cho cả hai con dốc nối tiếp nhau: Thẩm Mã ở 1.230 m và Chín Khoanh ở 1.330 m, cách nhau 3 km và chênh 100 m. Đây là mặt đối lập của trường hợp Mã Pí Lèng — gần nhau về ngang VÀ gần nhau về cao thì gộp, còn gần nhau về ngang mà xa nhau về cao thì tách.",
  },
  {
    id: "wp-sung-la",
    label: "thung lũng Sủng Là – Sà Phìn, 1.150 m",
    lat: 23.2528,
    lng: 105.2957,
    elevationM: 1150,
    servesPlaceSlugs: ["sung-la", "sa-phin", "dinh-thu-ho-vuong"],
    rationale:
      "Toạ độ đặt giữa Sủng Là (1.100 m) và Sà Phìn (1.200 m) thay vì trùng với một trong hai, vì cả hai đều là điểm dừng chính và không có lý do ưu tiên cái nào. ĐÃ BỎ Phố Bảng khỏi điểm đo này ngày 2026-09-10: rationale cũ nói nó 'cách 5 km', nhưng sau khi hiệu chỉnh toạ độ Phố Bảng theo Wikipedia thì khoảng cách thật là 10,5 km — vượt xa mức mà một điểm đo dùng chung còn có nghĩa. Phố Bảng hiện KHÔNG có điểm đo; hỏi thời tiết ở đó sẽ leo lên vùng cha thay vì nhận một dự báo của thung lũng khác.",
  },
  {
    id: "wp-dong-van",
    label: "thị trấn Đồng Văn, 1.025 m",
    lat: 23.2783,
    lng: 105.3625,
    elevationM: 1025,
    servesPlaceSlugs: ["dong-van", "pho-co-dong-van", "cho-phien-dong-van"],
    rationale:
      "Thị trấn nằm trong một lòng chảo đá, thấp hơn các dốc vừa vượt qua khoảng 200 m. Phố cổ và chợ phiên cách trung tâm vài trăm mét — không dự báo nào phân biệt được ba chỗ này, nên tách ra chỉ là gọi cùng một câu hỏi ba lần.",
  },

  // -----------------------------------------------------------------------------------------
  // NHÁNH LŨNG CÚ — cực bắc
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-lung-cu",
    label: "cột cờ Lũng Cú, 1.470 m",
    lat: 23.3634,
    lng: 105.3225,
    elevationM: 1470,
    servesPlaceSlugs: ["cot-co-lung-cu", "dinh-lung-cu", "lung-cu", "ban-lo-lo-chai", "don-bien-phong-lung-cu"],
    rationale:
      "Toạ độ duy nhất trong danh mục được đánh `surveyed`, nên đây là điểm đo đáng tin nhất của cả file. Đỉnh cột cờ, chân cột cờ, bản Lô Lô Chải và đồn biên phòng đều nằm quanh núi Rồng trong khoảng 1.400–1.500 m nên dùng chung.",
  },
  {
    id: "wp-cot-moc-428",
    label: "cột mốc 428, 1.000 m",
    lat: 23.3892,
    lng: 105.3239,
    elevationM: 1000,
    servesPlaceSlugs: ["cot-moc-428"],
    rationale:
      "Chỉ cách chân cột cờ Lũng Cú 3 km nhưng nằm dưới khe, thấp hơn 470 m. Tách ra dù chỉ phục vụ một thực thể là để giữ ngưỡng 300 m nhất quán: một ngoại lệ 'gần quá nên gộp cho gọn' sẽ được viện dẫn lại cho trường hợp tiếp theo, rồi tới lượt Mã Pí Lèng cũng bị gộp vì cùng lý do.",
  },

  // -----------------------------------------------------------------------------------------
  // KHU MÃ PÍ LÈNG — ba tầng độ cao trong bán kính 2 km
  //
  // Đây là chỗ mà nguyên tắc của cả file được thể hiện rõ nhất, nên đọc ba mục liền nhau. Đỉnh
  // đèo 1.500 m, mỏm đá ngắm hẻm vực 900 m, mặt nước Nho Quế 270 m — ba điểm gần như chồng lên
  // nhau trên bản đồ phẳng, chênh nhau tổng cộng 1.230 m theo chiều đứng. Một điểm đo chung cho
  // cả ba là cách nhanh nhất để nói sai về nơi được hỏi nhiều nhất trong toàn bộ hành trình.
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-dinh-ma-pi-leng",
    label: "đỉnh đèo Mã Pí Lèng, 1.500 m",
    lat: 23.2358,
    lng: 105.3867,
    elevationM: 1500,
    servesPlaceSlugs: ["deo-ma-pi-leng", "diem-ngam-ma-pi-leng", "vach-da-trang-ma-pi-leng"],
    rationale:
      "Đo ở đỉnh đèo chứ không ở trọng tâm hình học của con đèo dài hơn 20 km, vì đỉnh mới là nơi khách dừng và là nơi thời tiết khắc nghiệt nhất. Điểm dừng tượng đài (1.470 m) và lối đi bộ vách đá trắng (1.400 m) chênh dưới 100 m nên dùng chung. Với riêng lối vách đá trắng, dự báo gió và tầm nhìn ở đây không phải thông tin trang trí: đó là một lối mòn men vách, không lan can, đi bộ khoảng một tiếng mỗi chiều.",
  },
  {
    id: "wp-mom-da-tu-san",
    label: "mỏm đá ngắm hẻm Tu Sản, 900 m",
    lat: 23.235,
    lng: 105.375,
    elevationM: 900,
    servesPlaceSlugs: ["mom-da-tu-san"],
    rationale:
      "Tầng giữa của khu Mã Pí Lèng, trên nhánh đường thấp. Cách đỉnh đèo khoảng 1 km đường chim bay nhưng thấp hơn 600 m, và cách mặt nước hẻm vực bên dưới cũng 600 m — nằm đúng giữa hai điểm kia, không thuộc về bên nào. Sương thường đọng ở đúng dải độ cao này vào buổi sáng, tức là chính lúc khách tới để chụp ảnh, nên đây là điểm đo có giá trị thực tế cao nhất trong ba điểm.",
  },
  {
    id: "wp-long-song-nho-que",
    label: "lòng sông Nho Quế dưới hẻm Tu Sản, 270 m",
    lat: 23.2247,
    lng: 105.3856,
    elevationM: 270,
    servesPlaceSlugs: ["song-nho-que", "hem-tu-san", "ben-thuyen-ta-lang"],
    rationale:
      "Điểm đo quan trọng nhất của cả file về mặt thiết kế. Nó cách đỉnh đèo Mã Pí Lèng chưa tới 2 km đường chim bay nhưng thấp hơn khoảng 1.200 m, và đó chính là lý do dự án không dùng một điểm đo cho cả một vùng: khách ngồi thuyền dưới đây và khách đứng trên đèo ở hai kiểu thời tiết khác hẳn nhau trong cùng một giờ. Bến thuyền Tà Làng ở cùng mặt nước nên gộp vào.",
  },

  // -----------------------------------------------------------------------------------------
  // VÒNG CUNG CHÍNH, CHẶNG BỐN — Mèo Vạc và các nhánh phía đông
  // -----------------------------------------------------------------------------------------
  {
    id: "wp-meo-vac",
    label: "thị trấn Mèo Vạc, 1.000 m",
    lat: 23.1611,
    lng: 105.4128,
    elevationM: 1000,
    servesPlaceSlugs: ["meo-vac", "cho-phien-meo-vac", "pa-vi"],
    rationale:
      "Lòng chảo Mèo Vạc, điểm nghỉ đêm sau khi vượt Mã Pí Lèng. Chợ phiên họp ngay trong thị trấn và Pả Vi ở 900 m cách 3 km, đều dưới ngưỡng nên dùng chung điểm này.",
  },
  {
    id: "wp-lung-phin",
    label: "Lũng Phìn, 1.300 m",
    // Toạ độ hiệu chỉnh ngày 2026-09-10 theo Wikipedia tiếng Việt. Bản trước đặt ở
    // 23.1878, 105.3547 — cách xã Lũng Phìn 10,4 km, tức điểm đo nằm ở một thung lũng khác
    // hẳn nơi nó mang tên. Với một điểm đo mà cả giá trị nằm ở việc nội suy đúng độ cao thì
    // sai 10 km là sai hoàn toàn.
    lat: 23.12917,
    lng: 105.27583,
    elevationM: 1300,
    servesPlaceSlugs: ["lung-phin", "cho-lui-lung-phin"],
    rationale:
      "Lũng Phìn nằm trên yên ngựa giữa Đồng Văn và Mèo Vạc, cao hơn cả hai thị trấn khoảng 300 m và thường xuyên có mù. Đúng bằng ngưỡng tách nên tách — và đây là thông tin có ích thật, vì chợ lùi Lũng Phìn họp từ sớm tinh mơ, lúc mù dày nhất.",
  },
  {
    id: "wp-khau-vai",
    label: "Khâu Vai, 700 m",
    lat: 23.0664,
    lng: 105.4869,
    elevationM: 700,
    servesPlaceSlugs: ["khau-vai", "cho-tinh-khau-vai"],
    rationale:
      "Cách Mèo Vạc khoảng 24 km về phía đông nam và thấp hơn 300 m, nằm ở một thung lũng riêng gần sông Nhiệm. Chợ tình Khâu Vai chỉ họp mỗi năm một phiên nên nhu cầu tra thời tiết dồn hết vào vài ngày — càng cần con số đúng cho đúng chỗ.",
  },
];


/**
 * ĐIỂM ĐO TRUNG TÂM CHO NHỮNG THỰC THỂ TRẢI QUÁ RỘNG ĐỂ CÓ ĐIỂM ĐO RIÊNG.
 *
 * Khối chú thích ở đầu file đã nói vì sao `ha-giang`, `cao-nguyen-da-dong-van`, `duong-hanh-phuc`
 * và `tuyen-quang` không nằm trong `servesPlaceSlugs` của bất kỳ điểm nào. Điều đó vẫn đúng cho
 * việc PHỤC VỤ: không điểm nào đại diện được cho toàn bộ một vùng trải 1.400 m độ cao.
 *
 * Nhưng hệ quả thực tế của việc dừng ở đó là câu hỏi phổ biến nhất của khách — "thời tiết Hà
 * Giang hôm nay thế nào" — luôn trả về "chưa tra được", trong khi dữ liệu thì có sẵn ở hai chục
 * điểm bên trên. Khách hỏi một câu hợp lý và nhận về một lời từ chối.
 *
 * Bảng này là lối ra: mỗi thực thể rộng được gán MỘT điểm trung tâm — nơi đông khách nhất và
 * cũng là nơi người ta ngầm hiểu khi nói tên vùng đó. Câu trả lời bắt buộc phải ghi rõ số liệu
 * thuộc điểm nào, nên khách vẫn biết mình đang đọc con số của chỗ nào chứ không nhận một con số
 * trôi nổi gán cho cả vùng — đúng thứ mà khối chú thích đầu file cấm.
 */
export const BROAD_PLACE_CENTERS: Record<string, string> = {
  // Thành phố là nơi gần như mọi hành trình bắt đầu và là mốc thấp nhất của cả tỉnh.
  "ha-giang": "wp-tp-ha-giang",
  "tuyen-quang": "wp-tp-ha-giang",

  // Thị trấn Đồng Văn nằm giữa cao nguyên đá và là nơi khách ngủ lại đông nhất trên đó.
  "cao-nguyen-da-dong-van": "wp-dong-van",

  // Đường Hạnh Phúc dài hơn 180 km; Đồng Văn là chặng giữa và là mốc quen thuộc nhất của nó.
  "duong-hanh-phuc": "wp-dong-van",

  // Hai cột mốc khách thật sự tới đều thuộc cụm Lũng Cú; chân cột cờ là chỗ đông người nhất.
  "cot-moc-bien-gioi": "wp-lung-cu",
};
