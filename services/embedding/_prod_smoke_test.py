
"""Smoke / contract tests for embedding sidecar before production.

Run while uvicorn is up on 127.0.0.1:8000:
  .venv\\Scripts\\python.exe _prod_smoke_test.py
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.error
import urllib.request
from typing import Any

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0

# Windows consoles often use cp1252; avoid crashing on Vietnamese error text.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def request(method: str, path: str, body: dict | None = None, timeout: float = 600) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return err.code, payload


def check(name: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))


def l2(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def main() -> int:
    print("=== 1. GET /health ===")
    status, health = request("GET", "/health", timeout=10)
    check("health HTTP 200", status == 200, f"got {status}")
    check("status=ok", isinstance(health, dict) and health.get("status") == "ok")
    check("dim=1024", health.get("dim") == 1024, f"got {health.get('dim')}")
    check("device present", "device" in health, str(health.get("device")))
    check("embeddingModel present", bool(health.get("embeddingModel")))
    check("rerankModel present", bool(health.get("rerankModel")))

    print("\n=== 2. POST /embed (first call may load ~2.2GB model) ===")
    texts = [
        "Cao nguyên đá Đồng Văn",
        "Du lịch Hà Giang mùa lúa chín",
        "Cao nguyên đá Đồng Văn",  # duplicate — same vector expected
    ]
    t0 = time.perf_counter()
    status, embed = request("POST", "/embed", {"texts": texts})
    embed_ms = (time.perf_counter() - t0) * 1000
    check("embed HTTP 200", status == 200, f"got {status}: {embed}")
    if status == 200:
        vectors = embed.get("vectors") or []
        check("dim field=1024", embed.get("dim") == 1024)
        check("vector count matches texts", len(vectors) == len(texts), f"{len(vectors)}")
        check("each vector dim=1024", all(len(v) == 1024 for v in vectors))
        norms = [l2(v) for v in vectors]
        check(
            "L2-normalized (~1.0)",
            all(abs(n - 1.0) < 1e-3 for n in norms),
            f"norms={[round(n, 6) for n in norms]}",
        )
        # Cosine of identical texts should be ~1
        same = sum(a * b for a, b in zip(vectors[0], vectors[2]))
        check("identical texts cosine~1", abs(same - 1.0) < 1e-4, f"cos={same:.6f}")
        # Related travel texts should be more similar than unrelated noise
        check("model name returned", bool(embed.get("model")))
        print(f"  INFO  first embed latency: {embed_ms:.0f}ms (includes cold start if any)")

        # Second call latency (warm)
        t1 = time.perf_counter()
        status2, embed2 = request("POST", "/embed", {"texts": ["Cột cờ Lũng Cú"]})
        warm_ms = (time.perf_counter() - t1) * 1000
        check("warm embed HTTP 200", status2 == 200)
        check("warm embed under 3s (NFR-PERF-03 budget)", warm_ms < 3000, f"{warm_ms:.0f}ms")
        print(f"  INFO  warm embed latency: {warm_ms:.0f}ms")

        # health should now show embeddingLoaded
        _, health2 = request("GET", "/health", timeout=10)
        check("embeddingLoaded after embed", health2.get("embeddingLoaded") is True)

    print("\n=== 3. POST /embed validation ===")
    status, _ = request("POST", "/embed", {"texts": []})
    check("empty texts rejected (422)", status == 422, f"got {status}")
    status, _ = request("POST", "/embed", {})
    check("missing texts rejected (422)", status == 422, f"got {status}")

    print("\n=== 4. POST /rerank ===")
    query = "Đèo Mã Pí Lèng ở đâu"
    docs = [
        "Đèo Mã Pí Lèng nằm trên Quốc lộ 4C, đoạn giữa Đồng Văn và Mèo Vạc, Hà Giang.",
        "Phở bò là món ăn phổ biến ở Hà Nội với nước dùng xương bò.",
        "Mã Pí Lèng là một trong những đèo hiểm trở nhất Việt Nam tại Hà Giang.",
    ]
    t0 = time.perf_counter()
    status, rerank = request("POST", "/rerank", {"query": query, "documents": docs})
    rerank_ms = (time.perf_counter() - t0) * 1000
    check("rerank HTTP 200", status == 200, f"got {status}: {rerank}")
    if status == 200:
        scores = rerank.get("scores") or []
        check("scores length matches docs", len(scores) == len(docs), f"{len(scores)}")
        check("scores are numbers", all(isinstance(s, (int, float)) for s in scores))
        # Relevant Hà Giang docs should outrank phở Hà Nội
        best = max(range(len(scores)), key=lambda i: scores[i])
        check("relevant doc ranks above unrelated", best in (0, 2), f"best={best} scores={scores}")
        check("rerank model returned", bool(rerank.get("model")))
        print(f"  INFO  first rerank latency: {rerank_ms:.0f}ms")

        # Warm rerank vs default timeout 2000ms
        t1 = time.perf_counter()
        status2, _ = request(
            "POST",
            "/rerank",
            {"query": query, "documents": docs[:2]},
        )
        warm_ms = (time.perf_counter() - t1) * 1000
        check("warm rerank HTTP 200", status2 == 200)
        check(
            "warm rerank under RERANK_TIMEOUT_MS default (2000ms)",
            warm_ms < 2000,
            f"{warm_ms:.0f}ms",
        )
        print(f"  INFO  warm rerank latency: {warm_ms:.0f}ms")

    status, _ = request("POST", "/rerank", {"query": "x", "documents": []})
    check("empty documents rejected (422)", status == 422, f"got {status}")

    print("\n=== 5. POST /segment (underthesea optional) ===")
    status, seg = request("POST", "/segment", {"texts": ["cao nguyên đá Đồng Văn"]})
    if status == 501:
        check("segment returns 501 when underthesea missing", True, str(seg))
    elif status == 200:
        check("segment HTTP 200", True)
        check(
            "segment texts length matches",
            isinstance(seg, dict) and len(seg.get("texts") or []) == 1,
        )
        print(f"  INFO  segmented: {seg.get('texts')}")
    else:
        check("segment unexpected status", False, f"got {status}: {seg}")

    print("\n=== 6. Contract vs Node client ===")
    # SidecarEmbedder expects {vectors}; segment expects {texts}; rerank expects {scores}
    if status == 200 or True:
        _, e = request("POST", "/embed", {"texts": ["test contract"]})
        check("embed has vectors[]", isinstance(e.get("vectors"), list) if e else False)
        _, r = request("POST", "/rerank", {"query": "a", "documents": ["b"]})
        check("rerank has scores[]", isinstance(r.get("scores"), list) if r else False)

    print("\n=== SUMMARY ===")
    print(f"PASS={PASS}  FAIL={FAIL}")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
