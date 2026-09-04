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
  weatherTag?: {
    temp: number;
    condition: string;
    fogRisk: 'Thấp' | 'Trung bình' | 'Dày đặc' | 'Cảnh báo sạt lở mùa mưa';
  };
  recommendedStayHours: number;
  localFood: string[];
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
  updatedAt: string;
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
  phone: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'facebook' | 'email';
  phone?: string;
  riderLevel?: 'Mới bắt đầu' | 'Đã có kinh nghiệm' | 'Phượt thủ lão luyện' | 'Đi theo tour Easy Rider';
  favoriteDestinations: string[];
  savedItineraries: string[];
  badges: string[];
  createdAt: string;
}
