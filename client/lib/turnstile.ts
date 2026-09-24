/**
 * Nạp Cloudflare Turnstile theo yêu cầu, cùng cách với client/lib/googleIdentity.ts: script chỉ
 * tải khi hộp đăng nhập mở VÀ server có cấu hình Turnstile, không nhúng sẵn vào trang.
 *
 * `render=explicit` để widget chỉ hiện đúng chỗ AuthModal chỉ định, thay vì Turnstile tự quét
 * trang tìm phần tử có class `cf-turnstile`.
 */
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      language?: string;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loader: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  loader ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile nạp xong nhưng không dùng được'));
    });
    script.addEventListener('error', () => reject(new Error('Không tải được script chống bot của Cloudflare')));
    document.head.appendChild(script);
  });

  // Lần sau còn thử lại được nếu mạng lỗi giữa đường.
  loader.catch(() => {
    loader = null;
  });

  return loader;
}
