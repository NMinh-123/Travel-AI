import type { Season } from "@data/knowledge/types";
import { seasonsForMonth } from "./season";

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const TEMPORAL_TYPES = [
  "none", "relative_day", "weekend", "week", "month", "month_part", "absolute_date", "holiday",
] as const;
export type TemporalType = (typeof TEMPORAL_TYPES)[number];

export interface DateRange { start: string; end: string }
export interface HolidayHit extends DateRange {
  name: string;
  precision: "exact" | "approximate";
  note: string;
}
export interface TemporalContext {
  queryDate: string;
  travelDate?: string;
  travelDateRange?: DateRange;
  travelMonth?: number;
  travelYear?: number;
  temporalType: TemporalType;
  phrase?: string;
  seasons: Season[];
  holiday: HolidayHit | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Kiểm ngày thực, không cho Date tự cuộn 31/2 sang tháng 3. */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

function isRange(value: unknown): value is DateRange {
  return isRecord(value) && isDateString(value.start) && isDateString(value.end) && value.start <= value.end;
}

function isHoliday(value: unknown): value is HolidayHit {
  return isRecord(value) && isRange(value) && typeof value.name === "string" && value.name.length > 0
    && typeof value.note === "string" && value.note.length > 0
    && (value.precision === "exact" || value.precision === "approximate");
}

function isTemporalType(value: unknown): value is TemporalType {
  return TEMPORAL_TYPES.some((type) => type === value);
}

/** Json được đọc lại qua danh sách trắng; dữ liệu hỏng không làm mất các slot khác. */
export function parseTemporalContext(raw: unknown): TemporalContext | undefined {
  if (!isRecord(raw) || !isDateString(raw.queryDate) || !isTemporalType(raw.temporalType)) return undefined;
  if (!Array.isArray(raw.seasons) || (raw.holiday !== null && !isHoliday(raw.holiday))) return undefined;
  if (raw.phrase !== undefined && (typeof raw.phrase !== "string" || !raw.phrase.trim() || raw.phrase.length > 60)) return undefined;
  if (raw.travelDate !== undefined && !isDateString(raw.travelDate)) return undefined;
  if (raw.travelDateRange !== undefined && !isRange(raw.travelDateRange)) return undefined;
  if (raw.travelDate !== undefined && raw.travelDateRange !== undefined) return undefined;

  const ctx: TemporalContext = { queryDate: raw.queryDate, temporalType: raw.temporalType, seasons: [], holiday: null };
  if (raw.temporalType === "none") {
    return raw.travelDate === undefined && raw.travelDateRange === undefined && raw.travelMonth === undefined
      && raw.travelYear === undefined && raw.seasons.length === 0 && raw.holiday === null ? ctx : undefined;
  }
  if (typeof raw.travelMonth !== "number" || !Number.isInteger(raw.travelMonth) || raw.travelMonth < 1 || raw.travelMonth > 12
    || typeof raw.travelYear !== "number" || !Number.isInteger(raw.travelYear) || raw.travelYear < 1 || raw.travelYear > 9999) return undefined;
  const seasons = seasonsForMonth(raw.travelMonth);
  const storedSeasons = raw.seasons;
  if (storedSeasons.length !== seasons.length || !seasons.every((season) => storedSeasons.includes(season))) return undefined;
  if (isDateString(raw.travelDate)) ctx.travelDate = raw.travelDate;
  if (isRange(raw.travelDateRange)) ctx.travelDateRange = { ...raw.travelDateRange };
  const start = ctx.travelDate ?? ctx.travelDateRange?.start;
  if (start && (Number(start.slice(0, 4)) !== raw.travelYear || Number(start.slice(5, 7)) !== raw.travelMonth)) return undefined;
  if (["relative_day", "absolute_date"].includes(raw.temporalType) && !ctx.travelDate) return undefined;
  if (["weekend", "week", "month_part", "holiday"].includes(raw.temporalType) && !ctx.travelDateRange) return undefined;
  if (raw.temporalType === "month" && start) return undefined;
  if (raw.temporalType === "holiday" && raw.holiday === null) return undefined;
  if (isHoliday(raw.holiday)) {
    const rangeStart = start ?? `${raw.travelYear}-${String(raw.travelMonth).padStart(2, "0")}-01`;
    const rangeEnd = ctx.travelDateRange?.end ?? ctx.travelDate
      ?? new Date(Date.UTC(raw.travelYear, raw.travelMonth, 0)).toISOString().slice(0, 10);
    if (raw.holiday.start > rangeEnd || raw.holiday.end < rangeStart || rangeEnd > "2030-12-31") return undefined;
    ctx.holiday = { name: raw.holiday.name, start: raw.holiday.start, end: raw.holiday.end,
      precision: raw.holiday.precision, note: raw.holiday.note };
  }
  ctx.travelMonth = raw.travelMonth;
  ctx.travelYear = raw.travelYear;
  ctx.seasons = seasons;
  if (typeof raw.phrase === "string") ctx.phrase = raw.phrase;
  return ctx;
}
