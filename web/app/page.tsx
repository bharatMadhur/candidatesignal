"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileSearch,
  FileUp,
  Loader2,
  LogIn,
  LogOut,
  Rocket,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  Candidate,
  CandidatePortalProfile,
  CandidatePortalPrivacySettings,
  CandidateResumeShare,
  CandidateProfileUpdate,
  CandidateResumeUpload,
  CandidateResumeVersion,
  CandidateAiLearningEvent,
  CandidateAiSuggestion,
  CandidateApplication,
  CandidateAccessRequest,
  CandidateSelfMatch,
  CampaignPipelineStatus,
  CampaignScorecard,
  CandidateMaintenanceJob,
  CandidateSummary,
  LinkedInImportJob,
  AuditEvent,
  CopilotThread,
  CurrentUser,
  CandidateVersionMatch,
  GovernancePolicy,
  JobCampaign,
  OperationalAlert,
  OperationalAlertDelivery,
  MailMessage,
  PiiAccessEvent,
  ParseDeadLetter,
  ParseBatch,
  Requirement,
  RequirementMatch,
  RequirementMatchRun,
  RequirementMatchRunChange,
  TeamMember,
  Tenant,
  TenantAdminDetail,
  TenantInvitation,
  WorkerStatus,
  acceptInvitation,
  acknowledgeOperationalAlert,
  addNote,
  bootstrap,
  bulkUploadResumes,
  cancelInvitation,
  cancelCandidateMaintenanceJob,
  cancelParseBatch,
  cancelParseJob,
  chatCopilot,
  archiveCopilotThread,
  archiveCampaign,
  archiveCandidatePortalResumeVersion,
  candidateSignup,
  companySignup,
  createCandidatePortalResumeVersion,
  createCandidatePortalResumeShare,
  createCandidatePortalApplication,
  createCandidateAiLearningEvent,
  createCampaign,
  createCampaignRequirement,
  createCandidateRederiveJob,
  createTenant,
  createRequirement,
  createRequirementFromCopilotThread,
  decideCandidateVersion,
  decideCandidatePortalAccessRequest,
  deleteCandidate,
  getTeam,
  getCampaign,
  getCampaignMatchJob,
  getLinkedInImport,
  getCopilotThread,
  getTenantAdminDetail,
  getCandidatePortalProfile,
  getCandidatePortalResumeUpload,
  getCandidatePortalResumeVersion,
  candidateResumeVersionHtmlPath,
  candidateResumeVersionPdfPath,
  getCandidate,
  getRequirementMatches,
  listRequirementMatchRuns,
  compareLatestRequirementMatchRuns,
  finalizeRequirement,
  finalizeCandidateGoogleOAuth,
  setWorkspaceAccess,
  getParseBatch,
  getWorkerStatus,
  inviteTeamMember,
  importLinkedInCandidate,
  listCandidates,
  listCandidatePortalAccessRequests,
  listCandidatePortalApplications,
  listCandidatePortalResumeVersions,
  listCandidatePortalResumeUploads,
  listCandidatePortalResumeShares,
  listCandidateAiLearningEvents,
  listCampaigns,
  listCopilotThreads,
  listAuditLogs,
  listCandidateVersionClusters,
  listOperationalAlertDeliveries,
  listOperationalAlerts,
  listPiiAccessEvents,
  listCandidateMaintenanceJobs,
  listMailMessages,
  listParseDeadLetters,
  listParseBatches,
  listRequirements,
  listTenants,
  me,
  matchRequirement,
  matchCampaign,
  markCandidateReviewSignal,
  previewCandidatePortalResume,
  reactivateTenant,
  rejectMatch,
  resendInvitation,
  resolveParseDeadLetter,
  revokeCandidatePortalResumeShare,
  retryCandidatePortalResumeUpload,
  retryCandidateMaintenanceJob,
  retryMailMessage,
  retryParseJob,
  reparseCandidate,
  searchCandidates,
  shortlistMatch,
  matchCandidatePortalRequirement,
  suggestCandidateAiEdit,
  updateMemberRole,
  updateNote,
  updateCandidatePortalProfile,
  updateCandidatePortalApplication,
  updateCandidatePortalPrivacySettings,
  updateCandidatePortalResumeVersion,
  uploadRequirement,
  uploadResume,
  uploadCampaignResumes,
  updateCampaignCandidateStatus,
  updateCampaign,
  updateCandidateProfile,
  updateCampaignScorecard,
  updateGovernancePolicy,
  uploadCampaignRequirement,
  uploadCandidatePortalResume,
  deleteNote,
  disableTenant,
  disableMember,
  COOKIE_SESSION_TOKEN,
} from "../lib/api";
import { authClient, signInCandidateWithGoogle, signInWithBetterAuth } from "../lib/auth-client";
import { BrandMark } from "./components/brand";
import { CandidateVisibilityPanel } from "./components/candidate-coach-panels";
import { CandidateHomeCommandCenter } from "./components/candidate-home-command-center";
import { CandidatePreParsePreview } from "./components/candidate-pre-parse-preview";
import { candidateStarterResumeProfile } from "./components/candidate-resume-document-editor";
import { CandidateAtsConfidencePanel, CandidateCvPreview, CandidateTemplateSelector, CandidateVersionDiffPanel } from "./components/candidate-resume-export-panels";
import { CandidateAccessRequestsPanel, CandidateApplicationTracker, CandidateSharePanel } from "./components/candidate-sharing-panels";
import { CandidatePracticalJobBoard } from "./components/candidate-job-board";
import { CandidateUploadList } from "./components/candidate-upload-list";
import { CandidateVersionDatabase } from "./components/candidate-version-database";
import { CandidateScratchEditorOverlay, CandidateVersionEditorOverlay } from "./components/candidate-version-editor-overlay";
import { CandidateVersionReview } from "./components/candidate-version-review";
import { CandidateDetail } from "./components/candidate-detail";
import { CampaignsView } from "./components/campaigns-view";
import { DatabaseView } from "./components/database-view";
import { Dashboard } from "./components/recruiter-dashboard";
import { RecruiterCopilot } from "./components/recruiter-copilot";
import { AdminSettings } from "./components/admin-settings";
import { OperationsView } from "./components/operations-view";
import { TeamSettings } from "./components/team-settings";
import { UploadResumeView } from "./components/upload-resume-view";
import { AccessDeniedPanel, AdminShellTopBar, EnvironmentBanner, WorkspaceTopNav } from "./components/workspace-shell";
import { ProgressBar } from "./components/primitives";
import { MatchResults, RequirementIntake } from "./components/requirement-matching";
import { mergeCampaignCandidateUpdate } from "./lib/campaign-workflow";
import {
  candidatePortalCompleteness,
  candidatePortalSectionCopy,
  candidatePortalSectionFromSearch,
  candidateUploadPreviewKind,
  type CandidatePortalSection,
} from "./lib/candidate-portal";
import {
  type CandidateReviewSignal,
} from "./lib/candidate-database";
import {
  COPILOT_GREETING,
  copilotThreadMessages,
  type WorkspaceChatMessage,
} from "./lib/copilot";
import { candidateProfileHasContent, candidateResumeFromProfile } from "./lib/candidate-resume-profile";
import { domainLabel, humanizeLabel } from "./lib/format";
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FORMAT_LABEL, resolveLoginIdentifier } from "./lib/login";
import { parseWorkspaceRoute, routeHasDeepLink, type CampaignDetailTab, type CandidateDetailTab, type View, type WorkspaceRoute } from "./lib/workspace-route";
import { isCandidateUser, isPlatformAdmin, isTenantAdmin } from "./lib/user-roles";

function workspaceRouteIdentity(route: WorkspaceRoute) {
  const view = route.view ?? (route.candidateId ? "candidate" : route.campaignId ? "campaigns" : route.threadId ? "copilot" : route.requirementId ? "requirement" : "dashboard");
  return [
    view,
    route.candidateId ?? "",
    route.campaignId ?? "",
    route.threadId ?? "",
    route.requirementId ?? "",
  ].join("|");
}

type HomeAppProps = {
  initialLoginMode?: "company" | "admin" | "candidate";
  lockedLoginMode?: boolean;
  showPublicHome?: boolean;
};

const DEPLOY_ENV = (process.env.NEXT_PUBLIC_DEPLOY_ENV ?? "production").toLowerCase();
const IS_STAGING_ENV = DEPLOY_ENV === "staging";
function GoogleMark() {
  return (
    <svg className="googleMark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-.9 2.3-2 3v2.3h3.2c1.9-1.7 3.1-4.2 3.1-7z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.3c-.9.6-2 .9-3.5.9-2.7 0-4.9-1.8-5.7-4.2H3v2.4C4.7 19.7 8.1 22 12 22z" />
      <path fill="#FBBC05" d="M6.3 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.7H3C2.4 9 2 10.5 2 12s.4 3 1 4.3l3.3-2.4z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2 8.1 2 4.7 4.3 3 7.7l3.3 2.4C7.1 7.7 9.3 5.9 12 5.9z" />
    </svg>
  );
}

export default function Home() {
  return <HomeApp showPublicHome />;
}

export function HomeApp({ initialLoginMode, lockedLoginMode = false, showPublicHome = false }: HomeAppProps = {}) {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [workspaceMode, setWorkspaceMode] = useState<"admin" | "tenant" | "candidate">("admin");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateDetailTab, setCandidateDetailTab] = useState<CandidateDetailTab>("overview");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [matches, setMatches] = useState<RequirementMatch[]>([]);
  const [matchRuns, setMatchRuns] = useState<RequirementMatchRun[]>([]);
  const [matchRunChanges, setMatchRunChanges] = useState<RequirementMatchRunChange[]>([]);
  const [campaigns, setCampaigns] = useState<JobCampaign[]>([]);
  const [campaign, setCampaign] = useState<JobCampaign | null>(null);
  const [campaignLoadingId, setCampaignLoadingId] = useState("");
  const [campaignDetailTab, setCampaignDetailTab] = useState<CampaignDetailTab>("pipeline");
  const [campaignPipelineStage, setCampaignPipelineStage] = useState<CampaignPipelineStatus>("recommended");
  const [campaignSelectedCandidateId, setCampaignSelectedCandidateId] = useState("");
  const [clusters, setClusters] = useState<CandidateVersionMatch[]>([]);
  const [parseBatches, setParseBatches] = useState<ParseBatch[]>([]);
  const [parseDeadLetters, setParseDeadLetters] = useState<ParseDeadLetter[]>([]);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);
  const [operationalAlertDeliveries, setOperationalAlertDeliveries] = useState<OperationalAlertDelivery[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<CandidateMaintenanceJob[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ParseBatch | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantDetail, setTenantDetail] = useState<TenantAdminDetail | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TenantInvitation[]>([]);
  const [mailMessages, setMailMessages] = useState<MailMessage[]>([]);
  const [governancePolicy, setGovernancePolicy] = useState<GovernancePolicy | null>(null);
  const [piiAccessEvents, setPiiAccessEvents] = useState<PiiAccessEvent[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState("");
  const [bulkContextNote, setBulkContextNote] = useState("");
  const [bulkCampaignId, setBulkCampaignId] = useState("workspace");
  const [linkedinImportUrl, setLinkedinImportUrl] = useState("");
  const [linkedinImportCampaignId, setLinkedinImportCampaignId] = useState("workspace");
  const [linkedinImportJob, setLinkedinImportJob] = useState<LinkedInImportJob | null>(null);
  const [requirementFile, setRequirementFile] = useState<File | null>(null);
  const [requirementText, setRequirementText] = useState("");
  const [campaignName, setCampaignName] = useState("New job campaign");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignFiles, setCampaignFiles] = useState<File[]>([]);
  const [noteName, setNoteName] = useState("Recruiter Notes");
  const [note, setNote] = useState("");
  const [noteSaveState, setNoteSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteSaveError, setNoteSaveError] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState("");
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CandidateSummary[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotResultLimit, setCopilotResultLimit] = useState(10);
  const [copilotCampaignId, setCopilotCampaignId] = useState("");
  const [copilotThreads, setCopilotThreads] = useState<CopilotThread[]>([]);
  const [copilotThread, setCopilotThread] = useState<CopilotThread | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<WorkspaceChatMessage[]>([COPILOT_GREETING]);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteMode, setInviteMode] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [signupOwnerName, setSignupOwnerName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [candidateSignupMode, setCandidateSignupMode] = useState(false);
  const [candidateSignupName, setCandidateSignupName] = useState("");
  const [candidateSignupEmail, setCandidateSignupEmail] = useState("");
  const [candidateSignupPassword, setCandidateSignupPassword] = useState("");
  const [candidatePortalProfile, setCandidatePortalProfile] = useState<CandidatePortalProfile | null>(null);
  const [candidateResumeVersions, setCandidateResumeVersions] = useState<CandidateResumeVersion[]>([]);
  const [candidateResumeUploads, setCandidateResumeUploads] = useState<CandidateResumeUpload[]>([]);
  const [candidateResumeShares, setCandidateResumeShares] = useState<CandidateResumeShare[]>([]);
  const [candidateApplications, setCandidateApplications] = useState<CandidateApplication[]>([]);
  const [candidateAccessRequests, setCandidateAccessRequests] = useState<CandidateAccessRequest[]>([]);
  const [candidateAiLearningEvents, setCandidateAiLearningEvents] = useState<CandidateAiLearningEvent[]>([]);
  const [loginMode, setLoginMode] = useState<"company" | "admin" | "candidate">(initialLoginMode ?? "company");
  const [applicantLoginSelected, setApplicantLoginSelected] = useState(false);
  const [loginError, setLoginError] = useState("");
  const initialRouteAppliedRef = useRef(false);
  const routeApplyingRef = useRef(false);
  const lastRouteIdentityRef = useRef("");
  const lastRouteSearchRef = useRef("");
  const campaignLoadSeqRef = useRef(0);
  const selectedCampaignIdRef = useRef("");
  const publicAuthPanelRef = useRef<HTMLElement | null>(null);
  const signupCompanyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    selectedCampaignIdRef.current = campaign?.id ?? "";
  }, [campaign?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const login = params.get("login");
    const candidateOauth = params.get("candidate_oauth");
    const candidateOauthError = params.get("candidate_oauth_error");
    if (!lockedLoginMode && (login === "company" || login === "candidate")) setLoginMode(login);
    if (candidateOauthError) {
      setLoginMode("candidate");
      setApplicantLoginSelected(true);
      setLoginError(params.get("error_description") || params.get("error") || "Google login failed. Try again.");
      setStatus("Google login failed");
      window.history.replaceState(null, "", "/?login=candidate");
      return;
    }
    if (candidateOauth === "1") {
      setLoginMode("candidate");
      setApplicantLoginSelected(true);
      void handleCandidateGoogleReturn(params.get("new") === "1");
      return;
    }
    if (invite) {
      setInviteToken(invite);
      setInviteMode(true);
      setSignupMode(false);
      setApplicantLoginSelected(false);
    }
    void refresh(COOKIE_SESSION_TOKEN, workspaceMode)
      .then(() => setToken(COOKIE_SESSION_TOKEN))
      .catch(() => undefined);
    // Bootstrap must only run once; adding refresh would re-run login recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!campaigns.length) {
      if (copilotCampaignId) setCopilotCampaignId("");
      return;
    }
    if (!copilotCampaignId || !campaigns.some((item) => item.id === copilotCampaignId)) {
      setCopilotCampaignId(campaigns[0].id);
    }
  }, [campaigns, copilotCampaignId]);

  useEffect(() => {
    setNoteSaveState("idle");
    setNoteSaveError("");
    setDeletingNoteId("");
  }, [candidate?.document_id]);

  useEffect(() => {
    if (!token || !currentUser || initialRouteAppliedRef.current) return;
    initialRouteAppliedRef.current = true;
    const route = parseWorkspaceRoute(window.location.search);
    lastRouteIdentityRef.current = workspaceRouteIdentity(route);
    lastRouteSearchRef.current = window.location.search;
    if (routeHasDeepLink(route)) void applyWorkspaceRoute(route);
    // Deep-link hydration is intentionally one-shot after auth is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id]);

  useEffect(() => {
    if (!token || !currentUser) return;
    const handlePopState = () => {
      const route = parseWorkspaceRoute(window.location.search);
      lastRouteIdentityRef.current = workspaceRouteIdentity(route);
      lastRouteSearchRef.current = window.location.search;
      void applyWorkspaceRoute(route);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // Popstate should bind to the authenticated workspace identity, not every render of route helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id, requirements]);

  useEffect(() => {
    if (!token || !currentUser?.id || routeApplyingRef.current) return;
    const params = new URLSearchParams();
    params.set("view", view);
    if (view === "candidate" && candidate?.document_id) {
      params.set("candidate", candidate.document_id);
      params.set("candidateTab", candidateDetailTab);
    }
    if (view === "campaigns" && campaign?.id) {
      params.set("campaign", campaign.id);
      params.set("campaignTab", campaignDetailTab);
      params.set("campaignStage", campaignPipelineStage);
      if (campaignSelectedCandidateId) params.set("campaignCandidate", campaignSelectedCandidateId);
    }
    if (view === "copilot" && copilotThread?.id) params.set("thread", copilotThread.id);
    if ((view === "requirement" || view === "matches") && requirement?.id) params.set("requirement", requirement.id);
    const nextSearch = `?${params.toString()}`;
    const nextRoute = parseWorkspaceRoute(nextSearch);
    const nextIdentity = workspaceRouteIdentity(nextRoute);
    if (window.location.search !== nextSearch) {
      const currentRoute = parseWorkspaceRoute(window.location.search);
      const currentIdentity = workspaceRouteIdentity(currentRoute);
      const shouldPush = routeHasDeepLink(currentRoute) && currentIdentity !== nextIdentity;
      const historyMethod = shouldPush ? "pushState" : "replaceState";
      if (historyMethod === "pushState") {
        window.history.pushState(null, "", `${window.location.pathname}${nextSearch}`);
      } else {
        window.history.replaceState(null, "", `${window.location.pathname}${nextSearch}`);
      }
    }
    lastRouteIdentityRef.current = nextIdentity;
    lastRouteSearchRef.current = nextSearch;
  }, [
    token,
    currentUser?.id,
    view,
    candidate?.document_id,
    candidateDetailTab,
    campaign?.id,
    campaignDetailTab,
    campaignPipelineStage,
    campaignSelectedCandidateId,
    copilotThread?.id,
    requirement?.id,
  ]);

  useEffect(() => {
    if (!token || !copilotCampaignId || view !== "copilot") return;
    if (campaign?.id === copilotCampaignId && Array.isArray(campaign.candidates)) return;
    if (!campaigns.some((item) => item.id === copilotCampaignId)) return;
    void handleSelectCopilotCampaign(copilotCampaignId);
    // Campaign selection fetch is guarded by ids/status; including the handler would cause redundant reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.candidates, campaign?.id, campaigns, copilotCampaignId, token, view]);

  async function refresh(activeToken = token, nextWorkspaceMode = workspaceMode) {
    if (!activeToken) return;
    const meResult = await me(activeToken) as { user: CurrentUser };
    const user = meResult.user;
    const isPlatform = isPlatformAdmin(user);
    const isCandidate = isCandidateUser(user);
    if (lockedLoginMode && initialLoginMode === "company" && isPlatform) {
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("tenant");
      setView("dashboard");
      setStatus("Platform admin session found. Open /admin.");
      return;
    }
    if (lockedLoginMode && initialLoginMode === "admin" && !isPlatform) {
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("admin");
      setView("admin");
      setStatus("Recruiter session found. Use Recruiter Login.");
      return;
    }
    if (lockedLoginMode && initialLoginMode !== "candidate" && isCandidate) {
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("tenant");
      setView("dashboard");
      setStatus("Candidate session found. Use Candidate Access.");
      return;
    }
    setCurrentUser(user);
    if (isCandidate) {
      setWorkspaceMode("candidate");
      const [profileResult, versionResult, uploadResult, shareResult, applicationResult, accessResult, aiLearningResult] = await Promise.all([
        getCandidatePortalProfile(activeToken),
        listCandidatePortalResumeVersions(activeToken),
        listCandidatePortalResumeUploads(activeToken),
        listCandidatePortalResumeShares(activeToken),
        listCandidatePortalApplications(activeToken),
        listCandidatePortalAccessRequests(activeToken),
        listCandidateAiLearningEvents(activeToken),
      ]);
      setCandidatePortalProfile(profileResult);
      setCandidateResumeVersions(versionResult.versions ?? []);
      setCandidateResumeUploads(uploadResult.uploads ?? []);
      setCandidateResumeShares(shareResult.shares ?? []);
      setCandidateApplications(applicationResult.applications ?? []);
      setCandidateAccessRequests(accessResult.access_requests ?? []);
      setCandidateAiLearningEvents(aiLearningResult.events ?? []);
      setCandidates([]);
      setRequirements([]);
      setCampaigns([]);
      setCampaign(null);
      setClusters([]);
      setParseBatches([]);
      setParseDeadLetters([]);
      setOperationalAlerts([]);
      setOperationalAlertDeliveries([]);
      setMaintenanceJobs([]);
      setWorkerStatus(null);
      setPiiAccessEvents([]);
      setSearchResults([]);
      setCopilotThreads([]);
      setCopilotThread(null);
      setCopilotMessages([COPILOT_GREETING]);
      setMatches([]);
      setMatchRuns([]);
      setMatchRunChanges([]);
      setTeamMembers([]);
      setTeamInvites([]);
      setGovernancePolicy(null);
      return;
    }
    if (isPlatform) {
      setWorkspaceMode("admin");
      const [tenantResult, auditResult] = await Promise.all([
        listTenants(activeToken),
        listAuditLogs(activeToken, { limit: 50 }),
      ]);
      setTenants(tenantResult.tenants);
      setAuditEvents(auditResult.audit_events ?? []);
      if (nextWorkspaceMode === "admin") setView("admin");
    } else {
      setWorkspaceMode("tenant");
    }
    if (!user.tenant_id) {
      setCandidates([]);
      setRequirements([]);
      setCampaigns([]);
      setCampaign(null);
      setCampaignLoadingId("");
      setClusters([]);
      setParseBatches([]);
      setParseDeadLetters([]);
      setOperationalAlerts([]);
      setOperationalAlertDeliveries([]);
      setMaintenanceJobs([]);
      setWorkerStatus(null);
      setPiiAccessEvents([]);
      setSearchResults([]);
      setCopilotThreads([]);
      setCopilotThread(null);
      setCopilotMessages([COPILOT_GREETING]);
      setMatches([]);
      setMatchRuns([]);
      setMatchRunChanges([]);
      setTeamMembers([]);
      setTeamInvites([]);
      setGovernancePolicy(null);
      return;
    }
    const tenantAdmin = isTenantAdmin(user);
    const [candidateResult, requirementResult, campaignResult, clusterResult, batchResult, teamResult, copilotThreadResult] = await Promise.all([
      listCandidates(activeToken),
      listRequirements(activeToken),
      listCampaigns(activeToken),
      listCandidateVersionClusters(activeToken),
      listParseBatches(activeToken),
      getTeam(activeToken),
      listCopilotThreads(activeToken),
    ]);
    setCandidates(candidateResult.candidates);
    setRequirements(requirementResult.requirements);
    setCampaigns(campaignResult.campaigns);
    setClusters(clusterResult.clusters);
    setParseBatches(batchResult.batches);
    setTeamMembers(teamResult.members);
    setTeamInvites(teamResult.invitations);
    setGovernancePolicy(teamResult.governance_policy);
    setPiiAccessEvents(teamResult.pii_access_events ?? []);
    setCopilotThreads(copilotThreadResult.threads);
    if (tenantAdmin) {
      const [workerResult, deadLetterResult, alertResult, alertDeliveryResult, maintenanceResult, mailResult] = await Promise.all([
        getWorkerStatus(activeToken),
        listParseDeadLetters(activeToken),
        listOperationalAlerts(activeToken),
        listOperationalAlertDeliveries(activeToken),
        listCandidateMaintenanceJobs(activeToken),
        listMailMessages(activeToken, 50),
      ]);
      setWorkerStatus(workerResult);
      setParseDeadLetters(deadLetterResult.dead_letters);
      setOperationalAlerts(alertResult.alerts);
      setOperationalAlertDeliveries(alertDeliveryResult.deliveries);
      setMaintenanceJobs(maintenanceResult.jobs);
      setMailMessages(mailResult.mail_messages);
    } else {
      setWorkerStatus(null);
      setParseDeadLetters([]);
      setOperationalAlerts([]);
      setOperationalAlertDeliveries([]);
      setMaintenanceJobs([]);
      setMailMessages([]);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!token || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchCandidates(token, trimmed)
        .then((result) => setSearchResults(result.results ?? []))
        .catch(() => setSearchResults([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  const tenantAdminPollingEnabled = isTenantAdmin(currentUser);
  const selectedBatchActive = Boolean(selectedBatch?.status && isActiveBatchStatus(selectedBatch.status));
  const selectedBatchId = selectedBatch?.id ?? "";

  useEffect(() => {
    if (!token) return;
    const hasActiveBatch = parseBatches.some(isActiveBatch) || selectedBatchActive;
    const hasActiveMaintenanceJob = maintenanceJobs.some(isActiveMaintenanceJob);
    if (!hasActiveBatch && !hasActiveMaintenanceJob) return;
    const timer = window.setInterval(() => {
      listParseBatches(token)
        .then((result) => setParseBatches(result.batches))
        .catch(() => undefined);
      if (tenantAdminPollingEnabled) {
        getWorkerStatus(token)
          .then((result) => setWorkerStatus(result))
          .catch(() => undefined);
        listParseDeadLetters(token)
          .then((result) => setParseDeadLetters(result.dead_letters))
          .catch(() => undefined);
        listCandidateMaintenanceJobs(token)
          .then((result) => setMaintenanceJobs(result.jobs))
          .catch(() => undefined);
      }
      if (selectedBatchId) {
        getParseBatch(token, selectedBatchId)
          .then((batch) => setSelectedBatch(batch))
          .catch(() => undefined);
      }
      listCandidates(token)
        .then((result) => setCandidates(result.candidates))
        .catch(() => undefined);
      listCampaigns(token)
        .then((result) => setCampaigns(result.campaigns))
        .catch(() => undefined);
      if (candidate?.document_id) {
        getCandidate(token, candidate.document_id)
          .then((result) => setCandidate(result))
          .catch(() => undefined);
      }
      if (campaign?.id) {
        const pollingCampaignId = campaign.id;
        getCampaign(token, pollingCampaignId)
          .then((result) => {
            if (selectedCampaignIdRef.current === pollingCampaignId) setCampaign(result);
          })
          .catch(() => undefined);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [token, tenantAdminPollingEnabled, parseBatches, selectedBatchActive, selectedBatchId, maintenanceJobs, candidate?.document_id, campaign?.id]);

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(true);
    setStatus(label);
    try {
      const result = await fn();
      setStatus("Done");
      return result;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function applyWorkspaceRoute(route: WorkspaceRoute) {
    if (!token) return;
    routeApplyingRef.current = true;
    try {
      if (route.candidateId) {
        const result = await getCandidate(token, route.candidateId);
        setCandidate(result);
        setCandidateDetailTab(route.candidateTab ?? "overview");
        setView("candidate");
        return;
      }
      if (route.campaignId) {
        const result = await getCampaign(token, route.campaignId);
        setCampaign(result);
        setCampaigns((items) => items.some((item) => item.id === result.id) ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
        setCampaignDetailTab(route.campaignTab ?? "pipeline");
        setCampaignPipelineStage(route.campaignStage ?? "recommended");
        setCampaignSelectedCandidateId(route.campaignCandidateId ?? "");
        setView("campaigns");
        return;
      }
      if (route.threadId) {
        const result = await getCopilotThread(token, route.threadId);
        setCopilotThread(result.thread);
        setCopilotMessages(copilotThreadMessages(result.thread));
        setCopilotThreads((items) => items.some((item) => item.id === result.thread.id) ? items.map((item) => item.id === result.thread.id ? result.thread : item) : [result.thread, ...items]);
        setView("copilot");
        return;
      }
      if (route.requirementId) {
        const requirementResult = await listRequirements(token);
        setRequirements(requirementResult.requirements);
        const selected = requirementResult.requirements.find((item) => item.id === route.requirementId);
        if (selected) {
          setRequirement(selected);
          setClarifyAnswers(selected.recruiter_answers ?? {});
          setView(route.view === "matches" ? "matches" : "requirement");
          return;
        }
      }
      setView(route.view ?? (currentUser && isPlatformAdmin(currentUser) ? "admin" : "dashboard"));
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      window.setTimeout(() => {
        routeApplyingRef.current = false;
      }, 0);
    }
  }

  async function handleLogin() {
    setBusy(true);
    setStatus("Signing in with Better Auth...");
    setLoginError("");
    try {
      const loginEmail = resolveLoginIdentifier(email, loginMode);
      const result = await signInWithBetterAuth(loginEmail, password);
      const nextToken = result.token || COOKIE_SESSION_TOKEN;
      if (loginMode === "company") {
        await setWorkspaceAccess(nextToken, "tenant_member");
      } else if (loginMode === "candidate") {
        await setWorkspaceAccess(nextToken, "candidate");
      } else if (loginMode === "admin") {
        await setWorkspaceAccess(nextToken, "platform_admin");
      }
      const current = await me(nextToken) as { user: CurrentUser };
      const platform = isPlatformAdmin(current.user);
      const candidateAccount = isCandidateUser(current.user);
      if (loginMode === "admin" && !platform) {
        throw new Error("This account does not have platform admin access.");
      }
      if (loginMode === "company" && platform) {
        throw new Error("This account is a platform admin. Open /admin to use the platform admin system.");
      }
      if (loginMode === "company" && candidateAccount) {
        throw new Error("This is a candidate account. Use Candidate Access.");
      }
      if (loginMode === "candidate" && !candidateAccount) {
        throw new Error("This account is not a candidate account. Use Recruiter Access.");
      }
      const session = { token: nextToken, user: current.user };
      setToken(session.token);
      setCurrentUser(session.user);
      setWorkspaceMode(platform ? "admin" : candidateAccount ? "candidate" : "tenant");
      setView(platform ? "admin" : "dashboard");
      setStatus("Login successful");
      await refresh(session.token, platform ? "admin" : candidateAccount ? "candidate" : "tenant");
    } catch (error) {
      const message = readableError(error);
      setToken("");
      setCurrentUser(null);
      setLoginError(message);
      setStatus("Login failed");
    } finally {
      setBusy(false);
    }
  }

  function openCompanySignupPanel() {
    setLoginMode("company");
    setInviteMode(false);
    setApplicantLoginSelected(false);
    setCandidateSignupMode(false);
    setSignupMode(true);
    setLoginError("");
    setStatus("Ready");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        publicAuthPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => signupCompanyInputRef.current?.focus({ preventScroll: true }), 250);
      });
    });
  }

  async function handleCompanySignup() {
    setBusy(true);
    setStatus("Creating recruiter workspace...");
    setLoginError("");
    try {
      const normalizedEmail = signupEmail.trim().toLowerCase();
      await companySignup(signupCompanyName, signupOwnerName, normalizedEmail, signupPassword);
      setStatus("Workspace created. Signing in...");
      const result = await signInWithBetterAuth(normalizedEmail, signupPassword);
      const nextToken = result.token || COOKIE_SESSION_TOKEN;
      const current = await me(nextToken) as { user: CurrentUser };
      if (isPlatformAdmin(current.user)) {
        throw new Error("Self-service signup created an invalid admin session.");
      }
      setToken(nextToken);
      setCurrentUser(current.user);
      setWorkspaceMode("tenant");
      setSignupMode(false);
      setView("dashboard");
      setStatus("Recruiter workspace created");
      await refresh(nextToken, "tenant");
    } catch (error) {
      const message = readableError(error);
      setToken("");
      setCurrentUser(null);
      setLoginError(message);
      setStatus("Signup failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCandidateSignup() {
    setBusy(true);
    setStatus("Creating candidate profile...");
    setLoginError("");
    try {
      const normalizedEmail = candidateSignupEmail.trim().toLowerCase();
      await candidateSignup(candidateSignupName, normalizedEmail, candidateSignupPassword);
      setStatus("Candidate profile created. Signing in...");
      const result = await signInWithBetterAuth(normalizedEmail, candidateSignupPassword);
      const nextToken = result.token || COOKIE_SESSION_TOKEN;
      const current = await me(nextToken) as { user: CurrentUser };
      if (!isCandidateUser(current.user)) {
        throw new Error("Candidate signup did not create a candidate account.");
      }
      setToken(nextToken);
      setCurrentUser(current.user);
      setWorkspaceMode("candidate");
      setCandidateSignupMode(false);
      setApplicantLoginSelected(false);
      setView("dashboard");
      setStatus("Candidate profile created");
      await refresh(nextToken, "candidate");
    } catch (error) {
      const message = readableError(error);
      setToken("");
      setCurrentUser(null);
      setLoginError(message);
      setStatus("Candidate signup failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCandidateGoogleSignIn() {
    setBusy(true);
    setStatus("Opening Google...");
    setLoginError("");
    try {
      await signInCandidateWithGoogle();
    } catch (error) {
      setLoginError(readableError(error));
      setStatus("Google login failed");
      setBusy(false);
    }
  }

  async function handleCandidateGoogleReturn(newUser: boolean) {
    setBusy(true);
    setStatus("Finishing Google login...");
    setLoginError("");
    try {
      await finalizeCandidateGoogleOAuth(COOKIE_SESSION_TOKEN, newUser);
      const current = await me(COOKIE_SESSION_TOKEN) as { user: CurrentUser };
      if (!isCandidateUser(current.user)) {
        throw new Error("This Google account is not a candidate account. Use Recruiter Access.");
      }
      setToken(COOKIE_SESSION_TOKEN);
      setCurrentUser(current.user);
      setWorkspaceMode("candidate");
      setCandidateSignupMode(false);
      setApplicantLoginSelected(false);
      setView("dashboard");
      setStatus("Candidate login successful");
      window.history.replaceState(null, "", "/?login=candidate");
      await refresh(COOKIE_SESSION_TOKEN, "candidate");
    } catch (error) {
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("candidate");
      setView("dashboard");
      setLoginMode("candidate");
      setApplicantLoginSelected(true);
      setLoginError(readableError(error));
      setStatus("Google login failed");
      window.history.replaceState(null, "", "/?login=candidate");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!inviteToken.trim() || !inviteName.trim() || !invitePassword.trim()) return;
    await run("Accepting invite", () => acceptInvitation(inviteToken, inviteName, invitePassword));
    setInviteMode(false);
    setSignupMode(false);
    setInviteToken("");
    setEmail("");
    setPassword("");
    setStatus("Invite accepted. Log in with the invited email and password.");
  }

  async function handleBootstrap() {
    await run("Creating admin", () => bootstrap(email, password));
    await handleLogin();
  }

  function handleLoginModeChange(mode: "company" | "admin" | "candidate") {
    if (lockedLoginMode) return;
    setLoginMode(mode);
    setApplicantLoginSelected(mode === "candidate");
    setSignupMode(false);
    setCandidateSignupMode(false);
    setInviteMode(false);
    setEmail("");
    setPassword("");
    setLoginError("");
    setStatus("Ready");
  }

  function handleLoginKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && email.trim() && password.trim() && !busy) {
      void handleLogin();
    }
  }

  function handleLogout() {
    void authClient.signOut().catch(() => undefined);
    initialRouteAppliedRef.current = false;
    routeApplyingRef.current = false;
    lastRouteIdentityRef.current = "";
    lastRouteSearchRef.current = "";
    window.history.replaceState(null, "", window.location.pathname);
    setToken("");
    setCurrentUser(null);
    setWorkspaceMode("admin");
    setCandidate(null);
    setCandidatePortalProfile(null);
    setCandidateResumeVersions([]);
    setCandidateResumeUploads([]);
    setCandidateResumeShares([]);
    setCandidateApplications([]);
    setCandidateAccessRequests([]);
    setCandidateSignupMode(false);
    setRequirement(null);
    setCampaign(null);
    setMatches([]);
    setCopilotThreads([]);
    setCopilotThread(null);
    setCopilotMessages([COPILOT_GREETING]);
    setStatus("Logged out");
  }

  async function handleUploadResume() {
    if (!resumeFile || !token) return;
    const result = await run("Parsing resume and saving candidate", () => uploadResume(resumeFile, noteName, note, token));
    if (!result) return;
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    setSelectedBatch(result.batch);
    setNote("");
    setStatus("Resume queued for deep parsing. Start the worker to process it.");
    setView("upload");
    await refresh();
  }

  async function handleBulkUpload() {
    if (!bulkFiles.length || !token) return;
    const selectedCampaign = campaigns.find((item) => item.id === bulkCampaignId);
    const generatedName = autoBatchNameForFiles(bulkFiles, selectedCampaign?.name);
    const effectiveBatchName = batchName.trim() || bulkContextNote.trim() || generatedName;
    if (bulkCampaignId !== "workspace") {
      const result = await run("Queueing campaign resumes", () => uploadCampaignResumes(token, bulkCampaignId, bulkFiles, bulkContextNote, effectiveBatchName));
      if (!result) return;
      setBulkFiles([]);
      setBulkContextNote("");
      setBatchName("");
      setCampaign(result.campaign);
      setCampaigns((items) => [result.campaign, ...items.filter((item) => item.id !== result.campaign.id)]);
      setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
      setSelectedBatch(result.batch);
      await refresh();
      return;
    }
    const result = await run("Creating parse batch", () => bulkUploadResumes(bulkFiles, effectiveBatchName, token, false, bulkContextNote));
    if (!result) return;
    setBulkFiles([]);
    setBulkContextNote("");
    setBatchName("");
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    setSelectedBatch(result.batch);
    await refresh();
  }

  async function handleLinkedInImport() {
    if (!token || !linkedinImportUrl.trim()) return;
    const campaignId = linkedinImportCampaignId === "workspace" ? undefined : linkedinImportCampaignId;
    const result = await run("Importing LinkedIn profile", () => importLinkedInCandidate(
      token,
      linkedinImportUrl.trim(),
      campaignId,
      noteName.trim() || "Recruiter Notes",
      note.trim()
    ));
    if (!result) return;
    setLinkedinImportJob(result.import);
    setStatus("LinkedIn profile import started.");
    const completed = await pollLinkedInImport(result.import.id);
    if (completed?.status === "succeeded" && completed.document_id) {
      setLinkedinImportUrl("");
      await refresh();
      await handleOpenCandidate(completed.document_id);
    } else if (completed?.status === "failed") {
      setStatus(completed.error_message || "LinkedIn import failed");
    }
  }

  async function pollLinkedInImport(importId: string) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await delay(1500);
      const result = await getLinkedInImport(token, importId);
      setLinkedinImportJob(result.import);
      if (["succeeded", "failed"].includes(result.import.status)) return result.import;
    }
    return null;
  }

  async function handleSelectBatch(batch: ParseBatch) {
    const full = await run("Loading batch", () => getParseBatch(token, batch.id));
    if (!full) return;
    setSelectedBatch(full);
  }

  async function handleRetryJob(jobId: string) {
    await run("Retrying job", () => retryParseJob(token, jobId));
    if (selectedBatch) await handleSelectBatch(selectedBatch);
    await refresh();
  }

  async function handleCancelJob(jobId: string) {
    if (!window.confirm("Cancel this parse job? Running work may stop and the file will remain available for retry.")) return;
    await run("Cancelling job", () => cancelParseJob(token, jobId));
    if (selectedBatch) await handleSelectBatch(selectedBatch);
    await refresh();
  }

  async function handleCancelBatch(batchId: string) {
    if (!window.confirm("Cancel all cancellable jobs in this batch? Completed jobs and files are preserved.")) return;
    const updated = await run("Cancelling batch", () => cancelParseBatch(token, batchId));
    if (!updated) return;
    setSelectedBatch(updated);
    await refresh();
  }

  async function handleReparseCandidate(documentId: string) {
    if (!token) return;
    if (!window.confirm("Queue a full deep reparse from the stored original CV? This will re-read the resume and update the candidate profile.")) return;
    const result = await run("Queueing full candidate reparse", () => reparseCandidate(token, documentId, true));
    if (!result) return;
    setSelectedBatch(result.batch);
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    await refresh();
  }

  async function handleOpenCandidate(id: string, tab: CandidateDetailTab = "overview") {
    const result = await run("Loading candidate", () => getCandidate(token, id));
    if (!result) return;
    setCandidate(result);
    setCandidateDetailTab(tab);
    setView("candidate");
  }

  async function handleDeleteCandidate(documentId: string) {
    if (!token) return;
    if (!window.confirm("Archive this upload from the active candidate database? The stored file, notes, versions, and audit history are preserved, but this profile will no longer appear in search or campaigns.")) return;
    await run("Archiving candidate from active database", () => deleteCandidate(token, documentId, "removed_bad_or_wrong_upload"));
    setCandidate(null);
    setView("database");
    await refresh();
  }

  async function handleSendCopilotMessage(messageOverride?: string, limitOverride?: number) {
    const message = (messageOverride ?? copilotInput).trim();
    if (!message || !token) return;
    const isShowMoreRequest = Boolean(messageOverride && limitOverride);
    const nextHistory: WorkspaceChatMessage[] = [
      ...copilotMessages,
      { role: "user", content: isShowMoreRequest ? `Show more results for: ${message}` : message },
    ];
    setCopilotMessages(nextHistory);
    if (!messageOverride) setCopilotInput("");
    try {
      const response = await run("Searching workspace with Copilot", () =>
        chatCopilot(
          token,
          message,
          nextHistory.map((item) => ({ role: item.role, content: item.content })),
          limitOverride ?? copilotResultLimit,
          copilotThread?.id
        )
      );
      if (!response) return;
      if (response.thread) {
        setCopilotThread(response.thread);
        setCopilotMessages(copilotThreadMessages(response.thread));
        setCopilotThreads((items) => [response.thread!, ...items.filter((item) => item.id !== response.thread!.id)]);
      } else {
        setCopilotMessages((items) => [
          ...items,
          {
            role: "assistant",
            query: message,
            content: response.answer,
            candidates: response.candidates,
            clarifying_questions: response.clarifying_questions,
            suggested_actions: response.suggested_actions,
            metadata: response.metadata ?? { query_intent: response.query_intent },
          },
        ]);
      }
    } catch {
      setCopilotMessages((items) => [
        ...items,
        { role: "assistant", content: "I could not complete that search. Check the API status and try again." },
      ]);
    }
  }

  function handleNewCopilotThread() {
    setCopilotThread(null);
    setCopilotMessages([COPILOT_GREETING]);
    setCopilotInput("");
    setView("copilot");
  }

  async function handleOpenCopilotThread(threadId: string) {
    if (!token) return;
    const result = await run("Loading Copilot thread", () => getCopilotThread(token, threadId));
    if (!result) return;
    setCopilotThread(result.thread);
    setCopilotMessages(copilotThreadMessages(result.thread));
    setView("copilot");
  }

  async function handleArchiveCopilotThread(threadId: string) {
    if (!token) return;
    await run("Archiving Copilot thread", () => archiveCopilotThread(token, threadId));
    setCopilotThreads((items) => items.filter((item) => item.id !== threadId));
    if (copilotThread?.id === threadId) handleNewCopilotThread();
  }

  async function handleCreateRequirementFromCopilotThread(threadId: string) {
    if (!token) return;
    const result = await run("Creating requirement draft from Copilot thread", () => createRequirementFromCopilotThread(token, threadId));
    if (!result) return;
    setRequirement(result.requirement);
    setClarifyAnswers({});
    setView("copilot");
    await refresh();
  }

  async function handleResolveDeadLetter(deadLetterId: string) {
    if (!token) return;
    if (!window.confirm("Mark this file review item as acknowledged? Use Retry if the file should be processed again.")) return;
    await run("Resolving file review item", () => resolveParseDeadLetter(token, deadLetterId));
    await refresh();
  }

  async function handleAcknowledgeOperationalAlert(alertId: string) {
    if (!token) return;
    await run("Acknowledging operational alert", () => acknowledgeOperationalAlert(token, alertId));
    await refresh();
  }

  async function handleRunCandidateMaintenance() {
    if (!token) return;
    if (!window.confirm("Refresh candidate intelligence for this company? This updates derived fields from already saved profile data and does not re-read resumes.")) return;
    const result = await run("Queueing candidate intelligence maintenance", () => createCandidateRederiveJob(token, false, true));
    if (result?.job) setMaintenanceJobs((items) => [result.job, ...items.filter((item) => item.id !== result.job.id)]);
    await refresh();
  }

  async function handleRetryCandidateMaintenance(jobId: string) {
    if (!token) return;
    const result = await run("Retrying candidate intelligence maintenance", () => retryCandidateMaintenanceJob(token, jobId));
    if (result?.job) setMaintenanceJobs((items) => [result.job, ...items.filter((item) => item.id !== result.job.id)]);
    await refresh();
  }

  async function handleCancelCandidateMaintenance(jobId: string) {
    if (!token) return;
    if (!window.confirm("Cancel this maintenance job? Candidate data already processed by the job will remain saved.")) return;
    const result = await run("Cancelling candidate intelligence maintenance", () => cancelCandidateMaintenanceJob(token, jobId));
    if (result?.job) setMaintenanceJobs((items) => [result.job, ...items.filter((item) => item.id !== result.job.id)]);
    await refresh();
  }

  async function handleAddNote() {
    if (!candidate || !token || !note.trim()) return;
    setNoteSaveState("saving");
    setNoteSaveError("");
    try {
      const result = await run("Saving recruiter note", () => addNote(candidate.document_id, noteName.trim() || "Recruiter Notes", note, token));
      if (!result) throw new Error("No candidate returned after saving note");
      setCandidate(result);
      setNote("");
      setNoteSaveState("saved");
      setStatus("Note saved. Search index will update in the background.");
    } catch (error) {
      setNoteSaveState("error");
      setNoteSaveError(readableError(error));
    }
  }

  async function handleUpdateNote(noteId: string, name: string, content: string) {
    if (!candidate) return;
    const result = await run("Updating note", () => updateNote(candidate.document_id, noteId, name, content, token));
    if (!result) return;
    setCandidate(result);
    setStatus("Note updated. Search index will update in the background.");
  }

  async function handleDeleteNote(noteId: string) {
    if (!candidate || !token || !noteId) return;
    const previousCandidate = candidate;
    setDeletingNoteId(noteId);
    setNoteSaveState("idle");
    setNoteSaveError("");
    setCandidate({ ...candidate, notes: (candidate.notes ?? []).filter((item) => item.id !== noteId) });
    try {
      const result = await run("Deleting recruiter note", () => deleteNote(candidate.document_id, noteId, token));
      if (!result) throw new Error("No candidate returned after deleting note");
      setCandidate(result);
      setStatus("Note deleted. Search index will update in the background.");
    } catch (error) {
      setCandidate(previousCandidate);
      setNoteSaveState("error");
      setNoteSaveError(`Could not delete note: ${readableError(error)}`);
    } finally {
      setDeletingNoteId("");
    }
  }

  async function handleUpdateCandidateProfile(payload: CandidateProfileUpdate) {
    if (!candidate || !token) return;
    const result = await run("Saving candidate corrections", () => updateCandidateProfile(token, candidate.document_id, payload));
    if (!result) return;
    setCandidate(result);
    await refresh();
  }

  async function handleMarkCandidateReviewSignal(documentId: string, signalKey: CandidateReviewSignal) {
    if (!token) return;
    const result = await run("Marking review item complete", () => markCandidateReviewSignal(token, documentId, signalKey));
    if (!result) return;
    setCandidates((items) => items.map((item) => (
      item.document_id === documentId
        ? { ...item, reviewed_signals: Array.from(new Set([...(item.reviewed_signals ?? []), signalKey])) }
        : item
    )));
    if (candidate?.document_id === documentId) {
      setCandidate({ ...candidate, reviewed_signals: Array.from(new Set([...(candidate.reviewed_signals ?? []), signalKey])) });
    }
    await refresh();
  }

  async function handleCreateRequirement() {
    const result = requirementFile
      ? await run("Reading requirement PDF", () => uploadRequirement(token, requirementFile))
      : await run("Extracting requirement", () => createRequirement(token, requirementText));
    if (!result) return;
    setRequirement(result);
    setClarifyAnswers({});
    setView("requirement");
    await refresh();
  }

  async function handleFinalizeRequirement() {
    if (!requirement) return;
    const finalized = await run("Finalizing requirement", () => finalizeRequirement(token, requirement.id, clarifyAnswers));
    if (!finalized) return;
    setRequirement(finalized);
    await refresh();
  }

  async function handleRunRequirementMatch() {
    if (!requirement) return;
    const ranked = await run("Finding matching candidates", () => matchRequirement(token, requirement.id));
    if (!ranked) return;
    setMatches(ranked.matches);
    const [runs, comparison] = await Promise.all([
      listRequirementMatchRuns(token, requirement.id),
      compareLatestRequirementMatchRuns(token, requirement.id),
    ]);
    setMatchRuns(runs.runs ?? []);
    setMatchRunChanges(comparison.changes ?? []);
    setView("matches");
  }

  async function handleCreateCampaign() {
    if (!campaignName.trim() || !token) return;
    const result = await run("Creating job campaign", () => createCampaign(token, campaignName, campaignDescription));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => [result, ...items.filter((item) => item.id !== result.id)]);
    setCampaignName("New job campaign");
    setCampaignDescription("");
    if (result.requirement_id) {
      await handleOpenCampaign(result.id);
      return;
    }
    setView("campaigns");
  }

  async function handleOpenCampaign(id: string, tab: CampaignDetailTab = "pipeline") {
    if (!id || !token) return;
    const requestSeq = campaignLoadSeqRef.current + 1;
    campaignLoadSeqRef.current = requestSeq;
    const summary = campaigns.find((item) => item.id === id);
    setCampaignLoadingId(id);
    setBusy(true);
    setStatus("Loading campaign");
    setCampaignDetailTab(tab);
    setCampaignSelectedCandidateId("");
    setView("campaigns");
    if (summary && campaign?.id !== id) {
      setCampaign(summary);
    }
    try {
      const result = await getCampaign(token, id);
      if (campaignLoadSeqRef.current !== requestSeq) return;
      setCampaign(result);
      setCampaigns((items) => items.some((item) => item.id === result.id) ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
      setStatus("Done");
    } catch (error) {
      if (campaignLoadSeqRef.current === requestSeq) setStatus(readableError(error));
    } finally {
      if (campaignLoadSeqRef.current === requestSeq) {
        setCampaignLoadingId("");
        setBusy(false);
      }
    }
  }

  async function handleUpdateCampaign(id: string, payload: { name?: string; description?: string; status?: string; requirement_id?: string | null; unlink_requirement?: boolean }) {
    if (!id || !token) return;
    const result = await run("Saving campaign", () => updateCampaign(token, id, payload));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleDeleteCampaign(id: string, confirmation: string) {
    if (!id || !token) return;
    if (confirmation !== "archive") {
      setStatus("Campaign archive cancelled. Type archive exactly to confirm.");
      return;
    }
    const result = await run("Archiving campaign", () => archiveCampaign(token, id, confirmation));
    if (!result?.deleted) return;
    const remaining = campaigns.filter((item) => item.id !== id);
    setCampaigns(remaining);
    if (campaign?.id === id) {
      setCampaign(null);
      setCampaignSelectedCandidateId("");
      if (remaining[0]?.id) {
        await handleOpenCampaign(remaining[0].id);
      }
    }
    setStatus("Campaign archived. It has been removed from the active workspace list.");
    await refresh();
  }

  async function handleCreateCampaignRequirement(id: string, text: string) {
    if (!id || !token || !text.trim()) return;
    const result = await run("Extracting campaign requirement", () => createCampaignRequirement(token, id, text));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleUploadCampaignRequirement(id: string, file: File) {
    if (!id || !token) return;
    const result = await run("Uploading campaign requirement", () => uploadCampaignRequirement(token, id, file));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleSaveCampaignScorecard(id: string, scorecard: CampaignScorecard) {
    if (!id || !token) return;
    const result = await run("Saving campaign scorecard", () => updateCampaignScorecard(token, id, scorecard));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleMatchCampaign(id = campaign?.id) {
    if (!id || !token) return;
    const result = await run("Finding campaign matches", () => matchCampaign(token, id));
    if (!result) return;
    if (result.campaign) {
      const nextCampaign = result.campaign;
      setCampaign(nextCampaign);
      setCampaigns((items) => items.map((item) => item.id === nextCampaign.id ? nextCampaign : item));
    }
    setStatus(`Campaign match queued (${domainLabel(result.job.status)}). Worker will update this campaign when complete.`);
    void pollCampaignMatchJob(id, result.job.id);
  }

  async function pollCampaignMatchJob(campaignId: string, jobId: string) {
    if (!token) return;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await delay(2000);
      try {
        const result = await getCampaignMatchJob(token, campaignId, jobId);
        if (result.campaign) {
          const nextCampaign = result.campaign;
          setCampaign(nextCampaign);
          setCampaigns((items) => items.map((item) => item.id === nextCampaign.id ? nextCampaign : item));
        }
        if (["succeeded", "failed", "cancelled"].includes(result.job.status)) {
          setStatus(result.job.status === "succeeded" ? "Campaign matching completed." : `Campaign matching ${result.job.status}: ${result.job.error_message || "No details"}`);
          return;
        }
        setStatus(`Campaign matching ${domainLabel(result.job.status)}: ${domainLabel(result.job.stage)}`);
      } catch (error) {
        setStatus(readableError(error));
        return;
      }
    }
    setStatus("Campaign matching is still running. You can leave this page and come back later.");
  }

  async function handleUploadCampaignResumes() {
    if (!campaign?.id || !campaignFiles.length || !token) return;
    const result = await run("Queueing campaign resumes", () => uploadCampaignResumes(token, campaign.id, campaignFiles, "Campaign-specific resume upload", autoBatchNameForFiles(campaignFiles, campaign.name)));
    if (!result) return;
    setCampaignFiles([]);
    setCampaign(result.campaign);
    setSelectedBatch(result.batch);
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    await refresh();
  }

  async function handleCampaignCandidateStatus(candidateId: string, status: CampaignPipelineStatus, note = "") {
    if (!campaign?.id || !token) return;
    const updated = await run("Updating campaign candidate", () => updateCampaignCandidateStatus(token, campaign.id, candidateId, status, note));
    if (!updated) return;
    setCampaign((current) => {
      if (!current) return current;
      return {
        ...current,
        candidates: (current.candidates ?? []).map((item) => item.candidate_id === candidateId ? mergeCampaignCandidateUpdate(item, updated) : item),
      };
    });
  }

  async function handleSelectCopilotCampaign(id: string) {
    setCopilotCampaignId(id);
    if (!id || !token || campaign?.id === id) return;
    const result = await run("Loading campaign shortlist", () => getCampaign(token, id));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleCopilotShortlist(candidateId: string) {
    if (!token) return;
    if (!copilotCampaignId) {
      setStatus("Select a campaign before shortlisting.");
      return;
    }
    const result = await run("Adding candidate to campaign shortlist", async () => {
      await updateCampaignCandidateStatus(token, copilotCampaignId, candidateId, "shortlisted");
      return getCampaign(token, copilotCampaignId);
    });
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.some((item) => item.id === result.id)
      ? items.map((item) => item.id === result.id ? result : item)
      : [result, ...items]);
    setStatus("Candidate added to campaign shortlist.");
  }

  async function handleSelectRequirement(item: Requirement) {
    setRequirement(item);
    setClarifyAnswers(item.recruiter_answers ?? {});
    if (item.status === "matched") {
      const [result, runs, comparison] = await run("Loading saved matches", () => Promise.all([
        getRequirementMatches(token, item.id),
        listRequirementMatchRuns(token, item.id),
        compareLatestRequirementMatchRuns(token, item.id),
      ])) ?? [];
      setMatches(result?.matches ?? []);
      setMatchRuns(runs?.runs ?? []);
      setMatchRunChanges(comparison?.changes ?? []);
      setView("matches");
      return;
    }
    setMatches([]);
    setMatchRuns([]);
    setMatchRunChanges([]);
    setView("requirement");
  }

  async function handleCandidateVersionDecision(matchId: string, decision: "versioned" | "separate" | "review-later") {
    if (decision !== "review-later" && !window.confirm(`Save candidate-version decision: ${decision}? This is non-destructive and keeps every uploaded resume copy.`)) return;
    await run("Saving decision", () => decideCandidateVersion(token, matchId, decision));
    const result = await listCandidateVersionClusters(token);
    setClusters(result.clusters);
  }

  async function handleOpenCandidateVersions() {
    const result = await run("Loading candidate versions", () => listCandidateVersionClusters(token));
    if (result) setClusters(result.clusters);
    setView("versions");
  }

  async function handleShortlist(candidateId: string) {
    if (!requirement) return;
    const updated = await run("Shortlisting candidate", () => shortlistMatch(token, requirement.id, candidateId));
    if (updated) setMatches((items) => items.map((item) => item.candidate_id === candidateId ? { ...item, ...updated, candidate: item.candidate } : item));
  }

  async function handleReject(candidateId: string) {
    if (!requirement) return;
    if (!window.confirm("Reject this candidate for the active requirement? You can still view the candidate record later.")) return;
    const updated = await run("Rejecting candidate", () => rejectMatch(token, requirement.id, candidateId));
    if (updated) setMatches((items) => items.map((item) => item.candidate_id === candidateId ? { ...item, ...updated, candidate: item.candidate } : item));
  }

  async function handleCreateTenant(name: string, seatLimit: number, ownerEmail: string, ownerRole: string) {
    const result = await run("Creating tenant", () => createTenant(token, name, seatLimit, ownerEmail, ownerRole));
    if (!result) return;
    setTenants((items) => [result.tenant, ...items.filter((item) => item.id !== result.tenant.id)]);
    if (result.owner_invitation) {
      setTeamInvites((items) => [result.owner_invitation!, ...items]);
      setStatus(`Company created. Owner invite token: ${result.owner_invitation.invite_token}`);
    }
  }

  async function handleTenantStatus(tenantId: string, status: "active" | "disabled") {
    if (!window.confirm(status === "disabled" ? "Disable this company tenant? Users should lose operational access until reactivated." : "Reactivate this company tenant?")) return;
    const result = await run(status === "disabled" ? "Disabling company" : "Reactivating company", () =>
      status === "disabled" ? disableTenant(token, tenantId) : reactivateTenant(token, tenantId)
    );
    if (!result) return;
    setTenants((items) => items.map((item) => item.id === tenantId ? result.tenant : item));
    if (tenantDetail?.tenant.id === tenantId) {
      const detail = await getTenantAdminDetail(token, tenantId);
      setTenantDetail(detail);
    }
  }

  async function handleSelectTenant(tenantId: string) {
    const detail = await run("Loading company detail", () => getTenantAdminDetail(token, tenantId));
    if (detail) setTenantDetail(detail);
  }

  async function handleInviteMember(email: string, role: string) {
    const invite = await run("Inviting member", () => inviteTeamMember(token, email, role));
    if (!invite) return;
    setTeamInvites((items) => [invite, ...items]);
  }

  async function handleResendInvite(invitationId: string) {
    const invite = await run("Resending invite", () => resendInvitation(token, invitationId));
    if (!invite) return;
    setTeamInvites((items) => [invite, ...items.filter((item) => item.id !== invitationId)]);
  }

  async function handleCancelInvite(invitationId: string) {
    if (!window.confirm("Cancel this pending invitation? The invite link will stop working.")) return;
    const invite = await run("Cancelling invite", () => cancelInvitation(token, invitationId));
    if (!invite) return;
    setTeamInvites((items) => items.map((item) => item.id === invite.id ? invite : item));
  }

  async function handleUpdateMemberRole(membershipId: string, role: string) {
    if (!window.confirm(`Change this member role to ${formatRole(role)}?`)) return;
    await run("Updating role", () => updateMemberRole(token, membershipId, role));
    const team = await getTeam(token);
    setTeamMembers(team.members);
    setGovernancePolicy(team.governance_policy);
    setPiiAccessEvents(team.pii_access_events ?? []);
  }

  async function handleDisableMember(membershipId: string) {
    if (!window.confirm("Disable this team member? They should lose access to this recruiter workspace.")) return;
    await run("Disabling member", () => disableMember(token, membershipId));
    const team = await getTeam(token);
    setTeamMembers(team.members);
    setGovernancePolicy(team.governance_policy);
    setPiiAccessEvents(team.pii_access_events ?? []);
  }

  async function handleUpdateGovernancePolicy(policy: Partial<GovernancePolicy>) {
    const result = await run("Updating governance policy", () => updateGovernancePolicy(token, policy));
    if (!result) return;
    setGovernancePolicy(result.governance_policy);
    await refresh();
  }

  async function handleRefreshPiiAudit() {
    const result = await run("Loading PII audit", () => listPiiAccessEvents(token, 100));
    if (result) setPiiAccessEvents(result.pii_access_events);
  }

  async function handleRefreshMailMessages() {
    const result = await run("Loading mail delivery log", () => listMailMessages(token, 50));
    if (result) setMailMessages(result.mail_messages);
  }

  async function handleRetryMailMessage(messageId: string) {
    const result = await run("Retrying mail delivery", () => retryMailMessage(token, messageId));
    if (!result) return;
    setMailMessages((items) => [result.mail_message, ...items.filter((item) => item.id !== messageId)]);
  }

  async function handleSaveCandidatePortalProfile(profile: CandidatePortalProfile["profile"]) {
    const result = await run("Saving candidate profile", () => updateCandidatePortalProfile(token, profile));
    if (result) setCandidatePortalProfile(result);
  }

  async function handleSaveCandidatePortalPrivacySettings(settings: CandidatePortalPrivacySettings) {
    const result = await run("Saving candidate visibility", () => updateCandidatePortalPrivacySettings(token, settings));
    if (result) setCandidatePortalProfile(result);
  }

  async function handleCreateCandidatePortalVersion(title: string, targetRole?: string, resumeJson?: Record<string, any>) {
    const result = await run("Creating resume version", () => createCandidatePortalResumeVersion(token, title, targetRole, resumeJson));
    if (!result) return null;
    setCandidateResumeVersions((items) => [result.version, ...items.filter((item) => item.id !== result.version.id)]);
    return result.version;
  }

  async function handleUpdateCandidatePortalVersion(
    versionId: string,
    payload: { title?: string; target_role?: string | null; resume_json?: Record<string, any> },
  ) {
    const result = await run("Saving resume version", () => updateCandidatePortalResumeVersion(token, versionId, payload));
    if (!result) return null;
    setCandidateResumeVersions((items) => [result.version, ...items.filter((item) => item.id !== result.version.id)]);
    return result.version;
  }

  async function handleArchiveCandidatePortalVersion(versionId: string) {
    const result = await run("Archiving resume version", () => archiveCandidatePortalResumeVersion(token, versionId));
    if (!result) return null;
    setCandidateResumeVersions((items) => items.filter((item) => item.id !== versionId));
    return result.version;
  }

  async function handleCreateCandidatePortalShare(versionId: string, label: string, includePii = false) {
    const result = await run("Creating resume share", () => createCandidatePortalResumeShare(token, versionId, label, includePii));
    if (!result) return null;
    setCandidateResumeShares((items) => [result.share, ...items.filter((item) => item.id !== result.share.id)]);
    return result.share;
  }

  async function handleRevokeCandidatePortalShare(shareId: string) {
    const result = await run("Revoking resume share", () => revokeCandidatePortalResumeShare(token, shareId));
    if (!result) return;
    setCandidateResumeShares((items) => items.map((item) => item.id === shareId ? { ...item, status: "revoked" } : item));
  }

  async function handleCreateCandidatePortalApplication(payload: {
    resume_version_id: string;
    destination_name: string;
    destination_type?: string;
    job_title?: string;
    job_url?: string;
    status?: string;
    note?: string;
    create_share_link?: boolean;
    include_pii?: boolean;
  }) {
    const result = await run("Saving resume share history", () => createCandidatePortalApplication(token, payload));
    if (!result) return null;
    setCandidateApplications((items) => [result.application, ...items.filter((item) => item.id !== result.application.id)]);
    if (result.share) setCandidateResumeShares((items) => [result.share as CandidateResumeShare, ...items.filter((item) => item.id !== result.share?.id)]);
    return result.application;
  }

  async function handleUpdateCandidatePortalApplication(applicationId: string, payload: { status?: string; note?: string }) {
    const result = await run("Updating resume share history", () => updateCandidatePortalApplication(token, applicationId, payload));
    if (!result) return null;
    setCandidateApplications((items) => items.map((item) => item.id === applicationId ? result.application : item));
    return result.application;
  }

  async function handleCandidateAccessDecision(requestId: string, decision: "approve" | "deny") {
    const result = await run(`${decision === "approve" ? "Approving" : "Denying"} recruiter access`, () => decideCandidatePortalAccessRequest(token, requestId, decision));
    if (!result) return;
    setCandidateAccessRequests((items) => items.map((item) => item.id === requestId ? result.access_request : item));
  }

  async function handleLoadCandidatePortalVersion(versionId: string) {
    const result = await getCandidatePortalResumeVersion(token, versionId);
    setCandidateResumeVersions((items) => items.map((item) => item.id === versionId ? result.version : item));
    return result.version;
  }

  async function handleUploadCandidatePortalResume(file: File, targetRole?: string, note?: string) {
    const result = await run("Uploading candidate resume", () => uploadCandidatePortalResume(token, file, targetRole, note));
    if (!result) return null;
    setCandidateResumeUploads((items) => [result.upload, ...items.filter((item) => item.id !== result.upload.id)]);
    return result.upload;
  }

  async function handlePreviewCandidatePortalResume(file: File) {
    return previewCandidatePortalResume(token, file);
  }

  async function handleRefreshCandidatePortalUpload(uploadId: string) {
    const result = await getCandidatePortalResumeUpload(token, uploadId);
    setCandidateResumeUploads((items) => [result.upload, ...items.filter((item) => item.id !== uploadId)]);
    if (result.upload.status === "succeeded") {
      const [profileResult, versionResult] = await Promise.all([
        getCandidatePortalProfile(token),
        listCandidatePortalResumeVersions(token),
      ]);
      setCandidatePortalProfile(profileResult);
      setCandidateResumeVersions(versionResult.versions ?? []);
    }
    return result.upload;
  }

  async function handleRetryCandidatePortalUpload(uploadId: string) {
    const result = await run("Retrying candidate resume parse", () => retryCandidatePortalResumeUpload(token, uploadId));
    if (!result) return null;
    setCandidateResumeUploads((items) => [result.upload, ...items.filter((item) => item.id !== uploadId)]);
    return result.upload;
  }

  async function handleCandidatePortalRequirementMatch(versionId: string, requirementText: string) {
    const result = await run("Matching resume version", () => matchCandidatePortalRequirement(token, versionId, requirementText));
    return result?.match ?? null;
  }

  async function handleSuggestCandidateAiEdit(payload: {
    action: "coach" | "rewrite_selection" | "tailor_section" | "gap_check";
    selected_text?: string;
    instruction?: string;
    profile?: CandidatePortalProfile["profile"];
    resume_html?: string;
    target_role?: string;
    requirement_text?: string;
  }) {
    const result = await run("Getting AI resume suggestion", () => suggestCandidateAiEdit(token, payload));
    return result?.suggestion ?? null;
  }

  async function handleCreateCandidateAiLearningEvent(payload: {
    event_type: string;
    source?: string;
    original_text?: string;
    suggested_text?: string;
    accepted?: boolean;
    metadata?: Record<string, any>;
  }) {
    try {
      const result = await createCandidateAiLearningEvent(token, payload);
      if (result?.event) setCandidateAiLearningEvents((items) => [result.event, ...items.filter((item) => item.id !== result.event.id)].slice(0, 30));
      return result?.event ?? null;
    } catch {
      return null;
    }
  }

  const filteredCandidates = useMemo(() => {
    const needle = query.toLowerCase();
    if (!needle) return candidates;
    if (searchResults.length) return searchResults;
    return candidates.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
  }, [candidates, query, searchResults]);

  if (!token) {
    const showBootstrap = process.env.NODE_ENV !== "production";
    const showLocalDevHelp = process.env.NODE_ENV !== "production";
    const isAdminLogin = loginMode === "admin";
    const isCandidateLogin = loginMode === "candidate" || applicantLoginSelected;
    const showCandidateSignup = candidateSignupMode && isCandidateLogin && !inviteMode;
    const showCompanySignup = signupMode && !isAdminLogin && !inviteMode && !isCandidateLogin;
    const showMergedHome = showPublicHome && !lockedLoginMode && !inviteMode;
    const canShowPublicLoginTabs = showMergedHome && !inviteMode && !signupMode && !candidateSignupMode;
    const loginEmailPlaceholder = showLocalDevHelp
      ? (isAdminLogin ? "admin@example.com" : isCandidateLogin ? "candidate@example.com" : "recruiter@example.com")
      : (isAdminLogin ? "owner@candidatesignal.ai" : isCandidateLogin ? "candidate@email.com" : "name@company.com");
    const passwordPlaceholder = showLocalDevHelp ? "resume-intel" : "Password";
    const loginPanel = (
        <section ref={publicAuthPanelRef} className={showMergedHome ? "loginPanel stitchAuthCard" : "loginPanel"}>
          <ShieldCheck size={28} />
          {inviteMode ? (
            <>
              <h1>Accept Recruiter Invite</h1>
              <p>Create your account for the recruiter workspace.</p>
              <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Invite token" />
              <input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Your name" />
              <input value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} placeholder="Create password" type="password" />
              <button className="primary" onClick={handleAcceptInvitation} disabled={busy || !inviteToken.trim() || !inviteName.trim() || !invitePassword.trim()}>
                <LogIn size={16} /> Accept invite
              </button>
              <button className="plain" onClick={() => setInviteMode(false)} disabled={busy}>Back to login</button>
            </>
          ) : (
            <>
              <h1>{showCompanySignup ? "Create Recruiter Workspace" : showCandidateSignup ? "Create Candidate Profile" : isCandidateLogin ? "Candidate Access" : isAdminLogin ? "Admin Login" : "Recruiter Login"}</h1>
              <p>
                {showCompanySignup
                  ? "Register your recruiter workspace for your company and become the tenant owner. No platform-admin approval is required."
                  : showCandidateSignup
                  ? "Create a candidate-owned profile, maintain resume versions, and generate application-specific CVs. LinkedIn verification does not run from candidate access."
                  : isCandidateLogin
                  ? "Candidates can maintain resume versions, generate a clean CV, and compare their profile against requirements."
                  : isAdminLogin
                    ? "Platform owners only. This opens the admin system, not the recruiter app."
                    : "Recruiters only. This opens the recruiter workspace for one tenant."}
              </p>
              {canShowPublicLoginTabs ? (
                <div className="loginModeTabs" role="tablist" aria-label="Choose login type">
                  <button
                    className={!isCandidateLogin ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={!isCandidateLogin}
                    onClick={() => {
                      handleLoginModeChange("company");
                      setApplicantLoginSelected(false);
                      setEmail("");
                      setLoginError("");
                    }}
                    disabled={busy}
                  >
                    <strong>Recruiter Access</strong>
                    <span>Recruiters, candidates, campaigns, matching.</span>
                  </button>
                  <button
                    className={isCandidateLogin ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={isCandidateLogin}
                    onClick={() => {
                      handleLoginModeChange("candidate");
                      setApplicantLoginSelected(true);
                      setEmail("");
                      setLoginError("");
                    }}
                    disabled={busy}
                  >
                    <strong>Candidate Access</strong>
                    <span>Resume versions, application fit, data-to-CV.</span>
                  </button>
                </div>
              ) : (
                <div className="loginModeLocked">
                  <strong>{isAdminLogin ? "Admin System" : "Recruiter Workspace"}</strong>
                  <span>{isAdminLogin ? "Create companies, allocate seats, invite company owners." : "Upload resumes, search candidates, run campaigns and matching."}</span>
                </div>
              )}
              {showCompanySignup ? (
                <>
                  <input
                    ref={signupCompanyInputRef}
                    value={signupCompanyName}
                    onChange={(event) => {
                      setSignupCompanyName(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Company name"
                    aria-label="Company name"
                    autoComplete="organization"
                  />
                  <input
                    value={signupOwnerName}
                    onChange={(event) => {
                      setSignupOwnerName(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Your name"
                    aria-label="Your name"
                    autoComplete="name"
                  />
                  <input
                    value={signupEmail}
                    onChange={(event) => {
                      setSignupEmail(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="work@email.com"
                    aria-label="Work email"
                    autoComplete="username"
                  />
                  <input
                    value={signupPassword}
                    onChange={(event) => {
                      setSignupPassword(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Create password (10+ characters)"
                    type="password"
                    aria-label="Create password"
                    autoComplete="new-password"
                  />
                  <button
                    className="primary"
                    onClick={handleCompanySignup}
                    disabled={busy || !signupCompanyName.trim() || !signupOwnerName.trim() || !signupEmail.trim() || signupPassword.length < 10}
                  >
                    <Rocket size={16} /> {busy ? "Creating..." : "Create Free Workspace"}
                  </button>
                  <div className="loginHelpBox">
                    <strong>Private recruiter workspace</strong>
                    <span>Your data is tenant-isolated. Platform admins manage billing and company setup, not candidate databases.</span>
                  </div>
                  {loginError ? <div className="loginError">{loginError}</div> : null}
                  <button className="plain" type="button" onClick={() => setSignupMode(false)} disabled={busy}>Back to recruiter login</button>
                </>
              ) : showCandidateSignup ? (
                <>
                  <button className="googleAuthButton" type="button" onClick={handleCandidateGoogleSignIn} disabled={busy}>
                    <GoogleMark /> Continue with Google
                  </button>
                  <div className="authDivider"><span>or create with email</span></div>
                  <input
                    value={candidateSignupName}
                    onChange={(event) => {
                      setCandidateSignupName(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Your full name"
                    aria-label="Candidate full name"
                    autoComplete="name"
                  />
                  <input
                    value={candidateSignupEmail}
                    onChange={(event) => {
                      setCandidateSignupEmail(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="candidate@email.com"
                    aria-label="Candidate email"
                    autoComplete="username"
                  />
                  <input
                    value={candidateSignupPassword}
                    onChange={(event) => {
                      setCandidateSignupPassword(event.target.value);
                      setLoginError("");
                    }}
                    placeholder="Create password (10+ characters)"
                    type="password"
                    aria-label="Create candidate password"
                    autoComplete="new-password"
                  />
                  <button
                    className="primary"
                    onClick={handleCandidateSignup}
                    disabled={busy || !candidateSignupName.trim() || !candidateSignupEmail.trim() || candidateSignupPassword.length < 10}
                  >
                    <Rocket size={16} /> {busy ? "Creating..." : "Create Candidate Profile"}
                  </button>
                  <div className="loginHelpBox">
                    <strong>Candidate-owned workspace</strong>
                    <span>You control your resume data and versions. Candidate access does not trigger LinkedIn verification.</span>
                  </div>
                  {loginError ? <div className="loginError">{loginError}</div> : null}
                  <button className="plain" type="button" onClick={() => setCandidateSignupMode(false)} disabled={busy}>Back to candidate login</button>
                </>
              ) : (
                <>
                  {isCandidateLogin ? (
                    <>
                      <button className="googleAuthButton" type="button" onClick={handleCandidateGoogleSignIn} disabled={busy}>
                        <GoogleMark /> Continue with Google
                      </button>
                      <div className="authDivider"><span>or sign in with email</span></div>
                    </>
                  ) : null}
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setLoginError("");
                    }}
                    onKeyDown={handleLoginKeyDown}
                    placeholder={loginEmailPlaceholder}
                    aria-label={isAdminLogin ? "Admin email or username" : isCandidateLogin ? "Candidate email or username" : "Recruiter email or username"}
                    autoComplete="username"
                  />
                  <input
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setLoginError("");
                    }}
                    onKeyDown={handleLoginKeyDown}
                    placeholder={passwordPlaceholder}
                    type="password"
                    aria-label="Password"
                    autoComplete="current-password"
                  />
                  <button className="primary" onClick={handleLogin} disabled={busy || !email.trim() || !password.trim()}>
                    <LogIn size={16} /> {busy ? "Signing in..." : isAdminLogin ? "Enter Admin System" : isCandidateLogin ? "Enter Candidate Workspace" : "Enter Recruiter Workspace"}
                  </button>
                  {loginError ? <div className="loginError">{loginError}</div> : null}
                  {showLocalDevHelp ? <div className="loginHelpBox">
                    <strong>Local dev login</strong>
                    <span>{isAdminLogin ? "admin or admin@example.com / resume-intel" : isCandidateLogin ? "candidate or candidate@example.com / resume-intel" : "recruiter or recruiter@example.com / resume-intel"}</span>
                  </div> : null}
                  {lockedLoginMode ? (
                    <a className="plain actionLink" href={isAdminLogin ? "/" : "/admin"}>
                      {isAdminLogin ? "Go to Recruiter Login" : "Go to Admin Login"}
                    </a>
                  ) : null}
                  {isAdminLogin && showBootstrap ? <button className="plain" onClick={handleBootstrap} disabled={busy || !email.trim() || !password.trim()}>
                    Create local platform admin
                  </button> : null}
                  {!isAdminLogin && !isCandidateLogin ? <button className="plain" onClick={() => setInviteMode(true)} disabled={busy}>
                    Accept invite
                  </button> : null}
                  {!isAdminLogin && !isCandidateLogin ? <button className="plain" onClick={openCompanySignupPanel} disabled={busy}>
                    Create a recruiter workspace
                  </button> : null}
                  {isCandidateLogin ? <button className="plain" onClick={() => setCandidateSignupMode(true)} disabled={busy}>
                    Create candidate profile
                  </button> : null}
                </>
              )}
            </>
          )}
          <div className="status">{busy ? <Loader2 className="spin" size={16} /> : null}{busy ? "Working..." : status}</div>
        </section>
    );

    if (showMergedHome) {
      return (
        <main className="stitchPublicHome">
          <EnvironmentBanner isStaging={IS_STAGING_ENV} />
          <header className="stitchPublicNav">
            <a className="publicBrand stitchPublicBrand" href="/">
              <BrandMark />
              <strong>candidateSignal<span>.ai</span></strong>
            </a>
            <nav aria-label="Homepage sections">
              <a href="#solutions">Solutions</a>
              <a href="#pricing">Pricing</a>
              <a href="#privacy">Privacy</a>
              <a href="#security">Security</a>
            </nav>
            <div className="stitchNavActions">
              <button className="plain" type="button" onClick={() => { setSignupMode(false); setCandidateSignupMode(false); handleLoginModeChange("candidate"); }}>Candidate Access</button>
              <button className="primary" type="button" onClick={() => { setSignupMode(false); setCandidateSignupMode(false); handleLoginModeChange("company"); }}>Recruiter Login</button>
            </div>
          </header>

          <section className="stitchPublicHero">
            <div className="stitchHeroCopy">
              <span className="stitchHomePill"><CheckCircle2 size={15} /> Next-gen recruiting intelligence</span>
              <h1>
                <span>Upload resumes.</span>
                <span>Understand candidates.</span>
                <em>Find the right fit faster.</em>
              </h1>
              <p>Built for calm, evidence-backed hiring. Cut through traditional screening noise and discover the real professional signal in your company talent pool without mixing company data.</p>
              <div className="stitchHeroActions">
                <button className="primary" type="button" onClick={openCompanySignupPanel}>
                  <Rocket size={16} /> Get Started
                </button>
                <button className="secondary" type="button" onClick={() => { setSignupMode(false); setCandidateSignupMode(false); handleLoginModeChange("candidate"); }}>
                  <Users size={16} /> Candidate Access
                </button>
              </div>
            </div>
            {loginPanel}
          </section>

          <section className="stitchSuiteSection" id="solutions">
            <div className="stitchSectionHeader">
              <h2>The Intelligence Suite</h2>
              <p>Everything needed to extract signal from noise.</p>
            </div>
            <div className="stitchSuiteGrid">
              <article>
                <FileSearch size={25} />
                <h3>Intelligent Parsing</h3>
                <p>Extract skills, timelines, locations, PII links, portfolio URLs, and source-backed evidence from raw resumes.</p>
              </article>
              <article>
                <CheckCircle2 size={25} />
                <h3>Evidence Matching</h3>
                <p>Every recommendation shows source text, gaps, uncertainty, and the next recruiter action.</p>
              </article>
              <article>
                <Search size={25} />
                <h3>Search Copilot</h3>
                <p>Ask natural-language questions across your talent pool and get ranked candidates with evidence.</p>
              </article>
              <article id="privacy">
                <ShieldCheck size={25} />
                <h3>Tenant Privacy</h3>
                <p>Company data stays isolated. Platform admins manage companies and seats, not candidate databases.</p>
              </article>
            </div>
          </section>

          <section className="stitchPricingSection" id="pricing">
            <div className="pricingCompactShell">
              <div className="pricingCompactIntro">
                <span className="pricingKicker">Simple pricing</span>
                <h2>Start free while we onboard early companies.</h2>
                <p>Use the recruiter workspace now for resume parsing, search, campaigns, notes, and evidence-backed matching. Paid access is coming soon.</p>
              </div>
              <div className="pricingCompactPlans">
                <article className="pricingCompactPlan active">
                  <div>
                    <span>Available till June end</span>
                    <h3>Free Workspace</h3>
                    <p>Private recruiter workspace for evaluating the product.</p>
                  </div>
                  <strong>$0 <small>/ month</small></strong>
                  <ul>
                    <li>Resume database, Copilot search, campaign matching.</li>
                    <li>Member invites, recruiter notes, and privacy controls.</li>
                  </ul>
                  <button className="primary" type="button" onClick={openCompanySignupPanel}>Create Free Workspace</button>
                </article>
                <article className="pricingCompactPlan soon">
                  <div>
                    <span>Coming soon</span>
                    <h3>After that</h3>
                    <p>For continued recruiter workspace access after the free period.</p>
                  </div>
                  <strong>$29.99 <small>initial</small></strong>
                  <p className="pricingSubline">Then $9.99 per user / month.</p>
                  <ul>
                    <li>Higher limits, saved searches, and richer workflows.</li>
                    <li>Email onboarding, collaboration, and reporting.</li>
                  </ul>
                  <button className="secondary" type="button" disabled>Coming Soon</button>
                </article>
              </div>
            </div>
          </section>

          <section className="stitchSignalPreview" id="security">
            <div className="stitchSignalHeader">
              <h2>From Raw Text to Structured Signal</h2>
              <p>The engine understands context, skills, timelines, and evidence without manual data entry.</p>
            </div>
            <div className="stitchSignalGrid">
              <article className="rawSignalCard">
                <header><span /> <span /> <span /><b>resume_upload.pdf</b></header>
                <p>...managed healthcare analytics migration from Hadoop to Spark...</p>
                <mark>Python, SQL, Azure Data Factory, Databricks, Tableau</mark>
                <p>Led cross-functional data engineering delivery across enterprise stakeholders...</p>
              </article>
              <div className="signalArrow"><Search size={22} /></div>
              <article className="structuredSignalCard">
                <header>
                  <Database size={18} />
                  <strong>Extracted Signals</strong>
                  <em>Evidence-backed</em>
                </header>
                <div>
                  <span>Core competencies</span>
                  <p>Data engineering, healthcare analytics, cloud migration</p>
                </div>
                <div>
                  <span>Technical stack</span>
                  <p>Spark, Python, SQL, Azure Data Factory, Databricks</p>
                </div>
                <div>
                  <span>Recruiter action</span>
                  <p>Strong fit; verify current location and recent hands-on Spark depth.</p>
                </div>
              </article>
            </div>
          </section>

          <section className="stitchRoleSection">
            <div className="stitchSectionHeader centered">
              <h2>First-Class Workspaces for Every Role</h2>
              <p>Dedicated portals designed around the people using the product.</p>
            </div>
            <div className="stitchRoleGrid">
              <article>
                <div className="roleIcon primaryRole"><Rocket size={26} /></div>
                <h3>For Recruiters & Hiring Teams</h3>
                <p>The recruiter workspace for resume upload, search, matching, campaigns, notes, and evidence-backed shortlists.</p>
                <ul>
                  <li>Defensible candidate decisions with exact CV evidence.</li>
                  <li>Bulk parsing and campaign-specific uploads.</li>
                  <li>Natural-language search across the tenant database.</li>
                </ul>
              </article>
              <article>
                <div className="roleIcon mutedRole"><Users size={26} /></div>
                <h3>For Applicants & Students</h3>
                <p>Coming soon: a personal portal for resume signal, application fit, and transparent candidate experiences.</p>
                <ul>
                  <li>Understand what the system extracts from a resume.</li>
                  <li>Track profile strength and missing signals.</li>
                  <li>Manage future application context in one place.</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="stitchFinalCta">
            <h2>Ready to hire with evidence?</h2>
            <p>Start with recruiter access, upload resumes, and turn candidate data into recruiter-ready decisions.</p>
            <button className="primary" type="button" onClick={openCompanySignupPanel}>Create Free Workspace</button>
          </section>

          <footer className="stitchPublicFooter">
            <a className="publicBrand" href="/">
              <BrandMark />
              <strong>candidateSignal.ai</strong>
            </a>
            <p>Evidence-backed hiring intelligence for modern recruiting teams.</p>
            <div>
              <a href="#solutions">Product</a>
              <a href="#pricing">Pricing</a>
              <a href="#privacy">Privacy</a>
              <a href="#security">Security</a>
              <a href="/admin">Admin</a>
            </div>
          </footer>
        </main>
      );
    }

    return (
      <main className="loginShell">
        <EnvironmentBanner isStaging={IS_STAGING_ENV} />
        <section className="landingIntro loginIntroCompact">
          <span className="eyebrow">candidateSignal.ai</span>
          <h1>{inviteMode ? "Accept recruiter invite." : isAdminLogin ? "Platform admin login." : "Recruiter workspace login."}</h1>
          <p>
            {inviteMode
              ? "Use the invite token from your company admin to create a tenant-scoped account."
              : isAdminLogin
                ? "Use this only to create companies, manage seats, and review platform audit data."
                : "Use this for resumes, candidates, campaigns, requirements, matching, and Team Settings."}
          </p>
          <div className="loginBoundaryCard">
            <strong>{isAdminLogin ? "Admin system" : "Recruiter workspace"}</strong>
            <span>
              {isAdminLogin
                ? "No candidate database access from this side."
                : "Your candidate database is isolated to your company."}
            </span>
          </div>
        </section>
        {loginPanel}
      </main>
    );
  }

  if (token && !currentUser) {
    return (
      <main className="loginShell">
        <EnvironmentBanner isStaging={IS_STAGING_ENV} />
        <section className="landingIntro loginIntroCompact">
          <span className="eyebrow">candidateSignal.ai</span>
          <h1>Checking session.</h1>
          <p>Verifying your workspace access before opening the app.</p>
          <div className="loginBoundaryCard">
            <strong>Tenant boundary check</strong>
            <span>Admin and company sessions are separated before any workspace data loads.</span>
          </div>
        </section>
        <section className="loginPanel">
          <Loader2 className="spin" size={24} />
          <h1>Loading</h1>
          <p>{status}</p>
          <button className="plain" type="button" onClick={handleLogout}>Clear session and sign in again</button>
        </section>
      </main>
    );
  }

  const useWorkspaceTopNav = workspaceMode === "tenant";
  const useAdminTopBar = workspaceMode === "admin" && isPlatformAdmin(currentUser);
  const canManageWorkspaceSettings = isTenantAdmin(currentUser);

  return (
    <main className="appShell topNavShell">
      <EnvironmentBanner isStaging={IS_STAGING_ENV} />
      <section className="appMain">
        {useWorkspaceTopNav ? <WorkspaceTopNav view={view} setView={setView} user={currentUser} status={status} busy={busy} logout={handleLogout} /> : null}
        {!useWorkspaceTopNav && useAdminTopBar ? <AdminShellTopBar user={currentUser} status={status} busy={busy} logout={handleLogout} /> : null}
        <section className={useWorkspaceTopNav ? "canvas withWorkspaceTopNav" : useAdminTopBar ? "canvas withShellTopBar" : "canvas"}>
          {workspaceMode === "tenant" && view === "dashboard" ? (
            <Dashboard
              candidates={candidates}
              campaigns={campaigns}
              deadLetterCount={parseDeadLetters.length}
              operationalAlertCount={operationalAlerts.length}
              setView={setView}
              openCandidate={handleOpenCandidate}
              markReviewSignal={handleMarkCandidateReviewSignal}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "copilot" ? (
            <RecruiterCopilot
              messages={copilotMessages}
              threads={copilotThreads}
              activeThread={copilotThread}
              input={copilotInput}
              setInput={setCopilotInput}
              resultLimit={copilotResultLimit}
              setResultLimit={setCopilotResultLimit}
              allCandidates={candidates}
              campaigns={campaigns}
              activeCampaign={campaign}
              selectedCampaignId={copilotCampaignId}
              selectCampaign={handleSelectCopilotCampaign}
              shortlistToCampaign={handleCopilotShortlist}
              openCampaign={handleOpenCampaign}
              send={handleSendCopilotMessage}
              newThread={handleNewCopilotThread}
              openThread={handleOpenCopilotThread}
              archiveThread={handleArchiveCopilotThread}
              createRequirementFromThread={handleCreateRequirementFromCopilotThread}
              openCandidate={handleOpenCandidate}
              busy={busy}
              requirement={requirement}
              requirementText={requirementText}
              setRequirementText={setRequirementText}
              requirementFile={requirementFile}
              setRequirementFile={setRequirementFile}
              clarifyAnswers={clarifyAnswers}
              setClarifyAnswers={setClarifyAnswers}
              createRequirement={handleCreateRequirement}
              finalize={handleFinalizeRequirement}
              match={handleRunRequirementMatch}
              matches={matches}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "database" ? (
            <DatabaseView
              candidates={filteredCandidates}
              query={query}
              setQuery={setQuery}
              open={handleOpenCandidate}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "upload" ? (
            <UploadResumeView
              resumeFile={resumeFile}
              setResumeFile={setResumeFile}
              bulkFiles={bulkFiles}
              setBulkFiles={setBulkFiles}
              batchName={batchName}
              setBatchName={setBatchName}
              bulkContextNote={bulkContextNote}
              setBulkContextNote={setBulkContextNote}
              campaigns={campaigns}
              bulkCampaignId={bulkCampaignId}
              setBulkCampaignId={setBulkCampaignId}
              linkedinImportUrl={linkedinImportUrl}
              setLinkedinImportUrl={setLinkedinImportUrl}
              linkedinImportCampaignId={linkedinImportCampaignId}
              setLinkedinImportCampaignId={setLinkedinImportCampaignId}
              linkedinImportJob={linkedinImportJob}
              noteName={noteName}
              setNoteName={setNoteName}
              note={note}
              setNote={setNote}
              upload={handleUploadResume}
              bulkUpload={handleBulkUpload}
              importLinkedIn={handleLinkedInImport}
              batches={parseBatches}
              deadLetters={parseDeadLetters}
              workerStatus={workerStatus}
              selectedBatch={selectedBatch}
              selectBatch={handleSelectBatch}
              retryJob={handleRetryJob}
              cancelJob={handleCancelJob}
              cancelBatch={handleCancelBatch}
              openCandidate={handleOpenCandidate}
              openCampaign={handleOpenCampaign}
              createCampaignRequirement={handleCreateCampaignRequirement}
              uploadCampaignRequirement={handleUploadCampaignRequirement}
              busy={busy}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "operations" ? (
            canManageWorkspaceSettings ? (
              <OperationsView
                workerStatus={workerStatus}
                batches={parseBatches}
                deadLetters={parseDeadLetters}
                alerts={operationalAlerts}
                alertDeliveries={operationalAlertDeliveries}
                maintenanceJobs={maintenanceJobs}
                canManageMaintenance={canManageWorkspaceSettings}
                selectedBatch={selectedBatch}
                selectBatch={handleSelectBatch}
                retryJob={handleRetryJob}
                resolveDeadLetter={handleResolveDeadLetter}
                acknowledgeAlert={handleAcknowledgeOperationalAlert}
                cancelJob={handleCancelJob}
                cancelBatch={handleCancelBatch}
                runCandidateMaintenance={handleRunCandidateMaintenance}
                retryCandidateMaintenance={handleRetryCandidateMaintenance}
                cancelCandidateMaintenance={handleCancelCandidateMaintenance}
                busy={busy}
              />
            ) : (
              <AccessDeniedPanel title="Processing review is restricted" body="Ask a company admin to review failed files, processing health, and retry actions." />
            )
          ) : null}

          {workspaceMode === "tenant" && view === "candidate" && candidate ? (
            <CandidateDetail
              candidate={candidate}
              token={token}
              teamMembers={teamMembers}
              reparseBatches={parseBatches}
              noteName={noteName}
              setNoteName={setNoteName}
              note={note}
              setNote={setNote}
              saveNote={handleAddNote}
              noteSaveState={noteSaveState}
              noteSaveError={noteSaveError}
              deletingNoteId={deletingNoteId}
              updateSavedNote={handleUpdateNote}
              deleteSavedNote={handleDeleteNote}
              updateProfile={handleUpdateCandidateProfile}
              deleteCandidate={handleDeleteCandidate}
              openCandidate={handleOpenCandidate}
              reparseCandidate={handleReparseCandidate}
              canReparse={isTenantAdmin(currentUser)}
              match={() => setView("requirement")}
              activeTab={candidateDetailTab}
              setActiveTab={setCandidateDetailTab}
              refreshCandidate={() => handleOpenCandidate(candidate.document_id, candidateDetailTab)}
              openCandidateVersions={handleOpenCandidateVersions}
              markReviewSignal={(signal) => handleMarkCandidateReviewSignal(candidate.document_id, signal)}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "requirement" ? (
            <RequirementIntake
              requirement={requirement}
              requirementText={requirementText}
              setRequirementText={setRequirementText}
              requirementFile={requirementFile}
              setRequirementFile={setRequirementFile}
              clarifyAnswers={clarifyAnswers}
              setClarifyAnswers={setClarifyAnswers}
              createRequirement={handleCreateRequirement}
              finalize={handleFinalizeRequirement}
              match={handleRunRequirementMatch}
              requirements={requirements}
              selectRequirement={handleSelectRequirement}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "matches" ? <MatchResults requirement={requirement} requirements={requirements} matches={matches} matchRuns={matchRuns} matchRunChanges={matchRunChanges} openCandidate={handleOpenCandidate} shortlist={handleShortlist} reject={handleReject} setView={setView} selectRequirement={handleSelectRequirement} /> : null}

          {workspaceMode === "tenant" && view === "campaigns" ? (
            <CampaignsView
              token={token}
              teamMembers={teamMembers}
              campaigns={campaigns}
              requirements={requirements}
              campaign={campaign}
              campaignLoadingId={campaignLoadingId}
              campaignName={campaignName}
              setCampaignName={setCampaignName}
              campaignDescription={campaignDescription}
              setCampaignDescription={setCampaignDescription}
              campaignFiles={campaignFiles}
              setCampaignFiles={setCampaignFiles}
              createCampaign={handleCreateCampaign}
              openCampaign={handleOpenCampaign}
              updateCampaign={handleUpdateCampaign}
              archiveCampaign={handleDeleteCampaign}
              createRequirement={handleCreateCampaignRequirement}
              uploadRequirement={handleUploadCampaignRequirement}
              saveScorecard={handleSaveCampaignScorecard}
              matchCampaign={handleMatchCampaign}
              uploadResumes={handleUploadCampaignResumes}
              updateCandidateStatus={handleCampaignCandidateStatus}
              openCandidate={handleOpenCandidate}
              activeTab={campaignDetailTab}
              setActiveTab={setCampaignDetailTab}
              activePipelineStage={campaignPipelineStage}
              setActivePipelineStage={setCampaignPipelineStage}
              selectedCandidateId={campaignSelectedCandidateId}
              setSelectedCandidateId={setCampaignSelectedCandidateId}
              busy={busy}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "versions" ? <CandidateVersionReview clusters={clusters} decide={handleCandidateVersionDecision} /> : null}

          {workspaceMode === "tenant" && view === "team" ? (
            canManageWorkspaceSettings ? (
              <TeamSettings
                members={teamMembers}
                invitations={teamInvites}
                mailMessages={mailMessages}
                governancePolicy={governancePolicy}
                piiAccessEvents={piiAccessEvents}
                inviteMember={handleInviteMember}
                resendInvite={handleResendInvite}
                cancelInvite={handleCancelInvite}
                retryMail={handleRetryMailMessage}
                updateRole={handleUpdateMemberRole}
                disableMember={handleDisableMember}
                updateGovernancePolicy={handleUpdateGovernancePolicy}
                refreshPiiAudit={handleRefreshPiiAudit}
                refreshMailMessages={handleRefreshMailMessages}
              />
            ) : (
              <AccessDeniedPanel title="Team settings are restricted" body="Only company owners and tenant admins can invite users, change roles, or review contact-data access." />
            )
          ) : null}

          {workspaceMode === "candidate" ? (
            <CandidatePortalWorkspace
              user={currentUser}
              profile={candidatePortalProfile}
              uploads={candidateResumeUploads}
              versions={candidateResumeVersions}
              shares={candidateResumeShares}
              applications={candidateApplications}
              accessRequests={candidateAccessRequests}
              aiLearningEvents={candidateAiLearningEvents}
              status={status}
              busy={busy}
              previewResume={handlePreviewCandidatePortalResume}
              uploadResume={handleUploadCandidatePortalResume}
              refreshUpload={handleRefreshCandidatePortalUpload}
              retryUpload={handleRetryCandidatePortalUpload}
              saveProfile={handleSaveCandidatePortalProfile}
              savePrivacySettings={handleSaveCandidatePortalPrivacySettings}
              createVersion={handleCreateCandidatePortalVersion}
              updateVersion={handleUpdateCandidatePortalVersion}
              archiveVersion={handleArchiveCandidatePortalVersion}
              createShare={handleCreateCandidatePortalShare}
              revokeShare={handleRevokeCandidatePortalShare}
              createApplication={handleCreateCandidatePortalApplication}
              updateApplication={handleUpdateCandidatePortalApplication}
              decideAccessRequest={handleCandidateAccessDecision}
              loadVersion={handleLoadCandidatePortalVersion}
              matchRequirement={handleCandidatePortalRequirementMatch}
              suggestAiEdit={handleSuggestCandidateAiEdit}
              recordAiLearningEvent={handleCreateCandidateAiLearningEvent}
              logout={handleLogout}
            />
          ) : null}

          {workspaceMode === "admin" && isPlatformAdmin(currentUser) ? (
            <AdminSettings tenants={tenants} invitations={teamInvites} auditEvents={auditEvents} selectedTenant={tenantDetail} selectTenant={handleSelectTenant} createTenant={handleCreateTenant} setTenantStatus={handleTenantStatus} />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function CandidatePortalWorkspace({
  user,
  profile,
  uploads,
  versions,
  shares,
  applications,
  accessRequests,
  status,
  busy,
  previewResume,
  uploadResume,
  refreshUpload,
  retryUpload,
  saveProfile,
  savePrivacySettings,
  createVersion,
  updateVersion,
  archiveVersion,
  createShare,
  revokeShare,
  createApplication,
  updateApplication,
  decideAccessRequest,
  loadVersion,
  matchRequirement,
  suggestAiEdit,
  recordAiLearningEvent,
  logout,
}: {
  user: CurrentUser | null;
  profile: CandidatePortalProfile | null;
  uploads: CandidateResumeUpload[];
  versions: CandidateResumeVersion[];
  shares: CandidateResumeShare[];
  applications: CandidateApplication[];
  accessRequests: CandidateAccessRequest[];
  aiLearningEvents: CandidateAiLearningEvent[];
  status: string;
  busy: boolean;
  previewResume: (file: File) => Promise<{ filename: string; source_type: string; html: string }>;
  uploadResume: (file: File, targetRole?: string, note?: string) => Promise<CandidateResumeUpload | null>;
  refreshUpload: (uploadId: string) => Promise<CandidateResumeUpload>;
  retryUpload: (uploadId: string) => Promise<CandidateResumeUpload | null>;
  saveProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>;
  savePrivacySettings: (settings: CandidatePortalPrivacySettings) => Promise<void>;
  createVersion: (title: string, targetRole?: string, resumeJson?: Record<string, any>) => Promise<CandidateResumeVersion | null>;
  updateVersion: (versionId: string, payload: { title?: string; target_role?: string | null; resume_json?: Record<string, any> }) => Promise<CandidateResumeVersion | null>;
  archiveVersion: (versionId: string) => Promise<CandidateResumeVersion | null>;
  createShare: (versionId: string, label: string, includePii?: boolean) => Promise<CandidateResumeShare | null>;
  revokeShare: (shareId: string) => Promise<void>;
  createApplication: (payload: {
    resume_version_id: string;
    destination_name: string;
    destination_type?: string;
    job_title?: string;
    job_url?: string;
    status?: string;
    note?: string;
    create_share_link?: boolean;
    include_pii?: boolean;
  }) => Promise<CandidateApplication | null>;
  updateApplication: (applicationId: string, payload: { status?: string; note?: string }) => Promise<CandidateApplication | null>;
  decideAccessRequest: (requestId: string, decision: "approve" | "deny") => Promise<void>;
  loadVersion: (versionId: string) => Promise<CandidateResumeVersion>;
  matchRequirement: (versionId: string, requirementText: string) => Promise<CandidateSelfMatch | null>;
  suggestAiEdit: (payload: {
    action: "coach" | "rewrite_selection" | "tailor_section" | "gap_check";
    selected_text?: string;
    instruction?: string;
    profile?: CandidatePortalProfile["profile"];
    resume_html?: string;
    target_role?: string;
    requirement_text?: string;
  }) => Promise<CandidateAiSuggestion | null>;
  recordAiLearningEvent: (payload: {
    event_type: string;
    source?: string;
    original_text?: string;
    suggested_text?: string;
    accepted?: boolean;
    metadata?: Record<string, any>;
  }) => Promise<CandidateAiLearningEvent | null>;
  logout: () => void;
}) {
  const [draft, setDraft] = useState<CandidatePortalProfile["profile"]>({});
  const [activeSection, setActiveSection] = useState<CandidatePortalSection>(() => typeof window === "undefined" ? "dashboard" : candidatePortalSectionFromSearch(window.location.search));
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [resumePreviewHtml, setResumePreviewHtml] = useState("");
  const [resumePreviewLoading, setResumePreviewLoading] = useState(false);
  const [resumePreviewError, setResumePreviewError] = useState("");
  const [uploadTargetRole, setUploadTargetRole] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [activeUploadId, setActiveUploadId] = useState("");
  const [versionTitle, setVersionTitle] = useState("General Resume");
  const [targetRole, setTargetRole] = useState("");
  const [shareLabel, setShareLabel] = useState("Recruiter-safe resume view");
  const [shareIncludePii, setShareIncludePii] = useState(false);
  const [applicationDestination, setApplicationDestination] = useState("");
  const [applicationDestinationType, setApplicationDestinationType] = useState("company");
  const [applicationJobTitle, setApplicationJobTitle] = useState("");
  const [applicationJobUrl, setApplicationJobUrl] = useState("");
  const [applicationStatus, setApplicationStatus] = useState("shared");
  const [applicationNote, setApplicationNote] = useState("");
  const [applicationCreateShare, setApplicationCreateShare] = useState(false);
  const [applicationIncludePii, setApplicationIncludePii] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<CandidateResumeVersion | null>(null);
  const [versionDetailOpen, setVersionDetailOpen] = useState(false);
  const [versionEditorOpen, setVersionEditorOpen] = useState(false);
  const [scratchEditorOpen, setScratchEditorOpen] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState("");
  const [editingVersionTitle, setEditingVersionTitle] = useState("");
  const [editingVersionTargetRole, setEditingVersionTargetRole] = useState("");
  const [versionQuery, setVersionQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("atlas");
  const [requirementText, setRequirementText] = useState("");
  const [selfMatch, setSelfMatch] = useState<CandidateSelfMatch | null>(null);
  const [, setLocalAiLearningEvents] = useState<Array<{ type: string; detail: string; created_at: string }>>([]);
  const [localError, setLocalError] = useState("");
  const candidateUrlReadyRef = useRef(false);

  const latestUpload = uploads[0] ?? null;
  const activeUpload = uploads.find((item) => item.id === activeUploadId) ?? latestUpload;
  const uploadInProgress = Boolean(activeUpload && ["queued", "retrying", "running"].includes(activeUpload.status));
  const profileCompleteness = candidatePortalCompleteness(profile?.profile ?? {});
  const needsReview = activeUpload?.needs_review_json ?? [];
  const resumePreviewKind = candidateUploadPreviewKind(resumeFile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveSection(candidatePortalSectionFromSearch(window.location.search));
      const uploadId = params.get("upload");
      const versionId = params.get("resume_version");
      if (uploadId) setActiveUploadId(uploadId);
      if (versionId) {
        setSelectedVersionId(versionId);
        setVersionDetailOpen(true);
      }
    };
    applyFromUrl();
    candidateUrlReadyRef.current = true;
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, []);

  useEffect(() => {
    if (!candidateUrlReadyRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("login", "candidate");
    params.set("candidate_view", activeSection);
    if (activeSection === "review" && activeUpload?.id) params.set("upload", activeUpload.id);
    else params.delete("upload");
    if (((activeSection === "review" && versionDetailOpen) || activeSection === "match") && selectedVersionId) params.set("resume_version", selectedVersionId);
    else params.delete("resume_version");
    const next = `${window.location.pathname}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) window.history.pushState(null, "", next);
  }, [activeSection, activeUpload?.id, selectedVersionId, versionDetailOpen]);

  useEffect(() => {
    const next = profile?.profile ?? {};
    setDraft(next);
  }, [profile]);

  useEffect(() => {
    if (!resumeFile) {
      setResumePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(resumeFile);
    setResumePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [resumeFile]);

  useEffect(() => {
    setResumePreviewHtml("");
    setResumePreviewError("");
    if (!resumeFile || resumePreviewKind !== "document") return;
    let active = true;
    setResumePreviewLoading(true);
    previewResume(resumeFile)
      .then((result) => {
        if (active) setResumePreviewHtml(result.html || "");
      })
      .catch((error) => {
        if (active) setResumePreviewError(readableError(error));
      })
      .finally(() => {
        if (active) setResumePreviewLoading(false);
      });
    return () => {
      active = false;
    };
    // previewResume is stable for the current candidate session; including it causes redundant preview uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeFile, resumePreviewKind]);

  useEffect(() => {
    if (!activeUploadId && latestUpload) setActiveUploadId(latestUpload.id);
  }, [activeUploadId, latestUpload]);

  useEffect(() => {
    if (!activeUpload || !["queued", "retrying", "running"].includes(activeUpload.status)) return;
    const timer = window.setInterval(() => {
      void refreshUpload(activeUpload.id).catch((error) => setLocalError(readableError(error)));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeUpload, refreshUpload]);

  useEffect(() => {
    if (selectedVersionId || !versions.length) return;
    setSelectedVersionId(versions[0].id);
  }, [selectedVersionId, versions]);

  useEffect(() => {
    if (!selectedVersionId) {
      setSelectedVersion(null);
      return;
    }
    const cached = versions.find((item) => item.id === selectedVersionId);
    if (cached?.resume_json) {
      setSelectedVersion(cached);
      return;
    }
    let active = true;
    loadVersion(selectedVersionId)
      .then((version) => {
        if (active) setSelectedVersion(version);
      })
      .catch((error) => {
        if (active) setLocalError(readableError(error));
      });
    return () => {
      active = false;
    };
  }, [loadVersion, selectedVersionId, versions]);

  function applyStarterResume(skipConfirm = false) {
    if (!skipConfirm && candidateProfileHasContent(draft)) {
      const confirmed = window.confirm("Replace the current editor draft with the sample resume? Save first if you want to keep your current edits.");
      if (!confirmed) return;
    }
    const starter = candidateStarterResumeProfile();
    setDraft(starter);
    setVersionTitle("Software Engineer Starter Resume");
    setTargetRole(starter.headline ?? "Software Engineer");
  }

  function handleStartFromScratch() {
    if (!candidateProfileHasContent(draft) && !versions.length && !latestUpload) applyStarterResume(true);
    if (!versionTitle.trim()) setVersionTitle("General Resume");
    setScratchEditorOpen(true);
  }

  function openSubmissionTracker(versionId?: string) {
    const nextVersionId = versionId || selectedVersionId || versions[0]?.id || "";
    if (nextVersionId) {
      setSelectedVersionId(nextVersionId);
      setVersionDetailOpen(true);
      setActiveSection("review");
      window.setTimeout(() => {
        document.querySelector("#candidate-application-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return;
    }
    setVersionDetailOpen(false);
    setActiveSection("review");
  }

  async function handleSaveEditorProfile(nextProfile: CandidatePortalProfile["profile"]) {
    setLocalError("");
    try {
      setDraft(nextProfile);
      await saveProfile(nextProfile);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleCreateVersion() {
    setLocalError("");
    try {
      const version = await createVersion(versionTitle, targetRole);
      if (version) {
        setSelectedVersionId(version.id);
        setSelectedVersion(version);
        setVersionDetailOpen(true);
        setActiveSection("review");
      }
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleArchiveSelectedVersion() {
    if (!selectedVersionId) return;
    const confirmed = window.confirm("Archive this resume version? It will be hidden from the active Application Vault, but not hard deleted.");
    if (!confirmed) return;
    setLocalError("");
    try {
      await archiveVersion(selectedVersionId);
      const next = versions.find((item) => item.id !== selectedVersionId);
      setSelectedVersionId(next?.id ?? "");
      setSelectedVersion(null);
      setVersionDetailOpen(false);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleCreateShare() {
    if (!selectedVersionId) return;
    setLocalError("");
    try {
      const share = await createShare(selectedVersionId, shareLabel, shareIncludePii);
      if (share) setShareLabel(`${selectedVersion?.title || "Resume"} share`);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleCreateApplication() {
    if (!selectedVersionId || !applicationDestination.trim()) return;
    setLocalError("");
    try {
      const application = await createApplication({
        resume_version_id: selectedVersionId,
        destination_name: applicationDestination,
        destination_type: applicationDestinationType,
        job_title: applicationJobTitle,
        job_url: applicationJobUrl,
        status: applicationStatus,
        note: applicationNote,
        create_share_link: applicationCreateShare,
        include_pii: applicationIncludePii,
      });
      if (application) {
        setApplicationDestination("");
        setApplicationJobTitle("");
        setApplicationJobUrl("");
        setApplicationNote("");
        setApplicationCreateShare(false);
        setApplicationIncludePii(false);
      }
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleUpdateApplicationStatus(applicationId: string, status: string) {
    setLocalError("");
    try {
      await updateApplication(applicationId, { status });
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleRevokeShare(shareId: string) {
    setLocalError("");
    try {
      await revokeShare(shareId);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleAccessDecision(requestId: string, decision: "approve" | "deny") {
    setLocalError("");
    try {
      await decideAccessRequest(requestId, decision);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleUploadResume() {
    if (!resumeFile) return;
    setLocalError("");
    try {
      const upload = await uploadResume(resumeFile, uploadTargetRole, uploadNote);
      if (upload) {
        setActiveUploadId(upload.id);
        setActiveSection("upload");
        setResumeFile(null);
      }
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  async function handleMatchRequirement() {
    if (!selectedVersionId) return;
    setLocalError("");
    try {
      const result = await matchRequirement(selectedVersionId, requirementText);
      setSelfMatch(result);
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  function updateRequirementText(value: string) {
    setRequirementText(value);
    setSelfMatch(null);
  }

  function handleExportSelectedVersion() {
    if (!selectedVersionId) return;
    window.location.href = candidateResumeVersionPdfPath(selectedVersionId, selectedTemplateId);
  }

  function handlePreviewSelectedVersion() {
    if (!selectedVersionId) return;
    window.open(candidateResumeVersionHtmlPath(selectedVersionId, selectedTemplateId), "_blank", "noopener,noreferrer");
  }

  function recordAiLearning(type: string, detail: string, event: Partial<{
    original_text: string;
    suggested_text: string;
    accepted: boolean;
    metadata: Record<string, any>;
  }> = {}) {
    setLocalAiLearningEvents((items) => [
      { type, detail, created_at: new Date().toISOString() },
      ...items,
    ].slice(0, 8));
    void recordAiLearningEvent({
      event_type: type,
      source: "candidate_editor",
      suggested_text: event.suggested_text ?? detail,
      original_text: event.original_text,
      accepted: event.accepted,
      metadata: event.metadata,
    });
  }

  async function handleToggleNativeSearch(enabled: boolean) {
    setLocalError("");
    try {
      await savePrivacySettings({
        candidate_signal_native_search_enabled: enabled,
        pii_permission_required: true,
        pii_visible_to_recruiters: false,
      });
    } catch (error) {
      setLocalError(readableError(error));
    }
  }

  const resume = selectedVersion?.resume_json ?? candidateResumeFromProfile(profile?.profile ?? {});
  const privacySettings = profile?.privacy_settings ?? {};
  const sectionCopy = candidatePortalSectionCopy(activeSection, latestUpload, versions.length);
  const selectedVersionApplications = applications.filter((item) => item.resume_version_id === selectedVersionId);
  const showUploadSideRail = Boolean((activeUpload && ["queued", "running", "failed"].includes(activeUpload.status)) || uploads.length);

  function openVersionDetail(versionId: string) {
    setSelectedVersionId(versionId);
    setVersionDetailOpen(true);
    setActiveSection("review");
  }

  function openVersionEditor(versionId: string) {
    const version = versions.find((item) => item.id === versionId) || (selectedVersion?.id === versionId ? selectedVersion : null);
    setSelectedVersionId(versionId);
    setEditingVersionId(versionId);
    setEditingVersionTitle(version?.title || "Resume version");
    setEditingVersionTargetRole(version?.target_role || "");
    setVersionEditorOpen(true);
    setActiveSection("review");
  }

  async function handleSaveVersionEditorProfile(nextProfile: CandidatePortalProfile["profile"]) {
    if (!editingVersionId) return;
    const saved = await updateVersion(editingVersionId, {
      title: editingVersionTitle.trim() || "Resume version",
      target_role: editingVersionTargetRole.trim() || null,
      resume_json: candidateResumeFromProfile(nextProfile),
    });
    if (saved) {
      setSelectedVersion(saved);
      setSelectedVersionId(saved.id);
      setEditingVersionTitle(saved.title);
      setEditingVersionTargetRole(saved.target_role || "");
    }
  }

  return (
    <section className="candidatePortalShell">
      <header className="candidatePortalTopbar">
        <a className="publicBrand" href="/">
          <BrandMark />
          <strong>candidateSignal<span>.ai</span></strong>
        </a>
        <div>
          <span>{user?.email}</span>
          <button className="plain" type="button" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>
      <nav className="candidatePortalNav" aria-label="Candidate workspace sections">
        {[
          ["dashboard", "Home"],
          ["review", "My Resumes"],
          ["match", "Jobs"],
          ["upload", "Upload"],
        ].map(([id, label]) => (
          <button key={id} className={activeSection === id ? "active" : ""} type="button" onClick={() => {
            if (id === "review") setVersionDetailOpen(false);
            setActiveSection(id as typeof activeSection);
          }}>
            {label}
          </button>
        ))}
      </nav>
      {activeSection !== "dashboard" ? (
        <section className="candidatePortalHero compact">
          <div>
            <span className="eyebrow">{sectionCopy.eyebrow}</span>
            <h1>{sectionCopy.title}</h1>
            <p>{sectionCopy.body}</p>
          </div>
          {uploadInProgress || busy ? (
            <div className="candidatePortalStatus">
              <strong>{uploadInProgress ? "Parsing" : "Saving"}</strong>
              <span>{uploadInProgress ? `${activeUpload?.stage_label ?? "Parsing"} · ${activeUpload?.progress ?? 0}%` : status}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {localError ? <div className="loginError candidatePortalError">{localError}</div> : null}

      {activeSection === "dashboard" ? (
        <CandidateHomeCommandCenter
          profile={profile?.profile ?? {}}
          latestUpload={latestUpload}
          activeUpload={activeUpload}
          versions={versions}
          applications={applications}
          accessRequests={accessRequests}
          profileCompleteness={profileCompleteness}
          needsReview={needsReview}
          resume={resume}
          selectedVersion={selectedVersion}
          selectedTemplateId={selectedTemplateId}
          busy={busy}
          uploadInProgress={uploadInProgress}
          openUpload={() => setActiveSection("upload")}
          startFromScratch={handleStartFromScratch}
          openEditor={() => {
            const versionId = selectedVersionId || versions[0]?.id || "";
            if (versionId) openVersionEditor(versionId);
            else handleStartFromScratch();
          }}
          openVersions={() => {
            setVersionDetailOpen(false);
            setActiveSection("review");
          }}
          openVersion={(versionId) => openVersionDetail(versionId)}
          openJobBoard={() => setActiveSection("match")}
          openSubmissionTracker={openSubmissionTracker}
        />
      ) : null}

      {activeSection === "upload" ? (
        <section className={showUploadSideRail ? "candidateUploadWorkspace" : "candidateUploadWorkspace single"}>
          <article className="candidatePortalCard candidateUploadPrimary">
            <div className="candidateUploadPrimaryHead">
              <div>
                <span className="eyebrow">Upload</span>
                <h2>Start from a real resume</h2>
                <p>Choose a file, preview it, then parse it into an editable resume profile.</p>
              </div>
              <button className="secondary" type="button" onClick={handleStartFromScratch}>Start from scratch</button>
            </div>
            <label className="candidateFilePicker">
              <FileUp size={24} />
              <strong>{resumeFile ? resumeFile.name : "Drop or choose a resume"}</strong>
              <span>{DOCUMENT_FORMAT_LABEL}</span>
              <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)} />
            </label>
            {resumeFile ? (
              <div className="candidateUploadPreviewBlock">
                <div className="candidateUploadPreviewHead">
                  <div>
                    <span className="eyebrow">Preview before parse</span>
                    <strong>{resumeFile.name}</strong>
                  </div>
                  <button className="plain small" type="button" onClick={() => setResumeFile(null)}>Remove</button>
                </div>
                <CandidatePreParsePreview
                  file={resumeFile}
                  previewUrl={resumePreviewUrl}
                  previewKind={resumePreviewKind}
                  documentHtml={resumePreviewHtml}
                  loading={resumePreviewLoading}
                  error={resumePreviewError}
                  clear={() => setResumeFile(null)}
                />
              </div>
            ) : (
              <div className="candidateUploadQuietHint">
                <span>Preview is shown after selection. Nothing is parsed until you confirm.</span>
              </div>
            )}
            <details className="candidateUploadOptional">
              <summary>Add target role or note <span>Optional</span></summary>
              <div className="candidateFormGrid">
                <label>Target role<input value={uploadTargetRole} onChange={(event) => setUploadTargetRole(event.target.value)} placeholder="Data Engineer, Reliability Engineer..." /></label>
                <label>Upload note<input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} placeholder="Context for this resume" /></label>
              </div>
            </details>
            <div className="candidateUploadSubmitRow">
              <button className="primary" type="button" disabled={!resumeFile || busy} onClick={handleUploadResume}>
                {busy ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />} Confirm and parse resume
              </button>
              <span>After parsing, review facts in Resume before creating versions.</span>
            </div>
          </article>
          {showUploadSideRail ? (
          <aside className="candidateUploadSideRail">
            {activeUpload && ["queued", "running", "failed"].includes(activeUpload.status) ? (
              <div className="candidateUploadStatusCard">
                <span>{humanizeLabel(activeUpload.status)}</span>
                <strong>{activeUpload.original_filename}</strong>
                <ProgressBar value={activeUpload.progress} />
                <p>{activeUpload.status === "succeeded" ? "Your resume is ready to review. Confirm the details before exporting." : activeUpload.stage_label ?? "We are preparing your editable profile."}</p>
                <button className="secondary" type="button" onClick={() => activeUpload.status === "succeeded" ? setScratchEditorOpen(true) : setActiveSection("review")}>
                  {activeUpload.status === "succeeded" ? "Edit parsed resume" : "Open resume workspace"}
                </button>
              </div>
            ) : null}
            {uploads.length ? (
              <details className="candidatePortalCard candidateUploadHistoryCard">
                <summary>Recent uploads</summary>
                <CandidateUploadList
                  uploads={uploads}
                  activeUploadId={activeUpload?.id ?? ""}
                  selectUpload={(id) => { setActiveUploadId(id); setActiveSection("review"); }}
                  retryUpload={retryUpload}
                />
              </details>
            ) : null}
          </aside>
          ) : null}
        </section>
      ) : null}

      {activeSection === "review" ? (
        !versionDetailOpen ? (
          <CandidateVersionDatabase
            versions={versions}
            selectedVersionId={selectedVersionId}
            query={versionQuery}
            setQuery={setVersionQuery}
            applications={applications}
            versionTitle={versionTitle}
            setVersionTitle={setVersionTitle}
            targetRole={targetRole}
            setTargetRole={setTargetRole}
            busy={busy}
            createVersion={handleCreateVersion}
            openVersion={openVersionDetail}
            editVersion={openVersionEditor}
          />
        ) : (
          <section className="candidateResumeWorkspace">
          <article className="candidatePortalCard cvPreviewCard candidateResumeMain">
            <div className="candidatePortalSectionHead candidateResumeHead">
              <div>
                <span className="eyebrow">Resume preview</span>
                <h2>{selectedVersion?.title || "Master resume preview"}</h2>
                <p>Preview the final candidate-owned resume. If something is wrong, fix it in Editor; if it is ready, export or share this version.</p>
              </div>
              <div className="candidateVersionActions">
                <button className="plain" type="button" onClick={() => setVersionDetailOpen(false)}>All versions</button>
                <button className="primary" type="button" onClick={() => selectedVersionId ? openVersionEditor(selectedVersionId) : setScratchEditorOpen(true)}>Edit resume</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={() => openSubmissionTracker(selectedVersionId)}>Log submission</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={handleExportSelectedVersion}>
                  <FileSearch size={15} /> Download PDF
                </button>
                <button className="plain dangerText" type="button" disabled={!selectedVersionId} onClick={handleArchiveSelectedVersion}>Archive</button>
              </div>
            </div>
            <CandidateCvPreview resume={resume} templateId={selectedTemplateId} />
          </article>
          <aside className="candidateResumeRail">
            <CandidateTemplateSelector selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} />
            <CandidateAtsConfidencePanel profile={profile?.profile ?? {}} resume={resume} selectedTemplateId={selectedTemplateId} versions={versions} applications={applications} />
            <CandidateVersionDiffPanel baseResume={candidateResumeFromProfile(profile?.profile ?? {})} version={selectedVersion} resume={resume} />
            <CandidateApplicationTracker
              applications={selectedVersionApplications}
              selectedVersionId={selectedVersionId}
              destination={applicationDestination}
              setDestination={setApplicationDestination}
              destinationType={applicationDestinationType}
              setDestinationType={setApplicationDestinationType}
              jobTitle={applicationJobTitle}
              setJobTitle={setApplicationJobTitle}
              jobUrl={applicationJobUrl}
              setJobUrl={setApplicationJobUrl}
              status={applicationStatus}
              setStatus={setApplicationStatus}
              note={applicationNote}
              setNote={setApplicationNote}
              createShare={applicationCreateShare}
              setCreateShare={setApplicationCreateShare}
              includePii={applicationIncludePii}
              setIncludePii={setApplicationIncludePii}
              busy={busy}
              save={handleCreateApplication}
              updateStatus={handleUpdateApplicationStatus}
            />
            <details className="candidateControlDisclosure">
              <summary>Recruiter visibility and sharing</summary>
              <CandidateVisibilityPanel
                settings={privacySettings}
                busy={busy}
                toggleNativeSearch={handleToggleNativeSearch}
              />
              <CandidateSharePanel
                shares={shares}
                selectedVersionId={selectedVersionId}
                shareLabel={shareLabel}
                setShareLabel={setShareLabel}
                includePii={shareIncludePii}
                setIncludePii={setShareIncludePii}
                busy={busy}
                createShare={handleCreateShare}
                revokeShare={handleRevokeShare}
              />
              <CandidateAccessRequestsPanel
                accessRequests={accessRequests}
                busy={busy}
                decide={handleAccessDecision}
              />
            </details>
          </aside>
        </section>
        )
      ) : null}

      {activeSection === "match" ? (
        <section className="candidatePortalGrid">
        <CandidatePracticalJobBoard
          profile={profile?.profile ?? {}}
          versions={versions}
          selectedVersionId={selectedVersionId}
          setSelectedVersionId={setSelectedVersionId}
          setRequirementText={updateRequirementText}
        />
        <article className="candidatePortalCard">
          <div className="candidatePortalSectionHead">
            <div>
              <span className="eyebrow">Resume version</span>
              <h2>Match a specific job</h2>
              <p>Use a practical job card as a starting point or paste a real requirement.</p>
            </div>
          </div>
          <label>Resume version
            <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
              <option value="">Select version</option>
              {versions.map((version) => <option value={version.id} key={version.id}>{version.title} · {version.target_role || "General"}</option>)}
            </select>
          </label>
          <textarea value={requirementText} onChange={(event) => updateRequirementText(event.target.value)} rows={9} placeholder="Paste a job requirement here..." />
          <button className="primary fullWidth" type="button" onClick={handleMatchRequirement} disabled={busy || !selectedVersionId || requirementText.trim().length < 20}>Match this version</button>
          {selfMatch ? (
            <div className="candidateSelfMatch">
              <strong>{selfMatch.score}% · {humanizeLabel(selfMatch.fit_label)}</strong>
              <p>{selfMatch.summary}</p>
              <span>{selfMatch.recommended_next_action}</span>
              <div>
                <h4>Matched</h4>
                <p>{selfMatch.matched_terms.slice(0, 18).join(", ") || "No clear matched terms yet."}</p>
              </div>
              <div>
                <h4>Missing or unclear</h4>
                <p>{selfMatch.missing_or_unclear_terms.slice(0, 18).join(", ") || "No major missing terms detected."}</p>
              </div>
              <small>{selfMatch.privacy_note}</small>
            </div>
          ) : null}
        </article>
        </section>
      ) : null}

      {versionEditorOpen ? (
        <CandidateVersionEditorOverlay
          version={selectedVersionId === editingVersionId ? selectedVersion : null}
          fallbackProfile={profile?.profile ?? {}}
          title={editingVersionTitle}
          setTitle={setEditingVersionTitle}
          targetRole={editingVersionTargetRole}
          setTargetRole={setEditingVersionTargetRole}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          close={() => setVersionEditorOpen(false)}
          saveVersionProfile={handleSaveVersionEditorProfile}
          previewVersion={handlePreviewSelectedVersion}
          exportVersion={handleExportSelectedVersion}
          requestAiSuggestion={(payload) => suggestAiEdit({ ...payload, target_role: editingVersionTargetRole, requirement_text: requirementText })}
          recordAiLearning={recordAiLearning}
          busy={busy}
        />
      ) : null}
      {scratchEditorOpen ? (
        <CandidateScratchEditorOverlay
          profile={draft}
          title={versionTitle}
          setTitle={setVersionTitle}
          targetRole={targetRole}
          setTargetRole={setTargetRole}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          close={() => setScratchEditorOpen(false)}
          saveProfile={handleSaveEditorProfile}
          createVersion={async () => {
            await handleCreateVersion();
            setScratchEditorOpen(false);
          }}
          requestAiSuggestion={(payload) => suggestAiEdit({ ...payload, target_role: targetRole, requirement_text: requirementText })}
          recordAiLearning={recordAiLearning}
          busy={busy}
        />
      ) : null}
    </section>
  );
}

function autoBatchNameForFiles(files: File[], campaignName?: string | null) {
  const count = files.length;
  const date = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (!count) return campaignName ? `${campaignName} upload` : "Resume upload";
  if (count === 1) return `${campaignName ? `${campaignName} - ` : ""}${files[0].name}`;
  return `${campaignName ? `${campaignName} - ` : ""}${count} resumes - ${date}`;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isActiveBatch(batch: ParseBatch) {
  return isActiveBatchStatus(batch.status);
}

function isActiveBatchStatus(status: string) {
  return ["created", "queued", "running", "processing", "retrying"].includes(status);
}

function isActiveMaintenanceJob(job: CandidateMaintenanceJob) {
  return ["queued", "running"].includes(job.status);
}

function formatRole(value?: string | null) {
  if (!value) return "User";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Action failed");
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? JSON.stringify(item)).join("; ");
  } catch {
    // Fall through to normalized raw text.
  }
  if (raw === "Failed to fetch") return "Cannot reach the backend. Check that the API is running on 127.0.0.1:8010.";
  if (raw.includes("Login did not return a session")) return "Login succeeded but the session could not be restored. Refresh the page and try again.";
  return raw;
}
