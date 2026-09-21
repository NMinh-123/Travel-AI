import { expect, test } from "@playwright/test";
import { freshAccount, register, sendMessage } from "./helpers";

/**
 * LUỒNG: đăng ký → chat → tải lại trang → khôi phục lịch sử.
 *
 * Đây là luồng mà không tầng test nào khác chạm tới trọn vẹn. Test HTTP kiểm được từng endpoint,
 * test integration kiểm được database, nhưng chỉ E2E mới trả lời được câu "khách F5 xong thì có
 * còn thấy cuộc trò chuyện không" — vì câu đó phụ thuộc vào việc trình duyệt giữ `sessionId` ở
 * đâu và giao diện có gọi lại đúng endpoint khôi phục hay không.
 */

test("đăng ký, chat, tải lại trang và vẫn thấy lịch sử", async ({ page }) => {
  const account = freshAccount("e2e-chat");
  await page.goto("/");
  await register(page, account);

  await page.click("#nav-tab-concierge");
  await sendMessage(page, "Phố cổ Đồng Văn có gì?");

  // Tìm trong KHUNG HỘI THOẠI, không tìm trên cả trang: cùng câu hỏi đó cũng hiện ở danh sách
  // lịch sử bên cạnh, nên tìm toàn trang sẽ khớp hai nơi.
  const conversation = page.locator("#chat-messages");
  await expect(conversation.getByText("Phố cổ Đồng Văn có gì?")).toBeVisible();
  await expect(conversation.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();

  await page.reload();
  await page.click("#nav-tab-concierge");

  /**
   * Đây là phép kiểm cốt lõi của bài này. Lịch sử sống ở database và được nối lại qua `sessionId`
   * mà trình duyệt giữ; hỏng ở bất kỳ mắt xích nào — không lưu sessionId, lưu nhưng không gọi lại,
   * gọi lại nhưng trả sai phiên — đều biểu hiện y hệt nhau: một khung chat trống.
   */
  const restored = page.locator("#chat-messages");
  await expect(restored.getByText("Phố cổ Đồng Văn có gì?")).toBeVisible({ timeout: 20_000 });
  await expect(restored.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();
});

test("khách vãng lai chat được mà không cần đăng nhập", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-concierge");
  await sendMessage(page, "Đi Đồng Văn cần giấy tờ gì?");
  await expect(page.locator("#chat-messages").getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();
});
