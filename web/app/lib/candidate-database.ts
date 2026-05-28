import type { Candidate, CandidateSummary } from "../../lib/api";
import { domainLabel } from "./format";
import { normalizeCandidateVersionStatus } from "./candidate-versions";

export type CandidateReviewSignal = "low_coverage" | "role_fact_review" | "profile_freshness_review";
export type CandidateSortKey = "name" | "title" | "company" | "years" | "coverage" | "risk" | "updated";

export function topDomainCounts(candidates: CandidateSummary[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    (candidate.top_domains ?? []).forEach((domain) => counts.set(domain, (counts.get(domain) ?? 0) + 1));
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
}

export function applyDatabaseFilters(candidates: CandidateSummary[], filters: string[]) {
  const selectedCountries = filters
    .filter((item) => item.startsWith("country:"))
    .map((item) => item.slice("country:".length));
  const selectedNoteSignals = filters
    .filter((item) => item.startsWith("note:"))
    .map((item) => item.slice("note:".length));
  return candidates.filter((candidate) => {
    if (filters.includes("ai") && !(candidate.top_domains ?? []).some((domain) => /ai|gen|llm|conversation/i.test(domain))) return false;
    if (filters.includes("experience") && Number(candidate.total_years_experience ?? 0) < 5) return false;
    if (selectedCountries.length && !selectedCountries.some((country) => (candidate.countries ?? []).includes(country))) return false;
    if (selectedNoteSignals.length && !selectedNoteSignals.some((key) => (candidate.note_signals ?? []).some((signal) => candidateNoteSignalKey(signal) === key))) return false;
    if (filters.includes("seniority") && !/lead|senior|principal|staff/i.test(candidate.seniority ?? `${candidate.current_title ?? ""}`)) return false;
    if (filters.includes("duplicate") && Number(candidate.duplicate_risk_score ?? 0) < 0.75) return false;
    if (filters.includes("coverage") && Number(candidate.coverage ?? 0) <= 0.8) return false;
    if (filters.includes("missing_location") && candidate.location) return false;
    return true;
  });
}

export function candidateSortValue(candidate: CandidateSummary, key: CandidateSortKey) {
  if (key === "name") return candidate.name ?? "";
  if (key === "title") return candidate.current_title ?? "";
  if (key === "company") return candidate.current_company ?? "";
  if (key === "years") return Number(candidate.total_years_experience ?? -1);
  if (key === "coverage") return Number(candidate.coverage ?? -1);
  if (key === "risk") return Number(candidate.duplicate_risk_score ?? 0);
  return candidate.updated_at ? new Date(candidate.updated_at).getTime() : 0;
}

export function sortArrow(sort: { key: CandidateSortKey; direction: "asc" | "desc" }, key: CandidateSortKey) {
  if (sort.key !== key) return "";
  return sort.direction === "asc" ? "↑" : "↓";
}

export function candidateRoleFactsNeedReview(candidate: CandidateSummary) {
  return Boolean(
    candidate.current_role_verification_status
    && candidate.current_role_verification_status !== "verified"
    && candidate.current_role_verification_status !== "missing"
  );
}

export function candidateNoteSignalLabels(candidate: CandidateSummary) {
  return (candidate.note_signals ?? [])
    .map(candidateNoteSignalDisplay)
    .filter(Boolean);
}

export function candidateNoteSignalDisplay(signal: { category?: string; label?: string; value?: string | null }) {
  const label = domainLabel(String(signal.label || signal.value || signal.category || ""));
  const value = signal.value && String(signal.value).toLowerCase() !== String(signal.label || "").toLowerCase()
    ? `: ${signal.value}`
    : "";
  return `${label}${value}`.trim();
}

export function candidateNoteSignalKey(signal: { category?: string; label?: string; value?: string | null }) {
  const category = String(signal.category || "").toLowerCase().trim();
  const label = String(signal.label || signal.value || "").toLowerCase().trim();
  if (!category && !label) return "";
  return `${category}:${label}`.replace(/\s+/g, "_");
}

export function candidateProfileFreshnessLabel(freshness?: CandidateSummary["profile_freshness"]) {
  if (!freshness?.label) return "";
  if (freshness.status === "fresh") return freshness.label;
  return freshness.summary ? `${freshness.label}: ${freshness.summary}` : freshness.label;
}

export function profileFreshnessBadgeClass(status?: string) {
  if (status === "fresh") return "freshnessBadge fresh";
  if (status === "stale" || status === "possibly_stale") return "freshnessBadge stale";
  return "freshnessBadge review";
}

export function candidateProfileFreshness(candidate: CandidateSummary | Candidate): CandidateSummary["profile_freshness"] {
  return (candidate as CandidateSummary).profile_freshness ?? (candidate as Candidate).derived?.profile_freshness;
}

export function candidateProfileFreshnessNeedsReview(candidate: CandidateSummary | Candidate) {
  const freshness = candidateProfileFreshness(candidate);
  return ["stale", "possibly_stale", "needs_verification"].includes(String(freshness?.status ?? "")) && !candidateReviewSignalDone(candidate, "profile_freshness_review");
}

export function candidateListHazards(candidate: CandidateSummary) {
  const hazards: string[] = [];
  const coverage = Number(candidate.coverage ?? 0);
  if (coverage > 0 && coverage < 0.8 && !candidateReviewSignalDone(candidate, "low_coverage")) {
    hazards.push(coverage < 0.65 ? `Low profile coverage: ${Math.round(coverage * 100)}%` : `Review profile coverage: ${Math.round(coverage * 100)}%`);
  }
  if (candidateRoleFactsNeedReview(candidate) && !candidateReviewSignalDone(candidate, "role_fact_review")) {
    hazards.push("Role facts need review");
  }
  if (
    Number(candidate.duplicate_risk_score ?? 0) >= 0.75
    && normalizeCandidateVersionStatus(candidate.duplicate_status) === "suggested"
  ) {
    hazards.push("Possible repeated candidate upload");
  }
  if (candidateProfileFreshnessNeedsReview(candidate)) {
    hazards.push(candidate.profile_freshness?.summary ?? "Profile may be stale");
  }
  return hazards;
}

export function candidateReviewSignalDone(candidate: CandidateSummary | Candidate, signalKey: CandidateReviewSignal) {
  return Boolean(candidate.reviewed_signals?.includes(signalKey));
}
