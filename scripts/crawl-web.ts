import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WEB_SOURCES, type WebSource } from "./web-sources";

/**
 * Thu thập bản thô của các trang trong scripts/web-sources.ts.
 *
 *   npm run db:crawl
 *
 * Script này CỐ TÌNH không nối thẳng vào đường ống ingest. Nó chỉ ghi văn bản đã bóc ra
 * scripts/raw-web/ để người biên tập đọc và chắt lọc sang scripts/knowledge-web.ts. Lý do là
 * ranh giới của SRS Mục 11.4: kho tri thức chỉ chứa tri thức ĐÃ KIỂM DUYỆT. Đổ thẳng HTML của
 * mười bốn trang du lịch vào vector store là mời chatbot trích dẫn quảng cáo, giá đã lạc hậu và
 * những câu mà không ai trong dự án từng đọc qua.
 *
 * Bản thô cũng không commit (xem .gitignore): nó là nguyên liệu tái tạo được, còn thứ cần review
 * qua git diff là bản đã biên tập.
 */

const OUT_DIR = path.join(process.cwd(), "scripts", "raw-web");

/** Đủ để chủ trang biết ai đang gọi và chặn được nếu muốn. Không giả làm trình duyệt. */
const USER_AGENT =
  "TravelAI-KnowledgeBot/1.0 (+du an hoc tap; thu thap tu lieu du lich Ha Giang)";

/** Nghỉ giữa hai lượt gọi cùng một host, để không dội request vào máy chủ người ta. */
const HOST_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 20000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Đọc robots.txt và kiểm tra đường dẫn có bị cấm không.
 *
 * Bản cài tối giản, chỉ xét nhóm `User-agent: *` và tiền tố Disallow — đủ cho một danh sách URL
 * do người chọn. Không hỗ trợ wildcard hay Allow ghi đè. Nguyên tắc khi không chắc là DỪNG:
 * robots.txt tải về lỗi mạng thì coi như cấm, vì bỏ sót một trang nhẹ hơn là gọi vào chỗ người
 * ta đã nói đừng gọi. Riêng 404 thì đúng chuẩn là "không có luật nào", nên cho phép.
 */
async function robotsAllows(url: URL): Promise<{ allowed: boolean; reason: string }> {
  const robotsUrl = new URL("/robots.txt", url.origin);

  let body: string;
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) return { allowed: true, reason: "không có robots.txt" };
    if (!response.ok) return { allowed: false, reason: `robots.txt trả HTTP ${response.status}` };
    body = await response.text();
  } catch (error: any) {
    return { allowed: false, reason: `không đọc được robots.txt: ${error?.message ?? error}` };
  }

  const disallowed: string[] = [];
  let inStarGroup = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [rawField, ...rest] = line.split(":");
    const field = rawField.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      inStarGroup = value === "*";
      continue;
    }
    if (inStarGroup && field === "disallow" && value) disallowed.push(value);
  }

  const target = url.pathname + url.search;
  for (const rule of disallowed) {
    // "Disallow: /" chặn toàn site; các rule khác so khớp theo tiền tố.
    if (rule === "/" || target.startsWith(rule)) {
      return { allowed: false, reason: `robots.txt cấm "${rule}"` };
    }
  }
  return { allowed: true, reason: "robots.txt cho phép" };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

/**
 * Bóc văn bản từ HTML bằng regex, không dùng thư viện parse.
 *
 * Chấp nhận được vì đầu ra của hàm này là tư liệu cho người đọc, không phải dữ liệu đưa thẳng
 * vào máy: một vài dòng rác sót lại thì người biên tập bỏ qua, chứ không lọt vào kho tri thức.
 * Nếu sau này crawler nối thẳng vào ingest thì chỗ này phải thay bằng một parser thật.
 */
function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Thẻ khối thành xuống dòng để câu không bị dính vào nhau khi mất thẻ.
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function titleOf(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

interface CrawlOutcome {
  id: string;
  url: string;
  topic: string;
  status: "ok" | "skipped" | "failed";
  detail: string;
  title?: string;
  characters?: number;
  file?: string;
}

async function crawlOne(source: WebSource, fetchedAt: string): Promise<CrawlOutcome> {
  const base = { id: source.id, url: source.url, topic: source.topic };

  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return { ...base, status: "failed", detail: "URL không hợp lệ" };
  }

  const robots = await robotsAllows(url);
  if (!robots.allowed) return { ...base, status: "skipped", detail: robots.reason };

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (error: any) {
    return { ...base, status: "failed", detail: `lỗi mạng: ${error?.message ?? error}` };
  }

  if (!response.ok) return { ...base, status: "failed", detail: `HTTP ${response.status}` };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    return { ...base, status: "skipped", detail: `không phải HTML (${contentType})` };
  }

  const html = await response.text();
  const text = htmlToText(html);
  const title = titleOf(html);

  // Trang trả 200 nhưng rỗng thường là tường chặn bot hoặc nội dung dựng bằng JavaScript.
  if (text.length < 400) {
    return { ...base, status: "failed", detail: `chỉ bóc được ${text.length} ký tự` };
  }

  const file = path.join(OUT_DIR, `${source.id}.txt`);
  const header = [
    `# ${title || source.id}`,
    `# Nguồn: ${response.url}`,
    `# Truy xuất: ${fetchedAt}`,
    `# Chủ đề: ${source.topic}`,
    source.note ? `# Ghi chú: ${source.note}` : null,
    "#",
    "# Bản thô do scripts/crawl-web.ts bóc ra. CHƯA kiểm duyệt, KHÔNG dùng trực tiếp cho RAG.",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(file, `${header}\n${text}\n`, "utf8");

  return {
    ...base,
    status: "ok",
    detail: robots.reason,
    title,
    characters: text.length,
    file: path.relative(process.cwd(), file),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();

  console.log(`Thu thập ${WEB_SOURCES.length} trang nguồn...`);
  const outcomes: CrawlOutcome[] = [];
  const lastHitByHost = new Map<string, number>();

  // Tuần tự chứ không song song: mục tiêu ở đây là lịch sự với máy chủ nguồn, không phải nhanh.
  for (const source of WEB_SOURCES) {
    const host = (() => {
      try {
        return new URL(source.url).host;
      } catch {
        return "";
      }
    })();

    const since = Date.now() - (lastHitByHost.get(host) ?? 0);
    if (host && since < HOST_DELAY_MS) await sleep(HOST_DELAY_MS - since);

    const outcome = await crawlOne(source, fetchedAt);
    if (host) lastHitByHost.set(host, Date.now());

    outcomes.push(outcome);
    const mark = outcome.status === "ok" ? "OK " : outcome.status === "skipped" ? "BỎ " : "LỖI";
    const size = outcome.characters ? ` ${outcome.characters} ký tự` : "";
    console.log(`  ${mark} ${outcome.id}${size} — ${outcome.detail}`);
  }

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify({ fetchedAt, outcomes }, null, 2)}\n`,
    "utf8",
  );

  const ok = outcomes.filter((row) => row.status === "ok").length;
  const skipped = outcomes.filter((row) => row.status === "skipped").length;
  const failed = outcomes.filter((row) => row.status === "failed").length;

  console.log(`\nXong: ${ok} lấy được, ${skipped} bỏ qua, ${failed} thất bại.`);
  console.log(
    `Bản thô nằm ở ${path.relative(process.cwd(), OUT_DIR)} — đọc rồi chắt lọc sang scripts/knowledge-web.ts.`,
  );

  // Thất bại lẻ tẻ là bình thường với trang ngoài (chặn bot, đổi đường dẫn), nên không coi là
  // lỗi của cả lượt chạy. Chỉ khi không lấy được gì thì mới có chuyện đáng ngờ về mạng/cấu hình.
  if (ok === 0) throw new Error("Không lấy được trang nào — kiểm tra kết nối mạng.");
}

main().catch((error) => {
  console.error("Crawl thất bại:", error);
  process.exitCode = 1;
});
