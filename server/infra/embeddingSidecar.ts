import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "@server/config";

/**
 * Tự khởi động dịch vụ embedding cục bộ khi chạy `npm run dev`.
 *
 * Vì sao thêm: quên bật sidecar là một lỗi ÂM THẦM và tốn thời gian truy. Tầng truy xuất gọi
 * `getEmbedder().embed()`, fetch tới cổng 8000 thất bại, `runKnowledge` ném lỗi, orchestrator
 * bắt được và rơi vào nhánh dự phòng `runSupport(..., "OUT_OF_SCOPE")` — nên phía khách chỉ
 * thấy "chưa có đủ thông tin" cho MỌI câu hỏi tri thức, kèm một bản ghi
 * ChatEscalation giả. Không có gì trên giao diện nói rằng đây là sự cố hạ tầng.
 *
 * Ba nguyên tắc của module này:
 *
 * 1. **Không bao giờ làm sập server.** Sidecar là thứ làm tính năng tốt hơn, không phải điều
 *    kiện để ứng dụng chạy. Mọi lỗi ở đây chỉ in cảnh báo rồi đi tiếp — cùng tinh thần với việc
 *    thiếu GEMINI_API_KEY thì endpoint AI trả 503 chứ không chặn cả trang.
 * 2. **Không giành chỗ của tiến trình đang chạy.** Người dùng có thể đã mở sidecar ở cửa sổ
 *    riêng (đúng như tài liệu vẫn hướng dẫn). Thăm dò `/health` trước; sống rồi thì không đụng.
 * 3. **Không chặn khởi động.** Model BGE-M3 nặng ~2,2 GB và nạp lười ở lần `/embed` đầu tiên;
 *    đợi nó xong mới cho `npm run dev` in ra dòng nào là đổi một phiền toái lấy một phiền toái
 *    khác. Spawn xong trả về ngay, việc theo dõi sẵn sàng chạy nền.
 */

/** Thời gian chờ mỗi lần thăm dò /health. Ngắn, vì đây là localhost. */
const PROBE_TIMEOUT_MS = 1500;

/** Tổng thời gian theo dõi sidecar lên. Quá mốc này thì thôi báo, không kết luận là hỏng. */
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 1000;

let child: ChildProcess | null = null;

/** Thư mục của dịch vụ Python, tính từ gốc repo. Cũng là cwd khi spawn uvicorn. */
const SERVICE_DIR = path.join("services", "embedding");

/**
 * Đường dẫn Python, theo thứ tự ưu tiên. Venv nằm NGAY TRONG thư mục dịch vụ
 * (services/embedding/.venv) — môi trường Python đặt cạnh mã Python mà nó phục vụ. Bản `.venv/`
 * ở gốc repo giữ lại làm phương án dự phòng cho ai quen đặt venv ở gốc.
 */
function resolvePython(): string | null {
  const override = process.env.PYTHON_BIN?.trim();
  if (override) return existsSync(override) ? override : null;

  const isWindows = process.platform === "win32";
  const candidates = isWindows
    ? [path.join(SERVICE_DIR, ".venv/Scripts/python.exe"), ".venv/Scripts/python.exe"]
    : [path.join(SERVICE_DIR, ".venv/bin/python"), ".venv/bin/python"];

  for (const relative of candidates) {
    const full = path.join(process.cwd(), relative);
    if (existsSync(full)) return full;
  }
  return null;
}

/** `/health` trả lời được nghĩa là có tiến trình đang giữ cổng — kể cả khi model chưa nạp xong. */
async function isAlive(): Promise<boolean> {
  try {
    const response = await fetch(`${config.embeddingServiceUrl}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Theo dõi tới lúc sidecar trả lời, chỉ để in một dòng xác nhận. Không ảnh hưởng luồng chính. */
async function reportWhenReady(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) return; // đã chết, đã báo ở nơi khác
    if (await isAlive()) {
      console.log("✓ Dịch vụ embedding đã sẵn sàng.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }

  console.warn(
    `⚠  Dịch vụ embedding chưa trả lời sau ${READY_TIMEOUT_MS / 1000}s. ` +
      "Lần nạp model đầu tiên có thể lâu hơn; theo dõi các dòng [embedding] bên dưới.",
  );
}

/** Dừng sidecar khi server thoát, để không bỏ lại tiến trình mồ côi giữ cổng 8000. */
function killOnExit(): void {
  const stop = () => {
    if (child && child.exitCode === null) child.kill();
  };

  process.once("exit", stop);
  // SIGINT/SIGTERM: thoát hẳn sau khi dọn, nếu không Ctrl+C sẽ không đóng được terminal.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stop();
      process.exit(0);
    });
  }
}

/**
 * Gọi ở chế độ dev, TRƯỚC khi server lắng nghe. Trả về ngay sau khi spawn; không ném lỗi.
 */
export async function ensureEmbeddingSidecar(): Promise<void> {
  // Đặt EMBEDDING_AUTOSTART=false khi muốn tự chạy sidecar ở cửa sổ riêng để xem log đầy đủ.
  if (process.env.EMBEDDING_AUTOSTART?.trim().toLowerCase() === "false") return;

  // EMBEDDER=gemini thì việc nhúng đi qua API, không có sidecar nào để bật.
  if (config.embedder !== "bge-m3") return;

  if (await isAlive()) {
    console.log(`✓ Dịch vụ embedding đã chạy sẵn tại ${config.embeddingServiceUrl}.`);
    return;
  }

  const python = resolvePython();
  if (!python) {
    console.warn(
      "⚠  Không tìm thấy Python của dịch vụ embedding (đã thử services/embedding/.venv/ và .venv/).\n" +
        "   Tầng truy xuất sẽ lỗi và MỌI câu hỏi tri thức bị báo thiếu thông tin.\n" +
        "   Cách xử lý: tạo venv rồi cài services/embedding/requirements.txt, đặt PYTHON_BIN,\n" +
        "   hoặc đặt EMBEDDER=gemini (phải chạy lại `npm run db:ingest` vì đổi không gian vector).",
    );
    return;
  }

  // Cổng lấy từ EMBEDDING_SERVICE_URL để hai bên không bao giờ lệch nhau.
  const port = new URL(config.embeddingServiceUrl).port || "8000";

  console.log(`Đang khởi động dịch vụ embedding (${path.basename(python)}, cổng ${port})...`);

  /**
   * cwd đặt vào chính thư mục dịch vụ và module chỉ là "main:app". Trước đây spawn từ gốc repo
   * với "embedding-service.main:app" — chạy được nhờ namespace package ngầm, nhưng đó là một
   * đường dẫn import mà `python -m uvicorn main:app` chạy tay trong thư mục đó KHÔNG tái hiện
   * được, nên lỗi ở một bên không tái hiện ở bên kia.
   */
  child = spawn(python, ["-m", "uvicorn", "main:app", "--port", port], {
    cwd: path.join(process.cwd(), SERVICE_DIR),
    // Không dùng shell: đường dẫn Python có thể chứa khoảng trắng, và truyền mảng tham số thì
    // không phải lo trích dẫn.
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Gắn nhãn để log của sidecar không lẫn vào log server — hai tiến trình, một terminal.
  const relay = (stream: NodeJS.ReadableStream | null, write: (line: string) => void) => {
    stream?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) write(`[embedding] ${line}`);
      }
    });
  };
  relay(child.stdout, (line) => console.log(line));
  relay(child.stderr, (line) => console.warn(line));

  child.on("error", (error) => {
    console.warn(`⚠  Không chạy được dịch vụ embedding: ${error.message}`);
    child = null;
  });

  child.on("exit", (code) => {
    // code 0 khi ta chủ động kill lúc thoát — không phải sự cố, đừng doạ người dùng.
    if (code !== 0 && code !== null) {
      console.warn(
        `⚠  Dịch vụ embedding dừng với mã ${code}. Các câu hỏi tri thức sẽ bị báo thiếu thông tin ` +
          "cho tới khi nó chạy lại.",
      );
    }
    child = null;
  });

  killOnExit();
  void reportWhenReady();
}
