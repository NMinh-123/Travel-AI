import { Router } from "express";
import type { Request, Response } from "express";
import { AiUnavailableError, respondAiUnavailable } from "@server/infra/gemini";
import {
  AiBudgetExceededError,
  consumeTurnQuota,
  respondAiBudgetExceeded,
} from "@server/infra/aiBudget";
import { optionalUserId } from "@server/middleware/auth";
import { rateLimit } from "@server/middleware/rateLimit";
import { ItineraryGenerationError, generateItinerary } from "@server/domain/itinerary";
import {
  BUDGET_LEVELS,
  TRAVEL_MODES,
  VIBES,
  type ItineraryRequest,
} from "@server/domain/prompts";

export const itineraryRouter = Router();

const MIN_TRIP_DAYS = 1;
const MAX_TRIP_DAYS = 14;

interface ParseResult {
  value?: ItineraryRequest;
  error?: string;
}

function parseItineraryRequest(body: any): ParseResult {
  const days = Number(body?.days);
  if (!Number.isInteger(days) || days < MIN_TRIP_DAYS || days > MAX_TRIP_DAYS) {
    return { error: `Số ngày phải là số nguyên từ ${MIN_TRIP_DAYS} đến ${MAX_TRIP_DAYS}` };
  }

  const travelMode = body?.travelMode;
  if (!TRAVEL_MODES.includes(travelMode)) {
    return { error: `Phương tiện không hợp lệ (chọn: ${TRAVEL_MODES.join(", ")})` };
  }

  const vibe = body?.vibe;
  if (!VIBES.includes(vibe)) {
    return { error: `Phong cách không hợp lệ (chọn: ${VIBES.join(", ")})` };
  }

  const budget = body?.budget;
  if (!BUDGET_LEVELS.includes(budget)) {
    return { error: `Mức ngân sách không hợp lệ (chọn: ${BUDGET_LEVELS.join(", ")})` };
  }

  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

  /**
   * Số người là tuỳ chọn và chỉ ảnh hưởng bảng chi phí, nên giá trị hỏng KHÔNG làm cả yêu cầu
   * thất bại — nó lùi về một người, đúng như khi khách không khai. Trần 20 để một con số vô lý
   * không kéo tổng chi phí thành một câu chuyện cười.
   */
  const rawTravelers = Number(body?.travelers);
  const travelers =
    Number.isInteger(rawTravelers) && rawTravelers >= 1 && rawTravelers <= 20 ? rawTravelers : undefined;

  return { value: { days, travelMode, vibe, budget, notes, travelers } };
}

/**
 * Lõi sinh lịch trình nằm ở @server/domain/itinerary và được dùng chung với tác tử itinerary
 * trong luồng hội thoại, để hai đường vào không trả về hai kết quả khác nhau cho cùng một
 * yêu cầu. Route này chỉ lo phần kiểm đầu vào và ánh xạ lỗi sang mã HTTP.
 */
/**
 * Endpoint này KHÔNG có giới hạn tần suất trước bản này, và nó là bề mặt đắt nhất của cả hệ
 * thống: không cần đăng nhập, dùng model mạnh, và vòng lặp sửa trong `generateItinerary` có thể
 * gọi model vài lượt cho một request. Nói cách khác, bất kỳ ai cũng lập được một vòng lặp gọi nó.
 *
 * Chặt hơn nhóm chat (20 lượt/phút) vì một người dùng thật không dựng mười lịch trình trong một
 * phút, còn mỗi lượt ở đây tốn nhiều lần một lượt chat.
 */
const itineraryLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: "Bạn đang tạo lịch trình quá nhanh",
});

itineraryRouter.post("/plan-itinerary", itineraryLimiter, async (req: Request, res: Response) => {
  const parsedRequest = parseItineraryRequest(req.body);
  if (!parsedRequest.value) {
    return res.status(400).json({ error: parsedRequest.error ?? "Yêu cầu không hợp lệ" });
  }

  try {
    /**
     * Hạn mức theo giờ dùng chung một bộ đếm với chatbot: cả hai đều là "người này nhờ trợ lý làm
     * một việc", nên chúng phải cộng vào cùng một trần thay vì mỗi bề mặt có một trần riêng để
     * lách qua. Khách chưa đăng nhập tính theo IP.
     */
    const quota = await consumeTurnQuota((await optionalUserId(req, res)) ?? `ip:${req.ip ?? "unknown"}`);
    if (!quota.allowed) return respondAiBudgetExceeded(res, quota.retryAfterSeconds, quota.reason);

    const { plan } = await generateItinerary(parsedRequest.value);
    /**
     * Trả 200 kèm `plan.validation` NGAY CẢ KHI lịch trình còn lỗi, chứ không đổi sang 502.
     *
     * Một lịch trình còn vướng vài điểm vẫn dùng được: khách sửa được từng ngày trong trình lập
     * lịch trình, và quăng đi cả kết quả để bắt sinh lại thì tốn thêm một lượt model mà chưa chắc
     * lần sau sạch hơn. Điều bắt buộc là KHÔNG im lặng — `validation.valid` và `validation.issues`
     * đi kèm trong phản hồi, còn `validation.routes` nói rõ chặng nào chưa đối chiếu được quãng
     * đường. Giao diện quyết định hiển thị thế nào; server không được giấu.
     */
    return res.json(plan);
  } catch (error: any) {
    if (error instanceof AiUnavailableError) return respondAiUnavailable(res);
    if (error instanceof AiBudgetExceededError) {
      return respondAiBudgetExceeded(res, error.retryAfterSeconds);
    }

    if (error instanceof ItineraryGenerationError) {
      return res.status(502).json({
        error: error.message,
        details: "Bạn vui lòng thử lại, hoặc điều chỉnh phần ghi chú thêm.",
      });
    }

    console.error("Gemini itinerary error:", error);
    return res.status(502).json({
      error: "Không thể tạo lịch trình",
      details: error?.message ?? "Vui lòng thử lại sau giây lát.",
    });
  }
});
