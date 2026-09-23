import { GROUNDED_CHAT_RESPONSE_SCHEMA } from "@server/domain/prompts";
import { describeTemporal } from "@server/domain/temporal/router";
import type { TemporalContext } from "@server/domain/temporal/types";
import { cleanStringList } from "@server/infra/gemini";
import { retrieve } from "@server/domain/rag/retrieval";
import { expandPlaceTree, placeKinds } from "@server/domain/rag/places";
import { domainSignals, entityTypeSignals, seasonSignals } from "@server/domain/rag/signals";
import {
  CHAT_WEATHER_MAX_AGE_SECONDS, describeWeatherCode, getWeather, getWeatherAtCenter,
  hasDirectWeatherPoint,
} from "@server/infra/realtime/index";
import type { WeatherReading } from "@server/infra/realtime/index";
import { isFailure } from "@server/infra/realtime/toolResult";
import type { AgentContext, AgentResult, ToolCallTrace } from "@server/domain/agents/types";
import {
  checkClaimCoverage, checkNumericFacts, resolveGrounding, resolveToolStatus, summarizeCoverage,
  verifyCitations, type Citation, type EvidenceBlock,
} from "@server/domain/agents/grounding";
import type { ToolErrorCode } from "@data/realtime/types";
import { formatHistory, generateReply, personaFor } from "./shared";

/**
 * Tác tử giới thiệu địa danh & FAQ — FR-BOT-01 và FR-BOT-05. Đây là tác tử duy nhất dùng RAG.
 *
 * Ranh giới của SRS Mục 11.4: RAG chỉ phục vụ tri thức dạng văn bản đã kiểm duyệt (chính sách,
 * thủ tục, FAQ, mô tả điểm đến). Số liệu thời tiết đèo KHÔNG đi qua RAG mà lấy trực tiếp qua tool
 * layer, vì đó là dữ liệu có thể đổi và phải luôn tươi.
 *
 * Khi KHÔNG CÒN CĂN CỨ NÀO, tác tử không gọi model: trả `grounding: "no_source"` để orchestrator chuyển
 * tiếp, đúng trigger "câu hỏi nằm ngoài phạm vi kho tri thức" của Mục 10.6. Đây là chỗ ngăn "ảo
 * giác" hiệu quả nhất trong toàn hệ thống — không có căn cứ thì không nói.
 *
 * "Không còn căn cứ nào" nghĩa là KHÔNG có đoạn tri thức VÀ cũng KHÔNG có số liệu thời tiết. Phân
 * biệt này quan trọng và từng bị làm sai: bản trước chuyển tiếp ngay khi hybrid search rỗng, nên
 * câu "Hôm nay thời tiết Đồng Văn thế nào" bị từ chối dù `getWeather` lấy được số liệu của đúng
 * chỗ đó. Một số đo tự nó đã là căn cứ; nó không cần một đoạn văn bản nào chống lưng.
 */

const WEATHER_HINTS = /thời tiết|thoi tiet|sương|suong|mưa|mua|nhiệt độ|nhiet do|lạnh|gió|gio|mù/i;

/**
 * Lấy số liệu thời tiết THẬT cho địa danh khách hỏi.
 *
 * Trước đây chỗ này chèn bảng `PassWeather` tĩnh từ database, và đó là một lỗi có hậu quả thật:
 * một bảng số cố định được trình bày cho khách như tình hình hiện tại. Ca thử "Hôm nay thời tiết
 * Đồng Văn thế nào" phơi ra cả hai mặt của lỗi đó — bảng tĩnh không có dòng nào cho thị trấn Đồng
 * Văn, nên model không có căn cứ, trả lời rỗng, và guardrail chuyển tiếp cả lượt. Khách nhận
 * "mình chưa xử lý được" trong khi Open-Meteo trả về số liệu của đúng chỗ đó trong một giây.
 *
 * Nay dữ liệu đến từ `getWeather`, gọi Open-Meteo với ĐÚNG ĐỘ CAO của điểm đo. Điều này quan
 * trọng ở địa hình này: lòng sông Nho Quế và đỉnh Mã Pí Lèng cách nhau chưa tới hai kilômét đường
 * chim bay nhưng chênh hơn một nghìn mét, và đo được chênh khoảng bảy độ giữa hai nơi.
 *
 * KHI TOOL HỎNG THÌ NÓI LÀ HỎNG. Hàm này không bao giờ quay về bảng tĩnh để lấp chỗ trống — đó
 * đúng là hành vi mà DR-AGENT-08 cấm. Nó trả về một khối chỉ thị cho model nói thẳng là chưa tra
 * được, và như vậy khách biết mình đang không có số liệu thay vì đọc một con số cũ.
 */
/** `2026-09-10` -> `10/09/2026`. Khách đọc ngày kiểu Việt, không đọc ISO. */
function formatVnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * `2026-09-10T12:15` -> `12:15 ngày 10/09`.
 *
 * Nhận chuỗi giờ ĐỊA PHƯƠNG của nhà cung cấp chứ không nhận ISO UTC, nên không dựng `Date` và
 * không quy đổi múi giờ — mọi phép quy đổi ở đây đều phải mượn đồng hồ máy, thứ vừa chứng minh
 * là không đáng tin.
 */
function formatVnClock(local: string): string {
  const [date, time] = local.split("T");
  return `${(time ?? "").slice(0, 5)} ngày ${formatVnDate(date).slice(0, 5)}`;
}
/**
 * Xếp các slug ứng viên: nơi CÓ ĐIỂM ĐO ĐỨNG TRƯỚC.
 *
 * Cần thiết vì hai nguồn phân giải địa danh trả về hai MỨC khác nhau cho cùng một chữ: "Đồng Văn"
 * ra `cao-nguyen-da-dong-van` (vùng bốn xã) qua NLU, và `dong-van` (thị trấn) qua quét chuỗi. Điểm
 * đo thời tiết luôn gắn với nơi cụ thể, còn `resolvePoint` chỉ lùi LÊN cha chứ không xuống con —
 * nên hễ vùng đứng trước là tra cứu hỏng dù thị trấn ngay trong vùng đó có số liệu.
 *
 * Bản trước đoán mức "rộng/hẹp" qua `kind` của Place và đoán sai ở đúng ca vừa kể:
 * `cao-nguyen-da-dong-van` khai `kind: "landmark"` nên được coi là cụ thể và thử trước, còn
 * `dong-van` khai `kind: "region"` nên bị đẩy xuống sau. Lượt tra cứu vẫn ra kết quả nhờ vòng
 * thử tiếp, nhưng mỗi câu hỏi phải đốt thêm một lần gọi chắc chắn hỏng. Hỏi thẳng bảng điểm đo
 * thì không còn chỗ cho phỏng đoán.
 */
function rankForWeather(slugs: string[]): string[] {
  const rank = (slug: string): number => (hasDirectWeatherPoint(slug) ? 0 : 1);
  // Array.sort ổn định, nên các slug cùng mức giữ nguyên thứ tự orchestrator đã gộp.
  return [...slugs].sort((a, b) => rank(a) - rank(b));
}

export function weatherFailureBlock(code: ToolErrorCode): string {
  return `\n\nTHỜI TIẾT THỜI GIAN THỰC: KHÔNG TRA ĐƯỢC (mã lỗi ${code}).\n` +
    `Hãy nói thẳng với khách rằng hiện chưa tra được thời tiết cho nơi này và đừng suy đoán bất ` +
    `kỳ con số nào. Có thể gợi ý khách kiểm tra lại sau ít phút.`;
}

/**
 * Nhãn mức rủi ro bằng tiếng Việt.
 *
 * Khối dữ liệu gửi cho model là văn bản, nên mọi chuỗi trong đó đều có thể bị chép thẳng vào câu
 * trả lời — và đã bị: một lượt thử trả về "được đánh giá là 'moderate'" cho khách đọc. Dịch tại
 * nguồn thì không còn gì để chép nhầm.
 */
const RISK_LABELS: Record<WeatherReading["ridingRisk"], string> = {
  low: "thuận lợi",
  moderate: "cần cân nhắc",
  high: "nhiều bất lợi",
};


const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = [
  "Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy",
];

/** Trần dự báo của Open-Meteo. Hỏi xa hơn thì không có số đo nào để mà trả lời. */
const MAX_FORECAST_DAYS = 16;
/** Hôm nay + ngày mai: đủ cho câu hỏi về hiện tại, cũng là hành vi cũ của tool. */
const DEFAULT_FORECAST_DAYS = 2;
/** Quá mốc này thì dự báo bắt đầu kém tin, và câu trả lời phải nói ra điều đó. */
const FAR_FORECAST_DAYS = 7;

function dayDiff(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / DAY_MS);
}

/**
 * Số ngày dự báo cần lấy để phủ tới ngày khách hỏi; `null` nghĩa là câu hỏi nằm ngoài tầm dự báo.
 *
 * Trước đây chỗ gọi khoá cứng 2 ngày, nên "cuối tuần này thời tiết Đồng Văn thế nào" nhận về
 * đúng hôm nay và ngày mai: bộ quy đổi thời gian đã tính ra 19–20/09 nhưng không ai đọc kết quả
 * đó, và model chỉ có trong tay hai ngày sai để mà trình bày.
 *
 * `null` quan trọng không kém con số. Khách hỏi "tháng 11 thời tiết thế nào" thì không có dự báo
 * nào với tới, và lấy số đo hôm nay gán cho tháng 11 chính là kiểu sai mà cả tầng công cụ này
 * được dựng để tránh — thà không có khối thời tiết, để câu trả lời dựa vào tri thức mùa vụ.
 */
function forecastDaysFor(temporal?: TemporalContext): number | null {
  if (!temporal) return DEFAULT_FORECAST_DAYS;

  const target = temporal.travelDateRange?.end ?? temporal.travelDate;
  if (!target) {
    // Chỉ biết tháng: đúng tháng đang diễn ra thì số đo hôm nay vẫn nói được điều gì đó về nơi
    // khách sắp tới; tháng khác thì không.
    const sameMonth =
      temporal.travelMonth === Number(temporal.queryDate.slice(5, 7)) &&
      temporal.travelYear === Number(temporal.queryDate.slice(0, 4));
    return sameMonth ? DEFAULT_FORECAST_DAYS : null;
  }

  const span = dayDiff(temporal.queryDate, target);
  if (span === null) return DEFAULT_FORECAST_DAYS;
  if (span + 1 > MAX_FORECAST_DAYS) return null;
  return Math.min(Math.max(span + 1, DEFAULT_FORECAST_DAYS), MAX_FORECAST_DAYS);
}

/** Ngày này có nằm trong khoảng khách hỏi không. */
function isAskedDate(date: string, temporal?: TemporalContext): boolean {
  if (!temporal) return false;
  if (temporal.travelDate) return date === temporal.travelDate;
  const range = temporal.travelDateRange;
  return Boolean(range && date >= range.start && date <= range.end);
}

/**
 * Nhãn cho một ngày trong bảng dự báo.
 *
 * Mốc so sánh là `queryDate` của bộ quy đổi thời gian, hoặc `daily[0]` khi không có — theo hợp
 * đồng của Open-Meteo thì phần tử đầu luôn là hôm nay tại `Asia/Bangkok`. Mọi phép tính đều ở
 * UTC và không mượn đồng hồ máy: bản đầu của hàm này so với `new Date()` và dán sai cả bảng khi
 * đồng hồ máy chạy nhanh 14 giờ.
 */
function labelForDate(date: string, today: string): string {
  const diff = dayDiff(today, date);
  if (diff === 0) return "hôm nay";
  if (diff === 1) return "ngày mai";
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) ? WEEKDAY_LABELS[new Date(stamp).getUTCDay()] : "";
}

/**
 * Một điểm đo đã có số liệu -> khối văn bản mô tả nó.
 *
 * Tách ra vì cùng một định dạng phải dùng cho hai đường: một điểm khi khách hỏi đúng một nơi, và
 * điểm trung tâm khi khách hỏi cả vùng.
 */
function describeReading(
  w: WeatherReading,
  source: string,
  cached: boolean,
  temporal?: TemporalContext,
): string {
  const today = temporal?.queryDate ?? w.daily[0]?.date ?? "";
  const daily = w.daily
    .map((d) => {
      const label = labelForDate(d.date, today);
      const asked = isAskedDate(d.date, temporal) ? "   <- KHÁCH HỎI NGÀY NÀY" : "";
      return (
        `  - ${formatVnDate(d.date)}${label ? ` (${label})` : ""}: ` +
        `${d.tempMinC}–${d.tempMaxC}°C, ${describeWeatherCode(d.weatherCode)}, ` +
        `mưa ${d.precipitationSumMm} mm${asked}`
      );
    })
    .join("\n");

  const observed = w.observedAtLocal
    ? `, số liệu quan trắc lúc ${formatVnClock(w.observedAtLocal)}`
    : "";

  return (
    `Điểm đo: ${w.point}\n` +
    `Trạng thái: ${describeWeatherCode(w.weatherCode)}\n` +
    `Hiện tại: ${w.tempC}°C (cảm nhận ${w.feelsLikeC}°C), độ ẩm ${w.humidityPercent}%, ` +
    `mây ${w.cloudCoverPercent}%, mưa ${w.precipitationMm} mm, gió ${w.windSpeedKmh} km/h` +
    (w.visibilityM !== null ? `, tầm nhìn ${w.visibilityM} m` : "") +
    `\nDự báo:\n${daily}\n` +
    `Nguồn: ${source}${observed} (giờ Việt Nam)` +
    (cached ? " (từ cache còn hạn)" : "") +
    `.\n` +
    `ĐÁNH GIÁ ĐIỀU KIỆN ĐI LẠI (giá trị SUY LUẬN từ các số đo trên, không phải cảnh báo chính ` +
    `thức): ${RISK_LABELS[w.ridingRisk]} — ${w.riskFactors.join("; ")}.`
  );
}

/**
 * Chỉ dẫn cách trình bày, đi kèm mọi khối thời tiết.
 *
 * Khách hỏi thời tiết thì thứ họ cần ngay là một câu: bao nhiêu độ, trời thế nào, có nên lên
 * đường không. Bảng số đầy đủ vẫn giữ ở dưới cho ai muốn đọc kỹ, nhưng nó không được đứng trước.
 *
 * Ranh giới giữ nguyên theo Mục 11.1.1.10: `ridingRisk` là suy luận, nên câu khuyến nghị được
 * phép nói về ĐIỀU KIỆN quan trắc ("trời quang, thuận cho việc đi lại ngắm cảnh") nhưng không
 * được tuyên bố đường an toàn hay không an toàn.
 *
 * Khuyến nghị KHÔNG bó hẹp ở việc lái xe. Thời tiết quyết định cả những thứ khách tới đây để
 * làm: đi thuyền trên sông Nho Quế, dừng chụp ảnh ở điểm ngắm, đi bộ vào bản. Bản đầu của khối
 * này chỉ nói về "việc đi lại", nên một ngày trời quang ở hẻm Tu Sản cũng chỉ nhận được câu
 * "thuận cho việc di chuyển" — đúng nhưng bỏ phí thứ khách quan tâm hơn.
 */
const WEATHER_FORMAT_HINT =
  `\nCÁCH TRẢ LỜI PHẦN THỜI TIẾT:\n` +
  `- Mở đầu bằng ĐÚNG MỘT dòng tóm tắt theo mẫu: "Thời tiết <nơi>: <nhiệt độ>°C, <trạng thái>, ` +
  `<khuyến nghị ngắn>". Khuyến nghị nói về việc khách làm được gì với thời tiết đó — đi lại, ` +
  `ngắm cảnh, chụp ảnh, hay một hoạt động cụ thể của chính nơi ấy. Ví dụ: "Thời tiết Đồng Văn: ` +
  `24,5°C, trời quang, thuận cho việc di chuyển và ngắm cảnh."; "Thời tiết sông Nho Quế: 27°C, ` +
  `trời quang, hợp để đi thuyền và chụp ảnh hẻm vực."; "Thời tiết đỉnh Mã Pí Lèng: 18°C, sương ` +
  `mù, tầm nhìn ngắn nên cân nhắc lùi giờ qua đèo và khó chụp được cảnh."\n` +
  `- Khuyến nghị phải bám vào số đo và vào ĐÁNH GIÁ ĐIỀU KIỆN ĐI LẠI ở trên. Được phép gắn với ` +
  `hoạt động cụ thể (đi thuyền, chụp ảnh, đi bộ bản làng, chợ phiên...) NHƯNG chỉ những hoạt ` +
  `động có trong phần tri thức và điểm đến được cung cấp ở trên — không tự nghĩ ra hoạt động ` +
  `mới, và không hứa thay dịch vụ: dữ liệu ở đây không nói bến thuyền hay chợ hôm đó có mở không.\n` +
  `- KHÔNG được tuyên bố đường an toàn hay không an toàn — chỉ nói về điều kiện để khách tự cân nhắc.\n` +
  `- Không chép nguyên các nhãn kỹ thuật trong khối dữ liệu vào câu trả lời; viết bằng lời thường.\n` +
  `- Sau dòng tóm tắt mới tới các chỉ số chi tiết và dự báo, viết gọn.\n` +
  `- Khách hỏi một ngày cụ thể (dòng dự báo có dấu "KHÁCH HỎI NGÀY NÀY") thì dòng tóm tắt phải ` +
  `nói về ĐÚNG ngày đó: dải nhiệt và trạng thái của chính ngày ấy. Số đo hiện tại khi đó chỉ là ` +
  `thông tin phụ, đừng để nó đứng đầu câu trả lời.`;

/**
 * Kết quả của nhánh thời tiết, TÁCH chứng cứ khỏi chỉ dẫn trình bày.
 *
 * Bản trước trả về một chuỗi duy nhất gộp cả số đo lẫn câu lệnh "hãy mở đầu bằng một dòng tóm
 * tắt". Gộp như vậy thì không có cách nào nói được đâu là bằng chứng: bộ đo lấy nguyên chuỗi đó
 * làm ngữ cảnh chấm faithfulness, và lớp đối chiếu số sẽ coi mọi con số trong phần ví dụ của chỉ
 * dẫn ("Thời tiết Đồng Văn: 24,5°C") là số liệu thật.
 */
interface WeatherOutcome {
  evidence: EvidenceBlock | null;
  /** Chỉ dẫn cách trình bày và các cảnh báo. KHÔNG phải bằng chứng, không đi vào ngữ cảnh chấm. */
  instructions: string;
  /** Tool đã được gọi và hỏng. Khác hẳn "không cần gọi" và "gọi được nhưng nơi này không có điểm đo". */
  failed: boolean;
  /**
   * Câu trả lời BẮT BUỘC phải có số đo thời gian thực.
   *
   * Không đồng nghĩa với "khách có nhắc chữ thời tiết". Câu "tháng 11 lên Hà Giang lạnh không"
   * cũng khớp `WEATHER_HINTS` nhưng nằm ngoài tầm dự báo, nên nó được trả lời bằng tri thức mùa
   * vụ và một lượt tra cứu hỏng không ảnh hưởng gì. Cờ này chỉ bật khi ta THẬT SỰ đã gọi tool,
   * tức là khi không còn đường nào khác để có con số ấy.
   */
  required: boolean;
}

const NO_WEATHER: WeatherOutcome = { evidence: null, instructions: "", failed: false, required: false };

async function buildWeatherBlock(
  placeSlugs: string[],
  toolCalls: ToolCallTrace[],
  temporal?: TemporalContext,
): Promise<WeatherOutcome> {
  // Không phân giải được địa danh nào thì không gọi tool: `getWeather` nhận slug chứ không nhận
  // toạ độ tự do, chính là để tác tử không thể tự bịa ra một điểm đo.
  const candidates = rankForWeather(placeSlugs);
  if (candidates.length === 0) return NO_WEATHER;

  /**
   * Câu hỏi nằm ngoài tầm dự báo thì KHÔNG gọi tool. Trả về khối rỗng có chủ ý: câu trả lời khi
   * đó dựa vào tri thức mùa vụ trong BỐI CẢNH THỜI GIAN, chứ không phải vào một con số của hôm
   * nay được gán cho tháng sau.
   */
  const forecastDays = forecastDaysFor(temporal);
  if (forecastDays === null) return NO_WEATHER;

  // Thử lần lượt cho tới khi có số liệu. Một slug không có điểm đo phục vụ KHÔNG phải là "tra cứu
  // hỏng" — nó chỉ có nghĩa là mức địa danh đó không mang số liệu, và ứng viên sau có thể mang.
  let result = await getWeather({ placeSlug: candidates[0], forecastDays, maxAgeSeconds: CHAT_WEATHER_MAX_AGE_SECONDS });
  const record = (): void => {
    toolCalls.push(isFailure(result)
      ? { tool: "getWeather", outcome: "failed", code: result.error.code }
      : { tool: "getWeather", outcome: "ok" });
  };
  record();
  for (const slug of candidates.slice(1)) {
    if (!isFailure(result)) break;
    result = await getWeather({ placeSlug: slug, forecastDays, maxAgeSeconds: CHAT_WEATHER_MAX_AGE_SECONDS });
    record();
  }

  /**
   * Dự báo càng xa càng kém tin. Nói ra điều đó là bắt buộc, cùng nguyên tắc đã áp cho
   * `ridingRisk`: khách phải biết mình đang đọc một con số chắc hay một con số có thể đổi.
   */
  const farNote =
    forecastDays > FAR_FORECAST_DAYS
      ? `\nMốc khách hỏi cách hôm nay hơn một tuần. Phải nói rõ đây là dự báo xa và còn có thể ` +
        `thay đổi, khuyên khách kiểm lại gần ngày đi.`
      : "";

  // `isFailure` chứ không phải `if (!result.ok)`: dự án đang tắt strictNullChecks nên phép kiểm
  // truthiness không thu hẹp được union. Xem chú thích ở @server/infra/realtime/toolResult.
  if (isFailure(result)) {
    /**
     * Không ứng viên nào mang điểm đo. Trước khi chịu thua, thử điểm trung tâm: khách hỏi "thời
     * tiết Hà Giang" là câu hợp lệ và hay gặp nhất, mà `ha-giang` cố tình không có điểm đo riêng
     * vì một con số không mô tả nổi 1.400 m chênh lệch trong tỉnh. Lấy số liệu ở trung tâm và
     * NÓI RÕ đó là trung tâm nào thì khách vẫn biết mình đang đọc con số của chỗ nào.
     */
    for (const slug of candidates) {
      const center = await getWeatherAtCenter(slug, forecastDays, CHAT_WEATHER_MAX_AGE_SECONDS);
      if (!center) continue;

      toolCalls.push(isFailure(center)
        ? { tool: "getWeather", outcome: "failed", code: center.error.code }
        : { tool: "getWeather", outcome: "ok" });
      if (isFailure(center)) continue;

      return {
        evidence: weatherEvidence(center.data, center.source, center.cached === true, temporal),
        instructions:
          `\nKhách hỏi cả một vùng rộng, còn số liệu trong nguồn [W1] là của ĐIỂM TRUNG TÂM vùng ` +
          `đó. Bắt buộc nói rõ số liệu đo tại điểm nào, và nhắc rằng nơi cao hơn trong vùng sẽ ` +
          `lạnh hơn và dễ có mù hơn — KHÔNG trình bày con số này như tình hình chung của cả vùng.` +
          farNote +
          WEATHER_FORMAT_HINT,
        failed: false,
        required: true,
      };
    }

    return {
      evidence: null,
      instructions: weatherFailureBlock(result.error.code),
      failed: true,
      required: true,
    };
  }

  return {
    evidence: weatherEvidence(result.data, result.source, result.cached === true, temporal),
    instructions: farNote + WEATHER_FORMAT_HINT,
    failed: false,
    required: true,
  };
}

/** Một lượt đọc số liệu -> một khối chứng cứ mang mã `W1`. */
function weatherEvidence(
  reading: WeatherReading,
  source: string,
  cached: boolean,
  temporal?: TemporalContext,
): EvidenceBlock {
  return {
    id: "W1",
    kind: "realtime",
    label: `Thời tiết thời gian thực tại ${reading.point}`,
    text: describeReading(reading, source, cached, temporal),
    sourceRef: source,
  };
}

export async function runKnowledge(context: AgentContext): Promise<AgentResult> {
  // placeSlugs do orchestrator phân giải. Rỗng thì retrieve() bỏ qua bộ lọc địa danh, nên câu hỏi
  // không nêu nơi cụ thể vẫn thấy toàn bộ kho.
  /**
   * Mở địa danh khách nhắc ra cả CÂY CON trước khi lọc.
   *
   * Tài liệu tri thức gắn vào thực thể cụ thể — phố cổ Đồng Văn, chợ phiên Đồng Văn, dinh thự họ
   * Vương — còn khách hỏi bằng tên vùng. Không mở cây thì câu "có gì ở Đồng Văn" chỉ thấy tài liệu
   * gắn thẳng vào `dong-van` và bỏ qua toàn bộ con cháu.
   */
  const placeSlugs = await expandPlaceTree(context.placeSlugs);

  // Truy xuất dùng câu ĐÃ CHUẨN HOÁ; lời nhắc bên dưới vẫn dùng `context.message` để model đọc
  // đúng chữ khách gõ. Xem chú thích ở `AgentContext.retrievalQuery`.
  context.stream?.stage("retrieval");
  const { chunks, metrics: retrieval } = await retrieve(context.retrievalQuery ?? context.message, {
    finalLimit: 5,
    placeSlugs,
    /**
     * Ba tín hiệu metadata. Chúng KHÔNG lọc bớt ứng viên mà thêm một nhánh xếp hạng, nên câu hỏi
     * đoán sai nhánh nội dung cũng không mất nguồn nào — xem `metadataFilter` trong retrieval.ts.
     *
     * `entityTypes` lấy từ loại của địa danh khách NÊU, không phải của cả cây con: một vùng chứa
     * đủ mọi loại thực thể, nên lấy theo cây thì tín hiệu phủ gần hết kho và thành vô nghĩa.
     */
    domains: domainSignals(context.retrievalQuery ?? context.message),
    entityTypes: entityTypeSignals(await placeKinds(context.placeSlugs)),
    seasons: seasonSignals(context.slots.temporal?.seasons),
  });

  /**
   * Thời tiết được lấy TRƯỚC phép kiểm "không có đoạn nào".
   *
   * Thứ tự này là phần sửa cốt lõi cho ca "Hôm nay thời tiết Đồng Văn thế nào". Trước đây phép
   * kiểm chunks đứng trước, nên một câu hỏi thời tiết mà kho tri thức không có đoạn nào khớp sẽ
   * bị chuyển tiếp NGAY, dù số liệu thật hoàn toàn lấy được. Số liệu quan trắc tự nó đã là căn
   * cứ — nó không cần một đoạn văn bản nào chống lưng.
   */
  const toolCalls: ToolCallTrace[] = [];
  const weather = WEATHER_HINTS.test(context.message)
    ? await buildWeatherBlock(context.placeSlugs, toolCalls, context.slots.temporal)
    : NO_WEATHER;

  /**
   * Chứng cứ được đánh mã ngay tại đây, và danh sách này là nguồn sự thật cho ba việc: dựng lời
   * nhắc, đối chiếu mã model khai, và ghi lại ngữ cảnh cho bộ đo. Ba việc đó trước kia dùng ba
   * nguồn khác nhau, nên chúng có thể lệch nhau mà không ai phát hiện.
   */
  const evidence: EvidenceBlock[] = [
    ...chunks.map((chunk, index) => ({
      id: `K${index + 1}`,
      kind: "knowledge" as const,
      label: chunk.title,
      text: chunk.content,
      sourceRef: chunk.sourceRef,
      docId: chunk.id,
    })),
    ...(weather.evidence ? [weather.evidence] : []),
  ];
  const retrievedDocIds = chunks.map((chunk) => chunk.id);

  // Chỉ chuyển tiếp khi KHÔNG có căn cứ nào cả: không đoạn tri thức, cũng không số liệu thời tiết.
  // Tool hỏng KHÔNG rơi vào nhánh này — lúc đó vẫn gọi model để nói thẳng với khách là chưa tra
  // được, và trạng thái `tool_failed` giữ cho nó không bị đọc nhầm thành "ngoài phạm vi".
  if (evidence.length === 0 && !weather.failed) {
    return {
      reply: "",
      suggestions: [],
      grounding: "no_source",
      toolStatus: resolveToolStatus({
        used: toolCalls.length > 0,
        failed: weather.failed,
        required: weather.required,
      }),
      evidence: [],
      retrievedDocIds,
      citedDocIds: [],
      calls: [],
      retrieval,
      toolCalls,
    };
  }

  /**
   * Hai loại nguồn được phép dùng, và chúng KHÁC LOẠI nên phải tách rõ trong lời nhắc.
   *
   * Tri thức là văn bản đã qua biên tập; thời tiết là số đo lấy về trong lượt này. Gộp chúng dưới
   * một tiêu đề "tri thức đã kiểm duyệt" như bản trước làm mờ đúng ranh giới mà SRS Mục 11.1.1.3
   * dựng lên, và khiến model dễ nói về số đo bằng giọng của tri thức biên tập — hoặc ngược lại.
   *
   * Mã `[K1]`, `[W1]` không phải để trang trí: nó là thứ model phải dẫn lại và là thứ mã đối
   * chiếu được. Không có mã thì lời khai nguồn chỉ là văn xuôi, không kiểm được.
   */
  const sourceBlock = evidence.length
    ? evidence
        .map((block) =>
          block.kind === "knowledge"
            ? `[${block.id}] TRI THỨC ĐÃ KIỂM DUYỆT — ${block.label}\n${block.text}`
            : `[${block.id}] ${block.label} — số liệu quan trắc, được phép trích dẫn\n${block.text}`,
        )
        .join("\n\n")
    : "(không có nguồn nào khớp câu hỏi này)";

  const { data, metrics } = await generateReply<{
    reply: string;
    suggestions: string[];
    citations: Citation[];
  }>(context, {
    /**
     * TẦNG MẠNH, không phải tầng nhẹ — và lý do là ĐỘ TRỄ chứ không phải chất lượng câu chữ.
     *
     * Lời gọi này mang lược đồ nặng nhất hệ thống: `citations[]` là mảng object lồng `claim` kèm
     * `sourceIds[]`. Đo ngày 2026-09-22 qua proxy đang dùng, `gemini-2.5-flash-lite` chỉ trả đúng
     * lược đồ 2/5 lượt với chính bộ trường này, còn `gemini-2.5-flash` đạt 5/5. Hệ quả của việc
     * trượt không phải là một lỗi thấy được mà là một LƯỢT GỌI NỮA: lần chạy holdout ngày
     * 2026-09-23 có 55% số lượt phải gửi lại, mỗi lần thêm 7–9 giây vào một lượt vốn đã 17 giây.
     *
     * Nên tầng nhẹ ở đây không hề rẻ hơn. Nó trả tiền cho hai lượt flash-lite trong quá nửa số
     * lần, cộng thêm thời gian chờ nhân đôi, để đổi lấy giá đơn vị thấp hơn ở lượt đầu tiên.
     *
     * Các tác tử còn lại CHƯA đổi, nhưng không phải vì đã chứng minh chúng ổn: cùng lần chạy đó,
     * 11/16 lượt đi qua `support` cũng phải gửi lại, dù lược đồ của nó không lồng mảng object.
     * Số lần gửi lại hiện chỉ được ghi theo LƯỢT, gộp cả NLU lẫn tác tử, nên chưa tách được phần
     * nào thuộc về ai — tách ra được thì mới biết có nên đổi tầng cho chúng hay không.
     */
    tier: "strong",
    systemInstruction: personaFor(
      "trả lời câu hỏi của khách CHỈ dựa trên các nguồn được cung cấp bên dưới, và khai rõ mã " +
        "nguồn cho từng ý trong câu trả lời",
    ),
    temperature: 0.6,
    schema: GROUNDED_CHAT_RESPONSE_SCHEMA,
    contents: `Câu hỏi của khách: ${context.message}${formatHistory(context.history)}

NGUỒN ĐƯỢC PHÉP DÙNG (mỗi nguồn có một MÃ trong ngoặc vuông):

${sourceBlock}${weather.instructions}
${context.slots.temporal ? `\nBỐI CẢNH THỜI GIAN (do mã quy đổi từ bảng mùa, KHÔNG được tự suy diễn):\n${describeTemporal(context.slots.temporal)}\nKhông tự suy ra mùa từ ngày tháng; chỉ dùng thông tin mùa ở trên.` : ""}

Chỉ dùng các nguồn trên. Nếu chúng không chứa câu trả lời, hãy nói rõ là bạn chưa có thông tin đó
thay vì suy đoán. Khi trích số liệu thời tiết, nói rõ đó là số đo lấy tại thời điểm nào và ở điểm
đo nào — đừng trình bày nó như một nhận định chung chung.

TRÍCH DẪN: mỗi ý mang thông tin trong reply phải có một mục trong citations, kèm đúng những mã
nguồn đã dùng cho ý đó. Mọi câu có CON SỐ đều bắt buộc có mục riêng. Con số phải chép đúng từ
nguồn, không tự làm tròn theo ý mình và không tự suy ra con số mới.`,
  });

  const reply = data?.reply?.trim() ?? "";

  /**
   * Model trả lời nhưng KHÔNG khai trích dẫn nào là một triệu chứng riêng, cần phân biệt được.
   *
   * Nguyên nhân hay gặp nhất không phải model lười mà là điểm cuối không thực thi responseSchema
   * — xem ghi chú ở `generateStructured`. Khi đó nhánh cứu văn xuôi dựng lại `{reply, suggestions}`
   * mà không có `citations`, và kết quả là một câu trả lời hợp lý bị chặn vì không chứng minh
   * được nguồn. Đó là hành vi ĐÚNG theo hợp đồng mới, nhưng phải tìm ra được bằng log chứ không
   * để nó lẫn vào đống "câu hỏi ngoài phạm vi".
   */
  if (reply && !Array.isArray(data?.citations)) {
    console.warn(
      "Tác tử tri thức: model trả lời nhưng không khai trích dẫn nào. Nếu lặp lại, kiểm điểm cuối " +
        "có thực thi responseSchema không trước khi kết luận về chất lượng câu trả lời.",
    );
  }

  const citations = verifyCitations(data?.citations, evidence);
  const facts = checkNumericFacts(reply, evidence);
  /**
   * Độ phủ đo NGƯỢC từ câu trả lời về phía trích dẫn.
   *
   * Không có bước này thì một câu trả lời gồm một ý dẫn đúng nguồn và năm câu tự nghĩ ra vẫn đạt
   * `grounded`, vì `citedIds` không rỗng và không con số nào bịa. Đó đúng là hình dạng nguy hiểm
   * nhất: có nguồn thật ở đầu để tạo niềm tin, rồi nói tiếp những thứ không ai kiểm.
   */
  const coverage = checkClaimCoverage(reply, citations);
  const grounding = resolveGrounding({
    evidence,
    reply,
    citations,
    facts,
    coverage,
    toolFailed: weather.failed,
    toolRequired: weather.required,
  });

  /**
   * `citedDocIds` giờ chỉ chứa đoạn ĐÃ ĐƯỢC DẪN và đã đối chiếu, không còn là toàn bộ kết quả
   * truy xuất. Khối thời tiết không có `docId` nên tự nhiên nằm ngoài danh sách này; nó vẫn được
   * ghi lại đầy đủ trong `evidence`.
   */
  const citedDocIds = citations.citedIds
    .map((id) => evidence.find((block) => block.id === id)?.docId)
    .filter((id): id is string => typeof id === "string");

  return {
    reply,
    suggestions: cleanStringList(data?.suggestions, 4),
    grounding,
    toolStatus: resolveToolStatus({
      used: toolCalls.length > 0,
      failed: weather.failed,
      required: weather.required,
    }),
    coverage: summarizeCoverage(citations, coverage),
    evidence,
    retrievedDocIds,
    citedDocIds,
    unsupportedFacts: facts.unsupported,
    calls: [metrics],
    retrieval,
    toolCalls,
  };
}
