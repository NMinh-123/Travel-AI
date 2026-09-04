import React from 'react';
import { Compass, Calendar, MapPin, MessageSquareText, ShieldCheck, CloudSun, Sparkles, User, LogIn } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: 'explore' | 'planner' | 'map' | 'concierge' | 'guide';
  setActiveTab: (tab: 'explore' | 'planner' | 'map' | 'concierge' | 'guide') => void;
  onOpenConcierge: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenConcierge,
  onOpenProfile
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
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
                Travel AI <span className="text-[#005c55]">Hà Giang</span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#0051d5]/10 text-[#0051d5] border border-[#0051d5]/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-[#3e4947] tracking-wide font-medium">
              Vòng Cung Cao Nguyên Đá • Lộ Trình & Bản Đồ Số
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
            id="nav-tab-map"
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'map'
                ? 'bg-[#005c55] text-white shadow-sm'
                : 'text-[#3e4947] hover:text-[#181c1c] hover:bg-white/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Bản Đồ Đường Đèo</span>
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
          {/* Live Weather Badge on Mã Pí Lèng */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#bdc9c6]/60 text-xs font-medium text-[#181c1c] shadow-xs">
            <CloudSun className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[#6e7977] text-[10px] block leading-none">Mã Pí Lèng</span>
              <span className="font-semibold text-xs">18°C • Nắng ráo</span>
            </div>
          </div>

          {/* User Auth Section */}
          {isAuthenticated && user ? (
            <button
              id="btn-user-profile"
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-[#f1f4f3] border border-[#bdc9c6] shadow-xs transition-all text-left group"
            >
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-lg object-cover bg-emerald-100 border border-[#005c55]/30"
              />
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-[#181c1c] block leading-tight truncate max-w-[100px]">
                  {user.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-[#005c55] font-semibold flex items-center gap-1 leading-none">
                  {user.favoriteDestinations.length > 0 && <span>❤️ {user.favoriteDestinations.length}</span>}
                  <span>Hồ sơ</span>
                </span>
              </div>
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

          {/* Quick AI Trigger Button */}
          <button
            id="btn-quick-ai"
            onClick={onOpenConcierge}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#005c55] to-[#0f766e] hover:from-[#004e48] hover:to-[#0d645d] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span className="hidden md:inline">Hỏi Trợ Lý AI</span>
            <span className="md:hidden">Hỏi AI</span>
          </button>
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
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-md ${activeTab === 'map' ? 'text-[#005c55] font-semibold' : 'text-[#6e7977]'}`}
        >
          <MapPin className="w-4 h-4" />
          <span>Bản Đồ</span>
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
