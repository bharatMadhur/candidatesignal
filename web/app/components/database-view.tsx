"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CandidateSummary } from "../../lib/api";
import {
  applyDatabaseFilters,
  candidateNoteSignalDisplay,
  candidateNoteSignalKey,
} from "../lib/candidate-database";
import { CandidateTable } from "./candidate-table";

export function DatabaseView({
  candidates,
  query,
  setQuery,
  open,
}: {
  candidates: CandidateSummary[];
  query: string;
  setQuery: (value: string) => void;
  open: (id: string) => void;
}) {
  const [filters, setFilters] = useState<string[]>([]);
  const readyCount = candidates.filter((candidate) => (candidate.coverage ?? 0) >= 0.8 && Number(candidate.duplicate_risk_score ?? 0) < 0.75).length;
  const needsReviewCount = candidates.filter((candidate) => (candidate.coverage ?? 0) < 0.8 || Number(candidate.duplicate_risk_score ?? 0) >= 0.75).length;
  const missingLocationCount = candidates.filter((candidate) => !candidate.location && !(candidate.countries ?? []).length).length;
  const countryFilters = useMemo(() => {
    const countries = new Set<string>();
    candidates.forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country)));
    return Array.from(countries).sort((left, right) => left.localeCompare(right)).slice(0, 6);
  }, [candidates]);
  const noteSignalFilters = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    candidates.forEach((candidate) => {
      (candidate.note_signals ?? []).forEach((signal) => {
        const key = candidateNoteSignalKey(signal);
        if (!key) return;
        const existing = counts.get(key);
        counts.set(key, { label: candidateNoteSignalDisplay(signal), count: (existing?.count ?? 0) + 1 });
      });
    });
    return [...counts.entries()]
      .sort((left, right) => right[1].count - left[1].count || left[1].label.localeCompare(right[1].label))
      .slice(0, 5)
      .map(([key, value]) => ({ id: `note:${key}`, label: value.label }));
  }, [candidates]);
  const filteredCandidates = applyDatabaseFilters(candidates, filters);
  const filterOptions = [
    { id: "ai", label: "AI / GenAI" },
    { id: "experience", label: "5+ Years" },
    ...countryFilters.map((country) => ({ id: `country:${country}`, label: country })),
    { id: "seniority", label: "Lead/Senior" },
    { id: "duplicate", label: "Version Signal" },
    { id: "coverage", label: "Complete Profiles" },
    { id: "missing_location", label: "Missing Location" },
    ...noteSignalFilters,
  ];

  function toggleFilter(id: string) {
    setFilters((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  return (
    <section className="databasePage">
      <header className="profilesHeader">
        <div>
          <span className="eyebrow">Profiles</span>
          <h2>Candidate Profiles</h2>
          <p>Search the company resume database using profile fields, recruiter notes, locations, and raw resume evidence.</p>
        </div>
        <div className="profilesHeaderStats" aria-label="Database summary">
          <span>{candidates.length} profiles</span>
          <span>{readyCount} ready</span>
          {needsReviewCount ? <span>{needsReviewCount} review</span> : null}
          {missingLocationCount ? <span>{missingLocationCount} missing location</span> : null}
        </div>
      </header>

      <section className="profileSearchPanel sourceSearchCard compactSearchCard">
        <div className="sourceSearchHeader">
          <div>
            <span className="eyebrow">Your DB</span>
            <h3>Search candidates</h3>
          </div>
        </div>
        <form className="semanticSearch" onSubmit={(event) => event.preventDefault()}>
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, company, country, raw resume text, or recruiter note" />
          <button type="submit">Search</button>
        </form>
        <div className="filterRow">
          {filterOptions.map((item) => <button className={filters.includes(item.id) ? "filterChip active" : "filterChip"} key={item.id} onClick={() => toggleFilter(item.id)}>{item.label}</button>)}
          <button className="filterChip" onClick={() => setFilters([])}>Clear</button>
        </div>
      </section>

      <CandidateTable candidates={filteredCandidates} open={open} />
    </section>
  );
}
