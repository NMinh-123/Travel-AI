import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@server/infra/db";
import { consumeInDatabase, peek, sweepExpiredLimits } from "@server/infra/rateLimitStore";

/**
 * Bộ đếm hạn mức chạy trên POSTGRES THẬT.
 *
 * `aiBudget.test.ts` đã phủ phần nghiệp vụ với bản đếm trong bộ nhớ. Phần còn thiếu là những thứ
 * chỉ Postgres trả lời được, và đều là những thứ quyết định bộ đếm có bảo vệ được gì hay không:
 * hai request tới ĐỒNG THỜI thì số đếm có đúng không, cửa sổ có tự mở lại không, và bảng có thật
 * sự không lưu nguyên văn email hay không.
 */

const WINDOW_MS = 60_000;

async function rows() {
  return prisma.rateLimit.findMany();
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RateLimit"`);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RateLimit"`);
  await prisma.$disconnect();
});

describe("IT-LIMIT-01: đếm và chặn đúng mốc", () => {
  it("cho qua đúng `max` lượt rồi từ chối", async () => {
    const input = { key: "ip:1.2.3.4:/api/auth/login", scope: "ip-path", windowMs: WINDOW_MS, max: 3 };

    expect((await consumeInDatabase(input)).count).toBe(1);
    expect((await consumeInDatabase(input)).allowed).toBe(true);
    expect((await consumeInDatabase(input)).allowed).toBe(true);

    const blocked = await consumeInDatabase(input);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(4);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("hai khoá khác nhau không ăn vào nhau", async () => {
    const base = { scope: "ip-path", windowMs: WINDOW_MS, max: 1 };

    expect((await consumeInDatabase({ ...base, key: "ip:a:/x" })).allowed).toBe(true);
    expect((await consumeInDatabase({ ...base, key: "ip:b:/x" })).allowed).toBe(true);
    expect((await consumeInDatabase({ ...base, key: "ip:a:/x" })).allowed).toBe(false);
  });
});

describe("IT-LIMIT-02: đếm đúng khi nhiều request tới cùng lúc", () => {
  /**
   * Đây là lý do phép đếm phải là MỘT câu lệnh `INSERT ... ON CONFLICT DO UPDATE` chứ không phải
   * đọc-rồi-ghi. Với đọc-rồi-ghi, mười lượt song song cùng đọc số cũ và cùng ghi số cũ + 1, nên
   * bộ đếm dừng ở 1 hoặc 2 và giới hạn gần như không tồn tại.
   */
  it("mười lượt song song cho ra đúng mười số đếm khác nhau", async () => {
    const input = { key: "ip:dong-thoi:/x", scope: "ip-path", windowMs: WINDOW_MS, max: 5 };

    const results = await Promise.all(Array.from({ length: 10 }, () => consumeInDatabase(input)));

    const counts = results.map((result) => result.count).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
  });
});

describe("IT-LIMIT-03: cửa sổ tự mở lại khi hết hạn", () => {
  it("hàng đã hết hạn được đếm lại từ 1 mà không cần xoá trước", async () => {
    const input = { key: "ip:het-han:/x", scope: "ip-path", windowMs: WINDOW_MS, max: 1 };

    await consumeInDatabase(input);
    expect((await consumeInDatabase(input)).allowed).toBe(false);

    // Đẩy `expiresAt` về quá khứ: mô phỏng cửa sổ đã qua mà không phải chờ thật.
    await prisma.$executeRawUnsafe(`UPDATE "RateLimit" SET "expiresAt" = now() - interval '1 second'`);

    const reopened = await consumeInDatabase(input);
    expect(reopened.count).toBe(1);
    expect(reopened.allowed).toBe(true);
    // Vẫn đúng một hàng: cửa sổ mở lại tại chỗ, không tạo hàng thứ hai.
    expect(await rows()).toHaveLength(1);
  });
});

describe("IT-LIMIT-04: đọc bộ đếm mà không tăng", () => {
  it("peek trả về số hiện tại và không cộng thêm", async () => {
    const input = { key: "login:ai-do@example.com", scope: "login-email", windowMs: WINDOW_MS, max: 5 };

    await consumeInDatabase(input);
    await consumeInDatabase(input);

    expect((await peek(input.key)).count).toBe(2);
    expect((await peek(input.key)).count).toBe(2);
    expect((await consumeInDatabase(input)).count).toBe(3);
  });

  it("khoá chưa từng dùng, hoặc đã hết hạn, đều trả 0", async () => {
    expect((await peek("login:chua-ai-dung@example.com")).count).toBe(0);

    await consumeInDatabase({ key: "login:x@example.com", scope: "login-email", windowMs: WINDOW_MS, max: 5 });
    await prisma.$executeRawUnsafe(`UPDATE "RateLimit" SET "expiresAt" = now() - interval '1 second'`);
    expect((await peek("login:x@example.com")).count).toBe(0);
  });
});

describe("IT-LIMIT-05: bảng không lưu nguyên văn danh tính", () => {
  /**
   * Nếu ca kiểm này đỏ thì bảng đếm đã trở thành một danh sách email và IP — thứ không ai định
   * thu thập, không có mục đích sử dụng, nhưng vẫn rò được nếu database bị đọc.
   */
  it("khoá được băm, chỉ `scope` ở dạng đọc được", async () => {
    await consumeInDatabase({
      key: "login:nguoi-dung-that@example.com",
      scope: "login-email",
      windowMs: WINDOW_MS,
      max: 5,
    });
    await consumeInDatabase({
      key: "ip:203.0.113.7:/api/chat",
      scope: "ip-path",
      windowMs: WINDOW_MS,
      max: 5,
    });

    const stored = await rows();
    const asText = JSON.stringify(stored);

    expect(asText).not.toContain("nguoi-dung-that@example.com");
    expect(asText).not.toContain("203.0.113.7");
    expect(stored.map((row) => row.scope).sort()).toEqual(["ip-path", "login-email"]);
    // sha256 dạng hex: 64 ký tự.
    for (const row of stored) expect(row.key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("IT-LIMIT-06: dọn hàng hết hạn", () => {
  it("xoá hàng đã hết hạn và giữ hàng còn hiệu lực", async () => {
    await consumeInDatabase({ key: "ip:con-han:/x", scope: "ip-path", windowMs: WINDOW_MS, max: 5 });
    await consumeInDatabase({ key: "ip:het-han:/x", scope: "ip-path", windowMs: WINDOW_MS, max: 5 });
    await prisma.$executeRawUnsafe(
      `UPDATE "RateLimit" SET "expiresAt" = now() - interval '1 hour' WHERE "scope" = 'ip-path' AND "count" = 1`,
    );
    // Cả hai hàng đều count = 1 nên câu trên đẩy cả hai; đặt lại một hàng về tương lai để phân biệt.
    const all = await rows();
    await prisma.rateLimit.update({
      where: { key: all[0].key },
      data: { expiresAt: new Date(Date.now() + WINDOW_MS) },
    });

    expect(await sweepExpiredLimits()).toBe(1);
    expect(await rows()).toHaveLength(1);
  });
});
