/**
 * Kiểu dữ liệu của DANH MỤC THỰC THỂ — tầng xương sống của toàn bộ data/.
 *
 * Một "địa điểm" ở đây không chỉ là điểm đến trên bản đồ. Theo SRS Mục 11.1.1.5, mỗi thứ mà
 * khách có thể hỏi tới đều là một thực thể có khoá riêng: một con đèo, một điểm dừng ngắm cảnh
 * trên đèo đó, một món ăn, một quán bán món đó, một homestay. Cách tổ chức này khác hẳn bản
 * trước — trước đây ẩm thực là mảng chuỗi `localFood` nằm trong điểm đến, nên câu hỏi "thắng cố
 * ăn ở đâu" không có gì để tra cứu ngoài việc quét văn bản mô tả.
 *
 * Hệ quả bắt buộc phải nắm: `PlaceKind` ở đây và `KnowledgeEntityType` ở @data/knowledge/types
 * là HAI danh sách khác nhau và không được gộp. Danh mục này liệt kê thứ CÓ THẬT và định vị
 * được; kho tri thức thì còn có cả những nhánh không phải thực thể địa lý (`faq`,
 * `cancellation_policy`, `local_tips`). Gộp chúng lại là biến một bảng tra cứu địa danh thành
 * một túi đựng mọi thứ.
 */

/**
 * Cấp hành chính và loại thực thể trong danh mục.
 *
 * Không có `district`. Cấp huyện của Việt Nam đã bị bỏ từ 01/7/2025, và cùng đợt đó Hà Giang sáp
 * nhập vào tỉnh Tuyên Quang. Giữ lại `district` là mã hoá một cấp hành chính không còn tồn tại
 * vào khoá dữ liệu, rồi mọi câu trả lời về địa giới sẽ sai theo. Địa bàn cũ (Đồng Văn, Mèo Vạc,
 * Quản Bạ...) vẫn cần tra cứu được vì khách vẫn gọi tên như vậy — chúng nằm ở `kind: "region"`,
 * tức vùng du lịch theo cách gọi dân gian, không phải đơn vị hành chính.
 */
export type PlaceKind =
  /** Đơn vị hành chính cấp tỉnh — sau sáp nhập chỉ còn Tuyên Quang. */
  | "province"
  /** Đơn vị hành chính cấp xã/phường/thị trấn, cấp dưới trực tiếp của tỉnh từ 01/7/2025. */
  | "commune"
  /**
   * Vùng du lịch theo cách gọi quen thuộc ("Đồng Văn", "Mèo Vạc"). KHÔNG phải đơn vị hành chính.
   * Tồn tại vì khách hỏi bằng tên này chứ không hỏi bằng tên xã, và bỏ nó đi thì bộ phân giải
   * địa danh mất phần lớn đầu vào thực tế.
   */
  | "region"
  /** Địa danh tự nhiên hoặc nhân tạo có vị trí xác định: đèo, hẻm vực, sông, thác, cột cờ. */
  | "landmark"
  /** Điểm DỪNG để ngắm — mỏm đá, khúc cua, đài quan sát. Con của một `landmark`. */
  | "scenic_view"
  /** Di tích văn hoá đang sống: chợ phiên, làng nghề, bản dân tộc. */
  | "cultural_site"
  /** Di tích lịch sử: dinh thự, đồn biên phòng cũ, cột mốc. */
  | "historical_site"
  /** Món ăn — bản thân món, không phải nơi bán. */
  | "local_food"
  /** Đặc sản mang về được: mật ong bạc hà, chè Shan tuyết, rượu ngô. */
  | "specialty"
  /** Cơ sở ăn uống có địa chỉ. */
  | "restaurant"
  | "homestay"
  | "guesthouse"
  | "hotel";

/**
 * Toạ độ kèm ĐỘ CAO. `elevationM` không phải trường trang trí: Open-Meteo nhận nó làm tham số
 * và nội suy dự báo theo độ cao thật (xem @data/realtime/types). Đèo ở 1.500–2.000 m còn thị
 * trấn dưới chân đèo ở 300–900 m; bỏ trống trường này là để nhà cung cấp đoán theo ô lưới mặt
 * đất và trả về nhiệt độ lệch vài độ ở đúng chỗ nguy hiểm nhất.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** Mét trên mực nước biển. Bắt buộc với mọi thực thể có `kind` là đèo, đỉnh, điểm ngắm cảnh. */
  elevationM: number;
  /**
   * Độ tin cậy của toạ độ — BA mức, và phân biệt chúng quyết định giao diện được phép nói gì.
   *
   * `surveyed`    — đối chiếu được với nguồn độc lập (Wikipedia, OpenStreetMap) và tên khớp đúng.
   *                 Dùng để chỉ vị trí cụ thể là hợp lệ.
   * `approximate` — của riêng thực thể đó nhưng chưa đối chiếu độc lập, ví dụ toạ độ do sàn đặt
   *                 phòng cung cấp cho chính cơ sở của họ. Đủ chính xác để đặt một ghim riêng.
   * `area_only`   — KHÔNG phải toạ độ của thực thể, mà là của xã hoặc bản chứa nó. Dùng khi
   *                 không có nguồn nào cho riêng nó.
   *
   * VÌ SAO `area_only` PHẢI TÁCH RIÊNG thay vì gộp vào `approximate`. Hai mức đó khác nhau về
   * BẢN CHẤT chứ không về mức độ: một toạ độ approximate lệch vài trăm mét quanh đúng cơ sở,
   * còn một toạ độ area_only trỏ vào giữa làng và mọi cơ sở trong làng đều dùng chung nó. Gộp
   * lại thì giao diện không phân biệt được, và hệ quả thấy được ngay trên bản đồ: nhiều ghim
   * xếp chồng lên nhau ở một điểm, trông như dữ liệu hỏng. Tách ra thì giao diện nói đúng —
   * "vị trí khu vực" thay vì im lặng để khách tưởng đó là địa chỉ cơ sở.
   */
  precision: "surveyed" | "approximate" | "area_only";
}

/**
 * Giá ước lượng từ mặt bằng thị trường, KHÔNG phải giá niêm yết đã xác minh.
 *
 * Đây là kiểu quan trọng nhất trong file này về mặt an toàn dữ liệu. Dự án cho phép điền giá nhà
 * hàng và nhà nghỉ suy ra từ các trang bán hàng, vì không có nguồn chính thức nào cho địa bàn
 * này. Nhưng một con số ước lượng mà trông giống hệt một con số đã kiểm chứng thì sớm muộn sẽ
 * được trích vào câu trả lời như giá thật, và khách chỉ phát hiện lúc thanh toán.
 *
 * Nên giá ước lượng KHÔNG bao giờ là một `number` trần. Nó luôn mang theo cơ sở, ngày khảo sát
 * và nguồn tham chiếu. Validator ở giai đoạn G đăng ký nó với `sourceClass: "inference"`, và
 * theo Mục 11.1.1.10 thì dữ kiện loại đó bị cấm xuất hiện ở vị trí giá — tức tác tử buộc phải
 * nói "giá tham khảo khoảng…" chứ không thể nói "giá là…".
 */
export interface PriceEstimate {
  /** Cận dưới, VND. */
  minVnd: number;
  /** Cận trên, VND. Bằng `minVnd` khi chỉ khảo được một mức. */
  maxVnd: number;
  /** Đơn vị tính: mỗi người, mỗi phần, mỗi đêm, mỗi phòng. */
  unit: "per_person" | "per_dish" | "per_night" | "per_room" | "per_trip";
  /**
   * Ba mức xuất xứ, xếp từ yếu tới mạnh. Phân biệt chúng không phải chuyện học thuật: ba mức này
   * chịu được ba mức tin cậy khác nhau trong câu trả lời cho khách.
   *
   * `market_estimate` — SUY từ mặt bằng các cơ sở tương đương. Không ai từng thấy con số này
   *   trên một trang bán hàng nào. Đây là mặc định khi không có nguồn nào tốt hơn.
   *
   * `ota_observed` — ĐÃ THẤY trên một sàn bán phòng vào một ngày cụ thể. Mạnh hơn hẳn ước lượng
   *   vì nó là giá có thật, giao dịch được. Nhưng nó là giá SÀN: đã gồm hoa hồng, đổi theo ngày
   *   nhận phòng, và có thể khác giá chủ nhà báo trực tiếp. `surveyedAt` với mức này quan trọng
   *   hơn hẳn hai mức kia — một lần đọc là một điểm tại một thời điểm, không phải cả khoảng.
   *
   * `published_rate` — bảng giá do CHÍNH CƠ SỞ công bố, và `sourceUrls` trỏ tới đúng trang đó.
   *   Chỉ đặt mức này khi thực sự nhìn thấy bảng giá của họ, không phải giá trên sàn.
   */
  basis: "market_estimate" | "ota_observed" | "published_rate";
  /** Ngày khảo sát, dạng YYYY-MM-DD. Giá du lịch trượt nhanh nên thiếu ngày là vô nghĩa. */
  surveyedAt: string;
  /** Các trang đã tham chiếu khi ước lượng. Tối thiểu một, để soát lại được. */
  sourceUrls: string[];
  /** Ghi chú cách suy, ví dụ "trung vị 6 homestay cùng xã trên Booking, mùa thấp điểm". */
  note?: string;
}

/**
 * Khung giờ mở cửa TĨNH — chỉ dùng làm giá trị dự phòng khi Google Places không trả về.
 * Giờ mở cửa thật là dữ liệu động (Mục 11.1.1.3): `regularOpeningHours` từ Places thắng trường
 * này theo thứ tự ưu tiên realtime > knowledge của Mục 11.1.1.10.
 */
export interface StaticOpeningHours {
  /** Mô tả người đọc được, ví dụ "05:00–09:00, chỉ họp Chủ nhật". */
  text: string;
  /** Chỉ họp theo phiên — chợ phiên Hà Giang họp theo con giáp chứ không theo thứ trong tuần. */
  cadence?: "daily" | "weekly" | "market_cycle" | "seasonal";
}

/**
 * Một thực thể trong danh mục.
 *
 * `slug` là khoá bền vững, dùng làm `entityId` cho mọi tài liệu tri thức trỏ tới thực thể này.
 * Đổi slug là làm mồ côi toàn bộ tri thức đã gắn — nên slug đặt một lần rồi thôi, kể cả khi tên
 * hiển thị đổi.
 */
export interface Place {
  slug: string;
  /** Tên hiển thị tiếng Việt, có dấu, viết như trên biển chỉ dẫn. */
  name: string;
  /** Tên tiếng Anh nếu có nguồn dùng, để khớp kết quả từ API nước ngoài. */
  nameEn?: string;
  /**
   * Các cách gọi khác Ở DẠNG ĐÃ CHUẨN HOÁ (thường, bỏ dấu, không dấu câu). Bộ phân giải địa danh
   * chuẩn hoá đầu vào của khách rồi mới so, nên danh sách này chỉ cần liệt kê khác biệt về TỪ
   * NGỮ ("ma pi leng", "mapileng", "deo ma pi leng"), không cần liệt kê biến thể dấu.
   */
  aliases: string[];
  kind: PlaceKind;
  /**
   * Slug của thực thể cha. Điểm ngắm cảnh trỏ về đèo chứa nó, quán ăn trỏ về xã, xã trỏ về tỉnh.
   * Nhờ cây này mà câu hỏi "có gì ở Đồng Văn" gom được cả con lẫn cháu mà không cần liệt kê tay.
   */
  parentSlug?: string;
  geo?: GeoPoint;
  /** Địa chỉ dạng chữ, cho thực thể có cơ sở vật chất (quán ăn, homestay). */
  address?: string;
  openingHours?: StaticOpeningHours;
  /** Khoảng giá, chỉ có ở quán ăn và cơ sở lưu trú. Xem cảnh báo ở `PriceEstimate`. */
  price?: PriceEstimate;
  /**
   * Mã Google Place nếu đã tra được. Có sẵn thì adapter Places bỏ qua bước tìm kiếm theo tên —
   * vừa nhanh vừa loại hẳn rủi ro khớp nhầm sang một quán trùng tên ở tỉnh khác.
   */
  googlePlaceId?: string;
  /** Nhãn tự do để lọc: "mua-hoa-tam-giac-mach", "phu-hop-xe-may", "can-giay-phep-bien-gioi". */
  tags: string[];
  sortOrder: number;
}
