import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { loadAppConfig } from '@client/lib/appConfig';

/**
 * Bản đồ Google nhúng cho MỘT địa điểm.
 *
 * VÌ SAO NHÚNG BẰNG IFRAME CHỨ KHÔNG PHẢI MAPS JAVASCRIPT API. Ba lý do, theo thứ tự quan trọng:
 *
 *  1. CHI PHÍ. Maps JavaScript API tính tiền theo từng lượt tải bản đồ. Bản đồ này nằm trong
 *     modal chi tiết điểm đến — mỗi lần khách mở một điểm là một lượt tải, và một người xem
 *     mười điểm là mười lượt. Bản nhúng iframe ở các chế độ cơ bản không tính theo lượt tải như
 *     vậy, nên nó là lựa chọn đúng cho đúng kiểu dùng này.
 *  2. KHÔNG THÊM THƯ VIỆN. Chỉ là một thẻ iframe: không tải SDK, không phải chờ script, không
 *     đụng tới bundle. Trang chi tiết mở nhanh như cũ.
 *  3. BỀ MẶT NHỎ HƠN. Khoá dùng cho nó có thể bị giới hạn chỉ đúng Maps Embed API trong Cloud
 *     Console. Một khoá lộ ra trình duyệt mà chỉ gọi được đúng một API là rủi ro nhỏ hơn hẳn
 *     một khoá gọi được cả Routes lẫn Places.
 *
 * VÌ SAO KHÔNG THAY THẾ `HighlandsMap`. Hai bản đồ trả lời hai câu hỏi khác nhau và không thay
 * nhau được. `HighlandsMap` là SƠ ĐỒ HÀNH TRÌNH: nó bóp méo tỉ lệ có chủ ý để cả vòng cung đọc
 * được trong một khung hình và các mốc không chen nhau — thứ mà một bản đồ đúng tỉ lệ làm rất
 * tệ, vì Hoàng Su Phì kéo khung rộng hẳn sang tây và dồn phần còn lại vào một góc. Bản đồ ở đây
 * thì trả lời "chỗ này nằm chính xác ở đâu và đường tới trông thế nào".
 *
 * VỀ TOẠ ĐỘ. Luôn nhúng theo `lat,lng` chứ không theo TÊN địa điểm. Tra theo tên là giao cho
 * Google quyền quyết định địa điểm nào được hiển thị, và với những tên như "Cổng Trời" hay
 * "Núi Đôi" thì nó hoàn toàn có thể chọn một nơi trùng tên ở tỉnh khác — sai mà trông vẫn đúng.
 * Toạ độ trong @data/places là dữ liệu của dự án và đã qua bước soát toàn vẹn.
 */

interface PlaceMapProps {
  lat: number;
  lng: number;
  /** Tên hiển thị, dùng cho thuộc tính title của iframe. */
  name: string;
  /** Mức thu phóng. 14 vừa đủ thấy đường xung quanh; 11 cho địa danh trải rộng như một con đèo. */
  zoom?: number;
  /** Chiều cao khung. Mặc định vừa với modal chi tiết điểm đến. */
  heightClass?: string;
  /**
   * Toạ độ mới ở mức xấp xỉ hoặc mức vùng, chưa xác minh lối vào.
   *
   * Khi bật, khung vẫn là bản đồ thật nhưng BỎ liên kết chỉ đường và nói rõ đây là khu vực. Một
   * cặp số chưa ai kiểm mà kèm nút chỉ đường là mời khách rẽ theo nó — và ở vùng núi, rẽ sai
   * không phải chuyện đi thêm vài trăm mét. Toạ độ xấp xỉ trả lời "chỗ này nằm quanh đâu", không
   * trả lời "cổng vào ở đâu".
   */
  area?: boolean;
}

/** Liên kết mở Google Maps ở tab mới, để khách bấm chỉ đường. */
function externalMapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Maps Embed API — đường chính thức, dùng khi đã cấu hình GOOGLE_MAPS_EMBED_KEY. */
function officialEmbedUrl(lat: number, lng: number, zoom: number, key: string): string {
  return (
    `https://www.google.com/maps/embed/v1/place` +
    `?key=${encodeURIComponent(key)}` +
    // Toạ độ chứ không phải tên — xem chú thích ở đầu file.
    `&q=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&language=vi&region=VN`
  );
}

/**
 * Bản nhúng không cần khoá, dùng khi chưa cấu hình khoá.
 *
 * VÌ SAO CÓ ĐƯỜNG NÀY. Trước đây khi thiếu khoá, component vẽ một khối thay thế gồm liên kết và
 * cặp toạ độ. Khối đó xử lý đúng trường hợp thiếu khoá, nhưng khách vào xem một địa danh thì
 * cần THẤY chỗ đó nằm đâu — hai con số thập phân không nói lên điều gì. Nên mặc định bây giờ
 * vẫn là một bản đồ thật.
 *
 * VÌ SAO TRỎ THẲNG VÀO /maps/embed CHỨ KHÔNG DÙNG `output=embed`. Dạng quen thuộc
 * `maps.google.com/maps?...&output=embed` chuyển hướng 301 sang đúng URL dưới đây, và phản hồi
 * 301 ấy có mang `X-Frame-Options: SAMEORIGIN`. Về lý thuyết trình duyệt chỉ áp header đó lên
 * tài liệu thật sự được dựng chứ không lên chặng chuyển hướng, nhưng "về lý thuyết" là chưa đủ
 * cho một thứ mà hỏng thì khách thấy một ô trắng. Trỏ thẳng vào đích thì không còn câu hỏi đó:
 * phản hồi này đã đo là 200, không `X-Frame-Options`, không `frame-ancestors`.
 *
 * GIỚI HẠN PHẢI BIẾT. Chuỗi `pb` là định dạng NỘI BỘ của Google, không có tài liệu và không có
 * cam kết dịch vụ nào. Nó đã ổn định nhiều năm và chính Google sinh ra nó ở chặng chuyển hướng
 * nói trên, nhưng nếu một ngày nó đổi thì bản đồ hỏng lặng lẽ — iframe khác nguồn nên trang
 * không có cách nào tự phát hiện. Vì vậy đây chỉ là đường mặc định: đặt `GOOGLE_MAPS_EMBED_KEY`
 * vào `.env` là toàn bộ bản đồ tự chuyển sang Maps Embed API chính thức, không sửa dòng nào.
 *
 * Cấu trúc: `!1s<lat>,<lng>` là điểm cần hiện, `!6i<zoom>` là mức thu phóng, hai trường `!1s<hl>`
 * còn lại là ngôn ngữ giao diện.
 */
function keylessEmbedUrl(lat: number, lng: number, zoom: number): string {
  const point = `${lat},${lng}`;
  return (
    `https://www.google.com/maps/embed?origin=mfe` +
    `&pb=!1m3!2m1!1s${point}!6i${Math.round(zoom)}!3m1!1svi!5m1!1svi`
  );
}

export const PlaceMap: React.FC<PlaceMapProps> = ({
  lat,
  lng,
  name,
  zoom = 13,
  heightClass = 'h-64 sm:h-80',
  area = false,
}) => {
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppConfig().then((config) => {
      if (cancelled) return;
      setEmbedKey(config.googleMapsEmbedKey);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Trong lúc chờ cấu hình, giữ đúng chiều cao khung thay vì để trống.
   *
   * Không làm vậy thì nội dung phía dưới nhảy lên rồi tụt xuống khi bản đồ xuất hiện, và trong
   * một modal đang cuộn thì cú nhảy đó làm mất chỗ khách đang đọc. `loadAppConfig` nhớ kết quả
   * ở mức module nên chỉ bản đồ đầu tiên trong phiên mới thấy khối chờ này.
   */
  if (!ready) {
    return (
      <div
        className={`${heightClass} w-full rounded-2xl bg-[#f7faf8] border border-[#e0e3e1] animate-pulse`}
      />
    );
  }

  const src = embedKey
    ? officialEmbedUrl(lat, lng, zoom, embedKey)
    : keylessEmbedUrl(lat, lng, zoom);

  return (
    <div className="space-y-2">
      <div className={`${heightClass} w-full rounded-2xl overflow-hidden border border-[#e0e3e1]`}>
        <iframe
          title={`Bản đồ ${name}`}
          src={src}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          // `lazy` vì bản đồ nằm dưới phần đầu của modal: không tải khi khách chưa cuộn tới.
          loading="lazy"
          // Chặn iframe bên thứ ba đọc được đường dẫn trang hiện tại.
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      {area ? (
        <p className="text-xs leading-relaxed text-[#5b6b62]">
          Bản đồ khu vực quanh {name}. Toạ độ mới ở mức xấp xỉ, chưa xác minh cổng tham quan hay
          chỗ gửi xe, nên trang này không đưa liên kết chỉ đường.
        </p>
      ) : (
        <a
          href={externalMapUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5b6b62] hover:text-[#2c3733] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          Mở trong Google Maps để chỉ đường
        </a>
      )}
    </div>
  );
};
