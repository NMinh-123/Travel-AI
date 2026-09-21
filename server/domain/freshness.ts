/**
 * DỮ LIỆU TĨNH VÀ DỮ LIỆU ĐỘNG — một hợp đồng chung cho mọi thứ có thể cũ đi.
 *
 * Dự án có ba loại dữ liệu trộn lẫn trong cùng một câu trả lời, và chúng chịu được ba mức khẳng
 * định khác nhau:
 *
 *  - Dữ liệu KHÔNG cũ: độ cao của một con đèo, tên một món ăn, thứ tự các xã trên một cung đường.
 *  - Dữ liệu ĐO ĐƯỢC tại một thời điểm: nhiệt độ, lượng mưa. Còn hiệu lực trong vài giờ.
 *  - Dữ liệu KHẢO SÁT tại một thời điểm: giá phòng, giờ mở cửa, lịch chợ phiên. Còn hiệu lực
 *    trong vài tháng, và cũ đi mà không có tín hiệu nào báo.
 *
 * Trộn cả ba rồi để model tự diễn đạt là cách một khoảng giá khảo sát nửa năm trước được nói
 * thành "giá hiện tại". Khách đọc câu ấy và tin rằng đó là con số họ sẽ trả.
 *
 * Module này không sửa dữ liệu. Nó trả lời đúng một câu — dữ kiện này còn hiệu lực không — và
 * sinh ra CÂU LỆNH tương ứng cho lời nhắc, để ràng buộc nằm ở một chỗ thay vì rải trong từng
 * chuỗi prompt.
 */

export type Confidence = "verified" | "observed" | "estimated";

export interface Datum {
  /** Thời điểm đo hoặc khảo sát. `null` nghĩa là dữ liệu không gắn với thời điểm nào. */
  observedAt: Date | null;
  /** Thời điểm hết hiệu lực. `null` nghĩa là không hết hạn. */
  expiresAt: Date | null;
  /** Nguồn, để câu trả lời nói được "theo ...". */
  source: string;
  confidence: Confidence;
}

export interface Freshness {
  stale: boolean;
  /** Nhãn ngắn cho người đọc: "số đo lúc 12:15 ngày 21/09", "khảo sát 09/09/2026". */
  label: string;
  /**
   * Câu lệnh gắn vào lời nhắc.
   *
   * Luôn nói ĐƯỢC PHÉP hay KHÔNG ĐƯỢC PHÉP làm gì, không nói về dữ liệu nói chung: một chỉ dẫn
   * mơ hồ ("hãy thận trọng với số liệu") không đổi được gì trong câu model viết ra.
   */
  instruction: string;
}

const DAY_MS = 86_400_000;

function vnDate(value: Date): string {
  const iso = value.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Câu lệnh cấm nói "hiện tại" khi dữ liệu đã hết hiệu lực.
 *
 * Liệt kê đúng những CÁCH NÓI bị cấm thay vì mô tả nguyên tắc. Model tuân theo một danh sách cụ
 * thể tốt hơn nhiều so với một nguyên tắc trừu tượng, và danh sách cũng là thứ kiểm lại được.
 */
const STALE_RULE =
  'KHÔNG được nói "hiện tại", "đang", "hôm nay", "bây giờ" về dữ kiện này. Phải nói rõ đây là ' +
  'số liệu tại thời điểm khảo sát và khuyên khách xác nhận lại với cơ sở trước khi đi.';

const FRESH_RULE =
  'Được phép nói đây là số liệu hiện hành, NHƯNG vẫn phải ghi rõ thời điểm và nguồn.';

export function describeFreshness(datum: Datum, now: Date = new Date()): Freshness {
  const observed = datum.observedAt ? `${datum.confidence === "observed" ? "số đo" : "khảo sát"} ${vnDate(datum.observedAt)}` : "";
  const label = [observed, `nguồn ${datum.source}`].filter(Boolean).join(", ");

  /**
   * Không có hạn thì KHÔNG cũ — và đó là câu trả lời đúng, không phải "không biết".
   *
   * Gộp "không có hạn" với "hết hạn rồi" sẽ gắn cờ cũ lên toàn bộ nội dung biên tập của dự án, và
   * khi mọi thứ đều bị gắn cờ thì cái cờ mất hết ý nghĩa.
   */
  if (datum.expiresAt === null) {
    return { stale: false, label, instruction: datum.confidence === "estimated" ? STALE_RULE : FRESH_RULE };
  }

  const stale = datum.expiresAt.getTime() <= now.getTime();
  return {
    stale,
    label: stale
      ? `${label} — ĐÃ QUÁ HẠN từ ${vnDate(datum.expiresAt)}`
      : `${label}, còn hiệu lực tới ${vnDate(datum.expiresAt)}`,
    instruction: stale ? STALE_RULE : FRESH_RULE,
  };
}

/** Còn bao nhiêu ngày trước khi hết hiệu lực; số âm là đã quá hạn, `null` là không có hạn. */
export function daysLeft(datum: Datum, now: Date = new Date()): number | null {
  if (datum.expiresAt === null) return null;
  return Math.floor((datum.expiresAt.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Hạn hiệu lực của một khoảng giá, suy từ ngày khảo sát.
 *
 * Giá không có cột hạn riêng trong `PriceEstimate` — và thêm một cột để mỗi người soạn tự điền
 * sẽ cho ra một bảng số không nhất quán. Suy tập trung từ `surveyedAt` thì đổi chính sách là đổi
 * đúng một dòng, và bằng đúng hạn của nội dung `estimated` trong kho tri thức.
 */
export const PRICE_TTL_DAYS = 180;

export function priceDatum(surveyedAt: string, source: string, confidence: Confidence): Datum {
  const stamp = Date.parse(`${surveyedAt}T00:00:00Z`);
  const observedAt = Number.isFinite(stamp) ? new Date(stamp) : null;
  return {
    observedAt,
    expiresAt: observedAt ? new Date(observedAt.getTime() + PRICE_TTL_DAYS * DAY_MS) : null,
    source,
    confidence,
  };
}
