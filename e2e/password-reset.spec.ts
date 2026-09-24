import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "../test/integration/bootstrap";
import { freshAccount } from "./helpers";

/**
 * QUÊN MẬT KHẨU BẰNG MÃ OTP, nhìn từ phía khách.
 *
 * Server E2E không có RESEND_API_KEY nên không gửi thư thật. Mã được ghi thẳng vào database,
 * đúng dạng `sendPasswordResetCode` ghi — phần gửi thư đã có bài kiểm ở server/routes/auth.test.ts.
 * Ở đây kiểm phần chỉ trình duyệt trả lời được: hộp thoại đi đúng các bước, mật khẩu mới dùng
 * được, còn mã thì không dùng lại được.
 */

/** Phải khớp JWT_SECRET của server E2E trong playwright.config.ts — đó là khoá HMAC của mã. */
const E2E_JWT_SECRET = "e2e-placeholder-secret-at-least-32-characters";

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
test.afterAll(() => prisma.$disconnect());

async function plantResetCode(email: string, code: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: {
      passwordResetCodeHash: createHmac("sha256", E2E_JWT_SECRET)
        .update(`password-reset:${email}:${code}`)
        .digest("hex"),
      passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      passwordResetAttempts: 0,
    },
  });
}

test("nhập mã trong thư cùng mật khẩu mới rồi đăng nhập lại bằng nó", async ({ page }) => {
  const account = freshAccount("e2e-reset");
  expect((await page.request.post("/api/auth/register", { data: account })).status()).toBe(201);
  await page.context().clearCookies();
  await plantResetCode(account.email, "482913");

  await page.goto("/");
  await page.click("#btn-login-trigger");
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await page.getByPlaceholder("name@example.com").fill(account.email);
  await page.getByRole("button", { name: /gửi mã/i }).click();
  /**
   * Server E2E chưa cấu hình gửi thư nên lần gửi đầu trả 503 (TC-AUTH-13). Bước nhập mã chỉ mở
   * sau khi gửi thành công, nên lần sau chặn request để giả lập server đã nhận yêu cầu — mã thật
   * đã nằm sẵn trong database.
   */
  await expect(page.getByText("Chức năng quên mật khẩu chưa được cấu hình")).toBeVisible();
  await page.route("**/api/auth/forgot-password", (route) =>
    route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.getByRole("button", { name: /gửi mã/i }).click();

  await expect(page.getByRole("heading", { name: "Đặt mật khẩu mới" })).toBeVisible();
  const newPassword = "matkhaumoi-sau-khi-quen";

  // Mã sai: hiện lỗi của server, chưa đăng nhập.
  await page.getByPlaceholder("6 chữ số trong thư").fill("000000");
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(newPassword);
  await page.getByRole("button", { name: /đặt mật khẩu mới/i }).click();
  await expect(page.getByText("Mã xác nhận không đúng hoặc đã hết hạn")).toBeVisible();

  await page.getByPlaceholder("6 chữ số trong thư").fill("482913");
  await page.getByRole("button", { name: /đặt mật khẩu mới/i }).click();
  await expect(page.locator("#btn-user-profile")).toBeVisible({ timeout: 15_000 });

  // Mật khẩu cũ hết tác dụng, mật khẩu mới thì dùng được.
  const login = (password: string) =>
    page.request.post("/api/auth/login", { data: { email: account.email, password } });
  expect((await login(account.password)).status()).toBe(401);
  expect((await login(newPassword)).status()).toBe(200);

  // Mã chỉ dùng được một lần.
  const reuse = await page.request.post("/api/auth/reset-password", {
    data: { email: account.email, code: "482913", password: "lai-them-lan-nua" },
  });
  expect(reuse.status()).toBe(400);
});

test("sai mã 5 lần thì mã hỏng, kể cả khi lần thứ 6 nhập đúng", async ({ request }) => {
  const account = freshAccount("e2e-reset-brute");
  expect((await request.post("/api/auth/register", { data: account })).status()).toBe(201);
  await plantResetCode(account.email, "135790");

  const attempt = (code: string) =>
    request.post("/api/auth/reset-password", {
      data: { email: account.email, code, password: "matkhaumoi-12345" },
    });
  for (let wrong = 0; wrong < 5; wrong += 1) {
    expect((await attempt(String(100000 + wrong))).status()).toBe(400);
  }
  expect((await attempt("135790")).status()).toBe(400);
});

test("server chưa cấu hình gửi thư thì bấm Quên mật khẩu nhận câu giải thích", async ({ page }) => {
  await page.goto("/");
  await page.click("#btn-login-trigger");
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByRole("heading", { name: "Quên mật khẩu" })).toBeVisible();

  await page.getByPlaceholder("name@example.com").fill("ai-do@example.invalid");
  await page.getByRole("button", { name: /gửi mã/i }).click();
  await expect(page.getByText("Chức năng quên mật khẩu chưa được cấu hình")).toBeVisible();

  await page.getByRole("button", { name: "Quay lại đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập tài khoản" })).toBeVisible();
});
