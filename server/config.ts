import dotenv from "dotenv";

// quiet: từ v17 dotenv in một dòng quảng cáo mỗi lần nạp. Log khởi động chỉ nên chứa
// thông tin của ứng dụng, để dòng nào bất thường thì nhìn ra ngay.
dotenv.config({ quiet: true });

function readPort(): number {
  const raw = process.env.PORT;
  if (!raw) return 3000;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`PORT không hợp lệ: "${raw}" (cần một số nguyên 1-65535)`);
  }
  return parsed;
}

/**
 * Thiếu DATABASE_URL hay JWT_SECRET thì server dừng ngay thay vì chạy với giá trị mặc định.
 * Đây là cùng nguyên tắc đã áp cho GEMINI_API_KEY: một lỗi cấu hình phải lộ ra ở thời điểm
 * khởi động, chứ không biến thành hành vi sai lệch khó truy lúc chạy. Riêng khoá JWT, một
 * giá trị mặc định lọt vào production còn là lỗ hổng bảo mật — ai biết khoá đó đều ký được
 * session hợp lệ.
 */
function requireEnv(name: string, hint: string): string {
  const raw = process.env[name]?.trim();
  if (raw) return raw;

  throw new Error(
    `Thiếu biến môi trường ${name}.\n` +
      `  ${hint}\n` +
      `  Tạo file .env từ .env.example rồi khởi động lại server.`,
  );
}

const MIN_JWT_SECRET_LENGTH = 32;

function readJwtSecret(): string {
  const secret = requireEnv(
    "JWT_SECRET",
    'Sinh khoá: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  );

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET quá ngắn (${secret.length} ký tự, cần tối thiểu ${MIN_JWT_SECRET_LENGTH}).`,
    );
  }
  return secret;
}

/**
 * Đọc một số thực trong khoảng cho trước. Giá trị sai cú pháp hay ngoài khoảng thì DỪNG server
 * thay vì lặng lẽ dùng mặc định — cùng nguyên tắc đã áp cho PORT: một ngưỡng đánh máy sai sẽ
 * biểu hiện thành "chatbot tự nhiên không trả lời được gì", là loại lỗi rất khó truy về cấu hình.
 */
function readNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} không hợp lệ: "${raw}" (cần một số trong khoảng ${min}–${max})`);
  }
  return parsed;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export type EmbedderKind = "bge-m3" | "gemini";

export type WeatherProvider = "open-meteo" | "google";

/**
 * Nhà cung cấp dữ liệu thời tiết. Mặc định Open-Meteo vì nó nhận tham số `elevation` và nội suy
 * dự báo theo độ cao thật — các đèo trong hành trình nằm ở 1.500–2.000 m còn thị trấn dưới chân
 * đèo ở 300–900 m, nên dự báo lấy theo ô lưới mặt đất lệch vài độ và bỏ qua sương mù đỉnh đèo,
 * đúng thông tin ảnh hưởng tới an toàn khi lái.
 *
 * Đổi sang "google" khi muốn gom về một nhà cung cấp (một khoá, một hạn mức). Hồ sơ của cả hai
 * nằm ở @data/realtime/providers, nên đổi biến này không phải sửa adapter.
 */
function readWeatherProvider(): WeatherProvider {
  const raw = process.env.WEATHER_PROVIDER?.trim().toLowerCase();
  if (!raw) return "open-meteo";
  if (raw === "open-meteo" || raw === "google") return raw;

  throw new Error(`WEATHER_PROVIDER không hợp lệ: "${raw}" (chọn: open-meteo, google)`);
}

/**
 * Nguồn sinh vector cho tầng RAG. Hai bản cài đều trả vector 1024 chiều đã chuẩn hoá, nên
 * đổi biến này không cần migrate cột `vector(1024)` hay đánh chỉ mục lại — nhưng PHẢI chạy
 * lại ingest, vì hai model sinh ra hai không gian vector khác nhau.
 */
function readEmbedder(): EmbedderKind {
  const raw = process.env.EMBEDDER?.trim().toLowerCase();
  if (!raw) return "bge-m3";
  if (raw === "bge-m3" || raw === "gemini") return raw;

  throw new Error(`EMBEDDER không hợp lệ: "${raw}" (chọn: bge-m3, gemini)`);
}

/**
 * Điểm cuối Gemini. Để trống thì SDK dùng mặc định https://generativelanguage.googleapis.com;
 * đặt vào thì mọi lượt gọi (NLU, năm tác tử, sinh lịch trình, embedder) đi qua địa chỉ đó — cần
 * khi khoá được cấp bởi một proxy trung gian chứ không phải Google AI Studio.
 *
 * SDK @google/genai ghép URL theo dạng `{baseUrl}/{apiVersion}/{path}` với apiVersion mặc định
 * là v1beta, nên biến này phải là ORIGIN chứ không phải đường dẫn đầy đủ. Trang hướng dẫn của
 * các proxy thường in sẵn hậu tố "/v1" (kiểu OpenAI-compatible); dán nguyên cả hậu tố sẽ thành
 * .../v1/v1beta/models/... và trả 404. Hàm này cắt bỏ hậu tố đó thay vì bắt người dùng nhớ, và
 * dừng server ngay khi giá trị không phải URL http(s) — cùng nguyên tắc đã áp cho PORT.
 */
function readGeminiBaseUrl(): string {
  const raw = process.env.GEMINI_BASE_URL?.trim();
  if (!raw) return "";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `GEMINI_BASE_URL không hợp lệ: "${raw}" (cần URL đầy đủ, ví dụ https://api.example.com)`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`GEMINI_BASE_URL phải dùng http hoặc https, nhận được "${parsed.protocol}"`);
  }

  const path = parsed.pathname.replace(/\/+$/, "").replace(/\/(v1|v1beta|v1beta1)$/, "");
  return `${parsed.origin}${path}`;
}

/**
 * Cờ do esbuild ghi thẳng vào bundle production (xem --define trong script `build`).
 *
 * `npm start` chạy `node dist/server.cjs` trần, và không có cách nào đặt biến môi trường ngay
 * trong một dòng npm script chạy được trên cả Windows lẫn Linux. Trước đây script `start`
 * không đặt gì cả, nên NODE_ENV luôn rỗng và bản đã build vẫn chạy như dev: Vite middleware
 * phục vụ trang thay cho dist/client, cookie phiên không có cờ Secure, và error handler đẩy
 * đường dẫn file trên máy chủ cùng địa chỉ database ra cho client. Chế độ production vì thế
 * được đóng vào chính bản build, thay vì trông chờ người vận hành nhớ đặt biến.
 *
 * Chạy qua tsx (dev, seed, ingest) thì định danh này không tồn tại và `typeof` trả "undefined".
 */
declare const __BUILT_FOR_PRODUCTION__: boolean | undefined;

const isProduction =
  (typeof __BUILT_FOR_PRODUCTION__ !== "undefined" && __BUILT_FOR_PRODUCTION__ === true) ||
  process.env.NODE_ENV === "production";

/**
 * server/infra/db.ts và các thư viện bên thứ ba vẫn đọc process.env.NODE_ENV trực tiếp, nên đặt lại
 * biến để chúng thấy đúng cùng một chế độ với config.isProduction. Module này được nạp trước
 * mọi module khác của server.
 */
if (isProduction) process.env.NODE_ENV = "production";

/**
 * `trust proxy` của Express — và vì sao nó BẮT BUỘC phải khai tay.
 *
 * Mọi giới hạn theo IP của dự án (đăng nhập, chatbot) đọc `req.ip`. Sau một reverse proxy hay CDN,
 * địa chỉ TCP mà Express thấy là của proxy, còn IP thật nằm trong header `X-Forwarded-For`. Hai
 * cách khai sai đều dẫn tới chỗ không còn giới hạn nào, theo hai đường ngược nhau:
 *
 *  - KHÔNG KHAI khi thật sự có proxy: mọi request mang cùng một IP, nên cả thiên hạ chia nhau một
 *    bộ đếm. Người dùng thật bị chặn nhầm sau vài phút, và kẻ tấn công chỉ cần một IP để chặn cả
 *    hệ thống.
 *  - KHAI KHI KHÔNG CÓ PROXY (hoặc khai số tầng nhiều hơn thực tế): `X-Forwarded-For` là header
 *    client tự đặt được, nên đổi header là đổi bộ đếm — giới hạn tần suất trở thành thứ trang trí.
 *
 * Không có giá trị mặc định nào đúng cho cả hai, nên mặc định là KHÔNG TIN (false) và người vận
 * hành khai đúng số tầng proxy đứng trước ứng dụng: `TRUST_PROXY=1` cho một nginx/Caddy, `=2` khi
 * còn một CDN ở ngoài nữa. Cũng nhận "loopback" hoặc danh sách IP/CIDR mà Express hiểu.
 */
function readTrustProxy(): boolean | number | string {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw || raw === "false" || raw === "0") return false;

  const hops = Number(raw);
  if (Number.isInteger(hops) && hops > 0 && hops <= 10) return hops;

  if (raw === "true") {
    throw new Error(
      'TRUST_PROXY=true không được nhận: nó tin mọi tầng, kể cả header do client tự đặt.\n' +
        "  Khai đúng số tầng proxy đứng trước ứng dụng, ví dụ TRUST_PROXY=1.",
    );
  }
  // "loopback", "10.0.0.0/8", danh sách ngăn cách bằng dấu phẩy... để Express tự phân giải.
  return raw;
}

/**
 * Host được phép gửi request thay đổi dữ liệu (xem server/middleware/originCheck.ts).
 *
 * Để trống thì phép kiểm so `Origin` với chính host của request — đúng cho gần như mọi cách
 * triển khai. Chỉ cần khai khi origin công khai không khớp header `Host` mà ứng dụng nhận được,
 * ví dụ khi proxy không chuyển tiếp `X-Forwarded-Host`.
 */
function readAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => {
      // Nhận cả "https://ten-mien" lẫn "ten-mien": người khai không phải nhớ dạng nào.
      try {
        return new URL(item).host;
      } catch {
        return item;
      }
    });
}

function readRateLimitStore(): "database" | "memory" {
  const raw = process.env.RATE_LIMIT_STORE?.trim().toLowerCase();
  if (!raw) return "database";
  if (raw === "database" || raw === "memory") return raw;

  throw new Error(`RATE_LIMIT_STORE không hợp lệ: "${raw}" (chọn: database, memory)`);
}

/**
 * Chặn đúng một lỗi cấu hình: mang mật khẩu database của docker-compose lên production.
 *
 * `docker-compose.yml` dùng `travel:travel` cho môi trường phát triển và chỉ mở cổng ra localhost,
 * nên ở đó nó vô hại. Nguy hiểm là lúc chuỗi kết nối ấy được sao sang production cùng với phần
 * còn lại của file cấu hình — một mật khẩu nằm trong repo công khai thì không còn là mật khẩu.
 *
 * Kiểm ở thời điểm khởi động, cùng nguyên tắc đã áp cho PORT và JWT_SECRET: một lỗi cấu hình phải
 * lộ ra ngay, chứ không đợi tới lúc có người khác đăng nhập được vào database.
 */
function assertProductionDatabase(url: string): void {
  if (!isProduction) return;

  if (/:\/\/travel:travel@/.test(url)) {
    throw new Error(
      "DATABASE_URL đang dùng mật khẩu mẫu `travel:travel` của docker-compose.yml.\n" +
        "  Giá trị đó nằm trong repo nên không còn là bí mật. Đặt một mật khẩu riêng cho production.",
    );
  }

  /**
   * Database ở máy khác mà không bật TLS thì mật khẩu và toàn bộ dữ liệu đi qua mạng ở dạng rõ.
   * Chỉ CẢNH BÁO chứ không dừng: có những cách triển khai mà đường truyền đã được mã hoá ở tầng
   * dưới (VPC nội bộ, sidecar, unix socket), và dừng server ở đó là chặn một cấu hình hợp lệ.
   */
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (!isLocal && !/sslmode=/.test(url)) {
    console.warn(
      "⚠  DATABASE_URL trỏ tới máy khác nhưng không khai sslmode — kết nối có thể đang không mã hoá.",
    );
  }
}

const databaseUrl = requireEnv(
  "DATABASE_URL",
  "Ví dụ: postgresql://travel:travel@localhost:5432/travelai (khớp với docker-compose.yml)",
);
assertProductionDatabase(databaseUrl);

export const config = {
  port: readPort(),
  host: process.env.HOST ?? "0.0.0.0",
  isProduction,
  trustProxy: readTrustProxy(),
  allowedOrigins: readAllowedOrigins(),
  rateLimitStore: readRateLimitStore(),
  /**
   * Gửi CSP ở dạng chỉ báo cáo, không thực thi. Dùng cho lần đầu bật CSP trên một môi trường
   * thật: trang chạy y như cũ, còn vi phạm thì hiện ở console của trình duyệt. Tắt lại sau khi
   * đã xác nhận không còn vi phạm nào.
   */
  cspReportOnly: readBool("CSP_REPORT_ONLY", false),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiBaseUrl: readGeminiBaseUrl(),
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  /**
   * Tầng nhẹ theo SRS Mục 11.4.5: phân loại ý định, trích xuất thực thể, trả lời FAQ ngắn —
   * khoảng 70% lượt gọi. Phân tầng không chỉ để giảm chi phí mà còn giảm độ trễ trung bình,
   * giúp giữ ngưỡng ≤ 3 giây của NFR-PERF-03 dễ hơn.
   */
  geminiModelLight:
    process.env.GEMINI_MODEL_LIGHT?.trim() || "gemini-2.5-flash-lite",
  databaseUrl,
  jwtSecret: readJwtSecret(),
  /**
   * Client ID của Google là thông tin công khai, nên nó được gửi xuống trình duyệt qua
   * GET /api/config thay vì phải khai thêm một biến VITE_* thứ hai. Không đặt thì nút đăng
   * nhập Google tự ẩn — không có nút bấm vào rồi báo lỗi.
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",

  /**
   * Tầng dữ liệu động (SRS Mục 11.1.1.3 và 11.1.1.7). Cả hai biến đều KHÔNG bắt buộc: thiếu khoá
   * thì server vẫn khởi động bình thường, chỉ những tool cần Google trả về
   * `PROVIDER_NOT_CONFIGURED` và tác tử nói thẳng là chưa tra được — đúng DR-AGENT-08, thay vì
   * bịa một con số. Dừng server vì thiếu khoá bản đồ sẽ làm hỏng cả những phần không liên quan.
   *
   * MỘT khoá dùng chung cho ba API Google (Routes, Places, Geocoding), nhưng phải là khoá RIÊNG
   * của server và bị giới hạn theo API trong Cloud Console — không dùng chung với khoá của
   * client. Khoá client lộ ra trình duyệt là chuyện bình thường; khoá server thì không, và một
   * khoá bản đồ bị lộ là hoá đơn của người khác tiêu.
   *
   * Nhớ đặt quota cap cho từng API. Một tác tử gọi API trong vòng lặp khi gặp lỗi logic đốt hạn
   * mức rất nhanh, và đó không phải lo xa.
   */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "",
  weatherProvider: readWeatherProvider(),

  /**
   * Khoá RIÊNG cho bản đồ nhúng ở trình duyệt — KHÔNG dùng chung với `googleMapsApiKey`.
   *
   * Đây không phải sự cẩn thận thừa mà là hệ quả bắt buộc của cách hai khoá được dùng. Khoá
   * server gọi Routes, Places và Geocoding từ máy chủ, nên nó không bao giờ rời khỏi máy chủ và
   * được giới hạn theo API trong Cloud Console. Khoá này thì ngược lại: nó được gửi xuống trình
   * duyệt qua GET /api/config và nằm lộ thiên trong mã nguồn trang — bất kỳ ai mở DevTools đều
   * đọc được. Đó là bản chất của Maps Embed API, không phải lỗ hổng.
   *
   * Vì nó công khai nên phải giới hạn bằng cách khác: trong Cloud Console, đặt "Application
   * restrictions" theo HTTP referrer (chỉ tên miền của bạn) và "API restrictions" chỉ cho Maps
   * Embed API. Thiếu hai giới hạn đó thì một khoá công khai là một hoá đơn công khai.
   *
   * Dùng chung một khoá cho cả hai vai trò là cách nhanh nhất để biến khoá server thành khoá
   * công khai mà không ai nhận ra — và khoá đó thì gọi được cả Routes lẫn Places.
   */
  googleMapsEmbedKey: process.env.GOOGLE_MAPS_EMBED_KEY?.trim() ?? "",

  /**
   * Tầng RAG. Cả năm biến dưới đây đều KHÔNG bắt buộc, khác với DATABASE_URL và JWT_SECRET:
   * thiếu sidecar thì đặt EMBEDDER=gemini là chạy được, thiếu cả API key thì /api/chat trả 503
   * như trước. Không có đường nào dựng nội dung giả để che lỗi cấu hình.
   */
  embedder: readEmbedder(),
  embeddingServiceUrl:
    process.env.EMBEDDING_SERVICE_URL?.trim() || "http://127.0.0.1:8000",
  /**
   * Mặc định tắt có chủ ý. SRS Mục 11.4.4 nói rõ "mức cải thiện phải được đo trực tiếp trên
   * tập đánh giá của dự án trước khi bật mặc định" — bộ câu hỏi vàng chưa có, nên bật sẵn là
   * làm đúng điều SRS cảnh báo. Tắt cũng có nghĩa model reranker 2,2GB không bị tải về.
   */
  rerankEnabled: readBool("RERANK_ENABLED", false),
  /**
   * Trần thời gian cho một lượt xếp hạng lại.
   *
   * Bắt buộc phải có vì xếp hạng lại là bước TÙY CHỌN nằm trên đường đi đồng bộ: nó chỉ sắp lại
   * thứ tự của những đoạn đã có, nên một sidecar treo không được phép kéo cả lượt hội thoại quá
   * ngưỡng 3 giây của NFR-PERF-03. Hết giờ thì rơi về thứ tự RRF, và trace ghi lại là đã bỏ qua.
   *
   * 2 giây là mức để cross-encoder chấm xong ~20 đoạn trên CPU mà vẫn còn chỗ cho phần còn lại
   * của lượt; siết thêm thì bước này gần như không bao giờ kịp và bật nó thành vô nghĩa.
   */
  rerankTimeoutMs: readNumber("RERANK_TIMEOUT_MS", 2000, 100, 30000),
  /**
   * Tách từ tiếng Việt cho nhánh từ khoá. Mặc định tắt vì chưa đo được, và vì tách từ PHẢI
   * đối xứng giữa ingest và truy vấn: bật biến này thì phải chạy lại toàn bộ ingest, nếu
   * không thì chỉ mục và truy vấn nằm ở hai dạng văn bản khác nhau và âm thầm không khớp.
   */
  viSegmentEnabled: readBool("VI_SEGMENT_ENABLED", false),

  /**
   * Ngưỡng liên quan của hai nhánh truy xuất. Đoạn nào không vượt ngưỡng ở nhánh nào cả thì bị
   * loại, và khi không còn đoạn nào thì tác tử tri thức trả `grounding: "no_source"` mà không gọi model
   * — đây là chỗ thực thi nguyên tắc "không có căn cứ thì không nói" của SRS Mục 10.6. Trước khi
   * có hai biến này, nhánh vector luôn trả về đủ `finalLimit` đoạn gần nhất dù gần tới đâu, nên
   * `chunks.length === 0` chỉ xảy ra khi kho rỗng và nhánh chuyển tiếp gần như không bao giờ chạy.
   *
   * Hai ngưỡng chứ không phải một, vì đo trên kho hiện tại cho thấy mỗi nhánh mạnh ở một kiểu
   * truy vấn và một mình thì không nhánh nào tách được:
   *
   *   - Tương đồng cosine (nhánh vector) tách tốt câu hỏi tiếng Việt CÓ DẤU (thấp nhất 0,626)
   *     khỏi câu ngoài phạm vi (cao nhất 0,566 với câu vẫn thuộc chủ đề du lịch như "đi Đà Lạt
   *     tháng nào đẹp"). Nhưng câu gõ KHÔNG DẤU trong phạm vi chỉ đạt 0,379–0,466, tức thấp hơn
   *     cả câu ngoài phạm vi — BGE-M3 nhúng tiếng Việt không dấu kém hẳn.
   *   - ts_rank (nhánh từ khoá) thì ngược lại: nhờ cấu hình `vietnamese` bỏ dấu ở cả chỉ mục lẫn
   *     truy vấn, câu không dấu được chấm điểm y như câu có dấu. Đo được trong phạm vi 0,380–0,595
   *     so với ngoài phạm vi 0,219–0,301.
   *
   * NGƯỠNG TỪ KHOÁ ĐÃ ĐƯỢC ĐO LẠI Ở 0,35 (2026-09-10), thay cho 0,26 của bản trước. Lý do phải
   * đo lại: kho tri thức đã được dựng lại hoàn toàn — 162 đoạn thay vì 31, và phủ thêm ẩm thực,
   * văn hoá, lịch sử, mùa vụ. Kho rộng hơn nghĩa là nhiều bề mặt khớp nhầm hơn, nên con số cũ đo
   * trên kho cũ không mang sang được. Đây đúng là tình huống mà ghi chú cũ đã cảnh báo.
   *
   * Đo trên 39 câu (25 hợp lệ gồm cả nhóm gõ không dấu, 8 ngoài địa bàn, 6 khác chủ đề):
   *
   *   0,60 / 0,26  ->  25/25 hợp lệ, nhưng 5/6 câu KHÁC CHỦ ĐỀ lọt qua
   *   0,60 / 0,35  ->  25/25 hợp lệ, chỉ 1/6 khác chủ đề lọt        <- đang dùng
   *   0,70 / 0,40  ->  23/25 hợp lệ, 0/6 khác chủ đề lọt
   *
   * Chọn 0,35 vì nó là mức cuối cùng còn giữ trọn 25/25 câu hợp lệ. Đẩy lên 0,40 thì chặn thêm
   * được một câu khác chủ đề nhưng mất "homestay ở Lô Lô Chải giá bao nhiêu" và "đi Hà Giang cần
   * giấy tờ gì" — hai câu rất phổ biến, và mất chúng tệ hơn hẳn việc để lọt một câu vô hại.
   *
   * VỀ NHÓM NGOÀI ĐỊA BÀN: bài đo trên gọi thẳng `retrieve()` nên đi vòng qua cổng chặn địa danh,
   * và ở đó nhóm này lọt nhiều. Con số đó KHÔNG phản ánh hành vi thật: đo riêng cổng chặn
   * (`findOutOfAreaPlaces`) thì nó bắt 8/8 và không chặn nhầm câu hợp lệ nào, mà cổng đó chạy
   * TRƯỚC truy xuất trong orchestrator. Đây tiếp tục xác nhận điều ghi chú cũ đã nói: ngưỡng số
   * không tách được nhóm địa bàn, phải dùng phép tra bảng.
   *
   * Câu duy nhất còn lọt ở 0,35 là "thời tiết Hà Nội ngày mai". Cố chặn nó bằng ngưỡng là sai
   * hướng — nó lọt vì kho có nhiều nội dung về thời tiết và mùa. Trong luồng thật, câu hỏi thời
   * tiết đi tới tool `getWeather`, mà tool đó yêu cầu một slug có trong danh mục nên "Hà Nội" trả
   * `NOT_FOUND`. Cũng KHÔNG được thêm "ha noi" vào OUT_OF_AREA_PLACES: Hà Nội là điểm xuất phát
   * của phần lớn khách, và "đi từ Hà Nội lên Hà Giang thế nào" là câu hỏi hoàn toàn hợp lệ.
   *
   * Đây vẫn là tập tự soạn, CHƯA phải bộ câu hỏi vàng mà SRS Mục 11.4.4 yêu cầu. Đổi nội dung kho
   * thì lại phải đo lại — đó là lý do hai giá trị này là biến môi trường chứ không phải hằng số.
   * Đặt cả hai về 0 là tắt lọc.
   */
  ragMinVectorSimilarity: readNumber("RAG_MIN_VECTOR_SIMILARITY", 0.6, 0, 1),
  ragMinKeywordRank: readNumber("RAG_MIN_KEYWORD_RANK", 0.35, 0, 1),

  /**
   * TRẦN CHI PHÍ GỌI MODEL. Xem server/infra/aiBudget.ts về việc vì sao cần hai con số thay vì
   * một, và vì sao giới hạn tần suất theo IP không thay được chúng.
   *
   * `aiMaxTurnsPerHour` đếm số lượt NGƯỜI DÙNG yêu cầu trợ lý làm gì đó, theo từng danh tính
   * (tài khoản, hoặc IP với khách chưa đăng nhập). 120 lượt/giờ là mức một người dùng thật không
   * với tới — trò chuyện liên tục không nghỉ cũng khó vượt 60 lượt/giờ — nhưng nó cắt đúng kiểu
   * lạm dụng mà giới hạn 20 lượt/phút bỏ qua: gửi đều đặn suốt nhiều giờ.
   *
   * `aiMaxModelCallsPerHour` đếm TỔNG số lời gọi sinh nội dung của cả hệ thống. Đây là con số
   * quyết định hoá đơn tối đa, và là thứ duy nhất chặn được kiểu tấn công rải qua nhiều IP. Một
   * lượt chat tốn khoảng 2–5 lời gọi (phân loại ý định, tác tử, có thể thêm lượt viết lại truy
   * vấn), nên 2.000 lời gọi/giờ tương ứng khoảng 400–1.000 lượt chat — thừa cho quy mô hiện tại
   * và vẫn là một trần biết trước.
   *
   * Đặt 0 là TẮT. Chỉ nên tắt khi đã có trần chi phí ở phía nhà cung cấp, vì khi đó số tiền tối
   * đa một giờ lại trở thành hệ quả của việc có bao nhiêu người đang gọi.
   */
  aiMaxTurnsPerHour: readNumber("AI_MAX_TURNS_PER_HOUR", 120, 0, 100000),
  aiMaxModelCallsPerHour: readNumber("AI_MAX_MODEL_CALLS_PER_HOUR", 2000, 0, 1000000),

  /**
   * Thời hạn lưu phiên chat CHƯA GẮN TÀI KHOẢN, tính bằng ngày. Xem server/infra/retention.ts về
   * việc vì sao nhóm phiên này cần thời hạn còn phiên của người đã đăng nhập thì không.
   *
   * 30 ngày: đủ dài để một người quay lại sau chuyến đi vẫn thấy hội thoại cũ, đủ ngắn để dữ liệu
   * không tích lại vô hạn. Đặt 0 là giữ mãi — một lựa chọn hợp lệ nếu có chính sách lưu trữ khác
   * ở tầng hạ tầng, nhưng không phải mặc định.
   */
  guestSessionRetentionDays: readNumber("GUEST_SESSION_RETENTION_DAYS", 30, 0, 3650),
};

export function hasGeminiCredentials(): boolean {
  return config.geminiApiKey.length > 0;
}

export function hasGoogleCredentials(): boolean {
  return config.googleClientId.length > 0;
}

/**
 * Có khoá bản đồ nhúng hay không. Thiếu thì giao diện hiện khối thay thế kèm liên kết mở Google
 * Maps ở tab mới, chứ không hiện một iframe lỗi — xem `PlaceMap` ở phía client.
 */
export function hasMapsEmbedKey(): boolean {
  return config.googleMapsEmbedKey.length > 0;
}

/**
 * Địa chỉ để hiển thị cho người dùng mở trình duyệt. Server vẫn lắng nghe trên
 * `config.host` (mặc định 0.0.0.0 để nhận kết nối từ mọi network interface),
 * nhưng 0.0.0.0 không phải là địa chỉ trình duyệt điều hướng được.
 */
export function browsableUrl(): string {
  const host =
    config.host === "0.0.0.0" || config.host === "::" ? "localhost" : config.host;
  return `http://${host}:${config.port}`;
}
