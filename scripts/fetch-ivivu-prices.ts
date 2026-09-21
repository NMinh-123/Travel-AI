/**
 * Đọc giá phòng quan sát được từ iVIVU cho toàn bộ cơ sở ở địa bàn Hà Giang.
 *
 *   npx tsx scripts/fetch-ivivu-prices.ts [checkInDate]
 *   npx tsx scripts/fetch-ivivu-prices.ts 2027-05-12
 *
 * VÌ SAO IVIVU CHỨ KHÔNG PHẢI BOOKING HAY TRIPADVISOR. Đã kiểm cả ba, ngày 2026-09-10:
 *
 *   - TripAdvisor: robots.txt liệt kê đích danh `ClaudeBot` kèm `Disallow: /`. Chủ site đã nói
 *     rõ bằng văn bản máy đọc được, nên không tải gì cả.
 *   - Booking.com: robots.txt CHO PHÉP `/searchresults` với `User-agent: *`, nhưng phản hồi thực
 *     tế là trang thử thách JavaScript của AWS WAF — 3.962 byte, không một dòng giá. Vượt thử
 *     thách đó là né hệ thống chống bot, không làm.
 *   - iVIVU: robots.txt chỉ cấm `/du-lich/*?*`. Nguồn duy nhất vừa được phép vừa lấy được.
 *
 * HAI LẦN ĐI SAI TRƯỚC KHI TỚI ĐÂY — ghi lại vì cả hai đều là lỗi phương pháp, không phải lỗi mã:
 *
 *   1. Bản đầu đi từ `sitemap/files/Hotel_VN_*.xml` và kết luận iVIVU chỉ có 5 cơ sở ở Hà Giang,
 *      "không một homestay nào". Sitemap của họ liệt kê 2.448 URL toàn quốc nhưng bỏ sót gần hết
 *      địa bàn này. Sitemap là thứ chủ trang TỰ KHAI; trang danh sách là thứ họ THỰC SỰ PHỤC VỤ.
 *   2. Bản thứ hai đọc trang danh sách nhưng chỉ lấy được 15 — phần còn lại nạp động phía client.
 *      Con số 15 đó cũng không phải sự thật về độ phủ.
 *
 * Sự thật là 68 cơ sở. Bài học chung: khi một nguồn có vẻ "không có dữ liệu", hãy nghi ngờ cách
 * mình đang hỏi trước khi kết luận về nguồn.
 *
 * VỀ VIỆC GỌI API NỘI BỘ. Endpoint dưới đây không có tài liệu công khai, và host `apiportal`
 * không phục vụ robots.txt nên không có tuyên bố nào để tuân theo. Script vẫn giữ ba ràng buộc
 * tự đặt: khai báo User-Agent thật thay vì giả làm trình duyệt, gọi ĐÚNG MỘT lượt cho cả địa bàn
 * bằng `pageSize` đủ lớn thay vì phân trang nhiều lượt, và không chạy tự động trong bất kỳ lệnh
 * npm nào. Kết quả cũng không tự ghi vào data — giá phải qua mắt người trước khi vào danh mục.
 */

/** Mã vùng Hà Giang trên iVIVU, đọc được từ trang danh sách của họ. */
const REGION_ID = 114226;

const API = "https://apiportal.ivivu.com/web_prot/ms01/api/SearchFilters/SearchHotelList";

/** Đủ để chủ trang biết ai đang gọi và chặn được nếu muốn. Không giả làm trình duyệt. */
const USER_AGENT =
  "HaGiangTravel-KnowledgeBot/1.0 (+du an hoc tap; thu thap tu lieu du lich Ha Giang)";

const TIMEOUT_MS = 45000;

/**
 * Xin dư một lô so với tổng đã biết, để một lượt là đủ.
 *
 * API mặc định trả 30 mục và có `pageSize`. Xin 100 thì cả 68 cơ sở về trong một request — ít
 * hơn hẳn ba lượt phân trang, và đó là cách tôn trọng máy chủ người ta rẻ nhất. Nếu địa bàn sau
 * này vượt 100 thì script tự cảnh báo ở cuối chứ không âm thầm cắt.
 */
const PAGE_SIZE = 100;

/** Mặc định nhắm mùa cao điểm hoa tam giác mạch — lúc giá lệch nhiều nhất so với ngày thường. */
const DEFAULT_CHECKIN = "2026-10-28";

interface Hotel {
  hotelName: string;
  minPrice: number;
  maxPrice: number;
  address: string;
  url: string;
  rating: number;
  reviewCount: number;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function money(value: number): string {
  return value > 0 ? `${value.toLocaleString("vi-VN")}đ` : "—";
}

/**
 * Đọc giá từ chuỗi kiểu `"1.249.500 VND"`.
 *
 * API trả giá dưới dạng CHUỖI ĐÃ ĐỊNH DẠNG THEO TIẾNG VIỆT, không phải số. Bản trước dùng
 * `Number(row.minPrice)` và nhận `NaN` cho cả 68 mục, rồi in ra "—" — nhìn y hệt như thể sàn
 * không có giá nào, trong khi giá vẫn nằm nguyên trong phản hồi. Đây là kiểu lỗi tệ vì nó không
 * ném exception và kết quả sai trông hoàn toàn hợp lý.
 *
 * Dấu chấm ở đây là dấu phân nhóm hàng nghìn của tiếng Việt chứ không phải dấu thập phân, nên
 * cách đúng là bỏ mọi ký tự không phải chữ số rồi mới đọc.
 */
function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;

  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

async function main(): Promise<void> {
  const checkInDate = process.argv[2] ?? DEFAULT_CHECKIN;
  const checkOutDate = nextDay(checkInDate);

  console.log(`Đọc giá iVIVU cho địa bàn Hà Giang, nhận phòng ${checkInDate} → ${checkOutDate}\n`);

  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      regionId: REGION_ID,
      checkInDate,
      checkOutDate,
      // Hình dạng này do chính API chỉ ra qua thông báo lỗi khi thiếu trường, không phải đoán.
      roomPicker: { adult: 2, children: 0, room: 1 },
      pageSize: PAGE_SIZE,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error(`API trả HTTP ${response.status} — dừng.`);
    process.exitCode = 1;
    return;
  }

  const body = (await response.json()) as {
    success?: boolean;
    data?: { list?: any[]; total?: number };
  };

  const list = body.data?.list ?? [];
  const total = body.data?.total ?? list.length;

  const hotels: Hotel[] = list.map((row) => ({
    hotelName: String(row.hotelName ?? "").trim(),
    minPrice: parsePrice(row.minPrice),
    maxPrice: parsePrice(row.maxPrice),
    address: String(row.address ?? "").replace(/\s+/g, " ").trim(),
    // `row.url` trả về đường dẫn VÙNG (`/khach-san-ha-giang`), không phải của cơ sở — nên dựng
    // URL từ `hotelCode`, vốn chính là slug trang chi tiết.
    url: `https://www.ivivu.com/khach-san-ha-giang/${row.hotelCode ?? ""}`,
    // `rating` theo thang 50 (50 = 5 sao). Chia 10 để về thang sao quen thuộc.
    rating: Number(row.rating ?? 0) / 10,
    reviewCount: Number(row.reviewCount ?? 0),
  }));

  hotels.sort((a, b) => a.minPrice - b.minPrice);

  for (const h of hotels) {
    const price =
      h.minPrice === h.maxPrice || !h.maxPrice ? money(h.minPrice) : `${money(h.minPrice)} – ${money(h.maxPrice)}`;
    console.log(`■ ${h.hotelName}`);
    console.log(`   giá     : ${price}${h.rating ? `   |   ${h.rating}★ (${h.reviewCount} đánh giá)` : ""}`);
    console.log(`   địa chỉ : ${h.address || "(không ghi)"}`);
    console.log(`   nguồn   : ${h.url}`);
    console.log("");
  }

  const withPrice = hotels.filter((h) => h.minPrice > 0).length;
  console.log(`Lấy được ${hotels.length}/${total} cơ sở, ${withPrice} có giá.`);

  // Không im lặng khi cắt bớt: một script báo "lấy được N" mà giấu phần thiếu sẽ dẫn thẳng tới
  // đúng kết luận sai về độ phủ mà hai bản trước đã mắc.
  if (hotels.length < total) {
    console.log(
      `LƯU Ý: còn ${total - hotels.length} cơ sở chưa lấy. Nâng PAGE_SIZE trong script rồi chạy lại.`,
    );
  }

  console.log("");
  console.log("Khi đưa vào @data/places/lodging:");
  console.log('  - basis dùng "ota_observed" — giá QUAN SÁT ĐƯỢC trên sàn vào ngày cụ thể ở trên,');
  console.log("    không phải giá niêm yết của chính cơ sở, cũng không phải suy từ mặt bằng.");
  console.log(`  - surveyedAt là ngày chạy script; sourceUrls là URL của chính cơ sở.`);
  console.log("  - giá sàn đã gồm hoa hồng và đổi theo ngày nhận phòng: một lần đọc là MỘT ĐIỂM.");
  console.log("    Chạy lại với ngày thấp điểm để có đầu còn lại của khoảng.");
}

main().catch((error) => {
  console.error("Thu thập iVIVU thất bại:", error);
  process.exitCode = 1;
});
