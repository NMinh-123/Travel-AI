import { describe, expect, it } from "vitest";
import {
  checkClaimCoverage, checkNumericFacts, extractFacts, parseVnNumber, resolveGrounding,
  resolveToolStatus, splitClaims, verifyCitations, type EvidenceBlock,
} from "./grounding";
import { inspect } from "./guardrail";
import type { AgentResult } from "./types";

const knowledge = (id: string, text: string): EvidenceBlock => ({
  id, kind: "knowledge", label: `Đoạn ${id}`, text, sourceRef: `food:${id}`, docId: `doc-${id}`,
});

describe("KG-01: mã trích dẫn phải có thật", () => {
  const evidence = [knowledge("K1", "Nội dung một"), knowledge("K2", "Nội dung hai")];

  it("giữ mã thật, loại mã model bịa, và đếm ý không có nguồn", () => {
    const check = verifyCitations(
      [
        { claim: "ý một", sourceIds: ["K1"] },
        { claim: "ý hai", sourceIds: ["K9"] },
        { claim: "ý ba", sourceIds: [] },
        { claim: "ý bốn", sourceIds: ["k2", "[K1]"] },
      ],
      evidence,
    );
    expect(check.citedIds).toEqual(["K1", "K2"]);
    expect(check.unknownIds).toEqual(["K9"]);
    expect(check.uncitedClaims).toBe(2);
  });

  it("không có khai báo nào thì không có gì được tính là đã dẫn nguồn", () => {
    expect(verifyCitations(undefined, evidence).citedIds).toEqual([]);
    expect(verifyCitations([], evidence).citedIds).toEqual([]);
  });
});

describe("KG-02: đọc số viết kiểu Việt", () => {
  it.each([
    ["1.250.000", 1_250_000],
    ["24,5", 24.5],
    ["150", 150],
    ["1.000", 1000],
  ])("%s -> %s", (raw, value) => {
    expect(parseVnNumber(raw)).toBe(value);
  });

  it("km/h không bị đọc thành km", () => {
    const facts = extractFacts("gió 45 km/h, cách 150 km");
    expect(facts.filter((fact) => fact.group === "speed").map((fact) => fact.min)).toEqual([45]);
    expect(facts.filter((fact) => fact.group === "distance").map((fact) => fact.min)).toEqual([150]);
  });

  it("đọc được khoảng nhiệt độ và quy đổi đơn vị tiền", () => {
    expect(extractFacts("18–24°C")).toEqual([{ group: "temp", min: 18, max: 24, text: "18–24°C", at: 0 }]);
    expect(extractFacts("khoảng 1,25 triệu đồng")[0]).toMatchObject({ group: "money", min: 1_250_000 });
    expect(extractFacts("350 nghìn")[0]).toMatchObject({ group: "money", min: 350_000 });
  });

  it("không nhầm 'độ ẩm' và 'độ cao' thành nhiệt độ", () => {
    expect(extractFacts("độ ẩm 78%, ở độ cao 1500 m").filter((fact) => fact.group === "temp")).toEqual([]);
  });
});

describe("KG-03: đối chiếu dữ kiện số với chứng cứ", () => {
  const weather: EvidenceBlock = {
    id: "W1", kind: "realtime", label: "Đồng Văn",
    text: "Hiện tại: 24,5°C, gió 12 km/h\nDự báo:\n  - 16/09: 18–24°C",
    sourceRef: "open-meteo",
  };

  it("số có trong chứng cứ thì đạt, kể cả khi làm tròn khi viết lại", () => {
    expect(checkNumericFacts("Đồng Văn 24,5°C, gió 12 km/h.", [weather]).unsupported).toEqual([]);
    expect(checkNumericFacts("Khoảng 25 độ.", [weather]).unsupported).toEqual([]);
    // Nằm trong dải dự báo 18–24°C.
    expect(checkNumericFacts("Ngày mai quanh 21°C.", [weather]).unsupported).toEqual([]);
  });

  it("số không có ở đâu trong chứng cứ thì bị nêu tên", () => {
    const check = checkNumericFacts("Nhiệt độ 35°C và gió 90 km/h.", [weather]);
    expect(check.unsupported).toEqual(["35°C", "90 km/h"]);
    expect(check.checked).toBe(2);
  });

  it("tiền dùng biên hẹp vì lời nhắc yêu cầu giữ nguyên từng con số", () => {
    const table = knowledge("B1", "- TỔNG MỘT NGƯỜI: 3.250.000đ");
    expect(checkNumericFacts("Tổng khoảng 3.250.000đ.", [table]).unsupported).toEqual([]);
    expect(checkNumericFacts("Tổng khoảng 3.500.000đ.", [table]).unsupported).toEqual(["3.500.000đ"]);
  });

  it("số lấy từ tri thức biên tập cũng là số có căn cứ", () => {
    const guide = knowledge("K1", "Xe chạy khoảng sáu đến bảy tiếng, quãng đường 300 km.");
    expect(checkNumericFacts("Quãng đường 300 km.", [guide]).unsupported).toEqual([]);
  });
});

describe("KG-04: sáu trạng thái căn cứ", () => {
  const base = {
    evidence: [knowledge("K1", "Nội dung")],
    reply: "Câu trả lời",
    citations: {
      citedIds: ["K1"], unknownIds: [], uncitedClaims: 0, claims: 1, verifiedClaims: ["Câu trả lời"],
    },
    facts: { unsupported: [], checked: 1 },
    coverage: { claims: 1, covered: 1, important: 0, uncoveredImportant: [] },
    toolFailed: false,
    toolRequired: false,
  };

  it("không chứng cứ và tool không hỏng -> no_source", () => {
    expect(resolveGrounding({ ...base, evidence: [] })).toBe("no_source");
  });

  it("không chứng cứ vì tool hỏng -> tool_failed, KHÔNG phải no_source", () => {
    expect(resolveGrounding({ ...base, evidence: [], toolFailed: true })).toBe("tool_failed");
  });

  it("có chứng cứ nhưng không dẫn được nguồn nào -> insufficient", () => {
    expect(resolveGrounding({ ...base, citations: { ...base.citations, citedIds: [] } })).toBe("insufficient");
    expect(resolveGrounding({ ...base, reply: "   " })).toBe("insufficient");
  });

  it("dẫn đúng nguồn nhưng số không kiểm được -> unsupported", () => {
    expect(resolveGrounding({ ...base, facts: { unsupported: ["35°C"], checked: 1 } })).toBe("unsupported");
  });

  it("đủ mọi điều kiện -> grounded", () => {
    expect(resolveGrounding(base)).toBe("grounded");
  });

  /**
   * Hai bài dưới đây là lý do `partially_grounded` tồn tại. Trước khi có nó, cả hai tình huống
   * đều trả về `grounded`, vì `citedIds` không rỗng và không con số nào bịa.
   */
  it("còn ý QUAN TRỌNG không dẫn nguồn -> partially_grounded, không phải grounded", () => {
    expect(
      resolveGrounding({
        ...base,
        coverage: { claims: 2, covered: 1, important: 1, uncoveredImportant: ["Vé vào cổng 50.000đ"] },
      }),
    ).toBe("partially_grounded");
  });

  it("model khai một ý không kèm mã nguồn nào -> partially_grounded", () => {
    expect(
      resolveGrounding({ ...base, citations: { ...base.citations, uncitedClaims: 1, claims: 2 } }),
    ).toBe("partially_grounded");
  });

  /**
   * Trục tool thắng trục căn cứ khi câu hỏi BẮT BUỘC dữ liệu thời gian thực. Đây là ca bản trước
   * trả về `grounded`: Open-Meteo hỏng, nhưng kho tri thức có bài về khí hậu Đồng Văn nên
   * `evidence` không rỗng và mọi phép kiểm sau đều xanh — trong khi câu hỏi "hôm nay bao nhiêu
   * độ" hoàn toàn không được trả lời.
   */
  it("tool hỏng và câu hỏi bắt buộc dữ liệu tool -> tool_failed dù chứng cứ tri thức vẫn đầy đủ", () => {
    expect(resolveGrounding({ ...base, toolFailed: true, toolRequired: true })).toBe("tool_failed");
  });

  it("tool hỏng nhưng câu hỏi KHÔNG cần tới nó -> vẫn grounded", () => {
    expect(resolveGrounding({ ...base, toolFailed: true, toolRequired: false })).toBe("grounded");
  });
});

describe("KG-04b: độ phủ trích dẫn đo trên chính câu trả lời", () => {
  const cite = (...claims: string[]) =>
    verifyCitations(
      claims.map((claim) => ({ claim, sourceIds: ["K1"] })),
      [knowledge("K1", "Nguồn")],
    );

  it("một ý dẫn đúng nguồn, một ý BỊA -> câu bịa không được tính là đã phủ", () => {
    const reply =
      "Phố cổ Đồng Văn nằm trong lòng chảo giữa bốn bề núi đá. " +
      "Khu phố mở cửa đón khách tham quan miễn phí suốt cả tuần.";
    const coverage = checkClaimCoverage(reply, cite("Phố cổ Đồng Văn nằm trong lòng chảo núi đá"));
    expect(coverage.claims).toBe(2);
    expect(coverage.covered).toBe(1);
  });

  it("câu mang CON SỐ mà không có ý nào dẫn nguồn thì bị nêu tên", () => {
    const reply =
      "Phố cổ Đồng Văn nằm trong lòng chảo giữa bốn bề núi đá. Vé vào tham quan là 50.000đ mỗi người.";
    const coverage = checkClaimCoverage(reply, cite("Phố cổ Đồng Văn nằm trong lòng chảo núi đá"));
    expect(coverage.important).toBe(1);
    expect(coverage.uncoveredImportant).toEqual(["Vé vào tham quan là 50.000đ mỗi người"]);
  });

  it("số tiền viết kiểu Việt không làm vỡ câu thành nhiều mảnh", () => {
    expect(splitClaims("Phòng đôi khoảng 1.250.000đ một đêm.")).toEqual([
      "Phòng đôi khoảng 1.250.000đ một đêm",
    ]);
  });

  it("ý khai rút gọn vẫn khớp câu đầy đủ", () => {
    const reply = "Vé vào phố cổ Đồng Văn là 40.000đ một người.";
    expect(checkClaimCoverage(reply, cite("Vé phố cổ Đồng Văn 40.000đ")).uncoveredImportant).toEqual([]);
  });

  it("câu chào và câu hỏi ngược không bị tính vào mẫu số", () => {
    const reply =
      "Chào bạn, rất vui được hỗ trợ. Phố cổ Đồng Văn nằm trong lòng chảo giữa bốn bề núi đá. " +
      "Bạn muốn mình gợi ý thêm chỗ nào không?";
    expect(checkClaimCoverage(reply, cite("Phố cổ Đồng Văn nằm trong lòng chảo núi đá")).claims).toBe(1);
  });

  it("không khai trích dẫn nào thì độ phủ bằng 0, không phải NaN", () => {
    const coverage = checkClaimCoverage("Phố cổ Đồng Văn nằm trong lòng chảo núi đá.", cite());
    expect(coverage).toEqual({ claims: 1, covered: 0, important: 0, uncoveredImportant: [] });
  });
});

describe("KG-04c: trục tool tách khỏi trục căn cứ", () => {
  it("không gọi tool nào -> not_used", () => {
    expect(resolveToolStatus({ used: false, failed: false, required: false })).toBe("not_used");
  });

  it("gọi được -> ok", () => {
    expect(resolveToolStatus({ used: true, failed: false, required: true })).toBe("ok");
  });

  it("hỏng nhưng không bắt buộc -> degraded, để sự cố không biến mất khỏi trace", () => {
    expect(resolveToolStatus({ used: true, failed: true, required: false })).toBe("degraded");
  });

  it("hỏng và bắt buộc -> failed", () => {
    expect(resolveToolStatus({ used: true, failed: true, required: true })).toBe("failed");
  });
});

describe("KG-05: guardrail đọc trạng thái căn cứ", () => {
  const result = (patch: Partial<AgentResult>): AgentResult => ({
    reply: "Có phố cổ Đồng Văn.", suggestions: [], grounding: "grounded",
    evidence: [], retrievedDocIds: [], citedDocIds: [], calls: [], ...patch,
  });

  it("tool hỏng KHÔNG bị chặn: câu trả lời đúng là nói chưa tra được", () => {
    expect(inspect(result({ grounding: "tool_failed" }), "knowledge")).toBeNull();
  });

  /**
   * `partially_grounded` được GHI LẠI chứ không chặn. Câu trả lời có nguồn thật và mọi con số đã
   * đối chiếu xong; thứ còn thiếu là lời khai của model. Chặn ở đây thì mỗi lần model khai thiếu
   * một câu là một lần khách bị đẩy sang hàng đợi người thật, nên nó đi vào cổng chất lượng qua
   * `citation_coverage` thay vì đi vào guardrail.
   */
  it("phủ trích dẫn chưa đủ thì KHÔNG chặn, nhưng cũng không còn là grounded", () => {
    expect(inspect(result({ grounding: "partially_grounded" }), "knowledge")).toBeNull();
  });

  it("thiếu nguồn và không dẫn được nguồn đều bị chặn ở tác tử tri thức", () => {
    expect(inspect(result({ grounding: "no_source" }), "knowledge")).toBe("insufficient");
    expect(inspect(result({ grounding: "insufficient" }), "knowledge")).toBe("insufficient");
  });

  it("phép kiểm thiếu nguồn KHÔNG áp cho tác tử lấy dữ liệu thẳng từ database", () => {
    expect(inspect(result({ grounding: "no_source" }), "discovery")).toBeNull();
  });

  it("dữ kiện số không kiểm được thì chặn ở MỌI tác tử", () => {
    for (const agent of ["knowledge", "budget", "discovery", "itinerary"]) {
      expect(inspect(result({ grounding: "unsupported" }), agent), agent).toBe("unsupported");
    }
  });

  it("rỗng và rò placeholder vẫn được kiểm trước mọi thứ khác", () => {
    expect(inspect(result({ reply: "  ", grounding: "unsupported" }), "knowledge")).toBe("empty");
    expect(inspect(result({ reply: "Gọi __PHONE_1__", grounding: "unsupported" }), "knowledge")).toBe("pii_leak");
  });
});
