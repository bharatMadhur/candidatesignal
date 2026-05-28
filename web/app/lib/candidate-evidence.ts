export type EvidenceRowInput = { label: string; value?: unknown; source: string; query?: string[] };
type EvidenceMapItem = { claim?: unknown; evidence?: unknown };

export function buildRecruiterEvidenceRows(facts: EvidenceRowInput[], inferences: EvidenceRowInput[], evidenceMap: EvidenceMapItem[], rawText: string) {
  const rows = [
    ...facts.map((item, index) => ({ ...item, kind: "Fact" as const, id: `fact-${item.label}-${index}` })),
    ...inferences.map((item, index) => ({ ...item, kind: "AI interpretation" as const, id: `inference-${item.label}-${index}` })),
  ];
  return rows
    .filter((item) => String(item.value ?? "").trim())
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      claim: String(item.value ?? "").trim(),
      source: item.source,
      snippet: findClaimEvidence(item.value, evidenceMap, rawText, item.query ?? []),
    }))
    .slice(0, 24);
}

export function findClaimEvidence(value: unknown, evidenceMap: EvidenceMapItem[], rawText: string, fallbackTerms: string[]) {
  const text = String(value || "");
  const terms = evidenceTerms(text);
  const mapped = evidenceMap.find((item) => {
    const claimTerms = evidenceTerms(item?.claim ?? "");
    const overlap = claimTerms.filter((term) => terms.includes(term));
    return overlap.length >= 2;
  });
  const mappedEvidence = Array.isArray(mapped?.evidence) ? mapped.evidence.find((item: unknown) => String(item || "").trim()) : "";
  if (mappedEvidence) return String(mappedEvidence).slice(0, 280);
  return findEvidenceSnippet(rawText, fallbackTerms.length ? fallbackTerms : terms);
}

export function findEvidenceSnippet(rawText: string, terms: string[]) {
  if (!rawText || !terms.length) return "";
  const normalizedTerms = terms.map((term) => String(term || "").trim()).filter((term) => term.length >= 3);
  if (!normalizedTerms.length) return "";
  const flattened = rawText.replace(/\s+/g, " ").trim();
  const lower = flattened.toLowerCase();
  const hit = normalizedTerms
    .map((term) => ({ term, index: lower.indexOf(term.toLowerCase()) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!hit) return "";
  const start = Math.max(0, hit.index - 110);
  const end = Math.min(flattened.length, hit.index + hit.term.length + 170);
  return `${start > 0 ? "... " : ""}${flattened.slice(start, end)}${end < flattened.length ? " ..." : ""}`;
}

export function evidenceTerms(value: unknown) {
  const text = String(value || "").toLowerCase();
  const stopwords = new Set(["with", "from", "that", "this", "role", "good", "fit", "for", "and", "the", "ask", "current", "candidate", "experience"]);
  return Array.from(new Set(text.match(/[a-z0-9+#.]{3,}/g) ?? []))
    .filter((term) => !stopwords.has(term))
    .slice(0, 8);
}

export function evidenceSourceLabel(evidence: { source_label?: string | null; chunk_type?: string | null; page_number?: number | null }) {
  const label = evidence.source_label || evidence.chunk_type || "Candidate evidence";
  const normalized = String(label).toLowerCase();
  if (normalized.includes("raw extracted")) return evidence.page_number ? `Raw CV page ${evidence.page_number}` : "Raw CV text";
  if (normalized.includes("parsed skills") || normalized === "skills") return "Parsed skills";
  if (normalized.includes("recruiter notes") || normalized === "notes") return "Recruiter notes";
  if (normalized.includes("ai hr") || normalized.includes("ai_intelligence")) return "AI intelligence";
  if (normalized.includes("experience")) return label;
  if (normalized.includes("location")) return "Location signals";
  return label;
}
