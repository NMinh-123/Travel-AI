import { ALL_KNOWLEDGE } from "@data/knowledge/index";
import { loadGolden } from "./schema";
import { findLeakage, formatLeakage } from "./leakage";

/**
 * Soát rò rỉ giữa tập tinh chỉnh và tập giữ riêng, in đầy đủ cả cảnh báo.
 *
 * Test `leakage.test.ts` chỉ chặn nhóm `error`, vì một cảnh báo không phải bằng chứng — nó là
 * một chỗ cần người nhìn lại. Lệnh này là chỗ để nhìn.
 *
 * Chạy: `npm run eval:leakage`
 */

async function main(): Promise<number> {
  const cases = await loadGolden();
  const documents = new Map(ALL_KNOWLEDGE.map((doc) => [`${doc.domain}:${doc.slug}`, doc.content]));
  const issues = findLeakage({ cases, documents });

  const dev = cases.filter((row) => row.split === "dev").length;
  const holdout = cases.filter((row) => row.split === "holdout").length;
  console.log(`Bộ vàng: ${cases.length} kịch bản (dev ${dev}, holdout ${holdout}).`);
  console.log(formatLeakage(issues));

  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    console.error(`\n${errors.length} lỗi chặn: tập holdout đã mất tính độc lập, mọi con số báo cáo từ nó đều cao hơn thực tế.`);
    return 1;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
