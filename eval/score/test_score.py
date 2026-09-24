"""Kiểm RAGAS và SDK thật với HTTP fixture; không dùng mạng hay khoá thật."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from google import genai
from google.genai import types

from ragas_score import Sample, ScoreFailure, checked_score, create_llm, load_dataset, score_rows
from sidecar_embeddings import SidecarEmbeddings, validate_vectors


class ScoreTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_metrics_and_google_sdk_with_mock_transport(self) -> None:
        replies = [
            {"statements": ["Bánh cuốn ăn với nước xương."]},
            {"statements": [{"statement": "Bánh cuốn ăn với nước xương.", "reason": "Có nguồn", "verdict": 1}]},
            *[{"question": "Bánh cuốn chấm gì?", "noncommittal": 0}] * 3,
            {"reason": "Có nguồn", "verdict": 1},
            {"classifications": [{"statement": "Bánh cuốn ăn với nước xương.", "reason": "Có nguồn", "attributed": 1}]},
        ]
        urls: list[str] = []

        async def model_response(request: httpx.Request) -> httpx.Response:
            urls.append(str(request.url))
            body = json.loads(request.content)
            self.assertIn("contents", body)
            self.assertEqual(request.url.host, "fixture.invalid")
            response = replies.pop(0)
            return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": json.dumps(response)}]}, "finishReason": "STOP"}]})

        async def embed_response(_self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
            self.assertEqual(url, "http://sidecar.invalid/embed")
            self.assertIn("json", kwargs)
            return httpx.Response(200, request=httpx.Request("POST", url), json={"vectors": [[1.0] + [0.0] * 1023]})

        transport = httpx.AsyncClient(transport=httpx.MockTransport(model_response))
        client = genai.Client(api_key="fixture-only", http_options=types.HttpOptions(base_url="https://fixture.invalid", httpx_async_client=transport))
        try:
            llm = create_llm(client, "fixture-model")
            sample = Sample(id="GS-001", question="Bánh cuốn chấm gì?", answer="Bánh cuốn ăn với nước xương.",
                            reference="Bánh cuốn ăn với nước xương.", contexts=["Bánh cuốn ăn với nước xương."], ragas=True)
            skipped = Sample(**{**sample, "id": "GS-026", "ragas": False, "contexts": []})
            with patch.object(httpx.AsyncClient, "post", embed_response):
                scores = await score_rows([sample, skipped], llm, SidecarEmbeddings("http://sidecar.invalid"))
            self.assertEqual(len(urls), 7)
            self.assertTrue(all("fixture-model:generateContent" in url for url in urls))
            self.assertFalse(replies)
            self.assertEqual(scores["skipped"], 1)
            self.assertEqual([row["scored"] for row in scores["rows"]], [True, False])
            # Dòng không chấm phải mang scores None chứ không mang một phán quyết từ chối: việc
            # đó đã chuyển sang eval/metrics/refusal.ts, nơi đọc được trace.
            self.assertIsNone(scores["rows"][1]["scores"])
            self.assertNotIn("refusal_pass", scores["rows"][1])
            for metric in scores["aggregate"].values():
                self.assertAlmostEqual(metric, 1.0)
        finally:
            await client.aio.aclose()
            client.close()
            await transport.aclose()

    async def test_provider_flake_is_retried_instead_of_killing_the_run(self) -> None:
        """Điểm cuối chập chờn ở một hàng không được vứt bỏ cả lần chạy — xem PROVIDER_ATTEMPTS."""
        replies = [
            {"statements": ["Bánh cuốn ăn với nước xương."]},
            {"statements": [{"statement": "Bánh cuốn ăn với nước xương.", "reason": "Có nguồn", "verdict": 1}]},
            *[{"question": "Bánh cuốn chấm gì?", "noncommittal": 0}] * 3,
            {"reason": "Có nguồn", "verdict": 1},
            {"classifications": [{"statement": "Bánh cuốn ăn với nước xương.", "reason": "Có nguồn", "attributed": 1}]},
        ]
        # Một lượt 503 là đủ làm hỏng lần thử thứ nhất của HÀNG: `max_retries` của InstructorLLM
        # chỉ thử lại khi phản hồi sai kiểu, không thử lại lỗi HTTP của điểm cuối.
        failures = 1
        seen: list[str] = []

        async def model_response(request: httpx.Request) -> httpx.Response:
            nonlocal failures
            seen.append(str(request.url))
            if failures:
                failures -= 1
                return httpx.Response(503, json={"error": {"message": "fixture: điểm cuối chập chờn"}})
            return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": json.dumps(replies.pop(0))}]}, "finishReason": "STOP"}]})

        async def embed_response(_self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
            return httpx.Response(200, request=httpx.Request("POST", url), json={"vectors": [[1.0] + [0.0] * 1023]})

        transport = httpx.AsyncClient(transport=httpx.MockTransport(model_response))
        client = genai.Client(api_key="fixture-only", http_options=types.HttpOptions(base_url="https://fixture.invalid", httpx_async_client=transport))
        try:
            llm = create_llm(client, "fixture-model")
            sample = Sample(id="GS-001", question="Bánh cuốn chấm gì?", answer="Bánh cuốn ăn với nước xương.",
                            reference="Bánh cuốn ăn với nước xương.", contexts=["Bánh cuốn ăn với nước xương."], ragas=True)
            with patch.object(httpx.AsyncClient, "post", embed_response), patch("ragas_score.PROVIDER_BACKOFF_S", 0):
                scores = await score_rows([sample], llm, SidecarEmbeddings("http://sidecar.invalid"))
            self.assertTrue(scores["rows"][0]["scored"])
            self.assertFalse(replies)
            # Lần thử thứ nhất đã tiêu một request lỗi, nên tổng số request phải nhiều hơn số
            # lượt gọi của một hàng chạy suôn sẻ; không có retry ở mức hàng thì không có điểm nào.
            self.assertGreater(len(seen), 7)
        finally:
            await client.aio.aclose()
            client.close()
            await transport.aclose()

    async def test_provider_down_still_fails_without_inventing_scores(self) -> None:
        """Hết lượt thử thì vẫn hỏng — nới ngưỡng chịu đựng, không nới nguyên tắc."""

        async def always_down(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, json={"error": {"message": "fixture: điểm cuối chết hẳn"}})

        async def embed_response(_self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
            return httpx.Response(200, request=httpx.Request("POST", url), json={"vectors": [[1.0] + [0.0] * 1023]})

        transport = httpx.AsyncClient(transport=httpx.MockTransport(always_down))
        client = genai.Client(api_key="fixture-only", http_options=types.HttpOptions(base_url="https://fixture.invalid", httpx_async_client=transport))
        try:
            llm = create_llm(client, "fixture-model")
            sample = Sample(id="GS-001", question="Câu hỏi", answer="Trả lời",
                            reference="Nguồn", contexts=["Nguồn"], ragas=True)
            with patch.object(httpx.AsyncClient, "post", embed_response), patch("ragas_score.PROVIDER_BACKOFF_S", 0):
                with self.assertRaises(ScoreFailure) as caught:
                    await score_rows([sample], llm, SidecarEmbeddings("http://sidecar.invalid"))
            self.assertEqual(caught.exception.code, "PROVIDER_ERROR")
            self.assertEqual(caught.exception.sample_id, "GS-001")
        finally:
            await client.aio.aclose()
            client.close()
            await transport.aclose()

    def test_dataset_rejects_missing_context_and_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "dataset.jsonl"
            sample = {"id": "GS-001", "question": "Câu hỏi", "answer": "Trả lời", "reference": "Nguồn", "contexts": [], "ragas": True}
            file.write_text(json.dumps(sample), encoding="utf-8")
            with self.assertRaises(ScoreFailure):
                load_dataset(file)
            sample["contexts"] = ["Nguồn"]
            line = json.dumps(sample)
            file.write_text(line + "\n" + line, encoding="utf-8")
            with self.assertRaises(ScoreFailure):
                load_dataset(file)

    def test_invalid_scores_are_never_replaced_with_fake_numbers(self) -> None:
        for value in (float("nan"), float("inf"), None, -0.1, 1.1, True):
            with self.subTest(value=value), self.assertRaises(ScoreFailure):
                checked_score(value, "GS-001")

    def test_sidecar_shape_dimension_and_normalization(self) -> None:
        vector = [1.0] + [0.0] * 1023
        self.assertEqual(validate_vectors({"vectors": [vector]}, 1), [vector])
        for payload in ({}, {"vectors": []}, {"vectors": [[1.0]]}, {"vectors": [[float("nan")] * 1024]}, {"vectors": [[0.0] * 1024]}):
            with self.subTest(payload=str(payload)[:40]), self.assertRaises(ValueError):
                validate_vectors(payload, 1)


if __name__ == "__main__":
    unittest.main()
