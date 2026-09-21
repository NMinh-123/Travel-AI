import "dotenv/config";
import { generateItinerary } from "@server/domain/itinerary";
import { percentile } from "@eval/metrics/operational";
import { BUDGET_LEVELS, TRAVEL_MODES, VIBES, type ItineraryRequest } from "@server/domain/prompts";

/**
 * ĐO TỶ LỆ LỊCH TRÌNH KHẢ THI.
 *
 *   npx tsx scripts/itinerary-validity.ts [--limit 6] [--repeat 1]
 *
 * Chấm văn phong thì lịch trình nào cũng đạt: model viết trôi chảy là việc nó làm tốt nhất. Thứ
 * cần đo là lịch trình có ĐI ĐƯỢC không, và đó là câu hỏi có đáp án đúng/sai nhờ
 * server/domain/itineraryCheck.ts.
 *
 * Ba con số quan trọng, và chúng nói ba điều khác nhau:
 *  - Hợp lệ NGAY LƯỢT ĐẦU: chất lượng thật của lời nhắc. Thấp nghĩa là lời nhắc chưa nói đủ.
 *  - Hợp lệ SAU KHI SỬA: chất lượng khách nhận được. Khoảng cách giữa hai con số là phần vòng lặp
 *    sửa đang gánh, và nó tốn tiền cùng thời gian thật.
 *  - Bảng mã lỗi còn lại: chỗ nào vòng lặp sửa không sửa nổi. Đó mới là danh sách việc cần làm.
 *
 * Script này GỌI MODEL THẬT và tốn tiền: mỗi lịch trình là một tới ba lượt gọi model mạnh. Mặc
 * định chỉ chạy sáu yêu cầu.
 */

interface Options {
  limit: number;
  repeat: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { limit: 6, repeat: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[++index];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`Thiếu giá trị cho ${name}`);
    if (name === "--limit") options.limit = Number(value);
    else if (name === "--repeat") options.repeat = Number(value);
    else throw new Error(`Tham số không được hỗ trợ: ${name}`);
  }
  for (const [key, value] of Object.entries(options)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${key} phải là số nguyên dương`);
  }
  return options;
}

/**
 * Ma trận yêu cầu, xoay vòng qua cả ba chiều cấu hình.
 *
 * Xoay vòng chứ không lấy ngẫu nhiên: cần lặp lại được giữa hai lần chạy để so trước/sau một thay
 * đổi, và cần phủ đủ các phương tiện vì số ngày dài với ô tô là tổ hợp sinh nhiều lỗi nhất.
 */
function buildRequests(limit: number): ItineraryRequest[] {
  const dayCounts = [2, 3, 4, 5];
  return Array.from({ length: limit }, (_, index) => ({
    days: dayCounts[index % dayCounts.length],
    travelMode: TRAVEL_MODES[index % TRAVEL_MODES.length],
    vibe: VIBES[index % VIBES.length],
    budget: BUDGET_LEVELS[index % BUDGET_LEVELS.length],
    notes: "",
  }));
}

interface Run {
  request: ItineraryRequest;
  valid: boolean;
  attempts: number;
  codes: string[];
  latencyMs: number;
  unverifiedLegs: number;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const requests = buildRequests(options.limit);
  const runs: Run[] = [];

  for (let round = 0; round < options.repeat; round += 1) {
    for (const request of requests) {
      const label = `${request.days} ngày · ${request.travelMode} · ${request.vibe} · ${request.budget}`;
      process.stdout.write(`  ${label} ... `);
      try {
        const { plan, metrics } = await generateItinerary(request);
        const codes = [...new Set(plan.validation.issues.map((issue) => issue.code))];
        runs.push({
          request,
          valid: plan.validation.valid,
          attempts: plan.validation.attempts,
          codes,
          latencyMs: metrics.latencyMs,
          unverifiedLegs: plan.validation.routes.filter((route) => !route.verified).length,
        });
        console.log(plan.validation.valid ? `hợp lệ (${plan.validation.attempts} lượt)` : `còn lỗi: ${codes.join(", ")}`);
      } catch (error) {
        // Sinh hỏng hoàn toàn cũng là một kết quả cần đếm, không được im lặng bỏ qua.
        runs.push({ request, valid: false, attempts: 0, codes: ["GENERATION_FAILED"], latencyMs: 0, unverifiedLegs: 0 });
        console.log(`hỏng: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const total = runs.length;
  const valid = runs.filter((run) => run.valid).length;
  const validFirstTry = runs.filter((run) => run.valid && run.attempts === 1).length;
  const ratio = (value: number): string => (total ? (value / total).toFixed(2) : "—");

  const histogram = new Map<string, number>();
  for (const run of runs) for (const code of run.codes) histogram.set(code, (histogram.get(code) ?? 0) + 1);

  console.log("");
  console.log(`${total} lịch trình.`);
  console.log(`Hợp lệ ngay lượt đầu: ${validFirstTry}/${total} (${ratio(validFirstTry)})`);
  console.log(`Hợp lệ sau khi sửa:   ${valid}/${total} (${ratio(valid)})`);
  console.log(`Số lượt gọi model trung bình: ${(runs.reduce((sum, run) => sum + run.attempts, 0) / total).toFixed(2)}`);
  console.log(`Độ trễ p50 ${percentile(runs.map((run) => run.latencyMs), 0.5)}ms · p95 ${percentile(runs.map((run) => run.latencyMs), 0.95)}ms`);
  console.log(`Chặng chưa đối chiếu được quãng đường: ${runs.reduce((sum, run) => sum + run.unverifiedLegs, 0)}`);

  if (histogram.size) {
    console.log("");
    console.log("Mã lỗi còn lại sau khi sửa (số lịch trình dính):");
    for (const [code, count] of [...histogram].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code.padEnd(24)} ${count}`);
    }
  }
}

main().catch((error) => {
  console.error("Đo thất bại:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
