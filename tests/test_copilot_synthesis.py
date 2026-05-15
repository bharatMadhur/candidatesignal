from __future__ import annotations

import unittest

from resume_intel.copilot_synthesis import _candidate_for_synthesis


class CopilotSynthesisTests(unittest.TestCase):
    def test_redacts_candidate_contact_pii_for_external_synthesis(self) -> None:
        candidate = {
            "document_id": "doc-1",
            "name": "Pranjal Shah",
            "email": "candidate@example.com",
            "phone": "555-111-2222",
            "current_title": "AI Engineer",
            "location": "Columbus, OH",
            "evidence": [
                {"snippet": "Pranjal Shah built RAG system. Email candidate@example.com. Portfolio https://example.com", "chunk_type": "raw_text"},
                {"snippet": "candidate@example.com", "chunk_type": "contact_pii"},
            ],
        }

        safe = _candidate_for_synthesis(candidate, redact_pii=True, candidate_label="Candidate 1")

        self.assertNotIn("document_id", safe)
        self.assertNotIn("email", safe)
        self.assertNotIn("phone", safe)
        self.assertNotIn("location", safe)
        self.assertEqual(safe["name"], "Candidate 1")
        self.assertEqual(len(safe["evidence"]), 1)
        self.assertNotIn("Pranjal", safe["evidence"][0]["snippet"])
        self.assertNotIn("candidate@example.com", safe["evidence"][0]["snippet"])
        self.assertNotIn("https://example.com", safe["evidence"][0]["snippet"])

    def test_can_include_contact_when_policy_allows_unredacted_synthesis(self) -> None:
        candidate = {"document_id": "doc-1", "email": "candidate@example.com", "phone": "555-111-2222", "location": "Columbus, OH"}

        safe = _candidate_for_synthesis(candidate, redact_pii=False)

        self.assertEqual(safe["document_id"], "doc-1")
        self.assertEqual(safe["email"], "candidate@example.com")
        self.assertEqual(safe["phone"], "555-111-2222")
        self.assertEqual(safe["location"], "Columbus, OH")


if __name__ == "__main__":
    unittest.main()
