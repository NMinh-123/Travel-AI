import { TEST_DATABASE_URL } from "./bootstrap";

/**
 * Trỏ mọi module server sang database test TRƯỚC khi chúng được nạp.
 *
 * `server/infra/db.ts` dựng client một lần theo `DATABASE_URL` lúc nạp module, nên đặt biến ở đây
 * là cách duy nhất để mã đang test dùng đúng database test mà không phải sửa chính mã đó.
 */
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET ??= "integration-test-placeholder-at-least-32-characters";
