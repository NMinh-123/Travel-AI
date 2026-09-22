import { EXPANDED_DESTINATIONS } from "./expanded-destinations";
import type { WebsiteDestination } from "@data/website/types";

/** Catalog for discovery: the original 13 stops plus 13 researched additions.
 * Slugs join to data/places. Nullable measurements must never be replaced with zero.
 * sortOrder is editorial order, not route order; distances are reference values.
 */
export const WEBSITE_DESTINATIONS: WebsiteDestination[] = [
  {
    slug: "deo-bac-sum",
    name: "Bac Sum Slope",
    vietnameseName: "Dốc Bắc Sum",
    regionLabel: "Quản Bạ",
    category: "pass",
    elevation: 800,
    distanceFromStart: 30,
    difficulty: "Trung bình",
    bestTime: "Sáng sớm quanh năm, đẹp nhất các tháng khô",
    highlights: [
      "Đoạn leo dài đầu tiên sau khi rời thành phố",
      "Ranh giới thấy được giữa đồi thấp và núi đá",
      "Biển mây phủ thung lũng vào sáng sớm mùa lạnh",
    ],
    description:
      "Đoạn dốc dài đầu tiên của hành trình, nơi cảnh chuyển hẳn từ đồi thấp và ruộng nước sang " +
      "núi đá xếp lớp. Đây là chỗ nhiều người nhận ra mình đã thật sự vào vùng cao.",
    safetyTip:
      "Dốc dài liên tục nên xe dễ nóng máy; dừng nghỉ ở đỉnh chứ đừng dừng giữa dốc. Lề sát vực " +
      "nhiều đoạn không có rào.",
    lat: 22.98817,
    lng: 104.9359,
    recommendedStayHours: 0.5,
    localFood: ["Thịt trâu gác bếp", "Chè Shan tuyết"],
    imageSlug: "deo-bac-sum",
    sortOrder: 0,
  },
  {
    slug: "cong-troi-quan-ba",
    name: "Quan Ba Heaven Gate",
    vietnameseName: "Cổng Trời Quản Bạ",
    regionLabel: "Quản Bạ",
    category: "viewpoint",
    elevation: 1500,
    distanceFromStart: 46,
    difficulty: "Trung bình",
    bestTime: "Sáng sớm, các tháng lạnh có sương đọng dưới thung",
    highlights: [
      "Đài quan sát nhìn xuống toàn bộ thung lũng Tam Sơn",
      "Hai quả Núi Đôi nhô lên giữa cánh đồng",
      "Sương đọng đáy thung vào đầu ngày",
    ],
    description:
      "Điểm nhìn đầu tiên trên hành trình cho cảm giác đã lên cao thật. Từ đài quan sát thấy được " +
      "cả thị trấn nằm dưới thung lũng và dãy núi đá vây quanh.",
    safetyTip:
      "Vào những ngày mù dày có thể không thấy gì ngoài màn trắng — chuyện thường xảy ra trong " +
      "các tháng lạnh. Chờ thêm nửa giờ đôi khi có tác dụng vì sương ở đây đổi rất nhanh.",
    lat: 23.04932,
    lng: 104.99302,
    recommendedStayHours: 0.75,
    localFood: ["Hồng không hạt Quản Bạ", "Rượu ngô"],
    // Commons chưa có ảnh giấy phép mở cho riêng Cổng Trời — dùng ảnh vùng Quản Bạ.
    imageSlug: "quan-ba",
    sortOrder: 1,
  },
  {
    slug: "nui-doi-co-tien",
    name: "Fairy Twin Mountains",
    vietnameseName: "Núi Đôi Cô Tiên",
    regionLabel: "Quản Bạ",
    category: "nature",
    elevation: 1100,
    distanceFromStart: 48,
    difficulty: "Dễ đi",
    bestTime: "Quanh năm; ruộng quanh chân núi xanh nhất vào mùa lúa",
    highlights: [
      "Hai quả núi tròn đối xứng hiếm gặp",
      "Nhìn rõ nhất từ đài quan sát Cổng Trời",
      "Ruộng bậc thang thấp vây quanh chân núi",
    ],
    description:
      "Hai quả núi tròn nhô lên giữa cánh đồng bằng phẳng của thung lũng Tam Sơn, hình dáng đối " +
      "xứng đến mức trông như được đặt vào đó. Gắn với một truyền thuyết địa phương về nàng tiên.",
    safetyTip:
      "Điểm ngắm tốt nhất nằm trên đường quốc lộ; đừng dừng xe ở khúc cua để chụp, đi thêm tới " +
      "khoảng mở rộng có chỗ đỗ.",
    lat: 23.0508,
    lng: 104.9411,
    recommendedStayHours: 0.5,
    localFood: ["Hồng không hạt Quản Bạ"],
    imageSlug: "nui-doi-co-tien",
    sortOrder: 2,
  },
  {
    slug: "rung-thong-yen-minh",
    name: "Yen Minh Pine Forest",
    vietnameseName: "Rừng thông Yên Minh",
    regionLabel: "Yên Minh",
    category: "nature",
    elevation: 1100,
    distanceFromStart: 80,
    difficulty: "Dễ đi",
    bestTime: "Quanh năm; sáng có sương thì các hàng thông tách lớp rõ",
    highlights: [
      "Đoạn dễ lái nhất giữa hai chặng đá",
      "Đồi cỏ và thông thay cho núi đá",
      "Chỗ hợp lý để nghỉ trưa trước đoạn khó phía Đồng Văn",
    ],
    description:
      "Đoạn đường khác hẳn phần còn lại của hành trình: bằng hơn, hai bên là thông và đồi cỏ. " +
      "Nhiều người gọi đây là khúc Đà Lạt của Hà Giang.",
    safetyTip:
      "Một trong ít đoạn dừng xe bên lề khá an toàn vì đường rộng và tầm nhìn thoáng — nhưng vẫn " +
      "đưa xe hẳn vào phía trong.",
    lat: 23.0894,
    lng: 105.1017,
    recommendedStayHours: 1,
    localFood: ["Cơm lam", "Gà đen"],
    imageSlug: "rung-thong-yen-minh",
    sortOrder: 3,
  },
  {
    slug: "thac-du-gia",
    name: "Du Gia Waterfall",
    vietnameseName: "Thác Du Già",
    regionLabel: "Yên Minh",
    category: "waterfall",
    elevation: 650,
    distanceFromStart: 100,
    difficulty: "Đòi hỏi tay lái vững",
    bestTime: "Sau mùa mưa, khi nước còn nhiều mà đã trong",
    highlights: [
      "Hồ nước xanh dưới chân thác, tắm được",
      "Bản làng còn giữ nhịp sống thường ngày",
      "Đường vào qua nhiều đoạn đèo vắng",
    ],
    description:
      "Thác đổ xuống một hồ nước màu xanh giữa rừng, nằm cạnh một bản còn ít chịu tác động của du " +
      "lịch. Đây là điểm khiến nhiều người quyết định ngủ thêm một đêm trong hành trình.",
    safetyTip:
      "Đường vào Du Già xấu và vắng, nhiều đoạn không có sóng điện thoại. Đừng đi một mình vào " +
      "cuối ngày, và tránh hẳn khi đang mưa vì đoạn này dễ sạt.",
    lat: 22.9803,
    lng: 105.2392,
    recommendedStayHours: 3,
    localFood: ["Cá suối nướng", "Xôi ngũ sắc"],
    // Khoá riêng KHÔNG còn ảnh, và lý do đáng ghi: tìm "Du Gia waterfall" trên Commons trả về
    // toàn ảnh Vườn quốc gia Nahanni ở CANADA. Bản trước không có bộ lọc liên quan nên đã nhận
    // chúng làm ảnh thác Du Già. Nay dùng ảnh vùng Du Già — đúng bối cảnh, dù không phải thác.
    imageSlug: "thac-du-gia",
    sortOrder: 4,
  },
  {
    slug: "doc-tham-ma",
    name: "Tham Ma Slope",
    vietnameseName: "Dốc Thẩm Mã",
    regionLabel: "Yên Minh",
    category: "viewpoint",
    elevation: 1200,
    distanceFromStart: 110,
    difficulty: "Đòi hỏi tay lái vững",
    bestTime: "Buổi chiều, khi nắng tây rọi ngang làm nổi từng khúc cua",
    highlights: [
      "Nhìn lại được toàn bộ các khúc cua vừa vượt qua",
      "Khung ảnh kinh điển của cung đường Hà Giang",
      "Chỗ dừng rộng ngay đỉnh dốc",
    ],
    description:
      "Từ đỉnh dốc nhìn lại, các khúc cua vừa đi qua xếp thành một dải uốn lượn dưới chân. Đây là " +
      "một trong những khung nhìn được chụp nhiều nhất của cả vùng.",
    safetyTip:
      "Ở đây thường có trẻ em bán vòng hoa và mời chụp ảnh. Đưa tiền hay bánh kẹo trực tiếp cho " +
      "trẻ em duy trì việc các em bỏ học ra đường — muốn giúp thì mua hàng của người lớn trong bản.",
    lat: 23.169,
    lng: 105.19417,
    recommendedStayHours: 0.5,
    localFood: ["Bánh tam giác mạch"],
    // Dốc dẫn vào thung lũng Sủng Là, nên ảnh Sủng Là là bối cảnh gần nhất.
    imageSlug: "doc-tham-ma",
    sortOrder: 5,
  },
  {
    slug: "doc-chin-khoanh",
    name: "Nine Turns Slope",
    vietnameseName: "Dốc Chín Khoanh",
    regionLabel: "Đồng Văn",
    category: "viewpoint",
    elevation: 1300,
    distanceFromStart: 115,
    difficulty: "Đòi hỏi tay lái vững",
    bestTime: "Sáng muộn tới đầu chiều; đẹp nhất mùa hoa tam giác mạch",
    highlights: [
      "Nhìn xuống trọn thung lũng Sủng Là",
      "Các mảnh ruộng ghép thành từng ô màu",
      "Nhà trình tường nép giữa thung",
    ],
    description:
      "Từ đỉnh dốc nhìn xuống là thung lũng Sủng Là với những mảnh ruộng nhỏ ghép lại quanh mấy " +
      "nếp nhà trình tường — khung cảnh khiến Sủng Là hay được gọi là bông hoa giữa cao nguyên đá.",
    safetyTip:
      "Chỗ dừng ở đỉnh nằm ngay khúc cua. Đỗ hẳn vào phía trong và không đứng chụp ở mép đường.",
    lat: 23.20986,
    lng: 105.19517,
    recommendedStayHours: 0.5,
    localFood: ["Bánh tam giác mạch", "Rượu ngô"],
    imageSlug: "duong-hanh-phuc",
    sortOrder: 6,
  },
  {
    slug: "dinh-thu-ho-vuong",
    name: "Vuong Family Mansion",
    vietnameseName: "Dinh thự họ Vương",
    regionLabel: "Đồng Văn",
    category: "culture",
    elevation: 1200,
    distanceFromStart: 125,
    difficulty: "Trung bình",
    bestTime: "Quanh năm, nên tới ngoài giờ cao điểm buổi trưa",
    highlights: [
      "Nhà của Vương Chính Đức, người được gọi là vua Mèo",
      "Kiến trúc pha trộn Trung Hoa, H'Mông và phương Tây",
      "Sân trong nhiều lớp, mái ngói âm dương, chạm đá",
    ],
    description:
      "Dinh thự ở Sà Phìn là một hồ sơ vật chất về sự pha trộn văn hoá ở vùng biên, và là nơi cho " +
      "thấy quyền lực địa phương từng vận hành thế nào khi nhà nước trung ương còn ở rất xa.",
    safetyTip:
      "Là di tích đang được bảo tồn: không leo lên kết cấu gỗ, không chạm vào chi tiết chạm đá.",
    lat: 23.25649,
    lng: 105.26215,
    recommendedStayHours: 1.5,
    localFood: ["Thắng cố", "Bánh cuốn Đồng Văn"],
    imageSlug: "dinh-thu-ho-vuong",
    sortOrder: 7,
  },
  {
    slug: "pho-co-dong-van",
    name: "Dong Van Old Quarter",
    vietnameseName: "Phố cổ Đồng Văn",
    regionLabel: "Đồng Văn",
    category: "culture",
    elevation: 1025,
    distanceFromStart: 145,
    difficulty: "Dễ đi",
    bestTime: "Tối để đi phố, sáng chủ nhật để đi chợ phiên",
    highlights: [
      "Dãy nhà trình tường mái ngói âm dương từ đầu thế kỷ 20",
      "Quảng trường chợ vẫn còn hoạt động",
      "Quán cà phê trong nhà cổ đã trùng tu",
    ],
    description:
      "Khu phố lớn lên quanh một khoảng đất dùng làm chợ, nên hình dạng của nó chính là hình dạng " +
      "của hoạt động thương mại vùng biên. Chợ tới nay vẫn họp ngay tại đó.",
    safetyTip:
      "Đây là nơi hợp lý để ngủ đêm giữa hành trình. Mùa cao điểm phải đặt phòng trước, vì Đồng " +
      "Văn là điểm dừng của gần như mọi chuyến.",
    lat: 23.2778,
    lng: 105.3617,
    recommendedStayHours: 3,
    localFood: ["Bánh cuốn ăn với nước xương", "Thắng cố", "Cháo ấu tẩu"],
    imageSlug: "pho-co-dong-van",
    sortOrder: 8,
  },
  {
    slug: "cot-co-lung-cu",
    name: "Lung Cu Flag Tower",
    vietnameseName: "Cột cờ Lũng Cú",
    regionLabel: "Đồng Văn",
    category: "culture",
    elevation: 1470,
    distanceFromStart: 170,
    difficulty: "Trung bình",
    bestTime: "Sáng sớm hoặc cuối chiều; cần ngày trời trong để có tầm nhìn",
    highlights: [
      "Điểm đánh dấu vùng đất cực bắc",
      "Đài quan sát nhìn ra hai phía thung lũng",
      "Chân cột gắn hoa văn trống đồng Đông Sơn",
    ],
    description:
      "Cột cờ đứng trên đỉnh núi Rồng, và ý nghĩa của nó nằm ở vị trí chứ không ở chiều cao: đây " +
      "là nơi lá cờ được dựng lên như một tuyên bố về chủ quyền.",
    safetyTip:
      "Quãng bậc thang lên khá dốc và không có bóng mát. Gió trên đỉnh mạnh và lạnh hơn dưới chân " +
      "rõ rệt kể cả ngày nắng, nên mang thêm một lớp áo. Ngày mù thì lên cũng không thấy gì.",
    lat: 23.3634,
    lng: 105.3225,
    recommendedStayHours: 1.5,
    localFood: ["Thắng cố", "Rượu ngô"],
    imageSlug: "cot-co-lung-cu",
    sortOrder: 9,
  },
  {
    slug: "deo-ma-pi-leng",
    name: "Ma Pi Leng Pass",
    vietnameseName: "Đèo Mã Pí Lèng",
    regionLabel: "Mèo Vạc",
    category: "pass",
    elevation: 1500,
    distanceFromStart: 165,
    difficulty: "Hiểm trở",
    bestTime: "Buổi sáng, khi nắng đông rọi vào lòng vực",
    highlights: [
      "Đoạn đường được đục bằng tay trên vách đá dựng đứng",
      "Nhìn trọn khúc sông Nho Quế phía dưới",
      "Bia đá ghi lịch sử con đường Hạnh Phúc",
    ],
    description:
      "Con đèo nổi tiếng nhất của Việt Nam, và mặt đường mà xe đang chạy là kết quả của sáu năm " +
      "lao động thủ công ở một nơi máy móc không vào được. Đoạn qua đây được đục bởi những người " +
      "buộc dây treo mình bên sườn núi.",
    safetyTip:
      "Đường sát vách, gần như không có lề. Chỉ dừng ở các khoảng mở rộng có chủ đích, không bao " +
      "giờ dừng trong khúc cua hay ngay sau đỉnh dốc. Khi có sương mù thì bỏ hẳn ý định dừng chụp " +
      "ảnh ngoài điểm dừng chính thức.",
    lat: 23.24081,
    lng: 105.41094,
    recommendedStayHours: 2,
    localFood: ["Thắng cố Mèo Vạc", "Thịt trâu gác bếp"],
    imageSlug: "deo-ma-pi-leng",
    sortOrder: 10,
  },
  {
    slug: "hem-tu-san",
    name: "Tu San Canyon",
    vietnameseName: "Hẻm vực Tu Sản",
    regionLabel: "Mèo Vạc",
    category: "nature",
    elevation: 280,
    distanceFromStart: 170,
    difficulty: "Hiểm trở",
    bestTime: "Buổi sáng; mùa khô nước trong và xanh hơn",
    highlights: [
      "Hẻm vực sâu nhất Đông Nam Á",
      "Đi thuyền vào giữa hai vách đá dựng đứng",
      "Mỏm đá nhìn thẳng xuống chỗ hẹp nhất",
    ],
    description:
      "Từ trên đèo nhìn xuống thì đây là một khe hẹp; xuống tận mặt nước rồi đi thuyền vào trong " +
      "mới thấy được chiều cao thật của hai bên vách. Đây là trải nghiệm không thay thế được bằng " +
      "bất cứ điểm ngắm nào ở trên.",
    safetyTip:
      "Mỏm đá ngắm hẻm không có rào chắn và mặt đá nghiêng ra phía vực; đá vôi ẩm rất trơn nên " +
      "không ra sau mưa hoặc trong sương mù. Đi thuyền thì mặc áo phao là điều kiện bắt buộc.",
    lat: 23.2331,
    lng: 105.3708,
    recommendedStayHours: 3,
    localFood: ["Cá bống sông Nho Quế"],
    imageSlug: "hem-tu-san",
    sortOrder: 11,
  },
  {
    slug: "ruong-bac-thang-hoang-su-phi",
    name: "Hoang Su Phi Terraces",
    vietnameseName: "Ruộng bậc thang Hoàng Su Phì",
    regionLabel: "Hoàng Su Phì",
    category: "nature",
    elevation: 900,
    distanceFromStart: 110,
    difficulty: "Đòi hỏi tay lái vững",
    bestTime: "Khoảng tháng 9, mùa lúa chín — khoảng đẹp chỉ một hai tuần",
    highlights: [
      "Di tích quốc gia, công trình nông nghiệp qua nhiều đời",
      "Ruộng bậc thang trải kín các sườn núi đất",
      "Nhánh hành trình khác hẳn vòng cung phía bắc",
    ],
    description:
      "Không phải cảnh quan tự nhiên mà là công trình được bồi đắp qua nhiều thế hệ. Cảnh vàng " +
      "rực mùa lúa chín là mặt biểu hiện của một hệ thống canh tác vẫn đang hoạt động.",
    safetyTip:
      "Đường ở nhánh này xấu hơn và ít dịch vụ hơn hẳn so với trục Đồng Văn – Mèo Vạc. Đi quá " +
      "sớm thì ruộng còn xanh, đi muộn thì đã thu hoạch xong.",
    lat: 22.7331,
    lng: 104.6528,
    recommendedStayHours: 4,
    localFood: ["Chè Shan tuyết", "Thịt trâu gác bếp"],
    // Dùng ảnh vùng Hoàng Su Phì: ảnh đúng nội dung trên Commons có tên "Một góc ruộng ở bản Nậm
    // Ty" — Nậm Ty đúng là ở Hoàng Su Phì, nhưng tên file không chia sẻ token nào với từ khoá nên
    // bộ lọc liên quan loại nó. Đây là cái giá của bộ lọc, và trả giá vậy vẫn đáng.
    imageSlug: "ruong-bac-thang-hoang-su-phi",
    sortOrder: 12,
  },
  ...EXPANDED_DESTINATIONS,
];
