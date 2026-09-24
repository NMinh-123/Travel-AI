import path from "node:path";
import { defineConfig } from "@playwright/test";
import { TEST_DATABASE_URL } from "./test/integration/bootstrap";

/**
 * E2E CHẠY TRÊN ỨNG DỤNG THẬT, nhưng KHÔNG gọi model thật.
 *
 * `GEMINI_BASE_URL` trỏ vào máy chủ giả ở `e2e/mock-gemini.ts`, và `EMBEDDER=gemini` để cả lượt
 * nhúng cũng đi qua đó — nhờ vậy E2E không cần sidecar embedding, không tốn tiền, và cho kết quả
 * lặp lại được. Thứ E2E kiểm là LUỒNG, còn chất lượng câu trả lời thì bộ đánh giá ở `eval/` lo,
 * chạy theo lịch với model thật.
 */
const MOCK_PORT = 4010;
const APP_PORT = 4011;

export default defineConfig({
  testDir: "e2e",
  // Dùng chung một database nên chạy tuần tự; song song ở đây chỉ đổi lấy những lần đỏ ngẫu nhiên.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: path.resolve(import.meta.dirname, "e2e/global-setup.ts"),
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    locale: "vi-VN",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: `npx tsx e2e/mock-gemini.ts ${MOCK_PORT}`,
      url: `http://127.0.0.1:${MOCK_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npx tsx server/index.ts",
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(APP_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: "e2e-placeholder-secret-at-least-32-characters",
        GEMINI_API_KEY: "e2e-fake-key",
        GEMINI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        EMBEDDER: "gemini",
        // Không bật sidecar: mọi lượt nhúng đã đi qua máy chủ giả.
        EMBEDDING_AUTOSTART: "false",
        RERANK_ENABLED: "false",
        /**
         * Bộ đếm hạn mức trong BỘ NHỚ, không phải trong database.
         *
         * Cả bộ E2E đi ra từ một IP, nên 15 lượt đăng ký của nó dùng chung đúng một bộ đếm với
         * trần 20 lượt/10 phút. Bộ đếm ở database sống lâu hơn tiến trình server, nên chạy lại
         * bộ test trong cùng cửa sổ đó — hoặc một lần `--retries` ở CI — là nhận 429 và đỏ ở
         * những bài không liên quan gì tới giới hạn tần suất. Ở bộ nhớ thì mỗi lần server khởi
         * động là một bộ đếm sạch. Hành vi giới hạn không đổi, chỉ đổi nơi giữ số đếm; phần
         * kiểm chính giới hạn đó nằm ở tầng integration.
         */
        RATE_LIMIT_STORE: "memory",
        // Mọi test E2E chat dưới tư cách khách từ cùng một IP (127.0.0.1), nên trần 15 lượt/ngày
        // của khách sẽ chặn giữa chừng. Trần đó được kiểm ở server/infra/aiBudget.test.ts.
        AI_GUEST_TURNS_PER_DAY: "0",
        // Ngưỡng liên quan về 0: E2E không đo chất lượng truy xuất, và một ngưỡng chặn ở đây sẽ
        // biến mọi lượt chat thành chuyển tiếp.
        RAG_MIN_VECTOR_SIMILARITY: "0",
        RAG_MIN_KEYWORD_RANK: "0",
      },
    },
  ],
});
