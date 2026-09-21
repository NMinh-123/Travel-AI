import type { TraceNode } from "./types";

/** Một bộ gom riêng cho mỗi lượt; không cho caller sửa ngược sự kiện đã ghi. */
export class TraceCollector {
  private readonly nodes: TraceNode[] = [];

  push(node: TraceNode): void {
    this.nodes.push({ ...node });
  }

  snapshot(): TraceNode[] {
    return this.nodes.map((node) => ({ ...node }));
  }
}
