import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { EXIT_BLOCKED, EXIT_NO_VERDICT, EXIT_OK, runCodex } from "./flow-codex";
import { appendSection, assertNoPlaceholder, resolveTask, setPlanField, today } from "./flow-task";

dotenv.config({ quiet: true });

/**
 * Bước 4 của quy trình ở docs/dev-flow.md, bản tự động: nhờ ChatGPT soát phần code vừa viết,
 * rồi ghi kết quả vào review-code.md.
 *
 *   npm run flow:review-code -- [slug-task]
 *
 * Mã thoát: 0 = CLEAN, 2 = ISSUES, 3 = không đọc được VERDICT.
 *
 * Thay cho `flow-cursor.ts` của bản trước. Đổi vì hai lẽ: máy này không có CURSOR_API_KEY nên
 * đường đó chưa từng chạy được, còn Codex CLI thì đã đăng nhập sẵn bằng thuê bao ChatGPT và
 * cũng đọc được repo — vốn là năng lực duy nhất khiến Cursor được chọn cho bước này.
 *
 * Khác bước 2: ở đây KHÔNG đẩy nội dung file qua chỉ dẫn. Người soát đọc được repo nên chỉ cần
 * trỏ nó vào review-code.md; nội dung tiếng Việt nằm trong file và được đọc bằng UTF-8.
 */

function framing(promptFile: string): string {
  return [
    `Đọc yêu cầu soát code trong ${promptFile} và thực hiện đúng như file đó mô tả.`,
    "",
    "Ràng buộc tuyệt đối: CHỈ BÁO CÁO, KHÔNG SỬA. Không sửa, tạo hay xoá bất kỳ file nào —",
    "kể cả khi lỗi hiển nhiên và sửa được trong một dòng, kể cả file tài liệu hay file kết quả.",
    "Việc sửa do người khác làm sau khi từng phát hiện đã được xác minh; một bản vá lọt vào cây",
    "làm việc mà họ không biết sẽ phá đúng cơ chế kiểm tra đó.",
    "",
    "Trả lời theo đúng định dạng VERDICT mà file yêu cầu, không thêm lời dẫn.",
  ].join("\n");
}

function readVerdict(reply: string): "CLEAN" | "ISSUES" | null {
  const match = reply.match(/VERDICT:\s*(CLEAN|ISSUES)/i);
  if (!match) return null;
  return match[1].toUpperCase() as "CLEAN" | "ISSUES";
}

function main(): void {
  const task = resolveTask(process.argv[2]);
  const reviewPath = path.join(task.dir, "review-code.md");
  if (!existsSync(reviewPath)) {
    throw new Error(`Không có ${reviewPath}. Chạy /flow-build để sinh gói prompt trước.`);
  }
  assertNoPlaceholder(readFileSync(reviewPath, "utf8"), reviewPath);

  const relative = path.relative(process.cwd(), reviewPath).split(path.sep).join("/");
  const model = process.env.CODEX_REVIEW_MODEL?.trim() || "(mặc định của Codex)";

  console.log(`Task:  ${task.slug} (status ${task.status})`);
  console.log(`Model: ${model}`);
  console.log(`Đang nhờ Codex soát theo ${relative} (chế độ chỉ đọc)...`);

  const reply = runCodex({ instructions: framing(relative) });
  appendSection(reviewPath, `## Kết quả nhận về (${today()})`, reply);

  const verdict = readVerdict(reply);
  console.log(`\nĐã ghi kết quả vào ${relative}`);
  console.log(`VERDICT: ${verdict ?? "không đọc được"}`);
  console.log("Chạy /flow-review-code trong Claude Code để xác minh từng phát hiện rồi sửa.");

  if (verdict !== "CLEAN") setPlanField(task.planPath, "status", "cho-soat-code");
  process.exitCode =
    verdict === "CLEAN" ? EXIT_OK : verdict === "ISSUES" ? EXIT_BLOCKED : EXIT_NO_VERDICT;
}

try {
  main();
} catch (error: unknown) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
