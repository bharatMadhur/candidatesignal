from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.migrations.runner import _migration_modules


class MigrationModuleTests(unittest.TestCase):
    def test_versioned_migrations_are_ordered_and_have_upgrade(self) -> None:
        modules = _migration_modules()
        versions = [module.VERSION for module in modules]

        self.assertEqual(versions, sorted(versions))
        self.assertIn("20260513_0002_search_security_hardening", versions)
        self.assertIn("20260513_0003_invitation_seat_hardening", versions)
        for module in modules:
            self.assertTrue(callable(getattr(module, "upgrade", None)), module.__name__)
            self.assertTrue(getattr(module, "DESCRIPTION", ""), module.__name__)


if __name__ == "__main__":
    unittest.main()
