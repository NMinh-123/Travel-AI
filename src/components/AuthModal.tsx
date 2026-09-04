import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, Mail, Lock, User, Eye, EyeOff, Sparkles, 
  ShieldCheck, AlertCircle, Check, ArrowRight
} from 'lucide-react';
import { Logo } from './Logo';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    authModalTab, 
    openAuthModal,
    loginWithGoogle, 
    loginWithFacebook, 
    loginWithEmail, 
    registerWithEmail 
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);

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

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setSocialLoading('google');
    try {
      await loginWithGoogle();
    } catch (e) {
      setErrorMessage('Đăng nhập Google thất bại');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleFacebookLogin = async () => {
    setErrorMessage(null);
    setSocialLoading('facebook');
    try {
      await loginWithFacebook();
    } catch (e) {
      setErrorMessage('Đăng nhập Facebook thất bại');
    } finally {
      setSocialLoading(null);
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
          
          {/* Social Sign In Buttons */}
          <div className="space-y-2.5">
            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={!!socialLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-[#f7faf8] text-[#181c1c] border border-[#bdc9c6] rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-60"
            >
              {socialLoading === 'google' ? (
                <div className="w-4 h-4 border-2 border-[#0051d5] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Tiếp tục với tài khoản Google</span>
            </button>

            {/* Facebook */}
            <button
              onClick={handleFacebookLogin}
              disabled={!!socialLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-60"
            >
              {socialLoading === 'facebook' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0 fill-white" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              <span>Tiếp tục với Facebook</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-[#e0e3e1] w-full" />
            <span className="bg-white px-3 text-[11px] text-[#6e7977] uppercase tracking-wider font-semibold">
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
                  placeholder="Tối thiểu 6 ký tự"
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
              disabled={isSubmitting || !!socialLoading}
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
