import { Router } from "express";
import type { Request, Response } from "express";
import { COST_ASSUMPTIONS } from "../costs";
import { asyncRoute } from "../asyncHandler";
import { prisma } from "../db";
import {
  toDestination,
  toGearItem,
  toHomestay,
  toMapWaypoint,
  toPassWeather,
  toPresetItinerary,
} from "../mappers";

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
  "/map-waypoints",
  handle(async () =>
    (await prisma.mapWaypoint.findMany({ orderBy: byOrder })).map(toMapWaypoint),
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

contentRouter.get(
  "/pass-weather",
  handle(async () =>
    (await prisma.passWeather.findMany({ orderBy: byOrder })).map(toPassWeather),
  ),
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
