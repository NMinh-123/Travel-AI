import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Chạy test của bộ chấm bằng ĐÚNG trình thông dịch có phụ thuộc.
 *
 * Hai môi trường chạy khác nhau và cả hai đều hợp lệ: trên máy phát triển, phụ thuộc nằm trong
 * `eval/.venv`; trên CI, job Python `pip install` thẳng vào Python của runner nên không có venv.
 * Một dòng `python -m unittest` cố định chỉ đúng ở một trong hai chỗ — và trên máy phát triển nó
 * đỏ với `ModuleNotFoundError: httpx`, một thông điệp trông như phụ thuộc bị thiếu chứ không như
 * chọn nhầm trình thông dịch.
 *
 * Chạy: `npm run test:python`
 */

const root = fileURLToPath(new URL("../", import.meta.url));
const venv = path.join(root, "eval", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3";

console.log(`Dùng ${python === venv ? "Python trong eval/.venv" : "Python hệ thống"}.`);
execFileSync(python, ["-m", "unittest", "discover", "-s", "eval/score", "-t", "eval/score"], {
  cwd: root,
  stdio: "inherit",
});
