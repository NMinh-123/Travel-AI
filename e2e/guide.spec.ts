import { expect, test } from "@playwright/test";

/**
 * TAB CẨM NANG, hai mục mà `functional-audit.spec.ts` chưa chạm: điều kiện các đỉnh đèo và danh
 * sách chỗ nghỉ. Hai mục còn lại — hành trang và dự toán ngân sách — đã có ở QA04.
 *
 * Cả hai bài đối chiếu giao diện với CHÍNH API mà giao diện gọi, thay vì với số ghi cứng trong
 * bài test: dữ liệu đến từ database đã seed, nên một hằng số ở đây sẽ đỏ mỗi lần nội dung đổi
 * mà không nói được rằng giao diện có hỏng hay không.
 */

test("mục An toàn đèo hiện đủ các trạm và nói rõ số đo từ đâu", async ({ page, request }) => {
  const stations = await (await request.get("/api/content/pass-weather")).json();
  expect(stations.length).toBeGreaterThan(0);

  await page.goto("/");
  await page.click("#nav-tab-guide");
  await page.getByRole("button", { name: "An toàn đèo", exact: true }).click();

  for (const station of stations) {
    await expect(page.getByText(station.location, { exact: true })).toBeVisible();
  }

  /**
   * MỖI thẻ phải tự khai nguồn: hoặc "Đo tại <điểm>" khi lấy được số thật, hoặc câu nói rõ đây
   * là ước lượng theo mùa. Đúng một trong hai, không được im lặng — nhiệt độ đo lúc 15h hôm nay
   * và nhiệt độ ước lượng theo mùa trông giống hệt nhau trên cùng một tấm thẻ.
   */
  const sourced = page.getByText(/Đo tại |Chưa lấy được số đo lúc này/);
  await expect(sourced).toHaveCount(stations.length);
});

test("mục Chỗ nghỉ hiện đúng danh sách cơ sở kèm giá tham khảo", async ({ page, request }) => {
  const homestays = await (await request.get("/api/content/homestays")).json();
  expect(homestays.length).toBeGreaterThan(0);

  await page.goto("/");
  await page.click("#nav-tab-guide");
  await page.getByRole("button", { name: "Chỗ nghỉ", exact: true }).click();

  for (const homestay of homestays) {
    await expect(page.getByText(homestay.name, { exact: true })).toBeVisible();
  }

  // Bản đồ chỉ mở khi cơ sở có toạ độ, nên chỉ kiểm khi dữ liệu seed thật sự có một cơ sở như vậy.
  if (homestays.some((item: { coordinates?: unknown }) => item.coordinates)) {
    const mapButton = page.getByRole("button", { name: "Bản đồ", exact: true }).first();
    await mapButton.click();
    await expect(page.getByRole("button", { name: "Ẩn bản đồ", exact: true })).toBeVisible();
  }
});
