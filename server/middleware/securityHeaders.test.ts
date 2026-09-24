import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

/**
 * CSP được dựng MỘT LẦN lúc nạp module (xem `const CSP = buildCsp()`), nên mọi ca kiểm phụ thuộc
 * chế độ chạy phải nạp lại module với biến môi trường khác. Đó là cái giá của việc tính sẵn chuỗi
 * CSP thay vì dựng lại mỗi request — đánh đổi đúng, vì chuỗi đó giống nhau cho mọi request.
 */
async function loadHeaders(env: Record<string, string | undefined>) {
  const saved = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    vi.resetModules();
    const { securityHeaders } = await import("./securityHeaders");

    const headers = new Map<string, string>();
    const res = {
      setHeader: (name: string, value: unknown) => headers.set(name.toLowerCase(), String(value)),
    } as unknown as Response;

    let passed = false;
    const next: NextFunction = () => {
      passed = true;
    };
    securityHeaders({} as Request, res, next);

    return { headers, passed, csp: headers.get("content-security-policy") ?? "" };
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

describe("KB-01: header bảo mật có mặt trên mọi phản hồi", () => {
  it("đặt đủ nhóm header cố định và không chặn request", async () => {
    const { headers, passed } = await loadHeaders({ NODE_ENV: "development" });

    expect(passed).toBe(true);
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
    expect(headers.get("permissions-policy")).toContain("geolocation=()");
  });

  it("HSTS chỉ xuất hiện ở production", async () => {
    const dev = await loadHeaders({ NODE_ENV: "development" });
    expect(dev.headers.has("strict-transport-security")).toBe(false);

    const prod = await loadHeaders({ NODE_ENV: "production" });
    expect(prod.headers.get("strict-transport-security")).toContain("max-age=31536000");
    // Không preload: xem ghi chú ở hằng HSTS.
    expect(prod.headers.get("strict-transport-security")).not.toContain("preload");
  });
});

describe("KB-02: CSP khớp đúng các nguồn ngoài mà trang thật sự dùng", () => {
  it("cho phép bản đồ nhúng, Google Identity và Google Fonts", async () => {
    const { csp } = await loadHeaders({ NODE_ENV: "production" });

    // Thiếu bất kỳ dòng nào dưới đây là một tính năng hỏng trên production: bản đồ trắng, nút
    // đăng nhập Google không hiện, hoặc trang mất font.
    // Cả hai: `/maps/embed/` (có khoá) KHÔNG khớp `/maps/embed?pb=` (không khoá).
    expect(csp).toContain("frame-src https://www.google.com/maps/embed/ https://www.google.com/maps/embed ");
    expect(csp).toContain("https://accounts.google.com/gsi/client");
    expect(csp).toContain("https://accounts.google.com/gsi/style");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
  });

  it("cho phép script và iframe của Cloudflare Turnstile ở form đăng nhập", async () => {
    const { csp } = await loadHeaders({ NODE_ENV: "production" });

    const directive = (name: string) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(name)) ?? "";
    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("frame-src")).toContain("https://challenges.cloudflare.com");
  });

  it("chặn nhúng iframe và plugin, giới hạn base-uri", async () => {
    const { csp } = await loadHeaders({ NODE_ENV: "production" });

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("không cho phép chạy mã nội tuyến hay eval ở production", async () => {
    const { csp } = await loadHeaders({ NODE_ENV: "production" });

    const scriptSrc = csp.split("; ").find((line) => line.startsWith("script-src "));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("nới đúng hai thứ Vite cần ở dev, và chỉ ở dev", async () => {
    const { csp } = await loadHeaders({ NODE_ENV: "development" });

    const scriptSrc = csp.split("; ").find((line) => line.startsWith("script-src "));
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });

  it("CSP_REPORT_ONLY đổi sang header chỉ báo cáo, giữ nguyên nội dung", async () => {
    const { headers } = await loadHeaders({
      NODE_ENV: "production",
      CSP_REPORT_ONLY: "true",
    });

    expect(headers.has("content-security-policy")).toBe(false);
    expect(headers.get("content-security-policy-report-only")).toContain("default-src 'self'");
  });
});
