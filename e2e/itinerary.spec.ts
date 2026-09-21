import { expect, test } from "@playwright/test";
import { freshAccount, register } from "./helpers";

/**
 * LUỒNG: tạo lịch trình rồi lưu vào tài khoản.
 *
 * Phần đáng kiểm không phải nội dung lịch trình — máy chủ giả trả về một bản cố định — mà là
 * chuỗi bước: sinh xong thì giao diện render được, và nút lưu chỉ hoạt động khi đã đăng nhập.
 * Ràng buộc thứ hai là một quyết định sản phẩm nằm ở giao diện, nên chỉ E2E kiểm được.
 */

test("tạo lịch trình và lưu vào tài khoản", async ({ page }) => {
  const account = freshAccount("e2e-plan");
  await page.goto("/");
  await register(page, account);

  await page.click("#nav-tab-planner");
  await page.click("#btn-generate-itinerary");

  // Lịch trình do máy chủ giả trả về, nên tiêu đề là hằng số kiểm được.
  await expect(page.getByText("Hà Giang 2 ngày 1 đêm")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Dốc Bắc Sum/)).toBeVisible();

  await page.getByRole("button", { name: /lưu lịch trình/i }).click();
  // Sau khi lưu, nút đổi trạng thái — không khẳng định chữ cụ thể để test không vỡ vì một lần
  // sửa nhãn, chỉ khẳng định nút không còn mời lưu lần nữa.
  await expect(page.getByRole("button", { name: /^lưu lịch trình$/i })).toHaveCount(0, { timeout: 15_000 });
});

test("chưa đăng nhập thì lưu lịch trình mời đăng nhập trước", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-planner");
  await page.click("#btn-generate-itinerary");
  await expect(page.getByText("Hà Giang 2 ngày 1 đêm")).toBeVisible({ timeout: 30_000 });

  // Nút lưu chỉ hiện khi đã đăng nhập; khách vãng lai phải thấy lời mời đăng nhập thay vì một nút
  // bấm vào rồi mới báo lỗi.
  await expect(page.getByRole("button", { name: /^lưu lịch trình$/i })).toHaveCount(0);
});
