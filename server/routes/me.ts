import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@server/infra/db";
import type { AuthedRequest } from "@server/middleware/auth";
import { clearSession, issueSession, requireUser } from "@server/middleware/auth";
import { hashPassword, verifyPassword } from "@server/domain/password";
import { toRiderLevelCode, toSavedItinerary, toUserProfile, userWithRelations } from "@server/domain/mappers";
import { asyncRoute } from "@server/middleware/asyncHandler";

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
const MAX_NAME_LENGTH = 60;
const MIN_PASSWORD_LENGTH = 8;

meRouter.patch(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const data: {
      name?: string;
      phone?: string | null;
      riderLevel?: "BEGINNER" | "EXPERIENCED" | "VETERAN" | "EASY_RIDER";
    } = {};

    /**
     * Tên hiển thị sửa được, nhưng KHÔNG cho phép rỗng: tên là thứ đứng cạnh mọi thứ khách lưu
     * lại, và một tài khoản không tên thì giao diện phải tự bịa ra thứ gì đó để lấp chỗ.
     */
    if ("name" in (req.body ?? {})) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) {
        return res.status(400).json({ error: "Tên hiển thị không được để trống" });
      }
      data.name = name.slice(0, MAX_NAME_LENGTH);
    }

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
 * Đổi mật khẩu.
 *
 * BẮT BUỘC có mật khẩu hiện tại, kể cả khi người dùng đã đăng nhập. Cookie phiên chứng minh
 * người này *đã* đăng nhập lúc nào đó, không chứng minh người đang ngồi trước máy lúc này là
 * chủ tài khoản — một máy bỏ quên chưa khoá màn hình là đủ để chiếm tài khoản vĩnh viễn nếu
 * chỗ này bỏ qua bước xác minh.
 *
 * Tài khoản Google không có `passwordHash` nên không đổi được gì ở đây; đặt mật khẩu cho chúng
 * là một luồng khác (phải xác minh qua email) và chưa xây.
 */
meRouter.post(
  "/password",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu mới phải từ ${MIN_PASSWORD_LENGTH} ký tự` });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user.passwordHash) {
      return res.status(409).json({
        error: "Tài khoản này đăng nhập bằng Google nên chưa có mật khẩu để đổi",
      });
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    /**
     * Đổi mật khẩu thì thu hồi mọi phiên khác: người đổi thường là vì nghi bị lộ, và phiên của
     * kẻ đã đăng nhập bằng mật khẩu cũ không được sống tiếp. Thiết bị đang dùng được phát lại
     * cookie mới nên không bị đăng xuất.
     */
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    issueSession(res, userId, updated.sessionVersion);

    return res.status(204).end();
  }),
);

/**
 * Xoá tài khoản vĩnh viễn.
 *
 * Gõ lại email là rào chắn có chủ đích. Một hộp thoại "bạn có chắc không" thì người ta bấm Đồng
 * ý theo phản xạ; gõ lại chính địa chỉ của mình thì không nhầm được, và nó cũng chặn luôn
 * trường hợp người khác ngồi vào máy bỏ quên.
 *
 * Mọi dữ liệu kèm theo đi cùng nhờ `onDelete: Cascade` trên bốn quan hệ của User — yêu thích,
 * huy hiệu, lịch trình đã lưu và phiên chat. Cookie phiên bị xoá ngay để trình duyệt không giữ
 * lại một phiên trỏ tới tài khoản không còn tồn tại.
 */
meRouter.delete(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const confirmEmail = typeof req.body?.confirmEmail === "string" ? req.body.confirmEmail : "";

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ error: "Email xác nhận không khớp với tài khoản này" });
    }

    await prisma.user.delete({ where: { id: userId } });
    clearSession(res);
    return res.status(204).end();
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
    /**
     * Mỗi phần tử phải là một object. `days` đi thẳng vào cột Json nên một `null` lọt qua đây
     * không hỏng ở đây mà nằm im trong database, rồi nổ ở chỗ đọc nó ra — nơi không còn đủ ngữ
     * cảnh để nói cho khách biết cái gì sai.
     */
    if (days.some((day: unknown) => !day || typeof day !== "object" || Array.isArray(day))) {
      return res.status(400).json({ error: "Lịch trình có ngày không hợp lệ" });
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
        // Quãng đường âm là vô nghĩa; kẹp về 0 thay vì lưu lại rồi hiển thị "-100 km".
        totalKm: Number.isFinite(totalKm) ? Math.max(0, Math.round(totalKm)) : 0,
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
