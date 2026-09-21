import "dotenv/config";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ĐỐI CHIẾU THƯ MỤC MIGRATION VỚI BẢNG `_prisma_migrations`.
 *
 * Vì sao cần một bài kiểm riêng cho việc này. Prisma tin vào bảng `_prisma_migrations` để biết
 * database đang ở đâu, và `prisma migrate deploy` CHỈ áp những migration chưa có tên trong bảng
 * đó — nó không đọc lại nội dung những migration đã áp. Nghĩa là thư mục và database có thể trôi
 * xa nhau rất lâu mà mọi lệnh vẫn xanh, cho tới một lần dựng database mới thì lược đồ ra khác
 * hẳn, hoặc một lần `migrate dev` phát hiện lệch và đề nghị dựng lại cả database.
 *
 * Dự án này đã rơi vào đúng tình huống đó: database phát triển mang 11 migration, thư mục chỉ
 * còn 4, và sáu migration cũ bị gộp vào `init`. Một lần dựng mới từ thư mục ấy sẽ cho ra một
 * lược đồ không ai từng chạy.
 *
 * Ba kiểu lệch được phân biệt rõ vì chúng đòi ba cách xử lý khác nhau:
 *
 *  - THIẾU FILE: database đã áp một migration mà repo không còn giữ. Đây là kiểu nặng nhất —
 *    không dựng lại được database từ mã nguồn nữa. Phải khôi phục file từ git hoặc viết lại.
 *  - CHƯA ÁP: file có trong repo nhưng database chưa chạy. Bình thường; `migrate deploy` sẽ lo.
 *  - LỆCH CHECKSUM: cùng tên nhưng nội dung khác. Hoặc ai đó sửa một migration đã áp (không
 *    được phép), hoặc file bị đổi ký tự xuống dòng, hoặc nó vừa được dựng lại từ đầu.
 *
 * Chạy: `npm run db:migrate:check`
 *       `npm run db:migrate:check -- --adopt <tên-migration>`  (xem chú thích ở `adopt`)
 */

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = path.join(root, "db", "migrations");

interface Row {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
}

/**
 * Băm ĐÚNG cách Prisma băm: sha256 trên nguyên byte của file.
 *
 * Không chuẩn hoá ký tự xuống dòng ở đây, dù chính ký tự xuống dòng là nguyên nhân gây lệch trên
 * máy Windows. Chuẩn hoá thì bài kiểm sẽ báo xanh trong khi Prisma vẫn báo lệch — và một bài
 * kiểm nói khác công cụ thật thì tệ hơn là không có bài kiểm nào. Chỗ chữa nằm ở `.gitattributes`.
 */
function checksumOf(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function localMigrations(): { name: string; checksum: string }[] {
  return readdirSync(dir)
    .filter((name) => statSync(path.join(dir, name)).isDirectory())
    .sort()
    .map((name) => ({ name, checksum: checksumOf(path.join(dir, name, "migration.sql")) }));
}

/**
 * Nhận một migration đã được dựng lại: ghi checksum mới vào database.
 *
 * Đây là thao tác được Prisma khuyến nghị cho đúng một tình huống — file của một migration ĐÃ ÁP
 * bị mất rồi được viết lại với cùng tác dụng. Nó không chạy lại SQL nào; nó chỉ nói với Prisma
 * rằng nội dung mới là nội dung chính thức của cái tên ấy.
 *
 * Phải gọi có tên cụ thể, không có chế độ "nhận tất". Nhận hàng loạt sẽ biến một cảnh báo thật —
 * ai đó vừa sửa một migration đã chạy trên production — thành một dòng log trôi qua.
 */
async function adopt(name: string): Promise<number> {
  const { prisma } = await import("@server/infra/db");
  const local = localMigrations().find((row) => row.name === name);
  if (!local) {
    console.error(`Không có migration tên "${name}" trong ${dir}`);
    return 1;
  }
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2`,
    local.checksum,
    name,
  );
  if (updated === 0) {
    console.error(`Database chưa từng áp migration "${name}"; không có gì để nhận.`);
    return 1;
  }
  console.log(`Đã ghi checksum mới cho "${name}". Không có SQL nào được chạy lại.`);
  return 0;
}

async function check(): Promise<number> {
  const { prisma } = await import("@server/infra/db");
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" ORDER BY started_at`,
  );
  const applied = new Map(rows.map((row) => [row.migration_name, row]));
  const local = localMigrations();
  const known = new Set(local.map((row) => row.name));

  const missingFiles = rows.filter((row) => !known.has(row.migration_name));
  const pending = local.filter((row) => !applied.has(row.name));
  const drifted = local.filter((row) => {
    const hit = applied.get(row.name);
    return hit !== undefined && hit.checksum !== row.checksum;
  });
  const unfinished = rows.filter((row) => row.finished_at === null);

  console.log(`${local.length} migration trong repo, ${rows.length} đã áp trên database.`);

  for (const row of missingFiles) {
    console.error(`THIẾU FILE      ${row.migration_name} — database đã áp nhưng repo không còn giữ.`);
  }
  for (const row of pending) {
    console.log(`CHƯA ÁP         ${row.name}`);
  }
  for (const row of drifted) {
    console.error(`LỆCH CHECKSUM   ${row.name} — nội dung file khác nội dung đã được áp.`);
  }
  for (const row of unfinished) {
    console.error(`ÁP DỞ DANG      ${row.migration_name} — chạy nửa chừng rồi hỏng, phải xử lý tay.`);
  }

  if (missingFiles.length === 0 && drifted.length === 0 && unfinished.length === 0) {
    console.log("Thư mục migration và database khớp nhau.");
    return 0;
  }
  console.error(
    "\nKhông dùng `prisma db push` để lấp chỗ lệch: nó đồng bộ lược đồ mà không ghi gì vào " +
      "`_prisma_migrations`, nên khoảng cách giữa hai bên rộng thêm chứ không hẹp lại.",
  );
  return 1;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const at = args.indexOf("--adopt");
  if (at !== -1) {
    const name = args[at + 1];
    if (!name) {
      console.error("--adopt cần tên migration.");
      return 1;
    }
    return adopt(name);
  }
  return check();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
