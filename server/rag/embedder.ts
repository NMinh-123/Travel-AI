import { config } from "../config";
import { AiUnavailableError, getGeminiClient } from "../gemini";

/**
 * Số chiều vector, phải khớp cột `vector(1024)` của KnowledgeDoc và chỉ mục HNSW đi kèm.
 *
 * Chọn 1024 vì đó là số chiều gốc của BGE-M3 (SRS Mục 11.4.2: "điểm cân bằng giữa chất lượng
 * và chi phí lưu trữ/chỉ mục trong pgvector"). Bản Gemini bị buộc về đúng số này để đổi nguồn
 * embedding không phải migrate cột — nhưng vẫn phải chạy lại ingest, vì hai model sinh ra hai
 * không gian vector khác nhau và trộn lẫn thì điểm tương đồng vô nghĩa.
 */
export const EMBEDDING_DIM = 1024;

export interface Embedder {
  readonly kind: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

function assertDim(vectors: number[][], source: string): number[][] {
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `${source} trả về ${vector.length} chiều, cột vector trong schema là ${EMBEDDING_DIM}. ` +
          `Sửa cấu hình model hoặc migrate cột — đừng ghi vector sai chiều vào DB.`,
      );
    }
  }
  return vectors;
}

/** Chuẩn hoá L2 để so sánh cosine trong pgvector là một phép nhân vô hướng. */
function normalize(vector: number[]): number[] {
  let sumOfSquares = 0;
  for (const value of vector) sumOfSquares += value * value;

  const norm = Math.sqrt(sumOfSquares);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

/**
 * BGE-M3 qua sidecar Python cục bộ. Đây là bản mặc định: SRS Mục 11.4.2 chọn BGE-M3 một phần
 * vì tự triển khai được nên văn bản không phải rời khỏi hạ tầng (Mục 11.4.8).
 */
class SidecarEmbedder implements Embedder {
  readonly kind = "bge-m3";
  readonly model = "BAAI/bge-m3";

  async embed(texts: string[]): Promise<number[][]> {
    let response: globalThis.Response;
    try {
      response = await fetch(`${config.embeddingServiceUrl}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
    } catch (error: any) {
      // Phân biệt "sidecar không chạy" với "sidecar trả lỗi": nguyên nhân và cách sửa khác nhau.
      throw new Error(
        `Không kết nối được dịch vụ embedding tại ${config.embeddingServiceUrl}. ` +
          `Khởi động: venv\\Scripts\\python.exe -m uvicorn embedding-service.main:app --port 8000 ` +
          `(hoặc đặt EMBEDDER=gemini). Chi tiết: ${error?.message ?? error}`,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Dịch vụ embedding trả về HTTP ${response.status}. ${detail}`.trim());
    }

    const payload = (await response.json()) as { vectors?: number[][] };
    if (!Array.isArray(payload.vectors)) {
      throw new Error("Dịch vụ embedding trả về phản hồi không có trường `vectors`.");
    }

    // Sidecar đã chuẩn hoá sẵn (normalize_embeddings=True), không chuẩn hoá lần hai.
    return assertDim(payload.vectors, this.model);
  }
}

/**
 * Gemini embedding API. Không phải bản mặc định, nhưng cần có: sidecar cần torch và một model
 * 2,2GB, nên đây là đường để ingest chạy được ngay khi chỉ có API key.
 *
 * Đánh đổi phải biết: văn bản đi ra API bên ngoài. SRS Mục 11.4.8 đánh giá rủi ro này là THẤP
 * cho kho tri thức — nội dung đã kiểm duyệt và mang tính công khai, không chứa dữ liệu cá nhân.
 * Đánh giá đó không áp dụng cho nội dung hội thoại của khách, vốn phải qua bước che dữ liệu ở
 * server/agents/pii.ts.
 */
class GeminiEmbedder implements Embedder {
  readonly kind = "gemini";
  readonly model = "gemini-embedding-001";

  async embed(texts: string[]): Promise<number[][]> {
    const ai = getGeminiClient();
    if (!ai) throw new AiUnavailableError();

    const response = await ai.models.embedContent({
      model: this.model,
      contents: texts,
      config: { outputDimensionality: EMBEDDING_DIM },
    });

    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Gemini trả về ${embeddings.length} vector cho ${texts.length} đoạn văn bản.`,
      );
    }

    // Dùng outputDimensionality khác mặc định thì vector KHÔNG còn được chuẩn hoá sẵn, phải tự
    // chuẩn hoá — nếu không, chỉ mục cosine của pgvector cho ra thứ hạng sai.
    const vectors = embeddings.map((embedding) => normalize(embedding.values ?? []));
    return assertDim(vectors, this.model);
  }
}

let cached: Embedder | null = null;

export function getEmbedder(): Embedder {
  if (!cached) {
    cached = config.embedder === "gemini" ? new GeminiEmbedder() : new SidecarEmbedder();
  }
  return cached;
}

/** Định dạng vector cho pgvector qua $queryRaw: '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
