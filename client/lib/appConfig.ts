import { apiRequest } from '@client/lib/api';

/**
 * Cấu hình công khai mà server gửi xuống trình duyệt qua GET /api/config.
 *
 * "Công khai" ở đây là theo đúng nghĩa đen: mọi thứ trong kiểu này đều nằm lộ thiên trong mã
 * nguồn trang và ai mở DevTools cũng đọc được. Đó là lý do chỉ hai giá trị này được phép có
 * mặt — cả hai đều là loại khoá được thiết kế để công khai và được giới hạn ở phía Google bằng
 * HTTP referrer, chứ không phải bằng việc giấu chúng đi.
 *
 * KHÔNG BAO GIỜ thêm vào đây khoá của tầng máy chủ: `GOOGLE_MAPS_API_KEY` gọi được Routes và
 * Places và tính tiền theo lượt, `GEMINI_API_KEY` gọi được model. Một trường thêm vào file này
 * là một khoá đưa cho toàn bộ internet.
 */
export interface AppConfig {
  /** null khi server chưa cấu hình GOOGLE_CLIENT_ID — khi đó nút đăng nhập Google phải ẩn. */
  googleClientId: string | null;
  /**
   * null khi server chưa cấu hình GOOGLE_MAPS_EMBED_KEY. Bản đồ vẫn hiện: `PlaceMap` chuyển
   * sang đường nhúng không cần khoá. Giá trị này chỉ quyết định dùng Maps Embed API chính thức
   * hay đường không khoá, chứ không còn quyết định CÓ bản đồ hay không.
   */
  googleMapsEmbedKey: string | null;
}

const EMPTY: AppConfig = { googleClientId: null, googleMapsEmbedKey: null };

/**
 * Promise dùng chung cho cả vòng đời trang.
 *
 * Cache ở mức module chứ không ở mức component, và cache PROMISE chứ không cache kết quả. Cách
 * này giải đúng vấn đề mà một cache kết quả thông thường bỏ sót: khi hai nơi cùng hỏi cấu hình
 * trong cùng một nhịp render đầu tiên — `AuthProvider` và một bản đồ chẳng hạn — cache kết quả
 * vẫn còn rỗng ở cả hai lời gọi nên cả hai đều bắn request. Giữ promise thì người đến sau nhận
 * lại đúng promise đang bay.
 *
 * Cấu hình không đổi trong một phiên làm việc nên không có cơ chế làm mới. Đổi biến môi trường
 * thì phải tải lại trang, và điều đó đúng: các giá trị này được nhúng vào lúc khởi động server.
 */
let pending: Promise<AppConfig> | null = null;

export function loadAppConfig(): Promise<AppConfig> {
  if (!pending) {
    // Hỏng thì trả cấu hình rỗng thay vì ném lỗi. Thiếu một khoá tuỳ chọn KHÔNG được phép làm
    // hỏng cả trang — nút Google tự ẩn, bản đồ tự chuyển sang khối thay thế, phần còn lại chạy.
    pending = apiRequest<AppConfig>('/api/config').catch(() => EMPTY);
  }
  return pending;
}
