import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Tiện ích dùng chung cho hai script tự động hoá quy trình review (docs/dev-flow.md):
 * `flow-review.ts` nhờ ChatGPT duyệt kế hoạch, `flow-review-code.ts` nhờ ChatGPT soát code.
 *
 * Cả hai đều thao tác trên hồ sơ task ở docs/plans/<YYYYMMDD>-<slug>/ nên phần tìm task,
 * đọc trạng thái và ghi thêm mục vào file markdown gom về đây.
 */

export const PLANS_DIR = path.resolve(process.cwd(), "docs/plans");

export interface FlowTask {
  slug: string;
  dir: string;
  planPath: string;
  status: string;
  round: number;
}

/**
 * Đọc frontmatter YAML tối giản ở đầu plan.md. Không dùng thư viện YAML: frontmatter ở đây
 * chỉ có các cặp `khoá: giá trị` một dòng, thêm một dependency cho ngần đó là không đáng.
 * Comment sau dấu `#` bị cắt vì mẫu plan.md có chú thích các giá trị hợp lệ ngay trên dòng.
 */
function readFrontmatter(file: string): Record<string, string> {
  const text = readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    fields[pair[1]] = pair[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}

function listTaskDirs(): string[] {
  if (!existsSync(PLANS_DIR)) return [];
  return readdirSync(PLANS_DIR)
    .map((name) => path.join(PLANS_DIR, name))
    .filter((dir) => statSync(dir).isDirectory() && existsSync(path.join(dir, "plan.md")));
}

/**
 * Tìm hồ sơ task. Không truyền tham số thì lấy task có plan.md sửa gần nhất — thao tác thường
 * gặp là vừa chạy /flow-plan xong rồi gửi đi luôn. Luôn in ra task đã chọn để không có chuyện
 * gửi nhầm hồ sơ mà không ai biết.
 */
export function resolveTask(arg?: string): FlowTask {
  const dirs = listTaskDirs();
  if (dirs.length === 0) {
    throw new Error(
      `Chưa có hồ sơ task nào trong ${PLANS_DIR}.\n` +
        `  Chạy /flow-plan trong Claude Code để tạo kế hoạch trước.`,
    );
  }

  let dir: string;
  if (arg) {
    const matches = dirs.filter((d) => path.basename(d) === arg || path.basename(d).includes(arg));
    if (matches.length === 0) {
      throw new Error(
        `Không tìm thấy task khớp "${arg}".\n` +
          `  Các task hiện có: ${dirs.map((d) => path.basename(d)).join(", ")}`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `"${arg}" khớp nhiều task: ${matches.map((d) => path.basename(d)).join(", ")}.\n` +
          `  Truyền slug đầy đủ để chỉ rõ.`,
      );
    }
    dir = matches[0];
  } else {
    dir = dirs.sort(
      (a, b) =>
        statSync(path.join(b, "plan.md")).mtimeMs - statSync(path.join(a, "plan.md")).mtimeMs,
    )[0];
  }

  const planPath = path.join(dir, "plan.md");
  const fields = readFrontmatter(planPath);
  return {
    slug: path.basename(dir),
    dir,
    planPath,
    status: fields.status ?? "khong-ro",
    round: Number(fields.round ?? "1") || 1,
  };
}

/** Ngày theo giờ máy, định dạng YYYY-MM-DD — dùng cho tiêu đề các mục ghi thêm. */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Ghi thêm một mục vào cuối file markdown, tạo file nếu chưa có. */
export function appendSection(file: string, heading: string, body: string): void {
  const existing = existsSync(file) ? readFileSync(file, "utf8").replace(/\s*$/, "") : "";
  const next = `${existing}\n\n${heading}\n\n${body.trim()}\n`;
  writeFileSync(file, next.replace(/^\n+/, ""), "utf8");
}

/**
 * Cập nhật một trường trong frontmatter plan.md, giữ nguyên phần còn lại của file.
 * Chỉ đụng dòng đầu tiên khớp khoá và chỉ trong khối frontmatter, để không sửa nhầm một dòng
 * `status:` nào đó nằm trong phần thân kế hoạch.
 */
export function setPlanField(planPath: string, key: string, value: string): void {
  const text = readFileSync(planPath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return;

  let replaced = false;
  const block = match[1]
    .split(/\r?\n/)
    .map((line) => {
      if (replaced || !line.startsWith(`${key}:`)) return line;
      replaced = true;
      const comment = line.match(/\s+#.*$/)?.[0] ?? "";
      return `${key}: ${value}${comment}`;
    })
    .join("\n");

  if (!replaced) return;
  writeFileSync(planPath, text.replace(match[0], `---\n${block}\n---`), "utf8");
}

/** Chặn gửi đi khi gói prompt còn chỗ trống `<dán ...>` của mẫu chưa được điền. */
export function assertNoPlaceholder(content: string, file: string): void {
  const found = content.match(/<dán[^>]*>|<slug>|<N>|<ngày>/);
  if (!found) return;
  throw new Error(
    `Gói prompt trong ${file} còn chỗ trống chưa điền: ${found[0]}\n` +
      `  Điền nốt (hoặc chạy lại /flow-plan) rồi gửi, tránh tốn một lượt gọi vô ích.`,
  );
}
