import type { Destination, Homestay, PassWeather } from "@prisma/client";
import { prisma } from "../db";
import { estimateTripCost, type CostBreakdown, type RiderType, type StayStyle } from "../costs";
import type { Slots } from "./types";

/**
 * Lớp "bộ công cụ" của SRS Hình 9.2, nằm giữa các tác tử và dữ liệu.
 *
 * Quy tắc duy nhất của file này: **chỉ truy vấn database, không bao giờ gọi mô hình ngôn ngữ.**
 * Đây là chỗ hiện thực ràng buộc bắt buộc ở SRS Mục 10.4 bước 8-12 — tác tử lấy dữ liệu thật
 * trước, rồi mới đưa cho model diễn đạt. Mọi con số khách nhìn thấy đều bắt nguồn từ đây.
 *
 * Khác với Hình 9.2 ở một điểm và đây là chủ ý: sơ đồ vẽ tool layer gọi "API nội bộ", còn ở đây
 * tool gọi thẳng Prisma. Lý do là toàn bộ hệ thống vẫn nằm trong một tiến trình (modular
 * monolith, SRS Mục 9.1) nên gọi HTTP vào chính mình chỉ thêm một vòng mạng và một điểm hỏng.
 * Khi tách chatbot thành dịch vụ riêng, đổi các hàm dưới đây sang fetch là đủ.
 */

const byOrder = { sortOrder: "asc" } as const;

export interface DestinationFilter {
  categories?: Destination["category"][];
  district?: string;
  maxElevation?: number;
  difficulties?: string[];
  slugs?: string[];
  limit?: number;
}

export async function findDestinations(filter: DestinationFilter = {}): Promise<Destination[]> {
  return prisma.destination.findMany({
    where: {
      ...(filter.categories?.length ? { category: { in: filter.categories } } : {}),
      ...(filter.district ? { district: { contains: filter.district, mode: "insensitive" } } : {}),
      ...(filter.maxElevation ? { elevation: { lte: filter.maxElevation } } : {}),
      ...(filter.difficulties?.length ? { difficulty: { in: filter.difficulties } } : {}),
      ...(filter.slugs?.length ? { slug: { in: filter.slugs } } : {}),
    },
    orderBy: byOrder,
    take: filter.limit ?? 8,
  });
}

/**
 * Khớp tên địa danh do khách gõ với Destination trong DB.
 *
 * Dùng lại đúng ý tưởng của findWaypoint ở HighlandsMap (Vòng 1): chấm điểm theo tỉ lệ từ khoá
 * trùng nhau sau khi bỏ tiền tố hành chính, và **trả về rỗng khi không đủ tin cậy** thay vì đoán
 * bừa. Khách hỏi "Đồng Văn" mà ta trả về Quản Bạ thì tệ hơn hẳn việc nói không tìm thấy.
 */
const ADMIN_PREFIXES = /\b(thi tran|thanh pho|huyen|xa|ban|lang|pho co|deo|doc|nui|thac|hem)\b/g;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(ADMIN_PREFIXES, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_MATCH_THRESHOLD = 0.5;

export async function findDestinationsByName(names: string[]): Promise<Destination[]> {
  if (!names.length) return [];

  const all = await prisma.destination.findMany({ orderBy: byOrder });
  const matched = new Map<string, Destination>();

  for (const rawName of names) {
    const needle = new Set(normalize(rawName).split(" ").filter(Boolean));
    if (needle.size === 0) continue;

    let best: { row: Destination; score: number } | null = null;

    for (const row of all) {
      const haystack = new Set(
        normalize(`${row.vietnameseName} ${row.name} ${row.district}`).split(" ").filter(Boolean),
      );
      let hits = 0;
      for (const token of needle) if (haystack.has(token)) hits += 1;

      const score = hits / needle.size;
      if (score > (best?.score ?? 0)) best = { row, score };
    }

    if (best && best.score >= NAME_MATCH_THRESHOLD) matched.set(best.row.slug, best.row);
  }

  return [...matched.values()];
}

export async function getPassWeather(): Promise<PassWeather[]> {
  return prisma.passWeather.findMany({ orderBy: byOrder });
}

export async function getHomestays(): Promise<Homestay[]> {
  return prisma.homestay.findMany({ orderBy: byOrder });
}

export async function getPresetItineraries() {
  return prisma.presetItinerary.findMany({ orderBy: byOrder });
}

/** Map slot hội thoại sang tham số của máy tính chi phí, kèm giá trị mặc định đã ghi rõ. */
export function slotsToRiderType(slots: Slots): RiderType {
  return slots.travelMode === "easy_rider" ? "easy_rider" : "self_drive";
}

export function slotsToStayStyle(slots: Slots): StayStyle {
  if (slots.stayStyle) return slots.stayStyle;
  if (slots.budgetLevel === "backpacker") return "dorm";
  if (slots.budgetLevel === "luxury") return "ecolodge";
  return "private_room";
}

export interface BudgetToolResult {
  breakdown: CostBreakdown;
  /** Giá thật của homestay đang có trong hệ thống, để đối chiếu với mặt bằng ước tính. */
  homestayPrices: { name: string; location: string; pricePerNight: number }[];
  assumedDays: boolean;
}

/**
 * Toàn bộ số học do code thực hiện — model chỉ nhận bảng kết quả và diễn đạt lại.
 * SRS Mục 11.1: "tính toán dựa trên bảng giá dịch vụ thực tế trong hệ thống (không phải số liệu
 * ước lượng chung chung)".
 */
export async function estimateBudget(slots: Slots): Promise<BudgetToolResult> {
  const assumedDays = !slots.days;
  const homestays = await getHomestays();

  return {
    breakdown: estimateTripCost({
      days: slots.days ?? 3,
      riderType: slotsToRiderType(slots),
      stayStyle: slotsToStayStyle(slots),
      travelers: slots.travelers,
    }),
    homestayPrices: homestays.map((row) => ({
      name: row.name,
      location: row.location,
      pricePerNight: row.pricePerNight,
    })),
    assumedDays,
  };
}
