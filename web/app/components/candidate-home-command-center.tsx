"use client";

import type {
  CandidateAccessRequest,
  CandidateApplication,
  CandidatePortalProfile,
  CandidateResumeUpload,
  CandidateResumeVersion,
} from "../../lib/api";
import { candidateResumeVersionPdfPath } from "../../lib/api";
import { humanizeLabel, textValue, toTextList } from "../lib/format";
import { CandidateAtsConfidencePanel, CandidateCvPreview } from "./candidate-resume-export-panels";
import { ProgressBar } from "./primitives";

export function CandidateHomeCommandCenter({
  profile,
  latestUpload,
  activeUpload,
  versions,
  applications,
  accessRequests,
  profileCompleteness,
  needsReview,
  resume,
  selectedVersion,
  selectedTemplateId,
  busy,
  uploadInProgress,
  openUpload,
  startFromScratch,
  openEditor,
  openVersions,
  openCreateVersion,
  openVersion,
  openJobBoard,
  openSubmissionTracker,
}: {
  profile: CandidatePortalProfile["profile"];
  latestUpload: CandidateResumeUpload | null;
  activeUpload: CandidateResumeUpload | null;
  versions: CandidateResumeVersion[];
  applications: CandidateApplication[];
  accessRequests: CandidateAccessRequest[];
  profileCompleteness: number;
  needsReview: Array<Record<string, any>>;
  resume: Record<string, any>;
  selectedVersion: CandidateResumeVersion | null;
  selectedTemplateId: string;
  busy: boolean;
  uploadInProgress: boolean;
  openUpload: () => void;
  startFromScratch: () => void;
  openEditor: () => void;
  openVersions: () => void;
  openCreateVersion: () => void;
  openVersion: (versionId: string) => void;
  openJobBoard: () => void;
  openSubmissionTracker: (versionId?: string) => void;
}) {
  const displayName = textValue(profile.display_name) || "Your resume";
  const firstName = displayName === "Your resume" ? "Build" : displayName.split(/\s+/)[0];
  const headline = textValue(profile.headline) || "Upload a resume to build your candidate-owned profile.";
  const latestVersion = selectedVersion ?? versions[0] ?? null;
  const pendingAccessCount = accessRequests.filter((request) => request.status === "pending").length;
  const recentApplication = applications[0] ?? null;
  const visibleFixes = needsReview.filter((item) => !candidateReviewItemAlreadyResolved(profile, item)).slice(0, 3);
  const readinessLabel = profileCompleteness >= 90 ? "Ready to apply" : profileCompleteness >= 70 ? "Almost ready" : "Needs review";
  const versionSummary = latestVersion ? `${latestVersion.title} · ${latestVersion.target_role || "General"}` : "Create the first resume version after upload.";
  const nextActionTitle = uploadInProgress ? "Parsing your resume" : visibleFixes.length ? "Review the extracted facts" : versions.length ? "Tailor this resume to a job" : "Start your resume";
  const nextActionBody = uploadInProgress
    ? `${activeUpload?.stage_label ?? "Parsing"} · ${activeUpload?.progress ?? 0}%`
    : visibleFixes.length
      ? visibleFixes[0]?.reason ?? "Verify the extracted fields before exporting."
      : versions.length
        ? "Use AI to compare this version against a job brief and create a sharper application copy."
        : "Upload an existing file or start from scratch with a guided builder. You approve every fact before export.";
  const nextAction = visibleFixes.length ? openEditor : versions.length ? openJobBoard : openUpload;
  const nextActionLabel = visibleFixes.length ? "Review now" : versions.length ? "Match to a job" : "Upload resume";

  return (
    <section className="candidateCommandCenter candidateHomeStudio">
      <article className="candidateHomeResumeStage">
        <header>
          <div>
            <span className="eyebrow">My resume</span>
            <h1>{displayName === "Your resume" ? "Build a resume you can actually control." : `${firstName}, this is the resume you control.`}</h1>
            <p>Edit it, tailor it, export it, and track where each version goes.</p>
          </div>
          <div className="candidateHomeStageActions">
            <button className="primary" type="button" onClick={latestUpload ? openEditor : openUpload}>
              {latestUpload ? "Edit resume" : "Upload resume"}
            </button>
            <button className="secondary" type="button" onClick={startFromScratch}>
              Start from scratch
            </button>
            <button className="secondary" type="button" onClick={openCreateVersion}>
              Create version
            </button>
            <button className="secondary" type="button" disabled={!latestVersion} onClick={() => latestVersion ? openVersion(latestVersion.id) : undefined}>
              Preview
            </button>
          </div>
        </header>
        <article className="candidateHomeResumePaper" aria-label="Scrollable resume preview">
          <CandidateCvPreview resume={resume} templateId={selectedTemplateId} />
        </article>
      </article>

      <aside className="candidateHomeSide">
        <section className="candidateHomeCoachCard">
          <span className="eyebrow">Next step</span>
          <h2>{nextActionTitle}</h2>
          <p>{nextActionBody}</p>
          {uploadInProgress && activeUpload ? <ProgressBar value={activeUpload.progress} /> : null}
          <button className="primary fullWidth" type="button" disabled={busy && !uploadInProgress} onClick={nextAction}>{nextActionLabel}</button>
          {!versions.length ? <button className="secondary fullWidth" type="button" onClick={startFromScratch}>Start from scratch</button> : null}
        </section>

        <section className="candidateHomeSimpleCard candidateHomeControlCard">
          <span className="eyebrow">Resume control</span>
          <h2>{readinessLabel}</h2>
          <p>{headline}</p>
          <div className="candidateHomeControlRows">
            <button type="button" onClick={openEditor}>
              <strong>Master profile</strong>
              <span>{profileCompleteness}% complete · {profile.current_location || "location unclear"}</span>
            </button>
            <button type="button" disabled={!latestVersion} onClick={() => latestVersion ? openVersion(latestVersion.id) : undefined}>
              <strong>Current version</strong>
              <span>{versionSummary}</span>
            </button>
            <button type="button" disabled={!latestVersion} onClick={() => latestVersion ? openSubmissionTracker(latestVersion.id) : undefined}>
              <strong>Submission memory</strong>
              <span>{recentApplication ? `${recentApplication.destination_name} · ${humanizeLabel(recentApplication.status)}` : "Nothing logged yet"}</span>
            </button>
          </div>
          <div className="candidateHomeMiniActions">
            <button className="secondary" type="button" onClick={openCreateVersion}>Create version</button>
            <button className="secondary" type="button" onClick={openVersions} disabled={!versions.length}>All versions</button>
            <button className="secondary" type="button" disabled={!latestVersion} onClick={() => latestVersion ? openSubmissionTracker(latestVersion.id) : undefined}>Log submission</button>
            <button
              className="secondary"
              type="button"
              disabled={!latestVersion}
              onClick={() => {
                if (latestVersion) window.location.href = candidateResumeVersionPdfPath(latestVersion.id, selectedTemplateId);
              }}
            >
              Download PDF
            </button>
          </div>
          {pendingAccessCount ? <p>{pendingAccessCount} recruiter access request{pendingAccessCount === 1 ? "" : "s"} waiting for your decision.</p> : null}
        </section>

        <CandidateAtsConfidencePanel profile={profile} resume={resume} selectedTemplateId={selectedTemplateId} versions={versions} applications={applications} />

        {recentApplication ? (
          <section className="candidateHomeSimpleCard candidateSubmissionSnapshot">
            <span className="eyebrow">Last shared</span>
            <h2>{recentApplication.destination_name}</h2>
            <p>{[recentApplication.job_title, humanizeLabel(recentApplication.status)].filter(Boolean).join(" · ")}</p>
            <button className="secondary" type="button" onClick={() => openSubmissionTracker(recentApplication.resume_version_id || undefined)}>View submission history</button>
          </section>
        ) : (
          <section className="candidateHomeSimpleCard candidateSubmissionSnapshot">
            <span className="eyebrow">Submission tracker</span>
            <h2>Know what you sent where</h2>
            <p>Log each company, recruiter, job board, or LinkedIn conversation against the exact resume version used.</p>
            <button className="secondary" type="button" disabled={!latestVersion} onClick={() => latestVersion ? openSubmissionTracker(latestVersion.id) : undefined}>Log first submission</button>
          </section>
        )}
      </aside>
    </section>
  );
}

function candidateReviewItemAlreadyResolved(profile: CandidatePortalProfile["profile"], item: Record<string, any>) {
  const label = String(item.field ?? item.label ?? "").toLowerCase();
  const hasValue = (value: unknown) => Boolean(textValue(value).trim());
  if (label.includes("location")) return hasValue(profile.current_location);
  if (label.includes("email")) return hasValue(profile.email);
  if (label.includes("phone")) return hasValue(profile.phone);
  if (label.includes("linkedin")) return hasValue(profile.linkedin_url);
  if (label.includes("portfolio")) return hasValue(profile.portfolio_url) || hasValue(profile.github_url);
  if (label.includes("github")) return hasValue(profile.github_url);
  if (label.includes("name")) return hasValue(profile.display_name);
  if (label.includes("headline") || label.includes("title")) return hasValue(profile.headline);
  if (label.includes("summary")) return hasValue(profile.summary);
  if (label.includes("skill")) return toTextList(profile.skills).length > 0;
  if (label.includes("experience") || label.includes("role")) return Array.isArray(profile.experience) && profile.experience.length > 0;
  if (label.includes("education")) return Array.isArray(profile.education) && profile.education.length > 0;
  return false;
}
