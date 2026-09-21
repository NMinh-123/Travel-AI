import type { ProviderProfile } from "@data/realtime/types";
import { classifyFetchError, errorMessage, fail, ok, type ToolResult } from "@server/infra/realtime/toolResult";

/**
 * MỘT LƯỢT GỌI HTTP RA NHÀ CUNG CẤP NGOÀI, có timeout và có thử lại đúng chỗ.
 *
 * Mọi adapter đi qua đây thay vì gọi `fetch` trực tiếp, để ba quy tắc dưới đây được áp thống nhất
 * chứ không phụ thuộc vào việc người viết adapter có nhớ hay không.
 *
 * QUY TẮC 1 — KHÔNG THỬ LẠI LỖI 4xx. Đây là quy tắc dễ làm sai nhất và tốn tiền nhất. Lỗi 4xx là
 * lỗi ở phía ta: tham số sai, khoá hết hạn, field mask không hợp lệ, vượt hạn mức. Thử lại một
 * request sai thì lần sau vẫn sai, nhưng với các API tính tiền theo lượt gọi thì mỗi lần thử lại
 * vẫn bị tính. Một tác tử gặp lỗi logic rồi thử lại trong vòng lặp là cách đốt hạn mức nhanh
 * nhất, và nó đã xảy ra ở nhiều dự án. Chỉ 5xx và lỗi mạng mới đáng thử lại, vì chúng là lỗi
 * nhất thời ở phía nhà cung cấp.
 *
 * QUY TẮC 2 — TIMEOUT 4 GIÂY, lấy từ `profile.timeoutMs`. Con số này đặt trong ngân sách của
 * NFR-PERF-03: ngưỡng 3 giây tính đến TOKEN ĐẦU TIÊN, không phải đến câu trả lời hoàn chỉnh, và
 * một lượt gọi Gemini đã ăn 600–1200 ms. Chờ một nhà cung cấp lâu hơn 4 giây thì thà trả lỗi có
 * cấu trúc để tác tử nói "chưa tra được" — khách nhận câu trả lời chậm mà đủ vẫn tốt hơn nhận
 * một câu trả lời rất chậm.
 *
 * QUY TẮC 3 — 429 KHÔNG PHẢI 4xx THÔNG THƯỜNG. Nó được tách riêng thành `RATE_LIMITED` và cũng
 * không thử lại: thử lại ngay khi vừa bị giới hạn tần suất là làm tình hình xấu thêm. Việc chờ
 * bao lâu rồi gọi lại thuộc quyền quyết định của tầng trên, không phải của một hàm HTTP.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Thân request dạng đối tượng; hàm này tự tuần tự hoá và tự đặt Content-Type. */
  body?: unknown;
}

/**
 * Gọi một endpoint JSON và trả về `ToolResult` bọc thân phản hồi đã phân giải.
 *
 * Không ném exception trong bất kỳ trường hợp nào — kể cả khi thân phản hồi không phải JSON hợp
 * lệ, vì một nhà cung cấp trả HTML báo lỗi kèm mã 200 là chuyện có thật và nó phải thành
 * `PROVIDER_ERROR` chứ không thành một exception rơi ra ngoài luồng.
 */
export async function requestJson<T>(
  url: string,
  profile: ProviderProfile,
  options: RequestOptions = {},
): Promise<ToolResult<T>> {
  const attempts = profile.maxRetries + 1;
  let lastMessage = "chưa gọi được lần nào";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Backoff tuyến tính chứ không lũy thừa: với maxRetries = 1 thì hai cách cho ra cùng một
    // con số, nên chọn cách đọc dễ hơn. Đổi maxRetries lên 3 trở lên thì hãy xem lại chỗ này.
    if (attempt > 0) await sleep(300 * attempt);

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(profile.timeoutMs),
      });
    } catch (error) {
      const code = classifyFetchError(error);
      lastMessage = errorMessage(error);
      // Timeout vẫn được thử lại vì nó có thể là nghẽn mạng nhất thời. Nhưng nếu đây đã là lần
      // cuối thì trả luôn, không chờ thêm một nhịp backoff vô ích.
      if (attempt === attempts - 1) return fail(code, lastMessage, profile.provider);
      continue;
    }

    if (response.status === 429) {
      return fail("RATE_LIMITED", `HTTP 429 từ ${profile.provider}`, profile.provider);
    }

    if (response.status >= 400 && response.status < 500) {
      // Đọc thân để đưa thông điệp của nhà cung cấp vào log — chúng thường nói chính xác tham số
      // nào sai, và đó là thứ duy nhất giúp sửa nhanh. Không thử lại.
      const detail = await response.text().catch(() => "");
      return fail(
        "PROVIDER_ERROR",
        `HTTP ${response.status} từ ${profile.provider}: ${detail.slice(0, 300)}`,
        profile.provider,
      );
    }

    if (!response.ok) {
      lastMessage = `HTTP ${response.status} từ ${profile.provider}`;
      if (attempt === attempts - 1) return fail("PROVIDER_ERROR", lastMessage, profile.provider);
      continue;
    }

    try {
      const payload = (await response.json()) as T;
      return ok(payload, profile.provider);
    } catch (error) {
      return fail(
        "PROVIDER_ERROR",
        `phản hồi không phải JSON hợp lệ: ${errorMessage(error)}`,
        profile.provider,
      );
    }
  }

  return fail("PROVIDER_ERROR", lastMessage, profile.provider);
}

/** Ghép query string, bỏ qua giá trị rỗng để URL không mang tham số vô nghĩa. */
export function buildUrl(base: string, path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
