/**
 * HỒ SƠ NHÀ CUNG CẤP — mỗi nhóm dữ liệu động một dòng, kèm hạn sống của dữ liệu đó.
 *
 * File này chỉ khai báo. Không có `process.env`, không có nhánh rẽ theo cấu hình, không có một
 * lượt gọi mạng nào — đúng ranh giới mà @data/README.md đặt ra cho cả thư mục `data/`. Adapter ở
 * `server/infra/realtime/` đọc bảng này rồi mới quyết định gọi gì; nếu bảng tự đọc biến môi
 * trường thì cùng một file nội dung sẽ cho ra hai giá trị khác nhau ở hai máy, và không ai soát
 * được nó bằng git diff nữa.
 *
 * TTL ĐƯỢC CHỌN THEO TỐC ĐỘ THAY ĐỔI CỦA SỰ THẬT, KHÔNG THEO CHI PHÍ GỌI API. Bốn con số dưới
 * đây chênh nhau tới 1.440 lần, và khoảng cách đó phản ánh đúng bản chất từng loại dữ liệu:
 *
 * - Thời tiết 30 phút. Sương mù đỉnh đèo hình thành và tan trong vòng một giờ; một bản dự báo
 *   90 phút tuổi nói "trời quang" ở Mã Pí Lèng là thứ khách sẽ tin rồi mới lên đèo.
 * - Cung đường 24 giờ. Hình học đường và thời gian di chuyển trung bình gần như đứng yên theo
 *   ngày. Cái thay đổi nhanh — sạt lở, chặn đường sửa chữa — thì Routes API cũng không biết,
 *   nên rút TTL xuống không mua thêm được độ chính xác, chỉ đốt hạn mức.
 * - Tìm địa điểm 7 ngày. Một quán ăn mở hay đóng, đổi giờ, đổi tên là chuyện của hàng tuần chứ
 *   không phải hàng giờ. Đây cũng là nhóm đắt nhất trong ba SKU của Google, nên TTL dài vừa đúng
 *   về mặt dữ liệu vừa đúng về mặt hoá đơn.
 * - Geocoding 30 ngày. Ánh xạ tên → toạ độ gần như bất biến; nó chỉ đổi khi có đợt sắp xếp hành
 *   chính, và đợt gần nhất là 01/7/2025 — loại sự kiện tính bằng năm, không tính bằng ngày.
 *
 * QUY TẮC CỨNG: CACHE HẾT HẠN KHÔNG ĐƯỢC PHỤC VỤ. Theo Mục 11.1.1.11, bản ghi quá hạn bị coi như
 * không tồn tại; truy vấn cache luôn kèm `expires_at > now()` chứ không trông vào việc bộ trục
 * xuất đã kịp chạy hay chưa. Hết hạn thì gọi lại; gọi lại hỏng thì trả `ToolErrorCode` và để tác
 * tử nói thẳng là chưa tra được.
 *
 * Cám dỗ ở đây rất lớn và phải gọi tên ra để về sau không ai "sửa cho thân thiện hơn": khi lượt
 * gọi mới thất bại, phục vụ bản cũ trông có vẻ tử tế hơn là báo lỗi. Nhưng bản cũ không tự khai
 * là cũ. Khách nhận được một dự báo thời tiết hôm qua mà tưởng là hôm nay, và cái sai đó không
 * hiện ra ở bất kỳ đâu trong câu trả lời. Một câu "hiện chưa tra được thời tiết Mã Pí Lèng" thì
 * khách còn tự đi hỏi chỗ khác; một con số sai thì khách tin và đi luôn.
 */

import type { ProviderProfile, RealtimeTool } from "./types";

/**
 * Bảng mặc định: đúng một hồ sơ cho mỗi giá trị của `RealtimeTool`.
 *
 * Ràng buộc "đúng một" là ràng buộc thật chứ không phải quy ước cho đẹp — `profileFor` ở cuối
 * file tra bằng `find`, nên khai trùng `tool` thì bản thứ hai im lặng không bao giờ được dùng.
 */
export const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    tool: "weather",
    provider: "open-meteo",
    baseUrl: "https://api.open-meteo.com",
    // Nhà cung cấp duy nhất trong bảng không cần khoá. Đây không phải tiện thể mà là một tiêu chí
    // chọn: thiếu khoá thì công cụ thời tiết vẫn chạy được ngay sau khi clone repo, nên người mới
    // vào dự án không phải dựng tài khoản billing chỉ để thử một câu hỏi.
    apiKeyEnv: null,
    /**
     * Một giờ, khớp với nhịp làm mới nền của tab An toàn đèo
     * (@server/infra/realtime/passWeatherRefresh). Hai con số này phải bằng nhau: TTL ngắn hơn
     * nhịp làm mới thì giữa hai lượt nền sẽ có quãng cache rỗng, và người mở tab đúng lúc đó
     * lại phải ngồi chờ sáu lời gọi mạng — đúng thứ mà tác vụ nền sinh ra để tránh.
     *
     * Trước là 1800. Đổi lên đồng nghĩa số đo trong câu trả lời của trợ lý có thể cũ tới một
     * giờ; với nhiệt độ và gió trên cao nguyên thì sai số đó nhỏ hơn nhiều so với lợi ích của
     * việc không gọi lại API mỗi nửa giờ cho cùng một điểm.
     */
    ttlSeconds: 3600,
    timeoutMs: 4000,
    maxRetries: 1,
    attribution: "Dự báo từ Open-Meteo",
  },
  {
    tool: "route",
    provider: "google-routes",
    baseUrl: "https://routes.googleapis.com",
    // Cùng một khoá cho cả ba API của Google. Xem .env.example: khoá này phải là khoá RIÊNG của
    // server, có API restrictions và quota cap — một tác tử lỗi logic gọi trong vòng lặp đốt hạn
    // mức nhanh hơn bất kỳ ai kịp nhận ra.
    apiKeyEnv: "GOOGLE_MAPS_API_KEY",
    ttlSeconds: 86400,
    timeoutMs: 4000,
    maxRetries: 1,
    // Điều khoản của Google Maps Platform buộc ghi nguồn khi hiển thị dữ liệu của họ, nên câu này
    // là nghĩa vụ pháp lý chứ không phải phép lịch sự.
    attribution: "Dữ liệu tuyến đường từ Google Maps Platform",
  },
  {
    tool: "place_search",
    provider: "google-places",
    baseUrl: "https://places.googleapis.com",
    apiKeyEnv: "GOOGLE_MAPS_API_KEY",
    ttlSeconds: 604800,
    timeoutMs: 4000,
    maxRetries: 1,
    attribution: "Thông tin địa điểm từ Google Maps Platform",
  },
  {
    tool: "geocode",
    provider: "google-geocoding",
    // Geocoding vẫn nằm trên host cũ `maps.googleapis.com`, khác hai API kia đã tách sang host
    // riêng. Ghi đúng ở đây để adapter khỏi đoán và khỏi phải nhớ ngoại lệ này.
    baseUrl: "https://maps.googleapis.com",
    apiKeyEnv: "GOOGLE_MAPS_API_KEY",
    ttlSeconds: 2592000,
    timeoutMs: 4000,
    maxRetries: 1,
    attribution: "Toạ độ từ Google Maps Platform",
  },
];

/**
 * Hồ sơ thay thế cho công cụ thời tiết, bật bằng biến môi trường `WEATHER_PROVIDER="google"`.
 *
 * VÌ SAO MẶC ĐỊNH VẪN LÀ OPEN-METEO DÙ DỰ ÁN ĐÃ TRẢ TIỀN CHO GOOGLE. Lý do là địa hình, không
 * phải chi phí. Open-Meteo nhận tham số `elevation` và nội suy dự báo theo độ cao THẬT của điểm
 * đo; đó là lý do `WeatherPoint.elevationM` tồn tại và là trường bắt buộc. Trên địa bàn này
 * chênh lệch độ cao là toàn bộ vấn đề: các đèo trong hành trình nằm ở 1.500–2.000 m còn thị trấn
 * dưới chân đèo ở 300–900 m, và lòng sông Nho Quế chỉ 270 m ngay dưới đỉnh Mã Pí Lèng 1.500 m.
 * Dự báo lấy theo ô lưới mặt đất sẽ san phẳng chênh lệch ấy thành một con số trung bình đúng cho
 * không chỗ nào — lệch vài độ, và quan trọng hơn là bỏ qua sương mù đỉnh đèo, thứ ảnh hưởng
 * trực tiếp tới an toàn khi lái chứ không phải chi tiết trang trí.
 *
 * Đổi sang Google là hợp lý khi muốn gom về một nhà cung cấp duy nhất cho dễ vận hành. Nhưng độ
 * phủ và độ chi tiết của Google Weather API ở vùng núi phía Bắc CHƯA được đo trên dự án này, nên
 * hãy đối chiếu vài điểm chênh cao trước khi chốt, đừng đổi vì lý do gọn gàng.
 *
 * TTL giữ nguyên 30 phút: đổi nhà cung cấp không làm sương mù tan chậm lại.
 */
export const WEATHER_PROVIDER_ALTERNATIVE: ProviderProfile = {
  tool: "weather",
  provider: "google-weather",
  baseUrl: "https://weather.googleapis.com",
  apiKeyEnv: "GOOGLE_MAPS_API_KEY",
  ttlSeconds: 1800,
  timeoutMs: 4000,
  maxRetries: 1,
  attribution: "Dự báo từ Google Weather API",
};

/**
 * Lấy hồ sơ mặc định của một công cụ.
 *
 * Hàm này CỐ TÌNH không đọc `WEATHER_PROVIDER`. Việc chọn giữa Open-Meteo và Google là quyết
 * định của adapter — nơi đã có sẵn cấu hình, có logging và có chỗ báo `PROVIDER_NOT_CONFIGURED`
 * khi thiếu khoá. Kéo nhánh rẽ đó xuống đây thì `data/` mất tính chất "cùng một file cho ra cùng
 * một giá trị ở mọi máy", và một hàm thuần đang trả về hằng số bỗng phụ thuộc vào thứ tự nạp
 * biến môi trường.
 *
 * Ném lỗi thay vì trả `undefined` vì thiếu hồ sơ là lỗi lập trình, không phải tình huống chạy:
 * `RealtimeTool` là union đóng, nên trường hợp duy nhất dẫn tới đây là ai đó thêm một giá trị
 * vào union mà quên thêm dòng tương ứng vào bảng. Trả `undefined` thì lỗi ấy trôi xuống tận
 * adapter rồi hiện ra dưới dạng "không đọc được thuộc tính của undefined" ở một chỗ chẳng liên
 * quan gì; ném ở đây thì thông báo chỉ thẳng vào chỗ phải sửa.
 */
export function profileFor(tool: RealtimeTool): ProviderProfile {
  const profile = PROVIDER_PROFILES.find((item) => item.tool === tool);
  if (!profile) {
    throw new Error(
      `Thiếu hồ sơ nhà cung cấp cho công cụ "${tool}". Hãy bổ sung một mục vào PROVIDER_PROFILES trong data/realtime/providers.ts.`,
    );
  }
  return profile;
}
