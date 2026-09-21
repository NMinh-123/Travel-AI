import React from 'react';
import { Compass, Calendar, ShieldCheck, CloudSun, Sparkles, User, LogIn } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@client/context/AuthContext';
import type { PassLiveWeather } from '@shared/types';

interface NavbarProps {
  activeTab: 'explore' | 'planner' | 'concierge' | 'guide';
  setActiveTab: (tab: 'explore' | 'planner' | 'concierge' | 'guide') => void;
  onOpenProfile: () => void;
  /**
   * Số đo tại thành phố Hà Giang, do App lấy một lần rồi truyền xuống. `null` khi đang tải hoặc
   * khi tra cứu hỏng — badge tự ẩn, vì một badge trống trên thanh điều hướng còn khó hiểu hơn là
   * không có badge nào.
   */
  localWeather: PassLiveWeather | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenProfile,
  localWeather
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  /*
   * Badge này từng ghi cứng "18°C • Nắng ráo" dưới một comment "Live Weather", rồi chuyển sang
   * con số tham khảo theo mùa của đỉnh Mã Pí Lèng. Nay là số đo thật của THÀNH PHỐ Hà Giang.
   *
   * Đổi điểm là có lý do: badge đứng ở mọi trang nên nó phải nói về nơi ai cũng hiểu là "Hà
   * Giang". Đỉnh đèo ở 1.500 m lạnh hơn thành phố cả chục độ, và người chưa lên cao nguyên đọc
   * con số đó rất dễ tưởng đấy là thời tiết chung của cả vùng.
   */

  return (
    <header className="sticky top-0 z-40 w-full bg-[#f7faf8]/90 backdrop-blur-md border-b border-[#e0e3e1] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('explore')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <Logo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#181c1c]">
                Ha Giang <span className="text-[#005c55]">Travel</span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#0051d5]/10 text-[#0051d5] border border-[#0051d5]/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-[#3e4947] tracking-wide font-medium">
              Vòng Cung Cao Nguyên Đá • Lộ Trình & Cẩm Nang Số
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#ebefed] p-1.5 rounded-xl border border-[#bdc9c6]/40">
          <button
            id="nav-tab-explore"
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'explore'
                ? 'bg-[#005c55] text-white shadow-sm'
                : 'text-[#3e4947] hover:text-[#181c1c] hover:bg-white/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Khám Phá</span>
          </button>

          <button
            id="nav-tab-planner"
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'planner'
                ? 'bg-[#005c55] text-white shadow-sm'
                : 'text-[#3e4947] hover:text-[#181c1c] hover:bg-white/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Lịch Trình AI</span>
          </button>

          <button
            id="nav-tab-concierge"
            onClick={() => setActiveTab('concierge')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'concierge'
                ? 'bg-[#0051d5] text-white shadow-sm'
                : 'text-[#0051d5] hover:bg-[#0051d5]/10 font-semibold'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Trợ Lý Thổ Địa AI</span>
          </button>

          <button
            id="nav-tab-guide"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'guide'
                ? 'bg-[#005c55] text-white shadow-sm'
                : 'text-[#3e4947] hover:text-[#181c1c] hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sổ Tay Phượt</span>
          </button>
        </nav>

        {/* Right Info & Action Buttons */}
        <div className="flex items-center gap-3">
          {localWeather && (
            <div
              title={`Đo tại ${localWeather.point}${localWeather.observedAtLocal ? ` lúc ${localWeather.observedAtLocal.slice(11, 16)}` : ''}. Trên cao nguyên đá lạnh hơn đáng kể.`}
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#bdc9c6]/60 text-xs font-medium text-[#181c1c] shadow-xs"
            >
              <CloudSun className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-[#6e7977] text-[10px] block leading-none">
                  Hà Giang
                  {localWeather.observedAtLocal
                    ? ` · ${localWeather.observedAtLocal.slice(11, 16)}`
                    : ''}
                </span>
                <span className="font-semibold text-xs">
                  {localWeather.tempC}°C • {localWeather.condition}
                </span>
              </div>
            </div>
          )}

          {/*
            NÚT HỒ SƠ. Bản trước xếp tên và dòng "❤️ 3 Hồ sơ" cạnh avatar trong một khung viền,
            và dòng thứ hai ấy gánh hai việc chẳng liên quan: đếm điểm đã lưu, đồng thời làm nhãn
            cho biết bấm vào sẽ ra hồ sơ. Kết quả là một khối chữ nhỏ li ti ngay cạnh badge thời
            tiết vốn cũng hai dòng, và góc phải trông như hai bảng số đặt cạnh nhau.
            Nay chỉ còn avatar tròn: một đối tượng, một việc. Số điểm đã lưu chuyển thành chấm
            đếm ở góc avatar — nhìn thấy ngay mà không chiếm thêm dòng nào. Tên người dùng bỏ
            khỏi thanh vì nó đã nằm trong hồ sơ, và ai cũng biết ảnh đại diện của chính mình.
          */}
          {isAuthenticated && user ? (
            <button
              id="btn-user-profile"
              onClick={onOpenProfile}
              title={`${user.name} — mở hồ sơ`}
              aria-label={`Mở hồ sơ của ${user.name}`}
              className="relative shrink-0 rounded-full ring-2 ring-[#bdc9c6]/70 hover:ring-[#005c55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] transition-all active:scale-95"
            >
              <img
                src={user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover bg-emerald-100"
              />

              {/* Chấm đếm điểm đã lưu. Quá 9 thì rút gọn để không phá hình tròn. */}
              {user.favoriteDestinations.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#005c55] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#f7faf8]">
                  {user.favoriteDestinations.length > 9 ? '9+' : user.favoriteDestinations.length}
                </span>
              )}
            </button>
          ) : (
            <button
              id="btn-login-trigger"
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#f1f4f3] text-[#181c1c] border border-[#bdc9c6] text-xs font-bold shadow-xs transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-[#005c55]" />
              <span className="hidden sm:inline">Đăng Nhập</span>
              <span className="sm:hidden">Đăng nhập</span>
            </button>
          )}

          {/*
            Nút "Hỏi Trợ Lý AI" đã bỏ khỏi đây. Trợ lý vẫn có ba đường vào: tab trên thanh điều
            hướng, thanh tab ở màn hẹp, và nút nổi góc dưới phải. Bốn nút cho cùng một việc làm
            góc phải chật mà không thêm đường nào mới.
          */}
        </div>
      </div>

      {/* Mobile Sub Navigation Bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-[#e0e3e1] bg-white px-2 py-2 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'explore' ? 'text-[#005c55] font-semibold' : 'text-[#6e7977]'}`}
        >
          <Compass className="w-4 h-4" />
          <span>Khám Phá</span>
        </button>
        <button
          onClick={() => setActiveTab('planner')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'planner' ? 'text-[#005c55] font-semibold' : 'text-[#6e7977]'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>Lịch Trình</span>
        </button>
        <button
          onClick={() => setActiveTab('concierge')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'concierge' ? 'text-[#0051d5] font-semibold' : 'text-[#0051d5]/70'}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Trợ Lý AI</span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'guide' ? 'text-[#005c55] font-semibold' : 'text-[#6e7977]'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sổ Tay</span>
        </button>
        {isAuthenticated ? (
          <button
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-md text-[#005c55] font-semibold"
          >
            <User className="w-4 h-4" />
            <span>Tài khoản</span>
          </button>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-md text-[#0051d5] font-semibold"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
};
