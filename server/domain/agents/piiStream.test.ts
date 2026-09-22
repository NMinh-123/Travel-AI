import { describe, expect, it } from "vitest";
import { PiiMasker, StreamingPiiRestorer, hasLeftoverPlaceholder } from "./pii";

/**
 * Khôi phục dữ liệu cá nhân trên dòng chữ chảy dần.
 *
 * Đây là chỗ streaming làm hỏng một thứ vốn đang đúng: `PiiMasker.restore` chạy trên cả câu trả
 * lời thì không bao giờ gặp vấn đề, nhưng model sinh chữ theo token nên `__PHONE_1__` hoàn toàn
 * có thể về làm nhiều đoạn. Gọi `restore` cho từng đoạn thì không đoạn nào chứa đủ ký hiệu để
 * thay, và khách đọc được nguyên ký hiệu nội bộ giữa câu.
 */
describe("StreamingPiiRestorer", () => {
  function maskerFor(text: string) {
    const masker = new PiiMasker();
    const masked = masker.mask(text);
    return { masker, masked };
  }

  /** Cắt một chuỗi thành từng mẩu `size` ký tự, mô phỏng cách chunk về từ model. */
  const chop = (text: string, size: number): string[] =>
    Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));

  it("ghép lại đúng nguyên văn dù placeholder bị cắt ở bất kỳ đâu", () => {
    const original = "Bạn gọi giúp mình số 0912345678 nhé, hoặc mail toi@vidu.vn";
    const { masker, masked } = maskerFor(original);
    // Xác nhận tiền đề: câu đã che thật sự có ký hiệu, nếu không phép kiểm dưới đây vô nghĩa.
    expect(hasLeftoverPlaceholder(masked)).toBe(true);

    for (let size = 1; size <= masked.length; size += 1) {
      const restorer = new StreamingPiiRestorer(masker);
      const out = chop(masked, size).map((chunk) => restorer.push(chunk)).join("") + restorer.flush();
      expect(out).toBe(original);
    }
  });

  it("không bao giờ đẩy ra một ký hiệu che dữ liệu, kể cả ở mẩu giữa chừng", () => {
    const { masker, masked } = maskerFor("số của mình là 0912345678");

    for (let size = 1; size <= masked.length; size += 1) {
      const restorer = new StreamingPiiRestorer(masker);
      for (const chunk of chop(masked, size)) {
        expect(hasLeftoverPlaceholder(restorer.push(chunk))).toBe(false);
      }
      expect(hasLeftoverPlaceholder(restorer.flush())).toBe(false);
    }
  });

  it("chữ thường không bị giữ lại chờ vô cớ", () => {
    // Đuôi giữ lại chỉ được là thứ CÓ THỂ lớn lên thành placeholder. Giữ cả chữ bình thường thì
    // dòng chữ khựng thấy được, và đó là đúng thứ streaming sinh ra để tránh.
    const restorer = new StreamingPiiRestorer(new PiiMasker());
    expect(restorer.push("Mã Pí Lèng dài 20 km.")).toBe("Mã Pí Lèng dài 20 km.");
    expect(restorer.flush()).toBe("");
  });

  it("dấu gạch dưới trong câu bình thường vẫn đi qua được", () => {
    const restorer = new StreamingPiiRestorer(new PiiMasker());
    const out = restorer.push("xem file ten__file.txt rồi báo lại") + restorer.flush();
    expect(out).toBe("xem file ten__file.txt rồi báo lại");
  });

  it("flush đẩy nốt phần còn treo, không nuốt mất đoạn nào", () => {
    const restorer = new StreamingPiiRestorer(new PiiMasker());
    // `__PHO` là nửa đầu hợp lệ của một placeholder nên nó bị giữ lại chờ thêm chữ; model dừng ở
    // đây thì flush phải trả nó ra nguyên văn chứ không bỏ đi.
    expect(restorer.push("gọi __PHO")).toBe("gọi ");
    expect(restorer.flush()).toBe("__PHO");
  });
});
