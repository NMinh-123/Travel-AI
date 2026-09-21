import { profileFor } from "@data/realtime/providers";
import { BROAD_PLACE_CENTERS, WEATHER_POINTS } from "@data/realtime/weather-points";
import type { WeatherPoint } from "@data/realtime/types";
import { findPlace } from "@data/places/index";
import { buildUrl, requestJson } from "@server/infra/realtime/http";
import { readCache, writeCache, cacheKey } from "@server/infra/realtime/cache";
import { fail, isFailure, ok, type ToolResult } from "@server/infra/realtime/toolResult";

/**
 * TOOL THỜI TIẾT — Open-Meteo, nội suy theo độ cao thật.
 *
 * VÌ SAO OPEN-METEO CHỨ KHÔNG PHẢI GOOGLE, dù dự án đã dùng Google cho bản đồ. Lý do duy nhất
 * đáng kể là tham số `elevation`. Địa hình ở đây dựng đứng: đỉnh Mã Pí Lèng và lòng sông Nho Quế
 * cách nhau chưa tới hai kilômét đường chim bay nhưng chênh hơn một nghìn mét độ cao. Một nhà
 * cung cấp lấy dự báo theo ô lưới mặt đất sẽ trả về cùng một con số cho cả hai chỗ, lệch vài độ
 * so với thực tế và bỏ qua sương mù đỉnh đèo — đúng thông tin quyết định việc có nên lái qua đèo
 * hay không. Truyền `elevation` vào là để dự báo được nội suy về đúng độ cao của điểm hỏi.
 *
 * BỎ THAM SỐ `elevation` LÀ LỖI IM LẶNG. API vẫn trả HTTP 200 kèm dữ liệu hợp lệ; chỉ là dữ liệu
 * của một độ cao khác. Không có exception, không có cảnh báo, và câu trả lời sai một cách tự tin.
 * Đó là lý do độ cao được khai tường minh cho từng điểm đo trong @data/realtime/weather-points
 * thay vì để adapter tự đoán.
 */

/** Tên nhà cung cấp dùng trong `source` và trong thông điệp lỗi. */
const PROVIDER = "open-meteo";

export interface WeatherReading {
  /** Nhãn điểm đo, để câu trả lời ghi rõ đo ở đâu và ở độ cao nào. */
  point: string;
  elevationM: number;
  tempC: number;
  feelsLikeC: number;
  humidityPercent: number;
  precipitationMm: number;
  precipitationProbabilityPercent: number | null;
  windSpeedKmh: number;
  windGustKmh: number | null;
  cloudCoverPercent: number;
  visibilityM: number | null;
  isDay: boolean;
  /** Mã thời tiết WMO. Giữ nguyên số để tầng trên tự diễn giải, không dịch ở đây. */
  weatherCode: number;
  /**
   * Đánh giá rủi ro khi lái, SUY LUẬN từ các số liệu trên.
   *
   * ĐÂY LÀ GIÁ TRỊ SUY LUẬN, không phải quan trắc. Ở giai đoạn G nó được đăng ký với
   * `sourceClass: "inference"`, và theo Mục 11.1.1.10 thì dữ kiện loại đó KHÔNG được đứng ở vị
   * trí một khẳng định về an toàn. Tác tử được phép nói "điều kiện hiện tại có sương mù và mưa,
   * nên cân nhắc", nhưng không được nói "đường an toàn" hay "đường không an toàn" dựa vào trường
   * này. Nó cũng không thay thế cảnh báo chính thức của cơ quan quản lý đường bộ.
   */
  ridingRisk: "low" | "moderate" | "high";
  /** Các yếu tố đã tạo nên `ridingRisk`, để câu trả lời nói được lý do thay vì chỉ nói mức. */
  riskFactors: string[];
  /**
   * Giờ quan trắc do CHÍNH NHÀ CUNG CẤP báo, dạng `YYYY-MM-DDTHH:mm` theo múi giờ đã yêu cầu.
   *
   * Tồn tại vì dấu thời gian dựa trên đồng hồ máy chủ không đáng tin: máy lệch giờ thì câu trả lời
   * báo một thời điểm sai cho số liệu hoàn toàn đúng, và khách không có cách nào biết. Giá trị này
   * đi cùng chính lô số liệu nên luôn khớp với nó.
   */
  observedAtLocal: string | null;
  /** Dự báo theo ngày, dùng cho câu hỏi về ngày mai hoặc cuối tuần. */
  daily: DailyForecast[];
}

export interface DailyForecast {
  /** YYYY-MM-DD theo giờ Việt Nam. */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationSumMm: number;
  precipitationProbabilityMaxPercent: number | null;
  weatherCode: number;
}

/**
 * Quy các số liệu thành mức rủi ro, bằng luật viết tường minh chứ không bằng một bảng số.
 *
 * Viết thành các câu `if` có tên gọi là chọn lựa có chủ đích: mỗi nhánh vừa quyết định mức, vừa
 * ghi lại LÝ DO vào `riskFactors`, nên câu trả lời cho khách nói được "sương mù dày và mưa" thay
 * vì "rủi ro cao". Một bảng trọng số cộng điểm sẽ gọn hơn nhưng mất hẳn phần lý do, và với nội
 * dung liên quan tới an toàn thì lý do quan trọng hơn con số.
 *
 * Các ngưỡng dưới đây là ngưỡng KHỞI ĐẦU dựa trên điều kiện lái xe máy đường đèo, chưa được đo
 * đối chiếu với dữ liệu tai nạn hay với đánh giá của người địa phương. Đừng trích chúng như kết
 * quả nghiên cứu.
 */
function assessRiding(input: {
  visibilityM: number | null;
  precipitationMm: number;
  windGustKmh: number | null;
  windSpeedKmh: number;
  tempC: number;
}): { risk: "low" | "moderate" | "high"; factors: string[] } {
  const factors: string[] = [];
  let level = 0;

  // Tầm nhìn là yếu tố nặng nhất trên đường đèo hẹp: không thấy trước khúc cua thì mọi yếu tố
  // khác thành thứ yếu. Dưới 200 m là mức mà xe ngược chiều chỉ hiện ra khi đã rất gần.
  if (input.visibilityM !== null) {
    if (input.visibilityM < 200) {
      factors.push("sương mù rất dày, tầm nhìn dưới 200 m");
      level = Math.max(level, 2);
    } else if (input.visibilityM < 1000) {
      factors.push("sương mù, tầm nhìn hạn chế");
      level = Math.max(level, 1);
    }
  }

  if (input.precipitationMm >= 4) {
    factors.push("đang mưa to, mặt đường trơn và tăng nguy cơ sạt lở");
    level = Math.max(level, 2);
  } else if (input.precipitationMm > 0.2) {
    factors.push("có mưa, mặt đường ướt");
    level = Math.max(level, 1);
  }

  const gust = input.windGustKmh ?? input.windSpeedKmh;
  if (gust >= 50) {
    factors.push("gió giật mạnh, dễ mất lái ở đoạn trống");
    level = Math.max(level, 2);
  } else if (gust >= 30) {
    factors.push("gió khá mạnh");
    level = Math.max(level, 1);
  }

  // Dưới 3 độ thì có khả năng đóng băng mặt đường ở các đỉnh đèo, hiện tượng đã xảy ra trong các
  // đợt rét đậm. Đây là lý do nhiệt độ có mặt trong đánh giá dù nó không ảnh hưởng trực tiếp tới
  // độ bám như mưa.
  if (input.tempC <= 3) {
    factors.push("nhiệt độ rất thấp, có thể có băng giá trên mặt đường đỉnh đèo");
    level = Math.max(level, 2);
  } else if (input.tempC <= 10) {
    factors.push("lạnh, cần giữ ấm tay để không mất cảm giác phanh");
    level = Math.max(level, 1);
  }

  if (!factors.length) factors.push("không có yếu tố thời tiết bất lợi đáng kể");
  return { risk: level >= 2 ? "high" : level === 1 ? "moderate" : "low", factors };
}

/**
 * Tìm điểm đo phục vụ một slug.
 *
 * Có bước LEO LÊN CHA khi slug không được điểm đo nào phục vụ trực tiếp. Cần bước này vì các thực
 * thể là cơ sở kinh doanh — quán ăn, homestay — cố tình không có điểm đo riêng: chúng nằm trong
 * cùng thung lũng với xã chứa chúng, nên hỏi thời tiết ở một homestay thì câu trả lời đúng là
 * thời tiết của xã đó. Mở điểm đo riêng cho từng homestay sẽ đốt hạn mức để nhận về cùng một dự
 * báo. Leo tối đa bốn cấp, đủ cho cây thực thể sâu nhất là tỉnh → vùng → xã → cơ sở.
 */
function resolvePoint(placeSlug: string): WeatherPoint | null {
  let slug: string | undefined = placeSlug;

  for (let depth = 0; depth < 4 && slug; depth += 1) {
    const hit = WEATHER_POINTS.find((point) => point.servesPlaceSlugs.includes(slug as string));
    if (hit) return hit;
    slug = findPlace(slug)?.parentSlug;
  }
  return null;
}

interface OpenMeteoResponse {
  current?: Record<string, number>;
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: (number | null)[];
    weather_code?: number[];
  };
}

/**
 * Lấy thời tiết hiện tại và dự báo cho một thực thể trong danh mục.
 *
 * `placeSlug` phải là slug trong @data/places. Không nhận toạ độ tự do: cho phép truyền toạ độ
 * là mở đường cho tác tử tự sinh toạ độ, mà một toạ độ sai vẫn trả về dữ liệu hợp lệ của chỗ
 * khác — loại lỗi không bao giờ ném exception.
 */
export async function getWeather(input: {
  placeSlug: string;
  /** Số ngày dự báo, 1–16. Mặc định 3. */
  forecastDays?: number;
  /** Xem `CHAT_WEATHER_MAX_AGE_SECONDS`. Bỏ trống thì nhận mọi bản còn trong hạn cache. */
  maxAgeSeconds?: number;
}): Promise<ToolResult<WeatherReading>> {
  const point = resolvePoint(input.placeSlug);

  if (!point) {
    return fail(
      "NOT_FOUND",
      `không có điểm đo thời tiết nào phục vụ "${input.placeSlug}"`,
      PROVIDER,
    );
  }

  return fetchAtPoint(point, input.forecastDays, input.maxAgeSeconds);
}

/**
 * ĐỘ TƯƠI TỐI ĐA MÀ LUỒNG CHAT CHẤP NHẬN — nửa giờ.
 *
 * Cache thời tiết sống một giờ, khớp nhịp làm mới nền của tab An toàn đèo. Nhưng hai chỗ dùng có
 * đòi hỏi khác nhau: tab là bảng tra cứu, số nửa tiếng trước vẫn dùng được; còn khi khách hỏi
 * thẳng "giờ trên đèo thế nào" thì một con số của 55 phút trước là câu trả lời sai về thực tại.
 *
 * Tách bằng hạn TUỔI ở phía người đọc chứ không bằng khoá cache riêng. Phần lớn thời gian hai
 * đường vốn đã không giẫm lên nhau vì khoá cache có `forecastDays` trong đó, mà tab luôn hỏi 1
 * ngày còn chat hỏi theo mốc khách nêu. Hạn tuổi này là để phòng đúng lúc chúng trùng: khi ấy
 * chat vẫn không nhận một bản đã nằm đó 45 phút, còn tab thì nhận — và lượt gọi lại của chat làm
 * mới luôn bản chung, không sinh thêm mục cache thứ hai cho cùng một cấu hình.
 */
export const CHAT_WEATHER_MAX_AGE_SECONDS = 1800;

/** Bản cache này có đủ tươi cho người đọc đang yêu cầu không. */
function freshEnough(retrievedAt: string, maxAgeSeconds?: number): boolean {
  if (maxAgeSeconds === undefined) return true;
  const stamp = Date.parse(retrievedAt);
  if (!Number.isFinite(stamp)) return false;
  return Date.now() - stamp <= maxAgeSeconds * 1000;
}

/**
 * Hỏi nhà cung cấp cho MỘT điểm đo đã xác định.
 *
 * Tách khỏi `getWeather` vì có hai đường vào khác nhau: một là từ slug của khách, hai là từ bộ
 * điểm trung tâm của thực thể diện rộng (`BROAD_PLACE_CENTERS`) — đường thứ hai đã biết sẵn điểm nên
 * không có slug nào để phân giải. Phần gọi mạng, đọc cache và dựng bản ghi thì giống hệt nhau.
 */
async function fetchAtPoint(
  point: WeatherPoint,
  requestedDays?: number,
  maxAgeSeconds?: number,
): Promise<ToolResult<WeatherReading>> {
  const profile = profileFor("weather");
  const forecastDays = Math.min(Math.max(requestedDays ?? 3, 1), 16);
  const params = {
    latitude: point.lat,
    longitude: point.lng,
    // Tham số quyết định của cả adapter này. Xem khối chú thích ở đầu file.
    elevation: point.elevationM,
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code," +
      "cloud_cover,visibility,wind_speed_10m,wind_gusts_10m,is_day",
    daily:
      "temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code",
    hourly: "precipitation_probability",
    forecast_days: forecastDays,
    timezone: "Asia/Bangkok",
  };

  const key = cacheKey("weather", { point: point.id, forecastDays });
  const cached = await readCache<WeatherReading>(key);
  if (cached && freshEnough(cached.retrievedAt, maxAgeSeconds)) {
    return ok(cached.payload, cached.source, { cached: true, retrievedAt: cached.retrievedAt });
  }

  const url = buildUrl(profile.baseUrl, "/v1/forecast", params);
  const response = await requestJson<OpenMeteoResponse>(url, profile);
  if (isFailure(response)) return response;

  const current = response.data.current ?? {};
  const daily = response.data.daily ?? {};

  const visibilityM = typeof current.visibility === "number" ? current.visibility : null;
  const windGustKmh = typeof current.wind_gusts_10m === "number" ? current.wind_gusts_10m : null;
  const tempC = current.temperature_2m ?? 0;
  const precipitationMm = current.precipitation ?? 0;
  const windSpeedKmh = current.wind_speed_10m ?? 0;

  const assessment = assessRiding({
    visibilityM,
    precipitationMm,
    windGustKmh,
    windSpeedKmh,
    tempC,
  });

  const dailyOut: DailyForecast[] = (daily.time ?? []).map((date, index) => ({
    date,
    tempMinC: daily.temperature_2m_min?.[index] ?? 0,
    tempMaxC: daily.temperature_2m_max?.[index] ?? 0,
    precipitationSumMm: daily.precipitation_sum?.[index] ?? 0,
    precipitationProbabilityMaxPercent: daily.precipitation_probability_max?.[index] ?? null,
    weatherCode: daily.weather_code?.[index] ?? 0,
  }));

  // `current.time` là chuỗi, còn `current` được khai là Record<string, number> cho các số đo. Ép
  // kiểu tại chỗ thay vì nới kiểu cả bản ghi, để các phép đọc số còn lại không thành number | string.
  const observedAtLocal = (response.data.current as { time?: string } | undefined)?.time ?? null;

  const reading: WeatherReading = {
    point: point.label,
    observedAtLocal,
    elevationM: point.elevationM,
    tempC,
    feelsLikeC: current.apparent_temperature ?? tempC,
    humidityPercent: current.relative_humidity_2m ?? 0,
    precipitationMm,
    precipitationProbabilityPercent: dailyOut[0]?.precipitationProbabilityMaxPercent ?? null,
    windSpeedKmh,
    windGustKmh,
    cloudCoverPercent: current.cloud_cover ?? 0,
    visibilityM,
    isDay: current.is_day === 1,
    weatherCode: current.weather_code ?? 0,
    ridingRisk: assessment.risk,
    riskFactors: assessment.factors,
    daily: dailyOut,
  };

  await writeCache(key, "weather", reading, PROVIDER, profile.ttlSeconds);
  return ok(reading, PROVIDER, { cached: false });
}

/**
 * Slug này có điểm đo phục vụ TRỰC TIẾP hay không — không lùi lên cha.
 *
 * Dùng để xếp thứ tự ứng viên trước khi gọi tool. Trước đây chỗ gọi tự đoán mức "rộng/hẹp" theo
 * `kind` của Place, và đoán sai ở đúng ca hay gặp nhất: `cao-nguyen-da-dong-van` khai
 * `kind: "landmark"` nên bị coi là cụ thể và được thử trước, còn `dong-van` khai
 * `kind: "region"` nên bị đẩy xuống sau — ngược hẳn với thực tế, vì chỉ thị trấn mới có điểm đo.
 * Hỏi thẳng bảng điểm đo thì không còn chỗ cho phỏng đoán.
 */
export function hasDirectWeatherPoint(placeSlug: string): boolean {
  return WEATHER_POINTS.some((point) => point.servesPlaceSlugs.includes(placeSlug));
}

/**
 * Thời tiết ở điểm trung tâm của một thực thể trải quá rộng để có điểm đo riêng.
 *
 * `null` nghĩa là thực thể này không có điểm trung tâm nào được khai — khác hẳn với "gọi được
 * nhưng nhà cung cấp hỏng", nên chỗ gọi phân biệt được hai tình huống và không báo nhầm lỗi
 * mạng cho một chuyện chỉ là thiếu khai báo.
 */
export async function getWeatherAtCenter(
  placeSlug: string,
  forecastDays?: number,
  maxAgeSeconds?: number,
): Promise<ToolResult<WeatherReading> | null> {
  const pointId = BROAD_PLACE_CENTERS[placeSlug];
  if (!pointId) return null;

  const point = WEATHER_POINTS.find((candidate) => candidate.id === pointId);
  if (!point) return null;

  return fetchAtPoint(point, forecastDays, maxAgeSeconds);
}

/**
 * Mã thời tiết WMO -> mô tả tiếng Việt.
 *
 * Bảng này nằm trong mã chứ không để model tự diễn giải, vì "nắng đẹp" hay "mưa to" là phần
 * khách nhớ nhất trong câu trả lời và nó phải đến từ mã chính thức của nhà cung cấp. Suy ra
 * trạng thái bầu trời từ mấy con số rời (mây %, mưa mm) là chỗ model rất dễ nói quá lên.
 */
export function describeWeatherCode(code: number): string {
  const table: Record<number, string> = {
    0: "trời quang",
    1: "trời gần như quang",
    2: "có mây rải rác",
    3: "trời nhiều mây",
    45: "sương mù",
    48: "sương mù đóng băng",
    51: "mưa phùn nhẹ",
    53: "mưa phùn",
    55: "mưa phùn dày",
    56: "mưa phùn lạnh giá",
    57: "mưa phùn lạnh giá dày",
    61: "mưa nhỏ",
    63: "mưa vừa",
    65: "mưa to",
    66: "mưa lạnh giá",
    67: "mưa lạnh giá nặng hạt",
    71: "tuyết rơi nhẹ",
    73: "tuyết rơi",
    75: "tuyết rơi dày",
    77: "hạt tuyết",
    80: "mưa rào nhẹ",
    81: "mưa rào",
    82: "mưa rào rất to",
    85: "mưa tuyết nhẹ",
    86: "mưa tuyết dày",
    95: "dông",
    96: "dông kèm mưa đá nhẹ",
    99: "dông kèm mưa đá",
  };
  return table[code] ?? "không rõ trạng thái";
}
