import { useCallback, useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '@client/lib/api';
import type {
  Destination,
  GearItem,
  HomestaySpot,
  PassLiveWeather,
  PresetItinerary,
  WeatherPassStatus
} from '@shared/types';

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

/**
 * `refreshMs` bật tự làm mới cho những nội dung có tuổi thọ: thời tiết đổi trong lúc trang đang
 * mở, còn danh mục điểm đến thì không. Không đặt thì hook giữ nguyên hành vi cũ — tải một lần.
 *
 * Hai đường kích hoạt, và cần cả hai. Bộ đếm lo trường hợp người dùng để trang mở hàng giờ.
 * `visibilitychange` lo trường hợp ngược lại và hay gặp hơn: máy ngủ hoặc tab bị ẩn thì trình
 * duyệt bóp nghẹt bộ đếm, nên lúc quay lại tab người dùng sẽ nhìn một con số cũ thêm vài phút
 * nữa nếu chỉ trông vào `setInterval`.
 *
 * Lượt làm mới KHÔNG bật cờ `isLoading`: giao diện đang có số liệu cũ, nhấp nháy khối chờ mỗi
 * vài phút thì khó chịu hơn hẳn việc con số lặng lẽ đổi.
 */
function useContent<T>(path: string, refreshMs?: number): ContentState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    if (!refreshMs) return;

    let cancelled = false;

    const refresh = (): void => {
      apiRequest<T>(path)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch(() => {
          // Im lặng có chủ ý: một lượt làm mới hỏng không được thay số liệu đang hiển thị bằng
          // màn báo lỗi. Lượt sau thử lại, và lỗi ở lần tải đầu thì vẫn hiện như cũ.
        });
    };

    const timer = setInterval(refresh, refreshMs);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [path, refreshMs]);

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
export const useHomestays = () => useContent<HomestaySpot[]>('/api/content/homestays');
export const useGearChecklist = () => useContent<GearItem[]>('/api/content/gear');
/**
 * Năm phút — chọn theo phía sau chứ không phải theo cảm giác: server hâm số đo mỗi giờ, nên nhịp
 * này quyết định người dùng phải chờ bao lâu sau mốc đó mới thấy số mới. Năm phút là đủ sát mà
 * vẫn chỉ là 12 request nội bộ mỗi giờ, và chúng trả từ cache nên không chạm tới Open-Meteo.
 */
const WEATHER_REFRESH_MS = 5 * 60 * 1000;

export const usePassWeather = () =>
  useContent<WeatherPassStatus[]>('/api/content/pass-weather', WEATHER_REFRESH_MS);

/** Thời tiết thành phố Hà Giang cho badge trên thanh điều hướng. `null` khi chưa tra được. */
export const useLocalWeather = () =>
  useContent<PassLiveWeather | null>('/api/content/local-weather', WEATHER_REFRESH_MS);
export const usePresetItineraries = () =>
  useContent<PresetItinerary[]>('/api/content/preset-itineraries');
