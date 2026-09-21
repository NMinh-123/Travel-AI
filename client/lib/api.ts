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

  const body = await response.json().catch(() => null);

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
