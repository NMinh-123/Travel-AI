import type { Prisma } from "@prisma/client";

function isObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Đọc JSON lịch sử, không ép nó thành TurnTrace mới. Không in trường chưa biết. */
export function formatTrace(trace: Prisma.JsonValue): string {
  if (!isObject(trace)) return "  Không có trace.";
  if (!Array.isArray(trace.path)) {
    const fields = ["intent", "confidence", "agent", "grounding", "retrievedDocIds", "citedDocIds", "unsupportedFacts", "escalated", "totalMs", "nluMs", "agentMs", "calls", "retrieval"];
    const legacy = Object.fromEntries(fields.filter((key) => key in trace).map((key) => [key, trace[key]]));
    return `  Lượt trước khi có đường đi.\n${JSON.stringify(legacy, null, 2)}`;
  }
  return trace.path.map((entry) => {
    if (!isObject(entry) || typeof entry.node !== "string" || typeof entry.outcome !== "string") return "  [node không hợp lệ]";
    return `  ${entry.node.padEnd(14)} ${entry.outcome.padEnd(18)} ${typeof entry.detail === "string" ? entry.detail : ""}` +
      (typeof entry.reason === "string" ? ` reason: ${entry.reason}` : "") +
      (typeof entry.ms === "number" ? ` ${entry.ms}ms` : "");
  }).join("\n");
}

export function parseTraceOptions(args: string[]): { session?: string; message?: string; last: number; help: boolean } {
  const result: { session?: string; message?: string; last: number; help: boolean } = { last: 10, help: false };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error("Tham số trùng");
    seen.add(key);
    if (key === "--help") { result.help = true; continue; }
    if (!["--session", "--message", "--last"].includes(key)) throw new Error("Tham số không hợp lệ");
    const value = args[++i];
    if (!value?.trim() || value.startsWith("--")) throw new Error("Thiếu giá trị tham số");
    if (key === "--session") result.session = value;
    else if (key === "--message") result.message = value;
    else {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100) throw new Error("--last phải từ 1 đến 100");
      result.last = Number(value);
    }
  }
  if (!result.help && Boolean(result.session) === Boolean(result.message)) throw new Error("Chọn đúng một --session hoặc --message");
  return result;
}
