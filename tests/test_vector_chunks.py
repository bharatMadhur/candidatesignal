from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.vector_search import candidate_chunks


class CandidateSearchChunkTests(unittest.TestCase):
    def test_indexes_raw_text_contact_links_and_locations(self) -> None:
        record = {
            "document_id": "doc-1",
            "name": "Pranjal Paliwal",
            "summary": "Founding engineer building AI data platforms.",
            "skills": ["Databricks", "LangChain"],
            "contact": {
                "email": "pranjal@example.com",
                "phone": "774.253.7593",
                "location": "San Francisco, CA",
                "links": ["https://linkedin.com/in/pranjal-paliwal", "https://www.pranjal.ai"],
            },
            "derived": {
                "pii_contact_intelligence": {
                    "emails": ["pranjal@example.com"],
                    "phones": ["774.253.7593"],
                    "linkedin_urls": ["https://linkedin.com/in/pranjal-paliwal"],
                    "portfolio_websites": ["https://www.pranjal.ai"],
                    "all_urls": ["https://linkedin.com/in/pranjal-paliwal", "https://www.pranjal.ai"],
                },
                "countries_associated": [{"country": "United States"}],
                "location_intelligence": {
                    "current_location": "San Francisco, CA",
                    "structured_locations": ["San Francisco"],
                    "raw_location_mentions": ["California"],
                    "remote_work_signals": ["Remote"],
                },
            },
            "experience": [
                {
                    "company": "Orbit Systems Inc",
                    "title": "Founding Engineer",
                    "bullets": ["Built an AI analytics assistant over Salesforce and PostgreSQL."],
                }
            ],
        }

        chunks = candidate_chunks(record, "Cerner Healthcare migration with PySpark appears only in raw CV text.")
        by_type = {chunk_type: text for chunk_type, text, _, _ in chunks}

        self.assertIn("contact_pii", by_type)
        self.assertIn("https://linkedin.com/in/pranjal-paliwal", by_type["contact_pii"])
        self.assertIn("https://www.pranjal.ai", by_type["contact_pii"])
        self.assertIn("locations", by_type)
        self.assertIn("United States", by_type["locations"])
        self.assertTrue(any(chunk_type.startswith("raw_text_") and "Cerner Healthcare" in text for chunk_type, text, _, _ in chunks))


if __name__ == "__main__":
    unittest.main()
