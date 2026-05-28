"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { CandidateSummary } from "../../lib/api";
import {
  candidateListHazards,
  candidateNoteSignalLabels,
  candidateProfileFreshnessLabel,
  candidateRoleFactsNeedReview,
  candidateSortValue,
  sortArrow,
  type CandidateSortKey,
} from "../lib/candidate-database";
import { normalizeCandidateVersionStatus, versionStatusLabel } from "../lib/candidate-versions";
import { domainLabel } from "../lib/format";

export function CandidateTable({ candidates, open }: { candidates: CandidateSummary[]; open: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: CandidateSortKey; direction: "asc" | "desc" }>({ key: "updated", direction: "desc" });
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((left, right) => {
      const leftValue = candidateSortValue(left, sort.key);
      const rightValue = candidateSortValue(right, sort.key);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [candidates, sort]);

  function changeSort(key: CandidateSortKey) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
  }

  return (
    <div className="table candidateTable">
      <div className="tableRow header">
        <button onClick={() => changeSort("name")}>Name {sortArrow(sort, "name")}</button>
        <button onClick={() => changeSort("title")}>Current Role {sortArrow(sort, "title")}</button>
        <button onClick={() => changeSort("company")}>Company {sortArrow(sort, "company")}</button>
        <button onClick={() => changeSort("years")}>Experience {sortArrow(sort, "years")}</button>
        <span>Domains</span>
        <span>Location / Country</span>
        <button onClick={() => changeSort("coverage")}>Completeness {sortArrow(sort, "coverage")}</button>
        <button onClick={() => changeSort("risk")}>Version Signal {sortArrow(sort, "risk")}</button>
        <button onClick={() => changeSort("updated")}>Updated {sortArrow(sort, "updated")}</button>
      </div>
      {!sortedCandidates.length ? (
        <div className="tableEmpty">
          <strong>No candidates match this view.</strong>
          <span>Clear filters, change the search query, or upload resumes to build the database.</span>
        </div>
      ) : null}
      {sortedCandidates.map((item) => {
        const hazardItems = candidateListHazards(item);
        const noteSignals = candidateNoteSignalLabels(item).slice(0, 2);
        const freshness = candidateProfileFreshnessLabel(item.profile_freshness);
        return (
          <button className="tableRow" key={item.document_id} onClick={() => open(item.document_id)}>
            <span className="truncateCell candidateListNameCell" title={item.name ?? "Unknown"}>
              <span>
                {hazardItems.length ? <AlertTriangle className="candidateListHazardIcon" size={15} aria-label={hazardItems.join(", ")} /> : null}
                {item.name ?? "Unknown"}
              </span>
              <small>{hazardItems[0] ?? item.email ?? item.phone ?? "No contact ID"}</small>
            </span>
            <span className="truncateCell" title={item.current_title ?? "Missing"}>
              {item.current_title ?? "Missing"}
              {candidateRoleFactsNeedReview(item) ? <small className="factReviewText">Role facts need review</small> : null}
            </span>
            <span className="truncateCell" title={item.current_company ?? "Missing"}>{item.current_company ?? "Missing"}</span>
            <span>{typeof item.total_years_experience === "number" ? `${item.total_years_experience} yrs` : "N/A"}<small>{item.seniority ?? "Unknown seniority"}</small></span>
            <span className="truncateCell" title={(item.top_domains ?? []).map(domainLabel).join(", ") || "Missing"}>
              {(item.top_domains ?? []).slice(0, 2).map(domainLabel).join(", ") || "Missing"}
              {noteSignals.length ? <small>{noteSignals.join(" | ")}</small> : null}
            </span>
            <span className="truncateCell" title={[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}>
              {[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}
              {freshness ? <small>{freshness}</small> : null}
            </span>
            <span className="coverageCell"><i style={{ width: `${Math.round((item.coverage ?? 0) * 100)}%` }} />{item.coverage ? `${Math.round(item.coverage * 100)}%` : "N/A"}</span>
            <span>{item.duplicate_risk_score ? <b className="riskBadge">{Math.round(item.duplicate_risk_score * 100)}% {versionStatusLabel(normalizeCandidateVersionStatus(item.duplicate_status))}</b> : "Unique"}</span>
            <span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "N/A"}</span>
          </button>
        );
      })}
    </div>
  );
}
