import React, { useEffect, useMemo, useState } from 'react';
import type { GearItem, WeatherPassStatus } from '../types';
import { useCostAssumptions, useGearChecklist, useHomestays } from '../hooks/useContent';
import type { CostAssumptions } from '../hooks/useContent';
import { ErrorState, LoadingState } from './LoadingState';
import {
  ShieldCheck, CheckSquare, Square, AlertTriangle, Home, Star,
  HeartHandshake, CloudRain, Calculator, Sparkles
} from 'lucide-react';

/**
 * Trạng thái tick của checklist vẫn ở localStorage, không đưa vào database: checklist phải
 * dùng được khi chưa đăng nhập, và nó gắn với thiết bị người dùng đang đóng đồ hơn là với
 * tài khoản.
 *
 * Điểm khác bản cũ: chỉ lưu **danh sách slug đã tick**, không lưu cả mảng GearItem. Trước
 * đây lưu cả mảng nên khi danh mục trong database đổi (thêm món, sửa ghi chú), người dùng cũ
 * vẫn thấy bản chụp cũ mãi mãi.
 */
const CHECKED_STORAGE_KEY = 'hagiang_gear_checked';

/** null nghĩa là chưa từng lưu gì — khi đó dùng defaultChecked của danh mục. */
function readCheckedSlugs(): string[] | null {
  try {
    const raw = localStorage.getItem(CHECKED_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * Đơn giá tham khảo cho máy tính chi phí, đơn vị VNĐ. Trước đây các số này nằm rải rác
 * ngay trong biểu thức tính nên không ai biết phải sửa ở đâu khi giá thay đổi. Đây là mặt
 * bằng ước lượng tại thời điểm 09/2026 và sẽ lạc hậu — sửa ở đây là sửa cả bảng dự toán.
 *
 * Lưu ý: các con số này độc lập với `pricePerNight` của HOMESTAYS và với mức `budget`
 * của trình lập lịch trình; ba nguồn giá trong ứng dụng hiện chưa được hợp nhất.
 */
/**
 * Giá trị dự phòng khi chưa tải được đơn giá từ server. Giữ đúng bộ số đã dùng từ Vòng 2 để
 * bảng dự toán vẫn hiển thị được con số hợp lý thay vì toàn số 0 trong lúc đang tải.
 */
const FALLBACK_COSTS: CostAssumptions = {
  bikeRentPerDay: 180_000,
  easyRiderPerDay: 900_000,
  fuelPerDay: 100_000,
  stayPerNight: { dorm: 150_000, private_room: 450_000, ecolodge: 900_000 },
  foodPerDay: 300_000,
  attractionTickets: 250_000,
  busHanoiRoundTrip: 600_000
};

interface PocketGuideSectionProps {
  onAskAI: (query: string) => void;
  /** Số liệu đèo tham khảo, App lấy một lần rồi truyền xuống (navbar cũng dùng). */
  passWeather: WeatherPassStatus[];
}

export const PocketGuideSection: React.FC<PocketGuideSectionProps> = ({
  onAskAI,
  passWeather
}) => {
  const gearContent = useGearChecklist();
  const homestayContent = useHomestays();
  const costContent = useCostAssumptions();
  const [checkedSlugs, setCheckedSlugs] = useState<string[] | null>(() => readCheckedSlugs());

  const [activeGuideTab, setActiveGuideTab] = useState<'checklist' | 'safety' | 'homestays' | 'budget'>('checklist');

  // Budget Calculator state
  const [tripDays, setTripDays] = useState<number>(3);
  const [riderType, setRiderType] = useState<'self_drive' | 'easy_rider'>('self_drive');
  const [stayStyle, setStayStyle] = useState<'dorm' | 'private_room' | 'ecolodge'>('private_room');

  // Lần đầu dùng: lấy mặc định từ danh mục trong database.
  useEffect(() => {
    if (checkedSlugs === null && gearContent.data) {
      setCheckedSlugs(gearContent.data.filter((item) => item.checked).map((item) => item.id));
    }
  }, [checkedSlugs, gearContent.data]);

  useEffect(() => {
    if (checkedSlugs) {
      localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify(checkedSlugs));
    }
  }, [checkedSlugs]);

  const gearList: GearItem[] = useMemo(() => {
    const catalog = gearContent.data ?? [];
    if (!checkedSlugs) return catalog;

    const checked = new Set(checkedSlugs);
    return catalog.map((item) => ({ ...item, checked: checked.has(item.id) }));
  }, [gearContent.data, checkedSlugs]);

  const toggleGearItem = (id: string) => {
    setCheckedSlugs((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return [...next];
    });
  };

  const checkedCount = gearList.filter(g => g.checked).length;
  const progressPercent = gearList.length
    ? Math.round((checkedCount / gearList.length) * 100)
    : 0;

  // Dự toán chi phí một người, đơn vị VNĐ. Công thức PHẢI giữ khớp với estimateTripCost trong
  // server/costs.ts — cùng một bộ đơn giá, cùng một cách tính, nên chatbot và máy tính này luôn
  // ra cùng con số.
  const COST_ASSUMPTIONS = costContent.data ?? FALLBACK_COSTS;
  const nights = Math.max(0, tripDays - 1);
  const bikeCost =
    tripDays *
    (riderType === 'self_drive'
      ? COST_ASSUMPTIONS.bikeRentPerDay
      : COST_ASSUMPTIONS.easyRiderPerDay);
  const gasCost = riderType === 'self_drive' ? tripDays * COST_ASSUMPTIONS.fuelPerDay : 0;
  const stayCost = nights * COST_ASSUMPTIONS.stayPerNight[stayStyle];
  const foodCost = tripDays * COST_ASSUMPTIONS.foodPerDay;
  const ticketCost = COST_ASSUMPTIONS.attractionTickets;
  const busHanoiCost = COST_ASSUMPTIONS.busHanoiRoundTrip;
  const totalEstimatedCost = bikeCost + gasCost + stayCost + foodCost + ticketCost + busHanoiCost;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      
      {/* Header */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#005c55]/10 border border-[#005c55]/20 text-[#005c55] text-xs font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Highlands Survival & Trip Toolkit</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
          Sổ Tay Bỏ Túi & Tiện Ích Chuyến Đi
        </h2>
        <p className="text-sm sm:text-base text-[#3e4947] mt-1">
          Checklist đồ bảo hộ, quy tắc an toàn vượt đèo, homestay bản địa và dự toán ngân sách chi tiết.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-center gap-2 mb-10 overflow-x-auto pb-2">
        {[
          { id: 'checklist', label: '🎒 Checklist Hành Trang', icon: CheckSquare },
          { id: 'safety', label: '🛡️ Quy Tắc An Toàn Đèo', icon: AlertTriangle },
          { id: 'homestays', label: '🏡 Homestay Bản Địa', icon: Home },
          { id: 'budget', label: '💵 Dự Toán Ngân Sách', icon: Calculator },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveGuideTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeGuideTab === tab.id
                  ? 'bg-[#005c55] text-white shadow-sm'
                  : 'bg-white text-[#3e4947] border border-[#e0e3e1] hover:bg-[#f1f4f3]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content 1: Checklist */}
      {activeGuideTab === 'checklist' && gearContent.isLoading && (
        <LoadingState label="Đang tải danh mục đồ mang theo..." />
      )}

      {activeGuideTab === 'checklist' && gearContent.error && (
        <ErrorState message={gearContent.error} onRetry={gearContent.reload} />
      )}

      {activeGuideTab === 'checklist' && !gearContent.isLoading && !gearContent.error && (
        <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 sm:p-8 shadow-xs max-w-4xl mx-auto">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#e0e3e1]">
            <div>
              <h3 className="font-display text-xl font-bold text-[#181c1c]">
                Checklist Đồ Bảo Hộ & Hành Lý Vượt Đèo
              </h3>
              <p className="text-xs text-[#3e4947] mt-0.5">
                Đánh dấu các món đồ bạn đã chuẩn bị sẵn sàng trước khi lên đường.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="sm:w-56 bg-[#f1f4f3] p-3 rounded-2xl border border-[#e0e3e1]">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-[#005c55]">Đã chuẩn bị:</span>
                <span className="text-[#181c1c]">{checkedCount}/{gearList.length} món ({progressPercent}%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#e0e3e1] overflow-hidden">
                <div 
                  className="h-full bg-[#005c55] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gearList.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleGearItem(item.id)}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  item.checked
                    ? 'bg-[#005c55]/5 border-[#005c55]/30'
                    : 'bg-[#f7faf8] border-[#e0e3e1] hover:border-[#bdc9c6]'
                }`}
              >
                <div className="mt-0.5 text-[#005c55]">
                  {item.checked ? (
                    <CheckSquare className="w-5 h-5 fill-[#005c55] text-white" />
                  ) : (
                    <Square className="w-5 h-5 text-[#bdc9c6]" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${item.checked ? 'text-[#005c55] line-through' : 'text-[#181c1c]'}`}>
                      {item.name}
                    </span>
                    {item.recommended && (
                      <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Cần thiết
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6e7977] mt-0.5 leading-snug">
                    {item.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-[#e0e3e1] flex justify-between items-center text-xs text-[#6e7977]">
            <span>Dữ liệu được tự động lưu vào trình duyệt của bạn</span>
            <button
              onClick={() => onAskAI("Hãy tư vấn thêm về cách chọn mũ bảo hiểm và đồ bảo hộ phượt đèo Hà Giang")}
              className="text-[#0051d5] font-semibold hover:underline"
            >
              Hỏi AI thêm về đồ đạc &rarr;
            </button>
          </div>

        </div>
      )}

      {/* Tab Content 2: Road Safety */}
      {activeGuideTab === 'safety' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">

          {/* PASS_WEATHER_STATION trước đây được import nhưng không render ở đâu, và mỗi
              trạm mang một chuỗi "Vừa cập nhật N phút trước" giả. Nay hiển thị thật kèm
              đúng một lời cảnh báo rằng đây là số liệu tham khảo, không phải quan trắc. */}
          <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 shadow-xs md:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#181c1c]">
                  Điều Kiện Các Đỉnh Đèo
                </h3>
                <p className="text-xs text-[#3e4947] mt-1 leading-relaxed">
                  Số liệu tham khảo theo mùa khô, dùng để ước lượng khi chuẩn bị đồ. Ứng dụng
                  chưa kết nối API thời tiết nên đây <strong className="font-semibold">không phải
                  quan trắc thời gian thực</strong> — hãy kiểm tra dự báo trong ngày trước khi lên đèo.
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center shrink-0">
                <CloudRain className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {passWeather.map((station) => (
                <div
                  key={station.location}
                  className="bg-[#f7faf8] rounded-xl border border-[#e0e3e1] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#181c1c] leading-snug">
                      {station.location}
                    </span>
                    <span className="font-display text-lg font-bold text-[#005c55] shrink-0 leading-none">
                      {station.temp}°C
                    </span>
                  </div>

                  <p className="text-[11px] text-[#3e4947] mt-1.5 leading-relaxed">
                    {station.condition}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] text-[#3e4947]">
                      {station.elevation.toLocaleString('vi-VN')}m
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] text-[#3e4947]">
                      Gió {station.windSpeedKm} km/h
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-900">
                      {station.fogLevel}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        station.roadStatus === 'An toàn'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {station.roadStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#181c1c] mb-2">
              Quy Tắc "Lên Số Nào - Xuống Số Đó"
            </h3>
            <p className="text-xs text-[#3e4947] leading-relaxed mb-4">
              Khi xuống các con dốc dài như Mã Pí Lèng, Dốc Bắc Sum, Dốc Thẩm Mã: Hãy về số 2 (hoặc số 1 nếu dốc quá đứng) để tận dụng lực hãm động cơ (Engine Braking). Tuyệt đối không bóp phanh liên tục hoặc tắt máy thả trôi, điều này sẽ làm cháy bố phanh và mất lái hoàn toàn.
            </p>
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 font-medium">
              ⚠️ Tuyệt đối không đi xe ga nếu chưa có kinh nghiệm đổ đèo dốc núi cao!
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center mb-4">
              <CloudRain className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#181c1c] mb-2">
              Xử Lý Sương Mù & Khúc Cua Mù
            </h3>
            <p className="text-xs text-[#3e4947] leading-relaxed mb-4">
              Tại các đoạn cua tay áo khuất tầm nhìn, luôn bấm còi báo hiệu từ xa, giảm tốc dưới 25km/h và đi bám sát phần đường bên phải. Khi gặp sương mù dày tại Cổng Trời hoặc Lũng Cú, bật đèn cốt (chiếu gần), dán decal vàng lên đèn pha nếu có để tăng độ bám đường.
            </p>
            <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 font-medium">
              💡 Mẹo: Nhường đường hoàn toàn cho các xe tải chở đá lớn đang lên dốc.
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 shadow-xs md:col-span-2">
            <div className="w-10 h-10 rounded-xl bg-[#005c55]/10 text-[#005c55] flex items-center justify-center mb-4">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#181c1c] mb-2">
              Văn Hoá Ứng Xử & Tôn Trọng Bản Địa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#3e4947] mt-3">
              <div className="bg-[#f7faf8] p-3.5 rounded-xl border border-[#e0e3e1]">
                <strong className="text-[#181c1c] block mb-1">Trẻ em vùng cao:</strong>
                Không cho tiền mặt trực tiếp. Nên tặng bánh kẹo, sách vở hoặc ủng hộ qua thầy cô giáo tại điểm trường.
              </div>
              <div className="bg-[#f7faf8] p-3.5 rounded-xl border border-[#e0e3e1]">
                <strong className="text-[#181c1c] block mb-1">Nhà trình tường:</strong>
                Không ngồi hoặc bước lên ngưỡng cửa nhà người H'Mông. Xin phép chủ nhà trước khi vào tham quan gian thờ.
              </div>
              <div className="bg-[#f7faf8] p-3.5 rounded-xl border border-[#e0e3e1]">
                <strong className="text-[#181c1c] block mb-1">Bảo vệ môi trường:</strong>
                Không xả rác tại các mỏm đá ngắm cảnh Mã Pí Lèng, bến thuyền Nho Quế và thác Ba Tiên Du Già.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab Content 3: Homestays */}
      {activeGuideTab === 'homestays' && homestayContent.isLoading && (
        <LoadingState label="Đang tải danh sách homestay..." />
      )}

      {activeGuideTab === 'homestays' && homestayContent.error && (
        <ErrorState message={homestayContent.error} onRetry={homestayContent.reload} />
      )}

      {activeGuideTab === 'homestays' && !homestayContent.isLoading && !homestayContent.error && (
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-[#3e4947] bg-[#f1f4f3] border border-[#e0e3e1] rounded-xl p-3.5 mb-6 leading-relaxed">
            Danh sách tham khảo để hình dung mức giá và phong cách lưu trú. Điểm đánh giá và
            số lượt nhận xét là dữ liệu mẫu, chưa nối với hệ thống đặt phòng thật — hãy xác
            nhận giá và tình trạng phòng trực tiếp với chủ nhà trước khi đi.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(homestayContent.data ?? []).map((hs) => (
              <div
                key={hs.id}
                className="bg-white rounded-3xl border border-[#e0e3e1] overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div className="relative h-48 bg-[#2d3130]">
                  <img
                    src={hs.imageUrl}
                    alt={hs.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{hs.rating} ({hs.reviewCount})</span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-display text-lg font-bold text-[#181c1c] mb-1">
                      {hs.name}
                    </h4>
                    <p className="text-xs text-[#6e7977] mb-3">
                      {hs.location}
                    </p>
                    <p className="text-xs text-[#3e4947] line-clamp-2 leading-relaxed mb-4">
                      {hs.highlight}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {hs.tags.map((t, idx) => (
                        <span key={idx} className="text-[11px] bg-[#f1f4f3] text-[#005c55] font-medium px-2 py-0.5 rounded-md">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#e0e3e1] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#6e7977] block">Giá chỉ từ</span>
                      <span className="font-bold text-sm text-[#005c55]">
                        {hs.pricePerNight.toLocaleString('vi-VN')} đ/đêm
                      </span>
                    </div>

                    {/* Trước đây là link tel: tới một số điện thoại bịa — bấm vào là gọi
                        thật vào số không tồn tại. Thay bằng đường hỏi AI, và trường phone
                        đã được xoá khỏi HomestaySpot. */}
                    <button
                      onClick={() =>
                        onAskAI(
                          `Tư vấn về ${hs.name} tại ${hs.location}: cách liên hệ đặt phòng, giá thực tế theo mùa và kinh nghiệm lưu trú ở đây`
                        )
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Hỏi AI về chỗ này</span>
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: Budget Calculator */}
      {activeGuideTab === 'budget' && (
        <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 sm:p-8 shadow-xs max-w-4xl mx-auto">
          
          <div className="mb-6 pb-6 border-b border-[#e0e3e1]">
            <h3 className="font-display text-2xl font-bold text-[#181c1c]">
              Dự Toán Chi Phí Phượt Hà Giang Tự Động
            </h3>
            <p className="text-xs text-[#3e4947] mt-1">
              Ước tính chi phí trung bình cho một người bao gồm xe cộ, ăn uống, lưu trú và vé thắng cảnh.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            
            <div>
              <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
                Số Ngày Đi
              </label>
              <select
                value={tripDays}
                onChange={(e) => setTripDays(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-[#f7faf8] border border-[#e0e3e1] text-xs font-medium text-[#181c1c]"
              >
                <option value={2}>2 Ngày 1 Đêm</option>
                <option value={3}>3 Ngày 2 Đêm (Khuyến nghị)</option>
                <option value={4}>4 Ngày 3 Đêm</option>
                <option value={5}>5 Ngày 4 Đêm</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
                Hình Thức Lái Xe
              </label>
              <select
                value={riderType}
                onChange={(e) => setRiderType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-[#f7faf8] border border-[#e0e3e1] text-xs font-medium text-[#181c1c]"
              >
                <option value="self_drive">Tự thuê lái xe máy (Wave / Blade)</option>
                <option value="easy_rider">Thuê xế Easy Rider bản địa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
                Hạng Phòng Lưu Trú
              </label>
              <select
                value={stayStyle}
                onChange={(e) => setStayStyle(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-[#f7faf8] border border-[#e0e3e1] text-xs font-medium text-[#181c1c]"
              >
                <option value="dorm">Phòng Dorm tập thể (150k/đêm)</option>
                <option value="private_room">Phòng riêng Homestay (450k/đêm)</option>
                <option value="ecolodge">Ecolodge & Resort view núi (900k/đêm)</option>
              </select>
            </div>

          </div>

          {/* Breakdown Table */}
          <div className="bg-[#f7faf8] rounded-2xl p-5 border border-[#e0e3e1] mb-6 space-y-3 text-xs">
            <div className="flex justify-between text-[#3e4947]">
              <span>Xe giường nằm khứ hồi Hà Nội - Hà Giang:</span>
              <span className="font-semibold text-[#181c1c]">{busHanoiCost.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-[#3e4947]">
              <span>Chi phí thuê xe máy / Easy rider ({tripDays} ngày):</span>
              <span className="font-semibold text-[#181c1c]">{bikeCost.toLocaleString('vi-VN')} đ</span>
            </div>
            {gasCost > 0 && (
              <div className="flex justify-between text-[#3e4947]">
                <span>Tiền xăng xe ({tripDays} ngày):</span>
                <span className="font-semibold text-[#181c1c]">{gasCost.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            <div className="flex justify-between text-[#3e4947]">
              <span>Tiền phòng Homestay ({tripDays - 1} đêm):</span>
              <span className="font-semibold text-[#181c1c]">{stayCost.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-[#3e4947]">
              <span>Tiền ăn uống đặc sản ({tripDays} ngày):</span>
              <span className="font-semibold text-[#181c1c]">{foodCost.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-[#3e4947]">
              <span>Vé thuyền Nho Quế, Cột Cờ Lũng Cú & Dinh Vua Mèo:</span>
              <span className="font-semibold text-[#181c1c]">{ticketCost.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          {/* Total Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#005c55] to-[#0f766e] text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-200 block font-semibold">
                Tổng Chi Phí Dự Kiến / 1 Người
              </span>
              <span className="font-display text-3xl font-bold">
                {totalEstimatedCost.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>

            <button
              onClick={() => onAskAI(`Tư vấn cách tối ưu chi phí cho chuyến đi Hà Giang ${tripDays} ngày với mức ngân sách khoảng ${totalEstimatedCost.toLocaleString('vi-VN')}đ`)}
              className="px-5 py-3 rounded-xl bg-white text-[#005c55] hover:bg-emerald-50 text-xs font-bold shadow-md transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#005c55]" />
              <span>Hỏi AI Cách Tiết Kiệm Thêm</span>
            </button>
          </div>

        </div>
      )}

    </section>
  );
};
