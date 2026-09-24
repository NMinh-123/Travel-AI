import { CHAT_RESPONSE_SCHEMA } from "@server/domain/prompts";
import { cleanStringList } from "@server/infra/gemini";
import { estimateBudget } from "@server/domain/agents/tools";
import type { AgentContext, AgentResult } from "@server/domain/agents/types";
import { checkNumericFacts, extractFacts, type EvidenceBlock } from "@server/domain/agents/grounding";
import { formatHistory, formatVnd, generateReply, personaFor } from "./shared";

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
  const table = formatTable(breakdown);

  const stated = describeStatedBudget(context.message, breakdown.travelers, breakdown.groupTotal);
  const budgetBlock = stated?.text ?? null;

  /**
   * Ngân sách khách nêu không đủ thì code tính luôn PHƯƠNG ÁN TIẾT KIỆM (mức backpacker).
   *
   * Không có bảng này, model tự dựng phương án rẻ hơn bằng cách chia nhân các khoản — "600.000đ cho
   * 2 ngày, tức 300.000đ/ngày" — và guardrail chặn đúng những con số tự tính ấy. Đưa sẵn bảng thật
   * thì model có con số để nói mà không phải tính.
   */
  const thrift =
    stated && stated.groupBudget < breakdown.groupTotal && context.slots.budgetLevel !== "backpacker"
      ? (await estimateBudget({ ...context.slots, budgetLevel: "backpacker" })).breakdown
      : null;
  const thriftTable = thrift && thrift.groupTotal < breakdown.groupTotal ? formatTable(thrift) : null;

  const homestayBlock = homestayPrices
    .map((row) => `- ${row.name} (${row.location}): ${formatVnd(row.pricePerNight)}/đêm`)
    .join("\n");

  const { data, metrics } = await generateReply<{ reply: string; suggestions: string[] }>(context, {
    tier: "strong",
    systemInstruction: personaFor(
      "trình bày bảng dự trù chi phí đã được hệ thống tính sẵn, kèm vài mẹo tối ưu chi phí. " +
        "BẮT BUỘC nói rõ đây là ước tính tham khảo theo mặt bằng giá 09/2026, không phải báo giá cam kết. " +
        "TUYỆT ĐỐI giữ nguyên mọi con số dưới đây, không làm tròn lại, không tự cộng thêm khoản nào. " +
        "KHÔNG tự nhân, chia hay tính ra con số mới (kể cả tiền mỗi ngày); mẹo tối ưu chỉ dùng con số " +
        "có sẵn bên dưới hoặc nói bằng lời.",
    ),
    temperature: 0.5,
    schema: CHAT_RESPONSE_SCHEMA,
    contents: `Câu hỏi của khách: ${context.message}${formatHistory(context.history)}

BẢNG DỰ TRÙ DO HỆ THỐNG TÍNH (giữ nguyên từng con số):
${table}
${assumedDays ? "\nLƯU Ý: khách chưa nói số ngày, hệ thống tạm tính 3 ngày — hãy nói rõ giả định này và mời khách điều chỉnh." : ""}
${budgetBlock ? `\nĐỐI CHIẾU VỚI NGÂN SÁCH KHÁCH NÊU (do hệ thống tính, giữ nguyên từng con số):\n${budgetBlock}\n` : ""}
${thriftTable ? `\nPHƯƠNG ÁN TIẾT KIỆM DO HỆ THỐNG TÍNH (mức backpacker, giữ nguyên từng con số):\n${thriftTable}\n` : ""}

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
    ...(budgetBlock
      ? [{ id: "B3", kind: "knowledge" as const, label: "Đối chiếu với ngân sách khách nêu", text: budgetBlock, sourceRef: "costs:estimate" }]
      : []),
    ...(thriftTable
      ? [{ id: "B4", kind: "knowledge" as const, label: "Phương án tiết kiệm do hệ thống tính", text: thriftTable, sourceRef: "costs:estimate" }]
      : []),
    ...(homestayBlock
      ? [{ id: "B2", kind: "knowledge" as const, label: "Giá phòng thật trong hệ thống", text: homestayBlock, sourceRef: "db:homestay" }]
      : []),
  ];
  const derived = derivedAmounts(
    [table, budgetBlock, thriftTable].filter((text): text is string => Boolean(text)).join("\n"),
    [breakdown.days, breakdown.nights, breakdown.travelers],
  );
  // Phép suy ra chỉ dùng để KIỂM, không trả về trong `evidence`: nó không phải một nguồn để trích dẫn.
  const facts = checkNumericFacts(reply, [
    ...evidence,
    { id: "B5", kind: "knowledge", label: "Phép tính suy ra từ bảng", text: derived, sourceRef: "costs:estimate" },
  ]);

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

/**
 * NGÂN SÁCH KHÁCH TỰ NÊU — "Ngân sách 5 triệu".
 *
 * Con số khách nói không nằm trong bảng dự trù, nên trước đây mọi câu trả lời nhắc lại nó, hay
 * chia nó theo đầu người, đều bị `checkNumericFacts` coi là bịa và guardrail chặn cả lượt (GS-199
 * trượt hai trên ba lần chạy). Code tính sẵn các con số để model chỉ việc diễn đạt, đúng nguyên
 * tắc của tác tử này: mọi phép tính do code làm.
 *
 * Không có chữ "mỗi người"/"một người" thì hiểu là ngân sách của cả đoàn.
 */
export function describeStatedBudget(
  message: string,
  travelers: number,
  groupTotal: number,
): { text: string; groupBudget: number } | null {
  const stated = extractFacts(message).find((fact) => fact.group === "money");
  if (!stated) return null;
  const perPerson = /(mỗi|một|1)\s*người/iu.test(message);
  const group = perPerson ? stated.max * travelers : stated.max;
  const gap = group - groupTotal;
  const text = [
    `- Ngân sách khách nêu${perPerson ? " (mỗi người)" : " (cả đoàn)"}: ${formatVnd(stated.max)}`,
    travelers > 1
      ? `- Quy ra cả đoàn ${travelers} người: ${formatVnd(group)}, tức ${formatVnd(Math.round(group / travelers))} mỗi người`
      : null,
    `- ${gap >= 0 ? "Dư" : "Thiếu"} so với dự trù cả đoàn: ${formatVnd(Math.abs(gap))}` +
      (travelers > 1 ? `, tức ${formatVnd(Math.round(Math.abs(gap) / travelers))} mỗi người` : ""),
  ]
    .filter(Boolean)
    .join("\n");
  return { text, groupBudget: group };
}

/**
 * Những khoản tiền SUY RA ĐƯỢC bằng đúng một phép tính từ bảng do code tính.
 *
 * Cấm model tính trong lời nhắc không giữ được: đo 8 lượt trên GS-199, 5 lượt vẫn viết "thiếu
 * 3.640.000đ" (8.640.000đ − 5.000.000đ), "tiết kiệm 300.000đ" (450.000đ − 150.000đ) hay
 * "300.000đ/ngày" (600.000đ / 2 ngày), và guardrail chặn cả lượt dù mọi con số đều đúng. Nên chấp
 * nhận hiệu của hai khoản, và một khoản nhân hoặc chia cho số ngày, số đêm, số người. Con số không
 * suy ra được từ bảng thì vẫn bị chặn như cũ.
 *
 * ponytail: chấp nhận mọi cặp hiệu, nên một con số bịa trùng ngẫu nhiên với một hiệu nào đó sẽ lọt;
 * nếu eval thấy lọt, thu hẹp về các cặp cùng dòng hoặc cùng khoản.
 */
export function derivedAmounts(tables: string, counts: number[]): string {
  const amounts = [...new Set(extractFacts(tables).filter((fact) => fact.group === "money").map((fact) => fact.max))];
  const values = new Set<number>();
  for (const a of amounts) {
    for (const n of counts) {
      if (n > 1) values.add(Math.round(a / n)).add(a * n);
    }
    for (const b of amounts) if (a > b) values.add(a - b);
  }
  return [...values].map((value) => `- ${formatVnd(value)}`).join("\n");
}

/**
 * Bảng dự trù; đoàn nhiều người thì ghi sẵn cả tiền CẢ ĐOÀN cho từng khoản.
 *
 * Bảng chỉ có giá mỗi người thì model tự nhân lên cho đoàn — "200.000đ/người x 4 = 800.000đ" — và
 * mọi tích đó đều không có trong chứng cứ nên guardrail chặn cả lượt (GS-199, lượt "Ngân sách 5
 * triệu" cho đoàn 4 người). Phép nhân phải do code làm, như mọi phép tính khác của tác tử này.
 */
function formatTable(breakdown: Awaited<ReturnType<typeof estimateBudget>>["breakdown"]): string {
  const { perPerson, travelers } = breakdown;
  const item = (label: string, amount: number) =>
    `- ${label}: ${formatVnd(amount)}` + (travelers > 1 ? ` mỗi người, cả đoàn ${formatVnd(amount * travelers)}` : "");
  return [
    item(`Thuê xe / Easy Rider (${breakdown.days} ngày)`, perPerson.bike),
    perPerson.fuel > 0 ? item(`Xăng xe (${breakdown.days} ngày)`, perPerson.fuel) : null,
    item(`Lưu trú (${breakdown.nights} đêm, kiểu ${breakdown.stayStyle})`, perPerson.stay),
    item(`Ăn uống (${breakdown.days} ngày)`, perPerson.food),
    item("Vé tham quan (cả chuyến)", perPerson.tickets),
    item("Xe khách Hà Nội - Hà Giang khứ hồi", perPerson.bus),
    `- TỔNG MỘT NGƯỜI: ${formatVnd(perPerson.total)}`,
    travelers > 1 ? `- TỔNG CẢ ĐOÀN (${travelers} người): ${formatVnd(breakdown.groupTotal)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
