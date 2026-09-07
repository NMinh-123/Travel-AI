import { useCallback, useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '../lib/api';
import type {
  Destination,
  GearItem,
  HomestaySpot,
  MapWaypoint,
  PresetItinerary,
  WeatherPassStatus
} from '../types';

/**
 * Nội dung Hà Giang trước đây là import tĩnh từ src/data/hagiangData.ts, giờ đến từ
 * /api/content/*. Hook này giữ đúng ba trạng thái mà mọi lời gọi mạng đều có — đang tải, lỗi,
 * có dữ liệu — để component không tự nghĩ ra cách xử lý riêng ở mỗi chỗ.
 */
export interface ContentState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

function useContent<T>(path: string): ContentState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    // Cờ cancelled: component có thể unmount khi đổi tab trước lúc request về, ghi state
    // sau đó là ghi vào một component đã tháo.
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    apiRequest<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Không tải được dữ liệu'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { data, isLoading, error, reload };
}

/**
 * Đơn giá dự toán chi phí. Trước Vòng 5 bộ số này nằm cứng trong PocketGuideSection; giờ lấy từ
 * server để máy tính chi phí ở Cẩm nang và tác tử dự toán của chatbot không bao giờ ra hai kết
 * quả khác nhau cho cùng một đầu vào.
 */
export interface CostAssumptions {
  bikeRentPerDay: number;
  easyRiderPerDay: number;
  fuelPerDay: number;
  stayPerNight: { dorm: number; private_room: number; ecolodge: number };
  foodPerDay: number;
  attractionTickets: number;
  busHanoiRoundTrip: number;
}

export const useCostAssumptions = () =>
  useContent<CostAssumptions>('/api/content/cost-assumptions');

export const useDestinations = () => useContent<Destination[]>('/api/content/destinations');
export const useMapWaypoints = () => useContent<MapWaypoint[]>('/api/content/map-waypoints');
export const useHomestays = () => useContent<HomestaySpot[]>('/api/content/homestays');
export const useGearChecklist = () => useContent<GearItem[]>('/api/content/gear');
export const usePassWeather = () => useContent<WeatherPassStatus[]>('/api/content/pass-weather');
export const usePresetItineraries = () =>
  useContent<PresetItinerary[]>('/api/content/preset-itineraries');
