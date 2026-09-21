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
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!hasGeminiCredentials()) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      // Chỉ truyền httpOptions khi có cấu hình: để trống thì SDK giữ nguyên mặc định
      // https://generativelanguage.googleapis.com. Xem readGeminiBaseUrl() trong config.ts
      // về việc vì sao giá trị ở đây là origin, không kèm "/v1".
      ...(config.geminiBaseUrl ? { httpOptions: { baseUrl: config.geminiBaseUrl } } : {}),
    });
  }
  return aiClient;
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
 * Một lần gọi sinh nội dung có schema, kèm đo độ trễ và token.
 *
 * `data` trả về null khi model trả JSON không đọc được — cố tình không throw, vì mỗi tác tử
 * có cách xử lý riêng cho tình huống đó (tác tử tri thức thì chuyển sang escalation, tác tử
 * lịch trình thì báo cho khách thử lại).
 */
export async function generateStructured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
  const ai = getGeminiClient();
  if (!ai) throw new AiUnavailableError();

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
  const MAX_PARSE_RETRIES = 2;
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

    response = await ai.models.generateContent({
      model,
      contents: call.contents,
      config: {
        ...(call.systemInstruction ? { systemInstruction: call.systemInstruction } : {}),
        temperature: call.temperature ?? 0.7,
        responseMimeType: "application/json",
        responseSchema: call.schema,
      },
    });

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
