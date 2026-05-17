import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf import PdfReader, PdfWriter

from src.resume_intel.extractors import (
    _append_extracted_links,
    _extracted_link_lines,
    _extract_pdf_annotation_links,
    _extract_inline_links,
    _pdf_annotation_link,
    _should_prefer_pdfium_text,
)
from src.resume_intel.pipeline import _merge_extracted_links_into_model_json
from src.resume_intel.validate import validate_resume


class LinkExtractionTests(unittest.TestCase):
    def test_pdf_annotation_link_becomes_structured_link(self) -> None:
        link = _pdf_annotation_link({"/A": {"/URI": "https://www.linkedin.com/in/example"}}, 2)

        self.assertEqual(link["url"], "https://www.linkedin.com/in/example")
        self.assertEqual(link["label"], "LinkedIn")
        self.assertEqual(link["page_number"], 2)
        self.assertEqual(link["source"], "pdf_annotation")

    def test_extracted_links_are_appended_to_raw_text(self) -> None:
        text = _append_extracted_links(
            "Resume text only says LinkedIn",
            [{"url": "https://www.linkedin.com/in/example", "label": "LinkedIn", "page_number": 1, "source": "pdf_annotation"}],
        )

        self.assertIn("Resume text only says LinkedIn", text)
        self.assertIn("[EXTRACTED DOCUMENT LINKS]", text)
        self.assertIn("[PAGE 1 PDF_ANNOTATION] LinkedIn: https://www.linkedin.com/in/example", text)

    def test_link_lines_dedupe_duplicate_annotation_links(self) -> None:
        lines = _extracted_link_lines(
            [
                {"url": "https://portfolio.example.com", "label": "Portfolio", "page_number": 1, "source": "pdf_annotation"},
                {"url": "https://portfolio.example.com", "label": "Portfolio", "page_number": 1, "source": "pdf_annotation"},
            ]
        )

        self.assertEqual(lines, ["[PAGE 1 PDF_ANNOTATION] Portfolio: https://portfolio.example.com"])

    def test_inline_extraction_captures_bare_portfolio_domain(self) -> None:
        links = _extract_inline_links("Portfolio pranjal.ai and GitHub github.com/pranjal", "pdf_text", 1)

        self.assertIn({"url": "https://pranjal.ai", "label": "Portfolio", "page_number": 1, "source": "pdf_text"}, links)
        self.assertIn({"url": "https://github.com/pranjal", "label": "GitHub", "page_number": 1, "source": "pdf_text"}, links)

    def test_reads_real_pdf_uri_annotation(self) -> None:
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "resume.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=612, height=792)
            writer.add_uri(0, "https://www.linkedin.com/in/hidden-profile", [10, 10, 120, 40])
            with path.open("wb") as handle:
                writer.write(handle)

            links = _extract_pdf_annotation_links(PdfReader(str(path)))

        self.assertEqual(
            links,
            [
                {
                    "url": "https://www.linkedin.com/in/hidden-profile",
                    "label": "LinkedIn",
                    "page_number": 1,
                    "source": "pdf_annotation",
                }
            ],
        )

    def test_prefers_pdfium_when_pypdf_text_has_font_encoding_artifacts(self) -> None:
        pypdf_pages = [
            (
                "Founding SoHware Engineer with experience designing plaTorms and integraRng systems. "
                "Automated retraining workflows and reduced operaRonal costs. "
            )
            * 4
        ]
        pdfium_pages = [
            (
                "Founding Software Engineer with experience designing platforms and integrating systems. "
                "Automated retraining workflows and reduced operational costs. "
            )
            * 4
        ]

        self.assertTrue(_should_prefer_pdfium_text(pypdf_pages, pdfium_pages))

    def test_pipeline_merges_extracted_annotation_links_before_validation(self) -> None:
        model_json = {
            "document_id": "doc-1",
            "source_file": "resume.pdf",
            "name": "Example Candidate",
            "contact": {"links": []},
            "skills": ["Python"],
            "experience": [{"company": "Example", "title": "Engineer", "start_date": "2022-01", "end_date": "2024-01"}],
            "education": [{"school": "Example University"}],
        }
        links = [{"url": "https://www.linkedin.com/in/example", "label": "LinkedIn", "page_number": 1, "source": "pdf_annotation"}]

        _merge_extracted_links_into_model_json(model_json, links)
        record, report = validate_resume(
            model_json,
            _append_extracted_links("Resume visible text says LinkedIn Profile", links),
        )

        self.assertEqual(record.contact.links, ["https://www.linkedin.com/in/example"])
        self.assertNotIn("links_may_be_missing", report["warnings"])


if __name__ == "__main__":
    unittest.main()
