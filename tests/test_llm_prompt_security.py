from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.llm import HR_INTELLIGENCE_PROMPT, SYSTEM_PROMPT


class LlmPromptSecurityTests(unittest.TestCase):
    def test_resume_prompts_treat_resume_text_as_untrusted(self) -> None:
        combined = f"{SYSTEM_PROMPT}\n{HR_INTELLIGENCE_PROMPT}".lower()

        self.assertIn("untrusted", combined)
        self.assertIn("ignore instructions", combined)
        self.assertIn("only extract resume facts", combined)
        self.assertIn("never promote a desired role", combined)
        self.assertIn("latest explicit employment role", combined)


if __name__ == "__main__":
    unittest.main()
