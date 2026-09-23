import { GoogleGenAI } from "@google/genai";
import type { Content, Schema } from "@google/genai";
import type { Response } from "express";
import { config, hasGeminiCredentials } from "@server/config";
import { chargeModelCall } from "@server/infra/aiBudget";

/**
 * Cửa duy nhất đi ra Gemini. Trước Vòng 5, client và các hàm tiện ích này nằm ngay trong
 * server.ts (nay là server/index.ts); giờ có bốn nơi cần dùng (NLU, năm tác tử, sinh lịch trình, embedder) nên tách ra
 * để không có bốn bản `new GoogleGenAI(...)` với bốn cách xử lý lỗi khác nhau.
 */
/**
 * MỘT CLIENT CHO MỖI ĐIỂM CUỐI, DỰNG MỘT LẦN RỒI DÙNG LẠI.
 *
 * `GoogleGenAI` khoá `apiKey` và `baseUrl` ngay lúc khởi tạo, nên muốn đổi điểm cuối thì phải
 * đổi client — không có đường nào truyền chúng theo từng lượt gọi.
 */
let clientPool: GoogleGenAI[] | null = null;

/** Con trỏ luân phiên. Dùng chung cho mọi lượt gọi để tải rải đều, không dồn vào điểm cuối đầu. */
let nextEndpoint = 0;

function pool(): GoogleGenAI[] {
  if (!clientPool) {
    clientPool = config.geminiEndpoints.map(
      ({ apiKey, baseUrl }) =>
        new GoogleGenAI({
          apiKey,
          // `baseUrl` rỗng thì SDK giữ nguyên mặc định https://generativelanguage.googleapis.com.
          // Xem readGeminiBaseUrl() trong config.ts về việc vì sao giá trị ở đây là origin, không
          // kèm "/v1". `timeout` luôn đặt: xem config.geminiTimeoutMs về lượt treo 294 giây.
          httpOptions: { timeout: config.geminiTimeoutMs, ...(baseUrl ? { baseUrl } : {}) },
        }),
    );
  }
  return clientPool;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!hasGeminiCredentials()) return null;
  return pool()[nextEndpoint % pool().length];
}

/** Số điểm cuối đang có. Vòng lặp thử lại dùng nó để biết đã đi hết một vòng hay chưa. */
export function endpointCount(): number {
  return hasGeminiCredentials() ? pool().length : 0;
}

/**
 * Nhận điểm cuối khởi đầu cho một lượt gọi, và nhích con trỏ chung sang chỗ kế tiếp.
 *
 * Lấy chỉ số ra MỘT LẦN rồi giữ trong biến cục bộ của lượt gọi, thay vì đọc con trỏ chung ở mỗi
 * lần thử. Hai lượt gọi chạy song song — chuyện bình thường, vì một lượt hội thoại gọi model vài
 * lần — sẽ nhích con trỏ xen kẽ nhau, và khi đó việc đọc lại con trỏ giữa chừng khiến các lần
 * thử của cùng một lượt nhảy loạn xạ, có thể quay lại đúng điểm cuối vừa hỏng.
 */
function takeEndpointSlot(): number {
  const slot = nextEndpoint;
  nextEndpoint = (nextEndpoint + 1) % Math.max(pool().length, 1);
  return slot;
}

function clientAt(index: number): GoogleGenAI {
  const clients = pool();
  return clients[index % clients.length];
}

/** Chỉ dùng trong test: xoá pool để lần gọi sau đọc lại cấu hình. */
export function resetGeminiPool(): void {
  clientPool = null;
  nextEndpoint = 0;
}

/**
 * Khi thiếu API key, các endpoint AI trả về 503 kèm hướng dẫn thay vì một câu trả lời dựng
 * sẵn — để lỗi cấu hình không bị che mất dưới nội dung giả.
 */
export function respondAiUnavailable(res: Response) {
  return res.status(503).json({
    error: "Trợ lý AI chưa được cấu hình",
    details:
      "Thiếu biến môi trường GEMINI_API_KEY. Tạo file .env từ .env.example rồi khởi động lại server.",
  });
}

/**
 * Phân giải JSON từ phản hồi của model, chịu được vài kiểu bọc thường gặp.
 *
 * Lý ra hàm này chỉ cần `JSON.parse`: mọi lượt gọi đều đặt `responseMimeType: "application/json"`
 * kèm `responseSchema`, và điểm cuối chính thức của Google thực thi đúng hai tham số đó. Nhưng
 * `GEMINI_BASE_URL` cho phép trỏ sang một proxy trung gian, và đo trên proxy đang dùng cho thấy
 * nó BỎ QUA cả hai: model trả về văn xuôi kiểu `Ý định của câu này là: **discovery**`, hoặc trả
 * JSON đúng nhưng bọc trong khối ```json.
 *
 * Ba bước dưới đây xử lý theo thứ tự từ chặt tới lỏng. Bước cuối — cắt lấy đoạn từ `{` đầu tiên
 * tới `}` cuối cùng — cố tình KHÔNG dùng regex cân bằng ngoặc: chuỗi JSON hợp lệ luôn bắt đầu và
 * kết thúc bằng cặp đó, còn nếu cắt ra thứ không phân giải được thì `JSON.parse` vẫn ném và ta
 * trả `null` như cũ. Không có nhánh nào đoán nội dung.
 */
export function safeJsonParse(raw: string | undefined): any {
  if (!raw) return null;

  const direct = tryParse(raw);
  if (direct !== null) return direct;

  // Khối mã markdown: ```json ... ``` hoặc ``` ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = tryParse(fenced[1]);
    if (inner !== null) return inner;
  }

  // JSON nằm lẫn trong văn xuôi.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const sliced = tryParse(raw.slice(first, last + 1));
    if (sliced !== null) return sliced;
  }

  return null;
}

/**
 * Cứu lấy câu trả lời khi model viết văn xuôi thay vì JSON.
 *
 * PHẠM VI HẸP CÓ CHỦ ĐÍCH: chỉ áp cho schema có trường `reply` kiểu chuỗi, tức các lượt gọi sinh
 * câu trả lời cho khách. Schema của NLU không có trường đó nên không bao giờ đi qua đây — và điều
 * này quan trọng: đoán một ý định từ văn xuôi là chỗ dễ sai và hậu quả lan ra cả lượt hội thoại,
 * còn ở đây thì thứ ta cứu chính là đoạn văn mà model định gửi cho khách.
 *
 * VÌ SAO CỨU CHỨ KHÔNG VỨT. Đo được trên điểm cuối đang dùng: model sinh ra câu trả lời ĐÚNG, có
 * số liệu thời tiết thật, rồi bị vứt chỉ vì thiếu lớp vỏ JSON; guardrail đọc `reply` rỗng là
 * "empty" và chuyển tiếp cả lượt. Khách nhận "mình chưa xử lý được yêu cầu này" trong khi câu trả
 * lời đúng vừa bị bỏ đi một mili-giây trước đó. Giữ lại phần văn xuôi là hành vi đúng hơn hẳn.
 *
 * ĐIỀU NÀY KHÔNG NỚI LỎNG KIỂM SOÁT NỘI DUNG. Văn bản vẫn đi qua toàn bộ guardrail phía sau —
 * kiểm rỗng, kiểm sót placeholder PII, kiểm `grounded` với tác tử tri thức. Nó đến từ đúng model
 * với đúng system instruction; thứ duy nhất thiếu là lớp vỏ. `suggestions` trả về mảng rỗng vì
 * không có cách nào tách gợi ý ra khỏi văn xuôi mà không phải đoán.
 *
 * Đây là bản vá cho một khiếm khuyết của điểm cuối, KHÔNG phải giải pháp lâu dài. Cách sửa triệt
 * để là dùng điểm cuối chính thức của Google, nơi `responseSchema` được thực thi và nhánh này
 * không bao giờ chạy.
 */
function recoverProseReply<T>(schema: unknown, text: string | undefined): T | null {
  const prose = text?.trim();
  if (!prose) return null;

  const properties = (schema as any)?.properties;
  // So không phân biệt hoa thường: schema của dự án dùng hằng `Type.STRING` của @google/genai,
  // vốn là chuỗi VIẾT HOA. Bản đầu của hàm này so với "string" viết thường nên không bao giờ
  // khớp, và nhánh cứu văn xuôi lặng lẽ không chạy — đúng kiểu lỗi mà một phép so chuỗi thô hay
  // gây ra khi giá trị đến từ một enum bên ngoài.
  const isString = (field: unknown) => String((field as any)?.type ?? "").toLowerCase() === "string";
  if (!properties || !isString(properties.reply)) return null;

  // Văn xuôi quá ngắn thì nhiều khả năng là mẩu lỗi hoặc lời từ chối cụt, không phải câu trả lời.
  // Để nó rơi xuống nhánh lỗi và chuyển tiếp, đúng như khi không có gì.
  if (prose.length < 40) return null;

  const recovered: Record<string, unknown> = { reply: prose };
  if (properties.suggestions) recovered.suggestions = [];
  // `summary` của tác tử hỗ trợ: dùng lại chính đoạn văn, cắt ngắn cho bản ghi chuyển tiếp.
  if (isString(properties.summary)) recovered.summary = prose.slice(0, 500);

  return recovered as T;
}

function tryParse(value: string): any {
  try {
    const parsed = JSON.parse(value.trim());
    // `JSON.parse("null")` hợp lệ nhưng vô dụng với người gọi, và trả về nó sẽ khiến nhánh dự
    // phòng ở tầng trên không chạy. Coi như thất bại.
    return parsed === null ? null : parsed;
  } catch {
    return null;
  }
}

export function cleanStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

/**
 * Phân tầng model theo SRS Mục 11.4.5. `light` cho phân loại ý định, trích xuất thực thể và
 * FAQ ngắn (~70% lượt gọi); `strong` cho dựng lịch trình, dự toán kinh phí và suy luận nhiều
 * bước (~10-20%).
 */
export type ModelTier = "light" | "strong";

export function modelFor(tier: ModelTier): string {
  return tier === "light" ? config.geminiModelLight : config.geminiModel;
}

export interface StructuredCall {
  tier: ModelTier;
  contents: string | Content[];
  schema: Schema;
  systemInstruction?: string;
  temperature?: number;
}

/** Số liệu để ghi vào ChatMessage.trace — không có nó thì không đo được ngưỡng 3 giây. */
export interface CallMetrics {
  model: string;
  latencyMs: number;
  promptTokens?: number;
  outputTokens?: number;
  /**
   * Số lượt gọi lại vì phản hồi không phân giải được JSON. 0 nghĩa là lượt đầu đã đúng.
   *
   * Phải đo được từ bên ngoài chứ không chỉ nằm trong log cảnh báo: mỗi lượt gọi lại là một lần
   * nhân đôi độ trễ và token của lượt đó, nên khi p95 vượt ngưỡng thì đây là chỗ đầu tiên phải
   * nhìn — và tỷ lệ này chính là thước đo xem điểm cuối đang dùng có thực thi responseSchema hay
   * không, tức lý do nêu trong ghi chú của generateStructured.
   */
  retries: number;
}

export interface StructuredResult<T> {
  data: T | null;
  metrics: CallMetrics;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("Thiếu GEMINI_API_KEY");
    this.name = "AiUnavailableError";
  }
}

/**
 * ĐIỂM CUỐI CHẬP CHỜN KHÔNG PHẢI LÀ LƯỢT HỎNG.
 *
 * Vòng lặp thử lại bên dưới sinh ra cho một kiểu hỏng duy nhất — phản hồi không phân giải được —
 * còn một lỗi HTTP từ điểm cuối thì ném thẳng ra ngoài, và với khách đó là một lượt chat chết
 * hẳn. Nhưng hai thứ ấy đáng được đối xử như nhau: ngày 2026-09-22, api.shopaikey.com trả "Dịch
 * vụ đang quá tải" cho một lượt rồi chạy đúng ba lượt liền ngay sau đó, và chính một nhịp như
 * vậy đã giết trọn hai lần chạy đánh giá. Một request lại là đủ để lượt đó thành công.
 *
 * CHỈ thử lại những mã nói rằng "lúc khác thử lại có thể được": quá tải, hết hạn mức tức thời,
 * lỗi phía máy chủ. Yêu cầu sai (400), khoá sai (401/403) hay model không tồn tại (404) thì thử
 * lại bao nhiêu lần cũng ra đúng câu trả lời đó, mà mỗi lần lại tính thêm một lượt vào hạn mức.
 */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_BACKOFF_MS = 700;

/**
 * Hỏng ở tầng MẠNG, dưới cả HTTP: kết nối đứt giữa chừng, hết giờ chờ, DNS trả lời "lát nữa hỏi
 * lại". Undici gói chúng thành `TypeError: fetch failed` — không có `status`, và câu chữ ấy không
 * khớp mẫu nào ở trên — nên một lần TCP reset từng bị xếp là lỗi vĩnh viễn và ném thẳng, không
 * thử lại lấy một lần. Ngày 2026-09-22 đúng một `read ECONNRESET` như vậy giết một lần chạy đánh
 * giá 67 kịch bản ngay ở ca thứ ba; với khách thì nó là một câu hỏi mất trắng. Kết nối đứt lại là
 * thứ đáng thử lại nhất trong mọi kiểu hỏng: lần gửi sau thường đi lọt.
 *
 * ENOTFOUND KHÔNG nằm ở đây. Tên miền sai thì thử lại bao nhiêu lần cũng sai, và đó là lỗi cấu
 * hình cần hiện ra ngay thay vì bị hoãn sau mấy nhịp backoff.
 */
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
]);

/**
 * Thử lại mấy lượt trước khi bỏ cuộc.
 *
 * Mặc định 2 vì một lượt chat có người đang ngồi chờ: quá ngần ấy thì thà báo lỗi còn hơn để
 * khách nhìn khung trống thêm chục giây. Nhưng lần chạy đánh giá không có ai chờ, lại dài hàng
 * trăm lượt gọi, và một nhịp quá tải hai giây ở bất kỳ lượt nào cũng vứt đi cả hai mươi phút đo
 * — ngày 2026-09-22 nó giết bốn lần chạy liên tiếp. Nên ngân sách đọc được từ môi trường, và
 * `eval/run-eval.ts` đặt cao hơn cho riêng nó.
 *
 * Đọc lại ở TỪNG lượt gọi chứ không chốt lúc nạp module: nơi gọi đặt biến sau khi module đã nạp
 * thì giá trị chốt sẵn sẽ lặng lẽ bỏ qua thiết lập đó.
 */
function maxRetries(): number {
  const raw = Number(process.env.GEMINI_MAX_RETRIES);
  return Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : 2;
}

function isTransientProviderError(error: unknown): boolean {
  const raw = error as { status?: unknown; code?: unknown; name?: unknown; cause?: { code?: unknown } } | null;

  /**
   * Hết hạn thời gian là lỗi TẠM THỜI, dù nó do chính ta gây ra.
   *
   * `GEMINI_TIMEOUT_MS` cắt một lượt gọi treo, và SDK ném ra `AbortError` — không có `status`, và
   * câu chữ "This operation was aborted" không khớp mẫu nào bên dưới. Không nhận diện ở đây thì
   * nó rơi vào nhánh vĩnh viễn, và với cấu hình MỘT điểm cuối thì một lượt treo sẽ không được thử
   * lại lấy một lần — tức là bản vá timeout đổi một lượt chờ năm phút thành một lượt hỏng ngay,
   * thay vì thành một lượt gửi lại và đi lọt.
   */
  if (raw?.name === "AbortError" || raw?.code === "ABORT_ERR") return true;

  if (typeof raw?.status === "number") return TRANSIENT_STATUS.has(raw.status);

  // Mã lỗi hệ thống nằm ở `cause` khi undici bọc lại thành `fetch failed`, và nằm ngay trên lỗi
  // khi không bọc. Xem cả hai chỗ vì chỉ nhìn một chỗ là bỏ sót đúng nửa số trường hợp.
  if ([raw?.code, raw?.cause?.code].some((code) => typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code))) {
    return true;
  }

  // Proxy có thể gói lỗi lại và làm mất `status`; khi đó chỉ còn câu chữ để dựa vào.
  return /overload|unavailable|try again|quá tải/i.test(String((error as Error | null)?.message ?? ""));
}

/**
 * Còn thử tiếp không, và vì lý do gì.
 *
 * Hai lý do rất khác nhau, nên giữ tách bạch thay vì gộp thành một cờ boolean:
 *
 * - `transient` — điểm cuối tự khai là lỗi nhất thời (429, 5xx, kết nối đứt). Gửi lại thì có cơ
 *   hội đi lọt, kể cả khi chỉ có một điểm cuối.
 * - `failover` — lỗi KHÔNG tạm thời, nhưng trong chuỗi vẫn còn điểm cuối chưa thử. Với một điểm
 *   cuối duy nhất thì đây là chỗ phải dừng: thử lại một yêu cầu sai chỉ tốn thêm hạn mức để nhận
 *   về đúng câu trả lời đó. Có nhiều điểm cuối thì ý nghĩa đổi hẳn — proxy đang dùng trả 400
 *   "Yêu cầu không hợp lệ" cho chính request nó vừa chấp nhận, nên gửi request ấy sang một điểm
 *   cuối khác chính là phép kiểm chứng: request sai THẬT sẽ hỏng ở mọi điểm cuối và lỗi vẫn nổi
 *   lên như cũ, còn proxy nói dối thì lần sau đi lọt.
 */
type RetryReason = "transient" | "failover";

function retryDecision(error: unknown, attempt: number, budget: number): RetryReason | null {
  if (attempt >= budget) return null;
  if (isTransientProviderError(error)) return "transient";
  return attempt + 1 < endpointCount() ? "failover" : null;
}

function describeRetry(reason: RetryReason, error: unknown): string {
  if (reason === "transient") return "điểm cuối trả lỗi tạm thời";
  const status = (error as { status?: unknown } | null)?.status;
  return `điểm cuối từ chối (${status ?? "không rõ mã"}), chuyển sang điểm cuối kế tiếp`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Một lần gọi sinh nội dung có schema, kèm đo độ trễ và token.
 *
 * `data` trả về null khi model trả JSON không đọc được — cố tình không throw, vì mỗi tác tử
 * có cách xử lý riêng cho tình huống đó (tác tử tri thức thì chuyển sang escalation, tác tử
 * lịch trình thì báo cho khách thử lại).
 */
export async function generateStructured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
  const ai = getGeminiClient();
  if (!ai) throw new AiUnavailableError();
  // Một lần cho cả lượt gọi: hai lượt liên tiếp vì thế không cùng vào một điểm cuối.
  const slot = takeEndpointSlot();

  const model = modelFor(call.tier);
  const startedAt = Date.now();

  /**
   * THỬ LẠI KHI PHẢN HỒI KHÔNG PHÂN GIẢI ĐƯỢC — áp cho MỌI lượt gọi có cấu trúc.
   *
   * Đặt ở đây chứ không ở từng nơi gọi, vì lỗi này không thuộc về nơi gọi nào cả: đo được 25% số
   * lượt trả về văn xuôi thay vì JSON, và nó đánh vào cả phân loại ý định lẫn lượt sinh câu trả
   * lời. Vá riêng ở NLU thì lượt thứ hai vẫn hỏng, và biểu hiện với khách y hệt.
   *
   * Nguyên nhân nằm ngoài code: proxy đặt qua `GEMINI_BASE_URL` không thực thi `responseMimeType`
   * và `responseSchema`. Điểm cuối chính thức của Google ép hai tham số đó, và ở đó vòng lặp này
   * gần như luôn dừng ở lần đầu. Cách sửa TRIỆT ĐỂ là dùng điểm cuối chính thức; vòng lặp này chỉ
   * kéo tỷ lệ hỏng nhìn thấy được từ khoảng 25% xuống khoảng 1,5%.
   *
   * Thử lại là đúng bản chất chứ không phải che lỗi: các lượt hỏng độc lập nhau, cùng một prompt
   * thì lượt sau vẫn có thể ra JSON đúng. Cái phải tránh là nuốt lỗi im lặng — nếu hết lượt thử
   * mà vẫn hỏng thì có log ở mức cảnh báo, để lỗi hạ tầng không bị đọc nhầm thành "khách hỏi điều
   * ngoài phạm vi".
   */
  /**
   * Ngân sách phải đủ đi HẾT một vòng các điểm cuối, nếu không thì điểm cuối thứ ba trong chuỗi
   * không bao giờ được thử tới và việc cấu hình nó ra thành vô nghĩa.
   */
  const MAX_PARSE_RETRIES = Math.max(maxRetries(), endpointCount() - 1);
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let data: T | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt += 1) {
    retries = attempt;

    /**
     * Tính tiền TỪNG LƯỢT GỌI THẬT, kể cả lượt gọi lại vì phản hồi không phân giải được — mỗi
     * lượt trong vòng lặp này là một request có hoá đơn riêng. Đếm một lần cho cả vòng lặp sẽ
     * báo thiếu tới ba lần đúng vào lúc điểm cuối đang trả về văn xuôi, tức đúng lúc số lời gọi
     * thật tăng vọt.
     */
    await chargeModelCall();

    try {
      response = await clientAt(slot + attempt).models.generateContent({
        model,
        contents: call.contents,
        config: {
          ...(call.systemInstruction ? { systemInstruction: call.systemInstruction } : {}),
          temperature: call.temperature ?? 0.7,
          responseMimeType: "application/json",
          responseSchema: call.schema,
        },
      });
    } catch (error) {
      const decision = retryDecision(error, attempt, MAX_PARSE_RETRIES);
      if (!decision) throw error;
      console.warn(
        `Gemini (${model}): ${describeRetry(decision, error)}, thử lại ${attempt + 1}/${MAX_PARSE_RETRIES}.`,
      );
      await wait(TRANSIENT_BACKOFF_MS * (attempt + 1));
      continue;
    }

    data = safeJsonParse(response.text) as T | null;
    if (data !== null) break;

    // Nhãn suy từ chính schema thay vì thêm một tham số mới: mỗi nơi gọi có bộ trường riêng
    // (`intent,confidence,...` cho NLU, `reply,suggestions` cho câu trả lời), nên nó đủ để biết
    // lượt nào hỏng mà không phải đổi chữ ký hàm hay sửa mọi nơi gọi.
    const where = Object.keys((call.schema as any)?.properties ?? {}).join(",") || "không rõ";

    if (attempt < MAX_PARSE_RETRIES) {
      console.warn(
        `Gemini (${model}) [${where}]: phản hồi không phải JSON, thử lại ${attempt + 1}/${MAX_PARSE_RETRIES}.`,
      );
    } else {
      // Hết lượt thử. Với schema kiểu câu trả lời, cứu lấy phần văn xuôi thay vì vứt đi — xem
      // `recoverProseReply`.
      const recovered = recoverProseReply<T>(call.schema, response?.text);
      if (recovered) {
        console.warn(
          `Gemini (${model}) [${where}]: điểm cuối không trả JSON sau ${MAX_PARSE_RETRIES + 1} ` +
            `lượt; đã dùng nguyên văn phần văn xuôi làm câu trả lời.`,
        );
        data = recovered;
        break;
      }

      console.error(
        `Gemini (${model}) [${where}]: vẫn không phân giải được JSON sau ${MAX_PARSE_RETRIES + 1} ` +
          `lượt. Đây là lỗi hạ tầng — điểm cuối hiện tại có thể không thực thi responseSchema. ` +
          `Phản hồi cuối: ${JSON.stringify(response?.text ?? "").slice(0, 200)}`,
      );
    }
  }

  return {
    data,
    metrics: {
      model,
      latencyMs: Date.now() - startedAt,
      promptTokens: response?.usageMetadata?.promptTokenCount,
      outputTokens: response?.usageMetadata?.candidatesTokenCount,
      retries,
    },
  };
}

/**
 * Giải mã phần đầu của một chuỗi JSON, dừng trước mọi chuỗi thoát chưa đủ ký tự.
 *
 * Phải tự giải mã chứ không cắt chuỗi thô: model viết `\n` giữa các mục bullet, và đẩy hai ký tự
 * `\` `n` ra màn hình thì khách thấy đúng hai ký tự đó. Chuỗi thoát nằm vắt qua ranh giới hai
 * chunk cũng phải giữ lại — một `\` lẻ ở cuối buffer chưa nói được nó sắp thành `\n` hay `\"`.
 */
function decodeJsonStringPrefix(source: string): string {
  const SIMPLE: Record<string, string> = {
    '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
  };
  let out = "";
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') break; // chuỗi đã đóng, phần sau là trường khác
    if (ch !== "\\") {
      out += ch;
      i += 1;
      continue;
    }

    const next = source[i + 1];
    if (next === undefined) break; // `\` lẻ ở cuối buffer: chờ chunk sau

    if (next === "u") {
      const hex = source.slice(i + 2, i + 6);
      if (hex.length < 4) break; // `\uXXXX` chưa đủ bốn chữ số
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        // Không phải mã hợp lệ. Giữ nguyên văn thay vì để parseInt trả NaN và sinh ký tự \0.
        out += `\\u${hex}`;
        i += 6;
        continue;
      }
      out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }

    out += SIMPLE[next] ?? next;
    i += 2;
  }

  return out;
}

const REPLY_KEY = /"reply"\s*:\s*"/;

/**
 * Rút phần `reply` đã nhận được từ một phản hồi JSON CHƯA HOÀN CHỈNH.
 *
 * Đây là mảnh ghép làm cho streaming token chạy được trên một hệ thống mà mọi lượt gọi đều đặt
 * `responseSchema`: cái chảy về không phải chữ sạch mà là JSON gõ dần — `{"repl`, rồi
 * `y": "Hà Gi`, rồi `ang có...`. Nối thẳng các chunk đó rồi hiện lên màn hình thì khách đọc được
 * cả dấu ngoặc và tên trường.
 *
 * HAI HÌNH DẠNG ĐẦU RA, vì điểm cuối hiện tại trả về cả hai (xem ghi chú ở `generateStructured`):
 *
 *  - JSON đúng hợp đồng: chờ tới khi khoá `reply` xuất hiện rồi mới đẩy chữ ra.
 *  - Văn xuôi trần, khi proxy bỏ qua `responseMimeType`: chính nó là câu trả lời, đẩy thẳng. Đây
 *    là đường mà `recoverProseReply` cứu ở cuối lượt, và streaming đi cùng một lối.
 *
 * Phân biệt hai hình dạng bằng ký tự đầu tiên khác khoảng trắng: `{` thì là JSON. Cách này có thể
 * đoán nhầm ở đúng một chunk đầu — và `generateStructuredStream` xử lý việc đó bằng cách kiểm
 * chuỗi đã đẩy có còn là tiền tố của chuỗi hiện tại không, chứ không tin kết quả ở đây là cuối cùng.
 */
export function partialReplyText(raw: string): string {
  if (!raw) return "";

  // Rào markdown mở đầu (```json) — model bọc JSON trong khối mã là kiểu sai thường gặp nhất.
  const body = raw.replace(/^\s*```(?:json)?\s*\n?/i, "");
  const match = REPLY_KEY.exec(body);

  if (!match) {
    // Đang là JSON nhưng khoá `reply` chưa tới, hoặc schema này không có `reply` (NLU): chưa có
    // gì để hiện. Ngược lại là văn xuôi, và văn xuôi thì chính nó là câu trả lời.
    return body.trimStart().startsWith("{") ? "" : body;
  }

  return decodeJsonStringPrefix(body.slice(match.index + match[0].length));
}

export interface StreamingCall extends StructuredCall {
  /** Nhận từng đoạn chữ MỚI của `reply`, đã giải mã, theo đúng thứ tự. */
  onDelta?: (text: string) => void;
  /**
   * Bỏ hết những gì `onDelta` đã đẩy ra trước đó.
   *
   * Gọi ở hai tình huống, và cả hai đều có thật: lượt gọi phải thử lại vì phản hồi không phân
   * giải được JSON (đoạn vừa hiện thuộc về một lượt đã hỏng), và đầu ra đổi hình dạng giữa chừng
   * từ văn xuôi sang JSON.
   */
  onReset?: () => void;
}

/**
 * Bản streaming của `generateStructured`.
 *
 * HỢP ĐỒNG TRẢ VỀ GIỮ NGUYÊN: vẫn là `{ data, metrics }` với đúng ngữ nghĩa cũ — `data` null khi
 * không phân giải được, cùng vòng thử lại, cùng nhánh cứu văn xuôi. `onDelta` là thứ DUY NHẤT
 * thêm vào, và nó chỉ để hiện sớm. Nơi gọi vẫn phải dùng `data` làm kết quả thật, vì đó là thứ đi
 * qua guardrail; những gì đã đẩy qua `onDelta` chưa được kiểm gì cả.
 *
 * VÌ SAO KHÔNG THAY THẾ HẲN `generateStructured`. NLU không có trường `reply` nên không có gì để
 * stream, tầng đo lường và bộ chấm gọi API không-streaming để so sánh được giữa các lần chạy, và
 * quan trọng nhất: một lượt gọi có `onDelta` thì hỏng theo kiểu khác — chữ đã ra màn hình rồi mới
 * biết guardrail chặn. Giữ hai hàm tách nhau để chỗ nào chịu rủi ro đó là chỗ tự khai ra.
 */
export async function generateStructuredStream<T>(call: StreamingCall): Promise<StructuredResult<T>> {
  const ai = getGeminiClient();
  if (!ai) throw new AiUnavailableError();
  // Một lần cho cả lượt gọi: hai lượt liên tiếp vì thế không cùng vào một điểm cuối.
  const slot = takeEndpointSlot();

  const model = modelFor(call.tier);
  const startedAt = Date.now();

  const MAX_PARSE_RETRIES = Math.max(maxRetries(), endpointCount() - 1);
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
  let raw = "";
  let data: T | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt += 1) {
    retries = attempt;

    // Lượt trước đã đẩy chữ ra rồi mới hỏng: xoá đi trước khi lượt mới bắt đầu ghi đè, nếu không
    // khách đọc được hai bản nối đuôi nhau.
    if (attempt > 0) call.onReset?.();

    await chargeModelCall();

    raw = "";
    let emitted = "";

    /**
     * Lỗi tạm thời của điểm cuối được xử lý y như bên `generateStructured`, nhưng ở đây nó bao
     * trùm CẢ vòng đọc luồng: một lượt streaming có thể đứt giữa chừng, và khi đó phần chữ đã đẩy
     * ra thuộc về một câu trả lời không bao giờ hoàn thành. Lượt thử sau mở đầu bằng `onReset`
     * ngay đầu vòng lặp, nên khách thấy câu trả lời được viết lại từ đầu chứ không thấy hai mẩu
     * dán vào nhau.
     */
    try {
      const stream = await clientAt(slot + attempt).models.generateContentStream({
        model,
        contents: call.contents,
        config: {
          ...(call.systemInstruction ? { systemInstruction: call.systemInstruction } : {}),
          temperature: call.temperature ?? 0.7,
          responseMimeType: "application/json",
          responseSchema: call.schema,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) raw += chunk.text;
        // Chunk cuối mang usageMetadata; các chunk trước để trống. Ghi đè để giữ bản đầy đủ nhất.
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        if (!call.onDelta) continue;

        const shown = partialReplyText(raw);

        /**
         * Chuỗi đã đẩy phải luôn là TIỀN TỐ của chuỗi hiện tại. Không còn đúng nghĩa là hình dạng
         * đầu ra vừa đổi — đoán nhầm văn xuôi ở chunk đầu rồi hoá ra là JSON. Khi đó xoá và đẩy lại
         * từ đầu; đây cũng chính là lý do `onDelta` không bao giờ được coi là kết quả cuối cùng.
         */
        if (!shown.startsWith(emitted)) {
          call.onReset?.();
          emitted = "";
        }
        if (shown.length > emitted.length) {
          call.onDelta(shown.slice(emitted.length));
          emitted = shown;
        }
      }
    } catch (error) {
      const decision = retryDecision(error, attempt, MAX_PARSE_RETRIES);
      if (!decision) throw error;
      console.warn(
        `Gemini (${model}) streaming: ${describeRetry(decision, error)}, thử lại ${attempt + 1}/${MAX_PARSE_RETRIES}.`,
      );
      await wait(TRANSIENT_BACKOFF_MS * (attempt + 1));
      continue;
    }

    data = safeJsonParse(raw) as T | null;
    if (data !== null) break;

    const where = Object.keys((call.schema as any)?.properties ?? {}).join(",") || "không rõ";

    if (attempt < MAX_PARSE_RETRIES) {
      console.warn(
        `Gemini (${model}) [${where}] streaming: phản hồi không phải JSON, thử lại ${attempt + 1}/${MAX_PARSE_RETRIES}.`,
      );
    } else {
      const recovered = recoverProseReply<T>(call.schema, raw);
      if (recovered) {
        console.warn(
          `Gemini (${model}) [${where}] streaming: điểm cuối không trả JSON sau ${MAX_PARSE_RETRIES + 1} ` +
            `lượt; đã dùng nguyên văn phần văn xuôi làm câu trả lời.`,
        );
        data = recovered;
        break;
      }

      console.error(
        `Gemini (${model}) [${where}] streaming: vẫn không phân giải được JSON sau ` +
          `${MAX_PARSE_RETRIES + 1} lượt. Phản hồi cuối: ${JSON.stringify(raw).slice(0, 200)}`,
      );
    }
  }

  return {
    data,
    metrics: {
      model,
      latencyMs: Date.now() - startedAt,
      promptTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      retries,
    },
  };
}
