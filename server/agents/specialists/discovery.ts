import { CHAT_RESPONSE_SCHEMA } from "../../prompts";
import { cleanStringList, generateStructured } from "../../gemini";
import { describeSlots } from "../dialog";
import { findDestinations, findDestinationsByName } from "../tools";
import type { AgentContext, AgentResult } from "../types";
import { formatHistory, personaFor } from "./shared";

/**
 * Tác tử tư vấn tìm điểm đến — FR-BOT-02 trong bối cảnh Hà Giang.
 *
 * Thứ tự bắt buộc theo SRS Mục 10.4 bước 8-12: truy vấn Destination trước, rồi mới đưa danh sách
 * thật đó cho model diễn đạt. Model không được thêm điểm đến nào ngoài danh sách này.
 */
export async function runDiscovery(context: AgentContext): Promise<AgentResult> {
  const { slots } = context;

  // Khách có nhắc địa danh cụ thể thì ưu tiên khớp tên; không thì lọc theo phong cách đã thu thập.
  const named = await findDestinationsByName(slots.destinations ?? []);
  const rows = named.length
    ? named
    : await findDestinations({
        categories:
          slots.vibe === "culture"
            ? ["culture", "homestay"]
            : slots.vibe === "adventure"
              ? ["pass", "viewpoint"]
              : slots.vibe === "chill"
                ? ["nature", "waterfall", "homestay"]
                : undefined,
        limit: 6,
      });

  const catalogue = rows
    .map((row) =>
      [
        `### ${row.vietnameseName} (${row.name})`,
        `- Huyện: ${row.district}`,
        `- Độ cao: ${row.elevation} m · Cách TP Hà Giang: ${row.distanceFromStart} km`,
        `- Độ khó: ${row.difficulty} · Nên dành: ${row.recommendedStayHours} giờ`,
        `- Thời điểm đẹp: ${row.bestTime}`,
        `- Điểm nhấn: ${row.highlights.join("; ")}`,
        `- Món nên thử: ${row.localFood.join("; ")}`,
        `- Lưu ý an toàn: ${row.safetyTip}`,
      ].join("\n"),
    )
    .join("\n\n");

  const { data, metrics } = await generateStructured<{ reply: string; suggestions: string[] }>({
    tier: "light",
    systemInstruction: personaFor(
      "gợi ý điểm đến phù hợp, giải thích ngắn gọn VÌ SAO mỗi điểm hợp với nhu cầu khách",
    ),
    temperature: 0.7,
    schema: CHAT_RESPONSE_SCHEMA,
    contents: `Nhu cầu khách đã cung cấp:
${describeSlots(slots)}

Câu hỏi lượt này: ${context.message}${formatHistory(context.history)}

DANH SÁCH ĐIỂM ĐẾN THẬT TRONG HỆ THỐNG (chỉ được nói về những điểm dưới đây):
${catalogue || "Không có điểm đến nào khớp."}`,
  });

  return {
    reply: data?.reply?.trim() ?? "",
    suggestions: cleanStringList(data?.suggestions, 4),
    grounded: rows.length > 0,
    citedDocIds: rows.map((row) => `destination:${row.slug}`),
    calls: [metrics],
  };
}
