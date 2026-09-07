import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { generateStructured, type CallMetrics } from "../gemini";
import { INTENTS, type Intent, type NluResult, type Slots } from "./types";

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
      description: "True khi khách yêu cầu gặp nhân viên thật, hoặc đang khiếu nại/gặp sự cố khẩn.",
    },
    destinations: {
      type: Type.ARRAY,
      description: "Tên địa danh khách nhắc tới, giữ nguyên cách khách viết.",
      items: { type: Type.STRING },
    },
    days: { type: Type.INTEGER, description: "Số ngày của chuyến đi, 0 nếu khách chưa nói." },
    travelers: { type: Type.INTEGER, description: "Số người đi, 0 nếu khách chưa nói." },
    month: { type: Type.INTEGER, description: "Tháng dự kiến đi, 1-12, 0 nếu chưa nói." },
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
  required: ["intent", "confidence", "wantsHuman", "destinations", "days", "travelers", "month"],
};

const NLU_INSTRUCTION = `Bạn là bộ phân loại ý định của trợ lý du lịch Hà Giang. Chỉ phân loại và trích xuất, KHÔNG trả lời khách.

Năm ý định:
- discovery: khách muốn tìm/gợi ý điểm đến phù hợp ("nên đi đâu", "chỗ nào đẹp", "gợi ý vài điểm").
- itinerary: khách muốn một lịch trình theo ngày ("lên lịch trình 3 ngày", "đi 4 ngày thì sắp xếp sao").
- budget: khách hỏi chi phí, ngân sách, hết bao nhiêu tiền. CHỈ chọn khi khách hỏi rõ về tiền.
- knowledge: hỏi thông tin — địa danh, văn hoá, ẩm thực, thời tiết, đường đèo, an toàn, thủ tục, kinh nghiệm.
- support: khiếu nại, sự cố, yêu cầu gặp người thật, hoặc câu hoàn toàn ngoài phạm vi du lịch Hà Giang.

Quy tắc quan trọng:
- budget và giới thiệu địa danh chỉ được chọn khi khách hỏi rõ ràng, không suy diễn hộ khách.
- confidence phải thấp (dưới 0.5) khi câu nói mơ hồ, cụt, hoặc có thể thuộc nhiều ý định.
- Chỉ trích xuất thực thể khách NÓI RA ở lượt này. Không bịa, không lấy từ giả định.
- Trường số dùng 0 và trường chuỗi dùng "" khi khách chưa cung cấp.`;

interface NluRaw {
  intent: string;
  confidence: number;
  wantsHuman: boolean;
  destinations: string[];
  days: number;
  travelers: number;
  month: number;
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

export interface NluOutcome {
  result: NluResult;
  metrics: CallMetrics;
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

  const { data, metrics } = await generateStructured<NluRaw>({
    tier: "light",
    systemInstruction: NLU_INSTRUCTION,
    temperature: 0,
    schema: NLU_SCHEMA,
    contents: recent
      ? `Bối cảnh vài lượt gần nhất:\n${recent}\n\nLượt mới của khách: ${message}`
      : `Lượt mới của khách: ${message}`,
  });

  // Model trả JSON hỏng thì coi như không hiểu — confidence 0 sẽ đẩy sang chuyển tiếp ở
  // orchestrator, đúng hành vi mong muốn thay vì đoán một ý định bất kỳ.
  if (!data) {
    return {
      result: { intent: "support", confidence: 0, entities: {}, wantsHuman: false },
      metrics,
    };
  }

  const entities: Slots = {};
  const destinations = Array.isArray(data.destinations)
    ? data.destinations.filter((name) => typeof name === "string" && name.trim()).map((n) => n.trim())
    : [];
  if (destinations.length) entities.destinations = destinations;

  const days = positive(data.days, 14);
  if (days) entities.days = days;

  const travelers = positive(data.travelers, 40);
  if (travelers) entities.travelers = travelers;

  const month = positive(data.month, 12);
  if (month) entities.month = month;

  const budgetLevel = pickEnum(data.budgetLevel, ["backpacker", "comfort", "luxury"] as const);
  if (budgetLevel) entities.budgetLevel = budgetLevel;

  const travelMode = pickEnum(data.travelMode, ["motorbike", "easy_rider", "car_suv"] as const);
  if (travelMode) entities.travelMode = travelMode;

  const vibe = pickEnum(data.vibe, ["photography", "culture", "adventure", "chill"] as const);
  if (vibe) entities.vibe = vibe;

  const intent = (INTENTS.includes(data.intent as Intent) ? data.intent : "knowledge") as Intent;
  const confidence = Number.isFinite(data.confidence)
    ? Math.min(1, Math.max(0, data.confidence))
    : 0;

  return {
    result: { intent, confidence, entities, wantsHuman: data.wantsHuman === true },
    metrics,
  };
}
