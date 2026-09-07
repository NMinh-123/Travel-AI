/**
 * Nạp Google Identity Services theo yêu cầu.
 *
 * Script của Google chỉ được tải khi server có GOOGLE_CLIENT_ID **và** người dùng mở hộp
 * đăng nhập — không nhúng sẵn vào trang. Nhờ vậy người chỉ vào xem điểm đến không phải tải
 * script của bên thứ ba nào.
 *
 * Dùng renderButton của Google thay vì tự vẽ nút: nút thật luôn đúng quy định thương hiệu
 * của họ, và luồng lấy ID token không phải tự dựng lại.
 */

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let loader: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);

  loader ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error('Google Identity Services nạp xong nhưng không dùng được'));
    });
    script.addEventListener('error', () =>
      reject(new Error('Không tải được script đăng nhập của Google'))
    );

    document.head.appendChild(script);
  });

  // Lần sau còn thử lại được nếu mạng lỗi giữa đường.
  loader.catch(() => {
    loader = null;
  });

  return loader;
}

export type { GoogleAccountsId, GoogleCredentialResponse };
