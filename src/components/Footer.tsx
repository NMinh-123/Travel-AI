import React from 'react';
import { PhoneCall, ShieldAlert, Heart, MapPin, Sparkles } from 'lucide-react';
import { Logo } from './Logo';

interface FooterProps {
  onSelectTab: (tab: 'explore' | 'planner' | 'map' | 'concierge' | 'guide') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="bg-[#181c1c] text-[#eef1f0] border-t border-[#2d3130] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Logo size="md" variant="gradient" />
              <span className="font-display text-xl font-bold tracking-tight text-white">
                Travel AI <span className="text-[#80d5cb]">Hà Giang</span>
              </span>
            </div>
            <p className="text-xs text-[#bdc9c6] leading-relaxed">
              Ứng dụng hỗ trợ du lịch và khám phá vòng cung cao nguyên đá Hà Giang với hệ thống trí tuệ nhân tạo thông minh, dữ liệu địa hình chính xác và hướng dẫn viên bản địa.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-[#80d5cb] bg-white/5 px-3 py-1 rounded-lg border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini 3.7 Flash Intelligence</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-4">
              Khám Phá Vòng Cung
            </h4>
            <ul className="space-y-2 text-xs text-[#bdc9c6]">
              <li>
                <button onClick={() => onSelectTab('explore')} className="hover:text-white transition-colors">
                  8 Tuyệt tác cao nguyên đá
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('planner')} className="hover:text-white transition-colors">
                  Lập lịch trình thông minh AI 3N2Đ - 5N4Đ
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('map')} className="hover:text-white transition-colors">
                  Bản đồ trắc diện độ cao & đường đèo
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('guide')} className="hover:text-white transition-colors">
                  Sổ tay bỏ túi & dự toán ngân sách
                </button>
              </li>
            </ul>
          </div>

          {/* Emergency Pass Rescue Hotlines */}
          <div>
            <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>Hotline Cứu Hộ Đường Đèo</span>
            </h4>
            <div className="space-y-2.5 text-xs text-[#bdc9c6]">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="block text-[11px] text-white/60">Cứu hộ xe máy TP Hà Giang & Quản Bạ:</span>
                <span className="font-mono font-bold text-emerald-300">0982 123 456</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="block text-[11px] text-white/60">Cứu hộ đèo Mã Pí Lèng & Mèo Vạc:</span>
                <span className="font-mono font-bold text-emerald-300">0912 888 999</span>
              </div>
            </div>
          </div>

          {/* Environmental Stewardship */}
          <div>
            <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-4">
              Du Lịch Bền Vững
            </h4>
            <p className="text-xs text-[#bdc9c6] leading-relaxed mb-3">
              Hãy gìn giữ sự nguyên sơ của công viên địa chất toàn cầu UNESCO. Không xả rác tại các mỏm đá ngắm cảnh, tôn trọng nếp sống và phong tục truyền thống của đồng bào các dân tộc thiểu số.
            </p>
            <span className="text-[11px] text-[#80d5cb]">
              #LeaveNoTrace • #HaGiangLoop • #ResponsibleTravel
            </span>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6e7977] gap-4">
          <p>© 2026 Travel AI Hà Giang. Nền tảng du lịch số & trợ lý hành trình cao nguyên đá.</p>
          <p className="flex items-center gap-1">
            Thiết kế vì tình yêu đại ngàn cao nguyên đá
          </p>
        </div>

      </div>
    </footer>
  );
};
