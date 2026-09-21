import { profileFor } from "@data/realtime/providers";
import { ROUTE_SEGMENTS } from "@data/realtime/route-segments";
import type { RouteSegment } from "@data/realtime/types";
import { findPlace } from "@data/places/index";
import { requestJson } from "@server/infra/realtime/http";
import { cacheKey, readCache, writeCache } from "@server/infra/realtime/cache";
import { fail, isFailure, ok, type ToolResult } from "@server/infra/realtime/toolResult";
import { missingKeyMessage, readApiKey } from "@server/infra/realtime/credentials";

/**
 * TOOL TUYẾN ĐƯỜNG — Google Routes API v2.
 *
 * Chọn Google chứ không phải OSM vì độ phủ dữ liệu đường ở Việt Nam: trên các tuyến liên xã vùng
 * núi, dữ liệu mở thưa hơn đáng kể và cho ra thời gian di chuyển lệch nhiều. Đây là hạng mục mà
 * câu trả lời cho khách phụ thuộc trực tiếp vào chất lượng dữ liệu, nên chọn nguồn tốt hơn và
 * coi chi phí là hạng mục phải cấu hình.
 *
 * HAI ĐIỀU PHẢI GIỮ KHI SỬA FILE NÀY.
 *
 * Một — FIELD MASK PHẢI HẸP. Routes API tính tiền theo SKU, và SKU đắt hơn được kích hoạt khi
 * field mask xin những trường nâng cao. Xin `*` cho tiện là cách chuyển toàn bộ lưu lượng sang
 * bậc giá cao nhất mà không ai nhận ra cho tới lúc nhận hoá đơn. Danh sách trường dưới đây là
 * mức tối thiểu đủ dùng; thêm trường thì phải kiểm bảng giá trước.
 *
 * Hai — WAYPOINT TRUNG GIAN LÀ PHẦN CỦA YÊU CẦU, không phải tối ưu. Routes API tối ưu theo thời
 * gian, nên với chặng Đồng Văn – Mèo Vạc nó có thể trả về một tuyến vòng ngoài nhanh hơn mà không
 * qua Mã Pí Lèng. Tuyến đó đúng về mặt giao thông và vô dụng với khách đi ngắm cảnh. Vì vậy các
 * chặng khung khai sẵn `viaSlugs` trong @data/realtime/route-segments, và adapter phải truyền
 * chúng vào `intermediates`.
 */

const PROVIDER = "google-routes";

export interface RouteInfo {
  distanceMeters: number;
  /** Giây. Routes API trả dạng "3600s"; đã phân giải sẵn ở đây để tầng trên không phải parse. */
  durationSeconds: number;
  /** Polyline đã mã hoá, để giao diện vẽ tuyến. Không dùng trong câu trả lời văn bản. */
  encodedPolyline: string | null;
  travelMode: "DRIVE" | "TWO_WHEELER";
  /** Nhãn người đọc được của hai đầu chặng, để câu trả lời nói rõ đang nói về đoạn nào. */
  fromLabel: string;
  toLabel: string;
  viaLabels: string[];
  /**
   * Cảnh báo do chính adapter sinh ra, KHÔNG phải do Google trả về.
   *
   * Hiện có một loại: lệch quá 20% so với `referenceDistanceKm` của chặng khung. Lệch như vậy
   * nghĩa là Routes API đã định lại đường — có thể vì đang cấm đường, có thể vì waypoint không
   * ép được tuyến như mong đợi. Vẫn TRẢ dữ liệu vì nó là dữ liệu thật của tuyến thật, nhưng kèm
   * cảnh báo để tác tử nói rõ và để người vận hành biết cần xem lại khai báo chặng.
   */
  warnings: string[];
  /** Ghi chú địa hình lấy từ khai báo chặng. Đây là tri thức biên tập, không phải dữ liệu API. */
  terrainNote: string | null;
}

/** Tìm chặng khung khớp cặp điểm, theo cả hai chiều. */
function matchSegment(fromSlug: string, toSlug: string, travelMode?: string): RouteSegment | undefined {
  return ROUTE_SEGMENTS.find(
    (segment) =>
      ((segment.fromSlug === fromSlug && segment.toSlug === toSlug) ||
        (segment.fromSlug === toSlug && segment.toSlug === fromSlug)) &&
      (!travelMode || segment.travelMode === travelMode),
  );
}

/** Toạ độ của một slug, dạng waypoint của Routes API. */
function waypoint(slug: string): { location: { latLng: { latitude: number; longitude: number } } } | null {
  const place = findPlace(slug);
  if (!place?.geo) return null;
  return { location: { latLng: { latitude: place.geo.lat, longitude: place.geo.lng } } };
}

interface ComputeRoutesResponse {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }[];
}

export async function getRoute(input: {
  fromSlug: string;
  toSlug: string;
  travelMode?: "DRIVE" | "TWO_WHEELER";
  /** ISO 8601. Bỏ trống thì Routes API tính theo điều kiện mặc định. */
  departureTime?: string;
}): Promise<ToolResult<RouteInfo>> {
  const profile = profileFor("route");

  const apiKey = readApiKey(profile);
  if (apiKey === null) return fail("PROVIDER_NOT_CONFIGURED", missingKeyMessage(profile), PROVIDER);

  const from = findPlace(input.fromSlug);
  const to = findPlace(input.toSlug);
  if (!from || !to) {
    return fail("NOT_FOUND", `slug không có trong danh mục: ${input.fromSlug} hoặc ${input.toSlug}`, PROVIDER);
  }

  const segment = matchSegment(input.fromSlug, input.toSlug, input.travelMode);
  const travelMode = input.travelMode ?? segment?.travelMode ?? "TWO_WHEELER";
  const viaSlugs = segment?.viaSlugs ?? [];

  const origin = waypoint(input.fromSlug);
  const destination = waypoint(input.toSlug);
  if (!origin || !destination) {
    return fail(
      "NOT_FOUND",
      `thiếu toạ độ cho ${!origin ? input.fromSlug : input.toSlug} — không gọi Routes được`,
      PROVIDER,
    );
  }

  // Waypoint nào thiếu toạ độ thì bỏ qua chứ không làm cả lượt gọi thất bại: mất một điểm ép
  // tuyến vẫn còn hơn không có tuyến nào, và trường hợp đó sẽ lộ ra qua cảnh báo lệch khoảng cách.
  const intermediates = viaSlugs.map(waypoint).filter((point): point is NonNullable<typeof point> => point !== null);

  const cacheParams = {
    from: input.fromSlug,
    to: input.toSlug,
    travelMode,
    via: viaSlugs,
    // Giờ khởi hành KHÔNG vào khoá cache theo giá trị chính xác mà theo việc có hay không: TTL
    // của tuyến đường là 24 giờ, nên băm cả mốc thời gian vào khoá sẽ làm mọi lượt gọi thành một
    // khoá riêng và cache không bao giờ trúng.
    withDeparture: Boolean(input.departureTime),
  };
  const cacheId = cacheKey("route", cacheParams);
  const cached = await readCache<RouteInfo>(cacheId);
  if (cached) {
    return ok(cached.payload, cached.source, { cached: true, retrievedAt: cached.retrievedAt });
  }

  const response = await requestJson<ComputeRoutesResponse>(
    `${profile.baseUrl}/directions/v2:computeRoutes`,
    profile,
    {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        // Field mask hẹp có chủ đích — xem khối chú thích ở đầu file về SKU.
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: {
        origin,
        destination,
        intermediates: intermediates.length ? intermediates : undefined,
        travelMode,
        ...(travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        ...(input.departureTime ? { departureTime: input.departureTime } : {}),
        languageCode: "vi",
        units: "METRIC",
      },
    },
  );
  if (isFailure(response)) return response;

  const route = response.data.routes?.[0];
  if (!route?.distanceMeters || !route.duration) {
    return fail("NOT_FOUND", "Routes API không trả về tuyến nào cho cặp điểm này", PROVIDER);
  }

  const durationSeconds = Number.parseInt(route.duration.replace(/s$/, ""), 10);
  const warnings: string[] = [];

  if (segment) {
    const actualKm = route.distanceMeters / 1000;
    const deviation = Math.abs(actualKm - segment.referenceDistanceKm) / segment.referenceDistanceKm;
    if (deviation > 0.2) {
      warnings.push(
        `Khoảng cách trả về (${actualKm.toFixed(1)} km) lệch hơn 20% so với khoảng cách tham ` +
          `chiếu của chặng (${segment.referenceDistanceKm} km). Tuyến có thể đã bị định lại đường.`,
      );
    }
  }

  const info: RouteInfo = {
    distanceMeters: route.distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
    travelMode,
    fromLabel: from.name,
    toLabel: to.name,
    viaLabels: viaSlugs.map((slug) => findPlace(slug)?.name ?? slug),
    warnings,
    terrainNote: segment?.terrainNote ?? null,
  };

  await writeCache(cacheId, "route", info, PROVIDER, profile.ttlSeconds);
  return ok(info, PROVIDER, { cached: false });
}
