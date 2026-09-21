import type { ToolErrorCode } from "@data/realtime/types";

/**
 * KẾT QUẢ CỦA MỘT TOOL DỮ LIỆU ĐỘNG — kiểu nền của cả tầng realtime.
 *
 * Điều quan trọng nhất về kiểu này: **không có nhánh nào trả dữ liệu suy đoán khi lỗi**. Đó là
 * DR-AGENT-08, và nó là lý do tồn tại của cả kiểu union này thay vì một hàm ném exception hay
 * một hàm trả `T | null`.
 *
 * Vì sao không dùng exception. Một tool thất bại KHÔNG phải sự cố của chương trình mà là một dữ
 * kiện mà tác tử cần biết để nói với khách rằng chưa tra được. Dùng exception thì thông tin đó
 * lọt ra khỏi luồng dữ liệu và rơi vào tay khối catch ở tầng trên, nơi không còn ngữ cảnh để
 * quyết định nên nói gì — và cách xử lý dễ nhất ở đó luôn là bỏ qua rồi để model tự bịa.
 *
 * Vì sao không dùng `T | null`. `null` mất mã lỗi, và mã lỗi quyết định hành vi khác nhau:
 * `PROVIDER_NOT_CONFIGURED` thì tác tử nói tính năng chưa bật, `UNSUPPORTED_REGION` thì nói
 * ngoài địa bàn, còn `TIMEOUT` thì nói thử lại sau. Gộp cả ba thành `null` là biến ba câu trả lời
 * đúng thành một câu trả lời chung chung.
 *
 * `retrieved_at` có mặt ở CẢ HAI nhánh, kể cả nhánh lỗi. Nó là mốc thời gian mà Validator ở giai
 * đoạn G dùng để chặn dữ kiện realtime quá TTL, và nhánh lỗi cũng cần mốc đó để trace ghi được
 * thời điểm thất bại.
 */
export type ToolResult<T> =
  | {
      ok: true;
      data: T;
      /** Khoá nhà cung cấp đã trả dữ liệu này. Đi vào câu ghi nguồn của câu trả lời. */
      source: string;
      /** ISO 8601. Với dữ liệu từ cache, đây là thời điểm gọi API GỐC, không phải lúc đọc cache. */
      retrieved_at: string;
      cached: boolean;
    }
  | {
      ok: false;
      error: { code: ToolErrorCode; message: string; provider: string };
      retrieved_at: string;
    };

/**
 * Nhánh thất bại, tách thành kiểu riêng.
 *
 * Cần kiểu này vì `ToolResult<never>` KHÔNG dùng được để biểu đạt "chỉ có thể là lỗi": nó vẫn
 * còn nhánh `ok: true` với `data: never`, nên một hàm trả `{ ok: true; value: X } | ToolResult<never>`
 * sẽ không thu hẹp được bằng `if (!x.ok)` — sau phép kiểm đó vẫn còn hai nhánh `ok: true` và
 * TypeScript báo thiếu thuộc tính. `ToolFailure` chỉ có một nhánh nên thu hẹp sạch, và vì nó là
 * đúng nhánh lỗi của `ToolResult<T>` với mọi `T`, nó gán thẳng được vào kiểu trả về của bất kỳ
 * tool nào.
 */
export type ToolFailure = Extract<ToolResult<unknown>, { ok: false }>;

/**
 * Thu hẹp một `ToolResult` về nhánh thất bại.
 *
 * PHẢI DÙNG HÀM NÀY, KHÔNG VIẾT `if (!result.ok)`. Lý do nằm ở cấu hình biên dịch của dự án:
 * `tsconfig.json` không bật `strict` nên `strictNullChecks` đang tắt, và khi tắt cờ đó thì
 * TypeScript KHÔNG thu hẹp union theo phép kiểm truthiness trên trường phân biệt. Hệ quả là
 * `if (!result.ok) return result;` không biên dịch được: sau phép kiểm, `result` vẫn mang cả hai
 * nhánh, nên nó không gán được vào kiểu trả về và cũng không truy cập được `.error`.
 *
 * Vị từ kiểu tường minh (`r is ToolFailure`) thì vẫn thu hẹp bình thường vì đó là một khẳng định
 * của người viết chứ không phải suy luận theo luồng điều khiển. Nói cách khác, hàm này là cách
 * viết mẫu `early return` cho lỗi mà vẫn chạy được dưới cấu hình hiện tại.
 *
 * Bật `strictNullChecks` cho cả dự án sẽ làm mẫu `if (!result.ok)` hoạt động và khiến hàm này
 * thành không cần thiết — nhưng đó là một thay đổi ảnh hưởng toàn bộ codebase, không phải việc
 * của tầng realtime, nên để nguyên và ghi lại lý do ở đây.
 */
export function isFailure<T>(result: ToolResult<T>): result is ToolFailure {
  return result.ok === false;
}

export function ok<T>(
  data: T,
  source: string,
  options?: { cached?: boolean; retrievedAt?: string },
): ToolResult<T> {
  return {
    ok: true,
    data,
    source,
    retrieved_at: options?.retrievedAt ?? new Date().toISOString(),
    cached: options?.cached ?? false,
  };
}

export function fail(code: ToolErrorCode, message: string, provider: string): ToolFailure {
  return {
    ok: false,
    error: { code, message, provider },
    retrieved_at: new Date().toISOString(),
  };
}

/**
 * Quy lỗi của `fetch` về `ToolErrorCode`.
 *
 * `AbortSignal.timeout` ném `DOMException` tên `TimeoutError`, còn `AbortController.abort()` ném
 * tên `AbortError`; cả hai đều phải thành `TIMEOUT` chứ không phải `PROVIDER_ERROR`, vì hai mã
 * này dẫn tới hai câu trả lời khác nhau cho khách và tới hai quyết định khác nhau về việc có thử
 * lại hay không.
 *
 * Mọi thứ còn lại — DNS không phân giải, kết nối bị từ chối, TLS lỗi — đều là `PROVIDER_ERROR`.
 * Cố phân loại mịn hơn ở đây không có giá trị: tác tử xử lý chúng như nhau, và thông tin chi
 * tiết đã nằm trong `message` để trace giữ lại.
 */
export function classifyFetchError(error: unknown): ToolErrorCode {
  const name = (error as { name?: string })?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") return "TIMEOUT";
  return "PROVIDER_ERROR";
}

/** Thông điệp gọn cho log và cho trace. Không đưa nguyên văn ra cho khách. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
