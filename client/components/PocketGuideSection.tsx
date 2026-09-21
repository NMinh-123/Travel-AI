import React, { useEffect, useMemo, useState } from 'react';
import type { GearItem, HomestaySpot, WeatherPassStatus } from '@shared/types';
import { useCostAssumptions, useGearChecklist } from '@client/hooks/useContent';
import { PlaceMap } from './PlaceMap';
import { ControlGroup, ControlOption } from './ControlGroup';
import type { ContentState, CostAssumptions } from '@client/hooks/useContent';
import { ErrorState, LoadingState } from './LoadingState';
import {
  ShieldCheck, CheckSquare, Square, AlertTriangle, Home, Star,
  HeartHandshake, CloudRain, Calculator, Sparkles, MapPin
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

/**
 * Làm tròn giá phòng tới nghìn đồng trước khi hiển thị.
 *
 * `pricePerNight` là giá quan sát được một lần trên iVIVU, đã gồm thuế phí, nên ra những con số
 * kiểu 857.912đ. In nguyên tới hàng đơn vị khiến một ước lượng trông như giá niêm yết; đến lúc
 * khách đặt thật thì con số đã khác. Giá trị gốc vẫn giữ nguyên trong dữ liệu để còn đối chiếu,
 * chỉ riêng phần hiển thị được làm tròn — giống cách `priceLabel` ở server/domain/lodging.ts làm
 * cho câu trả lời của chatbot, để hai nơi nói cùng một con số.
 */
function formatNightlyPrice(vnd: number): string {
  return (Math.round(vnd / 1000) * 1000).toLocaleString('vi-VN');
}

interface PocketGuideSectionProps {
  onAskAI: (query: string) => void;
  /** Số liệu đèo tham khảo, App lấy một lần rồi truyền xuống (navbar cũng dùng). */
  passWeather: WeatherPassStatus[];
  /**
   * Danh sách chỗ nghỉ, kèm nguyên trạng thái tải chứ không chỉ mảng dữ liệu: phần dưới còn
   * cần phân biệt "đang tải" với "lỗi" để vẽ hai màn khác nhau. App lấy một lần vì ô số trong
   * hero cũng đếm trên chính danh sách này.
   */
  homestays: ContentState<HomestaySpot[]>;
}

export const PocketGuideSection: React.FC<PocketGuideSectionProps> = ({
  onAskAI,
  passWeather,
  homestays
}) => {
  const gearContent = useGearChecklist();
  const homestayContent = homestays;
  const costContent = useCostAssumptions();
  const [checkedSlugs, setCheckedSlugs] = useState<string[] | null>(() => readCheckedSlugs());

  const [activeGuideTab, setActiveGuideTab] = useState<'checklist' | 'safety' | 'homestays' | 'budget'>('checklist');
  /**
   * Thẻ chỗ nghỉ nào đang mở bản đồ. Chỉ MỘT tại một thời điểm, và đó là quyết định có chủ đích:
   * danh sách có hai mươi thẻ, mở hết cùng lúc là hai mươi iframe Google Maps trong một trang.
   * Kể cả với `loading="lazy"` thì cuộn qua vẫn nạp dần từng cái, và đó vừa là trang nặng vừa là
   * hai mươi lượt gọi tới Google cho một người chỉ muốn xem một chỗ.
   */
  const [openMapId, setOpenMapId] = useState<string | null>(null);

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
  // server/domain/costs.ts — cùng một bộ đơn giá, cùng một cách tính, nên chatbot và máy tính này luôn
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
      <div className="mb-7">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#005c55] mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sổ tay bỏ túi</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
          Chuẩn bị trước khi lên đèo
        </h2>
        <p className="text-sm sm:text-base text-[#3e4947] mt-2 max-w-3xl leading-relaxed">
          Danh mục đồ bảo hộ, điều kiện tham khảo ở từng đỉnh đèo, chỗ nghỉ kèm giá và một bảng
          dự toán dùng chung đơn giá với trợ lý AI.
        </p>
      </div>

            {/*
        Nhãn thẻ con bỏ emoji. Mỗi nhãn trước đây mang một emoji NGAY CẠNH một icon SVG đã vẽ
        sẵn: hai ký hiệu cho cùng một việc, mà emoji thì mỗi hệ điều hành lại vẽ một kiểu và
        không nhận màu của thương hiệu. Giữ icon, bỏ emoji.
      */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'checklist', label: 'Hành trang', icon: CheckSquare },
          { id: 'safety', label: 'An toàn đèo', icon: AlertTriangle },
          { id: 'homestays', label: 'Chỗ nghỉ', icon: Home },
          { id: 'budget', label: 'Dự toán ngân sách', icon: Calculator },
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

          {/*
            Nhiệt độ và gió là SỐ ĐO THẬT lấy trong lượt tải trang; mức sương, tình trạng mặt
            đường và ghi chú cua dốc là phần biên tập, đúng quanh năm chứ không đo được.

            Bản trước lấy cả nhiệt độ từ bảng tĩnh và tự khai "ứng dụng chưa kết nối API thời
            tiết" — câu đó đúng lúc viết nhưng đã lạc hậu, trong khi bảng vẫn báo đỉnh Mã Pí Lèng
            9°C giữa tháng 9, lệch gần mười độ so với thực tế.
          */}
          <div className="bg-white rounded-3xl border border-[#e0e3e1] p-6 shadow-xs md:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#181c1c]">
                  Điều Kiện Các Đỉnh Đèo
                </h3>
                <p className="text-xs text-[#3e4947] mt-1 leading-relaxed">
                  Nhiệt độ và gió là số đo lấy từ trạm dự báo theo đúng độ cao từng điểm, kèm giờ
                  quan trắc. Mức sương và tình trạng mặt đường là ghi chú biên tập theo mùa,{' '}
                  <strong className="font-semibold">không phải cảnh báo chính thức</strong> của cơ
                  quan quản lý đường bộ — thời tiết trên đèo đổi rất nhanh, hãy kiểm lại trước khi đi.
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
                      {station.live ? station.live.tempC : station.temp}°C
                    </span>
                  </div>

                  {/* Trạng thái bầu trời lấy từ mã thời tiết của nhà cung cấp khi có số đo; câu
                      mô tả theo mùa trong bảng chỉ dùng khi tra cứu hỏng. */}
                  <p className="text-[11px] text-[#3e4947] mt-1.5 leading-relaxed">
                    {station.live ? station.live.condition : station.condition}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] text-[#3e4947]">
                      {station.elevation.toLocaleString('vi-VN')}m
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] text-[#3e4947]">
                      Gió {station.live ? station.live.windSpeedKmh : station.windSpeedKm} km/h
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

                  {/*
                    Mỗi thẻ tự khai số của mình đến từ đâu. Không có dòng này thì hai loại dữ
                    liệu rất khác nhau — một cái đo lúc 15h hôm nay, một cái ước lượng theo mùa —
                    trông giống hệt nhau trên cùng một tấm thẻ.
                  */}
                  <p className="text-[10px] text-[#6e7977] mt-2 leading-relaxed">
                    {station.live ? (
                      <>
                        Đo tại {station.live.point}
                        {station.live.observedAtLocal
                          ? ` lúc ${station.live.observedAtLocal.slice(11, 16)} ngày ${station.live.observedAtLocal.slice(8, 10)}/${station.live.observedAtLocal.slice(5, 7)}`
                          : ''}
                        {station.live.visibilityM !== null
                          ? ` · tầm nhìn ${station.live.visibilityM.toLocaleString('vi-VN')}m`
                          : ''}
                      </>
                    ) : (
                      <span className="text-amber-700">
                        Chưa lấy được số đo lúc này — nhiệt độ và gió ở trên là ước lượng theo mùa.
                      </span>
                    )}
                  </p>
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
                        {formatNightlyPrice(hs.pricePerNight)} đ/đêm
                      </span>
                    </div>

                    {/* Trước đây là link tel: tới một số điện thoại bịa — bấm vào là gọi
                        thật vào số không tồn tại. Thay bằng đường hỏi AI, và trường phone
                        đã được xoá khỏi HomestaySpot. */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Nút bản đồ chỉ hiện khi cơ sở CÓ toạ độ. Cột lat/lng là nullable ở
                          database, nên một cơ sở vừa thêm mà chưa seed lại sẽ không có — khi đó
                          ẩn nút đúng hơn là hiện một nút bấm vào ra bản đồ sai chỗ. */}
                      {hs.coordinates && (
                        <button
                          onClick={() => setOpenMapId(openMapId === hs.id ? null : hs.id)}
                          aria-expanded={openMapId === hs.id}
                          className="px-3 py-2 rounded-xl border border-[#e0e3e1] hover:bg-[#f1f4f3] text-[#2c3733] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{openMapId === hs.id ? 'Ẩn bản đồ' : 'Bản đồ'}</span>
                        </button>
                      )}
                      <button
                        onClick={() =>
                          onAskAI(
                            `Tư vấn về ${hs.name} tại ${hs.location}: cách liên hệ đặt phòng, giá thực tế theo mùa và kinh nghiệm lưu trú ở đây`
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Hỏi AI</span>
                      </button>
                    </div>
                  </div>

                  {hs.coordinates && openMapId === hs.id && (
                    <div className="pt-4">
                      <PlaceMap
                        lat={hs.coordinates.lat}
                        lng={hs.coordinates.lng}
                        name={hs.name}
                        // Thu nhỏ hơn điểm đến: toạ độ chỗ nghỉ chỉ chính xác tới mức xã hoặc bản,
                        // nên phóng to sẽ ngụ ý một độ chính xác mà dữ liệu không có.
                        zoom={12}
                        heightClass="h-56"
                      />
                      {/* Chú thích ĐỔI THEO độ tin cậy thật của toạ độ, không dùng chung một câu.
                          Tag "vi-tri-khu-vuc" được gán ở @data/places/lodging cho những cơ sở mà
                          không nguồn nào — iVIVU lẫn OpenStreetMap — có toạ độ riêng, nên chúng
                          dùng chung toạ độ của xã. Nói rõ điều đó đúng hơn là để khách nhìn thấy
                          mấy ghim chồng lên nhau rồi tự kết luận là dữ liệu hỏng. */}
                      <p className="mt-2 text-[11px] text-[#6e7977] leading-relaxed">
                        {hs.tags.includes('vi-tri-khu-vuc')
                          ? 'Đây là vị trí của XÃ hoặc BẢN, không phải của riêng cơ sở này — chưa có nguồn nào cung cấp toạ độ riêng cho nó. Các cơ sở cùng khu vực vì vậy hiện chung một điểm.'
                          : 'Vị trí do sàn đặt phòng cung cấp cho chính cơ sở này. Vẫn nên hỏi lại chủ nhà trước khi dựa vào đây để dẫn đường tới cửa.'}
                      </p>
                    </div>
                  )}

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

                    {/*
            Ba thẻ select đổi thành nút chọn, cùng hình dạng với bảng điều khiển ở trình lập
            lịch trình. Mỗi tham số chỉ có hai tới bốn lựa chọn, và đổi một lựa chọn là con số
            tổng ngay bên cạnh đổi theo — giấu chúng sau một lần bấm thì mất đúng mối liên hệ đó.

            Giá mỗi đêm trong nhãn lấy TỪ COST_ASSUMPTIONS chứ không viết cứng. Bản trước ghi
            thẳng "150k", "450k", "900k" trong nhãn option, nên chỉ cần đổi đơn giá ở server là
            nhãn nói một đằng còn phép tính ra một nẻo, mà không có gì báo.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

            <ControlGroup label="Số ngày đi" cols={4}>
              {[2, 3, 4, 5].map((value) => (
                <ControlOption
                  key={value}
                  active={tripDays === value}
                  onClick={() => setTripDays(value)}
                >
                  {value}N{value - 1}Đ
                </ControlOption>
              ))}
            </ControlGroup>

            <ControlGroup label="Hình thức lái xe" cols={2}>
              <ControlOption
                active={riderType === 'self_drive'}
                onClick={() => setRiderType('self_drive')}
              >
                Tự lái
              </ControlOption>
              <ControlOption
                active={riderType === 'easy_rider'}
                onClick={() => setRiderType('easy_rider')}
              >
                Easy Rider
              </ControlOption>
            </ControlGroup>

            <ControlGroup label="Hạng phòng lưu trú" cols={3}>
              {([
                { id: 'dorm', label: 'Dorm' },
                { id: 'private_room', label: 'Phòng riêng' },
                { id: 'ecolodge', label: 'Ecolodge' }
              ] as const).map((option) => (
                <ControlOption
                  key={option.id}
                  active={stayStyle === option.id}
                  onClick={() => setStayStyle(option.id)}
                >
                  <span className="flex flex-col items-center gap-0.5 leading-tight">
                    <span>{option.label}</span>
                    <span className="text-[10px] font-medium opacity-70">
                      {Math.round(COST_ASSUMPTIONS.stayPerNight[option.id] / 1000)}k/đêm
                    </span>
                  </span>
                </ControlOption>
              ))}
            </ControlGroup>

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
