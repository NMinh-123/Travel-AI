import { config } from "@server/config";

/**
 * Gửi email qua HTTP API của Resend. Gọi thẳng bằng fetch thay vì cài SDK: cả tích hợp chỉ là
 * một request POST.
 *
 * Nơi gọi phải kiểm `hasMailer()` trước — hàm này không tự hạ cấp khi thiếu cấu hình.
 */
export async function sendMail(input: { to: string; subject: string; html: string; text: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, from: config.mailFrom, to: [input.to] }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend trả ${response.status}: ${await response.text()}`);
  }
}
