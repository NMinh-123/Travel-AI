/**
 * CĂN CỨ CỦA CÂU TRẢ LỜI — chứng cứ, trích dẫn và đối chiếu dữ kiện bằng code.
 *
 * Bản trước đặt `grounded: reply.length > 0`, nghĩa là "model có nói gì đó" được coi là "có căn
 * cứ", và `citedDocIds` nhận nguyên mọi đoạn truy xuất được dù câu trả lời có dùng đoạn nào hay
 * không. Hai phép gán đó không chứng minh điều gì cả: một câu bịa hoàn toàn vẫn `grounded: true`
 * và vẫn kèm một danh sách nguồn trông rất thuyết phục.
 *
 * File này dựng ba lớp kiểm mà mã có thể tự làm, không cần hỏi lại model:
 *
 *  1. Mọi thứ đưa vào lời nhắc đều là một `EvidenceBlock` có MÃ. Model phải dẫn mã đó cho từng ý.
 *  2. `verifyCitations` loại những mã model bịa ra — chỉ mã thật sự có trong lời nhắc mới được tính.
 *  3. `checkNumericFacts` đối chiếu từng con số có đơn vị trong câu trả lời với các con số có
 *     trong chứng cứ. Đây là lớp bắt "ảo giác số" mà hai lớp trên không thấy: model hoàn toàn có
 *     thể dẫn đúng nguồn rồi viết sai con số trong chính nguồn ấy.
 */

export type GroundingStatus =
  /** Có chứng cứ, MỌI ý mang thông tin đều dẫn được về chứng cứ, và mọi dữ kiện số đều đối chiếu được. */
  | "grounded"
  /**
   * Có nguồn thật và không có con số nào bịa, NHƯNG câu trả lời còn ý không dẫn nguồn.
   *
   * Trạng thái này sinh ra vì `uncitedClaims` từng được tính rồi bỏ đó: một câu trả lời gồm một ý
   * dẫn đúng nguồn và một ý bịa vẫn được đánh `grounded`, chỉ vì `citedIds` không rỗng. Tách
   * riêng thay vì gộp vào `insufficient` là có chủ ý — xem `resolveGrounding`.
   */
  | "partially_grounded"
  /** Có đi tìm nhưng chứng cứ không đủ để trả lời, hoặc câu trả lời không dẫn được nguồn nào. */
  | "insufficient"
  /** Có chứng cứ nhưng câu trả lời nêu dữ kiện không có trong đó. Đây là ảo giác, không phải thiếu nguồn. */
  | "unsupported"
  /** Dữ kiện phải lấy từ tool mà tool hỏng. KHÁC hẳn "ngoài phạm vi" và phải nói với khách là chưa tra được. */
  | "tool_failed"
  /** Không tìm được chứng cứ nào để mà bắt đầu. */
  | "no_source";

/**
 * Tình trạng của các TOOL trong lượt này — một trục riêng, không trộn vào `GroundingStatus`.
 *
 * Tách ra vì hai trục trả lời hai câu khác nhau và có thể lệch nhau. Câu "hôm nay Đồng Văn thế
 * nào" gặp lúc Open-Meteo hỏng nhưng kho tri thức vẫn có bài về khí hậu Đồng Văn: chứng cứ không
 * rỗng, câu trả lời dẫn được nguồn, nên trục căn cứ hoàn toàn có thể báo `grounded` trong khi một
 * tool đã hỏng. Gộp hai trục làm một thì hoặc là mất dấu sự cố hạ tầng, hoặc là mọi lượt có tool
 * hỏng đều bị hạ điểm kể cả khi tool đó không liên quan tới câu hỏi.
 */
export type ToolStatus =
  /** Lượt này không cần gọi tool nào. */
  | "not_used"
  /** Mọi tool cần thiết đều trả được dữ liệu. */
  | "ok"
  /** Có tool hỏng nhưng dữ kiện khách hỏi KHÔNG bắt buộc phải lấy từ tool đó. */
  | "degraded"
  /** Tool hỏng và đó đúng là nguồn bắt buộc cho câu hỏi này. */
  | "failed";

export interface EvidenceBlock {
  /** Mã ngắn hiện trong lời nhắc và là thứ model phải dẫn lại: `K1`, `K2`, `W1`. */
  id: string;
  kind: "knowledge" | "realtime";
  /** Tiêu đề đoạn hoặc tên điểm đo — để người đọc trace biết nguồn là gì. */
  label: string;
  /**
   * Nội dung CHỨNG CỨ, không kèm chỉ dẫn trình bày.
   *
   * Ranh giới này quan trọng với bộ đo: RAGAS chấm faithfulness của câu trả lời so với ngữ cảnh,
   * nên trộn câu lệnh "hãy mở đầu bằng một dòng tóm tắt" vào ngữ cảnh là đưa cho bộ chấm một thứ
   * không phải bằng chứng.
   */
  text: string;
  /** `domain:slug` với tri thức, khoá nhà cung cấp với dữ liệu động. */
  sourceRef: string;
  /** Id KnowledgeDoc. Chỉ có ở chứng cứ tri thức. */
  docId?: string;
}

export interface Citation {
  claim: string;
  sourceIds: string[];
}

export interface CitationCheck {
  /** Mã chứng cứ được dẫn hợp lệ, giữ thứ tự xuất hiện. */
  citedIds: string[];
  /** Mã model bịa ra, không có trong lời nhắc. */
  unknownIds: string[];
  /** Số ý không kèm mã nguồn nào hợp lệ. */
  uncitedClaims: number;
  claims: number;
  /**
   * Nội dung những ý đã dẫn được ít nhất một mã THẬT.
   *
   * Cần chính nội dung chứ không chỉ số đếm, vì bước sau phải đối chiếu chúng với từng câu trong
   * câu trả lời: model hoàn toàn có thể khai đúng một ý vô thưởng vô phạt rồi viết thêm năm câu
   * không khai gì, và khi đó `uncitedClaims` bằng 0 mà độ phủ thực tế chỉ một phần sáu.
   */
  verifiedClaims: string[];
}

function normalizeId(value: string): string {
  return value.trim().toUpperCase().replace(/^\[|\]$/g, "");
}

/**
 * Giữ lại những mã thật, vứt những mã bịa.
 *
 * Phép kiểm này rẻ nhưng bắt được đúng kiểu hỏng nguy hiểm nhất của lối trích dẫn do model tự
 * khai: model học được rằng câu trả lời nên có nguồn, nên nó gắn nguồn kể cả khi không có nguồn
 * nào — và một mã trông hợp lệ thì không ai kiểm lại bằng mắt.
 */
export function verifyCitations(citations: Citation[] | undefined, evidence: EvidenceBlock[]): CitationCheck {
  const known = new Map(evidence.map((block) => [block.id.toUpperCase(), block.id]));
  const cited: string[] = [];
  const unknown: string[] = [];
  const verified: string[] = [];
  let uncited = 0;

  for (const citation of citations ?? []) {
    if (!citation || typeof citation.claim !== "string" || !citation.claim.trim()) continue;
    const ids = Array.isArray(citation.sourceIds) ? citation.sourceIds : [];
    let matched = 0;
    for (const raw of ids) {
      if (typeof raw !== "string") continue;
      const id = known.get(normalizeId(raw));
      if (id === undefined) {
        if (!unknown.includes(normalizeId(raw))) unknown.push(normalizeId(raw));
        continue;
      }
      matched += 1;
      if (!cited.includes(id)) cited.push(id);
    }
    if (matched === 0) uncited += 1;
    else verified.push(citation.claim.trim());
  }

  return {
    citedIds: cited,
    unknownIds: unknown,
    uncitedClaims: uncited,
    claims: (citations ?? []).length,
    verifiedClaims: verified,
  };
}

/**
 * Đơn vị được đối chiếu, và HỆ SỐ quy về đơn vị chuẩn của nhóm.
 *
 * Cố tình KHÔNG kiểm mọi con số. Số ngày, số đêm, số người đến từ slot của khách chứ không đến từ
 * chứng cứ, còn phần trăm độ ẩm hay lượng mưa thì sai lệch do làm tròn gần như vô hại. Danh sách
 * này bám đúng ba nhóm dữ kiện mà nói sai là gây hại thật: GIÁ, NHIỆT ĐỘ và KHOẢNG CÁCH/TỐC ĐỘ.
 *
 * Thứ tự quan trọng: `km/h` phải đứng trước `km`, nếu không "45 km/h" bị đọc thành "45 km".
 */
const UNITS: { pattern: string; group: string; factor: number }[] = [
  { pattern: "km\\s*/\\s*h|kmh|km một giờ", group: "speed", factor: 1 },
  { pattern: "km|ki-?lô-?mét|kilomet", group: "distance", factor: 1 },
  { pattern: "°\\s*C|℃|độ\\s*C(?![a-zA-ZÀ-ỹ])|độ(?!\\s*(ẩm|cao|dài|dốc))", group: "temp", factor: 1 },
  { pattern: "triệu\\s*(đồng|đ|vnđ)?|trieu", group: "money", factor: 1_000_000 },
  { pattern: "nghìn\\s*(đồng|đ|vnđ)?|ngàn\\s*(đồng|đ|vnđ)?|nghin|ngan|k\\b", group: "money", factor: 1_000 },
  { pattern: "đồng|vnđ|vnd|đ(?![a-zA-ZÀ-ỹ])", group: "money", factor: 1 },
];

const NUMBER = "\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?";
const RANGE_SEPARATOR = "\\s*(?:–|—|-|tới|đến)\\s*";

/**
 * Đọc số viết kiểu Việt.
 *
 * `1.250.000` là một triệu hai trăm năm mươi nghìn, còn `24,5` là hai tư phẩy năm. Nhầm hai quy
 * ước này làm cả phép đối chiếu vô nghĩa, nên nhận dạng nhóm nghìn bằng chính hình dạng chuỗi
 * thay vì đoán theo ngữ cảnh.
 */
export function parseVnNumber(raw: string): number | null {
  const text = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) return Number(text.replace(/\./g, "").replace(",", "."));
  if (/^\d+([.,]\d+)?$/.test(text)) return Number(text.replace(",", "."));
  return null;
}

export interface NumericFact {
  group: string;
  /** Giá trị nhỏ nhất và lớn nhất; hai số bằng nhau khi đó là một trị đơn lẻ. */
  min: number;
  max: number;
  text: string;
  /** Vị trí trong đoạn văn, để danh sách trả về theo đúng thứ tự người đọc gặp chúng. */
  at: number;
}

/**
 * Quét mọi số CÓ ĐƠN VỊ trong một đoạn văn, gộp cả dạng khoảng `18–24°C`.
 *
 * Quét theo thứ tự của `UNITS` và ĐÁNH DẤU đoạn văn bản đã dùng. Thiếu bước đánh dấu thì "45
 * km/h" bị đếm hai lần — một lần là tốc độ 45 km/h, một lần là quãng đường 45 km — và con số
 * quãng đường ma đó sẽ bị báo là không có căn cứ trong khi câu trả lời hoàn toàn đúng.
 */
export function extractFacts(text: string): NumericFact[] {
  const facts: NumericFact[] = [];
  const taken: [number, number][] = [];
  for (const unit of UNITS) {
    const pattern = new RegExp(`(${NUMBER})(?:${RANGE_SEPARATOR}(${NUMBER}))?\\s*(?:${unit.pattern})`, "gi");
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (taken.some(([from, to]) => start < to && end > from)) continue;
      const low = parseVnNumber(match[1]);
      if (low === null) continue;
      const high = match[2] ? parseVnNumber(match[2]) : null;
      taken.push([start, end]);
      facts.push({
        group: unit.group,
        min: Math.min(low, high ?? low) * unit.factor,
        max: Math.max(low, high ?? low) * unit.factor,
        text: match[0].trim(),
        at: start,
      });
    }
  }
  // Quét theo đơn vị nhưng trả theo thứ tự trong câu: danh sách dữ kiện hỏng đi vào trace và vào
  // bản tóm tắt cho người đọc, nên nó phải khớp với thứ tự họ gặp chúng khi đọc câu trả lời.
  return facts.sort((left, right) => left.at - right.at);
}

/**
 * Sai số chấp nhận được khi đối chiếu.
 *
 * Có sai số vì viết lại cho người đọc thì phải làm tròn: chứng cứ ghi 24,5°C mà câu trả lời viết
 * "khoảng 25 độ" là diễn đạt đúng chứ không phải bịa. Nhưng với TIỀN thì biên phải hẹp, vì lời
 * nhắc của tác tử ngân sách yêu cầu giữ nguyên từng con số và một khoản lệch 5% là một khoản
 * tiền thật.
 */
function tolerance(group: string, value: number): number {
  if (group === "money") return Math.max(1000, Math.abs(value) * 0.01);
  if (group === "temp") return 0.5;
  return Math.max(0.5, Math.abs(value) * 0.05);
}

function supports(fact: NumericFact, source: NumericFact): boolean {
  if (fact.group !== source.group) return false;
  const slack = tolerance(fact.group, source.max);
  // Chứng cứ là một khoảng thì mọi giá trị trong khoảng đều được chống lưng; câu trả lời cũng có
  // thể là một khoảng, khi đó cả hai đầu phải nằm trong chứng cứ.
  return fact.min >= source.min - slack && fact.max <= source.max + slack;
}

export interface FactCheck {
  /** Dữ kiện số không tìm được chỗ nào trong chứng cứ chống lưng. */
  unsupported: string[];
  checked: number;
}

/**
 * Đối chiếu từng dữ kiện số của câu trả lời với các con số có trong chứng cứ.
 *
 * Chứng cứ ở đây gồm CẢ tri thức biên tập lẫn kết quả tool, và đó là chủ ý: câu "mất khoảng sáu
 * đến bảy tiếng" lấy từ cẩm nang cũng có căn cứ đúng như con số 24,5°C lấy từ Open-Meteo. Điều
 * duy nhất bị cấm là một con số không có ở đâu cả.
 */
export function checkNumericFacts(reply: string, evidence: EvidenceBlock[]): FactCheck {
  const sources = evidence.flatMap((block) => extractFacts(block.text));
  const facts = extractFacts(reply);
  const unsupported: string[] = [];
  for (const fact of facts) {
    if (sources.some((source) => supports(fact, source))) continue;
    if (!unsupported.includes(fact.text)) unsupported.push(fact.text);
  }
  return { unsupported, checked: facts.length };
}

/**
 * ĐỘ PHỦ TRÍCH DẪN — đo trên chính CÂU TRẢ LỜI, không đo trên danh sách model tự khai.
 *
 * `verifyCitations` chỉ trả lời được "những ý model KHAI có dẫn nguồn không". Nó mù với kiểu hỏng
 * phổ biến hơn nhiều: model khai đúng một ý, dẫn đúng một mã, rồi viết thêm năm câu khẳng định
 * mà không khai gì. Khi đó `uncitedClaims` bằng 0 và câu trả lời trông hoàn hảo.
 *
 * Nên bước này đi ngược lại: cắt câu trả lời thành câu, rồi hỏi từng câu xem có ý nào đã dẫn
 * nguồn nói về nó không. Denominator là văn bản khách đọc, chứ không phải bản tự khai.
 */

/** Từ chức năng, bỏ đi trước khi so khớp — giữ lại thì câu nào cũng "trùng" câu nào. */
const STOPWORDS = new Set([
  "la", "va", "cua", "co", "o", "cho", "voi", "duoc", "cac", "nhung", "mot", "nay", "do", "ban",
  "thi", "ma", "nen", "tai", "den", "tu", "se", "cung", "khi", "hoac", "hay", "rat", "nhe", "a",
  "ne", "nhieu", "trong", "ngoai", "tren", "duoi", "de", "ve", "theo", "boi", "bang",
]);

/** Bỏ dấu, bỏ dấu câu, cắt thành token đáng kể. Dùng chung cho cả hai phía của phép so khớp. */
function contentTokens(text: string): Set<string> {
  const flat = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  const tokens = flat.split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

/**
 * Cắt câu trả lời thành câu.
 *
 * Dấu chấm CHỈ kết thúc câu khi hai bên không phải chữ số: `1.250.000` là một khoản tiền viết
 * kiểu Việt, và cắt ở đó thì một câu về giá vỡ thành ba mảnh vô nghĩa, mỗi mảnh đều "không dẫn
 * được nguồn". Gạch đầu dòng cũng là ranh giới câu, vì câu trả lời hay ở dạng danh sách.
 */
export function splitClaims(reply: string): string[] {
  return reply
    .split(/(?<![0-9])[.!?…]+(?![0-9])|\n+|(?:^|\n)\s*[-•*]\s+/g)
    .map((part) => part.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Câu có đáng đòi trích dẫn không.
 *
 * Câu chào, câu mời hỏi tiếp và câu hỏi ngược không mang thông tin nào để mà dẫn nguồn; tính
 * chúng vào mẫu số thì độ phủ của một câu trả lời tử tế cũng chỉ quanh 70% và con số mất nghĩa.
 */
const CHITCHAT =
  /^(chào|xin chào|cảm ơn|chúc|hy vọng|mong|nếu cần|bạn (còn|muốn|có)|mình có thể|rất vui|hãy cho mình|còn gì)/i;

function isInformative(sentence: string): boolean {
  if (sentence.endsWith("?")) return false;
  if (CHITCHAT.test(sentence.trim())) return false;
  return contentTokens(sentence).size >= 4;
}

/** Tỷ lệ token của `needle` xuất hiện trong `haystack`. */
function containment(needle: Set<string>, haystack: Set<string>): number {
  if (needle.size === 0) return 0;
  let hit = 0;
  for (const token of needle) if (haystack.has(token)) hit += 1;
  return hit / needle.size;
}

/**
 * Ngưỡng coi một ý đã khai là "nói về" một câu trong câu trả lời.
 *
 * Không đòi trùng khít, vì model thường rút gọn ý khi khai trích dẫn ("Giá vé 40.000đ" cho câu
 * "Vé vào phố cổ Đồng Văn là 40.000đ một người"). 0,6 là chỗ dung được việc rút gọn đó mà vẫn
 * không cho một ý về thời tiết nhận vơ một câu về giá phòng.
 */
const CLAIM_MATCH = 0.6;

export interface CoverageCheck {
  /** Số câu mang thông tin trong câu trả lời — mẫu số của độ phủ. */
  claims: number;
  /** Trong đó, số câu khớp được một ý đã dẫn nguồn hợp lệ. */
  covered: number;
  /** Câu mang DỮ KIỆN SỐ: nhóm mà lời nhắc đã yêu cầu bắt buộc phải có mục trích dẫn riêng. */
  important: number;
  /**
   * Câu quan trọng không khớp ý nào đã dẫn nguồn.
   *
   * Đây là danh sách QUYẾT ĐỊNH trạng thái, không phải danh sách để tham khảo: còn phần tử nào
   * thì câu trả lời không được đánh `grounded`.
   */
  uncoveredImportant: string[];
}

export function checkClaimCoverage(reply: string, citations: CitationCheck): CoverageCheck {
  const claimTokens = citations.verifiedClaims.map(contentTokens);
  const sentences = splitClaims(reply).filter(isInformative);

  let covered = 0;
  let important = 0;
  const uncoveredImportant: string[] = [];

  for (const sentence of sentences) {
    const tokens = contentTokens(sentence);
    // So khớp hai chiều: ý đã khai có thể ngắn hơn câu (model rút gọn) hoặc dài hơn câu (model
    // gộp hai câu vào một ý). Một chiều thôi thì mất một nửa số ca khớp thật.
    const hit = claimTokens.some(
      (claim) => Math.max(containment(claim, tokens), containment(tokens, claim)) >= CLAIM_MATCH,
    );
    if (hit) covered += 1;

    if (extractFacts(sentence).length > 0) {
      important += 1;
      if (!hit) uncoveredImportant.push(sentence);
    }
  }

  return { claims: sentences.length, covered, important, uncoveredImportant };
}

/**
 * Chốt trạng thái căn cứ từ các tín hiệu đã đo được.
 *
 * Thứ tự ưu tiên là có lý do và đọc được từ trên xuống:
 *
 *  1. `toolRequired && toolFailed` đứng TRƯỚC cả phép kiểm chứng cứ. Khách hỏi "hôm nay Đồng Văn
 *     bao nhiêu độ" mà Open-Meteo hỏng thì việc kho tri thức có một bài về khí hậu Đồng Văn không
 *     cứu được gì: dữ kiện được hỏi chỉ tồn tại ở tool. Bản trước đặt phép kiểm này sau
 *     `evidence.length === 0`, nên đúng ca đó trả về `grounded` — có nguồn, có dẫn, và hoàn toàn
 *     không trả lời được câu hỏi.
 *  2. Không có chứng cứ thì mọi phép kiểm sau vô nghĩa.
 *  3. Có dẫn nguồn rồi mới xét tới con số có đúng không.
 *  4. Con số đúng rồi mới xét tới việc đã dẫn ĐỦ chưa.
 *
 * `partially_grounded` tách khỏi `insufficient` chứ không gộp, vì hai thứ đó đòi hai cách xử lý
 * khác nhau: `insufficient` nghĩa là không chứng minh được gì và câu trả lời không nên tới tay
 * khách; `partially_grounded` nghĩa là có nguồn thật, con số đã đối chiếu xong, chỉ là model khai
 * thiếu. Chặn nhóm sau cũng gay gắt như nhóm trước thì mỗi lần model lười khai một câu là một lần
 * khách bị đẩy sang hàng đợi người thật — nên nó được GHI LẠI và đưa vào cổng chất lượng (xem
 * `citation_coverage`, `uncited_claim_rate`) thay vì chặn tại chỗ.
 */
export function resolveGrounding(input: {
  evidence: EvidenceBlock[];
  reply: string;
  citations: CitationCheck;
  facts: FactCheck;
  coverage: CoverageCheck;
  toolFailed: boolean;
  /** Dữ kiện khách hỏi CHỈ có ở tool. Chỉ nơi gọi biết điều này, nên nó được truyền vào. */
  toolRequired: boolean;
}): GroundingStatus {
  if (input.toolFailed && input.toolRequired) return "tool_failed";
  if (input.evidence.length === 0) return input.toolFailed ? "tool_failed" : "no_source";
  if (!input.reply.trim()) return "insufficient";
  if (input.citations.citedIds.length === 0) return "insufficient";
  if (input.facts.unsupported.length > 0) return "unsupported";
  if (input.coverage.uncoveredImportant.length > 0) return "partially_grounded";
  if (input.citations.uncitedClaims > 0) return "partially_grounded";
  return "grounded";
}

/**
 * Số liệu độ phủ ghi vào trace, gộp từ hai phép kiểm.
 *
 * Gộp tại đây chứ không để nơi gọi tự ghép, vì đúng bộ số này là thứ `eval/metrics/grounding.ts`
 * đọc để tính `citation_coverage` và `uncited_claim_rate`. Hai nơi tự ghép thì hai nơi lệch nhau.
 */
export interface CoverageStats {
  /** Số ý model KHAI trong `citations`. */
  claims: number;
  /** Trong đó, số ý không kèm mã nguồn thật nào. */
  uncitedClaims: number;
  /** Số câu mang thông tin trong chính câu trả lời. */
  sentences: number;
  /** Trong đó, số câu khớp được một ý đã dẫn nguồn. */
  coveredSentences: number;
  /** Số câu mang dữ kiện số. */
  importantSentences: number;
  /** Câu mang dữ kiện số mà không dẫn được nguồn nào. */
  uncoveredImportant: string[];
}

export function summarizeCoverage(citations: CitationCheck, coverage: CoverageCheck): CoverageStats {
  return {
    claims: citations.claims,
    uncitedClaims: citations.uncitedClaims,
    sentences: coverage.claims,
    coveredSentences: coverage.covered,
    importantSentences: coverage.important,
    uncoveredImportant: coverage.uncoveredImportant,
  };
}

/**
 * Trục tool, suy ra độc lập với trục căn cứ.
 *
 * `degraded` là trạng thái đáng giá nhất ở đây: nó ghi lại rằng có thứ đã hỏng trong lượt này,
 * nhưng câu trả lời vẫn đứng vững vì dữ kiện được hỏi không nằm ở tool đó. Không có nấc này thì
 * chỉ còn hai lựa chọn tồi — hoặc coi như không có gì xảy ra và mất dấu sự cố, hoặc báo hỏng và
 * làm nhiễu tỷ lệ lỗi bằng những lượt thực ra vẫn phục vụ được khách.
 */
export function resolveToolStatus(input: { used: boolean; failed: boolean; required: boolean }): ToolStatus {
  if (!input.used) return "not_used";
  if (!input.failed) return "ok";
  return input.required ? "failed" : "degraded";
}
