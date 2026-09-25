/**
 * VIẾT LẠI TRUY VẤN TRƯỚC KHI TRUY XUẤT — hoàn toàn bằng luật, không gọi model.
 *
 * Quyết định "không gọi model" là quyết định thiết kế chính của module này, và nó có hai lý do
 * đều quan trọng như nhau. Thứ nhất là ĐỘ TRỄ: viết lại nằm trên đường đi của MỌI lượt hỏi, nên
 * một lượt gọi model ở đây cộng thẳng vào p95 của toàn hệ thống. Thứ hai, và nặng hơn, là ẢO
 * GIÁC: một model viết lại câu hỏi có thể thêm vào những chữ khách chưa từng nói — "ở đó" thành
 * "ở Đồng Văn" khi khách đang nói về Mèo Vạc — và sai lệch ấy đi thẳng vào bộ lọc địa danh, nơi
 * không còn lớp nào kiểm lại. Một bảng tra thì sai kiểu khác: nó bỏ sót, và bỏ sót thì vô hại.
 *
 * Mỗi phép viết lại được GHI TÊN trong kết quả trả về. Không có phần ghi tên đó thì không đo
 * riêng được nhóm nào có ích nhóm nào không, và việc viết lại trở thành một lớp không ai dám sửa.
 */

/**
 * RANH GIỚI TỪ CHO TIẾNG VIỆT.
 *
 * `\b` của JavaScript chỉ biết `[A-Za-z0-9_]`, nên trong một chuỗi tiếng Việt nó đặt ranh giới
 * ngay giữa chữ: `/\bnho quê\b/` KHÔNG khớp "sông Nho Quê", vì "ê" không phải ký tự từ theo định
 * nghĩa ASCII và `\b` cuối mẫu rơi vào giữa "Qu" với "ê". Đây là một cái bẫy im lặng — mẫu vẫn
 * biên dịch, vẫn chạy, chỉ là không bao giờ khớp thứ nó được viết ra để khớp.
 *
 * Lookaround theo thuộc tính Unicode `\p{L}` thay thế được và hiểu mọi chữ cái có dấu.
 */
const BEFORE = String.raw`(?<!\p{L})`;
const AFTER = String.raw`(?!\p{L})`;

function word(pattern: string, flags = "iu"): RegExp {
  return new RegExp(`${BEFORE}(?:${pattern})${AFTER}`, flags);
}

/**
 * Đại từ thay cho một địa danh đã nhắc ở lượt trước.
 *
 * "này" đứng một mình bị loại khỏi nhánh đầu có chủ ý: "chuyến này", "mùa này", "tháng này" đều
 * là cách nói bình thường và không trỏ tới địa danh nào. Nó chỉ được tính khi đi sau một danh từ
 * chỉ nơi chốn — "chỗ này", "khu này", "vùng này".
 */
const ANAPHORA = word(
  String.raw`(?:ở|tại|tới|đến|về|quanh|gần)\s*(?:đó|đấy|ấy|kia)` +
    String.raw`|(?:chỗ|nơi|khu|vùng|bên|đằng)\s+(?:đó|đấy|này|ấy|kia)`,
);

/**
 * CÂU NỐI TIẾP LƯỢC CHỦ NGỮ: "Nên đi buổi sáng hay buổi chiều?", "Giá vé bao nhiêu?".
 *
 * Không có đại từ nào, nhưng câu vẫn chỉ hiểu được khi biết đang nói về nơi nào. GS-198 hỏi câu
 * đầu ví dụ ngay sau câu về hẻm Tu Sản; truy xuất không có địa danh nên trả về Vách Đá Trắng và
 * sương mù thay vì bến thuyền Tà Làng, và câu trả lời qua hay trượt guardrail tuỳ lượt.
 *
 * Chỉ bắt câu MỞ ĐẦU bằng một cụm hỏi lời khuyên, thời điểm hay giá — những câu tự nó không có
 * chủ ngữ. Câu tự có chủ ngữ như "Thắng cố nấu bằng gì?" không bị gắn địa danh nào.
 * ponytail: danh sách mở đầu viết tay, bổ sung khi eval lộ thêm kiểu câu nối tiếp khác.
 */
const ELLIPSIS = new RegExp(
  String.raw`^\s*(?:có\s+)?(?:nên|mấy\s+giờ|bao\s+giờ|khi\s+nào|lúc\s+nào|giá|vé|mất\s+bao\s+lâu|đi\s+mất|có\s+cần|cần\s+mang)` + AFTER,
  "iu",
);

/**
 * Viết tắt hay gặp trong tin nhắn tiếng Việt về vùng này.
 *
 * Bảng CỐ TÌNH ngắn và chỉ chứa những cụm không thể hiểu thành gì khác. Một bảng viết tắt rộng
 * là một nguồn lỗi âm thầm: "DV" cũng là "dịch vụ", và mở rộng nhầm thì câu hỏi bị đẩy sang một
 * địa danh khách không nhắc tới — đúng kiểu hỏng mà cả module này được dựng để tránh.
 */
const ABBREVIATIONS: [RegExp, string][] = [
  [word("hg", "giu"), "Hà Giang"],
  [word("mpl", "giu"), "Mã Pí Lèng"],
  [word("qb", "giu"), "Quản Bạ"],
  [word("home ?stay", "giu"), "homestay"],
];

/**
 * Tên hay bị viết sai của địa danh.
 *
 * Khác bảng alias trong `data/places`: ở đó là những cách gọi ĐÚNG của một nơi, còn ở đây là
 * những cách viết SAI đủ phổ biến để đáng bắt. Giữ riêng vì trộn chúng lại sẽ khiến bộ xác thực
 * dữ liệu báo trùng alias — và nó đúng khi báo.
 */
const RENAMES: [RegExp, string][] = [
  [word("mã pì lèng", "giu"), "Mã Pí Lèng"],
  [word("ma pi leng", "giu"), "Mã Pí Lèng"],
  [word("nho quê", "giu"), "Nho Quế"],
  [word("lũng cu", "giu"), "Lũng Cú"],
  /**
   * "cao nguyên đá" đứng một mình là cách gọi tắt của cao nguyên đá Đồng Văn. Chỉ mở rộng khi
   * SAU nó chưa có sẵn chữ "Đồng Văn", nếu không sẽ thành "cao nguyên đá Đồng Văn Đồng Văn".
   */
  [new RegExp(`${BEFORE}cao nguyên đá(?!\\s+đồng văn)${AFTER}`, "giu"), "cao nguyên đá Đồng Văn"],
];

type RewriteKind = "abbreviation" | "rename" | "anaphora" | "ellipsis";

interface RewriteInput {
  message: string;
  /**
   * Địa danh đã nhắc ở các lượt TRƯỚC, mới nhất đứng đầu.
   *
   * Nơi gọi truyền vào chứ module này không tự đọc lịch sử: chỉ orchestrator biết lượt nào đã
   * phân giải ra địa danh nào, và đọc lại lịch sử ở đây sẽ là lần thứ hai làm cùng một việc bằng
   * một cách kém chính xác hơn.
   */
  carriedPlaces?: string[];
}

interface RewriteResult {
  /** Câu dùng cho truy xuất. Bằng đúng `message` khi không có phép nào áp dụng. */
  query: string;
  /** Những phép đã áp dụng, để đo riêng từng nhóm. Rỗng nghĩa là câu đi thẳng, không qua xử lý. */
  applied: RewriteKind[];
  /** Địa danh được mang sang từ lượt trước vì lượt này chỉ dùng đại từ hoặc lược chủ ngữ. */
  resolvedPlaces: string[];
}

/** Câu này có dùng đại từ thay cho một địa danh không. */
export function hasAnaphora(message: string): boolean {
  return ANAPHORA.test(message);
}

export function rewriteQuery(input: RewriteInput): RewriteResult {
  const applied: RewriteKind[] = [];
  let query = input.message;

  for (const [pattern, replacement] of ABBREVIATIONS) {
    if (!pattern.test(query)) continue;
    query = query.replace(pattern, replacement);
    if (!applied.includes("abbreviation")) applied.push("abbreviation");
  }

  for (const [pattern, replacement] of RENAMES) {
    if (!pattern.test(query)) continue;
    query = query.replace(pattern, replacement);
    if (!applied.includes("rename")) applied.push("rename");
  }

  /**
   * Đại từ: KHÔNG thay chữ trong câu, mà GẮN THÊM tên địa danh vào cuối.
   *
   * Thay chữ thì phải đoán đại từ ấy trỏ vào đâu trong câu và viết lại ngữ pháp cho đúng — "Ở đó
   * ăn sáng gì" thành "Ở Đồng Văn ăn sáng gì" nghe được, nhưng "Chỗ này có đắt không" thành "Chỗ
   * Đồng Văn có đắt không" thì không. Gắn thêm giữ nguyên câu khách viết và vẫn đưa đủ tín hiệu
   * cho cả nhánh vector lẫn nhánh từ khoá.
   *
   * Chỉ áp dụng khi lượt này KHÔNG tự nêu địa danh nào — nơi gọi bảo đảm điều đó bằng cách chỉ
   * truyền `carriedPlaces` trong tình huống ấy.
   */
  const carried = (input.carriedPlaces ?? []).filter(Boolean);
  const resolvedPlaces: string[] = [];
  const kind: RewriteKind | undefined = hasAnaphora(input.message)
    ? "anaphora"
    : ELLIPSIS.test(input.message) ? "ellipsis" : undefined;
  if (carried.length > 0 && kind) {
    // Chỉ mang MỘT địa danh: mang cả danh sách sẽ biến một câu hỏi về một nơi thành một truy vấn
    // trải trên nhiều nơi, và bộ lọc địa danh khi đó rộng hơn cả khi không lọc gì.
    resolvedPlaces.push(carried[0]);
    query = `${query} (${carried[0]})`;
    applied.push(kind);
  }

  return { query, applied, resolvedPlaces };
}
