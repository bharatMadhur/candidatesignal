import unittest

from resume_intel.matching import (
    apply_copilot_direct_evidence_policy,
    candidate_has_direct_evidence,
    copilot_clarifying_questions,
    copilot_query_intent,
    promote_direct_evidence,
    rank_and_filter_copilot_candidates,
    should_require_direct_evidence,
    significant_query_terms,
)


class CopilotFilteringTest(unittest.TestCase):
    def test_short_company_query_requires_direct_evidence(self):
        terms = significant_query_terms("cerner")

        self.assertEqual(terms, ["cerner"])
        self.assertTrue(should_require_direct_evidence("cerner", terms))

    def test_candidate_direct_evidence_detects_company_snippet(self):
        candidate = {
            "name": "Example Candidate",
            "evidence": [
                {"snippet": "Generic data engineering work"},
                {"snippet": "Oracle Cerner Software Engineer working on healthcare ETL"},
            ],
        }

        self.assertTrue(candidate_has_direct_evidence(candidate, ["cerner"]))

    def test_direct_evidence_is_promoted_above_semantic_noise(self):
        candidate = {
            "name": "Example Candidate",
            "evidence": [
                {"snippet": "CERTIFICATION"},
                {"snippet": "Cerner Healthcare Big Data Engineer"},
            ],
        }

        promoted = promote_direct_evidence(candidate, ["cerner"])

        self.assertEqual(promoted["evidence"][0]["snippet"], "Cerner Healthcare Big Data Engineer")

    def test_short_query_does_not_fallback_to_semantic_noise(self):
        results = apply_copilot_direct_evidence_policy(
            "cerner",
            ["cerner"],
            [
                {"name": "No Evidence", "evidence": [{"snippet": "Healthcare analytics without the requested company"}]},
                {"name": "Direct Evidence", "evidence": [{"snippet": "Cerner Healthcare Big Data Engineer"}]},
            ],
        )

        self.assertEqual([item["name"] for item in results], ["Direct Evidence"])

    def test_short_query_returns_empty_when_no_direct_evidence_exists(self):
        results = apply_copilot_direct_evidence_policy(
            "cerner",
            ["cerner"],
            [{"name": "No Evidence", "evidence": [{"snippet": "Healthcare analytics"}]}],
        )

        self.assertEqual(results, [])

    def test_location_intent_scores_preferred_city_above_wrong_city(self):
        results = rank_and_filter_copilot_candidates(
            "find me data engineer from new york",
            [
                {
                    "name": "Columbus Data Engineer",
                    "current_title": "Lead Data Engineer",
                    "location": "Columbus, OH",
                    "top_domains": ["data_engineering"],
                    "semantic_score": 0.92,
                    "evidence": [{"snippet": "Big Data Engineer with Spark and Databricks"}],
                },
                {
                    "name": "New York Candidate",
                    "current_title": "Research Engineer",
                    "location": "New York, NY",
                    "top_domains": ["data_engineering"],
                    "semantic_score": 0.41,
                    "evidence": [{"snippet": "New York, NY and 0.7 years exposure in data engineering"}],
                },
            ],
        )

        self.assertEqual([item["name"] for item in results], ["New York Candidate", "Columbus Data Engineer"])
        self.assertGreater(
            results[0]["copilot_score_breakdown"]["location_score"],
            results[1]["copilot_score_breakdown"]["location_score"],
        )

    def test_required_location_intent_filters_out_wrong_city_when_explicit(self):
        results = rank_and_filter_copilot_candidates(
            "find me data engineer who must be in new york",
            [
                {
                    "name": "Columbus Data Engineer",
                    "current_title": "Lead Data Engineer",
                    "location": "Columbus, OH",
                    "top_domains": ["data_engineering"],
                    "semantic_score": 0.92,
                    "evidence": [{"snippet": "Big Data Engineer with Spark and Databricks"}],
                },
                {
                    "name": "New York Candidate",
                    "current_title": "Research Engineer",
                    "location": "New York, NY",
                    "top_domains": ["data_engineering"],
                    "semantic_score": 0.41,
                    "evidence": [{"snippet": "New York, NY and 0.7 years exposure in data engineering"}],
                },
            ],
        )

        self.assertEqual([item["name"] for item in results], ["New York Candidate"])

    def test_data_engineer_intent_matches_data_engineering_domain(self):
        intent = copilot_query_intent("find me data engineer from new york")

        self.assertIn(["new york", "new york city", "nyc", "ny"], intent["location_groups"])
        self.assertIn("data engineering", intent["role_groups"][0])
        self.assertEqual(intent["location_requirement"], "preferred")

    def test_software_engineer_intent_uses_software_role_aliases(self):
        intent = copilot_query_intent("software engineer")

        self.assertTrue(intent["role_groups"])
        self.assertIn("software developer", intent["role_groups"][0])
        self.assertIn("backend engineer", intent["role_groups"][0])

    def test_explicit_location_requirement_is_detected(self):
        intent = copilot_query_intent("find me data engineer who must be in new york")

        self.assertEqual(intent["location_requirement"], "required")

    def test_copilot_does_not_ask_location_when_city_is_present(self):
        questions = copilot_clarifying_questions("find me data engineer from new york")

        self.assertFalse(any("countries, locations" in question for question in questions))


if __name__ == "__main__":
    unittest.main()
