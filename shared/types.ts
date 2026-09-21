export interface DestinationSourceLink { title: string; url: string }
export interface DestinationImageMeta {
  kind: 'place' | 'area' | 'illustration';
  regionLabel?: string;
  credit?: string;
  license?: string;
  sourcePage?: string;
}
export interface DestinationPhoto extends DestinationImageMeta { url: string }

export interface Destination {
  id: string;
  name: string;
  vietnameseName: string;
  district: string;
  category: 'pass' | 'nature' | 'culture' | 'viewpoint' | 'waterfall' | 'homestay';
  elevation: number | null; // in meters, null when unverified
  distanceFromStart: number | null; // km from Hà Giang City
  difficulty: 'Dễ đi' | 'Trung bình' | 'Đòi hỏi tay lái vững' | 'Hiểm trở';
  bestTime: string;
  highlights: string[];
  imageUrl: string;
  gallery: string[];
  description: string;
  safetyTip: string;
  coordinates: { lat: number; lng: number } | null;
  locationPrecision?: 'surveyed' | 'approximate' | 'area_only' | 'unknown';
  collection?: 'original' | 'expanded-20260918';
  sourceLinks?: DestinationSourceLink[];
  imageMeta?: DestinationImageMeta;
  photos?: DestinationPhoto[];
  aliases?: string[];
  recommendedStayHours: number;
  localFood: string[];
}

/** Một bộ lịch trình mẫu do hệ thống cung cấp, dùng làm mặc định cho trình lập lịch trình. */
export interface PresetItinerary {
  id: string;
  title: string;
  overview: string;
  totalKm: number;
  days: DayItinerary[];
}

/** Lịch trình do người dùng lưu lại sau khi AI sinh ra. */
export interface SavedItinerary {
  id: string;
  title: string;
  overview: string;
  totalKm: number;
  travelMode?: string;
  vibe?: string;
  budgetLevel?: string;
  days: DayItinerary[];
  createdAt: string;
}

export interface RouteWaypoint {
  id: string;
  day: number;
  time: string;
  title: string;
  subtitle: string;
  distanceKm: number;
  elevationM: number;
  type: 'ride' | 'viewpoint' | 'meal' | 'culture' | 'stay' | 'rest';
  highlight: string;
  aiTip: string;
  completed?: boolean;
}

export interface DayItinerary {
  day: number;
  title: string;
  theme: string;
  startPoint: string;
  endPoint: string;
  totalDistanceKm: number;
  ridingHours: number;
  maxElevationM: number;
  scenicRating: number; // 1-5
  waypoints: RouteWaypoint[];
  weatherAlert?: string;
  eveningStay: {
    name: string;
    type: string;
    vibe: string;
    priceEstimate: string;
  };
}

export interface ItineraryPlan {
  id: string;
  title: string;
  durationDays: number;
  travelMode: 'motorbike' | 'easy_rider' | 'car_suv';
  vibe: 'photography' | 'culture' | 'adventure' | 'chill';
  budgetLevel: 'backpacker' | 'comfort' | 'luxury';
  totalKm: number;
  overview: string;
  days: DayItinerary[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: string[];
  itinerarySnippet?: Partial<ItineraryPlan>;
}

/**
 * Số đo THẬT của một đỉnh đèo, lấy trong lượt gọi hiện tại.
 *
 * Tách khỏi các trường biên tập của `WeatherPassStatus` vì hai loại dữ liệu này có tuổi thọ và
 * độ tin khác hẳn nhau: nhiệt độ đo lúc 15h hôm nay chỉ đúng trong vài giờ, còn "nhiều khúc cua
 * gấp liên tục" thì đúng quanh năm. Gộp chung một chỗ là mời người đọc nhầm cái này sang cái kia.
 */
export interface PassLiveWeather {
  /** Nhãn điểm đo kèm độ cao, để nói rõ số này đo ở đâu. */
  point: string;
  tempC: number;
  feelsLikeC: number;
  windSpeedKmh: number;
  /** Mô tả suy ra từ mã WMO của nhà cung cấp, không phải do model diễn giải. */
  condition: string;
  visibilityM: number | null;
  /** Giờ quan trắc do nhà cung cấp báo, dạng `YYYY-MM-DDTHH:mm` giờ Việt Nam. */
  observedAtLocal: string | null;
}

export interface WeatherPassStatus {
  location: string;
  elevation: number;
  temp: number;
  condition: string;
  windSpeedKm: number;
  fogLevel: 'Quang đãng' | 'Sương mù nhẹ' | 'Sương mù dày đặc' | 'Mưa trơn trượt';
  roadStatus: 'An toàn' | 'Lưu ý cua dốc' | 'Đường ướt trơn' | 'Cảnh báo hạn chế tầm nhìn';
  /**
   * `null` khi tra cứu hỏng. Khi đó giao diện lùi về các con số biên tập ở trên và phải nói rõ
   * là chưa lấy được số đo — không được để khách tưởng mình đang đọc quan trắc.
   */
  live: PassLiveWeather | null;
}

export interface GearItem {
  id: string;
  name: string;
  category: 'safety' | 'clothing' | 'electronics' | 'medical' | 'documents';
  recommended: boolean;
  checked: boolean;
  note: string;
}

export interface HomestaySpot {
  id: string;
  name: string;
  location: string;
  pricePerNight: number; // VND
  rating: number;
  reviewCount: number;
  imageUrl: string;
  tags: string[];
  highlight: string;
  /**
   * Toạ độ để nhúng bản đồ. `null` khi cơ sở chưa được seed lại sau migration thêm hai cột này —
   * trạng thái có thật, và giao diện phải ẩn nút xem bản đồ thay vì nhúng một điểm sai.
   *
   * Độ chính xác ở mức xã hoặc bản, không phải mức công trình: đủ để thấy chỗ đó nằm đâu trên
   * cung đường, KHÔNG đủ để dẫn đường tới cửa.
   */
  coordinates: { lat: number; lng: number } | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  /** Facebook đã bị bỏ khỏi luồng đăng nhập: cần Facebook App + SDK riêng, chưa có. */
  provider: 'google' | 'email';
  phone?: string;
  riderLevel?: 'Mới bắt đầu' | 'Đã có kinh nghiệm' | 'Phượt thủ lão luyện' | 'Đi theo tour Easy Rider';
  favoriteDestinations: string[];
  savedItineraries: string[];
  createdAt: string;
}
