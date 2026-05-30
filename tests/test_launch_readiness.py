from __future__ import annotations

import sys
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import launch_readiness
from scripts.launch_readiness import GateResult, parse_ls_remote, validate_deep_health


class LaunchReadinessTests(unittest.TestCase):
    def test_validate_deep_health_accepts_matching_ready_payload(self) -> None:
        payload = {
            "ok": True,
            "build": {"sha": "abcdef123456", "environment": "production"},
            "database": "ready",
            "migrations": {"status": "ready", "applied_count": 31, "latest": "20260528_0031_runtime_db_role"},
        }

        self.assertEqual(validate_deep_health(payload, "abcdef1234567890", "production"), [])

    def test_validate_deep_health_rejects_wrong_sha_environment_and_db(self) -> None:
        payload = {
            "ok": True,
            "build": {"sha": "111111111111", "environment": "staging"},
            "database": "down",
            "migrations": {"status": "pending", "applied_count": 0, "latest": ""},
        }

        errors = validate_deep_health(payload, "abcdef1234567890", "production")

        self.assertIn("build sha 111111111111 does not match abcdef1234567890", errors)
        self.assertIn("environment 'staging' is not 'production'", errors)
        self.assertIn("database is 'down'", errors)
        self.assertIn("migration status is 'pending'", errors)
        self.assertIn("no migrations are reported as applied", errors)
        self.assertIn("latest migration is missing", errors)

    def test_parse_ls_remote_maps_refs_to_shas(self) -> None:
        output = "aaa111\trefs/heads/main\nbbb222\trefs/heads/staging\n"

        self.assertEqual(parse_ls_remote(output), {"refs/heads/main": "aaa111", "refs/heads/staging": "bbb222"})

    def test_main_returns_failure_when_any_gate_fails(self) -> None:
        with (
            patch("scripts.launch_readiness.git_gates", return_value=[GateResult("git", True, "ok")]),
            patch("scripts.launch_readiness.health_gate", side_effect=[
                GateResult("production deep health", True, "ok"),
                GateResult("staging deep health", False, "wrong sha"),
            ]),
            patch("sys.stdout", new_callable=StringIO),
        ):
            self.assertEqual(launch_readiness.main(["--expected-sha", "abcdef1234567890"]), 1)

    def test_launch_flag_enables_smoke_e2e_and_load_gates(self) -> None:
        command_names: list[str] = []

        def fake_command_gate(name: str, *_args: object, **_kwargs: object) -> GateResult:
            command_names.append(name)
            return GateResult(name, True, "ok")

        with (
            patch("scripts.launch_readiness.git_gates", return_value=[GateResult("git", True, "ok")]),
            patch("scripts.launch_readiness.health_gate", side_effect=[
                GateResult("production deep health", True, "ok"),
                GateResult("staging deep health", True, "ok"),
            ]),
            patch("scripts.launch_readiness.command_gate", side_effect=fake_command_gate),
            patch("sys.stdout", new_callable=StringIO),
        ):
            self.assertEqual(launch_readiness.main(["--expected-sha", "abcdef1234567890", "--launch"]), 0)

        self.assertEqual(
            command_names,
            [
                "production public smoke",
                "authenticated staging E2E",
                "production load smoke",
                "staging load smoke",
            ],
        )

    def test_staging_qa_skips_production_health_and_uses_staging_ref(self) -> None:
        captured_refs: list[tuple[str, ...]] = []
        health_names: list[str] = []
        command_names: list[str] = []

        def fake_git_gates(_expected_sha: str, _remote: str, refs: tuple[str, ...]) -> list[GateResult]:
            captured_refs.append(refs)
            return [GateResult("git", True, "ok")]

        def fake_health_gate(name: str, *_args: object, **_kwargs: object) -> GateResult:
            health_names.append(name)
            return GateResult(name, True, "ok")

        def fake_command_gate(name: str, *_args: object, **_kwargs: object) -> GateResult:
            command_names.append(name)
            return GateResult(name, True, "ok")

        with (
            patch("scripts.launch_readiness.git_gates", side_effect=fake_git_gates),
            patch("scripts.launch_readiness.health_gate", side_effect=fake_health_gate),
            patch("scripts.launch_readiness.command_gate", side_effect=fake_command_gate),
            patch("sys.stdout", new_callable=StringIO),
        ):
            self.assertEqual(launch_readiness.main(["--expected-sha", "abcdef1234567890", "--staging-qa"]), 0)

        self.assertEqual(captured_refs, [("staging",)])
        self.assertEqual(health_names, ["staging deep health"])
        self.assertEqual(command_names, ["authenticated staging E2E", "staging load smoke"])


if __name__ == "__main__":
    unittest.main()
