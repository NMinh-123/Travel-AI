import React from 'react';
import { Sparkles, Compass, MapPin, ArrowRight, Camera, Mountain } from 'lucide-react';
import { Destination } from '../types';

interface HeroSectionProps {
  onExploreClick: () => void;
  onPlanClick: () => void;
  onMapClick: () => void;
  onSelectDestination: (dest: Destination) => void;
  destinations: Destination[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onPlanClick,
  onMapClick,
  onSelectDestination,
  destinations
}) => {
  return (
    <div className="relative w-full overflow-hidden bg-[#181c1c] text-white">
      {/* Background Cinematic Image with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=2000&auto=format&fit=crop"
          alt="Hà Giang Mã Pí Lèng Landscape"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-45 scale-105 transition-transform duration-1000 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#181c1c] via-[#181c1c]/60 to-black/30" />
        <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#181c1c]/40 to-[#181c1c]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        
        {/* Top AI Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-emerald-200 mb-6 shadow-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Hệ Thống Trợ Lý Du Lịch & Lộ Trình Thông Minh Hà Giang</span>
        </div>

        {/* Cinematic Headline */}
        <div className="max-w-4xl">
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
            Chạm Đến Kỳ Vĩ <br />
            <span className="italic font-normal text-[#80d5cb]">Nơi Địa Đầu</span> Tổ Quốc
          </h1>
          
          <p className="text-base sm:text-xl text-[#eef1f0]/90 font-light leading-relaxed max-w-2xl mb-8">
            Khám phá trọn vẹn 350km cung đường đèo huyền thoại, hẻm vực Tu Sản sâu thẳm, dòng Nho Quế ngọc bích và nhịp sống thanh bình của các bản làng cổ kính với sự đồng hành của AI.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-12">
            <button
              id="btn-hero-plan"
              onClick={onPlanClick}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-base shadow-lg shadow-[#005c55]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-5 h-5 text-emerald-300" />
              <span>Lập Lịch Trình Tự Động</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              id="btn-hero-map"
              onClick={onMapClick}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white font-medium text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MapPin className="w-5 h-5 text-[#80d5cb]" />
              <span>Xem Bản Đồ Đường Đèo</span>
            </button>

            <button
              id="btn-hero-explore"
              onClick={onExploreClick}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl text-[#eef1f0] hover:text-white font-medium text-base transition-colors"
            >
              <Compass className="w-5 h-5" />
              <span>Khám Phá Địa Điểm</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 px-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 mb-12">
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-bold text-white">350+ km</span>
            <span className="text-xs text-[#bdc9c6] tracking-wide mt-0.5 font-medium">Vòng Cung Đường Đèo</span>
          </div>

          <div className="flex flex-col border-l border-white/10 pl-4 sm:pl-6">
            <span className="font-display text-2xl sm:text-3xl font-bold text-[#80d5cb]">1.520 m</span>
            <span className="text-xs text-[#bdc9c6] tracking-wide mt-0.5 font-medium">Đỉnh Mã Pí Lèng</span>
          </div>

          <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6">
            <span className="font-display text-2xl sm:text-3xl font-bold text-white">14+ Bản</span>
            <span className="text-xs text-[#bdc9c6] tracking-wide mt-0.5 font-medium">Văn Hoá Các Dân Tộc</span>
          </div>

          <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6">
            <span className="font-display text-2xl sm:text-3xl font-bold text-[#9cf2e8]">100%</span>
            <span className="text-xs text-[#bdc9c6] tracking-wide mt-0.5 font-medium">Cảnh Quan UNESCO</span>
          </div>
        </div>

        {/* Spotlight Quick Carousel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#80d5cb]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-[#bdc9c6]">
                Tuyệt Tác Không Thể Bỏ Lỡ
              </span>
            </div>
            <span className="text-xs text-[#80d5cb] cursor-pointer hover:underline" onClick={onExploreClick}>
              Xem tất cả 8 kỳ quan &rarr;
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {destinations.slice(0, 4).map((dest) => (
              <div
                key={dest.id}
                id={`hero-dest-${dest.id}`}
                onClick={() => onSelectDestination(dest)}
                className="group relative h-48 rounded-xl overflow-hidden cursor-pointer border border-white/15 bg-[#2d3130] transition-all hover:-translate-y-1 hover:border-[#80d5cb] shadow-md"
              >
                <img
                  src={dest.imageUrl}
                  alt={dest.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/15 text-[11px] font-medium text-white flex items-center gap-1">
                  <Mountain className="w-3 h-3 text-[#80d5cb]" />
                  <span>{dest.elevation}m</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#80d5cb] block mb-0.5">
                    {dest.district}
                  </span>
                  <h4 className="font-display text-base font-bold text-white leading-snug group-hover:text-[#9cf2e8] transition-colors">
                    {dest.vietnameseName}
                  </h4>
                  <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5 font-light">
                    {dest.highlights[0]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
