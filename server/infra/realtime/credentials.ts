import type { ProviderProfile } from "@data/realtime/types";

/**
 * Đọc khoá API của một nhà cung cấp. Trả `null` khi profile khai cần khoá mà biến môi trường
 * tương ứng chưa được đặt.
 *
 * VÌ SAO TRẢ `string | null` CHỨ KHÔNG TRẢ MỘT UNION CÓ NHÁNH LỖI. Bản đầu của hàm này trả
 * `{ ok: true; value: string } | ToolFailure` cho gọn ở chỗ gọi, nhưng nó không biên dịch được:
 * dự án đang tắt `strictNullChecks`, và khi tắt cờ đó thì `if (!key.ok)` không thu hẹp được
 * union. Dạng `string | null` với phép kiểm `=== null` thì thu hẹp bình thường trong mọi cấu
 * hình, nên nó là dạng đúng ở đây. Chỗ gọi tự sinh `fail("PROVIDER_NOT_CONFIGURED", ...)`, và như
 * vậy thông điệp lỗi cũng nói được tên nhà cung cấp cụ thể của mình.
 *
 * VÌ SAO ĐỌC `process.env` THEO TÊN KHAI TRONG PROFILE thay vì đọc `config.googleMapsApiKey`.
 * Tên biến môi trường là thuộc tính của nhà cung cấp, và nó đã được khai ở
 * @data/realtime/providers cùng `baseUrl` và `ttlSeconds`. Thêm một nhà cung cấp mới thì chỉ cần
 * khai `apiKeyEnv` là dùng được ngay; nếu ở đây đọc cứng một trường của `config` thì mỗi nhà cung
 * cấp mới lại phải sửa cả `server/config.ts` lẫn hàm này. `config.ts` vẫn là nơi validate giá trị
 * và là nơi ghi hướng dẫn tạo khoá — hai việc đó không xung đột với việc đọc theo tên ở đây.
 *
 * VÌ SAO KHÔNG DỪNG SERVER KHI THIẾU KHOÁ. Thiếu khoá bản đồ không được phép làm hỏng những phần
 * không liên quan — đăng nhập, nội dung, chat về tri thức đều chạy bình thường mà không cần
 * Google. Thay vào đó tool trả `PROVIDER_NOT_CONFIGURED`, và theo DR-AGENT-08 thì tác tử nói
 * thẳng là chưa tra được thông tin đó. Đây là điểm khác biệt so với `DATABASE_URL` và
 * `JWT_SECRET`, hai biến mà thiếu là dừng ngay: thiếu chúng thì KHÔNG phần nào của hệ thống chạy
 * đúng, còn thiếu khoá bản đồ thì chỉ mất đúng nhóm tính năng dùng bản đồ.
 */
export function readApiKey(profile: ProviderProfile): string | null {
  // Nhà cung cấp không cần khoá — Open-Meteo thuộc nhóm này, và đó là một trong những lý do chọn
  // nó. Trả chuỗi rỗng để người gọi đi chung một đường code thay vì rẽ nhánh theo việc có khoá.
  if (!profile.apiKeyEnv) return "";

  const value = process.env[profile.apiKeyEnv]?.trim();
  return value ? value : null;
}

/** Thông điệp lỗi thống nhất cho trường hợp thiếu khoá, để bốn adapter không viết lệch nhau. */
export function missingKeyMessage(profile: ProviderProfile): string {
  return `chưa đặt ${profile.apiKeyEnv} — xem hướng dẫn tạo khoá trong .env.example`;
}
