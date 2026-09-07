import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X, Mail, Lock, User, Eye, EyeOff,
  ShieldCheck, AlertCircle, ArrowRight
} from 'lucide-react';
import { Logo } from './Logo';
import { loadGoogleIdentity } from '../lib/googleIdentity';

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

  /**
   * Nút Google do chính Google render vào div này. Effect phải đứng TRƯỚC lệnh return sớm ở
   * dưới, nếu không thứ tự hook sẽ đổi giữa các lần render. Khi hộp thoại đóng thì ref rỗng
   * và effect không làm gì; lúc mở lại, isAuthModalOpen đổi nên effect chạy lại và lúc đó
   * div đã có trong DOM.
   */
  useEffect(() => {
    if (!isAuthModalOpen || !googleClientId) return;

    let cancelled = false;

    loadGoogleIdentity()
      .then((identity) => {
        const container = googleButtonRef.current;
        if (cancelled || !container) return;

        identity.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response.credential) {
              setErrorMessage('Google không trả về thông tin đăng nhập');
              return;
            }
            const result = await loginWithGoogle(response.credential);
            if (!result.success) setErrorMessage(result.error ?? 'Đăng nhập Google thất bại');
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });

        container.replaceChildren();
        identity.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'vi',
          width: 320
        });
      })
      .catch((error: unknown) => {
        // Script của Google không tải được thì phần đăng nhập bằng email vẫn phải dùng được.
        console.error('Không nạp được đăng nhập Google:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthModalOpen, googleClientId, loginWithGoogle]);

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



  const handleQuickDemo = (demoType: 'rider' | 'guide') => {
    if (demoType === 'rider') {
      setEmail('phuothagiang@gmail.com');
      setPassword('Hagiang2026@');
    } else {
      setEmail('easyrider.viet@gmail.com');
      setPassword('Easyrider2026@');
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
              Travel AI Hà Giang
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
            Nút Google do Google Identity Services tự render vào đây, chỉ khi server có
            GOOGLE_CLIENT_ID. Không có thì cả khối này biến mất — không để lại một nút bấm
            vào là báo lỗi. Nút Facebook đã bị bỏ: nó vốn chỉ là đăng nhập giả trả về user
            cứng, còn làm thật thì cần Facebook App ID và SDK riêng, hiện chưa có.
          */}
          {googleClientId && (
            <>
              <div className="flex justify-center">
                <div ref={googleButtonRef} className="min-h-[40px]" />
              </div>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-[#e0e3e1] w-full" />
                <span className="bg-white px-3 text-[11px] text-[#6e7977] uppercase tracking-wider font-semibold whitespace-nowrap">
                  Hoặc với email
                </span>
              </div>
            </>
          )}

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
                  <span>{authModalTab === 'login' ? 'Đăng Nhập Ngay' : 'Tạo Tài Khoản Travel AI'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Pills for Testing */}
          {authModalTab === 'login' && (
            <div className="pt-2 border-t border-[#e0e3e1]">
              <span className="text-[10px] uppercase font-bold text-[#6e7977] block mb-1.5">
                ⚡ Đăng nhập thử nghiệm nhanh:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('rider')}
                  className="text-[11px] bg-[#f1f4f3] hover:bg-[#005c55]/10 hover:text-[#005c55] text-[#3e4947] px-2.5 py-1 rounded-lg border border-[#e0e3e1] transition-all text-left flex-1"
                >
                  🏍️ Phượt thủ tự lái
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('guide')}
                  className="text-[11px] bg-[#f1f4f3] hover:bg-[#0051d5]/10 hover:text-[#0051d5] text-[#3e4947] px-2.5 py-1 rounded-lg border border-[#e0e3e1] transition-all text-left flex-1"
                >
                  🎒 Easy Rider bản địa
                </button>
              </div>
            </div>
          )}

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
