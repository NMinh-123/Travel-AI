/**
 * Nạp Google Identity Services theo yêu cầu.
 *
 * Script của Google chỉ được tải khi người dùng mở hộp đăng nhập và server có GOOGLE_CLIENT_ID —
 * không nhúng sẵn vào trang. Nhờ vậy người chỉ vào xem điểm đến không phải tải script của bên
 * thứ ba nào.
 *
 * NÚT BẤM LÀ NÚT CỦA MÌNH, LUỒNG VẪN LÀ CỦA GOOGLE. Trước đây chỗ này để `renderButton` vẽ nút
 * chính chủ, nhưng nút ấy nằm trong một iframe: không nhận được bo góc, cỡ chữ hay màu của giao
 * diện, và nó chỉ xuất hiện khi đã cấu hình xong — trang đăng nhập thì trống trơn, người dùng
 * không biết là chưa cấu hình hay đã bỏ tính năng.
 *
 * Nên giờ nút do mình vẽ và bấm vào thì gọi `prompt()`, tức đúng hộp chọn tài khoản của Google,
 * trả về cùng một ID token cho server xác minh. `renderButton` vẫn giữ làm phương án dự phòng:
 * `prompt()` có thể không hiện được (người dùng đã tắt, hoặc trình duyệt chặn), và khi đó phải
 * còn một đường vào thật thay vì một nút bấm mãi không ra gì.
 */

interface GoogleCredentialResponse {
  credential?: string;
}

/**
 * Kết quả của `prompt()`. Google báo qua đây khi hộp chọn tài khoản KHÔNG hiện ra được — đó là
 * tín hiệu duy nhất cho biết phải chuyển sang nút chính chủ, vì bản thân lời gọi không ném lỗi.
 */
interface GooglePromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(listener?: (notification: GooglePromptNotification) => void): void;
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
