import type { DateRange, HolidayHit } from "./types";

/** Chỉ là bối cảnh ngày lễ, KHÔNG phải lịch nghỉ hoặc nghỉ bù. Không ngoại suy sau hạn bảng. */
export const HOLIDAY_TABLE_VALID_UNTIL = "2030-12-31";
const LAW_SOURCE = "Bộ luật Lao động, Điều 112; https://congbao.chinhphu.vn/tai-ve-van-ban-so-125-vbhn-vpqh-46084-58727?format=pdf";
const TET_2026 = "https://baochinhphu.vn/tai-nan-giao-thong-giam-trong-ngay-dau-tien-cua-nam-binh-ngo-102260217165027759.htm";
const TET_2027 = "https://bnews.vn/tet-am-lich-2027-roi-vao-ngay-nao-nguoi-lao-dong-nghi-may-ngay/411926.html";
const HUNG_2026 = "https://baochinhphu.vn/trang-trong-le-gio-quoc-to-hung-vuong-tai-cac-dia-phuong-102260426123645229.htm";
const HUNG_2027 = "https://hcmussh.edu.vn/api/tt/storage/download/26661.pdf";

// QĐ-007: chưa tìm được công bố chính thức cho 2028–2030. Chỉ giữ KHOẢNG THÁNG,
// không chép ngày từ lịch Trung Quốc hoặc trình bày ngày dự đoán như đã xác nhận.
const LUNAR_RANGES: readonly HolidayHit[] = [
  { name: "Tết Nguyên đán", start: "2026-02-17", end: "2026-02-17", precision: "approximate", note: `Ngày mùng 1 đã đối chiếu; không xác định kỳ nghỉ. ${TET_2026}` },
  { name: "Tết Nguyên đán", start: "2027-02-06", end: "2027-02-06", precision: "approximate", note: `Nguồn TTXVN/Bnews; không xác định kỳ nghỉ. ${TET_2027}` },
  { name: "Tết Nguyên đán", start: "2028-01-01", end: "2028-01-31", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://agereckoner.com/reference/tet-dates/" },
  { name: "Tết Nguyên đán", start: "2029-02-01", end: "2029-02-28", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://agereckoner.com/reference/tet-dates/" },
  { name: "Tết Nguyên đán", start: "2030-02-01", end: "2030-02-28", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://agereckoner.com/reference/tet-dates/" },
  { name: "Giỗ Tổ Hùng Vương", start: "2026-04-26", end: "2026-04-26", precision: "approximate", note: `Ngày 10/3 âm lịch đã đối chiếu. ${HUNG_2026}` },
  { name: "Giỗ Tổ Hùng Vương", start: "2027-04-16", end: "2027-04-16", precision: "approximate", note: `Kế hoạch dự kiến của ĐH KHXH&NV, không phải công bố lịch nghỉ toàn quốc. ${HUNG_2027}` },
  { name: "Giỗ Tổ Hùng Vương", start: "2028-04-01", end: "2028-04-30", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://publicholidays.vn/vi/hung-kings-commemoration-day/" },
  { name: "Giỗ Tổ Hùng Vương", start: "2029-04-01", end: "2029-04-30", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://demngay.com/con-bao-nhieu-ngay-nua-den-gio-to-hung-vuong/" },
  { name: "Giỗ Tổ Hùng Vương", start: "2030-04-01", end: "2030-04-30", precision: "approximate", note: "Chưa đối chiếu được nguồn chính thức; chỉ dùng khoảng tháng. Tham khảo: https://www.timeanddate.com/calendar/custom.html?country=78&df=1&holm=1&year=2030" },
];

const SOLAR_DAYS = [
  ["Tết Dương lịch", "01-01"],
  ["Ngày Giải phóng miền Nam (30/4)", "04-30"],
  ["Quốc tế Lao động", "05-01"],
  ["Quốc khánh", "09-02"],
] as const;

export const HOLIDAYS: readonly HolidayHit[] = [
  ...[2026, 2027, 2028, 2029, 2030].flatMap((year) => SOLAR_DAYS.map(([name, date]): HolidayHit => ({
    name, start: `${year}-${date}`, end: `${year}-${date}`, precision: "exact", note: LAW_SOURCE,
  }))),
  ...LUNAR_RANGES,
].sort((a, b) => a.start.localeCompare(b.start));

export function findHoliday(range: DateRange): HolidayHit | null {
  if (range.start < "2026-01-01" || range.end > HOLIDAY_TABLE_VALID_UNTIL) return null;
  const hits = HOLIDAYS.filter((holiday) => holiday.start <= range.end && holiday.end >= range.start);
  // Một ngày dương lịch chắc chắn được ưu tiên hơn khoảng tháng âm lịch chưa xác nhận.
  const hit = hits.find((holiday) => holiday.precision === "exact") ?? hits[0];
  return hit ? { ...hit } : null;
}
