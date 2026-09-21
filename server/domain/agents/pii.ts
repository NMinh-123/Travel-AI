/**
 * Che dữ liệu cá nhân ở biên gửi ra API bên ngoài (SRS Mục 11.4.8).
 *
 * SRS phân biệt rõ hai loại nội dung: kho tri thức RAG là nội dung công khai đã kiểm duyệt nên
 * rủi ro thấp, còn **nội dung hội thoại của khách có thể chứa dữ liệu cá nhân** (họ tên, số điện
 * thoại, số giấy tờ) và bắt buộc phải che trước khi đưa vào lời nhắc gửi ra API nước ngoài, thay
 * bằng ký hiệu thay thế và chỉ khôi phục ở phía hệ thống.
 *
 * Phạm vi áp dụng chỉ là biên đó. `ChatMessage.content` trong database lưu bản GỐC: đây là dữ
 * liệu của khách nằm trong hệ thống của mình, việc che không liên quan tới lưu trữ nội bộ. Nghĩa
 * vụ với dữ liệu đã lưu là thời hạn lưu trữ và quyền yêu cầu xoá, không phải mã hoá hoá nó.
 *
 * Giới hạn cần biết: đây là bộ lọc theo mẫu, không phải bộ nhận diện thực thể. Nó bắt được số
 * điện thoại, email và số giấy tờ — tức là các mẫu có cấu trúc. Nó KHÔNG bắt được họ tên người
 * viết trong câu văn xuôi. Muốn tới mức đó cần một model NER, và đó là việc của giai đoạn sau.
 */

interface Pattern {
  name: string;
  regex: RegExp;
}

/**
 * Thứ tự quan trọng: mẫu dài phải khớp trước mẫu ngắn, nếu không thì số CCCD 12 chữ số bị bộ
 * lọc số điện thoại 10 chữ số ăn mất một khúc giữa và phần còn lại lộ ra ngoài.
 *
 * Về ranh giới hai bên — đây là chỗ đã từng sai và phải giữ đúng: điều kiện KHÔNG phải "không có
 * dấu chấm/phẩy liền kề" mà là "không nằm trong một dãy số dài hơn". Dấu phẩy và dấu chấm kết câu
 * đứng ngay sau số là chuyện hoàn toàn bình thường trong văn viết ("sđt 0982123456, email..."),
 * nên từ chối chúng đồng nghĩa với việc bỏ sót đúng trường hợp phổ biến nhất. Vì vậy lookahead
 * chỉ chặn khi sau dấu phân cách còn có chữ số — tức "180.000" thì bỏ qua, còn "0982123456,"
 * thì vẫn che.
 */
const PATTERNS: Pattern[] = [
  { name: "EMAIL", regex: /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}]{2,}/gu },
  // CCCD 12 chữ số.
  { name: "CCCD", regex: /(?<!\d)(?<!\d[.,])\d{12}(?!\d)(?![.,]\d)/g },
  // Số điện thoại VN: 0xxxxxxxxx, 84xxxxxxxxx hoặc +84xxxxxxxxx, cho phép khoảng trắng/gạch/chấm.
  { name: "PHONE", regex: /(?<!\d)(?<!\d[.,])(?:\+?84|0)(?:[\s.-]?\d){9}(?!\d)(?![.,]\d)/g },
  // CMND 9 chữ số. Đặt cuối vì dễ trùng nhất; giá tiền trong ứng dụng này luôn viết có dấu phân
  // cách ("180.000") nên một dãy 9 chữ số trần gần như chắc chắn là số giấy tờ.
  { name: "CMND", regex: /(?<!\d)(?<!\d[.,])\d{9}(?!\d)(?![.,]\d)/g },
];

/** Định dạng ít bị model viết lại nhất trong các phương án đã thử: không dấu, không khoảng trắng. */
const PLACEHOLDER = (name: string, index: number) => `__${name}_${index}__`;

const PLACEHOLDER_PROBE = /__(?:EMAIL|CCCD|PHONE|CMND)_\d+__/;

/**
 * Che theo phạm vi một lượt hội thoại. Cùng một số điện thoại xuất hiện ở tin nhắn mới và ở lịch
 * sử phải ra cùng một ký hiệu, nếu không model mất khả năng hiểu đó là cùng một thứ.
 */
export class PiiMasker {
  private readonly toPlaceholder = new Map<string, string>();
  private readonly toOriginal = new Map<string, string>();
  private counter = 0;

  mask(text: string): string {
    let masked = text;

    for (const pattern of PATTERNS) {
      masked = masked.replace(pattern.regex, (match) => {
        const existing = this.toPlaceholder.get(match);
        if (existing) return existing;

        this.counter += 1;
        const placeholder = PLACEHOLDER(pattern.name, this.counter);
        this.toPlaceholder.set(match, placeholder);
        this.toOriginal.set(placeholder, match);
        return placeholder;
      });
    }

    return masked;
  }

  /** Khôi phục ở đường về, trước khi trả cho khách. */
  restore(text: string): string {
    let restored = text;
    for (const [placeholder, original] of this.toOriginal) {
      restored = restored.split(placeholder).join(original);
    }
    return restored;
  }

  get maskedCount(): number {
    return this.toOriginal.size;
  }
}

/**
 * Guardrail gọi hàm này sau khi khôi phục. Còn placeholder sót lại nghĩa là model đã viết lại
 * hoặc bịa thêm một ký hiệu — trả nguyên ra cho khách thì họ thấy `__PHONE_1__` giữa câu trả lời.
 */
export function hasLeftoverPlaceholder(text: string): boolean {
  return PLACEHOLDER_PROBE.test(text);
}
