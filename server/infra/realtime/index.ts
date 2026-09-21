/**
 * TẦNG DỮ LIỆU ĐỘNG — cửa vào duy nhất cho tầng tác tử.
 *
 * `server/domain/agents/tools.ts` chỉ nên import từ file này, không import từng adapter. Nhờ vậy
 * việc đổi nhà cung cấp — Open-Meteo sang Google Weather, hay thêm một adapter khách sạn — không
 * lan ra tầng tác tử.
 *
 * Bốn tool đều cùng một chữ ký khái niệm: `(input) => Promise<ToolResult<T>>`, không ném exception
 * trong bất kỳ trường hợp nào, và không có nhánh nào trả dữ liệu suy đoán khi lỗi (DR-AGENT-08).
 *
 * MỘT NHÓM DỮ LIỆU CỐ TÌNH CHƯA CÓ Ở ĐÂY: tình trạng giao thông. Không có nguồn nào phủ địa bàn
 * này, nên tool tương ứng sẽ trả `UNSUPPORTED_REGION` tường minh khi được dựng, thay vì suy ra
 * tình trạng đường từ dữ liệu khác. Giá phòng thời gian thực cũng chưa có vì lý do độ phủ — phần
 * lớn homestay bản không nằm trong bất cứ API du lịch nào, nên nguồn chính cho địa bàn này là tồn
 * kho nội bộ.
 */

export type { ToolResult } from "@server/infra/realtime/toolResult";
export { ok, fail, classifyFetchError } from "@server/infra/realtime/toolResult";

export {
  CHAT_WEATHER_MAX_AGE_SECONDS, describeWeatherCode, getWeather, getWeatherAtCenter,
  hasDirectWeatherPoint,
} from "@server/infra/realtime/weather";
export type { WeatherReading, DailyForecast } from "@server/infra/realtime/weather";

export { getRoute } from "@server/infra/realtime/route";
export type { RouteInfo } from "@server/infra/realtime/route";

export { searchPlaces, getPlaceDetails, insideRegion } from "@server/infra/realtime/places";
export type { PlaceHit, PlaceDetail } from "@server/infra/realtime/places";

export { geocode } from "@server/infra/realtime/geocoding";
export type { GeocodeResult } from "@server/infra/realtime/geocoding";

export { sweepExpired as sweepRealtimeCache } from "@server/infra/realtime/cache";
