import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Cấu hình cho test INTEGRATION — cần Postgres thật, nên tách khỏi `npm test`.
 *
 * Tách vì hai bộ có điều kiện chạy khác nhau: test nhanh phải chạy được ở mọi máy và trong mọi PR,
 * còn test integration cần một database. Gộp chung thì `npm test` đỏ trên máy chưa dựng database,
 * và khi đó người ta sẽ bỏ qua cả hai.
 *
 * Quy ước tên: `*.int.test.ts`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@client": path.resolve(import.meta.dirname, "client"),
      "@server": path.resolve(import.meta.dirname, "server"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@data": path.resolve(import.meta.dirname, "data"),
      "@eval": path.resolve(import.meta.dirname, "eval"),
      "@test": path.resolve(import.meta.dirname, "test"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.int.test.ts"],
    exclude: ["**/node_modules/**", "**/.venv/**", "**/dist/**"],
    globalSetup: ["test/integration/global-setup.ts"],
    setupFiles: ["test/integration/setup.ts"],
    // Dùng chung một database nên chạy tuần tự: hai file cùng ghi vào KnowledgeDoc sẽ giẫm lên
    // nhau, và một test đỏ vì lý do đó thì tệ hơn là không có test.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
