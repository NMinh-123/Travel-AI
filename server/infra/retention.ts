import { config } from "@server/config";
import { prisma } from "@server/infra/db";
import { sweepRealtimeCache } from "@server/infra/realtime/index";
import { sweepExpiredLimits } from "@server/infra/rateLimitStore";

/**
 * THỜI HẠN LƯU TRỮ — xoá những gì không còn lý do giữ.
 *
 * VÌ SAO PHIÊN CỦA KHÁCH VÃNG LAI CẦN CÓ THỜI HẠN. `loadSession` ở server/routes/chat.ts cho phép
 * bất kỳ ai cầm id đọc một phiên chưa gắn tài khoản. Đó là thiết kế đúng cho tính năng đó — SRS
 * Mục 7.2 cho khách trò chuyện mà không cần đăng nhập, nên id phiên (một cuid ngẫu nhiên nằm
 * trong localStorage) chính là thứ duy nhất chứng minh "tôi là người đã gõ những câu này".
 *
 * Nhưng một id là chứng cứ duy nhất thì mọi đường nó rò ra đều thành đường đọc được hội thoại:
 * một máy dùng chung, một bản backup localStorage, một liên kết ai đó dán đi. Và nội dung phiên
 * thì lưu NGUYÊN VĂN chưa che dữ liệu cá nhân — đúng như ghi chú ở ChatMessage.content và ở
 * server/domain/agents/pii.ts: việc che chỉ áp ở biên gửi ra API ngoài, không áp cho lưu trữ nội
 * bộ. Nghĩa vụ với dữ liệu đã lưu vì thế là THỜI HẠN, và đây là chỗ thực thi nó.
 *
 * Phiên ĐÃ GẮN TÀI KHOẢN thì không bị chạm tới: nó thuộc về một người có thể đăng nhập để đọc
 * lại lịch sử của mình (FR-BOT-07), và xoá nó là xoá một tính năng. Dữ liệu đó đi theo tài khoản
 * và biến mất cùng tài khoản nhờ `onDelete: Cascade` — xem chú thích ở endpoint xoá tài khoản
 * trong server/routes/me.ts.
 */

/**
 * Xoá phiên chưa gắn tài khoản và đã im lặng quá thời hạn.
 *
 * Mốc tính theo `lastActiveAt`, không phải `startedAt`: một phiên mở từ tuần trước nhưng vừa được
 * nhắn thêm hôm nay vẫn là phiên đang dùng. Tin nhắn và bản ghi chuyển tiếp đi cùng nhờ
 * `onDelete: Cascade` trên hai quan hệ của ChatSession.
 */
export async function pruneGuestSessions(): Promise<number> {
  if (config.guestSessionRetentionDays <= 0) return 0;

  const cutoff = new Date(
    Date.now() - config.guestSessionRetentionDays * 24 * 60 * 60 * 1000,
  );

  const result = await prisma.chatSession.deleteMany({
    where: { userId: null, lastActiveAt: { lt: cutoff } },
  });
  return result.count;
}

/**
 * Một lượt quét. Không ném lỗi ra ngoài: một bảng quét hỏng không được làm chết vòng lặp, và
 * cũng không được làm chết những bảng còn lại — nên mỗi việc có try/catch riêng.
 */
export async function sweepOnce(): Promise<void> {
  try {
    const removed = await pruneGuestSessions();
    // Chỉ log khi có xoá thật: một dòng "đã xoá 0 phiên" mỗi ngày là tiếng ồn.
    if (removed > 0) console.log(`[retention] đã xoá ${removed} phiên chat quá thời hạn.`);
  } catch (error) {
    console.error("[retention] không dọn được phiên chat của khách:", error);
  }

  try {
    await sweepExpiredLimits();
  } catch (error) {
    console.error("[retention] không dọn được bộ đếm hạn mức:", error);
  }

  /**
   * Cache dữ liệu động: `sweepExpired` ở server/infra/realtime/cache.ts vốn đã có sẵn kèm ghi chú
   * "Gọi từ bộ quét định kỳ", nhưng trước bản này không có bộ quét nào gọi nó — nên bảng
   * RealtimeCache chỉ lớn lên, không bao giờ nhỏ lại. Tính đúng đắn không phụ thuộc vào việc dọn
   * (mọi lượt đọc đều lọc theo `expiresAt`), chỉ có dung lượng là phụ thuộc.
   */
  try {
    await sweepRealtimeCache();
  } catch (error) {
    console.error("[retention] không dọn được cache dữ liệu động:", error);
  }
}

/**
 * Mỗi ngày một lượt. Không cần mịn hơn: thời hạn tính bằng ngày, nên quét mỗi giờ chỉ làm cùng
 * một việc 24 lần.
 */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Lượt đầu hoãn một phút, cùng lý do như bộ làm mới thời tiết đèo: mấy giây đầu sau khi server
 * lên là lúc máy bận nhất, và một lượt DELETE trên nhiều bảng không có gì gấp.
 */
const FIRST_RUN_DELAY_MS = 60_000;

/**
 * Bật bộ quét. `unref()` cho cả hai bộ hẹn giờ để chúng không giữ tiến trình sống — tắt server
 * thì chúng tắt theo, thay vì treo thêm tới một ngày chờ nhịp kế tiếp.
 *
 * Chạy trong chính tiến trình web, không thêm dịch vụ hẹn giờ bên ngoài. Hệ quả cần biết khi chạy
 * NHIỀU INSTANCE: mỗi instance sẽ tự quét, nên cùng một lượt xoá có thể chạy song song vài lần.
 * Điều đó vô hại ở đây vì cả ba việc đều là `deleteMany` theo điều kiện — chạy hai lần cho cùng
 * một kết quả, lần sau chỉ xoá 0 hàng.
 */
export function startRetentionSweep(): NodeJS.Timeout {
  const first = setTimeout(() => void sweepOnce(), FIRST_RUN_DELAY_MS);
  first.unref();

  const timer = setInterval(() => void sweepOnce(), SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
