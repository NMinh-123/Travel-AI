import { generateItinerary } from "@server/domain/itinerary";
import { describeTemporal } from "@server/domain/temporal/router";
import { findDestinationsByName } from "@server/domain/agents/tools";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";
import type { GeneratedStay } from "@server/domain/itineraryCheck";

/**
 * Tác tử tạo lịch trình tự do — FR-BOT-03.
 *
 * KHÔNG viết prompt mới: dùng lại buildItineraryPrompt và ITINERARY_RESPONSE_SCHEMA đã có từ
 * trước qua server/domain/itinerary.ts. Việc của tác tử chỉ là map slot hội thoại sang
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
    slots.temporal ? describeTemporal(slots.temporal) : "",
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
    // Khách đã nói số người thì bảng chi phí phải tính cho đúng số đó. Bỏ qua slot này là lý do
    // một đoàn 4 người từng nhận về dự trù của một người.
    travelers: slots.travelers,
  });

  /**
   * Chỗ nghỉ chỉ hiện khi thực sự có.
   *
   * Bản trước nội suy thẳng `day.eveningStay?.name` vào câu, nên hai giá trị rác lọt ra tận mặt
   * khách: `undefined` khi model bỏ trống nhánh đó, và chuỗi `"N/A"` khi model tự điền chỗ trống
   * theo thói quen. Ngày cuối của một vòng cung luôn kết thúc ở điểm xuất phát nên KHÔNG có đêm
   * nghỉ — đó là trạng thái hợp lệ, không phải dữ liệu thiếu, và câu chữ phải phản ánh đúng vậy.
   */
  /**
   * LUẬT CẤU TRÚC: lịch trình N ngày chỉ có N−1 đêm nghỉ.
   *
   * Ngày cuối là ngày kết thúc hành trình nên không có đêm nghỉ — nếu khách ngủ thêm một đêm nữa
   * thì đó đã là lịch trình N+1 ngày. Điều này khớp đúng cách người Việt nói: "3 ngày 2 đêm".
   *
   * Vì sao dùng luật cấu trúc thay vì lọc chuỗi canh. Bản trước in thẳng `day.eveningStay?.name`
   * nên `undefined` lọt ra mặt khách; vá bằng cách chặn chuỗi `"N/A"` thì model đổi sang viết
   * `"Không áp dụng"`, và mọi lần vá tiếp theo cũng sẽ chỉ đuổi theo được đúng cách viết vừa gặp.
   * Ngày cuối không có đêm nghỉ là một SỰ THẬT về hình dạng lịch trình, biết được mà không cần
   * hỏi model — nên quyết định ở đây, không đọc từ đó.
   *
   * Bộ lọc chuỗi canh vẫn giữ làm lớp hai, cho trường hợp model bỏ trống một ngày ở giữa.
   */
  const PLACEHOLDER = /^(n\/?a|khong ap dung|khong co|chua xac dinh|tbd|-{1,2})$/i;

  const isPlaceholder = (value: unknown): boolean => {
    if (typeof value !== "string") return true;
    const plain = value
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d");
    return !plain || PLACEHOLDER.test(plain);
  };

  const stayLabel = (stay: GeneratedStay, isLastDay: boolean): string => {
    if (isLastDay) return "Kết thúc hành trình, không nghỉ đêm.";
    if (isPlaceholder(stay?.name)) return "Chỗ nghỉ chưa chốt.";

    const price = stay?.priceEstimate;
    // Giá do model đưa ra là ƯỚC LƯỢNG chứ không phải giá niêm yết — nói rõ để khách không đọc nó
    // như một cam kết. Xem ghi chú ở `PriceEstimate` trong @data/places/types.
    return isPlaceholder(price)
      ? `Nghỉ tại ${String(stay.name).trim()}.`
      : `Nghỉ tại ${String(stay.name).trim()} (giá tham khảo ${String(price).trim()}).`;
  };

  const days = plan.days;
  const { validation, cost } = plan;

  const costLine =
    `**Dự trù chi phí (do hệ thống tính, một người):** ${cost.breakdown.perPerson.total.toLocaleString("vi-VN")}đ. ` +
    cost.assumptions.join(" ");

  const unverified = validation.routes.filter((route) => !route.verified);
  const warnings = [
    validation.valid
      ? ""
      : `Hệ thống chưa kiểm hết được lịch trình này — còn ${validation.issues.length} điểm vướng, ví dụ: ${validation.issues[0].message}`,
    unverified.length
      ? `Quãng đường các chặng ${unverified.map((route) => `${route.from} → ${route.to}`).join("; ")} chưa đối chiếu được với dữ liệu tuyến đường, hãy xem đó là ước lượng.`
      : "",
  ].filter(Boolean);
  const warningLine = warnings.length ? `> ${warnings.join(" ")}
` : "";

  const dayLines = days
    .map(
      (day, index) =>
        `- **Ngày ${day.day} — ${day.title}**: ${day.startPoint} → ${day.endPoint}, ` +
        `${day.totalDistanceKm} km, khoảng ${day.ridingHours} giờ lái. ` +
        stayLabel(day.eveningStay, index === days.length - 1),
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
    plan.dailyTips.length
      ? `**Mẹo cho cả hành trình:**\n${plan.dailyTips.map((tip) => `- ${tip}`).join("\n")}`
      : "",
    "",
    costLine,
    "",
    /**
     * PHẦN CHƯA XÁC MINH PHẢI ĐƯỢC NÓI RA.
     *
     * Bộ kiểm tra bằng code có thể còn sót lỗi sau các lượt sửa, và bảng chặng khung không phủ hết
     * mọi cung đường. Cả hai đều là trạng thái hợp lệ, nhưng im lặng về chúng thì khách đọc một
     * lịch trình chưa kiểm xong như một lịch trình đã kiểm xong.
     */
    warningLine,
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
    grounding: "grounded",
    evidence: [],
    retrievedDocIds: named.map((row) => `destination:${row.slug}`),
    citedDocIds: named.map((row) => `destination:${row.slug}`),
    calls: [metrics],
    itinerary: plan,
    slotUpdates: slots.days ? undefined : { days: 3 },
  };
}
