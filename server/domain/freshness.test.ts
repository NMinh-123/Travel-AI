import { describe, expect, it } from "vitest";
import { daysLeft, describeFreshness, priceDatum, PRICE_TTL_DAYS } from "./freshness";

const NOW = new Date("2026-09-21T00:00:00.000Z");
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Điều nhóm này bảo vệ không phải là một con số mà là một CÂU: khách chỉ được nghe "giá hiện tại"
 * khi con số ấy thật sự còn hiệu lực. Không có ranh giới đó thì một khoảng giá khảo sát nửa năm
 * trước được nói ra y hệt một khoảng giá vừa kiểm hôm qua.
 */

describe("KF-01: dữ liệu còn hiệu lực hay đã cũ", () => {
  it("dữ liệu còn hạn thì được phép nói là hiện hành", () => {
    const result = describeFreshness(
      { observedAt: day("2026-09-01"), expiresAt: day("2026-12-01"), source: "ivivu", confidence: "estimated" },
      NOW,
    );
    expect(result.stale).toBe(false);
    expect(result.instruction).toContain("Được phép");
    expect(result.label).toContain("còn hiệu lực");
  });

  it("dữ liệu quá hạn thì bị CẤM nói hiện tại, và lệnh cấm nêu đích danh từng chữ", () => {
    const result = describeFreshness(
      { observedAt: day("2025-01-01"), expiresAt: day("2025-07-01"), source: "ivivu", confidence: "estimated" },
      NOW,
    );
    expect(result.stale).toBe(true);
    expect(result.instruction).toContain("KHÔNG được nói");
    for (const banned of ["hiện tại", "đang", "hôm nay", "bây giờ"]) {
      expect(result.instruction).toContain(banned);
    }
    expect(result.label).toContain("ĐÃ QUÁ HẠN");
  });

  /**
   * Không có hạn nghĩa là KHÔNG cũ, không phải "không biết". Gộp hai thứ đó sẽ gắn cờ cũ lên toàn
   * bộ nội dung biên tập của dự án, và khi mọi thứ đều bị gắn cờ thì cái cờ mất hết ý nghĩa.
   */
  it("dữ liệu không có hạn thì không bao giờ cũ", () => {
    const result = describeFreshness(
      { observedAt: day("2020-01-01"), expiresAt: null, source: "cẩm nang", confidence: "verified" },
      NOW,
    );
    expect(result.stale).toBe(false);
    expect(daysLeft({ observedAt: null, expiresAt: null, source: "x", confidence: "verified" })).toBeNull();
  });

  it("nội dung ước lượng không hạn vẫn phải nói rõ là ước lượng", () => {
    const result = describeFreshness(
      { observedAt: null, expiresAt: null, source: "mặt bằng thị trường", confidence: "estimated" },
      NOW,
    );
    expect(result.stale).toBe(false);
    expect(result.instruction).toContain("KHÔNG được nói");
  });
});

describe("KF-02: hạn của một khoảng giá suy từ ngày khảo sát", () => {
  it(`giá khảo sát trong ${PRICE_TTL_DAYS} ngày gần đây còn hiệu lực`, () => {
    const datum = priceDatum("2026-09-09", "ivivu", "estimated");
    expect(describeFreshness(datum, NOW).stale).toBe(false);
    expect(daysLeft(datum, NOW)).toBeGreaterThan(0);
  });

  it("giá khảo sát quá lâu thì hết hiệu lực", () => {
    const datum = priceDatum("2025-01-01", "ivivu", "estimated");
    expect(describeFreshness(datum, NOW).stale).toBe(true);
    expect(daysLeft(datum, NOW)).toBeLessThan(0);
  });

  it("ngày khảo sát hỏng thì coi như không có hạn, không ném lỗi", () => {
    const datum = priceDatum("không-phải-ngày", "ivivu", "estimated");
    expect(datum.observedAt).toBeNull();
    expect(datum.expiresAt).toBeNull();
    expect(describeFreshness(datum, NOW).stale).toBe(false);
  });
});
