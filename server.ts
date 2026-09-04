import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// AI Concierge Chat Endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Tin nhắn không được để trống" });
  }

  const systemPrompt = `Bạn là Trợ Lý Du Lịch Cao Cấp & Thổ Địa Hà Giang (Hà Giang AI Master Guide & Concierge) thuộc hệ thống "Cinematic Highlands".
Phong cách của bạn: Nhiệt thành, am hiểu sâu sắc từng khúc cua, con đèo, bản làng, con người H'Mông, Dao, Tày, Lô Lô và ẩm thực cao nguyên đá Đồng Văn - Hà Giang.
Giọng điệu: Tinh tế, ấm áp, văn phong giàu hình ảnh, nhấn mạnh an toàn giao thông đường đèo và tôn trọng văn hoá bản địa sâu sắc.

Kiến thức trọng tâm bạn luôn nắm vững:
1. Địa hình & An toàn đường đèo:
   - Các con đèo hiểm trở: Đèo Mã Pí Lèng, Dốc Thẩm Mã (9 khoanh), Dốc Bắc Sum, Dốc Chữ M (Mậu Duệ), Đèo Gió, Dốc Kéo Co.
   - Nguyên tắc sống còn phượt đèo: "Lên số nào xuống số đó" (số 1, số 2), tuyệt đối không tắt máy thả trôi xe, không bóp phanh liên tục gây cháy bố thắng, nhường đường xe tải chở đá ở góc cua mù.
2. Điểm đến không thể bỏ lỡ:
   - Hẻm Tu Sản & Sông Nho Quế (Bến thuyền Tà Làng, ngắm vách đá sâu 800m).
   - Cột cờ Lũng Cú & Làng cổ Lô Lô Chải (nhà trình tường đất sét, quán Cà phê Cực Bắc).
   - Phố cổ Đồng Văn, Dinh thự Vua Mèo Vương Chính Đức tại Sà Phìn.
   - Cổng Trời Quản Bạ, Núi Đôi Cô Tiên.
   - Thác Ba Tiên Du Già và cung đèo Mậu Duệ hoang sơ.
3. Ẩm thực trứ danh: Bánh tam giác mạch nướng, Thắng cố ngựa nguyên bản chợ phiên, Cháo ấu tẩu giải cảm đêm, Phở Tráng Kìm tráng tay dẻo thơm, Rượu ngô men lá Hà Giang, Thịt trâu/lợn gác bếp mắc khén.
4. Mùa du lịch:
   - Tháng 9 - 10: Mùa lúa chín vàng Hoàng Su Phì & thung lũng.
   - Tháng 10 - 12: Mùa hoa tam giác mạch phủ hồng cao nguyên đá.
   - Tháng 12 - 2: Mùa săn mây, hoa đào, hoa lê, hoa mận nở rộ đón xuân.
   - Tháng 5 - 6: Mùa nước đổ lấp lánh như gương trời.

Hãy trả lời bằng tiếng Việt gãy gọn, có cấu trúc bullet point rõ ràng, đưa ra các mẹo thực chiến (Pro Tips) hữu ích và gợi ý câu hỏi tiếp theo cho du khách.`;

  const ai = getGeminiClient();

  if (!ai) {
    // Elegant fallback response when API key is not yet set
    const fallbackResponses: Record<string, string> = {
      default: `Chào bạn! Tôi là Trợ Lý AI Hà Giang của Cinematic Highlands.

Cao nguyên đá Hà Giang mùa này sở hữu vẻ đẹp tráng lệ với không khí mát lành và mây vờn đỉnh núi. Để chuyến đi trọn vẹn nhất, bạn nên lưu ý:
- **Cung đường đẹp nhất**: Vòng cung Hà Giang -> Quản Bạ -> Yên Minh -> Đồng Văn -> Lũng Cú -> Mã Pí Lèng -> Mèo Vạc -> Du Già (350km).
- **Lưu ý an toàn số 1**: Hãy dùng xe số hoặc côn tay (Wave 110, Blade, XR150), đi số 2 khi đổ dốc dài, bật đèn pha khi qua khúc cua sương mù.
- **Điểm ngắm hoàng hôn**: Đỉnh Mã Pí Lèng hoặc mỏm đá Panorama lúc 17h00.

Bạn muốn tôi tư vấn cụ thể về **lịch trình theo ngày**, **kinh nghiệm thuê xe máy**, hay **thời tiết đèo hôm nay**?`
    };

    return res.json({
      reply: fallbackResponses.default,
      suggestions: [
        "Lập lịch trình phượt 3N2Đ chi tiết",
        "Tình trạng thời tiết đèo Mã Pí Lèng hôm nay",
        "Thuê xe máy loại nào tốt nhất ở TP Hà Giang?",
        "Top homestay view đẹp ở Lô Lô Chải và Pả Vi"
      ]
    });
  }

  try {
    const chat = ai.chats.create({
      model: "gemini-3.7-flash",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    // Provide context from conversation history
    for (const hist of conversationHistory.slice(-4)) {
      if (hist.role === 'user') {
        await chat.sendMessage({ message: hist.content });
      }
    }

    const response = await chat.sendMessage({ message: message });
    const replyText = response.text || "Rất tiếc, tôi chưa thể xử lý câu trả lời lúc này. Bạn vui lòng thử lại nhé!";

    return res.json({
      reply: replyText,
      suggestions: [
        "Tư vấn địa điểm ăn uống ngon ở Đồng Văn",
        "Cách đi xuống bến thuyền Sông Nho Quế an toàn",
        "Checklist đồ bảo hộ cần chuẩn bị trước chuyến đi",
        "Có nên tự lái xe máy phượt một mình không?"
      ]
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: "Không thể kết nối đến máy chủ AI",
      details: error.message || "Vui lòng thử lại sau giây lát."
    });
  }
});

// AI Itinerary Generator Endpoint
app.post("/api/plan-itinerary", async (req: Request, res: Response) => {
  const { days = 3, travelMode = "motorbike", vibe = "photography", budget = "comfort", notes = "" } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    // Return structured preset
    return res.json({
      title: `Lịch Trình Hà Giang ${days}N${days - 1}Đ Tối Ưu Tinh Hoa`,
      overview: `Hành trình khám phá trọn vẹn vòng cung cao nguyên đá Hà Giang với phong cách ${vibe}, di chuyển bằng ${travelMode}. Lịch trình được căn chỉnh khoảng cách và thời gian lái xe để đảm bảo an toàn tuyệt đối trước khi trời tối.`,
      status: "preset"
    });
  }

  try {
    const prompt = `Hãy đóng vai chuyên gia thổ địa Hà Giang, lập một lịch trình chi tiết và tinh tế cho chuyến đi ${days} ngày ${days - 1} đêm tại Hà Giang.
Phương tiện: ${travelMode}
Phong cách: ${vibe}
Mức ngân sách: ${budget}
Ghi chú thêm: ${notes || "Không có"}

Yêu cầu output JSON duy nhất theo schema:
{
  "title": "Tên lịch trình hấp dẫn",
  "overview": "Mô tả tổng quan về cung đường và trải nghiệm cốt lõi (khoảng 3 câu)",
  "totalKm": 350,
  "dailyTips": ["mẹo 1", "mẹo 2", "mẹo 3"],
  "days": [
    {
      "day": 1,
      "title": "Tiêu đề chặng ngày",
      "theme": "Chủ đề trải nghiệm",
      "startPoint": "Điểm xuất phát",
      "endPoint": "Điểm dừng chân nghỉ đêm",
      "totalDistanceKm": 130,
      "ridingHours": 4,
      "maxElevationM": 1500,
      "weatherAlert": "Lưu ý thời tiết",
      "eveningStay": {
        "name": "Tên homestay hoặc khu lưu trú",
        "type": "Loại phòng/vibe",
        "vibe": "Không khí",
        "priceEstimate": "Mức giá dự kiến"
      },
      "waypoints": [
        {
          "time": "08:00",
          "title": "Tên điểm dừng",
          "subtitle": "Hoạt động chính",
          "distanceKm": 45,
          "elevationM": 1200,
          "type": "ride",
          "highlight": "Điểm nhấn nổi bật",
          "aiTip": "Lời khuyên thổ địa thông minh"
        }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.6,
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("AI Itinerary Generation Error:", error);
    return res.status(500).json({ error: "Lỗi tạo lịch trình", details: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cinematic Highlands Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
