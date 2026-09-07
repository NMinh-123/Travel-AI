import { prisma } from "../db";
import { OUT_OF_AREA_PLACES } from "../../prisma/place-data";

/**
 * Phân giải tên địa danh người dùng gõ thành khoá chuẩn trong bảng Place.
 *
 * Đây là mắt xích khiến chiều địa danh hoạt động được. NLU đã trích ra tên địa danh từ lâu
 * (`entities.destinations`) nhưng không ai đọc, còn tầng truy xuất thì có sẵn bộ lọc mà không ai
 * truyền tham số vào. Module này nối hai đầu đó.
 *
 * Vì sao cần, chứ không chỉ là tối ưu: đo trên kho tri thức hiện tại, câu "chợ phiên Bắc Hà họp
 * ngày nào" đạt tương đồng cosine 0,632 và ts_rank 0,587 — cao hơn phần lớn câu hỏi HỢP LỆ. Cả
 * hai tín hiệu đều bỏ qua đúng một từ quyết định, là tên địa danh. Không ngưỡng số nào tách được
 * hai nhóm đó; quét ngưỡng cho thấy muốn chặn thêm hai câu ngoài địa bàn thì phải hy sinh mười
 * một trên hai mươi câu hợp lệ. Một phép tra bảng giải đúng việc mà ngưỡng không giải được.
 */

/**
 * Chuẩn hoá một chuỗi về dạng so khớp: bỏ dấu, thường hoá, gộp khoảng trắng.
 *
 * NFD tách nguyên âm khỏi dấu thanh rồi xoá toàn bộ ký tự tổ hợp, nên "Mèo Vạc" và "Meo Vac" về
 * cùng một dạng. Chữ đ phải xử lý riêng vì nó là một ký tự độc lập trong Unicode chứ không phải
 * d cộng dấu, nên NFD không đụng tới.
 *
 * Bỏ dấu là bắt buộc chứ không phải tiện tay: đo trên tập thử, mười một trên hai mươi câu hỏi
 * hợp lệ được truy xuất đúng là nhờ nhánh từ khoá bỏ dấu, tức người dùng gõ không dấu là chuyện
 * thường xuyên chứ không phải ngoại lệ.
 */
export function normalizePlaceName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResolvedPlaces {
  /** Khoá Place của những tên nhận diện được. Đã khử trùng lặp, giữ thứ tự xuất hiện. */
  slugs: string[];
  /** Tên khách nhắc tới nhưng không có trong từ điển — dấu hiệu câu hỏi ngoài địa bàn. */
  unknown: string[];
}

interface PlaceEntry {
  slug: string;
  needles: string[];
}

/**
 * Từ điển nạp một lần rồi giữ trong bộ nhớ. Bảng chỉ vài chục dòng và gần như không đổi lúc chạy,
 * nên gọi DB cho mỗi lượt hội thoại là thêm một vòng mạng vào đúng đường đi đang phải giữ dưới
 * ngưỡng 3 giây của NFR-PERF-03.
 *
 * Cache theo tiến trình: đổi nội dung bảng Place thì phải khởi động lại server. Đánh đổi này chấp
 * nhận được vì địa danh chỉ đổi khi có người sửa prisma/place-data.ts rồi chạy lại seed.
 */
let cache: PlaceEntry[] | null = null;

async function load(): Promise<PlaceEntry[]> {
  if (cache) return cache;

  const rows = await prisma.place.findMany({
    select: { slug: true, name: true, aliases: true },
    orderBy: { sortOrder: "asc" },
  });

  cache = rows.map((row) => ({
    slug: row.slug,
    // Tên hiển thị cũng là một cách gọi hợp lệ, và bí danh trong place-data.ts đã ở dạng chuẩn
    // hoá rồi — nhưng chuẩn hoá lại lần nữa để một dòng dữ liệu gõ sót dấu không âm thầm vô hiệu.
    needles: [...new Set([normalizePlaceName(row.name), ...row.aliases.map(normalizePlaceName)])]
      .filter(Boolean)
      // Dài trước ngắn sau: "cot co lung cu" phải được thử trước "lung cu", nếu không thì cụm dài
      // không bao giờ tới lượt và ta mất khả năng phân biệt hai địa danh lồng nhau.
      .sort((left, right) => right.length - left.length),
  }));

  return cache;
}

/** Xoá cache để lần gọi sau nạp lại. Dùng sau khi seed trong cùng một tiến trình. */
export function resetPlaceCache(): void {
  cache = null;
}

/**
 * Phân giải danh sách tên địa danh do NLU trích ra.
 *
 * So khớp theo cụm chứa nhau chứ không so bằng: NLU trả về nguyên cụm khách viết ("đèo Mã Pí
 * Lèng", "thị trấn Đồng Văn"), còn từ điển giữ tên gọn. So bằng sẽ trượt gần hết.
 */
export async function resolvePlaceNames(names: string[]): Promise<ResolvedPlaces> {
  const entries = await load();
  const slugs: string[] = [];
  const unknown: string[] = [];

  for (const raw of names) {
    const needle = normalizePlaceName(raw);
    if (!needle) continue;

    const hit = entries.find((entry) =>
      entry.needles.some((alias) => needle.includes(alias) || alias.includes(needle)),
    );

    if (hit) {
      if (!slugs.includes(hit.slug)) slugs.push(hit.slug);
    } else if (!unknown.includes(raw)) {
      unknown.push(raw);
    }
  }

  return { slugs, unknown };
}

/**
 * Quét thẳng câu hỏi để tìm địa danh, không qua NLU.
 *
 * Cần thiết vì NLU là một lượt gọi model: nó có thể bỏ sót, và khi thiếu GEMINI_API_KEY thì
 * không chạy được lượt nào. Quét chuỗi thì luôn có, và với các địa danh viết rời như "mã pí
 * lèng" thì nó thậm chí chắc chắn hơn.
 */
export async function findPlacesInText(text: string): Promise<string[]> {
  const entries = await load();
  const haystack = normalizePlaceName(text);
  if (!haystack) return [];

  const slugs: string[] = [];
  for (const entry of entries) {
    if (entry.needles.some((alias) => haystack.includes(alias)) && !slugs.includes(entry.slug)) {
      slugs.push(entry.slug);
    }
  }
  return slugs;
}

/**
 * Tìm địa danh NGOÀI địa bàn được nhắc trong câu hỏi.
 *
 * Đây là lớp phòng vệ thứ hai phía sau NLU, và là lớp duy nhất còn hoạt động khi NLU bỏ sót hoặc
 * chưa cấu hình được. Xem OUT_OF_AREA_PLACES trong prisma/place-data.ts để biết vì sao phải liệt
 * kê tường minh thay vì suy ra từ "không có trong từ điển".
 *
 * So khớp theo RANH GIỚI TỪ chứ không phải chuỗi con: "hue" là chuỗi con của rất nhiều từ tiếng
 * Việt bỏ dấu ("thue" trong "thuê xe"), nên `includes` trần sẽ biến câu "thuê xe máy ở Hà Giang"
 * thành câu hỏi về Huế. Danh sách này có quyền chuyển tiếp cả lượt hội thoại nên không được phép
 * khớp bừa.
 */
export function findOutOfAreaPlaces(text: string): string[] {
  const haystack = ` ${normalizePlaceName(text)} `;
  return OUT_OF_AREA_PLACES.filter((name) => haystack.includes(` ${name} `)).filter(
    (name, index, all) => all.indexOf(name) === index,
  );
}
