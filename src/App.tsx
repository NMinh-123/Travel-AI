import React, { useState } from 'react';
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
import { DESTINATIONS } from './data/hagiangData';
import { Destination } from './types';
import { Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'explore' | 'planner' | 'map' | 'concierge' | 'guide'>('explore');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [isQuickConciergeOpen, setIsQuickConciergeOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [aiPromptSeed, setAiPromptSeed] = useState<string>('');

  const handleAskAI = (promptText: string) => {
    setAiPromptSeed(promptText);
    setActiveTab('concierge');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlanTripTo = (dest: Destination) => {
    setActiveTab('planner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7faf8] text-[#181c1c] selection:bg-[#005c55] selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConcierge={() => setIsQuickConciergeOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Dynamic View Content */}
      <main className="flex-1">
        {activeTab === 'explore' && (
          <div>
            <HeroSection
              destinations={DESTINATIONS}
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
                destinations={DESTINATIONS}
                onSelectDestination={(dest) => setSelectedDestination(dest)}
                onAskAIAbout={(name) => handleAskAI(`Tư vấn chi tiết về kinh nghiệm tham quan, ăn uống và chụp ảnh tại ${name}`)}
              />
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <ItineraryPlanner
            onAskAI={handleAskAI}
            onOpenMapToLocation={(loc) => setActiveTab('map')}
          />
        )}

        {activeTab === 'map' && (
          <HighlandsMap
            destinations={DESTINATIONS}
            onSelectDestination={(dest) => setSelectedDestination(dest)}
            onAskAI={handleAskAI}
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
        onSelectDestination={(dest) => {
          setIsProfileModalOpen(false);
          setSelectedDestination(dest);
        }}
        onOpenPlanner={() => {
          setIsProfileModalOpen(false);
          setActiveTab('planner');
        }}
      />

      {/* Auth Modal (Google, Facebook, Email Signup & Login) */}
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
      <AppContent />
    </AuthProvider>
  );
}
