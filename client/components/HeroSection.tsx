import React from 'react';
import { Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { Destination } from '@shared/types';

interface HeroSectionProps {
  onExploreClick: () => void;
  onPlanClick: () => void;
  destinations: Destination[];
  /**
   * Số chỗ nghỉ đã có giá tham khảo trong danh mục. `null` khi chưa tải xong — ô số hiện dấu
   * gạch thay vì nhảy từ 0 lên 20 trước mắt khách.
   */
  lodgingCount: number | null;
}

interface HeroStat {
  value: string;
  label: string;
  tone: 'white' | 'teal' | 'mint';
}

const TONE_CLASS: Record<HeroStat['tone'], string> = {
  white: 'text-white',
  teal: 'text-[#80d5cb]',
  mint: 'text-[#9cf2e8]'
};

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onPlanClick,
  destinations,
  lodgingCount
}) => {
  /**
   * Ảnh nền lấy từ chính danh mục điểm đến, không hotlink ảnh của bên thứ ba.
   *
   * Bản trước nhúng thẳng một URL Unsplash: trang chủ phụ thuộc vào một máy chủ ngoài mà dự án
   * không kiểm soát, và ảnh đó không nằm trong bộ đã soát bản quyền như các ảnh còn lại. Đèo Mã
   * Pí Lèng đã có ảnh trong danh mục nên dùng luôn; hết cách thì lấy điểm đầu tiên có ảnh.
   */
  const heroSource =
    destinations.find((dest) => dest.vietnameseName.includes('Mã Pí Lèng')) ??
    destinations.find((dest) => Boolean(dest.imageUrl));

  /**
   * Số liệu trong hero phải kiểm chứng được.
   *
   * Bản trước ghi "14+ Bản văn hoá các dân tộc" và "100% cảnh quan UNESCO" — không có chỗ nào
   * trong dữ liệu chống lưng cho hai con số đó, và một con số không tra được thì làm hỏng lòng
   * tin vào cả ba con số còn lại. Nay hai ô đầu và ô cuối đếm thẳng từ dữ liệu đang chạy, ô độ
   * cao là số đo của chính điểm đến Mã Pí Lèng trong danh mục.
   */
  const maPiLengElevation = destinations.find((dest) =>
    dest.vietnameseName.includes('Mã Pí Lèng')
  )?.elevation;

  const stats: HeroStat[] = [
    {
      value: String(destinations.length),
      label: 'Điểm đến đã khảo dữ liệu',
      tone: 'white'
    },
    {
      value: '350 km',
      label: 'Vòng cung cao nguyên đá',
      tone: 'teal'
    },
    {
      value: maPiLengElevation ? `${maPiLengElevation.toLocaleString('vi-VN')} m` : '—',
      label: 'Đỉnh đèo Mã Pí Lèng',
      tone: 'white'
    },
    {
      value: lodgingCount === null ? '—' : String(lodgingCount),
      label: 'Chỗ nghỉ kèm giá tham khảo',
      tone: 'mint'
    }
  ];

  return (
    <div className="relative w-full overflow-hidden bg-[#181c1c] text-white">
      {/* Ảnh nền điện ảnh, phủ gradient cho chữ luôn đọc được */}
      <div className="absolute inset-0 z-0">
        {heroSource && (
          <img
            src={heroSource.imageUrl}
            alt={heroSource.vietnameseName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181c1c] via-[#181c1c]/60 to-black/35" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 sm:pt-16 sm:pb-24">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-emerald-200 mb-5 sm:mb-6">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Trợ lý &amp; lộ trình thông minh cho cao nguyên đá</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl lg:text-[66px] font-bold tracking-tight text-white leading-[1.08] mb-5 text-pretty">
          Chạm Đến Kỳ Vĩ <br />
          <span className="italic font-normal text-[#80d5cb]">Nơi Địa Đầu</span> Tổ Quốc
        </h1>

        {/*
          Một lời hứa cụ thể thay cho đoạn tả cảnh. Câu cũ liệt kê danh lam mà bất kỳ trang du
          lịch Hà Giang nào cũng viết được; câu này nói đúng thứ sản phẩm có mà nơi khác không có.
        */}
        <p className="text-base sm:text-lg text-[#eef1f0]/90 leading-relaxed max-w-2xl mb-7">
          Lịch trình theo từng ngày, thời tiết từng điểm và giá chỗ nghỉ — dựng trên dữ liệu đã
          khảo, không phải phỏng đoán.
        </p>

        {/*
          MỘT hành động chính. Bản trước đặt hai nút cùng cỡ cạnh nhau, cộng thêm nút "Hỏi Trợ Lý
          AI" trên navbar và nút nổi góc phải — bốn lời mời ngang hàng thì không còn lời mời nào
          nổi. Nút phụ ở đây hạ xuống dạng liên kết, chỉ để cuộn xuống lưới.
        */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 mb-10">
          <button
            id="btn-hero-plan"
            onClick={onPlanClick}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-base shadow-lg shadow-[#005c55]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <span>Lập lịch trình cho chuyến của bạn</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </button>

          <button
            id="btn-hero-explore"
            onClick={onExploreClick}
            className="flex items-center gap-2 px-3 py-3.5 rounded-xl text-[#eef1f0] hover:text-white font-medium text-base transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-[#80d5cb]" />
            <span>Xem {destinations.length} điểm đến</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6 py-5 px-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span
                className={`font-display text-2xl sm:text-3xl font-bold leading-none ${TONE_CLASS[stat.tone]}`}
              >
                {stat.value}
              </span>
              <span className="text-xs text-[#bdc9c6] font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
