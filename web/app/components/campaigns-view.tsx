"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileUp } from "lucide-react";
import type { CampaignDetailTab } from "../lib/workspace-route";
import type {
  CampaignPipelineStatus,
  CampaignScorecard,
  JobCampaign,
  Requirement,
  TeamMember,
} from "../../lib/api";
import { CollaborationPanel } from "./collaboration-panel";
import { EmptyPanel, ProgressBar } from "./primitives";
import { RECRUITER_COPY } from "./recruiter-language";
import {
  campaignCandidateVisibleInPipeline,
  campaignGapItems,
  campaignHardFilterFailures,
  campaignProgressStats,
  campaignReasonItems,
  campaignScoreBreakdownItems,
  campaignScorecardCompleteness,
  campaignScorecardForm,
  campaignScorecardPayload,
  campaignTimelineItems,
  emptyCampaignScorecardForm,
  stageCandidateStatus,
  type CampaignScorecardForm,
} from "../lib/campaign-workflow";
import { matchDistribution } from "../lib/matching-display";
import { candidateRoleFactsNeedReview } from "../lib/candidate-database";
import { DOCUMENT_FILE_ACCEPT } from "../lib/login";
import { copyCurrentUrl } from "../lib/workspace-route";
import { domainLabel, formatDateTime } from "../lib/format";

export function CampaignsView({
  token,
  teamMembers,
  campaigns,
  requirements,
  campaign,
  campaignLoadingId,
  campaignName,
  setCampaignName,
  campaignDescription,
  setCampaignDescription,
  campaignFiles,
  setCampaignFiles,
  createCampaign,
  openCampaign,
  updateCampaign,
  archiveCampaign,
  createRequirement,
  uploadRequirement,
  saveScorecard,
  matchCampaign,
  uploadResumes,
  updateCandidateStatus,
  openCandidate,
  activeTab,
  setActiveTab,
  activePipelineStage,
  setActivePipelineStage,
  selectedCandidateId,
  setSelectedCandidateId,
  busy,
}: {
  token: string;
  teamMembers: TeamMember[];
  campaigns: JobCampaign[];
  requirements: Requirement[];
  campaign: JobCampaign | null;
  campaignLoadingId: string;
  campaignName: string;
  setCampaignName: (value: string) => void;
  campaignDescription: string;
  setCampaignDescription: (value: string) => void;
  campaignFiles: File[];
  setCampaignFiles: (files: File[]) => void;
  createCampaign: () => void;
  openCampaign: (id: string) => void;
  updateCampaign: (id: string, payload: { name?: string; description?: string; status?: string; requirement_id?: string | null; unlink_requirement?: boolean }) => void;
  archiveCampaign: (id: string, confirmation: string) => void;
  createRequirement: (id: string, text: string) => void;
  uploadRequirement: (id: string, file: File) => void;
  saveScorecard: (id: string, scorecard: CampaignScorecard) => void;
  matchCampaign: (id?: string) => void;
  uploadResumes: () => void;
  updateCandidateStatus: (candidateId: string, status: CampaignPipelineStatus, note?: string) => Promise<void> | void;
  openCandidate: (id: string) => void;
  activeTab: CampaignDetailTab;
  setActiveTab: (tab: CampaignDetailTab) => void;
  activePipelineStage: CampaignPipelineStatus;
  setActivePipelineStage: (stage: CampaignPipelineStatus) => void;
  selectedCandidateId: string;
  setSelectedCandidateId: (id: string) => void;
  busy: boolean;
}) {
  const activeCampaign = campaign ?? campaigns[0] ?? null;
  const selectedCandidates = useMemo(() => activeCampaign?.candidates ?? [], [activeCampaign?.candidates]);
  const activeCampaignLoading = Boolean(activeCampaign?.id && campaignLoadingId === activeCampaign.id);
  const [autoOpenedCampaignId, setAutoOpenedCampaignId] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [showCampaignCreate, setShowCampaignCreate] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editForm, setEditForm] = useState({ name: "", description: "", status: "active", requirement_id: "" });
  const [scorecardForm, setScorecardForm] = useState<CampaignScorecardForm>(emptyCampaignScorecardForm());
  const [requirementDraft, setRequirementDraft] = useState("");
  const [campaignRequirementFile, setCampaignRequirementFile] = useState<File | null>(null);
  const [campaignMatchThreshold, setCampaignMatchThreshold] = useState(0.65);
  const [matchResultLimit, setMatchResultLimit] = useState(50);
  const campaignStages = useMemo<Array<{ id: CampaignPipelineStatus; label: string }>>(() => [
    { id: "recommended", label: "Matched" },
    { id: "shortlisted", label: "Shortlisted" },
    { id: "contacted", label: "Contacted" },
    { id: "replied", label: "Replied" },
    { id: "screened", label: "Screened" },
    { id: "submitted", label: "Submitted" },
    { id: "interviewing", label: "Interviewing" },
    { id: "offer", label: "Offer" },
    { id: "placed", label: "Placed" },
    { id: "rejected", label: "Rejected" },
  ], []);
  const pipelineCandidates = useMemo(
    () => selectedCandidates.filter((item) => campaignCandidateVisibleInPipeline(item, campaignMatchThreshold)),
    [selectedCandidates, campaignMatchThreshold],
  );
  const hiddenPipelineCandidates = selectedCandidates.length - pipelineCandidates.length;
  const stageBuckets = useMemo(
    () => campaignStages.map((stage) => ({
      ...stage,
      candidates: pipelineCandidates.filter((item) => stageCandidateStatus(item.status) === stage.id),
    })),
    [campaignStages, pipelineCandidates],
  );
  const activeStageBucket = stageBuckets.find((stage) => stage.id === activePipelineStage) ?? stageBuckets[0];
  const activeStageCandidates = useMemo(() => activeStageBucket?.candidates ?? [], [activeStageBucket]);
  const nonEmptyStageCount = stageBuckets.filter((stage) => stage.candidates.length).length;
  const selectedCampaignCandidate = activeStageCandidates.find((item) => item.candidate_id === selectedCandidateId) ?? activeStageCandidates[0] ?? null;
  const selectedCandidateStage = selectedCampaignCandidate ? stageCandidateStatus(selectedCampaignCandidate.status) : activePipelineStage;
  const selectedCandidateStageIndex = campaignStages.findIndex((stage) => stage.id === selectedCandidateStage);
  const previousCampaignStage = selectedCandidateStageIndex > 0 ? campaignStages[selectedCandidateStageIndex - 1] : null;
  const nextCampaignStage = selectedCandidateStageIndex >= 0 && selectedCandidateStageIndex < campaignStages.length - 1 ? campaignStages[selectedCandidateStageIndex + 1] : null;
  const campaignProgress = campaignProgressStats(activeCampaign, selectedCandidates);
  const campaignTimeline = useMemo(() => campaignTimelineItems(activeCampaign, selectedCandidates), [activeCampaign, selectedCandidates]);
  const rankedCandidates = useMemo(() => [...selectedCandidates].sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0)), [selectedCandidates]);
  const campaignMatchBuckets = matchDistribution(rankedCandidates);
  const visibleRankedCandidates = rankedCandidates.filter((item) => Number(item.score ?? 0) >= campaignMatchThreshold);
  const visibleRankedCandidatePage = visibleRankedCandidates.slice(0, matchResultLimit);
  const scorecardCompleteness = campaignScorecardCompleteness(scorecardForm);
  const campaignClosed = ["closed", "archived"].includes(activeCampaign?.status ?? "");

  useEffect(() => {
    if (!pipelineCandidates.length) {
      setSelectedCandidateId("");
      return;
    }
    const currentStageHasCandidates = stageBuckets.some((stage) => stage.id === activePipelineStage && stage.candidates.length);
    if (!currentStageHasCandidates) {
      const firstNonEmptyStage = stageBuckets.find((stage) => stage.candidates.length);
      if (firstNonEmptyStage && firstNonEmptyStage.id !== activePipelineStage) {
        setActivePipelineStage(firstNonEmptyStage.id);
      }
    }
  }, [activePipelineStage, pipelineCandidates.length, setActivePipelineStage, setSelectedCandidateId, stageBuckets]);

  useEffect(() => {
    if (!activeStageCandidates.length) {
      setSelectedCandidateId("");
      return;
    }
    if (!activeStageCandidates.some((item) => item.candidate_id === selectedCandidateId)) {
      setSelectedCandidateId(activeStageCandidates[0].candidate_id);
    }
  }, [activeStageCandidates, selectedCandidateId, setSelectedCandidateId]);

  useEffect(() => {
    setStageNote(selectedCampaignCandidate?.stage_note ?? "");
  }, [selectedCampaignCandidate?.candidate_id, selectedCampaignCandidate?.stage_note]);

  useEffect(() => {
    setMatchResultLimit(50);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
  }, [activeCampaign?.id, campaignMatchThreshold]);

  useEffect(() => {
    const firstCampaignId = campaigns[0]?.id;
    if (!campaign && firstCampaignId && autoOpenedCampaignId !== firstCampaignId) {
      setAutoOpenedCampaignId(firstCampaignId);
      openCampaign(firstCampaignId);
    }
  }, [autoOpenedCampaignId, campaign, campaigns, openCampaign]);

  useEffect(() => {
    if (!activeCampaign) return;
    setEditForm({
      name: activeCampaign.name,
      description: activeCampaign.description ?? "",
      status: activeCampaign.status ?? "active",
      requirement_id: activeCampaign.requirement_id ?? "",
    });
    setScorecardForm(campaignScorecardForm(activeCampaign));
    setRequirementDraft(activeCampaign.requirement?.original_text ?? activeCampaign.description ?? "");
  }, [activeCampaign]);

  async function saveCampaignDetails() {
    if (!activeCampaign) return;
    await updateCampaign(activeCampaign.id, {
      name: editForm.name,
      description: editForm.description,
      status: editForm.status,
      requirement_id: editForm.requirement_id || null,
      unlink_requirement: !editForm.requirement_id,
    });
    setEditingCampaign(false);
  }

  async function setCampaignLifecycle(status: "active" | "closed") {
    if (!activeCampaign) return;
    const message = status === "closed"
      ? "Finish this campaign? It will stay available for history, but matching and sourcing actions should stop."
      : "Reopen this campaign for matching and sourcing?";
    if (!window.confirm(message)) return;
    await updateCampaign(activeCampaign.id, { status });
  }

  async function confirmCampaignDelete() {
    if (!activeCampaign || deleteConfirmText !== "archive") return;
    await archiveCampaign(activeCampaign.id, deleteConfirmText);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
  }

  async function uploadCurrentRequirement() {
    if (!activeCampaign || !campaignRequirementFile) return;
    await uploadRequirement(activeCampaign.id, campaignRequirementFile);
    setCampaignRequirementFile(null);
    setActiveTab("scorecard");
  }

  async function extractRequirementDraft() {
    if (!activeCampaign || !requirementDraft.trim()) return;
    await createRequirement(activeCampaign.id, requirementDraft);
    setActiveTab("scorecard");
  }

  async function saveCurrentScorecard() {
    if (!activeCampaign) return;
    await saveScorecard(activeCampaign.id, campaignScorecardPayload(scorecardForm, activeCampaign));
  }

  async function moveSelectedCampaignCandidate(status: CampaignPipelineStatus) {
    if (!selectedCampaignCandidate) return;
    await Promise.resolve(updateCandidateStatus(selectedCampaignCandidate.candidate_id, status, stageNote));
    setActivePipelineStage(status);
    setSelectedCandidateId(selectedCampaignCandidate.candidate_id);
  }

  async function saveSelectedCampaignNote() {
    if (!selectedCampaignCandidate) return;
    await Promise.resolve(updateCandidateStatus(selectedCampaignCandidate.candidate_id, selectedCandidateStage, stageNote));
  }

  return (
    <section className="campaignPage campaignCleanPage">
      {!activeCampaign ? (
        <div className="campaignEmptyStart">
          <section className="panel campaignComposer cleanCampaignComposer">
            <span className="eyebrow">New campaign</span>
            <h2>Create a hiring campaign</h2>
            <p>Start with a campaign name and hiring brief. You can upload or paste a full requirement after creation.</p>
            <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name" />
            <textarea value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} placeholder="Optional hiring brief or context" />
            <button className="primary" onClick={createCampaign} disabled={busy || !campaignName.trim()}>Create campaign</button>
          </section>
        </div>
      ) : (
        <div className="campaignCleanWorkspace">
          <aside className="campaignCleanRail">
            <div className="campaignRailHeader">
              <div>
                <span className="eyebrow">Campaigns</span>
                <strong>{campaigns.length}</strong>
                <em>{activeCampaign.name}</em>
              </div>
              <button className="campaignRailNewButton" type="button" onClick={() => setShowCampaignCreate((value) => !value)}>
                {showCampaignCreate ? "Close" : "New"}
              </button>
            </div>
            {showCampaignCreate ? (
              <section className="campaignRailCreatePanel">
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name" />
                <textarea value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} placeholder="Optional hiring brief" />
                <button className="primary small" onClick={createCampaign} disabled={busy || !campaignName.trim()}>Create campaign</button>
              </section>
            ) : null}
            <div className="campaignRailList">
              {campaigns.map((item) => (
                <button
                  className={`${activeCampaign.id === item.id ? "active" : ""} ${campaignLoadingId === item.id ? "loading" : ""}`.trim()}
                  key={item.id}
                  onClick={() => openCampaign(item.id)}
                  disabled={campaignLoadingId === item.id}
                >
                  <span className="campaignRailInitial">{item.name.slice(0, 1).toUpperCase()}</span>
                  <span className="campaignRailItemCopy">
                    <strong>{item.name}</strong>
                    <em>{campaignLoadingId === item.id ? "Loading campaign..." : domainLabel(item.status)}</em>
                  </span>
                  <span className="campaignRailCount">{item.candidate_count}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="campaignCleanMain">
            <header className="campaignCleanHeader">
              <div>
                <span className="eyebrow">Campaign</span>
                <h2>{activeCampaign.name}</h2>
                <p>{activeCampaign.description || "No hiring brief saved yet."}</p>
                <div className="campaignCleanBadges">
                  {activeCampaignLoading ? <span>Loading details...</span> : null}
                  <span>{domainLabel(activeCampaign.status)}</span>
                  <span>{activeCampaign.requirement_title || "No requirement uploaded"}</span>
                  <span>{scorecardCompleteness}% scorecard</span>
                </div>
              </div>
              <div className="campaignCleanActions">
                <button className="plain" type="button" onClick={() => copyCurrentUrl()}>Copy Link</button>
                <button className="plain" onClick={() => setEditingCampaign((value) => !value)}>{editingCampaign ? "Close edit" : "Edit Campaign"}</button>
                {campaignClosed ? (
                  <button className="secondary" type="button" onClick={() => setCampaignLifecycle("active")} disabled={busy}>Reopen Campaign</button>
                ) : (
                  <button className="plain" type="button" onClick={() => setCampaignLifecycle("closed")} disabled={busy}>Finish Campaign</button>
                )}
                <button
                  className="plain campaignDeleteAction"
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={busy}
                >
                  <AlertTriangle size={14} /> Archive
                </button>
                <button className="secondary" onClick={() => setActiveTab("uploads")} disabled={campaignClosed}>Upload Resumes</button>
                <button className="primary" onClick={() => matchCampaign(activeCampaign.id)} disabled={busy || campaignClosed || !activeCampaign.requirement_id}>{RECRUITER_COPY.matchingButton}</button>
              </div>
            </header>

            {deleteConfirmOpen ? (
              <section className="campaignDeleteConfirmPanel" aria-label="Confirm campaign archive">
                <div>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Archive this campaign?</strong>
                    <span>{activeCampaign.name} will leave the workspace list. Candidate profiles, uploads, notes, matches, and history stay available.</span>
                  </div>
                </div>
                <label>
                  <span>Type archive to confirm</span>
                  <input
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    placeholder="archive"
                    autoFocus
                  />
                </label>
                <div>
                  <button className="plain" type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}>Cancel</button>
                  <button className="plain campaignDeleteAction" type="button" disabled={busy || deleteConfirmText !== "archive"} onClick={confirmCampaignDelete}>
                    <AlertTriangle size={14} /> Archive campaign
                  </button>
                </div>
              </section>
            ) : null}

            {campaignClosed ? (
              <section className="campaignClosedBanner">
                <strong>{activeCampaign.status === "archived" ? "Archived campaign" : "Finished campaign"}</strong>
                <span>This campaign is preserved for history. Reopen it before uploading resumes or refreshing matches.</span>
              </section>
            ) : null}

            {editingCampaign ? (
              <section className="campaignEditPanel">
                <div className="campaignEditGrid">
                  <label>
                    <span>Campaign name</span>
                    <input value={editForm.name} onChange={(event) => setEditForm((value) => ({ ...value, name: event.target.value }))} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={editForm.status} onChange={(event) => setEditForm((value) => ({ ...value, status: event.target.value }))}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="archived">Archived</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="wide">
                    <span>Description / hiring brief</span>
                    <textarea value={editForm.description} onChange={(event) => setEditForm((value) => ({ ...value, description: event.target.value }))} />
                  </label>
                  <label className="wide">
                    <span>Linked requirement</span>
                    <select value={editForm.requirement_id} onChange={(event) => setEditForm((value) => ({ ...value, requirement_id: event.target.value }))}>
                      <option value="">No linked requirement</option>
                      {requirements.map((item) => <option key={item.id} value={item.id}>{item.title || "Untitled requirement"} | {domainLabel(item.status)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="campaignEditActions">
                  <button className="plain" onClick={() => setEditingCampaign(false)}>Cancel</button>
                  <button className="primary" onClick={saveCampaignDetails} disabled={busy || !editForm.name.trim()}>Save campaign</button>
                </div>
              </section>
            ) : null}

            <section className="campaignProgressMini">
              {campaignProgress.stages.map((stage) => (
                <article className={stage.done ? "done" : stage.active ? "active" : ""} key={stage.label}>
                  <span>{stage.label}</span>
                  <strong>{stage.value}</strong>
                </article>
              ))}
            </section>

            <nav className="campaignWorkflowTabs cleanTabs" aria-label="Campaign workflow">
              <button className={activeTab === "pipeline" ? "active" : ""} onClick={() => setActiveTab("pipeline")}>Pipeline</button>
              <button className={activeTab === "matches" ? "active" : ""} onClick={() => setActiveTab("matches")}>Matches</button>
              <button className={activeTab === "scorecard" ? "active" : ""} onClick={() => setActiveTab("scorecard")}>Scorecard</button>
              <button className={activeTab === "uploads" ? "active" : ""} onClick={() => setActiveTab("uploads")}>Uploads</button>
              <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>Activity</button>
            </nav>

          {activeTab === "matches" ? (
            <section className="campaignTabPane campaignMatchesList">
              <div className="campaignPanelHeader">
                <div>
                  <span className="eyebrow">Recommended candidates</span>
                  <h3>{visibleRankedCandidates.length} candidates above {Math.round(campaignMatchThreshold * 100)}%</h3>
                  <p>{visibleRankedCandidates.length > matchResultLimit ? `Showing top ${matchResultLimit}. Raise the threshold or load more only when needed.` : "Showing the recruiter-actionable set for this threshold."}</p>
                </div>
                <button className="secondary" onClick={() => matchCampaign(activeCampaign.id)} disabled={busy || campaignClosed || !activeCampaign.requirement_id}>Refresh matches</button>
              </div>
              {rankedCandidates.length ? (
                <section className="matchDistributionPanel compact">
                  <div>
                    <span className="eyebrow">Review threshold</span>
                    <p>Use buckets instead of scrolling through weak matches. Below-threshold profiles stay hidden unless you lower the bar.</p>
                  </div>
                  <div className="matchGaugeBuckets">
                    {campaignMatchBuckets.map((bucket) => (
                      <button className={campaignMatchThreshold === bucket.minimum ? "active" : ""} key={bucket.label} onClick={() => setCampaignMatchThreshold(bucket.minimum)}>
                        <span>{bucket.label}</span>
                        <strong>{bucket.count}</strong>
                        <i style={{ width: `${Math.max(8, Math.min(100, bucket.percent))}%` }} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {visibleRankedCandidatePage.length ? visibleRankedCandidatePage.map((item, index) => (
                <article className="campaignMatchRow" key={item.candidate_id}>
                  <b>{index + 1}</b>
                  <button onClick={() => openCandidate(item.candidate_id)}>
                    <strong>{item.candidate?.name ?? item.candidate_id}</strong>
                    <span>{item.candidate?.current_title ?? "No title"} {item.candidate?.current_company ? `at ${item.candidate.current_company}` : ""}</span>
                  </button>
                  <em>{Math.round((item.score ?? 0) * 100)}%</em>
                  <p>
                    <span className="fitTypeBadge">{domainLabel(item.evidence?.fit_type ?? item.evidence?.llm_judge?.fit_type ?? "review_worthy")}</span>
                    {campaignReasonItems(item)[0] ?? item.evidence?.recommendation ?? "Open report for source-backed evidence."}
                    {campaignGapItems(item)[0] ? <small>Verify: {campaignGapItems(item)[0]}</small> : null}
                  </p>
                  <div>
                    <button className="secondary small" onClick={() => updateCandidateStatus(item.candidate_id, "shortlisted")} disabled={campaignClosed}>Shortlist</button>
                    <button className="plain small danger" onClick={() => updateCandidateStatus(item.candidate_id, "rejected")} disabled={campaignClosed}>Reject</button>
                  </div>
                </article>
              )) : <EmptyPanel title={rankedCandidates.length ? "No candidates above this threshold" : "No recommendations yet"} body={rankedCandidates.length ? "Lower the threshold bucket or adjust the scorecard." : "Find matches from the existing database, or upload resumes directly into this campaign."} />}
              {visibleRankedCandidates.length > visibleRankedCandidatePage.length ? (
                <button className="plain loadMoreMatches" type="button" onClick={() => setMatchResultLimit((value) => value + 50)}>
                  Load 50 more candidates
                </button>
              ) : null}
            </section>
          ) : null}

          {activeTab === "scorecard" ? (
            <section className="campaignScorecardWorkspace">
              <article className="campaignRequirementImport">
                <div>
                  <span className="eyebrow">Requirement intake</span>
                  <h3>Upload or paste a requirement</h3>
                  <p>The system extracts the requirement into editable scorecard fields. Save the scorecard before matching.</p>
                </div>
                <div className="campaignRequirementImportGrid">
                  <label className="campaignRequirementDrop">
                    <FileUp size={20} />
                    <span>{campaignRequirementFile ? campaignRequirementFile.name : "Upload requirement file"}</span>
                    <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setCampaignRequirementFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <button className="secondary" disabled={busy || campaignClosed || !campaignRequirementFile} onClick={uploadCurrentRequirement}>Extract file</button>
                  <textarea value={requirementDraft} onChange={(event) => setRequirementDraft(event.target.value)} placeholder="Paste job requirement, client email, or hiring manager notes..." />
                  <button className="secondary" disabled={busy || campaignClosed || !requirementDraft.trim()} onClick={extractRequirementDraft}>Extract pasted text</button>
                </div>
              </article>

              <article className="campaignScorecardEditor">
                <div className="campaignPanelHeader">
                  <div>
                    <span className="eyebrow">Editable scorecard</span>
                    <h3>{activeCampaign.requirement_title || "Campaign requirement"}</h3>
                    <p>Location is treated as a preference in campaign matching, not a hard blocker.</p>
                  </div>
                  <button className="primary" onClick={saveCurrentScorecard} disabled={busy || campaignClosed}>Save Scorecard</button>
                </div>
                <div className="campaignScorecardGrid">
                  <label className="wide">
                    <span>Role intent</span>
                    <input value={scorecardForm.role_intent} onChange={(event) => setScorecardForm((value) => ({ ...value, role_intent: event.target.value }))} placeholder="Example: hands-on data engineer for healthcare analytics platform" />
                  </label>
                  <label>
                    <span>Location preference</span>
                    <input value={scorecardForm.location_preference} onChange={(event) => setScorecardForm((value) => ({ ...value, location_preference: event.target.value }))} placeholder="New York, Remote US, EST" />
                  </label>
                  <label>
                    <span>Seniority</span>
                    <input value={scorecardForm.seniority} onChange={(event) => setScorecardForm((value) => ({ ...value, seniority: event.target.value }))} placeholder="Senior / Lead / Principal" />
                  </label>
                  <label>
                    <span>Minimum years</span>
                    <input value={scorecardForm.min_years_experience} onChange={(event) => setScorecardForm((value) => ({ ...value, min_years_experience: event.target.value }))} placeholder="5" />
                  </label>
                  <label className="wide">
                    <span>Must-have skills</span>
                    <textarea value={scorecardForm.must_have_skills} onChange={(event) => setScorecardForm((value) => ({ ...value, must_have_skills: event.target.value }))} placeholder="Python, Spark, Databricks" />
                  </label>
                  <label className="wide">
                    <span>Nice-to-have skills</span>
                    <textarea value={scorecardForm.nice_to_have_skills} onChange={(event) => setScorecardForm((value) => ({ ...value, nice_to_have_skills: event.target.value }))} placeholder="Healthcare, Azure, Airflow" />
                  </label>
                  <label>
                    <span>Domains / industries</span>
                    <textarea value={scorecardForm.domains} onChange={(event) => setScorecardForm((value) => ({ ...value, domains: event.target.value }))} placeholder="Data engineering, healthcare, AI platform" />
                  </label>
                  <label>
                    <span>Industry preference</span>
                    <textarea value={scorecardForm.industry_preferences} onChange={(event) => setScorecardForm((value) => ({ ...value, industry_preferences: event.target.value }))} placeholder="Healthcare, fintech, public sector, SaaS" />
                  </label>
                  <label>
                    <span>Hidden intent / soft preferences</span>
                    <textarea value={scorecardForm.hidden_intent} onChange={(event) => setScorecardForm((value) => ({ ...value, hidden_intent: event.target.value }))} placeholder="Client-facing, startup pace, enterprise data, recent hands-on delivery" />
                  </label>
                  <label className="wide">
                    <span>Soft preferences</span>
                    <textarea value={scorecardForm.soft_preferences} onChange={(event) => setScorecardForm((value) => ({ ...value, soft_preferences: event.target.value }))} placeholder="Remote East Coast preferred, healthcare data helpful, cloud migration exposure" />
                  </label>
                  <label className="wide">
                    <span>Dealbreakers</span>
                    <textarea value={scorecardForm.dealbreakers} onChange={(event) => setScorecardForm((value) => ({ ...value, dealbreakers: event.target.value }))} placeholder="No production data engineering experience" />
                  </label>
                </div>
                <section className="campaignWeightEditor">
                  <div>
                    <h4>Matching brain</h4>
                    <p>Adjust weights before matching. Missing evidence is shown as unclear, not automatic rejection.</p>
                  </div>
                  <div className="campaignStrictToggles">
                    <label><input type="checkbox" checked={scorecardForm.strict_must_haves} onChange={(event) => setScorecardForm((value) => ({ ...value, strict_must_haves: event.target.checked }))} /> Must-haves are hard blockers</label>
                    <label><input type="checkbox" checked={scorecardForm.strict_min_years} onChange={(event) => setScorecardForm((value) => ({ ...value, strict_min_years: event.target.checked }))} /> Minimum years is hard blocker</label>
                  </div>
                  <div className="campaignWeightGrid">
                    {[
                      ["Skills", "weight_skills"],
                      ["Role", "weight_role"],
                      ["Domain", "weight_domain"],
                      ["Years", "weight_years"],
                      ["Location", "weight_location"],
                      ["Recency", "weight_recency"],
                      ["Seniority", "weight_seniority"],
                      ["Notes", "weight_notes"],
                    ].map(([label, key]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input value={String(scorecardForm[key as keyof CampaignScorecardForm] ?? "")} onChange={(event) => setScorecardForm((value) => ({ ...value, [key]: event.target.value }))} inputMode="decimal" />
                      </label>
                    ))}
                  </div>
                </section>
              </article>
            </section>
          ) : null}

          {activeTab === "uploads" ? (
            <section className="campaignTabPane campaignUploadsPane">
              <div className="campaignPanelHeader">
                <div>
                  <span className="eyebrow">Campaign sourcing</span>
                  <h3>Upload resumes into this campaign</h3>
                  <p>New resumes become part of the campaign and the main candidate database.</p>
                </div>
                <label className="primary uploadMini">
                  Select resumes
                  <input type="file" multiple accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setCampaignFiles(Array.from(event.target.files ?? []))} />
                </label>
                <button className="secondary" onClick={uploadResumes} disabled={busy || campaignClosed || !campaignFiles.length}>Queue {campaignFiles.length || ""} resume{campaignFiles.length === 1 ? "" : "s"}</button>
              </div>
              {activeCampaign.upload_batches?.length ? (
                <div className="campaignBatches">
                  <strong>Upload history</strong>
                  {activeCampaign.upload_batches.map((batch) => (
                    <article key={batch.id}>
                      <div>
                        <span>{batch.name}</span>
                        <em>{domainLabel(batch.status)} | {batch.completed_count}/{batch.total_files} completed, {batch.failed_count} failed | {formatDateTime(batch.updated_at)}</em>
                      </div>
                      <ProgressBar value={batch.total_files ? Math.round(((batch.completed_count + batch.failed_count) / batch.total_files) * 100) : 0} />
                    </article>
                  ))}
                </div>
              ) : <EmptyPanel title="No campaign uploads yet" body="Upload resumes here when sourcing specifically for this job." />}
            </section>
          ) : null}

          {activeTab === "activity" ? (
            <section className="campaignActivityWorkspace">
              <section className="campaignActivityTimeline">
                <div className="campaignActivityHead">
                  <span className="eyebrow">Campaign Timeline</span>
                  <strong>{campaignTimeline.length} events</strong>
                </div>
                <div>
                  {campaignTimeline.slice(0, 8).map((event) => (
                    <article key={event.id}>
                      <i />
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.body}</span>
                      </div>
                      <time>{formatDateTime(event.date)}</time>
                    </article>
                  ))}
                </div>
              </section>
              <CollaborationPanel token={token} entityType="campaign" entityId={activeCampaign.id} teamMembers={teamMembers} compact />
            </section>
          ) : null}

          {activeTab === "pipeline" && selectedCandidates.length ? (
            <div className="campaignPipelineFocus">
              <section className="campaignPipelineGuardrail">
                <div>
                  <span className="eyebrow">Pipeline focus</span>
                  <strong>{pipelineCandidates.length} actionable candidates across {nonEmptyStageCount || 0} active stage{nonEmptyStageCount === 1 ? "" : "s"}</strong>
                  <p>{hiddenPipelineCandidates > 0 ? `${hiddenPipelineCandidates} weak or below-threshold candidates are hidden from the working pipeline. Use Matches to lower the threshold only if you need more recall.` : "The pipeline only shows candidates worth recruiter action at the current threshold."}</p>
                </div>
                <div className="pipelineThresholdButtons">
                  {campaignMatchBuckets.map((bucket) => (
                    <button className={campaignMatchThreshold === bucket.minimum ? "active" : ""} key={bucket.label} onClick={() => setCampaignMatchThreshold(bucket.minimum)}>
                      {bucket.label} <b>{bucket.count}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="campaignStageStrip" aria-label="Campaign stages">
                {stageBuckets.map((stage) => (
                  <button
                    className={activePipelineStage === stage.id ? "active" : stage.candidates.length ? "" : "empty"}
                    key={stage.id}
                    onClick={() => {
                      setActivePipelineStage(stage.id);
                      setStageNote("");
                    }}
                    type="button"
                  >
                    <span>{stage.label}</span>
                    <strong>{stage.candidates.length}</strong>
                  </button>
                ))}
              </section>

              <div className="campaignPipelineWorkspace">
                <section className="campaignStageListPanel">
                  <div className="campaignStageHeader">
                    <div>
                      <span className="eyebrow">Selected stage</span>
                      <h3>{activeStageBucket?.label ?? "Pipeline"}</h3>
                      <p>{activeStageCandidates.length ? "Work this focused stage without scrolling through empty pipeline columns." : "No candidates are currently in this stage at the selected threshold."}</p>
                    </div>
                    <button className="secondary small" onClick={() => setActiveTab("matches")}>Review all matches</button>
                  </div>

                  {activeStageCandidates.length ? (
                    <div className="campaignStageCandidateList">
                      {activeStageCandidates.map((item, index) => (
                        <button
                          className={selectedCampaignCandidate?.candidate_id === item.candidate_id ? "campaignStageCandidate active" : "campaignStageCandidate"}
                          key={item.candidate_id}
                          onClick={() => setSelectedCandidateId(item.candidate_id)}
                          type="button"
                        >
                          <div className="campaignStageScore">
                            <strong>{Math.round((item.score ?? 0) * 100)}%</strong>
                            <span>#{index + 1}</span>
                          </div>
                          <div className="campaignStageCandidateBody">
                            <strong>{item.candidate?.name ?? item.candidate_id}</strong>
                            <span>{item.candidate?.current_title ?? "No title"} {item.candidate?.current_company ? `at ${item.candidate.current_company}` : ""}</span>
                            <p>{campaignReasonItems(item)[0] ?? item.evidence?.recommendation ?? "Open the candidate report to inspect source-backed evidence."}</p>
                            {campaignGapItems(item)[0] ? <em>Verify: {campaignGapItems(item)[0]}</em> : null}
                          </div>
                          <div className="campaignStageMeta">
                            <span>{domainLabel(item.evidence?.fit_type ?? item.evidence?.llm_judge?.fit_type ?? item.source)}</span>
                            {item.candidate && candidateRoleFactsNeedReview(item.candidate) ? <b>Facts need review</b> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel title={`No ${activeStageBucket?.label?.toLowerCase() ?? "stage"} candidates`} body="Pick another stage, lower the review threshold, or run matching again after updating the scorecard." />
                  )}
                </section>

                <aside className="campaignCandidatePanel campaignPipelineCandidatePanel">
                  {selectedCampaignCandidate ? (
                    <>
                      <span className="eyebrow">Candidate action panel</span>
                      <h3>{selectedCampaignCandidate.candidate?.name ?? selectedCampaignCandidate.candidate_id}</h3>
                      <p>{selectedCampaignCandidate.candidate?.current_title ?? "No title"} {selectedCampaignCandidate.candidate?.current_company ? `at ${selectedCampaignCandidate.candidate.current_company}` : ""}</p>
                      <div className="scoreBadge">{Math.round((selectedCampaignCandidate.score ?? 0) * 100)}% match</div>
                      <div className="campaignScoreBreakdown">
                        {campaignScoreBreakdownItems(selectedCampaignCandidate).map((item) => (
                          <span key={item.label}><strong>{item.value}%</strong>{item.label}</span>
                        ))}
                      </div>
                      {campaignHardFilterFailures(selectedCampaignCandidate).length ? (
                        <div className="campaignHardFilters">
                          <strong>Must-check items need review</strong>
                          {campaignHardFilterFailures(selectedCampaignCandidate).slice(0, 3).map((failure, failureIndex) => <span key={`${failure}-${failureIndex}`}>{failure}</span>)}
                        </div>
                      ) : <div className="campaignHardFilterPass">Must-check items passed</div>}
                      <strong className="campaignPanelSubhead">Why this candidate</strong>
                      <div className="campaignEvidence">
                        {campaignReasonItems(selectedCampaignCandidate).slice(0, 4).map((reason, reasonIndex) => <span key={`${selectedCampaignCandidate.candidate_id}-side-${reasonIndex}`}>{reason}</span>)}
                      </div>
                      {campaignGapItems(selectedCampaignCandidate).length ? (
                        <div className="campaignGaps">
                          {campaignGapItems(selectedCampaignCandidate).slice(0, 4).map((gap, gapIndex) => <span key={`${gap}-${gapIndex}`}>{gap}</span>)}
                        </div>
                      ) : null}
                      <div className="draftBox">
                        <strong>Suggested recruiter angle</strong>
                        <span>{selectedCampaignCandidate.evidence?.recommendation ?? "Open the candidate report to tailor outreach from resume evidence and recruiter notes."}</span>
                      </div>
                      <div className="campaignCandidateWorkflow">
                        <div className="campaignCandidateWorkflowHead">
                          <div>
                            <span className="eyebrow">Campaign workflow</span>
                            <strong>{campaignStages.find((stage) => stage.id === selectedCandidateStage)?.label ?? domainLabel(selectedCandidateStage)}</strong>
                          </div>
                          <button className="plain small" onClick={() => openCandidate(selectedCampaignCandidate.candidate_id)}>Open report</button>
                        </div>
                        <div className="campaignStageProgress" aria-label="Candidate campaign stage progress">
                          {campaignStages.map((stage, index) => (
                            <button
                              className={stage.id === selectedCandidateStage ? "active" : index < selectedCandidateStageIndex ? "done" : ""}
                              key={stage.id}
                              onClick={() => moveSelectedCampaignCandidate(stage.id)}
                              disabled={campaignClosed}
                              title={stage.label}
                              type="button"
                            >
                              <i />
                              <span>{stage.label}</span>
                            </button>
                          ))}
                        </div>
                        <div className="campaignStageMoveControls">
                          <button className="secondary small" disabled={campaignClosed || !previousCampaignStage} onClick={() => previousCampaignStage && moveSelectedCampaignCandidate(previousCampaignStage.id)}>
                            Move back{previousCampaignStage ? ` to ${previousCampaignStage.label}` : ""}
                          </button>
                          <button className="primary small" disabled={campaignClosed || !nextCampaignStage} onClick={() => nextCampaignStage && moveSelectedCampaignCandidate(nextCampaignStage.id)}>
                            Move forward{nextCampaignStage ? ` to ${nextCampaignStage.label}` : ""}
                          </button>
                        </div>
                        <div className="campaignStageQuickActions">
                          <button className="secondary small" onClick={() => moveSelectedCampaignCandidate("shortlisted")} disabled={campaignClosed || selectedCandidateStage === "shortlisted"}>Shortlist</button>
                          <button className="plain small" onClick={() => moveSelectedCampaignCandidate("contacted")} disabled={campaignClosed || selectedCandidateStage === "contacted"}>Contacted</button>
                          <button className="plain small" onClick={() => moveSelectedCampaignCandidate("submitted")} disabled={campaignClosed || selectedCandidateStage === "submitted"}>Submit</button>
                          <button className="plain small danger" onClick={() => moveSelectedCampaignCandidate("rejected")} disabled={campaignClosed || selectedCandidateStage === "rejected"}>Reject</button>
                        </div>
                        <label className="campaignCandidateNoteBox">
                          <span>Campaign-candidate note</span>
                          <textarea value={stageNote} onChange={(event) => setStageNote(event.target.value)} placeholder="Add screening feedback, follow-up context, client fit, or why this candidate moved stages. This note only belongs to this candidate inside this campaign." />
                        </label>
                        <button className="secondary small" onClick={saveSelectedCampaignNote} disabled={campaignClosed}>Save campaign note</button>
                        <div className="campaignCandidateHistory">
                          <div>
                            <strong>Campaign note history</strong>
                            <span>{selectedCampaignCandidate.activity_events?.length ?? 0} updates</span>
                          </div>
                          {selectedCampaignCandidate.activity_events?.length ? (
                            selectedCampaignCandidate.activity_events.slice(0, 5).map((event) => (
                              <article key={event.id}>
                                <time>{formatDateTime(event.created_at)}</time>
                                <strong>{event.title}</strong>
                                {event.body ? <p>{event.body}</p> : <p>No note added.</p>}
                                {event.user_email ? <span>{event.user_email}</span> : null}
                              </article>
                            ))
                          ) : (
                            <p>No campaign notes yet. Save one here when this candidate moves through the campaign.</p>
                          )}
                        </div>
                        <CollaborationPanel token={token} entityType="campaign_candidate" entityId={selectedCampaignCandidate.id} teamMembers={teamMembers} compact />
                      </div>
                    </>
                  ) : (
                    <EmptyPanel title="No selected candidate" body="Select a stage with candidates to see evidence, stage controls, and next actions." />
                  )}
                </aside>
              </div>
            </div>
          ) : null}
          {activeTab === "pipeline" && !selectedCandidates.length ? (
            <EmptyPanel
              title={activeCampaignLoading ? "Loading campaign candidates" : "No campaign candidates yet"}
              body={activeCampaignLoading ? "Fetching the latest campaign pipeline, matches, uploads, and activity." : "Find matches from the existing database, or upload resumes directly into this campaign."}
            />
          ) : null}
          </main>
        </div>
      )}
    </section>
  );
}
