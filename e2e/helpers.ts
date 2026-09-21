import { expect, type Page } from "@playwright/test";

/**
 * Bộ chọn dùng chung cho E2E.
 *
 * Chọn theo PLACEHOLDER chứ không theo nhãn: nhãn trong AuthModal không gắn `htmlFor` nên
 * `getByLabel` không tìm thấy gì. Ghi lại ở đây thay vì để mỗi spec tự xoay xở, và đây cũng là
 * chỗ đáng sửa nếu sau này giao diện gắn nhãn đúng chuẩn.
 */

export const CHAT_INPUT = "Hỏi bất kỳ điều gì về đường đèo, homestay, thời tiết Hà Giang...";

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Mỗi lần chạy một tài khoản mới: test không được phụ thuộc vào dữ liệu lần chạy trước. */
export function freshAccount(prefix = "e2e"): Account {
  return {
    name: "Khách E2E",
    email: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`,
    password: "matkhaudumanh123",
  };
}

export async function register(page: Page, account: Account): Promise<void> {
  await page.click("#btn-login-trigger");
  await page.getByRole("button", { name: "Đăng Ký", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Hoàng Minh").fill(account.name);
  await page.getByPlaceholder("name@example.com").fill(account.email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(account.password);
  await page.getByRole("button", { name: /tạo tài khoản/i }).click();
  // Nút hồ sơ chỉ xuất hiện khi đã đăng nhập.
  await expect(page.locator("#btn-user-profile")).toBeVisible({ timeout: 15_000 });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder(CHAT_INPUT);
  await input.fill(text);
  await input.press("Enter");
}
