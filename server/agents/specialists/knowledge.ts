import { CHAT_RESPONSE_SCHEMA } from "../../prompts";
import { cleanStringList, generateStructured } from "../../gemini";
import { retrieve } from "../../rag/retrieval";
import { getPassWeather } from "../tools";
import type { AgentContext, AgentResult } from "../types";
import { formatHistory, personaFor } from "./shared";

/**
 * Tác tử giới thiệu địa danh & FAQ — FR-BOT-01 và FR-BOT-05. Đây là tác tử duy nhất dùng RAG.
 *
 * Ranh giới của SRS Mục 11.4: RAG chỉ phục vụ tri thức dạng văn bản đã kiểm duyệt (chính sách,
 * thủ tục, FAQ, mô tả điểm đến). Số liệu thời tiết đèo KHÔNG đi qua RAG mà lấy trực tiếp qua tool
 * layer, vì đó là dữ liệu có thể đổi và phải luôn tươi.
 *
 * Khi hybrid search không trả về đoạn nào, tác tử KHÔNG gọi model. Trả `grounded: false` để
 * orchestrator chuyển tiếp — đúng trigger "câu hỏi nằm ngoài phạm vi kho tri thức" của Mục 10.6.
 * Đây là chỗ ngăn "ảo giác" hiệu quả nhất trong toàn hệ thống: không có căn cứ thì không nói.
 */

const WEATHER_HINTS = /thời tiết|thoi tiet|sương|suong|mưa|mua|nhiệt độ|nhiet do|lạnh|gió|gio|mù/i;

export async function runKnowledge(context: AgentContext): Promise<AgentResult> {
  // placeSlugs do orchestrator phân giải. Rỗng thì retrieve() bỏ qua bộ lọc địa danh, nên câu hỏi
  // không nêu nơi cụ thể vẫn thấy toàn bộ kho.
  const { chunks, metrics: retrieval } = await retrieve(context.message, {
    finalLimit: 5,
    placeSlugs: context.placeSlugs,
  });

  if (chunks.length === 0) {
    return {
      reply: "",
      suggestions: [],
      grounded: false,
      citedDocIds: [],
      calls: [],
      retrieval,
    };
  }

  // Câu hỏi có nhắc thời tiết thì kèm bảng quan trắc theo mùa, lấy thẳng từ DB.
  const weather = WEATHER_HINTS.test(context.message) ? await getPassWeather() : [];
  const weatherBlock = weather.length
    ? `\n\nĐIỀU KIỆN THAM KHẢO THEO MÙA TẠI CÁC ĐỈNH ĐÈO (số liệu tham khảo, KHÔNG phải quan trắc thời gian thực — phải nói rõ điều này với khách):
${weather
        .map(
          (row) =>
            `- ${row.location} (${row.elevation} m): ${row.temp}°C, ${row.condition}, gió ${row.windSpeedKm} km/h, ${row.fogLevel}, đường ${row.roadStatus}`,
        )
        .join("\n")}`
    : "";

  const knowledgeBlock = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.content}`)
    .join("\n\n");

  const { data, metrics } = await generateStructured<{ reply: string; suggestions: string[] }>({
    tier: "light",
    systemInstruction: personaFor(
      "trả lời câu hỏi của khách CHỈ dựa trên các đoạn tri thức đã kiểm duyệt được cung cấp",
    ),
    temperature: 0.6,
    schema: CHAT_RESPONSE_SCHEMA,
    contents: `Câu hỏi của khách: ${context.message}${formatHistory(context.history)}

TRI THỨC ĐÃ KIỂM DUYỆT (nguồn duy nhất được phép dùng):
${knowledgeBlock}${weatherBlock}

Nếu các đoạn trên không chứa câu trả lời, hãy nói rõ là bạn chưa có thông tin đó thay vì suy đoán.`,
  });

  const reply = data?.reply?.trim() ?? "";

  return {
    reply,
    suggestions: cleanStringList(data?.suggestions, 4),
    grounded: reply.length > 0,
    citedDocIds: chunks.map((chunk) => chunk.id),
    calls: [metrics],
    retrieval,
  };
}
