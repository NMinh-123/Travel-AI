import { LODGING_PLACES } from "@data/places/lodging";
import { findPlace } from "@data/places/index";

/**
 * In danh sách đối chiếu giá phòng kèm đường dẫn Booking.com mở thẳng đúng chỗ cần xem.
 *
 *   npx tsx scripts/verify-lodging-prices.ts
 *
 * VÌ SAO LÀ SCRIPT IN RA CHỨ KHÔNG PHẢI CRAWLER. Đã thử lấy giá tự động và không được, với lý do
 * cụ thể chứ không phải "khó":
 *
 *   - `robots.txt` của Booking.com KHÔNG cấm `/searchresults` với `User-agent: *`. Ba nhóm
 *     `Disallow: /` trong đó thuộc về psbot, TurnitinBot, NPBot và Yandex.
 *   - Nhưng phản hồi thực tế là trang thử thách JavaScript của AWS WAF (3.962 byte, chứa
 *     `awsWafCookieDomainList` và `chal_t`), và tham số `ss=` bị cắt ngay khi redirect. Không có
 *     một dòng giá nào trong đó.
 *
 * Vượt qua thử thách WAF là cố ý né một hệ thống chống bot — không làm. Đường chính thức là
 * Booking.com Demand API, nhưng nó cần xét duyệt đối tác thương mại (xem mục 1.3 của kế hoạch
 * 11.1.1). Trong lúc chưa có, cách trung thực nhất là để NGƯỜI xem giá rồi ghi lại, và việc của
 * script này là làm cho thao tác đó nhanh nhất có thể.
 *
 * HAI MỐC NGÀY CHỨ KHÔNG PHẢI MỘT. Mỗi cơ sở in ra hai đường dẫn: một ngày thấp điểm và một ngày
 * cao điểm mùa hoa tam giác mạch. Giá trong danh mục là một KHOẢNG, nên xác minh bằng một ngày
 * duy nhất chỉ chứng minh được một đầu của khoảng đó. Chênh lệch giữa hai mốc chính là thứ
 * `minVnd`/`maxVnd` cần phản ánh.
 *
 * SAU KHI XEM XONG: cập nhật `price` trong @data/places/lodging, đổi `surveyedAt` sang ngày hôm
 * đó, và thay `sourceUrls` bằng chính đường dẫn đã mở. Chỉ đổi `basis` sang `"published_rate"`
 * khi bạn thực sự nhìn thấy bảng giá của cơ sở đó chứ không phải giá tổng hợp của sàn — phân
 * biệt này là lý do trường `basis` tồn tại.
 */

/**
 * Hai mốc ngày để đối chiếu. Truyền vào qua tham số dòng lệnh khi cần mốc khác:
 *   npx tsx scripts/verify-lodging-prices.ts 2027-05-12 2027-10-28
 *
 * Mặc định nhắm vào mùa 2026–2027 vì giá phòng chỉ mở bán trước khoảng một năm; mốc quá xa thì
 * Booking.com trả về không còn phòng và việc đối chiếu thành vô nghĩa.
 */
const DEFAULT_LOW_SEASON = "2027-05-12";
const DEFAULT_PEAK_SEASON = "2026-10-28";

/** Cộng thêm một đêm để có ngày trả phòng. */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function bookingUrl(query: string, checkin: string): string {
  const url = new URL("https://www.booking.com/searchresults.vi.html");
  url.searchParams.set("ss", query);
  url.searchParams.set("checkin", checkin);
  url.searchParams.set("checkout", nextDay(checkin));
  url.searchParams.set("group_adults", "2");
  url.searchParams.set("no_rooms", "1");
  url.searchParams.set("selected_currency", "VND");
  return url.toString();
}

function money(value: number): string {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function main(): void {
  const [lowSeason = DEFAULT_LOW_SEASON, peakSeason = DEFAULT_PEAK_SEASON] = process.argv.slice(2);

  console.log("ĐỐI CHIẾU GIÁ PHÒNG — mở từng đường dẫn, ghi lại giá thấp nhất và cao nhất thấy được.");
  console.log(`Thấp điểm: ${lowSeason}   |   Cao điểm (mùa hoa tam giác mạch): ${peakSeason}`);
  console.log("");

  let withoutPrice = 0;

  for (const place of LODGING_PLACES) {
    const area = place.parentSlug ? findPlace(place.parentSlug)?.name : undefined;
    // Tên cụm không tra được trên Booking.com — tra theo VÙNG thì mới ra danh sách cơ sở thật.
    // Cơ sở có tên riêng thì tra theo tên kèm vùng để khỏi lẫn với nơi trùng tên ở tỉnh khác.
    const isCluster = place.tags.includes("cum-co-so");
    const query = isCluster ? `${area ?? "Hà Giang"}, Việt Nam` : `${place.name}, ${area ?? "Hà Giang"}`;

    console.log(`■ ${place.name}`);
    console.log(`   vùng      : ${area ?? "(không rõ)"}   |   loại: ${place.kind}${isCluster ? "   |   MỤC CỤM: tra theo vùng" : ""}`);

    if (place.price) {
      console.log(
        `   đang ghi  : ${money(place.price.minVnd)} – ${money(place.price.maxVnd)}/đêm` +
          `   (${place.price.basis}, khảo sát ${place.price.surveyedAt})`,
      );
    } else {
      withoutPrice += 1;
      console.log("   đang ghi  : CHƯA CÓ GIÁ");
    }

    console.log(`   thấp điểm : ${bookingUrl(query, lowSeason)}`);
    console.log(`   cao điểm  : ${bookingUrl(query, peakSeason)}`);
    console.log("");
  }

  console.log(`Tổng ${LODGING_PLACES.length} cơ sở${withoutPrice ? `, ${withoutPrice} chưa có giá` : ""}.`);
  console.log("");
  console.log("Nhắc khi cập nhật lại @data/places/lodging:");
  console.log("  - đổi surveyedAt sang ngày bạn xem");
  console.log("  - thay sourceUrls bằng chính đường dẫn đã mở");
  console.log('  - chỉ đặt basis "published_rate" khi thấy bảng giá của chính cơ sở, không phải giá sàn');
}

main();
