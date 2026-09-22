import React, { useState } from 'react';
import type { Destination } from '@shared/types';
import { Compass, Search, Heart, Sparkles, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@client/context/AuthContext';
import { DESTINATION_CATEGORIES, filterDestinations } from '@client/lib/destinationFilters';
import { DestinationImage } from './DestinationImage';

interface DestinationsGridProps {
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  onAskAIAbout: (destName: string) => void;
}
const DIFFICULTY_STYLE: Record<Destination['difficulty'], string> = {
  'Dễ đi': 'bg-emerald-50 text-emerald-800', 'Trung bình': 'bg-amber-50 text-amber-800',
  'Đòi hỏi tay lái vững': 'bg-orange-50 text-orange-800', 'Hiểm trở': 'bg-red-50 text-red-800',
};

export const DestinationsGrid: React.FC<DestinationsGridProps> = ({ destinations, onSelectDestination, onAskAIAbout }) => {
  const { isFavorite, toggleFavorite } = useAuth();
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('all');
  const [query, setQuery] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const filtered = filterDestinations(destinations, { category, region, query });
  const regions = [...new Set(destinations.map(d => d.district))];
  const hasFilters = category !== 'all' || region !== 'all' || Boolean(query);
  const clear = () => { setCategory('all'); setRegion('all'); setQuery(''); };

  return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" aria-labelledby="explore-heading">
    <header className="mb-8 max-w-3xl">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-[#005c55]">
        <Compass className="w-4 h-4" /> Kỳ quan cao nguyên đá
      </div>
      <h2 id="explore-heading" className="font-display text-3xl sm:text-5xl font-bold text-[#181c1c] leading-tight mt-4 mb-4">
        {destinations.length ? `${destinations.length} điểm đến,` : 'Khám phá Hà Giang'}<br />
        <span className="text-[#005c55]">thêm những miền đáng khám phá.</span>
      </h2>
      <p className="text-[#3e4947] leading-relaxed">Từ cung đường Đồng Văn đến những bản làng và triền núi phía Tây Hà Giang. Tìm một điểm dừng cho hành trình của riêng bạn.</p>
    </header>
    <div className="rounded-2xl border border-[#dce4df] bg-white p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        <div className="flex-1">
          <label htmlFor="destination-search" className="block text-xs font-semibold text-[#53645f] mb-2">Bạn muốn khám phá nơi nào?</label>
          <div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 w-4 h-4 text-[#53645f]" />
            <input id="destination-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Tìm Lô Lô Chải, hang động, Xín Mần…"
              className="min-h-11 w-full pl-10 pr-3 py-2 rounded-xl border border-[#bdc9c6] bg-[#fbfcfa] text-sm focus:outline-2 focus:outline-[#005c55]" />
          </div>
        </div>
        <div className="sm:w-56"><label htmlFor="destination-region" className="block text-xs font-semibold text-[#53645f] mb-2">Vùng du lịch</label>
          <select id="destination-region" value={region} onChange={e => setRegion(e.target.value)} className="min-h-11 w-full px-3 py-2 rounded-xl border border-[#bdc9c6] bg-[#fbfcfa] text-sm">
            <option value="all">Tất cả vùng</option>{regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Loại hình địa danh">
        {DESTINATION_CATEGORIES.map(c => <button key={c.id} id={`filter-cat-${c.id}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
          className={`min-h-11 px-4 py-2 rounded-full text-sm transition-colors ${category === c.id ? 'bg-[#005c55] text-white' : 'border border-[#dce4df] text-[#53645f] hover:bg-[#f1f4f3]'}`}>
          {c.label} <span className="ml-1.5 opacity-75">{destinations.filter(d => c.id === 'all' || d.category === c.id).length}</span>
        </button>)}
      </div>
      {hasFilters && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#dce4df] mt-5 pt-3">
        <button onClick={clear} className="min-h-11 px-2 text-sm underline text-[#005c55]">Xóa bộ lọc</button>
      </div>}
    </div>
    <p role="status" aria-live="polite" className="text-sm text-[#53645f] mt-6 mb-4">Hiển thị {filtered.length} / {destinations.length} điểm đến</p>
    {favoriteError && <p role="alert" className="mb-4 text-sm text-red-700">{favoriteError}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {filtered.map(dest => <article key={dest.id} id={`card-dest-${dest.id}`} className="group flex flex-col bg-white rounded-2xl border border-[#dce4df] overflow-hidden shadow-xs hover:shadow-xl transition-shadow">
        <div className="relative h-60 overflow-hidden">
          <DestinationImage photo={dest.photos?.[0] ?? { url: dest.imageUrl, ...dest.imageMeta, kind: dest.imageMeta?.kind ?? 'illustration' }} name={dest.vietnameseName} />
          <button onClick={() => onSelectDestination(dest)} className="absolute inset-0 z-10 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-[#005c55]" aria-label={`Xem chi tiết ${dest.vietnameseName}`} />
          <button id={`btn-fav-${dest.id}`} aria-label={`${isFavorite(dest.id) ? 'Bỏ lưu' : 'Lưu'} ${dest.vietnameseName}`} aria-pressed={isFavorite(dest.id)}
            onClick={async () => { setFavoriteError(''); if (!await toggleFavorite(dest.id)) setFavoriteError('Không lưu được địa danh. Vui lòng thử lại.'); }}
            className={`absolute top-3 right-3 z-20 w-11 h-11 rounded-full flex items-center justify-center ${isFavorite(dest.id) ? 'bg-rose-50 text-rose-700' : 'bg-white/90 text-[#005c55]'}`}>
            <Heart className={`w-5 h-5 ${isFavorite(dest.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#005c55] mb-2">{dest.district}</p>
          <h3><button onClick={() => onSelectDestination(dest)} className="font-display text-xl font-bold text-left text-[#181c1c] hover:text-[#005c55] leading-tight">{dest.vietnameseName}</button></h3>
          <p className="text-sm text-[#53645f] line-clamp-2 leading-relaxed mt-3 mb-4">{dest.description}</p>
          <div className="mt-auto bg-[#f1f4f3] rounded-xl px-3 py-2.5"><span className="text-[10px] uppercase tracking-wide font-bold text-[#005c55]">Thời điểm phù hợp</span><p className="text-xs text-[#3e4947] mt-1">{dest.bestTime}</p></div>
          <div className="flex flex-wrap gap-2 my-4 text-[11px]">
            <span className="bg-[#f1f4f3] rounded-md px-2 py-1">~{dest.recommendedStayHours} giờ</span>
            <span className={`rounded-md px-2 py-1 ${DIFFICULTY_STYLE[dest.difficulty]}`}>{dest.difficulty}</span>
            {dest.elevation != null && <span className="bg-[#f1f4f3] rounded-md px-2 py-1">Khoảng {dest.elevation.toLocaleString('vi-VN')} m</span>}
            {dest.distanceFromStart != null && <span className="bg-[#f1f4f3] rounded-md px-2 py-1">~{dest.distanceFromStart} km từ Hà Giang</span>}
          </div>
          <div className="flex gap-2 border-t border-[#dce4df] pt-4">
            <button id={`btn-dest-detail-${dest.id}`} onClick={() => onSelectDestination(dest)} className="min-h-11 flex-1 px-3 py-2 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold inline-flex items-center justify-center gap-2">Xem chi tiết <ArrowUpRight className="w-4 h-4" /></button>
            <button id={`btn-dest-ai-${dest.id}`} onClick={() => onAskAIAbout(dest.vietnameseName)} className="min-h-11 px-3 py-2 rounded-xl border border-[#005c55] text-[#005c55] text-xs font-semibold inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" />Hỏi AI</button>
          </div>
        </div>
      </article>)}
    </div>
    {!filtered.length && <div className="text-center py-16 px-4 border border-dashed border-[#bdc9c6] rounded-2xl">
      <h3 className="font-display text-xl font-bold">{destinations.length ? 'Chưa tìm thấy điểm phù hợp' : 'Danh sách điểm đến đang được cập nhật'}</h3>
      {hasFilters && <><p className="mt-2 text-sm text-[#53645f]">Thử tên địa danh khác hoặc mở rộng vùng tìm kiếm.</p><button onClick={clear} className="min-h-11 mt-5 px-5 py-2 rounded-xl bg-[#005c55] text-white text-sm">Xóa bộ lọc</button></>}
    </div>}
  </section>;
};
