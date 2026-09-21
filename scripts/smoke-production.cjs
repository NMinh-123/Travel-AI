/**
 * KIỂM KHÓI BẢN BUILD PRODUCTION: `dist/server.cjs` có khởi động được trên một máy chỉ cài
 * `dependencies` hay không.
 *
 * Vì sao cần một bài riêng cho việc này. `npm run build` xanh KHÔNG chứng minh được điều gì về
 * lúc chạy: esbuild gói với `--packages=external`, nên mọi `require` gói ngoài đều được giữ
 * nguyên và chỉ vỡ khi tiến trình thật sự nạp module. Máy phát triển luôn có đủ
 * `devDependencies`, nên một phụ thuộc chỉ-dành-cho-dev lọt vào nhánh chạy sẽ đi qua cả build
 * lẫn test mà không ai thấy, rồi chết ở dòng đầu tiên trên máy chủ.
 *
 * Đúng chuyện đó đã xảy ra với `vite`: nó được `import` ở đầu `server/index.ts`, nên bản bundle
 * mở đầu bằng `require("vite")` và câu đó chạy bất kể `isProduction` bằng gì.
 *
 * Cách kiểm: chặn phân giải module ở đúng những gói KHÔNG có trong `dependencies`, rồi nạp bản
 * build. Chặn bằng hook `Module._resolveFilename` chứ không xoá gì trong `node_modules` — bài
 * kiểm này phải chạy được trên máy của bất kỳ ai mà không để lại hậu quả.
 *
 * Chạy: `node scripts/smoke-production.cjs` (sau `npm run build`).
 */

const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const bundle = path.join(root, "dist", "server.cjs");

if (!fs.existsSync(bundle)) {
  console.error("Chưa có dist/server.cjs — chạy `npm run build` trước.");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const runtime = new Set(Object.keys(pkg.dependencies || {}));
const devOnly = Object.keys(pkg.devDependencies || {}).filter((name) => !runtime.has(name));

/**
 * `@types/*` không tồn tại lúc chạy nên không cần chặn, và `prisma` (CLI) được `@prisma/client`
 * đụng tới ở vài đường phụ. Chỉ chặn những gói mà một lượt `require` thật sự có nghĩa là bản
 * build đang kéo theo công cụ phát triển.
 */
const blocked = new Set(devOnly.filter((name) => !name.startsWith("@types/")));

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const top = request.startsWith("@") ? request.split("/").slice(0, 2).join("/") : request.split("/")[0];
  if (blocked.has(top)) {
    const error = new Error(
      `Bản build production nạp "${request}", nhưng "${top}" chỉ có trong devDependencies. ` +
        `Trên máy chủ cài bằng \`npm ci --omit=dev\` thì gói này không tồn tại và tiến trình chết ngay khi khởi động.`,
    );
    error.code = "MODULE_NOT_FOUND";
    throw error;
  }
  return resolve.call(this, request, ...rest);
};

// Giá trị tối thiểu để `server/config.ts` qua được phần kiểm biến môi trường. Cổng cao và lạ để
// bài kiểm không đụng vào cổng đang dùng của ai; `config` từ chối cổng 0 nên không dùng được mẹo
// "để hệ điều hành tự cấp".
process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "45871";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://smoke:smoke@127.0.0.1:5432/smoke";
process.env.JWT_SECRET = process.env.JWT_SECRET || "smoke-test-secret-at-least-32-characters-long";

let failed = false;
process.on("uncaughtException", (error) => {
  console.error(`Bản build production không khởi động được: ${error.message}`);
  failed = true;
  process.exit(1);
});

require(bundle);

/**
 * Máy chủ lắng nghe bất đồng bộ, nên đợi một nhịp rồi mới kết luận. Không gọi endpoint nào: bài
 * này hỏi "tiến trình có nạp và lên được không", còn hành vi của từng route đã có tầng test khác.
 */
setTimeout(() => {
  if (!failed) {
    console.log(`Bản build production khởi động được mà không cần ${blocked.size} gói devDependencies.`);
    process.exit(0);
  }
}, 1500);
