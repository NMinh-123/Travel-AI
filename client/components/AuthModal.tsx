import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@client/context/AuthContext';
import {
  X, Mail, Lock, User, Eye, EyeOff,
  ShieldCheck, AlertCircle, ArrowRight
} from 'lucide-react';
import { Logo } from './Logo';
import { loadGoogleIdentity } from '@client/lib/googleIdentity';

/**
 * Logo Google, vẽ inline thay vì tải ảnh: nút đăng nhập là thứ hiện ra sớm nhất trong hộp
 * thoại, không nên chờ thêm một lượt mạng nữa mới có hình. Bốn màu và hình dạng giữ đúng bộ
 * nhận diện của Google — đây là phần không được phép tự chế lại.
 */
const GoogleGlyph: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    openAuthModal,
    googleClientId,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  /**
   * Bật khi `prompt()` báo không hiện được hộp chọn tài khoản. Lúc đó nút chính chủ của Google
   * được render ra làm đường vào dự phòng — xấu hơn nhưng luôn chạy.
   */
  const [needsNativeButton, setNeedsNativeButton] = useState(false);

  const handleGoogleCredential = useCallback(
    async (credential?: string) => {
      if (!credential) {
        setErrorMessage('Google không trả về thông tin đăng nhập');
        return;
      }
      const result = await loginWithGoogle(credential);
      if (!result.success) setErrorMessage(result.error ?? 'Đăng nhập Google thất bại');
    },
    [loginWithGoogle],
  );

  /**
   * Bấm nút của mình -> mở đúng hộp chọn tài khoản của Google.
   *
   * Chưa cấu hình thì nói thẳng ra thay vì im lặng: bản trước ẩn cả khối khi thiếu
   * GOOGLE_CLIENT_ID, nên trang đăng nhập trông như chưa từng có tính năng này và không ai biết
   * là chỉ thiếu một biến môi trường.
   */
  const handleGoogleClick = async () => {
    setErrorMessage(null);

    if (!googleClientId) {
      setErrorMessage(
        'Đăng nhập Google chưa được cấu hình: server chưa có GOOGLE_CLIENT_ID. Bạn vẫn đăng nhập bằng email được.',
      );
      return;
    }

    setIsGoogleBusy(true);
    try {
      const identity = await loadGoogleIdentity();
      identity.initialize({
        client_id: googleClientId,
        callback: (response) => {
          setIsGoogleBusy(false);
          void handleGoogleCredential(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      identity.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setNeedsNativeButton(true);
          setIsGoogleBusy(false);
        }
      });
    } catch (error) {
      // Script của Google không tải được thì phần đăng nhập bằng email vẫn phải dùng được.
      console.error('Không nạp được đăng nhập Google:', error);
      setErrorMessage('Không tải được đăng nhập Google. Kiểm tra kết nối rồi thử lại.');
      setIsGoogleBusy(false);
    }
  };

  /**
   * Nút chính chủ chỉ được vẽ khi `prompt()` đã thất bại. Effect phải đứng TRƯỚC lệnh return sớm
   * ở dưới, nếu không thứ tự hook sẽ đổi giữa các lần render.
   */
  useEffect(() => {
    if (!isAuthModalOpen || !googleClientId || !needsNativeButton) return;

    let cancelled = false;

    loadGoogleIdentity()
      .then((identity) => {
        const container = googleButtonRef.current;
        if (cancelled || !container) return;

        container.replaceChildren();
        identity.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'vi',
          width: 320,
        });
      })
      .catch((error: unknown) => {
        console.error('Không nạp được đăng nhập Google:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthModalOpen, googleClientId, needsNativeButton]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (authModalTab === 'login') {
        const res = await loginWithEmail(email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Đăng nhập không thành công');
        }
      } else {
        const res = await registerWithEmail(name, email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Đăng ký không thành công');
        }
      }
    } catch (err) {
      setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e0e3e1] flex flex-col">
        
        {/* Top Decorative Banner */}
        <div className="bg-gradient-to-r from-[#005c55] via-[#0f766e] to-[#0051d5] p-6 text-white relative">
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Logo size="sm" variant="dark" />
            <span className="font-display font-bold text-lg text-white">
              Ha Giang Travel
            </span>
          </div>

          <h2 className="text-xl font-bold font-display">
            {authModalTab === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <p className="text-xs text-emerald-100 mt-0.5">
            {authModalTab === 'login'
              ? 'Lưu lịch trình AI, đồng bộ lộ trình đèo & cập nhật thời tiết thực tế.'
              : 'Gia nhập cộng đồng phượt thủ cao nguyên đá và nhận hỗ trợ 24/7.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#e0e3e1] bg-[#f7faf8] p-1.5 mx-6 mt-4 rounded-xl">
          <button
            onClick={() => {
              setErrorMessage(null);
              openAuthModal('login');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authModalTab === 'login'
                ? 'bg-white text-[#005c55] shadow-xs'
                : 'text-[#6e7977] hover:text-[#181c1c]'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => {
              setErrorMessage(null);
              openAuthModal('register');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authModalTab === 'register'
                ? 'bg-white text-[#005c55] shadow-xs'
                : 'text-[#6e7977] hover:text-[#181c1c]'
            }`}
          >
            Đăng Ký
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          
          {/*
            Nút đăng nhập Google. Luôn hiển thị, kể cả khi server chưa có GOOGLE_CLIENT_ID —
            bản trước ẩn cả khối trong trường hợp đó, và hệ quả là trang đăng nhập trông như
            chưa bao giờ có tính năng này. Bấm vào lúc chưa cấu hình thì nhận đúng một câu giải
            thích, hơn hẳn việc không có gì để bấm.

            Nút Facebook đã bị bỏ: nó vốn chỉ là đăng nhập giả trả về user cứng, còn làm thật
            thì cần Facebook App ID và SDK riêng, hiện chưa có.
          */}
          <button
            type="button"
            id="btn-google-login"
            onClick={handleGoogleClick}
            disabled={isGoogleBusy}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#bdc9c6] text-sm font-semibold text-[#181c1c] shadow-xs transition-all hover:border-[#0051d5] hover:bg-[#f7faf8] hover:shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
          >
            <GoogleGlyph className="w-5 h-5 shrink-0" />
            <span>
              {isGoogleBusy
                ? 'Đang mở cửa sổ Google...'
                : authModalTab === 'login'
                  ? 'Đăng nhập với Google'
                  : 'Đăng ký với Google'}
            </span>
          </button>

          {/* Đường vào dự phòng, chỉ hiện khi hộp chọn tài khoản không mở được. */}
          {needsNativeButton && (
            <div className="flex justify-center">
              <div ref={googleButtonRef} className="min-h-[40px]" />
            </div>
          )}

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-[#e0e3e1] w-full" />
            <span className="bg-white px-3 text-[11px] text-[#6e7977] uppercase tracking-wider font-semibold whitespace-nowrap">
              Hoặc với email
            </span>
          </div>

          {/* Error alert */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {authModalTab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#181c1c] mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Hoàng Minh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] focus:bg-white text-[#181c1c]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#181c1c] mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] focus:bg-white text-[#181c1c]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181c1c] mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Tối thiểu 8 ký tự"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] focus:bg-white text-[#181c1c]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#6e7977] hover:text-[#181c1c]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{authModalTab === 'login' ? 'Đăng Nhập Ngay' : 'Tạo Tài Khoản Ha Giang Travel'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="text-center pt-2 text-[11px] text-[#6e7977] flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bảo mật thông tin & cam kết du lịch an toàn</span>
          </div>

        </div>

      </div>
    </div>
  );
};
