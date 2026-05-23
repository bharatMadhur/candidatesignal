from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.requirements import CAMPAIGN_MATCH_VISIBILITY_THRESHOLD, _apply_structured_answers, _deterministic_match_pool, score_candidate


class RequirementScoringTests(unittest.TestCase):
    def test_campaign_visibility_threshold_matches_recruiter_review_cutoff(self) -> None:
        self.assertEqual(CAMPAIGN_MATCH_VISIBILITY_THRESHOLD, 0.65)

    def test_hard_filter_failures_cap_score(self) -> None:
        profile = {
            "must_have_skills": ["Azure OpenAI", "LangChain"],
            "nice_to_have_skills": [],
            "domains": ["generative_ai"],
            "min_years_experience": 5,
            "required_locations": ["United States"],
            "required_countries": [],
            "dealbreakers": [],
            "strict_must_haves": True,
            "strict_min_years": True,
        }
        candidate = {
            "name": "Candidate",
            "summary": "Python engineer in India.",
            "skills": ["Python"],
            "experience": [{"company": "Example", "title": "Engineer", "location": "India", "bullets": ["Built ETL"]}],
            "education": [],
            "notes": [],
            "certifications": [],
            "derived": {"hr_profile": {"total_years_experience": 2}, "experience_by_domain": {"data_engineering": 2}},
            "contact": {"location": "India"},
        }

        result = score_candidate(profile, candidate, "")

        self.assertFalse(result["hard_filter_pass"])
        self.assertLessEqual(result["total_score"], 0.49)
        self.assertTrue(any("Missing must-have" in item for item in result["hard_filter_failures"]))
        self.assertTrue(any("Below minimum years" in item for item in result["hard_filter_failures"]))
        self.assertTrue(any("Missing required location" in item for item in result["hard_filter_failures"]))

    def test_missing_must_haves_are_scored_not_blocked_by_default(self) -> None:
        profile = {
            "must_have_skills": ["Spark", "Databricks"],
            "nice_to_have_skills": ["Airflow"],
            "domains": ["data_engineering"],
            "min_years_experience": 5,
            "preferred_locations": ["New York"],
            "required_locations": [],
            "required_countries": [],
            "dealbreakers": [],
        }
        candidate = {
            "name": "Candidate",
            "summary": "Data engineer with Python and ETL experience.",
            "skills": ["Python", "ETL"],
            "experience": [{"company": "Example", "title": "Data Engineer", "location": "Ohio", "bullets": ["Built data pipelines"]}],
            "education": [],
            "notes": [],
            "certifications": [],
            "derived": {"hr_profile": {"total_years_experience": 3}, "experience_by_domain": {"data_engineering": 3}},
            "contact": {"location": "Ohio"},
        }

        result = score_candidate(profile, candidate, "")

        self.assertTrue(result["hard_filter_pass"])
        self.assertEqual(result["hard_filter_failures"], [])
        self.assertGreater(result["total_score"], 0)
        self.assertIn("score_weights", result["evidence"])
        self.assertIn("match_explanation", result["evidence"])

    def test_structured_recruiter_note_signals_affect_notes_relevance(self) -> None:
        profile = {
            "must_have_skills": [],
            "nice_to_have_skills": [],
            "work_authorization": "OPT",
            "domains": [],
            "required_locations": [],
            "required_countries": [],
            "dealbreakers": [],
        }
        candidate = {
            "name": "Candidate",
            "summary": "Data engineer.",
            "skills": ["Python"],
            "experience": [{"company": "Example", "title": "Data Engineer", "location": "Ohio", "bullets": ["Built data pipelines"]}],
            "education": [],
            "notes": [],
            "certifications": [],
            "derived": {
                "hr_profile": {"total_years_experience": 3},
                "experience_by_domain": {"data_engineering": 3},
                "recruiter_note_signals": {
                    "signals": [{"category": "work_authorization", "label": "opt", "value": "OPT"}],
                },
            },
            "contact": {"location": "Ohio"},
        }

        result = score_candidate(profile, candidate, "")

        self.assertIn("structured recruiter note signal", result["evidence"]["notes_relevance"])

    def test_candidate_with_required_facts_passes_hard_filters(self) -> None:
        profile = {
            "must_have_skills": ["Azure OpenAI"],
            "nice_to_have_skills": ["LangChain"],
            "domains": ["generative_ai"],
            "min_years_experience": 3,
            "required_locations": ["United States"],
            "required_countries": [],
            "dealbreakers": ["Lack of chatbot experience"],
            "work_authorization": "Not specified",
        }
        candidate = {
            "name": "Candidate",
            "summary": "Azure OpenAI engineer in the United States using LangChain.",
            "skills": ["Azure OpenAI", "LangChain"],
            "experience": [{"company": "Example", "title": "AI Engineer", "location": "United States", "bullets": ["Built RAG systems"]}],
            "education": [],
            "notes": [],
            "certifications": [],
            "derived": {"hr_profile": {"total_years_experience": 4}, "experience_by_domain": {"generative_ai": 3}},
            "contact": {"location": "United States"},
        }

        result = score_candidate(profile, candidate, "")

        self.assertTrue(result["hard_filter_pass"])
        self.assertEqual(result["hard_filter_failures"], [])

    def test_deterministic_pool_drops_weak_candidates_before_llm(self) -> None:
        matches = [
            {
                "candidate_id": "strong",
                "total_score": 0.67,
                "hard_filter_pass": True,
                "semantic_score": 0.61,
                "evidence": {"must_have_hits": ["Spark"], "role_terms_present": True, "role_score": 0.9},
            },
            {
                "candidate_id": "weak",
                "total_score": 0.62,
                "hard_filter_pass": True,
                "semantic_score": 0.2,
                "evidence": {"role_terms_present": False, "role_score": 1.0, "recency_terms_present": False, "recency_score": 1.0},
            },
            {
                "candidate_id": "blocked",
                "total_score": 0.9,
                "hard_filter_pass": False,
                "semantic_score": 0.9,
                "evidence": {"must_have_hits": ["Spark"]},
            },
        ]

        pool = _deterministic_match_pool(matches)

        self.assertEqual([item["candidate_id"] for item in pool], ["strong"])
        self.assertEqual(pool[0]["evidence"]["deterministic_prescreen"]["status"], "passed")

    def test_structured_recruiter_answers_update_matchable_profile(self) -> None:
        profile = {
            "must_have_skills": [],
            "nice_to_have_skills": [],
            "domains": [],
            "required_locations": [],
            "required_countries": [],
            "dealbreakers": [],
        }

        _apply_structured_answers(
            profile,
            {
                "__profile.must_have_skills": "Azure OpenAI, LangChain\nRAG",
                "__profile.nice_to_have_skills": "Databricks; LangGraph",
                "__profile.min_years_experience": "5+ years",
                "__profile.required_countries": "United States, Canada",
                "__profile.domains": "generative_ai, data_engineering",
                "__profile.dealbreakers": "No production AI experience",
                "__profile.seniority": "Lead",
                "__profile.work_authorization": "US work authorization",
            },
        )

        self.assertEqual(profile["must_have_skills"], ["Azure OpenAI", "LangChain", "RAG"])
        self.assertEqual(profile["nice_to_have_skills"], ["Databricks", "LangGraph"])
        self.assertEqual(profile["min_years_experience"], 5)
        self.assertEqual(profile["required_countries"], ["United States", "Canada"])
        self.assertEqual(profile["domains"], ["generative_ai", "data_engineering"])
        self.assertEqual(profile["dealbreakers"], ["No production AI experience"])
        self.assertEqual(profile["seniority"], "Lead")
        self.assertEqual(profile["work_authorization"], "US work authorization")


if __name__ == "__main__":
    unittest.main()
