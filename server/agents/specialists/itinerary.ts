import { generateItinerary } from "../../itineraryCore";
import { findDestinationsByName } from "../tools";
import type { AgentContext, AgentResult } from "../types";

/**
 * Tác tử tạo lịch trình tự do — FR-BOT-03.
 *
 * KHÔNG viết prompt mới: dùng lại buildItineraryPrompt và ITINERARY_RESPONSE_SCHEMA đã có từ
 * trước qua server/itineraryCore.ts. Việc của tác tử chỉ là map slot hội thoại sang
 * ItineraryRequest và tóm tắt kết quả thành văn nói.
 *
 * Chạy ở tầng model mạnh theo SRS Mục 11.4.5 (dựng lịch trình là suy luận nhiều bước).
 * Câu trả lời được dựng bằng code từ chính lịch trình vừa sinh, nên không tốn thêm một lượt gọi
 * model chỉ để diễn đạt — giữ lượt này trong ngân sách 3 giây của NFR-PERF-03.
 */
export async function runItinerary(context: AgentContext): Promise<AgentResult> {
  const { slots } = context;

  // Địa danh khách nhắc được đưa vào ghi chú để lịch trình ưu tiên, giống cách plannerFocus mồi
  // ghi chú ở ItineraryPlanner từ Vòng 1.
  const named = await findDestinationsByName(slots.destinations ?? []);
  const notes = [
    named.length ? `Ưu tiên dành thời gian cho: ${named.map((r) => r.vietnameseName).join(", ")}` : "",
    slots.travelers ? `Đoàn ${slots.travelers} người.` : "",
    slots.month ? `Dự kiến đi vào tháng ${slots.month}.` : "",
    slots.notes ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const { plan, metrics } = await generateItinerary({
    days: slots.days ?? 3,
    travelMode: slots.travelMode ?? "motorbike",
    vibe: slots.vibe ?? "photography",
    budget: slots.budgetLevel ?? "comfort",
    notes: notes.slice(0, 1000),
  });

  const dayLines = (plan.days as any[])
    .map(
      (day) =>
        `- **Ngày ${day.day} — ${day.title}**: ${day.startPoint} → ${day.endPoint}, ` +
        `${day.totalDistanceKm} km, khoảng ${day.ridingHours} giờ lái. Nghỉ tại ${day.eveningStay?.name} ` +
        `(${day.eveningStay?.priceEstimate}).`,
    )
    .join("\n");

  const reply = [
    `## ${plan.title}`,
    "",
    plan.overview,
    "",
    `**Tổng quãng đường:** ${plan.totalKm} km · **Số ngày:** ${plan.days.length}`,
    "",
    dayLines,
    "",
    Array.isArray(plan.dailyTips) && plan.dailyTips.length
      ? `**Mẹo cho cả hành trình:**\n${plan.dailyTips.map((tip: string) => `- ${tip}`).join("\n")}`
      : "",
    "",
    "Lịch trình này là gợi ý tham khảo — bạn có thể mở trình lập lịch trình để chỉnh từng ngày và lưu lại.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return {
    reply,
    suggestions: [
      "Dự trù chi phí cho lịch trình này giúp mình",
      "Đổi thành lịch trình nhẹ nhàng hơn được không?",
      "Ngày nào là chặng khó lái nhất?",
      "Gợi ý homestay dọc cung đường này",
    ],
    grounded: true,
    citedDocIds: named.map((row) => `destination:${row.slug}`),
    calls: [metrics],
    itinerary: plan,
    slotUpdates: slots.days ? undefined : { days: 3 },
  };
}
