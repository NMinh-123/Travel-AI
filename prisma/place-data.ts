/**
 * Từ điển địa danh — chiều không gian của kho tri thức.
 *
 * Đây là thứ trả lời được câu hỏi mà ngưỡng liên quan không bao giờ trả lời nổi: "chợ phiên Bắc
 * Hà họp ngày nào" không phải câu hỏi kém liên quan, nó là câu hỏi về một địa bàn khác. Đo trên
 * kho hiện tại, câu đó đạt tương đồng 0,632 và ts_rank 0,587 — cao hơn phần lớn câu hỏi HỢP LỆ,
 * nên không có ngưỡng số nào tách được. Phân biệt được nó đòi hỏi biết "Bắc Hà" là địa danh nằm
 * ngoài địa bàn, tức là một phép tra bảng, và đây là bảng đó.
 *
 * Khoá theo ĐỊA DANH DU LỊCH, không theo đơn vị hành chính. Lý do rất cụ thể: từ 01/7/2025 tỉnh
 * Hà Giang đã nhập vào Tuyên Quang và cấp huyện bị bỏ, nên "huyện Đồng Văn" nay không còn là một
 * đơn vị nào cả — trong khi "Mã Pí Lèng" thì vẫn là Mã Pí Lèng. Khoá theo thứ không đổi.
 *
 * Bí danh viết ở dạng ĐÃ CHUẨN HOÁ: thường, bỏ dấu, đ thành d (xem normalizePlaceName trong
 * server/rag/places.ts). Nhờ vậy chỉ cần liệt kê các cách gọi khác nhau về mặt từ ngữ, còn
 * chuyện có dấu hay không dấu thì hàm chuẩn hoá lo — mà đó lại là chuyện thường gặp: đo trên tập
 * thử, 11/20 câu hỏi hợp lệ sống được là nhờ nhánh từ khoá bỏ dấu.
 */
export type PlaceKindValue = "PROVINCE" | "TOWN" | "SITE";

export interface PlaceSeed {
  slug: string;
  name: string;
  kind: PlaceKindValue;
  aliases: string[];
  sortOrder: number;
}

export const PLACES: PlaceSeed[] = [
  // ── Cấp tỉnh ───────────────────────────────────────────────────────────────────────────
  {
    slug: "ha-giang",
    name: "Hà Giang",
    kind: "PROVINCE",
    // "tuyen quang" là tên tỉnh sau sáp nhập, và "cao nguyen da" là cách gọi cả vùng lõi.
    // Cả hai đều phải dẫn về đây, nếu không thì câu hỏi dùng tên mới lại bị coi là ngoài địa bàn.
    aliases: ["ha giang", "hagiang", "hg", "tuyen quang", "cao nguyen da", "cao nguyen da dong van"],
    sortOrder: 0,
  },

  // ── Thị trấn, nơi dừng nghỉ ────────────────────────────────────────────────────────────
  {
    slug: "tp-ha-giang",
    name: "Thành phố Hà Giang",
    kind: "TOWN",
    aliases: ["thanh pho ha giang", "tp ha giang", "tp hg"],
    sortOrder: 10,
  },
  {
    slug: "quan-ba",
    name: "Quản Bạ",
    kind: "TOWN",
    aliases: ["quan ba", "tam son"],
    sortOrder: 11,
  },
  {
    slug: "yen-minh",
    name: "Yên Minh",
    kind: "TOWN",
    aliases: ["yen minh"],
    sortOrder: 12,
  },
  {
    slug: "dong-van",
    name: "Đồng Văn",
    kind: "TOWN",
    aliases: ["dong van", "thi tran dong van"],
    sortOrder: 13,
  },
  {
    slug: "meo-vac",
    name: "Mèo Vạc",
    kind: "TOWN",
    aliases: ["meo vac", "thi tran meo vac"],
    sortOrder: 14,
  },
  {
    slug: "hoang-su-phi",
    name: "Hoàng Su Phì",
    kind: "TOWN",
    aliases: ["hoang su phi"],
    sortOrder: 15,
  },
  {
    slug: "xin-man",
    name: "Xín Mần",
    kind: "TOWN",
    aliases: ["xin man", "coc pai"],
    sortOrder: 16,
  },
  {
    slug: "bac-me",
    name: "Bắc Mê",
    kind: "TOWN",
    aliases: ["bac me"],
    sortOrder: 17,
  },

  // ── Điểm tham quan ─────────────────────────────────────────────────────────────────────
  //
  // Tám slug đầu nhóm này TRÙNG với Destination.id trong prisma/seed-data.ts, và trùng có chủ ý:
  // ingest gán placeSlug cho bài viết điểm đến bằng chính id của nó, nên hai bảng khớp nhau mà
  // không cần bảng ánh xạ trung gian. Thêm một điểm đến vào seed-data thì phải thêm một dòng ở
  // đây, nếu không bài viết của nó sẽ trỏ tới một địa danh không tồn tại — kiểm tra tính toàn vẹn
  // này nằm ở cuối scripts/ingest-knowledge.ts.
  {
    slug: "ma-pi-leng",
    name: "Đèo Mã Pí Lèng",
    kind: "SITE",
    aliases: ["ma pi leng", "ma pi leng", "deo ma pi leng", "ma pileng", "hem tu san", "tu san"],
    sortOrder: 20,
  },
  {
    slug: "nho-que-river",
    name: "Sông Nho Quế",
    kind: "SITE",
    aliases: ["nho que", "song nho que", "thuyen nho que"],
    sortOrder: 21,
  },
  {
    slug: "lung-cu-flagpole",
    name: "Cột cờ Lũng Cú",
    kind: "SITE",
    aliases: ["lung cu", "cot co lung cu", "lo lo chai", "ban lo lo chai"],
    sortOrder: 22,
  },
  {
    slug: "doc-tham-ma",
    name: "Dốc Thẩm Mã",
    kind: "SITE",
    aliases: ["tham ma", "doc tham ma", "doc chin khoanh", "chin khoanh"],
    sortOrder: 23,
  },
  {
    slug: "dong-van-old-quarter",
    name: "Phố cổ Đồng Văn",
    kind: "SITE",
    aliases: ["pho co dong van", "pho co", "dinh vua meo", "dinh thu ho vuong", "nha vuong", "sa phin"],
    sortOrder: 24,
  },
  {
    slug: "quan-ba-heaven-gate",
    name: "Cổng trời Quản Bạ",
    kind: "SITE",
    aliases: ["cong troi quan ba", "cong troi", "nui doi", "nui doi co tien", "nui doi quan ba"],
    sortOrder: 25,
  },
  {
    slug: "du-gia-waterfall",
    name: "Du Già",
    kind: "SITE",
    aliases: ["du gia", "thac ba tien", "ban tien du gia"],
    sortOrder: 26,
  },
  {
    slug: "yen-minh-pine-forest",
    name: "Rừng thông Yên Minh",
    kind: "SITE",
    aliases: ["rung thong yen minh", "rung thong", "doc bac sum", "bac sum"],
    sortOrder: 27,
  },

  // Các địa danh dưới đây CHƯA có trang chi tiết trong Destination, nhưng vẫn phải nhận diện
  // được: khách hỏi về chúng là hỏi trong địa bàn, không phải hỏi ngoài phạm vi.
  {
    slug: "sung-la",
    name: "Thung lũng Sủng Là",
    kind: "SITE",
    aliases: ["sung la", "thung lung sung la", "nha cua pao"],
    sortOrder: 28,
  },
  {
    slug: "pho-bang",
    name: "Phó Bảng",
    kind: "SITE",
    aliases: ["pho bang"],
    sortOrder: 29,
  },
  {
    slug: "khau-vai",
    name: "Khâu Vai",
    kind: "SITE",
    aliases: ["khau vai", "khau vai", "cho tinh khau vai"],
    sortOrder: 30,
  },
  {
    slug: "lung-tam",
    name: "Lùng Tám",
    kind: "SITE",
    aliases: ["lung tam", "lang det lung tam"],
    sortOrder: 31,
  },
  {
    slug: "lung-khuy",
    name: "Động Lùng Khúy",
    kind: "SITE",
    aliases: ["lung khuy", "dong lung khuy"],
    sortOrder: 32,
  },
  {
    slug: "mau-due",
    name: "Mậu Duệ",
    kind: "SITE",
    aliases: ["mau due", "doc chu m", "doc chi m"],
    sortOrder: 33,
  },
  {
    slug: "lung-phin",
    name: "Lũng Phìn",
    kind: "SITE",
    aliases: ["lung phin"],
    sortOrder: 34,
  },
];

/**
 * Địa danh du lịch NGOÀI địa bàn, nhận diện để chuyển tiếp sớm.
 *
 * Vì sao cần một danh sách riêng thay vì chỉ dựa vào "không có trong PLACES": nhận ra một cụm từ
 * là TÊN ĐỊA DANH là việc cần hiểu ngôn ngữ, và trong hệ thống này việc đó do NLU làm — tức một
 * lượt gọi model. Khi NLU bỏ sót, hoặc khi chưa cấu hình được API key, không còn gì phát hiện
 * "Bắc Hà" là một nơi cả: quét chuỗi chỉ khẳng định được những nơi CÓ trong từ điển.
 *
 * Đo được hệ quả: bốn câu hỏi về Sa Pa, Bắc Hà và Đà Nẵng vẫn lấy được tài liệu Hà Giang và trả
 * lời như thể đúng, vì "chợ phiên Bắc Hà họp ngày nào" tương đồng 0,632 với bài chợ phiên Hà
 * Giang — cao hơn phần lớn câu hỏi hợp lệ.
 *
 * Danh sách này không bao giờ đầy đủ, và không cần đầy đủ. Nó là lớp phòng vệ thứ hai phía sau
 * NLU, nhắm vào những nơi mà khách đi Hà Giang hay hỏi nhầm sang nhất — các điểm du lịch miền núi
 * phía Bắc dùng gần như cùng bộ từ vựng. Không có trong danh sách thì hệ thống rơi về hành vi cũ,
 * chứ không hỏng.
 *
 * Cố tình KHÔNG nạp vào bảng Place: đây là danh sách chặn, không phải nội dung ứng dụng phục vụ.
 * Trộn chung sẽ khiến một truy vấn Place vô tình trả ra những nơi không thuộc phạm vi sản phẩm.
 */
export const OUT_OF_AREA_PLACES: string[] = [
  // Miền núi phía Bắc — nhóm dễ nhầm nhất
  "sa pa", "sapa", "lao cai", "bac ha", "y ty", "o quy ho", "fansipan",
  "mu cang chai", "yen bai", "nghia lo", "tu le",
  "moc chau", "son la", "ta xua", "moc chau",
  "cao bang", "ban gioc", "ba be", "bac kan", "lang son", "mau son",
  "dien bien", "lai chau", "sin ho", "pu luong", "mai chau", "hoa binh",
  "tam dao", "ba vi", "sa pa town",
  // Ngoài miền Bắc — hỏi nhầm ít hơn nhưng vẫn gặp
  "da lat", "da nang", "hoi an", "hue", "nha trang", "phu quoc", "con dao",
  "ha long", "cat ba", "ninh binh", "trang an", "phong nha", "quy nhon",
  "vung tau", "can tho", "sai gon", "ho chi minh", "phan thiet", "mui ne",
];
