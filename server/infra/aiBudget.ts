import type { Response } from "express";
import { config } from "@server/config";
import { consume } from "@server/infra/rateLimitStore";

/**
 * TRẦN CHI PHÍ GỌI MODEL — hai tầng, vì có hai kiểu lạm dụng khác nhau.
 *
 * Giới hạn tần suất theo IP (server/middleware/rateLimit.ts) chặn được một người gửi quá nhanh:
 * 20 lượt/phút. Nhưng nó không chặn được hai thứ mà chỉ ở đây chặn được:
 *
 *  - MỘT NGƯỜI GỬI ĐỀU ĐẶN CẢ NGÀY. 20 lượt/phút tức 1.200 lượt/giờ, mỗi lượt vài lời gọi model.
 *    Không có gì sai về tần suất, nhưng hoá đơn thì có. `consumeTurnQuota` đặt trần theo GIỜ cho
 *    từng danh tính, nên tần suất và tổng lượng được chặn bằng hai con số riêng.
 *  - NHIỀU NGƯỜI, HOẶC MỘT NGƯỜI QUA NHIỀU IP. Đây là chỗ giới hạn theo IP hết tác dụng, vì mỗi
 *    IP đều nằm trong hạn mức của nó. `chargeModelCall` đếm TỔNG số lời gọi model của cả hệ
 *    thống, nên số tiền tối đa một giờ là một con số biết trước chứ không phải hệ quả của việc
 *    có bao nhiêu người đang gọi.
 *
 * VÌ SAO KHÔNG ĐẾM LƯỢT NHÚNG (embedding). Chúng đi qua cùng một khoá API nhưng rẻ hơn lời gọi
 * sinh nội dung khoảng ba bậc độ lớn, nên gộp vào cùng một bộ đếm sẽ làm trần mất ý nghĩa: hoá
 * đơn thật bị chi phối bởi số lời gọi sinh nội dung, còn số đếm thì bị chi phối bởi số lượt nhúng.
 * Lượt nhúng trong luồng chat vẫn bị chặn gián tiếp vì mỗi lượt chat chỉ nhúng một lần và chính
 * lượt chat đó đã bị hai tầng trên đếm. Lượt nhúng lúc ingest là việc người vận hành chủ động
 * chạy, không phải thứ do request từ ngoài kích hoạt.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Trần đã chạm. Ném ra từ biên gọi model, nên nó phải nổi lên qua orchestrator giống
 * `AiUnavailableError`: cả hai đều là tình trạng hệ thống, không phải một câu hỏi khó — và nếu bị
 * nuốt thành escalation thì khách nhận một lời xin lỗi vô nghĩa, còn người vận hành mất đúng tín
 * hiệu cần thấy.
 */
export class AiBudgetExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Đã chạm trần số lời gọi model trong giờ này");
    this.name = "AiBudgetExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Đã log lần chạm trần chưa. Chạm trần thì mọi request tiếp theo trong giờ đó cũng chạm, nên log
 * mỗi lần sẽ dội ra hàng nghìn dòng giống nhau và che mất mọi thứ khác.
 */
let warnedAboutGlobalCap = false;

/**
 * Tính một lời gọi sinh nội dung vào trần toàn cục. Ném khi đã hết.
 *
 * Gọi TRƯỚC khi gửi request đi, không phải sau: đếm sau nghĩa là lời gọi thứ N+1 vẫn được trả
 * tiền rồi mới bị chặn.
 */
export async function chargeModelCall(): Promise<void> {
  if (config.aiMaxModelCallsPerHour <= 0) return;

  const result = await consume({
    key: "ai:global",
    scope: "ai-global",
    windowMs: ONE_HOUR_MS,
    max: config.aiMaxModelCallsPerHour,
  });

  if (result.allowed) {
    warnedAboutGlobalCap = false;
    return;
  }

  if (!warnedAboutGlobalCap) {
    warnedAboutGlobalCap = true;
    // Mức error, không phải warn: đây là lúc trợ lý ngừng trả lời cho TẤT CẢ mọi người, và người
    // vận hành phải biết ngay để quyết định nâng trần hay đang bị lạm dụng.
    console.error(
      `[ai-budget] đã chạm trần ${config.aiMaxModelCallsPerHour} lời gọi model/giờ. ` +
        `Trợ lý sẽ trả 429 cho tới khi cửa sổ mới mở (${result.retryAfterSeconds}s). ` +
        `Nâng bằng AI_MAX_MODEL_CALLS_PER_HOUR nếu đây là lưu lượng thật.`,
    );
  }

  throw new AiBudgetExceededError(result.retryAfterSeconds);
}

/**
 * Hạn mức theo giờ cho MỘT danh tính, đếm ở tầng route — tức mỗi lượt người dùng yêu cầu trợ lý
 * làm gì đó là một đơn vị, bất kể lượt đó bên trong tốn mấy lời gọi model.
 *
 * Đếm ở route chứ không ở biên model là có chủ đích: chỉ ở route mới biết ai đang hỏi, và chỉ ở
 * đó mới trả lời được bằng một mã HTTP rõ ràng thay vì một ngoại lệ đi xuyên qua năm tầng.
 *
 * Khách chưa đăng nhập tính theo IP. Đó là thứ tốt nhất có được, và nó kế thừa đúng điểm yếu của
 * mọi giới hạn theo IP: một mạng dùng NAT chung sẽ chia nhau một hạn mức. Vì vậy trần này đặt ở
 * mức mà một người dùng thật không bao giờ với tới.
 */
export interface TurnQuota {
  allowed: boolean;
  retryAfterSeconds: number;
  /** `guest_daily`: khách chưa đăng nhập đã dùng hết lượt trong ngày — trả lời bằng lời mời đăng nhập. */
  reason?: "hourly" | "guest_daily";
}

/**
 * Khách chưa đăng nhập có danh tính dạng `ip:<địa chỉ>` — đúng cách hai route chat và lịch trình
 * dựng khi không có userId.
 */
function isGuest(identity: string): boolean {
  return identity.startsWith("ip:");
}

export async function consumeTurnQuota(identity: string): Promise<TurnQuota> {
  /**
   * TRẦN THEO NGÀY CHO KHÁCH VÃNG LAI, kiểm trước trần theo giờ: khách đã hết lượt trong ngày thì
   * câu trả lời đúng là "đăng nhập để hỏi tiếp", không phải "chờ vài phút".
   *
   * Đếm theo IP nên kế thừa đúng điểm yếu đã nói ở trên: nhiều người sau cùng một NAT (quán cà
   * phê, ký túc xá) chia nhau một hạn mức. Với trần theo ngày thì chạm nhanh hơn trần theo giờ,
   * và lối ra là đăng nhập — tài khoản thì mỗi người đếm riêng.
   */
  if (isGuest(identity) && config.aiGuestTurnsPerDay > 0) {
    const daily = await consume({
      key: `ai:guest:${identity}`,
      scope: "ai-guest",
      windowMs: 24 * ONE_HOUR_MS,
      max: config.aiGuestTurnsPerDay,
    });
    if (!daily.allowed) return { allowed: false, retryAfterSeconds: daily.retryAfterSeconds, reason: "guest_daily" };
  }

  if (config.aiMaxTurnsPerHour <= 0) return { allowed: true, retryAfterSeconds: 0 };

  const result = await consume({
    key: `ai:identity:${identity}`,
    scope: "ai-identity",
    windowMs: ONE_HOUR_MS,
    max: config.aiMaxTurnsPerHour,
  });

  return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds, ...(result.allowed ? {} : { reason: "hourly" as const }) };
}

/**
 * 429 chứ không 503: 503 nói "hệ thống hỏng", còn đây là hệ thống đang chạy đúng như đã khai và
 * từ chối có lý do. `Retry-After` cho client biết chờ bao lâu thay vì thử lại trong vòng lặp.
 */
export function respondAiBudgetExceeded(res: Response, retryAfterSeconds: number, reason?: TurnQuota["reason"]) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  if (reason === "guest_daily") {
    return res.status(429).json({
      error: `Bạn đã dùng hết ${config.aiGuestTurnsPerDay} câu hỏi miễn phí hôm nay`,
      details: "Đăng nhập hoặc tạo tài khoản (miễn phí) để hỏi tiếp.",
      code: "GUEST_DAILY_LIMIT",
    });
  }
  return res.status(429).json({
    error: "Trợ lý AI đang tạm hết hạn mức",
    details: `Bạn vui lòng thử lại sau ${Math.ceil(retryAfterSeconds / 60)} phút.`,
  });
}
