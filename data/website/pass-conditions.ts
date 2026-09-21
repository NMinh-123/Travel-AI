import type { WebsitePassCondition } from "@data/website/types";

/**
 * ĐIỀU KIỆN ĐÈO THEO MÙA — dữ liệu THAM KHẢO, tuyệt đối không phải quan trắc thời gian thực.
 *
 * BẢNG NÀY TỪNG BỊ DÙNG SAI, và ghi lại ở đây để không ai lặp lại. Trước đây nó được chèn vào
 * prompt của tác tử tri thức mỗi khi câu hỏi nhắc tới thời tiết, tức một bảng số cố định trong
 * database được trình bày cho khách như tình hình hiện tại. Đó là vi phạm trực tiếp SRS Mục
 * 11.1.1.3 về tách dữ liệu tĩnh khỏi dữ liệu động, và là kiểu sai tệ nhất trong nhóm nội dung an
 * toàn: khách hỏi "đèo Mã Pí Lèng giờ thế nào" rồi nhận một câu trả lời tự tin về sương mù của
 * một thời điểm nào đó trong quá khứ.
 *
 * Nay thời tiết thật đến từ `getWeather` ở @server/infra/realtime, gọi Open-Meteo với đúng độ cao
 * của từng điểm đo. Bảng này giữ đúng một vai trò còn lại: cho khách hình dung điều kiện ĐIỂN
 * HÌNH của một con đèo trước khi lên kế hoạch, trên trang cẩm nang.
 *
 * HỆ QUẢ PHẢI GIỮ: không đưa bảng này vào prompt của bất kỳ tác tử nào như thể là thời tiết hiện
 * tại. Cần nói về điều kiện theo mùa thì lấy từ @data/knowledge với
 * `domain: "seasonal_recommendation"` — nội dung ở đó là văn bản đã biên tập và trích dẫn được
 * nguồn, còn các con số ở đây thì không.
 *
 * `temp` là nhiệt độ điển hình của mùa lạnh, mùa mà điều kiện đèo đáng lo nhất. Chọn mùa lạnh chứ
 * không chọn trung bình năm vì trung bình năm là con số không mô tả bất kỳ ngày thật nào, và với
 * mục đích cảnh báo thì mô tả điều kiện xấu mới có ích.
 */
export const WEBSITE_PASS_CONDITIONS: WebsitePassCondition[] = [
  {
    slug: "deo-ma-pi-leng",
    placeSlug: "deo-ma-pi-leng",
    location: "Đèo Mã Pí Lèng",
    elevation: 1500,
    temp: 9,
    condition: "Nhiều mây, sương mù từng đợt",
    windSpeedKm: 25,
    fogLevel: "Dày vào sáng sớm và chiều muộn",
    roadStatus: "Thông, mặt đường tốt nhưng gần như không có lề",
    sortOrder: 0,
  },
  {
    slug: "cong-troi-quan-ba",
    placeSlug: "cong-troi-quan-ba",
    location: "Cổng Trời Quản Bạ",
    elevation: 1500,
    temp: 10,
    condition: "Sương đọng đáy thung vào đầu ngày",
    windSpeedKm: 18,
    fogLevel: "Dày vào sáng sớm, tan khi nắng lên",
    roadStatus: "Thông, quốc lộ 4C mặt đường tốt",
    sortOrder: 1,
  },
  {
    slug: "cot-co-lung-cu",
    placeSlug: "cot-co-lung-cu",
    location: "Cột cờ Lũng Cú",
    elevation: 1470,
    temp: 8,
    condition: "Gió mạnh, trời quang thì tầm nhìn rất xa",
    windSpeedKm: 32,
    fogLevel: "Thay đổi nhanh, ngày mù thì không thấy gì từ đài quan sát",
    roadStatus: "Thông; khu vực biên giới, tuân thủ hướng dẫn biên phòng",
    sortOrder: 2,
  },
  {
    slug: "doc-tham-ma",
    placeSlug: "doc-tham-ma",
    location: "Dốc Thẩm Mã",
    elevation: 1200,
    temp: 11,
    condition: "Khô ráo phần lớn thời gian mùa lạnh",
    windSpeedKm: 15,
    fogLevel: "Nhẹ",
    roadStatus: "Thông, nhiều khúc cua gấp liên tục",
    sortOrder: 3,
  },
  {
    slug: "deo-bac-sum",
    placeSlug: "deo-bac-sum",
    location: "Dốc Bắc Sum",
    elevation: 800,
    temp: 14,
    condition: "Hay có biển mây phủ thung lũng phía dưới vào sáng sớm",
    windSpeedKm: 12,
    fogLevel: "Nhẹ tới trung bình",
    roadStatus: "Thông, dốc dài liên tục nên xe dễ nóng máy",
    sortOrder: 4,
  },
  {
    slug: "hem-tu-san",
    placeSlug: "hem-tu-san",
    location: "Hẻm vực Tu Sản (lòng sông)",
    elevation: 280,
    temp: 18,
    condition: "Ấm hơn hẳn trên đèo, trong lòng vực tắt nắng rất sớm",
    windSpeedKm: 8,
    fogLevel: "Ít",
    roadStatus: "Đường xuống bến dốc và hẹp, đổi trạng thái mặt đường theo mùa",
    sortOrder: 5,
  },
];
