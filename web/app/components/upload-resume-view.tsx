"use client";

import { useState } from "react";
import { FileSearch, FileUp } from "lucide-react";
import type {
  JobCampaign,
  LinkedInImportJob,
  ParseBatch,
  ParseDeadLetter,
  WorkerStatus,
} from "../../lib/api";
import { domainLabel } from "../lib/format";
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FORMAT_LABEL } from "../lib/login";
import { ProgressBar } from "./primitives";
import { RECRUITER_COPY } from "./recruiter-language";

export function UploadResumeView(props: {
  resumeFile: File | null;
  setResumeFile: (file: File | null) => void;
  bulkFiles: File[];
  setBulkFiles: (files: File[]) => void;
  batchName: string;
  setBatchName: (value: string) => void;
  bulkContextNote: string;
  setBulkContextNote: (value: string) => void;
  campaigns: JobCampaign[];
  bulkCampaignId: string;
  setBulkCampaignId: (value: string) => void;
  linkedinImportUrl: string;
  setLinkedinImportUrl: (value: string) => void;
  linkedinImportCampaignId: string;
  setLinkedinImportCampaignId: (value: string) => void;
  linkedinImportJob: LinkedInImportJob | null;
  noteName: string;
  setNoteName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  upload: () => void;
  bulkUpload: () => void;
  importLinkedIn: () => void;
  batches: ParseBatch[];
  deadLetters: ParseDeadLetter[];
  workerStatus: WorkerStatus | null;
  selectedBatch: ParseBatch | null;
  selectBatch: (batch: ParseBatch) => void;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  cancelBatch: (batchId: string) => void;
  openCandidate: (id: string) => void;
  openCampaign: (id: string) => void;
  createCampaignRequirement: (id: string, text: string) => Promise<void>;
  uploadCampaignRequirement: (id: string, file: File) => Promise<void>;
  busy: boolean;
}) {
  const [activeIntakeMode, setActiveIntakeMode] = useState<"cv" | "linkedin">("cv");
  const [requirementTextDraft, setRequirementTextDraft] = useState("");
  const [campaignRequirementFile, setCampaignRequirementFile] = useState<File | null>(null);
  const selectedCampaign = props.campaigns.find((item) => item.id === props.bulkCampaignId);
  const selectedLinkedInCampaign = props.campaigns.find((item) => item.id === props.linkedinImportCampaignId);
  const activeBatch = props.selectedBatch ?? props.batches[0] ?? null;
  const activeProgress = activeBatch ? (activeBatch.progress_percent ?? batchProgress(activeBatch)) : 0;
  const generatedBatchName = autoBatchNameForFiles(props.bulkFiles, selectedCampaign?.name);
  const shownBatchName = props.batchName.trim() || props.bulkContextNote.trim() || generatedBatchName;
  const requirementCampaignReady = Boolean(selectedCampaign);

  async function submitRequirementText() {
    if (!selectedCampaign || !requirementTextDraft.trim()) return;
    await props.createCampaignRequirement(selectedCampaign.id, requirementTextDraft);
    setRequirementTextDraft("");
    props.openCampaign(selectedCampaign.id);
  }

  async function submitRequirementFile() {
    if (!selectedCampaign || !campaignRequirementFile) return;
    await props.uploadCampaignRequirement(selectedCampaign.id, campaignRequirementFile);
    setCampaignRequirementFile(null);
    props.openCampaign(selectedCampaign.id);
  }

  return (
    <section className="uploadPage stitchUploadPage">
      <header className="stitchHeader compact">
        <h2>{RECRUITER_COPY.uploadTitle}</h2>
        <p>{RECRUITER_COPY.uploadSubtitle}</p>
      </header>
      <section className="uploadLandingGrid">
        <article className="uploadTypePanel candidateIntakePanel">
          <div className="uploadTypeHeader">
            <span className="eyebrow">Candidate intake</span>
            <h3>Add candidates</h3>
            <p>Use CV upload when you have resumes. Use LinkedIn when the recruiter only has a profile URL and notes.</p>
          </div>

          <div className="intakeToggleTabs" role="tablist" aria-label="Candidate intake type">
            <button
              className={activeIntakeMode === "cv" ? "active" : ""}
              type="button"
              onClick={() => setActiveIntakeMode("cv")}
            >
              CV upload
            </button>
            <button
              className={activeIntakeMode === "linkedin" ? "active" : ""}
              type="button"
              onClick={() => setActiveIntakeMode("linkedin")}
            >
              LinkedIn
            </button>
          </div>

          {activeIntakeMode === "cv" ? (
            <div className="intakeModePane">
              <label className="stitchDropZone refinedUploadDrop compact">
                <FileUp size={30} />
                <strong>{props.bulkFiles.length ? `${props.bulkFiles.length} file${props.bulkFiles.length === 1 ? "" : "s"} selected` : "Drop resumes or browse"}</strong>
                <span>{DOCUMENT_FORMAT_LABEL}. OCR runs only when needed.</span>
                <b>Browse resumes</b>
                <input
                  type="file"
                  multiple
                  accept={DOCUMENT_FILE_ACCEPT}
                  onChange={(event) => props.setBulkFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <section className="stitchProgressCard refinedUploadCard compact">
                <div>
                  <strong>Processing</strong>
                  <span>{Math.round(activeProgress)}%</span>
                </div>
                <ProgressBar value={activeProgress} />
                <div className="stitchBatchControls">
                  <div className="autoBatchName">
                    <span>Batch</span>
                    <strong>{shownBatchName}</strong>
                  </div>
                  <input
                    value={props.bulkContextNote}
                    onChange={(event) => {
                      props.setBulkContextNote(event.target.value);
                      props.setBatchName("");
                    }}
                    placeholder="Optional: add note or campaign name"
                  />
                  <select value={props.bulkCampaignId} onChange={(event) => props.setBulkCampaignId(event.target.value)}>
                    <option value="workspace">Candidate database only</option>
                    {props.campaigns.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <button className="primary" disabled={!props.bulkFiles.length || props.busy} onClick={props.bulkUpload}>
                    {selectedCampaign ? "Queue into campaign" : "Queue resumes"}
                  </button>
                </div>
                <p>
                  {activeBatch
                    ? `${activeBatch.completed_count + activeBatch.failed_count} of ${activeBatch.total_files} files processed. Profiles update automatically.`
                    : "Select resumes and queue them. Profiles update automatically after processing."}
                </p>
              </section>
            </div>
          ) : (
            <div className="intakeModePane linkedinIntakePane">
              <label>
                <span>LinkedIn profile URL</span>
                <input
                  value={props.linkedinImportUrl}
                  onChange={(event) => props.setLinkedinImportUrl(event.target.value)}
                  placeholder="https://www.linkedin.com/in/..."
                />
              </label>
              <label>
                <span>Destination</span>
                <select value={props.linkedinImportCampaignId} onChange={(event) => props.setLinkedinImportCampaignId(event.target.value)}>
                  <option value="workspace">Candidate database only</option>
                  {props.campaigns.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="linkedinRecruiterNoteBox">
                <label>
                  <span>Recruiter note title</span>
                  <input value={props.noteName} onChange={(event) => props.setNoteName(event.target.value)} placeholder="Recruiter Notes" />
                </label>
                <label>
                  <span>Recruiter notes</span>
                  <textarea value={props.note} onChange={(event) => props.setNote(event.target.value)} placeholder="Add context like OPT, salary, availability, source, or why this person should be tracked." />
                </label>
              </div>
              <button className="primary" disabled={!props.linkedinImportUrl.trim() || props.busy} onClick={props.importLinkedIn}>
                {props.busy ? "Working..." : selectedLinkedInCampaign ? "Import into campaign" : "Import LinkedIn profile"}
              </button>
              {props.linkedinImportJob ? (
                <div className="linkedinImportStatus">
                  <span className={`queueStatus ${props.linkedinImportJob.status}`}>{domainLabel(props.linkedinImportJob.status)}</span>
                  <strong>{props.linkedinImportJob.profile_snapshot?.full_name ?? props.linkedinImportJob.linkedin_url ?? "LinkedIn profile"}</strong>
                  <small>
                    {props.linkedinImportJob.error_message ||
                      (props.linkedinImportJob.document_id
                        ? `Candidate profile created${props.linkedinImportJob.has_note ? " with recruiter note." : "."}`
                        : domainLabel(props.linkedinImportJob.stage ?? "queued"))}
                  </small>
                </div>
              ) : null}
            </div>
          )}
        </article>

        <article className="uploadTypePanel campaignRequirementUploadTab">
          <div className="uploadTypeHeader">
            <span className="eyebrow">Requirement intake</span>
            <h3>Attach requirement</h3>
            <p>Every requirement belongs to a campaign. Upload or paste it here, then edit the extracted scorecard in Campaigns.</p>
          </div>
          <label>
            <span>Campaign</span>
            <select value={props.bulkCampaignId} onChange={(event) => props.setBulkCampaignId(event.target.value)}>
              <option value="workspace">Select campaign</option>
              {props.campaigns.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="campaignRequirementSplit">
            <label className="campaignRequirementDrop large">
              <FileSearch size={22} />
              <strong>{campaignRequirementFile ? campaignRequirementFile.name : "Upload requirement file"}</strong>
              <span>{DOCUMENT_FORMAT_LABEL}</span>
              <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setCampaignRequirementFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="secondary" disabled={!requirementCampaignReady || !campaignRequirementFile || props.busy} onClick={submitRequirementFile}>Extract file</button>
            <textarea value={requirementTextDraft} onChange={(event) => setRequirementTextDraft(event.target.value)} placeholder="Paste job requirement, client email, or hiring-manager notes..." />
            <button className="primary" disabled={!requirementCampaignReady || !requirementTextDraft.trim() || props.busy} onClick={submitRequirementText}>Extract pasted requirement</button>
          </div>
          {!props.campaigns.length ? <p className="muted">Create a campaign first, then attach requirements here.</p> : null}
        </article>
      </section>
      <section className="stitchQueueTable">
        <div className="stitchQueueHead">
          <h3>Resume Processing</h3>
          {activeBatch ? <button className="plain danger" onClick={() => props.cancelBatch(activeBatch.id)}>Cancel batch</button> : null}
        </div>
        <div className="jobTable">
          <div className="jobRow uploadQueueRow header"><span>Resume</span><span>Destination</span><span>Status</span><span>Action</span></div>
          {(activeBatch?.jobs ?? []).map((job) => (
            <div className="jobRow uploadQueueRow" key={job.id}>
              <span>{job.original_filename}</span>
              <span>{activeBatch?.campaign_id ? activeBatch.name : "Unassigned (Workspace)"}{activeBatch?.context_note ? <small>{activeBatch.context_note}</small> : null}</span>
              <span className="queueStatusCell">
                <b className={`queueStatus ${job.status}`}>{domainLabel(job.status)}</b>
                <small>{job.error_message ? job.error_message : job.stage_label ?? job.stage}</small>
              </span>
              <span className="jobActions">
                {job.document_id ? <button className="plain small" onClick={() => props.openCandidate(job.document_id!)}>View Profile</button> : null}
                <button className="plain small" disabled={!["failed", "retrying", "cancelled"].includes(job.status)} onClick={() => props.retryJob(job.id)}>Retry</button>
                <button className="plain small danger" disabled={!["queued", "retrying", "failed", "running", "processing"].includes(job.status)} onClick={() => props.cancelJob(job.id)}>Cancel</button>
              </span>
            </div>
          ))}
          {!activeBatch?.jobs?.length ? (
            <div className="emptyTableState">No files are being processed yet. Select resumes and click Queue resumes.</div>
          ) : null}
        </div>
      </section>
      {props.deadLetters.length ? (
        <section className="stitchQueueTable uploadReviewQueue">
          <div className="stitchQueueHead">
            <div>
              <h3>Files Needing Review</h3>
              <p>These resumes failed after retries. Retry the exact file below, or upload a corrected replacement above.</p>
            </div>
            <span className="statusPill dangerPill">{props.deadLetters.length} open</span>
          </div>
          <div className="jobTable">
            <div className="jobRow uploadQueueRow header"><span>Resume</span><span>Batch</span><span>Error</span><span>Action</span></div>
            {props.deadLetters.map((item) => (
              <div className="jobRow uploadQueueRow failedReviewRow" key={item.id}>
                <span>{item.original_filename ?? "Unknown file"}</span>
                <span>{item.batch_name ?? "No batch"}<small>Attempts {item.attempt_count}/{item.max_attempts || "?"}</small></span>
                <span className="queueStatusCell">
                  <b className="queueStatus failed">{domainLabel(item.job_status ?? "failed")}</b>
                  <small>{item.error_message}</small>
                </span>
                <span className="jobActions">
                  <button className="plain small" disabled={props.busy} onClick={() => props.retryJob(item.job_id)}>Retry</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {props.batches.length ? (
        <section className="stitchRecentBatches">
          {props.batches.slice(0, 4).map((batch) => (
            <button key={batch.id} onClick={() => props.selectBatch(batch)}>
              <strong>{batch.name}</strong>
              <span>{domainLabel(batch.status)} • {batch.completed_count}/{batch.total_files} completed</span>
            </button>
          ))}
        </section>
      ) : null}
      <details className="singleUploadFallback">
        <summary>Single resume with initial note</summary>
        <div>
          <label>
            <span>Resume file</span>
            <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => props.setResumeFile(event.target.files?.[0] ?? null)} />
          </label>
          <input value={props.noteName} onChange={(event) => props.setNoteName(event.target.value)} placeholder="Note title" />
          <button className="plain small" disabled={!props.resumeFile || props.busy} onClick={props.upload}>Queue single resume</button>
        </div>
      </details>
    </section>
  );
}

function autoBatchNameForFiles(files: File[], campaignName?: string | null) {
  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const label = campaignName?.trim() || "Resume upload";
  if (!files.length) return `${label} - ${today}`;
  if (files.length === 1) {
    const [file] = files;
    return `${label} - ${file.name.replace(/\.[^.]+$/, "")}`;
  }
  return `${label} - ${files.length} resumes - ${today}`;
}

function batchProgress(batch: ParseBatch) {
  if (!batch.total_files) return batch.status === "succeeded" ? 100 : 0;
  return Math.round(((batch.completed_count + batch.failed_count) / batch.total_files) * 100);
}
