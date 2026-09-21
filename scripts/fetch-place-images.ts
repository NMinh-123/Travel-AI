import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Sinh data/website/images.ts từ Wikimedia Commons.
 *
 *   npx tsx scripts/fetch-place-images.ts
 *
 * VÌ SAO PHẢI CÓ SCRIPT NÀY thay vì gõ tay danh sách URL ảnh. Ảnh là hạng mục duy nhất trong tầng
 * data mà người viết không thể tự tạo ra và cũng không thể tự xác minh bằng cách đọc lại: một URL
 * ảnh gõ tay nhìn hoàn toàn hợp lệ cho tới khi có người mở trang và thấy khung trống. Nặng hơn,
 * ảnh còn kèm nghĩa vụ pháp lý — dùng ảnh không rõ giấy phép trên một sản phẩm có người xem là
 * rủi ro thật. Script này giải cả hai: URL đến từ API nên chắc chắn tồn tại vào lúc chạy, và giấy
 * phép cùng tên tác giả được lấy từ chính metadata của Commons chứ không do ai đoán.
 *
 * CHỈ NHẬN GIẤY PHÉP CHO PHÉP DÙNG LẠI. Bộ lọc ở `ALLOWED_LICENSE` là nơi thực thi điều đó. Ảnh
 * nào không khớp thì bỏ, và slug đó sẽ không có ảnh — thà thiếu ảnh còn hơn có một ảnh mà không ai
 * dám khẳng định là được phép dùng.
 *
 * GHI CÔNG LÀ BẮT BUỘC, không phải tuỳ chọn. Giấy phép CC BY và CC BY-SA đòi ghi tên tác giả, nên
 * `ImageRef` giữ `credit`, `license` và `sourcePage`; giao diện phải hiển thị chúng ở đâu đó cạnh
 * ảnh. Lấy ảnh CC BY rồi bỏ phần ghi công là vi phạm giấy phép, không phải thiếu sót nhỏ.
 *
 * Script này KHÔNG chạy tự động trong bất kỳ lệnh npm nào. Nó được chạy tay khi cần bổ sung ảnh,
 * và kết quả được commit — để bản build không phụ thuộc vào việc Commons có trả lời hay không.
 */

const API = "https://commons.wikimedia.org/w/api.php";

/** Đủ để phía Commons biết ai đang gọi. Không giả làm trình duyệt. */
const USER_AGENT = "HaGiangTravel-DataBot/1.0 (du an hoc tap; thu thap anh co giay phep)";

/**
 * Nghỉ giữa hai lượt gọi.
 *
 * Con số này ĐO ĐƯỢC, không phải đoán: ở 700 ms, Commons trả HTTP 429 sau khoảng mười một lượt và
 * hai mươi mốt truy vấn còn lại thất bại sạch. 2,5 giây là mức chạy hết danh sách mà không bị
 * chặn. Nếu thêm nhiều truy vấn nữa mà lại gặp 429 thì nới tiếp chứ đừng bỏ phép chờ — API này
 * miễn phí và không cần khoá, nên tôn trọng hạn mức của họ là điều kiện để còn dùng được.
 */
const DELAY_MS = 2500;

/** Chờ khi bị chặn tần suất. Dài hơn hẳn DELAY_MS vì 429 nghĩa là nhịp hiện tại đã quá nhanh. */
const RATE_LIMIT_WAIT_MS = 12000;
const MAX_RATE_LIMIT_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Giấy phép được phép dùng. So khớp bằng tiền tố chữ thường vì Commons ghi rất nhiều biến thể
 * ("CC BY 2.0", "CC BY-SA 4.0", "CC0", "Public domain").
 *
 * CỐ TÌNH BỎ các giấy phép có điều kiện phi thương mại hoặc cấm phái sinh (NC, ND): dự án này là
 * bài tập nhưng vẫn là một sản phẩm có giao diện công khai, và phân biệt "thương mại hay không"
 * là loại tranh luận không nên để lọt vào dữ liệu.
 */
const ALLOWED_LICENSE = ["cc0", "cc by 1", "cc by 2", "cc by 3", "cc by 4", "cc by-sa", "public domain", "pd"];

/**
 * Từ khoá tra ảnh cho từng slug trong @data/places.
 *
 * Dùng tên KHÔNG DẤU và có kèm "Ha Giang" ở những chỗ tên riêng dễ trùng với địa danh khác, vì
 * người tải ảnh lên Commons phần lớn đặt tên file bằng tiếng Anh hoặc tiếng Việt không dấu.
 */
const QUERIES: { slug: string; search: string }[] = [
  { slug: "deo-ma-pi-leng", search: "Ma Pi Leng pass" },
  { slug: "hem-tu-san", search: "Tu San canyon Nho Que" },
  { slug: "song-nho-que", search: "Nho Que river" },
  { slug: "cot-co-lung-cu", search: "Lung Cu flag tower" },
  { slug: "doc-tham-ma", search: "Tham Ma slope Ha Giang" },
  { slug: "pho-co-dong-van", search: "Dong Van old town" },
  { slug: "cong-troi-quan-ba", search: "Quan Ba heaven gate" },
  { slug: "nui-doi-co-tien", search: "Quan Ba twin mountain" },
  { slug: "thac-du-gia", search: "Du Gia waterfall" },
  { slug: "rung-thong-yen-minh", search: "Yen Minh pine forest" },
  { slug: "dinh-thu-ho-vuong", search: "Vuong mansion Sa Phin" },
  { slug: "ruong-bac-thang-hoang-su-phi", search: "Hoang Su Phi terraced field" },
  { slug: "cao-nguyen-da-dong-van", search: "Dong Van karst plateau" },
  { slug: "deo-bac-sum", search: "Bac Sum Ha Giang" },
  { slug: "doc-chin-khoanh", search: "Sung La valley Ha Giang" },
  { slug: "tp-ha-giang", search: "Ha Giang city" },
  { slug: "dong-van", search: "Dong Van Ha Giang" },
  { slug: "meo-vac", search: "Meo Vac" },
  { slug: "yen-minh", search: "Yen Minh Ha Giang" },
  { slug: "quan-ba", search: "Quan Ba Ha Giang" },
  { slug: "sung-la", search: "Sung La Ha Giang" },
  { slug: "lung-cu", search: "Lung Cu Ha Giang" },
  { slug: "du-gia", search: "Du Gia Ha Giang" },
  { slug: "khau-vai", search: "Khau Vai" },
  { slug: "hoang-su-phi", search: "Hoang Su Phi" },
  { slug: "lung-tam", search: "Lung Tam linen Ha Giang" },
  { slug: "pho-bang", search: "Pho Bang Ha Giang" },
  { slug: "cho-phien-dong-van", search: "Dong Van market" },
  { slug: "ban-lo-lo-chai", search: "Lo Lo Chai" },
  { slug: "lang-det-lanh-lung-tam", search: "Hmong linen weaving Ha Giang" },
  { slug: "cho-tinh-khau-vai", search: "Khau Vai love market" },
  { slug: "ban-nam-dam", search: "Nam Dam Ha Giang" },
];

interface Candidate {
  title: string;
  url: string;
  license: string;
  credit: string;
  width: number;
  height: number;
}

/** Bỏ thẻ HTML mà Commons nhúng trong trường Artist, và gộp khoảng trắng. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function licenseAllowed(license: string): boolean {
  const lower = license.toLowerCase();
  return ALLOWED_LICENSE.some((prefix) => lower.startsWith(prefix));
}

/**
 * Đổi URL ảnh GỐC của Commons sang URL ảnh THU NHỎ.
 *
 * VÌ SAO BẮT BUỘC. Ảnh gốc trên Commons là ảnh máy chụp chưa nén lại: đo trên chính bộ ảnh của
 * dự án, 77 ảnh nặng tổng 373 MB, trung bình 4,8 MB và cái lớn nhất 23,4 MB ở 6000px. Trang lưới
 * điểm đến tải mười ba ảnh bìa cùng lúc, tức hàng chục MB cho một màn hình — trên mạng di động ở
 * chính vùng mà sản phẩm này phục vụ thì đó là trang không dùng được.
 *
 * Commons phục vụ sẵn bản thu nhỏ theo đường dẫn `/thumb/<hash>/<tên>/<rộng>px-<tên>`, không cần
 * hạ tầng gì thêm và không phải tự lưu ảnh. 1280px là mức vừa: đủ nét cho ảnh bìa và ảnh trong
 * modal trên màn hình thường, mà nhẹ hơn ảnh gốc hàng chục lần.
 *
 * Ảnh SVG không có bản thu nhỏ theo cách này, nhưng script đã lọc chỉ nhận jpg/png/webp từ trước.
 */
const THUMB_WIDTH = 1280;

function thumbUrl(originalUrl: string, title: string): string {
  // Dạng gốc:  https://upload.wikimedia.org/wikipedia/commons/a/ab/Ten.jpg
  // Dạng thumb: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Ten.jpg/1280px-Ten.jpg
  const marker = "/wikipedia/commons/";
  const at = originalUrl.indexOf(marker);
  if (at === -1) return originalUrl;

  const head = originalUrl.slice(0, at + marker.length);
  const tail = originalUrl.slice(at + marker.length);
  const fileSegment = encodeURIComponent(title.replace(/ /g, "_"));
  return `${head}thumb/${tail}/${THUMB_WIDTH}px-${fileSegment}`;
}

/** Bỏ dấu, thường hoá, tách token — dùng cho phép kiểm liên quan bên dưới. */
function tokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/**
 * ẢNH PHẢI LIÊN QUAN TỚI THỨ ĐANG TÌM — bộ lọc mà bản trước KHÔNG có, và hậu quả đã thấy.
 *
 * Commons trả kết quả theo độ liên quan của công cụ tìm kiếm, và khi không có ảnh nào thật sự
 * khớp thì nó vẫn trả về thứ gì đó. Bản trước nhận tất, nên trang chi tiết phố cổ Đồng Văn từng
 * có ảnh ĐỒNG HỒ THIÊN VĂN PRAHA, còn Du Già có ảnh cây dừa Hà Tiên. Cả hai đều là ảnh thật, giấy
 * phép hợp lệ, kích thước đạt — chỉ là không liên quan gì. Không phép kiểm nào ngoài phép kiểm
 * này bắt được, vì mọi tiêu chí kỹ thuật khác đều xanh.
 *
 * Quy tắc: tên file phải chia sẻ ÍT NHẤT MỘT token có nghĩa với từ khoá tìm. Đây là ngưỡng thấp
 * và cố ý thấp — mục tiêu là chặn ảnh hoàn toàn lạc đề, không phải chấm điểm mức độ hợp. Kèm một
 * danh sách chặn cứng các địa danh hay lẫn, vì "Sapa" hay "Hạ Long" chia sẻ token với truy vấn
 * về Việt Nam nhưng chắc chắn không phải Hà Giang.
 */
const OFF_TOPIC = /prague|czech|astronomical|ha[ _-]?tien|hoi[ _-]?an|sa[ _-]?pa|da[ _-]?nang|ha[ _-]?long|phu[ _-]?quoc|da[ _-]?lat|nha[ _-]?trang|saigon|hanoi|ninh[ _-]?binh/i;

function isRelevant(fileName: string, searchTerm: string): boolean {
  if (OFF_TOPIC.test(fileName)) return false;

  const want = new Set(tokens(searchTerm).filter((t) => !["giang", "vietnam", "viet", "nam"].includes(t)));
  if (!want.size) return true;

  return tokens(fileName).some((t) => want.has(t));
}

async function search(term: string): Promise<Candidate[]> {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", term);
  // Namespace 6 là File. Không giới hạn thì kết quả lẫn cả trang mô tả và thể loại.
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "12");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("format", "json");

  // Thử lại RIÊNG cho 429, và chỉ cho 429. Các mã lỗi khác là lỗi truy vấn hoặc lỗi phía máy chủ
  // mà thử lại không giúp gì; còn 429 thì thử lại sau một khoảng chờ đủ dài là cách đúng, vì nó
  // nói rằng yêu cầu hợp lệ nhưng ta gọi quá nhanh.
  let response: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(25000),
    });

    if (response.status !== 429) break;
    if (attempt === MAX_RATE_LIMIT_RETRIES) break;

    console.log(`      bị chặn tần suất, chờ ${RATE_LIMIT_WAIT_MS / 1000}s rồi thử lại`);
    await sleep(RATE_LIMIT_WAIT_MS);
  }

  if (!response || !response.ok) {
    throw new Error(`Commons trả HTTP ${response?.status ?? "không rõ"} cho "${term}"`);
  }

  const body = (await response.json()) as {
    query?: { pages?: Record<string, any> };
  };

  const pages = Object.values(body.query?.pages ?? {});
  const out: Candidate[] = [];

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info?.url) continue;

    const meta = info.extmetadata ?? {};
    const license = plainText(meta.LicenseShortName?.value ?? "");
    if (!licenseAllowed(license)) continue;

    // Bỏ tham số utm mà API gắn thêm — chúng không cần cho việc tải ảnh và chỉ làm URL dài ra.
    const clean = new URL(info.url);
    clean.search = "";

    // Chỉ nhận định dạng ảnh mà trình duyệt hiển thị trực tiếp. Commons có cả tif và svg;
    // tif thì trình duyệt không mở được, và một ảnh không mở được thì tệ hơn là không có ảnh.
    if (!/\.(jpe?g|png|webp)$/i.test(clean.pathname)) continue;

    const title = String(page.title ?? "").replace(/^File:/, "");
    if (!isRelevant(title, term)) continue;

    out.push({
      title,
      url: thumbUrl(clean.toString(), title),
      license,
      credit: plainText(meta.Artist?.value ?? "") || "không rõ tác giả",
      width: Number(info.width ?? 0),
      height: Number(info.height ?? 0),
    });
  }

  // Ưu tiên ảnh ngang và đủ lớn: giao diện dùng chúng làm ảnh bìa thẻ điểm đến, nên ảnh dọc bị
  // cắt mất phần quan trọng. Trong số đủ điều kiện thì lấy ảnh rộng nhất.
  return out
    .filter((c) => c.width >= 800 && c.width >= c.height)
    .sort((a, b) => b.width - a.width);
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main(): Promise<void> {
  const found: Record<string, Candidate[]> = {};
  const missing: string[] = [];

  for (const [index, query] of QUERIES.entries()) {
    if (index > 0) await sleep(DELAY_MS);

    try {
      const candidates = await search(query.search);
      if (!candidates.length) {
        missing.push(`${query.slug} (tìm "${query.search}")`);
        console.log(`  ${query.slug.padEnd(32)} không có ảnh đạt điều kiện`);
        continue;
      }
      // Giữ tối đa 4: một ảnh bìa và ba ảnh cho gallery.
      found[query.slug] = candidates.slice(0, 4);
      console.log(
        `  ${query.slug.padEnd(32)} ${candidates.length} ứng viên, giữ ${found[query.slug].length}` +
          ` — bìa ${found[query.slug][0].width}px ${found[query.slug][0].license}`,
      );
    } catch (error: any) {
      missing.push(`${query.slug} (lỗi: ${error?.message ?? error})`);
      console.log(`  ${query.slug.padEnd(32)} LỖI ${error?.message ?? error}`);
    }
  }

  const lines: string[] = [
    'import type { ImageRef } from "@data/website/types";',
    "",
    "/**",
    " * ẢNH LẤY TỪ WIKIMEDIA COMMONS — file này được SINH TỰ ĐỘNG, đừng sửa tay.",
    " *",
    " *   npx tsx scripts/fetch-place-images.ts",
    " *",
    " * Mọi ảnh ở đây đã qua bộ lọc giấy phép của script: chỉ nhận CC0, CC BY, CC BY-SA và phạm vi",
    " * công cộng, tức các giấy phép cho phép dùng lại. Ảnh dùng giấy phép phi thương mại hoặc cấm",
    " * phái sinh bị loại ngay từ lúc thu thập.",
    " *",
    " * `credit` và `license` KHÔNG phải trường trang trí: CC BY và CC BY-SA đòi ghi tên tác giả, nên",
    " * giao diện phải hiển thị chúng cạnh ảnh. Bỏ phần ghi công là vi phạm giấy phép.",
    " *",
    " * URL trỏ thẳng vào upload.wikimedia.org. Đây là đánh đổi có ý thức: không phải tự lưu ảnh nên",
    " * repo gọn, nhưng hiển thị ảnh thì phụ thuộc vào hạ tầng của Wikimedia. Nếu sau này cần chắc",
    " * chắn hơn thì tải ảnh về và phục vụ tại chỗ — cấu trúc ImageRef không phải đổi.",
    " */",
    "export const PLACE_IMAGES: Record<string, ImageRef[]> = {",
  ];

  for (const [slug, candidates] of Object.entries(found)) {
    lines.push(`  "${slug}": [`);
    for (const c of candidates) {
      lines.push("    {");
      lines.push(`      url: "${escapeString(c.url)}",`);
      lines.push(`      credit: "${escapeString(c.credit)}",`);
      lines.push(`      license: "${escapeString(c.license)}",`);
      lines.push(
        `      sourcePage: "https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.title).replace(/%20/g, "_")}",`,
      );
      lines.push(`      widthPx: ${c.width},`);
      lines.push("    },");
    }
    lines.push("  ],");
  }

  lines.push("};");
  lines.push("");

  if (missing.length) {
    lines.push("/**");
    lines.push(" * Các slug KHÔNG tìm được ảnh đạt điều kiện ở lần chạy gần nhất. Ghi lại tường minh để");
    lines.push(" * người đọc file biết đây là thiếu sót đã biết chứ không phải bỏ sót — và để `imageFor`");
    lines.push(" * trong @data/website/types trả ảnh dự phòng thay vì một chuỗi rỗng.");
    lines.push(" */");
    lines.push("export const SLUGS_WITHOUT_IMAGE: string[] = [");
    for (const m of missing) lines.push(`  // ${m}`);
    for (const m of missing) lines.push(`  "${escapeString(m.split(" ")[0])}",`);
    lines.push("];");
  } else {
    lines.push("/** Lần chạy gần nhất tìm được ảnh cho mọi slug trong danh sách truy vấn. */");
    lines.push("export const SLUGS_WITHOUT_IMAGE: string[] = [];");
  }

  const target = path.join(process.cwd(), "data", "website", "images.ts");
  await writeFile(target, lines.join("\n") + "\n", "utf8");

  console.log("");
  console.log(`Đã ghi ${path.relative(process.cwd(), target)}`);
  console.log(`  ${Object.keys(found).length}/${QUERIES.length} slug có ảnh`);
  if (missing.length) console.log(`  thiếu: ${missing.length} slug`);
}

main().catch((error) => {
  console.error("Thu thập ảnh thất bại:", error);
  process.exitCode = 1;
});
