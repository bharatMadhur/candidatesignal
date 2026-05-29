import { LinkedInVerificationRun } from "../../lib/api";
import { domainLabel, formatDateTime, toTextList } from "../lib/format";
import { ProgressBar } from "./primitives";

type JsonRecord = Record<string, unknown>;

export type LinkedInExternalVerification = {
  profile?: unknown;
  comparison?: JsonRecord;
  diff?: JsonRecord;
} | null | undefined;

export function LinkedInVerificationSummary({ run, external }: { run: LinkedInVerificationRun | null; external: LinkedInExternalVerification }) {
  const comparison = objectHasValues(run?.comparison) ? run?.comparison ?? {} : external?.comparison ?? {};
  const diff = objectHasValues(run?.profile_diff) ? run?.profile_diff ?? {} : external?.diff ?? {};
  const reasons = toTextList(comparison.reasons ?? []);
  const gaps = toTextList(comparison.gaps ?? []);
  const summary = toTextList(diff.summary ?? []);
  if (!run && !external?.profile) {
    return <p className="muted">Not checked yet. Verification runs securely on the server.</p>;
  }
  if (run?.status === "queued" || run?.status === "running") {
    return (
      <div className="linkedinVerifySummary">
        <ProgressBar value={run.status === "running" ? 65 : 20} />
        <span>{domainLabel(run.stage ?? run.status)}</span>
      </div>
    );
  }
  if (run?.status === "failed") {
    return <p className="muted">Verification failed: {run.error_message || "provider error"}</p>;
  }
  return (
    <div className="linkedinVerifySummary">
      <div className="compactMetaList">
        <div><span>Match confidence</span><strong>{typeof comparison.match_confidence === "number" ? `${Math.round(comparison.match_confidence * 100)}%` : "Unknown"}</strong></div>
        <div><span>Last checked</span><strong>{formatDateTime(run?.completed_at)}</strong></div>
      </div>
      {reasons.length ? <ul>{reasons.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null}
      {!reasons.length && summary.length ? <ul>{summary.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null}
      {gaps.length ? <p className="muted">{gaps[0]}</p> : null}
    </div>
  );
}

export function linkedinMatchConfidence(run: LinkedInVerificationRun | null, external: LinkedInExternalVerification): number | null {
  const direct = run?.match_confidence;
  if (typeof direct === "number") return direct;
  const comparison = objectHasValues(run?.comparison) ? run?.comparison ?? {} : external?.comparison ?? {};
  return typeof comparison.match_confidence === "number" ? comparison.match_confidence : null;
}

export function linkedinVerificationStatus(run: LinkedInVerificationRun | null, external: LinkedInExternalVerification) {
  const status = run?.status === "succeeded" ? run.result_status : run?.status;
  return String(status || external?.comparison?.status || "not_checked").replaceAll("_", "-");
}

export function linkedinVerificationLabel(run: LinkedInVerificationRun | null, external: LinkedInExternalVerification) {
  const status = run?.status === "succeeded" ? run.result_status : run?.status;
  return domainLabel(String(status || external?.comparison?.status || "not checked"));
}

export function isLinkedInVerified(run: LinkedInVerificationRun | null, verificationItem: unknown, external: LinkedInExternalVerification) {
  const verification = asRecord(verificationItem);
  if (run?.status === "succeeded" && run.result_status === "verified") return true;
  if (verification?.status === "verified") return true;
  return external?.comparison?.status === "verified";
}

export function PiiGroup({ label, values, compact = false }: { label: string; values: unknown; compact?: boolean }) {
  const list = toTextList(Array.isArray(values) ? values : []).slice(0, compact ? 6 : 4);
  return (
    <article className="piiGroup">
      <strong>{label}</strong>
      {list.length ? (
        <div>
          {list.map((item, index) => item.startsWith("http") ? (
            <a key={`${item}-${index}`} href={item} target="_blank" rel="noreferrer">{item}</a>
          ) : (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      ) : <span className="muted">Not found</span>}
    </article>
  );
}

export function VerificationRow({ label, item }: { label: string; item?: { status?: string | null; reason?: string | null } }) {
  const status = item?.status ?? "missing";
  return (
    <article className="verificationRow">
      <strong>{label}</strong>
      <span>{domainLabel(status)}</span>
      <p>{item?.reason ?? "No verification signal found"}</p>
    </article>
  );
}

export function WorkstreamList({ workstreams }: { workstreams: Array<{ name?: string | null; start_date?: string | null; end_date?: string | null; bullets?: string[] }> }) {
  return (
    <div className="workstreamList">
      <span>Same-company workstreams</span>
      {workstreams.slice(0, 5).map((item, index) => (
        <article key={`${item.name ?? "workstream"}-${index}`}>
          <strong>{item.name ?? "Workstream"}</strong>
          <em>{item.start_date ?? "Unknown"} - {item.end_date ?? "Present"}</em>
          {item.bullets?.[0] ? <p>{item.bullets[0]}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function NoteTypeButtons({ setNoteName }: { setNoteName: (value: string) => void }) {
  const types = ["Screening", "Client Feedback", "Concern", "Salary", "Availability"];
  return (
    <div className="noteTypeButtons" aria-label="Recruiter note types">
      {types.map((type) => <button className="plain small" type="button" key={type} onClick={() => setNoteName(type)}>{type}</button>)}
    </div>
  );
}

function objectHasValues(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? value as JsonRecord : null;
}
