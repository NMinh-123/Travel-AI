import { CHAT_RESPONSE_SCHEMA } from "../../prompts";
import { cleanStringList, generateStructured } from "../../gemini";
import { estimateBudget } from "../tools";
import type { AgentContext, AgentResult } from "../types";
import { formatHistory, formatVnd, personaFor } from "./shared";

/**
 * Tác tử lập kế hoạch kinh phí — FR-BOT-04.
 *
 * Điểm mấu chốt: **mọi phép cộng đều do code thực hiện** trong server/costs.ts, model chỉ nhận
 * bảng kết quả và diễn đạt lại. Nhờ vậy con số chatbot đưa ra luôn khớp chính xác với máy tính
 * chi phí ở tab Cẩm nang, và không có đường nào để model tự bịa một con số.
 *
 * SRS Hình 10.5 ghi chú rằng bảng dự trù phải được trình bày rõ là ước tính tham khảo, không phải
 * báo giá cam kết — yêu cầu đó nằm trong system instruction bên dưới.
 */
export async function runBudget(context: AgentContext): Promise<AgentResult> {
  const { breakdown, homestayPrices, assumedDays } = await estimateBudget(context.slots);
  const { perPerson } = breakdown;

  const table = [
    `- Thuê xe / Easy Rider (${breakdown.days} ngày): ${formatVnd(perPerson.bike)}`,
    perPerson.fuel > 0 ? `- Xăng xe (${breakdown.days} ngày): ${formatVnd(perPerson.fuel)}` : null,
    `- Lưu trú (${breakdown.nights} đêm, kiểu ${breakdown.stayStyle}): ${formatVnd(perPerson.stay)}`,
    `- Ăn uống (${breakdown.days} ngày): ${formatVnd(perPerson.food)}`,
    `- Vé tham quan (cả chuyến): ${formatVnd(perPerson.tickets)}`,
    `- Xe khách Hà Nội - Hà Giang khứ hồi: ${formatVnd(perPerson.bus)}`,
    `- TỔNG MỘT NGƯỜI: ${formatVnd(perPerson.total)}`,
    breakdown.travelers > 1
      ? `- TỔNG CẢ ĐOÀN (${breakdown.travelers} người): ${formatVnd(breakdown.groupTotal)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const homestayBlock = homestayPrices
    .map((row) => `- ${row.name} (${row.location}): ${formatVnd(row.pricePerNight)}/đêm`)
    .join("\n");

  const { data, metrics } = await generateStructured<{ reply: string; suggestions: string[] }>({
    tier: "strong",
    systemInstruction: personaFor(
      "trình bày bảng dự trù chi phí đã được hệ thống tính sẵn, kèm vài mẹo tối ưu chi phí. " +
        "BẮT BUỘC nói rõ đây là ước tính tham khảo theo mặt bằng giá 09/2026, không phải báo giá cam kết. " +
        "TUYỆT ĐỐI giữ nguyên mọi con số dưới đây, không làm tròn lại, không tự cộng thêm khoản nào.",
    ),
    temperature: 0.5,
    schema: CHAT_RESPONSE_SCHEMA,
    contents: `Câu hỏi của khách: ${context.message}${formatHistory(context.history)}

BẢNG DỰ TRÙ DO HỆ THỐNG TÍNH (giữ nguyên từng con số):
${table}
${assumedDays ? "\nLƯU Ý: khách chưa nói số ngày, hệ thống tạm tính 3 ngày — hãy nói rõ giả định này và mời khách điều chỉnh." : ""}

GIÁ PHÒNG THẬT CỦA CÁC HOMESTAY ĐANG CÓ TRONG HỆ THỐNG (dùng để đối chiếu, giá tham khảo chưa nối hệ thống đặt phòng):
${homestayBlock}`,
  });

  return {
    reply: data?.reply?.trim() ?? "",
    suggestions: cleanStringList(data?.suggestions, 4),
    grounded: true,
    citedDocIds: [],
    slotUpdates: assumedDays ? {} : undefined,
    calls: [metrics],
  };
}
