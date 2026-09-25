import { destinationContent, destinationPhotos, DESTINATION_ILLUSTRATION } from './destinationCatalog';
import { findPlace } from '@data/places/index';
import type {
  Destination as DestinationRow,
  GearItem as GearItemRow,
  Homestay as HomestayRow,
  PassWeather as PassWeatherRow,
  Prisma,
  PresetItinerary as PresetItineraryRow,
  RiderLevel,
  SavedItinerary as SavedItineraryRow,
} from "@prisma/client";
import type {
  DayItinerary,
  Destination,
  GearItem,
  HomestaySpot,
  PresetItinerary,
  SavedItinerary,
  UserProfile,
  WeatherPassStatus,
} from "@shared/types";

/**
 * Ranh giới giữa hai cách biểu diễn dữ liệu.
 *
 * Database lưu mã (`BEGINNER`, `EMAIL`) và id sinh tự động; frontend làm việc với nhãn
 * tiếng Việt và slug bền vững ('ma-pi-leng'). Mọi phép chuyển đổi tập trung ở đây, nhờ vậy
 * `shared/types.ts` giữ nguyên và không component nào phải sửa theo lược đồ database.
 */

const RIDER_LEVEL_LABELS: Record<RiderLevel, NonNullable<UserProfile["riderLevel"]>> = {
  BEGINNER: "Mới bắt đầu",
  EXPERIENCED: "Đã có kinh nghiệm",
  VETERAN: "Phượt thủ lão luyện",
  EASY_RIDER: "Đi theo tour Easy Rider",
};

const RIDER_LEVEL_CODES = Object.fromEntries(
  Object.entries(RIDER_LEVEL_LABELS).map(([code, label]) => [label, code as RiderLevel]),
) as Record<NonNullable<UserProfile["riderLevel"]>, RiderLevel>;

function toRiderLevelLabel(
  level: RiderLevel | null,
): UserProfile["riderLevel"] | undefined {
  return level ? RIDER_LEVEL_LABELS[level] : undefined;
}

/** Trả về null khi nhãn không nằm trong danh sách hợp lệ, để route từ chối yêu cầu. */
export function toRiderLevelCode(label: unknown): RiderLevel | null {
  if (typeof label !== "string") return null;
  return RIDER_LEVEL_CODES[label as NonNullable<UserProfile["riderLevel"]>] ?? null;
}

/** `days` được lưu dạng Json nên phải kiểm tra hình dạng trước khi tin. */
function toDays(value: Prisma.JsonValue): DayItinerary[] {
  return Array.isArray(value) ? (value as unknown as DayItinerary[]) : [];
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: "EMAIL" | "GOOGLE";
  phone: string | null;
  riderLevel: RiderLevel | null;
  createdAt: Date;
  favorites: { destinationSlug: string }[];
  savedItineraries: { id: string }[];
};

export function toUserProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    provider: user.provider === "GOOGLE" ? "google" : "email",
    phone: user.phone ?? undefined,
    riderLevel: toRiderLevelLabel(user.riderLevel),
    favoriteDestinations: user.favorites.map((favorite) => favorite.destinationSlug),
    savedItineraries: user.savedItineraries.map((itinerary) => itinerary.id),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toDestination(row: DestinationRow): Destination {
  const content = destinationContent(row.slug);
  const place = findPlace(row.slug);
  const coordinates = Number.isFinite(row.lat) && Number.isFinite(row.lng) &&
    row.lat !== null && row.lng !== null && Math.abs(row.lat) <= 90 && Math.abs(row.lng) <= 180
    ? { lat: row.lat, lng: row.lng } : null;
  const photos = destinationPhotos(row.slug, [row.imageUrl, ...row.gallery]);
  const cover = photos[0] ?? { url: DESTINATION_ILLUSTRATION, kind: 'illustration' as const };
  return {
    id: row.slug,
    name: row.name,
    vietnameseName: row.vietnameseName,
    district: row.district,
    category: row.category,
    elevation: row.elevation,
    distanceFromStart: row.distanceFromStart,
    difficulty: row.difficulty as Destination["difficulty"],
    bestTime: row.bestTime,
    highlights: row.highlights,
    imageUrl: cover.url,
    gallery: photos.slice(1).map(photo => photo.url),
    photos: photos.length ? photos : [cover],
    imageMeta: cover,
    collection: content?.collection ?? 'original',
    sourceLinks: content?.sourceLinks ?? [],
    aliases: place?.aliases ?? [],
    // The stored column, not a fresh lookup: a row seeded before a place moved should keep saying
    // how sure we were of the number it actually carries. No coordinates means nothing to qualify.
    locationPrecision: coordinates ? row.locationPrecision : 'unknown',
    description: row.description,
    safetyTip: row.safetyTip,
    coordinates,
    recommendedStayHours: row.recommendedStayHours,
    localFood: row.localFood,
  };
}

export function toHomestay(row: HomestayRow): HomestaySpot {
  return {
    id: row.slug,
    name: row.name,
    location: row.location,
    pricePerNight: row.pricePerNight,
    rating: row.rating,
    reviewCount: row.reviewCount,
    imageUrl: row.imageUrl,
    tags: row.tags,
    highlight: row.highlight,
    // Chỉ trả toạ độ khi có ĐỦ CẢ HAI. Một nửa toạ độ là vô nghĩa và sẽ dựng ra một điểm nằm
    // trên xích đạo hoặc kinh tuyến gốc — sai mà vẫn hợp kiểu.
    coordinates:
      typeof row.lat === "number" && typeof row.lng === "number"
        ? { lat: row.lat, lng: row.lng }
        : null,
  };
}

/**
 * `checked` là trạng thái tick của từng người dùng, hiện vẫn lưu ở localStorage để checklist
 * dùng được khi chưa đăng nhập. Database chỉ cấp giá trị khởi tạo.
 */
export function toGearItem(row: GearItemRow): GearItem {
  return {
    id: row.slug,
    name: row.name,
    category: row.category,
    recommended: row.recommended,
    checked: row.defaultChecked,
    note: row.note,
  };
}

export function toPassWeather(
  row: PassWeatherRow,
  live: WeatherPassStatus["live"] = null,
): WeatherPassStatus {
  return {
    location: row.location,
    elevation: row.elevation,
    temp: row.temp,
    condition: row.condition,
    windSpeedKm: row.windSpeedKm,
    fogLevel: row.fogLevel as WeatherPassStatus["fogLevel"],
    roadStatus: row.roadStatus as WeatherPassStatus["roadStatus"],
    live,
  };
}

export function toPresetItinerary(row: PresetItineraryRow): PresetItinerary {
  return {
    id: row.slug,
    title: row.title,
    overview: row.overview,
    totalKm: row.totalKm,
    days: toDays(row.days),
  };
}

export function toSavedItinerary(row: SavedItineraryRow): SavedItinerary {
  return {
    id: row.id,
    title: row.title,
    overview: row.overview,
    totalKm: row.totalKm,
    travelMode: row.travelMode ?? undefined,
    vibe: row.vibe ?? undefined,
    budgetLevel: row.budgetLevel ?? undefined,
    days: toDays(row.days),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Bản ghi user kèm quan hệ, dùng chung cho mọi endpoint trả về hồ sơ.
 *
 * Nằm cạnh `toUserProfile` có chủ ý: đây là hình dạng dữ liệu mà hàm đó CẦN có để chạy đúng.
 * Tách hai thứ ra hai file là cách chắc chắn để một ngày nào đó có người thêm quan hệ mới vào
 * hồ sơ mà quên sửa câu truy vấn, rồi ngồi truy vì sao trường đó luôn rỗng.
 */
export const userWithRelations = {
  favorites: { select: { destinationSlug: true } },
  savedItineraries: { select: { id: true }, orderBy: { createdAt: "desc" } },
} as const;
