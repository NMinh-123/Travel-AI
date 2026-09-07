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
 * server/db.ts và các thư viện bên thứ ba vẫn đọc process.env.NODE_ENV trực tiếp, nên đặt lại
 * biến để chúng thấy đúng cùng một chế độ với config.isProduction. Module này được nạp trước
 * mọi module khác của server.
 */
if (isProduction) process.env.NODE_ENV = "production";

export const config = {
  port: readPort(),
  host: process.env.HOST ?? "0.0.0.0",
  isProduction,
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
  databaseUrl: requireEnv(
    "DATABASE_URL",
    "Ví dụ: postgresql://travel:travel@localhost:5432/travelai (khớp với docker-compose.yml)",
  ),
  jwtSecret: readJwtSecret(),
  /**
   * Client ID của Google là thông tin công khai, nên nó được gửi xuống trình duyệt qua
   * GET /api/config thay vì phải khai thêm một biến VITE_* thứ hai. Không đặt thì nút đăng
   * nhập Google tự ẩn — không có nút bấm vào rồi báo lỗi.
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",

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
   * Tách từ tiếng Việt cho nhánh từ khoá. Mặc định tắt vì chưa đo được, và vì tách từ PHẢI
   * đối xứng giữa ingest và truy vấn: bật biến này thì phải chạy lại toàn bộ ingest, nếu
   * không thì chỉ mục và truy vấn nằm ở hai dạng văn bản khác nhau và âm thầm không khớp.
   */
  viSegmentEnabled: readBool("VI_SEGMENT_ENABLED", false),

  /**
   * Ngưỡng liên quan của hai nhánh truy xuất. Đoạn nào không vượt ngưỡng ở nhánh nào cả thì bị
   * loại, và khi không còn đoạn nào thì tác tử tri thức trả `grounded: false` mà không gọi model
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
   * Ngưỡng từ khoá được HẠ từ 0,34 xuống 0,26 sau khi có chiều địa danh (server/rag/places.ts).
   * Trước đó nó phải gánh thêm việc chặn câu hỏi về địa bàn khác — việc mà nó làm rất tệ, vì
   * "chợ phiên Bắc Hà" chấm 0,587, cao hơn phần lớn câu hỏi hợp lệ. Nay từ điển địa danh chặn
   * nhóm đó trước khi truy xuất chạy, nên ngưỡng chỉ còn phải lọc theo CHỦ ĐỀ và nới ra được.
   *
   * Đo trên 45 câu (25 hợp lệ, 12 ngoài địa bàn, 8 khác chủ đề): 0,60/0,34 cho 23/25 câu hợp lệ,
   * còn 0,60/0,26 cho đủ 25/25 mà vẫn không câu âm tính nào lọt. Hai câu được cứu là "đi Mã Pí
   * Lèng cần mang giấy tờ gì" và "tam giác mạch nở tháng mấy".
   *
   * Cảnh báo về biên: hạ tiếp xuống 0,22 thì ba câu khác chủ đề lọt ngay. Biên an toàn phía dưới
   * chỉ khoảng 0,04, và toàn bộ con số này đo trên tập tự soạn với kho 31 đoạn, KHÔNG phải tập
   * câu hỏi vàng mà SRS Mục 11.4.4 yêu cầu. Đổi nội dung kho thì phải đo lại; đó là lý do chúng
   * là biến môi trường chứ không phải hằng số. Đặt cả hai về 0 là tắt lọc.
   */
  ragMinVectorSimilarity: readNumber("RAG_MIN_VECTOR_SIMILARITY", 0.6, 0, 1),
  ragMinKeywordRank: readNumber("RAG_MIN_KEYWORD_RANK", 0.26, 0, 1),
};

export function hasGeminiCredentials(): boolean {
  return config.geminiApiKey.length > 0;
}

export function hasGoogleCredentials(): boolean {
  return config.googleClientId.length > 0;
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
