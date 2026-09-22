import { expect, test } from "@playwright/test";
import { freshAccount, register } from "./helpers";

/**
 * TÀI KHOẢN VÀ HỒ SƠ, nhìn từ phía khách.
 *
 * `functional-audit.spec.ts` đã kiểm phần API của nhóm này (đổi mật khẩu, xoá tài khoản, quyền
 * sở hữu lịch trình) và một lần sửa tên hiển thị. Ở đây là ba thứ còn lại mà chỉ giao diện trả
 * lời được: lỗi đăng nhập/đăng ký có tới được mắt khách không, hai trường hồ sơ còn lại có thật
 * sự được ghi không, và bỏ lưu ở một chỗ có đồng bộ sang chỗ kia không.
 */

test("đăng ký trùng email và đăng nhập sai mật khẩu đều hiện đúng lỗi của server", async ({ page }) => {
  const account = freshAccount("e2e-auth");
  expect((await page.request.post("/api/auth/register", { data: account })).status()).toBe(201);
  // Lượt đăng ký qua API đã đặt cookie phiên vào context; xoá đi để trang mở ở trạng thái khách.
  await page.context().clearCookies();

  await page.goto("/");
  await page.click("#btn-login-trigger");

  await page.getByRole("button", { name: "Đăng Ký", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Hoàng Minh").fill(account.name);
  await page.getByPlaceholder("name@example.com").fill(account.email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(account.password);
  await page.getByRole("button", { name: /tạo tài khoản/i }).click();
  await expect(page.getByText("Email này đã được sử dụng")).toBeVisible();

  // Nhãn "Đăng Nhập" nằm ở CẢ nút mở hộp thoại trên thanh điều hướng lẫn tab bên trong hộp
  // thoại; tab đứng sau trong DOM, nên `.last()` là cái thuộc hộp thoại.
  await page.getByRole("button", { name: "Đăng Nhập", exact: true }).last().click();
  await page.getByPlaceholder("name@example.com").fill(account.email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill("saibetmatkhau");
  await page.getByRole("button", { name: /đăng nhập ngay/i }).click();
  /**
   * Cùng một câu cho sai email và sai mật khẩu — xem `INVALID_CREDENTIALS` trong
   * server/routes/auth.ts. Khẳng định ở đây để một lần "cải thiện thông báo cho thân thiện"
   * không âm thầm biến form đăng nhập thành công cụ liệt kê email có tài khoản.
   */
  await expect(page.getByText("Email hoặc mật khẩu không đúng")).toBeVisible();

  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(account.password);
  await page.getByRole("button", { name: /đăng nhập ngay/i }).click();
  await expect(page.locator("#btn-user-profile")).toBeVisible({ timeout: 15_000 });
});

test("số điện thoại và trình độ lái được ghi lại, còn nguyên sau khi tải lại trang", async ({ page }) => {
  await page.goto("/");
  await register(page, freshAccount("e2e-profile"));

  await page.click("#btn-user-profile");
  const phone = page.getByPlaceholder("Ví dụ: 0912 345 678");
  await phone.fill("0912345678");
  // Nút lưu nằm cạnh ô nhập trong cùng một khối; đi qua DOM thay vì đoán thứ tự các nút "Lưu".
  await phone.locator("xpath=../..").getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(phone.locator("xpath=../..").getByRole("button")).toHaveText("Đã lưu");

  await page.getByRole("button", { name: /Đã có kinh nghiệm/ }).click();

  /**
   * Đọc lại từ server chứ không chỉ nhìn màn hình: số điện thoại này là số liên hệ cứu hộ, và
   * kiểu hỏng đáng sợ của nó là im lặng — giao diện báo đã lưu trong khi database vẫn rỗng.
   */
  const profile = await (await page.request.get("/api/auth/me")).json();
  expect(profile.user.phone).toBe("0912345678");
  expect(profile.user.riderLevel).toBe("Đã có kinh nghiệm");

  await page.reload();
  await page.click("#btn-user-profile");
  await expect(page.getByPlaceholder("Ví dụ: 0912 345 678")).toHaveValue("0912345678");
});

test("bỏ lưu trong hồ sơ cập nhật luôn trái tim ở lưới khám phá", async ({ page }) => {
  await page.goto("/");
  await register(page, freshAccount("e2e-fav"));

  const heart = page.locator('button[id^="btn-fav-"]').first();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");

  await page.click("#btn-user-profile");
  await page.getByRole("button", { name: /^Điểm đã lưu\s*1$/ }).click();
  await page.getByRole("button", { name: "Bỏ lưu", exact: true }).click();

  /**
   * Hai khung nhìn của cùng một danh sách. Chúng chỉ khớp nhau khi trạng thái yêu thích nằm ở
   * `AuthContext` chứ không được sao thành hai bản — nên phép kiểm này đỏ đúng lúc ai đó tách
   * state ra cho tiện một chỗ.
   */
  await expect(page.getByText("Chưa có địa điểm yêu thích")).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
});
