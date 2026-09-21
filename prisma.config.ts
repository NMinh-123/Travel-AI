/**
 * Prisma không còn nằm ở thư mục mặc định `prisma/`: lược đồ, migration và seed gom về `db/`,
 * còn dữ liệu nguồn để seed thì ở `data/` — công cụ tách khỏi nội dung.
 *
 * Dùng file này thay cho khoá `prisma` trong package.json vì khoá đó đã bị đánh dấu deprecated
 * và sẽ bị bỏ ở Prisma 7.
 *
 * `dotenv/config` là BẮT BUỘC: khi tồn tại prisma.config.ts, Prisma KHÔNG tự nạp `.env` nữa
 * (nó in đúng dòng "Prisma config detected, skipping environment variable loading"). Thiếu
 * import đó thì `DATABASE_URL` rỗng và mọi lệnh `npm run db:*` báo lỗi kết nối — một sự cố rất
 * dễ đổ nhầm cho Docker hay Postgres.
 */
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("db", "schema.prisma"),
  migrations: {
    seed: "tsx db/seed.ts",
  },
});
