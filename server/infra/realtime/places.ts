import { profileFor } from "@data/realtime/providers";
import { REGION_BBOX, REGION_LABEL } from "@data/realtime/region";
import { findPlace } from "@data/places/index";
import { requestJson } from "@server/infra/realtime/http";
import { cacheKey, readCache, writeCache } from "@server/infra/realtime/cache";
import { fail, isFailure, ok, type ToolResult } from "@server/infra/realtime/toolResult";
import { missingKeyMessage, readApiKey } from "@server/infra/realtime/credentials";

/**
 * TOOL TÌM ĐỊA ĐIỂM — Google Places API (New).
 *
 * File này có HAI RÀO CHẮN mà nếu tháo ra thì hệ thống vẫn chạy, vẫn trả kết quả, và vẫn trông
 * như đang hoạt động tốt. Đó là lý do chúng được giải thích dài ở đây thay vì một dòng comment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÀO CHẮN 1 — MỌI LƯỢT GỌI KÈM `locationRestriction` LÀ BBOX ĐỊA BÀN.
 *
 * Places trả kết quả cho mọi nơi trên thế giới. Cổng chặn "ngoài địa bàn" ở
 * `server/domain/agents/orchestrator.ts` là rào thứ nhất, dựa trên từ điển địa danh — và ghi chú
 * trong file đó nói rõ vì sao nó cần thiết: ngưỡng liên quan của RAG không chặn nổi nhóm câu hỏi
 * về địa bàn khác, vì "chợ phiên Bắc Hà họp ngày nào" chấm điểm cao hơn phần lớn câu hỏi hợp lệ.
 *
 * Nhưng cổng thứ nhất chỉ chặn được những tên đã có trong danh sách. Gắn Places vào mà không kèm
 * khung bao thì chatbot bắt đầu trả lời về Sapa, Đà Lạt, rồi Paris — với dữ liệu thật, giờ mở
 * cửa thật, nghe hoàn toàn đáng tin. Hai lớp tồn tại vì lớp thứ hai bảo vệ đúng trường hợp lớp
 * thứ nhất bị bỏ sót, và đây là kiểu hỏng mà không có test nào bắt được nếu không ai nghĩ tới.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÀO CHẮN 2 — CHỈ NHẬN TRƯỜNG CÓ CẤU TRÚC, KIỂM CHỨNG ĐƯỢC.
 *
 * FR-BOT-05 nói chatbot chỉ được nói trong phạm vi tri thức ĐÃ KIỂM DUYỆT. Review và
 * `editorialSummary` trên Google là nội dung người dùng tạo và nội dung do Google sinh — không ai
 * trong dự án đọc qua chúng, nên chúng không thể là căn cứ cho câu trả lời.
 *
 * Rào chắn này KHÔNG được cài bằng cách "nhớ đừng lấy review". Nó được ép vào chính kiểu dữ
 * liệu: `PlaceHit` và `PlaceDetail` dưới đây không có một trường nào chứa văn bản tự do của
 * Google, và field mask cũng không xin những trường đó. Muốn thêm review vào thì phải sửa kiểu,
 * sửa field mask, và đọc lại khối chú thích này — tức là phải làm có ý thức chứ không lỡ tay.
 *
 * Hệ quả cho giai đoạn G: thứ tự ưu tiên của Mục 11.1.1.10 (realtime thắng knowledge) phải áp
 * THEO TỪNG TRƯỜNG chứ không theo cả nguồn. Giờ mở cửa từ Google thắng nội dung biên tập — đúng.
 * Mô tả địa danh từ Google thắng nội dung biên tập — sai. Mô tả luôn đến từ @data/knowledge.
 */

const PROVIDER = "google-places";

/** Field mask hẹp, và mọi trường trong đây đều là dữ liệu có cấu trúc. Xem rào chắn 2. */
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
].join(",");

const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "businessStatus",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "regularOpeningHours",
  "nationalPhoneNumber",
].join(",");

export interface PlaceHit {
  placeId: string;
  /** Tên hiển thị. Đây là nhãn định danh cơ sở, không phải văn bản mô tả. */
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY. Dữ liệu quyết định, nên giữ nguyên. */
  businessStatus: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  primaryType: string | null;
}

export interface PlaceDetail extends PlaceHit {
  /** Giờ mở cửa dạng chuỗi do Google cung cấp theo từng ngày. Có cấu trúc, không phải văn bản tự do. */
  openingHoursWeekdayText: string[];
  openNow: boolean | null;
  phone: string | null;
}

interface SearchResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    primaryType?: string;
  }[];
}

type RawPlace = NonNullable<SearchResponse["places"]>[number];

function toHit(raw: RawPlace): PlaceHit | null {
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (!raw.id || typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? "",
    address: raw.formattedAddress ?? null,
    lat,
    lng,
    businessStatus: raw.businessStatus ?? null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    ratingCount: typeof raw.userRatingCount === "number" ? raw.userRatingCount : null,
    priceLevel: raw.priceLevel ?? null,
    primaryType: raw.primaryType ?? null,
  };
}

/** Kiểm một điểm có nằm trong khung bao địa bàn. Lớp chặn cuối, sau cả locationRestriction. */
export function insideRegion(lat: number, lng: number): boolean {
  return (
    lat >= REGION_BBOX.south &&
    lat <= REGION_BBOX.north &&
    lng >= REGION_BBOX.west &&
    lng <= REGION_BBOX.east
  );
}

/**
 * Tìm địa điểm theo văn bản, giới hạn trong địa bàn.
 *
 * `nearSlug` không đổi kết quả thành tìm quanh một điểm mà chỉ thêm tên nơi đó vào truy vấn văn
 * bản. Chọn cách này thay vì Nearby Search vì với vùng núi thì bán kính hình tròn gần như luôn
 * sai: hai chỗ cách nhau ít km đường chim bay có thể cách nhau cả tiếng đường đèo, nên "quanh
 * đây trong vòng 10 km" không phải khái niệm hữu ích ở địa hình này.
 */
export async function searchPlaces(input: {
  query: string;
  nearSlug?: string;
  /** Số kết quả tối đa, 1–20. Mặc định 8 để câu trả lời không bị ngập danh sách. */
  limit?: number;
}): Promise<ToolResult<PlaceHit[]>> {
  const profile = profileFor("place_search");

  const apiKey = readApiKey(profile);
  if (apiKey === null) return fail("PROVIDER_NOT_CONFIGURED", missingKeyMessage(profile), PROVIDER);

  const nearName = input.nearSlug ? findPlace(input.nearSlug)?.name : undefined;
  if (input.nearSlug && !nearName) {
    return fail("NOT_FOUND", `slug không có trong danh mục: ${input.nearSlug}`, PROVIDER);
  }

  const textQuery = nearName ? `${input.query} ${nearName}` : `${input.query} ${REGION_LABEL}`;
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);

  const cacheId = cacheKey("place_search", { textQuery, limit });
  const cached = await readCache<PlaceHit[]>(cacheId);
  if (cached) {
    return ok(cached.payload, cached.source, { cached: true, retrievedAt: cached.retrievedAt });
  }

  const response = await requestJson<SearchResponse>(`${profile.baseUrl}/v1/places:searchText`, profile, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: {
      textQuery,
      languageCode: "vi",
      regionCode: "VN",
      maxResultCount: limit,
      // RÀO CHẮN 1. Không bao giờ bỏ tham số này.
      locationRestriction: {
        rectangle: {
          low: { latitude: REGION_BBOX.south, longitude: REGION_BBOX.west },
          high: { latitude: REGION_BBOX.north, longitude: REGION_BBOX.east },
        },
      },
    },
  });
  if (isFailure(response)) return response;

  // Lọc lại theo bbox ở phía ta dù đã gửi locationRestriction: Places coi restriction là gợi ý
  // mạnh chứ không phải điều kiện tuyệt đối trong mọi trường hợp, và một kết quả lọt ra ngoài địa
  // bàn là đúng thứ hai rào chắn này tồn tại để ngăn.
  const hits = (response.data.places ?? [])
    .map(toHit)
    .filter((hit): hit is PlaceHit => hit !== null && insideRegion(hit.lat, hit.lng));

  await writeCache(cacheId, "place_search", hits, PROVIDER, profile.ttlSeconds);
  return ok(hits, PROVIDER, { cached: false });
}

interface DetailResponse extends RawPlace {
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  nationalPhoneNumber?: string;
}

/**
 * Chi tiết một địa điểm theo `placeId`.
 *
 * Đây là hàm phục vụ bước xác minh các thực thể mang tag `can-xac-minh-places` trong
 * @data/places: danh mục tĩnh giữ danh sách ứng viên, còn việc cơ sở đó còn hoạt động hay không
 * và mở cửa giờ nào là dữ liệu động, phải hỏi lúc chạy. `businessStatus` là trường quan trọng
 * nhất ở đây — một quán đã đóng vĩnh viễn mà vẫn được giới thiệu là kiểu sai mà khách chỉ phát
 * hiện khi đã đi tới đó.
 */
export async function getPlaceDetails(input: { placeId: string }): Promise<ToolResult<PlaceDetail>> {
  const profile = profileFor("place_search");

  const apiKey = readApiKey(profile);
  if (apiKey === null) return fail("PROVIDER_NOT_CONFIGURED", missingKeyMessage(profile), PROVIDER);

  const cacheId = cacheKey("place_details", { placeId: input.placeId });
  const cached = await readCache<PlaceDetail>(cacheId);
  if (cached) {
    return ok(cached.payload, cached.source, { cached: true, retrievedAt: cached.retrievedAt });
  }

  const response = await requestJson<DetailResponse>(
    `${profile.baseUrl}/v1/places/${encodeURIComponent(input.placeId)}?languageCode=vi`,
    profile,
    { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAIL_FIELD_MASK } },
  );
  if (isFailure(response)) return response;

  const hit = toHit(response.data);
  if (!hit) return fail("NOT_FOUND", `Places không trả về dữ liệu cho ${input.placeId}`, PROVIDER);

  if (!insideRegion(hit.lat, hit.lng)) {
    return fail(
      "UNSUPPORTED_REGION",
      `địa điểm ${input.placeId} nằm ngoài ${REGION_LABEL}`,
      PROVIDER,
    );
  }

  const detail: PlaceDetail = {
    ...hit,
    openingHoursWeekdayText: response.data.regularOpeningHours?.weekdayDescriptions ?? [],
    openNow: response.data.regularOpeningHours?.openNow ?? null,
    phone: response.data.nationalPhoneNumber ?? null,
  };

  await writeCache(cacheId, "place_details", detail, PROVIDER, profile.ttlSeconds);
  return ok(detail, PROVIDER, { cached: false });
}
