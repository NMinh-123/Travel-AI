import { config } from "@server/config";
import { chargeModelCall } from "@server/infra/aiBudget";
import { AiUnavailableError, getGeminiClient, safeJsonParse, type CallMetrics } from "@server/infra/gemini";
import {
  ITINERARY_RESPONSE_SCHEMA,
  buildItineraryPrompt,
  buildItineraryRepairPrompt,
  type ItineraryRequest,
} from "./prompts";
import { LODGING_OPTIONS, buildLodgingBlock, enforceLodging } from "@server/domain/lodging";
import { PLACES } from "@data/places/index";
import { normalizePlaceName } from "@data/places/normalize";
import {
  COST_ASSUMPTIONS, estimateTripCost,
  type CostBreakdown, type RiderType, type StayStyle,
} from "@server/domain/costs";
import {
  checkItinerary, checkRoutes, compareIssueSets, correctRouteDistances, describeIssues, parseItinerary,
  type GeneratedItinerary, type ItineraryIssue, type RouteCheck,
} from "@server/domain/itineraryCheck";

/**
 * Lõi sinh lịch trình, dùng chung cho HAI đường vào: endpoint /api/plan-itinerary của trình lập
 * lịch trình, và tác tử itinerary trong luồng hội thoại (FR-BOT-03).
 *
 * BA LỚP, và chỉ từ lớp thứ hai mới là ràng buộc:
 *
 *  1. Lời nhắc hướng dẫn model — danh mục lưu trú, số ngày, quy tắc giờ giấc.
 *  2. Kiểm bằng CODE sau khi sinh (server/domain/itineraryCheck.ts): số ngày, địa danh có thật,
 *     ngày sau nối tiếp ngày trước, tốc độ và giờ giấc đi được, chỗ nghỉ khớp điểm kết thúc,
 *     quãng đường đối chiếu với bảng chặng khung.
 *  3. Đưa danh sách lỗi lại cho model sửa, tối đa `MAX_REPAIR_ATTEMPTS` lượt.
 *
 * Bản trước chỉ có lớp một cộng đúng một phép kiểm "days là mảng không rỗng", và `plan` mang kiểu
 * `any` suốt đường đi — nên một lịch trình bảo khách ngày 1 kết thúc ở Đồng Văn rồi ngày 2 xuất
 * phát từ Mèo Vạc vẫn đi thẳng ra màn hình. Lời nhắc HƯỚNG DẪN, phép kiểm mới RÀNG BUỘC; đây là
 * cùng một bài học đã ghi ở đầu server/domain/lodging.ts.
 *
 * VÒNG LẶP SỬA KHÔNG PHẢI ĐỂ MODEL TỰ CHẤM BÀI MÌNH. Danh sách lỗi do code sinh ra từ dữ liệu
 * thật; model chỉ được giao việc viết lại phần bị chỉ tên.
 */

export class ItineraryGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItineraryGenerationError";
  }
}

/**
 * Trần số lượt sửa.
 *
 * Hai là con số của sự đánh đổi chứ không phải con số tròn: mỗi lượt thêm một lần gọi model đầy đủ
 * vào một thao tác vốn đã chậm nhất hệ thống, còn phần lớn lỗi thì biến mất ngay ở lượt sửa đầu.
 * Không có trần thì một lịch trình model không sửa nổi sẽ quay vòng mãi.
 */
const MAX_REPAIR_ATTEMPTS = 2;

/**
 * Lỗi mà `correctRouteDistances` tự sửa sau vòng lặp, nên một mình chúng KHÔNG khởi động lượt sửa.
 *
 * Mỗi lượt sửa là thêm 30–40 giây vào một thao tác vốn đã chậm nhất hệ thống (đo 62–80 giây trên
 * production ngày 2026-09-25), để model đổi một con số mà code thay được ngay bằng số tham chiếu.
 * Có lỗi khác khiến vòng lặp chạy thì chúng vẫn nằm trong danh sách gửi model, không mất đi.
 */
const CODE_FIXED = new Set(["DISTANCE_OFF_REFERENCE", "TOTAL_KM_MISMATCH"]);

export interface ItineraryValidation {
  valid: boolean;
  issues: ItineraryIssue[];
  /** Số lượt gọi model đã dùng, tính cả lượt đầu. */
  attempts: number;
  /** Đối chiếu quãng đường từng ngày; `verified: false` nghĩa là CHƯA có dữ liệu để đối chiếu. */
  routes: RouteCheck[];
}

/**
 * Một khoản chi phí, kèm chỗ con số ấy đến từ đâu.
 *
 * `verified` KHÔNG có nghĩa là "chắc chắn đúng giá" — không ai hứa được điều đó. Nó có nghĩa hẹp
 * và kiểm được: con số này lấy từ một bản ghi cụ thể trong danh mục, khảo sát vào một ngày cụ
 * thể, không phải từ bảng mặt bằng chung. Phân biệt ấy là thứ quyết định câu trả lời cho khách
 * được nói "phòng chỗ này 400.000đ" hay buộc phải nói "phòng loại này khoảng 450.000đ".
 */
export interface CostLine {
  label: string;
  amountVnd: number;
  source: "catalogue" | "assumption";
  confidence: "verified" | "estimated";
  note: string;
}

export interface ItineraryCost {
  currency: "VND";
  breakdown: CostBreakdown;
  /**
   * Giả định đã dùng, viết thành câu cho người đọc.
   *
   * Bắt buộc đi kèm con số: một bảng chi phí không nói rõ nó tính cho mấy người, kiểu lưu trú nào
   * và đơn giá lấy từ đâu thì khách không có cách nào biết con số đó áp cho ai.
   */
  assumptions: string[];
  /** Từng khoản kèm xuất xứ. Đây là phần trả lời được câu "con số này ở đâu ra". */
  lines: CostLine[];
  /**
   * Tổng MỘT người cộng từ `lines`, và tổng cả đoàn.
   *
   * Có thể khác `breakdown.perPerson.total`, và sự khác nhau đó là có ý nghĩa chứ không phải lỗi:
   * `breakdown` chạy đúng công thức dùng chung với máy tính chi phí ở tab Cẩm nang và tác tử dự
   * trù, nên khoản lưu trú ở đó luôn là mặt bằng theo kiểu phòng. `lines` thì thay khoản ấy bằng
   * giá thật của chính những cơ sở lịch trình này đã chọn, khi tra được.
   *
   * Giữ cả hai thay vì bỏ một: bỏ `breakdown` thì ba nơi trong ứng dụng lại trả ba con số khác
   * nhau cho cùng một câu hỏi; bỏ `lines` thì vứt đi giá thật đang có trong tay. `stayVariance`
   * nói rõ hai bên lệch nhau bao nhiêu.
   */
  perPersonTotalVnd: number;
  groupTotalVnd: number;
  /**
   * Chênh lệch giữa khoản lưu trú theo mặt bằng và theo giá thật, dạng tỷ lệ; `null` khi chưa
   * tra được giá thật.
   *
   * Đây là con số đáng nhìn nhất trong cả bảng: nó nói bảng mặt bằng `stayPerNight` còn bám thực
   * tế tới đâu. Lệch lớn và dai dẳng nghĩa là `COST_ASSUMPTIONS` cần khảo lại, chứ không phải
   * lịch trình này bất thường.
   */
  stayVariance: number | null;
  /**
   * Cả bảng chỉ được gọi là `verified` khi MỌI khoản đều `verified`.
   *
   * Lấy mức yếu nhất chứ không lấy trung bình: một bảng có đúng một khoản ước lượng vẫn là một
   * bảng ước lượng, và trình bày nó như đã xác minh là hứa với khách nhiều hơn những gì ta biết.
   */
  confidence: "verified" | "estimated";
}

export interface ValidatedItinerary extends GeneratedItinerary {
  validation: ItineraryValidation;
  cost: ItineraryCost;
}

export interface ItineraryOutcome {
  plan: ValidatedItinerary;
  metrics: CallMetrics;
}

/** Phương tiện của lịch trình -> kiểu người lái của máy tính chi phí. */
function riderTypeFor(mode: ItineraryRequest["travelMode"]): RiderType {
  return mode === "easy_rider" ? "easy_rider" : "self_drive";
}

/** Mức ngân sách -> kiểu lưu trú. Cùng ánh xạ với tác tử dự trù, để hai chỗ không lệch nhau. */
function stayStyleFor(budget: ItineraryRequest["budget"]): StayStyle {
  if (budget === "backpacker") return "dorm";
  if (budget === "luxury") return "ecolodge";
  return "private_room";
}

function vnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/**
 * Chi phí lưu trú tính từ CHÍNH những cơ sở lịch trình đã chọn.
 *
 * Bảng `stayPerNight` là mặt bằng theo kiểu lưu trú — nó đúng khi chưa biết khách ngủ ở đâu.
 * Nhưng đến lúc này thì đã biết: `enforceLodging` vừa ràng từng đêm vào một bản ghi cụ thể trong
 * danh mục, và bản ghi ấy mang giá đã khảo sát. Dùng mặt bằng khi đã có giá thật là vứt đi thông
 * tin tốt hơn mình đang cầm.
 *
 * Trả `null` khi còn dù chỉ một đêm không tra được giá. Trộn giá thật với mặt bằng cho ra một
 * tổng không thuộc về loại nào, và khi đó không nói được nó là `verified` hay `estimated`.
 */
function stayCostFromPlan(plan: GeneratedItinerary): { amount: number; nights: number } | null {
  // Lịch trình N ngày có N−1 đêm: ngày cuối kết thúc hành trình, không có đêm nghỉ.
  const nights = plan.days.slice(0, -1);
  if (nights.length === 0) return { amount: 0, nights: 0 };

  let amount = 0;
  for (const day of nights) {
    const option = LODGING_OPTIONS.find(
      (row) => normalizePlaceName(row.name) === normalizePlaceName(day.eveningStay.name),
    );
    const place = option ? PLACES.find((row) => row.slug === option.slug) : undefined;
    const price = place?.price;
    if (!price) return null;
    // Lấy trung điểm khoảng giá: cận dưới là hứa hẹn quá tay, cận trên thì doạ khách.
    amount += (price.minVnd + price.maxVnd) / 2;
  }
  // Tròn tới nghìn đồng như nhãn giá: "958.548đ" hứa một độ chính xác mà giá tham khảo không có.
  return { amount: Math.round(amount / 1000) * 1000, nights: nights.length };
}

/**
 * Chi phí do CODE tính, không hỏi model.
 *
 * Dùng lại `estimateTripCost` — đúng hàm mà máy tính chi phí ở tab Cẩm nang và tác tử dự trù kinh
 * phí đang dùng. Ba chỗ cùng một công thức thì khách hỏi ở đâu cũng ra một con số; để model tự
 * cộng thì không chỗ nào khớp chỗ nào.
 */
function computeCost(request: ItineraryRequest, plan: GeneratedItinerary): ItineraryCost {
  const stayStyle = stayStyleFor(request.budget);
  const riderType = riderTypeFor(request.travelMode);
  const travelers = Math.max(1, Math.round(request.travelers ?? 1));
  const breakdown = estimateTripCost({ days: request.days, riderType, stayStyle, travelers });

  const fromPlan = stayCostFromPlan(plan);
  const lines: CostLine[] = [
    {
      label: riderType === "self_drive" ? "Thuê xe" : "Easy Rider",
      amountVnd: breakdown.perPerson.bike,
      source: "assumption",
      confidence: "estimated",
      note:
        riderType === "self_drive"
          ? `${vnd(COST_ASSUMPTIONS.bikeRentPerDay)}/ngày × ${breakdown.days} ngày.`
          : `${vnd(COST_ASSUMPTIONS.easyRiderPerDay)}/ngày × ${breakdown.days} ngày, đã gồm xăng.`,
    },
    {
      label: "Xăng",
      amountVnd: breakdown.perPerson.fuel,
      source: "assumption",
      confidence: "estimated",
      note: riderType === "self_drive" ? `${vnd(COST_ASSUMPTIONS.fuelPerDay)}/ngày.` : "Đã gồm trong giá Easy Rider.",
    },
    fromPlan
      ? {
          label: "Lưu trú",
          amountVnd: fromPlan.amount,
          source: "catalogue" as const,
          confidence: "verified" as const,
          note: `Trung điểm khoảng giá đã khảo sát của đúng ${fromPlan.nights} cơ sở trong lịch trình này.`,
        }
      : {
          label: "Lưu trú",
          amountVnd: breakdown.perPerson.stay,
          source: "assumption" as const,
          confidence: "estimated" as const,
          note: `Mặt bằng kiểu ${stayStyle}: ${vnd(COST_ASSUMPTIONS.stayPerNight[stayStyle])}/đêm × ${breakdown.nights} đêm — chưa chốt đủ cơ sở để lấy giá thật.`,
        },
    {
      label: "Ăn uống",
      amountVnd: breakdown.perPerson.food,
      source: "assumption",
      confidence: "estimated",
      note: `${vnd(COST_ASSUMPTIONS.foodPerDay)}/ngày × ${breakdown.days} ngày.`,
    },
    {
      label: "Vé tham quan",
      amountVnd: breakdown.perPerson.tickets,
      source: "assumption",
      confidence: "estimated",
      note: "Thuyền Nho Quế, Cột cờ Lũng Cú, Dinh Vua Mèo — cả chuyến.",
    },
    {
      label: "Xe khách Hà Nội khứ hồi",
      amountVnd: breakdown.perPerson.bus,
      source: "assumption",
      confidence: "estimated",
      note: "Giường nằm, hai chiều.",
    },
  ];

  const perPersonTotalVnd = lines.reduce((sum, line) => sum + line.amountVnd, 0);

  return {
    currency: "VND",
    breakdown,
    // Mức yếu nhất thắng: một khoản ước lượng là đủ để cả bảng chỉ còn là ước lượng.
    confidence: lines.every((line) => line.confidence === "verified") ? "verified" : "estimated",
    lines,
    perPersonTotalVnd,
    groupTotalVnd: perPersonTotalVnd * travelers,
    stayVariance:
      fromPlan && breakdown.perPerson.stay > 0
        ? (fromPlan.amount - breakdown.perPerson.stay) / breakdown.perPerson.stay
        : null,
    assumptions: [
      travelers === 1
        ? `Tính cho MỘT người, ${breakdown.days} ngày và ${breakdown.nights} đêm.`
        : `Tính cho ${travelers} người, ${breakdown.days} ngày và ${breakdown.nights} đêm; ` +
          `mỗi người ${vnd(breakdown.perPerson.total)}, cả đoàn ${vnd(breakdown.groupTotal)}.`,
      riderType === "self_drive"
        ? `Tự lái: thuê xe ${vnd(COST_ASSUMPTIONS.bikeRentPerDay)}/ngày, xăng ${vnd(COST_ASSUMPTIONS.fuelPerDay)}/ngày.`
        : `Easy Rider: ${vnd(COST_ASSUMPTIONS.easyRiderPerDay)}/ngày, đã gồm xăng.`,
      fromPlan
        ? `Lưu trú lấy GIÁ THẬT của ${fromPlan.nights} cơ sở đã chọn trong lịch trình này.`
        : `Lưu trú theo mặt bằng kiểu ${stayStyle}: ${vnd(COST_ASSUMPTIONS.stayPerNight[stayStyle])}/đêm.`,
      `Ăn uống ${vnd(COST_ASSUMPTIONS.foodPerDay)}/ngày; vé tham quan ${vnd(COST_ASSUMPTIONS.attractionTickets)} cả chuyến; xe khách Hà Nội khứ hồi ${vnd(COST_ASSUMPTIONS.busHanoiRoundTrip)}.`,
      "Đây là ƯỚC TÍNH theo mặt bằng giá 09/2026, không phải báo giá cam kết.",
    ],
  };
}

interface Attempt {
  plan: GeneratedItinerary;
  issues: ItineraryIssue[];
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
}

export interface ModelReply {
  text: string | undefined;
  promptTokens: number;
  outputTokens: number;
}

/**
 * Một lượt gọi model, tách ra thành phụ thuộc thay vì gọi thẳng SDK.
 *
 * Cùng khuôn với `TurnDeps` ở orchestrator, và vì cùng một lý do: phần đáng kiểm nhất của module
 * này là VÒNG LẶP SỬA — nó phải dừng đúng lúc, phải không nhận một bản sửa tệ hơn, và phải giữ
 * được bản cũ khi lượt sửa hỏng. Không tách được lượt gọi model thì ba tính chất đó chỉ kiểm được
 * bằng cách tiêu tiền gọi model thật, tức là trên thực tế sẽ không ai kiểm.
 */
export interface ItineraryDeps {
  callModel(contents: string): Promise<ModelReply>;
}

export const PRODUCTION_ITINERARY_DEPS: ItineraryDeps = {
  async callModel(contents: string): Promise<ModelReply> {
    const ai = getGeminiClient();
    if (!ai) throw new AiUnavailableError();

    /**
     * Lịch trình KHÔNG đi qua `generateStructured`, nên trần chi phí phải được gọi cả ở đây.
     *
     * Đây là lượt gọi đắt nhất của hệ thống: nó dùng model mạnh, và vòng lặp sửa trong
     * `generateItinerary` có thể gọi lại vài lượt cho một yêu cầu. Bỏ sót chỗ này thì trần chi
     * phí chỉ che phần rẻ.
     */
    await chargeModelCall();

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents,
      config: {
        // Việc nặng nhất của hệ thống: xem `geminiLongTimeoutMs` về ca GS-192 bị hạn chung cắt ngang.
        httpOptions: { timeout: config.geminiLongTimeoutMs },
        responseMimeType: "application/json",
        responseSchema: ITINERARY_RESPONSE_SCHEMA,
        temperature: 0.6,
      },
    });

    return {
      text: response.text,
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },
};

async function generateOnce(contents: string, request: ItineraryRequest, deps: ItineraryDeps): Promise<Attempt> {
  const startedAt = Date.now();
  const response = await deps.callModel(contents);
  const latencyMs = Date.now() - startedAt;

  const plan = parseItinerary(safeJsonParse(response.text));
  if (!plan) throw new ItineraryGenerationError("Trợ lý AI không tạo được lịch trình hợp lệ");

  /**
   * Ràng chỗ nghỉ vào danh mục TRƯỚC khi kiểm.
   *
   * Thứ tự này quan trọng: `enforceLodging` sửa tại chỗ những tên model bịa ra, nên kiểm trước nó
   * sẽ báo hàng loạt lỗi mà hệ thống tự vá được, và vòng lặp sửa sẽ tiêu một lượt gọi model cho
   * việc code vừa làm xong.
   */
  const lodging = enforceLodging(plan, request.budget);
  if (lodging.rejectedNames.length) {
    // Ghi log tên bị loại: đây là bằng chứng model đang bịa, và là cách duy nhất để biết danh mục
    // đang thiếu vùng nào. Chính log này đã chỉ ra rằng danh mục không có cơ sở nào ở Yên Minh.
    console.warn(
      `Lịch trình: loại ${lodging.rejectedNames.length} tên cơ sở lưu trú không có trong danh mục ` +
        `(${lodging.rejectedNames.join(", ")}). Đã thay ${lodging.replaced}, ` +
        `còn ${lodging.unresolved} ngày chưa có chỗ nghỉ.`,
    );
  }

  // Waypoint id do server gán để ổn định và không tốn token của model.
  for (const day of plan.days) {
    day.waypoints = day.waypoints.map((waypoint, index) => ({
      ...waypoint,
      id: `d${day.day}-w${index + 1}`,
      day: day.day,
    }));
  }

  return {
    plan,
    issues: checkItinerary(plan, { days: request.days }),
    latencyMs,
    promptTokens: response.promptTokens,
    outputTokens: response.outputTokens,
  };
}

export async function generateItinerary(
  request: ItineraryRequest,
  deps: ItineraryDeps = PRODUCTION_ITINERARY_DEPS,
): Promise<ItineraryOutcome> {
  const lodgingBlock = buildLodgingBlock();

  let attempt = await generateOnce(buildItineraryPrompt(request) + lodgingBlock, request, deps);
  let totalLatency = attempt.latencyMs;
  let promptTokens = attempt.promptTokens;
  let outputTokens = attempt.outputTokens;
  let used = 1;

  /**
   * Chỉ những lỗi model SỬA ĐƯỢC mới khởi động một lượt sửa.
   *
   * Lỗi `unverified` không bao giờ hết: chúng có nghĩa là bảng chặng khung chưa có chặng đó, và
   * không lượt gọi model nào thay đổi được điều ấy. Đếm chúng vào điều kiện vòng lặp là cách tiêu
   * hai lượt gọi model đắt nhất hệ thống cho một việc chắc chắn không xong.
   */
  const repairable = (issues: ItineraryIssue[]): ItineraryIssue[] =>
    issues.filter((issue) => issue.kind !== "unverified" && !CODE_FIXED.has(issue.code));

  while (repairable(attempt.issues).length && used <= MAX_REPAIR_ATTEMPTS) {
    console.warn(
      `Lịch trình lượt ${used}: ${attempt.issues.length} lỗi ` +
        `(${[...new Set(attempt.issues.map((issue) => issue.code))].join(", ")}). Gửi lại cho model sửa.`,
    );
    const repair =
      buildItineraryRepairPrompt(JSON.stringify(attempt.plan), describeIssues(attempt.issues)) + lodgingBlock;

    let next: Attempt;
    try {
      next = await generateOnce(repair, request, deps);
    } catch (error) {
      // Lượt sửa hỏng thì GIỮ bản trước đó thay vì làm hỏng cả yêu cầu: bản cũ vẫn dùng được, chỉ
      // là chưa sạch lỗi, và `validation` nói đúng điều đó.
      console.warn("Lượt sửa lịch trình thất bại, giữ bản trước đó:", error);
      break;
    }

    totalLatency += next.latencyMs;
    promptTokens += next.promptTokens;
    outputTokens += next.outputTokens;
    used += 1;

    /**
     * Chỉ nhận bản sửa khi nó THỰC SỰ tốt hơn — theo TRỌNG SỐ, không theo số lượng.
     *
     * Bản trước so `next.issues.length < attempt.issues.length`, và phép so đó nhận nhầm đúng
     * kiểu đánh đổi tệ nhất: một lượt sửa dọn sạch ba mốc giờ sai định dạng rồi đổi một điểm đến
     * thành một cái tên không có trong danh mục sẽ được ghi nhận là tiến bộ (4 lỗi xuống 2 lỗi),
     * trong khi lịch trình vừa trở nên nguy hiểm hơn hẳn.
     *
     * `compareIssueSets` so lần lượt theo lỗi nặng nhất, rồi tổng trọng số, rồi mới tới số lượng.
     */
    if (compareIssueSets(next.issues, attempt.issues) < 0) attempt = next;
    else break;
  }

  /**
   * Quãng đường model sửa mãi vẫn lệch thì thay bằng số tham chiếu, thay vì chỉ cảnh báo.
   *
   * Đo ngày 2026-09-25 trên production: "Đồng Văn → Mèo Vạc 110 km" (thật 22 km) đi ra màn hình với
   * một khung cảnh báo vàng mà khách dễ bỏ qua. `routes` giữ số GỐC của model để còn tra được.
   */
  const routes = checkRoutes(attempt.plan.days);
  const corrected = correctRouteDistances(attempt.plan);
  if (corrected.length) {
    console.warn(
      `Lịch trình: thay quãng đường lệch bảng chặng khung ở ${corrected
        .map((row) => `ngày ${row.day} (${row.claimedKm} → ${row.referenceKm} km)`)
        .join(", ")}.`,
    );
  }
  attempt = { ...attempt, issues: checkItinerary(attempt.plan, { days: request.days }) };

  const plan: ValidatedItinerary = {
    ...attempt.plan,
    validation: {
      valid: attempt.issues.length === 0,
      issues: attempt.issues,
      attempts: used,
      routes,
    },
    cost: computeCost(request, attempt.plan),
  };

  if (!plan.validation.valid) {
    console.warn(
      `Lịch trình vẫn còn ${attempt.issues.length} lỗi sau ${used} lượt: ` +
        `${[...new Set(attempt.issues.map((issue) => issue.code))].join(", ")}. Trả về kèm cảnh báo.`,
    );
  }

  return {
    plan,
    metrics: {
      model: config.geminiModel,
      latencyMs: totalLatency,
      promptTokens,
      outputTokens,
      // Lượt sửa là một lượt gọi lại, nên nó thuộc đúng ô `retries` mà chỉ số vận hành đang đếm.
      retries: used - 1,
    },
  };
}
