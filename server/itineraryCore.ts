import { config } from "./config";
import { AiUnavailableError, getGeminiClient, safeJsonParse, type CallMetrics } from "./gemini";
import {
  ITINERARY_RESPONSE_SCHEMA,
  buildItineraryPrompt,
  type ItineraryRequest,
} from "./prompts";

/**
 * Lõi sinh lịch trình, dùng chung cho HAI đường vào: endpoint /api/plan-itinerary của trình lập
 * lịch trình, và tác tử itinerary trong luồng hội thoại (FR-BOT-03).
 *
 * Tách ra thành module riêng ở Vòng 5 vì trước đó logic này nằm inline trong server.ts. Hai bản
 * sao của cùng một lời gọi model là cách chắc chắn để hai đường vào dần trả về hai kết quả khác
 * nhau cho cùng một yêu cầu.
 */

export class ItineraryGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItineraryGenerationError";
  }
}

export interface ItineraryOutcome {
  plan: any;
  metrics: CallMetrics;
}

export async function generateItinerary(request: ItineraryRequest): Promise<ItineraryOutcome> {
  const ai = getGeminiClient();
  if (!ai) throw new AiUnavailableError();

  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: buildItineraryPrompt(request),
    config: {
      responseMimeType: "application/json",
      responseSchema: ITINERARY_RESPONSE_SCHEMA,
      temperature: 0.6,
    },
  });

  const plan = safeJsonParse(response.text);
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
    throw new ItineraryGenerationError("Trợ lý AI không tạo được lịch trình hợp lệ");
  }

  // Waypoint id do server gán để ổn định và không tốn token của model.
  for (const day of plan.days) {
    if (!Array.isArray(day?.waypoints)) continue;
    day.waypoints = day.waypoints.map((waypoint: any, index: number) => ({
      ...waypoint,
      id: `d${day.day}-w${index + 1}`,
      day: day.day,
    }));
  }

  return {
    plan,
    metrics: {
      model: config.geminiModel,
      latencyMs: Date.now() - startedAt,
      promptTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    },
  };
}
