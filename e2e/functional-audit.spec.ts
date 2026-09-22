import { expect, test, type APIRequestContext } from '@playwright/test';
import { freshAccount, register } from './helpers';

// Functional audit: real application/database; injected HTTP failures are labelled explicitly.
test.use({ screenshot: 'only-on-failure' });

async function apiRegister(request: APIRequestContext) {
  const account = freshAccount('qa-audit');
  const response = await request.post('/api/auth/register', { data: account });
  expect(response.status()).toBe(201);
  return account;
}

test('QA01 destination search, combined filters, empty state and reset', async ({ page, request }) => {
  const destinations = await (await request.get('/api/content/destinations')).json();
  expect(destinations.length).toBeGreaterThan(0);
  await page.goto('/');
  const cards = page.locator('article[id^="card-dest-"]');
  await expect(cards).toHaveCount(destinations.length);
  const target = destinations.find((d: any) => d.category === 'culture');
  await page.locator('#destination-search').fill(target.vietnameseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd'));
  await expect(page.locator(`#card-dest-${target.id}`)).toBeVisible();
  await page.locator('#destination-search').fill('');
  await page.locator('#destination-region').selectOption(target.district);
  await page.locator('#filter-cat-culture').click();
  await expect(cards).toHaveCount(destinations.filter((d: any) => d.category === 'culture' && d.district === target.district).length);
  await page.locator('#destination-search').fill('qa-no-such-destination-123');
  await expect(cards).toHaveCount(0);
  await expect(page.getByText('Chưa tìm thấy điểm phù hợp')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).first().click();
  await expect(cards).toHaveCount(destinations.length);
});

test('QA02 destination dialog closes with Escape and transfers destination to planner', async ({ page }) => {
  await page.goto('/');
  const open = page.locator('button[id^="btn-dest-detail-"]').first();
  await open.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const name = await page.locator('#destination-title').innerText();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open.click();
  await page.getByRole('button', { name: 'Thêm vào lịch trình', exact: true }).click();
  // Ô ghi chú của trình lập lịch là <input type="text">, không phải <textarea>.
  await expect(page.getByPlaceholder(/Yêu cầu thêm/)).toHaveValue(`Ưu tiên dành thời gian cho ${name}`);
});

test('QA03 favorites and profile edits survive reload; logout clears access', async ({ page }) => {
  await page.goto('/');
  await register(page, freshAccount('qa-profile'));
  const favorite = page.locator('button[id^="btn-fav-"]').first();
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-user-profile').click();
  const name = page.getByPlaceholder('Tên của bạn');
  await name.fill('Người kiểm thử QA');
  await name.locator('xpath=../..').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(name.locator('xpath=../..').getByRole('button')).toHaveText('Đã lưu');
  await page.reload();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-user-profile').click();
  await expect(name).toHaveValue('Người kiểm thử QA');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.locator('#btn-login-trigger')).toBeVisible();
  expect((await page.request.get('/api/me/itineraries')).status()).toBe(401);
});

test('QA04 gear checklist persists and budget calculator updates', async ({ page, request }) => {
  const gear = await (await request.get('/api/content/gear')).json();
  const costs = await (await request.get('/api/content/cost-assumptions')).json();
  await page.goto('/');
  await page.locator('#nav-tab-guide').click();
  const item = page.getByText(gear[0].name, { exact: true });
  await expect(item).toBeVisible();
  const before = (await item.getAttribute('class'))?.includes('line-through');
  await item.click();
  await expect.poll(async () => (await item.getAttribute('class'))?.includes('line-through')).toBe(!before);
  await page.reload();
  await page.locator('#nav-tab-guide').click();
  await expect.poll(async () => (await item.getAttribute('class'))?.includes('line-through')).toBe(!before);
  await page.getByRole('button', { name: 'Dự toán ngân sách', exact: true }).click();
  const expected = 3 * (costs.bikeRentPerDay + costs.fuelPerDay + costs.foodPerDay) + 2 * costs.stayPerNight.private_room + costs.attractionTickets + costs.busHanoiRoundTrip;
  await expect(page.getByText(`${expected.toLocaleString('vi-VN')} VNĐ`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Easy Rider', exact: true }).click();
  const easy = expected + 3 * (costs.easyRiderPerDay - costs.bikeRentPerDay - costs.fuelPerDay);
  await expect(page.getByText(`${easy.toLocaleString('vi-VN')} VNĐ`, { exact: true })).toBeVisible();
});

test('QA05 destination API failure displays error and retry recovers (injected 503)', async ({ page }) => {
  await page.route('**/api/content/destinations', route => route.fulfill({ status: 503, json: { error: 'QA: tạm thời không tải được điểm đến' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('QA: tạm thời');
  await page.unroute('**/api/content/destinations');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('article[id^="card-dest-"]').first()).toBeVisible();
});

test('QA06 mobile navigation keeps chat input inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#destination-search')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Ở dưới 1024px thanh tab mang id nằm trong một <nav className="hidden lg:flex">: nó vẫn ở
  // trong DOM nhưng không hiện. Thanh điều hướng thật của mobile là bản rút gọn ở cuối header,
  // và nhãn "Trợ Lý AI" của nó khác nhãn "Trợ Lý Thổ Địa AI" bên bản desktop.
  await page.getByRole('button', { name: 'Trợ Lý AI', exact: true }).click();
  const input = page.getByPlaceholder('Hỏi bất kỳ điều gì về đường đèo, homestay, thời tiết Hà Giang...');
  await expect(input).toBeVisible();
  const box = await input.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test('QA07 password change rejects old credentials and account deletion requires matching email', async ({ request }) => {
  const account = await apiRegister(request);
  expect((await request.patch('/api/me', { data: { name: '  ' } })).status()).toBe(400);
  expect((await request.post('/api/me/password', { data: { currentPassword: 'wrongpassword', newPassword: 'newpassword123' } })).status()).toBe(401);
  expect((await request.post('/api/me/password', { data: { currentPassword: account.password, newPassword: 'newpassword123' } })).status()).toBe(204);
  await request.post('/api/auth/logout');
  expect((await request.post('/api/auth/login', { data: account })).status()).toBe(401);
  expect((await request.post('/api/auth/login', { data: { email: account.email, password: 'newpassword123' } })).status()).toBe(200);
  expect((await request.delete('/api/me', { data: { confirmEmail: 'wrong@example.invalid' } })).status()).toBe(400);
  expect((await request.delete('/api/me', { data: { confirmEmail: account.email } })).status()).toBe(204);
  expect((await request.get('/api/me/itineraries')).status()).toBe(401);
});

test('QA08 itinerary ownership prevents another account from deleting a saved plan', async ({ request, playwright, baseURL }) => {
  await apiRegister(request);
  const presets = await (await request.get('/api/content/preset-itineraries')).json();
  const saved = await request.post('/api/me/itineraries', { data: { ...presets[0], title: 'QA ownership' } });
  expect(saved.status()).toBe(201);
  const plan = await saved.json();
  const other = await playwright.request.newContext({ baseURL });
  try {
    await apiRegister(other);
    expect(await (await other.get('/api/me/itineraries')).json()).toEqual([]);
    expect((await other.delete(`/api/me/itineraries/${plan.id}`)).status()).toBe(404);
    expect((await request.delete(`/api/me/itineraries/${plan.id}`)).status()).toBe(204);
  } finally { await other.dispose(); }
});

test('QA09 invalid saved itinerary structure must be rejected', async ({ request }) => {
  await apiRegister(request);
  const response = await request.post('/api/me/itineraries', {
    data: { title: 'QA invalid itinerary', days: [null], totalKm: -100 },
  });
  // Clean up even when the application incorrectly accepts this payload.
  if (response.status() === 201) {
    const saved = await response.json();
    await request.delete(`/api/me/itineraries/${saved.id}`);
  }
  expect(response.status()).toBe(400);
});

test('QA10 unresolved itinerary validation warnings must be visible', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-tab-planner').click();
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/plan-itinerary') && r.request().method() === 'POST');
  await page.locator('#btn-generate-itinerary').click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const plan = await response.json();
  expect(plan.validation.valid).toBe(false);
  const issue = plan.validation.issues.find((issue: any) => issue.code === 'DAY_COUNT');
  expect(issue).toBeTruthy();
  await expect(page.getByText(issue.message, { exact: false })).toBeVisible();
});

test('QA11 failed saved itinerary deletion must display an error (injected 503)', async ({ page }) => {
  await page.goto('/');
  await register(page, freshAccount('qa-delete'));
  const presets = await (await page.request.get('/api/content/preset-itineraries')).json();
  const response = await page.request.post('/api/me/itineraries', { data: { ...presets[0], title: 'QA deletion failure' } });
  expect(response.status()).toBe(201);
  const saved = await response.json();
  await page.reload();
  await page.locator('#btn-user-profile').click();
  await page.getByRole('button', { name: /^Lịch trình\s*1$/ }).click();
  await page.route(`**/api/me/itineraries/${saved.id}`, route => route.fulfill({ status: 503, json: { error: 'QA: không xoá được lịch trình' } }));
  await page.getByRole('button', { name: 'Xoá lịch trình QA deletion failure', exact: true }).click();
  await expect(page.getByText(/QA: không xoá được lịch trình/)).toBeVisible();
});
