import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Dựng virtualenv cho bộ chấm RAGAS.
 *
 * Tách thành một script thay vì một dòng trong README vì ba bước dưới đây phải chạy ĐÚNG THỨ TỰ
 * và đúng bằng `python` bên trong venv — không phải `python` trên PATH. Gõ tay ba bước đó trên
 * Windows và trên Linux cho ra hai câu lệnh khác nhau (`Scripts/python.exe` với `bin/python`), và
 * đó đúng là chỗ người ta hay làm sai rồi kết luận nhầm rằng phụ thuộc bị hỏng.
 *
 * Chạy: `npm run eval:setup`
 */

const root = fileURLToPath(new URL("../", import.meta.url));
const venv = path.join(root, "eval", ".venv");
const python = path.join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const requirements = path.join(root, "eval", "score", "requirements.txt");

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

if (!existsSync(venv)) {
  run(process.platform === "win32" ? "python" : "python3", ["-m", "venv", venv]);
} else {
  console.log(`Đã có ${venv}, chỉ cài lại phụ thuộc.`);
}

// `--require-virtualenv` không dùng được vì ta gọi thẳng python trong venv; gọi thẳng đã là bảo
// đảm mạnh hơn — không có cách nào cài nhầm vào Python hệ thống.
run(python, ["-m", "pip", "install", "--upgrade", "pip"]);
run(python, ["-m", "pip", "install", "-r", requirements]);

/**
 * Xác nhận bộ chấm NẠP ĐƯỢC, không chỉ xác nhận pip chạy xong.
 *
 * Sự cố `jsonref` đã cho thấy khoảng cách giữa hai điều đó: pip báo thành công, mọi gói đều có
 * mặt, và lượt chấm đầu tiên vẫn ném `ConfigurationError`.
 */
run(python, [path.join(root, "eval", "score", "ragas_score.py"), "--check"]);
console.log("\nMôi trường bộ chấm đã sẵn sàng.");
