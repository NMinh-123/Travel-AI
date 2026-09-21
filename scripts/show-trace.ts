import "dotenv/config";
import { formatTrace, parseTraceOptions } from "./trace-format";

async function main(): Promise<void> {
  const options = parseTraceOptions(process.argv.slice(2));
  if (options.help) {
    console.log("npm run trace -- --session <id> [--last 10]\nnpm run trace -- --message <id>\nChỉ đọc database đang cấu hình. Tin nhắn cũ không có path vẫn đọc được.");
    return;
  }
  const { prisma } = await import("@server/infra/db");
  try {
    const messages = await prisma.chatMessage.findMany({
      where: options.message ? { id: options.message } : { sessionId: options.session, role: "ASSISTANT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: options.message ? 1 : options.last,
      select: { id: true, createdAt: true, role: true, trace: true },
    });
    if (!messages.length) { console.error("Không tìm thấy tin nhắn phù hợp."); process.exitCode = 1; return; }
    for (const message of messages.reverse()) {
      console.log(`[${message.createdAt.toISOString()}] ${message.role} ${message.id}\n${formatTrace(message.trace)}`);
    }
  } finally { await prisma.$disconnect(); }
}

main().catch(() => {
  console.error("Không đọc được trace. Kiểm tra tham số (--help), DATABASE_URL/JWT_SECRET và kết nối database.");
  process.exitCode = 1;
});
