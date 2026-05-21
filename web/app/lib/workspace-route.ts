import type { CampaignPipelineStatus } from "../../lib/api";

export type View = "dashboard" | "copilot" | "database" | "upload" | "operations" | "candidate" | "requirement" | "matches" | "campaigns" | "versions" | "team" | "admin";
export type CandidateDetailTab = "overview" | "timeline" | "evidence" | "cv" | "notes" | "versions";
export type CampaignDetailTab = "pipeline" | "matches" | "scorecard" | "uploads" | "activity";

export type WorkspaceRoute = {
  view?: View;
  candidateId?: string;
  candidateTab?: CandidateDetailTab;
  campaignId?: string;
  campaignTab?: CampaignDetailTab;
  campaignStage?: CampaignPipelineStatus;
  campaignCandidateId?: string;
  threadId?: string;
  requirementId?: string;
};

const WORKSPACE_VIEWS = new Set<View>(["dashboard", "copilot", "database", "upload", "operations", "candidate", "requirement", "matches", "campaigns", "versions", "team", "admin"]);
const CANDIDATE_DETAIL_TABS = new Set<CandidateDetailTab>(["overview", "timeline", "evidence", "cv", "notes", "versions"]);
const CAMPAIGN_DETAIL_TABS = new Set<CampaignDetailTab>(["pipeline", "matches", "scorecard", "uploads", "activity"]);
const CAMPAIGN_PIPELINE_STAGES = new Set<CampaignPipelineStatus>(["recommended", "shortlisted", "contacted", "replied", "screened", "submitted", "interviewing", "offer", "placed", "rejected"]);

export function parseWorkspaceRoute(search: string): WorkspaceRoute {
  const params = new URLSearchParams(search);
  const viewValue = params.get("view");
  const candidateTabValue = params.get("candidateTab");
  const campaignTabValue = params.get("campaignTab");
  const campaignStageValue = params.get("campaignStage");
  return {
    view: viewValue && WORKSPACE_VIEWS.has(viewValue as View) ? viewValue as View : undefined,
    candidateId: params.get("candidate") || undefined,
    candidateTab: candidateTabValue && CANDIDATE_DETAIL_TABS.has(candidateTabValue as CandidateDetailTab) ? candidateTabValue as CandidateDetailTab : undefined,
    campaignId: params.get("campaign") || undefined,
    campaignTab: campaignTabValue && CAMPAIGN_DETAIL_TABS.has(campaignTabValue as CampaignDetailTab) ? campaignTabValue as CampaignDetailTab : undefined,
    campaignStage: campaignStageValue && CAMPAIGN_PIPELINE_STAGES.has(campaignStageValue as CampaignPipelineStatus) ? campaignStageValue as CampaignPipelineStatus : undefined,
    campaignCandidateId: params.get("campaignCandidate") || undefined,
    threadId: params.get("thread") || undefined,
    requirementId: params.get("requirement") || undefined,
  };
}

export function routeHasDeepLink(route: WorkspaceRoute) {
  return Boolean(route.view || route.candidateId || route.campaignId || route.threadId || route.requirementId);
}

export function canonicalWorkspaceUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  if (url.hostname === "www.candidatesignal.ai" || url.hostname === "candidatesignal.ai") {
    url.protocol = "https:";
    url.hostname = "app.candidatesignal.ai";
  }
  return url.toString();
}

export function copyCurrentUrl() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(canonicalWorkspaceUrl());
}
