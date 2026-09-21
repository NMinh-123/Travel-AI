-- Xoá chức năng bản đồ đường đèo.
--
-- Tab "Bản Đồ Đường Đèo" (`HighlandsMap`) đã bị gỡ khỏi giao diện, cùng với endpoint
-- `/api/content/map-waypoints` và nguồn dữ liệu `@data/website/map-waypoints`. Migration này dọn
-- nốt phần còn lại trong database.
--
-- Viết TAY, không dùng bản `prisma migrate dev` sinh ra. Lý do đã gặp nhiều lần trước đó: bản
-- sinh tự động luôn kèm hai câu
--
--     DROP INDEX "knowledgedoc_embedding_hnsw";
--     DROP INDEX "knowledgedoc_search_gin";
--
-- vì hai index đó được tạo bằng raw SQL trên cột `Unsupported` mà Prisma không mô hình hoá được,
-- nên mỗi lần so schema nó đều coi là drift. Để nguyên là phá tầng RAG mà KHÔNG có lỗi nào báo.

-- ---------------------------------------------------------------------------
-- Bảng MapWaypoint và enum WaypointType
-- ---------------------------------------------------------------------------
-- 15 hàng, toàn bộ là dữ liệu seed sinh lại được từ file, nên xoá hẳn chứ không giữ bảng mồ côi.
-- Không bảng nào tham chiếu tới nó: `destinationRef` chỉ là một String trỏ tới `Destination.slug`
-- theo quy ước, không phải khoá ngoại — nên DROP không kéo theo gì.
--
-- Enum phải xoá SAU bảng: Postgres từ chối DROP TYPE khi còn cột dùng kiểu đó.
DROP TABLE "MapWaypoint";
DROP TYPE "WaypointType";

-- ---------------------------------------------------------------------------
-- Destination.coordX / coordY
-- ---------------------------------------------------------------------------
-- Hai cột này là toạ độ trong canvas SVG 950x650 của `HighlandsMap` — KHÔNG phải toạ độ địa lý,
-- và không theo phép chiếu bản đồ nào. Chúng chỉ có nghĩa với đúng cái canvas vừa bị xoá, nên
-- giữ lại là để lại hai cột số mà không ai đọc được ý nghĩa nữa.
--
-- Toạ độ THẬT không mất: `lat` và `lng` ở lại nguyên vẹn, và đó là thứ `PlaceMap` (bản đồ Google
-- nhúng ở modal chi tiết điểm đến) dùng. Hai loại toạ độ này luôn tách biệt và lần này chỉ loại
-- đầu bị xoá.
ALTER TABLE "Destination" DROP COLUMN "coordX";
ALTER TABLE "Destination" DROP COLUMN "coordY";
