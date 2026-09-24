import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@client/context/AuthContext';
import {
  X, Mail, Lock, User, Eye, EyeOff,
  ShieldCheck, AlertCircle, ArrowRight, MailCheck, KeyRound
} from 'lucide-react';
import { Logo } from './Logo';
import { loadGoogleIdentity } from '@client/lib/googleIdentity';
import { loadAppConfig } from '@client/lib/appConfig';
import { loadTurnstile } from '@client/lib/turnstile';

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
    registerWithEmail,
    requestPasswordReset,
    resetPassword
  } = useAuth();

  /** Hai bước quên mật khẩu không có đăng nhập Google, không có tab, và chỉ một ô nhập. */
  const isRecovery = authModalTab === 'forgot' || authModalTab === 'reset';
  /** Server chỉ đòi Turnstile ở form gửi thư (dễ bị lạm dụng để dội thư), không đòi ở bước đặt mật khẩu mới. */
  const needsTurnstile = authModalTab !== 'reset';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  /**
   * Bật khi `prompt()` báo không hiện được hộp chọn tài khoản. Lúc đó nút chính chủ của Google
   * được render ra làm đường vào dự phòng — xấu hơn nhưng luôn chạy.
   */
  const [needsNativeButton, setNeedsNativeButton] = useState(false);

  /**
   * Cloudflare Turnstile. Chỉ hiện khi server bật (có đủ hai khoá); `turnstileSiteKey` null thì
   * form chạy như trước. Mỗi token dùng được một lần, nên sau mỗi lần gửi phải reset widget để
   * lấy token mới — không thì lần thử thứ hai luôn bị server từ chối.
   */
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    void loadAppConfig().then((appConfig) => setTurnstileSiteKey(appConfig.turnstileSiteKey));
  }, []);

  useEffect(() => {
    if (!isAuthModalOpen || !turnstileSiteKey || !needsTurnstile) return;

    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        const container = turnstileRef.current;
        if (cancelled || !container) return;
        turnstileWidgetId.current = turnstile.render(container, {
          sitekey: turnstileSiteKey,
          callback: setTurnstileToken,
          'expired-callback': () => setTurnstileToken(null),
          'error-callback': () => setTurnstileToken(null),
          language: 'vi',
        });
      })
      .catch((error: unknown) => {
        console.error('Không nạp được Turnstile:', error);
        setErrorMessage('Không tải được bước xác minh chống bot. Kiểm tra kết nối rồi tải lại trang.');
      });

    return () => {
      cancelled = true;
      if (turnstileWidgetId.current) window.turnstile?.remove(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
      setTurnstileToken(null);
    };
  }, [isAuthModalOpen, turnstileSiteKey, needsTurnstile]);

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

  const switchTab = (tab: 'login' | 'register' | 'forgot') => {
    setErrorMessage(null);
    openAuthModal(tab);
  };

  const heading = {
    login: ['Đăng nhập tài khoản', 'Lưu lịch trình AI, đồng bộ lộ trình đèo & cập nhật thời tiết thực tế.'],
    register: ['Tạo tài khoản mới', 'Gia nhập cộng đồng phượt thủ cao nguyên đá và nhận hỗ trợ 24/7.'],
    forgot: ['Quên mật khẩu', 'Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác nhận 6 chữ số.'],
    reset: ['Đặt mật khẩu mới', 'Mật khẩu mới dùng được ngay; các thiết bị khác sẽ bị đăng xuất.'],
  }[authModalTab];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (authModalTab === 'reset') {
      setIsSubmitting(true);
      const res = await resetPassword(email, resetCode, password);
      setIsSubmitting(false);
      if (!res.success) setErrorMessage(res.error || 'Không đặt lại được mật khẩu');
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage('Vui lòng hoàn tất bước xác minh chống bot bên dưới.');
      return;
    }
    setIsSubmitting(true);
    const token = turnstileToken ?? undefined;

    try {
      if (authModalTab === 'forgot') {
        const res = await requestPasswordReset(email, token);
        if (res.success) {
          setResetCode('');
          setPassword('');
          openAuthModal('reset');
        } else {
          setErrorMessage(res.error || 'Không gửi được mã đặt lại mật khẩu');
        }
      } else if (authModalTab === 'login') {
        const res = await loginWithEmail(email, password, token);
        if (!res.success) {
          setErrorMessage(res.error || 'Đăng nhập không thành công');
        }
      } else {
        const res = await registerWithEmail(name, email, password, token);
        if (!res.success) {
          setErrorMessage(res.error || 'Đăng ký không thành công');
        }
      }
    } catch (err) {
      setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      // Token vừa gửi đã hết hiệu lực, dù kết quả là gì. Đăng nhập thành công thì hộp thoại đóng
      // và widget bị gỡ ở effect phía trên; thất bại thì cần một token mới cho lần thử sau.
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current);
      setTurnstileToken(null);
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

          <h2 className="text-xl font-bold font-display">{heading[0]}</h2>
          <p className="text-xs text-emerald-100 mt-0.5">{heading[1]}</p>
        </div>

        {/* Tab Switcher */}
        {!isRecovery && (
        <div className="flex border-b border-[#e0e3e1] bg-[#f7faf8] p-1.5 mx-6 mt-4 rounded-xl">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authModalTab === 'login'
                ? 'bg-white text-[#005c55] shadow-xs'
                : 'text-[#6e7977] hover:text-[#181c1c]'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authModalTab === 'register'
                ? 'bg-white text-[#005c55] shadow-xs'
                : 'text-[#6e7977] hover:text-[#181c1c]'
            }`}
          >
            Đăng Ký
          </button>
        </div>
        )}

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
          {!isRecovery && (<>
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
          </>)}

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

            {authModalTab === 'reset' && (
              <>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800">
                  <MailCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>
                    Nếu <b>{email}</b> đã có tài khoản, mã xác nhận vừa được gửi tới hộp thư đó và có
                    hiệu lực trong 15 phút. Không thấy thư thì xem cả mục Spam.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#181c1c]">Mã xác nhận</label>
                    <button
                      type="button"
                      onClick={() => switchTab('forgot')}
                      className="text-[11px] font-semibold text-[#0051d5] hover:underline"
                    >
                      Gửi lại mã
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="6 chữ số trong thư"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-10 pr-4 py-2.5 text-sm tracking-[0.4em] bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] focus:bg-white text-[#181c1c]"
                    />
                  </div>
                </div>
              </>
            )}

            {authModalTab !== 'reset' && (
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
            )}

            {authModalTab !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#181c1c]">
                  {authModalTab === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                </label>
                {authModalTab === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchTab('forgot')}
                    className="text-[11px] font-semibold text-[#0051d5] hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
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
            )}

            {turnstileSiteKey && needsTurnstile && <div ref={turnstileRef} className="flex justify-center pt-1" />}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {{
                      login: 'Đăng Nhập Ngay',
                      register: 'Tạo Tài Khoản Ha Giang Travel',
                      forgot: 'Gửi Mã Xác Nhận',
                      reset: 'Đặt Mật Khẩu Mới',
                    }[authModalTab]}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {isRecovery && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="w-full text-center text-xs font-semibold text-[#005c55] hover:underline"
            >
              Quay lại đăng nhập
            </button>
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
