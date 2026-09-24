import { SPLITS, type Split } from "@eval/dataset";

export interface EvalOptions {
  limit: number;
  ids?: string[];
  split?: Split;
  out?: string;
  /** Thư mục kết quả cũ: áp lại cổng từ dataset.jsonl + scores.json, không gọi model. */
  results?: string;
  k: number;
  skipScore: boolean;
  help: boolean;
}

const FLAGS = ["--skip-score", "--help"];
const VALUED = ["--limit", "--ids", "--out", "--results", "--split", "--k"];

export function parseOptions(args: string[]): EvalOptions {
  const result: EvalOptions = { limit: 30, k: 5, skipScore: false, help: false };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (seen.has(name)) throw new Error(`Tham số trùng: ${name}`);
    seen.add(name);
    if (FLAGS.includes(name)) {
      if (name === "--skip-score") result.skipScore = true;
      else result.help = true;
      continue;
    }
    if (!VALUED.includes(name)) throw new Error("Tham số không được hỗ trợ; xem --help");
    const value = args[++index];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`Thiếu giá trị cho ${name}`);
    if (name === "--limit" || name === "--k") {
      /**
       * `--limit all` chạy trọn tập đã chọn.
       *
       * Sinh ra vì `.github/workflows/eval.yml` gọi eval mà không truyền `--limit`, và mặc định
       * 30 khiến lần chạy theo lịch chỉ đo 30 trên 67 kịch bản holdout rồi báo cáo như thể đã đủ.
       * Viết `--limit 67` ở workflow thì con số đó lệch ngay khi bộ vàng dài thêm, còn một số lớn
       * bừa như 1000 thì không ai đọc ra ý định.
       */
      if (name === "--limit" && value === "all") {
        result.limit = Number.MAX_SAFE_INTEGER;
        continue;
      }
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error(`${name} phải là số nguyên dương, hoặc "all" cho --limit`);
      result[name === "--limit" ? "limit" : "k"] = Number(value);
    } else if (name === "--ids") {
      result.ids = value.split(",");
      if (result.ids.some((id) => !/^GS-\d{3}$/.test(id)) || new Set(result.ids).size !== result.ids.length) throw new Error("--ids phải chứa ID GS-xxx duy nhất");
    } else if (name === "--split") {
      if (value !== "all" && !(SPLITS as readonly string[]).includes(value)) throw new Error("--split phải là dev, holdout hoặc all");
      if (value !== "all") result.split = value as Split;
    } else if (name === "--out") result.out = value;
    else result.results = value;
  }
  /**
   * Chạy lại cổng offline không được trộn với tham số chọn câu.
   *
   * `--results` đọc đúng những gì lần chạy trước đã ghi. Cho phép kèm `--ids` hay `--split` ở đây
   * thì con số in ra là của một tập con mà file summary.md cạnh đó lại nói về tập đầy đủ — hai
   * kết quả khác nhau mang cùng một mốc thời gian.
   */
  if (result.results && (result.skipScore || result.ids || result.split || result.out || seen.has("--limit"))) {
    throw new Error("--results không kết hợp với tham số chạy đo");
  }
  return result;
}

/**
 * Cắt bớt bằng cách lấy cách đều, không lấy N dòng đầu.
 *
 * Bộ vàng xếp theo nhóm nên `slice(0, 30)` chỉ ra toàn câu ẩm thực: một lần chạy thử như vậy
 * không chạm tới kịch bản từ chối lẫn kịch bản hội thoại, và bảng cổng sẽ bỏ qua đúng những luật
 * đáng xem nhất trong khi vẫn in ra chữ PASS.
 */
export function sample<T>(rows: T[], limit: number): T[] {
  if (rows.length <= limit) return rows;
  const stride = rows.length / limit;
  return Array.from({ length: limit }, (_, index) => rows[Math.floor(index * stride)]);
}
