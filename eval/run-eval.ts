import "dotenv/config";
import { mkdir, readFile, writeFile, appendFile, access } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGolden, type GoldenCase } from "@eval/golden/schema";
import { parseDataset, type EscalationReasonName } from "@eval/dataset";
import type { GroundingStatus, ToolStatus } from "@server/domain/agents/grounding";
import type { FailureClass } from "@server/domain/agents/failure";
import { parseScores, readThresholds, type Scores } from "./gate";
import { buildReport, formatSummary } from "./report";
import { parseOptions, sample } from "./options";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = path.join(root, "eval/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const scorer = path.join(root, "eval/score/ragas_score.py");

class EvalError extends Error {}

/**
 * Mô tả lỗi đủ để sửa, nhưng đã bỏ khoá đi.
 *
 * Bản trước ghi đúng một câu "không ghi thông điệp provider để bảo vệ bí mật". An toàn, nhưng ba
 * lần chạy hỏng liên tiếp ngày 2026-09-22 không ai đọc ra nổi vì sao — mà mỗi lần chạy lại là hai
 * mươi phút và ngót nghìn lượt gọi. Thứ duy nhất phải giấu là khoá API; lớp lỗi, mã HTTP và câu
 * chữ của provider lại chính là những gì phân biệt "điểm cuối quá tải" với "gửi sai tham số".
 * Giấu luôn cả chúng thì cổng phát hành báo đỏ mà không ai hành động được.
 */
function describeError(error: unknown): string {
  const raw = error as { status?: unknown; code?: unknown; message?: unknown; cause?: { message?: unknown } } | null;
  const parts = [(error as { constructor?: { name?: string } } | null)?.constructor?.name ?? "Error"];
  if (raw?.status !== undefined) parts.push(`status=${String(raw.status)}`);
  if (raw?.code !== undefined) parts.push(`code=${String(raw.code)}`);
  const cause = raw?.cause?.message ? ` | nguyên nhân: ${String(raw.cause.message)}` : "";
  const text = `${parts.join(" ")}: ${String(raw?.message ?? error)}${cause}`;
  // Đọc thẳng từ môi trường: `config` được import trễ trong main() để lỗi thiếu biến báo đúng
  // tên khoá, nên ở tầm module này chưa có nó.
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? text.split(key).join("***") : text;
}

/** Không chuyển stderr của SDK ra ngoài: thông điệp provider có thể chứa dữ liệu xác thực. */
function score(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [scorer, ...args], { cwd: root, env, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let safeCode = "SCORER_FAILED";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      const code = chunk.match(/EVAL_ERROR:(IMPORT_ERROR|CONFIG_ERROR|INPUT_ERROR|PROVIDER_ERROR|INVALID_SCORE):?(GS-\d{3})?/);
      if (code) safeCode = `${code[1]}${code[2] ? ` (${code[2]})` : ""}`;
    });
    child.once("error", () => reject(new EvalError("Không chạy được Python trong eval/.venv")));
    child.once("close", (code) => (code === 0 ? resolve() : reject(new EvalError(`RAGAS thất bại: ${safeCode}; xem hướng dẫn trong README, không có điểm thay thế.`))));
  });
}

const HELP = [
  "npm run eval -- [--limit 30|all] [--ids GS-001,GS-002] [--split dev|holdout|all] [--k 5] [--out thư-mục-mới] [--skip-score]",
  "npm run eval -- --results eval/results/<mốc>   (offline: đọc lại dataset.jsonl + scores.json và áp cổng)",
  "",
  "Quy ước tập: vặn prompt và ngưỡng trên --split dev; --split holdout là con số báo cáo.",
  "--limit mặc định 30 nên KHÔNG chạy hết bộ vàng; lấy cách đều để vẫn chạm đủ các dạng kịch bản.",
  "--limit all chạy trọn tập đã chọn — đây là thứ phải dùng cho con số đem báo cáo.",
  "Ngưỡng đặt qua biến môi trường (EVAL_MIN_*, EVAL_MAX_*); EVAL_GATE_OFF=<khoá,khoá> tắt hẳn một luật.",
  "EVAL_JUDGE_MODEL đặt model chấm khác model sinh; để trống thì hai bên trùng nhau và điểm bị thiên lệch tự chấm.",
].join("\n");

interface TurnRow {
  index: number;
  message: string;
  intent: string;
  confidence: number;
  agent: string;
  slots: Record<string, unknown>;
  expected_slots: Record<string, unknown> | null;
  asked_slot: string | null;
  escalated: boolean;
  escalation_reason: EscalationReasonName | null;
  agent_error: boolean;
  grounding: GroundingStatus;
  tool_status: ToolStatus;
  failure: FailureClass;
  unsupported_facts: string[];
  claims: number;
  uncited_claims: number;
  sentences: number;
  covered_sentences: number;
  important_sentences: number;
  uncovered_important: string[];
  latency_ms: number;
  prompt_tokens: number;
  output_tokens: number;
  retries: number;
  retrieved_docs: string[];
  cited_docs: string[];
  reply: string;
  contexts: string[];
  path: unknown;
}

async function offline(results: string, thresholds: ReturnType<typeof readThresholds>, k: number): Promise<number> {
  let content: string;
  try {
    content = await readFile(path.join(results, "dataset.jsonl"), "utf8");
  } catch {
    throw new EvalError(`Không đọc được ${path.join(results, "dataset.jsonl")}; --results cần trỏ vào thư mục một lần chạy đã có dataset.`);
  }
  const records = parseDataset(content);
  let scores: Scores | null = null;
  try {
    scores = parseScores(JSON.parse(await readFile(path.join(results, "scores.json"), "utf8")));
  } catch (error) {
    // Thiếu scores.json là hợp lệ (lần chạy --skip-score); file có mà hỏng thì không được nuốt.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const report = buildReport(records, scores, thresholds, { k });
  console.log(formatSummary(report, records, { k }));
  return report.gate.passed ? 0 : 2;
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  const thresholds = readThresholds(process.env);
  if (options.results) return offline(options.results, thresholds, options.k);

  // Trước import config (có kiểm DATABASE_URL/JWT_SECRET) để báo đúng khoá thiếu.
  if (!process.env.GEMINI_API_KEY?.trim()) throw new EvalError("Thiếu GEMINI_API_KEY; chưa chạy câu hỏi nào.");
  const { config, hasGeminiCredentials } = await import("@server/config");
  if (!hasGeminiCredentials()) throw new EvalError("Thiếu GEMINI_API_KEY");

  const golden = await loadGolden();
  if (options.ids?.some((id) => !golden.some((row) => row.id === id))) throw new EvalError("--ids chứa câu không có trong bộ vàng");
  const matched = golden.filter((row) => (!options.ids || options.ids.includes(row.id)) && (!options.split || row.split === options.split));
  const selected = sample(matched, options.limit);
  if (!selected.length) throw new EvalError("Bộ lọc không chọn được kịch bản nào");
  if (selected.length < matched.length) {
    console.warn(`Chỉ chạy ${selected.length}/${matched.length} kịch bản do --limit (mặc định 30, bỏ cờ đi vẫn là 30); con số ra KHÔNG dùng để báo cáo. Chạy đủ: --limit all.`);
  }
  if (!options.skipScore && !selected.some((row) => !row.out_of_scope && row.expected_docs.length > 0)) {
    throw new EvalError("Cần ít nhất một kịch bản có expected_docs để tính RAGAS; dùng --skip-score nếu chỉ kiểm phần tất định.");
  }
  if (config.embedder !== "bge-m3") throw new EvalError("Bộ chấm hiện chỉ hỗ trợ EMBEDDER=bge-m3 theo thiết kế; không tự đổi embedding.");

  let health: Response;
  try {
    health = await fetch(`${config.embeddingServiceUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new EvalError("Sidecar chưa sẵn sàng; khởi động services/embedding/.venv/Scripts/python.exe -m uvicorn main:app --app-dir services/embedding --port 8000");
  }
  if (!health.ok) throw new EvalError(`Sidecar /health trả HTTP ${health.status}`);
  const healthData: unknown = await health.json();
  if (!healthData || typeof healthData !== "object" || !("dim" in healthData) || healthData.dim !== 1024) throw new EvalError("Sidecar không xác nhận vector 1024 chiều");

  /**
   * Model chấm tách khỏi model sinh.
   *
   * Cùng một model vừa viết câu trả lời vừa chấm câu trả lời của chính nó thì điểm faithfulness
   * nói về mức nhất quán nội bộ của model chứ không nói về mức bám nguồn. Đặt EVAL_JUDGE_MODEL
   * sang một model khác là cách rẻ nhất để bỏ phần thiên lệch đó; khi không đặt thì báo cáo phải
   * NÓI RÕ là hai bên trùng nhau chứ không im lặng.
   */
  const judgeModel = process.env.EVAL_JUDGE_MODEL?.trim() || config.geminiModel;
  const selfJudging = judgeModel === config.geminiModel || judgeModel === config.geminiModelLight;

  const childEnv = {
    ...process.env, PYTHONIOENCODING: "utf-8", RAGAS_DO_NOT_TRACK: "true",
    GEMINI_API_KEY: config.geminiApiKey, GEMINI_BASE_URL: config.geminiBaseUrl,
    EVAL_MODEL: judgeModel, EMBEDDING_SERVICE_URL: config.embeddingServiceUrl,
  };
  if (!options.skipScore) {
    try {
      await access(python);
    } catch {
      throw new EvalError("Thiếu eval/.venv; cài theo README trước khi đo.");
    }
    await score(["--check"], childEnv);
  }

  const { prisma } = await import("@server/infra/db");
  try {
    const expectedRefs = [...new Set(selected.flatMap((row) => row.expected_docs))];
    const known = await prisma.knowledgeDoc.findMany({ where: { sourceRef: { in: expectedRefs }, status: "APPROVED" }, select: { sourceRef: true } });
    const found = new Set(known.map((doc) => doc.sourceRef));
    if (expectedRefs.some((ref) => !found.has(ref))) throw new EvalError("Database thiếu tài liệu APPROVED của bộ vàng; chưa gọi mô hình.");

    const timestamp = new Date().toISOString();
    const out = path.resolve(options.out ?? path.join(root, "eval/results", timestamp.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")));
    await mkdir(path.dirname(out), { recursive: true });
    // Không ghi đè kết quả cũ, kể cả cùng timestamp hoặc --out.
    await mkdir(out);

    const host = new URL(config.geminiBaseUrl || "https://generativelanguage.googleapis.com").host;
    const turnCount = selected.reduce((sum, row) => sum + row.turns.length, 0);
    console.log(`${selected.length} kịch bản / ${turnCount} lượt; khoảng ${turnCount * (options.skipScore ? 2 : 10)}–${turnCount * (options.skipScore ? 6 : 16)} lượt mô hình (ước lượng, retry có thể tăng).`);
    console.log(`Model sinh: ${config.geminiModelLight}/${config.geminiModel}; chấm: ${judgeModel}${selfJudging ? " (TRÙNG model sinh — điểm thiên lệch tự chấm)" : ""}; host: ${host}.`);
    console.log(`Thư mục: ${out}`);

    const originalFetch = globalThis.fetch;
    let generationCalls = 0;
    globalThis.fetch = async (resource, init) => {
      const url = new URL(resource instanceof Request ? resource.url : String(resource));
      if (url.host === host && /:generateContent$/.test(url.pathname)) generationCalls++;
      return originalFetch(resource, init);
    };

    const now = process.env.EVAL_NOW?.trim() || "2026-09-15T03:00:00.000Z";
    if (Number.isNaN(Date.parse(now))) throw new EvalError("EVAL_NOW không phải mốc thời gian ISO hợp lệ");
    const meta = {
      timestamp,
      revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()),
      generation_models: [config.geminiModelLight, config.geminiModel], judge_model: judgeModel,
      endpoint_host: host, embedder: config.embedder, now, self_judging_bias: selfJudging,
      thresholds, k: options.k, split: options.split ?? "all",
      intent_threshold: 0.5, vector_threshold: config.ragMinVectorSimilarity, keyword_threshold: config.ragMinKeywordRank,
      case_ids: selected.map((row) => row.id), turns: turnCount,
      generation_calls: 0, judge_calls: 0, status: "RUNNING",
    };
    const saveMeta = (): Promise<void> => writeFile(path.join(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    await saveMeta();

    // Kịch bản đang đo, để lần hỏng nói được nó chết ở đâu chứ không chỉ nói là đã chết.
    let measuring: string | null = null;

    try {
      // Lượt chat chỉ thử lại 2 lần vì có người đang chờ. Ở đây không ai chờ, mà một nhịp
      // quá tải thoáng qua của điểm cuối lại làm hỏng trọn cả lần đo hàng trăm lượt.
      process.env.GEMINI_MAX_RETRIES ??= "5";
      const { handleTurn } = await import("@server/domain/agents/orchestrator");
      const measureOne = async (row: GoldenCase): Promise<void> => {
        measuring = row.id;
        const rows = await runCase(row, { now: new Date(now), timestamp, handleTurn });
        const last = rows[rows.length - 1];
        /**
         * RAGAS chỉ chấm kịch bản có tài liệu kỳ vọng VÀ thực sự truy xuất được đoạn nào.
         *
         * Truy xuất rỗng không bị bỏ qua: nó đã bị bắt bởi `empty_retrieval_rate` (ngưỡng tối đa)
         * và, vì guardrail sẽ chặn câu trả lời không có căn cứ, bởi cả `false_refusal_rate`. Ép
         * RAGAS chấm một câu không có ngữ cảnh chỉ tạo ra một điểm 0 giả — nó không phân biệt
         * được "trả lời sai" với "không có gì để bám vào".
         */
        /**
         * Lượt CHUYỂN TIẾP không vào RAGAS, và nay phải nói ra điều đó bằng một điều kiện tường
         * minh. Trước đây nó đúng nhờ một tác dụng phụ: chuyển tiếp làm mất luôn `evidence`, nên
         * `contexts` rỗng và phép kiểm bên dưới tự loại nó. Từ khi chứng cứ được giữ lại để bốn
         * chỉ số truy xuất đo đúng, tác dụng phụ ấy mất — và nếu không chặn ở đây thì RAGAS sẽ
         * chấm câu "đã ghi nhận và chuyển cho nhân viên" dựa trên mấy đoạn tri thức về đường đèo,
         * rồi cho faithfulness thấp vì một lý do chẳng liên quan gì tới chất lượng trả lời.
         */
        const ragas = !row.out_of_scope && !last.escalated && row.expected_docs.length > 0 && last.contexts.length > 0 && last.reply.trim().length > 0;
        await appendFile(path.join(out, "dataset.jsonl"), JSON.stringify({
          id: row.id, kind: row.kind, group: row.group, split: row.split, variant: row.variant,
          out_of_scope: row.out_of_scope, question: row.question, reference: row.reference,
          expected_docs: row.expected_docs, expected_intent: row.expected_intent,
          expected_escalation_reason: row.expected_escalation_reason,
          ...(row.note ? { note: row.note } : {}),
          answer: last.reply, contexts: last.contexts, ragas, turns: rows,
        }) + "\n");
        meta.generation_calls = generationCalls;
        await saveMeta();
      };

      /**
       * MỘT KỊCH BẢN HỎNG KHÔNG ĐƯỢC PHÉP VỨT ĐI CẢ LẦN ĐO.
       *
       * Bản trước ném ngay ở kịch bản đầu tiên gặp lỗi, và ngày 2026-09-23 một HTTP 400 của
       * provider ở GS-028 đã kết thúc lượt chạy khi mới đo được 8 trên 67 — hai mươi phút và gần
       * hai trăm lượt gọi model bỏ đi, trong khi 8 kịch bản đã đo xong thì vẫn đúng.
       *
       * Kiểu hỏng này ngẫu nhiên: đo lại đúng kịch bản ấy ngay sau đó thì nó chạy trọn. Nên gom
       * các ca hỏng lại rồi đo LẠI MỘT LƯỢT ở cuối, thay vì dừng cả lần chạy.
       *
       * KHÔNG phải nới lỏng tiêu chuẩn: ca nào vẫn hỏng sau lượt hai thì lần chạy vẫn thất bại
       * và không có phán quyết cổng nào được đưa ra — bộ dữ liệu thiếu kịch bản thì mọi con số
       * trên nó đều vô nghĩa. Thứ đổi ở đây là không vứt phần đã làm được.
       */
      const failed: GoldenCase[] = [];
      for (const [index, row] of selected.entries()) {
        console.log(`Đang đo ${row.id} (${row.turns.length} lượt) — ${index + 1}/${selected.length}`);
        try {
          await measureOne(row);
        } catch (error) {
          failed.push(row);
          console.warn(`  ${row.id} hỏng, để lại đo cuối lượt: ${describeError(error)}`);
        }
      }

      if (failed.length > 0) {
        console.log(`Đo lại ${failed.length} kịch bản đã hỏng: ${failed.map((row) => row.id).join(", ")}`);
        const stillFailing: string[] = [];
        for (const row of failed) {
          console.log(`Đang đo lại ${row.id}`);
          try {
            await measureOne(row);
          } catch (error) {
            stillFailing.push(`${row.id} (${describeError(error)})`);
          }
        }
        if (stillFailing.length > 0) {
          throw new EvalError(
            `${stillFailing.length}/${selected.length} kịch bản hỏng cả hai lượt đo, nên bộ dữ liệu ` +
              `KHÔNG đủ để áp cổng: ${stillFailing.join("; ")}. ` +
              `Phần đã đo nằm ở ${out}; chạy lại riêng các ca đó bằng --ids, hoặc chạy lại cả lượt.`,
          );
        }
        console.log(`Đo lại xong, đủ ${selected.length} kịch bản.`);
      }

      const records = parseDataset(await readFile(path.join(out, "dataset.jsonl"), "utf8"));
      let scores: Scores | null = null;
      if (!options.skipScore) {
        await score(["--dataset", path.join(out, "dataset.jsonl"), "--out", path.join(out, "scores.json")], childEnv);
        scores = parseScores(JSON.parse(await readFile(path.join(out, "scores.json"), "utf8")));
        if (scores.rows.length !== selected.length || scores.rows.some((scoreRow, index) => scoreRow.id !== selected[index].id)) {
          throw new EvalError("Bộ chấm trả thiếu câu hoặc sai thứ tự ID");
        }
        if (scores.judge_model !== judgeModel) throw new EvalError("File điểm ghi model chấm khác model đã yêu cầu");
        meta.judge_calls = scores.judge_calls;
      }

      const report = buildReport(records, scores, thresholds, { k: options.k });
      const summary = formatSummary(report, records, { k: options.k });
      // Lưu bảng chỉ số ở dạng máy đọc được, cạnh summary.md dành cho người đọc. Trường `gate`
      // rút gọn còn khoá/giá trị/ngưỡng vì mô tả luật đã nằm trong GATE_RULES của mã nguồn.
      await writeFile(path.join(out, "metrics.json"), JSON.stringify({
        ...report,
        gate: { passed: report.gate.passed, failures: report.gate.failures,
          checks: report.gate.checks.map((check) => ({ key: check.rule.key, value: check.value, threshold: check.threshold, samples: check.samples, status: check.status })) },
      }, null, 2) + "\n");
      await writeFile(path.join(out, "summary.md"), `Mốc thời gian: ${timestamp}\nRevision: ${meta.revision}, dirty=${meta.dirty}\nModel chấm: ${judgeModel}${selfJudging ? " (trùng model sinh)" : ""}\n\n${summary}`);
      console.log(summary);
      meta.status = options.skipScore ? (report.gate.passed ? "PASS_NO_RAGAS" : "FAIL_GATE") : report.gate.passed ? "PASS" : "FAIL_GATE";
      return report.gate.passed ? 0 : 2;
    } catch (error) {
      meta.status = "FAIL";
      /**
       * `EvalError` đã tự mang đủ ngữ cảnh — kể cả danh sách kịch bản hỏng sau hai lượt đo — nên
       * gắn thêm "Hỏng khi đang đo X" vào trước nó chỉ tạo ra một câu tự mâu thuẫn.
       */
      const detail = error instanceof EvalError ? error.message : describeError(error);
      const where = error instanceof EvalError
        ? null
        : measuring ? `Hỏng khi đang đo ${measuring}` : "Hỏng trước khi đo kịch bản nào";
      await writeFile(path.join(out, "error.json"), JSON.stringify({ status: "FAIL", case: measuring, message: detail }, null, 2));
      console.error(where ? `${where}: ${detail}` : detail);
      throw error;
    } finally {
      meta.generation_calls = generationCalls;
      globalThis.fetch = originalFetch;
      await saveMeta();
    }
  } finally {
    await prisma.$disconnect();
  }
}

interface RunDeps {
  now: Date;
  timestamp: string;
  handleTurn: typeof import("@server/domain/agents/orchestrator").handleTurn;
}

/**
 * Chạy một kịch bản: các lượt nối tiếp nhau, mang theo slot và lịch sử.
 *
 * Đây là điểm khác cốt lõi so với bản trước, vốn chạy mọi câu với `slots: {}` và `history: []`.
 * Với câu đơn lượt thì hai cách cho kết quả y hệt; với kịch bản nhiều lượt thì cách cũ không bao
 * giờ chạm tới vòng lặp hỏi bổ sung của Dialog Manager, tức phần mà FR-BOT-02 và FR-BOT-07 mô tả.
 */
async function runCase(row: GoldenCase, deps: RunDeps): Promise<TurnRow[]> {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  let slots: Record<string, unknown> = {};
  const rows: TurnRow[] = [];

  for (const [index, turn] of row.turns.entries()) {
    const result = await deps.handleTurn({
      now: deps.now,
      sessionId: `eval-${deps.timestamp}-${row.id}`,
      userId: null,
      message: turn.message,
      slots,
      history: [...history],
      // Bộ đo phải mang việc đang làm dở y như production, nếu không nó đo một hệ thống khác.
      previousIntent: rows.length > 0 ? (rows[rows.length - 1].agent as never) : undefined,
    });

    /**
     * Ngữ cảnh lấy THẲNG từ `trace.evidence`, không đọc lại KnowledgeDoc từ database.
     *
     * Bản trước tra ngược `citedDocIds` rồi ghép lại nội dung tài liệu, và cách đó sai ở hai chỗ.
     * Thứ nhất, nó bỏ mất số liệu tool: một câu trả lời về thời tiết được chấm faithfulness so
     * với mấy đoạn văn bản mà model chỉ đọc lướt, còn khối số đo quyết định câu trả lời thì
     * không có trong ngữ cảnh. Thứ hai, nội dung trong database có thể đã đổi sau lần chạy, nên
     * cùng một dataset chấm lại hai lần có thể ra hai kết quả.
     */
    const evidence = result.trace.evidence;
    const cited = new Set(result.trace.citedDocIds);

    const nodes = result.trace.path;
    rows.push({
      index,
      message: turn.message,
      intent: result.nlu.intent,
      confidence: result.nlu.confidence,
      agent: result.agent,
      slots: result.slots as Record<string, unknown>,
      expected_slots: turn.expected_slots ?? null,
      asked_slot: nodes.find((node) => node.node === "slot_gate" && node.outcome === "ask")?.detail ?? null,
      escalated: result.trace.escalated,
      escalation_reason: (result.result.escalation?.reason ?? null) as EscalationReasonName | null,
      // Nút này là thứ duy nhất phân biệt "nhận ra câu ngoài phạm vi" với "tác tử ném lỗi rồi
      // rơi vào cùng một nhánh support với lý do OUT_OF_SCOPE".
      agent_error: nodes.some((node) => node.node === "agent" && node.outcome === "threw"),
      grounding: result.trace.grounding,
      // Tác tử không gọi tool nào thì không ghi `toolStatus`; ở dataset nó phải là một giá trị
      // thật để `tool_failure_rate` có mẫu số đúng, nên quy về "not_used" ngay tại đây.
      tool_status: result.trace.toolStatus ?? "not_used",
      failure: result.trace.failure ?? "none",
      unsupported_facts: result.trace.unsupportedFacts,
      claims: result.trace.coverage?.claims ?? 0,
      uncited_claims: result.trace.coverage?.uncitedClaims ?? 0,
      sentences: result.trace.coverage?.sentences ?? 0,
      covered_sentences: result.trace.coverage?.coveredSentences ?? 0,
      important_sentences: result.trace.coverage?.importantSentences ?? 0,
      uncovered_important: result.trace.coverage?.uncoveredImportant ?? [],
      latency_ms: result.trace.totalMs,
      prompt_tokens: result.trace.calls.reduce((sum, call) => sum + (call.promptTokens ?? 0), 0),
      output_tokens: result.trace.calls.reduce((sum, call) => sum + (call.outputTokens ?? 0), 0),
      retries: result.trace.calls.reduce((sum, call) => sum + (call.retries ?? 0), 0),
      // Chỉ chứng cứ tri thức mới vào Recall@k: khối thời tiết có sourceRef là khoá nhà cung cấp
      // chứ không phải một tài liệu trong bộ vàng, nên gộp nó vào sẽ kéo Precision@k xuống một
      // cách vô nghĩa.
      retrieved_docs: evidence.filter((block) => block.kind === "knowledge").map((block) => block.sourceRef),
      cited_docs: evidence
        .filter((block) => block.docId !== undefined && cited.has(block.docId))
        .map((block) => block.sourceRef),
      reply: result.result.reply,
      contexts: evidence.map((block) => `${block.label}\n${block.text}`),
      path: nodes,
    });

    slots = result.slots as Record<string, unknown>;
    history.push({ role: "user", content: turn.message }, { role: "assistant", content: result.result.reply });
  }
  return rows;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Lỗi thuần parser không chứa cấu hình; lỗi SDK/config không được in nguyên văn.
    const safe = error instanceof EvalError ? error.message : "Lệnh đánh giá thất bại. Kiểm tra tham số (--help), file điểm, cấu hình và dịch vụ; chưa có kết quả hợp lệ.";
    console.error(safe);
    process.exitCode = 1;
  });
