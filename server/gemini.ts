import { GoogleGenAI } from "@google/genai";
import type { Content, Schema } from "@google/genai";
import type { Response } from "express";
import { config, hasGeminiCredentials } from "./config";

/**
 * Cửa duy nhất đi ra Gemini. Trước Vòng 5, client và các hàm tiện ích này nằm ngay trong
 * server.ts; giờ có bốn nơi cần dùng (NLU, năm tác tử, sinh lịch trình, embedder) nên tách ra
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

export function safeJsonParse(raw: string | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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

  const response = await ai.models.generateContent({
    model,
    contents: call.contents,
    config: {
      ...(call.systemInstruction ? { systemInstruction: call.systemInstruction } : {}),
      temperature: call.temperature ?? 0.7,
      responseMimeType: "application/json",
      responseSchema: call.schema,
    },
  });

  return {
    data: safeJsonParse(response.text) as T | null,
    metrics: {
      model,
      latencyMs: Date.now() - startedAt,
      promptTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    },
  };
}
