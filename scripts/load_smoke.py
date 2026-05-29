from __future__ import annotations

import argparse
import concurrent.futures
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import urljoin


@dataclass(frozen=True)
class RequestResult:
    path: str
    status: int | None
    latency_ms: float
    error: str | None = None


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a small concurrent smoke test against candidateSignal.ai.")
    parser.add_argument("--base-url", required=True, help="Base URL, for example https://staging.candidatesignal.ai")
    parser.add_argument("--path", action="append", default=None, help="Path to request. Repeatable. Defaults to / and /api/backend/healthz.")
    parser.add_argument("--requests", type=int, default=120, help="Total requests across all paths.")
    parser.add_argument("--concurrency", type=int, default=12, help="Concurrent workers.")
    parser.add_argument("--timeout", type=float, default=10.0, help="Per-request timeout in seconds.")
    parser.add_argument("--max-error-rate", type=float, default=0.01, help="Allowed error rate, e.g. 0.01 for 1%%.")
    parser.add_argument("--max-p95-ms", type=float, default=2500.0, help="Allowed p95 latency in milliseconds.")
    args = parser.parse_args()

    paths = args.path or ["/", "/api/backend/healthz"]
    request_count = max(1, args.requests)
    concurrency = max(1, args.concurrency)
    work = [paths[index % len(paths)] for index in range(request_count)]

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(lambda path: fetch(args.base_url, path, args.timeout), work))
    elapsed = time.perf_counter() - started

    failures = [result for result in results if result.error or not result.status or result.status >= 400]
    latencies = [result.latency_ms for result in results]
    p95 = percentile(latencies, 95)
    error_rate = len(failures) / len(results)

    print(f"base_url={args.base_url}")
    print(f"requests={len(results)} concurrency={concurrency} elapsed={elapsed:.2f}s")
    print(f"error_rate={error_rate:.3%} failures={len(failures)} p50={percentile(latencies, 50):.0f}ms p95={p95:.0f}ms")
    for path in paths:
        path_results = [result for result in results if result.path == path]
        path_failures = [result for result in path_results if result.error or not result.status or result.status >= 400]
        print(f"path={path} count={len(path_results)} failures={len(path_failures)} p95={percentile([item.latency_ms for item in path_results], 95):.0f}ms")
    for failure in failures[:10]:
        print(f"failure path={failure.path} status={failure.status} latency={failure.latency_ms:.0f}ms error={failure.error}")

    if error_rate > args.max_error_rate:
        print(f"error: error rate {error_rate:.3%} exceeded {args.max_error_rate:.3%}")
        return 1
    if p95 > args.max_p95_ms:
        print(f"error: p95 {p95:.0f}ms exceeded {args.max_p95_ms:.0f}ms")
        return 1
    print("load smoke passed")
    return 0


def fetch(base_url: str, path: str, timeout: float) -> RequestResult:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    started = time.perf_counter()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "candidateSignal-load-smoke/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read(512)
            status = response.status
            error = None
    except urllib.error.HTTPError as exc:
        status = exc.code
        error = str(exc)
    except Exception as exc:
        status = None
        error = str(exc)
    latency_ms = (time.perf_counter() - started) * 1000
    return RequestResult(path=path, status=status, latency_ms=latency_ms, error=error)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    ordered = sorted(values)
    return statistics.quantiles(ordered, n=100, method="inclusive")[max(0, min(99, int(pct) - 1))]


if __name__ == "__main__":
    raise SystemExit(main())
