import { expect, it } from "vitest";
import { formatTrace, parseTraceOptions } from "./trace-format";

it("KE-27/28: đọc trace mới, cũ, rỗng và dữ liệu sai hình dạng", () => {
  const text = formatTrace({ path: [
    { node: "nlu", outcome: "ok" },
    { node: "route", outcome: "forced_escalation", reason: "LOW_CONFIDENCE" },
    { node: "escalate", outcome: "ok", detail: "support" },
  ] });
  expect(text.indexOf("nlu")).toBeLessThan(text.indexOf("route"));
  expect(text.indexOf("route")).toBeLessThan(text.indexOf("escalate"));
  expect(text).toContain("LOW_CONFIDENCE");
  expect(formatTrace({ intent: "knowledge", totalMs: 23 })).toContain("Lượt trước khi có đường đi");
  expect(formatTrace(null)).toContain("Không có trace");
  expect(formatTrace({ path: [null, { node: 2 }] })).toContain("node không hợp lệ");
});
it("buộc chọn một phiên hoặc tin nhắn và giới hạn hợp lệ", () => {
  expect(parseTraceOptions(["--session", "s", "--last", "2"])).toMatchObject({ session: "s", last: 2 });
  for (const args of [[], ["--last", "0"], ["--session", "s", "--message", "m"], ["--session"], ["--session", "s", "--last", "1.5"], ["--session", "s", "--last", "101"]]) expect(() => parseTraceOptions(args)).toThrow();
});
