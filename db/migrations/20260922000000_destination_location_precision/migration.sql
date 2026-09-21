-- Mức tin cậy của toạ độ điểm đến, sao chép từ Place.geo.precision lúc seed.
-- Hàng cũ giữ nguyên giá trị; mặc định 'unknown' tương đương hành vi trước đây, khi giao diện
-- coi mọi điểm không có toạ độ đã khảo sát là chưa biết vị trí.
CREATE TYPE "LocationPrecision" AS ENUM ('surveyed', 'approximate', 'area_only', 'unknown');

ALTER TABLE "Destination"
  ADD COLUMN "locationPrecision" "LocationPrecision" NOT NULL DEFAULT 'unknown';

-- Không có toạ độ thì không có mức tin cậy nào để nói. Ràng buộc này chặn trạng thái vô nghĩa
-- "chưa có vị trí nhưng đã khảo sát", vốn sẽ khiến giao diện mở cổng bản đồ trên dữ liệu rỗng.
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_precision_requires_coordinates_check"
  CHECK ("lat" IS NOT NULL OR "locationPrecision" = 'unknown');
