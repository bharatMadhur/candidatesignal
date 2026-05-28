"use client";

import type { CandidateAccessRequest, CandidateApplication, CandidateResumeShare } from "../../lib/api";
import { formatDateTime, humanizeLabel } from "../lib/format";
import { EmptyPanel } from "./primitives";

export function CandidateSharePanel({
  shares,
  selectedVersionId,
  shareLabel,
  setShareLabel,
  includePii,
  setIncludePii,
  busy,
  createShare,
  revokeShare,
}: {
  shares: CandidateResumeShare[];
  selectedVersionId: string;
  shareLabel: string;
  setShareLabel: (value: string) => void;
  includePii: boolean;
  setIncludePii: (value: boolean) => void;
  busy: boolean;
  createShare: () => Promise<void>;
  revokeShare: (shareId: string) => Promise<void>;
}) {
  const activeShares = shares.filter((share) => share.status === "active");
  return (
    <article className="candidatePortalCard candidateShareCard">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Controlled sharing</span>
          <h2>Resume MCP link</h2>
          <p>Create a controlled resume-data endpoint for a specific version. PII stays off unless the candidate explicitly includes it.</p>
        </div>
      </div>
      <label>
        Share label
        <input value={shareLabel} onChange={(event) => setShareLabel(event.target.value)} />
      </label>
      <label className="candidateToggleRow">
        <input type="checkbox" checked={includePii} onChange={(event) => setIncludePii(event.target.checked)} />
        Include PII in this specific share link
      </label>
      <button className="primary fullWidth" type="button" disabled={busy || !selectedVersionId} onClick={createShare}>
        Create controlled link
      </button>
      <div className="candidateShareList">
        {activeShares.length ? (
          activeShares.slice(0, 4).map((share) => {
            const url = candidatePortalShareUrl(share.access_token);
            return (
              <article key={share.id}>
                <strong>{share.label}</strong>
                <span>{share.version_title || "Resume version"} · {share.permissions?.include_pii ? "PII included" : "PII locked"}</span>
                <code>{url}</code>
                <div>
                  <button className="plain small" type="button" onClick={() => navigator.clipboard?.writeText(url)}>
                    Copy
                  </button>
                  <button className="plain small dangerText" type="button" onClick={() => revokeShare(share.id)}>
                    Revoke
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyPanel title="No active share links" body="Create one when a candidate wants to share a controlled resume version externally." />
        )}
      </div>
    </article>
  );
}

export function CandidateApplicationTracker({
  applications,
  selectedVersionId,
  destination,
  setDestination,
  destinationType,
  setDestinationType,
  jobTitle,
  setJobTitle,
  jobUrl,
  setJobUrl,
  status,
  setStatus,
  note,
  setNote,
  createShare,
  setCreateShare,
  includePii,
  setIncludePii,
  busy,
  save,
  updateStatus,
}: {
  applications: CandidateApplication[];
  selectedVersionId: string;
  destination: string;
  setDestination: (value: string) => void;
  destinationType: string;
  setDestinationType: (value: string) => void;
  jobTitle: string;
  setJobTitle: (value: string) => void;
  jobUrl: string;
  setJobUrl: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  createShare: boolean;
  setCreateShare: (value: boolean) => void;
  includePii: boolean;
  setIncludePii: (value: boolean) => void;
  busy: boolean;
  save: () => Promise<void>;
  updateStatus: (applicationId: string, status: string) => Promise<void>;
}) {
  return (
    <article id="candidate-application-tracker" className="candidatePortalCard candidateApplicationTracker">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Application memory</span>
          <h2>Where did you share this?</h2>
          <p>Track which resume version went to which company, recruiter, job board, or LinkedIn conversation.</p>
        </div>
      </div>
      <div className="candidateFormGrid">
        <label>
          Destination
          <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Company, recruiter, LinkedIn contact..." />
        </label>
        <label>
          Type
          <select value={destinationType} onChange={(event) => setDestinationType(event.target.value)}>
            <option value="company">Company</option>
            <option value="recruiter">Recruiter</option>
            <option value="job_board">Job board</option>
            <option value="linkedin">LinkedIn</option>
            <option value="email">Email</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Role / job title
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Senior Data Engineer" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="shared">Shared</option>
            <option value="applied">Applied</option>
            <option value="interviewing">Interviewing</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <label>
        Job URL
        <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://..." />
      </label>
      <label>
        Private note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What did you send, who asked, what should you follow up on?" />
      </label>
      <label className="candidateToggleRow">
        <input type="checkbox" checked={createShare} onChange={(event) => setCreateShare(event.target.checked)} />
        Also create a controlled resume link for this destination
      </label>
      {createShare ? (
        <label className="candidateToggleRow">
          <input type="checkbox" checked={includePii} onChange={(event) => setIncludePii(event.target.checked)} />
          Include contact details in that controlled link
        </label>
      ) : null}
      <button className="primary fullWidth" type="button" disabled={busy || !selectedVersionId || !destination.trim()} onClick={save}>
        Save share history
      </button>
      <div className="candidateApplicationList">
        {applications.length ? (
          applications.slice(0, 6).map((application) => {
            const shareUrl = application.share_url_token ? candidatePortalShareUrl(application.share_url_token) : "";
            return (
              <article key={application.id}>
                <div>
                  <strong>{application.destination_name}</strong>
                  <span>{[application.job_title, humanizeLabel(application.destination_type), formatDateTime(application.shared_at)].filter(Boolean).join(" · ")}</span>
                </div>
                <select value={application.status} onChange={(event) => void updateStatus(application.id, event.target.value)}>
                  <option value="shared">Shared</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="archived">Archived</option>
                </select>
                {application.job_url ? (
                  <a href={application.job_url} target="_blank" rel="noreferrer">
                    Open job
                  </a>
                ) : null}
                {shareUrl ? (
                  <button className="plain small" type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                    Copy share link
                  </button>
                ) : null}
                {application.status !== "archived" ? (
                  <button className="plain small dangerText" type="button" onClick={() => void updateStatus(application.id, "archived")}>
                    Archive
                  </button>
                ) : null}
                {application.candidate_note ? <p>{application.candidate_note}</p> : null}
              </article>
            );
          })
        ) : (
          <EmptyPanel title="No share history for this version" body="When you send this resume anywhere, log it here so you know which version was used." />
        )}
      </div>
    </article>
  );
}

export function CandidateAccessRequestsPanel({
  accessRequests,
  busy,
  decide,
}: {
  accessRequests: CandidateAccessRequest[];
  busy: boolean;
  decide: (requestId: string, decision: "approve" | "deny") => Promise<void>;
}) {
  const pending = accessRequests.filter((request) => request.status === "pending");
  return (
    <article className="candidatePortalCard candidateAccessCard">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">PII access</span>
          <h2>{pending.length ? `${pending.length} pending` : "No pending requests"}</h2>
          <p>Recruiters can discover searchable native candidates, but contact details unlock only after approval.</p>
        </div>
      </div>
      <div className="candidateAccessList">
        {pending.length ? (
          pending.slice(0, 4).map((request) => (
            <article key={request.id}>
              <strong>{request.tenant_name || "Recruiter workspace"}</strong>
              <span>{request.request_message || "Requested permission to view candidate contact/profile details."}</span>
              <small>{request.recruiter_email || "Recruiter"} · {formatDateTime(request.created_at)}</small>
              <div>
                <button className="primary small" type="button" disabled={busy} onClick={() => decide(request.id, "approve")}>
                  Approve
                </button>
                <button className="secondary small" type="button" disabled={busy} onClick={() => decide(request.id, "deny")}>
                  Deny
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel title="No access requests" body="When recruiters ask to see PII, the candidate can approve or deny from here." />
        )}
      </div>
    </article>
  );
}

function candidatePortalShareUrl(token: string) {
  const path = `/api/backend/candidate-shares/${encodeURIComponent(token)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
