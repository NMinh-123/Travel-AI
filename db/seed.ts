import { destinationRowData, validateDestinationCatalog } from "@server/domain/destinationCatalog";
import type { Prisma } from "@prisma/client";
import { prisma } from "@server/infra/db";
import { PLACES } from "@data/places/index";
import {
  coverImage,
  WEBSITE_DESTINATIONS,
  WEBSITE_GEAR,
  WEBSITE_LODGING_DISPLAY,
  WEBSITE_PASS_CONDITIONS,
  WEBSITE_PRESET_ITINERARIES,
} from "@data/website/index";
import { LODGING_PLACES } from "@data/places/lodging";

/**
 * Nạp nội dung Hà Giang vào database.
 *
 *   npm run db:seed
 *
 * HAI NGUỒN, HAI MỤC ĐÍCH. Script này đọc từ hai tầng khác nhau và điều đó là có chủ đích:
 *
 *   @data/places   -> bảng `Place`. Đây là từ điển địa danh mà tác tử dùng để phân giải tên khách
 *                     gõ. 101 thực thể, gồm cả quán ăn và homestay.
 *   @data/website  -> năm bảng nội dung mà giao diện đọc qua /api/content/*. Bản tuyển chọn để
 *                     hiển thị, có ảnh và nội dung tóm lược.
 *
 * Hai tầng nối với nhau bằng slug: `Destination.slug` trùng `Place.slug`, nên tác tử và giao diện
 * nói về cùng một thực thể mà không dùng chung schema. Bản trước gộp cả hai vào một file và đó
 * chính là lý do nó khó dùng — một bản ghi vừa phải đủ đẹp để render vừa phải đủ chuẩn để truy vấn.
 *
 * IDEMPOTENT: mọi thứ đều `upsert` theo slug, nên chạy lại nhiều lần không nhân bản.
 * Sau khi upsert, script xoá những bản ghi có slug không còn trong nguồn — nhờ vậy bỏ một điểm
 * đến khỏi file nguồn là nó biến khỏi database, không thành dữ liệu mồ côi.
 *
 * SCRIPT NÀY KHÔNG TẠO TÀI KHOẢN NÀO. Hai tài khoản thử nghiệm có mật khẩu công khai đã bị gỡ
 * ngày 15/09/2026 cùng hai nút "điền nhanh" trong AuthModal — một lối đăng nhập dùng chung, mật
 * khẩu nằm sẵn trong mã nguồn, là thứ dễ theo chân bản dev lên môi trường thật nhất. Cần tài
 * khoản để thử thì đăng ký qua chính giao diện đăng ký, như một người dùng thật.
 */

/**
 * Từ điển địa danh — nguồn cho bộ phân giải tên của tác tử.
 *
 * Thứ tự trong `PLACES` đã được sắp sao cho thực thể cha luôn đứng trước con (xem chú thích ở
 * @data/places/index), nên upsert tuần tự là an toàn mà không cần sắp xếp topo.
 *
 * Xoá bản ghi mồ côi cũng quan trọng như việc thêm mới: bỏ một địa danh khỏi file nguồn mà bảng
 * vẫn giữ nó thì kho tri thức còn khoá trỏ tới một địa danh mà người không còn nhận là hợp lệ.
 */
async function seedPlaces(): Promise<void> {
  for (const place of PLACES) {
    const data = {
      name: place.name,
      kind: place.kind,
      aliases: place.aliases,
      // Cây địa danh phải xuống tới database, nếu không tầng truy xuất không mở được cây con.
      parentSlug: place.parentSlug ?? null,
      sortOrder: place.sortOrder,
    };
    await prisma.place.upsert({
      where: { slug: place.slug },
      create: { slug: place.slug, ...data },
      update: data,
    });
  }

  await prisma.place.deleteMany({ where: { slug: { notIn: PLACES.map((p) => p.slug) } } });
}

async function seedDestinations(): Promise<void> {
  validateDestinationCatalog(WEBSITE_DESTINATIONS);
  for (const destination of WEBSITE_DESTINATIONS) {
    const data = destinationRowData(destination);

    await prisma.destination.upsert({
      where: { slug: destination.slug },
      create: data,
      update: data,
    });
  }

  await prisma.destination.deleteMany({
    where: { slug: { notIn: WEBSITE_DESTINATIONS.map((d) => d.slug) } },
  });
}

/**
 * Cơ sở lưu trú — ghép hai nguồn.
 *
 * Tên, địa bàn và giá đến từ @data/places/lodging; ảnh, điểm đánh giá và câu giới thiệu đến từ
 * @data/website/lodging-display. Cơ sở nào thiếu một trong hai thì bị BỎ QUA kèm cảnh báo, chứ
 * không nạp một nửa: một thẻ khách sạn không có ảnh và không có điểm đánh giá trông như lỗi tải
 * trang, và nạp lặng lẽ thì không ai biết là thiếu.
 *
 * `pricePerNight` là cột Int trong schema nhưng nguồn là `PriceEstimate` có khoảng. Lấy cận DƯỚI
 * chứ không lấy trung bình, vì giao diện hiển thị nó dưới dạng "từ ... đ" — trình bày một giá
 * trung bình dưới chữ "từ" là nói sai theo hướng bất lợi cho khách.
 */
async function seedHomestays(): Promise<void> {
  const display = new Map(WEBSITE_LODGING_DISPLAY.map((d) => [d.slug, d]));
  const seeded: string[] = [];

  for (const lodging of LODGING_PLACES) {
    const extra = display.get(lodging.slug);
    if (!extra) {
      console.warn(`  bỏ qua ${lodging.slug}: thiếu dữ liệu trình bày trong @data/website`);
      continue;
    }
    if (!lodging.price) {
      console.warn(`  bỏ qua ${lodging.slug}: thiếu PriceEstimate trong @data/places/lodging`);
      continue;
    }

    const data = {
      name: lodging.name,
      location: lodging.address ?? lodging.parentSlug ?? "Hà Giang",
      pricePerNight: lodging.price.minVnd,
      rating: extra.rating,
      reviewCount: extra.reviewCount,
      imageUrl: coverUrl(extra.imageSlug),
      tags: lodging.tags,
      highlight: extra.highlight,
      // Toạ độ để giao diện nhúng bản đồ. `geo` luôn có với mọi mục trong LODGING_PLACES, nhưng
      // đọc phòng thủ vì cột ở database là nullable — xem chú thích ở db/schema.prisma.
      lat: lodging.geo?.lat ?? null,
      lng: lodging.geo?.lng ?? null,
      sortOrder: extra.sortOrder,
    };

    await prisma.homestay.upsert({
      where: { slug: lodging.slug },
      create: { slug: lodging.slug, ...data },
      update: data,
    });
    seeded.push(lodging.slug);
  }

  await prisma.homestay.deleteMany({ where: { slug: { notIn: seeded } } });
}

async function seedGear(): Promise<void> {
  for (const item of WEBSITE_GEAR) {
    const data = {
      name: item.name,
      category: item.category,
      recommended: item.recommended,
      defaultChecked: item.defaultChecked,
      note: item.note,
      sortOrder: item.sortOrder,
    };

    await prisma.gearItem.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, ...data },
      update: data,
    });
  }

  await prisma.gearItem.deleteMany({
    where: { slug: { notIn: WEBSITE_GEAR.map((g) => g.slug) } },
  });
}

/**
 * Điều kiện đèo theo mùa.
 *
 * ĐỌC CHÚ THÍCH Ở @data/website/pass-conditions TRƯỚC KHI DÙNG BẢNG NÀY. Nó là dữ liệu tham khảo
 * theo mùa, không phải quan trắc thời gian thực, và trước đây đã từng bị chèn vào prompt của tác
 * tử như thể là thời tiết hiện tại. Thời tiết thật nay đến từ `getWeather` ở
 * @server/infra/realtime, gọi Open-Meteo với đúng độ cao của từng điểm đo.
 */
async function seedPassWeather(): Promise<void> {
  for (const station of WEBSITE_PASS_CONDITIONS) {
    const data = {
      location: station.location,
      elevation: station.elevation,
      temp: station.temp,
      condition: station.condition,
      windSpeedKm: station.windSpeedKm,
      fogLevel: station.fogLevel,
      roadStatus: station.roadStatus,
      sortOrder: station.sortOrder,
    };

    await prisma.passWeather.upsert({
      where: { slug: station.slug },
      create: { slug: station.slug, ...data },
      update: data,
    });
  }

  await prisma.passWeather.deleteMany({
    where: { slug: { notIn: WEBSITE_PASS_CONDITIONS.map((s) => s.slug) } },
  });
}

async function seedPresetItineraries(): Promise<void> {
  for (const itinerary of WEBSITE_PRESET_ITINERARIES) {
    // Tổng km suy ra từ chính các ngày, để không phải bảo trì một con số rời có thể lệch.
    const totalKm = Math.round(
      itinerary.days.reduce((sum, day) => sum + (day.totalDistanceKm || 0), 0),
    );

    const data = {
      title: itinerary.title,
      overview: itinerary.overview,
      totalKm,
      days: itinerary.days as unknown as Prisma.InputJsonValue,
      sortOrder: itinerary.sortOrder,
    };

    await prisma.presetItinerary.upsert({
      where: { slug: itinerary.slug },
      create: { slug: itinerary.slug, ...data },
      update: data,
    });
  }

  await prisma.presetItinerary.deleteMany({
    where: { slug: { notIn: WEBSITE_PRESET_ITINERARIES.map((i) => i.slug) } },
  });
}

/**
 * Dọn những mục yêu thích trỏ tới điểm đến không còn tồn tại.
 *
 * `Favorite.destinationSlug` KHÔNG có khoá ngoại tới `Destination` — chỉ có ràng buộc theo
 * `userId`. Nên khi danh sách điểm đến đổi, các hàng cũ vẫn nằm lại và trở thành rác lặng lẽ:
 * Postgres không cản, giao diện thì hiện một thẻ trống hoặc bỏ qua, và không ai biết. Bước dọn
 * này chạy SAU khi seed điểm đến, để nó so với danh sách mới chứ không phải danh sách cũ.
 */
async function pruneOrphanFavorites(): Promise<number> {
  const slugs = WEBSITE_DESTINATIONS.map((d) => d.slug);
  const removed = await prisma.favorite.deleteMany({
    where: { destinationSlug: { notIn: slugs } },
  });
  return removed.count;
}

/**
 * Ảnh bìa cho một khoá ảnh. Trả chuỗi rỗng khi không có ảnh nào.
 *
 * `coverImage` đã có sẵn đường lui về ảnh của cả vùng, nên chuỗi rỗng ở đây chỉ xảy ra khi
 * data/website/images.ts chưa được sinh lần nào. Trường hợp đó là `npx tsx
 * scripts/fetch-place-images.ts` chưa chạy — seed vẫn chạy được, chỉ là thẻ điểm đến không có ảnh.
 */
function coverUrl(imageSlug: string): string {
  return coverImage(imageSlug)?.url ?? "";
}

async function main(): Promise<void> {
  console.log("Nạp từ điển địa danh...");
  await seedPlaces();

  console.log("Nạp nội dung website...");
  await seedDestinations();
  await seedHomestays();
  await seedGear();
  await seedPassWeather();
  await seedPresetItineraries();

  const orphans = await pruneOrphanFavorites();
  if (orphans) console.log(`  đã dọn ${orphans} mục yêu thích mồ côi`);

  const counts = {
    places: await prisma.place.count(),
    destinations: await prisma.destination.count(),
    homestays: await prisma.homestay.count(),
    gearItems: await prisma.gearItem.count(),
    passConditions: await prisma.passWeather.count(),
    presetItineraries: await prisma.presetItinerary.count(),
  };

  console.log("Xong:", counts);
  console.log(`Nhắc: chạy tiếp "npm run db:ingest" để nạp kho tri thức cho chatbot.`);
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
