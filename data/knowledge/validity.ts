import type { KnowledgeSourceClass, KnowledgeSourceDoc } from "./types";

/**
 * HẠN TIN CẬY CỦA NỘI DUNG, và các phép suy quanh nó.
 *
 * Trước đây chính sách này nằm trong `scripts/ingest-plan.ts`, tức chỉ bước ingest biết tới nó.
 * Hệ quả là bộ xác thực dữ liệu không thể hỏi "tài liệu này đã hết hạn chưa", nên một tài liệu
 * crawl từ hai năm trước vẫn đi qua mọi phép kiểm và được nạp vào kho với trạng thái APPROVED.
 * Chuyển xuống `data/` để cả hai phía dùng CHUNG một bảng số: hướng phụ thuộc đúng là
 * `scripts/` đọc `data/`, không ngược lại.
 */

/**
 * Nội dung ngoài (crawl, ước lượng) hết hạn tin cậy sau mốc này kể từ ngày đối chiếu.
 *
 * Hai con số khác nhau vì hai loại nội dung trượt với tốc độ khác nhau. Giá và thông tin thương
 * mại đổi theo mùa và theo chủ cơ sở, nên nửa năm đã là rộng rãi. Nội dung mô tả lấy từ web —
 * đường đi, lịch chợ phiên, đặc điểm địa hình — ổn định hơn nhiều, một năm là hợp lý.
 */
export const EXTERNAL_TTL_DAYS: Record<Exclude<KnowledgeSourceClass, "editorial">, number> = {
  estimated: 180,
  crawled_verified: 365,
};

const DAY_MS = 86_400_000;

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) ? new Date(stamp) : null;
}

/**
 * Hạn tin cậy của một tài liệu; `null` nghĩa là không có hạn.
 *
 * Nội dung biên tập của dự án KHÔNG có hạn — người viết chịu trách nhiệm và sửa khi cần. Nội dung
 * lấy từ web và nội dung ước lượng thì có, vì chúng chụp lại một thời điểm: một khoảng giá khảo
 * sát từ hai năm trước trông y hệt một khoảng giá mới, và đó là lý do cột này tồn tại.
 *
 * Suy tập trung chứ không để mỗi tài liệu tự khai: một chính sách tập trung thì đổi được cho cả
 * kho bằng một dòng, còn để rải ra thì mỗi lần đổi phải sửa từng file và sẽ luôn sót.
 */
export function validUntilFor(doc: KnowledgeSourceDoc): Date | null {
  if (doc.sourceClass === "editorial") return null;
  const verified = toDate(doc.retrievedAt);
  if (!verified) return null;
  return new Date(verified.getTime() + EXTERNAL_TTL_DAYS[doc.sourceClass] * DAY_MS);
}

/**
 * Tài liệu đã quá hạn tin cậy tính tới `now` chưa.
 *
 * Không có hạn thì không bao giờ quá hạn — đó là nội dung biên tập, và câu trả lời phải là `false`
 * chứ không phải "không biết". Trộn hai thứ đó sẽ khiến toàn bộ nội dung của dự án bị gắn cờ cũ.
 */
export function isExpired(doc: KnowledgeSourceDoc, now: Date): boolean {
  const until = validUntilFor(doc);
  return until !== null && until.getTime() <= now.getTime();
}

/** Số ngày còn lại trước khi hết hạn; số âm nghĩa là đã quá hạn, `null` nghĩa là không có hạn. */
export function daysUntilExpiry(doc: KnowledgeSourceDoc, now: Date): number | null {
  const until = validUntilFor(doc);
  if (until === null) return null;
  return Math.floor((until.getTime() - now.getTime()) / DAY_MS);
}
