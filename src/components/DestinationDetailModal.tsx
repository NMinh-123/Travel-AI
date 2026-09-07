import React, { useState } from 'react';
import { Destination } from '../types';
import {
  X, Mountain, ShieldAlert, Utensils, Sparkles, CheckCircle2,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface DestinationDetailModalProps {
  destination: Destination | null;
  onClose: () => void;
  onAskAI: (query: string) => void;
  onPlanTripTo: (dest: Destination) => void;
}

export const DestinationDetailModal: React.FC<DestinationDetailModalProps> = ({
  destination,
  onClose,
  onAskAI,
  onPlanTripTo
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  if (!destination) return null;

  const galleryImages = destination.gallery && destination.gallery.length > 0 
    ? destination.gallery 
    : [destination.imageUrl];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-[#e0e3e1]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1">
          
          {/* Hero Gallery Container */}
          <div className="relative h-72 sm:h-96 w-full bg-[#181c1c]">
            <img
              src={galleryImages[activePhotoIdx]}
              alt={destination.vietnameseName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

            {/* Gallery Navigation if > 1 images */}
            {galleryImages.length > 1 && (
              <div className="absolute inset-y-0 left-4 right-4 flex items-center justify-between pointer-events-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
                  }}
                  className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 hover:bg-black text-white flex items-center justify-center transition-all backdrop-blur-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
                  }}
                  className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 hover:bg-black text-white flex items-center justify-center transition-all backdrop-blur-sm"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Badges on Top */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-[#80d5cb]" />
                {destination.elevation}m trên mực nước biển
              </span>
              <span className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium">
                Km {destination.distanceFromStart}
              </span>
            </div>

            {/* Title on Image */}
            <div className="absolute bottom-6 left-6 right-6">
              <span className="text-xs uppercase font-bold tracking-widest text-[#80d5cb] block mb-1">
                {destination.district}
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
                {destination.vietnameseName}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 mt-1 font-light">
                {destination.name}
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-8">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f7faf8] p-4 rounded-2xl border border-[#e0e3e1]">
              <div>
                <span className="text-[11px] text-[#6e7977] block">Độ hiểm trở</span>
                <span className="text-xs font-bold text-[#181c1c]">{destination.difficulty}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#6e7977] block">Thời gian lưu lại</span>
                <span className="text-xs font-bold text-[#181c1c]">~{destination.recommendedStayHours} giờ</span>
              </div>
              <div>
                <span className="text-[11px] text-[#6e7977] block">Giờ vàng chụp ảnh</span>
                <span className="text-xs font-bold text-[#005c55]">{destination.bestTime}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#6e7977] block">Toạ độ GPS</span>
                <span className="text-xs font-mono font-semibold text-[#181c1c]">
                  {destination.coordinates.lat.toFixed(3)}°N
                </span>
              </div>
            </div>

            {/* Story & Description */}
            <div>
              <h3 className="font-display text-lg font-bold text-[#181c1c] mb-2">
                Huyền Thoại & Trải Nghiệm Cốt Lõi
              </h3>
              <p className="text-sm text-[#3e4947] leading-relaxed">
                {destination.description}
              </p>
            </div>

            {/* Key Highlights */}
            <div>
              <h4 className="text-xs uppercase font-bold tracking-wider text-[#005c55] mb-3">
                Điểm Nhấn Nổi Bật
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {destination.highlights.map((hl, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#181c1c] bg-[#f1f4f3] p-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-[#005c55] shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Road Safety Advisory */}
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-900 mb-1">
                  Khuyến Cáo An Toàn Đường Đèo (Safety Tip)
                </h4>
                <p className="text-xs text-red-800 leading-relaxed">
                  {destination.safetyTip}
                </p>
              </div>
            </div>

            {/* Local Food Specialties */}
            {destination.localFood && destination.localFood.length > 0 && (
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-[#181c1c] mb-3 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-[#005c55]" />
                  <span>Ẩm Thực Bản Địa Nên Thử Tại Đây</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {destination.localFood.map((food, fIdx) => (
                    <span
                      key={fIdx}
                      className="px-3 py-1.5 rounded-xl bg-[#005c55]/10 text-[#005c55] text-xs font-semibold"
                    >
                      🍴 {food}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-[#f7faf8] border-t border-[#e0e3e1] flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => {
              onClose();
              onAskAI(`Hãy kể cho tôi nghe những câu chuyện văn hoá và mẹo chụp ảnh đẹp nhất tại ${destination.vietnameseName}`);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-[#0051d5] hover:underline"
          >
            <Sparkles className="w-4 h-4 text-[#0051d5]" />
            <span>Hỏi AI về kinh nghiệm tại {destination.vietnameseName} &rarr;</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#bdc9c6] text-xs font-medium text-[#3e4947] hover:bg-white transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onClose();
                onPlanTripTo(destination);
              }}
              className="px-5 py-2 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold shadow-xs transition-all"
            >
              Thêm Vào Lịch Trình
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
