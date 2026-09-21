import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@server/infra/db";
import { cacheKey, readCache, writeCache } from "./cache";

/**
 * Quy tắc "bản hết hạn không được phục vụ" được thực thi bằng điều kiện thời gian NGAY TRONG câu
 * truy vấn đọc. Đó là một tính chất của SQL, nên nó chỉ kiểm được trên Postgres thật — một test
 * thuần sẽ chỉ kiểm lại phép so sánh mà chính nó vừa viết ra.
 */

const TOOL = "weather";

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RealtimeCache"`);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RealtimeCache"`);
  await prisma.$disconnect();
});

describe("IT-CACHE-01: bản còn hạn được phục vụ, bản hết hạn thì không", () => {
  it("đọc lại được bản vừa ghi", async () => {
    const key = cacheKey(TOOL, { placeSlug: "dong-van" });
    await writeCache(key, TOOL, { tempC: 24.5 }, "open-meteo", 600);
    const entry = await readCache<{ tempC: number }>(key);
    expect(entry?.payload.tempC).toBe(24.5);
    expect(entry?.source).toBe("open-meteo");
  });

  it("TTL đã qua thì trả null, KHÔNG trả dữ liệu cũ", async () => {
    // TTL âm nên `expiresAt` nằm ở quá khứ ngay lúc ghi. Nếu điều kiện thời gian bị đưa ra khỏi
    // câu truy vấn, bài này sẽ đỏ — và đó đúng là kiểu hỏng khiến chatbot đọc thời tiết hôm qua.
    const key = cacheKey(TOOL, { placeSlug: "meo-vac" });
    await writeCache(key, TOOL, { tempC: 18 }, "open-meteo", -1);
    expect(await readCache(key)).toBeNull();
  });

  it("hàng hết hạn vẫn NẰM trong bảng — dọn dẹp là việc khác, không phải cơ chế đúng đắn", async () => {
    const key = cacheKey(TOOL, { placeSlug: "quan-ba" });
    await writeCache(key, TOOL, { tempC: 20 }, "open-meteo", -1);
    const count = await prisma.realtimeCache.count({ where: { key } });
    expect(count).toBe(1);
    expect(await readCache(key)).toBeNull();
  });

  it("ghi đè cùng khoá thì gia hạn chứ không nhân bản hàng", async () => {
    const key = cacheKey(TOOL, { placeSlug: "dong-van" });
    await writeCache(key, TOOL, { tempC: 1 }, "open-meteo", -1);
    await writeCache(key, TOOL, { tempC: 2 }, "open-meteo", 600);
    expect(await prisma.realtimeCache.count({ where: { key } })).toBe(1);
    const entry = await readCache<{ tempC: number }>(key);
    expect(entry?.payload.tempC).toBe(2);
  });
});

describe("IT-CACHE-02: khoá cache phụ thuộc giá trị tham số, không phụ thuộc cách gõ", () => {
  it("thứ tự khoá khác nhau vẫn ra cùng một khoá cache", async () => {
    // `JSON.stringify` giữ thứ tự chèn, nên thiếu bước sắp xếp thì hai lượt hỏi cùng một điểm sẽ
    // băm ra hai khoá và tỷ lệ trúng cache bằng không — không có lỗi nào để lần ra.
    expect(cacheKey(TOOL, { lat: 23.1, lng: 105.3 })).toBe(cacheKey(TOOL, { lng: 105.3, lat: 23.1 }));
  });

  it("nhiễu dấu phẩy động ở chữ số thứ mười lăm không tạo khoá mới", async () => {
    const a = cacheKey(TOOL, { lat: 23.1, lng: 105.3 });
    const b = cacheKey(TOOL, { lat: 23.1 + 1e-15, lng: 105.3 });
    expect(a).toBe(b);

    // Nhưng lệch ở mức có nghĩa thật thì vẫn phải là hai khoá khác nhau.
    expect(cacheKey(TOOL, { lat: 23.2, lng: 105.3 })).not.toBe(a);
  });

  it("hai tool khác nhau không dùng chung khoá", async () => {
    expect(cacheKey("weather", { x: 1 })).not.toBe(cacheKey("route", { x: 1 }));
  });
});
