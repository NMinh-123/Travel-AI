/**
 * Một chỗ duy nhất để gọi API của chính ứng dụng.
 *
 * Lý do tồn tại: cách đọc lỗi từ server đã được lặp lại ở bốn component
 * (`[data.error, data.details].filter(Boolean).join(' — ')`). Gom về đây để mọi lời gọi
 * hiển thị lỗi thật của server thay vì một câu chung chung, và để `credentials: 'include'`
 * không bị quên ở đâu đó khiến cookie session không được gửi.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers:
      init?.body !== undefined
        ? { 'Content-Type': 'application/json', ...init?.headers }
        : init?.headers
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => {
    // HTML từ SPA/proxy hoặc JSON hỏng không được biến thành một kết quả thành công null.
    if (response.ok) {
      throw new ApiError('Máy chủ trả về phản hồi JSON không hợp lệ', response.status);
    }
    return null;
  });

  if (!response.ok) {
    const message =
      [body?.error, body?.details].filter(Boolean).join(' — ') ||
      `Máy chủ trả về lỗi ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Một sự kiện đọc được từ endpoint streaming. `type` quyết định các trường còn lại. */
export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Đọc một phản hồi Server-Sent Events do chính ứng dụng trả về.
 *
 * KHÔNG dùng `EventSource` được: nó chỉ gửi được GET, còn một lượt chat mang tin nhắn và
 * `sessionId` trong thân request. Nên ở đây là `fetch` + đọc tay từng khung — vẫn là SSE đúng
 * chuẩn ở phía server, chỉ là client tự tách khung.
 *
 * Lỗi TRƯỚC khi luồng mở (400, 404, 429, 503) vẫn về dưới dạng JSON như mọi endpoint khác, nên
 * chúng ném `ApiError` y hệt `apiRequest` và nơi gọi không phải phân biệt hai kiểu lỗi. Lỗi xảy
 * ra GIỮA luồng thì không còn mã trạng thái nào để mang, nên nó về thành một sự kiện `error` —
 * nơi gọi tự quyết định làm gì với nó.
 */
export async function* streamRequest(path: string, init: RequestInit): AsyncGenerator<StreamEvent> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...init.headers
    }
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    const message =
      [body?.error, body?.details].filter(Boolean).join(' — ') ||
      `Máy chủ trả về lỗi ${response.status}`;
    throw new ApiError(message, response.status);
  }

  const reader = response.body.getReader();
  // `stream: true` là bắt buộc: một ký tự tiếng Việt chiếm nhiều byte và hoàn toàn có thể bị cắt
  // đôi giữa hai gói mạng. Giải mã từng gói độc lập sẽ sinh ra ký tự thay thế ngay giữa câu.
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Khung SSE kết thúc bằng một dòng trống. Chuẩn hoá CRLF phòng khi có tầng trung gian nào
      // đổi kiểu xuống dòng trên đường đi.
      buffer = buffer.replace(/\r\n/g, '\n');

      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);

        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');

        // Khung chỉ có `: ping` là nhịp giữ kết nối, không mang dữ liệu.
        if (data) {
          try {
            yield JSON.parse(data) as StreamEvent;
          } catch {
            // Khung hỏng thì bỏ qua đúng khung đó, KHÔNG dừng cả luồng: dừng là vứt luôn câu trả
            // lời đang về, trong khi `final` ở cuối vẫn còn nguyên cơ hội tới nơi.
          }
        }

        split = buffer.indexOf('\n\n');
      }
    }
  } finally {
    // Nơi gọi thoát sớm (khách đổi hội thoại giữa chừng): đóng socket thay vì để nó treo.
    void reader.cancel().catch(() => {});
  }
}
