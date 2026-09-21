import { expect, it } from "vitest";
import { TraceCollector } from "./trace";
import type { TraceNode } from "./types";

it("KE-13: giữ thứ tự và cách ly snapshot, đầu vào và các lượt", () => {
  const trace = new TraceCollector();
  const node: TraceNode = { node: "nlu", outcome: "ok" };
  trace.push(node);
  node.outcome = "sửa ngoài";
  trace.push({ node: "respond", outcome: "ok" });
  const snapshot = trace.snapshot();
  snapshot[0].outcome = "sửa snapshot";
  snapshot.pop();
  expect(trace.snapshot()).toEqual([
    { node: "nlu", outcome: "ok" }, { node: "respond", outcome: "ok" },
  ]);
  expect(new TraceCollector().snapshot()).toEqual([]);
});
