import { CHAT_RESPONSE_SCHEMA } from "@server/domain/prompts";
import { cleanStringList, generateStructured } from "@server/infra/gemini";
import { describeSlots } from "@server/domain/agents/dialog";
import { findDestinations, findDestinationsByName } from "@server/domain/agents/tools";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";
import type { EvidenceBlock } from "@server/domain/agents/grounding";
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

  /**
   * Mỗi điểm đến là một khối chứng cứ riêng, và lời nhắc chỉ là các khối đó nối lại.
   *
   * Dựng theo thứ tự này chứ không cắt ngược từ chuỗi đã nối, vì khi cắt ngược thì ranh giới giữa
   * các khối phụ thuộc vào dấu xuống dòng trong chính nội dung — một mô tả có dòng trống là đủ
   * làm lệch toàn bộ danh sách chứng cứ mà không có gì báo.
   */
  const entries: EvidenceBlock[] = rows.map((row, index) => ({
    id: `D${index + 1}`,
    kind: "knowledge",
    label: row.vietnameseName,
    sourceRef: `destination:${row.slug}`,
    text: [
      `### ${row.vietnameseName} (${row.name})`,
      `- Huyện: ${row.district}`,
      `- Độ cao: ${row.elevation} m · Cách TP Hà Giang: ${row.distanceFromStart} km`,
      `- Độ khó: ${row.difficulty} · Nên dành: ${row.recommendedStayHours} giờ`,
      `- Thời điểm đẹp: ${row.bestTime}`,
      `- Điểm nhấn: ${row.highlights.join("; ")}`,
      `- Món nên thử: ${row.localFood.join("; ")}`,
      `- Lưu ý an toàn: ${row.safetyTip}`,
    ].join("\n"),
  }));

  const catalogue = entries.map((entry) => entry.text).join("\n\n");

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
    grounding: rows.length > 0 ? "grounded" : "no_source",
    evidence: entries,
    retrievedDocIds: rows.map((row) => `destination:${row.slug}`),
    citedDocIds: rows.map((row) => `destination:${row.slug}`),
    calls: [metrics],
  };
}
