import type { Slots } from "@server/domain/agents/types";

/**
 * TRÍCH XUẤT SLOT TẤT ĐỊNH — đọc thẳng từ câu của khách, không qua model.
 *
 * VÌ SAO CẦN, VÀ VÌ SAO KHÔNG PHẢI LÀ TỐI ƯU. Ca thử "Du lịch 3 ngày 2 đêm" phơi ra một hỏng hóc
 * hoàn chỉnh: khách nói rõ số ngày, bot vẫn hỏi lại "bạn dự định đi mấy ngày?", khách bấm gợi ý
 * "3 ngày 2 đêm", bot lại hỏi tiếp — một vòng lặp không lối ra. Nguyên nhân là NLU trả về JSON
 * SAI HÌNH DẠNG: schema khai các trường phẳng `days`, `travelers`, còn model tự bịa ra
 * `{"entities":{"duration":"3 ngày 2 đêm","location":"","budget":0}}`. Không trường nào khớp, nên
 * mọi slot đều rỗng.
 *
 * Hình dạng bị trôi vì điểm cuối đang dùng không thực thi `responseSchema` (đo được: bốn trên bốn
 * lượt gọi thô trả văn xuôi thay vì JSON). Nhưng kể cả khi điểm cuối làm đúng, đặt việc đọc con
 * số vào tay model vẫn là chọn lựa sai — và kế hoạch 11.1.1 đã nói thẳng điều đó ở giai đoạn B:
 * để LLM tự quy ra ngày tháng là vi phạm cần sửa, LLM chỉ nên trích ra CỤM CHỮ còn việc quy đổi
 * do mã tất định làm. Ngày tháng hiện do Temporal Router xử lý riêng.
 *
 * PHẠM VI CÓ CHỦ ĐÍCH HẸP. Chỉ trích những slot mà tiếng Việt diễn đạt đủ quy củ để đọc chắc
 * chắn: số ngày, số người, phương tiện, mức ngân sách, phong cách. KHÔNG trích địa danh —
 * việc đó đã có `findPlacesInText` làm bằng từ điển, và nó làm tốt hơn bất kỳ mẫu chuỗi nào.
 *
 * THỨ TỰ ƯU TIÊN khi hợp nhất: giá trị đọc được ở đây THẮNG giá trị model đưa ra. Model đoán;
 * mã ở đây đọc. Khi hai bên khác nhau thì gần như luôn là model đoán sai.
 */

/** Bỏ dấu và thường hoá để mọi mẫu chỉ cần viết một dạng. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

/**
 * Số viết bằng chữ. Chỉ tới mười vì trên mức đó khách gần như luôn viết bằng số, và mỗi mục thêm
 * vào là thêm một khả năng khớp nhầm.
 */
const WORD_NUMBERS: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

/**
 * Đọc một số đứng trước đơn vị, chấp nhận cả chữ số lẫn chữ viết.
 *
 * `unit` là biểu thức cho đơn vị, ví dụ `ngay`. Trả `null` khi không tìm thấy hoặc khi giá trị
 * nằm ngoài khoảng hợp lệ — ngoài khoảng thì thà bỏ qua còn hơn điền một con số vô lý rồi để tác
 * tử dựng lịch trình 400 ngày.
 */
function readNumberBefore(text: string, unit: string, max: number): number | null {
  const digit = text.match(new RegExp(`(\\d{1,3})\\s*${unit}`));
  if (digit) {
    const value = Number.parseInt(digit[1], 10);
    return value >= 1 && value <= max ? value : null;
  }

  const words = Object.keys(WORD_NUMBERS).join("|");
  const word = text.match(new RegExp(`\\b(${words})\\s*${unit}`));
  if (word) {
    const value = WORD_NUMBERS[word[1]];
    return value >= 1 && value <= max ? value : null;
  }
  return null;
}

/** Mẫu cho các slug dạng liệt kê. Mục đầu khớp trước, nên xếp mục cụ thể lên trên mục chung. */
const TRAVEL_MODE_PATTERNS: [RegExp, Slots["travelMode"]][] = [
  // "easy rider" phải đứng TRƯỚC "xe may": một chuyến easy rider vẫn là đi xe máy, nhưng khách
  // thuê người lái thì nhu cầu khác hẳn, và câu của họ thường nhắc cả hai thứ.
  [/easy\s*rider|thue\s*(nguoi\s*)?lai|co\s*nguoi\s*lai|xe\s*om/, "easy_rider"],
  [/xe\s*may|motorbike|xe\s*so|xe\s*con\s*tay|phuot\s*xe/, "motorbike"],
  [/o\s*to|oto|xe\s*hoi|xe\s*4\s*cho|xe\s*7\s*cho|suv|car\b/, "car_suv"],
];

/**
 * Mức ngân sách. Ngoài các từ gọi thẳng tên mức, bảng còn bắt cách nói SO SÁNH NHẤT — "loại tốt
 * nhất", "xịn nhất", "rẻ nhất" — vì đó là cách khách đổi ý giữa chừng thay vì gọi lại tên mức.
 *
 * GS-200 của bộ vàng là đúng ca đó: khách nói "Mình muốn đi kiểu tiết kiệm thôi" rồi đổi sang
 * "Thôi đổi sang loại tốt nhất đi". Câu sau không chứa từ nào trong bảng cũ, nên slot vẫn kẹt ở
 * `backpacker` và tác tử ngân sách tính lại theo mức khách vừa bỏ.
 *
 * Neo vào "nhat" chứ không bắt "tot" đứng một mình: "chỗ nào tốt" là câu hỏi ý kiến, không phải
 * lệnh đổi hạng.
 */
const BUDGET_PATTERNS: [RegExp, Slots["budgetLevel"]][] = [
  [/tiet\s*kiem|gia\s*re|backpack|phuot\s*bui|di\s*bui|budget|sinh\s*vien|re\s*nhat/, "backpacker"],
  [
    /cao\s*cap|sang\s*trong|luxury|resort|5\s*sao|hang\s*sang|(tot|xin|ngon|dep|xa\s*xi)\s*nhat/,
    "luxury",
  ],
  [/thoai\s*mai|tieu\s*chuan|tam\s*trung|comfort|vua\s*phai/, "comfort"],
];

const VIBE_PATTERNS: [RegExp, Slots["vibe"]][] = [
  [/chup\s*anh|song\s*ao|photo|check\s*in|san\s*may/, "photography"],
  [/van\s*hoa|ban\s*lang|dan\s*toc|cho\s*phien|le\s*hoi|truyen\s*thong/, "culture"],
  [/mao\s*hiem|trekking|leo\s*nui|di\s*bo\s*duong\s*dai|adventure|thu\s*thach/, "adventure"],
  [/nghi\s*duong|thu\s*gian|chill|thong\s*tha|cham\s*rai/, "chill"],
];

function matchFirst<T>(text: string, patterns: [RegExp, T][]): T | null {
  for (const [pattern, value] of patterns) {
    if (pattern.test(text)) return value;
  }
  return null;
}

/**
 * Đọc mọi slot đọc được từ một câu.
 *
 * Trả về đối tượng chỉ chứa những slot THỰC SỰ tìm thấy. Không bao giờ điền giá trị mặc định:
 * một slot vắng mặt là tín hiệu để tác tử hỏi thêm, còn một slot điền bừa thì im lặng làm hỏng
 * cả lịch trình.
 */
export function extractSlots(message: string): Slots {
  const text = normalize(message);
  const slots: Slots = {};

  /**
   * Số ngày. Ngoài dạng "3 ngày" còn phải bắt hai dạng rất phổ biến mà bản trước bỏ sót:
   *
   *   - "3 ngày 2 đêm": bắt được ngay bởi mẫu "ngay".
   *   - "2 đêm" đứng một mình: khách nói số ĐÊM chứ không nói số ngày. Quy ước du lịch Việt Nam
   *     là n đêm tương ứng n+1 ngày, và suy như vậy đúng hơn hẳn việc hỏi lại một thứ khách vừa
   *     nói. Chỉ suy khi không tìm được số ngày tường minh.
   *   - "3n2d": dạng viết tắt hay gặp trên các trang tour.
   */
  const days = readNumberBefore(text, "ngay", 30) ?? readNumberBefore(text, "n(?=\\s*\\d\\s*d)", 30);
  if (days) {
    slots.days = days;
  } else {
    const nights = readNumberBefore(text, "dem", 29);
    if (nights) slots.days = nights + 1;
  }

  const travelers = readNumberBefore(text, "(nguoi|khach|thanh\\s*vien|pax|ban\\s*be)", 40);
  if (travelers) slots.travelers = travelers;

  const travelMode = matchFirst(text, TRAVEL_MODE_PATTERNS);
  if (travelMode) slots.travelMode = travelMode;

  const budgetLevel = matchFirst(text, BUDGET_PATTERNS);
  if (budgetLevel) slots.budgetLevel = budgetLevel;

  const vibe = matchFirst(text, VIBE_PATTERNS);
  if (vibe) slots.vibe = vibe;

  return slots;
}
