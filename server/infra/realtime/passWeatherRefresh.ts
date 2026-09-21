import { prisma } from "@server/infra/db";
import { getWeather } from "@server/infra/realtime/weather";
import { isFailure } from "@server/infra/realtime/toolResult";

/**
 * LÀM MỚI NỀN SỐ ĐO CÁC ĐỈNH ĐÈO — mỗi giờ một lượt.
 *
 * Tab An toàn đèo hiển thị số đo của sáu đỉnh. Nếu chờ tới lúc có người mở tab mới đi hỏi, thì
 * người đầu tiên sau mỗi lần cache hết hạn phải ngồi đợi sáu lời gọi mạng nối nhau — đo được 6,4
 * giây trên máy phát triển với đường truyền tốt. Hỏi trước rồi để sẵn trong cache thì lượt nào
 * cũng trả về trong khoảng 0,2 giây.
 *
 * NHỊP MỘT GIỜ PHẢI KHỚP `ttlSeconds` CỦA HỒ SƠ THỜI TIẾT (@data/realtime/providers). Đặt nhịp
 * dài hơn TTL sẽ để lại một quãng cache rỗng giữa hai lượt, và đúng quãng đó người dùng lại chịu
 * độ trễ mà tác vụ này sinh ra để tránh. Đặt ngắn hơn thì gọi thừa mà không ai đọc.
 *
 * Không thêm dịch vụ hẹn giờ nào bên ngoài: `setInterval` trong chính tiến trình web là đủ cho
 * một nhịp mỗi giờ, và nó chết cùng tiến trình nên không để lại tác vụ mồ côi.
 */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Thành phố Hà Giang không nằm trong bảng đỉnh đèo nhưng vẫn được hâm cùng mẻ, vì badge trên
 * thanh điều hướng hiện số của nó ở mọi trang. Để nó tự gọi khi có người mở trang thì người đầu
 * tiên sau mỗi giờ lại phải chờ một lượt mạng, đúng thứ tác vụ này sinh ra để tránh.
 */
export const LOCAL_WEATHER_SLUG = "tp-ha-giang";

/**
 * Một lượt làm mới. Không ném lỗi ra ngoài: hỏng một điểm không được làm chết vòng lặp.
 *
 * TUẦN TỰ CHỨ KHÔNG SONG SONG, và đây là thứ đo được chứ không phải cẩn thận thừa: bắn sáu lời
 * gọi cùng lúc tới Open-Meteo mất 4,13 giây cho cả mẻ, trong khi `timeoutMs` của hồ sơ thời tiết
 * là 4000. Trên máy rảnh thì vừa kịp, còn đúng lúc server khởi động — Vite đang dựng, sidecar
 * Python đang nạp model — thì cả sáu cùng vượt ngưỡng và lượt làm mới đầu tiên trắng tay.
 *
 * Tác tử trong luồng chat thì khác: khách đang đợi câu trả lời nên nó vẫn gọi song song và giữ
 * ngưỡng 4 giây. Tác vụ nền không có ai đợi, nên đổi tốc độ lấy độ chắc chắn là đúng chỗ.
 */
async function refreshOnce(): Promise<void> {
  try {
    const passes = await prisma.passWeather.findMany({ select: { slug: true, location: true } });
    const rows = [
      ...passes,
      { slug: LOCAL_WEATHER_SLUG, location: "thành phố Hà Giang" },
    ];

    const failed: string[] = [];
    for (const row of rows) {
      try {
        const result = await getWeather({ placeSlug: row.slug, forecastDays: 1 });
        if (isFailure(result)) failed.push(`${row.location} (${result.error.code})`);
      } catch {
        failed.push(`${row.location} (ngoại lệ)`);
      }
    }

    if (failed.length > 0) {
      // Không im lặng: cache khuyết một điểm thì tab sẽ hiện "chưa lấy được số đo" cho điểm đó,
      // và người vận hành cần biết vì sao mà không phải đi đọc log của từng lượt request.
      console.warn(
        `[pass-weather] làm mới xong, ${failed.length}/${rows.length} điểm không lấy được: ` +
          failed.join(", "),
      );
    }
  } catch (error) {
    console.error("[pass-weather] lượt làm mới nền thất bại:", error);
  }
}

/**
 * Lượt đầu tiên không chạy ngay lúc `listen`.
 *
 * Mấy giây đầu sau khi server lên là lúc máy bận nhất: Vite còn đang dựng đồ thị module, sidecar
 * Python còn đang nạp model BGE-M3. Gọi mạng đúng lúc đó thì request dễ vượt ngưỡng 4 giây — đo
 * được: lượt làm mới ngay lập tức mất một điểm vì PROVIDER_ERROR, còn lượt hoãn thì không.
 */
const FIRST_RUN_DELAY_MS = 5_000;

/**
 * Bật vòng làm mới: một lượt sau khi tiến trình đã ổn định, rồi cứ mỗi giờ một lượt.
 *
 * `unref()` cho cả hai bộ hẹn giờ để chúng không giữ tiến trình sống: tắt server thì chúng tắt
 * theo, thay vì treo thêm tới một giờ chờ nhịp kế tiếp.
 */
export function startPassWeatherRefresh(): NodeJS.Timeout {
  const first = setTimeout(() => void refreshOnce(), FIRST_RUN_DELAY_MS);
  first.unref();

  const timer = setInterval(() => void refreshOnce(), REFRESH_INTERVAL_MS);
  timer.unref();
  return timer;
}
