"""Dịch vụ embedding + rerank cục bộ cho tầng RAG (SRS Mục 11.4).

Vì sao là một dịch vụ Python riêng chứ không gọi API bên ngoài: SRS Mục 11.4.2 chọn
BGE-M3 với lý do thứ tư là "giấy phép mở và tự triển khai được, nên dữ liệu không bắt
buộc phải rời khỏi hạ tầng" — gắn trực tiếp với nghĩa vụ lưu trữ trong nước ở Mục
11.4.8. Chạy tại đây thì không có văn bản nào đi ra ngoài.

Vì sao mặc định CPU: kho tri thức hiện tại chỉ vài trăm đoạn. Ingest trên CPU mất một
vài phút, và một lần embed lúc truy vấn khoảng 50-150ms — nằm trong ngân sách 3 giây
của NFR-PERF-03. Bật GPU là tối ưu hoá sau khi đo, không phải điều kiện để chạy: đặt
EMBEDDING_DEVICE=cuda sau khi đã cài torch bản CUDA đúng với card.

Chỉ bind 127.0.0.1. Dịch vụ này không có xác thực, nên nó không được phơi ra mạng.

    venv\\Scripts\\python.exe -m uvicorn embedding-service.main:app --port 8000
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")

# Phải khớp cột vector(1024) trong prisma/schema.prisma. Đổi số này là phải migrate
# cột và đánh chỉ mục lại toàn bộ, nên nó được kiểm tra ở mỗi lần embed thay vì tin.
EMBEDDING_DIM = 1024

app = FastAPI(title="Travel AI — Embedding Service", version="1.0.0")

# Nạp lazy: tiến trình lên ngay và /health trả lời được trong lúc model còn đang tải
# lần đầu (BGE-M3 khoảng 2,2GB). Nếu nạp ở import thì `uvicorn` treo im lặng vài phút
# và không có cách nào biết nó đang tải hay đã chết.
_embedder: Any = None
_reranker: Any = None


def get_embedder() -> Any:
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer(EMBEDDING_MODEL, device=DEVICE)
    return _embedder


def get_reranker() -> Any:
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder

        _reranker = CrossEncoder(RERANK_MODEL, device=DEVICE)
    return _reranker


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)


class EmbedResponse(BaseModel):
    vectors: list[list[float]]
    dim: int
    model: str


class RerankRequest(BaseModel):
    query: str
    documents: list[str] = Field(min_length=1, max_length=128)


class RerankResponse(BaseModel):
    scores: list[float]
    model: str


class SegmentRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)


class SegmentResponse(BaseModel):
    texts: list[str]


@app.get("/health")
def health() -> dict[str, Any]:
    """Trả riêng trạng thái từng model để phân biệt 'chưa nạp' với 'nạp lỗi'."""
    return {
        "status": "ok",
        "embeddingModel": EMBEDDING_MODEL,
        "embeddingLoaded": _embedder is not None,
        "rerankModel": RERANK_MODEL,
        "rerankLoaded": _reranker is not None,
        "device": DEVICE,
        "dim": EMBEDDING_DIM,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    """Vector đã chuẩn hoá L2, để so sánh cosine trong pgvector là một phép nhân vô hướng."""
    try:
        model = get_embedder()
        vectors = model.encode(
            req.texts,
            normalize_embeddings=True,
            batch_size=8,
            show_progress_bar=False,
        ).tolist()
    except Exception as error:  # noqa: BLE001 - biên ngoài cùng, phải thành HTTP
        raise HTTPException(status_code=503, detail=f"Không nạp/chạy được model embedding: {error}")

    # Sai chiều là lỗi cấu hình model, không phải lỗi dữ liệu. Chặn ở đây để không ghi
    # vector sai chiều vào DB rồi mới vỡ ở tầng SQL với thông báo khó hiểu hơn nhiều.
    if vectors and len(vectors[0]) != EMBEDDING_DIM:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Model {EMBEDDING_MODEL} trả về {len(vectors[0])} chiều, "
                f"cột vector trong schema là {EMBEDDING_DIM}."
            ),
        )

    return EmbedResponse(vectors=vectors, dim=EMBEDDING_DIM, model=EMBEDDING_MODEL)


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest) -> RerankResponse:
    """Chỉ được gọi khi RERANK_ENABLED=true ở phía Node. Model nạp lazy nên tắt cờ thì
    2,2GB của reranker không bao giờ bị tải về."""
    try:
        model = get_reranker()
        scores = model.predict([(req.query, doc) for doc in req.documents]).tolist()
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Không nạp/chạy được model rerank: {error}")

    return RerankResponse(scores=scores, model=RERANK_MODEL)


@app.post("/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest) -> SegmentResponse:
    """Tách từ cho nhánh từ khoá. underthesea không nằm trong requirements.txt vì mặc
    định tắt — báo lỗi rõ ràng thay vì để ImportError lộ ra dưới dạng 500."""
    try:
        from underthesea import word_tokenize
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Chưa cài underthesea. Cài: pip install underthesea==6.8.4",
        )

    return SegmentResponse(
        texts=[word_tokenize(text, format="text") for text in req.texts]
    )
