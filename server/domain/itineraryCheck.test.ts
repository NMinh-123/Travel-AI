import { describe, expect, it } from "vitest";
import {
  checkItinerary, checkRoutes, compareIssueSets, describeIssues, isKnownPlace, minutesOfDay,
  parseItinerary, severityOf,
  type GeneratedDay, type GeneratedItinerary, type ItineraryIssue,
} from "./itineraryCheck";

/**
 * Lịch trình mẫu HỢP LỆ, dựng từ dữ liệu thật của dự án: địa danh có trong danh mục, chỗ nghỉ có
 * trong danh mục lưu trú và nằm đúng vùng, chặng nối tiếp nhau, tốc độ và giờ giấc đi được.
 *
 * Mọi bài test dưới đây chỉ bẻ MỘT thứ trên bản mẫu này, nên khi một bài đỏ lên thì lỗi nằm đúng
 * ở chiều mà bài đó bẻ, không phải ở chỗ dựng dữ liệu.
 */
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
    eveningStay: {
      name: "Khách sạn Thiên Ân Yên Minh",
      type: "Khách sạn",
      vibe: "Yên Minh",
      priceEstimate: "400.000đ/đêm",
    },
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

/** Ngày cuối của vòng cung: về lại điểm xuất phát, không có đêm nghỉ. */
function lastDay(patch: Partial<GeneratedDay> = {}): GeneratedDay {
  return day({
    day: 2,
    startPoint: "Yên Minh",
    endPoint: "Thành phố Hà Giang",
    eveningStay: { name: "Kết thúc hành trình", type: "Không nghỉ đêm", vibe: "", priceEstimate: "" },
    ...patch,
  });
}

function plan(patch: Partial<GeneratedItinerary> = {}): GeneratedItinerary {
  return {
    title: "Hà Giang 2 ngày",
    overview: "Vòng cung ngắn.",
    totalKm: 192,
    dailyTips: ["Mang áo gió."],
    missingFields: [],
    days: [
      day(),
      day({
        day: 2,
        startPoint: "Yên Minh",
        endPoint: "Thành phố Hà Giang",
        eveningStay: { name: "Kết thúc hành trình", type: "Không nghỉ đêm", vibe: "", priceEstimate: "" },
      }),
    ],
    ...patch,
  };
}

const codes = (issues: { code: string }[]): string[] => issues.map((issue) => issue.code);
const INPUT = { days: 2 };

describe("KL-00: lịch trình hợp lệ không bị báo lỗi", () => {
  it("bản mẫu dựng từ dữ liệu thật đi qua sạch", () => {
    const issues = checkItinerary(plan(), INPUT);
    expect(issues, describeIssues(issues)).toEqual([]);
  });
});

describe("KL-01: số ngày là ràng buộc cứng", () => {
  it("bắt lịch trình khác số ngày khách yêu cầu", () => {
    expect(codes(checkItinerary(plan(), { days: 3 }))).toContain("DAY_COUNT");
  });

  it("bắt đánh số ngày không liên tục", () => {
    const broken = plan({ days: [day({ day: 1 }), day({ day: 5, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] });
    expect(codes(checkItinerary(broken, INPUT))).toContain("DAY_NUMBERING");
  });
});

describe("KL-02: địa danh và tính liên tục", () => {
  it("bắt địa danh không có trong danh mục", () => {
    expect(codes(checkItinerary(plan({ days: [day({ endPoint: "Thị trấn Không Tồn Tại" }), day({ day: 2 })] }), INPUT)))
      .toContain("UNKNOWN_PLACE");
  });

  it("bắt ngày sau không xuất phát từ nơi ngày trước kết thúc", () => {
    // Đây là lỗi tai hại nhất: lịch trình ngầm giả định khách dịch chuyển tức thời giữa hai thị
    // trấn cách nhau vài chục cây số đường đèo.
    const broken = plan({
      days: [day({ endPoint: "Đồng Văn" }), day({ day: 2, startPoint: "Mèo Vạc", endPoint: "Thành phố Hà Giang" })],
    });
    expect(codes(checkItinerary(broken, INPUT))).toContain("DAY_NOT_CONTINUOUS");
  });

  it("bắt điểm dừng lặp lại trong cùng một ngày", () => {
    const repeated = day();
    repeated.waypoints = [...repeated.waypoints, { ...repeated.waypoints[0], time: "17:00" }];
    expect(codes(checkItinerary(plan({ days: [repeated, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("DUPLICATE_WAYPOINT");
  });

  it("nhận tên viết dài hơn tên trong danh mục", () => {
    expect(isKnownPlace("Thị trấn Đồng Văn, Hà Giang")).toBe(true);
    expect(isKnownPlace("Sa Pa")).toBe(false);
  });
});

describe("KL-03: thời gian và tốc độ phải đi được", () => {
  it("bắt mốc giờ không tăng dần và sai định dạng", () => {
    const backwards = day();
    backwards.waypoints[2].time = "08:00";
    expect(codes(checkItinerary(plan({ days: [backwards, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("TIME_NOT_INCREASING");

    const malformed = day();
    malformed.waypoints[0].time = "7h sáng";
    expect(codes(checkItinerary(plan({ days: [malformed, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("TIME_FORMAT");
  });

  it("bắt lịch trình xếp khách còn trên đường sau khi trời tối", () => {
    // Cẩm nang coi đây là quy tắc cứng: đèn xe chiếu thẳng trong khi đường cong liên tục, nên
    // trước mỗi khúc cua ánh đèn chiếu ra khoảng không của vực.
    const late = day();
    late.waypoints[3].time = "20:30";
    expect(codes(checkItinerary(plan({ days: [late, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("TIME_TOO_LATE");
  });

  it("bắt tốc độ vô lý trên đường đèo", () => {
    const tooFast = day({ totalDistanceKm: 180, ridingHours: 2 });
    expect(codes(checkItinerary(plan({ days: [tooFast, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("SPEED_IMPLAUSIBLE");
  });

  it("bắt ngày quá dài về giờ lái và về quãng đường", () => {
    const marathon = day({ totalDistanceKm: 300, ridingHours: 12 });
    const issues = codes(checkItinerary(plan({ days: [marathon, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT));
    expect(issues).toContain("RIDING_TOO_LONG");
    expect(issues).toContain("DISTANCE_TOO_LONG");
  });

  it("đọc đúng mốc giờ HH:mm và từ chối giá trị hỏng", () => {
    expect(minutesOfDay("07:30")).toBe(450);
    expect(minutesOfDay("25:00")).toBeNull();
    expect(minutesOfDay("7h")).toBeNull();
  });
});

describe("KL-04: chỗ nghỉ khớp điểm kết thúc ngày", () => {
  it("bắt cơ sở không có trong danh mục lưu trú", () => {
    const fake = day({ eveningStay: { name: "Yên Minh Homestay", type: "", vibe: "", priceEstimate: "" } });
    expect(codes(checkItinerary(plan({ days: [fake, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("STAY_NOT_IN_CATALOGUE");
  });

  it("bắt chỗ nghỉ nằm sai vùng so với điểm kết thúc", () => {
    const wrongArea = day({
      eveningStay: { name: "Khách sạn Hoa Cương", type: "", vibe: "", priceEstimate: "" },
    });
    expect(codes(checkItinerary(plan({ days: [wrongArea, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })] }), INPUT)))
      .toContain("STAY_AREA_MISMATCH");
  });

  it("bắt ngày cuối vẫn có đêm nghỉ — N ngày chỉ có N-1 đêm", () => {
    const lastWithStay = day({
      day: 2,
      startPoint: "Yên Minh",
      endPoint: "Thành phố Hà Giang",
      eveningStay: { name: "Khách sạn Hà An", type: "", vibe: "", priceEstimate: "" },
    });
    expect(codes(checkItinerary(plan({ days: [day(), lastWithStay] }), INPUT))).toContain("LAST_DAY_HAS_STAY");
  });
});

describe("KL-05: quãng đường đối chiếu bảng chặng khung", () => {
  it("bắt totalKm không khớp tổng các ngày", () => {
    expect(codes(checkItinerary(plan({ totalKm: 500 }), INPUT))).toContain("TOTAL_KM_MISMATCH");
  });

  it("bắt quãng đường lệch xa so với chặng khung", () => {
    // Quản Bạ đi Yên Minh khai 50 km trong bảng chặng; 200 km là lệch ở mức phải có người nhìn.
    const inflated = day({ startPoint: "Quản Bạ", endPoint: "Yên Minh", totalDistanceKm: 200, ridingHours: 6 });
    const broken = plan({
      totalKm: 296,
      days: [inflated, day({ day: 2, startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang" })],
    });
    expect(codes(checkItinerary(broken, INPUT))).toContain("DISTANCE_OFF_REFERENCE");
  });

  it("chặng không có trong bảng khung được đánh dấu CHƯA XÁC MINH, không phải sai", () => {
    const checks = checkRoutes(plan().days);
    expect(checks).toHaveLength(2);
    for (const check of checks) {
      expect(typeof check.verified).toBe("boolean");
      if (!check.verified) expect(check.referenceKm).toBeNull();
    }
    // Chặng Quản Bạ - Yên Minh có trong bảng, nên nó phải xác minh được.
    const known = checkRoutes([day({ startPoint: "Quản Bạ", endPoint: "Yên Minh" })]);
    expect(known[0].verified).toBe(true);
    expect(known[0].referenceKm).toBe(50);
  });
});

describe("KL-06: đọc đầu ra của model thành kiểu có thật", () => {
  it("từ chối thứ không phải lịch trình", () => {
    for (const value of [null, undefined, 42, "chuỗi", {}, { days: [] }, { days: "x" }]) {
      expect(parseItinerary(value), String(value)).toBeNull();
    }
  });

  it("từ chối ngày thiếu trường bắt buộc", () => {
    expect(parseItinerary({ days: [{ day: 1, startPoint: "A" }] })).toBeNull();
  });

  /**
   * TRƯỜNG SỐ BỊ BỎ TRỐNG PHẢI LÀ `null`, KHÔNG PHẢI 0.
   *
   * Bản trước lấp bằng 0 và đi tiếp, nên "model không khai quãng đường" trông y hệt "quãng đường
   * bằng 0": phép kiểm tốc độ bỏ qua vì mẫu số bằng 0, `totalKm` lệch mà không ai giải thích
   * được, và lịch trình ra tới khách với một ô trống không ai biết.
   *
   * Trường CHỮ thì vẫn lấp bằng chuỗi rỗng — chúng chỉ ảnh hưởng cách trình bày, không ảnh hưởng
   * phép tính nào.
   */
  it("trường số bị bỏ trống thành null và được gọi tên, thay vì lặng lẽ thành 0", () => {
    const parsed = parseItinerary({
      days: [{ day: 1, startPoint: "Thành phố Hà Giang", endPoint: "Yên Minh" }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.days[0].waypoints).toEqual([]);
    expect(parsed?.days[0].eveningStay.name).toBe("");
    expect(parsed?.totalKm).toBeNull();
    expect(parsed?.days[0].totalDistanceKm).toBeNull();
    expect(parsed?.missingFields).toEqual(["totalKm"]);
    expect(parsed?.days[0].missingFields).toEqual([
      "totalDistanceKm", "ridingHours", "maxElevationM", "scenicRating",
    ]);
  });

  it("bỏ waypoint hỏng thay vì kéo cả lịch trình xuống", () => {
    const parsed = parseItinerary({
      days: [
        {
          day: 1,
          startPoint: "Thành phố Hà Giang",
          endPoint: "Yên Minh",
          waypoints: [{ time: "07:00", title: "Dốc Bắc Sum" }, { title: "thiếu giờ" }, null],
        },
      ],
    });
    expect(parsed?.days[0].waypoints).toHaveLength(1);
  });
});

describe("KL-07: ba loại lỗi tách nhau", () => {
  /**
   * Trường thiếu là lỗi LƯỢC ĐỒ và phải được gọi tên. Nếu không, bản trước lấp bằng 0 và cả nhóm
   * phép kiểm phụ thuộc nó im lặng bỏ qua — danh sách lỗi trông như đã kiểm hết trong khi có cả
   * một ngày chưa ai đụng tới.
   */
  it("trường thiếu ra lỗi schema, KHÔNG đẻ thêm lỗi ngữ nghĩa giả", () => {
    const issues = checkItinerary(
      plan({ days: [day({ totalDistanceKm: null, ridingHours: null, missingFields: ["totalDistanceKm", "ridingHours"] }), lastDay()] }),
      { days: 2 },
    );
    const missing = issues.filter((issue) => issue.code === "FIELD_MISSING");
    expect(missing).toHaveLength(2);
    expect(missing.every((issue) => issue.kind === "schema")).toBe(true);

    // Không có số thì không có tốc độ để mà vô lý.
    expect(issues.map((issue) => issue.code)).not.toContain("SPEED_IMPLAUSIBLE");
    expect(issues.map((issue) => issue.code)).not.toContain("TOTAL_KM_MISMATCH");
  });

  it("mọi lỗi đều mang mức nghiêm trọng, không có lỗi nào bằng 0", () => {
    const issues = checkItinerary(plan({ days: [day({ endPoint: "Chỗ Không Có Thật" }), lastDay()] }), { days: 2 });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.severity > 0)).toBe(true);
  });

  /**
   * Đây là phép so quyết định vòng lặp sửa có đi tới hay không. Bản sửa bên trái dọn được ba lỗi
   * nhỏ nhưng làm sinh ra một địa danh không có thật; đếm số lượng thì nó "tốt hơn", còn trên
   * thực tế nó vừa gửi khách tới một nơi không tồn tại.
   */
  it("bộ lỗi ÍT HƠN nhưng NẶNG HƠN không được coi là tốt hơn", () => {
    const issue = (code: string): ItineraryIssue => ({
      code, kind: "semantic", severity: severityOf(code), message: code,
    });
    const nhieuLoiNhe = [issue("TIME_FORMAT"), issue("TIME_FORMAT"), issue("DAY_NUMBERING"), issue("WAYPOINT_COUNT")];
    const itLoiNang = [issue("UNKNOWN_PLACE")];

    expect(compareIssueSets(itLoiNang, nhieuLoiNhe)).toBeGreaterThan(0);
    expect(compareIssueSets(nhieuLoiNhe, itLoiNang)).toBeLessThan(0);
    expect(compareIssueSets([], nhieuLoiNhe)).toBeLessThan(0);
  });

  it("cùng mức nặng nhất thì so tổng trọng số, rồi mới tới số lượng", () => {
    const issue = (code: string): ItineraryIssue => ({
      code, kind: "semantic", severity: severityOf(code), message: code,
    });
    const a = [issue("TIME_TOO_LATE"), issue("SPEED_IMPLAUSIBLE")];
    const b = [issue("TIME_TOO_LATE"), issue("TIME_FORMAT")];
    expect(compareIssueSets(b, a)).toBeLessThan(0);
  });

  /**
   * Danh sách gửi cho model đọc từ trên xuống, nên nó phải mở đầu bằng thứ nặng nhất. Lỗi
   * `unverified` bị loại hẳn: model không sửa được chỗ ta thiếu dữ liệu đối chiếu.
   */
  it("khối văn bản gửi model xếp lỗi nặng lên trước và bỏ hẳn lỗi chưa xác minh", () => {
    const text = describeIssues([
      { code: "TIME_FORMAT", kind: "semantic", severity: severityOf("TIME_FORMAT"), message: "giờ sai định dạng" },
      { code: "UNKNOWN_PLACE", kind: "semantic", severity: severityOf("UNKNOWN_PLACE"), message: "địa danh không có thật" },
      { code: "ROUTE_UNVERIFIED", kind: "unverified", severity: 1, message: "chưa có chặng khung để đối chiếu" },
    ]);
    const lines = text.split("\n");
    expect(lines[0]).toContain("địa danh không có thật");
    expect(text).not.toContain("chưa có chặng khung");
  });
});
