import { afterEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

/**
 * Trần đọc từ `config` lúc nạp module, nên mỗi ca kiểm nạp lại module với trần riêng. Nạp lại
 * cũng dựng lại bộ đếm trong bộ nhớ của rateLimitStore, tức mỗi ca kiểm bắt đầu từ số 0 —
 * không cần dọn tay giữa các ca.
 *
 * Bộ test nhanh chạy với RATE_LIMIT_STORE=memory (xem test/setup-env.ts) nên không cần Postgres.
 */
async function loadBudget(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  vi.resetModules();
  return import("./aiBudget");
}

afterEach(() => {
  delete process.env.AI_MAX_MODEL_CALLS_PER_HOUR;
  delete process.env.AI_MAX_TURNS_PER_HOUR;
  delete process.env.AI_GUEST_TURNS_PER_DAY;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("KB-05: trần toàn cục cho lời gọi model", () => {
  it("cho qua đúng số lượt đã khai rồi ném", async () => {
    // Mức error được ghi đúng một lần khi chạm trần; im nó đi để log test không bị dội.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { chargeModelCall, AiBudgetExceededError } = await loadBudget({
      AI_MAX_MODEL_CALLS_PER_HOUR: "2",
    });

    await expect(chargeModelCall()).resolves.toBeUndefined();
    await expect(chargeModelCall()).resolves.toBeUndefined();

    await expect(chargeModelCall()).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(logged).toHaveBeenCalledTimes(1);

    // Lần thứ tư cũng bị chặn, nhưng KHÔNG log thêm: một trần đã chạm thì mọi request sau đó
    // cũng chạm, và một dòng log cho mỗi request sẽ che mất mọi thứ khác.
    await expect(chargeModelCall()).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("lỗi mang theo số giây phải chờ", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { chargeModelCall, AiBudgetExceededError } = await loadBudget({
      AI_MAX_MODEL_CALLS_PER_HOUR: "1",
    });

    await chargeModelCall();
    await expect(chargeModelCall()).rejects.toSatisfy(
      (error) => error instanceof AiBudgetExceededError && error.retryAfterSeconds > 0,
    );
  });

  it("đặt 0 là tắt hẳn, không phải trần bằng 0", async () => {
    const { chargeModelCall } = await loadBudget({ AI_MAX_MODEL_CALLS_PER_HOUR: "0" });

    for (let i = 0; i < 50; i += 1) {
      await expect(chargeModelCall()).resolves.toBeUndefined();
    }
  });
});

describe("KB-06: hạn mức theo giờ của từng danh tính", () => {
  it("hết hạn mức thì từ chối, và mỗi danh tính đếm riêng", async () => {
    const { consumeTurnQuota } = await loadBudget({ AI_MAX_TURNS_PER_HOUR: "2" });

    expect((await consumeTurnQuota("alice")).allowed).toBe(true);
    expect((await consumeTurnQuota("alice")).allowed).toBe(true);

    const blocked = await consumeTurnQuota("alice");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Bob không bị ảnh hưởng bởi hạn mức của Alice.
    expect((await consumeTurnQuota("bob")).allowed).toBe(true);
  });

  it("đặt 0 là tắt", async () => {
    const { consumeTurnQuota } = await loadBudget({ AI_MAX_TURNS_PER_HOUR: "0" });

    for (let i = 0; i < 20; i += 1) {
      expect((await consumeTurnQuota("alice")).allowed).toBe(true);
    }
  });
});

describe("Trần theo ngày cho khách chưa đăng nhập", () => {
  it("khách (danh tính ip:) hết lượt thì bị chặn với lý do guest_daily; tài khoản không bị trần này", async () => {
    const { consumeTurnQuota } = await loadBudget({ AI_GUEST_TURNS_PER_DAY: "3", AI_MAX_TURNS_PER_HOUR: "100" });

    for (let i = 0; i < 3; i += 1) expect((await consumeTurnQuota("ip:1.2.3.4")).allowed).toBe(true);
    const blocked = await consumeTurnQuota("ip:1.2.3.4");
    expect(blocked).toMatchObject({ allowed: false, reason: "guest_daily" });
    // Khoảng chờ tính theo cửa sổ 24 giờ, không phải một giờ.
    expect(blocked.retryAfterSeconds).toBeGreaterThan(60 * 60);

    // IP khác đếm riêng, và người đã đăng nhập không bị trần theo ngày.
    expect((await consumeTurnQuota("ip:5.6.7.8")).allowed).toBe(true);
    for (let i = 0; i < 10; i += 1) expect((await consumeTurnQuota("user-1")).allowed).toBe(true);
  });

  it("đặt 0 là tắt trần theo ngày", async () => {
    const { consumeTurnQuota } = await loadBudget({ AI_GUEST_TURNS_PER_DAY: "0", AI_MAX_TURNS_PER_HOUR: "100" });

    for (let i = 0; i < 30; i += 1) expect((await consumeTurnQuota("ip:1.2.3.4")).allowed).toBe(true);
  });

  it("trần theo giờ vẫn áp cho khách và trả lý do hourly", async () => {
    const { consumeTurnQuota } = await loadBudget({ AI_GUEST_TURNS_PER_DAY: "50", AI_MAX_TURNS_PER_HOUR: "2" });

    await consumeTurnQuota("ip:1.2.3.4");
    await consumeTurnQuota("ip:1.2.3.4");
    expect(await consumeTurnQuota("ip:1.2.3.4")).toMatchObject({ allowed: false, reason: "hourly" });
  });

  it("phản hồi mời đăng nhập, kèm số lượt và mã GUEST_DAILY_LIMIT", async () => {
    const { respondAiBudgetExceeded } = await loadBudget({ AI_GUEST_TURNS_PER_DAY: "15" });
    let status = 0;
    let body: any = null;
    const res = {
      setHeader: () => undefined,
      status(code: number) { status = code; return this; },
      json(payload: unknown) { body = payload; return this; },
    } as unknown as Response;

    respondAiBudgetExceeded(res, 3600, "guest_daily");

    expect(status).toBe(429);
    expect(body.code).toBe("GUEST_DAILY_LIMIT");
    expect(body.error).toContain("15");
    expect(body.details).toMatch(/đăng nhập/i);
  });
});

describe("KB-07: phản hồi khi chạm trần", () => {
  it("trả 429 kèm Retry-After, không phải 503", async () => {
    const { respondAiBudgetExceeded } = await loadBudget({});

    const headers = new Map<string, string>();
    let status = 0;
    let body: any = null;
    const res = {
      setHeader: (name: string, value: unknown) => headers.set(name.toLowerCase(), String(value)),
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    respondAiBudgetExceeded(res, 120);

    expect(status).toBe(429);
    expect(headers.get("retry-after")).toBe("120");
    expect(body.details).toContain("2 phút");
  });
});
