/**
 * KHUNG BAO ĐỊA BÀN — rào chắn thứ hai của tầng dữ liệu động.
 *
 * VÌ SAO CẦN HAI LỚP CHẶN CHO CÙNG MỘT VIỆC. Rào thứ nhất nằm ở orchestrator: trước khi gọi bất
 * kỳ công cụ nào, câu hỏi của khách được phân giải xuống một thực thể trong @data/places, và câu
 * nào không rơi vào cây đó thì bị cổng "ngoài địa bàn" trả lời thẳng là ngoài phạm vi. Rào đó
 * chặn theo Ý ĐỊNH. Rào ở đây chặn theo TOẠ ĐỘ, và nó bảo vệ đúng cái mà rào thứ nhất bỏ sót:
 * một chuỗi tìm kiếm đã lọt qua cổng rồi thì Google Places vẫn tìm trên toàn thế giới, nên
 * "quán phở gần đây" khi thiếu ngữ cảnh vị trí sẽ trả về một quán ở Hà Nội, kèm ảnh, kèm giờ mở
 * cửa, kèm đánh giá — dữ liệu hoàn toàn hợp lệ, HTTP 200, không có một dấu hiệu nào của lỗi.
 *
 * Đó là lý do một lớp là không đủ. Lỗi kiểu này không làm sập gì cả: hệ thống vẫn chạy, log vẫn
 * sạch, và chatbot bắt đầu tư vấn về Sa Pa hay Cao Bằng trong khi mọi chỉ số vận hành đều xanh.
 * Chỉ có khách phát hiện ra, và họ phát hiện bằng cách chạy nhầm 200 km.
 *
 * VÌ SAO LÀ HÌNH CHỮ NHẬT CHỨ KHÔNG PHẢI ĐA GIÁC ĐỊA GIỚI. `locationRestriction` của Places nhận
 * hình chữ nhật, nên đây là thứ nhà cung cấp hiểu được. Hệ quả phải chấp nhận: một hình chữ nhật
 * úp lên một địa giới răng cưa thì bao giờ cũng phủ dư ra ngoài — cạnh tây dưới đây liếm sang
 * mấy xã giáp ranh của Lào Cai, cạnh nam chạm phần trên của Yên Bái. Không có cách nào siết cho
 * hết dư mà không cắt mất chính các xã rìa của địa bàn. Và chính chỗ dư đó là lý do rào thứ nhất
 * phải tồn tại: khung bao thu hẹp thiệt hại, nó không tự mình xác định được phạm vi phục vụ.
 */

import type { RegionBoundingBox } from "./types";

/**
 * Khung bao địa bàn Hà Giang cũ — nay là phần phía bắc của tỉnh Tuyên Quang sau sáp nhập
 * 01/7/2025. Địa bàn trải khoảng 22,1–23,4 vĩ bắc và 104,3–105,6 kinh đông; bốn cạnh dưới đây
 * nới thêm vài kilômét mỗi bên, trừ cạnh bắc.
 *
 * Từng cạnh được chọn như sau, và mỗi con số đều có một thứ cụ thể ở ngay bên kia:
 *
 * - `north` 23,42: cực bắc thật của địa bàn là khu vực cột cờ Lũng Cú và cột mốc 428, quanh
 *   23,39. Đây là cạnh SIẾT NHẤT, chỉ nới khoảng 3 km, vì bên kia không phải tỉnh khác mà là
 *   biên giới quốc gia. Nới rộng cạnh này là mời Places trả về địa điểm ở Vân Nam, tức trả về
 *   những nơi khách không sang được nếu không có thủ tục xuất cảnh.
 * - `south` 22,05: rìa nam của địa bàn nằm quanh 22,1 ở phía Xín Mần. Nới 5 km để không cắt mất
 *   các xã rìa; phần dư chồng lên vùng giáp Yên Bái nhưng ở đó không có điểm du lịch nào dễ bị
 *   nhầm với Hà Giang.
 * - `west` 104,25: đây là cạnh RỦI RO NHẤT. Rìa tây của địa bàn khoảng 104,30, còn Si Ma Cai và
 *   Bắc Hà của Lào Cai chỉ nằm ngay sát bên kia. Siết thêm nữa thì cắt mất chính các xã tây của
 *   Xín Mần, nới thêm thì kéo cả một vùng du lịch khác vào kết quả. Chọn 104,25 là chấp nhận
 *   phần dư này và giao việc lọc cho rào thứ nhất — đúng phân vai đã nói ở đầu file.
 * - `east` 105,62: rìa đông của địa bàn ở khoảng 105,55 phía Mèo Vạc – Khâu Vai. Thị trấn Bảo
 *   Lạc của Cao Bằng nằm quanh 105,67, nên cạnh này phải dừng dưới mốc đó. Đây là ranh giới dễ
 *   nhầm nhất với khách, vì đường từ Mèo Vạc sang Bảo Lạc là một cung được đi rất nhiều.
 */
export const REGION_BBOX: RegionBoundingBox = {
  south: 22.05,
  west: 104.25,
  north: 23.42,
  east: 105.62,
};

/**
 * Nhãn địa bàn dùng khi trích dẫn nguồn.
 *
 * Viết cả hai tên trong cùng một chuỗi là có chủ ý. Nói trống "Hà Giang" thì đúng với cách khách
 * gọi nhưng sai với địa giới hiện hành; nói trống "Tuyên Quang" thì đúng giấy tờ nhưng khách
 * không nhận ra đang nói về nơi họ hỏi, và tệ hơn là tưởng chatbot trả lời nhầm tỉnh. Ghép lại
 * thì câu trích dẫn vừa khớp cách gọi vừa không khẳng định một đơn vị hành chính đã không còn.
 */
export const REGION_LABEL = "Hà Giang (tỉnh Tuyên Quang)";
