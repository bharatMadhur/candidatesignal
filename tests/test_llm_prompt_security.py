from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.llm import HR_INTELLIGENCE_PROMPT, SYSTEM_PROMPT, LlmJsonShapeError, _validate_json_pass_output


class LlmPromptSecurityTests(unittest.TestCase):
    def test_resume_prompts_treat_resume_text_as_untrusted(self) -> None:
        combined = f"{SYSTEM_PROMPT}\n{HR_INTELLIGENCE_PROMPT}".lower()

        self.assertIn("untrusted", combined)
        self.assertIn("ignore instructions", combined)
        self.assertIn("only extract resume facts", combined)
        self.assertIn("never promote a desired role", combined)
        self.assertIn("latest explicit employment role", combined)

    def test_deep_resume_pass_rejects_missing_required_shape(self) -> None:
        with self.assertRaisesRegex(LlmJsonShapeError, "document_text_audit returned invalid JSON shape"):
            _validate_json_pass_output(
                "document_text_audit",
                {
                    "document_type": "resume",
                    "text_quality_score": 0.9,
                    "is_resume": True,
                    "likely_missing_sections": [],
                    "ocr_or_layout_risks": [],
                    "parser_focus_areas": [],
                },
            )

    def test_requirement_profile_rejects_wrong_field_type(self) -> None:
        profile = {
            "title": None,
            "role_intent": "Data engineer",
            "must_have_skills": "Python, Spark",
            "nice_to_have_skills": [],
            "domains": [],
            "industry_preferences": [],
            "min_years_experience": None,
            "seniority": None,
            "required_locations": [],
            "preferred_locations": [],
            "required_countries": [],
            "work_authorization": None,
            "dealbreakers": [],
            "soft_preferences": [],
            "hidden_intent": [],
            "responsibilities": [],
            "strict_must_haves": False,
            "strict_min_years": False,
            "score_weights": {},
            "clarification_questions": [],
        }

        with self.assertRaisesRegex(LlmJsonShapeError, "must_have_skills"):
            _validate_json_pass_output("requirement_profile", profile)

    def test_campaign_judge_accepts_required_shape(self) -> None:
        payload = {
            "candidate_judgements": [],
            "pairwise_calibration": {"rank_order": [], "ranking_notes": []},
        }

        self.assertIs(_validate_json_pass_output("campaign_llm_match_judge", payload), payload)


if __name__ == "__main__":
    unittest.main()
