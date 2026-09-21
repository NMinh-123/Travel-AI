-- Bỏ bảng huy hiệu người dùng.
--
-- DỰNG LẠI. Migration này đã được áp lên database phát triển (có trong `_prisma_migrations` với
-- tên `20260916230000_drop_user_badge`) nhưng thư mục của nó chưa từng được đưa vào git, nên
-- một lần dựng lại từ đầu sẽ không bỏ bảng này và lược đồ sẽ lệch với `schema.prisma` — nơi
-- model `UserBadge` đã không còn. Nội dung dưới đây tái tạo đúng những gì Prisma sinh ra cho một
-- lần bỏ model: gỡ khoá ngoại rồi bỏ bảng. Chỉ mục và ràng buộc duy nhất đi theo bảng.

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_userId_fkey";

-- DropTable
DROP TABLE "UserBadge";
