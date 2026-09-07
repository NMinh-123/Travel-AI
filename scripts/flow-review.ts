import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { EXIT_BLOCKED, EXIT_NO_VERDICT, runCodex } from "./flow-codex";
import { appendSection, assertNoPlaceholder, resolveTask, setPlanField, today } from "./flow-task";

dotenv.config({ quiet: true });

/**
 * Bước 2 của quy trình ở docs/dev-flow.md, bản tự động: đưa gói prompt trong chatgpt.md cho
 * ChatGPT duyệt và ghi phản hồi trở lại đúng file đó.
 *
 *   npm run flow:review -- [slug-task]
 *
 * Mã thoát để dùng được trong script: 0 = PASS, 2 = FAIL, 3 = không đọc được VERDICT.
 *
 * Đường truyền là Codex CLI ở chế độ headless (xem scripts/flow-codex.ts), không phải REST
 * api.openai.com như bản trước. Lý do đổi: máy này đăng nhập Codex bằng thuê bao ChatGPT chứ
 * không có OPENAI_API_KEY, mà khoá API không đi kèm gói ChatGPT — hai loại thuê bao khác nhau.
 * Bản REST cũ vì thế chưa từng chạy được ở đây; giữ lại chỉ là giữ một đường chết.
 *
 * Gói prompt trong chatgpt.md vẫn được viết TỰ CHỨA (dán thẳng trích đoạn code vào) dù Codex
 * đọc được repo. Hai lý do: nó vẫn phải copy tay sang ChatGPT web được khi cần, và một kế
 * hoạch tự đứng vững trên mô tả của chính nó là điều đáng kiểm. Quyền đọc repo ở đây là để
 * ChatGPT ĐỐI CHIẾU các khẳng định về code hiện trạng, không phải để thay cho gói prompt.
 */

/**
 * Lấy khối "Vòng N — gửi đi" mới nhất trong chatgpt.md: từ tiêu đề đó tới tiêu đề `##` kế tiếp.
 * Các dòng trích dẫn hướng dẫn (`> Dán ...`) và dấu `---` phân cách bị bỏ, chúng chỉ có nghĩa
 * cho người copy tay.
 */
function extractRequest(md: string): string {
  const headings = [...md.matchAll(/^## Vòng .*gửi đi.*$/gm)];
  if (headings.length === 0) {
    throw new Error(
      "Không tìm thấy mục '## Vòng N — gửi đi' trong chatgpt.md.\n" +
        "  Chạy /flow-plan trong Claude Code để sinh gói prompt trước.",
    );
  }

  const last = headings[headings.length - 1];
  const start = last.index! + last[0].length;
  const rest = md.slice(start);
  const nextHeading = rest.search(/^## /m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  return body
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("> ") && line.trim() !== "---")
    .join("\n")
    .trim();
}

/**
 * Câu dẫn đặt trước gói prompt. Nói rõ hai điều mà gói prompt tự chứa không nói được, vì nó
 * được viết cho cả trường hợp dán tay vào ChatGPT web: rằng lần này có repo để đối chiếu, và
 * rằng tuyệt đối không được sửa file.
 */
function framing(planPath: string): string {
  return [
    "Bạn đang chạy trong thư mục làm việc của repo được review.",
    "",
    "Hai điều về vai trò của bạn ở lượt này:",
    "",
    "1. CHỈ ĐỌC. Không sửa, tạo hay xoá bất kỳ file nào, kể cả khi bạn thấy một lỗi hiển nhiên",
    "   sửa được trong một dòng. Việc sửa do người khác làm sau khi từng phát hiện đã được xác",
    "   minh. Nhiệm vụ của bạn kết thúc ở bản báo cáo.",
    "2. Gói prompt dưới đây được viết tự chứa, có dán sẵn trích đoạn code. Bạn ĐƯỢC đọc repo để",
    `   đối chiếu xem các khẳng định đó có đúng không (kế hoạch đầy đủ ở ${planPath}), và nếu`,
    "   phát hiện gói prompt mô tả sai hiện trạng thì đó là một điểm chặn đáng nêu.",
    "",
    "---",
    "",
  ].join("\n");
}

function readVerdict(reply: string): "PASS" | "FAIL" | null {
  const match = reply.match(/VERDICT:\s*(PASS|FAIL)/i);
  if (!match) return null;
  return match[1].toUpperCase() as "PASS" | "FAIL";
}

function main(): void {
  const task = resolveTask(process.argv[2]);
  const chatgptPath = path.join(task.dir, "chatgpt.md");
  if (!existsSync(chatgptPath)) {
    throw new Error(`Không có ${chatgptPath}. Chạy /flow-plan để sinh gói prompt trước.`);
  }

  const request = extractRequest(readFileSync(chatgptPath, "utf8"));
  assertNoPlaceholder(request, chatgptPath);

  const relativePlan = path.relative(process.cwd(), task.planPath).split(path.sep).join("/");
  const model = process.env.CODEX_REVIEW_MODEL?.trim() || "(mặc định của Codex)";

  console.log(`Task:  ${task.slug} (vòng ${task.round}, status ${task.status})`);
  console.log(`Model: ${model}`);
  console.log(`Đang gửi ${request.length} ký tự sang Codex (chế độ chỉ đọc)...`);

  const reply = runCodex({ instructions: framing(relativePlan) + request });
  appendSection(chatgptPath, `## Vòng ${task.round} — phản hồi nhận về (${today()})`, reply);

  const verdict = readVerdict(reply);
  console.log(`\nĐã ghi phản hồi vào ${path.relative(process.cwd(), chatgptPath)}`);
  console.log(`VERDICT: ${verdict ?? "không đọc được"}`);

  if (verdict === "PASS") {
    // Không tự đặt `da-duyet` ở đây: theo docs/dev-flow.md, các điểm BLOCKER phải được đối chiếu
    // lại với code thật trước khi mở cổng. Script chỉ lấy phản hồi về, /flow-review mới quyết định.
    console.log("Chạy /flow-review trong Claude Code để đối chiếu từng điểm rồi mở cổng.");
    return;
  }

  setPlanField(task.planPath, "status", "cho-duyet");
  console.log("Chạy /flow-review trong Claude Code để phân loại các điểm chặn.");
  process.exitCode = verdict === "FAIL" ? EXIT_BLOCKED : EXIT_NO_VERDICT;
}

try {
  main();
} catch (error: unknown) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
