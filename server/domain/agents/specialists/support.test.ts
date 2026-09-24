import { describe, expect, it } from "vitest";
import type { EscalationReason } from "@prisma/client";
import type { AgentContext } from "@server/domain/agents/types";
import { runSupport } from "./support";

/** Chưa có CSKH: mọi lý do đều ra thông báo, không hứa nhân viên liên hệ, không gọi model. */
const context = { message: "Giải giúp tôi phương trình bậc hai", slots: {}, history: [] } as unknown as AgentContext;
const REASONS: EscalationReason[] = ["OUT_OF_SCOPE", "LOW_CONFIDENCE", "USER_REQUEST", "URGENT", "COMPLAINT"];

describe("runSupport", () => {
  it.each(REASONS)("%s: thông báo, kèm số khẩn, không hứa chuyển nhân viên", async (reason) => {
    const result = await runSupport(context, reason);

    expect(result.reply).toMatch(/chưa có (đủ thông tin|bộ phận hỗ trợ trực tiếp)/);
    expect(result.reply).toContain("113");
    expect(result.reply).not.toMatch(/chuyển (cho|tới) nhân viên|sẽ liên hệ/);
    expect(result.calls).toEqual([]);
    expect(result.escalation).toMatchObject({ reason });
  });

  it("khách đòi gặp người: số cứu hộ đứng đầu câu", async () => {
    expect((await runSupport(context, "USER_REQUEST")).reply.startsWith("> **Nếu đây là tình huống khẩn")).toBe(true);
  });

  it("câu ngoài phạm vi báo thiếu thông tin", async () => {
    expect((await runSupport(context, "OUT_OF_SCOPE")).reply).toContain("chưa có đủ thông tin");
  });
});
