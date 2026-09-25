import { createHash } from "node:crypto";
import { config } from "@server/config";
import { prisma } from "@server/infra/db";

/**
 * BỘ ĐẾM HẠN MỨC — một cửa duy nhất cho mọi thứ cần "tối đa N lần trong T giây".
 *
 * Ba nơi dùng nó, và cả ba đều cần cùng một tính chất: giới hạn tần suất theo IP
 * (server/middleware/rateLimit.ts), chặn dò mật khẩu theo email (server/routes/auth.ts) và trần
 * chi phí gọi model (server/infra/aiBudget.ts).
 *
 * VÌ SAO XUỐNG DATABASE. Bản đầu đếm bằng một Map trong tiến trình, và ghi chú ở đó đã nêu đúng
 * hai hệ quả: nhiều instance thì mỗi instance đếm riêng, số đếm mất khi khởi động lại. Với một
 * bộ đếm dùng để chặn dò mật khẩu thì cả hai đều nghiêm trọng hơn vẻ ngoài của chúng — kẻ tấn
 * công chỉ cần rải request cho đủ số instance, hoặc chờ một lần deploy. Postgres đã là phụ thuộc
 * bắt buộc nên dùng nó không thêm hạ tầng mới, khác với Redis.
 *
 * MỌI PHÉP SO THỜI GIAN DÙNG `now()` CỦA POSTGRES, không dùng `Date.now()` của tiến trình web.
 * Nhiều instance nghĩa là nhiều đồng hồ, và một cửa sổ tính bằng đồng hồ lệch là một cửa sổ dài
 * hơn hoặc ngắn hơn mức đã khai — loại sai lệch không bao giờ biểu hiện trên máy phát triển vì ở
 * đó web và database dùng chung một đồng hồ.
 */

interface ConsumeInput {
  /** Khoá thật (chưa băm): "ip:1.2.3.4:/api/auth/login", "login:a@b.c", "ai:global"... */
  key: string;
  /** Nhóm để người vận hành đếm được mà không cần biết danh tính: "ip-path", "login-email"... */
  scope: string;
  windowMs: number;
  max: number;
}

interface ConsumeResult {
  allowed: boolean;
  /** Số lần đã dùng trong cửa sổ hiện tại, tính cả lần này. */
  count: number;
  /** Số giây còn lại của cửa sổ, luôn ≥ 1 để header Retry-After không bao giờ là 0. */
  retryAfterSeconds: number;
}

/**
 * Khoá được băm trước khi ghi.
 *
 * Khoá thật chứa email hoặc địa chỉ IP. Một bảng lưu nguyên văn sẽ dần thành danh sách email đã
 * từng đăng nhập và IP đã từng gọi — dữ liệu không ai định thu thập, không có mục đích sử dụng,
 * nhưng vẫn phải khai báo và vẫn rò được nếu database bị đọc. Băm thì bộ đếm vẫn chạy y nguyên
 * vì nó chỉ cần biết "có phải cùng một khoá hay không".
 *
 * Không thêm muối: muối theo tiến trình sẽ làm mỗi instance băm ra một khoá khác nhau, tức phá
 * đúng tính chất dùng chung mà cả module này tồn tại để có. Băm ở đây không nhằm chống dò ngược
 * một tập giá trị nhỏ, mà nhằm không lưu nguyên văn.
 */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

// Không giữ tiến trình sống chỉ vì timer này.
cleanupTimer.unref?.();

/**
 * Bản đếm trong bộ nhớ. Giữ lại vì hai việc: chạy test đơn vị (không có Postgres) và làm lưới
 * đỡ khi database không trả lời — xem `consume`.
 */
function consumeInMemory({ key, windowMs, max }: ConsumeInput): ConsumeResult {
  const hashed = hashKey(key);
  const now = Date.now();
  const bucket = buckets.get(hashed);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(hashed, { count: 1, resetAt: now + windowMs });
    return { allowed: 1 <= max, count: 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= max,
    count: bucket.count,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Chỉ dùng trong test: xoá sạch bộ đếm trong bộ nhớ giữa hai ca kiểm. */
export function resetMemoryLimits(): void {
  buckets.clear();
}

/**
 * Tăng bộ đếm bằng MỘT câu lệnh duy nhất.
 *
 * Phải là một câu lệnh, không phải đọc-rồi-ghi: hai request tới cùng lúc mà đọc trước rồi ghi sau
 * thì cùng thấy số cũ và cùng ghi số cũ + 1, nên giới hạn 20 lần thực tế cho qua 21, 22... tuỳ độ
 * đồng thời. `INSERT ... ON CONFLICT DO UPDATE` để Postgres khoá hàng đó trong lúc cộng, nên số
 * đếm đúng kể cả khi nhiều instance ghi đồng thời.
 *
 * Nhánh `CASE` là chỗ cửa sổ được mở lại: hàng đã hết hạn thì cộng từ 1 và dời `expiresAt`, thay
 * vì phải xoá hàng cũ bằng một câu lệnh riêng — một câu lệnh riêng lại mở đúng khe đua mà cách
 * làm này tồn tại để đóng.
 */
export async function consumeInDatabase(input: ConsumeInput): Promise<ConsumeResult> {
  const { key, scope, windowMs, max } = input;
  const windowSeconds = windowMs / 1000;

  const rows = await prisma.$queryRaw<{ count: number; retryAfterSeconds: number }[]>`
    INSERT INTO "RateLimit" ("key", "scope", "count", "expiresAt")
    VALUES (
      ${hashKey(key)},
      ${scope},
      1,
      now() + (${windowSeconds}::double precision * interval '1 second')
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."expiresAt" <= now() THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimit"."expiresAt" <= now()
        THEN now() + (${windowSeconds}::double precision * interval '1 second')
        ELSE "RateLimit"."expiresAt"
      END,
      "scope" = ${scope}
    RETURNING
      "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - now()))))::int AS "retryAfterSeconds"
  `;

  const row = rows[0];
  // Không có hàng trả về là chuyện không được phép xảy ra với một upsert có RETURNING. Nếu vẫn
  // xảy ra thì coi như chưa đếm được và cho qua, thay vì chặn người dùng vì một lỗi của ta.
  if (!row) return { allowed: true, count: 0, retryAfterSeconds: 1 };

  const count = Number(row.count);
  return {
    allowed: count <= max,
    count,
    retryAfterSeconds: Number(row.retryAfterSeconds),
  };
}

/**
 * Đã cảnh báo về sự cố store hay chưa. Một database không trả lời sẽ sinh ra đúng một dòng log
 * cho mỗi lần nó hỏng lại, chứ không phải một dòng cho mỗi request — log bị dội thì chính nó trở
 * thành sự cố thứ hai.
 */
let warnedAboutStore = false;

/**
 * Cửa duy nhất mà phần còn lại của server gọi.
 *
 * KHÔNG BAO GIỜ NÉM. Một bộ đếm hỏng không được phép làm hỏng chính request mà nó chỉ có nhiệm vụ
 * đếm. Nhưng cũng không im lặng bỏ qua: khi database không trả lời, nó rơi về bản trong bộ nhớ —
 * bảo vệ yếu hơn (mỗi instance đếm riêng) nhưng vẫn còn bảo vệ, và vẫn còn một dòng log để người
 * vận hành biết mình đang ở chế độ nào.
 */
export async function consume(input: ConsumeInput): Promise<ConsumeResult> {
  if (config.rateLimitStore === "memory") return consumeInMemory(input);

  try {
    const result = await consumeInDatabase(input);
    warnedAboutStore = false;
    return result;
  } catch (error) {
    if (!warnedAboutStore) {
      warnedAboutStore = true;
      console.warn(
        "[rate-limit] không ghi được bộ đếm xuống database, tạm đếm trong bộ nhớ tiến trình:",
        error,
      );
    }
    return consumeInMemory(input);
  }
}

/**
 * ĐỌC bộ đếm mà KHÔNG tăng.
 *
 * Có để phục vụ đúng một kiểu giới hạn: nơi chỉ những lần THẤT BẠI được tính, như chặn dò mật
 * khẩu theo email ở server/routes/auth.ts. Ở đó `consume` một mình không đủ, vì nó tăng bộ đếm
 * cho cả những lần đăng nhập thành công — và một người đăng nhập đúng mười lần trong buổi sáng
 * không phải là kẻ đang dò mật khẩu.
 *
 * Hệ quả cần biết: đọc rồi mới ghi thì có một khe đua. Nhiều request song song cùng đọc được số
 * cũ và cùng đi qua. Khe đó bị chặn bởi giới hạn theo IP đứng trước (một IP không gửi song song
 * vô hạn), nên nó chỉ nới trần thật lên một chút chứ không bỏ trần — khác hẳn với việc dùng
 * đọc-rồi-ghi cho chính phép đếm, là chỗ đã cố tình dùng một câu lệnh duy nhất.
 */
export async function peek(key: string): Promise<{ count: number; retryAfterSeconds: number }> {
  if (config.rateLimitStore === "memory") {
    const bucket = buckets.get(hashKey(key));
    const now = Date.now();
    if (!bucket || bucket.resetAt <= now) return { count: 0, retryAfterSeconds: 0 };
    return {
      count: bucket.count,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  try {
    const rows = await prisma.$queryRaw<{ count: number; retryAfterSeconds: number }[]>`
      SELECT
        "count",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - now()))))::int AS "retryAfterSeconds"
      FROM "RateLimit"
      WHERE "key" = ${hashKey(key)} AND "expiresAt" > now()
    `;
    const row = rows[0];
    if (!row) return { count: 0, retryAfterSeconds: 0 };
    return { count: Number(row.count), retryAfterSeconds: Number(row.retryAfterSeconds) };
  } catch (error) {
    // Cùng nguyên tắc như `consume`: bộ đếm hỏng không được làm hỏng request nó chỉ đi kèm.
    console.warn("[rate-limit] không đọc được bộ đếm:", error);
    return { count: 0, retryAfterSeconds: 0 };
  }
}

/**
 * Xoá các cửa sổ đã hết hạn. Chỉ để bảng không phình theo số IP đã từng gọi — tính đúng đắn không
 * phụ thuộc vào việc này, vì `consume` đã tự mở lại cửa sổ khi gặp hàng hết hạn.
 */
export async function sweepExpiredLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}
