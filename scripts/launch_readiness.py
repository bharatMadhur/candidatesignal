from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRODUCTION_URL = "https://app.candidatesignal.ai"
DEFAULT_STAGING_URL = "https://staging.candidatesignal.ai"
DEFAULT_REMOTE_REFS = ("main", "staging", "codex/v1-redesign")


@dataclass(frozen=True)
class GateResult:
    name: str
    ok: bool
    detail: str


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run candidateSignal.ai launch-readiness gates.")
    parser.add_argument("--expected-sha", default="", help="Expected Git SHA. Defaults to local HEAD.")
    parser.add_argument("--production-url", default=DEFAULT_PRODUCTION_URL)
    parser.add_argument("--staging-url", default=DEFAULT_STAGING_URL)
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--remote-ref", action="append", default=None, help="Remote ref to require at expected SHA. Repeatable.")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--skip-git", action="store_true", help="Skip local/remote Git sync checks.")
    parser.add_argument("--skip-health", action="store_true", help="Skip production/staging deep health checks.")
    parser.add_argument("--run-production-smoke", action="store_true")
    parser.add_argument("--run-staging-e2e", action="store_true")
    parser.add_argument("--run-production-load", action="store_true")
    parser.add_argument("--run-staging-load", action="store_true")
    parser.add_argument("--skip-production-health", action="store_true")
    parser.add_argument("--skip-staging-health", action="store_true")
    parser.add_argument("--staging-qa", action="store_true", help="Run the staging-only pre-promotion gate: staging ref, staging health, staging E2E, and staging load smoke.")
    parser.add_argument("--launch", action="store_true", help="Run the full launch gate: Git, health, production smoke, staging E2E, and production/staging load smoke.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args(argv)

    expected_sha = args.expected_sha.strip() or command_output(["git", "rev-parse", "HEAD"], cwd=ROOT).strip()
    if not expected_sha:
        print("error: expected SHA could not be determined", file=sys.stderr)
        return 1

    if args.launch:
        args.run_production_smoke = True
        args.run_staging_e2e = True
        args.run_production_load = True
        args.run_staging_load = True
    if args.staging_qa:
        args.run_staging_e2e = True
        args.run_staging_load = True
        args.skip_production_health = True
        if args.remote_ref is None:
            args.remote_ref = ["staging"]

    gates: list[GateResult] = []
    if not args.skip_git:
        gates.extend(git_gates(expected_sha, args.remote, tuple(args.remote_ref or DEFAULT_REMOTE_REFS)))
    if not args.skip_health and not args.skip_production_health:
        gates.append(health_gate("production deep health", args.production_url, "production", expected_sha, args.timeout))
    if not args.skip_health and not args.skip_staging_health:
        gates.append(health_gate("staging deep health", args.staging_url, "staging", expected_sha, args.timeout))
    if args.run_production_smoke:
        gates.append(command_gate(
            "production public smoke",
            ["npm", "run", "smoke"],
            cwd=ROOT / "web",
            env={"SMOKE_BASE_URL": args.production_url},
        ))
    if args.run_staging_e2e:
        gates.append(command_gate("authenticated staging E2E", ["scripts/run_staging_e2e_from_secrets.sh"], cwd=ROOT))
    if args.run_production_load:
        gates.append(command_gate(
            "production load smoke",
            [".venv/bin/python", "scripts/load_smoke.py", "--base-url", args.production_url, "--requests", "120", "--concurrency", "12", "--max-p95-ms", "4000"],
            cwd=ROOT,
        ))
    if args.run_staging_load:
        gates.append(command_gate(
            "staging load smoke",
            [".venv/bin/python", "scripts/load_smoke.py", "--base-url", args.staging_url, "--path", "/", "--path", "/healthz", "--requests", "120", "--concurrency", "12", "--max-p95-ms", "4000"],
            cwd=ROOT,
        ))

    if args.json:
        print(json.dumps({"expected_sha": expected_sha, "ok": all(gate.ok for gate in gates), "gates": [asdict(gate) for gate in gates]}, indent=2))
    else:
        print(f"expected_sha={expected_sha}")
        for gate in gates:
            status = "PASS" if gate.ok else "FAIL"
            print(f"{status} {gate.name}: {gate.detail}")
    return 0 if all(gate.ok for gate in gates) else 1


def git_gates(expected_sha: str, remote: str, refs: tuple[str, ...]) -> list[GateResult]:
    gates = [
        command_match_gate("local HEAD", ["git", "rev-parse", "HEAD"], expected_sha),
        GateResult("local working tree", not command_output(["git", "status", "--short"], cwd=ROOT).strip(), "clean" if not command_output(["git", "status", "--short"], cwd=ROOT).strip() else "working tree has uncommitted changes"),
    ]
    remote_result = run_command(["git", "ls-remote", remote, *refs], cwd=ROOT)
    if remote_result.returncode != 0:
        gates.append(GateResult("remote refs", False, one_line(remote_result.stderr or remote_result.stdout)))
        return gates
    remote_refs = parse_ls_remote(remote_result.stdout)
    for ref in refs:
        full_ref = f"refs/heads/{ref}"
        actual = remote_refs.get(full_ref)
        gates.append(GateResult(f"remote {ref}", sha_matches(actual or "", expected_sha), f"{actual or 'missing'} expected {expected_sha}"))
    return gates


def health_gate(name: str, base_url: str, environment: str, expected_sha: str, timeout: float) -> GateResult:
    url = base_url.rstrip("/") + "/healthz/deep"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "candidateSignal-launch-readiness/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return GateResult(name, False, f"HTTP {exc.code}")
    except Exception as exc:
        return GateResult(name, False, str(exc))
    errors = validate_deep_health(payload, expected_sha, environment)
    if errors:
        return GateResult(name, False, "; ".join(errors))
    build = payload.get("build") if isinstance(payload, dict) else {}
    migrations = payload.get("migrations") if isinstance(payload, dict) else {}
    return GateResult(name, True, f"sha={build.get('sha')} db={payload.get('database')} migrations={migrations.get('latest')}")


def validate_deep_health(payload: Any, expected_sha: str, environment: str) -> list[str]:
    if not isinstance(payload, dict):
        return ["response is not a JSON object"]
    errors: list[str] = []
    if payload.get("ok") is not True:
        errors.append("ok is not true")
    build = payload.get("build")
    if not isinstance(build, dict):
        errors.append("build metadata missing")
    else:
        sha = str(build.get("sha") or "")
        if not sha_matches(sha, expected_sha):
            errors.append(f"build sha {sha or 'missing'} does not match {expected_sha}")
        if build.get("environment") != environment:
            errors.append(f"environment {build.get('environment')!r} is not {environment!r}")
    if payload.get("database") != "ready":
        errors.append(f"database is {payload.get('database')!r}")
    migrations = payload.get("migrations")
    if not isinstance(migrations, dict):
        errors.append("migration metadata missing")
    else:
        if migrations.get("status") != "ready":
            errors.append(f"migration status is {migrations.get('status')!r}")
        if int(migrations.get("applied_count") or 0) <= 0:
            errors.append("no migrations are reported as applied")
        if not migrations.get("latest"):
            errors.append("latest migration is missing")
    return errors


def command_match_gate(name: str, command: list[str], expected: str) -> GateResult:
    result = run_command(command, cwd=ROOT)
    actual = result.stdout.strip()
    return GateResult(name, result.returncode == 0 and sha_matches(actual, expected), f"{actual or one_line(result.stderr)} expected {expected}")


def command_gate(name: str, command: list[str], cwd: Path, env: dict[str, str] | None = None) -> GateResult:
    result = run_command(command, cwd=cwd, env=env)
    detail = last_meaningful_line(result.stdout) or last_meaningful_line(result.stderr) or f"exit {result.returncode}"
    return GateResult(name, result.returncode == 0, detail)


def run_command(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    return subprocess.run(command, cwd=cwd, env=merged_env, text=True, capture_output=True, check=False)


def command_output(command: list[str], cwd: Path) -> str:
    return run_command(command, cwd=cwd).stdout


def parse_ls_remote(output: str) -> dict[str, str]:
    refs: dict[str, str] = {}
    for line in output.splitlines():
        parts = line.split()
        if len(parts) == 2:
            refs[parts[1]] = parts[0]
    return refs


def sha_matches(actual: str, expected: str) -> bool:
    actual = actual.strip()
    expected = expected.strip()
    if not actual or not expected:
        return False
    return actual == expected or actual.startswith(expected) or expected.startswith(actual)


def one_line(value: str) -> str:
    return " ".join(value.strip().split())[:240]


def last_meaningful_line(value: str) -> str:
    for line in reversed(value.splitlines()):
        line = line.strip()
        if line:
            return line[:240]
    return ""


if __name__ == "__main__":
    raise SystemExit(main())
