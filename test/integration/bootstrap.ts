import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * DỰNG DATABASE RIÊNG CHO TEST INTEGRATION.
 *
 * Test integration GHI và XOÁ dữ liệu — nhóm ingest kiểm đúng ba việc đó. Chạy chúng trên
 * `travelai` sẽ sửa dữ liệu dev đã seed, nên phải có một database riêng dựng lại được từ đầu.
 *
 * DÙNG `prisma migrate deploy`, ĐÚNG NHƯ PRODUCTION.
 *
 * Bản trước dùng `db push`, vì lúc đó lịch sử migration thiếu bảy mục và dựng từ migration sẽ ra
 * một lược đồ khác lược đồ đang chạy. Bảy mục đó nay đã được khôi phục và đối chiếu lại với
 * `_prisma_migrations` (xem scripts/migration-check.ts), nên chỗ đi vòng ấy không còn lý do tồn
 * tại — và giữ nó lại thì có hại: `db push` đọc thẳng `schema.prisma`, nên nó CHE mất đúng loại
 * hỏng mà người ta cần biết nhất, là chuỗi migration không còn dựng lại được database.
 *
 * Dựng bằng migration khiến mỗi lần chạy test integration cũng là một lần chứng minh
 * `migrate deploy` chạy được từ database rỗng. Không cần bài kiểm riêng cho việc đó.
 *
 * Extension `vector`, `unaccent` và cấu hình tìm kiếm `vietnamese` KHÔNG còn được tạo ở đây:
 * chúng nằm trong chính migration `20260906000000_chat_and_knowledge`. Tạo lại ở ngoài sẽ làm
 * bài kiểm nói dối — nếu một ngày migration đánh rơi phần đó, test vẫn xanh còn production hỏng.
 */

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL?.trim() || "postgresql://travel:travel@127.0.0.1:5432/travelai_test";

function maintenanceUrl(): string {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

function databaseName(): string {
  return new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
}

async function createDatabase(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: maintenanceUrl() } } });
  try {
    // Postgres không có `CREATE DATABASE IF NOT EXISTS`, và tên database không tham số hoá được,
    // nên phải nội suy. An toàn vì tên lấy từ biến môi trường của người chạy test chứ không từ
    // đầu vào người dùng, và vẫn chặn ký tự lạ để không ai vô tình chạy hai câu lệnh.
    const name = databaseName();
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Tên database test không hợp lệ: ${name}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } catch (error) {
    // 42P04 = duplicate_database. Đã có thì thôi, đó là trường hợp bình thường khi chạy lại.
    const code = (error as { meta?: { code?: string } })?.meta?.code;
    const message = error instanceof Error ? error.message : String(error);
    if (code !== "42P04" && !message.includes("already exists")) throw error;
  } finally {
    await admin.$disconnect();
  }
}

export async function bootstrapTestDatabase(): Promise<void> {
  await createDatabase();
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
      shell: process.platform === "win32",
    });
  } catch (error) {
    /**
     * `migrate deploy` in phần hữu ích ra stdout chứ không ra thông điệp của Error, nên không
     * chuyển tiếp thì người chạy test chỉ nhận được "Command failed" và không biết migration nào
     * hỏng ở câu lệnh nào.
     */
    const output = (error as { stdout?: Buffer; stderr?: Buffer });
    const detail = [output.stdout?.toString(), output.stderr?.toString()].filter(Boolean).join("\n");
    throw new Error(`prisma migrate deploy thất bại khi dựng database test:\n${detail}`);
  }
}
