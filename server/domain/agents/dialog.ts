import type { Prisma } from "@prisma/client";
import { SLOT_KEYS, type Intent, type Slots } from "./types";
import { parseTemporalContext } from "@server/domain/temporal/types";
import { describeTemporal } from "@server/domain/temporal/router";

/**
 * Bộ quản lý hội thoại (SRS Mục 11.1): duy trì ngữ cảnh xuyên suốt nhiều lượt, cho phép khách bổ
 * sung/điều chỉnh thông tin dần dần thay vì phải cung cấp đầy đủ ngay từ đầu.
 *
 * Trạng thái sống trong cột ChatSession.slots (Json), không trong bộ nhớ tiến trình. Nhờ vậy nó
 * sống sót qua F5, qua restart server và đồng bộ giữa các thiết bị khi khách đã đăng nhập —
 * chính là điều FR-BOT-07 yêu cầu.
 */

/** `slots` lưu dạng Json nên phải kiểm hình dạng trước khi tin, giống cách mappers.ts xử lý days. */
export function parseSlots(value: Prisma.JsonValue | null | undefined): Slots {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const raw = value as Record<string, unknown>;
  const slots: Slots = {};

  if (Array.isArray(raw.destinations)) {
    const list = raw.destinations.filter((item): item is string => typeof item === "string");
    if (list.length) slots.destinations = list;
  }
  for (const key of ["days", "travelers"] as const) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) slots[key] = raw[key] as number;
  }
  for (const key of ["budgetLevel", "travelMode", "vibe", "stayStyle", "notes"] as const) {
    if (typeof raw[key] === "string" && raw[key]) slots[key] = raw[key] as never;
  }
  const temporal = parseTemporalContext(raw.temporal);
  if (temporal) slots.temporal = temporal;
  return slots;
}

/**
 * Gộp thực thể mới vào trạng thái cũ. Giá trị mới luôn ghi đè giá trị cũ — khách nói "à thôi 4
 * ngày" thì phải thắng con số 3 đã nói ở lượt trước. NLU chỉ trích xuất những gì khách nói ra ở
 * lượt hiện tại nên không có nguy cơ giá trị cũ tự ghi đè chính nó.
 *
 * Riêng destinations thì cộng dồn có khử trùng: khách kể thêm địa danh qua nhiều lượt là bổ
 * sung, không phải thay thế.
 */
export function mergeSlots(current: Slots, incoming: Slots): Slots {
  const merged: Slots = { ...current };

  for (const key of SLOT_KEYS) {
    const value = incoming[key];
    if (value === undefined) continue;
    if (key === "destinations") continue;
    (merged as Record<string, unknown>)[key] = value;
  }

  if (incoming.destinations?.length) {
    const seen = new Set((current.destinations ?? []).map((name) => name.toLowerCase()));
    const combined = [...(current.destinations ?? [])];
    for (const name of incoming.destinations) {
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      combined.push(name);
    }
    merged.destinations = combined.slice(-6);
  }

  return merged;
}

/**
 * Slot mà từng tác tử cần trước khi làm việc được. Vòng lặp hỏi bổ sung ở SRS Hình 10.4 bước 4-6
 * chính là hệ quả của bảng này: thiếu slot thì tác tử hỏi thay vì đoán.
 *
 * Cố tình giữ danh sách RẤT ngắn. Hỏi khách bốn câu trước khi trả lời được gì là cách nhanh nhất
 * để họ bỏ đi; tác tử tự chọn mặc định hợp lý cho phần còn lại và nói rõ mình đã giả định gì.
 */
const REQUIRED_SLOTS: Record<Intent, (keyof Slots)[]> = {
  discovery: [],
  itinerary: ["days"],
  // Không đòi `days`: runBudget tự tạm tính 3 ngày và nói rõ giả định. Chặn ở đây thì câu hỏi giá
  // một dịch vụ lẻ ("giá chỗ nghỉ ở Mèo Vạc") bị hỏi ngược "đi mấy ngày" thay vì được trả lời.
  budget: [],
  knowledge: [],
  support: [],
};

export function missingSlots(intent: Intent, slots: Slots): (keyof Slots)[] {
  return REQUIRED_SLOTS[intent].filter((key) => slots[key] === undefined);
}

const SLOT_QUESTIONS: Partial<Record<keyof Slots, string>> = {
  days: "Bạn dự định đi mấy ngày?",
  travelers: "Đoàn mình có mấy người?",
  budgetLevel: "Bạn muốn đi kiểu tiết kiệm, tiện nghi vừa phải hay cao cấp?",
  travelMode: "Bạn tự lái xe máy, đi ô tô hay ngồi sau tài xế Easy Rider?",
  destinations: "Bạn đang muốn tới khu vực nào của Hà Giang?",
};

export function questionFor(slot: keyof Slots): string {
  return SLOT_QUESTIONS[slot] ?? "Bạn bổ sung thêm thông tin giúp mình nhé?";
}

/** Đưa slot vào prompt của tác tử dưới dạng người đọc được, thay vì dán JSON thô. */
export function describeSlots(slots: Slots): string {
  const parts: string[] = [];
  if (slots.destinations?.length) parts.push(`Địa danh quan tâm: ${slots.destinations.join(", ")}`);
  if (slots.days) parts.push(`Số ngày: ${slots.days}`);
  if (slots.travelers) parts.push(`Số người: ${slots.travelers}`);
  if (slots.temporal) parts.push(describeTemporal(slots.temporal));
  if (slots.budgetLevel) parts.push(`Mức ngân sách: ${slots.budgetLevel}`);
  if (slots.travelMode) parts.push(`Phương tiện: ${slots.travelMode}`);
  if (slots.vibe) parts.push(`Phong cách: ${slots.vibe}`);
  return parts.length ? parts.join("\n") : "Khách chưa cung cấp thông tin cụ thể nào.";
}
