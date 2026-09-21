import type { WebsiteGearItem } from "@data/website/types";

/**
 * DANH SÁCH ĐỒ CẦN MANG — checklist trên giao diện.
 *
 * Danh sách này đặc thù cho ĐÚNG địa bàn này, không phải danh sách đi du lịch chung. Ba đặc điểm
 * của Hà Giang quyết định nội dung: đi bằng xe máy trên đường đèo hẹp, chênh lệch độ cao lớn nên
 * chênh nhiệt độ lớn trong cùng một ngày, và nhiều xã không có sóng điện thoại lẫn không có ATM.
 * Một checklist chung chung sẽ nhắc kem chống nắng mà quên giấy tờ khu vực biên giới.
 *
 * VÌ SAO `recommended` VÀ `defaultChecked` LÀ HAI TRƯỜNG KHÁC NHAU. `recommended` là khuyến nghị
 * mạnh của dự án; `defaultChecked` là trạng thái tick sẵn khi khách mở trang. Mũ bảo hiểm thì cả
 * hai đều đúng. Nhưng hộ chiếu thì khuyến nghị mạnh với khách nước ngoài và vô nghĩa với khách
 * trong nước, nên nó `recommended` mà không tick sẵn — tick sẵn một thứ phần lớn người không cần
 * sẽ dạy họ bỏ qua cả checklist.
 */
export const WEBSITE_GEAR: WebsiteGearItem[] = [
  {
    slug: "mu-bao-hiem-full-face",
    name: "Mũ bảo hiểm trùm đầu",
    category: "safety",
    recommended: true,
    defaultChecked: true,
    note:
      "Mũ nửa đầu không đủ cho đường đèo. Nhiều chỗ cho thuê xe kèm mũ rất mỏng — kiểm trước khi " +
      "nhận xe, và nếu tệ thì mua mũ mới còn rẻ hơn mọi hậu quả.",
    sortOrder: 0,
  },
  {
    slug: "gang-tay-dai",
    name: "Găng tay dài",
    category: "safety",
    recommended: true,
    defaultChecked: true,
    note:
      "Vừa chống lạnh vừa giữ cảm giác phanh. Trên đèo ở độ cao cao, tay lạnh cóng là lý do thật " +
      "khiến người ta bóp phanh sai nhịp.",
    sortOrder: 1,
  },
  {
    slug: "ao-mua-bo",
    name: "Áo mưa bộ (không dùng áo mưa cánh dơi)",
    category: "safety",
    recommended: true,
    defaultChecked: true,
    note:
      "Áo mưa cánh dơi bay lên và có thể quấn vào bánh sau — đây là nguyên nhân tai nạn đã xảy ra " +
      "trên đường đèo. Áo mưa bộ hai mảnh là loại duy nhất nên dùng khi đi xe máy ở đây.",
    sortOrder: 2,
  },
  {
    slug: "giay-de-bam",
    name: "Giày đế bám, cổ cao",
    category: "clothing",
    recommended: true,
    defaultChecked: true,
    note:
      "Cần cho cả việc lái và việc đi bộ: đường mòn xuống bến thuyền hay ra mỏm đá đều là đá vôi, " +
      "và đá vôi ẩm thì rất trơn.",
    sortOrder: 3,
  },
  {
    slug: "ao-khoac-gio-nhieu-lop",
    name: "Áo khoác gió và áo lót giữ nhiệt",
    category: "clothing",
    recommended: true,
    defaultChecked: true,
    note:
      "Mặc theo lớp chứ đừng mang một áo thật dày. Trong cùng một ngày có thể đi từ thị trấn ấm " +
      "dưới thấp lên đỉnh đèo lạnh và nhiều gió, rồi lại xuống lòng sông nóng.",
    sortOrder: 4,
  },
  {
    slug: "khan-da-nang",
    name: "Khăn đa năng che cổ và mặt",
    category: "clothing",
    recommended: true,
    defaultChecked: false,
    note: "Chắn gió lạnh và bụi đường ở những đoạn đang sửa. Nhẹ, đáng mang.",
    sortOrder: 5,
  },
  {
    slug: "sac-du-phong",
    name: "Sạc dự phòng",
    category: "electronics",
    recommended: true,
    defaultChecked: true,
    note:
      "Điện thoại vừa là bản đồ vừa là phương tiện gọi cứu hộ. Ở các xã xa, mất điện vài giờ là " +
      "chuyện thường, nên đừng trông vào việc sạc ở nơi nghỉ.",
    sortOrder: 6,
  },
  {
    slug: "ban-do-offline",
    name: "Bản đồ tải sẵn để dùng ngoại tuyến",
    category: "electronics",
    recommended: true,
    defaultChecked: true,
    note:
      "Nhiều đoạn không có sóng, đặc biệt nhánh Du Già và các xã ven biên. Tải sẵn vùng bản đồ " +
      "trước khi rời thành phố.",
    sortOrder: 7,
  },
  {
    slug: "giá-đỡ-điện-thoại",
    name: "Giá đỡ điện thoại gắn xe",
    category: "electronics",
    recommended: false,
    defaultChecked: false,
    note:
      "Tiện cho việc dẫn đường, nhưng đừng vừa lái vừa nhìn màn hình trên đường đèo. Dừng lại ở " +
      "chỗ an toàn rồi xem.",
    sortOrder: 8,
  },
  {
    slug: "thuoc-say-xe-va-giam-dau",
    name: "Thuốc say xe và thuốc giảm đau",
    category: "medical",
    recommended: true,
    defaultChecked: true,
    note:
      "Đường liên tục cua gấp, và người không quen rất dễ say — kể cả người bình thường không say " +
      "xe. Uống trước khi vào đoạn đèo chứ đừng chờ tới lúc đã say.",
    sortOrder: 9,
  },
  {
    slug: "bo-so-cuu-nho",
    name: "Bộ sơ cứu nhỏ",
    category: "medical",
    recommended: true,
    defaultChecked: true,
    note:
      "Băng, gạc, sát trùng, băng dính. Trạm y tế xã cách nhau xa và cơ sở y tế đủ năng lực xử lý " +
      "chấn thương thì ở thành phố.",
    sortOrder: 10,
  },
  {
    slug: "kem-chong-nang",
    name: "Kem chống nắng",
    category: "medical",
    recommended: false,
    defaultChecked: false,
    note:
      "Ở độ cao thì tia UV mạnh hơn hẳn dù trời không nóng, và người ta hay bỏ qua đúng vì trời " +
      "mát nên không thấy cần.",
    sortOrder: 11,
  },
  {
    slug: "giay-phep-lai-xe",
    name: "Giấy phép lái xe hạng A1 trở lên",
    category: "documents",
    recommended: true,
    defaultChecked: true,
    note:
      "Bắt buộc theo luật để lái xe máy trên 50cc. Không có thì bảo hiểm cũng không chi trả nếu " +
      "xảy ra sự cố — đây là phần hậu quả mà ít người tính tới.",
    sortOrder: 12,
  },
  {
    slug: "cccd-hoac-ho-chieu",
    name: "Căn cước công dân hoặc hộ chiếu",
    category: "documents",
    recommended: true,
    defaultChecked: true,
    note:
      "Cần cho việc nhận phòng và cho việc khai báo khi vào khu vực biên giới như Lũng Cú hay Phố " +
      "Bảng. Mang bản gốc, không phải ảnh chụp.",
    sortOrder: 13,
  },
  {
    slug: "tien-mat",
    name: "Tiền mặt, chia thành nhiều túi",
    category: "documents",
    recommended: true,
    defaultChecked: true,
    note:
      "Nhiều homestay bản, quán ăn và bến thuyền chỉ nhận tiền mặt, và ATM gần như chỉ có ở thành " +
      "phố Hà Giang cùng vài thị trấn lớn. Rút đủ trước khi lên vùng cao.",
    sortOrder: 14,
  },
  {
    slug: "bao-hiem-du-lich",
    name: "Bảo hiểm du lịch có phần xe máy",
    category: "documents",
    recommended: true,
    defaultChecked: false,
    note:
      "Đọc kỹ điều khoản: nhiều hợp đồng loại trừ tai nạn xe máy, hoặc chỉ chi trả khi người lái " +
      "có giấy phép hợp lệ. Loại trừ đó thường nằm ở phần không ai đọc.",
    sortOrder: 15,
  },
];
