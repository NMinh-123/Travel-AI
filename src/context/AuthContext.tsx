import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updatedData: Partial<UserProfile>) => void;
  toggleFavorite: (destId: string) => void;
  isFavorite: (destId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'travel_ai_hagiang_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading auth from localStorage', e);
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [user]);

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async () => {
    // Simulate real Google OAuth authentication handshake
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const googleUser: UserProfile = {
      id: `google-${Date.now()}`,
      name: 'Nguyễn Hoàng Minh',
      email: 'minh.nguyen@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      provider: 'google',
      riderLevel: 'Đã có kinh nghiệm',
      favoriteDestinations: ['ma-pi-leng', 'nho-que-river', 'lung-cu-flagpole'],
      savedItineraries: ['itinerary-3d2n-classic'],
      badges: ['Chinh phục Mã Pí Lèng', 'Cột Cờ Cực Bắc', 'Thuyền Sông Nho Quế'],
      createdAt: new Date().toISOString()
    };

    setUser(googleUser);
    closeAuthModal();
  };

  const loginWithFacebook = async () => {
    await new Promise(resolve => setTimeout(resolve, 800));

    const fbUser: UserProfile = {
      id: `fb-${Date.now()}`,
      name: 'Trần Thị Thu Hà',
      email: 'thuha.tran@facebook.com',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
      provider: 'facebook',
      riderLevel: 'Đi theo tour Easy Rider',
      favoriteDestinations: ['dong-van-old-quarter', 'du-gia-waterfall'],
      savedItineraries: ['itinerary-4d3n-deep'],
      badges: ['Phố Cổ Đồng Văn', 'Bản Tiên Du Già'],
      createdAt: new Date().toISOString()
    };

    setUser(fbUser);
    closeAuthModal();
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(resolve => setTimeout(resolve, 600));

    if (!email || !pass) {
      return { success: false, error: 'Vui lòng nhập đầy đủ email và mật khẩu' };
    }

    if (pass.length < 6) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
    }

    const emailName = email.split('@')[0] || 'Phượt Thủ Hà Giang';
    const emailUser: UserProfile = {
      id: `email-${Date.now()}`,
      name: emailName.charAt(0).toUpperCase() + emailName.slice(1),
      email: email,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      provider: 'email',
      riderLevel: 'Mới bắt đầu',
      favoriteDestinations: ['ma-pi-leng'],
      savedItineraries: [],
      badges: ['Tân Thủ Cao Nguyên Đá'],
      createdAt: new Date().toISOString()
    };

    setUser(emailUser);
    closeAuthModal();
    return { success: true };
  };

  const registerWithEmail = async (name: string, email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(resolve => setTimeout(resolve, 600));

    if (!name.trim()) {
      return { success: false, error: 'Vui lòng nhập họ và tên của bạn' };
    }
    if (!email.includes('@')) {
      return { success: false, error: 'Địa chỉ email không đúng định dạng' };
    }
    if (pass.length < 6) {
      return { success: false, error: 'Mật khẩu phải từ 6 ký tự trở lên' };
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      provider: 'email',
      riderLevel: 'Mới bắt đầu',
      favoriteDestinations: [],
      savedItineraries: [],
      badges: ['Thành Viên Mới Travel AI'],
      createdAt: new Date().toISOString()
    };

    setUser(newUser);
    closeAuthModal();
    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (updatedData: Partial<UserProfile>) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, ...updatedData } : null);
  };

  const toggleFavorite = (destId: string) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const exists = user.favoriteDestinations.includes(destId);
    const updatedFavorites = exists
      ? user.favoriteDestinations.filter(id => id !== destId)
      : [...user.favoriteDestinations, destId];

    setUser({
      ...user,
      favoriteDestinations: updatedFavorites
    });
  };

  const isFavorite = (destId: string) => {
    return user ? user.favoriteDestinations.includes(destId) : false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        loginWithFacebook,
        loginWithEmail,
        registerWithEmail,
        logout,
        updateProfile,
        toggleFavorite,
        isFavorite
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
