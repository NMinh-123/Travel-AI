import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { ItineraryPlan } from "../src/types";

/**
 * Vai và giọng điệu của trợ lý. Đây là nội dung sản phẩm, không phải cấu hình hạ tầng — sửa ở
 * đây là sửa cách trợ lý nói.
 *
 * TRƯỚC VÒNG 5, prompt này còn chứa cả khối dữ kiện Hà Giang: danh sách đèo, nguyên tắc lái đèo,
 * ẩm thực, bốn mùa du lịch. Toàn bộ phần đó đã chuyển sang bảng KnowledgeDoc và tới tác tử qua
 * truy xuất hybrid search (SRS Mục 11.4) — đóng đúng cái TODO từng nằm ở dòng này.
 *
 * Vì sao chuyển: dữ kiện nằm trong prompt thì mọi lượt gọi đều trả tiền cho toàn bộ khối đó dù
 * khách chỉ hỏi một chi tiết, không sửa được nội dung mà không deploy lại, và không trích dẫn
 * được nguồn. Quan trọng hơn cả: model được tự do diễn giải chúng. Giờ tác tử tri thức chỉ nhận
 * đúng vài đoạn đã truy xuất, và không truy xuất được gì thì nó KHÔNG trả lời — xem
 * server/agents/guardrail.ts.
 *
 * Nguyên tắc khi sửa file này: thêm giọng điệu và ràng buộc hành vi thì được, thêm DỮ KIỆN thì
 * không — dữ kiện thuộc về KnowledgeDoc.
 */
export const CONCIERGE_SYSTEM_PROMPT = `Bạn là Trợ Lý Du Lịch Cao Cấp & Thổ Địa Hà Giang (Hà Giang AI Master Guide & Concierge) thuộc hệ thống "Cinematic Highlands".
Phong cách của bạn: Nhiệt thành, am hiểu sâu sắc từng khúc cua, con đèo, bản làng, con người H'Mông, Dao, Tày, Lô Lô và ẩm thực cao nguyên đá Đồng Văn - Hà Giang.
Giọng điệu: Tinh tế, ấm áp, văn phong giàu hình ảnh, nhấn mạnh an toàn giao thông đường đèo và tôn trọng văn hoá bản địa sâu sắc.

Hãy trả lời bằng tiếng Việt gãy gọn, có cấu trúc bullet point rõ ràng, đưa ra các mẹo thực chiến (Pro Tips) hữu ích.`;

/**
 * Buộc model trả về cả câu trả lời và các gợi ý trong một lần gọi, để gợi ý
 * thực sự khớp ngữ cảnh thay vì là một danh sách cố định.
 */
export const CHAT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: "Câu trả lời đầy đủ cho du khách, định dạng markdown.",
    },
    suggestions: {
      type: Type.ARRAY,
      description: "3-4 câu hỏi tiếp theo bám sát chủ đề vừa trao đổi.",
      items: { type: Type.STRING },
    },
  },
  required: ["reply", "suggestions"],
};

export interface ItineraryRequest {
  days: number;
  travelMode: ItineraryPlan["travelMode"];
  vibe: ItineraryPlan["vibe"];
  budget: ItineraryPlan["budgetLevel"];
  notes: string;
}

const TRAVEL_MODE_LABELS: Record<ItineraryPlan["travelMode"], string> = {
  motorbike: "Tự lái xe máy",
  easy_rider: "Ngồi sau tài xế Easy Rider bản địa",
  car_suv: "Ô tô gầm cao",
};

const VIBE_LABELS: Record<ItineraryPlan["vibe"], string> = {
  photography: "Săn mây & nhiếp ảnh góc rộng",
  culture: "Bản làng & văn hoá cổ kính",
  adventure: "Chinh phục cung đèo hiểm trở",
  chill: "Thư giãn, suối nước & homestay chill",
};

const BUDGET_LABELS: Record<ItineraryPlan["budgetLevel"], string> = {
  backpacker: "Tiết kiệm kiểu backpacker",
  comfort: "Tiện nghi vừa phải",
  luxury: "Cao cấp",
};

export const TRAVEL_MODES = Object.keys(TRAVEL_MODE_LABELS) as ItineraryPlan["travelMode"][];
export const VIBES = Object.keys(VIBE_LABELS) as ItineraryPlan["vibe"][];
export const BUDGET_LEVELS = Object.keys(BUDGET_LABELS) as ItineraryPlan["budgetLevel"][];

export function buildItineraryPrompt(req: ItineraryRequest): string {
  return `Hãy đóng vai chuyên gia thổ địa Hà Giang, lập một lịch trình chi tiết và tinh tế cho chuyến đi ${req.days} ngày ${req.days - 1} đêm tại Hà Giang.

Phương tiện: ${TRAVEL_MODE_LABELS[req.travelMode]}
Phong cách: ${VIBE_LABELS[req.vibe]}
Mức ngân sách: ${BUDGET_LABELS[req.budget]}
Ghi chú thêm từ du khách: ${req.notes || "Không có"}

Yêu cầu:
- Đúng ${req.days} phần tử trong mảng "days", đánh số "day" từ 1 đến ${req.days}.
- Căn chỉnh quãng đường và số giờ lái mỗi ngày sao cho luôn về tới nơi nghỉ trước khi trời tối.
- "totalKm" là tổng quãng đường cả hành trình, khớp với tổng "totalDistanceKm" của các ngày.
- Mỗi ngày có 4-6 waypoint, mốc "time" theo định dạng HH:mm và tăng dần trong ngày.
- "aiTip" phải là lời khuyên thực chiến cụ thể, không nói chung chung.`;
}

const WAYPOINT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    time: { type: Type.STRING, description: "Mốc giờ định dạng HH:mm, ví dụ 08:30." },
    title: { type: Type.STRING, description: "Tên điểm dừng." },
    subtitle: { type: Type.STRING, description: "Hoạt động chính tại điểm dừng." },
    distanceKm: { type: Type.NUMBER, description: "Số km luỹ kế tính từ điểm xuất phát trong ngày." },
    elevationM: { type: Type.NUMBER, description: "Độ cao so với mực nước biển, tính bằng mét." },
    type: {
      type: Type.STRING,
      description: "Loại hoạt động tại điểm dừng.",
      enum: ["ride", "viewpoint", "meal", "culture", "stay", "rest"],
    },
    highlight: { type: Type.STRING, description: "Điểm nhấn nổi bật." },
    aiTip: { type: Type.STRING, description: "Lời khuyên thổ địa thực chiến." },
  },
  required: [
    "time",
    "title",
    "subtitle",
    "distanceKm",
    "elevationM",
    "type",
    "highlight",
    "aiTip",
  ],
};

const DAY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.INTEGER, description: "Số thứ tự ngày, bắt đầu từ 1." },
    title: { type: Type.STRING },
    theme: { type: Type.STRING, description: "Chủ đề trải nghiệm của ngày." },
    startPoint: { type: Type.STRING },
    endPoint: { type: Type.STRING, description: "Điểm dừng chân nghỉ đêm." },
    totalDistanceKm: { type: Type.NUMBER },
    ridingHours: { type: Type.NUMBER },
    maxElevationM: { type: Type.NUMBER },
    scenicRating: { type: Type.INTEGER, description: "Điểm cảnh quan từ 1 đến 5." },
    weatherAlert: { type: Type.STRING, description: "Lưu ý thời tiết trong ngày." },
    eveningStay: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        type: { type: Type.STRING, description: "Loại phòng hoặc kiểu lưu trú." },
        vibe: { type: Type.STRING },
        priceEstimate: { type: Type.STRING, description: "Khoảng giá dự kiến, ví dụ 350.000đ - 650.000đ/đêm." },
      },
      required: ["name", "type", "vibe", "priceEstimate"],
    },
    waypoints: { type: Type.ARRAY, items: WAYPOINT_SCHEMA },
  },
  required: [
    "day",
    "title",
    "theme",
    "startPoint",
    "endPoint",
    "totalDistanceKm",
    "ridingHours",
    "maxElevationM",
    "scenicRating",
    "weatherAlert",
    "eveningStay",
    "waypoints",
  ],
};

export const ITINERARY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Tên lịch trình hấp dẫn." },
    overview: { type: Type.STRING, description: "Tổng quan cung đường và trải nghiệm cốt lõi, khoảng 3 câu." },
    totalKm: { type: Type.NUMBER, description: "Tổng quãng đường toàn hành trình." },
    dailyTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    days: { type: Type.ARRAY, items: DAY_SCHEMA },
  },
  required: ["title", "overview", "totalKm", "dailyTips", "days"],
};
