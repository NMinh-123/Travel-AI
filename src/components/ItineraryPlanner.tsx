import React, { useState } from 'react';
import { DayItinerary, RouteWaypoint } from '../types';
import { PRESET_ITINERARIES } from '../data/hagiangData';
import { 
  Sparkles, Calendar, Clock, MapPin, Mountain, AlertTriangle, 
  Send, RefreshCw, CheckCircle2, ChevronRight, Bed, Utensils, 
  Camera, ShieldAlert, Bike, Car, UserCheck, Flame
} from 'lucide-react';

interface ItineraryPlannerProps {
  onAskAI: (prompt: string) => void;
  onOpenMapToLocation?: (locationName: string) => void;
}

export const ItineraryPlanner: React.FC<ItineraryPlannerProps> = ({ onAskAI, onOpenMapToLocation }) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(3);
  const [travelMode, setTravelMode] = useState<'motorbike' | 'easy_rider' | 'car_suv'>('motorbike');
  const [vibe, setVibe] = useState<'photography' | 'culture' | 'adventure' | 'chill'>('photography');
  const [budget, setBudget] = useState<'backpacker' | 'comfort' | 'luxury'>('comfort');
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // Active itinerary days
  const [itineraryDays, setItineraryDays] = useState<DayItinerary[]>(PRESET_ITINERARIES[0]);
  const [customTitle, setCustomTitle] = useState<string>('Lịch Trình Vòng Cung 3N2Đ: Mã Pí Lèng & Du Già Hoang Sơ');

  const handleGenerateAIItinerary = async () => {
    setIsGenerating(true);
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
      const data = await res.json();
      if (data.days && Array.isArray(data.days) && data.days.length > 0) {
        setItineraryDays(data.days);
        if (data.title) setCustomTitle(data.title);
        setActiveDay(1);
      }
    } catch (err) {
      console.error('Failed to generate AI itinerary:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentDayData = itineraryDays.find(d => d.day === activeDay) || itineraryDays[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      
      {/* Header */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0051d5]/10 border border-[#0051d5]/20 text-[#0051d5] text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Itinerary Architect</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
          Lập Lịch Trình Đường Đèo Tối Ưu
        </h2>
        <p className="text-sm sm:text-base text-[#3e4947] mt-2">
          Hệ thống AI tính toán độ dốc, khúc cua, thời gian xuất phát và ánh sáng chụp ảnh vàng để hành trình của bạn an toàn và trọn vẹn nhất.
        </p>
      </div>

      {/* Control Box: Filter and Customize */}
      <div className="bg-white rounded-2xl border border-[#e0e3e1] p-6 shadow-sm mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
              Thời Gian Hành Trình
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { days: 3, label: '3N2Đ' },
                { days: 4, label: '4N3Đ' },
                { days: 5, label: '5N4Đ' },
              ].map((item) => (
                <button
                  key={item.days}
                  id={`btn-dur-${item.days}`}
                  onClick={() => setSelectedDuration(item.days)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    selectedDuration === item.days
                      ? 'bg-[#005c55] text-white border-[#005c55] shadow-xs'
                      : 'bg-[#f7faf8] text-[#3e4947] border-[#e0e3e1] hover:border-[#bdc9c6]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Travel Mode */}
          <div>
            <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
              Phương Tiện Di Chuyển
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTravelMode('motorbike')}
                className={`py-2 px-2 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all ${
                  travelMode === 'motorbike'
                    ? 'bg-[#005c55] text-white border-[#005c55]'
                    : 'bg-[#f7faf8] text-[#3e4947] border-[#e0e3e1] hover:border-[#bdc9c6]'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Tự Lái Xe</span>
              </button>

              <button
                onClick={() => setTravelMode('easy_rider')}
                className={`py-2 px-2 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all ${
                  travelMode === 'easy_rider'
                    ? 'bg-[#005c55] text-white border-[#005c55]'
                    : 'bg-[#f7faf8] text-[#3e4947] border-[#e0e3e1] hover:border-[#bdc9c6]'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Easy Rider</span>
              </button>

              <button
                onClick={() => setTravelMode('car_suv')}
                className={`py-2 px-2 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all ${
                  travelMode === 'car_suv'
                    ? 'bg-[#005c55] text-white border-[#005c55]'
                    : 'bg-[#f7faf8] text-[#3e4947] border-[#e0e3e1] hover:border-[#bdc9c6]'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Ô Tô Gầm Cao</span>
              </button>
            </div>
          </div>

          {/* Vibe */}
          <div>
            <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
              Phong Cách Trải Nghiệm
            </label>
            <select
              value={vibe}
              onChange={(e) => setVibe(e.target.value as any)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#f7faf8] border border-[#e0e3e1] text-xs font-medium text-[#181c1c] focus:outline-none focus:border-[#005c55]"
            >
              <option value="photography">📸 Săn Mây & Nhiếp Ảnh Góc Rộng</option>
              <option value="culture">🏮 Bản Làng & Văn Hoá Cổ Kính</option>
              <option value="adventure">⛰️ Chinh Phục Cung Đèo Hiểm Trở</option>
              <option value="chill">🌿 Thư Giãn, Suối Nước & Homestay Chill</option>
            </select>
          </div>

          {/* Generate Button */}
          <div className="flex flex-col justify-end">
            <button
              id="btn-generate-itinerary"
              onClick={handleGenerateAIItinerary}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#005c55] to-[#0051d5] hover:from-[#004e48] hover:to-[#0042b0] text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>AI Đang Tính Toán...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>Tái Tạo Lịch Trình AI</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Custom refinement prompt input */}
        <div className="mt-4 pt-4 border-t border-[#e0e3e1] flex items-center gap-2">
          <input
            type="text"
            placeholder="Yêu cầu thêm (VD: thêm 1 điểm check-in cà phê hoàng hôn Mã Pí Lèng, hạn chế lái xe sau 17h...)"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateAIItinerary()}
            className="flex-1 bg-[#f7faf8] border border-[#e0e3e1] rounded-xl px-4 py-2 text-xs text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#0051d5]"
          />
          <button
            onClick={handleGenerateAIItinerary}
            className="px-4 py-2 rounded-xl bg-[#0051d5] text-white text-xs font-medium hover:bg-[#0042b0] transition-colors"
          >
            Áp Dụng
          </button>
        </div>
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
              Lộ trình được thiết kế chuẩn khoa học, phân bổ thời gian nghỉ tại các trạm ngắm cảnh để giảm mỏi cơ và đảm bảo luôn về đến homestay trước khi trời sập tối.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#181c1c] bg-[#f1f4f3] p-3 rounded-xl mb-4">
              <div>
                <span className="text-[#6e7977] block text-[11px]">Tổng quãng đường</span>
                <span className="font-semibold text-sm">~350 km</span>
              </div>
              <div>
                <span className="text-[#6e7977] block text-[11px]">Độ cao dao động</span>
                <span className="font-semibold text-sm">110m - 1,520m</span>
              </div>
            </div>

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

        </div>

        {/* Right Side: Timeline of Waypoints */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-[#e0e3e1] p-6 shadow-xs">
            
            {/* Day Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[#e0e3e1] gap-3">
              <div>
                <div className="flex items-center gap-2">
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
              </div>

              {/* Weather Alert if any */}
              {currentDayData.weatherAlert && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium">{currentDayData.weatherAlert}</span>
                </div>
              )}
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
