import { LODGING_PLACES } from "@data/places/lodging";
import { findPlace } from "@data/places/index";
import type { Place } from "@data/places/types";
import { describeFreshness, priceDatum } from "@server/domain/freshness";

/**
 * RÀNG CHỖ NGHỈ TRONG LỊCH TRÌNH VÀO DANH MỤC THẬT.
 *
 * VÌ SAO MODULE NÀY TỒN TẠI. Tác tử lịch trình gọi thẳng model và không đọc danh mục lưu trú lấy
 * một lần, nên nó BỊA tên cơ sở: quan sát được "Yên Minh Homestay", "Khách sạn Cao Nguyên Mèo
 * Vạc", "Homestay A Páo" — không cái nào có trong mười hai cơ sở đã seed. Kèm theo là giá cũng
 * bịa nốt. Đây là hỏng hóc nặng hơn một lỗi hiển thị: khách có thể lên đường đi tìm một homestay
 * không tồn tại, và con số giá đi vòng qua đúng cơ chế `PriceEstimate` mà cả tầng data dựng lên
 * để ngăn chuyện này.
 *
 * HAI LỚP, VÀ LỚP THỨ HAI MỚI LÀ LỚP BẢO ĐẢM. Lớp một là đưa danh mục vào lời nhắc để model chọn
 * đúng. Lớp hai là kiểm lại sau khi sinh và thay thế những gì không khớp. Chỉ có lớp một là không
 * đủ, và điều đó đã đo được trên chính dự án này: điểm cuối đang dùng không thực thi cả
 * `responseSchema`, nên trông chờ nó tuân thủ một câu tiếng Việt trong prompt là trông chờ vào
 * thứ yếu hơn hẳn. Lời nhắc HƯỚNG DẪN, phép kiểm mới RÀNG BUỘC.
 *
 * GIÁ LUÔN LẤY TỪ DANH MỤC, không bao giờ giữ giá model đưa ra — kể cả khi tên khớp. Giá trong
 * danh mục có `surveyedAt` và `sourceUrls`, truy được nguồn; giá của model thì không có gì cả.
 */

export interface LodgingOption {
  slug: string;
  name: string;
  /** Tên vùng hoặc xã chứa cơ sở, để ghép với điểm kết thúc của mỗi ngày. */
  areaName: string;
  kind: Place["kind"];
  priceLabel: string;
  /**
   * Giá đã quá hạn hiệu lực chưa, và nhãn thời điểm đi kèm.
   *
   * Cần hai trường này vì cùng một chuỗi giá chịu được hai mức khẳng định khác nhau: giá vừa khảo
   * sát nói được là giá hiện hành, giá khảo sát nửa năm trước thì không. Không tách ra thì lời
   * nhắc chỉ có một cách nói cho cả hai, và nó sẽ là cách nói mạnh hơn.
   */
  priceStale: boolean;
  priceAsOf: string;
}

/** "250.000đ – 800.000đ/đêm". Khoảng bằng nhau thì in một số cho gọn. */
function priceLabel(place: Place): string {
  const price = place.price;
  if (!price) return "chưa có giá tham khảo";

  /**
   * Làm tròn tới nghìn đồng trước khi in.
   *
   * Giá iVIVU là giá một lần tìm kiếm đã gồm thuế phí, nên ra những con số như 383.548đ. In
   * nguyên tới hàng đơn vị là hứa với khách một độ chính xác mà một "giá tham khảo" không có:
   * đến ngày khách đặt thì con số đã khác. Làm tròn nói đúng mức tin cậy đang có.
   */
  const fmt = (v: number) => `${(Math.round(v / 1000) * 1000).toLocaleString("vi-VN")}đ`;
  const range = price.minVnd === price.maxVnd ? fmt(price.minVnd) : `${fmt(price.minVnd)} – ${fmt(price.maxVnd)}`;
  return `${range}/đêm`;
}

/**
 * Hạn hiệu lực của giá, suy từ `surveyedAt`.
 *
 * Dựng MỘT LẦN lúc nạp module, nên `now` ở đây là thời điểm tiến trình khởi động chứ không phải
 * thời điểm của lượt hỏi. Sai lệch tối đa bằng thời gian tiến trình sống, và với một hạn 180 ngày
 * thì nó không đáng kể — trong khi tính lại cho từng lượt sẽ bắt mọi lượt hỏi trả giá cho một
 * phép so ngày mà kết quả gần như không bao giờ đổi.
 */
function freshnessOf(place: Place): { stale: boolean; asOf: string } {
  const price = place.price;
  if (!price) return { stale: false, asOf: "" };
  const datum = priceDatum(price.surveyedAt, price.sourceUrls[0] ?? "khảo sát nội bộ", "estimated");
  const freshness = describeFreshness(datum);
  return { stale: freshness.stale, asOf: freshness.stale ? `khảo sát ${price.surveyedAt}, ĐÃ QUÁ HẠN` : `khảo sát ${price.surveyedAt}` };
}

export const LODGING_OPTIONS: LodgingOption[] = LODGING_PLACES.map((place) => {
  const freshness = freshnessOf(place);
  return {
    slug: place.slug,
    name: place.name,
    areaName: (place.parentSlug ? findPlace(place.parentSlug)?.name : undefined) ?? "Hà Giang",
    kind: place.kind,
    priceLabel: priceLabel(place),
    priceStale: freshness.stale,
    priceAsOf: freshness.asOf,
  };
});

/** Bỏ dấu, thường hoá, gộp khoảng trắng — để so tên không phụ thuộc cách gõ. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Khối văn bản chèn vào lời nhắc.
 *
 * Liệt kê kèm VÙNG và GIÁ chứ không chỉ tên: model cần biết cơ sở nằm ở đâu để chọn đúng theo
 * chặng, và biết giá để không tự nghĩ ra một con số khác.
 */
export function buildLodgingBlock(): string {
  const byArea = new Map<string, LodgingOption[]>();
  for (const option of LODGING_OPTIONS) {
    const list = byArea.get(option.areaName) ?? [];
    list.push(option);
    byArea.set(option.areaName, list);
  }

  const lines = [...byArea.entries()].map(
    ([area, list]) =>
      `- ${area}: ` + list.map((o) => `"${o.name}" (${o.priceLabel})`).join("; "),
  );

  return `

DANH MỤC CƠ SỞ LƯU TRÚ ĐƯỢC PHÉP DÙNG — đây là danh sách ĐÓNG:
${lines.join("\n")}

Quy tắc bắt buộc về "eveningStay":
- Trường "name" phải TRÙNG KHỚP TỪNG CHỮ với một tên trong danh mục trên. Tuyệt đối không tự nghĩ
  ra tên cơ sở khác, kể cả khi bạn biết một nơi có thật ngoài danh sách này.
- Chọn cơ sở nằm ở đúng vùng mà ngày đó kết thúc.
- Ngày CUỐI CÙNG không có đêm nghỉ vì hành trình kết thúc: lịch trình N ngày chỉ có N-1 đêm.
- Không tự đặt giá. Giá sẽ được hệ thống điền từ danh mục.`;
}

/** Tìm cơ sở khớp tên model đưa ra. So theo cụm chứa nhau vì model hay thêm bớt chữ. */
function matchByName(raw: unknown): LodgingOption | null {
  if (typeof raw !== "string") return null;
  const needle = normalize(raw);
  if (!needle) return null;

  const exact = LODGING_OPTIONS.find((o) => normalize(o.name) === needle);
  if (exact) return exact;

  return (
    LODGING_OPTIONS.find((o) => {
      const name = normalize(o.name);
      // Cụm phải đủ dài mới cho khớp lỏng: "khach san" khớp với mọi khách sạn trong danh mục và
      // sẽ chọn bừa cái đầu tiên.
      return needle.length >= 8 && (name.includes(needle) || needle.includes(name));
    }) ?? null
  );
}

/** Tìm cơ sở theo vùng, dựa vào điểm kết thúc của ngày. */
function matchByArea(endPoint: unknown, used: Set<string>): LodgingOption | null {
  if (typeof endPoint !== "string") return null;
  const haystack = normalize(endPoint);
  if (!haystack) return null;

  const inArea = LODGING_OPTIONS.filter((o) => haystack.includes(normalize(o.areaName)));
  if (!inArea.length) return null;

  // Ưu tiên cơ sở chưa dùng, để lịch trình nhiều ngày không xếp khách ngủ cùng một chỗ hai đêm
  // liền khi vùng đó có nhiều lựa chọn.
  return inArea.find((o) => !used.has(o.slug)) ?? inArea[0];
}

export interface LodgingEnforcement {
  /** Số ngày mà tên model đưa ra không có trong danh mục và đã bị thay. */
  replaced: number;
  /** Số ngày không tìm được cơ sở nào phù hợp trong danh mục. */
  unresolved: number;
  /** Tên đã bị loại, để ghi log — đây chính là những cái tên model bịa ra. */
  rejectedNames: string[];
}

/**
 * Hình dạng tối thiểu mà hàm này cần, khai tại chỗ thay vì import từ itineraryCheck.
 *
 * Tránh vòng import: itineraryCheck đọc `LODGING_OPTIONS` của file này để kiểm chỗ nghỉ, nên file
 * này mà import ngược lại kiểu của nó thì hai module khoá tay nhau. Kiểu cấu trúc nói đủ điều cần
 * nói và không tạo phụ thuộc nào.
 */
interface LodgingDay {
  endPoint?: string;
  eveningStay?: { name?: string; type?: string; vibe?: string; priceEstimate?: string };
}

/**
 * Sửa `eveningStay` của mọi ngày trong kế hoạch cho khớp danh mục. Thay đổi TẠI CHỖ.
 *
 * Thứ tự thử: khớp theo tên model đưa ra, rồi khớp theo vùng kết thúc của ngày. Không tìm được
 * thì đánh dấu "chưa chốt" thay vì giữ tên bịa — nói với khách rằng chỗ nghỉ chưa xác định là
 * trung thực, còn giới thiệu một homestay không tồn tại thì không.
 */
export function enforceLodging(plan: { days?: LodgingDay[] }): LodgingEnforcement {
  const days: LodgingDay[] = Array.isArray(plan?.days) ? plan.days : [];
  const used = new Set<string>();
  const result: LodgingEnforcement = { replaced: 0, unresolved: 0, rejectedNames: [] };

  days.forEach((day, index) => {
    // Ngày cuối: hành trình kết thúc nên không có đêm nghỉ. Ghi thẳng vào DỮ LIỆU chứ không chỉ
    // xử lý lúc hiển thị, vì trình lập lịch trình ở giao diện cũng đọc trường này.
    if (index === days.length - 1) {
      day.eveningStay = {
        name: "Kết thúc hành trình",
        type: "Không nghỉ đêm",
        vibe: "Về tới điểm xuất phát",
        priceEstimate: "",
      };
      return;
    }

    const proposed = day?.eveningStay?.name;
    let option = matchByName(proposed);

    if (!option) {
      if (typeof proposed === "string" && proposed.trim()) result.rejectedNames.push(proposed.trim());
      option = matchByArea(day?.endPoint, used);
      if (option) result.replaced += 1;
    }

    if (!option) {
      result.unresolved += 1;
      day.eveningStay = {
        name: "Chưa chốt chỗ nghỉ",
        type: "Cần chọn thêm",
        vibe: "Hệ thống chưa có cơ sở lưu trú nào trong danh mục ở khu vực này",
        priceEstimate: "",
      };
      return;
    }

    used.add(option.slug);
    day.eveningStay = {
      name: option.name,
      type: KIND_LABELS[option.kind] ?? "Cơ sở lưu trú",
      vibe: `${option.areaName}`,
      // Giá LUÔN từ danh mục, kể cả khi tên model đưa ra đã khớp — xem ghi chú đầu file.
      priceEstimate: option.priceLabel,
    };
  });

  return result;
}

const KIND_LABELS: Partial<Record<Place["kind"], string>> = {
  homestay: "Homestay",
  guesthouse: "Nhà nghỉ / hostel",
  hotel: "Khách sạn",
};
