import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest, errorMessage } from '../lib/api';
import type { DayItinerary, SavedItinerary, UserProfile } from '../types';

/**
 * Xác thực thật, dựa trên database.
 *
 * Bản trước của file này mô phỏng hoàn toàn: `setTimeout(800)` rồi trả về một user cứng và
 * lưu vào localStorage. Nay mọi thứ đi qua /api/auth/* và session nằm trong cookie httpOnly
 * do server đặt. Ba hệ quả cần biết:
 *
 * - **Không còn lưu user vào localStorage.** Cookie là nguồn duy nhất; nhồi thêm user vào
 *   localStorage sẽ tạo hai nguồn sự thật lệch nhau khi cookie hết hạn.
 * - Mọi thao tác ghi trả về hồ sơ đầy đủ sau khi cập nhật, và ta thay toàn bộ state bằng
 *   phản hồi đó — không cập nhật lạc quan ở client rồi hy vọng server đồng ý.
 * - `isInitialising` phân biệt "chưa biết đã đăng nhập hay chưa" với "chắc chắn chưa đăng
 *   nhập", để giao diện không nháy sang trạng thái khách khi còn đang hỏi server.
 */

interface MutationResult {
  success: boolean;
  error?: string;
}

interface SaveItineraryInput {
  title: string;
  overview: string;
  totalKm: number;
  travelMode?: string;
  vibe?: string;
  budgetLevel?: string;
  days: DayItinerary[];
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isInitialising: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  /** null khi server chưa cấu hình GOOGLE_CLIENT_ID — khi đó nút Google phải ẩn. */
  googleClientId: string | null;
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  loginWithEmail: (email: string, password: string) => Promise<MutationResult>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<MutationResult>;
  /** `credential` là ID token do Google Identity Services trả về, server xác thực lại. */
  loginWithGoogle: (credential: string) => Promise<MutationResult>;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<MutationResult>;
  toggleFavorite: (destinationId: string) => Promise<void>;
  isFavorite: (destinationId: string) => boolean;
  savedItineraries: SavedItinerary[];
  saveItinerary: (input: SaveItineraryInput) => Promise<MutationResult>;
  deleteSavedItinerary: (id: string) => Promise<void>;
}

/** Chỉ hai trường này được server cho phép sửa, nên không nhận Partial<UserProfile>. */
interface ProfileUpdate {
  phone?: string;
  riderLevel?: UserProfile['riderLevel'];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitialising, setIsInitialising] = useState<boolean>(true);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  // Hỏi server: phiên hiện tại còn hiệu lực không, và đăng nhập Google có được bật không.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiRequest<{ user: UserProfile | null }>('/api/auth/me').catch(() => ({ user: null })),
      apiRequest<{ googleClientId: string | null }>('/api/config').catch(() => ({
        googleClientId: null
      }))
    ]).then(([session, appConfig]) => {
      if (cancelled) return;
      setUser(session.user);
      setGoogleClientId(appConfig.googleClientId);
      setIsInitialising(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadSavedItineraries = useCallback(async () => {
    try {
      setSavedItineraries(await apiRequest<SavedItinerary[]>('/api/me/itineraries'));
    } catch {
      // Không chặn giao diện chỉ vì danh sách lịch trình đã lưu không tải được.
      setSavedItineraries([]);
    }
  }, []);

  // Danh sách chỉ có nghĩa khi đã đăng nhập; đăng xuất là phải xoá khỏi bộ nhớ.
  useEffect(() => {
    if (user) void loadSavedItineraries();
    else setSavedItineraries([]);
  }, [user, loadSavedItineraries]);

  const openAuthModal = useCallback((tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  /** Ba đường đăng nhập chỉ khác endpoint và payload, phần còn lại dùng chung. */
  const authenticate = useCallback(
    async (path: string, payload: unknown, fallback: string): Promise<MutationResult> => {
      try {
        const { user: signedIn } = await apiRequest<{ user: UserProfile }>(path, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setUser(signedIn);
        setIsAuthModalOpen(false);
        return { success: true };
      } catch (error) {
        return { success: false, error: errorMessage(error, fallback) };
      }
    },
    []
  );

  const loginWithEmail = useCallback(
    (email: string, password: string) =>
      authenticate('/api/auth/login', { email, password }, 'Đăng nhập không thành công'),
    [authenticate]
  );

  const registerWithEmail = useCallback(
    (name: string, email: string, password: string) =>
      authenticate('/api/auth/register', { name, email, password }, 'Đăng ký không thành công'),
    [authenticate]
  );

  const loginWithGoogle = useCallback(
    (credential: string) =>
      authenticate('/api/auth/google', { credential }, 'Đăng nhập Google thất bại'),
    [authenticate]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      // Kể cả khi request lỗi vẫn phải xoá state client: bấm đăng xuất mà vẫn thấy mình đang
      // đăng nhập là hành vi tệ hơn việc cookie còn sót lại.
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdate): Promise<MutationResult> => {
    try {
      const { user: updated } = await apiRequest<{ user: UserProfile }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      setUser(updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error, 'Không lưu được thay đổi') };
    }
  }, []);

  const isFavorite = useCallback(
    (destinationId: string) => !!user?.favoriteDestinations.includes(destinationId),
    [user]
  );

  /**
   * PUT/DELETE thay vì một endpoint "toggle": nếu mạng chậm và người dùng bấm hai lần, kết
   * quả cuối vẫn đúng theo ý định thay vì phụ thuộc vào số request tới được server.
   */
  const toggleFavorite = useCallback(
    async (destinationId: string) => {
      if (!user) {
        openAuthModal('login');
        return;
      }

      const wasFavorite = user.favoriteDestinations.includes(destinationId);
      try {
        const { user: updated } = await apiRequest<{ user: UserProfile }>(
          `/api/me/favorites/${encodeURIComponent(destinationId)}`,
          { method: wasFavorite ? 'DELETE' : 'PUT' }
        );
        setUser(updated);
      } catch (error) {
        console.error('Không cập nhật được điểm yêu thích:', error);
      }
    },
    [user, openAuthModal]
  );

  const saveItinerary = useCallback(
    async (input: SaveItineraryInput): Promise<MutationResult> => {
      if (!user) {
        openAuthModal('login');
        return { success: false, error: 'Bạn cần đăng nhập để lưu lịch trình' };
      }

      try {
        const saved = await apiRequest<SavedItinerary>('/api/me/itineraries', {
          method: 'POST',
          body: JSON.stringify(input)
        });
        setSavedItineraries((current) => [saved, ...current]);
        setUser((current) =>
          current
            ? { ...current, savedItineraries: [saved.id, ...current.savedItineraries] }
            : current
        );
        return { success: true };
      } catch (error) {
        return { success: false, error: errorMessage(error, 'Không lưu được lịch trình') };
      }
    },
    [user, openAuthModal]
  );

  const deleteSavedItinerary = useCallback(async (id: string) => {
    try {
      await apiRequest<void>(`/api/me/itineraries/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      setSavedItineraries((current) => current.filter((itinerary) => itinerary.id !== id));
      setUser((current) =>
        current
          ? {
              ...current,
              savedItineraries: current.savedItineraries.filter((saved) => saved !== id)
            }
          : current
      );
    } catch (error) {
      console.error('Không xoá được lịch trình:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitialising,
        isAuthModalOpen,
        authModalTab,
        googleClientId,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        updateProfile,
        toggleFavorite,
        isFavorite,
        savedItineraries,
        saveItinerary,
        deleteSavedItinerary
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
