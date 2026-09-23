import { expect, test } from "@playwright/test";
import { CHAT_INPUT, freshAccount } from "./helpers";

test.use({ screenshot: "only-on-failure" });

test("API trả HTML 200 phải hiện lỗi và thử lại được", async ({ page }) => {
  await page.route("**/api/content/destinations", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<html>SPA fallback</html>",
  }));
  await page.goto("/");
  await expect(page.getByText("Máy chủ trả về phản hồi JSON không hợp lệ", { exact: true })).toBeVisible();
  await page.unroute("**/api/content/destinations");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator('article[id^="card-dest-"]').first()).toBeVisible();
});

test("TC-AUTH-02: mật khẩu 7 ký tự bị chặn ở form và API", async ({ page }) => {
  const account = { ...freshAccount("release-short"), password: "1234567" };
  await page.goto("/");
  await page.click("#btn-login-trigger");
  await page.getByRole("button", { name: "Đăng Ký", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Hoàng Minh").fill(account.name);
  await page.getByPlaceholder("name@example.com").fill(account.email);
  const password = page.getByPlaceholder("Tối thiểu 8 ký tự");
  await password.fill(account.password);
  await page.getByRole("button", { name: /tạo tài khoản/i }).click();
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
  const response = await page.request.post("/api/auth/register", { data: account });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Mật khẩu phải có ít nhất 8 ký tự" });
});

test("TC-AUTH-07: thiếu Google client ID vẫn giải thích rõ và dùng được form email", async ({ page }) => {
  await page.route("**/api/config", (route) => route.fulfill({
    json: { googleClientId: null, googleMapsEmbedKey: null },
  }));
  await page.goto("/");
  await page.click("#btn-login-trigger");
  await page.click("#btn-google-login");
  await expect(page.getByText(/Đăng nhập Google chưa được cấu hình:/)).toBeVisible();
  await expect(page.getByPlaceholder("name@example.com")).toBeEnabled();
  await expect(page.getByPlaceholder("Tối thiểu 8 ký tự")).toBeEnabled();
});

test("TC-PLAN-01: lịch trình mẫu hiện đầy đủ số ngày và tổng quan", async ({ page, request }) => {
  const presets = await (await request.get("/api/content/preset-itineraries")).json();
  expect(presets.length).toBeGreaterThan(0);
  await page.goto("/");
  await page.click("#nav-tab-planner");
  await expect(page.getByRole("heading", { name: presets[0].title, exact: true })).toBeVisible();
  await expect(page.locator('[id^="tab-day-"]')).toHaveCount(presets[0].days.length);
  await expect(page.getByText("Tổng quãng đường", { exact: true })).toBeVisible();
  await expect(page.getByText("Độ cao dao động", { exact: true })).toBeVisible();
});

test("TC-PLAN-02: thiếu lịch trình mẫu có giải thích và nút thử lại", async ({ page }) => {
  await page.route("**/api/content/preset-itineraries", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.click("#nav-tab-planner");
  await expect(page.getByText(/Database chưa có lịch trình mẫu nào/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
});

test("TC-CHAT-12: tin nhắn rỗng hoặc chỉ có khoảng trắng không gửi được", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-concierge");
  await expect(page.locator("#btn-send-ai-chat")).toBeDisabled();
  await page.getByPlaceholder(CHAT_INPUT).fill("   ");
  await expect(page.locator("#btn-send-ai-chat")).toBeDisabled();
});

test("TC-PLAN-11: 30 ngày bị từ chối với khoảng hợp lệ", async ({ request }) => {
  const response = await request.post("/api/plan-itinerary", { data: { days: 30 } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe("Số ngày phải là số nguyên từ 1 đến 14");
});

test("TC-EXP-11: hỏi AI chuyển đúng tên điểm đến vào ô nhập", async ({ page, request }) => {
  const destinations = await (await request.get("/api/content/destinations")).json();
  const destination = destinations[0];
  await page.goto("/");
  await page.locator(`#btn-dest-ai-${destination.id}`).click();
  await expect(page.getByPlaceholder(CHAT_INPUT)).toHaveValue(
    `Tư vấn chi tiết về kinh nghiệm tham quan, ăn uống và chụp ảnh tại ${destination.vietnameseName}`,
  );
});

test("TC-EXP-10: lưu yêu thích lúc chưa đăng nhập phải hoàn tất sau đăng nhập", async ({ page }) => {
  const account = freshAccount("release-favorite");
  expect((await page.request.post("/api/auth/register", { data: account })).status()).toBe(201);
  await page.context().clearCookies();
  await page.goto("/");
  const heart = page.locator('button[id^="btn-fav-"]').first();
  await heart.click();
  await page.getByPlaceholder("name@example.com").fill(account.email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(account.password);
  await page.getByRole("button", { name: /đăng nhập ngay/i }).click();
  await expect(page.locator("#btn-user-profile")).toBeVisible();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
});
