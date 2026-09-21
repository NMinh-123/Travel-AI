import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@server/infra/db";
import { pruneGuestSessions } from "@server/infra/retention";

/**
 * THỜI HẠN LƯU TRỮ chạy trên Postgres thật, vì thứ cần kiểm là một câu `deleteMany` có điều kiện
 * và hai dây `onDelete: Cascade` — không có cái nào kiểm được bằng database giả.
 *
 * Ranh giới quan trọng nhất ở đây là ranh giới GIỮA HAI NHÓM PHIÊN: phiên chưa gắn tài khoản có
 * thời hạn, phiên đã gắn tài khoản thì không. Xoá nhầm nhóm thứ hai là xoá lịch sử hội thoại của
 * một người đang dùng sản phẩm (FR-BOT-07), nên nó có ca kiểm riêng.
 */

/** `lastActiveAt` là `@updatedAt` nên Prisma luôn tự đặt; lùi ngày phải đi qua SQL thô. */
async function backdate(sessionId: string, days: number) {
  await prisma.$executeRawUnsafe(
    `UPDATE "ChatSession" SET "lastActiveAt" = now() - ($1 || ' days')::interval WHERE "id" = $2`,
    String(days),
    sessionId,
  );
}

async function makeSession(userId: string | null): Promise<string> {
  const session = await prisma.chatSession.create({ data: { userId } });
  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: "USER", content: "Số của tôi là 0982123456" },
  });
  return session.id;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ChatEscalation", "ChatMessage", "ChatSession" CASCADE`,
  );
  await prisma.user.deleteMany({ where: { email: "chu-phien@example.com" } });
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ChatEscalation", "ChatMessage", "ChatSession" CASCADE`,
  );
  await prisma.user.deleteMany({ where: { email: "chu-phien@example.com" } });
  await prisma.$disconnect();
});

describe("IT-RETENTION-01: chỉ phiên khách vãng lai quá hạn bị xoá", () => {
  it("giữ phiên của tài khoản và phiên còn mới, xoá phiên khách đã im lặng quá lâu", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "chu-phien@example.com",
        name: "Chủ phiên",
        avatar: "https://example.invalid/a.svg",
      },
    });

    const guestOld = await makeSession(null);
    const guestRecent = await makeSession(null);
    const accountOld = await makeSession(owner.id);

    // Mặc định giữ 30 ngày: 40 ngày là quá hạn, 5 ngày thì chưa.
    await backdate(guestOld, 40);
    await backdate(guestRecent, 5);
    await backdate(accountOld, 400);

    expect(await pruneGuestSessions()).toBe(1);

    const remaining = (await prisma.chatSession.findMany({ select: { id: true } })).map(
      (row) => row.id,
    );
    expect(remaining.sort()).toEqual([accountOld, guestRecent].sort());
  });

  it("tin nhắn của phiên bị xoá đi theo, không để lại hàng mồ côi", async () => {
    const guestOld = await makeSession(null);
    await backdate(guestOld, 40);

    expect(await prisma.chatMessage.count()).toBe(1);
    await pruneGuestSessions();
    expect(await prisma.chatMessage.count()).toBe(0);
  });

  it("không có gì quá hạn thì không xoá gì", async () => {
    const guest = await makeSession(null);
    await backdate(guest, 1);

    expect(await pruneGuestSessions()).toBe(0);
    expect(await prisma.chatSession.count()).toBe(1);
  });
});
