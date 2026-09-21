/**
 * CHẶNG ĐƯỜNG KHUNG — các cung mà khách hỏi đi hỏi lại, khai sẵn để cache được làm nóng trước.
 *
 * ĐÂY LÀ ĐƯỜNG TẮT, KHÔNG PHẢI HÀNG RÀO. Chặng nào không có trong danh sách thì tool layer vẫn
 * gọi Routes API theo toạ độ bình thường. Khai sẵn chỉ mua hai thứ: một tập hữu hạn để nạp cache
 * trước khi khách hỏi, và một con số tham chiếu để đối chiếu.
 *
 * `referenceDistanceKm` DÙNG ĐỂ ĐỐI CHIẾU, TUYỆT ĐỐI KHÔNG ĐỂ TRẢ LỜI. Con số trong file này là
 * ước lượng của người biên tập, không phải kết quả đo. Nó tồn tại để bắt một loại lỗi rất khó
 * thấy: Routes API vẫn trả về HTTP 200 và một tuyến hợp lệ ngay cả khi tuyến đó bị định lại đường
 * vì sạt lở hoặc vì waypoint bị hiểu sai. Lệch quá 20% so với số ở đây là tín hiệu cần người xem
 * lại, chứ bản thân con số này không bao giờ được đưa vào câu trả lời cho khách — làm vậy là
 * đóng băng dữ liệu động vào file tĩnh, đúng thứ mà SRS Mục 11.1.1.3 cấm.
 *
 * VÌ SAO NHIỀU CHẶNG ĐƯỢC KHAI HAI LẦN CHO HAI PHƯƠNG TIỆN. Trên đường đèo hẹp, xe máy và ô tô
 * không chỉ khác nhau về tốc độ mà khác nhau về cả tuyến khả dụng. Ô tô 29 chỗ không quay đầu
 * được ở một số khúc cua tay áo, và có những nhánh đường ô tô không xuống nổi — chặng xuống bến
 * thuyền Tà Làng dưới đây chỉ có bản xe máy, và việc THIẾU bản ô tô ở đó là thông tin, không
 * phải chỗ bỏ sót cần điền nốt.
 *
 * VÌ SAO ĐIỂM ĐẦU VÀ ĐIỂM CUỐI ĐÔI KHI KHÔNG PHẢI TÊN VÙNG. Chặng đi Lũng Cú lấy `cot-co-lung-cu`
 * làm đích chứ không lấy xã `lung-cu`, vì một xã không có điểm dẫn đường duy nhất còn cột cờ thì
 * có — và đó lại đúng là toạ độ `surveyed` duy nhất trong cả danh mục. Đặt đích là một vùng thì
 * Routes API tự chọn một điểm đại diện nào đó trong vùng, và nó chọn mà không nói cho ai biết.
 *
 * Mọi `fromSlug`, `toSlug`, `viaSlugs` đều phải là slug CÓ THẬT trong @data/places/geography.ts.
 * Slug sai không gây lỗi biên dịch, chỉ làm chặng đó âm thầm không bao giờ khớp.
 */

import type { RouteSegment } from "./types";

export const ROUTE_SEGMENTS: RouteSegment[] = [
  // -----------------------------------------------------------------------------------------
  // NGÀY MỘT — thành phố Hà Giang lên Quản Bạ, rồi sang Yên Minh
  // -----------------------------------------------------------------------------------------
  {
    id: "tp-ha-giang-quan-ba-xe-may",
    fromSlug: "tp-ha-giang",
    toSlug: "quan-ba",
    // Ép qua đèo Bắc Sum dù quốc lộ 4C là đường chính, vì đã có đoạn tuyến tránh mới và Routes
    // API sẽ chọn nó nếu nhanh hơn. Với khách đi ngắm cảnh thì bỏ Bắc Sum là bỏ mất con đèo đầu
    // tiên của cả chuyến.
    viaSlugs: ["deo-bac-sum"],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 46,
    terrainNote:
      "Quốc lộ 4C, mặt đường tốt nhưng leo liên tục từ 100 m lên 1.500 m ở Cổng Trời rồi đổ xuống thung lũng Tam Sơn. Người mới tập chạy xe số nên tính dư thời gian cho đoạn Bắc Sum: dốc dài, nhiều cua gấp, và đây là nơi khách quen đường bằng dễ mỏi tay phanh nhất.",
  },
  {
    id: "tp-ha-giang-quan-ba-o-to",
    fromSlug: "tp-ha-giang",
    toSlug: "quan-ba",
    viaSlugs: ["deo-bac-sum"],
    travelMode: "DRIVE",
    referenceDistanceKm: 46,
    terrainNote:
      "Cùng tuyến với bản xe máy nhưng ô tô mất nhiều thời gian hơn ở các khúc cua tay áo trên Bắc Sum, nhất là khi gặp xe tải hoặc xe khách giường nằm đi ngược chiều. Đoạn này ô tô gầm thấp vẫn đi được bình thường.",
  },
  {
    id: "quan-ba-yen-minh-xe-may",
    fromSlug: "quan-ba",
    toSlug: "yen-minh",
    // `viaSlugs` để rỗng là có chủ ý: đoạn này chỉ có một tuyến khả dụng, nên thêm waypoint chỉ
    // tốn thêm một điểm trung gian cho API mà không loại bỏ được lựa chọn nào.
    viaSlugs: [],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 50,
    terrainNote:
      "Vẫn quốc lộ 4C, đi men theo sườn núi qua khu rừng thông Yên Minh. Đây là chặng dễ chịu nhất của vòng cung chính: độ dốc vừa phải, cua thoáng, và là chỗ tốt để bù lại thời gian đã mất ở Bắc Sum.",
  },
  {
    id: "quan-ba-yen-minh-o-to",
    fromSlug: "quan-ba",
    toSlug: "yen-minh",
    viaSlugs: [],
    travelMode: "DRIVE",
    referenceDistanceKm: 50,
    terrainNote:
      "Chặng thân thiện với ô tô nhất trong toàn bộ vòng cung: đường rộng đủ hai làn gần như suốt tuyến, ít đoạn phải nhường đường.",
  },

  // -----------------------------------------------------------------------------------------
  // NGÀY HAI — Yên Minh lên Đồng Văn, rẽ Lũng Cú
  // -----------------------------------------------------------------------------------------
  {
    id: "yen-minh-dong-van-xe-may",
    fromSlug: "yen-minh",
    toSlug: "dong-van",
    // Hai waypoint này không phải để đổi tuyến mà để neo tuyến: dốc Thẩm Mã và thung lũng Sủng
    // Là là hai điểm dừng bắt buộc của chặng, và neo chúng vào yêu cầu bảo đảm thời gian API
    // trả về là thời gian của đúng con đường khách sẽ đi.
    viaSlugs: ["doc-tham-ma", "sung-la"],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 45,
    terrainNote:
      "Chặng nhiều điểm dừng nhất cả chuyến: dốc Thẩm Mã, dốc Chín Khoanh, thung lũng Sủng Là, dinh thự họ Vương ở Sà Phìn. Thời gian Routes API trả về là thời gian chạy liên tục — thực tế khách mất gấp đôi vì dừng chụp ảnh, và con số thô đó không nên đưa thẳng cho khách mà không nói rõ.",
  },
  {
    id: "yen-minh-dong-van-o-to",
    fromSlug: "yen-minh",
    toSlug: "dong-van",
    viaSlugs: ["doc-tham-ma", "sung-la"],
    travelMode: "DRIVE",
    referenceDistanceKm: 45,
    terrainNote:
      "Ô tô lên được tới cả bốn điểm dừng chính, nhưng bãi đỗ trên đỉnh dốc Thẩm Mã hẹp và hay kín vào giữa buổi sáng. Đoạn Chín Khoanh có chín khúc cua liên tiếp, xe dài phải đi chậm hẳn.",
  },
  {
    id: "dong-van-cot-co-lung-cu-xe-may",
    fromSlug: "dong-van",
    toSlug: "cot-co-lung-cu",
    viaSlugs: [],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 26,
    terrainNote:
      "Đường nhánh lên cực bắc, mặt đường đã trải nhựa và đi lại thuận lợi. Cần nhớ chặng này là đi và về trong ngày: 26 km mỗi chiều, cộng thời gian leo 389 bậc lên chân cột cờ rồi cầu thang xoắn trong thân cột.",
  },
  {
    id: "dong-van-cot-co-lung-cu-o-to",
    fromSlug: "dong-van",
    toSlug: "cot-co-lung-cu",
    viaSlugs: [],
    travelMode: "DRIVE",
    referenceDistanceKm: 26,
    terrainNote:
      "Ô tô vào được tới bãi đỗ dưới chân núi Rồng; từ đó bắt buộc đi bộ hoặc dùng xe điện của khu di tích. Không có đường nào cho xe cá nhân lên sát chân cột cờ.",
  },

  // -----------------------------------------------------------------------------------------
  // NGÀY BA — Mã Pí Lèng, chặng quan trọng nhất của cả file
  // -----------------------------------------------------------------------------------------
  {
    id: "dong-van-meo-vac-xe-may",
    fromSlug: "dong-van",
    toSlug: "meo-vac",
    // ĐÂY LÀ LÝ DO TRƯỜNG `viaSlugs` TỒN TẠI. Routes API tối ưu theo thời gian, và giữa Đồng Văn
    // với Mèo Vạc có những tuyến vòng ngoài mà API hoàn toàn có thể chấm là nhanh hơn — đường
    // rộng hơn, ít cua hơn, tốc độ trung bình cao hơn. Nhưng toàn bộ giá trị của chặng 22 km này
    // nằm ở chính con đèo: không đi Mã Pí Lèng thì khách không thấy hẻm Tu Sản, không thấy sông
    // Nho Quế, và chặng còn lại chỉ là 22 km đường núi bình thường. Một tuyến nhanh hơn ở đây là
    // một tuyến vô dụng, và cái sai đó không hiện ra ở bất kỳ mã lỗi nào: API trả về 200, thời
    // gian đẹp hơn, khách đi theo rồi mới biết mình đã bỏ lỡ thứ mình lên Hà Giang để xem.
    viaSlugs: ["deo-ma-pi-leng"],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 22,
    terrainNote:
      "Hai mươi hai kilômét nhưng là đoạn đòi hỏi nhất cả chuyến: đường men vách đá, một bên là núi một bên là vực sâu hơn 1.200 m xuống sông Nho Quế, nhiều khúc cua khuất tầm nhìn. Không chạy đoạn này lúc trời tối hoặc lúc sương mù dày. Thời gian thực tế thường gấp rưỡi số API trả về vì hầu như ai cũng dừng ở điểm ngắm tượng đài thanh niên xung phong.",
  },
  {
    id: "dong-van-meo-vac-o-to",
    fromSlug: "dong-van",
    toSlug: "meo-vac",
    viaSlugs: ["deo-ma-pi-leng"],
    travelMode: "DRIVE",
    referenceDistanceKm: 22,
    terrainNote:
      "Ô tô con và xe 16 chỗ qua được, xe lớn hơn phải rất cẩn thận vì nhiều đoạn chỉ vừa hai xe tránh nhau. Bãi dừng ở điểm ngắm Mã Pí Lèng là chỗ duy nhất trên đèo đỗ được xe khách. Nhánh đường thấp xuống mỏm đá ngắm hẻm Tu Sản thì ô tô không đi được.",
  },
  {
    id: "meo-vac-ben-thuyen-ta-lang-xe-may",
    fromSlug: "meo-vac",
    toSlug: "ben-thuyen-ta-lang",
    viaSlugs: [],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 12,
    terrainNote:
      "Chặng CỐ TÌNH không có bản ô tô: đường xuống bến là con dốc đất dựng, nhiều đoạn đổ bê tông hẹp, mùa mưa thì trơn. Xe số leo về được nhưng xe tay ga chở đôi thì không nên thử. Khách đi ô tô phải gửi xe ở trên và thuê xe ôm xuống bến — đó là thông tin phải đi kèm mọi gợi ý tới đây.",
  },
  {
    id: "meo-vac-khau-vai-xe-may",
    fromSlug: "meo-vac",
    toSlug: "khau-vai",
    viaSlugs: [],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 24,
    terrainNote:
      "Đường nhánh về phía đông nam, đổ dần từ 1.000 m xuống 700 m. Ngày thường vắng xe; riêng dịp chợ tình Khâu Vai thì đông đột biến và thời gian di chuyển không còn suy ra được từ khoảng cách nữa.",
  },

  // -----------------------------------------------------------------------------------------
  // NGÀY BỐN — nhánh Du Già và đường về
  //
  // Hai chặng dưới đây là hai chặng có `referenceDistanceKm` kém chắc chắn nhất trong file, và
  // điều đó được ghi ra thay vì làm tròn cho gọn. Chúng đi qua đường liên xã, có nhiều lối rẽ
  // song song, nên khoảng cách thực phụ thuộc vào tuyến Routes API chọn. Đúng vì vậy mà ngưỡng
  // đối chiếu 20% ở đây nên được đọc rộng tay hơn các chặng quốc lộ.
  // -----------------------------------------------------------------------------------------
  {
    id: "meo-vac-du-gia-xe-may",
    fromSlug: "meo-vac",
    toSlug: "du-gia",
    // Neo qua Lũng Phìn và Mậu Duệ vì đây là tuyến khách thực sự đi; bỏ neo thì API có thể trả về
    // đường vòng qua Yên Minh, dài hơn nhưng dễ chạy hơn nên đôi khi được chấm là nhanh hơn.
    viaSlugs: ["lung-phin", "mau-due"],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 70,
    terrainNote:
      "Chặng dài nhất trong ngày và gần như không có trạm xăng ở đoạn giữa, nên phải đổ đầy bình từ Mèo Vạc. Đường qua Lũng Phìn ở 1.300 m hay có mù buổi sáng, sau đó đổ liên tục xuống thung lũng Du Già ở 700 m. Con số 70 km là ước lượng của người biên tập, không phải số đo — hãy tin số Routes API trả về hơn.",
  },
  {
    id: "du-gia-tp-ha-giang-xe-may",
    fromSlug: "du-gia",
    toSlug: "tp-ha-giang",
    viaSlugs: [],
    travelMode: "TWO_WHEELER",
    referenceDistanceKm: 70,
    terrainNote:
      "Đường về khép vòng cung, không quay lại quốc lộ 4C mà theo tuyến liên xã phía nam. Mặt đường xấu hơn hẳn phần còn lại của hành trình, có đoạn đá dăm và đoạn đang sửa. Đây là chặng mà khách hay tính thiếu thời gian nhất vì nhìn trên bản đồ thì nó là đường về, mà đường về thì ai cũng tưởng nhanh hơn.",
  },

  // -----------------------------------------------------------------------------------------
  // CÁC NHÁNH RẼ KHÔNG NẰM TRÊN VÒNG CUNG
  //
  // Cả hai đều chỉ khai bản ô tô, vì đây là những chặng dài mà khách thường đi bằng xe thuê có
  // tài xế hoặc xe khách chứ hiếm khi chạy xe máy.
  // -----------------------------------------------------------------------------------------
  {
    id: "tp-ha-giang-hoang-su-phi-o-to",
    fromSlug: "tp-ha-giang",
    toSlug: "hoang-su-phi",
    viaSlugs: [],
    travelMode: "DRIVE",
    referenceDistanceKm: 65,
    terrainNote:
      "Rẽ tây theo quốc lộ 2 rồi tỉnh lộ 177, hoàn toàn tách khỏi vòng cung cao nguyên đá. Nửa sau là đường tỉnh lộ quanh co bám sườn núi, ô tô gầm thấp đi được nhưng chậm. Nhánh này chỉ đáng đi vào mùa lúa chín, và đó là tri thức theo mùa nên nằm ở @data/knowledge chứ không phải ở đây.",
  },
  {
    id: "tp-ha-giang-bac-me-o-to",
    fromSlug: "tp-ha-giang",
    toSlug: "bac-me",
    viaSlugs: [],
    travelMode: "DRIVE",
    referenceDistanceKm: 50,
    terrainNote:
      "Theo quốc lộ 34 về phía đông nam dọc thung lũng sông Gâm, gần như không leo dốc — chặng bằng phẳng hiếm hoi trong toàn bộ danh sách này. Thường được ghép vào ngày cuối khi khách muốn về Hà Nội theo hướng Cao Bằng hoặc Tuyên Quang thay vì quay lại đường cũ.",
  },
];
