/**
 * Kiểu dữ liệu của TẦNG TRÌNH BÀY — thứ mà giao diện cần để hiển thị, không phải thứ tác tử cần
 * để trả lời.
 *
 * VÌ SAO THƯ MỤC NÀY TỒN TẠI RIÊNG. `data/places` và `data/knowledge` được thiết kế để TRẢ LỜI:
 * thực thể có khoá tra cứu, tri thức có metadata để lọc. Giao diện thì cần một thứ khác hẳn — ảnh
 * bìa, toạ độ trong canvas SVG, thứ tự hiển thị, một danh sách đồ cần mang. Không có gì trong số
 * đó giúp trả lời câu hỏi nào, và ngược lại `PriceEstimate` với `sourceUrls` thì không giúp vẽ
 * một thẻ điểm đến.
 *
 * Bản trước gộp cả hai vào một file (`src/data/hagiangData.ts`) và đó chính là lý do nó khó dùng:
 * một bản ghi vừa phải đủ đẹp để render vừa phải đủ chuẩn để truy vấn, nên nó không làm tốt việc
 * nào. Ở đây hai tầng tách ra và **nối với nhau bằng slug**: `Destination.slug` trùng
 * `Place.slug`, nên tác tử và giao diện nói về cùng một thực thể mà không phải dùng chung schema.
 *
 * HỆ QUẢ PHẢI GIỮ: mọi slug trong thư mục này BẮT BUỘC tồn tại trong @data/places. Script soát
 * toàn vẹn kiểm điều đó. Một slug lệch ở đây không làm giao diện hỏng ngay — nó chỉ làm mục yêu
 * thích của khách trỏ vào một điểm đến mà tác tử không biết, và không ai phát hiện cho tới khi có
 * người hỏi chatbot về đúng điểm đó.
 */

/**
 * Một ảnh kèm nghĩa vụ ghi công.
 *
 * `credit` và `license` KHÔNG phải trường tuỳ chọn cho đẹp. Ảnh trong dự án này lấy từ Wikimedia
 * Commons dưới giấy phép CC BY hoặc CC BY-SA, và cả hai đều ĐÒI ghi tên tác giả. Giao diện phải
 * hiển thị chúng ở đâu đó cạnh ảnh; bỏ đi là vi phạm giấy phép chứ không phải thiếu sót nhỏ. Đó
 * là lý do chúng nằm trong kiểu dữ liệu chứ không nằm trong một file ghi chú bên cạnh — đã lấy
 * ảnh thì buộc phải mang theo thông tin ghi công.
 *
 * File @data/website/images.ts được SINH TỰ ĐỘNG bởi `scripts/fetch-place-images.ts`, nên đừng
 * sửa tay: xuất xứ và giấy phép đến từ API của Commons, không do ai gõ vào.
 */
export interface ImageRef {
  url: string;
  /** Tên tác giả theo metadata của Commons. "không rõ tác giả" khi Commons không ghi. */
  credit: string;
  /** Tên ngắn của giấy phép, ví dụ "CC BY-SA 4.0", "CC0". */
  license: string;
  /** Trang mô tả trên Commons, để người xem kiểm được xuất xứ. */
  sourcePage: string;
  widthPx: number;
}

/** Phân loại điểm đến, khớp `enum DestinationCategory` trong db/schema.prisma. */
export type DestinationCategory =
  | "pass"
  | "nature"
  | "culture"
  | "viewpoint"
  | "waterfall"
  | "homestay";

/**
 * Mức độ khó của đường tới điểm đến. Bốn giá trị này khớp union `difficulty` trong
 * shared/types.ts và được hiển thị nguyên văn trên giao diện, nên đổi chữ ở đây là đổi chữ trên
 * màn hình — không phải một khoá nội bộ.
 */
export type Difficulty = "Dễ đi" | "Trung bình" | "Đòi hỏi tay lái vững" | "Hiểm trở";

/**
 * Một điểm đến trên giao diện.
 *
 * Ba nhóm trường, và phân biệt chúng giúp biết chỗ nào được phép sửa tự do:
 *
 *  - NHÓM ĐỒNG BỘ VỚI DANH MỤC — `slug`, `lat`, `lng`, `elevation`. Chúng phải khớp
 *    `Place.geo` trong @data/places. Lệch là tạo hai nguồn sự thật cho cùng một điểm, và tác tử
 *    với giao diện sẽ nói hai con số khác nhau về cùng một chỗ. Script soát kiểm điều này.
 *  - NHÓM CHỈ CỦA GIAO DIỆN — `imageSlug`, `sortOrder`. Sửa thoải mái, không
 *    ảnh hưởng câu trả lời của chatbot.
 *  - NHÓM NỘI DUNG NGẮN — `description`, `safetyTip`, `highlights`, `bestTime`. Đây là bản TÓM
 *    LƯỢC cho thẻ và modal, KHÔNG phải tri thức của chatbot. Tri thức đầy đủ nằm ở
 *    @data/knowledge; nếu hai chỗ nói khác nhau thì @data/knowledge là bản đúng, vì đó là bản đã
 *    qua quy trình biên tập và được trích dẫn kèm nguồn.
 */
export interface WebsiteDestination {
  /** Phải tồn tại trong @data/places. */
  slug: string;
  name: string;
  vietnameseName: string;
  /**
   * Nhãn địa bàn hiển thị cho khách. Trường này tên là `district` ở database và ở shared/types vì
   * lịch sử, nhưng giá trị điền vào đây là TÊN VÙNG DU LỊCH (Đồng Văn, Mèo Vạc...) — cấp huyện đã
   * bị bỏ từ 01/7/2025. Không đổi tên trường vì đổi thì phải chạm cả schema lẫn client, mà giá
   * trị đúng thì quan trọng hơn tên đúng ở chỗ này.
   */
  regionLabel: string;
  category: DestinationCategory;
  /** Mét; null khi chưa xác minh. Khi có geo, số đã xác minh phải khớp danh mục. */
  elevation: number | null;
  /** Km tính từ thành phố Hà Giang theo đường bộ. Số tham chiếu để sắp thứ tự, không để dẫn đường. */
  distanceFromStart: number | null;
  difficulty: Difficulty;
  bestTime: string;
  highlights: string[];
  description: string;
  safetyTip: string;
  /** Cùng null khi chưa xác minh; không lấy tọa độ vùng làm cổng tham quan. */
  lat: number | null;
  lng: number | null;
  collection?: 'original' | 'expanded-20260918';
  sourceLinks?: { title: string; url: string }[];
  recommendedStayHours: number;
  localFood: string[];
  /**
   * Khoá tra ảnh trong @data/website/images. Thường bằng `slug`, nhưng tách riêng để nhiều điểm
   * đến dùng chung một bộ ảnh khi Commons không có ảnh riêng cho từng chỗ.
   */
  imageSlug: string;
  sortOrder: number;
}

/** Nhóm đồ cần mang, khớp `enum GearCategory` trong db/schema.prisma. */
export type GearCategory = "safety" | "clothing" | "electronics" | "medical" | "documents";

export interface WebsiteGearItem {
  slug: string;
  name: string;
  category: GearCategory;
  /**
   * `recommended` là khuyến nghị mạnh của dự án; `defaultChecked` là trạng thái tick sẵn trên
   * giao diện. Hai thứ khác nhau có chủ đích: mũ bảo hiểm thì vừa khuyến nghị mạnh vừa tick sẵn,
   * còn hộ chiếu thì khuyến nghị mạnh với khách nước ngoài nhưng không tick sẵn cho mọi người.
   */
  recommended: boolean;
  defaultChecked: boolean;
  note: string;
  sortOrder: number;
}

/**
 * Điều kiện đèo THEO MÙA — dữ liệu tham khảo, KHÔNG phải quan trắc thời gian thực.
 *
 * Bảng này từng bị dùng như dữ liệu thời tiết, và đó là vi phạm trực tiếp SRS Mục 11.1.1.3 về
 * tách tĩnh khỏi động. Nay thời tiết thật đến từ `getWeather` ở @server/infra/realtime, còn bảng
 * này giữ đúng vai trò của nó: điều kiện điển hình của một con đèo theo mùa, để giao diện cho
 * khách hình dung trước khi đi.
 *
 * Vì vậy nó KHÔNG được đưa vào prompt của tác tử như thể là thời tiết hiện tại. Nếu cần nói về
 * điều kiện theo mùa thì lấy từ @data/knowledge với `domain: "seasonal_recommendation"`.
 */
export interface WebsitePassCondition {
  slug: string;
  /** Slug của địa danh trong @data/places mà điều kiện này nói về. */
  placeSlug: string;
  location: string;
  elevation: number;
  /** Nhiệt độ điển hình, độ C. Là giá trị THAM KHẢO theo mùa, không phải số đo. */
  temp: number;
  condition: string;
  windSpeedKm: number;
  fogLevel: string;
  roadStatus: string;
  sortOrder: number;
}

/** Trường trình bày cho cơ sở lưu trú, ghép với @data/places/lodging theo slug. */
export interface LodgingDisplay {
  /** Phải tồn tại trong LODGING_PLACES của @data/places/lodging. */
  slug: string;
  /**
   * Điểm đánh giá và số lượt đánh giá là giá trị THAM KHẢO tổng hợp từ các sàn OTA, cùng tính
   * chất với `PriceEstimate` — chúng không phải dữ liệu của dự án. Giá trị thật, cập nhật theo
   * thời gian, đến từ `getPlaceDetails` ở tầng realtime. Vì vậy giao diện nên hiển thị chúng như
   * số tham khảo, và khi có dữ liệu Google thì dữ liệu Google thắng.
   */
  rating: number;
  reviewCount: number;
  /** Một câu nêu đặc điểm nổi nhất, dùng làm dòng phụ trên thẻ. */
  highlight: string;
  imageSlug: string;
  sortOrder: number;
}

/**
 * Ảnh dự phòng khi một slug không có ảnh nào trong @data/website/images.
 *
 * Dùng ảnh của cả vùng chứ không dùng một khung xám: một thẻ điểm đến không có ảnh trông như lỗi
 * tải trang, còn một ảnh đúng vùng nhưng không đúng điểm thì vẫn truyền đạt được bối cảnh. Đánh
 * đổi này chỉ chấp nhận được vì ảnh dự phòng là ảnh của Hà Giang — không bao giờ được dùng ảnh
 * của một nơi khác làm dự phòng.
 */
export const FALLBACK_IMAGE_SLUG = "cao-nguyen-da-dong-van";
