import type { RequestHandler } from "express";
import { config } from "@server/config";

/**
 * HEADER BẢO MẬT cho mọi phản hồi — kể cả trang tĩnh, không chỉ /api.
 *
 * Cố tình không dùng `helmet`, cùng lý do như bản render markdown ở client và bộ đếm hạn mức:
 * thứ dự án cần là bảy header có giá trị ĐỌC ĐƯỢC NGAY TẠI ĐÂY. Một CSP đúng thì phải khớp với
 * danh sách nguồn ngoài thật của trang này, mà danh sách đó không suy ra được từ mặc định của
 * thư viện nào; còn khi trang hỏng vì CSP, chỗ phải mở ra đọc là chính danh sách bên dưới.
 *
 * CSP CHẶN ĐƯỢC GÌ Ở ĐÂY. Trang không có lối chèn HTML nào đã biết: client dựng mọi thứ bằng
 * React element, `MarkdownMessage` không dùng `dangerouslySetInnerHTML` và còn lọc giao thức của
 * liên kết do model sinh. CSP vì thế là lớp thứ hai, cho tình huống lớp thứ nhất bị một thay đổi
 * tương lai làm hỏng — và `frame-ancestors` thì chặn một lối tấn công mà lớp thứ nhất không với
 * tới: nhúng trang này vào iframe của người khác để lừa cú bấm.
 */

/**
 * Nguồn ngoài của Google Identity Services, chép theo đúng tài liệu CSP của Google. Bốn directive
 * khác nhau vì script, iframe, XHR và stylesheet của nó nằm ở bốn đường dẫn khác nhau — nới cả
 * `accounts.google.com` thay vì bốn đường dẫn này là nới rộng hơn mức cần.
 */
const GSI_SCRIPT = "https://accounts.google.com/gsi/client";
const GSI_FRAME = "https://accounts.google.com/gsi/";
const GSI_CONNECT = "https://accounts.google.com/gsi/";
const GSI_STYLE = "https://accounts.google.com/gsi/style";

/**
 * Cloudflare Turnstile (form đăng nhập/đăng ký): script tải từ đây và widget chạy trong một iframe
 * cũng ở đây — đúng hai directive tài liệu CSP của Cloudflare yêu cầu.
 */
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Bản đồ nhúng của client/components/PlaceMap.tsx, hai đường: có khoá thì `/maps/embed/v1/place`,
 * không khoá thì `/maps/embed?pb=...`. Nguồn kết thúc bằng `/` chỉ khớp đường con, không khớp
 * chính `/maps/embed` — thiếu mục thứ hai thì bản đồ không khoá bị CSP chặn, Chrome hiện
 * "Nội dung này bị chặn".
 */
const MAPS_EMBED = ["https://www.google.com/maps/embed/", "https://www.google.com/maps/embed"];

/** Google Fonts: khai trong index.html (stylesheet ở googleapis, file font ở gstatic). */
const FONTS_STYLE = "https://fonts.googleapis.com";
const FONTS_FILES = "https://fonts.gstatic.com";

function buildCsp(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    /**
     * `base-uri` và `object-src` không phục vụ tính năng nào của trang; đặt chặt nhất có thể vì
     * cả hai là lối biến một lỗ chèn HTML nhỏ thành quyền đổi đích của mọi liên kết tương đối
     * (`<base>`) hoặc quyền chạy plugin.
     */
    "base-uri": ["'self'"],
    "object-src": ["'none'"],

    /** Không ai được nhúng trang này vào iframe — đây là phần chống lừa bấm (clickjacking). */
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],

    "script-src": ["'self'", GSI_SCRIPT, TURNSTILE],

    /**
     * `'unsafe-inline'` cho STYLE, không phải cho script — hai thứ khác nhau về mức độ.
     *
     * Bắt buộc phải có vì thư viện `motion` và Google Identity Services đều chèn thẻ `<style>`
     * lúc chạy, và không có nonce nào đặt được vào thẻ do thư viện bên thứ ba tạo ra. Rủi ro của
     * nó là kẻ tấn công đã chèn được HTML thì chèn thêm được CSS; rủi ro của `'unsafe-inline'`
     * trong `script-src` là chạy được mã, tức khác hẳn một bậc — nên chỗ này nới, chỗ kia không.
     */
    "style-src": ["'self'", "'unsafe-inline'", FONTS_STYLE, GSI_STYLE],
    "font-src": ["'self'", "data:", FONTS_FILES],

    /**
     * Ảnh: mọi nguồn HTTPS.
     *
     * Đây là lựa chọn có chủ đích, không phải chỗ bỏ sót. Ảnh điểm đến nằm trong database và do
     * người biên tập nội dung đặt — hiện là upload.wikimedia.org, nhưng thêm một nguồn mới là
     * việc sửa nội dung, không phải việc deploy. Một danh sách trắng ở đây nghĩa là mỗi lần biên
     * tập viên thêm ảnh từ nguồn khác thì ảnh lặng lẽ không hiện, và người sửa nội dung không có
     * cách nào tự biết vì sao. Ảnh cũng không chạy được mã, nên cái mất khi nới là khả năng chặn
     * theo dõi bằng ảnh nhúng — nhỏ hơn hẳn cái giá vừa nói.
     */
    "img-src": ["'self'", "data:", "blob:", "https:"],

    "frame-src": [...MAPS_EMBED, GSI_FRAME, TURNSTILE],
    "connect-src": ["'self'", GSI_CONNECT],
  };

  /**
   * Ở dev, Vite cần `'unsafe-eval'` (biến đổi module lúc chạy), `'unsafe-inline'` (script nội
   * tuyến của chính nó) và WebSocket cho HMR.
   *
   * CSP vẫn được đặt ở dev chứ không tắt hẳn: một directive thiếu nguồn sẽ lộ ra ngay trên máy
   * phát triển, thay vì lộ ra sau khi deploy. Đó là lý do danh sách trên dùng chung cho cả hai
   * chế độ và dev chỉ THÊM, không thay.
   */
  if (!config.isProduction) {
    directives["script-src"].push("'unsafe-eval'", "'unsafe-inline'");
    directives["connect-src"].push("ws:", "wss:");
  }

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

const CSP = buildCsp();

/**
 * Một năm, kèm cả subdomain.
 *
 * KHÔNG có `preload`: đưa tên miền vào danh sách preload của trình duyệt là một cam kết rất khó
 * rút lại (phải chờ qua vài phiên bản trình duyệt), nên nó là quyết định của người vận hành tên
 * miền chứ không phải thứ một bản deploy tự ý làm thay.
 */
const HSTS = "max-age=31536000; includeSubDomains";

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader(
    config.cspReportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    CSP,
  );

  /** Bản cũ của `frame-ancestors`, cho trình duyệt chưa đọc CSP. Hai header cùng nói một điều. */
  res.setHeader("X-Frame-Options", "DENY");

  /**
   * Chặn trình duyệt tự đoán lại kiểu nội dung. Không có nó, một phản hồi JSON chứa chuỗi do
   * người dùng nhập có thể bị đoán thành HTML và chạy như HTML.
   */
  res.setHeader("X-Content-Type-Options", "nosniff");

  /**
   * Chỉ gửi origin khi sang trang khác, và không gửi gì khi tụt xuống HTTP.
   *
   * Có liên quan trực tiếp tới việc dọn phiên chat của khách vãng lai (xem
   * server/infra/retention.ts): id phiên hiện không nằm trong URL, nhưng nếu một ngày nào đó có
   * liên kết chia sẻ mang id trên query string thì header này là thứ giữ nó không đi theo mọi
   * liên kết ra ngoài.
   */
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  /**
   * `same-origin-allow-popups` chứ không phải `same-origin`: luồng đăng nhập Google mở popup và
   * cần giữ tham chiếu tới cửa sổ mở nó. Đặt `same-origin` là cách làm nút đăng nhập Google hỏng
   * theo kiểu rất khó truy — popup mở ra rồi đứng im, không có lỗi nào ở console.
   */
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  /**
   * Khoá sẵn các quyền thiết bị. Trang không dùng cái nào trong số này (đã kiểm: không có lượt
   * gọi `geolocation` nào ở client — thời tiết tra theo slug địa danh, không theo vị trí người
   * dùng), nên khai rỗng để một script bên thứ ba lọt vào cũng không xin được quyền.
   */
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );

  // Chỉ có ý nghĩa trên HTTPS, và bật ở dev sẽ ghim localhost sang https trong trình duyệt của
  // chính người phát triển — một sự cố nhớ đời cho người gặp lần đầu.
  if (config.isProduction) res.setHeader("Strict-Transport-Security", HSTS);

  next();
};
