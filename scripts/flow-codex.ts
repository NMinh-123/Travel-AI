import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

/**
 * Cửa duy nhất ra Codex CLI cho hai script tự động hoá quy trình (xem docs/dev-flow.md):
 * `flow-review.ts` nhờ ChatGPT duyệt kế hoạch, `flow-review-code.ts` nhờ ChatGPT soát code.
 *
 * Vì sao gọi CLI thay vì gọi thẳng REST như bản trước: Codex CLI trên máy này đăng nhập bằng
 * thuê bao ChatGPT (`auth_mode = "chatgpt"` trong ~/.codex/auth.json, `OPENAI_API_KEY` null).
 * Token OAuth trong file đó thuộc một realm xác thực khác, KHÔNG dùng thay khoá API để gọi
 * api.openai.com được — và moi token ra để gọi API là vừa dễ vỡ khi token xoay vòng, vừa là
 * vùng xám về điều khoản. Đường được hỗ trợ là gọi chính CLI ở chế độ headless.
 *
 * Hệ quả tốt: không cần OPENAI_API_KEY, và mỗi lượt review không phát sinh chi phí theo token.
 */

/** Mã thoát dùng chung cho cả hai script, để dùng được trong shell script khác. */
export const EXIT_OK = 0;
export const EXIT_BLOCKED = 2;
export const EXIT_NO_VERDICT = 3;

/**
 * Bản cài standalone đặt binary sau một symlink `current` trỏ vào release đang dùng. Trỏ vào
 * `current` chứ không vào release cụ thể: đường dẫn có số phiên bản sẽ chết ngay lần
 * `codex update` đầu tiên.
 */
function standalonePath(): string {
  const bin = process.platform === "win32" ? "codex.exe" : "codex";
  return path.join(homedir(), ".codex", "packages", "standalone", "current", "bin", bin);
}

export interface CodexBin {
  path: string;
  /**
   * `.cmd`/`.bat` là script của shell chứ không phải file thực thi; từ Node 20.12 spawn thẳng
   * chúng mà không qua shell sẽ bị chặn. Cờ này cho bên gọi biết phải bật `shell: true`.
   */
  needsShell: boolean;
}

/**
 * Thứ tự tìm — **bản cài standalone đứng trước PATH**, và đây là chỗ dễ làm sai:
 *
 * Trên máy này `where codex` có trả về kết quả, nhưng đó là shim của npm
 * (`AppData\\Roaming\\npm\\codex` không đuôi, kèm `codex.cmd`). Truyền tên trần `"codex"` cho
 * `spawnSync` thì Windows không chạy được file không đuôi và văng `ENOENT` — bộ dò báo "tìm
 * thấy" trong khi lệnh thì không chạy nổi. Ưu tiên file `.exe` thật của bản standalone tránh
 * hẳn lớp shim đó; nhánh PATH chỉ còn là phương án dự phòng và luôn dùng đường dẫn tuyệt đối
 * lấy từ chính `where`, không bao giờ dùng tên trần.
 */
export function resolveCodexBin(): CodexBin {
  const override = process.env.CODEX_BIN?.trim();
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`CODEX_BIN trỏ tới đường dẫn không tồn tại: ${override}`);
    }
    return { path: override, needsShell: /\.(cmd|bat)$/i.test(override) };
  }

  const standalone = standalonePath();
  if (existsSync(standalone)) return { path: standalone, needsShell: false };

  const probe = process.platform === "win32" ? "where" : "which";
  const found = spawnSync(probe, ["codex"], { encoding: "utf8", shell: true });
  if (found.status === 0 && found.stdout.trim()) {
    const candidates = found.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    // Ưu tiên file thực thi thật, rồi mới tới script shell; bỏ hẳn mục không có đuôi.
    const exe = candidates.find((c) => /\.exe$/i.test(c));
    if (exe) return { path: exe, needsShell: false };

    const script = candidates.find((c) => /\.(cmd|bat)$/i.test(c));
    if (script) return { path: script, needsShell: true };
  }

  throw new Error(
    "Không tìm thấy Codex CLI.\n" +
      "  Kiểm tra đã đăng nhập chưa:  codex login status\n" +
      `  Bản cài standalone thường nằm ở: ${standalone}\n` +
      "  Hoặc đặt CODEX_BIN trong .env trỏ tới đường dẫn thực thi.",
  );
}

/**
 * Rút phần đáng đọc từ output của một lượt chạy hỏng.
 *
 * Không cắt 800 ký tự ĐẦU như bản trước: khi Codex hỏng, nó in lại toàn bộ chỉ dẫn đã nhận
 * trước rồi mới tới dòng lỗi, nên cắt phần đầu thì chỉ thấy chính prompt của mình còn nguyên
 * nhân thật bị nuốt mất. Lỗi này đã thật sự làm mất một lượt gỡ rối — hạn mức tài khoản đã hết
 * mà thông báo lại trông như prompt bị echo.
 *
 * Ưu tiên các dòng `ERROR:` nếu có; không có thì lấy phần CUỐI, vì lỗi luôn nằm ở cuối.
 */
function failureDetail(stderr: string, stdout: string): string {
  const combined = `${stderr ?? ""}\n${stdout ?? ""}`.trim();
  if (!combined) return "(không có output)";

  const errorLines = [...new Set(combined.split(/\r?\n/).filter((line) => /^\s*ERROR:/.test(line)))];
  if (errorLines.length > 0) return errorLines.join("\n  ");

  const tail = combined.slice(-800);
  return combined.length > 800 ? `...${tail}` : tail;
}

export interface CodexRunOptions {
  /** Toàn văn chỉ dẫn gửi cho Codex. Đi qua stdin, không qua tham số dòng lệnh. */
  instructions: string;
  /** Thư mục gốc Codex được phép đọc. Mặc định là thư mục làm việc hiện tại. */
  cwd?: string;
}

/**
 * Chạy `codex exec` một lượt và trả về tin nhắn cuối của agent.
 *
 * Ba lựa chọn cần giữ nguyên khi sửa file này:
 *
 * 1. **`-s read-only`.** Người dùng đã chốt: bên review chỉ được phản hồi, tuyệt đối không
 *    sửa file. Mọi thay đổi code do Claude thực hiện sau khi từng phát hiện đã được xác minh.
 *    Đây là ràng buộc của quy trình, không phải mặc định tiện tay — bỏ cờ này là phá cổng đó.
 * 2. **Chỉ dẫn đi qua stdin, không qua argv.** Gói prompt dài vài chục nghìn ký tự tiếng Việt;
 *    truyền qua dòng lệnh trên Windows sẽ vướng cả giới hạn độ dài lẫn bảng mã của console.
 *    `spawnSync` ghi stdin dạng UTF-8 nên không phụ thuộc codepage.
 * 3. **Đọc kết quả từ `-o <file>` thay vì parse stdout.** stdout còn lẫn log tiến trình; file
 *    đó chứa đúng tin nhắn cuối, nên không phải đoán ranh giới.
 */
export function runCodex(options: CodexRunOptions): string {
  const bin = resolveCodexBin();
  const cwd = options.cwd ?? process.cwd();

  const outDir = mkdtempSync(path.join(tmpdir(), "flow-codex-"));
  const outFile = path.join(outDir, "last-message.txt");

  const args = [
    "exec",
    "-s",
    "read-only",
    "--color",
    "never",
    "-C",
    cwd,
    "-o",
    outFile,
  ];

  const model = process.env.CODEX_REVIEW_MODEL?.trim();
  if (model) args.push("-m", model);

  // `-` = đọc chỉ dẫn từ stdin.
  args.push("-");

  try {
    const result = spawnSync(bin.path, args, {
      input: options.instructions,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: bin.needsShell,
    });

    if (result.error) throw new Error(`Không chạy được "${bin.path}": ${result.error.message}`);

    if (result.status !== 0) {
      throw new Error(
        `Codex CLI thoát với mã ${result.status}.\n  ${failureDetail(result.stderr, result.stdout)}\n\n` +
          "  Nếu là lỗi xác thực, đăng nhập lại:  codex login",
      );
    }

    const reply = existsSync(outFile) ? readFileSync(outFile, "utf8").trim() : "";
    if (!reply) throw new Error("Codex CLI không trả về nội dung nào.");
    return reply;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
