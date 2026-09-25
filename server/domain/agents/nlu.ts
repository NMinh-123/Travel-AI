import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { generateStructured, type CallMetrics } from "@server/infra/gemini";
import { INTENTS, type Intent, type NluResult, type Slots } from "./types";
import { extractSlots } from "./slotExtract";
import { normalizePlaceName } from "@data/places/normalize";
import { sanitizeModelPhrases } from "@server/domain/temporal/phrases";

/**
 * Lớp hiểu ngôn ngữ tự nhiên (SRS Mục 11.1): nhận diện ý định và trích xuất thực thể.
 *
 * Chạy ở tầng model nhẹ theo SRS Mục 11.4.5 — đây chính là phần "khoảng 70% lượt gọi" mà việc
 * phân tầng nhắm tới. Một lượt hội thoại tốn đúng hai lần gọi model: lần này để định tuyến, và
 * một lần nữa ở tác tử để diễn đạt câu trả lời.
 *
 * Vì sao phải là một lần gọi model thật chứ không phải bộ luật từ khoá: `confidence` là đầu vào
 * bắt buộc của một trong ba trigger chuyển tiếp ở SRS Mục 10.6 ("độ tin cậy nhận diện ý định
 * thấp hơn ngưỡng"). Bộ luật từ khoá không sinh ra được con số đó.
 */
const NLU_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: "Ý định chính của lượt nói này.",
      enum: INTENTS,
    },
    confidence: {
      type: Type.NUMBER,
      description: "Độ tin cậy của việc phân loại, từ 0 đến 1. Thấp khi câu hỏi mơ hồ.",
    },
    wantsHuman: {
      type: Type.BOOLEAN,
      description:
        "True khi khách yêu cầu gặp nhân viên thật, hoặc đang khiếu nại/gặp sự cố khẩn. " +
        'Ngoại lệ: "thuê người lái", "thuê tài xế", "đi tour có hướng dẫn viên" là dịch vụ du ' +
        "lịch khách đang chọn cho chuyến đi, không phải yêu cầu gặp nhân viên hỗ trợ.",
    },
    destinations: {
      type: Type.ARRAY,
      description: "Tên địa danh khách nhắc tới, giữ nguyên cách khách viết.",
      items: { type: Type.STRING },
    },
    days: { type: Type.INTEGER, description: "Số ngày của chuyến đi, 0 nếu khách chưa nói." },
    travelers: { type: Type.INTEGER, description: "Số người đi, 0 nếu khách chưa nói." },
    temporalPhrases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Cụm chữ chỉ thời gian khách nói ra, giữ NGUYÊN VĂN. Không quy đổi thành ngày hay tháng.",
    },
    budgetLevel: {
      type: Type.STRING,
      description: "Mức ngân sách, chuỗi rỗng nếu khách chưa nói.",
      enum: ["backpacker", "comfort", "luxury", ""],
    },
    travelMode: {
      type: Type.STRING,
      description: "Phương tiện, chuỗi rỗng nếu khách chưa nói.",
      enum: ["motorbike", "easy_rider", "car_suv", ""],
    },
    vibe: {
      type: Type.STRING,
      description: "Phong cách chuyến đi, chuỗi rỗng nếu khách chưa nói.",
      enum: ["photography", "culture", "adventure", "chill", ""],
    },
  },
  required: ["intent", "confidence", "wantsHuman", "destinations", "days", "travelers", "temporalPhrases"],
};

const NLU_INSTRUCTION = `Bạn là bộ phân loại ý định của trợ lý du lịch Hà Giang. Chỉ phân loại và trích xuất, KHÔNG trả lời khách.

Năm ý định:
- discovery: khách muốn tìm/gợi ý điểm đến phù hợp ("nên đi đâu", "chỗ nào đẹp", "gợi ý vài điểm").
- itinerary: khách muốn một lịch trình theo ngày ("lên lịch trình 3 ngày", "đi 4 ngày thì sắp xếp sao").
- budget: khách muốn dự trù TỔNG chi phí cả chuyến đi ("đi 3 ngày hết bao nhiêu tiền", "5 triệu có đủ không"). CHỈ chọn khi khách hỏi rõ về tiền.
- knowledge: hỏi thông tin — địa danh, văn hoá, ẩm thực, thời tiết, đường đèo, an toàn, thủ tục, kinh nghiệm, và GIÁ CỦA MỘT DỊCH VỤ LẺ ("giá chỗ nghỉ ở Mèo Vạc", "thuê xe máy bao nhiêu một ngày", "vé vào cửa bao nhiêu").
- support: khiếu nại, sự cố, yêu cầu gặp người thật, hoặc câu hoàn toàn ngoài phạm vi du lịch Hà Giang.

Quy tắc quan trọng:
- budget và giới thiệu địa danh chỉ được chọn khi khách hỏi rõ ràng, không suy diễn hộ khách.
- confidence phải thấp (dưới 0.5) khi câu nói mơ hồ, cụt, hoặc có thể thuộc nhiều ý định.
- Chỉ trích xuất thực thể khách NÓI RA ở lượt này. Không bịa, không lấy từ giả định.
- temporalPhrases chỉ chứa cụm chữ chỉ thời gian khách nói ra, giữ NGUYÊN VĂN và thứ tự xuất hiện. Không quy đổi thành ngày hay tháng. Không có thì trả [].
- Trường số dùng 0 và trường chuỗi dùng "" khi khách chưa cung cấp.`;

interface NluRaw {
  intent: string;
  confidence: number;
  wantsHuman: boolean;
  destinations: string[];
  days: number;
  travelers: number;
  temporalPhrases?: unknown;
  budgetLevel?: string;
  travelMode?: string;
  vibe?: string;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function positive(value: unknown, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return undefined;
  return Math.round(parsed);
}

interface NluOutcome {
  result: NluResult;
  metrics: CallMetrics;
}

/**
 * KHÁCH ĐÒI GẶP NGƯỜI — đọc tất định, thay cho `wantsHuman` của model.
 *
 * Model bật trường này sai theo CẢ HAI chiều, đo ngày 2026-09-23 trên bộ holdout:
 *   - Bỏ sót: "Cho tôi nói chuyện với nhân viên tư vấn thật." (GS-171) và "Đoàn tôi đang mắc kẹt
 *     vì sạt lở, cần hỗ trợ khẩn cấp." (GS-174) đều ra `false`. Lượt đầu bị chuyển với lý do sai;
 *     lượt sau được trả lời bằng một đoạn tri thức về sạt lở thay vì được đưa tới câu chuyển tiếp
 *     có số cứu hộ 113/115/114.
 *   - Bật nhầm: "À cho mình thuê người lái thôi" (GS-186) ra `true`, dù mô tả trường trong lược đồ
 *     ĐÃ ghi rõ thuê tài xế không phải xin gặp nhân viên. Model phớt lờ một chỉ dẫn tường minh.
 */
const HUMAN_REQUEST = new RegExp(
  [
    String.raw`(noi|tro)\s*chuyen\s*(voi|cung)\s*(nhan\s*vien|nguoi\s*that|tu\s*van\s*vien|admin)`,
    String.raw`gap\s*(nhan\s*vien|nguoi\s*(that|phu\s*trach)|tu\s*van\s*vien|quan\s*ly)`,
    String.raw`can\s*(co\s*)?nguoi\s*(xu\s*ly|giai\s*quyet)`,
    String.raw`(nhan\s*vien|tu\s*van\s*vien)\s*(tu\s*van\s*)?(that|con\s*nguoi)`,
    String.raw`(can|xin)\s*(ho\s*tro|giup\s*do?|cuu)\s*(khan\s*cap|gap)`,
    String.raw`mac\s*ket`,
    String.raw`cuu\s*(voi|toi|minh|chung\s*toi)`,
  ].join("|"),
);

export function asksForHuman(message: string): boolean {
  return HUMAN_REQUEST.test(normalizePlaceName(message));
}

export async function classify(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<NluOutcome> {
  // Kèm vài lượt gần nhất vì ý định thường chỉ hiểu được trong ngữ cảnh: "2 người" một mình
  // không có ý định nào, nhưng sau câu hỏi về lịch trình thì nó là bổ sung slot.
  const recent = history
    .slice(-4)
    .map((turn) => `${turn.role === "user" ? "Khách" : "Trợ lý"}: ${turn.content}`)
    .join("\n");

  const contents = recent
    ? `Bối cảnh vài lượt gần nhất:\n${recent}\n\nLượt mới của khách: ${message}`
    : `Lượt mới của khách: ${message}`;

  const { data, metrics } = await generateStructured<NluRaw>({
    tier: "light",
    systemInstruction: NLU_INSTRUCTION,
    temperature: 0,
    schema: NLU_SCHEMA,
    contents,
  });

  /**
   * Hết đường phân giải thì coi như không hiểu — `confidence: 0` đẩy lượt sang chuyển tiếp ở
   * orchestrator, đúng hành vi mong muốn thay vì đoán một ý định bất kỳ.
   *
   * CẦN BIẾT KHI ĐỌC LOG: `generateStructured` đã thử lại tối đa ba lượt trước khi tới đây, vì
   * proxy đặt qua `GEMINI_BASE_URL` không thực thi `responseSchema` và trả văn xuôi trong khoảng
   * 25% số lượt. Nên nhánh này chạy nghĩa là ba lượt liên tiếp đều hỏng — đó là dấu hiệu HẠ TẦNG
   * chứ gần như chắc chắn không phải khách hỏi điều gì khó hiểu. Đừng đọc nhầm hai thứ đó thành
   * một: chúng biểu hiện giống hệt nhau ở phía khách nhưng cần hai cách xử lý khác hẳn.
   */
  if (!data) {
    return {
      result: { intent: "support", confidence: 0, entities: {}, temporalPhrases: [], wantsHuman: false },
      metrics,
    };
  }

  const entities: Slots = {};

  /**
   * Đọc địa danh chịu được HÌNH DẠNG TRÔI.
   *
   * Schema khai một mảng phẳng `destinations`, nhưng điểm cuối đang dùng không thực thi
   * `responseSchema`, nên model tự bịa cấu trúc riêng — quan sát được cả ba dạng:
   * `{destinations:[...]}`, `{entities:{locations:[...]}}` và `{entities:{location:"Hà Giang"}}`.
   * Chỉ đọc dạng thứ nhất là mất trắng hai dạng kia mà không có lỗi nào báo.
   *
   * Đây là bản vá cho khiếm khuyết của điểm cuối, không phải thiết kế mong muốn. Nó rẻ và không
   * gây hại: dạng nào không có thì bỏ qua.
   */
  const nested = (data as any)?.entities;
  const rawDestinations = [
    ...(Array.isArray(data.destinations) ? data.destinations : []),
    ...(Array.isArray(nested?.locations) ? nested.locations : []),
    ...(typeof nested?.location === "string" ? [nested.location] : []),
  ];
  const destinations = rawDestinations
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim());
  if (destinations.length) entities.destinations = [...new Set(destinations)];

  const days = positive(data.days, 14);
  if (days) entities.days = days;

  const travelers = positive(data.travelers, 40);
  if (travelers) entities.travelers = travelers;

  const temporalPhrases = sanitizeModelPhrases(data.temporalPhrases, message);

  const budgetLevel = pickEnum(data.budgetLevel, ["backpacker", "comfort", "luxury"] as const);
  if (budgetLevel) entities.budgetLevel = budgetLevel;

  const travelMode = pickEnum(data.travelMode, ["motorbike", "easy_rider", "car_suv"] as const);
  if (travelMode) entities.travelMode = travelMode;

  const vibe = pickEnum(data.vibe, ["photography", "culture", "adventure", "chill"] as const);
  if (vibe) entities.vibe = vibe;

  /**
   * Slot đọc TẤT ĐỊNH từ chính câu của khách, ghi đè lên giá trị model đưa ra.
   *
   * Thứ tự này quan trọng và không được đảo. Model ĐOÁN, mã trong `extractSlots` ĐỌC — khi hai
   * bên khác nhau thì gần như luôn là model đoán sai. Ca thử "Du lịch 3 ngày 2 đêm" là ví dụ
   * sạch nhất: model trả về một hình dạng JSON tự bịa nên `days` rỗng hoàn toàn, còn phép đọc
   * chuỗi thì lấy ra số 3 một cách chắc chắn.
   *
   * Ngày tháng do Temporal Router quy đổi ở orchestrator; model chỉ trích cụm chữ nguyên văn.
   */
  Object.assign(entities, extractSlots(message));

  const intent = (INTENTS.includes(data.intent as Intent) ? data.intent : "knowledge") as Intent;
  const confidence = Number.isFinite(data.confidence)
    ? Math.min(1, Math.max(0, data.confidence))
    : 0;

  return {
    result: {
      intent, confidence, entities, temporalPhrases,
      /**
       * CHỈ phép đọc tất định quyết định, `wantsHuman` của model bị bỏ qua.
       *
       * Trước đây model được bật cờ tự do vì bật thừa chỉ tốn một lượt chuyển cho nhân viên. Nay
       * chưa có CSKH, bật thừa nghĩa là khách mất câu trả lời: holdout ngày 2026-09-24 có bốn câu
       * model bật nhầm (GS-116 "rơi xuống vực thì gọi số nào", GS-143 hoàn tiền, GS-168 Ninh Bình,
       * GS-177 phương trình) và cả bốn bị chặn với lý do USER_REQUEST. Model vẫn điền trường này
       * trong lược đồ vì mô tả của nó giúp phân loại ý định `support`.
       */
      wantsHuman: asksForHuman(message),
    },
    metrics,
  };
}
