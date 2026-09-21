-- Cây địa danh xuống tới database.
--
-- `parentSlug` vốn chỉ sống trong data/places/types.ts, nên tầng truy xuất không dùng được: hỏi
-- "có gì ở Đồng Văn" chỉ lấy được tài liệu gắn đúng slug `dong-van`, còn tài liệu của phố cổ, chợ
-- phiên và dinh thự trong vùng thì không ai gom hộ.
--
-- NULL cho tới khi `npm run db:seed` chạy lại — đó là trạng thái có thật của một bảng vừa migrate,
-- và `expandPlaceTree` xử lý nó đúng bằng cách trả về chính danh sách slug đầu vào.

ALTER TABLE "Place" ADD COLUMN "parentSlug" TEXT;

CREATE INDEX "Place_parentSlug_idx" ON "Place"("parentSlug");
