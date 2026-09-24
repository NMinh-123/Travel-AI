import { createServer } from "node:http";

/**
 * MÁY CHỦ GIẢ THAY CHO GEMINI, dùng cho E2E.
 *
 * VÌ SAO KHÔNG GỌI MODEL THẬT TRONG E2E. Ba lý do, và lý do thứ ba mới là lý do quyết định:
 * mỗi lần chạy CI tốn tiền; phản hồi của model không tất định nên test sẽ đỏ ngẫu nhiên; và E2E
 * sinh ra để kiểm LUỒNG — đăng nhập, gửi tin, tải lại trang, khôi phục lịch sử — chứ không phải
 * để kiểm chất lượng câu trả lời. Chất lượng câu trả lời đã có bộ đánh giá riêng ở `eval/`, chạy
 * theo lịch với model thật.
 *
 * Nhận dạng lượt gọi bằng CHÍNH LƯỢC ĐỒ mà nơi gọi gửi lên, không bằng đường dẫn: mọi lượt đều
 * tới `:generateContent`, còn bộ trường trong `responseSchema` thì khác nhau ở từng nơi gọi. Đây
 * cũng là cách `recoverProseReply` trong server/infra/gemini.ts nhận ra mình đang ở lượt nào.
 */

const EMBEDDING_DIM = 1024;

/**
 * MỘT vector duy nhất cho mọi văn bản.
 *
 * Nghe như bỏ qua mất chất lượng, nhưng đó đúng là điều cần: E2E kiểm LUỒNG, và một vector chung
 * làm cho mọi truy vấn chắc chắn khớp mọi tài liệu (cosine bằng 1). Vector phụ thuộc nội dung thì
 * câu hỏi và tài liệu gần như không bao giờ trùng trục, truy xuất trả rỗng, tác tử chuyển tiếp —
 * và test đỏ vì một lý do nằm ngoài thứ nó muốn kiểm. Thứ hạng truy xuất đã có bộ đo riêng ở
 * `scripts/retrieval-ablation.ts`, chạy với model thật.
 */
function fakeVector(): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  vector[0] = 1;
  return vector;
}

const NLU_REPLY = {
  intent: "knowledge",
  confidence: 0.92,
  wantsHuman: false,
  destinations: ["Đồng Văn"],
  days: 0,
  travelers: 0,
  temporalPhrases: [],
};

const CHAT_REPLY = {
  reply: "Phố cổ Đồng Văn nằm gọn trong lòng chảo, buổi tối rất tĩnh. [Trả lời từ máy chủ giả E2E]",
  suggestions: ["Chợ phiên Đồng Văn họp hôm nào?", "Ngủ ở Đồng Văn chọn chỗ nào?"],
  citations: [{ claim: "Phố cổ Đồng Văn nằm gọn trong lòng chảo.", sourceIds: ["K1"] }],
};

const ITINERARY_REPLY = {
  title: "Hà Giang 2 ngày 1 đêm",
  overview: "Vòng cung ngắn từ thành phố lên Yên Minh rồi quay về.",
  totalKm: 192,
  dailyTips: ["Mang áo gió cho đoạn đèo."],
  days: [
    {
      day: 1, title: "Vào cao nguyên", theme: "Đường lên",
      startPoint: "Thành phố Hà Giang", endPoint: "Yên Minh",
      totalDistanceKm: 96, ridingHours: 4, maxElevationM: 1500, scenicRating: 5,
      weatherAlert: "Sáng sớm có sương.",
      eveningStay: { name: "Khách sạn Thiên Ân Yên Minh", type: "Khách sạn", vibe: "Yên Minh", priceEstimate: "" },
      waypoints: [
        { time: "07:00", title: "Dốc Bắc Sum", subtitle: "Cửa vào vùng đá", distanceKm: 20, elevationM: 900, type: "ride", highlight: "Cua tay áo xếp lớp", aiTip: "Dừng ở khoảng lề rộng, không dừng trong cua." },
        { time: "09:30", title: "Cổng Trời Quản Bạ", subtitle: "Đài quan sát", distanceKm: 45, elevationM: 1500, type: "viewpoint", highlight: "Thung lũng Tam Sơn", aiTip: "Lên sớm khi sương chưa tan." },
        { time: "12:00", title: "Tam Sơn", subtitle: "Ăn trưa", distanceKm: 50, elevationM: 1000, type: "meal", highlight: "Thị trấn giữa thung lũng", aiTip: "Đổ đầy xăng tại đây." },
        { time: "15:30", title: "Yên Minh", subtitle: "Nghỉ đêm", distanceKm: 96, elevationM: 1100, type: "stay", highlight: "Rừng thông", aiTip: "Về trước khi trời tối." },
      ],
    },
    {
      day: 2, title: "Quay về", theme: "Đường xuống",
      startPoint: "Yên Minh", endPoint: "Thành phố Hà Giang",
      totalDistanceKm: 96, ridingHours: 4, maxElevationM: 1500, scenicRating: 4,
      weatherAlert: "Chiều có thể mưa.",
      eveningStay: { name: "Kết thúc hành trình", type: "Không nghỉ đêm", vibe: "", priceEstimate: "" },
      waypoints: [
        { time: "08:00", title: "Rừng thông Yên Minh", subtitle: "Nghỉ chân", distanceKm: 10, elevationM: 1100, type: "rest", highlight: "Đồi thông", aiTip: "Quãng dễ lái nhất tuyến." },
        { time: "10:30", title: "Cổng Trời Quản Bạ", subtitle: "Ngắm lần cuối", distanceKm: 45, elevationM: 1500, type: "viewpoint", highlight: "Núi Đôi", aiTip: "Gió mạnh, mặc thêm áo." },
        { time: "13:00", title: "Dốc Bắc Sum", subtitle: "Đổ đèo", distanceKm: 75, elevationM: 900, type: "ride", highlight: "Nhìn lại vùng đá", aiTip: "Ghì máy thay vì rà phanh." },
        { time: "15:00", title: "Thành phố Hà Giang", subtitle: "Kết thúc", distanceKm: 96, elevationM: 300, type: "rest", highlight: "Trả xe", aiTip: "Kiểm lại xe trước khi trả." },
      ],
    },
  ],
};

/** Chọn phản hồi theo bộ trường của lược đồ mà nơi gọi gửi lên. */
function replyFor(body: unknown): unknown {
  const schema = (body as { generationConfig?: { responseSchema?: { properties?: Record<string, unknown> } } })
    ?.generationConfig?.responseSchema?.properties;
  const keys = new Set(Object.keys(schema ?? {}));

  if (keys.has("intent") && keys.has("wantsHuman")) return NLU_REPLY;
  if (keys.has("days") && keys.has("totalKm")) return ITINERARY_REPLY;
  return CHAT_REPLY;
}

export function startMockGemini(port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? (JSON.parse(raw) as unknown) : {};
      const url = req.url ?? "";

      if (url.includes(":embedContent") || url.includes(":batchEmbedContents")) {
        res.setHeader("Content-Type", "application/json");
        const contents = (body as { contents?: unknown }).contents;
        const texts = Array.isArray(contents) ? contents : [contents ?? ""];
        res.end(JSON.stringify({ embeddings: texts.map(() => ({ values: fakeVector() })) }));
        return;
      }

      const payload = JSON.stringify(replyFor(body));
      const usageMetadata = { promptTokenCount: 100, candidatesTokenCount: 200 };

      /**
       * Đường STREAMING, dùng bởi `POST /api/chat/stream`.
       *
       * Máy chủ giả này từng chỉ biết trả một khối JSON, nên khi giao diện chuyển sang streaming
       * thì CẢ BỐN bài e2e về chat cùng đỏ một lúc — kể cả bài không liên quan gì tới tính năng
       * mới. SDK gọi `:streamGenerateContent?alt=sse` và chờ một luồng SSE; nhận về một object
       * JSON thì nó không đọc ra được chunk nào, và biểu hiện ở phía khách là khung chat trống.
       *
       * Cắt payload thành nhiều mẩu nhỏ chứ không đẩy một lần: chính việc cắt mới kiểm được
       * `partialReplyText` — bộ rút `reply` từ JSON gõ dần — trên đường đi thật. Đẩy nguyên khối
       * thì bài e2e vẫn xanh kể cả khi bộ đó hỏng hoàn toàn.
       */
      if (url.includes(":streamGenerateContent")) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");

        const frame = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        for (const piece of payload.match(/[\s\S]{1,24}/g) ?? []) {
          frame({ candidates: [{ content: { role: "model", parts: [{ text: piece }] } }] });
        }
        frame({
          candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP" }],
          usageMetadata,
        });
        res.end();
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: payload }] }, finishReason: "STOP" }],
          usageMetadata,
        }),
      );
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

// Chạy trực tiếp: `tsx e2e/mock-gemini.ts 4010`.
if (process.argv[1]?.includes("mock-gemini")) {
  const port = Number(process.argv[2] ?? 4010);
  startMockGemini(port);
  console.log(`Mock Gemini đang nghe ở http://127.0.0.1:${port}`);
}
