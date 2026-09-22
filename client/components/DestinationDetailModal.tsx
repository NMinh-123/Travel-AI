import React, { useEffect, useRef, useState } from 'react';
import type { Destination, DestinationPhoto } from '@shared/types';
import { X, ChevronLeft, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import { PlaceMap } from './PlaceMap';
import { DestinationImage } from './DestinationImage';

interface DestinationDetailModalProps {
  destination: Destination | null;
  onClose: () => void;
  onAskAI: (query: string) => void;
  onPlanTripTo: (dest: Destination) => void;
}

// The keyed dialog resets gallery state when opening a different destination.
export const DestinationDetailModal: React.FC<DestinationDetailModalProps> = props => props.destination
  ? <DestinationDialog key={props.destination.id} {...props} destination={props.destination} /> : null;

const DestinationDialog: React.FC<Omit<DestinationDetailModalProps, 'destination'> & { destination: Destination }> = ({ destination: d, onClose, onAskAI, onPlanTripTo }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const photos: DestinationPhoto[] = d.photos?.length ? d.photos : [{ url: d.imageUrl, ...d.imageMeta, kind: d.imageMeta?.kind ?? 'illustration' }];
  const photo = photos[active] ?? photos[0];
  /**
   * Bốn mức tin cậy, ba cách vẽ: đã khảo sát thì bản đồ điểm kèm chỉ đường; xấp xỉ hoặc mức vùng
   * thì bản đồ khu vực, không chỉ đường; chưa có toạ độ thì chỉ còn chữ.
   *
   * Trước đây chỉ mức đầu được vẽ, nên phần lớn điểm đến không hiện gì cả — kể cả những điểm đã
   * có toạ độ, chỉ vì chưa đủ chắc. Giấu sạch không trung thực hơn: khách không phân biệt được
   * "dữ liệu chưa chắc" với "đội ngũ quên mất".
   */
  const coords = d.coordinates;
  const precision = coords ? d.locationPrecision ?? 'unknown' : 'unknown';
  const surveyed = precision === 'surveyed';
  const areaOnly = precision === 'approximate' || precision === 'area_only';
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  return <dialog ref={dialog} aria-labelledby="destination-title" onCancel={e => { e.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto p-0 w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] rounded-3xl border border-[#dce4df] bg-white text-[#181c1c] shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
    <div className="relative h-64 sm:h-80 overflow-hidden">
      <DestinationImage photo={photo} name={d.vietnameseName} eager />
      <button autoFocus onClick={onClose} aria-label="Đóng chi tiết" className="absolute top-4 right-4 z-30 w-11 h-11 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
      {photos.length > 1 && <div className="absolute inset-x-4 top-1/2 flex justify-between pointer-events-none">
        <button aria-label="Ảnh trước" onClick={() => setActive(i => (i - 1 + photos.length) % photos.length)} className="pointer-events-auto w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center"><ChevronLeft /></button>
        <button aria-label="Ảnh sau" onClick={() => setActive(i => (i + 1) % photos.length)} className="pointer-events-auto w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center"><ChevronRight /></button>
      </div>}
    </div>
    <div className="p-5 sm:p-8">
      <p className="text-xs uppercase tracking-widest font-semibold text-[#005c55]">{d.district}</p>
      <h2 id="destination-title" className="font-display text-2xl sm:text-4xl font-bold mt-2 leading-tight">{d.vietnameseName}</h2>
      <p className="mt-2 text-sm text-[#53645f]">{d.name}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6 text-sm">
        <div className="rounded-xl bg-[#f1f4f3] p-4"><dt className="text-xs text-[#53645f] mb-1">Mức độ di chuyển</dt><dd className="font-semibold">{d.difficulty}</dd></div>
        <div className="rounded-xl bg-[#f1f4f3] p-4"><dt className="text-xs text-[#53645f] mb-1">Thời gian gợi ý</dt><dd className="font-semibold">Khoảng {d.recommendedStayHours} giờ</dd></div>
        <div className="rounded-xl bg-[#f1f4f3] p-4"><dt className="text-xs text-[#53645f] mb-1">Thời điểm phù hợp</dt><dd className="font-semibold text-[#005c55]">{d.bestTime}</dd></div>
        <div className="rounded-xl bg-[#f1f4f3] p-4"><dt className="text-xs text-[#53645f] mb-1">Vị trí</dt><dd>{coords
          ? (surveyed ? `${coords.lat.toFixed(3)}°N ${coords.lng.toFixed(3)}°E`
            : `Khoảng ${coords.lat.toFixed(2)}°N ${coords.lng.toFixed(2)}°E · chưa xác minh lối vào`)
          : `${d.district} · Chưa có vị trí xác minh`}</dd></div>
      </dl>
      {(d.elevation != null || d.distanceFromStart != null) && <p className="text-xs text-[#53645f] mb-5">
        {d.elevation != null && <span className="mr-4">Độ cao tham khảo: {d.elevation.toLocaleString('vi-VN')} m</span>}
        {d.distanceFromStart != null && <span>Khoảng {d.distanceFromStart} km đường bộ từ trung tâm Hà Giang</span>}
      </p>}
      {coords && (surveyed || areaOnly) && <PlaceMap lat={coords.lat} lng={coords.lng} name={d.vietnameseName} area={areaOnly}
        zoom={areaOnly ? 11 : d.category === 'nature' || d.category === 'pass' ? 12 : 14} />}
      <h3 className="font-display text-xl font-bold mt-7 mb-3">Câu chuyện & trải nghiệm</h3>
      <p className="text-sm text-[#3e4947] leading-relaxed">{d.description}</p>
      <h3 className="font-display text-xl font-bold mt-7 mb-3">Điểm nổi bật</h3>
      <ul className="grid sm:grid-cols-2 gap-3">{d.highlights.map((h, i) => <li key={i} className="flex gap-2 p-3 rounded-xl bg-[#f1f4f3] text-sm"><CheckCircle2 className="w-4 h-4 shrink-0 text-[#005c55] mt-0.5" />{h}</li>)}</ul>
      <h3 className="font-display text-xl font-bold mt-7 mb-3">Lưu ý khi tham quan</h3>
      <p className="text-sm leading-relaxed bg-amber-50 border-l-4 border-amber-600 p-4 rounded-lg text-amber-950">{d.safetyTip}</p>
      {!!d.localFood?.length && <><h3 className="font-display text-xl font-bold mt-7 mb-3">Món ăn gợi ý trong vùng</h3><ul className="flex flex-wrap gap-2">{d.localFood.map((food, i) => <li key={i} className="bg-[#005c55]/10 rounded-xl px-3 py-2 text-sm text-[#005c55]">{food}</li>)}</ul></>}
      {!!d.sourceLinks?.length && <><h3 className="font-display text-xl font-bold mt-7 mb-3">Nguồn tham khảo</h3><ul className="space-y-2 text-xs">{d.sourceLinks.filter(s => s.url.startsWith('https://')).map(s => <li key={s.url}><a className="text-[#005c55] underline break-words" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></>}
    </div>
    <footer className="flex flex-wrap gap-3 justify-between p-5 sm:px-8 border-t border-[#dce4df] bg-[#f7faf8]">
      <button onClick={() => { onClose(); onAskAI(`Tư vấn kinh nghiệm tham quan, ăn uống và chụp ảnh tại ${d.vietnameseName}`); }} className="min-h-11 px-3 py-2 text-sm text-[#005c55] inline-flex items-center gap-2"><Sparkles className="w-4 h-4" />Hỏi AI về địa danh</button>
      <div className="flex gap-2"><button onClick={onClose} className="min-h-11 px-4 py-2 text-sm border border-[#bdc9c6] rounded-xl">Đóng</button><button onClick={() => { onClose(); onPlanTripTo(d); }} className="min-h-11 px-4 py-2 text-sm font-semibold bg-[#005c55] text-white rounded-xl">Thêm vào lịch trình</button></div>
    </footer>
  </dialog>;
};
