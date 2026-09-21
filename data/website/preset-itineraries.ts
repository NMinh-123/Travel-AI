import type { DayItinerary } from "@shared/types";

/**
 * LỊCH TRÌNH MẪU — bản dựng sẵn để khách xem trước và để làm nền cho lịch trình tự sinh.
 *
 * VÌ SAO CẦN CÓ LỊCH TRÌNH MẪU khi hệ thống đã có tác tử sinh lịch trình. Hai lý do khác nhau:
 *
 *  1. Trang lịch trình phải có gì để hiển thị NGAY khi khách vào, trước khi họ nhập gì cả. Một
 *     trang trống kèm ô nhập là cách nhanh nhất khiến khách rời đi.
 *  2. Lịch trình mẫu là mốc đối chiếu để biết bản tự sinh có hợp lý hay không. Một bản tự sinh
 *     ghi ba trăm km trong một ngày đường đèo thì sai, và người soát chỉ nhận ra điều đó khi có
 *     một bản do người viết đặt cạnh.
 *
 * VÌ SAO `totalDistanceKm` VÀ `ridingHours` LÀ SỐ THAM CHIẾU. Chúng do người viết đặt theo kinh
 * nghiệm đi thật, KHÔNG phải kết quả tính từ API. Số thật cho một chặng cụ thể đến từ `getRoute`
 * ở tầng realtime. Hai nguồn này cố tình tách: lịch trình mẫu phải đọc được cả khi chưa cấu hình
 * khoá Google, còn khi đã có khoá thì giao diện nên hiển thị số của Routes API và giữ số ở đây
 * làm mốc đối chiếu.
 *
 * Tỷ lệ giờ lái so với km ở đây thấp hơn hẳn đường đồng bằng — khoảng 30 km một giờ. Đó không
 * phải sự thận trọng thừa: đường gần như không có đoạn thẳng nào dài, và mọi ước lượng theo kiểu
 * đường bằng đều sai. Đây là con số mà khách hay tính sai nhất khi tự lên kế hoạch.
 *
 * `aiTip` là lời khuyên biên tập, KHÔNG phải do model sinh. Tên trường mang chữ "ai" vì lịch sử
 * giao diện; nội dung thì là tri thức của người viết và được soát như mọi nội dung khác.
 */

const BA_NGAY_CO_BAN: DayItinerary[] = [
  {
    day: 1,
    title: "Thành phố Hà Giang đến Đồng Văn",
    theme: "Từ đồi thấp lên cao nguyên đá",
    startPoint: "Thành phố Hà Giang",
    endPoint: "Thị trấn Đồng Văn",
    totalDistanceKm: 145,
    ridingHours: 5.5,
    maxElevationM: 1500,
    scenicRating: 5,
    weatherAlert:
      "Chặng này leo từ khoảng 100 m lên 1.500 m. Kiểm dự báo cho ĐỈNH ĐÈO chứ không phải cho " +
      "thành phố — hai nơi có thể chênh nhau vài độ và khác nhau hoàn toàn về sương mù.",
    waypoints: [
      {
        id: "d1-khoi-hanh",
        day: 1,
        time: "07:00",
        title: "Nhận xe và khởi hành",
        subtitle: "Thành phố Hà Giang",
        distanceKm: 0,
        elevationM: 100,
        type: "ride",
        highlight: "Rút đủ tiền mặt và tải bản đồ ngoại tuyến trước khi rời thành phố",
        aiTip:
          "Kiểm phanh, lốp và đèn ngay tại chỗ thuê, chụp ảnh xe trước khi đi. ATM gần như chỉ có " +
          "ở đây và vài thị trấn lớn.",
      },
      {
        id: "d1-bac-sum",
        day: 1,
        time: "08:15",
        title: "Dốc Bắc Sum",
        subtitle: "Đoạn leo dài đầu tiên",
        distanceKm: 30,
        elevationM: 800,
        type: "viewpoint",
        highlight: "Ranh giới thấy được giữa vùng đồi thấp và vùng núi đá",
        aiTip: "Dừng nghỉ máy ở đỉnh, đừng dừng giữa dốc. Sáng sớm mùa lạnh hay có biển mây dưới thung.",
      },
      {
        id: "d1-cong-troi",
        day: 1,
        time: "09:00",
        title: "Cổng Trời Quản Bạ và Núi Đôi",
        subtitle: "Đài quan sát nhìn xuống thung lũng Tam Sơn",
        distanceKm: 46,
        elevationM: 1500,
        type: "viewpoint",
        highlight: "Điểm nhìn đầu tiên cho cảm giác đã lên cao thật",
        aiTip:
          "Ngày mù dày thì có thể không thấy gì. Chờ thêm nửa giờ đôi khi có tác dụng vì sương ở " +
          "đây đổi rất nhanh.",
      },
      {
        id: "d1-yen-minh",
        day: 1,
        time: "11:30",
        title: "Nghỉ trưa ở rừng thông Yên Minh",
        subtitle: "Đoạn dễ lái nhất của cả chuyến",
        distanceKm: 80,
        elevationM: 1100,
        type: "meal",
        highlight: "Thông và đồi cỏ thay cho núi đá",
        aiTip: "Đây là chỗ hợp lý để ăn trưa và nghỉ chân trước khi vào đoạn khó phía Đồng Văn.",
      },
      {
        id: "d1-tham-ma",
        day: 1,
        time: "14:00",
        title: "Dốc Thẩm Mã",
        subtitle: "Nhìn lại các khúc cua vừa vượt",
        distanceKm: 110,
        elevationM: 1200,
        type: "viewpoint",
        highlight: "Khung ảnh kinh điển của cung đường Hà Giang",
        aiTip:
          "Ánh sáng thuận nhất vào buổi chiều. Ở đây có trẻ em bán vòng hoa — muốn giúp thì mua " +
          "hàng của người lớn trong bản, đừng đưa tiền trực tiếp cho trẻ em.",
      },
      {
        id: "d1-sung-la",
        day: 1,
        time: "15:00",
        title: "Thung lũng Sủng Là và dinh thự họ Vương",
        subtitle: "Sà Phìn",
        distanceKm: 125,
        elevationM: 1200,
        type: "culture",
        highlight: "Nhà của người được gọi là vua Mèo, xây trong những năm 1920",
        aiTip:
          "Vào tháng 10–11 thì thung lũng có tam giác mạch; hỏi chủ homestay tuần đó ruộng nào " +
          "đang rộ, vì hoa nở lệch nhau theo từng thung.",
      },
      {
        id: "d1-dong-van",
        day: 1,
        time: "17:00",
        title: "Về Đồng Văn, đi phố cổ",
        subtitle: "Thị trấn Đồng Văn",
        distanceKm: 145,
        elevationM: 1025,
        type: "stay",
        highlight: "Dãy nhà trình tường mái ngói âm dương quanh quảng trường chợ",
        aiTip: "Ăn thử bánh cuốn chấm nước xương và cháo ấu tẩu. Cháo có vị đắng, đó là đúng vị.",
      },
    ],
    eveningStay: {
      name: "Nhà nghỉ hoặc homestay trong phố cổ Đồng Văn",
      type: "Nhà nghỉ thị trấn",
      vibe: "Đi bộ ra được quảng trường chợ và các quán cà phê trong nhà cổ",
      priceEstimate: "khoảng 300.000 – 700.000đ/đêm, giá tham khảo",
    },
  },
  {
    day: 2,
    title: "Lũng Cú, Mã Pí Lèng và hẻm Tu Sản",
    theme: "Cực bắc và con đèo nổi tiếng nhất",
    startPoint: "Thị trấn Đồng Văn",
    endPoint: "Thị trấn Mèo Vạc",
    totalDistanceKm: 95,
    ridingHours: 4,
    maxElevationM: 1500,
    scenicRating: 5,
    weatherAlert:
      "Ngày quan trọng nhất của chuyến và cũng là ngày phụ thuộc thời tiết nhất. Mù dày thì đổi " +
      "thứ tự: xuống bến thuyền trước, để dành đèo cho lúc trời mở.",
    waypoints: [
      {
        id: "d2-lung-cu",
        day: 2,
        time: "07:30",
        title: "Cột cờ Lũng Cú",
        subtitle: "Điểm đánh dấu vùng đất cực bắc",
        distanceKm: 26,
        elevationM: 1470,
        type: "culture",
        highlight: "Đài quan sát nhìn ra hai phía thung lũng và về hướng đường biên",
        aiTip:
          "Đi sớm cho mát và cho tầm nhìn. Gió trên đỉnh lạnh hơn dưới chân rõ rệt kể cả ngày " +
          "nắng — mang thêm một lớp áo.",
      },
      {
        id: "d2-lo-lo-chai",
        day: 2,
        time: "09:30",
        title: "Bản Lô Lô Chải",
        subtitle: "Dưới chân cột cờ",
        distanceKm: 28,
        elevationM: 1400,
        type: "culture",
        highlight: "Bản của người Lô Lô với nhà trình tường và hàng rào đá",
        aiTip:
          "Xin phép trước khi chụp ảnh người dân, và khi được từ chối thì thôi. Không tự ý vào " +
          "nhà, không cho tiền trẻ em.",
      },
      {
        id: "d2-ma-pi-leng",
        day: 2,
        time: "11:00",
        title: "Đèo Mã Pí Lèng",
        subtitle: "Điểm dừng ngắm chính",
        distanceKm: 60,
        elevationM: 1500,
        type: "viewpoint",
        highlight: "Đoạn đường được đục bằng tay trên vách đá dựng đứng, nhìn trọn khúc sông dưới đáy vực",
        aiTip:
          "Buổi sáng là lúc nắng rọi vào lòng vực nên thấy được nước sông và các lớp vách đá; " +
          "buổi chiều lòng vực chìm trong bóng núi. Chỉ dừng ở khoảng mở rộng có chủ đích.",
      },
      {
        id: "d2-tu-san",
        day: 2,
        time: "13:30",
        title: "Xuống bến thuyền, đi hẻm Tu Sản",
        subtitle: "Lòng sông Nho Quế",
        distanceKm: 72,
        elevationM: 280,
        type: "rest",
        highlight: "Vào giữa hai vách đá dựng đứng, thấy được chiều cao thật của hẻm vực",
        aiTip:
          "Hỏi lại tình trạng chạy thuyền TRƯỚC khi xuống — xuống tới bến rồi mới biết không có " +
          "thuyền là mất cả buổi. Mặc áo phao là bắt buộc.",
      },
      {
        id: "d2-meo-vac",
        day: 2,
        time: "17:00",
        title: "Về Mèo Vạc",
        subtitle: "Thị trấn Mèo Vạc",
        distanceKm: 95,
        elevationM: 1000,
        type: "stay",
        highlight: "Thị trấn nhỏ, vắng hơn Đồng Văn",
        aiTip: "Ăn thắng cố ở đây nếu chưa thử. Chợ Mèo Vạc họp sáng chủ nhật.",
      },
    ],
    eveningStay: {
      name: "Homestay ở Pả Vi hoặc nhà nghỉ thị trấn Mèo Vạc",
      type: "Homestay bản",
      vibe: "Yên hơn Đồng Văn, gần chân đèo để sáng sau đi sớm",
      priceEstimate: "khoảng 200.000 – 500.000đ/đêm, giá tham khảo",
    },
  },
  {
    day: 3,
    title: "Mèo Vạc về thành phố Hà Giang",
    theme: "Vòng về qua Du Già",
    startPoint: "Thị trấn Mèo Vạc",
    endPoint: "Thành phố Hà Giang",
    totalDistanceKm: 165,
    ridingHours: 6,
    maxElevationM: 1200,
    scenicRating: 4,
    weatherAlert:
      "Nhánh Du Già dễ sạt khi mưa và nhiều đoạn không có sóng điện thoại. Đang mưa hoặc vừa mưa " +
      "xong thì đi đường Yên Minh về, dài hơn nhưng chắc chắn hơn.",
    waypoints: [
      {
        id: "d3-khoi-hanh",
        day: 3,
        time: "07:00",
        title: "Rời Mèo Vạc",
        subtitle: "Chặng dài nhất của chuyến",
        distanceKm: 0,
        elevationM: 1000,
        type: "ride",
        highlight: "Đổ đầy bình trước khi vào nhánh Du Già",
        aiTip: "Cây xăng trên nhánh này thưa. Đây là chặng phải tính nhiên liệu chứ không đi tới đâu tính tới đó.",
      },
      {
        id: "d3-du-gia",
        day: 3,
        time: "10:30",
        title: "Thác Du Già",
        subtitle: "Hồ nước xanh dưới chân thác",
        distanceKm: 75,
        elevationM: 650,
        type: "rest",
        highlight: "Tắm được, và là chỗ nghỉ dài duy nhất của ngày",
        aiTip:
          "Nhiều người tới đây rồi quyết định ngủ thêm một đêm. Nếu còn dư thời gian thì đó là " +
          "một lựa chọn tốt hơn là chạy gấp về thành phố.",
      },
      {
        id: "d3-ve-thanh-pho",
        day: 3,
        time: "15:00",
        title: "Về thành phố Hà Giang",
        subtitle: "Trả xe",
        distanceKm: 165,
        elevationM: 100,
        type: "ride",
        highlight: "Đoạn cuối đường tốt dần, tốc độ nhanh hơn",
        aiTip:
          "Tính dư thời gian: xe khách đêm về Hà Nội thường khởi hành đầu buổi tối, và trả xe " +
          "cũng mất một lúc để kiểm cùng chủ.",
      },
    ],
    eveningStay: {
      name: "Xe khách giường nằm về Hà Nội, hoặc ngủ lại thành phố Hà Giang",
      type: "Kết thúc hành trình",
      vibe: "Chặng về mất khoảng 6–7 tiếng nếu đi xe đêm",
      priceEstimate: "vé xe khoảng 300.000 – 450.000đ, giá tham khảo",
    },
  },
];

export const WEBSITE_PRESET_ITINERARIES = [
  {
    slug: "ha-giang-ba-ngay-vong-cung-co-ban",
    title: "Hà Giang 3 ngày — vòng cung cơ bản",
    overview:
      "Lộ trình phổ biến nhất và cũng là lộ trình nên chọn cho chuyến đầu tiên: thành phố Hà " +
      "Giang lên Quản Bạ, Yên Minh, Đồng Văn, chạm cực bắc ở Lũng Cú, vượt Mã Pí Lèng xuống Mèo " +
      "Vạc rồi vòng về qua Du Già. Ba ngày là đủ để đi hết những điểm chính mà không phải chạy " +
      "gấp, nhưng chưa dư thời gian để bù cho một ngày mù — nếu đi vào các tháng lạnh thì nên " +
      "tính thêm một ngày.",
    days: BA_NGAY_CO_BAN,
    sortOrder: 0,
  },
];
