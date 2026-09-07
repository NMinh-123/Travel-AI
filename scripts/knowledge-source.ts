/**
 * Tri thức dạng chính sách và FAQ cho chatbot.
 *
 * Toàn bộ nội dung dưới đây trước Vòng 5 nằm cứng trong CONCIERGE_SYSTEM_PROMPT. Chuyển ra file
 * này để nó đi qua đường ống RAG như mọi tài liệu khác: chunk, sinh embedding, đánh chỉ mục, và
 * quan trọng nhất là **trích dẫn được nguồn**.
 *
 * Đây vẫn là dữ liệu tĩnh trong repo, chưa phải kho tri thức do biên tập viên quản lý qua giao
 * diện (FR-ADM-02, thuộc Giai đoạn 2). Nhưng nó đã nằm đúng chỗ trong kiến trúc, nên khi có trang
 * quản trị thì chỉ cần đổi nguồn đọc, không phải sửa gì ở tầng truy xuất.
 */
export interface KnowledgeSourceDoc {
  slug: string;
  docType: "faq" | "policy" | "destination" | "tour_desc";
  title: string;
  content: string;

  /**
   * Khoá Place mà tài liệu này nói riêng về. Bỏ trống nghĩa là tri thức cấp địa bàn, áp cho mọi
   * nơi — và đó là mặc định đúng cho hầu hết nội dung ở đây.
   *
   * Chỉ gắn địa danh khi tài liệu thực sự CHỈ đúng về nơi đó. Một bài liệt kê lịch của tất cả
   * các chợ phiên là tri thức cấp địa bàn, dù trong đó có nhắc tên Mèo Vạc; gắn nó vào Mèo Vạc
   * sẽ làm nó biến mất khi khách hỏi về chợ ở Đồng Văn.
   */
  place?: string;

  /**
   * Trang gốc của tri thức lấy từ bên ngoài, và ngày đối chiếu lần cuối. Tài liệu do dự án tự
   * viết (các mục trong file này, và mô tả điểm đến sinh từ seed-data) thì bỏ trống cả hai.
   *
   * Hai trường này được ingest ghép thành một câu ở CUỐI MỖI ĐOẠN chứ không phải thành cột
   * riêng trong bảng KnowledgeDoc. Đánh đổi đã biết: câu nguồn nằm trong `content` nên nó đi
   * vào cả vector lẫn chỉ mục từ khoá, làm nhiễu một chút. Bù lại không phải migrate schema, và
   * quan trọng hơn là model luôn nhìn thấy nguồn ngay trong đoạn nó đang đọc, nên trích dẫn
   * được mà không cần thêm đường truyền metadata nào qua tầng truy xuất.
   */
  sourceUrl?: string;
  retrievedAt?: string;
}

export const POLICY_AND_FAQ: KnowledgeSourceDoc[] = [
  {
    slug: "an-toan-deo-nguyen-tac-so",
    docType: "policy",
    title: "Nguyên tắc sống còn khi đổ đèo Hà Giang",
    content:
      "Lên số nào xuống số đó — đổ đèo phải về số 1 hoặc số 2 để động cơ ghì tốc độ. " +
      "Tuyệt đối không tắt máy thả trôi xe: mất phanh động cơ và mất luôn khả năng kiểm soát. " +
      "Không bóp phanh liên tục vì sẽ làm nóng và cháy bố thắng, phanh mất tác dụng đúng lúc cần nhất. " +
      "Luôn nhường đường cho xe tải chở đá ở các góc cua mù. " +
      "Với xe tay ga, phanh động cơ rất yếu nên hạn chế dùng để đổ các đèo dài như Mã Pí Lèng.",
  },
  {
    slug: "an-toan-deo-danh-sach",
    docType: "policy",
    title: "Các con đèo và dốc hiểm trở cần đặc biệt chú ý",
    content:
      "Đèo Mã Pí Lèng: cung đèo nguy hiểm và đẹp nhất, vách đá dựng đứng bên sông Nho Quế. " +
      "Dốc Thẩm Mã: chín khoanh cua tay áo liên tiếp. " +
      "Dốc Bắc Sum: cửa ngõ lên cao nguyên đá, hay có sương mù dày vào sáng sớm. " +
      "Dốc Chữ M ở Mậu Duệ: hai khúc cua gấp hình chữ M. " +
      "Đèo Gió và Dốc Kéo Co: đường hẹp, nhiều đoạn không có hộ lan.",
  },
  {
    slug: "am-thuc-dac-san",
    docType: "faq",
    title: "Ẩm thực đặc trưng nên thử ở Hà Giang",
    content:
      "Bánh tam giác mạch nướng, thắng cố ngựa nguyên bản ở chợ phiên, cháo ấu tẩu ăn đêm để giải cảm, " +
      "phở Tráng Kìm tráng tay dẻo thơm, rượu ngô men lá, thịt trâu và thịt lợn gác bếp tẩm mắc khén. " +
      "Chợ phiên thường họp vào cuối tuần và là nơi ăn thắng cố đúng vị nhất.",
  },
  {
    slug: "mua-du-lich",
    docType: "faq",
    title: "Nên đi Hà Giang vào mùa nào",
    content:
      "Tháng 9 đến tháng 10: mùa lúa chín vàng ở Hoàng Su Phì và các thung lũng. " +
      "Tháng 10 đến tháng 12: mùa hoa tam giác mạch phủ hồng cao nguyên đá. " +
      "Tháng 12 đến tháng 2: mùa săn mây, hoa đào, hoa lê, hoa mận nở đón xuân; trời rất lạnh, " +
      "cần chuẩn bị đồ giữ ấm và lưu ý sương muối trên đèo. " +
      "Tháng 5 đến tháng 6: mùa nước đổ, ruộng bậc thang lấp lánh như gương trời.",
  },
  {
    slug: "faq-thoi-tiet-tham-khao",
    docType: "faq",
    title: "Số liệu thời tiết đèo trong ứng dụng là gì",
    content:
      "Bảng điều kiện các đỉnh đèo trong ứng dụng là số liệu tham khảo theo mùa, KHÔNG phải quan trắc " +
      "thời gian thực và chưa nối với API thời tiết nào. Trước khi lên đường luôn phải kiểm tra dự báo " +
      "thời tiết cập nhật và hỏi lại chủ homestay hoặc cửa hàng thuê xe về tình trạng đường thực tế.",
  },
  {
    slug: "faq-cuu-ho-khan-cap",
    docType: "policy",
    title: "Gọi ai khi gặp sự cố trên đường đèo",
    content:
      "Ba số khẩn cấp quốc gia dùng được trên toàn quốc: 113 cảnh sát, 115 cấp cứu y tế, " +
      "114 cứu hoả và cứu nạn cứu hộ. " +
      "Ngay khi nhận xe, hãy lưu số điện thoại của cửa hàng thuê xe và của homestay sẽ nghỉ đêm — " +
      "đó là nguồn hỗ trợ nhanh nhất khi hỏng xe giữa đường. " +
      "Hệ thống không cung cấp số cứu hộ địa phương vì không xác minh được tính chính xác của chúng.",
  },
  {
    slug: "faq-gia-tham-khao",
    docType: "policy",
    title: "Mức độ tin cậy của giá trong ứng dụng",
    content:
      "Mọi con số chi phí trong ứng dụng là ước tính theo mặt bằng giá tháng 09/2026 và sẽ lạc hậu theo " +
      "thời gian. Đây là ước tính tham khảo, không phải báo giá cam kết. " +
      "Đánh giá và số lượt đánh giá của homestay hiện là dữ liệu mẫu, chưa nối với hệ thống đặt phòng thật; " +
      "phải xác nhận giá và tình trạng phòng trực tiếp với chủ nhà trước khi đi.",
  },
];
