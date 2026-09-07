import type { Prisma } from "@prisma/client";
import { prisma } from "../server/db";
import { hashPassword } from "../server/auth";
import { PLACES } from "./place-data";
import {
  DESTINATIONS,
  GEAR_CHECKLIST,
  HOMESTAYS,
  MAP_WAYPOINTS,
  PASS_WEATHER_STATION,
  PRESET_ITINERARIES,
} from "./seed-data";

/**
 * Nạp nội dung Hà Giang và hai tài khoản demo vào database.
 *
 *   npm run db:seed
 *
 * Idempotent: mọi thứ đều `upsert` theo slug hoặc email, nên chạy lại nhiều lần không nhân
 * bản dữ liệu. Sau khi upsert, script xoá những bản ghi có slug không còn trong seed-data —
 * nhờ vậy bỏ một điểm đến khỏi file nguồn là nó biến khỏi database, không thành dữ liệu mồ
 * côi.
 *
 * CẢNH BÁO: hai tài khoản demo có mật khẩu công khai (khớp với nút "điền nhanh" trong
 * AuthModal). Script này chỉ dành cho môi trường phát triển, đừng chạy lên production.
 */

/** Bỏ dấu tiếng Việt để sinh slug ascii. 'đ' không phân rã được nên phải xử lý riêng. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedDestinations(): Promise<void> {
  for (const [index, destination] of DESTINATIONS.entries()) {
    const data = {
      name: destination.name,
      vietnameseName: destination.vietnameseName,
      district: destination.district,
      category: destination.category,
      elevation: destination.elevation,
      distanceFromStart: destination.distanceFromStart,
      difficulty: destination.difficulty,
      bestTime: destination.bestTime,
      highlights: destination.highlights,
      imageUrl: destination.imageUrl,
      gallery: destination.gallery,
      description: destination.description,
      safetyTip: destination.safetyTip,
      coordX: destination.coordinates.x,
      coordY: destination.coordinates.y,
      lat: destination.coordinates.lat,
      lng: destination.coordinates.lng,
      recommendedStayHours: destination.recommendedStayHours,
      localFood: destination.localFood,
      sortOrder: index,
    };

    await prisma.destination.upsert({
      where: { slug: destination.id },
      create: { slug: destination.id, ...data },
      update: data,
    });
  }

  await prisma.destination.deleteMany({
    where: { slug: { notIn: DESTINATIONS.map((d) => d.id) } },
  });
}

async function seedMapWaypoints(): Promise<void> {
  for (const [index, waypoint] of MAP_WAYPOINTS.entries()) {
    const data = {
      name: waypoint.name,
      vietnamese: waypoint.vietnamese,
      km: waypoint.km,
      elevation: waypoint.elevation,
      x: waypoint.x,
      y: waypoint.y,
      type: waypoint.type,
      warning: waypoint.warning ?? null,
      destinationRef: waypoint.destinationRef ?? null,
      sortOrder: index,
    };

    await prisma.mapWaypoint.upsert({
      where: { slug: waypoint.id },
      create: { slug: waypoint.id, ...data },
      update: data,
    });
  }

  await prisma.mapWaypoint.deleteMany({
    where: { slug: { notIn: MAP_WAYPOINTS.map((w) => w.id) } },
  });
}

async function seedHomestays(): Promise<void> {
  for (const [index, homestay] of HOMESTAYS.entries()) {
    const data = {
      name: homestay.name,
      location: homestay.location,
      pricePerNight: homestay.pricePerNight,
      rating: homestay.rating,
      reviewCount: homestay.reviewCount,
      imageUrl: homestay.imageUrl,
      tags: homestay.tags,
      highlight: homestay.highlight,
      sortOrder: index,
    };

    await prisma.homestay.upsert({
      where: { slug: homestay.id },
      create: { slug: homestay.id, ...data },
      update: data,
    });
  }

  await prisma.homestay.deleteMany({
    where: { slug: { notIn: HOMESTAYS.map((h) => h.id) } },
  });
}

async function seedGear(): Promise<void> {
  for (const [index, item] of GEAR_CHECKLIST.entries()) {
    const data = {
      name: item.name,
      category: item.category,
      recommended: item.recommended,
      defaultChecked: item.checked,
      note: item.note,
      sortOrder: index,
    };

    await prisma.gearItem.upsert({
      where: { slug: item.id },
      create: { slug: item.id, ...data },
      update: data,
    });
  }

  await prisma.gearItem.deleteMany({
    where: { slug: { notIn: GEAR_CHECKLIST.map((g) => g.id) } },
  });
}

async function seedPassWeather(): Promise<void> {
  const slugs: string[] = [];

  for (const [index, station] of PASS_WEATHER_STATION.entries()) {
    const slug = slugify(station.location);
    slugs.push(slug);

    const data = {
      location: station.location,
      elevation: station.elevation,
      temp: station.temp,
      condition: station.condition,
      windSpeedKm: station.windSpeedKm,
      fogLevel: station.fogLevel,
      roadStatus: station.roadStatus,
      sortOrder: index,
    };

    await prisma.passWeather.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
  }

  await prisma.passWeather.deleteMany({ where: { slug: { notIn: slugs } } });
}

async function seedPresetItineraries(): Promise<void> {
  for (const [index, itinerary] of PRESET_ITINERARIES.entries()) {
    // Tổng km suy ra từ chính các ngày, để không phải bảo trì một con số rời có thể lệch.
    const totalKm = Math.round(
      itinerary.days.reduce((sum, day) => sum + (day.totalDistanceKm || 0), 0),
    );

    const data = {
      title: itinerary.title,
      overview: itinerary.overview,
      totalKm,
      days: itinerary.days as unknown as Prisma.InputJsonValue,
      sortOrder: index,
    };

    await prisma.presetItinerary.upsert({
      where: { slug: itinerary.slug },
      create: { slug: itinerary.slug, ...data },
      update: data,
    });
  }

  await prisma.presetItinerary.deleteMany({
    where: { slug: { notIn: PRESET_ITINERARIES.map((i) => i.slug) } },
  });
}

/**
 * Hai tài khoản khớp đúng email và mật khẩu mà nút "điền nhanh" trong AuthModal prefill.
 * Không seed thì hai nút đó dẫn tới lỗi đăng nhập, đúng kiểu giao diện hứa một thứ mà backend
 * không có.
 */
const DEMO_USERS = [
  {
    email: "phuothagiang@gmail.com",
    password: "Hagiang2026@",
    name: "Phượt Thủ Hà Giang",
    riderLevel: "EXPERIENCED" as const,
    favorites: ["ma-pi-leng", "nho-que-river", "lung-cu-flagpole"],
    badges: ["Chinh phục Mã Pí Lèng", "Cột Cờ Cực Bắc", "Thuyền Sông Nho Quế"],
  },
  {
    email: "easyrider.viet@gmail.com",
    password: "Easyrider2026@",
    name: "Easy Rider Việt",
    riderLevel: "EASY_RIDER" as const,
    favorites: ["dong-van-old-quarter", "du-gia-waterfall"],
    badges: ["Phố Cổ Đồng Văn", "Bản Tiên Du Già"],
  },
];

async function seedDemoUsers(): Promise<void> {
  for (const demo of DEMO_USERS) {
    const passwordHash = await hashPassword(demo.password);

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        name: demo.name,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(demo.email)}`,
        passwordHash,
        provider: "EMAIL",
        riderLevel: demo.riderLevel,
      },
      update: { passwordHash, name: demo.name, riderLevel: demo.riderLevel },
      select: { id: true },
    });

    // Chỉ giữ những điểm yêu thích thực sự tồn tại trong danh mục.
    const existing = await prisma.destination.findMany({
      where: { slug: { in: demo.favorites } },
      select: { slug: true },
    });

    for (const destination of existing) {
      await prisma.favorite.upsert({
        where: { userId_destinationSlug: { userId: user.id, destinationSlug: destination.slug } },
        create: { userId: user.id, destinationSlug: destination.slug },
        update: {},
      });
    }

    for (const label of demo.badges) {
      await prisma.userBadge.upsert({
        where: { userId_label: { userId: user.id, label } },
        create: { userId: user.id, label },
        update: {},
      });
    }
  }
}

/**
 * Từ điển địa danh. Idempotent theo slug như mọi bảng khác, và cũng xoá bản ghi mồ côi: bỏ một
 * địa danh khỏi place-data.ts là nó biến khỏi từ điển, để không còn khoá nào mà kho tri thức
 * trỏ tới nhưng người không còn nhận là hợp lệ.
 */
async function seedPlaces(): Promise<void> {
  for (const place of PLACES) {
    const data = {
      name: place.name,
      kind: place.kind,
      aliases: place.aliases,
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

async function main(): Promise<void> {
  console.log("Nạp nội dung Hà Giang...");
  await seedPlaces();
  await seedDestinations();
  await seedMapWaypoints();
  await seedHomestays();
  await seedGear();
  await seedPassWeather();
  await seedPresetItineraries();

  console.log("Nạp tài khoản demo...");
  await seedDemoUsers();

  const counts = {
    places: await prisma.place.count(),
    destinations: await prisma.destination.count(),
    mapWaypoints: await prisma.mapWaypoint.count(),
    homestays: await prisma.homestay.count(),
    gearItems: await prisma.gearItem.count(),
    passWeather: await prisma.passWeather.count(),
    presetItineraries: await prisma.presetItinerary.count(),
    users: await prisma.user.count(),
  };

  console.log("Xong:", counts);
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
