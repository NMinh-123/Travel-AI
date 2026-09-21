import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

/**
 * `config` đọc biến môi trường một lần lúc nạp module, nên các ca kiểm về ALLOWED_ORIGINS và
 * TRUST_PROXY phải nạp lại module — cùng cách làm như securityHeaders.test.ts.
 */
async function run(
  init: { method: string; headers: Record<string, string> },
  env: Record<string, string | undefined> = {},
) {
  const saved = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    vi.resetModules();
    const { originCheck } = await import("./originCheck");

    const headers = Object.fromEntries(
      Object.entries(init.headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    const req = {
      method: init.method,
      path: "/api/auth/login",
      get: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;

    let status = 0;
    let body: unknown = null;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    let passed = false;
    const next: NextFunction = () => {
      passed = true;
    };
    originCheck(req, res, next);

    return { passed, status, body };
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

describe("KB-03: chỉ chặn request thay đổi dữ liệu đến từ trang khác", () => {
  it("bỏ qua GET, kể cả khi Origin là trang lạ", async () => {
    // Đọc dữ liệu không phải CSRF: kẻ tấn công không đọc được phản hồi nếu không có CORS, và
    // chặn GET theo Origin sẽ làm hỏng mọi lượt tải trang bình thường.
    const result = await run({
      method: "GET",
      headers: { origin: "https://ke-tan-cong.example", host: "ha-giang.example" },
    });
    expect(result.passed).toBe(true);
  });

  it("cho qua khi không có Origin: đó là client không phải trình duyệt", async () => {
    const result = await run({ method: "POST", headers: { host: "ha-giang.example" } });
    expect(result.passed).toBe(true);
  });

  it("cho qua khi Origin trùng host của chính request", async () => {
    const result = await run({
      method: "POST",
      headers: { origin: "https://ha-giang.example", host: "ha-giang.example" },
    });
    expect(result.passed).toBe(true);
  });

  it("giao thức lệch nhau vẫn qua: reverse proxy cắt TLS là chuyện bình thường", async () => {
    const result = await run({
      method: "POST",
      headers: { origin: "https://ha-giang.example", host: "ha-giang.example" },
    });
    expect(result.passed).toBe(true);
  });

  it("chặn 403 khi Origin là một trang khác", async () => {
    const result = await run({
      method: "POST",
      headers: { origin: "https://ke-tan-cong.example", host: "ha-giang.example" },
    });
    expect(result.passed).toBe(false);
    expect(result.status).toBe(403);
  });

  it("chặn cả khi Origin không phân giải được thành URL", async () => {
    const result = await run({
      method: "POST",
      headers: { origin: "khong-phai-url", host: "ha-giang.example" },
    });
    expect(result.passed).toBe(false);
    expect(result.status).toBe(403);
  });

  it("thông báo lỗi không nêu host nào được phép", async () => {
    const result = await run({
      method: "POST",
      headers: { origin: "https://ke-tan-cong.example", host: "ha-giang.example" },
    });
    expect(JSON.stringify(result.body)).not.toContain("ha-giang.example");
  });
});

describe("KB-04: nguồn host tin cậy phụ thuộc cấu hình proxy", () => {
  it("ALLOWED_ORIGINS thay cho phép so theo host của request", async () => {
    const allowed = await run(
      {
        method: "POST",
        headers: { origin: "https://ha-giang.example", host: "noi-bo:3000" },
      },
      { ALLOWED_ORIGINS: "https://ha-giang.example" },
    );
    expect(allowed.passed).toBe(true);

    // Khai ALLOWED_ORIGINS thì chính host của request KHÔNG còn tự động được tin.
    const blocked = await run(
      { method: "POST", headers: { origin: "http://noi-bo:3000", host: "noi-bo:3000" } },
      { ALLOWED_ORIGINS: "https://ha-giang.example" },
    );
    expect(blocked.passed).toBe(false);
  });

  it("X-Forwarded-Host chỉ được tin khi TRUST_PROXY đã khai", async () => {
    // Không khai proxy: header do client tự đặt được, nên tin nó là tự bỏ phép kiểm.
    const untrusted = await run(
      {
        method: "POST",
        headers: {
          origin: "https://ke-tan-cong.example",
          "x-forwarded-host": "ke-tan-cong.example",
          host: "ha-giang.example",
        },
      },
      { TRUST_PROXY: undefined },
    );
    expect(untrusted.passed).toBe(false);

    // Có proxy thật: origin công khai khớp X-Forwarded-Host, còn Host là địa chỉ nội bộ.
    const trusted = await run(
      {
        method: "POST",
        headers: {
          origin: "https://ha-giang.example",
          "x-forwarded-host": "ha-giang.example",
          host: "10.0.0.5:3000",
        },
      },
      { TRUST_PROXY: "1" },
    );
    expect(trusted.passed).toBe(true);
  });
});
