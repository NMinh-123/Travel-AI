import type { Request, RequestHandler } from "express";
import { config } from "@server/config";

/**
 * CHẶN CSRF BẰNG CÁCH ĐỐI CHIẾU `Origin` — không dùng token.
 *
 * Phiên đăng nhập nằm trong cookie, nên mọi request thay đổi dữ liệu đều mang sẵn quyền của
 * người dùng: một trang bất kỳ chỉ cần làm trình duyệt gửi request tới đây là đã hành động dưới
 * danh nghĩa họ. Lớp phòng thủ hiện có là `sameSite: "lax"` ở cookie phiên, và nó đã chặn đúng
 * nhóm nguy hiểm nhất. Hai lý do vẫn thêm lớp này:
 *
 *  1. `lax` là một thuộc tính của COOKIE, do trình duyệt thực thi. Nó chặn ở phía client, và ta
 *     không có cách nào biết nó đã chặn hay chưa. Phép kiểm ở đây chạy trên máy chủ, nên nó còn
 *     hiệu lực với cả trình duyệt cũ không hiểu SameSite.
 *  2. `lax` không chặn được CSRF ĐĂNG NHẬP: một trang khác ép được trình duyệt đăng nhập vào tài
 *     khoản của kẻ tấn công (POST /api/auth/login là cross-site nhưng nó KHÔNG cần cookie có sẵn,
 *     nên SameSite không tham gia), và từ đó mọi thứ người dùng lưu lại đều nằm trong tài khoản
 *     kẻ tấn công đọc được.
 *
 * VÌ SAO KHÔNG CÓ `Origin` THÌ VẪN CHO QUA. CSRF là tấn công qua trình duyệt của nạn nhân, và
 * trình duyệt LUÔN gửi `Origin` cho các phương thức thay đổi dữ liệu — cả `fetch` lẫn form submit.
 * Một request không có header đó đến từ curl, từ test, từ một client không phải trình duyệt: ở đó
 * kẻ tấn công tự đặt được mọi header nên chặn theo header không có tác dụng bảo vệ, chỉ có tác
 * dụng làm hỏng những client hợp lệ. Nói cách khác: phép kiểm này chỉ dùng thứ mà kẻ tấn công
 * KHÔNG đặt được — `Origin` do trình duyệt tự ghi và script trên trang không sửa được.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Host mà request này đáng lẽ phải tới.
 *
 * So theo HOST chứ không so cả origin, vì giao thức hai bên có thể lệch nhau một cách hoàn toàn
 * hợp lệ: sau một reverse proxy cắt TLS, trình duyệt gửi `Origin: https://ten-mien` còn ứng dụng
 * nhận request http nội bộ. So cả origin ở đó sẽ chặn đúng mọi request thật.
 *
 * `X-Forwarded-Host` chỉ được xét khi `trust proxy` đã khai — không khai thì header đó do client
 * tự đặt, và tin nó nghĩa là cho phép kẻ tấn công tự khai host mình muốn, tức tự bỏ phép kiểm.
 */
function expectedHosts(req: Request): string[] {
  if (config.allowedOrigins.length > 0) return config.allowedOrigins;

  const hosts: string[] = [];
  if (config.trustProxy !== false) {
    const forwarded = req.get("x-forwarded-host");
    // Qua nhiều tầng proxy thì header này là danh sách; tầng ngoài cùng đứng đầu.
    if (forwarded) hosts.push(forwarded.split(",")[0].trim().toLowerCase());
  }
  const host = req.get("host");
  if (host) hosts.push(host.toLowerCase());
  return hosts;
}

export const originCheck: RequestHandler = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    // `Origin` không phân giải được thì không có cách nào đối chiếu. Trình duyệt không bao giờ
    // gửi thứ như vậy, nên đây là request đã bị dựng tay.
    return res.status(403).json({ error: "Yêu cầu bị từ chối: Origin không hợp lệ" });
  }

  if (expectedHosts(req).includes(originHost)) return next();

  /**
   * Không nêu host nào được phép trong thông báo: người dùng thật không bao giờ thấy lỗi này, còn
   * người đang dò thì không cần ta xác nhận hộ danh sách. Log thì ghi đủ để truy.
   */
  console.warn(`[origin-check] chặn ${req.method} ${req.path} từ origin "${origin}"`);
  return res.status(403).json({
    error: "Yêu cầu bị từ chối vì được gửi từ một trang khác",
  });
};
