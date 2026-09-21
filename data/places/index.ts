import { GEOGRAPHY } from "@data/places/geography";
import { FOOD_PLACES } from "@data/places/food";
import { LODGING_PLACES } from "@data/places/lodging";
import type { Place } from "@data/places/types";

export type { Place, PlaceKind, GeoPoint, PriceEstimate, StaticOpeningHours } from "@data/places/types";
export { GEOGRAPHY } from "@data/places/geography";
export { FOOD_PLACES } from "@data/places/food";
export { LODGING_PLACES } from "@data/places/lodging";

/**
 * Toàn bộ danh mục thực thể, gộp ba file nguồn.
 *
 * THỨ TỰ GỘP CÓ Ý NGHĨA và không được đổi: địa lý trước, rồi ẩm thực, rồi lưu trú. Lý do là
 * `parentSlug` chỉ trỏ theo một chiều — quán ăn và homestay trỏ về xã hoặc vùng, không bao giờ
 * ngược lại. Gộp theo thứ tự này thì mọi thực thể cha luôn xuất hiện trước con của nó, nên
 * `db/seed.ts` upsert tuần tự là an toàn mà không cần sắp xếp topo.
 */
export const PLACES: Place[] = [...GEOGRAPHY, ...FOOD_PLACES, ...LODGING_PLACES];

/**
 * Tra một thực thể theo slug. Map dựng một lần lúc nạp module.
 *
 * Trả `undefined` chứ không ném lỗi: người gọi ở tầng tool phải tự quyết định slug không tồn tại
 * là lỗi dữ liệu hay là đầu vào rác từ khách, và hai trường hợp đó xử lý khác nhau.
 */
const BY_SLUG = new Map(PLACES.map((place) => [place.slug, place]));

export function findPlace(slug: string): Place | undefined {
  return BY_SLUG.get(slug);
}

/** Các thực thể ngoài địa bàn, dùng cho cổng chặn ở orchestrator. Xem chú thích trong file. */
export { OUT_OF_AREA_PLACES } from "@data/places/out-of-area";
