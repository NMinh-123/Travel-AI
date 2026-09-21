/**
 * Kiểu dữ liệu của TẦNG DỮ LIỆU ĐỘNG — phần khai báo, không phải phần gọi API.
 *
 * SRS Mục 11.1.1.3 buộc tách tĩnh khỏi động, và ranh giới đó ở đây là ranh giới giữa hai thư
 * mục: `data/realtime/` mô tả CÁI GÌ cần hỏi và hỏi Ở ĐÂU; `server/infra/realtime/` thực hiện
 * lượt gọi, xử lý lỗi và cache. Không có lượt gọi mạng nào được viết trong thư mục này.
 *
 * Vì sao phải khai báo tường minh thay vì để tác tử tự dựng tham số: một tác tử tự sinh toạ độ
 * sẽ sinh cả toạ độ sai, và một lượt gọi API bằng toạ độ sai vẫn trả về HTTP 200 kèm dữ liệu
 * hoàn toàn hợp lệ của một chỗ khác. Lỗi đó không bao giờ ném exception, chỉ làm câu trả lời sai
 * một cách tự tin. Khai báo trước thì tập tham số hợp lệ là hữu hạn và soát được qua git diff.
 */

/**
 * Một điểm đo thời tiết. Mỗi thực thể trong danh mục mà khách có thể hỏi "thời tiết thế nào" đều
 * cần đúng một điểm.
 *
 * Không dùng thẳng `Place.geo` vì hai lý do. Thứ nhất, điểm đo tốt nhất cho một con đèo dài 20 km
 * là ĐỈNH đèo chứ không phải trọng tâm hình học của nó — chênh lệch có thể là 600 m độ cao. Thứ
 * hai, nhiều thực thể (quán ăn, homestay trong cùng một xã) chia sẻ chung một điểm đo; gọi API
 * riêng cho từng cái là đốt hạn mức để nhận về cùng một câu trả lời.
 */
export interface WeatherPoint {
  /** Khoá của điểm đo. */
  id: string;
  /** Tên hiển thị khi trích dẫn nguồn: "đỉnh Mã Pí Lèng, 1.500 m". */
  label: string;
  lat: number;
  lng: number;
  /**
   * Độ cao truyền thẳng cho tham số `elevation` của Open-Meteo. Đây là lý do chọn nhà cung cấp
   * này: dự báo được nội suy theo độ cao thật thay vì lấy theo ô lưới mặt đất. Sương mù đỉnh đèo
   * và nhiệt độ thực tế ở 1.800 m là thông tin ảnh hưởng tới an toàn khi lái, không phải chi
   * tiết trang trí.
   */
  elevationM: number;
  /**
   * Các slug trong @data/places dùng chung điểm đo này. Một điểm phục vụ nhiều thực thể; ngược
   * lại một thực thể chỉ được xuất hiện ở đúng một điểm — trùng thì bộ phân giải không biết chọn
   * cái nào và sẽ chọn theo thứ tự khai báo, tức chọn bừa.
   */
  servesPlaceSlugs: string[];
  /** Vì sao đặt điểm đo ở đây chứ không ở chỗ khác. Bắt buộc, để lần sau còn soát lại được. */
  rationale: string;
}

/**
 * Một cung đường cần phân tích khoảng cách và thời gian di chuyển.
 *
 * Khai báo sẵn các chặng KHUNG của hành trình Hà Giang thay vì để tác tử ghép tuỳ ý từng cặp
 * điểm. Lý do là chi phí và tính đúng đắn cùng lúc: cung đường thay đổi rất chậm nên TTL 24 giờ
 * là hợp lý, và một danh sách hữu hạn thì cache được làm nóng trước, còn tổ hợp mọi cặp điểm thì
 * không. Chặng nào khách hỏi mà không có trong danh sách thì vẫn gọi Routes API theo toạ độ —
 * danh sách này là đường tắt cho các chặng phổ biến, không phải hàng rào.
 */
export interface RouteSegment {
  id: string;
  /** Slug điểm đầu trong @data/places. */
  fromSlug: string;
  /** Slug điểm cuối trong @data/places. */
  toSlug: string;
  /**
   * Điểm bắt buộc đi qua. Cần vì Routes API tối ưu theo thời gian và sẽ chọn quốc lộ vòng ngoài,
   * trong khi giá trị của cung đường này nằm ở chính con đèo. Không có waypoint thì API trả về
   * một tuyến nhanh hơn và hoàn toàn vô dụng với khách đi ngắm cảnh.
   */
  viaSlugs: string[];
  /** Phương tiện. Đường đèo hẹp nên xe máy và ô tô cho ra thời gian rất khác nhau. */
  travelMode: "DRIVE" | "TWO_WHEELER";
  /**
   * Khoảng cách tham chiếu, km. Dùng để ĐỐI CHIẾU chứ không để trả lời: lệch quá 20% so với số
   * Routes API trả về nghĩa là tuyến bị định lại đường, và đó là tín hiệu cần người xem lại chứ
   * không phải số để đưa vào câu trả lời.
   */
  referenceDistanceKm: number;
  /** Ghi chú địa hình ảnh hưởng tới thời gian: độ dốc, số khúc cua, đoạn đang sửa. */
  terrainNote: string;
}

/**
 * Khung bao địa bàn, dùng cho `locationRestriction` của Google Places.
 *
 * Đây là rào chắn thứ hai của Mục 5.1 trong kế hoạch 11.1.1. Cổng chặn "ngoài địa bàn" ở
 * orchestrator là rào thứ nhất, nhưng Places trả kết quả cho mọi nơi trên thế giới, nên mọi lượt
 * gọi phải kèm khung bao. Hai lớp vì lớp thứ hai bảo vệ đúng trường hợp lớp thứ nhất bị bỏ sót —
 * và khi bị bỏ sót thì chatbot bắt đầu trả lời về Sapa hay Đà Lạt trong khi trông vẫn như đang
 * chạy tốt.
 */
export interface RegionBoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Mã lỗi có cấu trúc. Không nhánh nào được phép trả dữ liệu suy đoán khi lỗi (DR-AGENT-08). */
export type ToolErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "PROVIDER_NOT_CONFIGURED"
  | "UNSUPPORTED_REGION"
  | "NOT_FOUND";

/** Nhóm dữ liệu động, mỗi nhóm một TTL riêng. */
export type RealtimeTool = "weather" | "route" | "place_search" | "geocode";

/**
 * Hồ sơ một nhà cung cấp.
 *
 * `ttlSeconds` là quy tắc cứng theo Mục 11.1.1.11: cache hết hạn KHÔNG được phục vụ cho dữ liệu
 * biến động cao. Nó được hiện thực thành điều kiện `WHERE expires_at > now()` chứ không dựa vào
 * việc bộ trục xuất đã kịp chạy hay chưa. Hết hạn thì gọi lại; gọi lại hỏng thì trả lỗi có cấu
 * trúc, không bao giờ phục vụ bản cũ.
 */
export interface ProviderProfile {
  tool: RealtimeTool;
  /** Khoá nhà cung cấp, khớp giá trị của biến môi trường tương ứng. */
  provider: string;
  /** Origin của API. Đường dẫn cụ thể do adapter ghép, để đổi endpoint không phải sửa data. */
  baseUrl: string;
  /**
   * Tên biến môi trường chứa khoá. Rỗng nghĩa là không cần khoá — Open-Meteo thuộc nhóm này, và
   * đó là một trong những lý do chọn nó.
   */
  apiKeyEnv: string | null;
  ttlSeconds: number;
  /** Ngân sách thời gian cho một lượt gọi. Quá ngưỡng là `TIMEOUT`, không chờ tiếp. */
  timeoutMs: number;
  /** Số lần thử lại cho lỗi mạng. Đếm vào `execution.retry_count` của trace. */
  maxRetries: number;
  /** Câu ghi nguồn gắn vào câu trả lời khi dùng dữ liệu từ nhà cung cấp này. */
  attribution: string;
}
