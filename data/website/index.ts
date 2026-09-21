import { PLACE_IMAGES } from "@data/website/images";
import { FALLBACK_IMAGE_SLUG, type ImageRef } from "@data/website/types";

export type {
  ImageRef,
  WebsiteDestination,
  WebsiteGearItem,
  WebsitePassCondition,
  LodgingDisplay,
  DestinationCategory,
  GearCategory,
  Difficulty,
} from "@data/website/types";

export { WEBSITE_DESTINATIONS } from "@data/website/destinations";
export { WEBSITE_GEAR } from "@data/website/gear";
export { WEBSITE_PASS_CONDITIONS } from "@data/website/pass-conditions";
export { WEBSITE_LODGING_DISPLAY } from "@data/website/lodging-display";
export { WEBSITE_PRESET_ITINERARIES } from "@data/website/preset-itineraries";
export { PLACE_IMAGES, SLUGS_WITHOUT_IMAGE } from "@data/website/images";

/**
 * Ảnh bìa cho một khoá ảnh, kèm đường lui khi khoá đó không có ảnh nào.
 *
 * Hàm này tồn tại để KHÔNG chỗ nào trong giao diện phải tự xử lý trường hợp thiếu ảnh. Nếu để
 * mỗi component tự kiểm thì sớm muộn sẽ có chỗ quên, và biểu hiện là một thẻ vỡ hình trông như
 * lỗi tải trang — tệ hơn hẳn một ảnh bối cảnh không đúng điểm.
 *
 * Ảnh dự phòng là ảnh của chính vùng này, không bao giờ là ảnh của nơi khác. Đó là ranh giới:
 * dùng ảnh Sapa làm dự phòng cho một điểm ở Hà Giang là nói dối bằng hình.
 */
export function coverImage(imageSlug: string): ImageRef | null {
  const own = PLACE_IMAGES[imageSlug]?.[0];
  if (own) return own;
  return PLACE_IMAGES[FALLBACK_IMAGE_SLUG]?.[0] ?? null;
}

/** Bộ ảnh cho thư viện ảnh, bỏ ảnh bìa vì nó đã hiển thị riêng. */
export function galleryImages(imageSlug: string): ImageRef[] {
  return (PLACE_IMAGES[imageSlug] ?? []).slice(1);
}

/**
 * Câu ghi công hiển thị cạnh ảnh.
 *
 * KHÔNG phải trang trí: ảnh trong dự án dùng giấy phép CC BY và CC BY-SA, và cả hai đều ĐÒI ghi
 * tên tác giả. Bỏ phần này là vi phạm giấy phép chứ không phải một thiếu sót về giao diện.
 */
export function imageCredit(image: ImageRef): string {
  return `Ảnh: ${image.credit} (${image.license})`;
}
