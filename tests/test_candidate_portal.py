from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.candidate_portal import (
    build_resume_from_profile,
    DEFAULT_PRIVACY_SETTINGS,
    _RESUME_TEMPLATES,
    _candidate_profile_for_recruiter,
    _normalize_application_destination_type,
    _normalize_application_status,
    _normalize_privacy_settings,
    _resume_for_external_share,
    finalize_candidate_oauth_account,
    render_cv_pdf,
    profile_from_parsed_resume,
    render_cv_html,
    resume_from_parsed_record,
    resume_review_items,
    score_resume_against_requirement,
    tailor_resume_for_requirement,
)


class _QueuedResult:
    def __init__(self, row=None):
        self.row = row

    def fetchone(self):
        return self.row


class _CandidateOAuthConnection:
    def __init__(self):
        self.executed_sql: list[str] = []
        self.rows = [
            {
                "id": "user-1",
                "email": "recruiter@example.com",
                "name": "Recruiter Candidate",
                "role": "recruiter",
                "email_verified": True,
                "created_at": None,
            },
            {
                "id": "user-1",
                "email": "recruiter@example.com",
                "name": "Recruiter Candidate",
                "role": "recruiter",
                "email_verified": True,
                "created_at": None,
            },
        ]

    def execute(self, sql, *_args, **_kwargs):
        self.executed_sql.append(sql)
        if sql.strip().lower().startswith("select"):
            return _QueuedResult(self.rows.pop(0))
        return _QueuedResult()

    def commit(self):
        return None


class _CandidateOAuthDb:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, *args: object) -> None:
        return None


class CandidatePortalTests(unittest.TestCase):
    def test_google_candidate_finalize_allows_recruiter_candidate_persona(self) -> None:
        conn = _CandidateOAuthConnection()

        with patch("resume_intel.candidate_portal.db", return_value=_CandidateOAuthDb(conn)):
            result = finalize_candidate_oauth_account({"id": "user-1"}, new_user=False)

        self.assertEqual(result["user"]["workspace_access"], "candidate")
        self.assertEqual(result["user"]["email"], "recruiter@example.com")
        executed = "\n".join(conn.executed_sql).lower()
        self.assertNotIn("set role='candidate'", executed)
        self.assertIn("insert into candidate_profiles", executed)

    def test_build_resume_from_profile_preserves_candidate_owned_links_without_verification(self) -> None:
        resume = build_resume_from_profile(
            {
                "display_name": "Zulqarnain Musawar",
                "headline": "Reliability Engineer",
                "current_location": "Chicago, IL",
                "email": "candidate@example.com",
                "linkedin_url": "https://www.linkedin.com/in/zulqarnainmusawar",
                "skills": "Reliability Engineering, Mechanical Integrity, RCA",
            },
            target_role="Reliability Engineer II",
        )

        self.assertEqual(resume["name"], "Zulqarnain Musawar")
        self.assertEqual(resume["headline"], "Reliability Engineer II")
        self.assertEqual(resume["contact"]["linkedin_url"], "https://www.linkedin.com/in/zulqarnainmusawar")
        self.assertIn("Reliability Engineering", resume["skills"])

    def test_render_cv_html_escapes_candidate_data(self) -> None:
        html = render_cv_html(
            {
                "name": "<script>alert(1)</script>",
                "headline": "Engineer",
                "summary": "Builds safe systems",
                "skills": ["Python"],
            }
        )

        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)
        self.assertNotIn("<script>alert(1)</script>", html)

    def test_render_cv_pdf_returns_downloadable_ats_text_pdf(self) -> None:
        pdf = render_cv_pdf(self._sample_resume())

        self.assertTrue(pdf.startswith(b"%PDF-1.4"))
        self.assertIn(b"Utkarsh Sharma", pdf)
        self.assertIn(b"ENGYNE.AI", pdf)
        self.assertNotIn(b"candidateSignal.ai resume export", pdf)
        self.assertIn(b"startxref", pdf)

    def test_all_resume_templates_render_safe_html_and_downloadable_pdf(self) -> None:
        resume = self._sample_resume()

        for template in _RESUME_TEMPLATES:
            with self.subTest(template=template):
                html = render_cv_html(resume, template=template)
                pdf = render_cv_pdf(resume, template=template)

                self.assertIn("Utkarsh Sharma", html)
                self.assertIn("Construction Agent", html)
                self.assertIn("OpenAI Whisper", html)
                self.assertNotIn("<script", html.lower())
                self.assertTrue(pdf.startswith(b"%PDF-1.4"))
                self.assertIn(b"Utkarsh Sharma", pdf)
                self.assertIn(b"ENGYNE.AI", pdf)
                self.assertIn(b"startxref", pdf)
                self.assertNotIn(b"candidateSignal.ai resume export", pdf)

    def test_self_match_reports_privacy_boundary_and_missing_terms(self) -> None:
        result = score_resume_against_requirement(
            {
                "headline": "Data Engineer",
                "summary": "Built Spark and Python ETL pipelines on Azure.",
                "contact": {"location": "New York, NY"},
                "skills": ["Python", "Spark", "Azure"],
            },
            "Need a senior data engineer with Python, Spark, Snowflake, healthcare, and New York experience.",
        )

        self.assertGreaterEqual(result["score"], 30)
        self.assertIn("python", result["matched_terms"])
        self.assertIn("york", result["matched_terms"])
        self.assertIn("snowflake", result["missing_or_unclear_terms"])
        self.assertIn("does not run LinkedIn verification", result["privacy_note"])

    def test_targeted_resume_version_prioritizes_evidence_without_inventing_missing_terms(self) -> None:
        base_resume = {
            "name": "Asha Patel",
            "headline": "Data Engineer",
            "summary": "Built Spark and Python ETL pipelines on Azure.",
            "contact": {"location": "New York, NY"},
            "skills": ["Azure", "Python", "Spark"],
            "experience": [
                {
                    "title": "Data Engineer",
                    "company": "Acme",
                    "bullets": ["Built Spark ETL jobs for analytics reporting."],
                }
            ],
        }

        match = score_resume_against_requirement(
            base_resume,
            "Role: Senior Data Engineer. Need Python, Spark, Snowflake, healthcare, and New York experience.",
        )
        targeted = tailor_resume_for_requirement(
            base_resume,
            "Role: Senior Data Engineer. Need Python, Spark, Snowflake, healthcare, and New York experience.",
            target_role="Senior Data Engineer",
            match=match,
        )

        self.assertEqual(targeted["headline"], "Senior Data Engineer")
        self.assertEqual(targeted["skills"][:2], ["Python", "Spark"])
        self.assertIn("snowflake", targeted["job_tailoring"]["missing_or_unclear_terms"])
        self.assertNotIn("Snowflake", targeted["skills"])
        self.assertIn("spark", targeted["experience"][0]["targeted_relevance_terms"])

    def test_candidate_native_preview_hides_pii_until_permission(self) -> None:
        profile = {
            "display_name": "Asha Patel",
            "email": "asha@example.com",
            "phone": "555-111-2222",
            "linkedin_url": "https://www.linkedin.com/in/asha",
            "portfolio_url": "https://asha.dev",
            "github_url": "https://github.com/asha",
            "headline": "Data Engineer",
            "skills": ["Python"],
        }

        redacted = _candidate_profile_for_recruiter(profile, include_pii=False)
        visible = _candidate_profile_for_recruiter(profile, include_pii=True)

        self.assertEqual(redacted["display_name"], "candidateSignal native candidate")
        self.assertEqual(redacted["email"], "")
        self.assertEqual(redacted["phone"], "")
        self.assertEqual(redacted["linkedin_url"], "")
        self.assertEqual(visible["email"], "asha@example.com")
        self.assertEqual(visible["linkedin_url"], "https://www.linkedin.com/in/asha")

    def test_external_share_payload_hides_pii_by_default(self) -> None:
        resume = {
            "name": "Asha Patel",
            "contact": {
                "email": "asha@example.com",
                "phone": "555-111-2222",
                "linkedin_url": "https://www.linkedin.com/in/asha",
                "portfolio_url": "https://asha.dev",
                "github_url": "https://github.com/asha",
            },
            "links": ["https://asha.dev"],
            "skills": ["Python"],
        }

        redacted = _resume_for_external_share(resume, include_pii=False)
        visible = _resume_for_external_share(resume, include_pii=True)

        self.assertEqual(redacted["name"], "Candidate")
        self.assertEqual(redacted["contact"]["email"], "")
        self.assertEqual(redacted["contact"]["linkedin_url"], "")
        self.assertEqual(redacted["links"], [])
        self.assertEqual(visible["name"], "Asha Patel")
        self.assertEqual(visible["contact"]["email"], "asha@example.com")

    def test_candidate_privacy_defaults_keep_pii_permission_required(self) -> None:
        privacy = _normalize_privacy_settings({"candidate_signal_native_search_enabled": True, "pii_visible_to_recruiters": True})

        self.assertTrue(privacy["candidate_signal_native_search_enabled"])
        self.assertTrue(privacy["pii_permission_required"])
        self.assertFalse(privacy["pii_visible_to_recruiters"])
        self.assertEqual(privacy["public_resume_fields"], DEFAULT_PRIVACY_SETTINGS["public_resume_fields"])

    def test_candidate_application_tracking_normalizes_status_and_destination(self) -> None:
        self.assertEqual(_normalize_application_destination_type("Job Board"), "job_board")
        self.assertEqual(_normalize_application_destination_type("LinkedIn"), "linkedin")
        self.assertEqual(_normalize_application_destination_type("unknown-place"), "other")
        self.assertEqual(_normalize_application_status("Interviewing"), "interviewing")
        self.assertEqual(_normalize_application_status("bad-status"), "shared")

    def test_parsed_resume_profile_extracts_projects_and_links(self) -> None:
        record = {
            "name": "Asha Patel",
            "contact": {
                "email": "asha@example.com",
                "location": "Pittsburgh, PA",
                "links": ["https://www.linkedin.com/in/asha", "https://asha.dev", "https://github.com/asha"],
            },
            "summary": "Data engineer building analytics platforms.",
            "skills": ["Python", "Spark"],
            "experience": [{"title": "Data Engineer", "company": "Acme", "start_date": "2022-01", "end_date": "Present"}],
            "education": [{"school": "CMU", "degree": "MS"}],
            "projects": [{"name": "Analytics Assistant", "role": "Builder", "bullets": ["Built natural language analytics"]}],
            "certifications": ["AWS"],
            "derived": {"hr_profile": {"current_title": "Data Engineer"}},
            "_metadata": {"parse_quality": {"coverage_score": 0.9}},
        }

        profile = profile_from_parsed_resume(record)
        resume = resume_from_parsed_record(record, target_role="Senior Data Engineer")
        review = resume_review_items(record, profile)

        self.assertEqual(profile["display_name"], "Asha Patel")
        self.assertEqual(profile["linkedin_url"], "https://www.linkedin.com/in/asha")
        self.assertEqual(profile["github_url"], "https://github.com/asha")
        self.assertEqual(profile["portfolio_url"], "https://asha.dev")
        self.assertEqual(profile["projects"][0]["name"], "Analytics Assistant")
        self.assertEqual(resume["headline"], "Senior Data Engineer")
        self.assertFalse(any(item["field"] == "projects" for item in review))

    def test_duplicate_linkedin_does_not_become_portfolio(self) -> None:
        record = {
            "name": "Pranjal Paliwal",
            "contact": {
                "links": [
                    "https://www.linkedin.com/in/pranjal-paliwal-490/",
                    "https://github.com/Cranial490",
                    "https://www.linkedin.com/in/pranjal-paliwal-490/",
                ],
            },
            "experience": [{"title": "Founding Engineer", "company": "Orbit Systems"}],
            "derived": {"hr_profile": {"current_title": "Founding Engineer"}},
            "_metadata": {"links": [{"url": "https://www.linkedin.com/in/pranjal-paliwal-490/"}]},
        }

        profile = profile_from_parsed_resume(record)

        self.assertEqual(profile["linkedin_url"], "https://www.linkedin.com/in/pranjal-paliwal-490/")
        self.assertEqual(profile["github_url"], "https://github.com/Cranial490")
        self.assertEqual(profile["portfolio_url"], "")
        self.assertEqual(profile["links"], ["https://www.linkedin.com/in/pranjal-paliwal-490/", "https://github.com/Cranial490"])

    def test_parsed_resume_preserves_rich_resume_character(self) -> None:
        record = {
            "name": "Utkarsh Sharma",
            "contact": {
                "email": "utkarsh@example.com",
                "phone": "6149967685",
                "location": "Los Angeles, CA",
                "links": ["https://www.linkedin.com/in/utkarsh", "https://leetcode.com/u/utkarsh", "https://utkarsh.blog"],
            },
            "summary": "Specialized in designing scalable, lightweight data model architectures.",
            "skills": [
                "Languages: Java, Python, JavaScript",
                "Frameworks: Spring Boot, LangChain, LangGraph",
                "AWS",
            ],
            "experience": [
                {
                    "company": "ENGYNE.AI",
                    "title": "Founding Engineer",
                    "location": "Remote, USA",
                    "start_date": "2024-10",
                    "end_date": "2025-05",
                    "technologies": ["Java", "Spring Boot", "AWS Lambda"],
                    "bullets": [
                        "Created features on AWS, driving the first 100K revenue.",
                        "Designed RAG pipeline and user-tailored UI navigation.",
                    ],
                    "workstreams": [
                        {
                            "name": "Speech-to-text captioning",
                            "technologies": ["OpenAI Whisper"],
                            "bullets": ["Owned on-click video clip generation and real-time captioning."],
                        }
                    ],
                }
            ],
            "projects": [
                {
                    "name": "Construction Agent",
                    "role": "LangChain, LangGraph",
                    "bullets": ["Created a plan generation agent with 90% accuracy."],
                    "links": ["https://example.com/construction-agent"],
                }
            ],
            "education": [{"school": "The Ohio State University", "degree": "M.S. Computer Engineering", "details": ["Gold Medalist"]}],
            "awards": ["Gold Medalist"],
            "publications": ["AIAA Sci-Tech 2024"],
            "languages": ["English"],
            "candidate_intelligence": {
                "final_candidate_profile": {
                    "summary_card": {"headline": "Founding systems engineer with product AI depth"},
                    "recruiter_brief": ["First engineer at ENGYNE.AI with revenue impact."],
                    "wow_factor": ["Built RAG and speech systems across production products."],
                    "best_fit_roles": ["Founding AI Engineer"],
                    "screening_questions": ["How much of the RAG stack did you own?"],
                }
            },
            "llm_hr_intelligence": {
                "recruiter_dashboard": {
                    "one_minute_summary": ["Strong founding engineer signal."],
                    "possible_concerns": [{"concern": "Short tenure", "how_to_verify": "Ask about contract dates."}],
                },
                "ai_notes": [{"note": "Strong AI product builder signal.", "based_on": ["RAG and Whisper projects"]}],
            },
            "derived": {"hr_profile": {"current_title": "Founding Engineer"}},
            "_metadata": {"parse_quality": {"coverage_score": 0.95}},
        }

        profile = profile_from_parsed_resume(record)
        resume = resume_from_parsed_record(record, target_role="Founding Engineer")
        html = render_cv_html(resume)

        self.assertIn("First engineer at ENGYNE.AI", resume["summary_highlights"][0])
        self.assertEqual(resume["ai_enhancement"]["headline_suggestion"], "Founding systems engineer with product AI depth")
        self.assertIn("Strong AI product builder signal.", resume["ai_enhancement"]["ai_notes"])
        self.assertIn("Founding AI Engineer", resume["ai_enhancement"]["best_fit_roles"])
        self.assertIn("Languages", resume["skill_groups"])
        self.assertIn("Java", resume["skill_groups"]["Languages"])
        self.assertEqual(resume["experience"][0]["workstreams"][0]["name"], "Speech-to-text captioning")
        self.assertEqual(profile["portfolio_url"], "https://leetcode.com/u/utkarsh")
        self.assertIn("Construction Agent", html)
        self.assertIn("Gold Medalist", html)
        self.assertIn("OpenAI Whisper", html)

    def _sample_resume(self) -> dict:
        return {
            "name": "Utkarsh Sharma",
            "headline": "Founding Engineer",
            "summary": "Specialized in scalable data model architecture, RAG products, and AI navigation.",
            "summary_highlights": [
                "Joined as the first engineer at ENGYNE.AI.",
                "Built RAG pipeline and user-tailored UI navigation.",
            ],
            "contact": {
                "location": "Los Angeles, CA",
                "email": "utkarsh@example.com",
                "phone": "6149967685",
                "linkedin_url": "https://www.linkedin.com/in/utkarsh",
                "portfolio_url": "https://utkarsh.blog",
                "github_url": "https://github.com/utkarsh",
            },
            "skills": ["Java", "Python", "LangChain", "AWS"],
            "skill_groups": {
                "Languages": ["Java", "Python", "JavaScript"],
                "Frameworks": ["Spring Boot", "LangChain", "LangGraph"],
                "Cloud": ["AWS Lambda", "AWS ECS", "CloudFront"],
            },
            "experience": [
                {
                    "company": "ENGYNE.AI",
                    "title": "Founding Engineer",
                    "location": "Remote, USA",
                    "start_date": "2024-10",
                    "end_date": "2025-05",
                    "technologies": ["Java", "Spring Boot", "AWS Lambda"],
                    "bullets": [
                        "Created features on AWS, driving the first 100K revenue.",
                        "Designed RAG pipeline and user-tailored UI navigation.",
                    ],
                    "workstreams": [
                        {
                            "name": "Speech-to-text captioning",
                            "technologies": ["OpenAI Whisper"],
                            "bullets": ["Owned on-click video clip generation and real-time captioning."],
                        }
                    ],
                }
            ],
            "projects": [
                {
                    "name": "Construction Agent",
                    "role": "LangChain, LangGraph",
                    "bullets": ["Created a plan generation agent with 90% accuracy."],
                    "links": ["https://example.com/construction-agent"],
                }
            ],
            "education": [{"school": "The Ohio State University", "degree": "M.S. Computer Engineering", "details": ["Gold Medalist"]}],
            "certifications": ["AWS Certified Cloud Practitioner"],
            "awards": ["Gold Medalist"],
            "publications": ["AIAA Sci-Tech 2024"],
            "languages": ["English"],
        }


if __name__ == "__main__":
    unittest.main()
