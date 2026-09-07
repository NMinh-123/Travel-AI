import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient dùng chung một instance.
 *
 * `npm run dev` chạy qua tsx: mỗi lần lưu file là một lần nạp lại module, và mỗi
 * `new PrismaClient()` mở một connection pool mới. Sau vài chục lần lưu, Postgres sẽ từ
 * chối kết nối vì hết slot. Giữ instance trên globalThis để lần nạp sau dùng lại.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Dùng cho /api/health, để khi có sự cố ta phân biệt được ngay "database không kết nối
 * được" với "thiếu GEMINI_API_KEY" — hai nguyên nhân rất khác nhau nhưng cùng làm ứng dụng
 * trông như bị hỏng.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database không kết nối được:", error);
    return false;
  }
}
