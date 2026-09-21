// Chỉ phục vụ nạp module trong test; mọi I/O nghiệp vụ phải được thay bằng fixture.
process.env.DATABASE_URL ??= "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.JWT_SECRET ??= "offline-test-placeholder-at-least-32-characters";

/**
 * Bộ đếm hạn mức đếm trong bộ nhớ ở bộ test nhanh.
 *
 * Mặc định của server là đếm xuống Postgres (xem server/infra/rateLimitStore.ts), nhưng bộ test
 * này phải chạy được ở mọi máy mà không cần database — đúng quy ước đã nêu trong vitest.config.ts.
 * Bản đếm xuống database được kiểm riêng ở `*.int.test.ts`.
 */
process.env.RATE_LIMIT_STORE ??= "memory";
