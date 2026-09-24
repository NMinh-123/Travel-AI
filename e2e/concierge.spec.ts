import { expect, test } from "@playwright/test";
import { freshAccount, register, sendMessage } from "./helpers";

/**
 * LUỒNG TRỢ LÝ, phần mà `chat.spec.ts` không chạm tới.
 *
 * `chat.spec.ts` khoá lại vòng đời của phiên — F5, mở lại từ lịch sử, nối mạch nhiều lượt. Ở đây
 * là bốn thứ còn lại mà chỉ trình duyệt trả lời được: một lượt HỎNG trông ra sao với khách, nút
 * dọn khung có thật sự mở phiên mới không, viên gợi ý do server trả về có bấm được không, và
 * phản hồi hài lòng có sống trên server chứ không chỉ đổi màu nút.
 */

test("lượt chat hỏng hiện lỗi thật của server và vẫn hỏi lại được (chèn 503)", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-concierge");

  /**
   * Chèn lỗi ở `/api/chat/stream` chứ không tắt model: thứ cần kiểm là đường lỗi của giao diện,
   * và đó là đường duy nhất trong ứng dụng mà mã trạng thái về TRƯỚC khi luồng SSE mở.
   */
  await page.route("**/api/chat/stream", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "QA: trợ lý tạm thời không phản hồi", details: "Lỗi do E2E chèn vào" },
    }),
  );

  await sendMessage(page, "Đường lên Lũng Cú có khó đi không?");
  const conversation = page.locator("#chat-messages");
  await expect(conversation.getByText(/QA: trợ lý tạm thời không phản hồi/)).toBeVisible();
  // Câu chữ của server đi trọn vẹn tới khách, không bị thay bằng một câu chung chung.
  await expect(conversation.getByText(/Lỗi do E2E chèn vào/)).toBeVisible();

  /**
   * Và lượt hỏng KHÔNG được khoá ô nhập lại: `busy` phải được nhả trong khối finally, nếu không
   * một lần server trục trặc là khách phải tải lại trang mới hỏi tiếp được.
   */
  await page.unroute("**/api/chat/stream");
  await sendMessage(page, "Thế còn Mèo Vạc?");
  await expect(conversation.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible({ timeout: 20_000 });
});

test("bấm viên gợi ý sau câu trả lời sẽ gửi luôn câu đó", async ({ page }) => {
  await page.goto("/");
  await page.click("#nav-tab-concierge");

  await sendMessage(page, "Phố cổ Đồng Văn có gì?");
  const conversation = page.locator("#chat-messages");
  await expect(conversation.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible({ timeout: 20_000 });

  /**
   * Gợi ý này do SERVER trả về (`suggestions` trong phản hồi), không phải danh sách mồi cố định
   * ở rãnh bên — nên nó kiểm cả chặng: model giả → orchestrator → lưu xuống database → giao diện.
   */
  await conversation.getByRole("button", { name: /Chợ phiên Đồng Văn họp hôm nào\?/ }).click();

  // Viên gợi ý hiển thị kèm mũi tên, nên `exact` chỉ khớp bong bóng tin nhắn của người dùng.
  await expect(conversation.getByText("Chợ phiên Đồng Văn họp hôm nào?", { exact: true }))
    .toBeVisible({ timeout: 20_000 });
});

test("Trò chuyện mới dọn khung và mở một phiên riêng, không nối vào phiên cũ", async ({ page }) => {
  await page.goto("/");
  await register(page, freshAccount("e2e-newchat"));
  await page.click("#nav-tab-concierge");

  await sendMessage(page, "Phố cổ Đồng Văn có gì?");
  const conversation = page.locator("#chat-messages");
  await expect(conversation.getByText(/Trả lời từ máy chủ giả E2E/)).toBeVisible({ timeout: 20_000 });

  await page.click("#btn-new-chat");
  await expect(conversation.getByText("Phố cổ Đồng Văn có gì?")).toHaveCount(0);

  await sendMessage(page, "Chợ phiên Mèo Vạc họp hôm nào?");
  await expect(conversation.getByText("Chợ phiên Mèo Vạc họp hôm nào?", { exact: true }))
    .toBeVisible({ timeout: 20_000 });

  /**
   * HAI mục lịch sử, không phải một. Đây là ranh giới giữa "dọn khung" và "mở phiên mới": nếu
   * client chỉ xoá màn hình mà vẫn gửi kèm `sessionId` cũ thì hai câu hỏi rơi vào cùng một phiên
   * và lịch sử chỉ có một mục — khung trông đúng, dữ liệu thì sai.
   */
  const history = page.getByLabel("Các cuộc trò chuyện");
  await expect(history.getByRole("button", { name: /Phố cổ Đồng Văn có gì\?/ }))
    .toHaveCount(1, { timeout: 20_000 });
  await expect(history.getByRole("button", { name: /Chợ phiên Mèo Vạc họp hôm nào\?/ }))
    .toHaveCount(1, { timeout: 20_000 });
  await expect(conversation.getByText("Phố cổ Đồng Văn có gì?")).toHaveCount(0);
});

test("đánh giá hữu ích được lưu trên server và còn nguyên khi mở lại phiên", async ({ page }) => {
  await page.goto("/");
  await register(page, freshAccount("e2e-rate"));
  await page.click("#nav-tab-concierge");

  await sendMessage(page, "Phố cổ Đồng Văn có gì?");
  await expect(page.locator("#chat-messages").getByText(/Trả lời từ máy chủ giả E2E/))
    .toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Hữu ích", exact: true }).click();
  await expect(page.getByText("Cảm ơn bạn đã phản hồi.")).toBeVisible();

  /**
   * Tải lại trang rồi mở lại phiên từ lịch sử: đánh giá chỉ hiện lại nếu nó đã thật sự tới
   * `POST /api/chat/feedback` và nằm trong cột `satisfaction`. Kiểm ngay sau cú bấm thì một bản
   * chỉ đổi state trong trình duyệt cũng xanh.
   */
  await page.reload();
  await page.click("#nav-tab-concierge");
  await page.getByLabel("Các cuộc trò chuyện")
    .getByRole("button", { name: /Phố cổ Đồng Văn có gì\?/ })
    .click();

  await expect(page.locator("#chat-messages").getByText("Phố cổ Đồng Văn có gì?"))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cảm ơn bạn đã phản hồi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hữu ích", exact: true })).toHaveCount(0);
});
