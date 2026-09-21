import { execFileSync } from "node:child_process";
import { bootstrapTestDatabase, TEST_DATABASE_URL } from "@test/integration/bootstrap";

/**
 * Dựng database E2E rồi nạp dữ liệu tối thiểu.
 *
 * Dùng chung database test với nhóm integration: cùng một lược đồ, cùng một cách dựng lại, nên
 * thêm một database thứ ba chỉ thêm một thứ phải nhớ. Hai bộ không chạy song song (E2E có
 * `webServer` riêng), nên chúng không giẫm lên nhau.
 */
export default async function globalSetup(): Promise<void> {
  await bootstrapTestDatabase();

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  // Seed danh mục thật: giao diện đọc Destination và Homestay, nên không seed thì trang trống và
  // test sẽ đỏ vì một lý do không liên quan gì tới luồng đang kiểm.
  execFileSync("npx", ["tsx", "db/seed.ts"], { env, stdio: "pipe", shell: process.platform === "win32" });
  execFileSync("npx", ["tsx", "e2e/seed-knowledge.ts"], { env, stdio: "pipe", shell: process.platform === "win32" });
}
