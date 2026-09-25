import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@server/infra/db";

/**
 * CACHE CỦA TẦNG DỮ LIỆU ĐỘNG, lưu ở bảng `RealtimeCache` trên Postgres.
 *
 * File này thực thi một quy tắc của SRS Mục 11.1.1.11 mà nếu làm sai thì sai rất im lặng: **bản
 * hết hạn không được phục vụ**. Cách làm đúng là đặt điều kiện thời gian NGAY TRONG câu truy vấn
 * đọc. Cách làm sai — đọc hàng ra rồi so `expiresAt` ở tầng ứng dụng — nhìn thì tương đương,
 * nhưng nó khiến tính đúng đắn phụ thuộc vào việc mọi người gọi đều nhớ kiểm tra, và chỉ cần một
 * chỗ quên là chatbot bắt đầu đọc thời tiết của hôm qua mà không có dấu hiệu gì.
 *
 * Hệ quả có chủ đích: bộ quét dọn hàng hết hạn (`sweepExpired`) chỉ là việc dọn dẹp để bảng không
 * phình ra, KHÔNG phải cơ chế bảo đảm đúng đắn. Bộ quét chết thì bảng to lên, nhưng không có một
 * byte dữ liệu quá hạn nào được phục vụ.
 */

/**
 * Sinh khoá cache từ tên tool và tham số.
 *
 * VÌ SAO PHẢI LÀM TRÒN SỐ THỰC TRƯỚC KHI BĂM. Đây là chỗ mà một cache trông như đang hoạt động
 * có thể chưa bao giờ trúng một lần nào. Toạ độ đi qua nhiều phép tính dấu phẩy động sẽ lệch
 * nhau ở chữ số thứ mười lăm, và hai lượt hỏi về đúng cùng một điểm sẽ băm ra hai khoá khác
 * nhau — tỷ lệ trúng cache bằng không, hoá đơn API bằng như không có cache, và không có lỗi nào
 * để lần ra. Làm tròn về bốn chữ số thập phân là khoảng mười mét trên mặt đất, đủ mịn cho mọi
 * mục đích ở đây và đủ thô để triệt tiêu nhiễu dấu phẩy động.
 *
 * VÌ SAO PHẢI SẮP XẾP KHOÁ. `JSON.stringify` giữ thứ tự chèn của đối tượng, nên
 * `{lat, lng}` và `{lng, lat}` cho ra hai chuỗi khác nhau dù cùng nội dung. Sắp xếp khoá làm cho
 * khoá cache phụ thuộc vào GIÁ TRỊ tham số chứ vào cách người viết adapter gõ đối tượng.
 */
export function cacheKey(tool: string, params: Record<string, unknown>): string {
  const normalized = JSON.stringify(normalize(params), replacer);
  return createHash("sha256").update(`${tool}:${normalized}`).digest("hex");
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "number" && !Number.isInteger(value)) {
    return Number(value.toFixed(4));
  }
  return value;
}

/** Sắp xếp khoá đệ quy. Mảng giữ nguyên thứ tự vì với tham số API thì thứ tự mảng có nghĩa. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

interface CachedEntry<T> {
  payload: T;
  source: string;
  /** Thời điểm gọi API gốc, KHÔNG phải lúc đọc cache. Adapter phải truyền lại đúng mốc này. */
  retrievedAt: string;
}

/**
 * Đọc một bản còn hiệu lực. Trả `null` khi không có hoặc đã hết hạn — người gọi không cần biết
 * phân biệt hai trường hợp đó, vì cách xử lý giống nhau: gọi lại API.
 *
 * Điều kiện `expiresAt: { gt: new Date() }` là chỗ quy tắc "hết hạn không phục vụ" được thực thi.
 * Đừng bỏ nó ra ngoài truy vấn.
 */
export async function readCache<T>(key: string): Promise<CachedEntry<T> | null> {
  const row = await prisma.realtimeCache.findFirst({
    where: { key, expiresAt: { gt: new Date() } },
    select: { payload: true, source: true, retrievedAt: true },
  });
  if (!row) return null;

  return {
    payload: row.payload as T,
    source: row.source,
    retrievedAt: row.retrievedAt.toISOString(),
  };
}

/**
 * Ghi hoặc thay một bản cache.
 *
 * `expiresAt` được TÍNH SẴN lúc ghi thay vì suy ra lúc đọc từ `retrievedAt` cộng TTL hiện hành.
 * Chọn như vậy vì đổi `ttlSeconds` trong @data/realtime/providers thì các bản đã ghi vẫn giữ hạn
 * cũ cho tới khi hết — hành vi này dễ hiểu hơn là một lần đổi cấu hình làm hết hạn hoặc gia hạn
 * hàng loạt bản ghi đang dùng.
 */
export async function writeCache(
  key: string,
  tool: string,
  payload: unknown,
  source: string,
  ttlSeconds: number,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const data = {
    tool,
    payload: payload as Prisma.InputJsonValue,
    source,
    retrievedAt: now,
    expiresAt,
  };

  await prisma.realtimeCache.upsert({
    where: { key },
    create: { key, ...data },
    update: data,
  });
}

/**
 * Xoá các bản đã hết hạn. Chỉ để bảng không phình ra — xem ghi chú ở đầu file về việc đây không
 * phải cơ chế bảo đảm đúng đắn. Gọi từ bộ quét định kỳ.
 */
export async function sweepExpired(): Promise<number> {
  const result = await prisma.realtimeCache.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
}
