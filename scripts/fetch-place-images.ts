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
 * hai mươi mốt truy vấn còn lại thất bại sạch. 2,5 giây chạy được danh sách 32 truy vấn, nhưng khi
 * danh sách lên hơn 40 thì vẫn gặp 429 giữa đường, nên nới lên 3,5 giây. Thêm truy vấn nữa mà lại
 * bị chặn thì nới tiếp chứ đừng bỏ phép chờ — API này miễn phí và không cần khoá, nên tôn trọng
 * hạn mức của họ là điều kiện để còn dùng được.
 */
const DELAY_MS = 3500;

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
 * Nguồn ảnh cho từng slug trong @data/places.
 *
 * HAI CÁCH LẤY, và `files` được ưu tiên hơn `search`:
 *
 *  - `files`: tên tệp Commons ĐÍCH DANH, đã duyệt bằng mắt qua cây thể loại Hà Giang
 *    (Category:Quan Ba District, Category:Dong Van District, Category:Hmong Lord's Palace...).
 *  - `search`: tra theo từ khoá như trước, dùng cho các slug vùng và những chỗ chưa duyệt tay.
 *
 * VÌ SAO PHẢI THÊM `files`. Tra theo từ khoá chọn ảnh thay người, và nó chọn tệ ở đúng những địa
 * danh nhỏ: Commons xếp kết quả theo độ liên quan của công cụ tìm, nên khi không có ảnh nào thật
 * sự khớp thì nó vẫn trả về thứ gì đó. Đo trên chính danh sách này: "Thac Tien waterfall" trả về
 * thác Cát Cát ở Sa Pa, "Nam Dan ancient stone" trả về khu mộ cổ ở Cần Giuộc, "Lung Tam" trả về
 * một vịnh ở Hồng Kông, còn "Ho Noong" trả về một cửa hàng ở Chicago. Bộ lọc token chặn được phần
 * lớn, nhưng thứ lọt lưới thì lọt im lặng — ảnh thật, giấy phép hợp lệ, kích thước đạt, chỉ là
 * không phải nơi đang nói tới. Mười ba điểm vì thế phải mượn ảnh của cả vùng.
 *
 * Duyệt thể loại thì ngược lại: người đóng góp đã xếp ảnh vào đúng huyện, nên tên tệp như
 * "Động Lùng Khúy (47694355042).jpg" hay "Thảo nguyên Suôi Thầu - NKS.jpg" là chỉ dẫn đáng tin
 * hơn bất kỳ điểm số liên quan nào. Giấy phép, tác giả và kích thước vẫn lấy từ API như cũ —
 * chỉ có bước CHỌN ẢNH là chuyển từ máy đoán sang người duyệt.
 *
 * Slug nào không có mặt ở đây, hoặc có mà Commons không còn ảnh đạt điều kiện, thì không có ảnh
 * riêng và giao diện dùng ảnh vùng kèm nhãn "Ảnh khu vực". Thà vậy còn hơn gán một tấm ảnh chụp
 * nơi khác cho một địa danh.
 */
const QUERIES: { slug: string; search?: string; files?: string[] }[] = [
  { slug: "deo-ma-pi-leng", search: "Ma Pi Leng pass" },
  { slug: "hem-tu-san", search: "Tu San canyon Nho Que" },
  { slug: "song-nho-que", search: "Nho Que river" },
  // Ảnh cột cờ nhìn từ dưới lên hầu hết là ảnh dọc và bị loại; hai tệp này là ảnh ngang.
  { slug: "cot-co-lung-cu", files: ["Lá cờ Việt Nam trên đỉnh Cột cờ Lũng Cú.JPG", "Cotcolungcu.jpg"] },
  { slug: "doc-tham-ma", files: ["Dốc Thẩm Mã 2022 - NKS.jpg", "Tham Ma pass - Dong Van.jpg"] },
  { slug: "pho-co-dong-van", files: ["Cho Pho Co Dong Van in 2014.jpg", "Phỗ Cổ.jpg", "Covered market of Dong Van in 2014.jpg"] },
  // Cổng Trời Quản Bạ: Commons chưa có ảnh nào của riêng đài quan sát. Giữ tra từ khoá để lần
  // chạy sau tự bắt được nếu có người tải lên; tới lúc đó thẻ vẫn dùng ảnh vùng Quản Bạ.
  { slug: "cong-troi-quan-ba", search: "Quan Ba heaven gate" },
  { slug: "nui-doi-co-tien", files: ["Núi Cô Tiên, Quản Bạ (47742798901).jpg", "Fairy Hill 2012 - panoramio.jpg"] },
  { slug: "thac-du-gia", files: ["Du Già.jpg"] },
  { slug: "rung-thong-yen-minh", files: ["Needle trees in the Yen Minh district 2.jpg", "Autumn comes on TerraceField-YenMinh HaGiang Vietnam.jpg"] },
  { slug: "dinh-thu-ho-vuong", files: ["Dinh thự vua Mèo họ Vương - Vuong’s Palace, Đồng Văn.jpg", "Sa Phin palais hmong entree.jpg", "Sa Phin palais hmong cour 2.jpg", "SaPhin entrance.JPG"] },
  { slug: "ruong-bac-thang-hoang-su-phi", files: ["Ruộng bậc thang ở Hoàng Su Phì.jpg", "Ruộng bậc thang Bản Phùng 1 - NKS.jpg", "Bản Phùng - NKS.jpg"] },
  { slug: "cao-nguyen-da-dong-van", search: "Dong Van karst plateau" },
  { slug: "deo-bac-sum", files: ["Dốc Bắc Sum (46762031595).jpg"] },
  // Dốc Chín Khoanh nằm trên đoạn Phố Cáo; Commons chưa có ảnh nào chụp đúng con dốc. Giữ tra từ
  // khoá để lần chạy sau tự bắt được nếu có người tải lên — khi đó nhớ trả `imageSlug` của nó về
  // chính nó trong @data/website/destinations, vì hiện nó đang trỏ sang `duong-hanh-phuc`.
  { slug: "doc-chin-khoanh", search: "Doc Chin Khoanh Pho Cao" },
  // Ảnh đường núi trên quốc lộ 4C, dùng làm ảnh khu vực cho Dốc Chín Khoanh. Trước đây nó mượn
  // ảnh vùng Sủng Là, mà ảnh bìa của bộ đó là một nếp nhà trình tường — một con dốc chín khúc
  // thì không nên minh hoạ bằng ảnh nhà. Hai tệp này đều thuộc thể loại Dong Van District trên
  // Commons, đúng huyện có con dốc, và chủ thể trong ảnh là đường đèo.
  { slug: "duong-hanh-phuc", files: ["Mountainous road in the district of Dong Van in 2014.jpg", "Road in Hà Giang province.jpg"] },
  { slug: "tp-ha-giang", search: "Ha Giang city" },
  { slug: "dong-van", search: "Dong Van Ha Giang" },
  { slug: "meo-vac", search: "Meo Vac" },
  { slug: "yen-minh", search: "Yen Minh Ha Giang" },
  { slug: "quan-ba", search: "Quan Ba Ha Giang" },
  // Vùng Vị Xuyên, thêm để Hồ Noong có ảnh khu vực đúng huyện thay vì hình minh hoạ. Tra từ khoá
  // "Vi Xuyen" trả về cả phố Vị Xuyên ở Nam Định, nên chỉ đích danh ba tệp của Minh Tân.
  { slug: "vi-xuyen", files: ["Minh Tân, Vị Xuyên, Hà Giang, Vietnam - panoramio.jpg", "Minh Tân, Vị Xuyên, Hà Giang, Vietnam - panoramio (1).jpg", "Minh Tân, Vị Xuyên, Hà Giang, Vietnam - panoramio (3).jpg"] },
  { slug: "sung-la", files: ["Nhà trình tường ở Lũng Cẩm - NKS.jpg", "Sủng Là, Đồng Văn, Hà Giang, Vietnam - panoramio.jpg", "Sủng Là, Đồng Văn, Hà Giang, Vietnam - panoramio (2).jpg"] },
  { slug: "lung-cu", search: "Lung Cu Ha Giang" },
  { slug: "du-gia", search: "Du Gia Ha Giang" },
  { slug: "khau-vai", search: "Khau Vai" },
  { slug: "hoang-su-phi", search: "Hoang Su Phi" },
  { slug: "lung-tam", search: "Lung Tam linen Ha Giang" },
  { slug: "pho-bang", search: "Pho Bang Ha Giang" },
  { slug: "cho-phien-dong-van", search: "Dong Van market" },
  { slug: "ban-lo-lo-chai", files: ["Lô Lô Chải 2022 - NKS.jpg"] },
  // Ảnh nghề dệt lanh chụp tại Quản Bạ — đúng nghề và đúng vùng của hợp tác xã Lùng Tám.
  { slug: "lang-det-lanh-lung-tam", files: ["Quản Bạ, Vietnam - Linen making.jpg"] },
  { slug: "cho-tinh-khau-vai", files: ["Chợ tình Khau Vai.jpg"] },
  // Nặm Đăm: tra "Nam Dam" trả về Ba Chúc ở An Giang và một hồ chứa ở Hồng Kông. Không có ảnh.
  { slug: "ban-nam-dam", search: "Nam Dam Quan Ba Ha Giang" },

  // --- Mười ba điểm bổ sung của nhiệm vụ EXPLORE-26, trước đây không có mặt trong danh sách này
  // nên không bao giờ được tra ảnh. Đó là lý do phần lớn chúng hiện ảnh minh hoạ.
  { slug: "dong-lung-khuy", files: ["Động Lùng Khúy (47694355042).jpg"] },
  { slug: "lang-van-hoa-pa-vi-ha", files: ["Ancient river valley in PaVi HaGiang Vietnam.jpg", "Rd4C & Valley in PaVi HaGiang Vietnam.jpg"] },
  // Ảnh duy nhất đạt điều kiện cho Chiêu Lầu Thi chỉ 960px; "Chieu Lau Thi summit.jpg" là ảnh dọc
  // 723x960 nên bị loại. Đủ dùng làm ảnh bìa nhưng không nét bằng các điểm khác.
  { slug: "dinh-chieu-lau-thi", files: ["Đỉnh núi chiêu lầu thi.png"] },
  { slug: "thao-nguyen-suoi-thau", files: ["Thảo nguyên Suôi Thầu - NKS.jpg", "Suôi Thầu - NKS.jpg", "NKS và thảo nguyên Suôi Thầu.jpg"] },
  // Bốn slug dưới đây: đã duyệt hết cây thể loại Hà Giang trên Commons và KHÔNG có ảnh nào chụp
  // đúng nơi. Giữ từ khoá để lần chạy sau tự bắt được nếu có người tải lên.
  { slug: "thon-tha", search: "Tha village Ha Giang" },
  { slug: "ho-noong", search: "Noong lake Vi Xuyen Ha Giang" },
  { slug: "thac-tien-deo-gio", search: "Thac Tien Deo Gio Xin Man" },
  { slug: "bai-da-co-nam-dan", search: "Nam Dan rock carving Xin Man" },
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

/**
 * Lấy metadata của những tệp Commons đã chọn đích danh.
 *
 * Giữ NGUYÊN THỨ TỰ trong danh sách thay vì xếp theo chiều rộng như `search`: ảnh đầu tiên là ảnh
 * bìa, và với những tệp đã duyệt bằng mắt thì ảnh hợp nhất chưa chắc là ảnh to nhất. Bộ lọc giấy
 * phép, định dạng và kích thước vẫn áp y như đường tra từ khoá — chọn tay không miễn cho tệp nào
 * khỏi các điều kiện đó, và một tệp bị đổi giấy phép trên Commons sẽ tự rụng ở lần chạy sau.
 */
async function byTitles(titles: string[]): Promise<Candidate[]> {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", titles.map((t) => `File:${t}`).join("|"));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("format", "json");

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
    throw new Error(`Commons trả HTTP ${response?.status ?? "không rõ"} cho ${titles.length} tệp chỉ định`);
  }

  const body = (await response.json()) as { query?: { pages?: Record<string, any> } };
  const pages = Object.values(body.query?.pages ?? {});
  const out: Candidate[] = [];

  for (const wanted of titles) {
    const page = pages.find((p: any) => String(p?.title ?? "").replace(/^File:/, "") === wanted);
    const info = page?.imageinfo?.[0];
    if (!info?.url) {
      console.log(`      bỏ "${wanted}": Commons không còn tệp này`);
      continue;
    }

    const meta = info.extmetadata ?? {};
    const license = plainText(meta.LicenseShortName?.value ?? "");
    if (!licenseAllowed(license)) {
      console.log(`      bỏ "${wanted}": giấy phép "${license}" không cho phép dùng lại`);
      continue;
    }

    const clean = new URL(info.url);
    clean.search = "";
    if (!/\.(jpe?g|png|webp)$/i.test(clean.pathname)) {
      console.log(`      bỏ "${wanted}": định dạng không hiển thị trực tiếp được`);
      continue;
    }

    const width = Number(info.width ?? 0);
    const height = Number(info.height ?? 0);
    if (width < 800 || width < height) {
      console.log(`      bỏ "${wanted}": ${width}x${height}, quá nhỏ hoặc là ảnh dọc`);
      continue;
    }

    out.push({
      title: wanted,
      url: thumbUrl(clean.toString(), wanted),
      license,
      credit: plainText(meta.Artist?.value ?? "") || "không rõ tác giả",
      width,
      height,
    });
  }

  return out;
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main(): Promise<void> {
  const found: Record<string, Candidate[]> = {};
  const missing: string[] = [];
  /**
   * Slug thất bại vì LỖI GỌI API, khác hẳn slug không có ảnh nào đạt điều kiện.
   *
   * Phân biệt hai thứ này là bắt buộc, và đã có sự cố thật: một lần chạy bị Commons trả HTTP 429
   * ở giữa danh sách, script vẫn ghi file như thường và hai slug `quan-ba` với
   * `lang-det-lanh-lung-tam` mất sạch ảnh — trong khi ảnh của chúng vẫn còn nguyên trên Commons.
   * Hậu quả không dừng ở đó: `quan-ba` là bộ ảnh mà Cổng Trời Quản Bạ mượn làm ảnh khu vực, nên
   * một cái 429 nhất thời đã làm hai điểm đến rơi về hình minh hoạ, và tệp sai đó thì sẵn sàng
   * được commit vì trông vẫn hợp lệ.
   *
   * Nay gặp lỗi gọi API thì KHÔNG ghi file. Giữ lại bản cũ đúng còn hơn ghi một bản mới thiếu, vì
   * thiếu ảnh ở đây không làm gì hỏng ồn ào cả — nó chỉ âm thầm đổi ảnh thành hình minh hoạ.
   */
  const failed: string[] = [];

  for (const [index, query] of QUERIES.entries()) {
    if (index > 0) await sleep(DELAY_MS);

    const how = query.files ? `${query.files.length} tệp chỉ định` : `tìm "${query.search}"`;

    try {
      const candidates = query.files ? await byTitles(query.files) : await search(query.search ?? "");
      if (!candidates.length) {
        missing.push(`${query.slug} (${how})`);
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
      failed.push(`${query.slug} (${how}): ${error?.message ?? error}`);
      console.log(`  ${query.slug.padEnd(32)} LỖI ${error?.message ?? error}`);
    }
  }

  if (failed.length) {
    console.error("");
    console.error(`KHÔNG GHI FILE: ${failed.length} slug thất bại vì lỗi gọi API, không phải vì thiếu ảnh.`);
    for (const item of failed) console.error(`  ${item}`);
    console.error("");
    console.error("Ghi bây giờ là xoá ảnh của những slug đó khỏi dữ liệu. Chờ vài phút rồi chạy lại;");
    console.error("nếu vẫn bị chặn tần suất thì nới DELAY_MS ở đầu file.");
    process.exitCode = 1;
    return;
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
      // Mọi mục ra tới đây đều đã qua `licenseAllowed`, và giấy phép đọc từ metadata của Commons
      // chứ không do ai gõ. Đó là điều kiện để giao diện dám dẫn người xem về trang giấy phép.
      lines.push("      licenseVerified: true,");
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
