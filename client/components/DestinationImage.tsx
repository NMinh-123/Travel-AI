import React, { useState } from 'react';
import type { DestinationPhoto } from '@shared/types';

export const DestinationImage: React.FC<{ photo: DestinationPhoto; name: string; eager?: boolean }> = ({ photo, name, eager }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const illustration = photo.kind === 'illustration' || !photo.url || photo.url === failedUrl;
  const label = illustration ? 'Minh họa cảnh quan' : photo.kind === 'area' ? `Ảnh khu vực ${photo.regionLabel ?? 'Hà Giang'}` : '';
  return <div className="relative h-full w-full bg-[#d9e9df]">
    <img src={illustration ? '/destination-illustration.svg' : photo.url} alt={label || name}
      loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer"
      onError={() => { if (!illustration) setFailedUrl(photo.url); }}
      className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-105" />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-white">
      {label && <span className="block text-[11px] font-medium">{label}</span>}
      {!illustration && photo.credit && photo.sourcePage?.startsWith('https://') && <a
        href={photo.sourcePage} target="_blank" rel="noopener noreferrer"
        className="relative z-30 inline-flex min-h-6 items-center text-[10px] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-white">
        {photo.credit} · {photo.license}
      </a>}
    </div>
  </div>;
};
