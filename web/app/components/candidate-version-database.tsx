"use client";

import { Search } from "lucide-react";

import type {
  CandidateApplication,
  CandidateResumeVersion,
} from "../../lib/api";
import { formatDateTime, humanizeLabel, toTextList } from "../lib/format";
import { EmptyPanel } from "./primitives";

export function CandidateVersionDatabase({
  versions,
  selectedVersionId,
  query,
  setQuery,
  applications,
  versionTitle,
  setVersionTitle,
  targetRole,
  setTargetRole,
  busy,
  createVersion,
  openVersion,
  editVersion,
}: {
  versions: CandidateResumeVersion[];
  selectedVersionId: string;
  query: string;
  setQuery: (value: string) => void;
  applications: CandidateApplication[];
  versionTitle: string;
  setVersionTitle: (value: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  busy: boolean;
  createVersion: () => Promise<void>;
  openVersion: (versionId: string) => void;
  editVersion: (versionId: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredVersions = versions.filter((version) => {
    if (!normalizedQuery) return true;
    const resume = version.resume_json ?? {};
    const haystack = [
      version.title,
      version.target_role,
      version.status,
      resume.headline,
      resume.summary,
      ...toTextList(resume.skills),
      ...(Array.isArray(resume.experience)
        ? resume.experience.flatMap((item) => [item.title, item.company, ...toTextList(item.bullets)])
        : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  return (
    <section className="databasePage candidateVersionDatabasePage">
      <header className="profilesHeader">
        <div>
          <span className="eyebrow">Resume versions</span>
          <h2>Application Vault</h2>
          <p>Search, open, edit, export, and track every resume version from one place.</p>
        </div>
      </header>

      <section className="candidateVersionDatabaseGrid">
        <div>
          <section className="profileSearchPanel">
            <form className="semanticSearch" onSubmit={(event) => event.preventDefault()}>
              <Search size={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search versions by role, skill, company, or resume content"
              />
              <button type="submit">Search</button>
            </form>
            <div className="filterRow">
              <button className="filterChip" onClick={() => setQuery("")}>
                Clear
              </button>
            </div>
          </section>
          <div className="table candidateVersionTable">
            <div className="tableRow header">
              <span>Version</span>
              <span>Target</span>
              <span>Evidence</span>
              <span>Status</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {!filteredVersions.length ? (
              <div className="tableEmpty">
                <strong>No resume versions match this view.</strong>
                <span>Create a version from the approved master profile, or clear the search.</span>
              </div>
            ) : null}
            {filteredVersions.map((version) => {
              const resume = version.resume_json ?? {};
              const evidence = versionEvidenceSummary(resume);
              return (
                <div
                  className={selectedVersionId === version.id ? "tableRow active" : "tableRow"}
                  key={version.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => editVersion(version.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") editVersion(version.id);
                  }}
                >
                  <span className="truncateCell candidateListNameCell" title={version.title}>
                    <span>{version.title}</span>
                    <small>{resume.headline || "Resume version"}</small>
                  </span>
                  <span className="truncateCell" title={version.target_role || "General"}>
                    {version.target_role || "General"}
                  </span>
                  <span className="truncateCell" title={evidence}>
                    {evidence}
                  </span>
                  <span>
                    <b className="riskBadge">{humanizeLabel(version.status || "ready")}</b>
                  </span>
                  <span>{version.updated_at ? new Date(version.updated_at).toLocaleDateString() : "N/A"}</span>
                  <span className="candidateVersionRowActions">
                    <button
                      className="primary small"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        editVersion(version.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="secondary small"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openVersion(version.id);
                      }}
                    >
                      Preview
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="candidatePortalCard candidateVersionCreateCard">
          <div className="candidatePortalSectionHead">
            <div>
              <span className="eyebrow">Create version</span>
              <h2>New application resume</h2>
              <p>Use your approved resume content, then export or tailor this version.</p>
            </div>
          </div>
          <label>
            Version title
            <input value={versionTitle} onChange={(event) => setVersionTitle(event.target.value)} />
          </label>
          <label>
            Target role
            <input
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              placeholder="Data Engineer, Reliability Engineer..."
            />
          </label>
          <button className="primary fullWidth" type="button" onClick={createVersion} disabled={busy || !versionTitle.trim()}>
            Create and open
          </button>
        </aside>
      </section>
      <CandidateSubmissionHistory applications={applications} versions={versions} openVersion={openVersion} />
    </section>
  );
}

function CandidateSubmissionHistory({
  applications,
  versions,
  openVersion,
}: {
  applications: CandidateApplication[];
  versions: CandidateResumeVersion[];
  openVersion: (versionId: string) => void;
}) {
  const versionById = new Map(versions.map((version) => [version.id, version]));
  return (
    <section className="candidateSubmissionHistory">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Submission history</span>
          <h2>Which resume went where</h2>
          <p>Each application points to the exact resume version used, so later edits do not rewrite old submissions.</p>
        </div>
      </div>
      <div className="candidateSubmissionRows">
        {applications.length ? (
          applications.slice(0, 10).map((application) => {
            const versionId = application.resume_version_id || "";
            const version = versionById.get(versionId);
            return (
              <article key={application.id}>
                <div>
                  <strong>{application.destination_name}</strong>
                  <span>
                    {[application.job_title, humanizeLabel(application.destination_type), humanizeLabel(application.status)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <small>
                    {version?.title || application.version_title || "Resume version"} · {formatDateTime(application.shared_at)}
                  </small>
                </div>
                <button className="secondary small" type="button" disabled={!versionId} onClick={() => openVersion(versionId)}>
                  Open version
                </button>
              </article>
            );
          })
        ) : (
          <EmptyPanel
            title="No submissions logged yet"
            body="Open a resume version and use “Log submission” when you send it to a company, recruiter, job board, or LinkedIn contact."
          />
        )}
      </div>
    </section>
  );
}

function versionEvidenceSummary(resume: Record<string, any>) {
  const skills = toTextList(resume.skills).slice(0, 3);
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const latest = experience[0] ?? {};
  return [
    latest.title && latest.company ? `${latest.title} at ${latest.company}` : latest.title || latest.company,
    skills.length ? skills.join(", ") : "",
  ]
    .filter(Boolean)
    .join(" · ") || "Open to review resume evidence";
}
