import type { KnowledgeDomain, KnowledgeEntityType } from "@prisma/client";
import { normalizePlaceName } from "@data/places/normalize";

/**
 * SUY TÍN HIỆU METADATA TỪ CÂU HỎI — đầu vào cho nhánh truy xuất theo metadata.
 *
 * Năm cột metadata (`domain`, `entityType`, `season`, `entityId`, `scope`) được chuẩn bị từ lúc
 * ingest với chủ ý "lọc trước rồi mới tính tương đồng", nhưng tầng truy xuất chưa bao giờ đọc ba
 * cột đầu. File này là phần còn thiếu: đọc câu hỏi và nói xem tín hiệu nào đủ rõ để dùng.
 *
 * TẤT ĐỊNH, KHÔNG GỌI MODEL. Cùng lý do với server/domain/agents/slotExtract.ts: một lượt gọi
 * model nữa trên đường đi đang phải giữ dưới ngưỡng 3 giây của NFR-PERF-03 là quá đắt cho một
 * phép phân loại mà vài chục từ khoá giải quyết được, và một bộ quy tắc đọc được thì gỡ lỗi được.
 *
 * Tín hiệu ở đây KHÔNG dùng để lọc cứng. Xem `metadataBranch` trong retrieval.ts: nó là một nhánh
 * xếp hạng THÊM, nên tài liệu khớp metadata được cộng điểm còn tài liệu không khớp vẫn nằm
 * nguyên trong nhánh vector gốc. Lọc cứng ở đây sẽ tái lập đúng cái bẫy mà chú thích `baseFilter`
 * đã mô tả: một câu hỏi lỡ chạm vào từ khoá của một nhánh là mất sạch bảy nhánh còn lại.
 */

/**
 * Từ khoá cho từng nhánh nội dung, so trên văn bản ĐÃ BỎ DẤU.
 *
 * Bỏ dấu vì phần lớn người dùng gõ không dấu — cùng lý do đã ghi ở `normalizePlaceName`. Danh
 * sách cố tình ngắn và chỉ gồm từ gần như không mang nghĩa nào khác trong ngữ cảnh du lịch: một
 * từ khoá quá rộng sẽ gắn nhãn domain cho mọi câu hỏi, và khi đó nhánh metadata thành một bản sao
 * của nhánh vector chứ không thêm thông tin gì.
 */
const DOMAIN_PATTERNS: [RegExp, KnowledgeDomain][] = [
  [/\b(an|mon|am thuc|dac san|quan an|nha hang|ruou|che|mat ong|banh|chao|thit|com|lau|pho)\b/, "food"],
  [/\b(ngu|o dau|luu tru|homestay|khach san|nha nghi|phong|dat phong|nha san)\b/, "accommodation"],
  [/\b(huy|hoan tien|dat cho|thanh toan|dat coc|phu thu|khieu nai|chinh sach|hoa don|ma tra cuu)\b/, "policy"],
  [/\b(xe may|o to|xe khach|thue xe|bang lai|xang|sat lo|suong mu|an toan|giay phep|tien mat|atm|mang gi|mac gi)\b/, "travel_guide"],
  [/\b(mua|thang may|tam giac mach|lua chin|hoa cai|hoa dao|hoa man|bien may|mua mua|mua lanh)\b/, "seasonal_recommendation"],
  [/\b(deo|thac|hem|cot co|diem ngam|cho phien|di tich|dinh thu|pho co|song)\b/, "attraction"],
];

/**
 * Nhãn mùa của bộ quy đổi thời gian -> giá trị cột `season`.
 *
 * Hai bảng vốn đã dùng chung một union `Season` (data/knowledge/types.ts và
 * server/domain/temporal/types.ts), nên đây chỉ là phép lọc giá trị hợp lệ chứ không phải ánh xạ.
 * Kiểm lại vẫn cần: cột `season` khai String[] chứ không phải enum, nên một giá trị lạ sẽ lọt qua
 * trình biên dịch rồi âm thầm không khớp hàng nào.
 */
const KNOWN_SEASONS = new Set([
  "hoa_tam_giac_mach", "lua_chin", "hoa_cai", "hoa_dao_man", "mua_mua", "mua_lanh", "quanh_nam",
]);

/**
 * `quanh_nam` KHÔNG phải tín hiệu.
 *
 * Nó là giá trị mặc định của tài liệu không phụ thuộc mùa, tức phần lớn kho. Đưa nó vào nhánh
 * metadata thì nhánh đó khớp gần hết kho và không còn phân biệt được gì — đúng kiểu "tín hiệu"
 * chỉ làm loãng thứ hạng.
 */
export function seasonSignals(seasons: readonly string[] | undefined): string[] {
  return [...new Set((seasons ?? []).filter((season) => KNOWN_SEASONS.has(season) && season !== "quanh_nam"))];
}

/**
 * Đoán nhánh nội dung từ câu hỏi. Trả mảng rỗng khi không đủ rõ — rỗng là câu trả lời hợp lệ và
 * là câu trả lời phổ biến nhất.
 *
 * Nhiều nhánh cùng khớp thì giữ cả: "ăn gì và ngủ ở đâu tại Đồng Văn" thật sự hỏi hai nhánh, và
 * chọn bừa một cái sẽ đẩy nhánh kia xuống dưới.
 */
export function domainSignals(question: string): KnowledgeDomain[] {
  const text = ` ${normalizePlaceName(question)} `;
  const hits = DOMAIN_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, domain]) => domain);
  /**
   * Khớp quá nhiều nhánh thì coi như không có tín hiệu. Một câu chạm vào bốn nhánh trở lên gần
   * như luôn là câu dài hỏi lan man, và khi đó nhánh metadata phủ gần hết kho nên nó chỉ nhân đôi
   * thứ hạng của nhánh vector chứ không thêm thông tin.
   */
  return hits.length >= 4 ? [] : [...new Set(hits)];
}

/**
 * `PlaceKind` của địa danh khách nhắc tới -> `KnowledgeEntityType` tương ứng.
 *
 * Hai danh sách được khai riêng và CỐ TÌNH không gộp (xem đầu data/places/types.ts): danh mục chỉ
 * liệt kê thứ có thật và định vị được, còn kho tri thức có thêm những nhánh không phải thực thể
 * địa lý (`faq`, `safety`, `cancellation_policy`). Nhưng mọi giá trị của `PlaceKind` đều có mặt
 * trong `KnowledgeEntityType` với cùng tên, nên phép ánh xạ là đồng nhất — và có một bài test giữ
 * cho điều đó còn đúng, vì ngày nào đó hai enum lệch nhau thì phép ánh xạ này im lặng trả về một
 * giá trị không khớp hàng nào.
 */
export function entityTypeSignals(kinds: readonly string[]): KnowledgeEntityType[] {
  return [...new Set(kinds)] as KnowledgeEntityType[];
}
