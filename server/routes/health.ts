import { Router } from "express";
import type { Request, Response } from "express";
import { config, hasGeminiCredentials, hasGoogleCredentials, hasMapsEmbedKey } from "@server/config";
import { isDatabaseReachable } from "@server/infra/db";
import { asyncRoute } from "@server/middleware/asyncHandler";

export const healthRouter = Router();

/**
 * Health check. Trả riêng trạng thái database và Gemini để khi ứng dụng trông như bị hỏng,
 * ta biết ngay nguyên nhân nằm ở đâu thay vì phải đoán.
 */
healthRouter.get(
  "/health",
  asyncRoute(async (_req: Request, res: Response) => {
    const aiConfigured = hasGeminiCredentials();
    const dbConnected = await isDatabaseReachable();

    /**
     * MẤT DATABASE PHẢI LỘ RA Ở MÃ TRẠNG THÁI, KHÔNG CHỈ Ở MỘT TRƯỜNG TRONG THÂN.
     *
     * Bản trước luôn trả 200 kèm `status: "ok"` kể cả khi `dbConnected` bằng false. Ai cắm
     * endpoint này làm readiness probe cho load balancer — cách dùng hiển nhiên nhất của một
     * đường dẫn tên là /health — thì chỉ kiểm mã 200, và một tiến trình mất hẳn database vẫn
     * được coi là sẵn sàng nhận traffic. Nó sẽ nhận, rồi trả lỗi cho từng khách một.
     *
     * Không có database thì ứng dụng này không làm được gì đáng kể: danh sách điểm đến, đăng
     * nhập, lịch sử hội thoại và lịch trình đã lưu đều đi qua Postgres. Nên 503 là câu trả lời
     * đúng, chứ không phải 200 kèm một lời chú thích.
     *
     * Thân phản hồi giữ nguyên hình dạng để nơi nào đang đọc `dbConnected` vẫn đọc được.
     */
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? "ok" : "degraded",
      dbConnected,
      aiConfigured,
      /**
       * Tên model chỉ lộ ra ngoài production.
       *
       * Ở dev nó trả lời đúng câu hỏi hay gặp nhất khi câu trả lời trở nên lạ: "server đang gọi
       * model nào?". Trên production thì nó chỉ nói cho người đang dò biết cần đọc CVE và mẹo
       * vượt guardrail của model nào — một thông tin không giúp gì cho ai khác. Giữ nguyên khoá
       * `model` với giá trị null để hình dạng phản hồi không đổi giữa hai chế độ.
       */
      model: aiConfigured && !config.isProduction ? config.geminiModel : null,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * Cấu hình công khai cho client. Client ID của Google vốn không phải bí mật, nên gửi qua đây
 * thay vì khai thêm một biến VITE_* thứ hai chứa cùng giá trị. Trả null thì nút đăng nhập
 * Google tự ẩn — không để người dùng bấm vào một nút chắc chắn lỗi.
 */
healthRouter.get("/config", (_req: Request, res: Response) => {
  res.json({
    googleClientId: hasGoogleCredentials() ? config.googleClientId : null,
    /**
     * Khoá Maps Embed. Gửi xuống trình duyệt là ĐÚNG THIẾT KẾ của Maps Embed API, không phải rò
     * rỉ — nhưng chỉ đúng với khoá đã bị giới hạn theo HTTP referrer trong Cloud Console. Tuyệt
     * đối không thay bằng `config.googleMapsApiKey`: khoá đó gọi được cả Routes lẫn Places và
     * phải ở lại phía máy chủ. Xem chú thích ở server/config.ts.
     */
    googleMapsEmbedKey: hasMapsEmbedKey() ? config.googleMapsEmbedKey : null,
  });
});
