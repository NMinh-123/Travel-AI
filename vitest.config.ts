import path from "node:path";
import { defineConfig } from "vitest/config";

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
    setupFiles: ["test/setup-env.ts"],
    // Test integration nằm ở `vitest.integration.config.ts` vì chúng cần Postgres thật. Bộ này
    // phải chạy được ở mọi máy và trong mọi PR, nên nó không được phụ thuộc vào hạ tầng nào.
    exclude: ["**/node_modules/**", "**/.venv/**", "**/dist/**", "**/*.int.test.ts", "e2e/**"],
  },
});
