import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { DestinationsGrid } from './components/DestinationsGrid';
import { ItineraryPlanner } from './components/ItineraryPlanner';
import { HighlandsMap } from './components/HighlandsMap';
import { AIConciergeTab } from './components/AIConciergeTab';
import { PocketGuideSection } from './components/PocketGuideSection';
import { DestinationDetailModal } from './components/DestinationDetailModal';
import { AIConciergeModal } from './components/AIConciergeModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Footer } from './components/Footer';
import { ErrorState, LoadingState } from './components/LoadingState';
import { useDestinations, usePassWeather } from './hooks/useContent';
import { Destination } from './types';
import { Sparkles } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { ChatSessionProvider } from './hooks/useChatSession';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'explore' | 'planner' | 'map' | 'concierge' | 'guide'>('explore');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [isQuickConciergeOpen, setIsQuickConciergeOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [aiPromptSeed, setAiPromptSeed] = useState<string>('');
  const [plannerFocus, setPlannerFocus] = useState<string>('');
  const [mapFocus, setMapFocus] = useState<string>('');

  /**
   * Điểm đến và số liệu đèo tham khảo được lấy một lần ở đây rồi truyền xuống, vì có nhiều
   * chỗ cùng cần: điểm đến dùng ở hero, lưới khám phá, bản đồ và hồ sơ; số liệu đèo dùng ở
   * navbar và tab cẩm nang. Fetch trong từng component sẽ gọi lặp cùng một endpoint.
   */
  const destinations = useDestinations();
  const passWeather = usePassWeather();

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

  const handleOpenMapToLocation = (locationName: string) => {
    setMapFocus(locationName);
    setActiveTab('map');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const destinationList = destinations.data ?? [];

  /**
   * Ba tab dựa trên danh sách điểm đến nên dùng chung một cách xử lý trạng thái tải, thay vì
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
    <div className="min-h-screen flex flex-col bg-[#f7faf8] text-[#181c1c] selection:bg-[#005c55] selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConcierge={() => setIsQuickConciergeOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        passWeather={passWeather.data ?? []}
      />

      {/* Main Dynamic View Content */}
      <main className="flex-1">
        {activeTab === 'explore' &&
          renderWithDestinations(
            <div>
              <HeroSection
                destinations={destinationList}
                onExploreClick={() => {
                  const el = document.getElementById('destinations-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                onPlanClick={() => setActiveTab('planner')}
                onMapClick={() => setActiveTab('map')}
                onSelectDestination={(dest) => setSelectedDestination(dest)}
              />

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
            onOpenMapToLocation={handleOpenMapToLocation}
            focusDestination={plannerFocus}
          />
        )}

        {activeTab === 'map' &&
          renderWithDestinations(
            <HighlandsMap
              destinations={destinationList}
              onSelectDestination={(dest) => setSelectedDestination(dest)}
              onAskAI={handleAskAI}
              focusLocation={mapFocus}
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
          />
        )}
      </main>

      {/* Global Floating AI Quick Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
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

      {/* Footer */}
      <Footer onSelectTab={(tab) => {
        setActiveTab(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* Một phiên chat duy nhất cho cả widget nổi và tab Thổ Địa AI (FR-BOT-07). */}
      <ChatSessionProvider>
        <AppContent />
      </ChatSessionProvider>
    </AuthProvider>
  );
}
