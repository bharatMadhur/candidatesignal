"use client";

import { AlertTriangle, CheckCircle2, FileUp, Rocket, Search, UploadCloud } from "lucide-react";
import type { CandidateSummary, JobCampaign } from "../../lib/api";
import {
  candidateProfileFreshnessLabel,
  candidateProfileFreshnessNeedsReview,
  candidateReviewSignalDone,
  candidateRoleFactsNeedReview,
  topDomainCounts,
  type CandidateReviewSignal,
} from "../lib/candidate-database";
import { normalizeCandidateVersionStatus } from "../lib/candidate-versions";
import { domainLabel } from "../lib/format";
import type { CandidateDetailTab, View } from "../lib/workspace-route";
import { EmptyPanel, ProgressBar } from "./primitives";
import { RECRUITER_COPY } from "./recruiter-language";

type ReviewCenterItem = {
  title: string;
  body: string;
  action: string;
  doneAction?: string;
  label: string;
  run: () => void;
  done?: () => void;
};

export function Dashboard({
  candidates,
  campaigns,
  deadLetterCount,
  operationalAlertCount,
  setView,
  openCandidate,
  markReviewSignal,
}: {
  candidates: CandidateSummary[];
  campaigns: JobCampaign[];
  deadLetterCount: number;
  operationalAlertCount: number;
  setView: (view: View) => void;
  openCandidate: (id: string, tab?: CandidateDetailTab) => void;
  markReviewSignal: (documentId: string, signalKey: CandidateReviewSignal) => void;
}) {
  const urgentCoverageCandidates = candidates.filter((item) => (item.coverage ?? 1) > 0 && (item.coverage ?? 1) < 0.65 && !candidateReviewSignalDone(item, "low_coverage"));
  const roleFactReviewCandidates = candidates.filter((item) => candidateRoleFactsNeedReview(item) && !candidateReviewSignalDone(item, "role_fact_review"));
  const profileFreshnessReviewCandidates = candidates.filter(candidateProfileFreshnessNeedsReview);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newToday = candidates.filter((item) => item.updated_at && new Date(item.updated_at).getTime() >= dayAgo).length;
  const newThisWeek = candidates.filter((item) => item.updated_at && new Date(item.updated_at).getTime() >= weekAgo).length;
  const readyForReview = candidates.filter((item) => (item.coverage ?? 0) >= 0.8 && !(item.duplicate_risk_score && item.duplicate_risk_score >= 0.75)).length;
  const domainCounts = topDomainCounts(candidates);
  const actionItems: ReviewCenterItem[] = [
    ...(deadLetterCount ? [{
      title: "Resume files are waiting for review",
      body: `${deadLetterCount} file${deadLetterCount === 1 ? "" : "s"} need a retry, replacement, or ignore decision. Details are kept in Upload Review so the dashboard stays calm.`,
      action: "Open Upload Review",
      label: "File review",
      run: () => setView("operations"),
    }] : []),
    ...(operationalAlertCount ? [{
      title: "Processing items are waiting",
      body: `${operationalAlertCount} processing item${operationalAlertCount === 1 ? "" : "s"} are available for admin review. Recruiters can keep working.`,
      action: "Open Processing Health",
      label: "Processing review",
      run: () => setView("operations"),
    }] : []),
    ...candidates
      .filter((item) => (item.duplicate_risk_score ?? 0) >= 0.75 && normalizeCandidateVersionStatus(item.duplicate_status) === "suggested")
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} has a possible newer resume version`,
        body: `${Math.round((item.duplicate_risk_score ?? 0) * 100)}% version signal from matching identity/profile fields.`,
        action: "Review versions",
        label: "Version review",
        run: () => openCandidate(item.document_id, "versions"),
      })),
    ...urgentCoverageCandidates
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} has unusable profile coverage`,
        body: `Profile completeness is ${Math.round((item.coverage ?? 0) * 100)}%. Edit extracted fields, reparse, or remove the upload if it was not a resume.`,
        action: "Fix profile",
        doneAction: "Mark reviewed",
        label: "Profile fix",
        run: () => openCandidate(item.document_id),
        done: () => markReviewSignal(item.document_id, "low_coverage" as const),
      })),
    ...roleFactReviewCandidates
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} needs role fact review`,
        body: "The latest role was not fully supported by source evidence. Open Evidence to verify or edit extracted fields.",
        action: "Review evidence",
        doneAction: "Mark reviewed",
        label: "Fact review",
        run: () => openCandidate(item.document_id, "evidence"),
        done: () => markReviewSignal(item.document_id, "role_fact_review" as const),
      })),
    ...profileFreshnessReviewCandidates
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} needs profile freshness review`,
        body: candidateProfileFreshnessLabel(item.profile_freshness) || "Open the profile to verify LinkedIn, current location, or recently updated work history.",
        action: "Review profile",
        doneAction: "Mark reviewed",
        label: "Freshness review",
        run: () => openCandidate(item.document_id),
        done: () => markReviewSignal(item.document_id, "profile_freshness_review" as const),
      })),
  ].slice(0, 5);
  const reviewCount = actionItems.length;
  const activeCampaigns = campaigns.filter((item) => item.status !== "archived").slice(0, 4);
  return (
    <section className="snapshotPage">
      <main className="snapshotMain">
        <header className="stitchHeader">
          <h2>{RECRUITER_COPY.dashboardTitle}</h2>
          <p>{RECRUITER_COPY.dashboardSubtitle}</p>
        </header>
        <section className="homeActionBar">
          <button className="primary" onClick={() => setView("upload")}><UploadCloud size={18} /> Upload resumes</button>
          <button className="secondary" onClick={() => setView("campaigns")}><Rocket size={18} /> Create campaign</button>
          <button className="plain" onClick={() => setView("copilot")}><Search size={18} /> Search candidates</button>
        </section>
        <div className="stitchMetricGrid">
          <button className="stitchMetricCard" onClick={() => setView("database")}>
            <div><span>New or Updated</span><b><FileUp size={20} /></b></div>
            <strong>{newToday || newThisWeek}</strong>
            <em>Candidate profiles from recent resume activity</em>
          </button>
          <button className="stitchMetricCard attention" onClick={() => actionItems[0]?.run() ?? setView("database")}>
            <div><span>Review Center</span><b>{reviewCount ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</b></div>
            <strong>{reviewCount}</strong>
            <em>Files or profiles waiting for a clear recruiter/admin decision</em>
          </button>
          <button className="stitchMetricCard" onClick={() => setView("database")}>
            <div><span>Ready Candidates</span><b><CheckCircle2 size={20} /></b></div>
            <strong>{readyForReview}</strong>
            <em>Profiles with enough data for matching</em>
          </button>
        </div>
        <section className="stitchCampaignSection">
          <div className="stitchSectionHead">
            <h3>Active Campaigns</h3>
            <button onClick={() => setView("campaigns")}>View All</button>
          </div>
          <div className="stitchCampaignTable">
            {activeCampaigns.length ? activeCampaigns.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.requirement_title ? `Req: ${item.requirement_title}` : "Req: Draft"} • {domainLabel(item.status)}</span>
                </div>
                <div className="pipelineCell">
                  <div><span>Pipeline Depth</span><b>{Math.min(95, Math.max(10, item.candidate_count * 12))}%</b></div>
                  <ProgressBar value={Math.min(95, Math.max(10, item.candidate_count * 12))} />
                </div>
                <div><strong>{item.candidate_count}</strong><span> Candidates</span></div>
              </article>
            )) : (
              <>
                <article>
                  <div><strong>No active campaigns</strong><span>Create a campaign to start a hiring board</span></div>
                  <div className="pipelineCell"><div><span>Pipeline Depth</span><b>0%</b></div><ProgressBar value={0} /></div>
                  <div><strong>0</strong><span> Candidates</span></div>
                </article>
              </>
            )}
          </div>
        </section>
        {domainCounts.length ? (
          <section className="stitchDomainStrip">
            {domainCounts.slice(0, 4).map(([domain, count]) => <span key={domain}>{domainLabel(domain)} <b>{count}</b></span>)}
          </section>
        ) : null}
      </main>
      <aside className="snapshotAside">
        <div className="actionHeader">
          <h3><CheckCircle2 size={22} /> {RECRUITER_COPY.reviewQueueTitle}</h3>
          <span>{reviewCount || 0} item{reviewCount === 1 ? "" : "s"}</span>
        </div>
        <div className="stitchActionList">
          {actionItems.length ? actionItems.slice(0, 3).map((item) => (
            <article key={item.title}>
              <div className="actionPerson">
                <div className="avatarDot">{item.title.slice(0, 1)}</div>
                <div>
                  <strong>{item.title.split(" has ")[0].replace(" needs missing profile fields", "")}</strong>
                  <span>{item.label}</span>
                </div>
              </div>
              <p>{item.body}</p>
              <div className="actionButtons">
                <button onClick={item.run}>{item.action}</button>
                {item.done ? <button className="quietActionButton" onClick={item.done}>{item.doneAction ?? "Mark reviewed"}</button> : null}
              </div>
            </article>
          )) : <EmptyPanel title="No decisions needed" body={RECRUITER_COPY.reviewQueueEmpty} />}
        </div>
      </aside>
    </section>
  );
}
