export interface Destination {
  id: string;
  name: string;
  vietnameseName: string;
  district: string;
  category: 'pass' | 'nature' | 'culture' | 'viewpoint' | 'waterfall' | 'homestay';
  elevation: number; // in meters
  distanceFromStart: number; // km from Hà Giang City
  difficulty: 'Dễ đi' | 'Trung bình' | 'Đòi hỏi tay lái vững' | 'Hiểm trở';
  bestTime: string;
  highlights: string[];
  imageUrl: string;
  gallery: string[];
  description: string;
  safetyTip: string;
  coordinates: { x: number; y: number; lat: number; lng: number }; // SVG map coordinates
  recommendedStayHours: number;
  localFood: string[];
}

/**
 * Một điểm trên bản đồ SVG cao nguyên đá. `id` là slug bền vững ('ma-pi-leng'), giống
 * `Destination.id` — server map từ cột `slug` sang đây để frontend không phụ thuộc vào id
 * sinh tự động của database.
 */
export interface MapWaypoint {
  id: string;
  name: string;
  vietnamese: string;
  km: number;
  elevation: number;
  x: number; // toạ độ trong canvas SVG 950x650
  y: number;
  type: 'city' | 'pass' | 'scenic' | 'water' | 'culture';
  warning?: string;
  destinationRef?: string; // trỏ tới Destination.id khi có trang chi tiết tương ứng
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
  coordinates?: { x: number; y: number };
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

export interface WeatherPassStatus {
  location: string;
  elevation: number;
  temp: number;
  condition: string;
  windSpeedKm: number;
  fogLevel: 'Quang đãng' | 'Sương mù nhẹ' | 'Sương mù dày đặc' | 'Mưa trơn trượt';
  roadStatus: 'An toàn' | 'Lưu ý cua dốc' | 'Đường ướt trơn' | 'Cảnh báo hạn chế tầm nhìn';
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
  badges: string[];
  createdAt: string;
}
