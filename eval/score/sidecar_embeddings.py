"""Adapter RAGAS dùng đúng sidecar của tầng truy xuất, không tải model thứ hai."""

import math

import httpx
from ragas.embeddings.base import BaseRagasEmbedding


def validate_vectors(payload: object, count: int) -> list[list[float]]:
    """Không nhận vector thiếu, sai chiều, NaN hoặc vector không chuẩn hoá."""
    if not isinstance(payload, dict) or not isinstance(payload.get("vectors"), list):
        raise ValueError("Sidecar thiếu vectors")
    vectors: list[list[float]] = []
    if len(payload["vectors"]) != count:
        raise ValueError("Sidecar trả sai số vector")
    for vector in payload["vectors"]:
        if not isinstance(vector, list) or len(vector) != 1024:
            raise ValueError("Sidecar trả sai chiều vector")
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in vector):
            raise ValueError("Sidecar trả giá trị không hữu hạn")
        values = [float(v) for v in vector]
        if abs(sum(v * v for v in values) - 1.0) > 0.01:
            raise ValueError("Sidecar trả vector chưa chuẩn hoá")
        vectors.append(values)
    return vectors


class SidecarEmbeddings(BaseRagasEmbedding):
    def __init__(self, url: str):
        super().__init__()
        self.url = url.rstrip("/") + "/embed"

    def embed_text(self, text: str, **kwargs: object) -> list[float]:
        response = httpx.post(self.url, json={"texts": [text]}, timeout=120)
        response.raise_for_status()
        return validate_vectors(response.json(), 1)[0]

    async def aembed_text(self, text: str, **kwargs: object) -> list[float]:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(self.url, json={"texts": [text]})
            response.raise_for_status()
            return validate_vectors(response.json(), 1)[0]
