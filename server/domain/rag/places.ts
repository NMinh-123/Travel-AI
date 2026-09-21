import { prisma } from "@server/infra/db";
import { OUT_OF_AREA_PLACES } from "@data/places/out-of-area";
import { normalizePlaceName } from "@data/places/normalize";

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
 * Định nghĩa nằm ở @data/places/normalize vì `Place.aliases` được KHAI ở dạng đã chuẩn hoá, nên
 * quy ước đó thuộc về nơi khai dữ liệu. Re-export ở đây để tầng truy xuất và các nơi gọi cũ giữ
 * nguyên đường import, và để `data/validate.ts` kiểm alias bằng đúng phép chuẩn hoá mà bộ phân
 * giải dùng lúc chạy thật.
 */
export { normalizePlaceName } from "@data/places/normalize";

export interface ResolvedPlaces {
  /** Khoá Place của những tên nhận diện được. Đã khử trùng lặp, giữ thứ tự xuất hiện. */
  slugs: string[];
  /** Tên khách nhắc tới nhưng không có trong từ điển — dấu hiệu câu hỏi ngoài địa bàn. */
  unknown: string[];
}

interface PlaceEntry {
  slug: string;
  needles: string[];
  kind: string;
  parentSlug: string | null;
}

/**
 * Từ điển nạp một lần rồi giữ trong bộ nhớ. Bảng chỉ vài chục dòng và gần như không đổi lúc chạy,
 * nên gọi DB cho mỗi lượt hội thoại là thêm một vòng mạng vào đúng đường đi đang phải giữ dưới
 * ngưỡng 3 giây của NFR-PERF-03.
 *
 * Cache theo tiến trình: đổi nội dung bảng Place thì phải khởi động lại server. Đánh đổi này chấp
 * nhận được vì địa danh chỉ đổi khi có người sửa data/places.ts rồi chạy lại seed.
 */
let cache: PlaceEntry[] | null = null;

async function load(): Promise<PlaceEntry[]> {
  if (cache) return cache;

  const rows = await prisma.place.findMany({
    select: { slug: true, name: true, aliases: true, kind: true, parentSlug: true },
    orderBy: { sortOrder: "asc" },
  });

  cache = rows.map((row) => ({
    slug: row.slug,
    kind: String(row.kind),
    parentSlug: row.parentSlug,
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

/**
 * Phân giải danh sách tên địa danh do NLU trích ra.
 *
 * So khớp theo cụm chứa nhau chứ không so bằng: NLU trả về nguyên cụm khách viết ("đèo Mã Pí
 * Lèng", "thị trấn Đồng Văn"), còn từ điển giữ tên gọn. So bằng sẽ trượt gần hết.
 *
 * NHƯNG CHỨA NHAU THÌ PHẢI XẾP HẠNG, KHÔNG ĐƯỢC LẤY CÁI ĐẦU TIÊN. Bản trước duyệt từ điển theo
 * `sortOrder` rồi lấy `find()` đầu tiên khớp theo một trong hai chiều, nên một thực thể có tên
 * DÀI HƠN mà tình cờ chứa tên khách nêu sẽ nuốt mất thực thể đúng — chỉ cần nó được khai sớm hơn
 * trong bảng. Đo được trên dữ liệu thật: "Đồng Văn" ra `cao-nguyen-da-dong-van` (vùng bốn xã) và
 * "Mèo Vạc" ra `meo-vac-giac-xua-homestay`, tức một cái homestay, cho câu hỏi về cả thị trấn.
 *
 * Thứ tự ưu tiên dưới đây đọc theo mức độ chắc chắn giảm dần:
 *   1. Khách gọi ĐÚNG tên trong từ điển — không còn gì để bàn.
 *   2. Khách viết dài hơn tên trong từ điển ("thị trấn Đồng Văn" ⊃ "dong van"): lấy alias dài
 *      nhất khớp được, vì alias càng dài càng dùng được nhiều chữ khách đã viết.
 *   3. Khách viết ngắn hơn tên trong từ điển ("Đồng Văn" ⊂ "cao nguyen da dong van"): đây là mức
 *      yếu nhất và chỉ dùng khi không còn cách nào khác. Lấy alias NGẮN NHẤT, tức thực thể có
 *      tên gần với chữ khách viết nhất — "Mèo Vạc" thì về thị trấn Mèo Vạc, không về một homestay
 *      có chữ "Mèo Vạc" trong tên.
 */
interface Candidate {
  slug: string;
  tier: number;
  aliasLength: number;
}

function bestMatch(entries: PlaceEntry[], needle: string): Candidate | null {
  let best: Candidate | null = null;

  for (const entry of entries) {
    for (const alias of entry.needles) {
      let tier: number;
      if (alias === needle) tier = 0;
      else if (needle.includes(alias)) tier = 1;
      else if (alias.includes(needle)) tier = 2;
      else continue;

      // Trong bậc 1 alias dài thắng, trong bậc 2 alias ngắn thắng. Bậc 0 chỉ có một cách khớp.
      const better =
        !best ||
        tier < best.tier ||
        (tier === best.tier &&
          (tier === 1 ? alias.length > best.aliasLength : alias.length < best.aliasLength));

      if (better) best = { slug: entry.slug, tier, aliasLength: alias.length };
    }
  }

  return best;
}

export async function resolvePlaceNames(names: string[]): Promise<ResolvedPlaces> {
  const entries = await load();
  const slugs: string[] = [];
  const unknown: string[] = [];

  for (const raw of names) {
    const needle = normalizePlaceName(raw);
    if (!needle) continue;

    const hit = bestMatch(entries, needle);

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
 *
 * Tên nằm LỒNG TRONG một tên dài hơn thì bị bỏ. "Thời tiết trên cao nguyên đá Đồng Văn" chứa cả
 * `cao nguyen da dong van` lẫn `dong van`, và trước đây cả hai cùng được thêm vào — khách hỏi cả
 * cao nguyên nhưng danh sách lại có thêm thị trấn, rồi tầng dưới ưu tiên nơi cụ thể hơn và trả
 * về số liệu của riêng thị trấn. Chỉ khớp nào không bị một khớp khác trùm lên mới được giữ.
 */
export async function findPlacesInText(text: string): Promise<string[]> {
  const entries = await load();
  const haystack = normalizePlaceName(text);
  if (!haystack) return [];

  const spans: { slug: string; start: number; end: number }[] = [];
  for (const entry of entries) {
    for (const alias of entry.needles) {
      const start = haystack.indexOf(alias);
      if (start === -1) continue;
      spans.push({ slug: entry.slug, start, end: start + alias.length });
      // `needles` đã xếp dài trước ngắn sau, nên khớp đầu tiên trong một entry là khớp dài nhất.
      break;
    }
  }

  const slugs: string[] = [];
  for (const span of spans) {
    const covered = spans.some(
      (other) =>
        other.slug !== span.slug &&
        other.start <= span.start &&
        other.end >= span.end &&
        other.end - other.start > span.end - span.start,
    );
    if (!covered && !slugs.includes(span.slug)) slugs.push(span.slug);
  }
  return slugs;
}

/**
 * Tìm địa danh NGOÀI địa bàn được nhắc trong câu hỏi.
 *
 * Đây là lớp phòng vệ thứ hai phía sau NLU, và là lớp duy nhất còn hoạt động khi NLU bỏ sót hoặc
 * chưa cấu hình được. Xem OUT_OF_AREA_PLACES trong data/places.ts để biết vì sao phải liệt
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

/**
 * Mở một danh sách địa danh ra cả CÂY CON của nó.
 *
 * Vì sao cần: tài liệu tri thức gắn vào thực thể CỤ THỂ — phố cổ Đồng Văn, chợ phiên Đồng Văn,
 * dinh thự họ Vương — trong khi khách hỏi bằng tên VÙNG. Lọc theo đúng slug khách nêu thì câu
 * "có gì ở Đồng Văn" chỉ thấy tài liệu gắn thẳng vào `dong-van` và bỏ qua toàn bộ con cháu, đúng
 * thứ mà cây `parentSlug` trong danh mục sinh ra để gom.
 *
 * Duyệt theo chiều rộng và có tập đã thăm: `data/validate.ts` đã cấm chu trình trong cây, nhưng
 * một bảng Place seed dở dang vẫn có thể có, và một vòng lặp treo ở đây thì treo cả lượt hội thoại.
 */
export function descendantsOf(rows: { slug: string; parentSlug: string | null }[], roots: string[]): string[] {
  if (!roots.length) return [];

  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentSlug) continue;
    children.set(row.parentSlug, [...(children.get(row.parentSlug) ?? []), row.slug]);
  }

  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const slug = queue.shift() as string;
    // Tập đã thăm vừa khử trùng lặp vừa chặn chu trình. data/validate.ts đã cấm chu trình trong
    // danh mục, nhưng một bảng Place seed dở dang vẫn có thể có — và một vòng lặp treo ở đây thì
    // treo cả lượt hội thoại.
    if (seen.has(slug)) continue;
    seen.add(slug);
    for (const child of children.get(slug) ?? []) if (!seen.has(child)) queue.push(child);
  }
  return [...seen];
}

export async function expandPlaceTree(slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  return descendantsOf(await load(), slugs);
}

/** Loại thực thể của những địa danh đã phân giải. Đầu vào cho tín hiệu `entityType` của truy xuất. */
export async function placeKinds(slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  const entries = await load();
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry.kind]));
  return [...new Set(slugs.map((slug) => bySlug.get(slug)).filter((kind): kind is string => Boolean(kind)))];
}
