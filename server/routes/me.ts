import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db";
import type { AuthedRequest } from "../auth";
import { requireUser, userWithRelations } from "../auth";
import { toRiderLevelCode, toSavedItinerary, toUserProfile } from "../mappers";
import { asyncRoute } from "../asyncHandler";

/**
 * Mọi thứ dưới /api/me là dữ liệu riêng của một người dùng, nên router này gắn `requireUser`
 * cho toàn bộ nhánh. Không có endpoint nào ở đây nhận `userId` từ body hay query — id luôn
 * lấy từ cookie đã xác thực, để một người không đọc hay sửa được hồ sơ của người khác.
 */
export const meRouter = Router();

meRouter.use(requireUser);

function currentUserId(req: Request): string {
  return (req as AuthedRequest).userId;
}

async function respondWithProfile(res: Response, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: userWithRelations,
  });
  return res.json({ user: toUserProfile(user) });
}

const MAX_PHONE_LENGTH = 20;

meRouter.patch(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const data: { phone?: string | null; riderLevel?: "BEGINNER" | "EXPERIENCED" | "VETERAN" | "EASY_RIDER" } = {};

    if ("phone" in (req.body ?? {})) {
      const phone = req.body.phone;
      if (phone !== null && typeof phone !== "string") {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
      }
      const trimmed = typeof phone === "string" ? phone.trim().slice(0, MAX_PHONE_LENGTH) : "";
      data.phone = trimmed || null;
    }

    if ("riderLevel" in (req.body ?? {})) {
      const code = toRiderLevelCode(req.body.riderLevel);
      if (!code) {
        return res.status(400).json({ error: "Trình độ lái xe không hợp lệ" });
      }
      data.riderLevel = code;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    }

    await prisma.user.update({ where: { id: userId }, data });
    return respondWithProfile(res, userId);
  }),
);

/**
 * Yêu thích dùng PUT/DELETE thay vì một endpoint "toggle": bấm hai lần vì mạng chậm sẽ ra
 * đúng kết quả mong đợi, chứ không bật tắt ngẫu nhiên theo số lần request tới được server.
 */
meRouter.put(
  "/favorites/:slug",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const destinationSlug = req.params.slug;

    const destination = await prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { slug: true },
    });
    if (!destination) {
      return res.status(404).json({ error: "Không tìm thấy điểm đến này" });
    }

    await prisma.favorite.upsert({
      where: { userId_destinationSlug: { userId, destinationSlug } },
      create: { userId, destinationSlug },
      update: {},
    });

    return respondWithProfile(res, userId);
  }),
);

meRouter.delete(
  "/favorites/:slug",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);

    await prisma.favorite.deleteMany({
      where: { userId, destinationSlug: req.params.slug },
    });

    return respondWithProfile(res, userId);
  }),
);

meRouter.get(
  "/itineraries",
  asyncRoute(async (req: Request, res: Response) => {
    const itineraries = await prisma.savedItinerary.findMany({
      where: { userId: currentUserId(req) },
      orderBy: { createdAt: "desc" },
    });

    return res.json(itineraries.map(toSavedItinerary));
  }),
);

const MAX_SAVED_ITINERARIES = 50;

meRouter.post(
  "/itineraries",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const body = req.body ?? {};

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const overview = typeof body.overview === "string" ? body.overview.trim() : "";
    const days = body.days;

    if (!title) return res.status(400).json({ error: "Lịch trình cần có tiêu đề" });
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Lịch trình không có ngày nào để lưu" });
    }

    const saved = await prisma.savedItinerary.count({ where: { userId } });
    if (saved >= MAX_SAVED_ITINERARIES) {
      return res.status(409).json({
        error: "Bạn đã lưu tối đa số lịch trình cho phép",
        details: `Giới hạn ${MAX_SAVED_ITINERARIES} lịch trình. Hãy xoá một lịch trình cũ trước khi lưu thêm.`,
      });
    }

    const totalKm = Number(body.totalKm);
    const itinerary = await prisma.savedItinerary.create({
      data: {
        userId,
        title,
        overview,
        totalKm: Number.isFinite(totalKm) ? Math.round(totalKm) : 0,
        travelMode: typeof body.travelMode === "string" ? body.travelMode : null,
        vibe: typeof body.vibe === "string" ? body.vibe : null,
        budgetLevel: typeof body.budgetLevel === "string" ? body.budgetLevel : null,
        days,
      },
    });

    return res.status(201).json(toSavedItinerary(itinerary));
  }),
);

meRouter.delete(
  "/itineraries/:id",
  asyncRoute(async (req: Request, res: Response) => {
    // deleteMany kèm userId: không xoá được lịch trình của người khác dù biết id.
    const result = await prisma.savedItinerary.deleteMany({
      where: { id: req.params.id, userId: currentUserId(req) },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Không tìm thấy lịch trình này" });
    }
    return res.status(204).end();
  }),
);
