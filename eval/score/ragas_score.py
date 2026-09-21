"""Đọc dataset của hệ thống thật, chấm tuần tự bằng bốn metric RAGAS."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import os
import re
import sys
from pathlib import Path
from typing import TypedDict

# Tắt telemetry trước import, không gửi dữ liệu đo ra dịch vụ khác.
os.environ["RAGAS_DO_NOT_TRACK"] = "true"
logging.disable(logging.CRITICAL)

try:
    import httpx
    import instructor
    from google import genai
    from google.genai import types
    from ragas.llms.base import InstructorLLM
    from ragas.metrics.collections import (
        AnswerRelevancy,
        ContextPrecision,
        ContextRecall,
        Faithfulness,
    )
    from sidecar_embeddings import SidecarEmbeddings
except ImportError:
    print("EVAL_ERROR:IMPORT_ERROR", file=sys.stderr)
    sys.exit(1)

METRICS = ("faithfulness", "answer_relevancy", "context_precision", "context_recall")


class Sample(TypedDict):
    id: str
    question: str
    answer: str
    reference: str
    contexts: list[str]
    # Chấm RAGAS hay không. Kịch bản từ chối và hội thoại không gắn tài liệu thì bỏ qua — nhóm chỉ
    # số từ chối và hội thoại nằm ở phía TypeScript, nơi đọc được trace để phân biệt chuyển tiếp
    # có chủ đích với chuyển tiếp vì tác tử ném lỗi. Python không thấy trace nên không phán quyết.
    ragas: bool


class ScoreFailure(Exception):
    def __init__(self, code: str, sample_id: str = ""):
        super().__init__(code)
        self.code = code
        self.sample_id = sample_id


def load_dataset(file: Path) -> list[Sample]:
    result: list[Sample] = []
    seen: set[str] = set()
    for line in file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict):
            raise ScoreFailure("INPUT_ERROR")
        sample_id = row.get("id")
        if not isinstance(sample_id, str) or not re.fullmatch(r"GS-\d{3}", sample_id) or sample_id in seen:
            raise ScoreFailure("INPUT_ERROR")
        seen.add(sample_id)
        if any(not isinstance(row.get(key), str) or not row[key].strip() for key in ("question", "reference")):
            raise ScoreFailure("INPUT_ERROR", sample_id)
        if not isinstance(row.get("answer"), str):
            raise ScoreFailure("INPUT_ERROR", sample_id)
        if type(row.get("ragas")) is not bool:
            raise ScoreFailure("INPUT_ERROR", sample_id)
        if not isinstance(row.get("contexts"), list) or any(not isinstance(v, str) or not v.strip() for v in row["contexts"]):
            raise ScoreFailure("INPUT_ERROR", sample_id)
        # Không bịa điểm 0/1 cho mẫu không thể chấm faithfulness bằng RAGAS.
        if row["ragas"] and (not row["contexts"] or not row["answer"].strip()):
            raise ScoreFailure("INPUT_ERROR", sample_id)
        result.append(Sample(id=sample_id, question=row["question"], answer=row["answer"], reference=row["reference"],
                             contexts=row["contexts"], ragas=row["ragas"]))
    if not result or not any(row["ragas"] for row in result):
        raise ScoreFailure("INPUT_ERROR")
    return result


def checked_score(value: object, sample_id: str) -> float:
    if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
        raise ScoreFailure("INVALID_SCORE", sample_id)
    return float(value)


def create_llm(client: genai.Client, model: str) -> InstructorLLM:
    # llm_factory của ragas 0.4.3 tạo client sync, nhưng collections gọi agenerate.
    # Dùng cùng adapter và nhà cung cấp, chỉ chọn chế độ async một cách tường minh.
    patched = instructor.from_genai(client, use_async=True, mode=instructor.Mode.JSON)
    return InstructorLLM(client=patched, model=model, provider="google", max_retries=3)


async def score_rows(rows: list[Sample], llm: InstructorLLM, embeddings: SidecarEmbeddings) -> dict[str, object]:
    faithfulness = Faithfulness(llm=llm)
    relevancy = AnswerRelevancy(llm=llm, embeddings=embeddings)
    precision = ContextPrecision(llm=llm)
    recall = ContextRecall(llm=llm)
    output: list[dict[str, object]] = []
    values: list[dict[str, float]] = []
    for row in rows:
        if not row["ragas"]:
            output.append({"id": row["id"], "scored": False, "scores": None})
            continue
        try:
            measurements = [
                await faithfulness.ascore(row["question"], row["answer"], row["contexts"]),
                await relevancy.ascore(row["question"], row["answer"]),
                await precision.ascore(row["question"], row["reference"], row["contexts"]),
                await recall.ascore(row["question"], row["contexts"], row["reference"]),
            ]
            scores = {key: checked_score(metric.value, row["id"]) for key, metric in zip(METRICS, measurements)}
        except ScoreFailure:
            raise
        except Exception as error:
            raise ScoreFailure("PROVIDER_ERROR", row["id"]) from error
        values.append(scores)
        output.append({"id": row["id"], "scored": True, "scores": scores})
    if not values:
        raise ScoreFailure("INPUT_ERROR")
    return {"aggregate": {key: sum(value[key] for value in values) / len(values) for key in METRICS},
            "rows": output, "skipped": sum(1 for row in rows if not row["ragas"])}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    key, model, sidecar = (os.environ.get(name, "").strip() for name in ("GEMINI_API_KEY", "EVAL_MODEL", "EMBEDDING_SERVICE_URL"))
    if not key or not model or not sidecar:
        raise ScoreFailure("CONFIG_ERROR")
    calls = 0

    async def count_call(request: httpx.Request) -> None:
        nonlocal calls
        if request.url.path.endswith(":generateContent"):
            calls += 1

    transport = httpx.AsyncClient(timeout=120, event_hooks={"request": [count_call]})
    client = genai.Client(api_key=key, http_options=types.HttpOptions(
        base_url=os.environ.get("GEMINI_BASE_URL") or None, timeout=120000,
        httpx_async_client=transport,
    ))
    try:
        llm = create_llm(client, model)
        embeddings = SidecarEmbeddings(sidecar)
        if args.check:
            if not llm.is_async:
                raise ScoreFailure("CONFIG_ERROR")
            Faithfulness(llm=llm)
            AnswerRelevancy(llm=llm, embeddings=embeddings)
            ContextPrecision(llm=llm)
            ContextRecall(llm=llm)
            return
        if not args.dataset or not args.out:
            raise ScoreFailure("INPUT_ERROR")
        rows = load_dataset(args.dataset)
        scores = await score_rows(rows, llm, embeddings)
        scores["judge_calls"] = calls
        # Ghi thẳng model đã chấm vào file điểm: nó là thứ quyết định điểm có thiên lệch tự chấm
        # hay không, và đọc lại một file điểm cũ mà không biết ai chấm thì con số vô nghĩa.
        scores["judge_model"] = model
        # Ghi đúng một lần sau khi tất cả các mẫu có điểm hợp lệ.
        with args.out.open("x", encoding="utf-8") as file:
            json.dump(scores, file, ensure_ascii=False, allow_nan=False, indent=2)
            file.write("\n")
    finally:
        await client.aio.aclose()
        client.close()
        await transport.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ScoreFailure as error:
        print(f"EVAL_ERROR:{error.code}:{error.sample_id}", file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Không in exception provider, URL, header hoặc nội dung prompt.
        print("EVAL_ERROR:CONFIG_ERROR", file=sys.stderr)
        sys.exit(1)
