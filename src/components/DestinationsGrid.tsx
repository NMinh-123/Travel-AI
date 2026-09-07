import React, { useState } from 'react';
import { Destination } from '../types';
import { Mountain, Compass, Sparkles, Clock, Search, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DestinationsGridProps {
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  onAskAIAbout: (destName: string) => void;
}

export const DestinationsGrid: React.FC<DestinationsGridProps> = ({
  destinations,
  onSelectDestination,
  onAskAIAbout
}) => {
  const { isFavorite, toggleFavorite } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'Tất Cả Kỳ Quan' },
    { id: 'pass', label: 'Đèo & Dốc Hiểm Trở' },
    { id: 'nature', label: 'Sông Núi & Cảnh Quan' },
    { id: 'culture', label: 'Bản Làng & Di Tích' },
    { id: 'viewpoint', label: 'Đài Ngắm Mây' },
    { id: 'waterfall', label: 'Thác Nước Hoang Sơ' },
  ];

  const filtered = destinations.filter((dest) => {
    const matchCat = selectedCategory === 'all' || dest.category === selectedCategory;
    const matchSearch =
      dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.vietnameseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#005c55] mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Kỳ Quan Cao Nguyên Đá</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
            Những Điểm Dừng Chân Huyền Thoại
          </h2>
          <p className="text-sm sm:text-base text-[#3e4947] mt-1 max-w-xl">
            Từ vách đá vôi dựng đứng của đèo Mã Pí Lèng đến sắc màu văn hoá mộc mạc của người H'Mông, Lô Lô và Tày.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tên đèo, bản làng, suối..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#bdc9c6] text-sm text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] transition-all"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            id={`filter-cat-${cat.id}`}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-[#005c55] text-white shadow-xs'
                : 'bg-white text-[#3e4947] border border-[#e0e3e1] hover:border-[#bdc9c6] hover:bg-[#f1f4f3]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of Destination Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((dest) => (
          <div
            key={dest.id}
            id={`card-dest-${dest.id}`}
            className="group flex flex-col bg-white rounded-2xl border border-[#e0e3e1] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            {/* Image Container */}
            <div
              className="relative h-64 overflow-hidden cursor-pointer bg-[#2d3130]"
              onClick={() => onSelectDestination(dest)}
            >
              <img
                src={dest.imageUrl}
                alt={dest.vietnameseName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

              {/* Elevation & Distance Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1">
                  <Mountain className="w-3.5 h-3.5 text-[#80d5cb]" />
                  {dest.elevation}m
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90">
                  Km {dest.distanceFromStart}
                </span>
              </div>

              {/* Difficulty Tag & Favorite Button */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  id={`btn-fav-${dest.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(dest.id);
                  }}
                  className={`w-7 h-7 rounded-lg backdrop-blur-md flex items-center justify-center transition-all ${
                    isFavorite(dest.id)
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-black/50 text-white/80 hover:text-white hover:bg-black/70 border border-white/20'
                  }`}
                  title={isFavorite(dest.id) ? 'Bỏ lưu' : 'Lưu địa điểm yêu thích'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite(dest.id) ? 'fill-white' : ''}`} />
                </button>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md ${
                  dest.difficulty === 'Đòi hỏi tay lái vững'
                    ? 'bg-red-500/80 text-white border border-red-300/40'
                    : dest.difficulty === 'Trung bình'
                    ? 'bg-amber-500/80 text-white border border-amber-300/40'
                    : 'bg-emerald-600/80 text-white border border-emerald-300/40'
                }`}>
                  {dest.difficulty}
                </span>
              </div>

              {/* Bottom Title on Image */}
              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#80d5cb] block mb-0.5">
                  {dest.district}
                </span>
                <h3 className="font-display text-xl font-bold text-white group-hover:text-[#9cf2e8] transition-colors leading-tight">
                  {dest.vietnameseName}
                </h3>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-sm text-[#3e4947] line-clamp-2 leading-relaxed mb-4">
                  {dest.description}
                </p>

                {/* Best Time Indicator */}
                <div className="flex items-center gap-2 text-xs text-[#181c1c] font-medium bg-[#f1f4f3] px-3 py-2 rounded-lg mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#005c55] shrink-0" />
                  <span className="truncate">Giờ đẹp nhất: <strong>{dest.bestTime}</strong></span>
                </div>

                {/* Highlights list */}
                <div className="space-y-1.5 mb-5">
                  {dest.highlights.slice(0, 2).map((hl, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[#3e4947]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#005c55] mt-1.5 shrink-0" />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#e0e3e1] flex items-center justify-between gap-2">
                <button
                  id={`btn-dest-detail-${dest.id}`}
                  onClick={() => onSelectDestination(dest)}
                  className="px-3.5 py-2 rounded-lg bg-[#005c55]/10 hover:bg-[#005c55] text-[#005c55] hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Xem Chi Tiết</span>
                </button>

                <button
                  id={`btn-dest-ai-${dest.id}`}
                  onClick={() => onAskAIAbout(dest.vietnameseName)}
                  className="px-3 py-2 rounded-lg bg-[#0051d5]/10 hover:bg-[#0051d5] text-[#0051d5] hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0051d5] group-hover:text-white" />
                  <span>Hỏi AI Mẹo Phượt</span>
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
