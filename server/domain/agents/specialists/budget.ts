import { CHAT_RESPONSE_SCHEMA } from "@server/domain/prompts";
import { cleanStringList, generateStructured } from "@server/infra/gemini";
import { estimateBudget } from "@server/domain/agents/tools";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";
import { checkNumericFacts, type EvidenceBlock } from "@server/domain/agents/grounding";
import { formatHistory, formatVnd, personaFor } from "./shared";

/**
 * Tác tử lập kế hoạch kinh phí — FR-BOT-04.
 *
 * Điểm mấu chốt: **mọi phép cộng đều do code thực hiện** trong server/domain/costs.ts, model chỉ nhận
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

  const reply = data?.reply?.trim() ?? "";

  /**
   * Đối chiếu từng con số tiền trong câu trả lời với bảng do code tính.
   *
   * Lời nhắc đã yêu cầu "giữ nguyên mọi con số, không làm tròn lại", nhưng một yêu cầu trong lời
   * nhắc chỉ là một mong muốn. Đây là chỗ biến nó thành ràng buộc kiểm được: bảng dự trù và bảng
   * giá phòng là chứng cứ, và mọi khoản tiền không khớp chứng cứ sẽ bị guardrail chặn thay vì đi
   * ra tới khách dưới dạng một con số trông rất chắc chắn.
   */
  const evidence: EvidenceBlock[] = [
    { id: "B1", kind: "knowledge", label: "Bảng dự trù do hệ thống tính", text: table, sourceRef: "costs:estimate" },
    ...(homestayBlock
      ? [{ id: "B2", kind: "knowledge" as const, label: "Giá phòng thật trong hệ thống", text: homestayBlock, sourceRef: "db:homestay" }]
      : []),
  ];
  const facts = checkNumericFacts(reply, evidence);

  return {
    reply,
    suggestions: cleanStringList(data?.suggestions, 4),
    grounding: facts.unsupported.length ? "unsupported" : "grounded",
    evidence,
    retrievedDocIds: [],
    citedDocIds: [],
    unsupportedFacts: facts.unsupported,
    slotUpdates: assumedDays ? {} : undefined,
    calls: [metrics],
  };
}
