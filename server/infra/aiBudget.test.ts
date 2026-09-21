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
