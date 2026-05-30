"use client";

import { Database, FileSearch, ShieldCheck } from "lucide-react";

export function CandidateVisibilityPanel({
  settings,
  busy,
  toggleNativeSearch,
}: {
  settings: Record<string, unknown>;
  busy: boolean;
  toggleNativeSearch: (enabled: boolean) => Promise<void>;
}) {
  const nativeSearchEnabled = Boolean(settings.candidate_signal_native_search_enabled);
  return (
    <article className="candidatePortalCard candidateVisibilityCard">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Recruiter visibility</span>
          <h2>{nativeSearchEnabled ? "Searchable, PII locked" : "Private"}</h2>
          <p>Candidates can opt into recruiter discovery without exposing email, phone, LinkedIn, portfolio, or GitHub until they approve access.</p>
        </div>
      </div>
      <div className="candidateVisibilityRows">
        <span>
          <ShieldCheck size={15} /> PII permission required
        </span>
        <span>
          <Database size={15} /> Candidate-owned profile
        </span>
        <span>
          <FileSearch size={15} /> Resume versions stay controlled
        </span>
      </div>
      <button className={nativeSearchEnabled ? "secondary fullWidth" : "primary fullWidth"} type="button" disabled={busy} onClick={() => toggleNativeSearch(!nativeSearchEnabled)}>
        {nativeSearchEnabled ? "Turn recruiter discovery off" : "Make searchable without PII"}
      </button>
    </article>
  );
}
