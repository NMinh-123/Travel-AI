/**
 * Kiểu dữ liệu của KHO TRI THỨC — phần văn bản mà chatbot được phép trích dẫn.
 *
 * Ranh giới với @data/places/types phải giữ chặt: danh mục thực thể trả lời câu hỏi "cái đó là
 * gì, ở đâu, giá bao nhiêu"; kho tri thức trả lời "vì sao nên đến, nên đi lúc nào, cần biết
 * trước điều gì". Số liệu có cấu trúc (toạ độ, khoảng cách, độ cao) KHÔNG được chép vào nội dung
 * tri thức — tác tử lấy chúng qua tool layer. Nhét số vào văn bản RAG là mở đường cho model đọc
 * sai rồi nói sai, và không có cách nào truy ngược con số đó về nguồn.
 *
 * Sáu mặt nội dung mà dự án cần — mô tả, lịch sử, văn hoá, ẩm thực, điểm ngắm cảnh, kinh nghiệm
 * ngắm cảnh — KHÔNG phải sáu trường của một bản ghi. Chúng là sáu tổ hợp `domain` × `entityType`
 * dưới đây. Làm vậy vì bộ lọc metadata chạy TRƯỚC semantic search (Mục 11.1.1.5): hỏi "ăn gì ở
 * Đồng Văn" thì lọc `domain: "food"` + `entityId` trong cây Đồng Văn xong mới tính tương đồng,
 * thay vì để vector tự mò trong toàn kho.
 */

/** Tám nhánh của SRS Mục 11.1.1.5. Không thêm nhánh nào ngoài danh sách này. */
export type KnowledgeDomain =
  | "destination"
  | "attraction"
  | "food"
  | "seasonal_recommendation"
  | "accommodation"
  | "tour"
  | "travel_guide"
  | "policy";

/**
 * Loại thực thể mà tài liệu nói về. Rộng hơn `PlaceKind` vì kho tri thức còn chứa những nhánh
 * không phải thực thể địa lý — chính sách, FAQ, mẹo đi đường.
 */
export type KnowledgeEntityType =
  | "province"
  | "commune"
  | "region"
  | "location"
  | "landmark"
  | "scenic_view"
  | "cultural_site"
  | "historical_site"
  | "local_food"
  | "restaurant"
  | "specialty"
  | "hotel"
  | "homestay"
  | "guesthouse"
  | "tour_description"
  | "tour_itinerary"
  | "tour_policy"
  | "transportation"
  | "safety"
  | "local_tips"
  | "faq"
  | "booking_policy"
  | "cancellation_policy"
  | "payment_policy"
  | "refund_policy";

/**
 * Mùa theo cách khách Hà Giang thực sự hỏi, không phải bốn mùa trong sách giáo khoa.
 *
 * Người ta không hỏi "mùa thu Hà Giang thế nào" mà hỏi "tháng mấy có hoa tam giác mạch". Bảng
 * mùa này là khoá lọc cho `seasonal_recommendation`, và phải khớp với bảng mùa của Temporal
 * Router ở giai đoạn B — lệch nhau thì câu hỏi theo tháng lọc ra tập rỗng mà không báo lỗi.
 */
export type Season =
  /** Tam giác mạch, tháng 10 – 11. */
  | "hoa_tam_giac_mach"
  /** Lúa chín ruộng bậc thang, tháng 9. */
  | "lua_chin"
  /** Hoa cải vàng, tháng 12 – 1. */
  | "hoa_cai"
  /** Hoa đào hoa mận, tháng 1 – 3. */
  | "hoa_dao_man"
  /** Mùa mưa và sạt lở, tháng 6 – 8. Mùa duy nhất mang ý nghĩa cảnh báo an toàn. */
  | "mua_mua"
  /** Rét đậm, băng giá trên đèo, tháng 12 – 1. */
  | "mua_lanh"
  /** Không phụ thuộc mùa. */
  | "quanh_nam";

/**
 * Xuất xứ của nội dung. Đây là trường quyết định tài liệu có được trích dẫn hay không.
 *
 * `editorial` — người trong dự án viết, chịu trách nhiệm về nội dung.
 * `crawled_verified` — lấy từ web qua @data/knowledge/web-sources, đã có người đọc và biên tập
 *   lại. Bản thô chưa biên tập KHÔNG bao giờ mang nhãn này.
 * `estimated` — suy luận từ mặt bằng thị trường hoặc từ nguồn gián tiếp. Tương ứng
 *   `sourceClass: "inference"` ở giai đoạn G, tức bị cấm đứng ở vị trí giá và chính sách.
 */
export type KnowledgeSourceClass = "editorial" | "crawled_verified" | "estimated";

/**
 * Một tài liệu nguồn. Chưa phải một đoạn (chunk) — việc cắt đoạn do scripts/ingest thực hiện,
 * và một tài liệu dài sẽ thành nhiều `KnowledgeDoc` trong database.
 */
export interface KnowledgeSourceDoc {
  /** Khoá bền vững, suy ra được từ nội dung. Ingest là idempotent nhờ trường này. */
  slug: string;
  domain: KnowledgeDomain;
  entityType: KnowledgeEntityType;
  /**
   * Slug của thực thể trong @data/places. Bỏ trống khi tài liệu không gắn với thực thể nào —
   * chính sách huỷ phòng, FAQ chung.
   *
   * Ràng buộc toàn vẹn: mọi `entityId` phải tồn tại trong danh mục. Không đặt khoá ngoại vì kho
   * tri thức được đánh chỉ mục lại độc lập, nên phép kiểm này chạy ở bước ingest — thiếu nó thì
   * một tài liệu gắn slug sai sẽ lặng lẽ không bao giờ khớp bộ lọc nào.
   */
  entityId?: string;
  title: string;
  /**
   * Nội dung tiếng Việt. Viết thành câu hoàn chỉnh, KHÔNG dùng gạch đầu dòng cụt: đoạn văn bị
   * cắt ra khỏi ngữ cảnh khi chunk, và một dòng "— 200.000đ" đứng một mình thì vô nghĩa.
   */
  content: string;
  tags: string[];
  season: Season[];
  sourceClass: KnowledgeSourceClass;
  /** Bắt buộc khi `sourceClass` là `crawled_verified` hoặc `estimated`. */
  sourceUrl?: string;
  /** Ngày đối chiếu nguồn, YYYY-MM-DD. Bắt buộc cùng điều kiện với `sourceUrl`. */
  retrievedAt?: string;
}

/**
 * Một trang web trong danh sách thu thập.
 *
 * Bản thô tải về KHÔNG đi thẳng vào kho tri thức: nó rơi xuống data/raw-web/ để người biên tập
 * đọc rồi chắt lọc thành `KnowledgeSourceDoc` với `sourceClass: "crawled_verified"`. Đây là ranh
 * giới của FR-BOT-05 — chatbot chỉ nói trong phạm vi tri thức đã kiểm duyệt. Đổ thẳng HTML của
 * mấy chục trang du lịch vào vector store là mời chatbot trích dẫn quảng cáo và giá đã lạc hậu.
 */
export interface WebSource {
  /** Khoá ngắn, cũng là tên file bản thô trong data/raw-web/. */
  id: string;
  url: string;
  /** Vì sao trang này đáng thu thập, và nó bổ khuyết nhóm câu hỏi nào. */
  purpose: string;
  domain: KnowledgeDomain;
  /**
   * Độ tin cậy của nguồn, quyết định thứ tự khi hai trang nói khác nhau.
   * `official` — cơ quan nhà nước, ban quản lý khu du lịch.
   * `press` — báo chí chính thống.
   * `operator` — đơn vị lữ hành, chủ homestay. Có lợi ích thương mại, đọc kỹ phần giá.
   * `community` — blog, diễn đàn. Tốt cho kinh nghiệm thực tế, kém cho số liệu.
   */
  tier: "official" | "press" | "operator" | "community";
  /** Đặt false khi trang chặn bot hoặc dựng bằng JavaScript — crawler sẽ bỏ qua, có ghi log. */
  crawlable: boolean;
}
