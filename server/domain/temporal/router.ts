import { HOLIDAYS, HOLIDAY_TABLE_VALID_UNTIL, findHoliday } from "./holidays";
import { SEASON_LABELS, seasonsForMonth } from "./season";
import { isDateString, VN_TIME_ZONE, type TemporalContext, type TemporalType } from "./types";

const DAY_MS = 86_400_000;
const PRIORITY: Record<TemporalType, number> = {
  absolute_date: 0, holiday: 1, month_part: 2, weekend: 3, relative_day: 4, week: 5, month: 6, none: 7,
};
const TIME_ZONE_OFFSETS: Readonly<Record<string, number>> = {
  "Asia/Ho_Chi_Minh": 420,
  "Asia/Bangkok": 420,
};

/** Tên thứ -> chỉ số của `Date.getUTCDay()`. Nhận cả dạng số vì khách hay gõ "thứ 7". */
const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  "chủ nhật": 0,
  "thứ hai": 1, "thứ 2": 1,
  "thứ ba": 2, "thứ 3": 2,
  "thứ tư": 3, "thứ 4": 3,
  "thứ năm": 4, "thứ 5": 4,
  "thứ sáu": 5, "thứ 6": 5,
  "thứ bảy": 6, "thứ 7": 6,
};

interface WeekdayHit { weekday: number; suffix?: string }

/** Tách "thứ bảy tới" thành thứ trong tuần và hậu tố; `null` nếu cụm không phải thứ nào cả. */
function weekdayMatch(text: string): WeekdayHit | null {
  const matched = text.match(/^(chủ nhật|thứ (?:hai|ba|tư|năm|sáu|bảy|[2-7]))(?: (này|tới|sau))?$/);
  if (!matched) return null;
  const weekday = WEEKDAY_INDEX[matched[1]];
  return weekday === undefined ? null : { weekday, suffix: matched[2] };
}

function iso(stamp: number): string { return new Date(stamp).toISOString().slice(0, 10); }
function date(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function monthEnd(year: number, month: number): string { return iso(Date.UTC(year, month, 0)); }

function resolvePhrase(phrase: string, queryDate: string): TemporalContext | undefined {
  const text = phrase.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
  const year = Number(queryDate.slice(0, 4));
  const month = Number(queryDate.slice(5, 7));
  const queryStamp = Date.parse(`${queryDate}T00:00:00Z`);
  const ctx: TemporalContext = { queryDate, temporalType: "none", phrase, seasons: [], holiday: null };
  const absolute = text.match(/^(\d{1,2})([/-])(\d{1,2})(?:\2(\d{4}))?$/);
  const monthPart = text.match(/^(đầu|giữa|cuối) tháng (\d{1,2})$/);
  const monthMatch = text.match(/^tháng (sau|\d{1,2})$/);
  if (absolute) {
    const day = Number(absolute[1]);
    const targetMonth = Number(absolute[3]);
    const explicitYear = absolute[4] ? Number(absolute[4]) : undefined;
    if (explicitYear !== undefined && (explicitYear < year || explicitYear > year + 5)) return undefined;
    for (let candidate = explicitYear ?? year; candidate <= (explicitYear ?? year + 5); candidate++) {
      const value = date(candidate, targetMonth, day);
      if (isDateString(value) && (explicitYear !== undefined || value >= queryDate)) {
        ctx.travelDate = value;
        break;
      }
    }
    if (!ctx.travelDate) return undefined;
    ctx.temporalType = "absolute_date";
  } else if (/^(?:dịp )?(?:tết(?: nguyên đán| âm lịch| dương lịch)?|giỗ tổ(?: hùng vương)?|0?2\/0?9|30\/0?4|0?1\/0?5)$/.test(text)) {
    const name = text.includes("dương lịch") ? "Tết Dương lịch"
      : text.includes("tết") ? "Tết Nguyên đán"
      : text.includes("giỗ") ? "Giỗ Tổ Hùng Vương"
      : /2\/0?9/.test(text) ? "Quốc khánh"
      : /30\/0?4/.test(text) ? "Ngày Giải phóng miền Nam (30/4)" : "Quốc tế Lao động";
    const holiday = HOLIDAYS.find((item) => item.name === name && item.end >= queryDate);
    if (!holiday) return undefined;
    ctx.temporalType = "holiday";
    ctx.travelDateRange = { start: holiday.start, end: holiday.end };
    ctx.holiday = { ...holiday };
  } else if (monthPart || monthMatch) {
    let targetMonth = monthMatch?.[1] === "sau" ? month + 1 : Number(monthPart?.[2] ?? monthMatch?.[1]);
    if (targetMonth < 1 || targetMonth > (monthMatch?.[1] === "sau" ? 13 : 12)) return undefined;
    let targetYear = year;
    if (targetMonth === 13) { targetMonth = 1; targetYear++; }
    else if (targetMonth < month) targetYear++;
    ctx.travelMonth = targetMonth;
    ctx.travelYear = targetYear;
    ctx.temporalType = monthPart ? "month_part" : "month";
    if (monthPart) {
      const part = monthPart[1];
      ctx.travelDateRange = {
        start: date(targetYear, targetMonth, part === "đầu" ? 1 : part === "giữa" ? 11 : 21),
        end: part === "cuối" ? monthEnd(targetYear, targetMonth) : date(targetYear, targetMonth, part === "đầu" ? 10 : 20),
      };
    }
  } else if (/^cuối tuần( này| sau| tới)?$/.test(text) || text === "tuần sau") {
    const monday = queryStamp - ((new Date(queryStamp).getUTCDay() + 6) % 7) * DAY_MS;
    // "cuối tuần" trần và "cuối tuần này" là một; chỉ "sau" mới đẩy sang tuần kế.
    const next = text.endsWith("sau") ? 7 : 0;
    const weekend = text.startsWith("cuối");
    ctx.temporalType = weekend ? "weekend" : "week";
    ctx.travelDateRange = { start: iso(monday + (next + (weekend ? 5 : 0)) * DAY_MS), end: iso(monday + (next + 6) * DAY_MS) };
  } else if (weekdayMatch(text) !== null) {
    /**
     * Thứ trong tuần quy về MỘT ngày cụ thể, luôn là ngày trong tương lai gần nhất.
     *
     * Ba hậu tố cho ba ý khác nhau, và gộp chúng lại là hiểu sai lịch của khách: "thứ bảy" (hoặc
     * "thứ bảy này") là thứ bảy sắp tới, kể cả khi hôm nay đã là thứ bảy thì vẫn là hôm nay;
     * "thứ bảy tới" thì hôm nay không tính, phải là lần kế tiếp; "thứ bảy sau" là của tuần kế.
     */
    const { weekday, suffix } = weekdayMatch(text) as WeekdayHit;
    const current = new Date(queryStamp).getUTCDay();
    let offset = (weekday - current + 7) % 7;
    if (suffix === "tới" && offset === 0) offset = 7;
    if (suffix === "sau") offset += 7;
    ctx.temporalType = "relative_day";
    ctx.travelDate = iso(queryStamp + offset * DAY_MS);
  } else {
    const offset = text === "hôm nay" ? 0 : ["mai", "ngày mai"].includes(text) ? 1 : ["mốt", "ngày kia"].includes(text) ? 2 : undefined;
    if (offset === undefined) return undefined;
    ctx.temporalType = "relative_day";
    ctx.travelDate = iso(queryStamp + offset * DAY_MS);
  }
  const start = ctx.travelDate ?? ctx.travelDateRange?.start;
  if (start) {
    ctx.travelMonth = Number(start.slice(5, 7));
    ctx.travelYear = Number(start.slice(0, 4));
  }
  ctx.seasons = seasonsForMonth(ctx.travelMonth);
  ctx.holiday ??= findHoliday({
    start: start ?? date(ctx.travelYear, ctx.travelMonth, 1),
    end: ctx.travelDate ?? ctx.travelDateRange?.end ?? monthEnd(ctx.travelYear, ctx.travelMonth),
  });
  return ctx;
}

/** Hàm thuần: now bắt buộc, không đọc đồng hồ hay ghi log. Thứ tự mảng là thứ tự cụm trong câu. */
export function resolve(phrases: readonly string[], now: Date, timeZone = VN_TIME_ZONE): TemporalContext {
  if (!Object.hasOwn(TIME_ZONE_OFFSETS, timeZone)) throw new RangeError(`Múi giờ không hỗ trợ: ${timeZone}`);
  const offset = TIME_ZONE_OFFSETS[timeZone];
  if (!Number.isFinite(now.getTime())) throw new RangeError("Thời điểm hiện tại không hợp lệ");
  const queryDate = iso(now.getTime() + offset * 60_000);
  let selected: TemporalContext = { queryDate, temporalType: "none", seasons: [], holiday: null };
  for (const phrase of phrases) {
    if (typeof phrase !== "string" || !phrase.trim() || phrase.length > 60) continue;
    const candidate = resolvePhrase(phrase, queryDate);
    if (candidate && PRIORITY[candidate.temporalType] < PRIORITY[selected.temporalType]) selected = candidate;
  }
  return selected;
}

/** Cảnh báo hết hạn nằm trong chuỗi trả về để resolver giữ tính thuần. */
export function describeTemporal(ctx: TemporalContext): string {
  const parts: string[] = [];
  if (ctx.temporalType === "none") return "Chưa xác định thời gian đi.";
  const approximate = ctx.temporalType === "holiday" && ctx.holiday?.precision === "approximate";
  if (ctx.travelDate) parts.push(`Ngày đi dự kiến: ${ctx.travelDate}.`);
  else if (ctx.travelDateRange && !approximate) parts.push(`Khoảng đi dự kiến: ${ctx.travelDateRange.start} đến ${ctx.travelDateRange.end}.`);
  parts.push(`Dự kiến đi vào tháng ${ctx.travelMonth}/${ctx.travelYear}.`);
  parts.push(ctx.seasons.length ? `Mùa Hà Giang: ${ctx.seasons.map((season) => SEASON_LABELS[season]).join("; ")}.` : "Bảng mùa chưa ghi nhận mùa đặc trưng cho tháng này.");
  if (ctx.holiday) {
    const holidayMonth = Number(ctx.holiday.start.slice(5, 7));
    parts.push(ctx.holiday.precision === "approximate"
      ? `Có thể trùng dịp ${ctx.holiday.name} ${ctx.holiday.start.slice(0, 4)} (khoảng tháng ${holidayMonth}); chưa xác nhận ngày cụ thể, không phải lịch nghỉ.`
      : `Trùng dịp ${ctx.holiday.name}; không bao gồm lịch nghỉ bù.`);
  }
  const end = ctx.travelDate ?? ctx.travelDateRange?.end ?? date(ctx.travelYear, ctx.travelMonth, 1);
  if (end > HOLIDAY_TABLE_VALID_UNTIL) parts.push("Chưa có dữ liệu ngày lễ sau 31/12/2030; cần tra cứu lại.");
  return parts.join("\n");
}
