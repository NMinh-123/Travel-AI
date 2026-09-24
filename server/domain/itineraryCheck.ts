import { PLACES } from "@data/places/index";
import { normalizePlaceName } from "@data/places/normalize";
import { ROUTE_SEGMENTS } from "@data/realtime/route-segments";
import { LODGING_OPTIONS } from "@server/domain/lodging";

/**
 * KIỂM TÍNH KHẢ THI CỦA MỘT LỊCH TRÌNH — độc lập hoàn toàn với model.
 *
 * Trước đây phép kiểm duy nhất sau khi sinh là `Array.isArray(plan.days) && plan.days.length > 0`,
 * và `plan` mang kiểu `any` nên không có gì chặn giữa đầu ra của model và màn hình của khách. Một
 * lịch trình "hợp lệ" theo mức đó vẫn có thể bảo khách ngày 1 kết thúc ở Đồng Văn rồi ngày 2 xuất
 * phát từ Mèo Vạc, chạy 180 km trong 3 giờ trên đường đèo, và về tới nơi nghỉ lúc 21 giờ.
 *
 * NGUYÊN TẮC: mọi phép kiểm ở đây phải trả lời được bằng DỮ LIỆU CÓ SẴN, không hỏi lại model.
 * Danh mục địa danh nói địa danh có thật hay không; danh mục lưu trú nói cơ sở có thật hay không;
 * bảng chặng khung cho một con số để đối chiếu quãng đường; còn giờ giấc và tốc độ thì chỉ là số
 * học. Cái gì phải hỏi model mới biết thì không thuộc về file này.
 *
 * KẾT QUẢ LÀ DANH SÁCH LỖI CÓ MÃ, không phải một cờ đúng/sai. Danh sách đó đi hai đường: quay lại
 * cho model sửa (xem vòng lặp sửa trong server/domain/itinerary.ts), và đi ra ngoài để câu trả lời
 * nói rõ phần nào chưa xác minh được.
 */

/**
 * BA LOẠI LỖI, và vì sao chúng phải tách nhau.
 *
 * Bản trước gộp tất cả vào một danh sách phẳng, nên vòng lặp sửa chỉ biết đếm. Ba loại này đòi ba
 * cách xử lý khác hẳn nhau:
 *
 *  - `schema` — model bỏ trống một trường bắt buộc. Bản trước thay nó bằng `0` và đi tiếp, nên
 *    "thiếu quãng đường" trông y hệt "quãng đường bằng 0", và mọi phép kiểm ngữ nghĩa phía sau
 *    đều chạy trên một con số không ai từng viết ra. Lỗi loại này model sửa được ngay và rẻ.
 *  - `semantic` — trường có mặt nhưng giá trị không đi được: 180 km trong 3 giờ, về tới nơi lúc
 *    21 giờ, chỗ nghỉ nằm cách điểm kết thúc ngày một quả núi.
 *  - `unverified` — không có gì sai, chỉ là KHÔNG CÓ dữ liệu để đối chiếu. Đây là loại duy nhất
 *    KHÔNG được đưa cho model sửa: bảo model sửa một con số mà ta không biết đúng hay sai chỉ
 *    khiến nó đổi sang một con số khác cũng không kiểm được.
 */
export type IssueKind = "schema" | "semantic" | "unverified";

export interface ItineraryIssue {
  code: string;
  kind: IssueKind;
  /**
   * Mức nghiêm trọng, càng lớn càng nặng. Tra từ `SEVERITY`, không tự đặt tại chỗ gọi.
   *
   * Lý do tồn tại: vòng lặp sửa từng chỉ so SỐ LƯỢNG lỗi, nên một bản sửa đánh đổi ba lỗi định
   * dạng giờ lấy một lỗi "địa danh không tồn tại" được coi là tiến bộ. Nó không phải tiến bộ —
   * một mốc giờ viết sai định dạng làm giao diện xấu, còn một địa danh không có thật thì gửi
   * khách tới một nơi không tồn tại.
   */
  severity: number;
  /** Ngày gây lỗi, 1-based. Bỏ trống với lỗi ở mức cả lịch trình. */
  day?: number;
  message: string;
}

/**
 * Thang nghiêm trọng, theo đúng thứ tự ưu tiên khi sửa.
 *
 * Đọc từ trên xuống: gửi khách tới một nơi không có thật là nặng nhất; bắt khách dịch chuyển tức
 * thời giữa hai thị trấn là nặng thứ hai; xếp chỗ nghỉ sai vùng khiến khách đi thêm hàng chục
 * cây số trong đêm; về tới nơi sau khi trời tối vi phạm một quy tắc cứng của chính kho tri thức;
 * tốc độ và quãng đường vô lý làm cả ngày không đi được; còn lại là những thứ sửa được bằng mắt.
 */
const SEVERITY: Record<string, number> = {
  UNKNOWN_PLACE: 100,
  STAY_NOT_IN_CATALOGUE: 95,
  DAY_COUNT: 90,
  DAY_NOT_CONTINUOUS: 85,
  STAY_AREA_MISMATCH: 70,
  LAST_DAY_HAS_STAY: 65,
  TIME_TOO_LATE: 60,
  SPEED_IMPLAUSIBLE: 50,
  RIDING_TOO_LONG: 48,
  DISTANCE_TOO_LONG: 46,
  DISTANCE_OFF_REFERENCE: 40,
  TIME_NOT_INCREASING: 35,
  TIME_TOO_EARLY: 30,
  FIELD_MISSING: 25,
  DUPLICATE_WAYPOINT: 20,
  WAYPOINT_COUNT: 15,
  TOTAL_KM_MISMATCH: 12,
  DAY_NUMBERING: 10,
  TIME_FORMAT: 8,
};

/** Mã chưa có trong thang thì coi là lỗi nhỏ, nhưng không được im lặng bằng 0. */
const DEFAULT_SEVERITY = 5;

export function severityOf(code: string): number {
  return SEVERITY[code] ?? DEFAULT_SEVERITY;
}

/**
 * So hai bộ lỗi để biết bản sửa có THỰC SỰ tốt hơn không.
 *
 * So theo thứ tự từ điển trên ba khoá, và thứ tự ấy là cả nội dung của phép so:
 *
 *  1. Lỗi NẶNG NHẤT còn lại. Một bản còn một lỗi "địa danh không tồn tại" luôn tệ hơn một bản
 *     còn năm lỗi định dạng giờ, bất kể đếm ra sao.
 *  2. Tổng trọng số. Bắt được trường hợp hai bản có cùng mức nặng nhất nhưng một bên nhiều lỗi
 *     nặng hơn.
 *  3. Số lượng. Chỉ dùng để phân định khi hai khoá trên hoà.
 *
 * Trả về số âm khi `left` tốt hơn `right`.
 */
export function compareIssueSets(left: ItineraryIssue[], right: ItineraryIssue[]): number {
  const worst = (issues: ItineraryIssue[]): number =>
    issues.reduce((max, issue) => Math.max(max, issue.severity), 0);
  const weight = (issues: ItineraryIssue[]): number =>
    issues.reduce((sum, issue) => sum + issue.severity, 0);

  return worst(left) - worst(right) || weight(left) - weight(right) || left.length - right.length;
}

export interface GeneratedWaypoint {
  id?: string;
  day?: number;
  time: string;
  title: string;
  subtitle: string;
  /**
   * `null` nghĩa là MODEL KHÔNG KHAI, khác hẳn với 0.
   *
   * Bản trước thay mọi trường số thiếu bằng 0. Hậu quả không nằm ở chỗ con số 0 xấu, mà ở chỗ nó
   * IM LẶNG: một ngày thiếu quãng đường trông y hệt một ngày 0 km, phép kiểm tốc độ bỏ qua vì
   * mẫu số bằng 0, và lịch trình đi ra ngoài với một trường rỗng không ai biết.
   */
  distanceKm: number | null;
  elevationM: number | null;
  type: string;
  highlight: string;
  aiTip: string;
}

export interface GeneratedStay {
  name: string;
  type: string;
  vibe: string;
  priceEstimate: string;
}

export interface GeneratedDay {
  day: number;
  title: string;
  theme: string;
  startPoint: string;
  endPoint: string;
  /** `null` nghĩa là model không khai. Xem chú thích ở `GeneratedWaypoint.distanceKm`. */
  totalDistanceKm: number | null;
  ridingHours: number | null;
  maxElevationM: number | null;
  scenicRating: number | null;
  weatherAlert?: string;
  eveningStay: GeneratedStay;
  waypoints: GeneratedWaypoint[];
  /** Tên những trường bắt buộc mà model bỏ trống, để `checkItinerary` gọi đúng tên chúng ra. */
  missingFields: string[];
}

export interface GeneratedItinerary {
  title: string;
  overview: string;
  totalKm: number | null;
  dailyTips: string[];
  days: GeneratedDay[];
  missingFields: string[];
}

/**
 * NGƯỠNG HỢP LÝ CHO ĐƯỜNG ĐÈO HÀ GIANG.
 *
 * Không phải luật giao thông mà là biên của cái có thể làm được trên địa hình này, đặt rộng có
 * chủ ý: việc của bộ kiểm tra là bắt những con số vô lý (200 km trong 2 giờ, về tới nơi lúc 22
 * giờ), không phải áp một phong cách đi đường lên lịch trình.
 *
 * Trần 19 giờ đến từ một quy tắc cứng trong chính kho tri thức: không chạy đèo sau khi trời tối,
 * vì đèn xe chiếu thẳng trong khi đường cong liên tục nên trước mỗi khúc cua ánh đèn chiếu ra
 * khoảng không của vực. Một lịch trình xếp khách về tới nơi lúc 20 giờ là lịch trình không đi
 * được, dù mọi con số khác đều đẹp.
 */
export const LIMITS = {
  minSpeedKmh: 12,
  maxSpeedKmh: 45,
  maxRidingHours: 9,
  maxDistanceKmPerDay: 220,
  earliestStart: 5 * 60,
  latestArrival: 19 * 60,
  minWaypoints: 3,
  maxWaypoints: 8,
  /** Lệch quá mức này so với chặng khung thì quãng đường của ngày đó đáng ngờ. */
  distanceTolerance: 0.35,
  /** `totalKm` phải khớp tổng các ngày trong biên này. */
  totalTolerance: 0.1,
} as const;

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWaypoint(value: unknown): GeneratedWaypoint | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!text(row.time) || !text(row.title)) return null;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    day: finite(row.day) ? row.day : undefined,
    time: row.time,
    title: row.title,
    subtitle: text(row.subtitle) ? row.subtitle : "",
    distanceKm: finite(row.distanceKm) ? row.distanceKm : null,
    elevationM: finite(row.elevationM) ? row.elevationM : null,
    type: text(row.type) ? row.type : "ride",
    highlight: text(row.highlight) ? row.highlight : "",
    aiTip: text(row.aiTip) ? row.aiTip : "",
  };
}

/**
 * Đọc đầu ra của model thành một kiểu có thật, thay cho `any`.
 *
 * Trả `null` chứ không ném: nơi gọi cần phân biệt "model trả về thứ không đọc được" với "đọc được
 * nhưng nội dung chưa khả thi", và hai tình huống đó dẫn tới hai hành động khác nhau — một cái
 * phải sinh lại từ đầu, một cái đưa danh sách lỗi cho model sửa.
 */
export function parseItinerary(value: unknown): GeneratedItinerary | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  if (!Array.isArray(root.days) || root.days.length === 0) return null;

  const days: GeneratedDay[] = [];
  for (const raw of root.days) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    if (!finite(row.day) || !text(row.startPoint) || !text(row.endPoint)) return null;
    const stay = (row.eveningStay ?? {}) as Record<string, unknown>;
    const waypoints = Array.isArray(row.waypoints)
      ? row.waypoints.map(parseWaypoint).filter((wp): wp is GeneratedWaypoint => wp !== null)
      : [];

    /**
     * Ghi TÊN trường bị bỏ trống thay vì lấp bằng 0.
     *
     * Danh sách này là thứ duy nhất phân biệt được "model không khai quãng đường" với "model khai
     * 0 km". Hai chuyện đó dẫn tới hai hành động khác nhau: cái đầu bảo model điền vào, cái sau
     * là một con số sai cần sửa. Gộp chúng lại thì cả hai đều lặng lẽ đi tiếp.
     */
    const missing = ([
      ["totalDistanceKm", row.totalDistanceKm],
      ["ridingHours", row.ridingHours],
      ["maxElevationM", row.maxElevationM],
      ["scenicRating", row.scenicRating],
    ] as const)
      .filter(([, value]) => !finite(value))
      .map(([name]) => name as string);

    for (const [index, waypoint] of waypoints.entries()) {
      if (waypoint.distanceKm === null) missing.push(`waypoints[${index}].distanceKm`);
      if (waypoint.elevationM === null) missing.push(`waypoints[${index}].elevationM`);
    }

    days.push({
      day: row.day,
      title: text(row.title) ? row.title : "",
      theme: text(row.theme) ? row.theme : "",
      startPoint: row.startPoint,
      endPoint: row.endPoint,
      totalDistanceKm: finite(row.totalDistanceKm) ? row.totalDistanceKm : null,
      ridingHours: finite(row.ridingHours) ? row.ridingHours : null,
      maxElevationM: finite(row.maxElevationM) ? row.maxElevationM : null,
      scenicRating: finite(row.scenicRating) ? row.scenicRating : null,
      weatherAlert: text(row.weatherAlert) ? row.weatherAlert : undefined,
      eveningStay: {
        name: text(stay.name) ? (stay.name as string) : "",
        type: text(stay.type) ? (stay.type as string) : "",
        vibe: text(stay.vibe) ? (stay.vibe as string) : "",
        priceEstimate: text(stay.priceEstimate) ? (stay.priceEstimate as string) : "",
      },
      waypoints,
      missingFields: missing,
    });
  }

  return {
    title: text(root.title) ? root.title : "Lịch trình Hà Giang",
    overview: text(root.overview) ? root.overview : "",
    totalKm: finite(root.totalKm) ? root.totalKm : null,
    dailyTips: Array.isArray(root.dailyTips) ? root.dailyTips.filter(text) : [],
    days,
    missingFields: finite(root.totalKm) ? [] : ["totalKm"],
  };
}

/** `HH:mm` -> số phút từ nửa đêm. `null` khi không đọc được. */
export function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Danh mục địa danh ở dạng đã chuẩn hoá, dựng một lần. */
const PLACE_NEEDLES = PLACES.flatMap((place) =>
  [place.name, ...place.aliases].map(normalizePlaceName).filter(Boolean),
);

/**
 * Tên này có nằm trong danh mục không.
 *
 * So theo cụm chứa nhau chứ không so bằng, cùng lý do với bộ phân giải địa danh: model viết
 * "Thị trấn Đồng Văn" hay "Phố cổ Đồng Văn, Hà Giang" chứ hiếm khi viết đúng tên gọn trong danh
 * mục. Cụm phải đủ dài mới cho khớp lỏng, nếu không thì một chữ ngắn khớp với mọi thứ.
 */
export function isKnownPlace(raw: string): boolean {
  const needle = normalizePlaceName(raw);
  if (!needle) return false;
  return PLACE_NEEDLES.some(
    (alias) => alias === needle || (alias.length >= 5 && (needle.includes(alias) || alias.includes(needle))),
  );
}

function sameArea(left: string, right: string): boolean {
  const a = normalizePlaceName(left);
  const b = normalizePlaceName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Slug của địa danh khớp tên, để tra chặng khung. */
function slugFor(raw: string): string | null {
  const needle = normalizePlaceName(raw);
  if (!needle) return null;
  let best: { slug: string; length: number } | null = null;
  for (const place of PLACES) {
    for (const alias of [place.name, ...place.aliases].map(normalizePlaceName)) {
      if (!alias) continue;
      if (alias !== needle && !needle.includes(alias)) continue;
      if (!best || alias.length > best.length) best = { slug: place.slug, length: alias.length };
    }
  }
  return best?.slug ?? null;
}

export interface RouteCheck {
  day: number;
  from: string;
  to: string;
  /** Quãng đường model đưa ra; `null` khi model không khai. */
  claimedKm: number | null;
  /** Số tham chiếu của chặng khung, `null` khi không có chặng nào khớp. */
  referenceKm: number | null;
  /**
   * `false` nghĩa là KHÔNG CÓ dữ liệu để đối chiếu, không phải là sai.
   *
   * Phân biệt này là bắt buộc: một lịch trình đi qua chặng chưa khai trong bảng khung vẫn có thể
   * đúng, nhưng khách phải biết con số km ở đó chưa được kiểm chứng bởi bất cứ thứ gì ngoài model.
   */
  verified: boolean;
}

/** Đồ thị vô hướng dựng từ các chặng khung: slug -> (slug kề -> km). Bản xe máy và ô tô cùng số km. */
const SEGMENT_GRAPH = new Map<string, Map<string, number>>();
for (const row of ROUTE_SEGMENTS) {
  for (const [a, b] of [[row.fromSlug, row.toSlug], [row.toSlug, row.fromSlug]]) {
    const edges = SEGMENT_GRAPH.get(a) ?? new Map<string, number>();
    edges.set(b, Math.min(edges.get(b) ?? Infinity, row.referenceDistanceKm));
    SEGMENT_GRAPH.set(a, edges);
  }
}

/** Model viết "Lũng Cú" (tên xã) nhưng chặng khung neo vào cột cờ, xem route-segments.ts. */
const NODE_ALIASES: Record<string, string> = { "lung-cu": "cot-co-lung-cu" };

function graphNode(raw: string): string | null {
  const slug = slugFor(raw);
  if (!slug) return null;
  const node = NODE_ALIASES[slug] ?? slug;
  return SEGMENT_GRAPH.has(node) ? node : null;
}

/** Đường ngắn nhất giữa hai nút theo bảng chặng khung (Dijkstra trên đồ thị vài chục cạnh). */
function shortestPath(from: string, to: string): { km: number; nodes: string[] } | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  while (true) {
    let current: string | null = null;
    for (const [node, km] of dist) {
      if (!done.has(node) && (current === null || km < (dist.get(current) as number))) current = node;
    }
    if (current === null) return null;
    if (current === to) {
      const nodes = [to];
      while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0]) as string);
      return { km: dist.get(to) as number, nodes };
    }
    done.add(current);
    for (const [next, km] of SEGMENT_GRAPH.get(current) ?? []) {
      const candidate = (dist.get(current) as number) + km;
      if (candidate < (dist.get(next) ?? Infinity)) {
        dist.set(next, candidate);
        prev.set(next, current);
      }
    }
  }
}

/**
 * Số tham chiếu cho CẢ MỘT NGÀY: đi từ điểm xuất phát, qua lần lượt những điểm dừng có trong bảng
 * chặng khung, tới điểm kết thúc, mỗi bước theo quãng ngắn nhất.
 *
 * Bản trước chỉ tra đúng một chặng khung nối thẳng điểm đầu với điểm cuối, nên một ngày
 * "Hà Giang → Đồng Văn" (ba chặng nối nhau) không bao giờ đối chiếu được, và lỗi quãng đường chỉ bị
 * bắt khi nó tình cờ rơi vào một chặng đơn. Đi qua điểm dừng là để tính cả đoạn rẽ nhánh — ngày có
 * lên cột cờ Lũng Cú rồi quay lại Đồng Văn thì dài hơn hẳn quãng Đồng Văn → Mèo Vạc.
 */
function referenceKmFor(day: GeneratedDay): number | null {
  const start = graphNode(day.startPoint);
  const end = graphNode(day.endPoint);
  if (!start || !end) return null;

  const stops = [start, ...day.waypoints.map((wp) => graphNode(wp.title)).filter((n): n is string => n !== null), end]
    .filter((node, index, list) => index === 0 || node !== list[index - 1]);
  if (stops.length === 1) return null;

  let total = 0;
  const walked: string[] = [start];
  for (let index = 1; index < stops.length; index += 1) {
    const path = shortestPath(stops[index - 1], stops[index]);
    if (!path) return null;
    total += path.km;
    walked.push(...path.nodes.slice(1));
  }
  /**
   * Đường đi qua ĐIỂM KẾT THÚC trước khi tới đích là bảng chặng thiếu cạnh, không phải lộ trình.
   *
   * Đo ngày 2026-09-25: ngày "Du Già → Hà Giang" dừng ở Quản Bạ, bảng không có đoạn Du Già – Yên
   * Minh, nên đường ngắn nhất tới Quản Bạ đi qua Hà Giang rồi quay ngược lên — 162 km, và số 95 km
   * hợp lý của model bị thay bằng nó. Không dựng được lộ trình thật thì nói "chưa đối chiếu".
   * Rẽ vào một ĐƯỜNG CỤT rồi quay ra thì vẫn hợp lệ, kể cả khi lối rẽ nằm ở điểm kết thúc: Yên
   * Minh → Đồng Văn → cột cờ Lũng Cú → Đồng Văn. Nên gộp các đoạn "X → đường cụt → X" trước khi xét.
   */
  const collapsed: string[] = [];
  for (const node of walked) {
    const n = collapsed.length;
    if (n >= 2 && collapsed[n - 2] === node && SEGMENT_GRAPH.get(collapsed[n - 1])?.size === 1) collapsed.pop();
    else collapsed.push(node);
  }
  if (collapsed.slice(1, -1).includes(end)) return null;
  return total;
}

/**
 * Đối chiếu quãng đường từng ngày với bảng chặng khung.
 *
 * `referenceDistanceKm` trong @data/realtime/route-segments là ước lượng của người biên tập, dùng
 * để ĐỐI CHIẾU, đủ để bắt "Đồng Văn đi Mèo Vạc 150 km". Riêng khi model đã được sửa mà vẫn lệch,
 * `correctRouteDistances` dùng nó thay số của model — một ước lượng có người biên tập chịu trách
 * nhiệm vẫn tốt hơn một con số đã bị chứng minh là sai.
 */
export function checkRoutes(days: GeneratedDay[]): RouteCheck[] {
  return days.map((day) => {
    const referenceKm = referenceKmFor(day);
    return {
      day: day.day,
      from: day.startPoint,
      to: day.endPoint,
      claimedKm: day.totalDistanceKm,
      referenceKm,
      verified: referenceKm !== null,
    };
  });
}

function isOffReference(check: RouteCheck): boolean {
  if (check.referenceKm === null || check.claimedKm === null || check.claimedKm <= 0) return false;
  return Math.abs(check.claimedKm - check.referenceKm) / check.referenceKm > LIMITS.distanceTolerance;
}

/**
 * Thay quãng đường lệch bảng chặng khung bằng số tham chiếu. Sửa TẠI CHỖ, trả về các ngày đã sửa.
 *
 * Chỉ gọi SAU vòng lặp sửa bằng model: model được cơ hội tự sửa trước. Km cộng dồn của từng điểm
 * dừng được co giãn cùng tỉ lệ, nếu không thì mốc cuối ngày vẫn ghi con số cũ và hai chỗ trên cùng
 * một màn hình nói hai điều khác nhau. `totalKm` được cộng lại từ các ngày.
 */
export function correctRouteDistances(plan: GeneratedItinerary): RouteCheck[] {
  const corrected: RouteCheck[] = [];
  for (const check of checkRoutes(plan.days)) {
    if (!isOffReference(check)) continue;
    const day = plan.days.find((row) => row.day === check.day);
    if (!day) continue;
    const ratio = (check.referenceKm as number) / (check.claimedKm as number);
    day.totalDistanceKm = check.referenceKm;
    for (const wp of day.waypoints) {
      if (wp.distanceKm !== null) wp.distanceKm = Math.round(wp.distanceKm * ratio);
    }
    corrected.push(check);
  }
  // Cộng lại cả khi không sửa ngày nào: `TOTAL_KM_MISMATCH` cũng không khởi động lượt sửa model.
  if (plan.days.every((day) => day.totalDistanceKm !== null)) {
    plan.totalKm = plan.days.reduce((sum, day) => sum + (day.totalDistanceKm as number), 0);
  }
  return corrected;
}

export interface CheckInput {
  /** Số ngày khách yêu cầu. Đây là ràng buộc cứng, không phải gợi ý. */
  days: number;
}

export function checkItinerary(plan: GeneratedItinerary, input: CheckInput): ItineraryIssue[] {
  const issues: ItineraryIssue[] = [];
  const add = (code: string, message: string, day?: number, kind: IssueKind = "semantic"): void => {
    const issue: ItineraryIssue = { code, kind, severity: severityOf(code), message };
    issues.push(day === undefined ? issue : { ...issue, day });
  };

  // ------------------------------------------------------- trường bị bỏ trống
  /**
   * Lỗi LƯỢC ĐỒ được báo trước mọi thứ khác, vì nó giải thích những phép kiểm bị bỏ qua bên dưới.
   *
   * Một ngày thiếu `ridingHours` sẽ không có lỗi tốc độ — không phải vì tốc độ hợp lý mà vì không
   * có gì để tính. Không nói ra điều đó thì danh sách lỗi trông như đã kiểm hết.
   */
  for (const name of plan.missingFields) {
    add("FIELD_MISSING", `Thiếu trường bắt buộc "${name}" ở mức cả lịch trình.`, undefined, "schema");
  }
  for (const day of plan.days) {
    for (const name of day.missingFields) {
      add("FIELD_MISSING", `Thiếu trường bắt buộc "${name}".`, day.day, "schema");
    }
  }

  // ---------------------------------------------------------------- số ngày
  if (plan.days.length !== input.days) {
    add("DAY_COUNT", `Khách yêu cầu ${input.days} ngày nhưng lịch trình có ${plan.days.length} ngày.`);
  }
  plan.days.forEach((day, index) => {
    if (day.day !== index + 1) {
      add("DAY_NUMBERING", `Trường "day" phải đánh số liên tục từ 1; phần tử thứ ${index + 1} đang ghi ${day.day}.`, index + 1);
    }
  });

  // -------------------------------------------------------------- địa danh
  for (const day of plan.days) {
    for (const [label, value] of [["startPoint", day.startPoint], ["endPoint", day.endPoint]] as const) {
      if (!isKnownPlace(value)) {
        add("UNKNOWN_PLACE", `"${value}" (${label}) không có trong danh mục địa danh.`, day.day);
      }
    }

    const titles = day.waypoints.map((wp) => normalizePlaceName(wp.title));
    const duplicated = titles.filter((title, index) => title && titles.indexOf(title) !== index);
    if (duplicated.length) {
      add("DUPLICATE_WAYPOINT", `Ngày này lặp lại cùng một điểm dừng: ${[...new Set(duplicated)].join(", ")}.`, day.day);
    }
  }

  /**
   * Ngày sau phải bắt đầu ở nơi ngày trước kết thúc.
   *
   * Đây là phép kiểm bắt được nhiều lỗi nhất và cũng là lỗi tai hại nhất: một lịch trình đứt quãng
   * ngầm giả định khách dịch chuyển tức thời giữa hai thị trấn cách nhau vài chục cây số đường đèo.
   */
  for (let index = 1; index < plan.days.length; index += 1) {
    const previous = plan.days[index - 1];
    const current = plan.days[index];
    if (!sameArea(previous.endPoint, current.startPoint)) {
      add(
        "DAY_NOT_CONTINUOUS",
        `Ngày ${previous.day} kết thúc ở "${previous.endPoint}" nhưng ngày ${current.day} lại xuất phát từ "${current.startPoint}".`,
        current.day,
      );
    }
  }

  // ------------------------------------------------ thời gian và tốc độ
  for (const day of plan.days) {
    if (day.waypoints.length < LIMITS.minWaypoints || day.waypoints.length > LIMITS.maxWaypoints) {
      add("WAYPOINT_COUNT", `Ngày này có ${day.waypoints.length} điểm dừng, cần ${LIMITS.minWaypoints}–${LIMITS.maxWaypoints}.`, day.day);
    }

    const minutes = day.waypoints.map((wp) => minutesOfDay(wp.time));
    if (minutes.some((value) => value === null)) {
      add("TIME_FORMAT", `Có mốc giờ không đúng định dạng HH:mm.`, day.day);
    } else {
      const values = minutes as number[];
      for (let index = 1; index < values.length; index += 1) {
        if (values[index] <= values[index - 1]) {
          add("TIME_NOT_INCREASING", `Mốc giờ phải tăng dần trong ngày: ${day.waypoints[index - 1].time} rồi tới ${day.waypoints[index].time}.`, day.day);
          break;
        }
      }
      if (values.length) {
        if (values[0] < LIMITS.earliestStart) {
          add("TIME_TOO_EARLY", `Ngày bắt đầu lúc ${day.waypoints[0].time}, quá sớm để lên đường.`, day.day);
        }
        const last = values[values.length - 1];
        if (last > LIMITS.latestArrival) {
          add(
            "TIME_TOO_LATE",
            `Mốc cuối lúc ${day.waypoints[values.length - 1].time}: lịch trình xếp khách còn trên đường sau khi trời tối, điều mà cẩm nang coi là quy tắc cứng không được vi phạm.`,
            day.day,
          );
        }
      }
    }

    /**
     * Ba phép kiểm dưới đây CHỈ chạy khi có số để mà kiểm.
     *
     * `null` ở đây đã được báo bằng `FIELD_MISSING` phía trên. Nếu vẫn chạy tiếp và coi `null`
     * như 0 thì mỗi trường thiếu sẽ đẻ thêm một lỗi ngữ nghĩa giả — và model sẽ được yêu cầu
     * "sửa quãng đường 0 km" thay vì "điền quãng đường".
     */
    if (day.ridingHours !== null && day.ridingHours > LIMITS.maxRidingHours) {
      add("RIDING_TOO_LONG", `${day.ridingHours} giờ lái trong một ngày là quá sức trên đường đèo (trần ${LIMITS.maxRidingHours} giờ).`, day.day);
    }
    if (day.totalDistanceKm !== null && day.totalDistanceKm > LIMITS.maxDistanceKmPerDay) {
      add("DISTANCE_TOO_LONG", `${day.totalDistanceKm} km trong một ngày vượt trần ${LIMITS.maxDistanceKmPerDay} km.`, day.day);
    }
    if (day.ridingHours !== null && day.totalDistanceKm !== null && day.ridingHours > 0 && day.totalDistanceKm > 0) {
      const speed = day.totalDistanceKm / day.ridingHours;
      if (speed < LIMITS.minSpeedKmh || speed > LIMITS.maxSpeedKmh) {
        add(
          "SPEED_IMPLAUSIBLE",
          `${day.totalDistanceKm} km trong ${day.ridingHours} giờ tương đương ${speed.toFixed(0)} km/h, ngoài khoảng hợp lý ${LIMITS.minSpeedKmh}–${LIMITS.maxSpeedKmh} km/h của đường đèo.`,
          day.day,
        );
      }
    }
  }

  // ----------------------------------------------------------- chỗ nghỉ
  const catalogue = new Set(LODGING_OPTIONS.map((option) => normalizePlaceName(option.name)));
  plan.days.forEach((day, index) => {
    const isLast = index === plan.days.length - 1;
    const name = day.eveningStay.name;

    if (isLast) {
      // Lịch trình N ngày chỉ có N−1 đêm: ngày cuối kết thúc hành trình.
      if (catalogue.has(normalizePlaceName(name))) {
        add("LAST_DAY_HAS_STAY", `Ngày cuối không được có đêm nghỉ; lịch trình ${plan.days.length} ngày chỉ có ${plan.days.length - 1} đêm.`, day.day);
      }
      return;
    }

    if (!catalogue.has(normalizePlaceName(name))) {
      add("STAY_NOT_IN_CATALOGUE", `Chỗ nghỉ "${name}" không có trong danh mục lưu trú.`, day.day);
      return;
    }

    const option = LODGING_OPTIONS.find((row) => normalizePlaceName(row.name) === normalizePlaceName(name));
    if (option && !sameArea(day.endPoint, option.areaName)) {
      add(
        "STAY_AREA_MISMATCH",
        `Ngày kết thúc ở "${day.endPoint}" nhưng chỗ nghỉ "${option.name}" nằm ở ${option.areaName}.`,
        day.day,
      );
    }
  });

  // -------------------------------------------------------- quãng đường
  // Chỉ cộng những ngày CÓ số. Một ngày thiếu quãng đường đã có `FIELD_MISSING`; cộng nó như 0
  // sẽ đẻ thêm một lỗi `TOTAL_KM_MISMATCH` giả và đẩy model đi sửa nhầm chỗ.
  const measured = plan.days.filter((day) => day.totalDistanceKm !== null);
  const sum = measured.reduce((total, day) => total + (day.totalDistanceKm as number), 0);
  if (plan.totalKm !== null && measured.length === plan.days.length && sum > 0
      && Math.abs(plan.totalKm - sum) > sum * LIMITS.totalTolerance) {
    add("TOTAL_KM_MISMATCH", `"totalKm" ghi ${plan.totalKm} km nhưng tổng các ngày là ${sum} km.`);
  }

  for (const check of checkRoutes(plan.days)) {
    if (!isOffReference(check)) continue;
    const delta = Math.abs((check.claimedKm as number) - (check.referenceKm as number)) / (check.referenceKm as number);
    add(
      "DISTANCE_OFF_REFERENCE",
      `Chặng ${check.from} → ${check.to} ghi ${check.claimedKm} km, lệch ${(delta * 100).toFixed(0)}% so với ${check.referenceKm} km theo bảng chặng khung (tính qua các điểm dừng của ngày).`,
      check.day,
    );
  }

  return issues;
}

/**
 * Danh sách lỗi -> khối văn bản đưa lại cho model sửa, XẾP THEO MỨC NGHIÊM TRỌNG.
 *
 * Thứ tự không phải để trình bày cho đẹp. Model đọc danh sách từ trên xuống và dồn sức vào những
 * mục đầu; đưa cho nó một danh sách mở đầu bằng "mốc giờ sai định dạng" là tự tay đẩy lỗi "địa
 * danh không tồn tại" xuống cuối trang.
 *
 * Lỗi loại `unverified` bị LOẠI khỏi khối này. Đó không phải lỗi của model — đó là chỗ ta không
 * có dữ liệu để đối chiếu, và bảo model sửa chỉ khiến nó đổi sang một con số khác cũng không kiểm
 * được, trong khi làm loãng danh sách những thứ nó thật sự sửa được.
 */
export function describeIssues(issues: ItineraryIssue[]): string {
  return [...issues]
    .filter((issue) => issue.kind !== "unverified")
    .sort((left, right) => right.severity - left.severity || (left.day ?? 0) - (right.day ?? 0))
    .map((issue) => `- ${issue.day ? `Ngày ${issue.day}: ` : ""}${issue.message}`)
    .join("\n");
}
