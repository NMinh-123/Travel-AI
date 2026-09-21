import { Router } from "express";
import type { Request, Response } from "express";
import { COST_ASSUMPTIONS } from "@server/domain/costs";
import { asyncRoute } from "@server/middleware/asyncHandler";
import { prisma } from "@server/infra/db";
import { describeWeatherCode, getWeather } from "@server/infra/realtime/index";
import { isFailure } from "@server/infra/realtime/toolResult";
import { LOCAL_WEATHER_SLUG } from "@server/infra/realtime/passWeatherRefresh";
import {
  toDestination,
  toGearItem,
  toHomestay,
  toPassWeather,
  toPresetItinerary,
} from "@server/domain/mappers";

/**
 * Nội dung Hà Giang: công khai và chỉ đọc, không cần đăng nhập.
 *
 * Trước đây frontend import trực tiếp từ src/data/hagiangData.ts. Chuyển sang API để sửa
 * nội dung không phải build lại app, và để dữ liệu có một nguồn duy nhất dùng chung giữa
 * giao diện, seed và (sau này) trang quản trị.
 *
 * Mọi truy vấn sắp theo `sortOrder` để thứ tự hiển thị giữ đúng như mảng gốc, chứ không phụ
 * thuộc vào thứ tự Postgres trả về.
 */
export const contentRouter = Router();

const byOrder = { sortOrder: "asc" } as const;

/** Bọc handler async để lỗi đi vào error handler của Express thay vì thành unhandled rejection. */
function handle(load: () => Promise<unknown>) {
  return asyncRoute(async (_req: Request, res: Response) => {
    res.json(await load());
  });
}

contentRouter.get(
  "/destinations",
  handle(async () =>
    (await prisma.destination.findMany({ orderBy: byOrder })).map(toDestination),
  ),
);

contentRouter.get(
  "/homestays",
  handle(async () => (await prisma.homestay.findMany({ orderBy: byOrder })).map(toHomestay)),
);

contentRouter.get(
  "/gear",
  handle(async () => (await prisma.gearItem.findMany({ orderBy: byOrder })).map(toGearItem)),
);

/**
 * Thời tiết tại điểm neo của cả vùng — thành phố Hà Giang, 100 m.
 *
 * Badge trên thanh điều hướng đứng ở mọi trang nên nó cần một nơi mà ai cũng hiểu, chứ không
 * phải một đỉnh đèo cụ thể: bản trước hiện số của đỉnh Mã Pí Lèng ở 1.500 m, lạnh hơn thành phố
 * cả chục độ, và người chưa lên đèo đọc con số đó rất dễ tưởng đó là thời tiết chung.
 *
 * Trả `null` khi tra cứu hỏng, để badge nói rõ là chưa có số thay vì hiện một con số bịa.
 */
contentRouter.get(
  "/local-weather",
  handle(async () => {
    const result = await getWeather({ placeSlug: LOCAL_WEATHER_SLUG, forecastDays: 1 });
    if (isFailure(result)) return null;

    const w = result.data;
    return {
      point: w.point,
      tempC: w.tempC,
      feelsLikeC: w.feelsLikeC,
      windSpeedKmh: w.windSpeedKmh,
      condition: describeWeatherCode(w.weatherCode),
      visibilityM: w.visibilityM,
      observedAtLocal: w.observedAtLocal,
    };
  }),
);

/**
 * Điều kiện các đỉnh đèo: số đo THẬT ghép lên phần biên tập.
 *
 * Bảng `PassWeather` trong database là tri thức của người viết — tình trạng mặt đường, mức sương
 * theo mùa, ghi chú cua dốc — và những thứ đó không đổi theo ngày. Nhưng nhiệt độ và gió thì có,
 * và trước đây chúng cũng nằm luôn trong bảng: tab An toàn đèo báo đỉnh Mã Pí Lèng 9°C quanh
 * năm, trong khi số đo thật giữa tháng 9 là 15–19°C. Một con số cố định được trình bày như tình
 * hình hiện tại chính là kiểu sai mà tầng công cụ thời gian thực được dựng ra để chấm dứt.
 *
 * `allSettled` chứ không phải `all`: một điểm đo hỏng thì năm điểm còn lại vẫn phải lên được
 * giao diện. Điểm hỏng trả `live: null` và phía client nói rõ là chưa lấy được số đo, chứ không
 * âm thầm hiện lại con số cũ như thể nó vừa được đo.
 *
 * `forecastDays: 1` vì ở đây chỉ cần hiện tại, không cần bảng dự báo. Cache một giờ và tác vụ
 * làm mới nền gánh phần còn lại, nên sáu lời gọi này không lặp lại ở mỗi lượt mở tab.
 */
contentRouter.get(
  "/pass-weather",
  handle(async () => {
    const rows = await prisma.passWeather.findMany({ orderBy: byOrder });
    const readings = await Promise.allSettled(
      rows.map((row) => getWeather({ placeSlug: row.slug, forecastDays: 1 })),
    );

    return rows.map((row, index) => {
      const settled = readings[index];
      if (settled.status !== "fulfilled" || isFailure(settled.value)) return toPassWeather(row);

      const w = settled.value.data;
      return toPassWeather(row, {
        point: w.point,
        tempC: w.tempC,
        feelsLikeC: w.feelsLikeC,
        windSpeedKmh: w.windSpeedKmh,
        condition: describeWeatherCode(w.weatherCode),
        visibilityM: w.visibilityM,
        observedAtLocal: w.observedAtLocal,
      });
    });
  }),
);

contentRouter.get(
  "/preset-itineraries",
  handle(async () =>
    (await prisma.presetItinerary.findMany({ orderBy: byOrder })).map(toPresetItinerary),
  ),
);

/**
 * Đơn giá dự toán chi phí. Thêm ở Vòng 5 để máy tính chi phí ở tab Cẩm nang và tác tử dự toán
 * kinh phí của chatbot dùng CHUNG một bộ số — trước đó bộ số này nằm cứng trong
 * PocketGuideSection.tsx và chỉ giao diện thấy được.
 */
contentRouter.get(
  "/cost-assumptions",
  handle(async () => COST_ASSUMPTIONS),
);
