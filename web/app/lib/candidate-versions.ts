import type { Candidate, CandidateVersionDiff, CandidateVersionMatch } from "../../lib/api";
import { domainLabel } from "./format";

export type CandidateVersionLink = {
  documentId: string;
  name: string;
  fileName: string;
  score: number;
  status: string;
  uploadedAt?: string | null;
  extractionMethod?: string | null;
  diffs: CandidateVersionDiff[];
};

export function candidateVersionLinks(candidate: Candidate, matches: CandidateVersionMatch[]) {
  const currentId = candidate.document_id;
  const rows: CandidateVersionLink[] = [];
  const seen = new Set<string>();
  for (const match of matches ?? []) {
    const currentIsLeft = match.left_document_id === currentId;
    const currentIsRight = match.right_document_id === currentId;
    if (!currentIsLeft && !currentIsRight) continue;
    const otherId = currentIsLeft ? match.right_document_id : match.left_document_id;
    if (!otherId || seen.has(otherId)) continue;
    seen.add(otherId);
    const otherName = currentIsLeft ? match.right_name : match.left_name;
    const version = currentIsLeft ? match.right_version : match.left_version;
    rows.push({
      documentId: otherId,
      name: otherName || "Candidate version",
      fileName: version?.latest_document?.original_filename || version?.documents?.[0]?.original_filename || "Uploaded resume",
      score: Number(match.score ?? 0),
      status: normalizeCandidateVersionStatus(match.status),
      uploadedAt: version?.latest_document?.uploaded_at || version?.candidate_updated_at || version?.candidate_created_at,
      extractionMethod: version?.latest_document?.extraction_method || version?.page_methods?.[0]?.extraction_method,
      diffs: match.field_diffs ?? [],
    });
  }
  return rows.sort((left, right) => {
    const statusDelta = candidateVersionStatusRank(left.status) - candidateVersionStatusRank(right.status);
    return statusDelta || right.score - left.score;
  });
}

export function normalizeCandidateVersionStatus(value?: string | null) {
  const normalized = (value || "suggested").replace("-", "_");
  const mapped: Record<string, string> = {
    same_person: "versioned",
    not_same_person: "separate",
    version_candidate: "suggested",
  };
  return mapped[normalized] ?? normalized;
}

export function candidateVersionStatusRank(value?: string | null) {
  const status = normalizeCandidateVersionStatus(value);
  const ranks: Record<string, number> = {
    versioned: 0,
    suggested: 1,
    review_later: 2,
    separate: 3,
  };
  return ranks[status] ?? 4;
}

export function candidateVersionSummary(links: CandidateVersionLink[]) {
  const confirmed = links.filter((item) => normalizeCandidateVersionStatus(item.status) === "versioned").length;
  const review = links.filter((item) => ["suggested", "review_later"].includes(normalizeCandidateVersionStatus(item.status))).length;
  const separate = links.filter((item) => normalizeCandidateVersionStatus(item.status) === "separate").length;
  const visibleCount = confirmed + review;
  if (confirmed) {
    return {
      badge: `${confirmed} confirmed version${confirmed === 1 ? "" : "s"}`,
      quickFact: String(confirmed),
      railText: `${confirmed} uploaded resume version${confirmed === 1 ? "" : "s"} confirmed for this candidate. Separate files are preserved in the version history.`,
      needsReview: false,
      visibleCount,
    };
  }
  if (review) {
    return {
      badge: `${review} version signal${review === 1 ? "" : "s"} to review`,
      quickFact: `${review} review`,
      railText: `${review} possible repeated upload${review === 1 ? "" : "s"} need recruiter review before being treated as resume versions.`,
      needsReview: true,
      visibleCount,
    };
  }
  if (separate) {
    return {
      badge: "Version review complete",
      quickFact: "Separate",
      railText: "Related uploads were reviewed and kept separate, so they are not counted as resume versions.",
      needsReview: false,
      visibleCount: 0,
    };
  }
  return {
    badge: "No version signals",
    quickFact: "None",
    railText: "No related resume versions are linked to this candidate.",
    needsReview: false,
    visibleCount: 0,
  };
}

export function candidateVersionDocumentLabel(candidate: Candidate) {
  return candidate.original_filename || candidate.source_file?.split("/").pop() || "Uploaded resume";
}

export function candidateVersionCompareRows(match: CandidateVersionMatch) {
  if (match.field_diffs?.length) {
    return match.field_diffs.map((row) => ({
      label: row.label,
      left: row.left,
      right: row.right,
      status: row.status,
      detail: row.detail,
    }));
  }
  const left = match.left_profile ?? {};
  const right = match.right_profile ?? {};
  return [
    { label: "Email", left: left.email, right: right.email, status: undefined, detail: undefined },
    { label: "Phone", left: left.phone, right: right.phone, status: undefined, detail: undefined },
    { label: "Current title", left: left.current_title, right: right.current_title, status: undefined, detail: undefined },
    { label: "Current company", left: left.current_company, right: right.current_company, status: undefined, detail: undefined },
    { label: "Location", left: left.location, right: right.location, status: undefined, detail: undefined },
    { label: "Countries", left: listValue(left.countries), right: listValue(right.countries), status: undefined, detail: undefined },
    { label: "Companies", left: listValue(left.companies), right: listValue(right.companies), status: undefined, detail: undefined },
    { label: "Education", left: listValue(left.education), right: listValue(right.education), status: undefined, detail: undefined },
    { label: "Skills", left: listValue(left.skills), right: listValue(right.skills), status: undefined, detail: undefined },
  ];
}

export function versionStatusLabel(value?: string | null) {
  if (!value) return "possible version";
  const status = normalizeCandidateVersionStatus(value);
  const mapped: Record<string, string> = {
    suggested: "possible version",
    review_later: "review later",
    versioned: "versioned",
    separate: "kept separate",
    same_person: "versioned",
    not_same_person: "kept separate",
    merged: "legacy merged",
  };
  return mapped[status] ?? domainLabel(status);
}

function listValue(value: unknown) {
  if (!Array.isArray(value)) return typeof value === "string" ? value : "";
  return value.filter(Boolean).slice(0, 10).join(", ");
}
