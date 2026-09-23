import React, { useState } from 'react';
import type { DestinationPhoto } from '@shared/types';

export const DestinationImage: React.FC<{ photo: DestinationPhoto; name: string; eager?: boolean }> = ({ photo, name, eager }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const illustration = photo.kind === 'illustration' || !photo.url || photo.url === failedUrl;
  const label = illustration ? 'Minh họa cảnh quan' : photo.kind === 'area' ? `Ảnh khu vực ${photo.regionLabel ?? 'Hà Giang'}` : '';
  const linked = photo.licenseVerified === true && photo.sourcePage?.startsWith('https://') === true;
  return <div className="relative h-full w-full bg-[#d9e9df]">
    <img src={illustration ? '/destination-illustration.svg' : photo.url} alt={label || name}
      loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer"
      onError={() => { if (!illustration) setFailedUrl(photo.url); }}
      className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-105" />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-white">
      {label && <span className="block text-[11px] font-medium">{label}</span>}
      {/* Ghi công luôn hiện — ảnh CC BY và CC BY-SA đòi điều đó, bỏ đi là vi phạm giấy phép.
          Nhưng chỉ ảnh có giấy phép ĐÃ XÁC MINH mới thành liên kết: với ảnh chưa rõ giấy phép,
          trang gốc không nói gì về quyền sử dụng, nên dẫn người xem sang đó chỉ gợi ý sai rằng
          ở đấy có thứ để kiểm. Ảnh chưa xác minh chỉ hiện tên nguồn, không hiện nhãn giấy phép. */}
      {!illustration && photo.credit && (linked
        ? <a href={photo.sourcePage} target="_blank" rel="noopener noreferrer"
            className="relative z-30 inline-flex min-h-6 items-center text-[10px] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-white">
            {photo.credit} · {photo.license}
          </a>
        : <span className="block text-[10px] opacity-90">{photo.credit}</span>)}
    </div>
  </div>;
};
