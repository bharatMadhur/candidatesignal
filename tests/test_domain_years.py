from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.derive import add_derived_fields, normalize_domain_years
from resume_intel.schema import ResumeRecord


class DomainYearAccountingTests(unittest.TestCase):
    def test_overlapping_domain_roles_do_not_double_count_years(self) -> None:
        record = ResumeRecord.model_validate(
            {
                "document_id": "candidate-1",
                "source_file": "resume.pdf",
                "experience": [
                    {
                        "company": "A",
                        "title": "Cloud Architect",
                        "start_date": "2020-01",
                        "end_date": "2022-12",
                        "bullets": ["Built Azure cloud architecture."],
                    },
                    {
                        "company": "B",
                        "title": "Cloud Engineer",
                        "start_date": "2021-01",
                        "end_date": "2022-12",
                        "bullets": ["Designed AWS microservices."],
                    },
                ],
            }
        )

        enriched = add_derived_fields(record)
        cloud = enriched.derived["experience_by_domain"]["cloud_architecture"]

        self.assertEqual(enriched.derived["hr_profile"]["total_years_experience"], 3.0)
        self.assertEqual(cloud["years"], 3.0)

    def test_domain_years_are_capped_to_total_experience_with_evidence(self) -> None:
        record = {
            "experience": [
                {
                    "company": "Orbit Systems",
                    "title": "Founding Engineer",
                    "start_date": "2020-01",
                    "end_date": "2025-12",
                    "bullets": ["Built Azure AI assistants and cloud architecture."],
                }
            ],
            "derived": {
                "hr_profile": {"total_years_experience": 6.0},
                "experience_by_domain": {"cloud_architecture": {"years": 8.5, "evidence_terms": ["Azure"]}},
            },
        }

        normalize_domain_years(record)
        cloud = record["derived"]["experience_by_domain"]["cloud_architecture"]

        self.assertEqual(cloud["years"], 6.0)
        self.assertEqual(cloud["original_years"], 8.5)
        self.assertTrue(cloud["capped"])
        self.assertIn("capped_to_total_experience", cloud["review_flags"])
        self.assertIn("azure", [term.lower() for term in cloud["evidence_terms"]])
        self.assertEqual(record["derived"]["domain_years_review"]["status"], "needs_review")

    def test_numeric_domain_years_are_normalized_to_structured_evidence(self) -> None:
        record = {
            "experience": [
                {
                    "company": "Acme",
                    "title": "Data Engineer",
                    "start_date": "2021-01",
                    "end_date": "2022-12",
                    "bullets": ["Built Databricks ETL pipelines."],
                }
            ],
            "derived": {"experience_by_domain": {"data_engineering": 2}},
        }

        normalize_domain_years(record)
        domain = record["derived"]["experience_by_domain"]["data_engineering"]

        self.assertEqual(domain["years"], 2.0)
        self.assertEqual(domain["evidence_quality"], "role_dated")
        self.assertEqual(domain["role_evidence_years"], 2.0)


if __name__ == "__main__":
    unittest.main()
