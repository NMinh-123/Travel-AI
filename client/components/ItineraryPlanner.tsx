import React, { useEffect, useState } from 'react';
import type { DayItinerary, PresetItinerary } from '@shared/types';
import { usePresetItineraries } from '@client/hooks/useContent';
import { useAuth } from '@client/context/AuthContext';
import { ErrorState, LoadingState } from './LoadingState';
import { ControlGroup, ControlOption } from './ControlGroup';
import {
  Sparkles, Clock, Mountain, AlertTriangle, RefreshCw, Route,
  CheckCircle2, Bed, Bike, Car, UserCheck, Star, BookmarkPlus, Check
} from 'lucide-react';

const VIBE_OPTIONS: { id: 'photography' | 'culture' | 'adventure' | 'chill'; label: string }[] = [
  { id: 'photography', label: 'Săn mây, nhiếp ảnh' },
  { id: 'culture', label: 'Bản làng, văn hoá' },
  { id: 'adventure', label: 'Cung đèo hiểm trở' },
  { id: 'chill', label: 'Suối nước, nghỉ ngơi' }
];

const BUDGET_OPTIONS: { id: 'backpacker' | 'comfort' | 'luxury'; label: string }[] = [
  { id: 'backpacker', label: 'Tiết kiệm' },
  { id: 'comfort', label: 'Tiện nghi' },
  { id: 'luxury', label: 'Cao cấp' }
];

interface ItineraryPlannerProps {
  onAskAI: (prompt: string) => void;
  /** Tên điểm đến người dùng vừa chọn ở tab khám phá, dùng để mồi sẵn phần ghi chú. */
  focusDestination?: string;
}

/**
 * Lịch trình mẫu đến từ /api/content/preset-itineraries (trước đây là PRESET_ITINERARIES
 * trong src/data/hagiangData.ts). Tách phần tải ra vỏ ngoài để phần dựng giao diện luôn có
 * một lịch trình khởi tạo, thay vì phải xử lý trạng thái "chưa có ngày nào" khắp nơi.
 */
export const ItineraryPlanner: React.FC<ItineraryPlannerProps> = (props) => {
  const presets = usePresetItineraries();

  if (presets.isLoading) return <LoadingState label="Đang tải lịch trình mẫu..." />;
  if (presets.error) return <ErrorState message={presets.error} onRetry={presets.reload} />;

  const preset = presets.data?.[0];
  if (!preset || preset.days.length === 0) {
    return (
      <ErrorState
        message="Database chưa có lịch trình mẫu nào. Chạy `npm run db:seed` để nạp dữ liệu."
        onRetry={presets.reload}
      />
    );
  }

  // key: đổi lịch trình mẫu thì dựng lại state bên trong từ đầu.
  return <ItineraryPlannerView key={preset.id} {...props} preset={preset} />;
};

const ItineraryPlannerView: React.FC<ItineraryPlannerProps & { preset: PresetItinerary }> = ({
  onAskAI,
  focusDestination = '',
  preset
}) => {
  const { isAuthenticated, saveItinerary } = useAuth();

  const [selectedDuration, setSelectedDuration] = useState<number>(3);
  const [travelMode, setTravelMode] = useState<'motorbike' | 'easy_rider' | 'car_suv'>('motorbike');
  const [vibe, setVibe] = useState<'photography' | 'culture' | 'adventure' | 'chill'>('photography');
  const [budget, setBudget] = useState<'backpacker' | 'comfort' | 'luxury'>('comfort');
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Lịch trình đang xem: khởi tạo từ bản mẫu, thay bằng bản do AI sinh sau khi tạo xong.
  const [itineraryDays, setItineraryDays] = useState<DayItinerary[]>(preset.days);
  const [customTitle, setCustomTitle] = useState<string>(preset.title);
  const [overview, setOverview] = useState<string>(preset.overview);
  const [dailyTips, setDailyTips] = useState<string[]>([]);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Khi người dùng bấm "Thêm Vào Lịch Trình" từ một điểm đến cụ thể, mồi sẵn ghi chú để
  // lần tạo lịch trình kế tiếp thực sự ghé nơi đó, thay vì bỏ qua lựa chọn của họ.
  useEffect(() => {
    if (!focusDestination) return;
    setCustomPrompt(`Ưu tiên dành thời gian cho ${focusDestination}`);
  }, [focusDestination]);

  const handleGenerateAIItinerary = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/plan-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: selectedDuration,
          travelMode,
          vibe,
          budget,
          notes: customPrompt
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          [data?.error, data?.details].filter(Boolean).join(' — ') ||
            `Máy chủ trả về lỗi ${res.status}`
        );
      }

      if (!Array.isArray(data?.days) || data.days.length === 0) {
        throw new Error('Lịch trình trả về không có ngày nào. Bạn vui lòng thử lại.');
      }

      setItineraryDays(data.days);
      if (data.title) setCustomTitle(data.title);
      if (typeof data.overview === 'string' && data.overview.trim()) {
        setOverview(data.overview.trim());
      }
      // dailyTips nằm trong schema nên model luôn sinh ra; trước đây bị bỏ đi hoàn toàn.
      setDailyTips(
        Array.isArray(data.dailyTips)
          ? data.dailyTips
              .filter((tip: unknown): tip is string => typeof tip === 'string' && tip.trim().length > 0)
              .map((tip: string) => tip.trim())
          : []
      );
      setActiveDay(1);
    } catch (err) {
      console.error('Failed to generate AI itinerary:', err);
      setGenerateError(
        err instanceof Error ? err.message : 'Không tạo được lịch trình. Vui lòng thử lại.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const currentDayData = itineraryDays.find(d => d.day === activeDay) || itineraryDays[0];

  // Tổng quãng đường và dải độ cao suy ra từ chính lịch trình đang xem. Nếu để số cố định,
  // lịch trình 5 ngày do AI tạo vẫn hiển thị "~350 km" của bản mẫu 3 ngày.
  const totalKm = Math.round(itineraryDays.reduce((sum, d) => sum + (d.totalDistanceKm || 0), 0));
  const elevations = itineraryDays
    .flatMap(d => d.waypoints.map(wp => wp.elevationM))
    .filter(value => typeof value === 'number' && !Number.isNaN(value));
  const minElevationM = elevations.length ? Math.min(...elevations) : 0;
  const maxElevationM = elevations.length ? Math.max(...elevations) : 0;

  /**
   * Lưu lịch trình đang xem vào tài khoản. Chưa đăng nhập thì `saveItinerary` tự mở hộp đăng
   * nhập và trả về thất bại, nên ở đây chỉ cần hiển thị lỗi nếu có.
   */
  const handleSaveItinerary = async () => {
    setSaveError(null);
    setSaveState('saving');

    const result = await saveItinerary({
      title: customTitle,
      overview,
      totalKm,
      travelMode,
      vibe,
      budgetLevel: budget,
      days: itineraryDays
    });

    if (!result.success) {
      setSaveState('idle');
      setSaveError(result.error ?? 'Không lưu được lịch trình');
      return;
    }

    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2500);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      
      {/* Header */}
      <div className="mb-7">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#0051d5] mb-2">
          <Route className="w-3.5 h-3.5" />
          <span>Trình lập lịch trình</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
          Lập lịch trình đường đèo tối ưu
        </h2>
        {/*
          Câu cũ hứa AI "tính toán độ dốc, khúc cua, thời gian xuất phát và ánh sáng chụp ảnh
          vàng". Hệ thống không chạy phép tính nào như vậy: nó gửi số ngày, phương tiện, phong
          cách và ngân sách sang model rồi dựng lịch trình trên danh mục điểm đến. Hứa một năng
          lực không có là cách nhanh nhất để mất lòng tin vào những phần thật sự chạy.
        */}
        <p className="text-sm sm:text-base text-[#3e4947] mt-2 max-w-3xl leading-relaxed">
          Chọn số ngày, phương tiện và phong cách — hệ thống dựng lịch trình trên danh mục điểm
          đến đã khảo, kèm giờ khởi hành, độ cao từng chặng và chỗ nghỉ có giá tham khảo.
        </p>
      </div>

      {/* Control Box: Filter and Customize */}
      <div className="bg-white rounded-2xl border border-[#e0e3e1] p-6 shadow-sm mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          <ControlGroup label="Thời gian hành trình" cols={3}>
            {[
              { days: 3, label: '3N2Đ' },
              { days: 4, label: '4N3Đ' },
              { days: 5, label: '5N4Đ' }
            ].map((item) => (
              <ControlOption
                key={item.days}
                active={selectedDuration === item.days}
                onClick={() => setSelectedDuration(item.days)}
              >
                {item.label}
              </ControlOption>
            ))}
          </ControlGroup>

          <ControlGroup label="Phương tiện" cols={3}>
            <ControlOption active={travelMode === 'motorbike'} onClick={() => setTravelMode('motorbike')}>
              <Bike className="w-4 h-4 shrink-0" />
              <span>Tự lái</span>
            </ControlOption>
            <ControlOption active={travelMode === 'easy_rider'} onClick={() => setTravelMode('easy_rider')}>
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Easy Rider</span>
            </ControlOption>
            <ControlOption active={travelMode === 'car_suv'} onClick={() => setTravelMode('car_suv')}>
              <Car className="w-4 h-4 shrink-0" />
              <span>Ô tô</span>
            </ControlOption>
          </ControlGroup>

          <ControlGroup label="Phong cách trải nghiệm" cols={2}>
            {VIBE_OPTIONS.map((option) => (
              <ControlOption
                key={option.id}
                active={vibe === option.id}
                onClick={() => setVibe(option.id)}
              >
                {option.label}
              </ControlOption>
            ))}
          </ControlGroup>

          {/* Mức ngân sách: trước đây bị khoá cứng ở 'comfort' vì không có UI để chọn,
              dù server vẫn nhận và prompt vẫn có nhãn cho cả ba mức. */}
          <ControlGroup label="Mức ngân sách" cols={3}>
            {BUDGET_OPTIONS.map((option) => (
              <ControlOption
                key={option.id}
                active={budget === option.id}
                onClick={() => setBudget(option.id)}
              >
                {option.label}
              </ControlOption>
            ))}
          </ControlGroup>

        </div>

        {/*
          MỘT nút tạo lịch trình. Bản trước có hai nút gọi cùng `handleGenerateAIItinerary`:
          "Tái Tạo Lịch Trình AI" ở cột thứ tư và "Áp Dụng" cạnh ô ghi chú. Hai nút cho một
          hành động buộc người dùng phải đoán xem chúng khác nhau ở chỗ nào, mà chúng thì không.
        */}
        <div className="mt-5 pt-5 border-t border-[#e0e3e1] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="Yêu cầu thêm — ví dụ: thêm một điểm cà phê hoàng hôn ở Mã Pí Lèng, hạn chế lái sau 17h"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateAIItinerary()}
            className="flex-1 bg-white border border-[#bdc9c6] rounded-xl px-4 py-3 text-xs sm:text-sm text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#0051d5] focus:ring-1 focus:ring-[#0051d5] transition-all"
          />
          <button
            id="btn-generate-itinerary"
            onClick={handleGenerateAIItinerary}
            disabled={isGenerating}
            className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-[#005c55] to-[#0051d5] hover:from-[#004e48] hover:to-[#0042b0] text-white text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                <span>AI đang tính toán...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Tạo lịch trình</span>
              </>
            )}
          </button>
        </div>

        {/* Generation error surfaced from the server */}
        {generateError && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Không tạo được lịch trình AI</span>
              <span className="text-red-800">{generateError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Itinerary Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Day Switcher & Overview */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-white rounded-2xl border border-[#e0e3e1] p-5 shadow-xs">
            <h3 className="font-display text-lg font-bold text-[#181c1c] mb-2 leading-snug">
              {customTitle}
            </h3>
            <p className="text-xs text-[#3e4947] leading-relaxed mb-4">
              {overview}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#181c1c] bg-[#f1f4f3] p-3 rounded-xl mb-4">
              <div>
                <span className="text-[#6e7977] block text-[11px]">Tổng quãng đường</span>
                <span className="font-semibold text-sm">~{totalKm.toLocaleString('vi-VN')} km</span>
              </div>
              <div>
                <span className="text-[#6e7977] block text-[11px]">Độ cao dao động</span>
                <span className="font-semibold text-sm">
                  {minElevationM.toLocaleString('vi-VN')}m - {maxElevationM.toLocaleString('vi-VN')}m
                </span>
              </div>
            </div>

            {/* Lưu lịch trình vào tài khoản. Nút chỉ hiện khi đã đăng nhập — mời đăng nhập
                bằng một nút "Lưu" rồi bật hộp thoại lên là kiểu dẫn dụ không cần thiết. */}
            {isAuthenticated && (
              <div className="mb-4">
                <button
                  onClick={handleSaveItinerary}
                  disabled={saveState !== 'idle'}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#005c55] text-[#005c55] hover:bg-[#005c55] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-[#005c55]"
                >
                  {saveState === 'saving' && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {saveState === 'saved' && <Check className="w-4 h-4 text-emerald-600" />}
                  {saveState === 'idle' && <BookmarkPlus className="w-4 h-4" />}
                  <span>
                    {saveState === 'saving'
                      ? 'Đang lưu...'
                      : saveState === 'saved'
                        ? 'Đã lưu vào hồ sơ'
                        : 'Lưu lịch trình'}
                  </span>
                </button>

                {saveError && (
                  <p className="mt-2 text-[11px] text-red-700 leading-relaxed">{saveError}</p>
                )}
              </div>
            )}

            {/* Day Selector Buttons */}
            <div className="space-y-2">
              {itineraryDays.map((d) => (
                <div
                  key={d.day}
                  id={`tab-day-${d.day}`}
                  onClick={() => setActiveDay(d.day)}
                  className={`p-3.5 rounded-xl cursor-pointer border transition-all ${
                    activeDay === d.day
                      ? 'bg-[#005c55] text-white border-[#005c55] shadow-sm'
                      : 'bg-white text-[#181c1c] border-[#e0e3e1] hover:border-[#bdc9c6] hover:bg-[#f7faf8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      activeDay === d.day ? 'bg-white/20 text-white' : 'bg-[#ebefed] text-[#005c55]'
                    }`}>
                      Ngày 0{d.day}
                    </span>
                    <span className={`text-xs ${activeDay === d.day ? 'text-white/80' : 'text-[#6e7977]'}`}>
                      {d.totalDistanceKm} km • ~{d.ridingHours}h lái
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-semibold truncate">
                    {d.title}
                  </h4>
                </div>
              ))}
            </div>

          </div>

          {/* Evening Stay Recommendation Card */}
          {currentDayData?.eveningStay && (
            <div className="glass-card rounded-2xl p-5 border border-[#bdc9c6]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#005c55] mb-2">
                <Bed className="w-4 h-4 text-[#005c55]" />
                <span>Nơi Nghỉ Đêm Gợi Ý</span>
              </div>
              <h4 className="font-display text-base font-bold text-[#181c1c]">
                {currentDayData.eveningStay.name}
              </h4>
              <p className="text-xs text-[#3e4947] mt-1">
                {currentDayData.eveningStay.type} • {currentDayData.eveningStay.vibe}
              </p>
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-[#e0e3e1] text-xs">
                <span className="text-[#6e7977]">Chi phí dự kiến</span>
                <span className="font-bold text-[#005c55]">{currentDayData.eveningStay.priceEstimate}</span>
              </div>
            </div>
          )}

          {/* Mẹo cho cả hành trình. Model vẫn luôn sinh dailyTips theo schema, trước đây
              không hiển thị ở đâu nên coi như trả tiền token cho dữ liệu bỏ đi. */}
          {dailyTips.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#e0e3e1] p-5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0051d5] mb-3">
                <Sparkles className="w-4 h-4" />
                <span>Mẹo Cho Cả Hành Trình</span>
              </div>
              <ul className="space-y-2 text-xs text-[#3e4947] leading-relaxed list-disc pl-4 marker:text-[#0051d5]">
                {dailyTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Right Side: Timeline of Waypoints */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-[#e0e3e1] p-6 shadow-xs">
            
            {/* Day Header Banner */}
            <div className="pb-6 mb-6 border-b border-[#e0e3e1]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-[#005c55] text-white text-xs font-bold uppercase">
                    Ngày {currentDayData.day}
                  </span>
                  <span className="text-xs text-[#6e7977]">
                    {currentDayData.startPoint} &rarr; {currentDayData.endPoint}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold text-[#181c1c] mt-1.5">
                  {currentDayData.title}
                </h3>
                <p className="text-xs text-[#3e4947] mt-0.5">
                  {currentDayData.theme}
                </p>

                {/* scenicRating và maxElevationM là trường required trong schema nhưng
                    trước đây không được render ở bất kỳ đâu. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-[#6e7977]">
                  {typeof currentDayData.scenicRating === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, starIdx) => (
                        <Star
                          key={starIdx}
                          className={`w-3.5 h-3.5 ${
                            starIdx < currentDayData.scenicRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-[#bdc9c6]'
                          }`}
                        />
                      ))}
                      <span className="ml-0.5">Cảnh quan {currentDayData.scenicRating}/5</span>
                    </span>
                  )}

                  {typeof currentDayData.maxElevationM === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      <Mountain className="w-3.5 h-3.5 text-[#005c55]" />
                      <span>Cao nhất {currentDayData.maxElevationM.toLocaleString('vi-VN')}m</span>
                    </span>
                  )}

                  {typeof currentDayData.ridingHours === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#005c55]" />
                      <span>~{currentDayData.ridingHours}h lái</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Vertical Timeline Nodes */}
            <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#0051d5]/30">
              {currentDayData.waypoints.map((wp, idx) => (
                <div key={wp.id || idx} className="relative group">
                  
                  {/* Timeline Smart Node Pin */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-[#0051d5] flex items-center justify-center shadow-xs group-hover:scale-125 transition-transform">
                    <span className="w-2 h-2 rounded-full bg-[#0051d5]" />
                  </div>

                  {/* Waypoint Card */}
                  <div className="bg-[#f7faf8] group-hover:bg-[#ebefed] transition-colors rounded-xl p-4 border border-[#e0e3e1]">
                    
                    {/* Time, Distance & Altitude Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#181c1c] text-white text-[11px] font-mono font-bold">
                          {wp.time}
                        </span>
                        <h4 className="font-display text-base font-bold text-[#181c1c]">
                          {wp.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] text-[#3e4947] font-medium flex items-center gap-1">
                          <Mountain className="w-3 h-3 text-[#005c55]" />
                          {wp.elevationM}m
                        </span>
                        <span className="text-[#6e7977] text-[11px]">
                          Km {wp.distanceKm}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#3e4947] mb-3">
                      {wp.subtitle}
                    </p>

                    {/* Highlight Pill */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#005c55]/10 text-[#005c55] text-xs font-semibold mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{wp.highlight}</span>
                    </div>

                    {/* AI Smart Tip Box */}
                    {wp.aiTip && (
                      <div className="glass-ai rounded-xl p-3 text-xs text-[#181c1c] flex items-start gap-2.5 mt-2">
                        <Sparkles className="w-4 h-4 text-[#0051d5] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#0051d5] block text-[11px] uppercase tracking-wider">
                            AI Thổ Địa Khuyên:
                          </span>
                          <span className="text-[#3e4947] leading-relaxed">{wp.aiTip}</span>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-[#e0e3e1] flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => onAskAI(`Hãy tư vấn chi tiết hơn về các điểm dừng trong Ngày ${activeDay} của cung đường Hà Giang`)}
                className="flex items-center gap-2 text-xs font-semibold text-[#0051d5] hover:underline"
              >
                <Sparkles className="w-4 h-4" />
                <span>Hỏi AI về mẹo chuẩn bị cho Ngày {activeDay} &rarr;</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  disabled={activeDay <= 1}
                  onClick={() => setActiveDay(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#bdc9c6] text-xs font-medium disabled:opacity-30"
                >
                  &larr; Ngày Trước
                </button>
                <button
                  disabled={activeDay >= itineraryDays.length}
                  onClick={() => setActiveDay(prev => Math.min(itineraryDays.length, prev + 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-[#005c55] text-white text-xs font-semibold disabled:opacity-30"
                >
                  Ngày Kế Tiếp &rarr;
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

    </section>
  );
};
