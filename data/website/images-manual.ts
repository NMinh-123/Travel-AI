import type { ImageRef } from "@data/website/types";

/**
 * ẢNH KHÔNG LẤY TỪ WIKIMEDIA COMMONS — CHƯA XÁC ĐỊNH GIẤY PHÉP.
 *
 * File này TÁCH RIÊNG khỏi @data/website/images vì hai tệp có mức bảo đảm pháp lý khác hẳn nhau,
 * và gộp chung sẽ xoá mất sự khác biệt đó. `images.ts` do `scripts/fetch-place-images.ts` sinh ra
 * từ Commons: mọi mục trong đó đã qua bộ lọc chỉ nhận CC0, CC BY, CC BY-SA và phạm vi công cộng,
 * nên `license` ở đấy là một khẳng định kiểm chứng được. Ở file này thì KHÔNG: các ảnh dưới đây
 * lấy từ trang của cơ quan nhà nước, không kèm tuyên bố giấy phép nào, và dự án CHƯA XIN PHÉP.
 *
 * VÌ SAO VẪN CÓ FILE NÀY. Bốn địa danh — Cổng Trời Quản Bạ, Dốc Chín Khoanh, Thác Tiên – Đèo Gió
 * và Bãi đá cổ Nấm Dẩn — không có lấy một tấm ảnh nào trên Commons. Đã tra hết: tìm theo từ khoá
 * nhiều biến thể, duyệt toàn bộ cây thể loại Hà Giang, đọc ảnh trong các bài Wikipedia tiếng
 * Việt, tra theo tên tệp, và tìm trên Openverse. Người dùng dự án quyết định chấp nhận rủi ro để
 * có ảnh thật thay cho hình minh hoạ. Quyết định đó được ghi lại ở đây chứ không giấu trong một
 * lần commit.
 *
 * NGUYÊN TẮC KHI SỬA FILE NÀY:
 *
 *  - `license` PHẢI nói đúng tình trạng. Không bao giờ gán nhãn CC cho ảnh chưa có giấy phép CC —
 *    một nhãn sai ở đây còn tệ hơn không có nhãn, vì nó làm người sau tưởng đã kiểm rồi.
 *  - `sourcePage` trỏ tới trang đã lấy ảnh, để người sau kiểm được xuất xứ và đi xin phép.
 *  - Ưu tiên nguồn theo đúng thứ tự tier ở @data/knowledge/web-sources: cơ quan nhà nước trước,
 *    rồi báo chí. KHÔNG lấy ảnh từ trang thương mại hay mạng xã hội: ảnh ở đó vừa không có giấy
 *    phép vừa thường đã bị lấy lại từ nơi khác, nên không truy được tác giả gốc.
 *  - Slug nào tìm được ảnh Commons hợp lệ thì GỠ khỏi đây — `images.ts` luôn thắng.
 *
 * ẢNH DẪN THẲNG TỪ MÁY CHỦ NGUỒN, không tự lưu. Nếu nguồn đổi đường dẫn thì ảnh mất, và trang sẽ
 * rơi về hình minh hoạ như trước — hỏng thấy được ngay chứ không âm thầm.
 */
export const MANUAL_PLACE_IMAGES: Record<string, ImageRef[]> = {
  // Cổng thông tin quảng bá du lịch nông thôn của Cục Du lịch Quốc gia Việt Nam. Đây cũng chính
  // là trang đang được dẫn trong `sourceLinks` của điểm đến này, nên ảnh và nội dung cùng một gốc.
  "thac-tien-deo-gio": [
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Thac-Tien1.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/ve-dep-yen-binh-tho-mong-cua-thac-tien-deo-gio-ha-giang/",
      widthPx: 700,
    },
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Thac-Tien2.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/ve-dep-yen-binh-tho-mong-cua-thac-tien-deo-gio-ha-giang/",
      widthPx: 700,
    },
  ],

  // Nặm Đăm không có ảnh nào trên Commons dù là làng du lịch cộng đồng được giải ASEAN: đã tra
  // "Nam Dam village", "Nam Dam Quan Ba", "Dao village Quan Ba" và intitle:"Nặm Đăm", đều rỗng.
  "ban-nam-dam": [
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Nam-Dam2-2-1024x731.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/hap-dan-lang-van-hoa-du-lich-cong-dong-nam-dam/",
      widthPx: 1024,
    },
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Nam-Dam1-2.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/hap-dan-lang-van-hoa-du-lich-cong-dong-nam-dam/",
      widthPx: 700,
    },
  ],

  "bai-da-co-nam-dan": [
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Bai-da-co1-1024x401.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/ve-dep-bi-an-cua-bai-da-co-nam-dan-ha-giang/",
      widthPx: 1024,
    },
    {
      url: "https://nongthon.vietnamtourism.gov.vn/wp-content/uploads/2024/02/Bai-da-co2.jpg",
      credit: "Chuyên trang du lịch nông thôn — Cục Du lịch Quốc gia Việt Nam",
      license: "Chưa xác định giấy phép — chưa xin phép sử dụng",
      sourcePage: "https://nongthon.vietnamtourism.gov.vn/ve-dep-bi-an-cua-bai-da-co-nam-dan-ha-giang/",
      widthPx: 680,
    },
  ],
};

/**
 * Hai slug vẫn chưa có ảnh sau cả lần tìm này, ghi lại để khỏi tìm lại từ đầu:
 *
 *  - `cong-troi-quan-ba`: dongvangeopark.com hết hạn chứng chỉ TLS; cổng huyện Quản Bạ
 *    (quanba.hagiang.gov.vn) từ chối kết nối; vietnamtourism.gov.vn dựng bằng JavaScript nên
 *    không bóc được ảnh. Trên Openverse chỉ có một ảnh CC BY-NC-SA, mà NC thì dự án cố tình loại.
 *  - `doc-chin-khoanh`: không có nguồn nhà nước hay báo chí nào truy cập được kèm ảnh. Hai điểm
 *    này giữ ảnh khu vực Quản Bạ và Sủng Là, đều có nhãn "Ảnh khu vực" trên giao diện.
 */
export const MANUAL_IMAGE_GAPS: string[] = ["cong-troi-quan-ba", "doc-chin-khoanh"];
