import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      /**
       * Client build nằm riêng trong dist/client, tách khỏi dist/server.cjs mà esbuild sinh ra.
       * Server chỉ phục vụ tĩnh thư mục này, nên bundle server và sourcemap của nó không bị
       * express.static đem ra ngoài.
       */
      outDir: 'dist/client',
      emptyOutDir: true,
    },
    resolve: {
      /**
       * Phải khớp với "paths" trong tsconfig.json. Vite không đọc tsconfig paths, nên hai chỗ
       * này lệch nhau là kiểu lỗi khó chịu nhất: tsc báo xanh còn trang trắng ở trình duyệt.
       * Client chỉ được phép chạm @client và @shared; @server/@data không khai ở đây có chủ ý,
       * để một import nhầm sang mã server hỏng ngay lúc build chứ không lọt vào bundle.
       */
      alias: {
        '@client': path.resolve(import.meta.dirname, 'client'),
        '@shared': path.resolve(import.meta.dirname, 'shared'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
