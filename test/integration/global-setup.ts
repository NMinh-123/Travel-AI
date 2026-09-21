import { bootstrapTestDatabase } from "./bootstrap";

/** Chạy MỘT lần trước toàn bộ test integration. Dựng lược đồ để từng file test chỉ lo dữ liệu. */
export default async function setup(): Promise<void> {
  await bootstrapTestDatabase();
}
