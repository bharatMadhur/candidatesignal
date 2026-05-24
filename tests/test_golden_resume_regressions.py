from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.candidate_facts import factual_current_company, factual_current_title
from resume_intel.coverage import primary_key_coverage
from resume_intel.fact_verification import enrich_fact_verification
from resume_intel.geo import build_location_intelligence, candidate_current_location
from resume_intel.timeline import build_timeline_profile
from resume_intel.validate import validate_resume
from resume_intel.workstreams import nest_same_company_workstreams


class GoldenResumeRegressionTests(unittest.TestCase):
    def test_pranjal_orbit_projects_are_workstreams_not_concurrent_roles(self) -> None:
        record = nest_same_company_workstreams({
            "experience": [
                {"company": "Orbit Systems Inc", "title": "Founding Engineer", "start_date": "2023-07", "end_date": "Present", "bullets": ["Built platform."]},
                {"company": "Orbit Systems Inc", "title": "Agentic Chatbot", "start_date": "2023-07", "end_date": "Present", "bullets": ["Built analytics assistant."]},
                {"company": "Orbit Systems Inc", "title": "SOW Contract Agent", "start_date": "2023-07", "end_date": "Present", "bullets": ["Built workflow automation."]},
            ]
        })
        timeline = build_timeline_profile(record)

        self.assertEqual(len(record["experience"]), 1)
        self.assertEqual(len(record["experience"][0]["workstreams"]), 2)
        self.assertEqual(timeline["experience_accounting"]["overlap_group_count"], 0)

    def test_neelabh_current_title_uses_verified_raw_role_not_inferred_role_intent(self) -> None:
        record = {
            "experience": [
                {"company": "OCLC", "title": "Founding Engineer", "start_date": "2022-01", "end_date": "Present"},
                {"company": "PreviousCo", "title": "Software Engineer", "start_date": "2020-01", "end_date": "2021-12"},
            ],
            "derived": {"hr_profile": {"current_title": "Founding Engineer", "current_company": "OCLC"}},
        }
        raw_text = "OCLC\nSoftware Engineer\nJan 2022 - Present\nBuilt services and internal platforms."

        enriched = enrich_fact_verification(record, raw_text)

        self.assertEqual(factual_current_title(enriched), "Software Engineer")
        self.assertEqual(factual_current_company(enriched), "OCLC")
        self.assertIn("title_not_found_in_raw_text", enriched["derived"]["fact_verification"]["current_role_flags"])

    def test_requirement_uploaded_as_resume_stays_below_usable_coverage_with_reason(self) -> None:
        raw = {
            "document_id": "req-1",
            "source_file": "data-engineer-requirement.pdf",
            "name": None,
            "contact": {},
            "summary": "Hiring requirement for a senior data engineer.",
            "skills": ["Python", "Spark", "SQL"],
            "experience": [],
            "education": [],
        }
        record, _report = validate_resume(raw, "We need a Senior Data Engineer with Python, Spark, SQL, and healthcare data experience.")
        coverage = primary_key_coverage(record.model_dump(mode="json"))

        self.assertLess(coverage["score"], 0.65)
        self.assertEqual(coverage["status"], "low_confidence")
        self.assertTrue(any(reason["label"] == "Below usable profile threshold" for reason in coverage["low_coverage_reasons"]))

    def test_location_uncertainty_prefers_resume_header_over_old_role_location(self) -> None:
        record = {
            "contact": {"location": "Pittsburgh, PA"},
            "experience": [{"company": "Older Employer", "title": "Engineer", "location": "India"}],
            "education": [{"school": "Carnegie Mellon University", "location": "Pittsburgh, PA"}],
        }
        record["derived"] = {"location_intelligence": build_location_intelligence(record)}

        self.assertEqual(candidate_current_location(record), "Pittsburgh, PA")
        self.assertTrue(record["derived"]["location_intelligence"]["location_conflict"])

    def test_resume_pii_urls_are_not_lost_when_present_in_raw_text(self) -> None:
        raw_text = """
        Neelabh Prajapati
        neelabh@example.com | +1 555 444 3333
        LinkedIn: https://www.linkedin.com/in/neelabhp
        Portfolio: neelabh.dev
        GitHub: github.com/neelabhp
        OCLC Software Engineer Jan 2022 - Present
        """
        raw = {
            "document_id": "pii-1",
            "source_file": "neelabh.pdf",
            "name": "Neelabh Prajapati",
            "contact": {
                "email": "neelabh@example.com",
                "phone": "+1 555 444 3333",
                "location": "",
                "links": ["https://www.linkedin.com/in/neelabhp", "https://neelabh.dev", "https://github.com/neelabhp"],
            },
            "skills": ["Python"],
            "experience": [{"company": "OCLC", "title": "Software Engineer", "start_date": "2022-01", "end_date": "Present"}],
            "education": [],
        }

        record, report = validate_resume(raw, raw_text)

        self.assertNotIn("links_may_be_missing", report["warnings"])
        self.assertIn("https://www.linkedin.com/in/neelabhp", record.contact.links)
        self.assertIn("https://neelabh.dev", record.contact.links)
        self.assertIn("https://github.com/neelabhp", record.contact.links)


if __name__ == "__main__":
    unittest.main()
