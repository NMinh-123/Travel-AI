import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateItinerary, ItineraryGenerationError, type ItineraryDeps } from "./itinerary";
import type { GeneratedDay, GeneratedItinerary } from "./itineraryCheck";
import type { ItineraryRequest } from "./prompts";

const REQUEST: ItineraryRequest = {
  days: 2, travelMode: "motorbike", vibe: "photography", budget: "comfort", notes: "",
};

function day(patch: Partial<GeneratedDay> = {}): GeneratedDay {
  return {
    day: 1,
    title: "Vào cao nguyên",
    theme: "Đường lên",
    startPoint: "Thành phố Hà Giang",
    endPoint: "Yên Minh",
    totalDistanceKm: 96,
    ridingHours: 4,
    maxElevationM: 1500,
    scenicRating: 5,
    eveningStay: { name: "Khách sạn Thiên Ân Yên Minh", type: "Khách sạn", vibe: "Yên Minh", priceEstimate: "" },
    waypoints: [
      { time: "07:00", title: "Dốc Bắc Sum", subtitle: "", distanceKm: 20, elevationM: 900, type: "ride", highlight: "", aiTip: "" },
      { time: "09:30", title: "Cổng Trời Quản Bạ", subtitle: "", distanceKm: 45, elevationM: 1500, type: "viewpoint", highlight: "", aiTip: "" },
      { time: "12:00", title: "Tam Sơn", subtitle: "", distanceKm: 50, elevationM: 1000, type: "meal", highlight: "", aiTip: "" },
      { time: "15:30", title: "Yên Minh", subtitle: "", distanceKm: 96, elevationM: 1100, type: "stay", highlight: "", aiTip: "" },
    ],
    missingFields: [],
    ...patch,
  };
}

const lastDay = day({
  day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang",
  eveningStay: { name: "Kết thúc hành trình", type: "Không nghỉ đêm", vibe: "", priceEstimate: "" },
});

function valid(): GeneratedItinerary {
  return {
    title: "Hà Giang 2 ngày", overview: "Vòng cung ngắn.", totalKm: 192, dailyTips: [],
    days: [day(), lastDay], missingFields: [],
  };
}

/** Sai đúng một chiều: ngày 2 xuất phát từ nơi khác nơi ngày 1 kết thúc. */
function broken(): GeneratedItinerary {
  return {
    ...valid(),
    days: [day({ endPoint: "Đồng Văn" }), day({ day: 2, startPoint: "Mèo Vạc", endPoint: "Thành phố Hà Giang", eveningStay: lastDay.eveningStay })],
  };
}

/** Sai hai chiều, để kiểm "chỉ nhận bản sửa khi nó thực sự ít lỗi hơn". */
function worse(): GeneratedItinerary {
  return {
    ...broken(),
    title: "Bản sửa tệ hơn",
    totalKm: 9999,
  };
}

/** Phụ thuộc giả: trả lần lượt các phản hồi đã dựng sẵn. */
function deps(replies: (GeneratedItinerary | Error)[]): ItineraryDeps & { calls: number } {
  const stub = {
    calls: 0,
    async callModel() {
      const reply = replies[Math.min(stub.calls, replies.length - 1)];
      stub.calls += 1;
      if (reply instanceof Error) throw reply;
      return { text: JSON.stringify(reply), promptTokens: 100, outputTokens: 200 };
    },
  };
  return stub;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("KT-01: lịch trình hợp lệ ngay lượt đầu", () => {
  it("không gọi lượt sửa nào", async () => {
    const stub = deps([valid()]);
    const { plan, metrics } = await generateItinerary(REQUEST, stub);
    expect(stub.calls).toBe(1);
    expect(plan.validation.valid).toBe(true);
    expect(plan.validation.issues).toEqual([]);
    expect(plan.validation.attempts).toBe(1);
    expect(metrics.retries).toBe(0);
  });
});

describe("KT-02: vòng lặp sửa", () => {
  it("gửi lỗi lại cho model và nhận bản đã sửa", async () => {
    const stub = deps([broken(), valid()]);
    const { plan, metrics } = await generateItinerary(REQUEST, stub);
    expect(stub.calls).toBe(2);
    expect(plan.validation.valid).toBe(true);
    expect(plan.validation.attempts).toBe(2);
    // Lượt sửa là một lượt gọi lại, nên nó phải hiện ở đúng ô `retries` của chỉ số vận hành.
    expect(metrics.retries).toBe(1);
    expect(metrics.promptTokens).toBe(200);
  });

  it("KHÔNG nhận bản sửa tệ hơn, và dừng ngay tại đó", async () => {
    // Không có phép so này thì vòng lặp có thể đi ngược — rủi ro cố hữu của mọi vòng tự sửa.
    const stub = deps([broken(), worse(), valid()]);
    const { plan } = await generateItinerary(REQUEST, stub);
    expect(stub.calls).toBe(2);
    // So theo tiêu đề chứ không theo totalKm: quãng đường lệch bảng chặng giờ được tính lại cho cả hai bản.
    expect(plan.title).not.toBe("Bản sửa tệ hơn");
    expect(plan.validation.valid).toBe(false);
  });

  it("dừng ở trần số lượt khi model không sửa nổi", async () => {
    const stub = deps([broken()]);
    const { plan } = await generateItinerary(REQUEST, stub);
    // Một lượt đầu cộng tối đa hai lượt sửa; lượt sửa thứ hai không tốt hơn nên vòng lặp thoát.
    expect(stub.calls).toBeLessThanOrEqual(3);
    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.issues.some((issue) => issue.code === "DAY_NOT_CONTINUOUS")).toBe(true);
  });

  it("lượt sửa ném lỗi thì GIỮ bản trước đó thay vì hỏng cả yêu cầu", async () => {
    const stub = deps([broken(), new Error("sidecar sập")]);
    const { plan } = await generateItinerary(REQUEST, stub);
    expect(plan.validation.valid).toBe(false);
    expect(plan.days).toHaveLength(2);
  });

  it("lượt ĐẦU không đọc được thì hỏng hẳn, vì không có gì để giữ", async () => {
    const stub: ItineraryDeps = { async callModel() { return { text: "không phải JSON", promptTokens: 0, outputTokens: 0 }; } };
    await expect(generateItinerary(REQUEST, stub)).rejects.toBeInstanceOf(ItineraryGenerationError);
  });
});

describe("KT-03: chi phí do code tính, ghi rõ giả định và đơn vị", () => {
  it("khớp công thức của máy tính chi phí, không lấy từ model", async () => {
    const { plan } = await generateItinerary(REQUEST, deps([valid()]));
    const cost = plan.cost;
    expect(cost.currency).toBe("VND");
    expect(cost.breakdown.days).toBe(2);
    expect(cost.breakdown.nights).toBe(1);
    // 2 ngày tự lái: xe 2×180k, xăng 2×100k, 1 đêm phòng riêng 450k, ăn 2×300k, vé 250k, xe khách 600k.
    expect(cost.breakdown.perPerson.total).toBe(2_460_000);
    expect(cost.assumptions.join(" ")).toContain("MỘT người");
    expect(cost.assumptions.join(" ")).toContain("ƯỚC TÍNH");
  });

  it("Easy Rider không tính xăng riêng", async () => {
    const { plan } = await generateItinerary({ ...REQUEST, travelMode: "easy_rider" }, deps([valid()]));
    expect(plan.cost.breakdown.perPerson.fuel).toBe(0);
    expect(plan.cost.assumptions.join(" ")).toContain("đã gồm xăng");
  });
});

describe("KT-04: chặng thiếu dữ liệu tuyến đường được đánh dấu chưa xác minh", () => {
  it("mỗi ngày có một mục đối chiếu, có hoặc không có số tham chiếu", async () => {
    const { plan } = await generateItinerary(REQUEST, deps([valid()]));
    expect(plan.validation.routes).toHaveLength(2);
    for (const route of plan.validation.routes) {
      expect(route).toHaveProperty("verified");
      if (!route.verified) expect(route.referenceKm).toBeNull();
    }
  });
});

describe("KT-05: chi phí phân biệt giá đã xác minh với giá ước lượng", () => {
  /**
   * Khoản lưu trú là khoản duy nhất có thể lấy giá THẬT: sau `enforceLodging`, mỗi đêm đã ràng
   * vào một bản ghi cụ thể trong danh mục, và bản ghi ấy mang khoảng giá đã khảo sát. Dùng mặt
   * bằng `stayPerNight` khi đã có giá thật trong tay là vứt đi thông tin tốt hơn.
   */
  it("lưu trú lấy giá từ danh mục và được đánh dấu verified", async () => {
    const { plan } = await generateItinerary(REQUEST, deps([valid()]));
    const stay = plan.cost.lines.find((line) => line.label === "Lưu trú");
    expect(stay?.source).toBe("catalogue");
    expect(stay?.confidence).toBe("verified");
    expect(stay?.amountVnd).toBeGreaterThan(0);
  });

  /**
   * Cả bảng vẫn là `estimated` vì xăng, ăn uống, vé tham quan đều từ bảng giả định. Lấy mức yếu
   * nhất chứ không lấy trung bình: một bảng có một khoản ước lượng vẫn là bảng ước lượng, và gọi
   * nó là đã xác minh là hứa với khách nhiều hơn những gì ta biết.
   */
  it("một khoản ước lượng là đủ để cả bảng chỉ còn là ước lượng", async () => {
    const { plan } = await generateItinerary(REQUEST, deps([valid()]));
    expect(plan.cost.confidence).toBe("estimated");
    expect(plan.cost.lines.some((line) => line.confidence === "estimated")).toBe(true);
  });

  /**
   * Ngày kết thúc ở một nơi danh mục lưu trú không phủ — Mã Pí Lèng là đèo, không ai ngủ ở đó.
   * `enforceLodging` khi ấy trả về "Chưa chốt chỗ nghỉ", nên không có giá thật nào để lấy và
   * khoản lưu trú buộc phải lùi về mặt bằng. Điều bắt buộc là nó NÓI RA điều đó.
   */
  it("không chốt được chỗ nghỉ thì lưu trú lùi về mặt bằng và nói rõ là ước lượng", async () => {
    const noStay = valid();
    noStay.days[0].endPoint = "Mã Pí Lèng";
    noStay.days[1].startPoint = "Mã Pí Lèng";
    // Tên bịa: `enforceLodging` chỉ thay những tên KHÔNG có trong danh mục, nên phải bịa thì nó
    // mới đi tìm cơ sở thay thế — và ở Mã Pí Lèng thì không có cơ sở nào để tìm.
    noStay.days[0].eveningStay = { name: "Homestay Trên Đèo", type: "", vibe: "", priceEstimate: "" };
    const { plan } = await generateItinerary(REQUEST, deps([noStay, noStay, noStay]));

    const stay = plan.cost.lines.find((line) => line.label === "Lưu trú");
    expect(stay?.source).toBe("assumption");
    expect(stay?.confidence).toBe("estimated");
    expect(stay?.note).toContain("chưa chốt đủ cơ sở");
    expect(plan.cost.stayVariance).toBeNull();
  });

  /**
   * Bảng chi phí từng khoá cứng `travelers: 1`, nên một đoàn 4 người nhận về dự trù của một
   * người — đúng về số học, sai về câu hỏi khách đang hỏi.
   */
  it("tính cho đúng số người khách đã nói", async () => {
    const { plan } = await generateItinerary({ ...REQUEST, travelers: 4 }, deps([valid()]));
    expect(plan.cost.breakdown.travelers).toBe(4);
    expect(plan.cost.groupTotalVnd).toBe(plan.cost.perPersonTotalVnd * 4);
    expect(plan.cost.assumptions.join(" ")).toContain("4 người");
  });

  it("tổng cộng từ lines khớp với chính lines, không phải một con số rời", async () => {
    const { plan } = await generateItinerary(REQUEST, deps([valid()]));
    const sum = plan.cost.lines.reduce((total, line) => total + line.amountVnd, 0);
    expect(plan.cost.perPersonTotalVnd).toBe(sum);
  });
});

describe("KT-06: vòng lặp sửa cân theo mức nghiêm trọng", () => {
  /**
   * Bản sửa dưới đây ÍT LỖI HƠN nhưng NẶNG HƠN: nó dọn được lỗi ngày không liên tục và đổi lại
   * một điểm đến thành cái tên không có trong danh mục. Phép so cũ đếm số lượng nên nhận nó;
   * phép so mới nhìn mức nặng nhất nên giữ bản cũ.
   */
  it("từ chối bản sửa ít lỗi hơn nhưng nặng hơn", async () => {
    const worse = valid();
    worse.days[0].endPoint = "Thị Trấn Hoàn Toàn Bịa";
    worse.days[1].startPoint = "Thị Trấn Hoàn Toàn Bịa";

    const { plan } = await generateItinerary(REQUEST, deps([broken(), worse, worse]));
    // Giữ bản đầu: lỗi của nó là DAY_NOT_CONTINUOUS, nhẹ hơn UNKNOWN_PLACE.
    expect(plan.validation.issues.map((issue) => issue.code)).toContain("DAY_NOT_CONTINUOUS");
    expect(plan.validation.issues.map((issue) => issue.code)).not.toContain("UNKNOWN_PLACE");
  });
});
