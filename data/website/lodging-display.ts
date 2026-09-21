import type { LodgingDisplay } from "@data/website/types";

/**
 * TRƯỜNG TRÌNH BÀY CHO CƠ SỞ LƯU TRÚ — ghép với @data/places/lodging theo slug.
 *
 * VÌ SAO TÁCH LÀM HAI FILE thay vì thêm mấy trường này vào `LODGING_PLACES`. Tầng danh mục trả
 * lời câu hỏi "chỗ đó ở đâu, thuộc xã nào, giá khoảng bao nhiêu"; tầng này chỉ để vẽ một cái thẻ.
 * Gộp vào thì mỗi lần đổi ảnh bìa là chạm vào file mà tác tử đọc, và ngược lại mỗi lần sửa
 * `PriceEstimate` là chạm vào file mà giao diện đọc — hai nhịp thay đổi hoàn toàn khác nhau bị
 * buộc vào cùng một chỗ.
 *
 * `rating` VÀ `reviewCount` LÀ SỐ THAM KHẢO, cùng tính chất với `PriceEstimate`. Chúng là mặt bằng
 * tổng hợp từ các sàn OTA vào thời điểm khảo sát, KHÔNG phải dữ liệu của dự án và không cập nhật
 * theo thời gian. Giá trị sống đến từ `getPlaceDetails` ở @server/infra/realtime, và theo thứ tự
 * ưu tiên của SRS Mục 11.1.1.10 thì dữ liệu Google thắng các con số ở đây. Giao diện nên trình bày
 * chúng như số tham khảo — in một con số 4,7 sao trông như đã xác minh là kiểu sai mà khách chỉ
 * phát hiện khi đã đặt phòng.
 *
 * Không cơ sở nào ở đây có ảnh riêng trên Wikimedia Commons — điều dễ hiểu, vì Commons không phải
 * nơi người ta đăng ảnh nhà nghỉ. Vì vậy `imageSlug` trỏ tới ảnh của VÙNG chứa cơ sở đó, và đây
 * là đánh đổi phải nói rõ: ảnh trên thẻ là ảnh bối cảnh, không phải ảnh cơ sở. Giao diện nên ghi
 * chú điều đó, hoặc thay bằng ảnh thật khi chủ cơ sở cung cấp.
 */
export const WEBSITE_LODGING_DISPLAY: LodgingDisplay[] = [
  {
    slug: "a-loi-homestay-lo-lo-chai",
    rating: 4.5,
    reviewCount: 140,
    highlight: "Bản Lô Lô Chải dưới chân cột cờ Lũng Cú — hạng cao hơn trong bản",
    imageSlug: "ban-lo-lo-chai",
    sortOrder: 0,
  },
  {
    slug: "long-co-tran-lung-cu",
    rating: 4.3,
    reviewCount: 95,
    highlight: "Chỗ nghỉ ở Lũng Cú, tiện cho buổi sáng sớm lên cột cờ trước các đoàn",
    imageSlug: "cot-co-lung-cu",
    sortOrder: 1,
  },
  {
    slug: "meo-vac-beehive-house",
    rating: 4.5,
    reviewCount: 170,
    highlight: "Làng văn hoá du lịch Pả Vi, ngay chân Mã Pí Lèng",
    imageSlug: "meo-vac",
    sortOrder: 7,
  },
  {
    slug: "o-chau-meo-vac-homestay",
    rating: 4.4,
    reviewCount: 120,
    highlight: "Mặt quốc lộ 4C ở Pả Vi — tiện xe, đổi lại ồn hơn các nhà phía trong làng",
    imageSlug: "meo-vac",
    sortOrder: 8,
  },
  {
    slug: "du-gia-thu-homestay",
    rating: 4.5,
    reviewCount: 130,
    highlight: "Mức thấp nhất trong nhóm homestay của danh mục, ngoài trục chính nên ít chịu mùa cao điểm",
    imageSlug: "thac-du-gia",
    sortOrder: 9,
  },
  {
    slug: "to-day-du-gia-village",
    rating: 4.4,
    reviewCount: 110,
    highlight: "Bản Tớ Dày ở Du Già, quanh thác và ruộng bậc thang",
    imageSlug: "thac-du-gia",
    sortOrder: 10,
  },
  {
    slug: "hoang-su-phi-lodge",
    rating: 4.4,
    reviewCount: 160,
    highlight: "Lựa chọn vừa túi hơn Panhou ở cùng xã Thông Nguyên, hợp mùa lúa chín",
    imageSlug: "ruong-bac-thang-hoang-su-phi",
    sortOrder: 6,
  },
  {
    slug: "dao-lodge-nam-dam",
    rating: 4.7,
    reviewCount: 290,
    highlight: "Do người Dao ở Nặm Đăm vận hành, có tắm lá thuốc truyền thống",
    imageSlug: "quan-ba",
    sortOrder: 1,
  },
  {
    slug: "ks-thien-an-yen-minh",
    rating: 4.0,
    reviewCount: 210,
    highlight: "Chặng nghỉ đêm đầu của phần lớn lịch trình ba ngày, trước khi vào cao nguyên đá",
    imageSlug: "yen-minh",
    sortOrder: 3,
  },
  {
    slug: "meo-vac-giac-xua-homestay",
    rating: 4.4,
    reviewCount: 190,
    highlight: "Homestay trong thị trấn Mèo Vạc, tiện cho đêm sau khi vượt Mã Pí Lèng",
    imageSlug: "meo-vac",
    sortOrder: 6,
  },
  {
    slug: "cum-homestay-thon-tha",
    rating: 4.5,
    reviewCount: 260,
    highlight: "Bản người Tày sát thành phố, chỗ nghỉ hợp lý cho đêm trước khi khởi hành",
    imageSlug: "tp-ha-giang",
    sortOrder: 3,
  },
  {
    slug: "panhou-retreat",
    rating: 4.5,
    reviewCount: 220,
    highlight: "Cơ sở duy nhất trong danh mục ở nhánh Hoàng Su Phì, hợp cho mùa lúa chín tháng 9",
    imageSlug: "ruong-bac-thang-hoang-su-phi",
    sortOrder: 5,
  },
  {
    slug: "hmong-village-resort",
    rating: 4.6,
    reviewCount: 640,
    highlight: "Kiến trúc lấy cảm hứng nhà trình tường, nhìn xuống thung lũng Tam Sơn",
    imageSlug: "quan-ba",
    sortOrder: 4,
  },
  {
    slug: "auberge-de-meo-vac",
    rating: 4.5,
    reviewCount: 150,
    highlight: "Nhà cổ người Pháp trùng tu trong trung tâm Mèo Vạc",
    imageSlug: "meo-vac",
    sortOrder: 5,
  },
  {
    slug: "ks-hoa-cuong-dong-van",
    rating: 4.2,
    reviewCount: 720,
    highlight: "Khách sạn lớn nhất Đồng Văn, đi bộ ra được phố cổ",
    imageSlug: "pho-co-dong-van",
    sortOrder: 6,
  },
  {
    slug: "ks-lam-tung-dong-van",
    rating: 4.1,
    reviewCount: 430,
    highlight: "Ngay quảng trường chợ Đồng Văn",
    imageSlug: "pho-co-dong-van",
    sortOrder: 7,
  },
  {
    slug: "du-gia-backpackers-hostel",
    rating: 4.4,
    reviewCount: 310,
    highlight: "Chỗ nghỉ dạng phòng chung ở Du Già, đông khách nước ngoài",
    imageSlug: "thac-du-gia",
    sortOrder: 8,
  },
  {
    slug: "bui-hostel-ha-giang",
    rating: 4.3,
    reviewCount: 520,
    highlight: "Điểm hẹn của dân đi xe máy ở thành phố, thuê xe và ghép nhóm tại chỗ",
    imageSlug: "tp-ha-giang",
    sortOrder: 9,
  },
  {
    slug: "ks-yen-bien-luxury",
    rating: 4.3,
    reviewCount: 410,
    highlight: "Khách sạn cao tầng bên sông Lô, tiện cho đêm đầu và đêm cuối",
    imageSlug: "tp-ha-giang",
    sortOrder: 10,
  },
  {
    slug: "ks-ha-an",
    rating: 4.2,
    reviewCount: 350,
    highlight: "Trung tâm thành phố Hà Giang, gần bến xe",
    imageSlug: "tp-ha-giang",
    sortOrder: 11,
  },
];
