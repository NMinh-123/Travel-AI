import { profileFor } from "@data/realtime/providers";
import { REGION_BBOX, REGION_LABEL } from "@data/realtime/region";
import { buildUrl, requestJson } from "@server/infra/realtime/http";
import { cacheKey, readCache, writeCache } from "@server/infra/realtime/cache";
import { fail, isFailure, ok, type ToolResult } from "@server/infra/realtime/toolResult";
import { missingKeyMessage, readApiKey } from "@server/infra/realtime/credentials";
import { insideRegion } from "@server/infra/realtime/places";

/**
 * TOOL PHÂN GIẢI TÊN THÀNH TOẠ ĐỘ — Google Geocoding API.
 *
 * Tool này chỉ dùng cho những địa chỉ KHÔNG có trong danh mục: một khách sạn khách tự nhập, một
 * địa chỉ cụ thể trên đường. Mọi thực thể đã có trong @data/places thì lấy toạ độ trực tiếp từ
 * `Place.geo` — gọi Geocoding cho chúng là tốn tiền để nhận về con số mình đã có, và tệ hơn là
 * mở khả năng nhận về một toạ độ KHÁC với toạ độ đã khai, tạo ra hai nguồn sự thật cho cùng một
 * điểm.
 *
 * QUY TẮC QUAN TRỌNG NHẤT: KẾT QUẢ NGOÀI KHUNG BAO THÌ TRẢ LỖI, KHÔNG TRẢ TOẠ ĐỘ.
 *
 * Đây không phải kiểm tra cho chặt chẽ mà là chặn một lỗi có hậu quả thật. Một toạ độ ngoài địa
 * bàn đi tiếp vào Routes API sẽ sinh ra một cung đường hoàn toàn hợp lệ — có khoảng cách, có thời
 * gian, có polyline — và hoàn toàn sai. Không có gì trong chuỗi xử lý phía sau nhận ra được điều
 * đó, vì mọi dữ liệu đều đúng định dạng. Khách sẽ nhận một câu trả lời tự tin về một tuyến đường
 * không liên quan gì tới chuyến đi của mình. Chặn ngay tại đây là chỗ duy nhất còn nhận ra được.
 *
 * `bounds` gửi cho Google chỉ là GỢI Ý ưu tiên, không phải giới hạn cứng — đó là lý do phải kiểm
 * lại kết quả ở phía ta thay vì tin vào tham số đã gửi.
 */

const PROVIDER = "google-geocoding";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  /**
   * Mức chính xác Google báo: ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE.
   *
   * Giữ lại vì nó quyết định toạ độ này dùng được để làm gì. `APPROXIMATE` thường là tâm của một
   * xã hoặc một vùng, đủ để gọi thời tiết nhưng không đủ để dẫn đường tới một cơ sở cụ thể — và
   * đưa một toạ độ APPROXIMATE vào Routes rồi nói với khách "đi 12 phút là tới" là sai theo kiểu
   * không ai kiểm được.
   */
  locationType: string | null;
  placeId: string | null;
}

interface GeocodeResponse {
  status?: string;
  results?: {
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?: { lat?: number; lng?: number };
      location_type?: string;
    };
  }[];
}

export async function geocode(input: { address: string }): Promise<ToolResult<GeocodeResult>> {
  const profile = profileFor("geocode");

  const apiKey = readApiKey(profile);
  if (apiKey === null) return fail("PROVIDER_NOT_CONFIGURED", missingKeyMessage(profile), PROVIDER);

  const address = input.address.trim();
  if (!address) return fail("NOT_FOUND", "địa chỉ rỗng", PROVIDER);

  const cacheId = cacheKey("geocode", { address: address.toLowerCase() });
  const cached = await readCache<GeocodeResult>(cacheId);
  if (cached) {
    return ok(cached.payload, cached.source, { cached: true, retrievedAt: cached.retrievedAt });
  }

  const url = buildUrl(profile.baseUrl, "/maps/api/geocode/json", {
    address: `${address}, ${REGION_LABEL}`,
    // Gợi ý ưu tiên vùng. Không phải giới hạn cứng — xem khối chú thích ở đầu file.
    bounds: `${REGION_BBOX.south},${REGION_BBOX.west}|${REGION_BBOX.north},${REGION_BBOX.east}`,
    region: "vn",
    language: "vi",
    key: apiKey,
  });

  const response = await requestJson<GeocodeResponse>(url, profile);
  if (isFailure(response)) return response;

  // Geocoding API trả HTTP 200 kèm `status` trong thân, nên lỗi logic KHÔNG hiện ra ở mã HTTP.
  // Đây là kiểu API mà chỉ kiểm response.ok là bỏ sót toàn bộ nhóm lỗi.
  const status = response.data.status;
  if (status === "ZERO_RESULTS") {
    return fail("NOT_FOUND", `không phân giải được địa chỉ "${address}"`, PROVIDER);
  }
  if (status === "OVER_QUERY_LIMIT") {
    return fail("RATE_LIMITED", "Geocoding API báo vượt hạn mức", PROVIDER);
  }
  if (status !== "OK") {
    return fail("PROVIDER_ERROR", `Geocoding API trả status ${status ?? "không rõ"}`, PROVIDER);
  }

  const first = response.data.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return fail("NOT_FOUND", `phản hồi thiếu toạ độ cho "${address}"`, PROVIDER);
  }

  if (!insideRegion(lat, lng)) {
    return fail(
      "UNSUPPORTED_REGION",
      `"${address}" phân giải ra một điểm ngoài ${REGION_LABEL} — không dùng toạ độ này`,
      PROVIDER,
    );
  }

  const result: GeocodeResult = {
    lat,
    lng,
    formattedAddress: first?.formatted_address ?? address,
    locationType: first?.geometry?.location_type ?? null,
    placeId: first?.place_id ?? null,
  };

  await writeCache(cacheId, "geocode", result, PROVIDER, profile.ttlSeconds);
  return ok(result, PROVIDER, { cached: false });
}
