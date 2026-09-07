import type {
  Destination as DestinationRow,
  GearItem as GearItemRow,
  Homestay as HomestayRow,
  MapWaypoint as MapWaypointRow,
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
  MapWaypoint,
  PresetItinerary,
  SavedItinerary,
  UserProfile,
  WeatherPassStatus,
} from "../src/types";

/**
 * Ranh giới giữa hai cách biểu diễn dữ liệu.
 *
 * Database lưu mã (`BEGINNER`, `EMAIL`) và id sinh tự động; frontend làm việc với nhãn
 * tiếng Việt và slug bền vững ('ma-pi-leng'). Mọi phép chuyển đổi tập trung ở đây, nhờ vậy
 * `src/types.ts` giữ nguyên và không component nào phải sửa theo lược đồ database.
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

export function toRiderLevelLabel(
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
  badges: { label: string }[];
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
    badges: user.badges.map((badge) => badge.label),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toDestination(row: DestinationRow): Destination {
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
    imageUrl: row.imageUrl,
    gallery: row.gallery,
    description: row.description,
    safetyTip: row.safetyTip,
    coordinates: { x: row.coordX, y: row.coordY, lat: row.lat, lng: row.lng },
    recommendedStayHours: row.recommendedStayHours,
    localFood: row.localFood,
  };
}

export function toMapWaypoint(row: MapWaypointRow): MapWaypoint {
  return {
    id: row.slug,
    name: row.name,
    vietnamese: row.vietnamese,
    km: row.km,
    elevation: row.elevation,
    x: row.x,
    y: row.y,
    type: row.type,
    warning: row.warning ?? undefined,
    destinationRef: row.destinationRef ?? undefined,
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

export function toPassWeather(row: PassWeatherRow): WeatherPassStatus {
  return {
    location: row.location,
    elevation: row.elevation,
    temp: row.temp,
    condition: row.condition,
    windSpeedKm: row.windSpeedKm,
    fogLevel: row.fogLevel as WeatherPassStatus["fogLevel"],
    roadStatus: row.roadStatus as WeatherPassStatus["roadStatus"],
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
