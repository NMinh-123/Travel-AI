import { expect, test } from "@playwright/test";
import { freshAccount, register, sendMessage } from "./helpers";

/**
 * LUỒNG: đăng ký → chat → tải lại trang → KHUNG SẠCH, nhưng hội thoại cũ vẫn mở lại được.
 *
 * Đây là luồng mà không tầng test nào khác chạm tới trọn vẹn. Test HTTP kiểm được từng endpoint,
 * test integration kiểm được database, nhưng chỉ E2E mới trả lời được câu "khách F5 xong thì thấy
 * gì" — vì câu đó phụ thuộc vào việc trình duyệt có giữ `sessionId` hay không.
 *
 * BÀI NÀY TỪNG KHẲNG ĐỊNH ĐIỀU NGƯỢC LẠI. Trước đây client giữ `sessionId` ở localStorage và tự
 * mở lại hội thoại gần nhất sau khi F5, đúng như FR-BOT-07 mô tả. Hành vi đó đã được đổi theo
 * yêu cầu sản phẩm: mỗi lần mở trang là một cuộc trò chuyện mới. Hai phép kiểm dưới đây khoá lại
 * ĐÚNG hai nửa của quyết định đó — nửa bỏ đi và nửa phải giữ nguyên — vì một mình nửa đầu thì
 * không phân biệt được "cố ý mở khung mới" với "làm mất hội thoại của khách".
 */

test("tải lại trang thì mở cuộc trò chuyện mới, hội thoại cũ vẫn nằm trong lịch sử", async ({ page }) => {
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

  const history = page.getByLabel("Các cuộc trò chuyện");

  /**
   * NỬA THỨ NHẤT: khung chat sạch.
   *
   * Chờ danh sách lịch sử hiện ra trước rồi mới khẳng định khung trống. Khẳng định ngay sẽ đúng
   * cả khi trang chưa kịp tải xong bất cứ thứ gì, tức bài test xanh mà không kiểm được gì — đúng
   * kiểu phép kiểm phủ định tự lừa mình.
   */
  await expect(history.getByRole("button", { name: /Phố cổ Đồng Văn có gì\?/ }))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#chat-messages").getByText("Phố cổ Đồng Văn có gì?")).toHaveCount(0);

  /**
   * NỬA THỨ HAI: không mất gì cả.
   *
   * Đây là điều kiện khiến nửa trên chấp nhận được. Hội thoại cũ vẫn nằm trên server và mở lại
   * được bằng một cú bấm; nếu phép kiểm này đỏ thì thay đổi kia không còn là "mở khung mới" mà
   * là xoá lịch sử của khách.
   */
  await history.getByRole("button", { name: /Phố cổ Đồng Văn có gì\?/ }).click();
  const reopened = page.locator("#chat-messages");
  await expect(reopened.getByText("Phố cổ Đồng Văn có gì?")).toBeVisible({ timeout: 20_000 });
  await expect(reopened.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();
});

test("trong cùng một lượt truy cập, hội thoại vẫn nối mạch qua nhiều lượt nhắn", async ({ page }) => {
  /**
   * Ranh giới của thay đổi trên: thứ bị bỏ là việc giữ phiên QUA CÁC LẦN TẢI TRANG, không phải
   * việc giữ phiên giữa các lượt nhắn. Nhầm hai thứ đó thì mỗi câu hỏi mở một phiên riêng, trạng
   * thái slot không tích luỹ được, và vòng hỏi bổ sung của Dialog Manager không bao giờ đóng.
   */
  const account = freshAccount("e2e-chat-mach");
  await page.goto("/");
  await register(page, account);

  await page.click("#nav-tab-concierge");
  await sendMessage(page, "Phố cổ Đồng Văn có gì?");
  await expect(page.locator("#chat-messages").getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();

  await sendMessage(page, "Thế còn Mèo Vạc?");
  const conversation = page.locator("#chat-messages");
  await expect(conversation.getByText("Thế còn Mèo Vạc?")).toBeVisible({ timeout: 20_000 });
  // Cả hai câu cùng nằm trong một khung: chúng thuộc cùng một phiên.
  await expect(conversation.getByText("Phố cổ Đồng Văn có gì?")).toBeVisible();

  // Và cả hai gộp thành MỘT mục lịch sử, không phải hai.
  await expect(page.getByLabel("Các cuộc trò chuyện").getByRole("button", { name: /Phố cổ Đồng Văn có gì\?/ }))
    .toHaveCount(1, { timeout: 20_000 });
});

test("khách vãng lai chat được mà không cần đăng nhập", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-concierge");
  await sendMessage(page, "Đi Đồng Văn cần giấy tờ gì?");
  await expect(page.locator("#chat-messages").getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();
});

test("hội thoại của khách vãng lai không quay lại sau khi tải lại trang", async ({ page }) => {
  /**
   * Khách vãng lai không có chỗ nào để mở lại hội thoại: danh sách lịch sử chỉ có với tài khoản.
   * Nên với họ, "mỗi lần mở trang là chat mới" cũng có nghĩa là đoạn chat cũ không còn đường về —
   * và `pruneGuestSessions` sẽ dọn nó khỏi database sau thời hạn đã cấu hình.
   */
  await page.goto("/");
  await page.click("#nav-tab-concierge");
  await sendMessage(page, "Đi Đồng Văn cần giấy tờ gì?");
  await expect(page.locator("#chat-messages").getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible();

  await page.reload();
  await page.click("#nav-tab-concierge");

  // Ô nhập sẵn sàng là dấu hiệu khung chat đã dựng xong — chờ nó trước khi khẳng định điều phủ định.
  await expect(page.getByPlaceholder(/Hỏi bất kỳ điều gì/)).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("#chat-messages").getByText("Đi Đồng Văn cần giấy tờ gì?")).toHaveCount(0);
});
