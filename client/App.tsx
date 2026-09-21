import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { DestinationsGrid } from './components/DestinationsGrid';
import { ItineraryPlanner } from './components/ItineraryPlanner';
import { AIConciergeTab } from './components/AIConciergeTab';
import { PocketGuideSection } from './components/PocketGuideSection';
import { AskConciergeBand } from './components/AskConciergeBand';
import { DestinationDetailModal } from './components/DestinationDetailModal';
import { AIConciergeModal } from './components/AIConciergeModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Footer } from './components/Footer';
import { ErrorState, LoadingState } from './components/LoadingState';
import { useDestinations, useHomestays, useLocalWeather, usePassWeather } from './hooks/useContent';
import { Destination } from '@shared/types';
import { Sparkles } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { ChatSessionProvider } from './hooks/useChatSession';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'explore' | 'planner' | 'concierge' | 'guide'>('explore');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [isQuickConciergeOpen, setIsQuickConciergeOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [aiPromptSeed, setAiPromptSeed] = useState<string>('');
  const [plannerFocus, setPlannerFocus] = useState<string>('');

  /**
   * Nội dung dùng chung được lấy một lần ở đây rồi truyền xuống, vì có nhiều chỗ cùng cần:
   * điểm đến dùng ở hero, lưới khám phá và hồ sơ; số liệu đèo dùng ở navbar và tab cẩm nang;
   * danh sách chỗ nghỉ dùng ở ô số của hero và ở tab cẩm nang. Fetch trong từng component sẽ
   * gọi lặp cùng một endpoint — trước đây tab Cẩm nang tự gọi /api/content/homestays một lần
   * nữa dù App đã có sẵn dữ liệu đó.
   */
  const destinations = useDestinations();
  const passWeather = usePassWeather();
  const localWeather = useLocalWeather();
  const homestays = useHomestays();

  const handleAskAI = (promptText: string) => {
    setAiPromptSeed(promptText);
    setActiveTab('concierge');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Điểm đến vừa chọn được chuyển tiếp sang planner, để lịch trình AI thực sự ghé nơi đó.
  const handlePlanTripTo = (dest: Destination) => {
    setPlannerFocus(dest.vietnameseName);
    setActiveTab('planner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const destinationList = destinations.data ?? [];

  /*
   * Tab trợ lý là một mặt chat chứ không phải một khúc của trang dài: nó cao đúng bằng khung
   * nhìn và tự cuộn bên trong. Trước đây khung chat nối tiếp header và chân trang nên mỗi câu
   * trả lời dài lại đẩy ô nhập ra khỏi màn hình, buộc người dùng cuộn ngược lên để gõ tiếp.
   */
  const isChatTab = activeTab === 'concierge';

  /**
   * Các tab dựa trên danh sách điểm đến dùng chung một cách xử lý trạng thái tải, thay vì
   * mỗi tab tự vẽ một kiểu. Lỗi có nút thử lại: sự cố mạng tạm thời không nên buộc người dùng
   * tải lại cả trang.
   */
  const renderWithDestinations = (children: ReactNode) => {
    if (destinations.isLoading) return <LoadingState label="Đang tải dữ liệu Hà Giang..." />;
    if (destinations.error) {
      return <ErrorState message={destinations.error} onRetry={destinations.reload} />;
    }
    return children;
  };

  return (
    <ChatSessionProvider>
    <div className={`${isChatTab ? 'h-dvh overflow-hidden' : 'min-h-screen'} flex flex-col bg-[#f7faf8] text-[#181c1c] selection:bg-[#005c55] selection:text-white`}>
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        localWeather={localWeather.data ?? null}
      />

      {/* Main Dynamic View Content */}
      <main className={`flex-1 ${isChatTab ? 'min-h-0 flex flex-col' : ''}`}>
        {activeTab === 'explore' &&
          renderWithDestinations(
            <div>
              <HeroSection
                destinations={destinationList}
                lodgingCount={homestays.data?.length ?? null}
                onExploreClick={() => {
                  const el = document.getElementById('destinations-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                onPlanClick={() => setActiveTab('planner')}
              />

              {/*
                Dải hỏi nhanh đè lên mép dưới hero. Dùng chung handleAskAI với nút nổi và nút
                trên navbar, nên mọi đường vào trợ lý đều đổ về một phiên chat duy nhất.
              */}
              <AskConciergeBand onAsk={handleAskAI} />

              <div id="destinations-section">
                <DestinationsGrid
                  destinations={destinationList}
                  onSelectDestination={(dest) => setSelectedDestination(dest)}
                  onAskAIAbout={(name) => handleAskAI(`Tư vấn chi tiết về kinh nghiệm tham quan, ăn uống và chụp ảnh tại ${name}`)}
                />
              </div>
            </div>
          )}

        {activeTab === 'planner' && (
          <ItineraryPlanner
            onAskAI={handleAskAI}
            focusDestination={plannerFocus}
          />
        )}

        {activeTab === 'concierge' && (
          <AIConciergeTab
            initialPrompt={aiPromptSeed}
          />
        )}

        {activeTab === 'guide' && (
          <PocketGuideSection
            onAskAI={handleAskAI}
            passWeather={passWeather.data ?? []}
            homestays={homestays}
          />
        )}
      </main>

      {/* Nút nổi mở chat nhanh. Ẩn ở tab trợ lý: ở đó ô nhập đã nằm cố định sát đáy màn hình
          nên nút này vừa che nút Gửi vừa mở lại đúng cuộc trò chuyện đang mở. */}
      <div className={`fixed bottom-6 right-6 z-40 ${isChatTab ? 'hidden' : ''}`}>
        <button
          id="btn-floating-ai"
          onClick={() => setIsQuickConciergeOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#005c55] to-[#0051d5] text-white font-semibold text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border border-white/20"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
          </div>
          <span className="hidden sm:inline">Hỏi Thổ Địa AI</span>
          <span className="sm:hidden">AI</span>
        </button>
      </div>

      {/* Destination Detail Modal */}
      <DestinationDetailModal
        destination={selectedDestination}
        onClose={() => setSelectedDestination(null)}
        onAskAI={handleAskAI}
        onPlanTripTo={handlePlanTripTo}
      />

      {/* Quick AI Concierge Modal */}
      <AIConciergeModal
        isOpen={isQuickConciergeOpen}
        onClose={() => setIsQuickConciergeOpen(false)}
        onNavigateToFullChat={() => {
          setIsQuickConciergeOpen(false);
          setActiveTab('concierge');
        }}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        destinations={destinationList}
        onSelectDestination={(dest) => {
          setIsProfileModalOpen(false);
          setSelectedDestination(dest);
        }}
        onOpenPlanner={() => {
          setIsProfileModalOpen(false);
          setActiveTab('planner');
        }}
      />

      {/* Auth Modal (đăng nhập Google và email) */}
      <AuthModal />

      {/* Chân trang. Tab trợ lý cao đúng bằng khung nhìn và không cuộn, nên ở đó không có
          chỗ cho chân trang; các tab khác giữ nguyên. */}
      {!isChatTab && (
        <Footer onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      )}

    </div>
    </ChatSessionProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
