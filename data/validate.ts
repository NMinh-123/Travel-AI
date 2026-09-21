import { ALL_KNOWLEDGE, type KnowledgeSourceDoc, type Season } from "@data/knowledge/index";
import { PLACES } from "@data/places/index";
import { OUT_OF_AREA_PLACES } from "@data/places/out-of-area";
import { normalizePlaceName } from "@data/places/normalize";
import { EXTERNAL_TTL_DAYS, daysUntilExpiry, isExpired } from "@data/knowledge/validity";
import type { Place } from "@data/places/types";

/**
 * KIỂM ĐỊNH DỮ LIỆU NGUỒN — chạy trước ingest và chạy trong test.
 *
 * Kiểu TypeScript chỉ bảo đảm HÌNH DẠNG của dữ liệu. Những lỗi đắt nhất của một kho tri thức lại
 * nằm ở QUAN HỆ giữa các bản ghi, và chúng đều đi qua kiểu mà không bị chặn: hai thực thể trùng
 * slug, một `parentSlug` trỏ vòng lại chính nó, hai địa danh khai cùng một alias, một khoảng giá
 * có cận dưới lớn hơn cận trên, một tài liệu crawl thiếu ngày đối chiếu.
 *
 * Điểm chung của cả nhóm: **không có lỗi nào báo ra lúc chạy**. Tài liệu gắn `entityId` sai chính
 * tả thì lặng lẽ không khớp bộ lọc nào và biến khỏi mọi câu trả lời; alias mơ hồ thì bộ phân giải
 * chọn bừa một trong hai nơi; giá đảo ngược thì hiện ra như một khoảng giá bình thường. Chỉ một
 * bộ kiểm định đọc toàn bộ danh mục cùng lúc mới thấy được chúng.
 *
 * File này KHÔNG import từ `@server/*`: nó phải chạy được trong test và trong script ingest mà
 * không kéo theo cấu hình server hay kết nối database.
 */

export interface DataIssue {
  /** Mã ngắn để lọc và để test bám vào, ví dụ `PLACE_DUPLICATE_SLUG`. */
  code: string;
  /** Bản ghi gây lỗi — slug thực thể hoặc `domain:slug` của tài liệu. */
  entity: string;
  message: string;
}

/**
 * Khung toạ độ hợp lệ của địa bàn.
 *
 * Rộng hơn dữ liệu thật khá nhiều (dữ liệu hiện nằm trong lat 22,57–23,39 và lng 104,49–105,49),
 * vì mục đích không phải là bắt lỗi vài trăm mét mà là bắt những sai lệch cỡ lớn: toạ độ bỏ trống
 * thành 0, lat và lng bị đảo cho nhau, hoặc chép nhầm từ một tỉnh khác. Siết sát dữ liệu hiện có
 * sẽ chặn luôn việc thêm thực thể hợp lệ ở rìa địa bàn.
 */
const BOUNDS = { latMin: 22, latMax: 23.6, lngMin: 104, lngMax: 106 };
/** Đỉnh cao nhất Việt Nam là 3.143 m, nên quá mốc này chắc chắn là dữ liệu hỏng. */
const ELEVATION_MAX_M = 3200;

const SEASONS: Season[] = [
  "hoa_tam_giac_mach", "lua_chin", "hoa_cai", "hoa_dao_man", "mua_mua", "mua_lanh", "quanh_nam",
];

/** `YYYY-MM-DD` và là một ngày có thật; `2026-02-31` phải bị coi là sai. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Tìm chu trình trong cây `parentSlug`.
 *
 * Cây địa danh được cả bộ phân giải lẫn truy vấn "có gì ở Đồng Văn" đi ngược lên để gom con
 * cháu. Một chu trình ở đây không làm sai kết quả mà làm TREO vòng lặp, và nó chỉ xuất hiện khi
 * ai đó sửa quan hệ cha con của hai thực thể trong hai lần commit khác nhau — tức đúng lúc không
 * ai nhìn cả hai cùng lúc.
 */
function findParentCycles(places: Place[]): DataIssue[] {
  const parents = new Map(places.map((place) => [place.slug, place.parentSlug]));
  const issues: DataIssue[] = [];
  const settled = new Set<string>();

  for (const place of places) {
    if (settled.has(place.slug)) continue;
    const path: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = place.slug;

    while (current !== undefined && !settled.has(current)) {
      if (seen.has(current)) {
        issues.push({
          code: "PLACE_PARENT_CYCLE",
          entity: place.slug,
          message: `Cây địa danh có chu trình: ${[...path.slice(path.indexOf(current)), current].join(" -> ")}.`,
        });
        break;
      }
      seen.add(current);
      path.push(current);
      current = parents.get(current);
    }
    for (const slug of path) settled.add(slug);
  }
  return issues;
}

/**
 * Giá khảo sát cũ hơn mốc này thì không còn được trình bày như giá hiện tại.
 *
 * Bằng đúng hạn của nội dung `estimated` trong `EXTERNAL_TTL_DAYS`: cả hai đều là con số chụp
 * lại một thời điểm của thị trường, nên không có lý do gì để hai bên trượt theo hai tốc độ khác
 * nhau. Đổi một chỗ thì đổi cả hai.
 */
const PRICE_MAX_AGE_DAYS = EXTERNAL_TTL_DAYS.estimated;

export function validatePlaces(places: Place[], outOfArea: string[], now: Date): DataIssue[] {
  const issues: DataIssue[] = [];
  const bySlug = new Map<string, Place>();
  const today = now.toISOString().slice(0, 10);
  const staleBefore = new Date(now.getTime() - PRICE_MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);

  for (const place of places) {
    if (bySlug.has(place.slug)) {
      issues.push({ code: "PLACE_DUPLICATE_SLUG", entity: place.slug, message: "Slug xuất hiện nhiều lần trong danh mục." });
      continue;
    }
    bySlug.set(place.slug, place);
  }

  for (const place of places) {
    if (place.parentSlug !== undefined && !bySlug.has(place.parentSlug)) {
      issues.push({ code: "PLACE_PARENT_MISSING", entity: place.slug, message: `parentSlug "${place.parentSlug}" không có trong danh mục.` });
    }
    if (place.parentSlug === place.slug) {
      issues.push({ code: "PLACE_PARENT_CYCLE", entity: place.slug, message: "Thực thể tự trỏ về chính nó." });
    }

    const geo = place.geo;
    if (geo) {
      if (geo.lat < BOUNDS.latMin || geo.lat > BOUNDS.latMax || geo.lng < BOUNDS.lngMin || geo.lng > BOUNDS.lngMax) {
        issues.push({
          code: "PLACE_GEO_OUT_OF_BOUNDS",
          entity: place.slug,
          message: `Toạ độ (${geo.lat}, ${geo.lng}) nằm ngoài địa bàn — kiểm xem lat và lng có bị đảo không.`,
        });
      }
      if (!Number.isFinite(geo.elevationM) || geo.elevationM < 0 || geo.elevationM > ELEVATION_MAX_M) {
        issues.push({ code: "PLACE_ELEVATION_IMPLAUSIBLE", entity: place.slug, message: `Độ cao ${geo.elevationM} m không hợp lý.` });
      }
    }

    const price = place.price;
    if (price) {
      if (price.minVnd <= 0 || price.maxVnd <= 0) {
        issues.push({ code: "PRICE_NOT_POSITIVE", entity: place.slug, message: "Khoảng giá phải là số dương." });
      }
      if (price.minVnd > price.maxVnd) {
        issues.push({
          code: "PRICE_RANGE_INVERTED",
          entity: place.slug,
          message: `Khoảng giá đảo ngược: ${price.minVnd} > ${price.maxVnd}.`,
        });
      }
      if (!isCalendarDate(price.surveyedAt)) {
        issues.push({ code: "PRICE_SURVEYED_AT_INVALID", entity: place.slug, message: `surveyedAt "${price.surveyedAt}" không phải ngày hợp lệ.` });
      } else if (price.surveyedAt > today) {
        issues.push({ code: "PRICE_SURVEYED_AT_FUTURE", entity: place.slug, message: `surveyedAt "${price.surveyedAt}" nằm ở tương lai.` });
      }
      // Giá ước lượng KHÔNG được đứng một mình: xem cảnh báo ở `PriceEstimate`. Không có trang
      // tham chiếu thì con số đó không soát lại được, và nó sẽ được trích như giá thật.
      if (price.sourceUrls.length === 0) {
        issues.push({ code: "PRICE_SOURCE_MISSING", entity: place.slug, message: "Khoảng giá phải có ít nhất một sourceUrl để soát lại." });
      }

      /**
       * GIÁ SUY LUẬN KHÔNG ĐƯỢC ĐỨNG Ở VỊ TRÍ GIÁ CHÍNH THỨC.
       *
       * `published_rate` nghĩa là "chính cơ sở công bố bảng giá này", nên nó phải trỏ tới đúng
       * trang của cơ sở đó. Đặt mức mạnh nhất cho một con số thực ra suy từ mặt bằng thị trường
       * là kiểu sai nguy hiểm nhất trong cả nhóm giá: mọi lớp phía sau — lời nhắc của tác tử
       * ngân sách, bộ đối chiếu dữ kiện số — đều tin vào nhãn này để quyết định được nói "giá là"
       * hay phải nói "giá tham khảo khoảng".
       *
       * Phép kiểm ở đây là phép kiểm HÌNH THỨC, không phải phép kiểm sự thật: mã không biết trang
       * kia có thật là của cơ sở không. Nó chỉ chặn được ca rõ ràng — khai `published_rate` mà
       * không có nguồn nào, hoặc khai `ota_observed` mà không ghi ngày đọc.
       */
      if (price.basis === "published_rate" && price.sourceUrls.length === 0) {
        issues.push({
          code: "PRICE_ESTIMATE_AS_OFFICIAL",
          entity: place.slug,
          message: "basis \"published_rate\" nghĩa là chính cơ sở công bố, nên bắt buộc có sourceUrls trỏ tới bảng giá đó.",
        });
      }
      if (price.basis === "ota_observed" && !isCalendarDate(price.surveyedAt)) {
        issues.push({
          code: "PRICE_ESTIMATE_AS_OFFICIAL",
          entity: place.slug,
          message: "basis \"ota_observed\" là một lần đọc tại một thời điểm, nên surveyedAt phải là ngày hợp lệ.",
        });
      }

      /**
       * Giá khảo sát quá lâu vẫn được trích như giá hiện tại.
       *
       * Cùng lý do với `validUntil` của kho tri thức: một khoảng giá từ hai năm trước trông y hệt
       * một khoảng giá mới. Khác ở chỗ giá không có cột hạn riêng, nên hạn được suy từ chính
       * `surveyedAt`.
       */
      if (isCalendarDate(price.surveyedAt) && price.surveyedAt <= staleBefore) {
        issues.push({
          code: "PRICE_STALE",
          entity: place.slug,
          message: `Giá khảo sát ngày ${price.surveyedAt}, đã quá ${PRICE_MAX_AGE_DAYS} ngày — khảo lại hoặc hạ basis xuống market_estimate.`,
        });
      }
    }
  }

  issues.push(...findParentCycles(places));

  /**
   * Alias mơ hồ: một cách gọi dẫn tới hai thực thể khác nhau.
   *
   * Bộ phân giải trả về thực thể đầu tiên khớp, nên một alias mơ hồ không báo lỗi mà chỉ âm thầm
   * chọn bừa — và chọn theo thứ tự file, tức kết quả đổi khi ai đó sắp xếp lại danh mục.
   */
  const owners = new Map<string, string[]>();
  for (const place of places) {
    for (const raw of [place.name, ...place.aliases]) {
      const key = normalizePlaceName(raw);
      if (!key) continue;
      const list = owners.get(key) ?? [];
      if (!list.includes(place.slug)) list.push(place.slug);
      owners.set(key, list);
    }
    for (const alias of place.aliases) {
      if (alias !== normalizePlaceName(alias)) {
        issues.push({
          code: "PLACE_ALIAS_NOT_NORMALIZED",
          entity: place.slug,
          message: `Alias "${alias}" chưa ở dạng chuẩn hoá; phải viết là "${normalizePlaceName(alias)}".`,
        });
      }
    }
  }
  for (const [key, slugs] of owners) {
    if (slugs.length > 1) {
      issues.push({ code: "PLACE_ALIAS_AMBIGUOUS", entity: slugs.join(", "), message: `Cách gọi "${key}" trỏ tới nhiều thực thể.` });
    }
  }

  /**
   * Danh sách chặn ngoài địa bàn không được phủ lên một địa danh có thật.
   *
   * Một mục trùng sẽ khiến câu hỏi HỢP LỆ bị chuyển tiếp với lý do ngoài địa bàn — kiểu hỏng tệ
   * nhất vì nó làm hệ thống từ chối đúng thứ nó biết.
   */
  for (const entry of outOfArea) {
    if (entry !== normalizePlaceName(entry)) {
      issues.push({ code: "OUT_OF_AREA_NOT_NORMALIZED", entity: entry, message: "Mục chặn phải ở dạng chuẩn hoá, nếu không nó không bao giờ khớp." });
    }
    const clash = owners.get(normalizePlaceName(entry));
    if (clash) {
      issues.push({
        code: "OUT_OF_AREA_SHADOWS_PLACE",
        entity: entry,
        message: `Mục chặn trùng tên với thực thể có thật (${clash.join(", ")}) — câu hỏi hợp lệ sẽ bị từ chối.`,
      });
    }
  }

  return issues;
}

export function validateKnowledge(docs: KnowledgeSourceDoc[], placeSlugs: Set<string>, now: Date): DataIssue[] {
  const issues: DataIssue[] = [];
  const seen = new Set<string>();
  const today = now.toISOString().slice(0, 10);

  for (const doc of docs) {
    const ref = `${doc.domain}:${doc.slug}`;

    if (seen.has(ref)) {
      issues.push({ code: "DOC_DUPLICATE_REF", entity: ref, message: "Hai tài liệu cùng domain và cùng slug — bản sau sẽ ghi đè bản trước lúc ingest." });
    }
    seen.add(ref);

    if (!doc.title.trim() || !doc.content.trim()) {
      issues.push({ code: "DOC_EMPTY", entity: ref, message: "Tài liệu thiếu tiêu đề hoặc nội dung." });
    }

    // Không đặt khoá ngoại tới Place theo đúng nguyên tắc "kho tri thức đánh chỉ mục lại độc
    // lập", nên phép kiểm toàn vẹn phải nằm ở đây.
    if (doc.entityId !== undefined && !placeSlugs.has(doc.entityId)) {
      issues.push({ code: "DOC_ENTITY_MISSING", entity: ref, message: `entityId "${doc.entityId}" không có trong danh mục thực thể.` });
    }

    /**
     * `sourceUrl` và `retrievedAt` là BẮT BUỘC với nội dung crawl và nội dung ước lượng — đúng
     * như data/knowledge/types.ts đã ghi. Thiếu chúng thì câu ghi nguồn ở cuối mỗi đoạn biến mất,
     * và nội dung lấy từ web được model đọc như tri thức biên tập của dự án.
     */
    if (doc.sourceClass !== "editorial") {
      if (!doc.sourceUrl) {
        issues.push({ code: "DOC_SOURCE_URL_MISSING", entity: ref, message: `sourceClass "${doc.sourceClass}" bắt buộc phải có sourceUrl.` });
      }
      if (!doc.retrievedAt) {
        issues.push({ code: "DOC_RETRIEVED_AT_MISSING", entity: ref, message: `sourceClass "${doc.sourceClass}" bắt buộc phải có retrievedAt.` });
      }
    }
    if (doc.retrievedAt !== undefined) {
      if (!isCalendarDate(doc.retrievedAt)) {
        issues.push({ code: "DOC_RETRIEVED_AT_INVALID", entity: ref, message: `retrievedAt "${doc.retrievedAt}" không phải ngày hợp lệ.` });
      } else if (doc.retrievedAt > today) {
        issues.push({ code: "DOC_RETRIEVED_AT_FUTURE", entity: ref, message: `retrievedAt "${doc.retrievedAt}" nằm ở tương lai.` });
      }
    }

    for (const season of doc.season) {
      if (!SEASONS.includes(season)) {
        issues.push({ code: "DOC_SEASON_UNKNOWN", entity: ref, message: `Mùa "${season}" không có trong bảng mùa.` });
      }
    }

    /**
     * TÀI LIỆU ĐÃ QUÁ HẠN TIN CẬY MÀ VẪN SẼ ĐƯỢC NẠP VỚI TRẠNG THÁI `APPROVED`.
     *
     * `KnowledgeDoc.status` mặc định là `APPROVED`, và `validUntil` được suy lúc ingest chứ không
     * có ai canh nó sau đó. Nghĩa là một tài liệu crawl với `retrievedAt` từ hai năm trước vẫn đi
     * thẳng vào kho ở trạng thái đã duyệt, rồi được truy xuất và trích dẫn như nội dung hiện
     * hành — đúng thứ mà cột `validUntil` sinh ra để ngăn.
     *
     * Bắt tại đây, ở tầng dữ liệu nguồn, là chỗ rẻ nhất: nó hỏng ngay lúc `npm run db:ingest`
     * thay vì hỏng âm thầm trong một câu trả lời nào đó vài tháng sau.
     */
    if (isExpired(doc, now)) {
      const days = daysUntilExpiry(doc, now);
      issues.push({
        code: "DOC_EXPIRED",
        entity: ref,
        message:
          `Nội dung "${doc.sourceClass}" đối chiếu ngày ${doc.retrievedAt} đã quá hạn tin cậy ` +
          `${days === null ? "" : `${Math.abs(days)} ngày`} — đối chiếu lại nguồn rồi cập nhật ` +
          `retrievedAt, đừng nạp vào kho ở trạng thái APPROVED.`,
      });
    }
  }

  return issues;
}

/** Kiểm toàn bộ dữ liệu thật của dự án. `now` tách ra để test không phụ thuộc đồng hồ máy. */
export function validateData(now: Date = new Date()): DataIssue[] {
  return [
    ...validatePlaces(PLACES, OUT_OF_AREA_PLACES, now),
    ...validateKnowledge(ALL_KNOWLEDGE, new Set(PLACES.map((place) => place.slug)), now),
  ];
}

export function formatIssues(issues: DataIssue[]): string {
  return issues.map((issue) => `  [${issue.code}] ${issue.entity}: ${issue.message}`).join("\n");
}
