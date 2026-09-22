import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, streamRequest } from "./api";

/**
 * Bộ tách khung SSE ở phía client.
 *
 * Nó phải chịu được đúng những gì mạng làm với một luồng byte: khung bị cắt đôi giữa chừng, nhiều
 * khung về chung một gói, và một ký tự tiếng Việt nằm vắt qua ranh giới hai gói. Cả ba đều không
 * ném lỗi khi xử lý sai — chúng chỉ làm chữ méo hoặc mất sự kiện, nên phải khoá bằng kiểm thử.
 */
function respondWith(packets: (string | Uint8Array)[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const packet of packets) {
        controller.enqueue(typeof packet === "string" ? encoder.encode(packet) : packet);
      }
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

const frame = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

async function drain(packets: (string | Uint8Array)[]) {
  vi.stubGlobal("fetch", vi.fn(async () => respondWith(packets)));
  const seen: Record<string, unknown>[] = [];
  for await (const event of streamRequest("/api/chat/stream", { method: "POST", body: "{}" })) {
    seen.push(event);
  }
  return seen;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("streamRequest", () => {
  it("đọc được các khung về lần lượt, giữ đúng thứ tự", async () => {
    const seen = await drain([
      frame({ type: "session", sessionId: "s1" }),
      frame({ type: "stage", stage: "nlu" }),
      frame({ type: "delta", text: "Mã Pí" }),
      frame({ type: "delta", text: " Lèng" }),
      frame({ type: "final", reply: "Mã Pí Lèng" }),
    ]);

    expect(seen.map((e) => e.type)).toEqual(["session", "stage", "delta", "delta", "final"]);
    expect(seen.filter((e) => e.type === "delta").map((e) => e.text).join("")).toBe("Mã Pí Lèng");
  });

  it("một khung bị cắt làm nhiều gói vẫn ghép lại đúng", async () => {
    const whole = frame({ type: "delta", text: "Đèo Mã Pí Lèng dài 20 km" });
    // Cắt ở mọi vị trí: khung SSE không có gì bảo đảm nó về gọn trong một gói.
    for (let cut = 1; cut < whole.length; cut += 1) {
      const seen = await drain([whole.slice(0, cut), whole.slice(cut)]);
      expect(seen).toEqual([{ type: "delta", text: "Đèo Mã Pí Lèng dài 20 km" }]);
    }
  });

  it("nhiều khung về chung một gói thì tách ra đủ, không bỏ sót khung nào", async () => {
    const seen = await drain([
      frame({ type: "delta", text: "a" }) + frame({ type: "delta", text: "b" }) + frame({ type: "delta", text: "c" }),
    ]);
    expect(seen.map((e) => e.text)).toEqual(["a", "b", "c"]);
  });

  it("ký tự nhiều byte bị cắt giữa hai gói vẫn ra đúng chữ", async () => {
    // Đây là lý do `TextDecoder` phải chạy ở chế độ stream. Giải mã từng gói độc lập thì chữ "è"
    // bị cắt đôi sẽ thành ký tự thay thế ngay giữa câu trả lời.
    const bytes = new TextEncoder().encode(frame({ type: "delta", text: "Mã Pí Lèng" }));
    for (let cut = 1; cut < bytes.length; cut += 1) {
      const seen = await drain([bytes.slice(0, cut), bytes.slice(cut)]);
      expect(seen).toEqual([{ type: "delta", text: "Mã Pí Lèng" }]);
    }
  });

  it("bỏ qua nhịp giữ kết nối, không coi nó là sự kiện", async () => {
    const seen = await drain([": ping\n\n", frame({ type: "delta", text: "x" }), ": ping\n\n"]);
    expect(seen).toEqual([{ type: "delta", text: "x" }]);
  });

  it("khung hỏng chỉ mất đúng khung đó, phần còn lại vẫn về", async () => {
    // Dừng cả luồng ở đây nghĩa là vứt luôn `final` — tức vứt câu trả lời đã qua guardrail.
    const seen = await drain([
      frame({ type: "delta", text: "x" }),
      "data: {khong-phai-json\n\n",
      frame({ type: "final", reply: "Xong." }),
    ]);
    expect(seen.map((e) => e.type)).toEqual(["delta", "final"]);
  });

  it("chịu được kiểu xuống dòng CRLF", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respondWith([`data: ${JSON.stringify({ type: "delta", text: "x" })}\r\n\r\n`])));
    const seen: Record<string, unknown>[] = [];
    for await (const event of streamRequest("/api/chat/stream", { method: "POST", body: "{}" })) seen.push(event);
    expect(seen).toEqual([{ type: "delta", text: "x" }]);
  });

  it("lỗi trước khi luồng mở vẫn ném ApiError kèm đúng mã và thông điệp của server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "Trợ lý AI chưa được cấu hình", details: "Thiếu GEMINI_API_KEY" }), {
        status: 503, headers: { "Content-Type": "application/json" },
      })));

    const read = async () => {
      for await (const _event of streamRequest("/api/chat/stream", { method: "POST", body: "{}" })) { /* không tới đây */ }
    };

    await expect(read()).rejects.toThrow(ApiError);
    await expect(read()).rejects.toThrow("Trợ lý AI chưa được cấu hình — Thiếu GEMINI_API_KEY");
  });
});
