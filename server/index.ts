import path from "path";
import http from "http";
import express from "express";
import { browsableUrl, config, hasGeminiCredentials } from "@server/config";
import { ensureEmbeddingSidecar } from "@server/infra/embeddingSidecar";
import { createApp } from "@server/app";
import { startPassWeatherRefresh } from "@server/infra/realtime/passWeatherRefresh";
import { startRetentionSweep } from "@server/infra/retention";

/**
 * Điểm vào duy nhất của tiến trình web. Chỉ làm ba việc: dựng http server, gắn Vite (dev) hoặc
 * thư mục tĩnh (production), rồi lắng nghe. Toàn bộ định tuyến nằm ở server/routes/index.ts.
 */
async function startServer() {
  const app = createApp();

  /**
   * Tự dựng http server thay vì app.listen(): chế độ dev cần đưa chính server này cho Vite làm
   * kênh HMR (xem bên dưới), còn app.listen() thì không trả ra đối tượng đó trước khi lắng nghe.
   */
  const httpServer = http.createServer(app);

  if (!config.isProduction) {
    /**
     * Sidecar embedding bật trước Vite để việc nạp model BGE-M3 chạy song song với thời gian
     * Vite dựng dev server, thay vì nối tiếp. Hàm này không ném lỗi và không chặn: thiếu sidecar
     * thì ứng dụng vẫn lên, chỉ là tầng truy xuất hỏng — xem chú thích trong module đó.
     *
     * Chỉ ở dev. Trên production, sidecar là một dịch vụ được vận hành riêng, không phải thứ
     * tiến trình web tự spawn.
     */
    await ensureEmbeddingSidecar();

    /**
     * HMR đi chung cổng với ứng dụng, qua nâng cấp WebSocket trên chính httpServer.
     *
     * Ở chế độ middleware, mặc định Vite mở một WebSocket server RIÊNG ở cổng 24678 cố định —
     * không đổi theo PORT. Chạy hai instance dev cùng lúc, hoặc còn sót một tiến trình dev cũ,
     * thì instance sau báo "WebSocket server error: Port 24678 is already in use" rồi VẪN khởi
     * động bình thường: trang tải được nhưng HMR chết, sửa file không thấy cập nhật và cũng
     * không có lỗi nào ở màn hình. Dùng chung cổng thì cổng nào chạy được app, cổng đó chạy HMR.
     *
     * DISABLE_HMR vẫn có hiệu lực: cờ đó tắt HMR trong vite.config.ts, nên chỉ nối kênh khi nó
     * không được bật — nếu không, cấu hình nội tuyến này sẽ ghi đè và bật lại HMR.
     */
    /**
     * Vite được nạp ĐỘNG, và chỉ trong nhánh dev.
     *
     * Trước đây nó là một `import` ở đầu file, nên `dist/server.cjs` mở đầu bằng
     * `require("vite")` và câu lệnh đó chạy ngay khi nạp module — không cần biết `isProduction`
     * bằng gì. Máy chủ production cài bằng `npm ci --omit=dev` sẽ không có gói đó, và tiến trình
     * chết ở dòng đầu tiên với `Cannot find module 'vite'` trước khi kịp in bất cứ log nào.
     *
     * Lỗi ấy bị che suốt vì `vite` từng được khai ở CẢ `dependencies` lẫn `devDependencies`: npm
     * lấy theo `dependencies` nên gói vẫn có mặt, và bản build vẫn chạy. Chỉ cần ai đó dọn mục
     * trùng đó về đúng chỗ — điều hoàn toàn nên làm — là production hỏng ngay. Nạp động thì bản
     * build không còn phụ thuộc vào một chi tiết khai báo may rủi.
     */
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(process.env.DISABLE_HMR === "true" ? {} : { hmr: { server: httpServer } }),
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    /**
     * Chỉ phục vụ dist/client. Bản build server (dist/server.cjs) và sourcemap của nó nằm
     * cùng nhánh dist; trỏ express.static vào cả dist sẽ công khai luôn mã nguồn server.
     */
    const distPath = path.join(process.cwd(), "dist", "client");
    /**
     * File trong /assets/ có hash nội dung trong tên (Vite đặt), nên cache một năm là an toàn:
     * deploy mới thì tên đổi. Không đặt vậy thì Express gửi max-age=0 và Cloudflare hỏi lại máy
     * chủ ở MỌI lượt tải (đo được: MISS rồi REVALIDATED). index.html giữ mặc định để luôn lấy
     * bản mới, vì nó là thứ trỏ tới các tên file mới đó.
     */
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "365d", fallthrough: false }),
    );
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(config.port, config.host, () => {
    console.log(`Cinematic Highlands Server running on ${browsableUrl()}`);
    if (!hasGeminiCredentials()) {
      console.warn(
        "⚠  GEMINI_API_KEY chưa được thiết lập — các endpoint AI sẽ trả về HTTP 503.",
      );
    }
    // Một điểm cuối AI bị đổi âm thầm là thứ rất khó truy khi câu trả lời trở nên lạ, nên nó
    // được in ra lúc khởi động thay vì chỉ nằm trong .env.
    if (config.geminiBaseUrl) {
      console.log(`Gemini đi qua điểm cuối tuỳ chỉnh: ${config.geminiBaseUrl}`);
    }

    /**
     * Số đo các đỉnh đèo được hâm sẵn mỗi giờ, để tab An toàn đèo không bắt ai phải chờ lượt gọi
     * mạng đầu tiên. Đặt sau `listen` chứ không trước: server phải nhận request được ngay, còn
     * lượt làm mới đầu tiên chạy nền và hỏng cũng không cản việc khởi động.
     */
    startPassWeatherRefresh();

    /**
     * Bộ quét thời hạn lưu trữ: xoá phiên chat của khách vãng lai đã quá hạn, dọn bộ đếm hạn mức
     * và cache dữ liệu động đã hết hạn. Cùng lý do đặt sau `listen` như trên — server phải nhận
     * request được ngay, còn một lượt DELETE nền thì không gấp.
     */
    startRetentionSweep();
  });
}

startServer();
