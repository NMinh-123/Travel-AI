/**
 * Danh sách trang nguồn cho kho tri thức — đầu vào của `npm run db:crawl`.
 *
 * Đây là danh sách do người chọn, KHÔNG phải crawler tự đi lang thang theo link. Kho tri thức
 * của chatbot phải là "tri thức đã kiểm duyệt" (SRS Mục 11.4), nên phạm vi thu thập được giới
 * hạn ngay từ đầu vào: mỗi URL dưới đây là một trang đã được đọc qua và xác định là nói đúng
 * chủ đề, thay vì để máy quyết định đọc gì.
 *
 * `topic` không dùng để lọc lúc chạy — nó để người biên tập biết trang này lấy về nhằm trả lời
 * nhóm câu hỏi nào, khi đối chiếu bản thô với scripts/knowledge-web.ts.
 */
export interface WebSource {
  /** Tên file bản thô sẽ ghi ra: scripts/raw-web/<id>.txt */
  id: string;
  url: string;
  topic: string;
  /** Ghi chú của người biên tập: trang này đáng tin tới đâu, dùng được phần nào. */
  note?: string;
}

export const WEB_SOURCES: WebSource[] = [
  {
    id: "hanhchinh-sapnhap-tuyenquang",
    url: "https://www.tuyenquang.gov.vn/vi/post/chinh-thuc-sap-nhap-tinh-tuyen-quang-va-tinh-ha-giang-thanh-tinh-tuyen-quang?type=NEWS&id=148950",
    topic: "địa giới hành chính",
    note: "Cổng thông tin điện tử cấp tỉnh — nguồn có thẩm quyền cho việc Hà Giang nhập vào Tuyên Quang.",
  },
  {
    id: "phapluat-nd34-bien-gioi",
    url: "https://thuvienphapluat.vn/van-ban/Linh-vuc-khac/Nghi-dinh-34-2014-ND-CP-quy-che-khu-vuc-bien-gioi-dat-lien-nuoc-Viet-Nam-228215.aspx",
    topic: "giấy tờ khu vực biên giới",
    note: "Toàn văn Nghị định 34/2014/NĐ-CP. Trang này chặn bot (HTTP 403) nên crawler không lấy được — giữ lại trong danh sách để biết đã tra ở đâu; bản dùng được là mục bienphong-nd34 ngay dưới.",
  },
  {
    id: "bienphong-nd34",
    url: "http://bienphongvietnam.gov.vn/nghi-dinh-so-34-2014-nd-cp-ngay-29-04-2014-ve-ve-quy-che-khu-vuc-bien-gioi-dat-lien-nuoc-cong-hoa-xa-hoi-chu-nghia-viet-nam.html",
    topic: "giấy tờ khu vực biên giới",
    note: "Bản đăng trên cổng Bộ đội Biên phòng — đối chiếu chéo với bản thuvienphapluat.",
  },
  {
    id: "choPhien-lich-hop",
    url: "https://motogo.vn/cho-phien-ha-giang/",
    topic: "chợ phiên",
    note: "Lịch họp chi tiết nhất tìm được, có cả chợ theo ngày con giáp. Cần đối chiếu vì các nguồn khác gán ngày khác nhau cho chợ Lũng Phìn.",
  },
  {
    id: "choPhien-vietlinktour",
    url: "https://vietlinktour.vn/cho-phien-ha-giang-vao-ngay-nao/",
    topic: "chợ phiên",
    note: "Nguồn thứ hai để đối chiếu lịch chợ theo ngày con giáp.",
  },
  {
    id: "xemay-huong-dan",
    url: "https://laca.fun/blog/huong-dan-du-lich-ha-giang-bang-xe-may",
    topic: "thuê xe máy, xăng, ATM, sóng",
    note: "Chi tiết thực dụng: giá thuê theo loại xe, mức tiêu hao xăng, vùng phủ sóng.",
  },
  {
    id: "xemay-motogo",
    url: "https://motogo.vn/thue-xe-may-ha-giang/",
    topic: "thuê xe máy",
    note: "Đối chiếu khoảng giá thuê xe và yêu cầu giấy tờ.",
  },
  {
    id: "gia-ve-tham-quan",
    url: "https://vietsensetravel.com/gia-ve-cac-diem-tham-quan-ha-giang-n.html",
    topic: "giá vé tham quan",
    note: "Bảng giá vé theo điểm. Giá vé Dinh Vua Mèo ở đây (20k) lệch với nguồn khác (25k) — phải nói rõ là ước tính.",
  },
  {
    id: "nho-que-gia-ve",
    url: "https://pystravel.vn/tin/18196-gia-ve-song-nho-que.html",
    topic: "thuyền sông Nho Quế",
    note: "Giá vé thuyền theo loại. Các nguồn chênh nhau khá nhiều nên chỉ lấy khoảng.",
  },
  {
    id: "lich-trinh-3n2d",
    url: "https://www.klook.com/vi/blog/lich-trinh-di-ha-giang-3-ngay/",
    topic: "lộ trình",
    note: "Lộ trình 3N2Đ theo ngày. Trang chặn bot (HTTP 403); mục lộ trình trong knowledge-web.ts vì thế ghi nguồn theo cẩm nang Vietravel bên dưới.",
  },
  {
    id: "sat-lo-canh-bao",
    url: "https://nhandan.vn/ha-giang-co-hon-250-diem-nguy-co-sat-lo-cao-post884407.html",
    topic: "an toàn mùa mưa",
    note: "Báo Nhân Dân — nguồn báo chí chính thống cho con số điểm nguy cơ sạt lở.",
  },
  {
    id: "sat-lo-chinh-phu",
    url: "https://baochinhphu.vn/ha-giang-mua-lon-gay-sat-lo-chia-cat-nhieu-tuyen-duong-102240910175319631.htm",
    topic: "an toàn mùa mưa",
    note: "Báo Chính phủ — mô tả các tuyến bị chia cắt khi mưa lớn.",
  },
  {
    id: "le-hoi-truyen-thong",
    url: "https://hagiangsensetravel.com/le-hoi-tai-ha-giang-a.html",
    topic: "lễ hội",
    note: "Danh sách lễ hội truyền thống theo mùa và theo dân tộc.",
  },
  {
    id: "kinh-nghiem-vietravel",
    url: "https://www.vietravel.com/vn/am-thuc-kham-pha/du-lich-ha-giang-v18000.aspx",
    topic: "tổng quan, mùa, ẩm thực",
    note: "Cẩm nang tổng hợp của một công ty lữ hành lớn.",
  },
];
