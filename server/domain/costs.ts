/**
 * Đơn giá dự toán chi phí — nguồn duy nhất cho cả ứng dụng.
 *
 * Trước Vòng 5, bộ số này nằm trong client/components/PocketGuideSection.tsx và chỉ máy tính chi phí
 * ở tab Cẩm nang dùng tới. Tác tử dự toán kinh phí (FR-BOT-04) cần đúng bộ số đó: hai bảng giá
 * lệch nhau thì khách hỏi chatbot ra một con số, tự bấm máy tính ra con số khác — đúng loại lỗi
 * "hai nguồn dữ liệu cho cùng một thứ" mà Vòng 2 đã dọn.
 *
 * Đây là mặt bằng ước lượng tại thời điểm 09/2026 và sẽ lạc hậu — sửa ở đây là sửa cả bảng dự
 * toán ở giao diện lẫn câu trả lời của chatbot.
 *
 * Vẫn còn một điểm chưa hợp nhất: `pricePerNight` của từng Homestay trong database là giá thật của
 * chỗ đó, còn `stayPerNight` dưới đây là mặt bằng theo kiểu lưu trú. Tác tử dự toán dùng cả hai —
 * mặt bằng để ước tính, giá thật để đối chiếu khi khách đã chọn một homestay cụ thể.
 */
export const COST_ASSUMPTIONS = {
  bikeRentPerDay: 180_000,
  easyRiderPerDay: 900_000,
  fuelPerDay: 100_000,
  stayPerNight: { dorm: 150_000, private_room: 450_000, ecolodge: 900_000 },
  foodPerDay: 300_000,
  /** Vé thuyền Nho Quế + Cột cờ Lũng Cú + Dinh Vua Mèo, tính cho cả chuyến. */
  attractionTickets: 250_000,
  /** Xe giường nằm Hà Nội - Hà Giang, khứ hồi. */
  busHanoiRoundTrip: 600_000,
} as const;

export type RiderType = "self_drive" | "easy_rider";
export type StayStyle = keyof typeof COST_ASSUMPTIONS.stayPerNight;

export interface CostInput {
  days: number;
  riderType: RiderType;
  stayStyle: StayStyle;
  travelers?: number;
}

export interface CostBreakdown {
  days: number;
  nights: number;
  riderType: RiderType;
  stayStyle: StayStyle;
  travelers: number;
  /** Từng khoản, đơn vị VNĐ, tính cho MỘT người. */
  perPerson: {
    bike: number;
    fuel: number;
    stay: number;
    food: number;
    tickets: number;
    bus: number;
    total: number;
  };
  /** Tổng cho cả nhóm. */
  groupTotal: number;
}

/**
 * Công thức giữ nguyên đúng như máy tính chi phí ở tab Cẩm nang, để hai chỗ không bao giờ ra hai
 * kết quả khác nhau cho cùng một đầu vào.
 *
 * Toàn bộ số học nằm ở đây, trong code. Model ngôn ngữ chỉ nhận bảng kết quả này và diễn đạt lại —
 * ràng buộc bắt buộc của SRS Mục 10.4: "mô hình không được phép tự sinh giá".
 */
export function estimateTripCost(input: CostInput): CostBreakdown {
  const days = Math.max(1, Math.round(input.days));
  const nights = Math.max(0, days - 1);
  const travelers = Math.max(1, Math.round(input.travelers ?? 1));

  const bike =
    days *
    (input.riderType === "self_drive"
      ? COST_ASSUMPTIONS.bikeRentPerDay
      : COST_ASSUMPTIONS.easyRiderPerDay);
  const fuel = input.riderType === "self_drive" ? days * COST_ASSUMPTIONS.fuelPerDay : 0;
  const stay = nights * COST_ASSUMPTIONS.stayPerNight[input.stayStyle];
  const food = days * COST_ASSUMPTIONS.foodPerDay;
  const tickets = COST_ASSUMPTIONS.attractionTickets;
  const bus = COST_ASSUMPTIONS.busHanoiRoundTrip;
  const total = bike + fuel + stay + food + tickets + bus;

  return {
    days,
    nights,
    riderType: input.riderType,
    stayStyle: input.stayStyle,
    travelers,
    perPerson: { bike, fuel, stay, food, tickets, bus, total },
    groupTotal: total * travelers,
  };
}
