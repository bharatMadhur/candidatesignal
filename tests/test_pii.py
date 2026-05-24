from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.pii import enrich_record_pii, redact_contact_pii_payload
from resume_intel.db_store import public_candidate_record


class PiiExtractionTests(unittest.TestCase):
    def test_extracts_linkedin_portfolio_github_email_and_phone(self) -> None:
        record = {"contact": {"links": []}, "derived": {}}
        raw_text = """
        Pranjal Paliwal
        pranjal@example.com | 774.253.7593
        linkedin.com/in/pranjal-paliwal | github.com/pranjal
        Portfolio: pranjal.ai
        """

        enriched = enrich_record_pii(record, raw_text)
        pii = enriched["derived"]["pii_contact_intelligence"]

        self.assertEqual(enriched["contact"]["email"], "pranjal@example.com")
        self.assertEqual(enriched["contact"]["phone"], "774.253.7593")
        self.assertEqual(pii["linkedin_urls"], ["https://www.linkedin.com/in/pranjal-paliwal"])
        self.assertEqual(pii["github_urls"], ["https://github.com/pranjal"])
        self.assertEqual(pii["portfolio_websites"], ["https://pranjal.ai"])
        self.assertTrue(pii["coverage"]["has_linkedin"])
        self.assertTrue(pii["coverage"]["has_portfolio"])

    def test_extracts_hidden_annotation_links_appended_to_raw_text(self) -> None:
        record = {"contact": {"links": []}, "derived": {}}
        raw_text = """
        Visible text only says LinkedIn Profile and Github.

        [EXTRACTED DOCUMENT LINKS]
        [PAGE 1 PDF_ANNOTATION] LinkedIn: https://www.linkedin.com/in/pranjal-paliwal-490/
        [PAGE 1 PDF_ANNOTATION] GitHub: https://github.com/Cranial490
        """

        enriched = enrich_record_pii(record, raw_text)
        pii = enriched["derived"]["pii_contact_intelligence"]

        self.assertEqual(pii["linkedin_urls"], ["https://www.linkedin.com/in/pranjal-paliwal-490"])
        self.assertEqual(pii["github_urls"], ["https://github.com/Cranial490"])
        self.assertIn("https://www.linkedin.com/in/pranjal-paliwal-490", enriched["contact"]["links"])

    def test_filters_resume_false_positive_pii_urls_and_dates(self) -> None:
        record = {
            "contact": {
                "links": [
                    "www.linkedin.com/in/neelabh-ai-mlops-architect",
                    "mailto:neelabh@example.com",
                ]
            },
            "derived": {},
        }
        raw_text = """
        Neelabh Prajapati
        neelabh@example.com | +14697772081
        LinkedIn: http://www.linkedin.com/in/neelabh-ai-mlops-architect?jobid=1234&lipi=tracking
        Truncated duplicate: https://www.linkedin.com/in/neelabh-ai-
        Skills: ASP.NET, ADO.Net
        Education 2005 - 2008 and 2002 - 2005
        """

        enriched = enrich_record_pii(record, raw_text)
        pii = enriched["derived"]["pii_contact_intelligence"]

        self.assertEqual(pii["phones"], ["+14697772081"])
        self.assertEqual(pii["linkedin_urls"], ["https://www.linkedin.com/in/neelabh-ai-mlops-architect"])
        self.assertEqual(pii["portfolio_websites"], [])
        self.assertEqual(enriched["contact"]["links"], ["https://www.linkedin.com/in/neelabh-ai-mlops-architect"])

    def test_public_candidate_record_redacts_contact_pii_when_role_disallowed(self) -> None:
        record = {
            "document_id": "doc-1",
            "email": "person@example.com",
            "phone": "555-111-2222",
            "contact": {
                "email": "person@example.com",
                "phone": "555-111-2222",
                "links": ["https://linkedin.com/in/person", "https://portfolio.example.com"],
            },
            "derived": {
                "pii_contact_intelligence": {
                    "emails": ["person@example.com"],
                    "phones": ["555-111-2222"],
                    "linkedin_urls": ["https://linkedin.com/in/person"],
                    "portfolio_websites": ["https://portfolio.example.com"],
                }
            },
        }

        redacted = public_candidate_record(record, allow_pii=False)

        self.assertEqual(redacted["email"], "[redacted]")
        self.assertEqual(redacted["phone"], "[redacted]")
        self.assertEqual(redacted["contact"]["email"], "[redacted]")
        self.assertEqual(redacted["contact"]["phone"], "[redacted]")
        self.assertEqual(redacted["contact"]["links"], [])
        pii = redacted["derived"]["pii_contact_intelligence"]
        self.assertEqual(pii["emails"], [])
        self.assertEqual(pii["phones"], [])
        self.assertEqual(pii["linkedin_urls"], [])
        self.assertEqual(pii["portfolio_websites"], [])

    def test_recursive_redaction_removes_pii_from_nested_ai_text(self) -> None:
        redacted = redact_contact_pii_payload({
            "summary": "Reach person@example.com or https://linkedin.com/in/person",
            "nested": {"evidence": "Phone 555-111-2222 and portfolio.example.com"},
            "links": ["https://linkedin.com/in/person"],
        })

        self.assertNotIn("person@example.com", redacted["summary"])
        self.assertNotIn("linkedin.com", redacted["summary"])
        self.assertNotIn("555-111-2222", redacted["nested"]["evidence"])
        self.assertEqual(redacted["links"], [])


if __name__ == "__main__":
    unittest.main()
