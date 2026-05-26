"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  FileUp,
  GitBranch,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
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
  CandidateApplication,
  CandidateAccessRequest,
  CandidateSelfMatch,
  NativeCandidateSummary,
  CampaignPipelineStatus,
  CampaignScorecard,
  CandidateMaintenanceJob,
  CandidateSummary,
  CollaborationComment,
  LinkedInImportJob,
  LinkedInVerificationRun,
  AuditEvent,
  CopilotThread,
  CurrentUser,
  CandidateVersionMatch,
  GovernancePolicy,
  JobCampaign,
  JobCampaignCandidate,
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
  RecruiterTask,
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
  createCandidatePortalTargetedVersion,
  createCandidatePortalResumeShare,
  createCandidatePortalApplication,
  createCampaign,
  createCampaignRequirement,
  createCandidateRederiveJob,
  createCollaborationComment,
  createRecruiterTask,
  createTenant,
  createRequirement,
  createRequirementFromCopilotThread,
  decideCandidateVersion,
  decideCandidatePortalAccessRequest,
  deleteCollaborationComment,
  deleteCandidate,
  deleteRecruiterTask,
  getTeam,
  getCampaign,
  getCandidateDocumentHtml,
  getCampaignMatchJob,
  getLinkedInVerification,
  getLinkedInImport,
  getCopilotThread,
  getTenantAdminDetail,
  getCandidateRawText,
  getCandidatePortalProfile,
  getCandidatePortalResumeUpload,
  getCandidatePortalResumeVersion,
  candidateResumeVersionHtmlPath,
  candidateResumeVersionPdfPath,
  getCandidateSource,
  getCandidate,
  getRequirementMatches,
  listRequirementMatchRuns,
  compareLatestRequirementMatchRuns,
  finalizeRequirement,
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
  listCampaigns,
  listCopilotThreads,
  listAuditLogs,
  listCandidateVersionClusters,
  listOperationalAlertDeliveries,
  listOperationalAlerts,
  listPiiAccessEvents,
  listCandidateMaintenanceJobs,
  listCollaborationComments,
  listMailMessages,
  listParseDeadLetters,
  listParseBatches,
  listRecruiterTasks,
  listRequirements,
  listTenants,
  listNativeCandidates,
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
  requestNativeCandidateAccess,
  retryCandidateMaintenanceJob,
  retryMailMessage,
  retryParseJob,
  reparseCandidate,
  searchCandidates,
  shortlistMatch,
  matchCandidatePortalRequirement,
  updateMemberRole,
  updateNote,
  updateCandidatePortalProfile,
  updateCandidatePortalApplication,
  updateCandidatePortalPrivacySettings,
  uploadRequirement,
  uploadResume,
  uploadCampaignResumes,
  updateCampaignCandidateStatus,
  updateCampaign,
  updateCandidateProfile,
  updateCampaignScorecard,
  updateGovernancePolicy,
  updateRecruiterTask,
  uploadCampaignRequirement,
  uploadCandidatePortalResume,
  verifyLinkedInProfile,
  deleteNote,
  disableTenant,
  disableMember,
  COOKIE_SESSION_TOKEN,
} from "../lib/api";
import { authClient, signInWithBetterAuth } from "../lib/auth-client";
import { BrandMark } from "./components/brand";
import { EmptyPanel, Metric, ProgressBar } from "./components/primitives";
import { RECRUITER_COPY, WORKSPACE_NAV_LABELS } from "./components/recruiter-language";
import {
  candidateVersionCompareRows,
  candidateVersionDocumentLabel,
  candidateVersionLinks,
  candidateVersionSummary,
  normalizeCandidateVersionStatus,
  versionStatusLabel,
} from "./lib/candidate-versions";
import {
  COPILOT_GREETING,
  buildCopilotQueryInsights,
  copilotAnalysisQuery,
  copilotResultReason,
  copilotThreadMessages,
  filterCopilotCandidates,
  locationRequirementLabel,
  normalizeCopilotQueryIntent,
  normalizedCopilotScoreBreakdown,
  percentScore,
  rewriteCopilotLocationPreference,
  scoreBreakdownItems,
  type CopilotFilters,
  type WorkspaceChatMessage,
} from "./lib/copilot";
import { domainLabel, formatBytes, formatDateTime, shortHash, splitCommaList, textValue, toTextList, uniqueTextList } from "./lib/format";
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FORMAT_LABEL, resolveLoginIdentifier } from "./lib/login";
import { copyCurrentUrl, parseWorkspaceRoute, routeHasDeepLink, type CampaignDetailTab, type CandidateDetailTab, type View, type WorkspaceRoute } from "./lib/workspace-route";

type CandidateReviewSignal = "low_coverage" | "role_fact_review" | "profile_freshness_review";
type ReviewCenterItem = {
  title: string;
  body: string;
  action: string;
  doneAction?: string;
  label: string;
  run: () => void;
  done?: () => void;
};

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
const CANDIDATE_RESUME_TEMPLATES = [
  { id: "atlas", name: "Atlas", tone: "Balanced", note: "Clean professional default for most roles." },
  { id: "classic", name: "Classic", tone: "Traditional", note: "Best for conservative HR and academic-style readers." },
  { id: "modern", name: "Modern", tone: "Sharp", note: "Stronger hierarchy without breaking ATS safety." },
  { id: "compact", name: "Compact", tone: "Dense", note: "For longer careers that need tight spacing." },
  { id: "executive", name: "Executive", tone: "Senior", note: "For leadership, strategy, and client-facing profiles." },
  { id: "technical", name: "Technical", tone: "Engineering", note: "For software, data, infra, and technical roles." },
  { id: "academic", name: "Academic", tone: "Research", note: "For publications, education, and research-heavy profiles." },
  { id: "startup", name: "Startup", tone: "Builder", note: "For founding, product, and high-ownership resumes." },
  { id: "consulting", name: "Consulting", tone: "Client-ready", note: "For business, transformation, and advisory roles." },
  { id: "minimal", name: "Minimal", tone: "ATS-first", note: "Maximum simplicity for strict ATS parsing." },
] as const;

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
  const [nativeCandidateQuery, setNativeCandidateQuery] = useState("");
  const [nativeCandidates, setNativeCandidates] = useState<NativeCandidateSummary[]>([]);
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
    if (!lockedLoginMode && (login === "company" || login === "candidate")) setLoginMode(login);
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
      const [profileResult, versionResult, uploadResult, shareResult, applicationResult, accessResult] = await Promise.all([
        getCandidatePortalProfile(activeToken),
        listCandidatePortalResumeVersions(activeToken),
        listCandidatePortalResumeUploads(activeToken),
        listCandidatePortalResumeShares(activeToken),
        listCandidatePortalApplications(activeToken),
        listCandidatePortalAccessRequests(activeToken),
      ]);
      setCandidatePortalProfile(profileResult);
      setCandidateResumeVersions(versionResult.versions ?? []);
      setCandidateResumeUploads(uploadResult.uploads ?? []);
      setCandidateResumeShares(shareResult.shares ?? []);
      setCandidateApplications(applicationResult.applications ?? []);
      setCandidateAccessRequests(accessResult.access_requests ?? []);
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
    setNativeCandidateQuery("");
    setNativeCandidates([]);
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

  async function handleCreateCandidatePortalTargetedVersion(versionId: string, payload: { requirement_text: string; title?: string; target_role?: string }) {
    const result = await run("Creating targeted resume version", () => createCandidatePortalTargetedVersion(token, versionId, payload));
    if (!result) return null;
    setCandidateResumeVersions((items) => [result.version, ...items.filter((item) => item.id !== result.version.id)]);
    return result;
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

  async function handleCandidatePortalRequirementMatch(versionId: string, requirementText: string) {
    const result = await run("Matching resume version", () => matchCandidatePortalRequirement(token, versionId, requirementText));
    return result?.match ?? null;
  }

  async function handleSearchNativeCandidates(searchText = nativeCandidateQuery) {
    const result = await run("Searching candidateSignal native candidates", () => listNativeCandidates(token, searchText, 20));
    if (result) setNativeCandidates(result.native_candidates ?? []);
  }

  async function handleRequestNativeCandidateAccess(candidateUserId: string, resumeVersionId?: string | null) {
    const result = await run("Requesting candidate PII access", () => requestNativeCandidateAccess(token, candidateUserId, "Recruiter is interested in this candidate for a role and requests permission to view contact details.", resumeVersionId));
    if (!result) return;
    setNativeCandidates((items) => items.map((item) => item.candidate_user_id === candidateUserId ? { ...item, request_status: result.access_request.status } : item));
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
          <EnvironmentBanner />
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
        <EnvironmentBanner />
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
        <EnvironmentBanner />
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
      <EnvironmentBanner />
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
              nativeQuery={nativeCandidateQuery}
              setNativeQuery={setNativeCandidateQuery}
              nativeCandidates={nativeCandidates}
              searchNativeCandidates={handleSearchNativeCandidates}
              requestNativeAccess={handleRequestNativeCandidateAccess}
              busy={busy}
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
              status={status}
              busy={busy}
              previewResume={handlePreviewCandidatePortalResume}
              uploadResume={handleUploadCandidatePortalResume}
              refreshUpload={handleRefreshCandidatePortalUpload}
              saveProfile={handleSaveCandidatePortalProfile}
              savePrivacySettings={handleSaveCandidatePortalPrivacySettings}
              createVersion={handleCreateCandidatePortalVersion}
              createTargetedVersion={handleCreateCandidatePortalTargetedVersion}
              archiveVersion={handleArchiveCandidatePortalVersion}
              createShare={handleCreateCandidatePortalShare}
              revokeShare={handleRevokeCandidatePortalShare}
              createApplication={handleCreateCandidatePortalApplication}
              updateApplication={handleUpdateCandidatePortalApplication}
              decideAccessRequest={handleCandidateAccessDecision}
              loadVersion={handleLoadCandidatePortalVersion}
              matchRequirement={handleCandidatePortalRequirementMatch}
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

function EnvironmentBanner() {
  if (!IS_STAGING_ENV) return null;
  return (
    <aside className="environmentBanner" role="note" aria-label="Staging environment">
      <strong>Staging Environment</strong>
      <span>Test data only. Do not upload production resumes or customer information.</span>
    </aside>
  );
}

type CandidatePortalSection = "dashboard" | "upload" | "review" | "profile" | "match";

const CANDIDATE_PORTAL_SECTIONS: CandidatePortalSection[] = ["dashboard", "upload", "review", "profile", "match"];

function candidatePortalSectionFromSearch(search: string, fallback: CandidatePortalSection = "dashboard"): CandidatePortalSection {
  const params = new URLSearchParams(search);
  const value = params.get("candidate_view") || params.get("section");
  if (value === "versions" || value === "export") return "review";
  if (value === "editor") return "profile";
  if (value === "job_board") return "match";
  return CANDIDATE_PORTAL_SECTIONS.includes(value as CandidatePortalSection) ? value as CandidatePortalSection : fallback;
}

function candidatePortalSectionCopy(section: CandidatePortalSection, latestUpload: CandidateResumeUpload | null, versionCount: number) {
  if (section === "upload") {
    return {
      eyebrow: "Upload",
      title: "Bring in your existing resume.",
      body: "Preview the file first, then turn it into an editable master profile you control.",
    };
  }
  if (section === "review") {
    return {
      eyebrow: "Resume",
      title: versionCount ? "Manage your resume versions." : "Create your first clean resume version.",
      body: "Open a version to edit, preview, export as PDF, share safely, or tailor it to a job.",
    };
  }
  if (section === "profile") {
    return {
      eyebrow: "Editor",
      title: "Shape the resume people will actually read.",
      body: "Update facts, improve bullets, add sections, and keep the master profile clean before creating role-specific versions.",
    };
  }
  if (section === "match") {
    return {
      eyebrow: "Jobs",
      title: "Tailor one version to one job.",
      body: "Paste a job requirement, choose a resume version, and get a clear fit read before applying.",
    };
  }
  return {
    eyebrow: "Candidate workspace",
    title: latestUpload ? "Own the resume you send." : "Start from the resume you already have.",
    body: "Maintain one approved profile, create targeted versions, export clean PDFs, and track where every version was shared.",
  };
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
  saveProfile,
  savePrivacySettings,
  createVersion,
  createTargetedVersion,
  archiveVersion,
  createShare,
  revokeShare,
  createApplication,
  updateApplication,
  decideAccessRequest,
  loadVersion,
  matchRequirement,
  logout,
}: {
  user: CurrentUser | null;
  profile: CandidatePortalProfile | null;
  uploads: CandidateResumeUpload[];
  versions: CandidateResumeVersion[];
  shares: CandidateResumeShare[];
  applications: CandidateApplication[];
  accessRequests: CandidateAccessRequest[];
  status: string;
  busy: boolean;
  previewResume: (file: File) => Promise<{ filename: string; source_type: string; html: string }>;
  uploadResume: (file: File, targetRole?: string, note?: string) => Promise<CandidateResumeUpload | null>;
  refreshUpload: (uploadId: string) => Promise<CandidateResumeUpload>;
  saveProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>;
  savePrivacySettings: (settings: CandidatePortalPrivacySettings) => Promise<void>;
  createVersion: (title: string, targetRole?: string, resumeJson?: Record<string, any>) => Promise<CandidateResumeVersion | null>;
  createTargetedVersion: (versionId: string, payload: { requirement_text: string; title?: string; target_role?: string }) => Promise<{ version: CandidateResumeVersion; match: CandidateSelfMatch } | null>;
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
  logout: () => void;
}) {
  const [draft, setDraft] = useState<CandidatePortalProfile["profile"]>({});
  const [skillsText, setSkillsText] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [awardsText, setAwardsText] = useState("");
  const [publicationsText, setPublicationsText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [linksText, setLinksText] = useState("");
  const [referencesText, setReferencesText] = useState("");
  const [experienceItems, setExperienceItems] = useState<Array<Record<string, any>>>([]);
  const [educationItems, setEducationItems] = useState<Array<Record<string, any>>>([]);
  const [projectItems, setProjectItems] = useState<Array<Record<string, any>>>([]);
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
  const [versionQuery, setVersionQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("atlas");
  const [requirementText, setRequirementText] = useState("");
  const [selfMatch, setSelfMatch] = useState<CandidateSelfMatch | null>(null);
  const [coachInput, setCoachInput] = useState("");
  const [coachMessages, setCoachMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([
    { role: "assistant", content: "I can help improve positioning, tighten bullets, suggest missing evidence, and decide which resume version/template fits a job." },
  ]);
  const [scratchMode, setScratchMode] = useState(false);
  const [localError, setLocalError] = useState("");
  const candidateUrlReadyRef = useRef(false);

  const latestUpload = uploads[0] ?? null;
  const activeUpload = uploads.find((item) => item.id === activeUploadId) ?? latestUpload;
  const uploadInProgress = Boolean(activeUpload && ["queued", "running"].includes(activeUpload.status));
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
    if ((activeSection === "review" || activeSection === "profile") && activeUpload?.id) params.set("upload", activeUpload.id);
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
    setSkillsText((next.skills ?? []).join(", "));
    setCertificationsText((next.certifications ?? []).join("\n"));
    setAwardsText((next.awards ?? []).join("\n"));
    setPublicationsText((next.publications ?? []).join("\n"));
    setLanguagesText((next.languages ?? []).join(", "));
    setLinksText((next.links ?? []).join("\n"));
    setReferencesText(toTextList((next.other_sections ?? {}).references).join("\n"));
    setExperienceItems(next.experience ?? []);
    setEducationItems(next.education ?? []);
    setProjectItems(next.projects ?? []);
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
    if (!activeUpload || !["queued", "running"].includes(activeUpload.status)) return;
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

  function updateDraft(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleStartFromScratch() {
    setScratchMode(true);
    if (!versionTitle.trim()) setVersionTitle("General Resume");
    if (!draft.summary && !draft.headline) {
      setCoachMessages((items) => [
        ...items,
        {
          role: "assistant",
          content: "Start with identity, target role, education, experience/projects, and skills. Write rough bullets; I will help convert them into resume-ready language without inventing facts.",
        },
      ]);
    }
    setActiveSection("profile");
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

  async function handleSave() {
    setLocalError("");
    try {
      await saveProfile({
        ...draft,
        skills: splitCommaList(skillsText),
        certifications: certificationsText.split("\n").map((item) => item.trim()).filter(Boolean),
        experience: normalizeEditableProfileItems(experienceItems, "bullets"),
        education: normalizeEditableProfileItems(educationItems, "details"),
        projects: normalizeEditableProfileItems(projectItems, "bullets"),
        awards: splitLineList(awardsText),
        publications: splitLineList(publicationsText),
        languages: splitCommaList(languagesText),
        links: splitLineList(linksText),
        other_sections: {
          ...(draft.other_sections ?? {}),
          references: splitLineList(referencesText),
        },
      });
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

  async function handleSaveAndCreateVersion() {
    await handleSave();
    await handleCreateVersion();
  }

  async function handleCreateTargetedVersion() {
    const inferredRole = targetRole.trim() || inferTargetRoleFromRequirement(requirementText) || "Target Job";
    setLocalError("");
    try {
      const sourceVersionId = selectedVersionId || versions[0]?.id || "";
      if (!sourceVersionId) {
        const version = await createVersion(`${inferredRole} Resume`, inferredRole);
        if (version) {
          setSelectedVersionId(version.id);
          setSelectedVersion(version);
          setVersionDetailOpen(true);
          setActiveSection("review");
        }
        return;
      }
      if (requirementText.trim().length < 20) {
        setLocalError("Paste a job requirement first so the targeted version can be created from real evidence.");
        return;
      }
      const result = await createTargetedVersion(sourceVersionId, {
        requirement_text: requirementText,
        title: `${inferredRole} Resume`,
        target_role: inferredRole,
      });
      if (result?.version) {
        setSelfMatch(result.match);
        setSelectedVersionId(result.version.id);
        setSelectedVersion(result.version);
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

  function sendCoachMessage() {
    const message = coachInput.trim();
    if (!message) return;
    const reply = candidateCoachReply(profile?.profile ?? {}, message);
    setCoachMessages((items) => [...items, { role: "user", content: message }, { role: "assistant", content: reply }]);
    setCoachInput("");
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

  function openVersionDetail(versionId: string) {
    setSelectedVersionId(versionId);
    setVersionDetailOpen(true);
    setActiveSection("review");
  }

  function renderProfileEditor(context: "review" | "profile", showCoachTools = true) {
    const isReview = context === "review";
    return (
      <>
        <div className="candidatePortalSectionHead">
          <div>
            <span className="eyebrow">{isReview ? "Editable resume data" : "Resume sections"}</span>
            <h2>{isReview ? "Review and edit what was extracted" : "Edit resume content"}</h2>
            {isReview ? <p>Correct names, dates, links, bullets, projects, education, and skills. Saving updates the profile used for versions, matching, and exports.</p> : null}
          </div>
          <button className="primary" type="button" onClick={handleSave} disabled={busy}>{isReview ? "Save corrections" : "Save resume"}</button>
        </div>
        {showCoachTools ? <CandidateEditorCoachTools
          enhancement={normalizedAiEnhancement(draft.ai_enhancement)}
          applyHeadline={(value) => updateDraft("headline", value)}
          applySummary={(value) => updateDraft("summary", value)}
        /> : null}
        <div className="candidateFormGrid" data-candidate-editor-section="Identity">
          <label>Full name<input value={draft.display_name ?? ""} onChange={(event) => updateDraft("display_name", event.target.value)} /></label>
          <label>Headline<input value={draft.headline ?? ""} onChange={(event) => updateDraft("headline", event.target.value)} /></label>
          <label>Current location<input value={draft.current_location ?? ""} onChange={(event) => updateDraft("current_location", event.target.value)} /></label>
          <label>Email<input value={draft.email ?? ""} onChange={(event) => updateDraft("email", event.target.value)} /></label>
          <label>Phone<input value={draft.phone ?? ""} onChange={(event) => updateDraft("phone", event.target.value)} /></label>
          <label>LinkedIn URL<input value={draft.linkedin_url ?? ""} onChange={(event) => updateDraft("linkedin_url", event.target.value)} placeholder="Stored only. No candidate-side verification." /></label>
          <label>Portfolio URL<input value={draft.portfolio_url ?? ""} onChange={(event) => updateDraft("portfolio_url", event.target.value)} /></label>
          <label>GitHub URL<input value={draft.github_url ?? ""} onChange={(event) => updateDraft("github_url", event.target.value)} /></label>
        </div>
        <label className="candidateWideField" data-candidate-editor-section="Summary">Summary<textarea value={draft.summary ?? ""} onChange={(event) => updateDraft("summary", event.target.value)} rows={4} /></label>
        <label className="candidateWideField" data-candidate-editor-section="Skills">Skills<textarea value={skillsText} onChange={(event) => setSkillsText(event.target.value)} rows={3} placeholder="Python, Spark, Azure, Reliability Engineering" /></label>
        <div data-candidate-editor-section="Experience">
          <EditableProfileList
            title="Work experience"
            addLabel="Add role"
            items={experienceItems}
            setItems={setExperienceItems}
            detailsKey="bullets"
            enableWorkstreams
            fields={[
              { key: "title", label: "Title" },
              { key: "company", label: "Company" },
              { key: "location", label: "Location" },
              { key: "start_date", label: "Start" },
              { key: "end_date", label: "End" },
            ]}
            detailsLabel="Bullets"
          />
        </div>
        <div data-candidate-editor-section="Education">
          <EditableProfileList
            title="Education"
            addLabel="Add education"
            items={educationItems}
            setItems={setEducationItems}
            detailsKey="details"
            fields={[
              { key: "degree", label: "Degree" },
              { key: "school", label: "School" },
              { key: "field", label: "Field" },
              { key: "location", label: "Location" },
              { key: "start_date", label: "Start" },
              { key: "end_date", label: "End" },
            ]}
            detailsLabel="Details"
          />
        </div>
        <div data-candidate-editor-section="Projects">
          <EditableProfileList
            title="Projects"
            addLabel="Add project"
            items={projectItems}
            setItems={setProjectItems}
            detailsKey="bullets"
            fields={[
              { key: "name", label: "Project" },
              { key: "role", label: "Role" },
              { key: "start_date", label: "Start" },
              { key: "end_date", label: "End" },
            ]}
            detailsLabel="Project bullets"
          />
        </div>
        <section className="candidateOptionalSections" data-candidate-editor-section="Optional">
          <div>
            <span className="eyebrow">Optional sections</span>
            <h3>Add what this candidate actually has</h3>
            <p>Portfolio, references, publications, languages, awards, and extra links stay blank unless the candidate adds them.</p>
          </div>
          <label className="candidateWideField">Certifications<textarea value={certificationsText} onChange={(event) => setCertificationsText(event.target.value)} rows={4} placeholder="One certification per line" /></label>
          <label className="candidateWideField">Awards<textarea value={awardsText} onChange={(event) => setAwardsText(event.target.value)} rows={3} placeholder="One award per line" /></label>
          <label className="candidateWideField">Publications<textarea value={publicationsText} onChange={(event) => setPublicationsText(event.target.value)} rows={3} placeholder="One publication per line" /></label>
          <label className="candidateWideField">Languages<input value={languagesText} onChange={(event) => setLanguagesText(event.target.value)} placeholder="English, Hindi, Spanish" /></label>
          <label className="candidateWideField">Additional links<textarea value={linksText} onChange={(event) => setLinksText(event.target.value)} rows={3} placeholder="Portfolio, blog, publication, project, or other URLs. One per line." /></label>
          <label className="candidateWideField">References<textarea value={referencesText} onChange={(event) => setReferencesText(event.target.value)} rows={3} placeholder="Available on request, or named references only if you want them stored and exported." /></label>
        </section>
      </>
    );
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
          ["review", "Resume"],
          ["profile", "Editor"],
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
          openEditor={() => setActiveSection("profile")}
          openVersions={() => {
            setVersionDetailOpen(false);
            setActiveSection("review");
          }}
          openCreateVersion={() => {
            setVersionDetailOpen(false);
            setActiveSection("review");
          }}
          openVersion={(versionId) => openVersionDetail(versionId)}
          openJobBoard={() => setActiveSection("match")}
          openSubmissionTracker={openSubmissionTracker}
        />
      ) : null}

      {activeSection === "upload" ? (
        <section className="candidatePortalGrid">
          <article className="candidatePortalCard candidateUploadDrop">
            <div>
              <span className="eyebrow">Secure resume upload</span>
              <h2>Upload an existing resume</h2>
              <p>PDF, DOCX, TXT, and image resumes become an editable profile. You review the details before using them in any exported version.</p>
            </div>
            <label className="candidateFilePicker">
              <FileUp size={24} />
              <strong>{resumeFile ? resumeFile.name : "Drop or choose a resume"}</strong>
              <span>{DOCUMENT_FORMAT_LABEL}</span>
              <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)} />
            </label>
            <CandidatePreParsePreview
              file={resumeFile}
              previewUrl={resumePreviewUrl}
              previewKind={resumePreviewKind}
              documentHtml={resumePreviewHtml}
              loading={resumePreviewLoading}
              error={resumePreviewError}
              clear={() => setResumeFile(null)}
            />
            <div className="candidateFormGrid">
              <label>Target role<input value={uploadTargetRole} onChange={(event) => setUploadTargetRole(event.target.value)} placeholder="Data Engineer, Reliability Engineer..." /></label>
              <label>Upload note<input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} placeholder="Optional context for this resume" /></label>
            </div>
            <button className="primary" type="button" disabled={!resumeFile || busy} onClick={handleUploadResume}>
              {busy ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />} Confirm and parse resume
            </button>
            <div className="candidateStartScratchInline">
              <span>No resume file yet?</span>
              <button className="secondary" type="button" onClick={handleStartFromScratch}>Start from scratch instead</button>
            </div>
            {activeUpload ? (
              <div className="candidateUploadStatusCard">
                <span>{humanizeLabel(activeUpload.status)}</span>
                <strong>{activeUpload.original_filename}</strong>
                <ProgressBar value={activeUpload.progress} />
                <p>{activeUpload.status === "succeeded" ? "Your resume is ready to review. Confirm the details before exporting." : activeUpload.stage_label ?? "We are preparing your editable profile."}</p>
                <button className="secondary" type="button" onClick={() => setActiveSection(activeUpload.status === "succeeded" ? "profile" : "review")}>
                  {activeUpload.status === "succeeded" ? "Review extracted facts" : "Open resume workspace"}
                </button>
              </div>
            ) : null}
          </article>
          <aside className="candidatePortalCard">
            <div className="candidatePortalSectionHead">
              <div>
                <span className="eyebrow">Upload history</span>
                <h2>Recent uploads</h2>
              </div>
            </div>
            <CandidateUploadList uploads={uploads} activeUploadId={activeUpload?.id ?? ""} selectUpload={(id) => { setActiveUploadId(id); setActiveSection("review"); }} />
          </aside>
        </section>
      ) : null}

      {activeSection === "review" ? (
        !versionDetailOpen ? (
          <CandidateVersionDatabase
            versions={versions}
            selectedVersionId={selectedVersionId}
            query={versionQuery}
            setQuery={setVersionQuery}
            shares={shares}
            applications={applications}
            accessRequests={accessRequests}
            versionTitle={versionTitle}
            setVersionTitle={setVersionTitle}
            targetRole={targetRole}
            setTargetRole={setTargetRole}
            busy={busy}
            createVersion={handleCreateVersion}
            openVersion={openVersionDetail}
            editFacts={() => setActiveSection("profile")}
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
                <button className="primary" type="button" onClick={() => setActiveSection("profile")}>Edit resume</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={() => openSubmissionTracker(selectedVersionId)}>Log submission</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={handlePreviewSelectedVersion}>Open HTML</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={handleExportSelectedVersion}>
                  <FileSearch size={15} /> Download PDF
                </button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy link</button>
                <button className="plain dangerText" type="button" disabled={!selectedVersionId} onClick={handleArchiveSelectedVersion}>Archive</button>
              </div>
            </div>
            <CandidateCvPreview resume={resume} templateId={selectedTemplateId} />
          </article>
          <aside className="candidateResumeRail">
            <CandidateTemplateSelector selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} />
            <CandidateAtsConfidencePanel profile={profile?.profile ?? {}} resume={resume} selectedTemplateId={selectedTemplateId} versions={versions} applications={applications} />
            <CandidateVersionDiffPanel baseResume={candidateResumeFromProfile(profile?.profile ?? {})} version={selectedVersion} resume={resume} />
            <article className="candidatePortalCard candidateNextActionCard">
              <span className="eyebrow">What to do next</span>
              <h2>{selectedVersionId ? "This version is ready to use" : "Create or select a version"}</h2>
              <p>Edit the resume content, preview/export this version, or tailor it for a job.</p>
              <div className="candidateNextActions">
                <button className="primary" type="button" onClick={() => setActiveSection("profile")}>Edit resume</button>
                <button className="secondary" type="button" onClick={() => setVersionDetailOpen(false)}>Manage versions</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={() => setActiveSection("match")}>Match to a job</button>
                <button className="secondary" type="button" disabled={!selectedVersionId} onClick={() => openSubmissionTracker(selectedVersionId)}>Log where used</button>
              </div>
            </article>
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
            <article id="candidate-version-card" className="candidatePortalCard">
              <div className="candidatePortalSectionHead">
                <div>
                  <span className="eyebrow">Versions</span>
                  <h2>Application vault</h2>
                  <p>Create targeted versions from the same approved profile data.</p>
                </div>
              </div>
              <label>Version title<input value={versionTitle} onChange={(event) => setVersionTitle(event.target.value)} /></label>
              <label>Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Data Engineer, Reliability Engineer..." /></label>
              <button className="primary fullWidth" type="button" onClick={handleCreateVersion} disabled={busy || !versionTitle.trim()}>Create version</button>
              <div className="candidateVersionList compact">
                {versions.length ? versions.map((version) => (
                  <button key={version.id} className={selectedVersionId === version.id ? "active" : ""} type="button" onClick={() => setSelectedVersionId(version.id)}>
                    <strong>{version.title}</strong>
                    <span>{version.target_role || "General"} · {formatDateTime(version.updated_at)}</span>
                  </button>
                )) : <EmptyPanel title="No versions yet" body="Upload and parse a resume, then create the first version." />}
              </div>
            </article>
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

      {activeSection === "profile" ? (
        <section className="candidateAiEditorShell">
          <article className="candidateAiEditorMain">
            <header className="candidateAiEditorHero">
              <div>
                <span className="eyebrow">AI resume editor</span>
                <h1>Edit the resume people will actually read.</h1>
                <p>Change the resume directly, use the coach to improve positioning, then preview the exact version before exporting.</p>
              </div>
              <div>
                <button className="secondary" type="button" onClick={() => setActiveSection("review")}>Preview resume</button>
                <button className="secondary" type="button" onClick={() => document.querySelector(".candidateJobAiEditor")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Job editor</button>
                <button className="primary" type="button" onClick={handleSave} disabled={busy}>Save changes</button>
              </div>
            </header>
            {scratchMode || (!latestUpload && !versions.length) ? (
              <CandidateScratchBuilderGuide
                busy={busy}
                saveProfile={handleSave}
                createVersion={handleSaveAndCreateVersion}
              />
            ) : null}
            <div className="candidateAiEditorBody">
              <aside className="candidateEditorSectionNav" aria-label="Resume sections">
                {[
                  ["Identity", "Name, links, location"],
                  ["Summary", "Career positioning"],
                  ["Experience", "Roles and bullets"],
                  ["Projects", "Proof of work"],
                  ["Education", "Schools and degrees"],
                  ["Skills", "Keywords and tools"],
                  ["Optional", "Links, awards, references"],
                ].map(([title, body]) => (
                  <button key={title} type="button" onClick={() => document.querySelector(`[data-candidate-editor-section="${title}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </button>
                ))}
              </aside>
              <div className="candidateEditorFormSurface">
                {renderProfileEditor("profile", false)}
              </div>
            </div>
          </article>
          <aside className="candidateAiEditorRail">
            <CandidateBulletRewriteCard
              experienceItems={experienceItems}
              setExperienceItems={setExperienceItems}
            />
            <CandidateJobAiEditor
              versions={versions}
          selectedVersionId={selectedVersionId}
          setSelectedVersionId={setSelectedVersionId}
          targetRole={targetRole}
          setTargetRole={setTargetRole}
          requirementText={requirementText}
          setRequirementText={updateRequirementText}
          match={selfMatch}
          busy={busy}
              analyze={handleMatchRequirement}
              createTargetedVersion={handleCreateTargetedVersion}
              openJobBoard={() => setActiveSection("match")}
            />
            <CandidateCoachChat
              messages={coachMessages}
              input={coachInput}
              setInput={setCoachInput}
              send={sendCoachMessage}
              enhancement={normalizedAiEnhancement(draft.ai_enhancement)}
              applyHeadline={(value) => updateDraft("headline", value)}
              applySummary={(value) => updateDraft("summary", value)}
            />
            <article className="candidatePortalCard">
              <div className="candidatePortalSectionHead">
                <div>
                  <span className="eyebrow">Readiness</span>
                  <h2>{needsReview.length ? `${needsReview.length} review items` : "Looks clean"}</h2>
                  <p>Fix only the items that would hurt the resume or confuse a recruiter.</p>
                </div>
              </div>
              <div className="candidateNeedsList">
                {needsReview.length ? needsReview.map((item, index) => (
                  <article key={`${item.field ?? "review"}-${index}`}>
                    <strong>{item.label ?? item.field}</strong>
                    <span>{item.reason}</span>
                  </article>
                )) : <EmptyPanel title="No blocking checks" body="Still verify dates, links, and role titles before exporting." />}
              </div>
              <button className="secondary fullWidth" type="button" onClick={() => setActiveSection("review")}>Preview/export</button>
            </article>
          </aside>
        </section>
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
    </section>
  );
}

function CandidateHomeCommandCenter({
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
          <span className="eyebrow">AI coach</span>
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

function CandidatePreParsePreview({
  file,
  previewUrl,
  previewKind,
  documentHtml,
  loading,
  error,
  clear,
}: {
  file: File | null;
  previewUrl: string;
  previewKind: "pdf" | "image" | "document" | "none";
  documentHtml: string;
  loading: boolean;
  error: string;
  clear: () => void;
}) {
  if (!file) {
    return (
      <div className="candidatePreParsePreview empty">
        <FileSearch size={18} />
        <div>
          <strong>Preview before extraction</strong>
          <span>Select the file first. Nothing is parsed until you confirm.</span>
        </div>
      </div>
    );
  }
  const sizeLabel = formatBytes(file.size);
  return (
    <article className="candidatePreParsePreview">
      <header>
        <div>
          <span className="eyebrow">Confirm file before parsing</span>
          <strong>{file.name}</strong>
          <small>{sizeLabel} · {file.type || "Unknown type"}</small>
        </div>
        <button className="plain small" type="button" onClick={clear}>Replace file</button>
      </header>
      {previewKind === "pdf" ? (
        <iframe src={previewUrl} title="Selected resume preview before extraction" />
      ) : null}
      {previewKind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Selected resume preview before extraction" />
      ) : null}
      {previewKind === "document" ? (
        loading ? (
          <div className="candidatePreParseFallback">
            <Loader2 size={20} className="spin" />
            <strong>Building safe document preview</strong>
            <span>This does not extract the resume into your profile yet.</span>
          </div>
        ) : error ? (
          <div className="candidatePreParseFallback">
            <AlertTriangle size={20} />
            <strong>Preview unavailable</strong>
            <span>{error}</span>
          </div>
        ) : documentHtml ? (
          <div className="docxPreview candidatePreParseDocHtml" dangerouslySetInnerHTML={{ __html: documentHtml }} />
        ) : (
          <div className="candidatePreParseFallback">
            <FileSearch size={20} />
            <strong>Document selected</strong>
            <span>Confirm this is the right file before extraction.</span>
          </div>
        )
      ) : null}
    </article>
  );
}

function CandidateVersionDatabase({
  versions,
  selectedVersionId,
  query,
  setQuery,
  shares,
  applications,
  accessRequests,
  versionTitle,
  setVersionTitle,
  targetRole,
  setTargetRole,
  busy,
  createVersion,
  openVersion,
  editFacts,
}: {
  versions: CandidateResumeVersion[];
  selectedVersionId: string;
  query: string;
  setQuery: (value: string) => void;
  shares: CandidateResumeShare[];
  applications: CandidateApplication[];
  accessRequests: CandidateAccessRequest[];
  versionTitle: string;
  setVersionTitle: (value: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  busy: boolean;
  createVersion: () => Promise<void>;
  openVersion: (versionId: string) => void;
  editFacts: () => void;
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
      ...(Array.isArray(resume.experience) ? resume.experience.flatMap((item) => [item.title, item.company, ...(toTextList(item.bullets))]) : []),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const roleCount = new Set(versions.map((version) => version.target_role).filter(Boolean)).size;
  const activeShareCount = shares.filter((share) => share.status === "active").length;
  const destinationCount = new Set(applications.map((item) => item.destination_name).filter(Boolean)).size;
  const pendingAccessCount = accessRequests.filter((request) => request.status === "pending").length;
  return (
    <section className="databasePage candidateVersionDatabasePage">
      <header className="profilesHeader">
        <div>
          <span className="eyebrow">Resume versions</span>
          <h2>Application Vault</h2>
          <p>Search, open, edit, export, and track every resume version from one place.</p>
        </div>
        <div className="profilesResultCount">
          <strong>{filteredVersions.length}</strong>
          <span>shown of {versions.length}</span>
        </div>
      </header>

      <div className="profilesMetricStrip">
        <article>
          <div className="profileMetricCardHead"><span>Total Versions</span></div>
          <strong>{versions.length}</strong>
          <em>Exportable resumes</em>
        </article>
        <article>
          <div className="profileMetricCardHead"><span>Target Roles</span></div>
          <strong>{roleCount}</strong>
          <em>Application directions</em>
        </article>
        <article>
          <div className="profileMetricCardHead"><span>Shared To</span></div>
          <strong>{destinationCount}</strong>
          <em>{activeShareCount} active links</em>
        </article>
        <article className={pendingAccessCount ? "attention" : ""}>
          <div className="profileMetricCardHead">
            <span>Access Requests</span>
            {pendingAccessCount ? <i className="profileMetricHazard" aria-label="Needs attention"><AlertTriangle size={14} /></i> : null}
          </div>
          <strong>{pendingAccessCount}</strong>
          <em>Awaiting approval</em>
        </article>
      </div>

      <CandidateVersionWorkflowCard createVersion={createVersion} editFacts={editFacts} busy={busy} hasVersions={versions.length > 0} />

      <section className="candidateVersionDatabaseGrid">
        <div>
          <section className="profileSearchPanel">
            <form className="semanticSearch" onSubmit={(event) => event.preventDefault()}>
              <Search size={20} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search versions by role, skill, company, or resume content" />
              <button type="submit">Search</button>
            </form>
            <div className="filterRow">
              <button className="filterChip" onClick={() => setQuery("")}>Clear</button>
              <button className="filterChip" onClick={editFacts}>Edit resume</button>
            </div>
          </section>
          <div className="table candidateVersionTable">
            <div className="tableRow header">
              <span>Version</span>
              <span>Target</span>
              <span>Evidence</span>
              <span>Status</span>
              <span>Updated</span>
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
                <button className={selectedVersionId === version.id ? "tableRow active" : "tableRow"} key={version.id} onClick={() => openVersion(version.id)}>
                  <span className="truncateCell candidateListNameCell" title={version.title}>
                    <span>{version.title}</span>
                    <small>{resume.headline || "Resume version"}</small>
                  </span>
                  <span className="truncateCell" title={version.target_role || "General"}>{version.target_role || "General"}</span>
                  <span className="truncateCell" title={evidence}>{evidence}</span>
                  <span><b className="riskBadge">{humanizeLabel(version.status || "ready")}</b></span>
                  <span>{version.updated_at ? new Date(version.updated_at).toLocaleDateString() : "N/A"}</span>
                </button>
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
          <label>Version title<input value={versionTitle} onChange={(event) => setVersionTitle(event.target.value)} /></label>
          <label>Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Data Engineer, Reliability Engineer..." /></label>
          <button className="primary fullWidth" type="button" onClick={createVersion} disabled={busy || !versionTitle.trim()}>Create and open</button>
          <button className="secondary fullWidth" type="button" onClick={editFacts}>Edit resume first</button>
        </aside>
      </section>
      <CandidateSubmissionHistory applications={applications} versions={versions} openVersion={openVersion} />
    </section>
  );
}

function CandidateVersionWorkflowCard({
  createVersion,
  editFacts,
  busy,
  hasVersions,
}: {
  createVersion: () => Promise<void>;
  editFacts: () => void;
  busy: boolean;
  hasVersions: boolean;
}) {
  return (
    <section className="candidateVersionWorkflowCard">
      <div>
        <span className="eyebrow">How versions work</span>
        <h3>One master profile. Many application resumes.</h3>
        <p>Keep the facts in one place, create a focused version for each role, export a clean PDF, then log where that version was sent.</p>
      </div>
      <div>
        <span>1. Review facts</span>
        <span>2. Create version</span>
        <span>3. Tailor to job</span>
        <span>4. Export and track</span>
      </div>
      <footer>
        <button className="secondary" type="button" onClick={editFacts}>Edit master profile</button>
        <button className="primary" type="button" disabled={busy} onClick={createVersion}>{hasVersions ? "Create another version" : "Create first version"}</button>
      </footer>
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
        {applications.length ? applications.slice(0, 10).map((application) => {
          const versionId = application.resume_version_id || "";
          const version = versionById.get(versionId);
          return (
            <article key={application.id}>
              <div>
                <strong>{application.destination_name}</strong>
                <span>{[application.job_title, humanizeLabel(application.destination_type), humanizeLabel(application.status)].filter(Boolean).join(" · ")}</span>
                <small>{version?.title || application.version_title || "Resume version"} · {formatDateTime(application.shared_at)}</small>
              </div>
              <button className="secondary small" type="button" disabled={!versionId} onClick={() => openVersion(versionId)}>Open version</button>
            </article>
          );
        }) : <EmptyPanel title="No submissions logged yet" body="Open a resume version and use “Log submission” when you send it to a company, recruiter, job board, or LinkedIn contact." />}
      </div>
    </section>
  );
}

function CandidateScratchBuilderGuide({
  busy,
  saveProfile,
  createVersion,
}: {
  busy: boolean;
  saveProfile: () => Promise<void>;
  createVersion: () => Promise<void>;
}) {
  const steps = [
    ["Identity", "Add name, contact, location, LinkedIn, GitHub, or portfolio only if you have them."],
    ["Direction", "Write the target role and a rough summary. The coach can tighten it after facts exist."],
    ["Evidence", "Add education, roles, projects, skills, certifications, publications, or references as needed."],
    ["Version", "Save the profile, then create a version for the first application."],
  ];
  return (
    <section className="candidateScratchGuide">
      <div>
        <span className="eyebrow">Start from scratch</span>
        <h2>No resume file needed.</h2>
        <p>Use the structured editor below as the source of truth. Add only facts you can defend, then create a resume version and export it.</p>
      </div>
      <ol>
        {steps.map(([title, body]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{body}</span>
          </li>
        ))}
      </ol>
      <div>
        <button className="primary" type="button" disabled={busy} onClick={saveProfile}>Save profile</button>
        <button className="secondary" type="button" disabled={busy} onClick={createVersion}>Save and create first version</button>
      </div>
    </section>
  );
}

function CandidatePracticalJobBoard({
  profile,
  versions,
  selectedVersionId,
  setSelectedVersionId,
  setRequirementText,
}: {
  profile: CandidatePortalProfile["profile"];
  versions: CandidateResumeVersion[];
  selectedVersionId: string;
  setSelectedVersionId: (versionId: string) => void;
  setRequirementText: (value: string) => void;
}) {
  const cards = practicalJobCardsForCandidate(profile, versions);
  return (
    <section className="candidateJobBoardPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Practical job board</span>
          <h2>Roles worth testing</h2>
          <p>These are not random jobs. They are practical targets inferred from the approved profile, skills, projects, and existing versions.</p>
        </div>
      </div>
      <div className="candidateJobCards">
        {cards.length ? cards.map((card) => (
          <article key={card.role}>
            <div>
              <strong>{card.role}</strong>
              <span>{card.fit}</span>
            </div>
            <p>{card.reason}</p>
            <div className="nativeCandidateTags">
              {card.keywords.slice(0, 6).map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
            <footer>
              <small>{card.versionTitle || "Use any version"}</small>
              <button className="secondary small" type="button" onClick={() => {
                if (card.versionId && card.versionId !== selectedVersionId) setSelectedVersionId(card.versionId);
                setRequirementText(card.requirementText);
              }}>Use as job brief</button>
            </footer>
          </article>
        )) : (
          <EmptyPanel title="No practical roles yet" body="Upload and parse a resume first. The job board should only show practical roles after the profile has evidence." />
        )}
      </div>
    </section>
  );
}

function CandidateTemplateSelector({
  selectedTemplateId,
  setSelectedTemplateId,
}: {
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
}) {
  return (
    <article className="candidatePortalCard candidateTemplateSelector">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">PDF templates</span>
          <h2>Choose export style</h2>
          <p>All templates are standardized and ATS-safe. The candidate verifies the look before downloading.</p>
        </div>
      </div>
      <div className="candidateTemplateGrid">
        {CANDIDATE_RESUME_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={selectedTemplateId === template.id ? "active" : ""}
            type="button"
            onClick={() => setSelectedTemplateId(template.id)}
          >
            <i />
            <strong>{template.name}</strong>
            <span>{template.tone}</span>
            <small>{template.note}</small>
          </button>
        ))}
      </div>
      <p className="candidateTemplateActiveLabel">Preview is using {selectedTemplateLabel(selectedTemplateId)}.</p>
    </article>
  );
}

function CandidateAtsConfidencePanel({
  profile,
  resume,
  selectedTemplateId,
  versions,
  applications,
}: {
  profile: CandidatePortalProfile["profile"];
  resume: Record<string, any>;
  selectedTemplateId: string;
  versions: CandidateResumeVersion[];
  applications: CandidateApplication[];
}) {
  const checks = candidateAtsSignals(profile, resume, selectedTemplateId, versions, applications);
  const passed = checks.filter((item) => item.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return (
    <article className="candidatePortalCard candidateAtsPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">ATS confidence</span>
          <h2>{score}% ready</h2>
          <p>Checks for the practical things that usually break resume screening before export.</p>
        </div>
        <strong>{selectedTemplateLabel(selectedTemplateId)}</strong>
      </div>
      <div className="candidateAtsMeter"><i style={{ width: `${score}%` }} /></div>
      <div className="candidateAtsChecks">
        {checks.map((item) => (
          <span key={item.label} className={item.ok ? "ok" : "warn"}>
            {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function CandidateVersionDiffPanel({
  baseResume,
  version,
  resume,
}: {
  baseResume: Record<string, any>;
  version: CandidateResumeVersion | null;
  resume: Record<string, any>;
}) {
  const baseSkills = toTextList(baseResume.skills).map((item) => item.toLowerCase());
  const versionSkills = toTextList(resume.skills);
  const prioritizedSkills = versionSkills.filter((item) => !baseSkills.includes(item.toLowerCase())).slice(0, 8);
  const targetRole = textValue(resume.job_tailoring?.target_role || version?.target_role || resume.headline);
  const matchedTerms = toTextList(resume.job_tailoring?.matched_terms).slice(0, 8);
  const missingTerms = toTextList(resume.job_tailoring?.missing_or_unclear_terms).slice(0, 8);
  const changes = [
    {
      label: "Headline",
      value: textValue(baseResume.headline) === textValue(resume.headline) ? "Same as master profile" : `${textValue(baseResume.headline) || "No master headline"} -> ${textValue(resume.headline) || "No version headline"}`,
    },
    {
      label: "Experience",
      value: `${Array.isArray(resume.experience) ? resume.experience.length : 0} roles carried into this version`,
    },
    {
      label: "Projects",
      value: `${Array.isArray(resume.projects) ? resume.projects.length : 0} projects carried into this version`,
    },
  ];
  return (
    <article className="candidatePortalCard candidateVersionDiffPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Version changes</span>
          <h2>{targetRole ? `Tailored for ${targetRole}` : "Compared with master profile"}</h2>
          <p>Shows what this version emphasizes without hiding missing or unclear evidence.</p>
        </div>
      </div>
      <div className="candidateVersionDiffRows">
        {changes.map((item) => (
          <span key={item.label}><strong>{item.label}</strong>{item.value}</span>
        ))}
      </div>
      {prioritizedSkills.length || matchedTerms.length ? (
        <div className="candidateDiffTags">
          {[...prioritizedSkills, ...matchedTerms].slice(0, 12).map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : null}
      {missingTerms.length ? (
        <div className="candidateMissingTerms">
          <strong>Missing or unclear</strong>
          <p>{missingTerms.join(", ")}</p>
        </div>
      ) : null}
    </article>
  );
}

function CandidateCoachChat({
  messages,
  input,
  setInput,
  send,
  enhancement,
  applyHeadline,
  applySummary,
}: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  input: string;
  setInput: (value: string) => void;
  send: () => void;
  enhancement: Record<string, any>;
  applyHeadline: (value: string) => void;
  applySummary: (value: string) => void;
}) {
  const prompts = [
    "Make my summary sharper without adding fake facts.",
    "Rewrite my latest role bullets with stronger impact.",
    "What is missing before I apply to data engineer roles?",
    "Suggest a cleaner version for startup AI roles.",
  ];
  return (
    <article className="candidatePortalCard candidateCoachChat">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">AI resume coach</span>
          <h2>Improve the resume with AI</h2>
          <p>Ask for rewrites, gaps, stronger bullets, or role-specific positioning. You approve every edit.</p>
        </div>
      </div>
      <CandidateEditorCoachTools enhancement={enhancement} applyHeadline={applyHeadline} applySummary={applySummary} />
      <div className="candidateCoachPrompts">
        {prompts.map((prompt) => (
          <button key={prompt} className="plain" type="button" onClick={() => setInput(prompt)}>{prompt}</button>
        ))}
      </div>
      <div className="candidateCoachMessages">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role}>
            <span>{message.role === "assistant" ? "Coach" : "You"}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <div className="candidateCoachComposer">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} placeholder="Ask: make my summary stronger, what template should I use, what is missing for data engineer roles..." />
        <button className="primary fullWidth" type="button" onClick={send}>Send to coach</button>
      </div>
    </article>
  );
}

function CandidateBulletRewriteCard({
  experienceItems,
  setExperienceItems,
}: {
  experienceItems: Array<Record<string, any>>;
  setExperienceItems: (items: Array<Record<string, any>>) => void;
}) {
  const firstEditable = experienceItems.findIndex((item) => toTextList(item.bullets).length > 0);
  const role = firstEditable >= 0 ? experienceItems[firstEditable] : null;
  const originalBullet = role ? toTextList(role.bullets)[0] ?? "" : "";
  const suggestion = originalBullet ? strengthenResumeBullet(originalBullet, role) : "";

  function applySuggestion() {
    if (firstEditable < 0 || !suggestion) return;
    setExperienceItems(experienceItems.map((item, index) => {
      if (index !== firstEditable) return item;
      const bullets = toTextList(item.bullets);
      return { ...item, bullets: [suggestion, ...bullets.slice(1)] };
    }));
  }

  return (
    <article className="candidatePortalCard candidateBulletRewriteCard">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Bullet editor</span>
          <h2>Make one bullet sharper</h2>
          <p>Rewrites use only the selected bullet and role context. Add metrics manually only when they are true.</p>
        </div>
      </div>
      {originalBullet ? (
        <>
          <div className="candidateBulletCompare">
            <span><strong>Current</strong>{originalBullet}</span>
            <span><strong>Suggested</strong>{suggestion}</span>
          </div>
          <button className="secondary fullWidth" type="button" onClick={applySuggestion}>Apply rewrite to editor</button>
        </>
      ) : (
        <EmptyPanel title="No bullet available" body="Add a work experience bullet first. The editor can then help make it clearer and stronger." />
      )}
    </article>
  );
}

function CandidateJobAiEditor({
  versions,
  selectedVersionId,
  setSelectedVersionId,
  targetRole,
  setTargetRole,
  requirementText,
  setRequirementText,
  match,
  busy,
  analyze,
  createTargetedVersion,
  openJobBoard,
}: {
  versions: CandidateResumeVersion[];
  selectedVersionId: string;
  setSelectedVersionId: (versionId: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  requirementText: string;
  setRequirementText: (value: string) => void;
  match: CandidateSelfMatch | null;
  busy: boolean;
  analyze: () => Promise<void>;
  createTargetedVersion: () => Promise<void>;
  openJobBoard: () => void;
}) {
  const inferredRole = targetRole.trim() || inferTargetRoleFromRequirement(requirementText);
  const enoughRequirement = requirementText.trim().length >= 20;
  const editPlan = candidateJobEditPlan(match, inferredRole);
  return (
    <article className="candidatePortalCard candidateJobAiEditor">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Job-level AI editor</span>
          <h2>Tailor this resume to one job</h2>
          <p>Paste the job brief, analyze fit, then create a targeted version without changing the master facts.</p>
        </div>
      </div>
      <label>Resume version
        <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
          <option value="">Select version</option>
          {versions.map((version) => <option value={version.id} key={version.id}>{version.title} · {version.target_role || "General"}</option>)}
        </select>
      </label>
      <label>Target role
        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder={inferredRole || "Senior Data Engineer"} />
      </label>
      <label>Job requirement
        <textarea value={requirementText} onChange={(event) => setRequirementText(event.target.value)} rows={5} placeholder="Paste the exact job description. The editor will identify keywords, gaps, and what to emphasize." />
      </label>
      <div className="candidateJobAiActions">
        <button className="primary" type="button" disabled={busy || !selectedVersionId || !enoughRequirement} onClick={analyze}>
          {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Analyze job fit
        </button>
        <button className="secondary" type="button" disabled={busy || !selectedVersionId || !enoughRequirement || !inferredRole} onClick={createTargetedVersion}>
          <Plus size={15} /> Create targeted version
        </button>
      </div>
      {match ? (
        <section className="candidateJobEditPlan">
          <header>
            <strong>{match.score}% · {humanizeLabel(match.fit_label)}</strong>
            <span>{match.recommended_next_action}</span>
          </header>
          <div>
            {editPlan.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="candidateJobEditPlan empty">
          <strong>What the AI editor will produce</strong>
          <p>Role positioning, missing keywords, skills to emphasize, bullet edits to consider, and whether this deserves a separate resume version.</p>
        </section>
      )}
      <button className="plain small" type="button" onClick={openJobBoard}>Open full job board</button>
    </article>
  );
}

function CandidateCvPreview({ resume, templateId = "atlas" }: { resume: Record<string, any>; templateId?: string }) {
  const contact = resume.contact ?? {};
  const skills = toTextList(resume.skills);
  const summaryHighlights = toTextList(resume.summary_highlights);
  const skillGroups = skillGroupEntries(resume.skill_groups, skills);
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const certifications = toTextList(resume.certifications);
  const awards = toTextList(resume.awards);
  const publications = toTextList(resume.publications);
  const languages = toTextList(resume.languages);
  const otherSections = resumeOtherSectionEntries(resume.other_sections);
  const links = uniqueTextList(toTextList(resume.links).filter((link) => !toTextList([contact.linkedin_url, contact.portfolio_url, contact.github_url]).includes(link)));
  const normalizedTemplate = CANDIDATE_RESUME_TEMPLATES.some((template) => template.id === templateId) ? templateId : "atlas";
  return (
    <div className={`candidateCvPreview candidateCvTemplate-${normalizedTemplate}`}>
      <h1>{textValue(resume.name) || "Candidate Name"}</h1>
      <p className="cvHeadline">{textValue(resume.headline)}</p>
      <p className="cvMeta">{toTextList([contact.location, contact.email, contact.phone, contact.linkedin_url, contact.portfolio_url, contact.github_url]).join(" | ")}</p>
      {resume.summary ? <p>{textValue(resume.summary)}</p> : null}
      {summaryHighlights.length ? <TextListSection title="Summary Highlights" items={summaryHighlights} /> : null}
      {skillGroups.length ? <section><h2>Skills</h2><SkillGroups groups={skillGroups} /></section> : skills.length ? <section><h2>Skills</h2><div className="cvSkills">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section> : null}
      {experience.length ? <section><h2>Experience</h2>{experience.map((item, index) => <CvItem key={`${item.company || item.title || "experience"}-${index}`} item={item} />)}</section> : null}
      {projects.length ? <section><h2>Projects</h2>{projects.map((item, index) => <CvItem key={`${item.name || item.role || "project"}-${index}`} item={item} />)}</section> : null}
      {education.length ? <section><h2>Education</h2>{education.map((item, index) => <CvItem key={`${item.school || item.degree || "education"}-${index}`} item={item} />)}</section> : null}
      <TextListSection title="Certifications" items={certifications} />
      <TextListSection title="Awards" items={awards} />
      <TextListSection title="Publications" items={publications} />
      <TextListSection title="Languages" items={languages} />
      {otherSections.map((section) => <TextListSection key={section.title} title={section.title} items={section.items} />)}
      <TextListSection title="Additional Links" items={links} />
    </div>
  );
}

function CandidateVisibilityPanel({
  settings,
  busy,
  toggleNativeSearch,
}: {
  settings: Record<string, any>;
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
        <span><ShieldCheck size={15} /> PII permission required</span>
        <span><Database size={15} /> Candidate-owned profile</span>
        <span><FileSearch size={15} /> Resume versions stay controlled</span>
      </div>
      <button className={nativeSearchEnabled ? "secondary fullWidth" : "primary fullWidth"} type="button" disabled={busy} onClick={() => toggleNativeSearch(!nativeSearchEnabled)}>
        {nativeSearchEnabled ? "Turn recruiter discovery off" : "Make searchable without PII"}
      </button>
    </article>
  );
}

function CandidateEditorCoachTools({
  enhancement,
  applyHeadline,
  applySummary,
}: {
  enhancement: Record<string, any>;
  applyHeadline: (value: string) => void;
  applySummary: (value: string) => void;
}) {
  const [ignoredHeadline, setIgnoredHeadline] = useState(false);
  const [ignoredSummary, setIgnoredSummary] = useState(false);
  const headline = textValue(enhancement.headline_suggestion);
  const summary = textValue(enhancement.career_narrative || enhancement.profile_read);
  const bestFitRoles = cvTextList(enhancement.best_fit_roles);
  const questions = cvTextList(enhancement.screening_questions || enhancement.likely_missed_details);
  if (!headline && !summary && !bestFitRoles.length && !questions.length) {
    return (
      <section className="candidateEditorCoachTools">
        <div>
          <span className="eyebrow">AI resume coach</span>
          <h3>Start improving the resume</h3>
          <p>Use the editor to add facts, sharpen bullets, and prepare a clean version. Coaching suggestions appear here when enough resume context is available.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="candidateEditorCoachTools">
      <div>
        <span className="eyebrow">AI resume coach</span>
        <h3>Improve positioning without changing facts</h3>
        <p>The coach suggests better positioning. You approve every change before it becomes part of the resume.</p>
      </div>
      {headline && !ignoredHeadline ? (
        <article>
          <strong>Suggested headline</strong>
          <span>{headline}</span>
          <div className="candidateCoachSuggestionActions">
            <button className="secondary small" type="button" onClick={() => applyHeadline(headline)}>Accept</button>
            <button className="plain small" type="button" onClick={() => setIgnoredHeadline(true)}>Ignore</button>
          </div>
        </article>
      ) : null}
      {summary && !ignoredSummary ? (
        <article>
          <strong>Suggested summary direction</strong>
          <span>{summary}</span>
          <div className="candidateCoachSuggestionActions">
            <button className="secondary small" type="button" onClick={() => applySummary(summary)}>Accept</button>
            <button className="plain small" type="button" onClick={() => setIgnoredSummary(true)}>Ignore</button>
          </div>
        </article>
      ) : null}
      {bestFitRoles.length ? (
        <article>
          <strong>Best-fit roles to target</strong>
          <span>{bestFitRoles.slice(0, 6).join(", ")}</span>
        </article>
      ) : null}
      {questions.length ? (
        <article>
          <strong>Missing details to confirm</strong>
          <span>{questions.slice(0, 4).join(" · ")}</span>
        </article>
      ) : null}
    </section>
  );
}

function CandidateSharePanel({
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
      <label>Share label<input value={shareLabel} onChange={(event) => setShareLabel(event.target.value)} /></label>
      <label className="candidateToggleRow">
        <input type="checkbox" checked={includePii} onChange={(event) => setIncludePii(event.target.checked)} />
        Include PII in this specific share link
      </label>
      <button className="primary fullWidth" type="button" disabled={busy || !selectedVersionId} onClick={createShare}>Create controlled link</button>
      <div className="candidateShareList">
        {activeShares.length ? activeShares.slice(0, 4).map((share) => {
          const url = candidatePortalShareUrl(share.access_token);
          return (
            <article key={share.id}>
              <strong>{share.label}</strong>
              <span>{share.version_title || "Resume version"} · {share.permissions?.include_pii ? "PII included" : "PII locked"}</span>
              <code>{url}</code>
              <div>
                <button className="plain small" type="button" onClick={() => navigator.clipboard?.writeText(url)}>Copy</button>
                <button className="plain small dangerText" type="button" onClick={() => revokeShare(share.id)}>Revoke</button>
              </div>
            </article>
          );
        }) : <EmptyPanel title="No active share links" body="Create one when a candidate wants to share a controlled resume version externally." />}
      </div>
    </article>
  );
}

function CandidateApplicationTracker({
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
        <label>Destination<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Company, recruiter, LinkedIn contact..." /></label>
        <label>Type
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
        <label>Role / job title<input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Senior Data Engineer" /></label>
        <label>Status
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
      <label>Job URL<input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="https://..." /></label>
      <label>Private note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What did you send, who asked, what should you follow up on?" /></label>
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
      <button className="primary fullWidth" type="button" disabled={busy || !selectedVersionId || !destination.trim()} onClick={save}>Save share history</button>
      <div className="candidateApplicationList">
        {applications.length ? applications.slice(0, 6).map((application) => {
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
              {application.job_url ? <a href={application.job_url} target="_blank" rel="noreferrer">Open job</a> : null}
              {shareUrl ? <button className="plain small" type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy share link</button> : null}
              {application.status !== "archived" ? <button className="plain small dangerText" type="button" onClick={() => void updateStatus(application.id, "archived")}>Archive</button> : null}
              {application.candidate_note ? <p>{application.candidate_note}</p> : null}
            </article>
          );
        }) : <EmptyPanel title="No share history for this version" body="When you send this resume anywhere, log it here so you know which version was used." />}
      </div>
    </article>
  );
}

function CandidateAccessRequestsPanel({
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
        {pending.length ? pending.slice(0, 4).map((request) => (
          <article key={request.id}>
            <strong>{request.tenant_name || "Recruiter workspace"}</strong>
            <span>{request.request_message || "Requested permission to view candidate contact/profile details."}</span>
            <small>{request.recruiter_email || "Recruiter"} · {formatDateTime(request.created_at)}</small>
            <div>
              <button className="primary small" type="button" disabled={busy} onClick={() => decide(request.id, "approve")}>Approve</button>
              <button className="secondary small" type="button" disabled={busy} onClick={() => decide(request.id, "deny")}>Deny</button>
            </div>
          </article>
        )) : <EmptyPanel title="No access requests" body="When recruiters ask to see PII, the candidate can approve or deny from here." />}
      </div>
    </article>
  );
}

function candidatePortalShareUrl(token: string) {
  const path = `/api/backend/candidate-shares/${encodeURIComponent(token)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function selectedTemplateLabel(templateId: string) {
  return CANDIDATE_RESUME_TEMPLATES.find((template) => template.id === templateId)?.name ?? "Atlas";
}

function candidateAtsSignals(
  profile: CandidatePortalProfile["profile"],
  resume: Record<string, any>,
  selectedTemplateId: string,
  versions: CandidateResumeVersion[],
  applications: CandidateApplication[],
) {
  const contact = resume.contact ?? {};
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const skills = toTextList(resume.skills);
  const hasDates = experience.some((item) => textValue(item.start_date) || textValue(item.end_date));
  const hasLinks = Boolean(contact.linkedin_url || contact.portfolio_url || contact.github_url || profile.linkedin_url || profile.portfolio_url || profile.github_url);
  const hasTargetedVersion = versions.some((version) => Boolean(textValue(version.target_role)));
  return [
    { label: "Name and headline", ok: Boolean(textValue(resume.name || profile.display_name) && textValue(resume.headline || profile.headline)) },
    { label: "Contact details", ok: Boolean(textValue(contact.email || profile.email) || textValue(contact.phone || profile.phone)) },
    { label: "Location", ok: Boolean(textValue(contact.location || profile.current_location)) },
    { label: "Professional links", ok: hasLinks },
    { label: "Summary", ok: Boolean(textValue(resume.summary || profile.summary)) },
    { label: "Experience bullets", ok: experience.some((item) => cvTextList(item.bullets || item.details || item.description).length) },
    { label: "Role dates", ok: hasDates },
    { label: "Skills", ok: skills.length >= 6 },
    { label: "Education or projects", ok: education.length > 0 || projects.length > 0 },
    { label: "ATS-safe template", ok: CANDIDATE_RESUME_TEMPLATES.some((template) => template.id === selectedTemplateId) },
    { label: "Role-specific version", ok: hasTargetedVersion || versions.length === 1 },
    { label: "Submission tracking", ok: applications.length > 0 },
  ];
}

function candidateResumeFromProfile(profile: CandidatePortalProfile["profile"]): Record<string, any> {
  return {
    name: profile.display_name || "",
    headline: profile.headline || "",
    summary: profile.summary || "",
    summary_highlights: profile.summary_highlights || [],
    ai_enhancement: profile.ai_enhancement || {},
    contact: {
      location: profile.current_location || "",
      email: profile.email || "",
      phone: profile.phone || "",
      linkedin_url: profile.linkedin_url || "",
      portfolio_url: profile.portfolio_url || "",
      github_url: profile.github_url || "",
    },
    skills: profile.skills || [],
    skill_groups: profile.skill_groups || {},
    experience: profile.experience || [],
    education: profile.education || [],
    certifications: profile.certifications || [],
    projects: profile.projects || [],
    awards: profile.awards || [],
    publications: profile.publications || [],
    languages: profile.languages || [],
    other_sections: profile.other_sections || {},
    links: profile.links || [],
  };
}

function SkillGroups({ groups }: { groups: Array<{ label: string; skills: string[] }> }) {
  return (
    <div className="cvSkillGroups">
      {groups.map((group) => (
        <div key={group.label}>
          <strong>{group.label}</strong>
          <span>{group.skills.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function TextListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function CandidateUploadList({ uploads, activeUploadId, selectUpload }: { uploads: CandidateResumeUpload[]; activeUploadId: string; selectUpload: (id: string) => void }) {
  if (!uploads.length) return <EmptyPanel title="No uploads yet" body="Upload a resume to start parsing and build the master profile." />;
  return (
    <div className="candidateUploadList">
      {uploads.map((upload) => (
        <button key={upload.id} className={activeUploadId === upload.id ? "active" : ""} type="button" onClick={() => selectUpload(upload.id)}>
          <span>{humanizeLabel(upload.status)}</span>
          <strong>{upload.original_filename}</strong>
          <small>{upload.stage_label ?? humanizeLabel(upload.stage)} · {formatDateTime(upload.updated_at)}</small>
          <ProgressBar value={upload.progress} />
        </button>
      ))}
    </div>
  );
}

function CvItem({ item }: { item: Record<string, any> }) {
  const title = textValue(item.title || item.degree || item.role || item.name);
  const place = textValue(item.company || item.school);
  const location = textValue(item.location);
  const dates = toTextList([item.start_date, item.end_date]).join(" - ");
  const technologies = cvTextList(item.technologies);
  const links = cvTextList(item.links);
  const bullets = cvTextList(item.bullets || item.details || item.description);
  const workstreams = Array.isArray(item.workstreams) ? item.workstreams : [];
  return (
    <article className="cvItem">
      <h3>{title}{place ? ` · ${place}` : ""}</h3>
      {dates || location ? <span>{[dates, location].filter(Boolean).join(" · ")}</span> : null}
      {technologies.length ? <p className="cvItemTech">{technologies.join(", ")}</p> : null}
      {links.length ? <p className="cvItemLinks">{links.join(" | ")}</p> : null}
      {bullets.length ? <ul>{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
      {workstreams.length ? (
        <div className="cvWorkstreams">
          {workstreams.map((workstream, index) => (
            <CvItem key={`${workstream.name || workstream.role || "workstream"}-${index}`} item={workstream} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function cvTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return toTextList(value);
}

function splitLineList(value: string): string[] {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function candidateUploadPreviewKind(file: File | null): "pdf" | "image" | "document" | "none" {
  if (!file) return "none";
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"].some((suffix) => name.endsWith(suffix))) return "image";
  return "document";
}

function skillGroupEntries(groups: unknown, fallbackSkills: string[]) {
  if (groups && typeof groups === "object" && !Array.isArray(groups)) {
    return Object.entries(groups as Record<string, unknown>)
      .map(([label, values]) => ({ label: humanizeLabel(label), skills: cvTextList(values) }))
      .filter((group) => group.skills.length);
  }
  return fallbackSkills.length ? [{ label: "Skills", skills: fallbackSkills }] : [];
}

function resumeOtherSectionEntries(value: unknown): Array<{ title: string; items: string[] }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([title, items]) => ({
      title: humanizeLabel(title),
      items: cvTextList(items),
    }))
    .filter((section) => section.items.length);
}

function versionEvidenceSummary(resume: Record<string, any>) {
  const skills = toTextList(resume.skills).slice(0, 3);
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const latest = experience[0] ?? {};
  return [
    latest.title && latest.company ? `${latest.title} at ${latest.company}` : latest.title || latest.company,
    skills.length ? skills.join(", ") : "",
  ].filter(Boolean).join(" · ") || "Open to review resume evidence";
}

function practicalJobCardsForCandidate(profile: CandidatePortalProfile["profile"], versions: CandidateResumeVersion[]) {
  const enhancement = normalizedAiEnhancement(profile.ai_enhancement);
  const aiRoles = cvTextList(enhancement.best_fit_roles);
  const versionRoles = versions.map((version) => version.target_role || "").filter(Boolean);
  const headlineRoles = textValue(profile.headline)
    ? [textValue(profile.headline).replace(/\|/g, " ").split(",")[0]?.trim()].filter(Boolean)
    : [];
  const roles = uniqueTextList([...aiRoles, ...versionRoles, ...headlineRoles]).slice(0, 6);
  const skills = toTextList(profile.skills).slice(0, 12);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const latest = experience[0] ?? {};
  return roles.map((role) => {
    const roleNeedle = role.toLowerCase().split(" ")[0] || role.toLowerCase();
    const matchingVersion = versions.find((version) => (version.target_role || version.title || "").toLowerCase().includes(roleNeedle));
    const keywords = uniqueTextList([...skills, ...cvTextList(enhancement.search_keywords)]).slice(0, 8);
    return {
      role,
      versionId: matchingVersion?.id || versions[0]?.id || "",
      versionTitle: matchingVersion?.title || versions[0]?.title || "",
      fit: matchingVersion ? "Version exists" : "Create or tailor a version",
      reason: [
        latest.title && latest.company ? `Recent evidence includes ${latest.title} at ${latest.company}.` : "",
        skills.length ? `Core searchable skills include ${skills.slice(0, 5).join(", ")}.` : "",
        textValue(enhancement.profile_read || enhancement.career_narrative),
      ].filter(Boolean)[0] || "This role is inferred from the candidate profile. Verify against a real requirement before applying.",
      keywords,
      requirementText: [
        `Role: ${role}`,
        skills.length ? `Relevant skills to test: ${skills.slice(0, 10).join(", ")}` : "",
        latest.title || latest.company ? `Recent experience evidence: ${[latest.title, latest.company].filter(Boolean).join(" at ")}` : "",
        "Use this as a starting job brief. Paste the real requirement to get a better match.",
      ].filter(Boolean).join("\n"),
    };
  });
}

function candidateCoachReply(profile: CandidatePortalProfile["profile"], message: string) {
  const enhancement = normalizedAiEnhancement(profile.ai_enhancement);
  const lower = message.toLowerCase();
  const skills = toTextList(profile.skills).slice(0, 8);
  const bestRoles = cvTextList(enhancement.best_fit_roles).slice(0, 4);
  const questions = cvTextList(enhancement.screening_questions || enhancement.likely_missed_details).slice(0, 4);
  if (lower.includes("template") || lower.includes("pdf") || lower.includes("download")) {
    return "Use Atlas for the default professional export, Technical for engineering/data roles, Compact if the resume is too long, and Minimal when you want the safest ATS-first version. Verify the selected template in preview before downloading.";
  }
  if (lower.includes("summary") || lower.includes("headline")) {
    const suggested = textValue(enhancement.headline_suggestion || enhancement.career_narrative || enhancement.profile_read);
    return suggested
      ? `I would start with this positioning: ${suggested}`
      : "Your summary should be evidence-led: current role, strongest domain, top 3 skills, and one quantified impact. Add metrics from the resume before exporting.";
  }
  if (lower.includes("missing") || lower.includes("improve") || lower.includes("weak")) {
    return questions.length
      ? `The main missing items to verify are: ${questions.join("; ")}. Add these in the structured editor so every resume version improves.`
      : "Check dates, latest title, location, LinkedIn/portfolio, quantified bullets, project ownership, and role-specific keywords. Those fields usually improve matching the most.";
  }
  if (lower.includes("job") || lower.includes("role") || lower.includes("match")) {
    return bestRoles.length
      ? `The strongest practical directions look like: ${bestRoles.join(", ")}. Use Job Board to test one version against a real requirement before applying.`
      : `Based on captured skills${skills.length ? ` like ${skills.join(", ")}` : ""}, create a targeted version for the job and then match it against the requirement.`;
  }
  return `I would improve this profile by tightening the headline, making bullets outcome-based, and ensuring role-specific keywords are present${skills.length ? `: ${skills.slice(0, 5).join(", ")}` : ""}. Ask me about summary, missing evidence, template choice, or job matching.`;
}

function strengthenResumeBullet(bullet: string, role: Record<string, any> | null) {
  const clean = textValue(bullet).replace(/^[-•]\s*/, "");
  const roleLabel = [role?.title, role?.company].filter(Boolean).join(" at ");
  if (!clean) return "";
  if (/\b(led|built|designed|architected|improved|reduced|increased|launched|implemented|optimized|automated|delivered)\b/i.test(clean)) {
    return clean;
  }
  const prefix = roleLabel ? `Delivered ${roleLabel} work by ` : "Delivered impact by ";
  return `${prefix}${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

function inferTargetRoleFromRequirement(requirementText: string) {
  const lines = requirementText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const explicit = lines.find((line) => /^(role|job title|title|position)\s*:/i.test(line));
  if (explicit) return explicit.replace(/^(role|job title|title|position)\s*:/i, "").trim().slice(0, 80);
  const heading = lines.find((line) => line.length <= 80 && /(engineer|developer|analyst|manager|designer|architect|consultant|scientist|specialist|lead)/i.test(line));
  if (heading) return heading.replace(/^job\s*/i, "").trim().slice(0, 80);
  return "";
}

function candidateJobEditPlan(match: CandidateSelfMatch | null, targetRole: string) {
  if (!match) return [];
  const matched = match.matched_terms.slice(0, 8).join(", ") || "No strong matched terms yet.";
  const missing = match.missing_or_unclear_terms.slice(0, 8).join(", ") || "No major gaps detected.";
  const skills = match.skill_hits.slice(0, 8).join(", ") || matched;
  return [
    {
      title: "Fit read",
      body: match.summary || `This version scored ${match.score}% for the role. Use this as a decision aid, not a reason to invent missing details.`,
    },
    {
      title: "Positioning",
      body: targetRole
        ? `Create a version that clearly targets ${targetRole}. The summary and headline should mention the role only if the resume evidence supports it.`
        : "Add a target role before creating the version so the export has a clear direction.",
    },
    {
      title: "Evidence to emphasize",
      body: `Bring these signals higher in the resume where they are factual: ${matched}.`,
    },
    {
      title: "Missing or unclear keywords",
      body: `Verify these before adding them: ${missing}. If they are not true, keep them out and prepare an interview answer instead.`,
    },
    {
      title: "ATS keyword focus",
      body: `The strongest skill overlap is: ${skills}. Use the editor to sharpen bullets around these skills before export.`,
    },
    {
      title: "What not to fake",
      body: "Do not add tools, years, locations, certifications, or employers unless they are true. Mark unclear items as questions to verify.",
    },
  ];
}

function normalizedAiEnhancement(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function EditableProfileList({
  title,
  addLabel,
  items,
  setItems,
  fields,
  detailsKey,
  detailsLabel,
  enableWorkstreams = false,
}: {
  title: string;
  addLabel: string;
  items: Array<Record<string, any>>;
  setItems: (items: Array<Record<string, any>>) => void;
  fields: Array<{ key: string; label: string }>;
  detailsKey: "bullets" | "details";
  detailsLabel: string;
  enableWorkstreams?: boolean;
}) {
  function updateItem(index: number, key: string, value: string) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function updateDetails(index: number, value: string) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [detailsKey]: value.split("\n").map((line) => line.trim()).filter(Boolean) } : item));
  }

  function updateWorkstreams(index: number, workstreams: Array<Record<string, any>>) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, workstreams } : item));
  }

  return (
    <section className="editableProfileList">
      <div>
        <h3>{title}</h3>
        <button className="plain small" type="button" onClick={() => setItems([...items, {}])}><Plus size={14} /> {addLabel}</button>
      </div>
      {items.length ? items.map((item, index) => (
        <article key={`${title}-${index}`} className="editableProfileItem">
          <div className="candidateFormGrid">
            {fields.map((field) => (
              <label key={field.key}>{field.label}<input value={textValue(item[field.key])} onChange={(event) => updateItem(index, field.key, event.target.value)} /></label>
            ))}
          </div>
          <label className="candidateWideField">{detailsLabel}<textarea value={toTextList(item[detailsKey]).join("\n")} onChange={(event) => updateDetails(index, event.target.value)} rows={4} placeholder="One bullet per line" /></label>
          {enableWorkstreams ? (
            <EditableWorkstreamList
              workstreams={Array.isArray(item.workstreams) ? item.workstreams : []}
              setWorkstreams={(workstreams) => updateWorkstreams(index, workstreams)}
            />
          ) : null}
          <button className="plain dangerText" type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </article>
      )) : <EmptyPanel title={`No ${title.toLowerCase()} yet`} body={`Add ${title.toLowerCase()} to make generated CV versions stronger.`} />}
    </section>
  );
}

function EditableWorkstreamList({
  workstreams,
  setWorkstreams,
}: {
  workstreams: Array<Record<string, any>>;
  setWorkstreams: (items: Array<Record<string, any>>) => void;
}) {
  function updateItem(index: number, key: string, value: string) {
    setWorkstreams(workstreams.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function updateList(index: number, key: "bullets" | "technologies", value: string) {
    const list = key === "technologies" ? splitCommaList(value) : splitLineList(value);
    setWorkstreams(workstreams.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: list } : item));
  }

  return (
    <section className="editableWorkstreamList">
      <div className="editableWorkstreamHead">
        <div>
          <strong>Same-company projects / workstreams</strong>
          <span>These stay under the parent role and are not counted as separate jobs.</span>
        </div>
        <button className="plain small" type="button" onClick={() => setWorkstreams([...workstreams, {}])}>
          <Plus size={14} /> Add project
        </button>
      </div>
      {workstreams.length ? workstreams.map((item, index) => (
        <article className="editableWorkstreamItem" key={`${item.name || item.role || "workstream"}-${index}`}>
          <div className="candidateFormGrid">
            <label>Project / product<input value={textValue(item.name)} onChange={(event) => updateItem(index, "name", event.target.value)} /></label>
            <label>Role on project<input value={textValue(item.role)} onChange={(event) => updateItem(index, "role", event.target.value)} /></label>
            <label>Start<input value={textValue(item.start_date)} onChange={(event) => updateItem(index, "start_date", event.target.value)} /></label>
            <label>End<input value={textValue(item.end_date)} onChange={(event) => updateItem(index, "end_date", event.target.value)} /></label>
            <label>Location<input value={textValue(item.location)} onChange={(event) => updateItem(index, "location", event.target.value)} /></label>
            <label>Technologies<input value={toTextList(item.technologies).join(", ")} onChange={(event) => updateList(index, "technologies", event.target.value)} /></label>
          </div>
          <label className="candidateWideField">Project bullets<textarea value={toTextList(item.bullets || item.details || item.description).join("\n")} onChange={(event) => updateList(index, "bullets", event.target.value)} rows={4} placeholder="One project bullet per line" /></label>
          <button className="plain dangerText small" type="button" onClick={() => setWorkstreams(workstreams.filter((_, itemIndex) => itemIndex !== index))}>Remove project</button>
        </article>
      )) : (
        <p className="editableWorkstreamEmpty">Add projects here when one employer contains several products, clients, agents, platforms, or implementations.</p>
      )}
    </section>
  );
}

function normalizeEditableProfileItems(items: Array<Record<string, any>>, detailsKey: "bullets" | "details") {
  return items
    .map((item) => {
      const normalized = { ...item };
      normalized[detailsKey] = toTextList(item[detailsKey]);
      if (Array.isArray(normalized.workstreams)) {
        normalized.workstreams = normalized.workstreams
          .map((workstream: Record<string, any>) => ({
            ...workstream,
            bullets: toTextList(workstream.bullets || workstream.details || workstream.description),
            technologies: toTextList(workstream.technologies),
          }))
          .filter((workstream: Record<string, any>) => Object.values(workstream).some((value) => Array.isArray(value) ? value.length : Boolean(String(value ?? "").trim())));
      }
      return normalized;
    })
    .filter((item) => Object.values(item).some((value) => Array.isArray(value) ? value.length : Boolean(String(value ?? "").trim())));
}

function candidatePortalCompleteness(profile: CandidatePortalProfile["profile"]) {
  const checks = [
    profile.display_name,
    profile.headline,
    profile.current_location,
    profile.email,
    profile.phone,
    profile.linkedin_url || profile.portfolio_url || profile.github_url,
    profile.summary,
    profile.skills?.length,
    profile.experience?.length,
    profile.education?.length,
    profile.projects?.length,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

function humanizeLabel(value: string) {
  return value.split("_").map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(" ");
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "topNavLink active" : "topNavLink"} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function AdminShellTopBar({ user, status, busy, logout }: { user: CurrentUser | null; status: string; busy: boolean; logout: () => void }) {
  return (
    <header className="shellTopBar adminShellTopBar">
      <div>
        <BrandMark />
        <strong>candidateSignal.ai</strong>
      </div>
      <div className="topNavActions">
        <button
          className="shellUploadButton"
          type="button"
          onClick={() => document.getElementById("new-company-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <Plus size={18} /> New Company
        </button>
        <AccountSettingsMenu user={user} status={status} busy={busy} logout={logout} />
      </div>
    </header>
  );
}

function WorkspaceTopNav({
  view,
  setView,
  user,
  status,
  busy,
  logout,
}: {
  view: View;
  setView: (view: View) => void;
  user: CurrentUser | null;
  status: string;
  busy: boolean;
  logout: () => void;
}) {
  return (
    <header className="workspaceTopNav">
      <div className="workspaceTopBrand">
        <button className="workspaceBrandButton" type="button" aria-label="Open workspace home" onClick={() => setView("dashboard")}>
          <BrandMark />
        </button>
        <strong>candidateSignal.ai</strong>
      </div>
      <nav>
        <NavButton icon={<Database size={18} />} label={WORKSPACE_NAV_LABELS.home} active={view === "dashboard"} onClick={() => setView("dashboard")} />
        <NavButton icon={<Users size={18} />} label={WORKSPACE_NAV_LABELS.candidates} active={view === "database" || view === "candidate"} onClick={() => setView("database")} />
        <NavButton icon={<Rocket size={18} />} label={WORKSPACE_NAV_LABELS.campaigns} active={view === "campaigns"} onClick={() => setView("campaigns")} />
        <NavButton icon={<Search size={18} />} label={WORKSPACE_NAV_LABELS.copilot} active={view === "copilot" || view === "requirement" || view === "matches"} onClick={() => setView("copilot")} />
      </nav>
      <div className="topNavActions">
        {isTenantAdmin(user) ? (
          <button className={view === "operations" ? "shellUploadButton active queueTopButton" : "shellUploadButton queueTopButton"} type="button" onClick={() => setView("operations")}>
            <AlertTriangle size={18} /> {WORKSPACE_NAV_LABELS.review}
          </button>
        ) : null}
        <button className={view === "upload" ? "shellUploadButton active" : "shellUploadButton"} type="button" onClick={() => setView("upload")}>
          <UploadCloud size={18} /> {WORKSPACE_NAV_LABELS.upload}
        </button>
        <AccountSettingsMenu user={user} status={status} busy={busy} logout={logout} setView={setView} active={view === "team" || view === "operations" || view === "versions"} />
      </div>
    </header>
  );
}

function AccountSettingsMenu({
  user,
  status,
  busy,
  logout,
  setView,
  active = false,
}: {
  user: CurrentUser | null;
  status: string;
  busy: boolean;
  logout: () => void;
  setView?: (view: View) => void;
  active?: boolean;
}) {
  const role = user?.tenant_role ?? user?.role ?? user?.platform_role ?? "user";
  const canManageWorkspaceSettings = isTenantAdmin(user);
  function switchLogin(path: "/" | "/admin") {
    logout();
    window.location.href = path;
  }
  return (
    <details className="accountMenu">
      <summary className={active ? "settingsSummary active" : "settingsSummary"}>
        <Settings size={18} /> Settings
      </summary>
      <section className="accountMenuPanel">
        <div className="accountIdentity">
          <span className="avatarButton">{(user?.email ?? "CS").slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user?.name ?? user?.email ?? "Signed in"}</strong>
            <small>{user?.email ?? "No email"}</small>
          </div>
        </div>
        <div className="accountMeta">
          <span>Workspace</span>
          <strong>{user?.tenant_name ?? (isPlatformAdmin(user) ? "Platform Admin" : "Company")}</strong>
        </div>
        <div className="accountMeta">
          <span>Role</span>
          <strong>{domainLabel(role)}</strong>
        </div>
        <div className="accountMeta">
          <span>Status</span>
          <strong>{busy ? "Working..." : status}</strong>
        </div>
        {setView ? (
          <div className="accountMenuActions">
            {canManageWorkspaceSettings ? <button type="button" onClick={() => setView("team")}><ShieldCheck size={16} /> Team Settings</button> : null}
            {canManageWorkspaceSettings ? <button type="button" onClick={() => setView("operations")}><AlertTriangle size={16} /> Upload Review</button> : null}
            <button type="button" onClick={() => setView("versions")}><GitBranch size={16} /> Candidate Versions</button>
          </div>
        ) : null}
        <div className="accountMenuActions">
          <button type="button" onClick={() => switchLogin("/")}><LogIn size={16} /> Recruiter Login</button>
          <button type="button" onClick={() => switchLogin("/admin")}><ShieldCheck size={16} /> Admin Login</button>
        </div>
        <button className="logoutButton" type="button" onClick={logout}><LogOut size={16} /> Logout</button>
      </section>
    </details>
  );
}

function AccessDeniedPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="panel accessDeniedPanel">
      <ShieldCheck size={26} />
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
    </section>
  );
}

function Dashboard({
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

function RecruiterCopilot({
  messages,
  threads,
  activeThread,
  input,
  setInput,
  resultLimit,
  setResultLimit,
  allCandidates,
  campaigns,
  activeCampaign,
  selectedCampaignId,
  selectCampaign,
  shortlistToCampaign,
  openCampaign,
  send,
  newThread,
  openThread,
  archiveThread,
  createRequirementFromThread,
  openCandidate,
  busy,
  requirement,
  requirementText,
  setRequirementText,
  requirementFile,
  setRequirementFile,
  clarifyAnswers,
  setClarifyAnswers,
  createRequirement,
  finalize,
  match,
  matches,
}: {
  messages: WorkspaceChatMessage[];
  threads: CopilotThread[];
  activeThread: CopilotThread | null;
  input: string;
  setInput: (value: string) => void;
  resultLimit: number;
  setResultLimit: (value: number) => void;
  allCandidates: CandidateSummary[];
  campaigns: JobCampaign[];
  activeCampaign: JobCampaign | null;
  selectedCampaignId: string;
  selectCampaign: (id: string) => void;
  shortlistToCampaign: (candidateId: string) => void;
  openCampaign: (id: string) => void;
  send: (messageOverride?: string, limitOverride?: number) => void;
  newThread: () => void;
  openThread: (id: string) => void;
  archiveThread: (id: string) => void;
  createRequirementFromThread: (id: string) => void;
  openCandidate: (id: string) => void;
  busy: boolean;
  requirement: Requirement | null;
  requirementText: string;
  setRequirementText: (value: string) => void;
  requirementFile: File | null;
  setRequirementFile: (file: File | null) => void;
  clarifyAnswers: Record<string, string>;
  setClarifyAnswers: (value: Record<string, string>) => void;
  createRequirement: () => void;
  finalize: () => void;
  match: () => void;
  matches: RequirementMatch[];
}) {
  const [activeTab, setActiveTab] = useState<"search" | "requirement">("search");
  const [filters, setFilters] = useState<CopilotFilters>({
    sort: "relevance",
    minScore: 0,
    exactEvidenceOnly: false,
    country: "all",
    seniority: "all",
  });
  const [ignoredCandidateIds, setIgnoredCandidateIds] = useState<string[]>([]);
  const latestResultCount = messages.reduce((count, message) => count + (message.candidates?.length ?? 0), 0);
  const selectedCampaign = activeCampaign?.id === selectedCampaignId
    ? activeCampaign
    : campaigns.find((item) => item.id === selectedCampaignId) ?? null;
  const shortlistedCandidateIds = useMemo(() => new Set(
    (selectedCampaign?.candidates ?? [])
      .filter((item) => item.status === "shortlisted")
      .map((item) => item.candidate_id)
  ), [selectedCampaign?.candidates]);
  const countryOptions = useMemo(() => {
    const countries = new Set<string>();
    allCandidates.forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country)));
    messages.forEach((message) => (message.candidates ?? []).forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country))));
    return Array.from(countries).sort((left, right) => left.localeCompare(right));
  }, [allCandidates, messages]);
  const latestCandidateMessage = useMemo(() => [...messages].reverse().find((message) => message.candidates?.length), [messages]);
  const latestQuery = latestCandidateMessage?.query ?? input;
  const latestQueryIntent = useMemo(
    () => normalizeCopilotQueryIntent(latestCandidateMessage?.metadata?.query_intent, latestQuery),
    [latestCandidateMessage?.metadata, latestQuery]
  );
  const latestFilteredCandidates = useMemo(() => {
    return filterCopilotCandidates(latestCandidateMessage?.candidates ?? [], filters, latestQuery)
      .filter((candidate) => !ignoredCandidateIds.includes(candidate.document_id));
  }, [filters, ignoredCandidateIds, latestCandidateMessage?.candidates, latestQuery]);
  const computedQueryInsights = useMemo(() => buildCopilotQueryInsights(latestQuery, latestCandidateMessage?.candidates ?? latestFilteredCandidates, latestQueryIntent), [latestQuery, latestCandidateMessage?.candidates, latestFilteredCandidates, latestQueryIntent]);
  const [queryDraft, setQueryDraft] = useState(computedQueryInsights);
  const queryDraftResetRef = useRef("");
  const queryDraftResetKey = latestCandidateMessage
    ? `${activeThread?.id ?? "new"}:${latestCandidateMessage.query ?? ""}:${latestCandidateMessage.candidates?.length ?? 0}`
    : `draft:${activeThread?.id ?? "new"}`;
  useEffect(() => {
    if (queryDraftResetRef.current === queryDraftResetKey) return;
    queryDraftResetRef.current = queryDraftResetKey;
    setQueryDraft(computedQueryInsights);
  }, [queryDraftResetKey, computedQueryInsights]);
  const isSearching = busy && activeTab === "search";
  const canShowMore = Boolean(latestQuery.trim()) && !isSearching && (latestCandidateMessage?.candidates?.length ?? 0) >= resultLimit;
  function updateQueryDraft(next: typeof queryDraft) {
    setQueryDraft(next);
    setInput(copilotAnalysisQuery(next));
  }
  function showMoreResults() {
    const nextLimit = Math.min(100, resultLimit + 10);
    setResultLimit(nextLimit);
    send(latestQuery, nextLimit);
  }
  return (
    <section className="copilotPage">
      <div className="copilotModeBar">
        <div className="copilotTabs">
          <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}><MessageSquare size={16} /> Search Copilot</button>
          <button className={activeTab === "requirement" ? "active" : ""} onClick={() => setActiveTab("requirement")}><FileSearch size={16} /> {RECRUITER_COPY.requirementAssistant}</button>
        </div>
        <div className="copilotModeActions">
          <label className="copilotCampaignSelector">
            <span>Shortlist to</span>
            <select value={selectedCampaignId} onChange={(event) => selectCampaign(event.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.filter((item) => item.status !== "archived").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {selectedCampaignId ? <button className="secondary" type="button" onClick={() => openCampaign(selectedCampaignId)}>Open Campaign</button> : null}
          {activeThread?.id ? <button className="plain" type="button" onClick={() => copyCurrentUrl()}>Copy Thread Link</button> : null}
          <button className="secondary" onClick={newThread}><Plus size={16} /> New Thread</button>
        </div>
      </div>
      <div className="copilotGrid">
        {activeTab === "search" ? <section className="stitchCopilotMain">
          <form
            className="stitchSearchCommand"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Search size={30} />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Find senior data engineers with heavy PySpark experience, ideal locations, and evidence."
            />
            <button disabled={busy || !input.trim()} type="submit">
              {busy ? <><Loader2 size={14} /> Searching</> : "Search"}
            </button>
          </form>
          {isSearching ? (
            <section className="copilotSearchingBanner" aria-live="polite">
              <Loader2 size={18} />
              <div>
                <strong>Finding candidates</strong>
                <span>Checking profiles, raw CV text, recruiter notes, and source-backed evidence.</span>
              </div>
              <i />
            </section>
          ) : null}
          <section className="stitchSignals">
            <div className="stitchSignalsHead">
              <div>
                <h3>Recommended Candidates</h3>
                <span>{latestFilteredCandidates.length || latestResultCount} Matches</span>
              </div>
              <div className="copilotControlGroup">
                <label>
                  Sorted by
                  <select value={filters.sort} onChange={(event) => setFilters((value) => ({ ...value, sort: event.target.value as CopilotFilters["sort"] }))}>
                    <option value="relevance">Match Quality</option>
                    <option value="recency">Recency</option>
                  </select>
                </label>
                <label>
                  Results
                  <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="copilotFilterStrip">
              <label>
                Country
                <select value={filters.country} onChange={(event) => setFilters((value) => ({ ...value, country: event.target.value }))}>
                  <option value="all">Any country</option>
                  {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
                </select>
              </label>
              <button className={filters.seniority === "senior" ? "filterChip active" : "filterChip"} onClick={() => setFilters((value) => ({ ...value, seniority: value.seniority === "senior" ? "all" : "senior" }))}>Senior+</button>
              <button className={filters.exactEvidenceOnly ? "filterChip active" : "filterChip"} onClick={() => setFilters((value) => ({ ...value, exactEvidenceOnly: !value.exactEvidenceOnly }))}>Exact evidence only</button>
            </div>
            <div className="copilotIntentPanel">
              <div>
                <span>Role intent</span>
                <strong>{latestQueryIntent.role_intent}</strong>
              </div>
              <div>
                <span>Locations</span>
                <strong>{latestQueryIntent.locations.length ? latestQueryIntent.locations.join(", ") : "Not specified"}</strong>
              </div>
              <div>
                <span>Location mode</span>
                <strong>{locationRequirementLabel(latestQueryIntent.location_requirement)}</strong>
              </div>
              <div className="locationPreferenceButtons" aria-label="Location preference controls">
                <button className={latestQueryIntent.location_requirement === "preferred" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "preferred"))}>Preferred</button>
                <button className={latestQueryIntent.location_requirement === "required" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "required"))}>Required</button>
                <button className={latestQueryIntent.location_requirement === "ignored" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "ignored"))}>Ignore location</button>
              </div>
            </div>
            <div className={isSearching ? "copilotResultList searching" : "copilotResultList"}>
              {isSearching && !latestFilteredCandidates.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <article className="stitchCandidateCard copilotCompactCard copilotSkeletonCard" key={`loading-${index}`}>
                    <div><i /><i /><b /></div>
                    <span />
                    <p />
                  </article>
                ))
              ) : null}
              {latestFilteredCandidates.map((candidate, index) => {
                const reason = copilotResultReason(candidate, latestQuery);
                const evidenceItems = (candidate.evidence ?? []).filter((item) => item.snippet).slice(0, 2);
                const breakdown = normalizedCopilotScoreBreakdown(candidate);
                const scoreItems = scoreBreakdownItems(breakdown);
                const isShortlisted = shortlistedCandidateIds.has(candidate.document_id);
                const noteSignalTags = candidateNoteSignalLabels(candidate).slice(0, 3);
                return (
                  <article className="stitchCandidateCard copilotCompactCard" key={candidate.document_id}>
                    <div className="stitchCandidateTop">
                      <div className="rankAvatar">{index + 1}</div>
                      <button onClick={() => openCandidate(candidate.document_id)}>
                        <strong>{candidate.name ?? "Unnamed candidate"}</strong>
                        <span>{candidate.current_title ?? "No title"} {candidate.current_company ? `at ${candidate.current_company}` : ""}</span>
                        <em>{candidate.location || "Location not stated"}{candidate.countries?.length ? ` · ${candidate.countries.join(", ")}` : ""}</em>
                      </button>
                      <b>{Math.round(Number(breakdown.total_score ?? candidate.semantic_score ?? 0) * 100)}% Match</b>
                    </div>
                    <div className="copilotScorePills">
                      {scoreItems.map((item) => (
                        <span key={item.label}><strong>{item.value}%</strong> {item.label}</span>
                      ))}
                    </div>
                    <div className="copilotWhyShown">
                      <span>{breakdown.location_reason ? `${reason} Location: ${breakdown.location_reason}.` : reason}</span>
                    </div>
                    {evidenceItems.length ? (
                      <div className="copilotInlineEvidence">
                        <strong>{evidenceSourceLabel(evidenceItems[0])}</strong>
                        <span>{evidenceItems[0].snippet}</span>
                      </div>
                    ) : (
                      <details className="copilotEvidenceDetails mutedEvidence">
                        <summary>No exact snippet returned</summary>
                        <p>This candidate matched the semantic/profile index. Use “Exact evidence only” for stricter results.</p>
                      </details>
                    )}
                    <div className="stitchCandidateActions">
                      {noteSignalTags.map((signal) => <span className="noteSignalChip" key={signal}>{signal}</span>)}
                      {(candidate.top_domains ?? []).slice(0, 2).map((domain) => <span key={domain}>{domainLabel(domain)}</span>)}
                      {candidateRoleFactsNeedReview(candidate) ? <span className="factReviewAction">Role facts need review</span> : null}
                      <button onClick={() => setIgnoredCandidateIds((ids) => [...ids, candidate.document_id])}>Ignore</button>
                      <button className="shortlist" disabled={!selectedCampaignId || isShortlisted} onClick={() => shortlistToCampaign(candidate.document_id)}>
                        {isShortlisted ? "Shortlisted" : selectedCampaignId ? "Shortlist" : "Select campaign"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {!latestFilteredCandidates.length && !isSearching ? <EmptyPanel title="No candidate results yet" body="Write what you are looking for and click Search to review the company candidate database." /> : null}
            </div>
            {latestFilteredCandidates.length ? (
              <div className="copilotShowMoreBar">
                <div>
                  <strong>{latestFilteredCandidates.length} candidates visible</strong>
                  <span>Current search asks for up to {resultLimit} results. Retrieval can expand to 100; LLM synthesis stays capped to the strongest 10 to control cost.</span>
                </div>
                <button className="secondary" disabled={!canShowMore} onClick={showMoreResults}>
                  {canShowMore ? `Show 10 more` : "All returned results shown"}
                </button>
              </div>
            ) : null}
          </section>
        </section> : (
          <section className="panel copilotThread">
            <div className="panelHead">
              <h3>Requirement Builder</h3>
              <span>{requirement?.status ?? "No requirement loaded"}</span>
            </div>
            <div className="requirementHITLGrid">
              <section className="requirementDrop">
                <h3>Upload requirement</h3>
                <label className="fileDrop compact">
                  <FileSearch size={22} />
                  <span>{requirementFile ? requirementFile.name : `Choose ${DOCUMENT_FORMAT_LABEL}`}</span>
                  <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setRequirementFile(event.target.files?.[0] ?? null)} />
                </label>
              </section>
              <section className="requirementPaste">
                <h3>Or paste requirement</h3>
                <textarea value={requirementText} onChange={(event) => setRequirementText(event.target.value)} placeholder="Paste the job requirement, client email, JD, or hiring manager notes here." />
              </section>
            </div>
            <button className="primary" disabled={busy || (!requirementFile && !requirementText.trim())} onClick={createRequirement}>
              Build Requirement Profile
            </button>
            {requirement ? (
              <section className="hitlPanel">
                <div className="panelHead">
                  <h3>{requirement.title || "Requirement clarification"}</h3>
                  <span>{requirement.status}</span>
                </div>
                <div className="hitlQuestions">
                  {(requirement.clarification_questions?.length ? requirement.clarification_questions : ["Confirm must-have skills, years, seniority, location, dealbreakers, and nice-to-haves."]).map((question) => (
                    <label key={question}>
                      <span>{question}</span>
                      <input value={clarifyAnswers[question] ?? ""} onChange={(event) => setClarifyAnswers({ ...clarifyAnswers, [question]: event.target.value })} placeholder="Recruiter answer" />
                    </label>
                  ))}
                </div>
                {requirement.final_requirement_profile ? (
                  <div className="requirementProfilePreview">
                    <strong>Final profile ready</strong>
                    <span>Use the confirmed scorecard to find candidates. Raw extraction JSON stays hidden from the recruiter workflow.</span>
                  </div>
                ) : null}
                <div className="actions">
                  <button className="secondary" onClick={finalize} disabled={busy}>Confirm Requirement</button>
                  <button className="primary" onClick={match} disabled={busy || requirement.status !== "finalized"}>{RECRUITER_COPY.matchingButton}</button>
                </div>
              </section>
            ) : null}
            {matches.length ? <p className="muted">{matches.length} candidates ranked. Review evidence, gaps, shortlist decisions, and rejects from the campaign or match results.</p> : null}
          </section>
        )}
        <aside className="panel copilotGuide">
          <header className="copilotGuideHeader">
            <div>
              <Search size={28} />
              <h3>{activeTab === "search" ? "Search Copilot" : "Requirement Assistant"}</h3>
            </div>
            <span>•••</span>
          </header>
          <h3>Editable Query Analysis</h3>
          <div className="queryAnalysisCard editableQueryAnalysis">
            <div className="queryAnalysisSummary">
              <span>Interpreted search</span>
              <strong>{latestQuery.trim() || "Start with a hiring question"}</strong>
            </div>
            <label>
              <span>Role intent</span>
              <input
                value={queryDraft.roleIntent}
                onChange={(event) => updateQueryDraft({ ...queryDraft, roleIntent: event.target.value })}
              />
            </label>
            <label>
              <span>Skills / signals</span>
              <input
                value={queryDraft.skills.join(", ")}
                onChange={(event) => updateQueryDraft({ ...queryDraft, skills: splitCommaList(event.target.value) })}
                placeholder="Spark, Python, healthcare"
              />
            </label>
            <label>
              <span>Location preference</span>
              <input
                value={queryDraft.locations.join(", ")}
                onChange={(event) => updateQueryDraft({ ...queryDraft, locations: splitCommaList(event.target.value) })}
                placeholder="New York, remote, USA"
              />
            </label>
            <div className="queryAnalysisFooter">
              <span>Visible candidates</span>
              <strong>{latestFilteredCandidates.length}</strong>
              <em>{locationRequirementLabel(latestQueryIntent.location_requirement)}</em>
            </div>
          </div>
          <section className="savedThreadsDrawer">
            <div className="savedThreadsHeader">
              <h3>Saved Threads</h3>
              <span>{threads.length}</span>
            </div>
            <div className="threadList">
              {threads.length ? threads.map((thread) => (
                <article className={activeThread?.id === thread.id ? "active" : ""} key={thread.id}>
                  <button onClick={() => openThread(thread.id)}>
                    <strong>{thread.title}</strong>
                    <span>{thread.message_count ?? 0} messages | {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString() : "No date"}</span>
                  </button>
                  <div className="threadActions">
                    <button className="plain tiny" onClick={() => createRequirementFromThread(thread.id)}>Req</button>
                    <button className="plain tiny danger" onClick={() => archiveThread(thread.id)}>Archive</button>
                  </div>
                </article>
              )) : <EmptyPanel title="No saved threads" body="Ask a Copilot question and the thread will be saved for the recruiter workspace." />}
            </div>
          </section>
          <h3>Quick Refinements</h3>
          <div className="guideList">
            <button className="promptChip" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "preferred"))}>Treat location as preferred</button>
            <button className="promptChip" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "required"))}>Make location required</button>
            <button className="promptChip" onClick={() => setInput(`${latestQuery || queryDraft.roleIntent} with recent experience and recruiter-note relevance`)}>Add recency + notes</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DatabaseView({
  candidates,
  query,
  setQuery,
  open,
  nativeQuery,
  setNativeQuery,
  nativeCandidates,
  searchNativeCandidates,
  requestNativeAccess,
  busy,
}: {
  candidates: CandidateSummary[];
  query: string;
  setQuery: (value: string) => void;
  open: (id: string) => void;
  nativeQuery: string;
  setNativeQuery: (value: string) => void;
  nativeCandidates: NativeCandidateSummary[];
  searchNativeCandidates: (query?: string) => Promise<void>;
  requestNativeAccess: (candidateUserId: string, resumeVersionId?: string | null) => Promise<void>;
  busy: boolean;
}) {
  const [filters, setFilters] = useState<string[]>([]);
  const readyCount = candidates.filter((candidate) => (candidate.coverage ?? 0) >= 0.8 && Number(candidate.duplicate_risk_score ?? 0) < 0.75).length;
  const needsReviewCount = candidates.filter((candidate) => (candidate.coverage ?? 0) < 0.8 || Number(candidate.duplicate_risk_score ?? 0) >= 0.75).length;
  const missingLocationCount = candidates.filter((candidate) => !candidate.location && !(candidate.countries ?? []).length).length;
  const versionSignalCount = candidates.filter((candidate) => Number(candidate.duplicate_risk_score ?? 0) >= 0.75).length;
  const countryFilters = useMemo(() => {
    const countries = new Set<string>();
    candidates.forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country)));
    return Array.from(countries).sort((left, right) => left.localeCompare(right)).slice(0, 6);
  }, [candidates]);
  const noteSignalFilters = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    candidates.forEach((candidate) => {
      (candidate.note_signals ?? []).forEach((signal) => {
        const key = candidateNoteSignalKey(signal);
        if (!key) return;
        const existing = counts.get(key);
        counts.set(key, { label: candidateNoteSignalDisplay(signal), count: (existing?.count ?? 0) + 1 });
      });
    });
    return [...counts.entries()]
      .sort((left, right) => right[1].count - left[1].count || left[1].label.localeCompare(right[1].label))
      .slice(0, 5)
      .map(([key, value]) => ({ id: `note:${key}`, label: value.label }));
  }, [candidates]);
  const filteredCandidates = applyDatabaseFilters(candidates, filters);
  const filterOptions = [
    { id: "ai", label: "AI / GenAI" },
    { id: "experience", label: "5+ Years" },
    ...countryFilters.map((country) => ({ id: `country:${country}`, label: country })),
    { id: "seniority", label: "Lead/Senior" },
    { id: "duplicate", label: "Version Signal" },
    { id: "coverage", label: "Complete Profiles" },
    { id: "missing_location", label: "Missing Location" },
    ...noteSignalFilters,
  ];
  function toggleFilter(id: string) {
    setFilters((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }
  return (
    <section className="databasePage">
      <header className="profilesHeader">
        <div>
          <span className="eyebrow">Profiles</span>
          <h2>Candidate Profiles</h2>
          <p>Search the company resume database using profile fields, recruiter notes, locations, and raw resume evidence.</p>
        </div>
        <div className="profilesResultCount">
          <strong>{filteredCandidates.length}</strong>
          <span>shown of {candidates.length}</span>
        </div>
      </header>

      <div className="profilesMetricStrip">
        <article>
          <div className="profileMetricCardHead"><span>Total Profiles</span></div>
          <strong>{candidates.length}</strong>
          <em>Company database</em>
        </article>
        <article>
          <div className="profileMetricCardHead"><span>Ready</span></div>
          <strong>{readyCount}</strong>
          <em>Enough data for matching</em>
        </article>
        <article className={needsReviewCount ? "attention" : ""}>
          <div className="profileMetricCardHead">
            <span>Needs Review</span>
            {needsReviewCount ? <i className="profileMetricHazard" aria-label="Needs attention"><AlertTriangle size={14} /></i> : null}
          </div>
          <strong>{needsReviewCount}</strong>
          <em>Needs a recruiter decision</em>
        </article>
        <article className={missingLocationCount ? "attention" : ""}>
          <div className="profileMetricCardHead">
            <span>Missing Location</span>
            {missingLocationCount ? <i className="profileMetricHazard" aria-label="Needs attention"><AlertTriangle size={14} /></i> : null}
          </div>
          <strong>{missingLocationCount}</strong>
          <em>Country/location not captured</em>
        </article>
        <article>
          <div className="profileMetricCardHead"><span>Version Signals</span></div>
          <strong>{versionSignalCount}</strong>
          <em>Possible repeated candidate uploads</em>
        </article>
      </div>

      <section className="profileSearchPanel">
        <form className="semanticSearch" onSubmit={(event) => event.preventDefault()}>
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, company, country, raw resume text, or recruiter note" />
          <button type="submit">Search</button>
        </form>
        <div className="filterRow">
          {filterOptions.map((item) => <button className={filters.includes(item.id) ? "filterChip active" : "filterChip"} key={item.id} onClick={() => toggleFilter(item.id)}>{item.label}</button>)}
          <button className="filterChip" onClick={() => setFilters([])}>Clear</button>
        </div>
      </section>

      <NativeCandidateDiscoveryPanel
        query={nativeQuery}
        setQuery={setNativeQuery}
        nativeCandidates={nativeCandidates}
        search={() => searchNativeCandidates(nativeQuery)}
        requestAccess={requestNativeAccess}
        busy={busy}
      />

      <CandidateTable candidates={filteredCandidates} open={open} />
    </section>
  );
}

function NativeCandidateDiscoveryPanel({
  query,
  setQuery,
  nativeCandidates,
  search,
  requestAccess,
  busy,
}: {
  query: string;
  setQuery: (value: string) => void;
  nativeCandidates: NativeCandidateSummary[];
  search: () => Promise<void>;
  requestAccess: (candidateUserId: string, resumeVersionId?: string | null) => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="nativeDiscoveryPanel">
      <div className="nativeDiscoveryHead">
        <div>
          <span className="eyebrow">candidateSignal native</span>
          <h3>Search opt-in candidates without PII</h3>
          <p>These candidates manage their own profiles. You can review fit signals, then request contact/profile access from the candidate.</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search native candidates by role, skills, location..." />
          <button className="secondary" type="submit" disabled={busy}>{busy ? "Searching..." : "Search native"}</button>
        </form>
      </div>
      {nativeCandidates.length ? (
        <div className="nativeCandidateGrid">
          {nativeCandidates.map((candidate) => (
            <article key={candidate.candidate_user_id}>
              <div>
                <strong>{candidate.name}</strong>
                <span>{candidate.headline || "Candidate-managed profile"}</span>
              </div>
              <p>{candidate.summary || "Summary is available after the candidate completes their profile."}</p>
              <div className="nativeCandidateTags">
                {(candidate.skills ?? []).slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}
              </div>
              <footer>
                <small>{candidate.current_location || "Location unclear"} · {candidate.pii_locked ? "PII locked" : "PII approved"}</small>
                <button className="secondary small" type="button" disabled={busy || candidate.request_status === "pending"} onClick={() => requestAccess(candidate.candidate_user_id, candidate.resume_version_id)}>
                  {candidate.request_status === "pending" ? "Requested" : candidate.request_status === "approved" ? "Approved" : "Request access"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="nativeDiscoveryEmpty">
          <span>Native candidates are separate from your tenant database until they opt in and approve PII access.</span>
        </div>
      )}
    </section>
  );
}

function UploadResumeView(props: {
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

function OperationsView(props: {
  workerStatus: WorkerStatus | null;
  batches: ParseBatch[];
  deadLetters: ParseDeadLetter[];
  alerts: OperationalAlert[];
  alertDeliveries: OperationalAlertDelivery[];
  maintenanceJobs: CandidateMaintenanceJob[];
  canManageMaintenance: boolean;
  selectedBatch: ParseBatch | null;
  selectBatch: (batch: ParseBatch) => void;
  retryJob: (jobId: string) => void;
  resolveDeadLetter: (deadLetterId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  cancelJob: (jobId: string) => void;
  cancelBatch: (batchId: string) => void;
  runCandidateMaintenance: () => void;
  retryCandidateMaintenance: (jobId: string) => void;
  cancelCandidateMaintenance: (jobId: string) => void;
  busy: boolean;
}) {
  const activeBatches = props.batches.filter(isActiveBatch);
  const completedBatches = props.batches.filter((batch) => !isActiveBatch(batch));
  const activeMaintenanceJobs = props.maintenanceJobs.filter(isActiveMaintenanceJob);
  const openIssueCount = props.alerts.length + props.deadLetters.length;
  return (
    <section className="operationsPage">
      <div className="pageTitle">
        <div>
          <h2>Resume Processing Review</h2>
          <p>Review failed resumes first, then active and recent upload batches. Advanced diagnostics stay collapsed below.</p>
        </div>
        <span className={openIssueCount ? "statusPill dangerPill" : "statusPill"}>
          {openIssueCount} open issue{openIssueCount === 1 ? "" : "s"}
        </span>
      </div>

      <section className="panel deadLetterPanel uploadQueuePriorityPanel">
        <div className="panelHead">
          <div>
            <h3>Failed Uploads</h3>
            <span>Retry files that can be processed, or acknowledge items that need a corrected replacement upload.</span>
          </div>
          <span className={props.deadLetters.length ? "statusPill dangerPill" : "statusPill"}>{props.deadLetters.length} open</span>
        </div>
        {props.deadLetters.length ? (
          <div className="failedUploadList">
            {props.deadLetters.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.original_filename ?? "Unknown file"}</strong>
                  <span>{item.batch_name ?? "No batch"} | attempts {item.attempt_count}/{item.max_attempts || "?"} | {formatDateTime(item.created_at)}</span>
                  <p>{item.error_message}</p>
                </div>
                <div className="jobActions">
                  <button className="plain small" disabled={props.busy} onClick={() => props.retryJob(item.job_id)}>Retry</button>
                  <button className="plain small danger" disabled={props.busy} onClick={() => props.resolveDeadLetter(item.id)}>Mark reviewed</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No failed resumes" body="Files that exhaust parsing retries will appear here with the exact filename, attempt count, and error." />
        )}
      </section>

      <section className="panel uploadQueueSection">
        <div className="panelHead">
          <div>
            <h3>Active Uploads</h3>
            <span>Resume batches currently waiting, processing, or retrying.</span>
          </div>
          <span className="statusPill">{activeBatches.length} active</span>
        </div>
        {activeBatches.length ? (
          <div className="batchList uploadQueueBatchList">
            {activeBatches.map((batch) => (
              <article key={batch.id} role="button" tabIndex={0} onClick={() => props.selectBatch(batch)}>
                <strong>{batch.name}</strong>
                <span>{domainLabel(batch.status)} | {batch.completed_count}/{batch.total_files} parsed | {batch.failed_count} failed</span>
                <ProgressBar value={batch.progress_percent ?? batchProgress(batch)} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No active uploads" body="Queued or running resume batches will appear here." />
        )}
      </section>

      <section className="panel uploadQueueSection">
        <div className="panelHead">
          <div>
            <h3>Completed Uploads</h3>
            <span>Recent completed, cancelled, or completed-with-errors batches.</span>
          </div>
          <span className="statusPill">{completedBatches.length} total</span>
        </div>
        {completedBatches.length ? (
          <div className="batchList uploadQueueBatchList">
            {completedBatches.slice(0, 10).map((batch) => (
              <article key={batch.id} role="button" tabIndex={0} onClick={() => props.selectBatch(batch)}>
                <strong>{batch.name}</strong>
                <span>{domainLabel(batch.status)} | {batch.completed_count}/{batch.total_files} parsed | {batch.failed_count} failed</span>
                <ProgressBar value={batch.progress_percent ?? batchProgress(batch)} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No completed uploads yet" body="Finished upload batches will appear here after the worker processes resumes." />
        )}
      </section>

      {props.selectedBatch ? (
        <section className="panel batchDetail uploadQueueBatchDetail">
          <div className="panelHead">
            <div>
              <h3>{props.selectedBatch.name}</h3>
              <span>{domainLabel(props.selectedBatch.status)} | {props.selectedBatch.completed_count}/{props.selectedBatch.total_files} parsed | {props.selectedBatch.failed_count} failed</span>
              <ProgressBar value={props.selectedBatch.progress_percent ?? batchProgress(props.selectedBatch)} />
            </div>
            <button className="plain danger" disabled={props.busy || !isActiveBatch(props.selectedBatch)} onClick={() => props.cancelBatch(props.selectedBatch!.id)}>Cancel batch</button>
          </div>
          <div className="jobTable">
            <div className="jobRow header"><span>File</span><span>Status</span><span>Progress</span><span>Actions</span></div>
            {(props.selectedBatch.jobs ?? []).map((job) => (
              <div className="jobRow" key={job.id}>
                <span>{job.original_filename}</span>
                <span>{domainLabel(job.status)}</span>
                <span>
                  <ProgressBar value={job.progress_percent ?? 0} />
                  <small>{job.stage_label ?? domainLabel(job.stage)}{job.error_message ? ` | ${job.error_message}` : ""}</small>
                </span>
                <span className="jobActions">
                  <button className="plain small" disabled={props.busy || !["failed", "retrying", "cancelled"].includes(job.status)} onClick={() => props.retryJob(job.id)}>Retry</button>
                  <button className="plain small danger" disabled={props.busy || !["queued", "retrying", "failed", "running", "processing"].includes(job.status)} onClick={() => props.cancelJob(job.id)}>Cancel</button>
                </span>
              </div>
            ))}
          </div>
          {props.selectedBatch.events?.length ? (
            <details className="queueEventLog">
              <summary>Show processing event log</summary>
              <div>
                {props.selectedBatch.events.slice(0, 20).map((event) => (
                  <article key={event.id}>
                    <strong>{domainLabel(event.event_type)}</strong>
                    <span>{domainLabel(event.status)} | {domainLabel(event.stage)} | {formatDateTime(event.created_at)}</span>
                    {event.message ? <p>{event.message}</p> : null}
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <details className="panel operationsAdvanced">
        <summary>
          <div>
            <strong>Processing Health</strong>
            <span>{props.workerStatus?.online ? "Processing online" : "Processing offline"} | {props.workerStatus?.queued_count ?? 0} waiting | {props.workerStatus?.running_count ?? 0} running</span>
          </div>
          <span className={props.alerts.length ? "statusPill dangerPill" : "statusPill"}>{props.alerts.length} system alert{props.alerts.length === 1 ? "" : "s"}</span>
        </summary>
        <section className="workerStatusPanel">
          <div>
            <h3>Processing Status</h3>
            <p>{props.workerStatus?.online ? "Resume processing is online." : "Processing is offline. Queued resumes will wait."}</p>
          </div>
          <div className="workerStats">
            <Metric label="Waiting" value={`${props.workerStatus?.queued_count ?? 0}`} />
            <Metric label="Running" value={`${props.workerStatus?.running_count ?? 0}`} />
            <Metric label="Failed" value={`${props.workerStatus?.failed_count ?? 0}`} />
            <Metric label="Needs Review" value={`${props.workerStatus?.dead_letter_count ?? 0}`} />
            <Metric label="Active Batches" value={`${activeBatches.length}`} />
            <Metric label="Maintenance" value={`${activeMaintenanceJobs.length}`} />
          </div>
        </section>
      </details>

      <details className="panel operationsAdvanced">
        <summary>
          <div>
            <strong>Advanced Diagnostics</strong>
            <span>System alerts, maintenance runs, and alert-delivery history.</span>
          </div>
          <span className="statusPill">Admin</span>
        </summary>
        <section className="operationsAdvancedGrid">
          <section className="operationsAlertPanel">
            <div className="panelHead">
              <div>
                <h3>Processing Alerts</h3>
                <span>Delayed parsing, exhausted retries, OCR warnings, and stale search indexes.</span>
              </div>
              <span className={props.alerts.length ? "statusPill dangerPill" : "statusPill"}>{props.alerts.length} open</span>
            </div>
            {props.alerts.length ? (
              <div className="alertList">
                {props.alerts.map((alert) => (
                  <article key={alert.id} className={`alertCard ${alert.severity === "critical" ? "critical" : ""}`}>
                    <div>
                      <strong>{alert.title}</strong>
                      <span>{alert.alert_type.replaceAll("_", " ")} | {formatDateTime(alert.created_at)}</span>
                      <p>{alert.body}</p>
                    </div>
                    <button className="plain small" disabled={props.busy} onClick={() => props.acknowledgeAlert(alert.id)}>Acknowledge</button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No processing alerts" body="Alerts appear here when queues stall, parsing fails, OCR quality drops, or search indexes need rebuilding." />
            )}
          </section>
          <section className="maintenancePanel">
            <div className="panelHead">
              <div>
                <h3>Candidate Intelligence Maintenance</h3>
                <span>Refresh timeline totals, countries, coverage, and profile analytics from already saved candidate data.</span>
              </div>
              <button className="primary small" disabled={props.busy || activeMaintenanceJobs.length > 0 || !props.canManageMaintenance} onClick={props.runCandidateMaintenance}>
                {props.canManageMaintenance ? "Run local rederive" : "Admin only"}
              </button>
            </div>
            {props.maintenanceJobs.length ? (
              <div className="maintenanceJobList">
                {props.maintenanceJobs.slice(0, 6).map((job) => (
                  <article key={job.id}>
                    <div>
                      <strong>{job.stage_label ?? job.stage}</strong>
                      <span>
                        {job.status} | {job.processed_candidates}/{job.total_candidates} processed | {job.failed_candidates} failed
                      </span>
                      <ProgressBar value={job.progress_percent ?? 0} />
                      {job.error_message ? <p>{job.error_message}</p> : null}
                    </div>
                    <div className="jobActions vertical">
                      <button className="plain small" disabled={props.busy || !props.canManageMaintenance || !["failed", "completed_with_errors", "cancelled"].includes(job.status)} onClick={() => props.retryCandidateMaintenance(job.id)}>Retry</button>
                      <button className="plain small danger" disabled={props.busy || !props.canManageMaintenance || !isActiveMaintenanceJob(job)} onClick={() => props.cancelCandidateMaintenance(job.id)}>Cancel</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No maintenance runs" body="Use local rederive after deterministic parsing logic changes, such as domain-year caps, countries, coverage, or timeline accounting." />
            )}
          </section>
        </section>
        <section className="operationsDeliveryHistory">
          <div className="panelHead">
            <div>
              <h3>Alert Delivery History</h3>
              <span>Delivery attempts for configured processing alerts.</span>
            </div>
            <span>{props.alertDeliveries.length} attempts</span>
          </div>
          {props.alertDeliveries.length ? (
            <div className="deliveryList">
              {props.alertDeliveries.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <strong>{item.channel} | {item.status}</strong>
                  <span>{item.destination} | {item.status_code ?? "no status"} | {item.latency_ms ?? 0}ms | {formatDateTime(item.created_at)}</span>
                  {item.error_message ? <p>{item.error_message}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No alert deliveries" body="No processing alerts have been delivered to an external destination." />
          )}
        </section>
      </details>
    </section>
  );
}

type CandidateSortKey = "name" | "title" | "company" | "years" | "coverage" | "risk" | "updated";
type ResolutionFilter = "all" | "suggested" | "versioned" | "separate" | "review_later";

function CandidateTable({ candidates, open }: { candidates: CandidateSummary[]; open: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: CandidateSortKey; direction: "asc" | "desc" }>({ key: "updated", direction: "desc" });
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((left, right) => {
      const leftValue = candidateSortValue(left, sort.key);
      const rightValue = candidateSortValue(right, sort.key);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [candidates, sort]);

  function changeSort(key: CandidateSortKey) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
  }

  return (
    <div className="table candidateTable">
      <div className="tableRow header">
        <button onClick={() => changeSort("name")}>Name {sortArrow(sort, "name")}</button>
        <button onClick={() => changeSort("title")}>Current Role {sortArrow(sort, "title")}</button>
        <button onClick={() => changeSort("company")}>Company {sortArrow(sort, "company")}</button>
        <button onClick={() => changeSort("years")}>Experience {sortArrow(sort, "years")}</button>
        <span>Domains</span>
        <span>Location / Country</span>
        <button onClick={() => changeSort("coverage")}>Completeness {sortArrow(sort, "coverage")}</button>
        <button onClick={() => changeSort("risk")}>Version Signal {sortArrow(sort, "risk")}</button>
        <button onClick={() => changeSort("updated")}>Updated {sortArrow(sort, "updated")}</button>
      </div>
      {!sortedCandidates.length ? (
        <div className="tableEmpty">
          <strong>No candidates match this view.</strong>
          <span>Clear filters, change the search query, or upload resumes to build the database.</span>
        </div>
      ) : null}
      {sortedCandidates.map((item) => {
        const hazardItems = candidateListHazards(item);
        const noteSignals = candidateNoteSignalLabels(item).slice(0, 2);
        const freshness = candidateProfileFreshnessLabel(item.profile_freshness);
        return (
          <button className="tableRow" key={item.document_id} onClick={() => open(item.document_id)}>
            <span className="truncateCell candidateListNameCell" title={item.name ?? "Unknown"}>
              <span>
                {hazardItems.length ? <AlertTriangle className="candidateListHazardIcon" size={15} aria-label={hazardItems.join(", ")} /> : null}
                {item.name ?? "Unknown"}
              </span>
              <small>{hazardItems[0] ?? item.email ?? item.phone ?? "No contact ID"}</small>
            </span>
            <span className="truncateCell" title={item.current_title ?? "Missing"}>
              {item.current_title ?? "Missing"}
              {candidateRoleFactsNeedReview(item) ? <small className="factReviewText">Role facts need review</small> : null}
            </span>
            <span className="truncateCell" title={item.current_company ?? "Missing"}>{item.current_company ?? "Missing"}</span>
            <span>{typeof item.total_years_experience === "number" ? `${item.total_years_experience} yrs` : "N/A"}<small>{item.seniority ?? "Unknown seniority"}</small></span>
            <span className="truncateCell" title={(item.top_domains ?? []).map(domainLabel).join(", ") || "Missing"}>
              {(item.top_domains ?? []).slice(0, 2).map(domainLabel).join(", ") || "Missing"}
              {noteSignals.length ? <small>{noteSignals.join(" | ")}</small> : null}
            </span>
            <span className="truncateCell" title={[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}>
              {[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}
              {freshness ? <small>{freshness}</small> : null}
            </span>
            <span className="coverageCell"><i style={{ width: `${Math.round((item.coverage ?? 0) * 100)}%` }} />{item.coverage ? `${Math.round(item.coverage * 100)}%` : "N/A"}</span>
            <span>{item.duplicate_risk_score ? <b className="riskBadge">{Math.round(item.duplicate_risk_score * 100)}% {versionStatusLabel(item.duplicate_status)}</b> : "Unique"}</span>
            <span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "N/A"}</span>
          </button>
        );
      })}
    </div>
  );
}

function CandidateDetail({
  candidate,
  token,
  teamMembers,
  reparseBatches,
  noteName,
  setNoteName,
  note,
  setNote,
  saveNote,
  noteSaveState,
  noteSaveError,
  deletingNoteId,
  updateSavedNote,
  deleteSavedNote,
  updateProfile,
  deleteCandidate,
  openCandidate,
  reparseCandidate,
  canReparse,
  match,
  activeTab,
  setActiveTab,
  refreshCandidate,
  openCandidateVersions,
  markReviewSignal,
}: {
  candidate: Candidate;
  token: string;
  teamMembers: TeamMember[];
  reparseBatches: ParseBatch[];
  noteName: string;
  setNoteName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  saveNote: () => Promise<void> | void;
  noteSaveState: "idle" | "saving" | "saved" | "error";
  noteSaveError: string;
  deletingNoteId: string;
  updateSavedNote: (noteId: string, name: string, content: string) => void;
  deleteSavedNote: (noteId: string) => void;
  updateProfile: (payload: CandidateProfileUpdate) => void;
  deleteCandidate: (documentId: string) => void;
  openCandidate: (id: string) => void;
  reparseCandidate: (id: string) => void;
  canReparse: boolean;
  match: () => void;
  activeTab: CandidateDetailTab;
  setActiveTab: (tab: CandidateDetailTab) => void;
  refreshCandidate: () => Promise<void> | void;
  openCandidateVersions: () => void;
  markReviewSignal: (signalKey: CandidateReviewSignal) => void;
}) {
  const hr = candidate.derived?.hr_profile;
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState("");
  const [documentHtml, setDocumentHtml] = useState("");
  const [documentHtmlError, setDocumentHtmlError] = useState("");
  const [rawText, setRawText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [editingNoteName, setEditingNoteName] = useState("");
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [showRawCvText, setShowRawCvText] = useState(false);
  const [showCorrectionPanel, setShowCorrectionPanel] = useState(false);
  const [linkedinUrlDraft, setLinkedinUrlDraft] = useState("");
  const [linkedinRun, setLinkedinRun] = useState<LinkedInVerificationRun | null>(null);
  const [linkedinVerifyState, setLinkedinVerifyState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [linkedinVerifyError, setLinkedinVerifyError] = useState("");
  const [correctionForm, setCorrectionForm] = useState<CandidateCorrectionForm>(() => candidateCorrectionForm(candidate));
  const reportTopRef = useRef<HTMLElement | null>(null);
  const intelligence = candidate.candidate_intelligence;
  const finalProfile = intelligence?.final_candidate_profile;
  const recruiterDashboard = intelligence?.hr_intelligence?.recruiter_dashboard;
  const timeline = intelligence?.timeline ?? candidate.derived?.timeline;
  const locationIntel = candidate.derived?.location_intelligence;
  const piiIntel = candidate.derived?.pii_contact_intelligence ?? {};
  const linkedinProfileUrls = toTextList(piiIntel.linkedin_urls ?? []);
  const otherLinkedinUrls = toTextList(piiIntel.other_linkedin_urls ?? []);
  const portfolioUrls = toTextList(piiIntel.portfolio_websites ?? []);
  const profileVerification = candidate.derived?.profile_verification ?? {};
  const profileFreshness = candidate.derived?.profile_freshness ?? {};
  const linkedinExternal = profileVerification.linkedin_external ?? {};
  const recruiterNoteSignals = candidate.derived?.recruiter_note_signals ?? {};
  const factVerification = candidate.derived?.fact_verification ?? {};
  const reviewedSignals = candidate.reviewed_signals ?? [];
  const roleFactNeedsReview = Boolean(factVerification.current_role_status && factVerification.current_role_status !== "verified" && !reviewedSignals.includes("role_fact_review"));
  const timelineEvents = timeline?.timeline_events ?? [];
  const accounting = timeline?.experience_accounting;
  const bestFitRoles = toTextList(finalProfile?.best_fit_roles ?? intelligence?.hr_intelligence?.good_fit_roles);
  const aiNotes = toTextList(finalProfile?.ai_notes ?? intelligence?.hr_intelligence?.ai_notes);
  const dashboardBullets = toTextList(finalProfile?.recruiter_brief ?? recruiterDashboard?.one_minute_summary);
  const wowFactors = toTextList(finalProfile?.wow_factor ?? aiNotes);
  const screeningQuestions = toTextList(finalProfile?.questions_to_ask ?? intelligence?.hr_intelligence?.questions_to_ask ?? intelligence?.hr_intelligence?.screening_questions);
  const sourceName = candidate.source_file?.split("/").pop() ?? "Uploaded CV";
  const sourceExt = sourceName.split(".").pop()?.toLowerCase() ?? "";
  const canInlinePreview = ["pdf", "txt", "md", "png", "jpg", "jpeg", "webp"].includes(sourceExt);
  const canHtmlPreview = ["docx", "txt", "md"].includes(sourceExt);
  const evidenceMap = intelligence?.hr_intelligence?.evidence_map ?? [];
  const domainEntries = Object.entries(candidate.derived?.experience_by_domain ?? {});
  const uniqueExperienceYears = numericYears(accounting?.total_years_unique ?? hr?.total_years_experience);
  const domainRows = domainEntries.map(([domain, value]) => {
    const years = domainYears(value);
    const originalYears = domainOriginalYears(value);
    const evidenceTerms = domainStoredEvidenceTerms(value);
    const reviewFlags = domainStoredReviewFlags(value);
    const capped = Boolean(value && typeof value === "object" && (value as { capped?: unknown }).capped);
    return {
      domain,
      years,
      originalYears,
      evidenceTerms,
      reviewFlags,
      capped,
      overTotal: Boolean(uniqueExperienceYears && years > uniqueExperienceYears + 0.25),
      width: Math.min(100, uniqueExperienceYears ? (Math.min(years, uniqueExperienceYears) / uniqueExperienceYears) * 100 : years * 12),
    };
  }).sort((left, right) => right.years - left.years);
  const skillTaxonomyEntries = Object.entries(intelligence?.hr_intelligence?.skill_taxonomy ?? {});
  const locationSignals = locationIntel?.location_signals ?? locationIntel?.countries_associated ?? candidate.derived?.countries_associated ?? [];
  const latestJobLocation = textValue(locationIntel?.latest_role_location) || textValue(locationIntel?.current_job_location) || textValue(candidate.experience?.[0]?.location);
  const resumeHeaderLocation = textValue(locationIntel?.resume_header_location) || textValue(candidate.contact?.location);
  const currentLocation = resumeHeaderLocation || textValue(locationIntel?.current_location) || latestJobLocation;
  const currentLocationSource = resumeHeaderLocation && currentLocation === resumeHeaderLocation ? "resume_header" : textValue(locationIntel?.current_location_source);
  const coverage = candidate.primary_key_coverage;
  const coverageScore = Number(coverage?.score ?? 0);
  const needsUploadReview = coverageScore > 0 && coverageScore < 0.8 && !reviewedSignals.includes("low_coverage");
  const profileFreshnessNeedsReview = candidateProfileFreshnessNeedsReview(candidate);
  const verifiedFactRows = [
    candidate.name ? { label: "Name", value: candidate.name, source: "Parsed identity field", query: [candidate.name] } : null,
    candidate.contact?.email ? { label: "Email", value: candidate.contact.email, source: "Parsed contact field", query: [candidate.contact.email] } : null,
    candidate.contact?.phone ? { label: "Phone", value: candidate.contact.phone, source: "Parsed contact field", query: [candidate.contact.phone] } : null,
    linkedinProfileUrls.length ? { label: "LinkedIn", value: linkedinProfileUrls[0], source: "Deterministic PII/link extraction", query: linkedinProfileUrls.slice(0, 2) } : null,
    portfolioUrls.length ? { label: "Portfolio", value: portfolioUrls[0], source: "Deterministic PII/link extraction", query: portfolioUrls.slice(0, 2) } : null,
    currentLocation ? { label: "Current location", value: currentLocation, source: currentLocationSource === "resume_header" ? "Resume contact/header location" : "Latest experience location", query: [currentLocation] } : null,
    latestJobLocation ? { label: "Latest role location", value: latestJobLocation, source: "Latest experience location", query: [latestJobLocation] } : null,
    resumeHeaderLocation ? { label: "Resume header location", value: resumeHeaderLocation, source: "Resume contact/header location", query: [resumeHeaderLocation] } : null,
    hr?.current_title ? { label: "Current title", value: hr.current_title, source: "Derived HR profile", query: [hr.current_title] } : null,
    hr?.current_company ? { label: "Current company", value: hr.current_company, source: "Derived HR profile", query: [hr.current_company] } : null,
    typeof accounting?.total_years_unique === "number" || typeof hr?.total_years_experience === "number" ? { label: "Non-overlapping experience", value: formatYears(accounting?.total_years_unique ?? hr?.total_years_experience), source: "Timeline accounting", query: [] } : null,
    candidate.skills?.length ? { label: "Skills found", value: candidate.skills.slice(0, 12).join(", "), source: "Parsed skills", query: candidate.skills.slice(0, 8) } : null,
    candidate.education?.length ? { label: "Education", value: candidate.education.map((item) => [item.degree, item.field, item.school].filter(Boolean).join(" | ")).filter(Boolean).slice(0, 3).join("; "), source: "Parsed education", query: candidate.education.flatMap((item) => [item.school, item.degree, item.field].filter(Boolean) as string[]).slice(0, 6) } : null,
    candidate.certifications?.length ? { label: "Certifications", value: candidate.certifications.slice(0, 5).join(", "), source: "Parsed certifications", query: candidate.certifications.slice(0, 5) } : null,
  ].filter(Boolean) as Array<{ label: string; value?: string | null; source: string; query: string[] }>;
  const aiFitRows = [
    ...aiNotes.slice(0, 4).map((item) => ({ label: "AI note", value: item, source: "AI inference", query: evidenceTerms(item) })),
    ...bestFitRoles.slice(0, 3).map((role) => ({ label: "Good fit for", value: role, source: "Role-fit inference", query: evidenceTerms(role) })),
    ...screeningQuestions.slice(0, 3).map((question) => ({ label: "Ask HR", value: question, source: "Screening guidance", query: evidenceTerms(question) })),
  ];

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewError("");
    setPreviewUrl("");
    getCandidateSource(token, candidate.document_id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (active) setPreviewError(error instanceof Error ? error.message : "Could not load source preview");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidate.document_id, token]);

  useEffect(() => {
    setCorrectionForm(candidateCorrectionForm(candidate));
    setShowCorrectionPanel(false);
    setLinkedinUrlDraft(primaryLinkedIn || "");
    setLinkedinVerifyState("idle");
    setLinkedinVerifyError("");
    // Keep manual correction edits stable during same-candidate refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.document_id]);

  useEffect(() => {
    let active = true;
    getLinkedInVerification(token, candidate.document_id)
      .then((result) => {
        if (active) setLinkedinRun(result.run);
      })
      .catch(() => {
        if (active) setLinkedinRun(null);
      });
    return () => {
      active = false;
    };
  }, [candidate.document_id, token]);

  useEffect(() => {
    let active = true;
    setDocumentHtml("");
    setDocumentHtmlError("");
    if (!canHtmlPreview) return () => {
      active = false;
    };
    getCandidateDocumentHtml(token, candidate.document_id)
      .then((result) => {
        if (active) setDocumentHtml(result.html);
      })
      .catch((error) => {
        if (active) setDocumentHtmlError(error instanceof Error ? error.message : "Could not render document preview");
      });
    return () => {
      active = false;
    };
  }, [candidate.document_id, token, canHtmlPreview]);

  useEffect(() => {
    let active = true;
    getCandidateRawText(token, candidate.document_id)
      .then((text) => {
        if (active) setRawText(text);
      })
      .catch(() => {
        if (active) setRawText("");
      });
    return () => {
      active = false;
    };
  }, [candidate.document_id, token]);

  const strengths = dashboardBullets.length ? dashboardBullets : wowFactors;
  const concerns = toTextList(
    finalProfile?.possible_concerns ??
    finalProfile?.concerns ??
    intelligence?.hr_intelligence?.possible_concerns ??
    intelligence?.hr_intelligence?.concerns
  );
  const educationRows = candidateEducationRows(candidate.education ?? []);
  const educationTimelineEvents = candidateEducationTimelineEvents(candidate.education ?? []);
  const fallbackWorkTimelineEvents = candidate.experience.map((item, index) => ({
      id: `${item.company ?? "company"}-${item.title ?? "role"}-${index}`,
      title: item.title,
      organization: item.company,
      start_date: item.start_date,
      end_date: item.end_date,
      summary: item.bullets?.[0],
      workstreams: item.workstreams ?? [],
      relationship: "work",
      crossCompanyOverlap: false,
    }));
  const timelineBaseEvents = timelineEvents.length ? timelineEvents : fallbackWorkTimelineEvents;
  const reportTimeline = buildTimelineRows(dedupeTimelineEvents([
    ...timelineBaseEvents,
    ...educationTimelineEvents,
  ]));
  const timelineMarkers = timelineYearMarkers(reportTimeline);
  const verifiedSkillGroups = skillTaxonomyEntries.length
    ? skillTaxonomyEntries.map(([group, values]) => ({ group, skills: toTextList(Array.isArray(values) ? values : []) }))
    : [{ group: "Skills", skills: candidate.skills ?? [] }];
  const candidateTabs: Array<{ id: CandidateDetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "evidence", label: "Evidence" },
    { id: "cv", label: "Original CV" },
    { id: "notes", label: "Notes" },
    { id: "versions", label: "Versions" },
  ];
  const locationChips = candidateLocationChips(locationSignals, currentLocation);
  const primaryLinkedIn = linkedinProfileUrls[0];
  const primaryPortfolio = portfolioUrls[0];
  const linkedinVerified = isLinkedInVerified(linkedinRun, profileVerification.linkedin, linkedinExternal);
  const linkedinConfidence = linkedinMatchConfidence(linkedinRun, linkedinExternal);
  const linkedinConfidenceLabel = typeof linkedinConfidence === "number" ? `${Math.round(linkedinConfidence * 100)}% match` : null;
  const linkedinVerificationBusy = linkedinVerifyState === "running" || linkedinRun?.status === "running" || linkedinRun?.status === "queued";
  const versionMatches = candidate.candidate_versions?.matches ?? [];
  const versionLinks = candidateVersionLinks(candidate, versionMatches);
  const versionSummary = candidateVersionSummary(versionLinks);
  const reparseStatusBatch = latestCandidateReparseBatch(reparseBatches, sourceName);
  const reparseProgress = reparseStatusBatch ? Number(reparseStatusBatch.progress_percent ?? batchProgress(reparseStatusBatch)) : 0;
  const parseQuality = candidate._metadata?.parse_quality ?? {};
  const deepParseFailed = parseQuality.deep_parse_status === "failed" || intelligence?.status === "failed";
  const recruiterEvidenceRows = buildRecruiterEvidenceRows(verifiedFactRows, aiFitRows, evidenceMap, rawText);
  const coverageReasons = coverageGapReasons(coverage);
  const structuredNoteSignals = noteSignalItems(recruiterNoteSignals);
  const recentRecruiterNotes = (candidate.notes ?? []).slice(0, 2);
  const candidateRiskItems = [
    ...concerns.slice(0, 3),
    ...coverageReasons.slice(0, 2).map((reason) => `${reason.label}: ${reason.detail}`),
    roleFactNeedsReview ? "Current role facts need recruiter review before relying on matching." : "",
    profileFreshnessNeedsReview && profileFreshness?.summary ? profileFreshness.summary : "",
    !primaryLinkedIn ? "LinkedIn profile was not found in the resume." : linkedinVerified ? "" : "LinkedIn profile is present but not verified yet.",
  ].filter((item): item is string => Boolean(item));

  function saveCandidateCorrections() {
    updateProfile(candidateCorrectionPayload(correctionForm));
    setShowCorrectionPanel(false);
  }

  function selectCandidateTab(tab: CandidateDetailTab) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      reportTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  async function verifyLinkedIn() {
    const targetUrl = linkedinUrlDraft.trim() || primaryLinkedIn || "";
    setLinkedinVerifyState("running");
    setLinkedinVerifyError("");
    try {
      const result = await verifyLinkedInProfile(token, candidate.document_id, targetUrl);
      setLinkedinRun(result.run);
      await pollLinkedInVerification(result.run.id);
    } catch (error) {
      setLinkedinVerifyState("error");
      setLinkedinVerifyError(readableError(error));
    }
  }

  async function pollLinkedInVerification(runId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1200);
      const result = await getLinkedInVerification(token, candidate.document_id);
      if (result.run) setLinkedinRun(result.run);
      if (result.run && ["succeeded", "failed"].includes(result.run.status)) {
        if (result.run.status === "succeeded") {
          setLinkedinVerifyState("done");
          await refreshCandidate();
        } else {
          setLinkedinVerifyState("error");
          setLinkedinVerifyError(result.run.error_message || "LinkedIn verification failed");
        }
        return;
      }
      if (result.run?.id !== runId && result.run?.status === "succeeded") {
        setLinkedinVerifyState("done");
        await refreshCandidate();
        return;
      }
    }
    setLinkedinVerifyState("idle");
  }

  return (
    <section className="candidateReport candidateTabbedReport candidateCleanReport">
      <header className="candidateCleanHeader">
        <section className="candidateCleanIdentity">
          <div className="candidateReportAvatar">{candidateInitials(candidate.name)}</div>
          <div>
            <span className="reportLabel">Candidate Report</span>
            <h2 className="candidateNameLine">
              {candidate.name ?? "Unknown Candidate"}
              {primaryLinkedIn ? (
                <span className={linkedinVerified ? "linkedinHeaderBadge verified" : "linkedinHeaderBadge"}>
                  {linkedinVerified ? <CheckCircle2 size={15} /> : null}
                  <a href={primaryLinkedIn} target="_blank" rel="noreferrer">LinkedIn</a>
                  {linkedinVerified ? (
                    <b>{linkedinConfidenceLabel ? `Verified · ${linkedinConfidenceLabel}` : "Verified"}</b>
                  ) : (
                    <button type="button" onClick={() => void verifyLinkedIn()} disabled={linkedinVerificationBusy}>
                      {linkedinVerificationBusy ? "Verifying..." : "Verify"}
                    </button>
                  )}
                </span>
              ) : null}
            </h2>
            <p>
              {hr?.current_title ?? finalProfile?.summary_card?.current_or_target_title ?? "Role not extracted"}
              {hr?.current_company ? ` at ${hr.current_company}` : ""}
            </p>
            <div className="candidateReportBadges">
              <span>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)} experience</span>
              {roleFactNeedsReview ? <span className="factReviewBadge"><AlertTriangle size={13} /> Role facts need review</span> : <span className="factVerifiedBadge">Role facts verified</span>}
              {profileFreshness?.label ? <span className={profileFreshnessBadgeClass(profileFreshness.status)}>{profileFreshness.label}</span> : null}
              {currentLocation ? <span className="currentLocationBadge">Current location: {currentLocation}</span> : <span className="currentLocationBadge muted">Current location not stated</span>}
              <span className={versionSummary.needsReview ? "versionReviewBadge" : ""}>{versionSummary.needsReview ? <AlertTriangle size={13} /> : null}{versionSummary.badge}</span>
              {reparseStatusBatch ? <span className="reparseStatusBadge">Reparse: {domainLabel(reparseStatusBatch.status)}</span> : null}
              {primaryPortfolio ? <a href={primaryPortfolio} target="_blank" rel="noreferrer">Portfolio</a> : null}
            </div>
          </div>
        </section>
        <section className="candidateCleanActions">
          <button className="plain" type="button" onClick={() => copyCurrentUrl()}>Copy Link</button>
          <button className="plain" type="button" onClick={() => selectCandidateTab("cv")}>View CV</button>
          <button className="plain" type="button" onClick={() => selectCandidateTab("notes")}>Recruiter Notes</button>
          {canReparse ? <button className="plain" type="button" onClick={() => reparseCandidate(candidate.document_id)}>Reparse CV</button> : null}
          {roleFactNeedsReview ? <button className="plain" type="button" onClick={() => markReviewSignal("role_fact_review")}>Mark role reviewed</button> : null}
          {profileFreshnessNeedsReview ? <button className="plain" type="button" onClick={() => markReviewSignal("profile_freshness_review")}>Mark freshness reviewed</button> : null}
          <button className="plain candidateHazardAction" type="button" onClick={() => deleteCandidate(candidate.document_id)}><AlertTriangle size={14} /> Archive Upload</button>
          <button className="primary" type="button" onClick={match}>Match to Role</button>
        </section>
      </header>
      {deepParseFailed ? (
        <article className="candidateParseQualityBanner">
          <AlertTriangle size={18} />
          <div>
            <strong>Deep AI analysis did not complete</strong>
            <span>{parseQuality.deep_parse_error || intelligence?.error || "The factual extraction is available, but the richer HR intelligence needs a retry."}</span>
          </div>
          {canReparse ? <button className="secondary" type="button" onClick={() => reparseCandidate(candidate.document_id)}>Retry deep parse</button> : null}
        </article>
      ) : null}
      {needsUploadReview ? (
        <article className="candidateBadUploadBanner">
          <AlertTriangle size={18} />
          <div>
            <strong>Profile needs review ({Math.round(coverageScore * 100)}% complete)</strong>
            <span>{coverageScore < 0.65 ? "This is below the usable profile threshold. It may be a wrong upload, weak scan, or missing core resume sections." : "This is usable but needs recruiter review before matching confidence is high."}</span>
            {coverageReasons.length ? (
              <ul>
                {coverageReasons.slice(0, 4).map((reason) => <li key={`${reason.label}-${reason.detail}`}>{reason.label}: {reason.detail}</li>)}
              </ul>
            ) : null}
          </div>
          <button className="plain" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit extracted fields</button>
          <button className="plain" onClick={() => markReviewSignal("low_coverage")}>Mark reviewed</button>
          <button className="plain candidateHazardAction" onClick={() => deleteCandidate(candidate.document_id)}><AlertTriangle size={14} /> Archive from active database</button>
        </article>
      ) : null}
      {showCorrectionPanel ? (
        <CandidateCorrectionPanel
          form={correctionForm}
          setForm={setCorrectionForm}
          save={saveCandidateCorrections}
          cancel={() => setShowCorrectionPanel(false)}
        />
      ) : null}

      <main ref={reportTopRef} className="candidateReportMain candidateCleanMainShell">
        <header className="candidateBriefHeader">
          <div>
            <h2>{activeTab === "overview" ? "Overview" : candidateTabs.find((tab) => tab.id === activeTab)?.label}</h2>
            <p>{RECRUITER_COPY.candidateReportSubtitle}</p>
          </div>
          <div>
              <button className="plain" type="button" onClick={() => selectCandidateTab("evidence")}>Source Evidence</button>
              <button className="plain" type="button" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit Extracted Data</button>
              <button className="plain" type="button" onClick={() => selectCandidateTab("notes")}>Add Note</button>
            </div>
        </header>

        <nav className="candidateReportTabs" aria-label="Candidate detail sections">
          {candidateTabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => selectCandidateTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="candidateReviewWorkspace">
          <div className="candidateReviewMain">
        {activeTab === "overview" ? (
          <section className="candidateOverviewStack">
            <div className="candidateCleanPrimary">
              <article className="candidateReportHeroCard">
                <span className="reportLabel">Recruiter Summary</span>
                <p>{dashboardBullets[0] || finalProfile?.summary_card?.headline || candidate.summary || "No recruiter summary is available yet. Review the resume and add notes."}</p>
              </article>

              <article className="briefCard candidateIdentityLocationCard">
                <div className="candidateSectionHeader">
                  <div>
                    <h3>Identity & Location</h3>
                    <p>Current location prefers the resume header/profile location. Latest role location is shown separately when it differs.</p>
                  </div>
                  <span>{currentLocation ? "Current location found" : "Current location unknown"}</span>
                </div>
                <div className="identityLocationGrid">
                  <div className="currentLocationCallout">
                    <span>Current location</span>
                    <strong>{currentLocation || "Not stated"}</strong>
                    {currentLocationSource ? <em>Source: {domainLabel(currentLocationSource)}</em> : null}
                    {latestJobLocation && latestJobLocation !== currentLocation ? <em>Latest role: {latestJobLocation}</em> : null}
                  </div>
                  <div className="locationChipList">
                    {locationChips.length ? locationChips.map((item, index) => (
                      <span className={item.current ? "currentLocationChip" : ""} key={`${item.label}-${index}`}>{item.label}</span>
                    )) : <span>No country or location signals found</span>}
                  </div>
                </div>
                <div className="piiList clean identityPiiList">
                  <PiiGroup label="Email" values={piiIntel.emails ?? (candidate.contact?.email ? [candidate.contact.email] : [])} />
                  <PiiGroup label="Phone" values={piiIntel.phones ?? (candidate.contact?.phone ? [candidate.contact.phone] : [])} />
                  <PiiGroup label="LinkedIn profile" values={linkedinProfileUrls} />
                  {otherLinkedinUrls.length ? <PiiGroup label="Other LinkedIn links" values={otherLinkedinUrls} compact /> : null}
                  <PiiGroup label="Portfolio" values={portfolioUrls} />
                </div>
              </article>

              <section className="candidateDecisionGrid" aria-label="Recruiter decision cards">
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Role fit</span>
                  <h3>Best Roles</h3>
                  <div className="roleCards">{bestFitRoles.length ? bestFitRoles.slice(0, 5).map((role, index) => <span key={`${role}-${index}`}>{role}</span>) : <span>No suggested roles generated</span>}</div>
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Decision signal</span>
                  <h3><CheckCircle2 size={18} /> Why Call</h3>
                  {strengths.length ? (
                    <ul>{strengths.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  ) : <p className="muted">No strong signals generated yet.</p>}
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Profile verification</span>
                  <h3><ShieldCheck size={18} /> Verification</h3>
                  <div className="decisionFactList">
                    <div><span>Freshness</span><strong>{profileFreshness?.label ?? "Unknown"}</strong></div>
                    <div><span>LinkedIn</span><strong>{linkedinVerified ? (linkedinConfidenceLabel ?? "Verified") : primaryLinkedIn ? "Needs verification" : "Not found"}</strong></div>
                    <div><span>Portfolio</span><strong>{primaryPortfolio ? "Found" : "Not found"}</strong></div>
                    <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong></div>
                  </div>
                  {profileFreshness?.summary ? <p className="muted">{profileFreshness.summary}</p> : null}
                  {profileFreshnessNeedsReview ? (
                    <button className="plain small" type="button" onClick={() => markReviewSignal("profile_freshness_review")}>Mark freshness reviewed</button>
                  ) : null}
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Recruiter context</span>
                  <h3>Notes & Constraints</h3>
                  {structuredNoteSignals.length ? (
                    <div className="noteSignalList compact">
                      {structuredNoteSignals.slice(0, 5).map((item, index) => (
                        <span key={`${item.category}-${item.label}-${item.value ?? index}`}>
                          <b>{domainLabel(item.category)}</b>
                          {domainLabel(item.value || item.label)}
                        </span>
                      ))}
                    </div>
                  ) : recentRecruiterNotes.length ? (
                    <ul>{recentRecruiterNotes.map((item, index) => <li key={`${item.name}-${item.created_at ?? index}`}>{item.name}: {item.content}</li>)}</ul>
                  ) : <p className="muted">No recruiter notes or structured constraints saved yet.</p>}
                </article>
                <article className="briefCard candidateDecisionCard concern">
                  <span className="reportLabel">Screening plan</span>
                  <h3><AlertTriangle size={18} /> Risks & Questions</h3>
                  {candidateRiskItems.length || screeningQuestions.length ? (
                    <ul>
                      {candidateRiskItems.slice(0, 3).map((item, index) => <li key={`risk-${index}`}>{item}</li>)}
                      {screeningQuestions.slice(0, Math.max(1, 4 - candidateRiskItems.length)).map((question, index) => <li key={`question-${index}`}>Ask: {question}</li>)}
                    </ul>
                  ) : <p className="muted">No concerns generated. Recruiter should still validate fit in screening.</p>}
                </article>
              </section>

              <article className="briefCard">
                <h3>Skills & Domain Experience</h3>
                <div className="candidateSkillDomainGrid">
                  <div className="reportSkillGroups clean">
                    {verifiedSkillGroups.slice(0, 4).map((group) => (
                      <article key={group.group}>
                        <strong>{group.group.replaceAll("_", " ")}</strong>
                        <div>{group.skills.slice(0, 8).map((skill, index) => <span key={`${group.group}-${skill}-${index}`}>{skill}</span>)}</div>
                      </article>
                    ))}
                  </div>
                  <div className="reportDomainList compact">
                    {domainRows.length ? domainRows.slice(0, 5).map((item) => (
                      <article className={item.capped || item.overTotal ? "domainReview" : ""} key={item.domain}>
                        <div><span>{domainLabel(item.domain)}</span><strong>{item.years} yrs</strong></div>
                        {item.capped ? <em>Capped from {item.originalYears} yrs to total verified experience.</em> : null}
                      </article>
                    )) : <p className="muted">No domain-year facts stored.</p>}
                  </div>
                </div>
              </article>

              <article className="briefCard candidateEducationCard">
                <div className="candidateSectionHeader">
                  <div>
                    <h3>Education</h3>
                    <p>Parsed from the CV and included in candidate matching context.</p>
                  </div>
                  <span>{educationRows.length ? `${educationRows.length} record${educationRows.length === 1 ? "" : "s"}` : "Missing"}</span>
                </div>
                {educationRows.length ? (
                  <div className="educationList">
                    {educationRows.map((item, index) => (
                      <article key={`${item.school}-${item.degree}-${index}`}>
                        <div>
                          <strong>{item.degree || item.field || "Education"}</strong>
                          <span>{item.school || "School not extracted"}</span>
                        </div>
                        <em>{[item.field, item.location].filter(Boolean).join(" | ") || "Field/location not stated"}</em>
                        <small>{educationDateLabel(item)}</small>
                        {item.details.length ? <p>{item.details.slice(0, 2).join(" ")}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : <p className="muted">No education history was extracted. Use source evidence or reparse if the CV contains education.</p>}
              </article>

              <CandidateWorkEducationTimeline
                rows={reportTimeline}
                markers={timelineMarkers}
                uniqueExperience={formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "timeline" ? (
          <CandidateWorkEducationTimeline
            rows={reportTimeline}
            markers={timelineMarkers}
            uniqueExperience={formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}
          />
        ) : null}

        {activeTab === "notes" ? (
          <section className="candidateNotesWorkspace" id="candidate-notes">
            <article className="briefCard recruiterNotesReport polishedNotesReport">
              <div className="notesComposerHeader">
                <div>
                  <h3>Recruiter Notes</h3>
                  <p>Notes are saved to the candidate profile and included in search/matching context.</p>
                </div>
                <NoteTypeButtons setNoteName={setNoteName} />
              </div>
              <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write recruiter notes. These become searchable candidate context." />
              <button className="secondary" type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteSaveState === "saving"}>
                {noteSaveState === "saving" ? "Saving..." : noteSaveState === "saved" ? "Saved" : "Save Note"}
              </button>
              {noteSaveError ? <p className="noteSaveFeedback error">{noteSaveError}</p> : null}
              {noteSaveState === "saved" ? <p className="noteSaveFeedback success">Recruiter note saved to this candidate.</p> : null}
              <div className="notes">
                {(candidate.notes ?? []).map((item, index) => (
                  <article key={`${item.created_at}-${index}`}>
                    {editingNoteId === item.id ? (
                      <>
                        <input value={editingNoteName} onChange={(event) => setEditingNoteName(event.target.value)} />
                        <textarea value={editingNoteContent} onChange={(event) => setEditingNoteContent(event.target.value)} />
                        <div className="jobActions">
                          <button className="plain small" type="button" onClick={() => setEditingNoteId("")}>Cancel</button>
                          <button className="secondary small" type="button" onClick={() => {
                            if (!item.id) return;
                            updateSavedNote(item.id, editingNoteName, editingNoteContent);
                            setEditingNoteId("");
                          }}>Save</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <strong>{item.name}</strong>
                        <p>{item.content}</p>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleString() : "Saved"} | {domainLabel(item.visibility ?? "team")}</span>
                        {item.id ? (
                          <div className="jobActions">
                            <button className="plain small" type="button" onClick={() => {
                              setEditingNoteId(item.id ?? "");
                              setEditingNoteName(item.name);
                              setEditingNoteContent(item.content);
                            }}>Edit</button>
                            <button
                              className="plain small danger"
                              type="button"
                              disabled={deletingNoteId === item.id}
                              onClick={() => item.id && deleteSavedNote(item.id)}
                            >
                              {deletingNoteId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                ))}
              </div>
            </article>
            <CollaborationPanel token={token} entityType="candidate" entityId={candidate.document_id} teamMembers={teamMembers} />
          </section>
        ) : null}

        {activeTab === "evidence" ? (
          <section className="candidateTabPanel recruiterEvidencePanel">
            <article className="evidenceIntroCard">
              <div>
                <span className="reportLabel">Evidence Report</span>
                <h3><FileSearch size={22} /> Facts vs AI Interpretation</h3>
                <p>Recruiters see what was parsed as a fact, what the AI inferred, and the closest source snippet when available.</p>
              </div>
              <div>
                <Metric label="Fact rows" value={String(verifiedFactRows.length)} />
                <Metric label="AI rows" value={String(aiFitRows.length)} />
                <Metric label="Evidence map" value={String(evidenceMap.length)} />
                <Metric label="Role review" value={String(factVerification.summary?.review_roles ?? 0)} />
              </div>
            </article>
            {roleFactNeedsReview ? (
              <article className="factVerificationWarning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Latest role needs source review</strong>
                  <span>{toTextList(factVerification.current_role_flags ?? []).map(domainLabel).join(", ") || "Parsed current role was not fully supported by raw CV text."}</span>
                </div>
              </article>
            ) : null}
            <div className="evidenceReportList">
              {recruiterEvidenceRows.length ? recruiterEvidenceRows.map((item) => (
                <article className={item.kind === "Fact" ? "evidenceReportCard fact" : "evidenceReportCard inference"} key={item.id}>
                  <header>
                    <span className="evidenceKind">{item.kind}</span>
                    <strong>{item.label}</strong>
                    <em>{item.source}</em>
                  </header>
                  <p>{item.claim}</p>
                  {item.snippet ? (
                    <blockquote>{item.snippet}</blockquote>
                  ) : (
                    <div className="evidenceMissing">
                      <AlertTriangle size={16} />
                      <span>No exact snippet found. Keep this visible for recruiter review instead of hiding uncertainty.</span>
                    </div>
                  )}
                </article>
              )) : <EmptyPanel title="No evidence rows yet" body="The raw resume text is still stored and indexed; reparse this CV if the structured evidence map is empty." />}
            </div>
            {evidenceMap.length ? (
              <details className="sourceEvidenceDrawer">
                <summary>Show raw evidence map</summary>
                <section className="sourceClaimList">
                  {evidenceMap.slice(0, 12).map((item: any, index: number) => (
                    <article key={`${item.claim}-${index}`}>
                      <strong>{item.claim}</strong>
                      <p>{(item.evidence ?? []).slice(0, 3).join(" ")}</p>
                    </article>
                  ))}
                </section>
              </details>
            ) : null}
          </section>
        ) : null}

        {activeTab === "cv" ? (
          <section className="candidateTabPanel candidateCvPanel">
            <article className="briefCard cvToolbarCard">
              <div>
                <h3>Original CV</h3>
                <p className="muted">Authenticated preview of the uploaded resume. DOCX files use the safe in-app HTML renderer.</p>
              </div>
              <div className="cvToolbarActions">
                {previewUrl ? <a className="plainLinkButton" href={previewUrl} target="_blank" rel="noreferrer">Open Full Screen</a> : null}
                {previewUrl ? <a className="plainLinkButton" href={previewUrl} download={sourceName}>Download</a> : null}
                <button className="plain" onClick={() => setShowRawCvText((value) => !value)}>{showRawCvText ? "Show Preview" : "Show Raw Text"}</button>
                {canReparse ? <button className="secondary" onClick={() => reparseCandidate(candidate.document_id)}>Reparse CV</button> : null}
              </div>
            </article>
            {reparseStatusBatch ? (
              <article className="reparseStatusCard">
                <div>
                  <strong>Latest reparse</strong>
                  <span>{domainLabel(reparseStatusBatch.status)} | {formatDateTime(reparseStatusBatch.updated_at ?? reparseStatusBatch.created_at)}</span>
                </div>
                <ProgressBar value={reparseProgress} />
              </article>
            ) : null}
            <section className="rawCvEvidence">
              {previewError ? <p className="muted">{previewError}</p> : null}
              {documentHtmlError ? <p className="muted">{documentHtmlError}</p> : null}
              {showRawCvText ? <pre>{rawText.slice(0, 20000) || "Loading source text..."}</pre> : null}
              {!showRawCvText && documentHtml ? <div className="docxPreview" dangerouslySetInnerHTML={{ __html: documentHtml }} /> : null}
              {!showRawCvText && previewUrl && canInlinePreview ? <iframe title="Raw CV preview" src={previewUrl} /> : null}
              {!showRawCvText && !documentHtml && !canInlinePreview ? <pre>{rawText.slice(0, 8000) || "Loading source text..."}</pre> : null}
            </section>
          </section>
        ) : null}

        {activeTab === "versions" ? (
          <section className="candidateTabPanel candidateVersionsPanel">
            <CandidateVersionRail candidate={candidate} matches={versionMatches} openCandidate={openCandidate} openCandidateVersions={openCandidateVersions} />
          </section>
        ) : null}
          </div>

          <aside className="candidateContextRail candidatePersistentRail" aria-label="Candidate recruiter context">
            <article className="briefCard recruiterQuickNotes">
              <div className="railCardHeader">
                <div>
                  <span className="reportLabel">Recruiter Context</span>
                  <h3>Notes</h3>
                </div>
                <button className="plain small" type="button" onClick={() => selectCandidateTab("notes")}>All Notes</button>
              </div>
              <NoteTypeButtons setNoteName={setNoteName} />
              <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a quick recruiter note. It becomes searchable context." />
              <button className="secondary" type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteSaveState === "saving"}>
                {noteSaveState === "saving" ? "Saving..." : noteSaveState === "saved" ? "Saved" : "Save Note"}
              </button>
              {noteSaveError ? <p className="noteSaveFeedback error">{noteSaveError}</p> : null}
              {noteSaveState === "saved" ? <p className="noteSaveFeedback success">Recruiter note saved.</p> : null}
              <div className="recentNotesCompact">
                {(candidate.notes ?? []).slice(0, 3).map((item, index) => (
                  <article key={`${item.id ?? item.created_at}-${index}`}>
                    <strong>{item.name}</strong>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Saved"}</span>
                    <p>{item.content}</p>
                    {item.id ? (
                      <div className="noteMiniActions">
                        <button className="plain small" type="button" onClick={() => {
                          setEditingNoteId(item.id ?? "");
                          setEditingNoteName(item.name);
                          setEditingNoteContent(item.content);
                          selectCandidateTab("notes");
                        }}>Edit</button>
                        <button
                          className="plain small danger"
                          type="button"
                          disabled={deletingNoteId === item.id}
                          onClick={() => item.id && deleteSavedNote(item.id)}
                        >
                          {deletingNoteId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!(candidate.notes ?? []).length ? <p className="muted">No recruiter notes yet.</p> : null}
              </div>
            </article>

            <article className="briefCard candidateRailActions">
              <h3>Next Action</h3>
              <div>
                <button className="primary" onClick={match}>Match to Role</button>
                <button className="plain" onClick={() => selectCandidateTab("cv")}>View Resume</button>
                <button className="plain" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit Fields</button>
              </div>
            </article>

            <article className="briefCard candidateRailSnapshot">
              <h3>Profile Snapshot</h3>
              <div className="compactMetaList">
                <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong></div>
                <div><span>Experience</span><strong>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}</strong></div>
                <div><span>Top domain</span><strong>{domainRows[0] ? domainLabel(domainRows[0].domain) : "Not found"}</strong></div>
                <div><span>Location</span><strong>{currentLocation || resumeHeaderLocation || "Unknown"}</strong></div>
                <div><span>LinkedIn</span><strong>{linkedinVerified ? (linkedinConfidenceLabel ?? "Verified") : primaryLinkedIn ? "Not verified" : "Not found"}</strong></div>
                <div><span>Versions</span><strong>{versionSummary.quickFact}</strong></div>
              </div>
              <div className="profileVerificationList compact">
                <div className="profileVerificationHead">
                  <strong>Profile checks</strong>
                  <span>{domainLabel(profileVerification.external_verification_status ?? "not_configured")}</span>
                </div>
                <VerificationRow label="LinkedIn" item={profileVerification.linkedin} />
                <VerificationRow label="Portfolio" item={profileVerification.portfolio} />
              </div>
            </article>

            {(!primaryLinkedIn || linkedinVerifyError || linkedinRun?.status === "failed") ? (
            <article className="briefCard linkedinVerifyCard">
              <div className="railCardHeader">
                <div>
                  <span className="reportLabel">External profile</span>
                  <h3>LinkedIn Verification</h3>
                </div>
                <span className={`linkedinStatus ${linkedinVerificationStatus(linkedinRun, linkedinExternal)}`}>
                  {linkedinVerificationLabel(linkedinRun, linkedinExternal)}
                </span>
              </div>
              <p>
                Verify that the LinkedIn profile belongs to this candidate and surface updated roles, location, education, and certifications for recruiter review.
              </p>
              <input
                value={linkedinUrlDraft}
                onChange={(event) => setLinkedinUrlDraft(event.target.value)}
                placeholder="https://www.linkedin.com/in/..."
              />
              <button className="secondary" type="button" onClick={() => void verifyLinkedIn()} disabled={linkedinVerifyState === "running" || (!linkedinUrlDraft.trim() && !primaryLinkedIn)}>
                {linkedinVerifyState === "running" ? "Verifying..." : "Verify LinkedIn"}
              </button>
              {linkedinVerifyError ? <p className="noteSaveFeedback error">{linkedinVerifyError}</p> : null}
              <LinkedInVerificationSummary run={linkedinRun} external={linkedinExternal} />
            </article>
            ) : null}

            {noteSignalCount(recruiterNoteSignals) ? (
              <article className="briefCard noteSignalCard">
                <div className="railCardHeader">
                  <h3>Structured Note Signals</h3>
                  <span>{noteSignalCount(recruiterNoteSignals)} found</span>
                </div>
                <div className="noteSignalList">
                  {noteSignalItems(recruiterNoteSignals).slice(0, 8).map((item, index) => (
                    <span key={`${item.category}-${item.label}-${item.value ?? index}`}>
                      <b>{domainLabel(item.category)}</b>
                      {domainLabel(item.value || item.label)}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {versionLinks.length ? (
              <article className="briefCard candidateRailVersions">
                <div className="railCardHeader">
                  <h3>Versions</h3>
                  <button className="plain small" type="button" onClick={() => selectCandidateTab("versions")}>Review</button>
                </div>
                <p>{versionSummary.railText}</p>
                <button className="plain small" type="button" onClick={openCandidateVersions}>Open Candidate Versions</button>
              </article>
            ) : null}
          </aside>
        </section>

      </main>
    </section>
  );
}

function LinkedInVerificationSummary({ run, external }: { run: LinkedInVerificationRun | null; external: any }) {
  const comparison = run?.comparison && Object.keys(run.comparison).length ? run.comparison : external?.comparison ?? {};
  const diff = run?.profile_diff && Object.keys(run.profile_diff).length ? run.profile_diff : external?.diff ?? {};
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

function linkedinMatchConfidence(run: LinkedInVerificationRun | null, external: any): number | null {
  const direct = run?.match_confidence;
  if (typeof direct === "number") return direct;
  const comparison = run?.comparison && Object.keys(run.comparison).length ? run.comparison : external?.comparison ?? {};
  return typeof comparison.match_confidence === "number" ? comparison.match_confidence : null;
}

function linkedinVerificationStatus(run: LinkedInVerificationRun | null, external: any) {
  const status = run?.status === "succeeded" ? run.result_status : run?.status;
  return String(status || external?.comparison?.status || "not_checked").replaceAll("_", "-");
}

function linkedinVerificationLabel(run: LinkedInVerificationRun | null, external: any) {
  const status = run?.status === "succeeded" ? run.result_status : run?.status;
  return domainLabel(status || external?.comparison?.status || "not checked");
}

function isLinkedInVerified(run: LinkedInVerificationRun | null, verificationItem: any, external: any) {
  if (run?.status === "succeeded" && run.result_status === "verified") return true;
  if (verificationItem?.status === "verified") return true;
  return external?.comparison?.status === "verified";
}

function noteSignalItems(signals: any): Array<{ category: string; label: string; value?: string | null }> {
  if (Array.isArray(signals?.signals)) return signals.signals;
  const grouped = signals?.by_category ?? {};
  return Object.entries(grouped).flatMap(([category, items]) => (
    Array.isArray(items) ? items.map((item: any) => ({ category, label: String(item.label ?? ""), value: item.value })) : []
  ));
}

function noteSignalCount(signals: any) {
  if (typeof signals?.count === "number") return signals.count;
  return noteSignalItems(signals).length;
}

function CandidateWorkEducationTimeline({
  rows,
  markers,
  uniqueExperience,
}: {
  rows: any[];
  markers: number[];
  uniqueExperience: string;
}) {
  return (
    <section className="candidateReportTimeline cleanTimeline workEducationTimeline">
      <div className="timelineHeader">
        <div>
          <h3>Work & Education Timeline</h3>
          <p>Employment, same-company project workstreams, and dated education are shown together. Red bars only indicate true cross-company overlap.</p>
        </div>
        <div className="timelineAccounting">
          <span>Unique work experience</span>
          <strong>{uniqueExperience}</strong>
        </div>
      </div>
      {rows.length ? (
        <div className="timelineBoard">
          <div className="timelineYearAxis">
            <span />
            <div>
              {markers.map((year) => <b key={year}>{year}</b>)}
            </div>
          </div>
          {rows.slice(0, 14).map((item: any, index: number) => {
            const isEducation = isEducationTimelineEvent(item);
            return (
              <article className={`timelineRow ${isEducation ? "educationTimelineRow" : ""} ${item.crossCompanyOverlap ? "crossOverlap" : ""}`.trim()} key={item.id ?? index}>
                <div className="timelineRoleLabel">
                  <span className={isEducation ? "timelineType education" : "timelineType work"}>{isEducation ? "Education" : "Work"}</span>
                  <strong>{item.title ?? (isEducation ? "Education" : "Role")}</strong>
                  <span>{item.organization ?? (isEducation ? "School not extracted" : "Unknown company")}</span>
                  <em>{timelineDateRangeLabel(item, isEducation)}</em>
                </div>
                <div className="timelineTrack">
                  <i style={{ left: `${Math.max(0, Math.min(96, Number(item.left ?? 0)))}%`, width: `${Math.max(4, Math.min(100, Number(item.width ?? 100)))}%` }} />
                  {item.crossCompanyOverlap ? <b>Cross-company overlap</b> : null}
                </div>
                {item.summary ? <p>{item.summary}</p> : null}
                {item.workstreams?.length ? <WorkstreamList workstreams={item.workstreams} /> : null}
              </article>
            );
          })}
        </div>
      ) : <EmptyPanel title="No dated timeline extracted" body="The parser did not extract dated work or education history. Review the source evidence panel or reparse this CV." />}
    </section>
  );
}

type CandidateCorrectionForm = {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  current_title: string;
  current_company: string;
  total_years_experience: string;
  skills: string;
  countries: string;
  certifications: string;
  experience: CandidateCorrectionExperience[];
  education: CandidateCorrectionEducation[];
};

type CandidateCorrectionExperience = {
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string;
  technologies: string[];
  workstreams: Candidate["experience"][number]["workstreams"];
};

type CandidateCorrectionEducation = {
  school: string;
  degree: string;
  field: string;
  location: string;
  start_date: string;
  end_date: string;
  details: string;
};

type CandidateCorrectionTextField = Exclude<keyof CandidateCorrectionForm, "experience" | "education">;

function CandidateCorrectionPanel({
  form,
  setForm,
  save,
  cancel,
}: {
  form: CandidateCorrectionForm;
  setForm: (form: CandidateCorrectionForm) => void;
  save: () => void;
  cancel: () => void;
}) {
  const update = (key: CandidateCorrectionTextField, value: string) => setForm({ ...form, [key]: value });
  const updateExperience = (index: number, key: keyof CandidateCorrectionExperience, value: string) => {
    setForm({
      ...form,
      experience: form.experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    });
  };
  const updateEducation = (index: number, key: keyof CandidateCorrectionEducation, value: string) => {
    setForm({
      ...form,
      education: form.education.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    });
  };
  const addExperience = () => setForm({ ...form, experience: [...form.experience, emptyExperienceCorrection()] });
  const removeExperience = (index: number) => setForm({ ...form, experience: form.experience.filter((_, itemIndex) => itemIndex !== index) });
  const addEducation = () => setForm({ ...form, education: [...form.education, emptyEducationCorrection()] });
  const removeEducation = (index: number) => setForm({ ...form, education: form.education.filter((_, itemIndex) => itemIndex !== index) });
  return (
    <section className="candidateCorrectionPanel">
      <div>
        <span className="reportLabel">Manual correction</span>
        <h3>Edit extracted profile data</h3>
        <p>Use this when the parser missed or confused a field. The original CV stays unchanged; these corrections update the candidate profile, timeline, coverage, search index, and matching context.</p>
      </div>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Basics</strong>
          <span>Identity, contact, location, and headline fields.</span>
        </div>
        <div className="candidateCorrectionGrid">
          <label><span>Name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><span>Email</span><input value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
          <label><span>Current location</span><input value={form.location} onChange={(event) => update("location", event.target.value)} /></label>
          <label><span>Current title</span><input value={form.current_title} onChange={(event) => update("current_title", event.target.value)} /></label>
          <label><span>Current company</span><input value={form.current_company} onChange={(event) => update("current_company", event.target.value)} /></label>
          <label><span>Total years</span><input value={form.total_years_experience} onChange={(event) => update("total_years_experience", event.target.value)} /></label>
          <label><span>Countries</span><input value={form.countries} onChange={(event) => update("countries", event.target.value)} placeholder="United States, India" /></label>
          <label className="wide"><span>Summary</span><textarea value={form.summary} onChange={(event) => update("summary", event.target.value)} /></label>
          <label className="wide"><span>Skills</span><textarea value={form.skills} onChange={(event) => update("skills", event.target.value)} placeholder="Python, Spark, Databricks" /></label>
          <label className="wide"><span>Certifications</span><textarea value={form.certifications} onChange={(event) => update("certifications", event.target.value)} placeholder="AWS Solutions Architect, PMP" /></label>
        </div>
      </section>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Work history & dates</strong>
          <span>These rows drive the visible timeline and non-overlapping experience calculation.</span>
          <button className="plain small" type="button" onClick={addExperience}>Add role</button>
        </div>
        <div className="candidateEditableList">
          {form.experience.length ? form.experience.map((item, index) => (
            <article className="candidateEditableCard" key={`experience-${index}`}>
              <div className="candidateEditableCardHeader">
                <strong>Role {index + 1}</strong>
                <button className="plain danger small" type="button" onClick={() => removeExperience(index)}>Remove</button>
              </div>
              <div className="candidateCorrectionGrid">
                <label><span>Company</span><input value={item.company} onChange={(event) => updateExperience(index, "company", event.target.value)} /></label>
                <label><span>Title</span><input value={item.title} onChange={(event) => updateExperience(index, "title", event.target.value)} /></label>
                <label><span>Location</span><input value={item.location} onChange={(event) => updateExperience(index, "location", event.target.value)} placeholder="City, country, remote" /></label>
                <label><span>Start date</span><input value={item.start_date} onChange={(event) => updateExperience(index, "start_date", event.target.value)} placeholder="2022-01" /></label>
                <label><span>End date</span><input value={item.end_date} onChange={(event) => updateExperience(index, "end_date", event.target.value)} placeholder="Present" /></label>
                <label className="wide"><span>Bullets</span><textarea value={item.bullets} onChange={(event) => updateExperience(index, "bullets", event.target.value)} placeholder="One bullet per line" /></label>
              </div>
            </article>
          )) : <EmptyPanel title="No work history rows" body="Add roles here if the parser missed the candidate's experience." />}
        </div>
      </section>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Education</strong>
          <span>Education appears in the candidate report and matching context.</span>
          <button className="plain small" type="button" onClick={addEducation}>Add education</button>
        </div>
        <div className="candidateEditableList">
          {form.education.length ? form.education.map((item, index) => (
            <article className="candidateEditableCard" key={`education-${index}`}>
              <div className="candidateEditableCardHeader">
                <strong>Education {index + 1}</strong>
                <button className="plain danger small" type="button" onClick={() => removeEducation(index)}>Remove</button>
              </div>
              <div className="candidateCorrectionGrid">
                <label><span>School</span><input value={item.school} onChange={(event) => updateEducation(index, "school", event.target.value)} /></label>
                <label><span>Degree</span><input value={item.degree} onChange={(event) => updateEducation(index, "degree", event.target.value)} /></label>
                <label><span>Field</span><input value={item.field} onChange={(event) => updateEducation(index, "field", event.target.value)} /></label>
                <label><span>Location</span><input value={item.location} onChange={(event) => updateEducation(index, "location", event.target.value)} /></label>
                <label><span>Start date</span><input value={item.start_date} onChange={(event) => updateEducation(index, "start_date", event.target.value)} /></label>
                <label><span>End date</span><input value={item.end_date} onChange={(event) => updateEducation(index, "end_date", event.target.value)} /></label>
                <label className="wide"><span>Details</span><textarea value={item.details} onChange={(event) => updateEducation(index, "details", event.target.value)} placeholder="One detail per line" /></label>
              </div>
            </article>
          )) : <EmptyPanel title="No education rows" body="Add education if the CV contains it but parsing missed it." />}
        </div>
      </section>
      <div className="candidateCorrectionActions">
        <button className="plain" onClick={cancel}>Cancel</button>
        <button className="primary" onClick={save}>Save corrections</button>
      </div>
    </section>
  );
}

function candidateCorrectionForm(candidate: Candidate): CandidateCorrectionForm {
  const hr = candidate.derived?.hr_profile ?? {};
  return {
    name: textValue(candidate.name),
    email: textValue(candidate.contact?.email),
    phone: textValue(candidate.contact?.phone),
    location: textValue(candidate.contact?.location),
    summary: textValue(candidate.summary),
    current_title: textValue(hr.current_title),
    current_company: textValue(hr.current_company),
    total_years_experience: textValue(hr.total_years_experience),
    skills: (candidate.skills ?? []).join(", "),
    countries: toTextList(candidate.derived?.countries_associated ?? []).join(", "),
    certifications: (candidate.certifications ?? []).join(", "),
    experience: (candidate.experience ?? []).map((item) => ({
      company: textValue(item.company),
      title: textValue(item.title),
      location: textValue(item.location),
      start_date: textValue(item.start_date),
      end_date: textValue(item.end_date),
      bullets: (item.bullets ?? []).join("\n"),
      technologies: item.technologies ?? [],
      workstreams: item.workstreams ?? [],
    })),
    education: (candidate.education ?? []).map((item) => ({
      school: textValue(item.school),
      degree: textValue(item.degree),
      field: textValue(item.field),
      location: textValue(item.location),
      start_date: textValue(item.start_date),
      end_date: textValue(item.end_date),
      details: (item.details ?? []).join("\n"),
    })),
  };
}

function candidateCorrectionPayload(form: CandidateCorrectionForm): CandidateProfileUpdate {
  const years = Number(form.total_years_experience.replace(/[^\d.]/g, ""));
  return {
    name: form.name.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    location: form.location.trim() || null,
    summary: form.summary.trim() || null,
    current_title: form.current_title.trim() || null,
    current_company: form.current_company.trim() || null,
    total_years_experience: Number.isFinite(years) ? years : null,
    skills: candidateInputList(form.skills),
    countries: candidateInputList(form.countries),
    certifications: candidateInputList(form.certifications),
    experience: form.experience.map((item) => ({
      company: nullableCandidateText(item.company),
      title: nullableCandidateText(item.title),
      location: nullableCandidateText(item.location),
      start_date: nullableCandidateText(item.start_date),
      end_date: nullableCandidateText(item.end_date),
      bullets: candidateTextLines(item.bullets),
      technologies: item.technologies ?? [],
      workstreams: item.workstreams ?? [],
    })).filter((item) => hasCandidateExperienceContent(item)),
    education: form.education.map((item) => ({
      school: nullableCandidateText(item.school),
      degree: nullableCandidateText(item.degree),
      field: nullableCandidateText(item.field),
      location: nullableCandidateText(item.location),
      start_date: nullableCandidateText(item.start_date),
      end_date: nullableCandidateText(item.end_date),
      details: candidateTextLines(item.details),
    })).filter((item) => hasCandidateEducationContent(item)),
  };
}

function emptyExperienceCorrection(): CandidateCorrectionExperience {
  return { company: "", title: "", location: "", start_date: "", end_date: "", bullets: "", technologies: [], workstreams: [] };
}

function emptyEducationCorrection(): CandidateCorrectionEducation {
  return { school: "", degree: "", field: "", location: "", start_date: "", end_date: "", details: "" };
}

function nullableCandidateText(value: string) {
  const text = value.trim();
  return text || null;
}

function candidateTextLines(value: string) {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function hasCandidateExperienceContent(item: Candidate["experience"][number]) {
  return Boolean(item.company || item.title || item.location || item.start_date || item.end_date || item.bullets.length);
}

function hasCandidateEducationContent(item: Candidate["education"][number]) {
  return Boolean(item.school || item.degree || item.field || item.location || item.start_date || item.end_date || item.details?.length);
}

function coverageGapReasons(coverage?: Candidate["primary_key_coverage"]) {
  if (!coverage) return [];
  const generated = coverage.low_coverage_reasons ?? [];
  if (generated.length) return generated;
  return (coverage.items ?? [])
    .filter((item) => item.status === "missing")
    .slice(0, 8)
    .map((item) => ({
      severity: item.severity ?? "standard",
      label: item.label,
      detail: `${item.category_label ?? "Profile"} field is missing.`,
    }));
}

function candidateInputList(value: string) {
  return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}

function WorkstreamList({ workstreams }: { workstreams: Array<{ name?: string | null; start_date?: string | null; end_date?: string | null; bullets?: string[] }> }) {
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

function NoteTypeButtons({ setNoteName }: { setNoteName: (value: string) => void }) {
  const types = ["Screening", "Client Feedback", "Concern", "Salary", "Availability"];
  return (
    <div className="noteTypeButtons" aria-label="Recruiter note types">
      {types.map((type) => <button className="plain small" type="button" key={type} onClick={() => setNoteName(type)}>{type}</button>)}
    </div>
  );
}

function CollaborationPanel({
  token,
  entityType,
  entityId,
  teamMembers,
  compact = false,
}: {
  token: string;
  entityType: "candidate" | "campaign" | "campaign_candidate";
  entityId: string;
  teamMembers: TeamMember[];
  compact?: boolean;
}) {
  const [comments, setComments] = useState<CollaborationComment[]>([]);
  const [tasks, setTasks] = useState<RecruiterTask[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("team");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeTeamMembers = teamMembers.filter((member) => member.status === "active");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      listCollaborationComments(token, entityType, entityId),
      listRecruiterTasks(token, { entity_type: entityType, entity_id: entityId }),
    ])
      .then(([commentResult, taskResult]) => {
        if (!active) return;
        setComments(commentResult.comments);
        setTasks(taskResult.tasks);
      })
      .catch((loadError) => {
        if (active) setError(readableError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entityId, entityType, token]);

  async function refresh() {
    const [commentResult, taskResult] = await Promise.all([
      listCollaborationComments(token, entityType, entityId),
      listRecruiterTasks(token, { entity_type: entityType, entity_id: entityId }),
    ]);
    setComments(commentResult.comments);
    setTasks(taskResult.tasks);
  }

  async function addComment() {
    if (!commentBody.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createCollaborationComment(token, {
        entity_type: entityType,
        entity_id: entityId,
        body: commentBody,
        visibility: commentVisibility,
      });
      setComments((value) => [...value, result.comment]);
      setCommentBody("");
    } catch (commentError) {
      setError(readableError(commentError));
    } finally {
      setSaving(false);
    }
  }

  async function removeComment(commentId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteCollaborationComment(token, commentId);
      setComments((value) => value.filter((comment) => comment.id !== commentId));
    } catch (deleteError) {
      setError(readableError(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function addTask() {
    if (!taskTitle.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createRecruiterTask(token, {
        entity_type: entityType,
        entity_id: entityId,
        title: taskTitle,
        body: taskBody,
        assignee_user_id: taskAssignee || null,
        priority: taskPriority,
      });
      setTasks((value) => [result.task, ...value]);
      setTaskTitle("");
      setTaskBody("");
      setTaskAssignee("");
      setTaskPriority("normal");
    } catch (taskError) {
      setError(readableError(taskError));
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "done" | "cancelled") {
    setSaving(true);
    setError("");
    try {
      const result = await updateRecruiterTask(token, taskId, { status });
      setTasks((value) => value.map((task) => task.id === taskId ? result.task : task));
    } catch (taskError) {
      setError(readableError(taskError));
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteRecruiterTask(token, taskId);
      setTasks((value) => value.filter((task) => task.id !== taskId));
    } catch (taskError) {
      setError(readableError(taskError));
    } finally {
      setSaving(false);
    }
  }

  const openTasks = tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const completedTasks = tasks.filter((task) => task.status === "done");
  const entityLabel = entityType === "campaign_candidate" ? "candidate in this campaign" : entityType;

  return (
    <section className={compact ? "collaborationPanel handoffPanel compact" : "collaborationPanel handoffPanel"}>
      <header className="collaborationHeader">
        <div>
          <span className="reportLabel">Team Handoff</span>
          <h3>Shared context</h3>
          <p>Leave internal notes, mention teammates, and assign follow-ups for this {entityLabel}.</p>
        </div>
        <div className="handoffHeaderActions">
          <span>{openTasks.length} open</span>
          <span>{comments.length} comments</span>
          <button className="plain small" type="button" onClick={() => void refresh()} disabled={loading || saving}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>
      {error ? <p className="noteSaveFeedback error">{error}</p> : null}
      <div className="collaborationGrid">
        <article className="collaborationComposer">
          <strong>Team note</strong>
          <textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add context for the team. Use @email if someone needs to see it."
          />
          <div className="collaborationControls">
            <select value={commentVisibility} onChange={(event) => setCommentVisibility(event.target.value)}>
              <option value="team">Team visible</option>
              <option value="private">Private to me</option>
              <option value="client_ready">Client-ready note</option>
            </select>
            <button className="secondary small" type="button" onClick={() => void addComment()} disabled={saving || !commentBody.trim()}>Post</button>
          </div>
        </article>
        <article className="collaborationComposer">
          <strong>Follow-up</strong>
          <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" />
          <textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} placeholder="What should happen next?" />
          <div className="collaborationControls">
            <select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>
              <option value="">Unassigned</option>
              {activeTeamMembers.map((member) => <option key={member.id} value={member.user_id}>{member.email}</option>)}
            </select>
            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="low">Low</option>
            </select>
            <button className="secondary small" type="button" onClick={() => void addTask()} disabled={saving || !taskTitle.trim()}>Create</button>
          </div>
        </article>
      </div>
      <div className="collaborationLists">
        <section className="collaborationList">
          <div className="collaborationListHeader">
            <strong>Follow-ups</strong>
            <span>{openTasks.length}</span>
          </div>
          {openTasks.length ? openTasks.slice(0, compact ? 4 : 8).map((task) => (
            <article className="collaborationItem task" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                {task.body ? <p>{task.body}</p> : null}
                <span>{task.assignee_email ? `Assigned to ${task.assignee_email}` : "Unassigned"} · {domainLabel(task.priority)} · {formatDateTime(task.created_at)}</span>
              </div>
              <div className="collaborationItemActions">
                {task.status === "open" ? <button className="plain small" type="button" onClick={() => void updateTaskStatus(task.id, "in_progress")}>Start</button> : null}
                <button className="secondary small" type="button" onClick={() => void updateTaskStatus(task.id, "done")}>Done</button>
                <button className="plain small danger" type="button" onClick={() => void removeTask(task.id)}>Delete</button>
              </div>
            </article>
          )) : <p className="muted">No open tasks for this item.</p>}
          {completedTasks.length ? <span className="collaborationCompleteCount">{completedTasks.length} completed</span> : null}
        </section>
        <section className="collaborationList">
          <div className="collaborationListHeader">
            <strong>Shared notes</strong>
            <span>{comments.length}</span>
          </div>
          {comments.length ? comments.slice(0, compact ? 4 : 10).map((comment) => (
            <article className="collaborationItem" key={comment.id}>
              <div>
                <strong>{comment.user_name || comment.user_email || "Team member"}</strong>
                <p>{comment.body}</p>
                <span>{domainLabel(comment.visibility)} · {formatDateTime(comment.created_at)}</span>
              </div>
              <button className="plain small danger" type="button" onClick={() => void removeComment(comment.id)}>Delete</button>
            </article>
          )) : <p className="muted">No team comments yet.</p>}
        </section>
      </div>
    </section>
  );
}

function CandidateVersionRail({
  candidate,
  matches,
  openCandidate,
  openCandidateVersions,
}: {
  candidate: Candidate;
  matches: CandidateVersionMatch[];
  openCandidate: (id: string) => void;
  openCandidateVersions: () => void;
}) {
  const versions = candidateVersionLinks(candidate, matches);
  const activeDocument = candidateVersionDocumentLabel(candidate);
  return (
    <aside className="candidateVersionRail candidateVersionPanel" aria-label="Candidate resume versions">
      <div className="versionPanelHeader">
        <div>
        <span className="reportLabel">Versions</span>
        <h3>Resume History</h3>
          <p>PII/name matches are kept as candidate versions. Nothing is auto-merged.</p>
        </div>
        <button className="plain small" type="button" onClick={openCandidateVersions}>Open Candidate Versions</button>
      </div>
      <article className="currentVersionCard">
        <span>Current version</span>
        <strong>{activeDocument}</strong>
        <em>{candidate._metadata?.extraction_method ?? "Extraction method unknown"}</em>
      </article>
      <div className="versionRailList">
        {versions.length ? versions.map((item) => (
          <article className="versionCompareCard" key={item.documentId}>
            <div className="versionCompareHead">
              <div>
                <strong>{item.name}</strong>
                <p>{item.fileName}</p>
              </div>
              <span>{Math.round(item.score * 100)}% match</span>
            </div>
            <div className="versionMetaGrid">
              <div><span>Status</span><strong>{versionStatusLabel(item.status)}</strong></div>
              <div><span>Uploaded</span><strong>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : "Unknown"}</strong></div>
              <div><span>Extraction</span><strong>{item.extractionMethod || "Unknown"}</strong></div>
            </div>
            <div className="versionDiffList">
              {item.diffs.length ? item.diffs.slice(0, 5).map((diff) => (
                <div className={diff.status === "different" ? "changed" : diff.status} key={diff.key}>
                  <span>{diff.label}</span>
                  <strong>{diff.detail || `${diff.left || "Missing"} -> ${diff.right || "Missing"}`}</strong>
                </div>
              )) : <p>No field-level differences stored for this version.</p>}
            </div>
            <button className="plain small" type="button" onClick={() => openCandidate(item.documentId)}>Open This Version</button>
          </article>
        )) : (
          <article className="emptyVersionCard">
            <strong>No other versions</strong>
            <p>If another upload matches this candidate’s PII or fuzzy name, it will appear here.</p>
          </article>
        )}
      </div>
    </aside>
  );
}

function candidateLocationChips(signals: unknown, currentLocation: string) {
  const chips: Array<{ label: string; current: boolean }> = [];
  const seen = new Set<string>();
  const current = normalizeComparableText(currentLocation);
  if (currentLocation) addLocationChip(chips, seen, currentLocation, true);
  for (const signal of Array.isArray(signals) ? signals : []) {
    const label = locationSignalLabel(signal);
    if (!label) continue;
    const normalized = normalizeComparableText(label);
    const isCurrent = Boolean(current && (normalized.includes(current) || current.includes(normalized)));
    addLocationChip(chips, seen, label, isCurrent);
  }
  return chips.slice(0, 10);
}

function addLocationChip(chips: Array<{ label: string; current: boolean }>, seen: Set<string>, label: string, current: boolean) {
  const key = normalizeComparableText(label);
  if (!key) return;
  const existing = chips.find((item) => normalizeComparableText(item.label) === key);
  if (existing) {
    existing.current = existing.current || current;
    return;
  }
  if (seen.has(key)) return;
  seen.add(key);
  chips.push({ label, current });
}

function locationSignalLabel(signal: unknown) {
  if (typeof signal === "string") return signal;
  if (!signal || typeof signal !== "object") return "";
  const item = signal as Record<string, unknown>;
  const location = textValue(item.location ?? item.current_location ?? item.city);
  const region = textValue(item.region ?? item.state);
  const country = textValue(item.country ?? item.country_name);
  const combined = [location, region, country].filter(Boolean).join(", ");
  return combined || textValue(item.label ?? item.name ?? item.value);
}

function PiiGroup({ label, values, compact = false }: { label: string; values: unknown; compact?: boolean }) {
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

function VerificationRow({ label, item }: { label: string; item?: { status?: string | null; reason?: string | null } }) {
  const status = item?.status ?? "missing";
  return (
    <article className="verificationRow">
      <strong>{label}</strong>
      <span>{domainLabel(status)}</span>
      <p>{item?.reason ?? "No verification signal found"}</p>
    </article>
  );
}

function RequirementIntake(props: {
  requirement: Requirement | null;
  requirementText: string;
  setRequirementText: (value: string) => void;
  requirementFile: File | null;
  setRequirementFile: (file: File | null) => void;
  clarifyAnswers: Record<string, string>;
  setClarifyAnswers: (answers: Record<string, string>) => void;
  createRequirement: () => void;
  finalize: () => void;
  match: () => void;
  requirements: Requirement[];
  selectRequirement: (requirement: Requirement) => void;
}) {
  const locked = props.requirement?.status === "finalized" || props.requirement?.status === "matched";
  const inputMode = props.requirementFile ? "file" : props.requirementText.trim() ? "text" : "none";
  const activeProfile = props.requirement?.final_requirement_profile ?? props.requirement?.extracted_requirement_json ?? {};
  const updateAnswer = (key: string, value: string) => props.setClarifyAnswers({ ...props.clarifyAnswers, [key]: value });
  return (
    <section className="requirementPage">
      <div className="pageTitle centered">
        <div>
          <h2>Build Requirement Profile</h2>
          <p>Extract the job profile, answer clarifying questions, confirm the scorecard, then find matching candidates.</p>
        </div>
      </div>
      <div className="intakeMethods">
        <label className={inputMode === "file" ? "intakeMethod active" : "intakeMethod"}>
          <FileUp size={28} />
          <strong>Upload Requirement</strong>
          <p>Upload a job description document. The system extracts the role, skills, location preferences, and dealbreakers.</p>
          <span>{props.requirementFile ? props.requirementFile.name : "Browse files ->"}</span>
          <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => props.setRequirementFile(event.target.files?.[0] ?? null)} />
        </label>
        <article className={inputMode === "text" || inputMode === "none" ? "intakeMethod active" : "intakeMethod"}>
          <FileSearch size={28} />
          <strong>Paste Text Requirement</strong>
          <p>Paste plain text from an email, internal req board, or hiring manager note.</p>
          <span>Active input</span>
        </article>
      </div>
      <section className="panel requirementTextPanel">
        <label>Requirement Text</label>
        <textarea value={props.requirementText} onChange={(event) => props.setRequirementText(event.target.value)} placeholder="Paste job description here..." />
        <button className="plain" disabled={!props.requirementText.trim() && !props.requirementFile} onClick={props.createRequirement}>Build Profile</button>
      </section>
      <section className="panel requirementHistory">
        <div className="panelHead"><h3>Requirement History</h3><span>{props.requirements.length}</span></div>
        {props.requirements.slice(0, 5).map((item) => (
          <button className={props.requirement?.id === item.id ? "historyItem active" : "historyItem"} key={item.id} onClick={() => props.selectRequirement(item)}>
            <strong>{item.title ?? "Untitled requirement"}</strong>
            <span>{item.status} | {new Date(item.updated_at).toLocaleDateString()}</span>
          </button>
        ))}
        {!props.requirements.length ? <p className="muted">No saved requirements yet.</p> : null}
      </section>
      <section className="clarificationPanel">
        <h3><ShieldCheck size={20} /> Clarifying Questions</h3>
        <p>Clarify ambiguous parameters before matching so weak assumptions do not become hard filters.</p>
        {props.requirement ? (
          <>
            <div className="requirementLifecycle">
              <span className={props.requirement.status === "draft" ? "active" : ""}>1. Extracted</span>
              <span className={props.requirement.status === "finalized" ? "active" : ""}>2. Confirmed</span>
              <span className={props.requirement.status === "matched" ? "active" : ""}>3. Matched</span>
            </div>
            <section className="requirementSummary">
              <Metric label="Title" value={props.requirement.title ?? "Untitled"} />
              <Metric label="Minimum Years" value={`${activeProfile?.min_years_experience ?? "Not set"}`} />
              <Metric label="Must-Haves" value={`${(activeProfile?.must_have_skills ?? []).length}`} />
              <Metric label="Locations" value={`${(activeProfile?.required_locations ?? []).length + (activeProfile?.required_countries ?? []).length}`} />
            </section>
            <section className="structuredClarification">
              <div className="cardTitle"><h3>Editable Scorecard</h3><span>These fields directly affect matching</span></div>
              {requirementStructuredFields.map((field) => (
                <label key={field.key} className={field.multiline ? "structuredField wide" : "structuredField"}>
                  <span>{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      disabled={locked}
                      value={profileAnswerValue(props.clarifyAnswers, props.requirement?.recruiter_answers ?? {}, activeProfile, field)}
                      onChange={(event) => updateAnswer(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      disabled={locked}
                      value={profileAnswerValue(props.clarifyAnswers, props.requirement?.recruiter_answers ?? {}, activeProfile, field)}
                      onChange={(event) => updateAnswer(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                  <small>{field.help}</small>
                </label>
              ))}
            </section>
            {(props.requirement.clarification_questions ?? []).length ? (
              <section className="openQuestions">
                <div className="cardTitle"><h3>Open Questions</h3><span>Additional recruiter context</span></div>
                {(props.requirement.clarification_questions ?? []).map((question) => (
                  <label className="question" key={question}>
                    <span>{question}</span>
                    <input disabled={locked} value={props.clarifyAnswers[question] ?? props.requirement?.recruiter_answers?.[question] ?? ""} onChange={(event) => updateAnswer(question, event.target.value)} />
                  </label>
                ))}
              </section>
            ) : null}
            <div className="actions">
              <button className="secondary" disabled={locked} onClick={props.finalize}>Confirm requirement</button>
              <button className="primary" disabled={!locked} onClick={props.match}>{RECRUITER_COPY.matchingButton}</button>
            </div>
          </>
        ) : <p className="muted">Create a requirement to generate clarification questions.</p>}
      </section>
    </section>
  );
}

type MatchFilter = "all" | "eligible" | "blocked" | "shortlisted" | "rejected";

const requirementStructuredFields = [
  {
    key: "__profile.must_have_skills",
    profileKey: "must_have_skills",
    label: "Must-have skills",
    placeholder: "Azure OpenAI, LangChain, RAG",
    help: "Non-negotiable capabilities only if the recruiter truly means hard requirement.",
    multiline: true,
  },
  {
    key: "__profile.nice_to_have_skills",
    profileKey: "nice_to_have_skills",
    label: "Nice-to-have skills",
    placeholder: "Databricks, LangGraph, Kubernetes",
    help: "Improves score but should not block otherwise strong candidates.",
    multiline: true,
  },
  {
    key: "__profile.min_years_experience",
    profileKey: "min_years_experience",
    label: "Minimum years",
    placeholder: "5",
    help: "Used for years-fit scoring. Treat as hard only when the requirement explicitly says so.",
    multiline: false,
  },
  {
    key: "__profile.seniority",
    profileKey: "seniority",
    label: "Required seniority",
    placeholder: "Senior / Lead / Principal",
    help: "Sets recruiter intent for title and responsibility fit.",
    multiline: false,
  },
  {
    key: "__profile.required_countries",
    profileKey: "required_countries",
    label: "Required countries",
    placeholder: "United States, Canada",
    help: "Candidate country/location signals are checked against this list.",
    multiline: false,
  },
  {
    key: "__profile.required_locations",
    profileKey: "required_locations",
    label: "Required locations / time zones",
    placeholder: "EST, New York, Remote US",
    help: "Use for city, timezone, remote, or office-specific constraints.",
    multiline: false,
  },
  {
    key: "__profile.domains",
    profileKey: "domains",
    label: "Priority domains",
    placeholder: "generative_ai, data_engineering",
    help: "Domain fit is scored separately from raw skill matches.",
    multiline: false,
  },
  {
    key: "__profile.work_authorization",
    profileKey: "work_authorization",
    label: "Work authorization",
    placeholder: "US work authorization required",
    help: "Only make strict if it is a real hiring constraint.",
    multiline: false,
  },
  {
    key: "__profile.dealbreakers",
    profileKey: "dealbreakers",
    label: "Dealbreakers",
    placeholder: "No production AI experience; no cloud experience",
    help: "Active dealbreakers are shown as hard-filter failures when detected.",
    multiline: true,
  },
] as const;

function MatchResults({
  requirement,
  requirements,
  matches,
  matchRuns,
  matchRunChanges,
  openCandidate,
  shortlist,
  reject,
  setView,
  selectRequirement,
}: {
  requirement: Requirement | null;
  requirements: Requirement[];
  matches: RequirementMatch[];
  matchRuns: RequirementMatchRun[];
  matchRunChanges: RequirementMatchRunChange[];
  openCandidate: (id: string) => void;
  shortlist: (id: string) => void;
  reject: (id: string) => void;
  setView: (view: View) => void;
  selectRequirement: (requirement: Requirement) => void;
}) {
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [minimumScore, setMinimumScore] = useState(0.3);
  const matchedRequirements = requirements.filter((item) => item.status === "matched");
  const scoreBuckets = matchDistribution(matches);
  const filteredMatches = matches.filter((item) => item.total_score >= minimumScore).filter((item) => matchFilterHit(item, filter));
  const counts = {
    all: matches.length,
    eligible: matches.filter((item) => !(item.evidence?.hard_filter_failures ?? []).length).length,
    blocked: matches.filter((item) => (item.evidence?.hard_filter_failures ?? []).length).length,
    shortlisted: matches.filter((item) => item.status === "shortlisted").length,
    rejected: matches.filter((item) => item.status === "rejected").length,
  };
  return (
    <section className="matchesPage">
      <div className="pageTitle">
        <div>
          <h2>Candidate Recommendations</h2>
          <p>{requirement ? `Requirement: ${requirement.title ?? "Untitled requirement"}` : "Select or create a confirmed requirement to find matching candidates."}</p>
        </div>
        <span>{filteredMatches.length}/{matches.length} candidates shown above {Math.round(minimumScore * 100)}%</span>
      </div>
      {!matches.length ? (
        <section className="panel emptyState">
          <h3>No recommendations loaded</h3>
          <p>Create a requirement, answer clarification questions, confirm the profile, then find matching candidates.</p>
          <button className="primary" onClick={() => setView("requirement")}>Go to Requirements</button>
        </section>
      ) : null}
      {matchedRequirements.length ? (
        <section className="panel requirementHistory matchHistory">
          <div className="panelHead"><h3>Matched Requirements</h3><span>{matchedRequirements.length}</span></div>
          {matchedRequirements.slice(0, 8).map((item) => (
            <button className={requirement?.id === item.id ? "historyItem active" : "historyItem"} key={item.id} onClick={() => selectRequirement(item)}>
              <strong>{item.title ?? "Untitled requirement"}</strong>
              <span>{item.status} | {new Date(item.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </section>
      ) : null}
      {matchRuns.length ? (
        <section className="panel matchRunHistory">
          <div className="panelHead"><h3>Match Run History</h3><span>{matchRuns.length} runs</span></div>
          <div className="matchRunGrid">
            {matchRuns.slice(0, 4).map((run) => (
              <article key={run.id}>
                <strong>Search #{run.run_number}</strong>
                <span>{formatDateTime(run.created_at)}</span>
                <div>
                  <Metric label="Candidates" value={String(run.candidate_count)} />
                  <Metric label="Eligible" value={String(run.eligible_count)} />
                  <Metric label="Top Score" value={`${Math.round(run.top_score * 100)}%`} />
                  <Metric label="Avg Score" value={`${Math.round(run.average_score * 100)}%`} />
                </div>
              </article>
            ))}
          </div>
          {matchRunChanges.length ? (
            <div className="matchRunChanges">
              <strong>Latest run comparison</strong>
              {matchRunChanges.slice(0, 6).map((change) => (
                <span key={`${change.candidate_id}-${change.change_type}`}>
                  {change.candidate_name ?? change.candidate_id}: {domainLabel(change.change_type)}
                  {typeof change.score_delta === "number" ? ` ${change.score_delta > 0 ? "+" : ""}${Math.round(change.score_delta * 100)} pts` : ""}
                  {change.rank_delta ? ` | rank ${change.rank_delta > 0 ? "+" : ""}${change.rank_delta}` : ""}
                </span>
              ))}
            </div>
          ) : <p className="muted">Run comparison will appear after at least two match runs.</p>}
        </section>
      ) : null}
      {matches.length ? (
        <section className="matchDistributionPanel">
          <div>
            <span className="eyebrow">Match distribution</span>
            <h3>Only review candidates above the working threshold</h3>
            <p>Candidates below 30% stay hidden from the recruiter list. Raise the threshold when the database gets large.</p>
          </div>
          <div className="matchGaugeBuckets">
            {scoreBuckets.map((bucket) => (
              <button className={minimumScore === bucket.minimum ? "active" : ""} key={bucket.label} onClick={() => setMinimumScore(bucket.minimum)}>
                <span>{bucket.label}</span>
                <strong>{bucket.count}</strong>
                <i style={{ width: `${Math.max(8, Math.min(100, bucket.percent))}%` }} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {matches.length ? (
        <section className="matchToolbar">
          {(["all", "eligible", "blocked", "shortlisted", "rejected"] as MatchFilter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {domainLabel(item)} <span>{counts[item]}</span>
            </button>
          ))}
        </section>
      ) : null}
      <div className="matchList">
        {filteredMatches.map((item, index) => (
          <article className="matchCard" key={item.candidate_id}>
            <div className="matchHead">
              <div>
                <strong>#{index + 1} {item.candidate.name}</strong>
                <span>{item.candidate.current_title} | {item.candidate.total_years_experience} yrs</span>
                <em className={`matchStatus ${item.status ?? "ranked"}`}>{item.status ?? "ranked"}</em>
              </div>
              <b>{Math.round(item.total_score * 100)}%</b>
            </div>
            <p>{item.recommendation}</p>
            <div className="nextActionBox">
              <strong>Recommended next action</strong>
              <span>{matchNextAction(item)}</span>
            </div>
            {(item.evidence?.hard_filter_failures ?? []).length ? (
              <div className="hardFilterBox">
                <strong>Must-check failures</strong>
                {(item.evidence.hard_filter_failures ?? []).map((failure: string, failureIndex: number) => <span key={`${failure}-${failureIndex}`}>{failure}</span>)}
              </div>
            ) : <div className="hardFilterPass">Must-check items passed</div>}
            <div className="scoreGrid">
              <Metric label="Must-have" value={`${Math.round(item.must_have_score * 100)}%`} />
              <Metric label="Nice-have" value={`${Math.round(item.nice_to_have_score * 100)}%`} />
              <Metric label="Years" value={`${Math.round(item.years_score * 100)}%`} />
              <Metric label="Domain" value={`${Math.round(item.domain_score * 100)}%`} />
            </div>
            <div className="chips">{(item.evidence.must_have_hits ?? []).map((hit: string) => <span key={hit}>{hit}</span>)}</div>
            {(item.evidence?.notes_relevance ?? []).length ? (
              <div className="notesRelevance">
                <strong>Recruiter notes relevance</strong>
                {(item.evidence.notes_relevance ?? []).map((noteName: string, noteIndex: number) => <span key={`${noteName}-${noteIndex}`}>{noteName}</span>)}
              </div>
            ) : null}
            {(item.evidence?.semantic_evidence ?? []).length ? (
              <div className="matchEvidence">
                <strong>Semantic evidence</strong>
                {(item.evidence.semantic_evidence ?? []).slice(0, 3).map((evidence: any, evidenceIndex: number) => (
                  <article key={`${evidence.source_label ?? "evidence"}-${evidenceIndex}`}>
                    <span>{evidenceSourceLabel(evidence)}</span>
                    <p>{evidence.snippet}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {hasMatchGaps(item.gaps) ? (
              <div className="matchGaps">
                <strong>Gaps</strong>
                {Object.entries(item.gaps ?? {}).flatMap(([key, value]) => gapItems(key, value)).map((gap) => <span key={gap}>{gap}</span>)}
              </div>
            ) : null}
            <div className="jobActions">
              <button className="plain" onClick={() => openCandidate(item.candidate_id)}>Open candidate</button>
              <button className="secondary" disabled={item.status === "shortlisted"} onClick={() => shortlist(item.candidate_id)}>Add to shortlist</button>
              <button className="plain danger" disabled={item.status === "rejected"} onClick={() => reject(item.candidate_id)}>Reject for req</button>
            </div>
          </article>
        ))}
        {matches.length && !filteredMatches.length ? (
          <section className="panel emptyState">
            <h3>No candidates in this match view</h3>
            <p>Change the match filter to review other ranked, blocked, shortlisted, or rejected candidates.</p>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function CampaignsView({
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
                  <strong>{item.name}</strong>
                  <span>{campaignLoadingId === item.id ? "Loading campaign..." : `${domainLabel(item.status)} | ${item.candidate_count} candidates`}</span>
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

type CampaignScorecardForm = {
  role_intent: string;
  location_preference: string;
  seniority: string;
  min_years_experience: string;
  must_have_skills: string;
  nice_to_have_skills: string;
  domains: string;
  industry_preferences: string;
  soft_preferences: string;
  hidden_intent: string;
  dealbreakers: string;
  strict_must_haves: boolean;
  strict_min_years: boolean;
  weight_skills: string;
  weight_role: string;
  weight_domain: string;
  weight_years: string;
  weight_location: string;
  weight_recency: string;
  weight_seniority: string;
  weight_notes: string;
};

function emptyCampaignScorecardForm(): CampaignScorecardForm {
  return {
    role_intent: "",
    location_preference: "",
    seniority: "",
    min_years_experience: "",
    must_have_skills: "",
    nice_to_have_skills: "",
    domains: "",
    industry_preferences: "",
    soft_preferences: "",
    hidden_intent: "",
    dealbreakers: "",
    strict_must_haves: false,
    strict_min_years: false,
    weight_skills: "30",
    weight_role: "18",
    weight_domain: "15",
    weight_years: "12",
    weight_location: "10",
    weight_recency: "8",
    weight_seniority: "5",
    weight_notes: "2",
  };
}

function campaignScorecardForm(campaign: JobCampaign): CampaignScorecardForm {
  const scorecard = campaign.scorecard ?? {};
  const profile = campaign.requirement?.final_requirement_profile ?? campaign.requirement?.extracted_requirement_json ?? {};
  const locationPreference = firstCampaignList(
    scorecard.location_preference,
    profile.preferred_locations,
    profile.location_preference,
    profile.required_locations,
    profile.required_countries
  );
  return {
    role_intent: textValue(scorecard.role_intent ?? profile.role_intent),
    location_preference: campaignListInput(locationPreference),
    seniority: textValue(scorecard.seniority ?? profile.seniority),
    min_years_experience: textValue(scorecard.min_years_experience ?? profile.min_years_experience),
    must_have_skills: campaignListInput(scorecard.must_have_skills ?? profile.must_have_skills),
    nice_to_have_skills: campaignListInput(scorecard.nice_to_have_skills ?? profile.nice_to_have_skills),
    domains: campaignListInput(scorecard.domains ?? profile.domains),
    industry_preferences: campaignListInput(scorecard.industry_preferences ?? profile.industry_preferences),
    soft_preferences: campaignListInput(scorecard.soft_preferences ?? profile.soft_preferences),
    hidden_intent: campaignListInput(scorecard.hidden_intent ?? profile.hidden_intent),
    dealbreakers: campaignListInput(scorecard.dealbreakers ?? profile.dealbreakers),
    strict_must_haves: Boolean(scorecard.strict_must_haves ?? profile.strict_must_haves),
    strict_min_years: Boolean(scorecard.strict_min_years ?? profile.strict_min_years),
    weight_skills: scoreWeightPercent(scorecard.score_weights?.skills ?? profile.score_weights?.skills, "30"),
    weight_role: scoreWeightPercent(scorecard.score_weights?.role ?? profile.score_weights?.role, "18"),
    weight_domain: scoreWeightPercent(scorecard.score_weights?.domain ?? profile.score_weights?.domain, "15"),
    weight_years: scoreWeightPercent(scorecard.score_weights?.years ?? profile.score_weights?.years, "12"),
    weight_location: scoreWeightPercent(scorecard.score_weights?.location ?? profile.score_weights?.location, "10"),
    weight_recency: scoreWeightPercent(scorecard.score_weights?.recency ?? profile.score_weights?.recency, "8"),
    weight_seniority: scoreWeightPercent(scorecard.score_weights?.seniority ?? profile.score_weights?.seniority, "5"),
    weight_notes: scoreWeightPercent(scorecard.score_weights?.notes ?? profile.score_weights?.notes, "2"),
  };
}

function firstCampaignList(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string" && value.trim()) return value;
  }
  return [];
}

function campaignScorecardPayload(form: CampaignScorecardForm, campaign: JobCampaign): CampaignScorecard {
  const years = Number(form.min_years_experience.replace(/[^\d.]/g, ""));
  return {
    title: campaign.requirement_title || campaign.name,
    role_intent: form.role_intent.trim() || null,
    location_preference: campaignInputList(form.location_preference),
    seniority: form.seniority.trim() || null,
    min_years_experience: Number.isFinite(years) && years > 0 ? years : null,
    must_have_skills: campaignInputList(form.must_have_skills),
    nice_to_have_skills: campaignInputList(form.nice_to_have_skills),
    domains: campaignInputList(form.domains),
    industry_preferences: campaignInputList(form.industry_preferences),
    soft_preferences: campaignInputList(form.soft_preferences),
    hidden_intent: campaignInputList(form.hidden_intent),
    dealbreakers: campaignInputList(form.dealbreakers),
    strict_must_haves: form.strict_must_haves,
    strict_min_years: form.strict_min_years,
    score_weights: {
      skills: percentInputToDecimal(form.weight_skills),
      role: percentInputToDecimal(form.weight_role),
      domain: percentInputToDecimal(form.weight_domain),
      years: percentInputToDecimal(form.weight_years),
      location: percentInputToDecimal(form.weight_location),
      recency: percentInputToDecimal(form.weight_recency),
      seniority: percentInputToDecimal(form.weight_seniority),
      notes: percentInputToDecimal(form.weight_notes),
    },
  };
}

function campaignScorecardCompleteness(form: CampaignScorecardForm) {
  const checks = [
    form.role_intent.trim(),
    form.must_have_skills.trim(),
    form.min_years_experience.trim(),
    form.seniority.trim(),
    form.location_preference.trim(),
    form.domains.trim() || form.industry_preferences.trim(),
    form.dealbreakers.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreWeightPercent(value: unknown, fallback: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return String(Math.round((numeric <= 1 ? numeric * 100 : numeric) * 10) / 10);
}

function percentInputToDecimal(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function campaignListInput(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  if (value == null) return "";
  return String(value);
}

function campaignInputList(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function campaignEvidenceItems(item: JobCampaignCandidate) {
  return [
    ...toTextList(item.evidence?.top_reasons),
    ...toTextList(item.evidence?.evidence?.must_have_hits),
    ...toTextList(item.evidence?.evidence?.nice_to_have_hits),
  ].filter(Boolean);
}

function mergeCampaignCandidateUpdate(current: JobCampaignCandidate, updated: JobCampaignCandidate): JobCampaignCandidate {
  const seen = new Set<string>();
  const activityEvents = [
    ...(updated.activity_events ?? []),
    ...(current.activity_events ?? []),
  ].filter((event) => {
    if (!event?.id || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
  return { ...current, ...updated, activity_events: activityEvents };
}

function stageCandidateStatus(status: string): CampaignPipelineStatus {
  if (status === "uploaded" || status === "matched" || status === "reviewing") return "recommended";
  if (status === "below_threshold") return "below_threshold";
  if (
    [
      "recommended",
      "shortlisted",
      "contacted",
      "replied",
      "screened",
      "submitted",
      "interviewing",
      "offer",
      "placed",
      "rejected",
      "archived",
    ].includes(status)
  ) {
    return status as CampaignPipelineStatus;
  }
  return "recommended";
}

function campaignCandidateVisibleInPipeline(item: JobCampaignCandidate, threshold: number) {
  if (item.status === "below_threshold") return false;
  if (["shortlisted", "contacted", "replied", "screened", "submitted", "interviewing", "offer", "placed", "rejected", "archived"].includes(item.status)) {
    return true;
  }
  return Number(item.score ?? 0) >= threshold;
}

function campaignScoreBreakdownItems(item: JobCampaignCandidate) {
  const breakdown = item.evidence?.score_breakdown ?? {};
  const fallbackTotal = Number(item.score ?? 0);
  return [
    { label: "Total", raw: breakdown.total ?? fallbackTotal },
    { label: "Must", raw: breakdown.must_have },
    { label: "Nice", raw: breakdown.nice_to_have },
    { label: "Years", raw: breakdown.years },
    { label: "Domain", raw: breakdown.domain },
    { label: "Location", raw: breakdown.location },
  ]
    .map((item) => ({ label: item.label, value: percentScore(Number(item.raw ?? 0)) }))
    .filter((item) => Number.isFinite(item.value));
}

function campaignHardFilterFailures(item: JobCampaignCandidate) {
  return [
    ...toTextList(item.evidence?.hard_filter_failures),
    ...toTextList(item.evidence?.evidence?.hard_filter_failures),
  ];
}

function campaignReasonItems(item: JobCampaignCandidate) {
  const explicit = toTextList(item.evidence?.top_reasons);
  if (explicit.length) return explicit;
  return campaignEvidenceItems(item);
}

function campaignGapItems(item: JobCampaignCandidate) {
  const threshold = Number(item.evidence?.incremental_match?.visibility_threshold ?? 0);
  const thresholdLabel = threshold ? `${Math.round(threshold * 100)}%` : "review";
  const thresholdReason = item.status === "below_threshold"
    ? [`Below ${thresholdLabel} campaign threshold.`]
    : [];
  const incrementalReason = typeof item.evidence?.incremental_match?.reason === "string"
    ? [item.evidence.incremental_match.reason]
    : toTextList(item.evidence?.incremental_match?.reason);
  const explicit = toTextList(item.evidence?.top_gaps);
  const fallback = Object.entries(item.evidence?.gaps ?? {}).flatMap(([key, value]) => gapItems(key, value));
  return uniqueTextList([...thresholdReason, ...incrementalReason, ...explicit, ...fallback]);
}

function campaignProgressStats(campaign: JobCampaign | null, candidates: JobCampaignCandidate[]) {
  const uploads = campaign?.upload_batches ?? [];
  const totalUploaded = uploads.reduce((sum, batch) => sum + Number(batch.total_files ?? 0), 0);
  const completedUploads = uploads.reduce((sum, batch) => sum + Number(batch.completed_count ?? 0) + Number(batch.failed_count ?? 0), 0);
  const uploadPercent = totalUploaded ? Math.round((completedUploads / totalUploaded) * 100) : 0;
  const shortlisted = candidates.filter((item) => item.status === "shortlisted").length;
  const rejected = candidates.filter((item) => item.status === "rejected").length;
  const reviewed = shortlisted + rejected;
  const reviewPercent = candidates.length ? Math.round((reviewed / candidates.length) * 100) : 0;
  const matched = candidates.length > 0;
  const percent = Math.max(uploadPercent, matched ? Math.max(35, reviewPercent) : campaign?.requirement_id ? 20 : 5);
  return {
    percent: Math.min(100, percent),
    label: matched ? `${candidates.length} ranked candidates` : campaign?.requirement_id ? "Requirement ready" : "Campaign setup",
    description: matched
      ? "Review recommended candidates, shortlist the strongest profiles, and keep rejects tied to this campaign."
      : "Create or link criteria, then run matching against the company database and any campaign-specific uploads.",
    stages: [
      { label: "Criteria", value: campaign?.requirement_status ?? (campaign?.requirement_id ? "linked" : "missing"), done: Boolean(campaign?.requirement_id), active: !campaign?.requirement_id },
      { label: "Uploads", value: uploads.length ? `${completedUploads}/${totalUploaded} files` : "none yet", done: Boolean(totalUploaded && completedUploads >= totalUploaded), active: Boolean(totalUploaded && completedUploads < totalUploaded) },
      { label: "Ranked", value: `${candidates.length} candidates`, done: matched, active: Boolean(campaign?.requirement_id && !matched) },
      { label: "Reviewed", value: `${reviewed}/${candidates.length || 0}`, done: Boolean(candidates.length && reviewed === candidates.length), active: Boolean(candidates.length && reviewed < candidates.length) },
    ],
  };
}

function campaignTimelineItems(campaign: JobCampaign | null, candidates: JobCampaignCandidate[]) {
  if (!campaign) return [];
  const events: Array<{ id: string; title: string; body: string; date?: string | null }> = [];
  events.push({
    id: `${campaign.id}-created`,
    title: "Campaign created",
    body: campaign.requirement_id ? "Requirement profile linked for matching." : "Campaign shell created; add criteria before ranking.",
    date: campaign.created_at,
  });
  for (const batch of campaign.upload_batches ?? []) {
    events.push({
      id: `${campaign.id}-batch-${batch.id}`,
      title: `Upload batch: ${batch.status}`,
      body: `${batch.completed_count}/${batch.total_files} resumes processed, ${batch.failed_count} failed.`,
      date: batch.updated_at,
    });
  }
  for (const item of candidates) {
    const activityEvents = item.activity_events ?? [];
    for (const event of activityEvents) {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-activity-${event.id}`,
        title: `${item.candidate?.name ?? item.candidate_id}: ${event.title}`,
        body: event.body || "No note added.",
        date: event.created_at,
      });
    }
    if (!activityEvents.length && (item.status === "shortlisted" || item.status === "rejected")) {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-${item.status}`,
        title: item.status === "shortlisted" ? "Candidate shortlisted" : "Candidate rejected",
        body: item.candidate?.name ?? item.candidate_id,
        date: item.updated_at,
      });
    } else if (item.source === "matched") {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-matched`,
        title: "Candidate ranked",
        body: `${item.candidate?.name ?? item.candidate_id} scored ${Math.round((item.score ?? 0) * 100)}%.`,
        date: item.updated_at,
      });
    }
  }
  events.push({
    id: `${campaign.id}-updated`,
    title: "Campaign updated",
    body: `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} currently attached.`,
    date: campaign.updated_at,
  });
  return events
    .filter((event) => event.date || event.title)
    .sort((left, right) => new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime());
}

function CandidateVersionReview({ clusters, decide }: { clusters: CandidateVersionMatch[]; decide: (id: string, decision: "versioned" | "separate" | "review-later") => void }) {
  const [filter, setFilter] = useState<ResolutionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(clusters[0]?.id);
  const filteredClusters = clusters.filter((cluster) => filter === "all" || (cluster.status ?? "suggested") === filter);
  const selected = filteredClusters.find((cluster) => cluster.id === selectedId) ?? filteredClusters[0];
  const selectedStatus = normalizeCandidateVersionStatus(selected?.status);
  const resolutionCounts = {
    all: clusters.length,
    suggested: clusters.filter((cluster) => (cluster.status ?? "suggested") === "suggested").length,
    review_later: clusters.filter((cluster) => cluster.status === "review_later").length,
    versioned: clusters.filter((cluster) => cluster.status === "versioned").length,
    separate: clusters.filter((cluster) => cluster.status === "separate").length,
  };
  useEffect(() => {
    if (selectedId && filteredClusters.some((cluster) => cluster.id === selectedId)) return;
    setSelectedId(filteredClusters[0]?.id);
  }, [filteredClusters, selectedId]);
  return (
    <section className="resolutionPage">
      <aside className="clusterList">
        <div className="clusterHead"><h3>Candidate Versions</h3><span>{clusters.length}</span></div>
        <div className="clusterFilters">
          {(["all", "suggested", "review_later", "versioned", "separate"] as ResolutionFilter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {domainLabel(item)} <span>{resolutionCounts[item]}</span>
            </button>
          ))}
        </div>
        {filteredClusters.map((item) => (
          <article className={item.id === selected?.id ? "clusterItem active" : "clusterItem"} key={item.id} onClick={() => setSelectedId(item.id)}>
            <strong>{item.left_name ?? item.name ?? "Candidate"} </strong>
            <p>{item.right_name ? `Possible version: ${item.right_name}` : "Review required"}</p>
            <div className="clusterItemMeta">
              <span>{Math.round(item.score * 100)}% Version signal</span>
              <em className={`clusterStatus ${normalizeCandidateVersionStatus(item.status)}`}>{versionStatusLabel(item.status)}</em>
            </div>
          </article>
        ))}
        {!filteredClusters.length ? <p className="muted clusterEmpty">No clusters in this status.</p> : null}
      </aside>
      <main className="resolutionDetail">
        {selected ? (
          <>
            <div className="resolutionHeader">
              <div>
                <h2>Version Stack: {selected.left_name ?? selected.name ?? "Candidate"}</h2>
                <p>Matching identity signals are handled as candidate versions. Every uploaded file is preserved; no data is merged or deleted.</p>
                <span className={`clusterStatus large ${selectedStatus}`}>Status: {versionStatusLabel(selected.status)}</span>
              </div>
              <div className="actions">
                <button className="plain" disabled={selectedStatus === "review_later"} onClick={() => selected.id && decide(selected.id, "review-later")}>
                  {selectedStatus === "review_later" ? "Marked Review Later" : "Review Later"}
                </button>
                <button className="plain" disabled={selectedStatus === "separate"} onClick={() => selected.id && decide(selected.id, "separate")}>
                  {selectedStatus === "separate" ? "Kept Separate" : "Keep Separate"}
                </button>
                <button className="primary" disabled={selectedStatus === "versioned"} onClick={() => selected.id && decide(selected.id, "versioned")}>
                  {selectedStatus === "versioned" ? "Marked as Versions" : "Mark as Versions"}
                </button>
              </div>
            </div>
            <section className="reasonBox">
              <div><span>Version Signal</span><strong>{Math.round(selected.score * 100)}%</strong></div>
              <ul>{selected.reasons.map((reason, index) => <li key={index}>{reason.type}: {reason.detail ?? reason.value ?? "match signal"}</li>)}</ul>
            </section>
            <section className="versionTimelinePanel">
              <div className="cardTitle"><h3>Version Timeline</h3><span>Upload and parse metadata</span></div>
              <div className="versionTimeline">
                <VersionMetadataCard label={selected.left_name ?? "Candidate A"} version={selected.left_version} />
                <VersionMetadataCard label={selected.right_name ?? "Candidate B"} version={selected.right_version} />
              </div>
            </section>
            <section className="comparePanel">
              <div className="cardTitle"><h3>Field Differences</h3><span>Every file remains preserved</span></div>
              <div className="compareGrid">
                <strong>Field</strong>
                <strong>{selected.left_name ?? "Candidate A"}</strong>
                <strong>{selected.right_name ?? "Candidate B"}</strong>
                {candidateVersionCompareRows(selected).map((row) => (
                  <div className={`compareRow ${row.status ?? "different"}`} key={row.label}>
                    <span>
                      {row.label}
                      {row.status ? <b>{domainLabel(row.status)}</b> : null}
                      {row.detail ? <em>{row.detail}</em> : null}
                    </span>
                    <p>{row.left || "Missing"}</p>
                    <p>{row.right || "Missing"}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="auditPanel">
              <div className="cardTitle"><h3>Decision Audit Trail</h3><span>{selected.audit_events?.length ?? 0} events</span></div>
              {selected.audit_events?.length ? (
                <div className="auditList">
                  {selected.audit_events.map((event, index) => (
                    <article key={`${event.action}-${event.created_at}-${index}`}>
                      <strong>{domainLabel(event.action.replace("entity_resolution.", "").replace("candidate_versions.", ""))}</strong>
                      <span>{event.user_email ?? "Unknown user"} | {new Date(event.created_at).toLocaleString()}</span>
                      {event.metadata?.status ? <p>Status: {event.metadata.status}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <EmptyPanel title="No version decision recorded yet" body="Mark-as-versions, keep-separate, and review-later decisions will appear here after they are saved." />}
            </section>
          </>
        ) : <p className="muted">No candidate version groups are pending.</p>}
      </main>
    </section>
  );
}

function VersionMetadataCard({ label, version }: { label: string; version?: CandidateVersionMatch["left_version"] }) {
  const latest = version?.latest_document;
  const pageMethods = version?.page_methods ?? [];
  return (
    <article className="versionCard">
      <div>
        <strong>{label}</strong>
        <span>{version?.document_id ?? "Missing document id"}</span>
      </div>
      <dl>
        <dt>Uploaded</dt>
        <dd>{formatDateTime(latest?.uploaded_at ?? version?.candidate_created_at)}</dd>
        <dt>File</dt>
        <dd>{latest?.original_filename ?? "No document metadata"}</dd>
        <dt>Storage</dt>
        <dd>{latest ? `${latest.storage_backend} / ${shortHash(latest.storage_key)}` : "Missing"}</dd>
        <dt>Parse</dt>
        <dd>{latest?.parse_status ? `${domainLabel(latest.parse_status)}${latest.parse_stage ? ` (${domainLabel(latest.parse_stage)})` : ""}` : "No parse job linked"}</dd>
        <dt>Extraction</dt>
        <dd>{pageMethods.length ? pageMethods.map((item) => `${domainLabel(item.extraction_method ?? "unknown")} ${item.page_count}p`).join(", ") : latest?.extraction_method ?? "Unknown"}</dd>
        <dt>Size</dt>
        <dd>{formatBytes(latest?.size_bytes)}</dd>
      </dl>
    </article>
  );
}

function TeamSettings({
  members,
  invitations,
  mailMessages,
  governancePolicy,
  piiAccessEvents,
  inviteMember,
  resendInvite,
  cancelInvite,
  retryMail,
  updateRole,
  disableMember,
  updateGovernancePolicy,
  refreshPiiAudit,
  refreshMailMessages,
}: {
  members: TeamMember[];
  invitations: TenantInvitation[];
  mailMessages: MailMessage[];
  governancePolicy: GovernancePolicy | null;
  piiAccessEvents: PiiAccessEvent[];
  inviteMember: (email: string, role: string) => void;
  resendInvite: (invitationId: string) => void;
  cancelInvite: (invitationId: string) => void;
  retryMail: (messageId: string) => void;
  updateRole: (membershipId: string, role: string) => void;
  disableMember: (membershipId: string) => void;
  updateGovernancePolicy: (policy: Partial<GovernancePolicy>) => void;
  refreshPiiAudit: () => void;
  refreshMailMessages: () => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("recruiter");
  const [activeSettingsTab, setActiveSettingsTab] = useState<"pii" | "members" | "governance">("pii");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const piiRoles = governancePolicy?.contact_pii_visible_to_roles ?? ["tenant_owner", "tenant_admin", "recruiter"];
  return (
    <section className="settingsPage privacySettingsPage">
      <header className="privacySettingsTop">
        <div>
          <button className="plain small" type="button" onClick={() => window.history.back()}>Back</button>
          <strong>candidateSignal.ai</strong>
        </div>
        <button className="primary" type="button" onClick={refreshPiiAudit}>Refresh Audit</button>
      </header>
      <div className="privacySettingsLayout">
        <aside className="privacySettingsNav">
          <div>
            <h2>Settings</h2>
            <p>Manage privacy, team access, and data governance.</p>
          </div>
          <button className={activeSettingsTab === "members" ? "active" : ""} onClick={() => setActiveSettingsTab("members")}><Users size={22} /> Team Members</button>
          <button className={activeSettingsTab === "pii" ? "active" : ""} onClick={() => setActiveSettingsTab("pii")}><ShieldCheck size={22} /> PII Access Policies</button>
          <button className={activeSettingsTab === "governance" ? "active" : ""} onClick={() => setActiveSettingsTab("governance")}><Database size={22} /> Data Governance</button>
        </aside>
        <main className="privacySettingsMain">
          {activeSettingsTab === "pii" ? (
            <>
              <div className="privacySettingsTitle">
                <h2>PII Access Policies</h2>
                <p>Configure how personally identifiable information is handled, masked, unlocked, and processed by internal and external systems.</p>
              </div>
              <section className="privacyControlCard">
                <h3>Processing & Masking Controls</h3>
                <label className="policySwitchRow">
                  <span>
                    <strong>Redact PII in Copilot Synthesis</strong>
                    <small>Automatically strip names, emails, phone numbers, LinkedIn, portfolio, and direct contact details from assistant summaries.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={governancePolicy?.redact_pii_before_external_llm ?? true}
                    onChange={(event) => updateGovernancePolicy({ redact_pii_before_external_llm: event.target.checked })}
                  />
                </label>
                <label className="policySwitchRow">
                  <span>
                    <strong>Mask Contact Details by Role</strong>
                    <small>Hide direct contact information from viewer/reviewer roles until a permitted recruiter opens the field.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={piiRoles.length > 0}
                    onChange={(event) => updateGovernancePolicy({ contact_pii_visible_to_roles: event.target.checked ? ["tenant_owner", "tenant_admin", "recruiter"] : [] })}
                  />
                </label>
                <label className="policySwitchRow">
                  <span>
                    <strong>Enable Advanced AI Matching</strong>
                    <small>Allow sanitized candidate context to be used for richer match explanations. Contact details stay governed by the PII policy.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(governancePolicy?.external_llm_synthesis_enabled)}
                    onChange={(event) => updateGovernancePolicy({ external_llm_synthesis_enabled: event.target.checked })}
                  />
                </label>
              </section>
              <section className="privacyAuditCard">
                <div className="panelHead">
                  <h3>PII Access Audit Log</h3>
                  <button className="plain small" type="button" onClick={refreshPiiAudit}>Refresh</button>
                </div>
                <div className="settingsTable privacyAuditTable">
                  <div className="settingsRow piiAuditRow header"><span>Timestamp</span><span>User</span><span>Candidate</span><span>Action</span><span>Reason / Fields</span></div>
                  {piiAccessEvents.length ? piiAccessEvents.slice(0, 12).map((event) => (
                    <div className="settingsRow piiAuditRow" key={event.id}>
                      <span>{formatDateTime(event.created_at)}</span>
                      <span>{event.user_email ?? "Unknown user"}</span>
                      <span>{event.candidate_name ?? event.document_id ?? "Bulk/search access"}</span>
                      <span><b className={event.action.includes("mask") ? "auditTag danger" : "auditTag"}>{event.action.replaceAll("_", " ")}</b></span>
                      <span>{event.fields.join(", ") || "PII access"}</span>
                    </div>
                  )) : (
                    <div className="emptyTableState">No contact-data access events recorded yet.</div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeSettingsTab === "members" ? (
            <>
              <div className="privacySettingsTitle">
                <h2>Team Members</h2>
                <p>Invite recruiters and manage roles without exposing this workspace to platform admins.</p>
              </div>
              <section className="panel notePanel settingsInviteCard">
                <h3>Invite Member</h3>
                <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@company.com" />
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                  <option value="tenant_admin">Tenant admin</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="readonly">Readonly</option>
                </select>
                <button className="primary" disabled={!inviteEmail.trim()} onClick={() => inviteMember(inviteEmail, inviteRole)}>Send invite</button>
              </section>
              <section className="panel">
                <div className="panelHead"><h3>Members</h3><span>{members.length} active records</span></div>
                <div className="settingsTable">
                  <div className="settingsRow memberRow header"><span>Email</span><span>Name</span><span>Role</span><span>Status</span><span>Actions</span></div>
                  {members.map((member) => (
                    <div className="settingsRow memberRow" key={member.id}>
                      <span>{member.email}</span>
                      <span>{member.name ?? "Missing"}</span>
                      <span>
                        <select value={member.role} onChange={(event) => updateRole(member.id, event.target.value)}>
                          <option value="tenant_owner">Tenant owner</option>
                          <option value="tenant_admin">Tenant admin</option>
                          <option value="recruiter">Recruiter</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="readonly">Readonly</option>
                        </select>
                      </span>
                      <span>{member.status}</span>
                      <span><button className="plain small danger" disabled={member.status === "disabled"} onClick={() => disableMember(member.id)}>Disable</button></span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panelHead"><h3>Invitations</h3><span>{invitations.length}</span></div>
                <div className="settingsTable">
                  <div className="settingsRow inviteRow header"><span>Email</span><span>Role</span><span>Status</span><span>Invite Link</span><span>Actions</span></div>
                  {invitations.map((invite) => {
                    const link = invite.invite_token ? `${origin}?invite=${encodeURIComponent(invite.invite_token)}` : "";
                    const canCopy = invite.status === "pending" && Boolean(link);
                    const canResend = ["pending", "expired"].includes(invite.status);
                    const canCancel = invite.status === "pending";
                    return (
                      <div className="settingsRow inviteRow" key={invite.id}>
                        <span>{invite.email}</span>
                        <span>{invite.role}</span>
                        <span>{invite.status}</span>
                        <span>{link || "Hidden after creation"}</span>
                        <span className="jobActions">
                          {canCopy ? <button className="plain small" onClick={() => void navigator.clipboard?.writeText(link)}>Copy link</button> : null}
                          {canResend ? <button className="plain small" onClick={() => resendInvite(invite.id)}>Resend</button> : null}
                          {canCancel ? <button className="plain small danger" onClick={() => cancelInvite(invite.id)}>Cancel</button> : null}
                          {!canCopy && !canResend && !canCancel ? <span className="muted">Closed</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="panel">
                <div className="panelHead">
                  <h3>Email Delivery</h3>
                  <button className="plain small" type="button" onClick={refreshMailMessages}>Refresh</button>
                </div>
                <p className="panelIntro">Invitation emails are queued and tracked here. Failed delivery can be retried without creating a new invite.</p>
                <div className="settingsTable mailDeliveryTable">
                  <div className="settingsRow mailRow header"><span>Recipient</span><span>Type</span><span>Status</span><span>Sent</span><span>Actions</span></div>
                  {mailMessages.length ? mailMessages.slice(0, 12).map((message) => (
                    <div className="settingsRow mailRow" key={message.id}>
                      <span>{message.to_email}</span>
                      <span>{domainLabel(message.message_type)}</span>
                      <span>
                        <b className={`mailStatus ${message.status}`}>{domainLabel(message.status)}</b>
                        {message.error_message ? <small>{message.error_message}</small> : null}
                      </span>
                      <span>{message.sent_at ? formatDateTime(message.sent_at) : formatDateTime(message.created_at)}</span>
                      <span>
                        {["failed", "skipped", "dry_run"].includes(message.status) ? (
                          <button className="plain small" type="button" onClick={() => retryMail(message.id)}>Retry</button>
                        ) : (
                          <span className="muted">{message.provider}</span>
                        )}
                      </span>
                    </div>
                  )) : (
                    <div className="emptyTableState">No invitation email records yet.</div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeSettingsTab === "governance" ? (
            <>
              <div className="privacySettingsTitle">
                <h2>Data Governance</h2>
                <p>Set which company roles can view contact PII and verify the workspace privacy posture.</p>
              </div>
              <section className="privacyControlCard">
                <h3>Role-Based Contact Visibility</h3>
                <p className="muted">Only selected roles can view direct email, phone, LinkedIn, portfolio, and raw source CV contact fields.</p>
                <div className="roleChipGrid">
                  {["tenant_owner", "tenant_admin", "recruiter", "reviewer", "readonly"].map((role) => {
                    const selected = piiRoles.includes(role);
                    const nextRoles = selected ? piiRoles.filter((item) => item !== role) : [...piiRoles, role];
                    return (
                      <button
                        className={selected ? "filterChip active" : "filterChip"}
                        key={role}
                        onClick={() => updateGovernancePolicy({ contact_pii_visible_to_roles: nextRoles })}
                      >
                        {formatRole(role)} can see contact PII
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="privacyBoundary">
                <ShieldCheck size={22} />
                <div>
                  <strong>Company Boundary Active</strong>
                  <span>Recruiter files, notes, matches, campaigns, source previews, and candidate PII stay inside this tenant workspace.</span>
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </section>
  );
}

function AdminSettings({
  tenants,
  invitations,
  auditEvents,
  selectedTenant,
  selectTenant,
  createTenant,
  setTenantStatus,
}: {
  tenants: Tenant[];
  invitations: TenantInvitation[];
  auditEvents: AuditEvent[];
  selectedTenant: TenantAdminDetail | null;
  selectTenant: (tenantId: string) => void;
  createTenant: (name: string, seatLimit: number, ownerEmail: string, ownerRole: string) => void;
  setTenantStatus: (tenantId: string, status: "active" | "disabled") => void;
}) {
  const [name, setName] = useState("");
  const [seatLimit, setSeatLimit] = useState(5);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerRole, setOwnerRole] = useState("tenant_owner");
  const [companyQuery, setCompanyQuery] = useState("");
  const [page, setPage] = useState(1);
  const [companyFormError, setCompanyFormError] = useState("");
  const latestInvite = invitations.find((invite) => invite.invite_token);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = latestInvite?.invite_token ? `${origin}?invite=${encodeURIComponent(latestInvite.invite_token)}` : "";
  const filteredTenants = tenants.filter((tenant) => `${tenant.name} ${tenant.slug} ${tenant.status} ${tenant.plan}`.toLowerCase().includes(companyQuery.toLowerCase()));
  const platformAuditEvents = auditEvents.filter(isPlatformAdminAuditEvent);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const pagedTenants = filteredTenants.slice((page - 1) * pageSize, page * pageSize);
  const totalSeats = tenants.reduce((sum, tenant) => sum + Number(tenant.seat_limit ?? 0), 0);
  const usedSeats = tenants.reduce((sum, tenant) => sum + Number(tenant.member_count ?? 0), 0);
  const pendingInvites = invitations.filter((invite) => invite.status === "pending").length;

  useEffect(() => {
    setPage(1);
  }, [companyQuery]);

  function submitCompanyForm() {
    const error = validateCompanyForm(name, ownerEmail, seatLimit, ownerRole);
    if (error) {
      setCompanyFormError(error);
      return;
    }
    setCompanyFormError("");
    createTenant(name.trim(), seatLimit, ownerEmail.trim(), ownerRole);
  }

  return (
    <section className="settingsPage adminPage">
      <div className="pageTitle adminOverviewTitle">
        <div>
          <h2>Companies Overview</h2>
          <p>Monitor company health, seat utilization, pending invites, and workspace access. Candidate data stays inside each recruiter workspace.</p>
        </div>
        <div className="adminHeaderActions">
          <button className="plain" type="button" onClick={() => window.print()}>Export View</button>
          <button className="primary" type="button" onClick={() => document.getElementById("new-company-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Plus size={18} /> New Company
          </button>
        </div>
      </div>
      <section className="privacyBoundary">
        <ShieldCheck size={20} />
        <div>
          <strong>Privacy Boundary Active</strong>
          <span>Platform admins manage companies and seats only. Recruiter workflows, candidate PII, notes, and CV previews are not exposed here.</span>
        </div>
      </section>
      <div className="adminMetricGrid">
        <Metric label="Total Companies" value={String(tenants.length)} />
        <Metric label="Seats Allocated" value={`${usedSeats}/${totalSeats || 0}`} />
        <Metric label="Pending Invites" value={String(pendingInvites)} />
        <Metric label="Active Tenants" value={String(tenants.filter((tenant) => tenant.status === "active").length)} />
      </div>
      <section className="panel notePanel" id="new-company-form">
        <h3>Add Company</h3>
        <input value={name} onChange={(event) => {
          setName(event.target.value);
          setCompanyFormError("");
        }} placeholder="Company name" />
        <input value={ownerEmail} onChange={(event) => {
          setOwnerEmail(event.target.value);
          setCompanyFormError("");
        }} placeholder="First company admin email" />
        <select value={ownerRole} onChange={(event) => {
          setOwnerRole(event.target.value);
          setCompanyFormError("");
        }}>
          <option value="tenant_owner">Tenant owner</option>
          <option value="tenant_admin">Tenant admin</option>
        </select>
        <input value={seatLimit} onChange={(event) => {
          setSeatLimit(Number(event.target.value || 1));
          setCompanyFormError("");
        }} type="number" min={1} max={500} />
        {companyFormError ? <div className="formError">{companyFormError}</div> : null}
        <button className="primary" disabled={!name.trim() || !ownerEmail.trim()} onClick={submitCompanyForm}>Create company and invite admin</button>
        {latestInvite?.invite_token ? (
          <div className="inviteOutput">
            <strong>Latest owner invite</strong>
            <span>{latestInvite.email}</span>
            <code>{inviteUrl}</code>
          </div>
        ) : null}
      </section>
      <section className="panel adminTenantPanel">
        <div className="panelHead">
          <div>
            <h3>Active Tenants</h3>
            <span>{filteredTenants.length} shown from {tenants.length}</span>
          </div>
          <label className="companySearch">
            <Search size={16} />
            <input value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search company, slug, status, or tier" />
          </label>
        </div>
        <div className="settingsTable">
          <div className="settingsRow tenantRow header"><span>Company</span><span>Tier</span><span>Seat Usage</span><span>Status</span><span>Actions</span></div>
          {pagedTenants.map((tenant) => (
            <div className="settingsRow tenantRow" key={tenant.id}>
              <span>{tenant.name}</span>
              <span>{domainLabel(tenant.plan || tenantTier(tenant))}<small>{tenant.slug}</small></span>
              <span>
                <ProgressBar value={tenant.seat_limit ? Math.round(((tenant.member_count ?? 0) / tenant.seat_limit) * 100) : 0} />
                <small>{tenant.member_count ?? 0}/{tenant.seat_limit} seats</small>
              </span>
              <span>{domainLabel(tenant.status)}<small>{tenant.created_at ? `Created ${new Date(tenant.created_at).toLocaleDateString()}` : "No date"}</small></span>
              <span className="jobActions">
                <button className="plain small" onClick={() => selectTenant(tenant.id)}>Inspect</button>
                {tenant.status === "active" ? (
                  <button className="plain small danger" onClick={() => setTenantStatus(tenant.id, "disabled")}>Disable</button>
                ) : (
                  <button className="plain small" onClick={() => setTenantStatus(tenant.id, "active")}>Reactivate</button>
                )}
              </span>
            </div>
          ))}
          {!pagedTenants.length ? <div className="emptyTableState">No companies match this search.</div> : null}
        </div>
        <div className="paginationRow">
          <button className="plain small" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button className="plain small" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
        </div>
      </section>
      {selectedTenant ? <TenantDrilldown detail={selectedTenant} /> : (
        <section className="panel emptyState">
          <h3>No company selected</h3>
          <p>Inspect a company to review seats, users, invitations, status, and company-management audit events without entering the recruiter workspace.</p>
        </section>
      )}
      <section className="panel">
        <div className="panelHead"><h3>Recent Company Admin Invites</h3><span>{invitations.length}</span></div>
        <div className="settingsTable">
          <div className="settingsRow header"><span>Email</span><span>Role</span><span>Status</span><span>Invite Link</span></div>
          {invitations.map((invite) => (
            <div className="settingsRow" key={invite.id}>
              <span>{invite.email}</span>
              <span>{invite.role}</span>
              <span>{invite.status}</span>
              <span>{invite.invite_token ? `${origin}?invite=${encodeURIComponent(invite.invite_token)}` : "Hidden after creation"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panelHead"><h3>Platform Audit Log</h3><span>{platformAuditEvents.length}</span></div>
        <div className="auditList">
          {platformAuditEvents.length ? platformAuditEvents.map((event) => (
            <article key={event.id}>
              <strong>{domainLabel(event.action)}</strong>
              <span>{event.tenant_name ?? "No tenant"} | {event.user_email ?? "System"} | {formatDateTime(event.created_at)}</span>
              <p>{domainLabel(event.entity_type)}</p>
            </article>
          )) : <EmptyPanel title="No platform audit events" body="Tenant creation, invites, company status changes, and role changes will appear here." />}
        </div>
      </section>
    </section>
  );
}

function TenantDrilldown({ detail }: { detail: TenantAdminDetail }) {
  const safeAuditEvents = detail.audit_events.filter(isPlatformAdminAuditEvent);
  return (
    <section className="tenantDrilldown">
      <div className="pageTitle compact">
        <div>
          <h2>{detail.tenant.name}</h2>
          <p>Platform-admin governance view. Recruiter workspace access belongs only to invited recruiters.</p>
        </div>
        <span className="jobActions">
          <span className="statusPill">{detail.tenant.status}</span>
        </span>
      </div>
      <div className="metricsGrid">
        <Metric label="Seats" value={`${detail.tenant.member_count ?? 0}/${detail.tenant.seat_limit}`} />
        <Metric label="Invites" value={String(detail.invitations.length)} />
        <Metric label="Members" value={String(detail.members.length)} />
        <Metric label="Status" value={domainLabel(detail.tenant.status)} />
      </div>
      <section className="panel">
        <div className="panelHead"><h3>Members</h3><span>{detail.members.length}</span></div>
        <div className="settingsTable">
          <div className="settingsRow memberRow header"><span>Email</span><span>Name</span><span>Role</span><span>Status</span><span>Joined</span></div>
          {detail.members.map((member) => (
            <div className="settingsRow memberRow" key={member.id}>
              <span>{member.email}</span>
              <span>{member.name ?? "Missing"}</span>
              <span>{domainLabel(member.role)}</span>
              <span>{member.status}</span>
              <span>{formatDateTime(member.joined_at ?? member.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="adminDetailGrid">
        <AdminMiniList
          title="Privacy Boundary"
          count={detail.tenant.candidate_count ?? 0}
          rows={[[`${detail.tenant.candidate_count ?? 0} candidate records`, "Profile details hidden", "Recruiters access candidate records"]]}
        />
        <AdminMiniList
          title="Seat Governance"
          count={detail.members.length}
          rows={[
            [`${detail.members.length}/${detail.tenant.seat_limit} seats used`, "Company user access", "Manage seats from platform admin"],
            [`${detail.invitations.filter((item) => item.status === "pending").length} pending invites`, "Invite-only onboarding", "Company owner/admin accepts invite"],
          ]}
        />
        <AdminMiniList
          title="Workspace Data"
          count={detail.tenant.parse_job_count ?? 0}
          rows={[["Resume files, parsing, requirements, notes, and matches", "Hidden from platform admin", "Tenant isolation boundary"]]}
        />
        <AdminMiniList
          title="Invitations"
          count={detail.invitations.length}
          rows={detail.invitations.map((item) => [item.email, domainLabel(item.role), domainLabel(item.status)])}
        />
      </div>
      <section className="panel">
        <div className="panelHead"><h3>Audit Events</h3><span>{safeAuditEvents.length}</span></div>
        <div className="auditList">
          {safeAuditEvents.length ? safeAuditEvents.map((event) => (
            <article key={event.id}>
              <strong>{domainLabel(event.action)}</strong>
              <span>{event.user_email ?? "System"} | {event.entity_type} | {formatDateTime(event.created_at)}</span>
              <p>{domainLabel(event.entity_type)}</p>
            </article>
          )) : <EmptyPanel title="No company-management audit events yet" body="Tenant creation, owner invites, role changes, and company status changes will appear here." />}
        </div>
      </section>
    </section>
  );
}

function AdminMiniList({ title, count, rows }: { title: string; count: number; rows: string[][] }) {
  return (
    <section className="panel adminMiniList">
      <div className="panelHead"><h3>{title}</h3><span>{count}</span></div>
      {rows.length ? rows.map((row, index) => (
        <article key={`${title}-${index}`}>
          <strong>{row[0]}</strong>
          <span>{row[1]}</span>
          <em>{row[2]}</em>
        </article>
      )) : <EmptyPanel title={`No ${title.toLowerCase()}`} body="Nothing has been recorded for this company yet." />}
    </section>
  );
}

function tenantTier(tenant: Tenant) {
  if (tenant.seat_limit >= 50) return "enterprise";
  if (tenant.seat_limit >= 15) return "growth";
  return "starter";
}

function candidateInitials(name?: string | null) {
  const parts = String(name || "Candidate").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function isPlatformAdminAuditEvent(event: AuditEvent) {
  const action = `${event.action} ${event.entity_type}`.toLowerCase();
  return /tenant|company|member|invite|invitation|role|seat|user|admin|governance/.test(action)
    && !/workspace|candidate|resume|parse|requirement|match|copilot|pii|document|note/.test(action);
}

type EvidenceRowInput = { label: string; value?: unknown; source: string; query?: string[] };

function buildRecruiterEvidenceRows(facts: EvidenceRowInput[], inferences: EvidenceRowInput[], evidenceMap: any[], rawText: string) {
  const rows = [
    ...facts.map((item, index) => ({ ...item, kind: "Fact" as const, id: `fact-${item.label}-${index}` })),
    ...inferences.map((item, index) => ({ ...item, kind: "AI interpretation" as const, id: `inference-${item.label}-${index}` })),
  ];
  return rows
    .filter((item) => String(item.value ?? "").trim())
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      claim: String(item.value ?? "").trim(),
      source: item.source,
      snippet: findClaimEvidence(item.value, evidenceMap, rawText, item.query ?? []),
    }))
    .slice(0, 24);
}

function topDomainCounts(candidates: CandidateSummary[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    (candidate.top_domains ?? []).forEach((domain) => counts.set(domain, (counts.get(domain) ?? 0) + 1));
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
}

function applyDatabaseFilters(candidates: CandidateSummary[], filters: string[]) {
  const selectedCountries = filters
    .filter((item) => item.startsWith("country:"))
    .map((item) => item.slice("country:".length));
  const selectedNoteSignals = filters
    .filter((item) => item.startsWith("note:"))
    .map((item) => item.slice("note:".length));
  return candidates.filter((candidate) => {
    if (filters.includes("ai") && !(candidate.top_domains ?? []).some((domain) => /ai|gen|llm|conversation/i.test(domain))) return false;
    if (filters.includes("experience") && Number(candidate.total_years_experience ?? 0) < 5) return false;
    if (selectedCountries.length && !selectedCountries.some((country) => (candidate.countries ?? []).includes(country))) return false;
    if (selectedNoteSignals.length && !selectedNoteSignals.some((key) => (candidate.note_signals ?? []).some((signal) => candidateNoteSignalKey(signal) === key))) return false;
    if (filters.includes("seniority") && !/lead|senior|principal|staff/i.test(candidate.seniority ?? `${candidate.current_title ?? ""}`)) return false;
    if (filters.includes("duplicate") && Number(candidate.duplicate_risk_score ?? 0) < 0.75) return false;
    if (filters.includes("coverage") && Number(candidate.coverage ?? 0) <= 0.8) return false;
    if (filters.includes("missing_location") && candidate.location) return false;
    return true;
  });
}

function autoBatchNameForFiles(files: File[], campaignName?: string | null) {
  const count = files.length;
  const date = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (!count) return campaignName ? `${campaignName} upload` : "Resume upload";
  if (count === 1) return `${campaignName ? `${campaignName} - ` : ""}${files[0].name}`;
  return `${campaignName ? `${campaignName} - ` : ""}${count} resumes - ${date}`;
}

function candidateSortValue(candidate: CandidateSummary, key: CandidateSortKey) {
  if (key === "name") return candidate.name ?? "";
  if (key === "title") return candidate.current_title ?? "";
  if (key === "company") return candidate.current_company ?? "";
  if (key === "years") return Number(candidate.total_years_experience ?? -1);
  if (key === "coverage") return Number(candidate.coverage ?? -1);
  if (key === "risk") return Number(candidate.duplicate_risk_score ?? 0);
  return candidate.updated_at ? new Date(candidate.updated_at).getTime() : 0;
}

function sortArrow(sort: { key: CandidateSortKey; direction: "asc" | "desc" }, key: CandidateSortKey) {
  if (sort.key !== key) return "";
  return sort.direction === "asc" ? "↑" : "↓";
}

function hasMatchGaps(gaps: any) {
  return Object.values(gaps ?? {}).some((value) => Array.isArray(value) ? value.length > 0 : Number(value ?? 0) > 0);
}

function gapItems(key: string, value: unknown) {
  const label = domainLabel(key);
  if (Array.isArray(value)) return value.map((item) => `${label}: ${item}`);
  if (Number(value ?? 0) > 0) return [`${label}: ${value}`];
  return [];
}

function matchFilterHit(match: RequirementMatch, filter: MatchFilter) {
  if (filter === "all") return true;
  if (filter === "eligible") return !(match.evidence?.hard_filter_failures ?? []).length;
  if (filter === "blocked") return (match.evidence?.hard_filter_failures ?? []).length > 0;
  return match.status === filter;
}

function matchNextAction(match: RequirementMatch) {
  if ((match.evidence?.hard_filter_failures ?? []).length) return "Do not outreach yet. Resolve hard-filter failures or change the requirement constraints.";
  if (match.status === "shortlisted") return "Already shortlisted. Move to recruiter screen or hiring-manager review.";
  if (match.status === "rejected") return "Rejected for this requirement. Keep the decision for audit/history.";
  if (match.total_score >= 0.78) return "Shortlist and open the candidate detail to review raw evidence before outreach.";
  if (hasMatchGaps(match.gaps)) return "Review gaps and semantic evidence before deciding whether to shortlist.";
  return "Open candidate detail and compare against other eligible candidates.";
}

function matchDistribution(matches: Array<{ total_score?: number; score?: number }>) {
  const buckets = [
    { label: "80-100%", minimum: 0.8, min: 0.8, max: 1.01 },
    { label: "65-79%", minimum: 0.65, min: 0.65, max: 0.8 },
    { label: "50-64%", minimum: 0.5, min: 0.5, max: 0.65 },
    { label: "30-49%", minimum: 0.3, min: 0.3, max: 0.5 },
  ];
  const total = Math.max(1, matches.length);
  return buckets.map((bucket) => {
    const count = matches.filter((item) => {
      const score = Number(item.total_score ?? item.score ?? 0);
      return score >= bucket.min && score < bucket.max;
    }).length;
    return { ...bucket, count, percent: Math.round((count / total) * 100) };
  });
}

function findClaimEvidence(value: unknown, evidenceMap: any[], rawText: string, fallbackTerms: string[]) {
  const text = String(value || "");
  const terms = evidenceTerms(text);
  const mapped = evidenceMap.find((item) => {
    const claimTerms = evidenceTerms(item?.claim ?? "");
    const overlap = claimTerms.filter((term) => terms.includes(term));
    return overlap.length >= 2;
  });
  const mappedEvidence = Array.isArray(mapped?.evidence) ? mapped.evidence.find((item: unknown) => String(item || "").trim()) : "";
  if (mappedEvidence) return String(mappedEvidence).slice(0, 280);
  return findEvidenceSnippet(rawText, fallbackTerms.length ? fallbackTerms : terms);
}

function findEvidenceSnippet(rawText: string, terms: string[]) {
  if (!rawText || !terms.length) return "";
  const normalizedTerms = terms.map((term) => String(term || "").trim()).filter((term) => term.length >= 3);
  if (!normalizedTerms.length) return "";
  const flattened = rawText.replace(/\s+/g, " ").trim();
  const lower = flattened.toLowerCase();
  const hit = normalizedTerms
    .map((term) => ({ term, index: lower.indexOf(term.toLowerCase()) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!hit) return "";
  const start = Math.max(0, hit.index - 110);
  const end = Math.min(flattened.length, hit.index + hit.term.length + 170);
  return `${start > 0 ? "... " : ""}${flattened.slice(start, end)}${end < flattened.length ? " ..." : ""}`;
}

function evidenceTerms(value: unknown) {
  const text = String(value || "").toLowerCase();
  const stopwords = new Set(["with", "from", "that", "this", "role", "good", "fit", "for", "and", "the", "ask", "current", "candidate", "experience"]);
  return Array.from(new Set(text.match(/[a-z0-9+#.]{3,}/g) ?? []))
    .filter((term) => !stopwords.has(term))
    .slice(0, 8);
}

function evidenceSourceLabel(evidence: { source_label?: string | null; chunk_type?: string | null; page_number?: number | null }) {
  const label = evidence.source_label || evidence.chunk_type || "Candidate evidence";
  const normalized = String(label).toLowerCase();
  if (normalized.includes("raw extracted")) return evidence.page_number ? `Raw CV page ${evidence.page_number}` : "Raw CV text";
  if (normalized.includes("parsed skills") || normalized === "skills") return "Parsed skills";
  if (normalized.includes("recruiter notes") || normalized === "notes") return "Recruiter notes";
  if (normalized.includes("ai hr") || normalized.includes("ai_intelligence")) return "AI intelligence";
  if (normalized.includes("experience")) return label;
  if (normalized.includes("location")) return "Location signals";
  return label;
}

function profileAnswerValue(
  draftAnswers: Record<string, string>,
  savedAnswers: Record<string, string>,
  profile: Record<string, any>,
  field: (typeof requirementStructuredFields)[number],
) {
  if (Object.prototype.hasOwnProperty.call(draftAnswers, field.key)) return draftAnswers[field.key] ?? "";
  if (Object.prototype.hasOwnProperty.call(savedAnswers, field.key)) return savedAnswers[field.key] ?? "";
  const value = profile?.[field.profileKey];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function candidateRoleFactsNeedReview(candidate: CandidateSummary) {
  return Boolean(
    candidate.current_role_verification_status
    && candidate.current_role_verification_status !== "verified"
    && candidate.current_role_verification_status !== "missing"
  );
}

function candidateNoteSignalLabels(candidate: CandidateSummary) {
  return (candidate.note_signals ?? [])
    .map(candidateNoteSignalDisplay)
    .filter(Boolean);
}

function candidateNoteSignalDisplay(signal: { category?: string; label?: string; value?: string | null }) {
  const label = domainLabel(String(signal.label || signal.value || signal.category || ""));
  const value = signal.value && String(signal.value).toLowerCase() !== String(signal.label || "").toLowerCase()
    ? `: ${signal.value}`
    : "";
  return `${label}${value}`.trim();
}

function candidateNoteSignalKey(signal: { category?: string; label?: string; value?: string | null }) {
  const category = String(signal.category || "").toLowerCase().trim();
  const label = String(signal.label || signal.value || "").toLowerCase().trim();
  if (!category && !label) return "";
  return `${category}:${label}`.replace(/\s+/g, "_");
}

function candidateProfileFreshnessLabel(freshness?: CandidateSummary["profile_freshness"]) {
  if (!freshness?.label) return "";
  if (freshness.status === "fresh") return freshness.label;
  return freshness.summary ? `${freshness.label}: ${freshness.summary}` : freshness.label;
}

function profileFreshnessBadgeClass(status?: string) {
  if (status === "fresh") return "freshnessBadge fresh";
  if (status === "stale" || status === "possibly_stale") return "freshnessBadge stale";
  return "freshnessBadge review";
}

function candidateProfileFreshness(candidate: CandidateSummary | Candidate): CandidateSummary["profile_freshness"] {
  return (candidate as CandidateSummary).profile_freshness ?? (candidate as Candidate).derived?.profile_freshness;
}

function candidateProfileFreshnessNeedsReview(candidate: CandidateSummary | Candidate) {
  const freshness = candidateProfileFreshness(candidate);
  return ["stale", "possibly_stale", "needs_verification"].includes(String(freshness?.status ?? "")) && !candidateReviewSignalDone(candidate, "profile_freshness_review");
}

function candidateListHazards(candidate: CandidateSummary) {
  const hazards: string[] = [];
  const coverage = Number(candidate.coverage ?? 0);
  if (coverage > 0 && coverage < 0.8 && !candidateReviewSignalDone(candidate, "low_coverage")) {
    hazards.push(coverage < 0.65 ? `Low profile coverage: ${Math.round(coverage * 100)}%` : `Review profile coverage: ${Math.round(coverage * 100)}%`);
  }
  if (candidateRoleFactsNeedReview(candidate) && !candidateReviewSignalDone(candidate, "role_fact_review")) {
    hazards.push("Role facts need review");
  }
  if (
    Number(candidate.duplicate_risk_score ?? 0) >= 0.75
    && normalizeCandidateVersionStatus(candidate.duplicate_status) === "suggested"
  ) {
    hazards.push("Possible repeated candidate upload");
  }
  if (candidateProfileFreshnessNeedsReview(candidate)) {
    hazards.push(candidate.profile_freshness?.summary ?? "Profile may be stale");
  }
  return hazards;
}

function candidateReviewSignalDone(candidate: CandidateSummary | Candidate, signalKey: CandidateReviewSignal) {
  return Boolean(candidate.reviewed_signals?.includes(signalKey));
}

function latestCandidateReparseBatch(batches: ParseBatch[], sourceName: string) {
  const normalizedSource = normalizeComparableText(sourceName);
  const matching = batches
    .filter((batch) => batch.source_type === "candidate_reparse")
    .filter((batch) => !normalizedSource || normalizeComparableText(batch.name).includes(normalizedSource))
    .sort((left, right) => new Date(right.updated_at ?? right.created_at ?? 0).getTime() - new Date(left.updated_at ?? left.created_at ?? 0).getTime());
  return matching[0] ?? null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function candidateEducationRows(education: Candidate["education"]) {
  return (education ?? []).map((item) => ({
    school: textValue(item.school),
    degree: textValue(item.degree),
    field: textValue(item.field),
    location: textValue(item.location),
    start_date: textValue(item.start_date),
    end_date: textValue(item.end_date),
    details: toTextList(item.details ?? []),
  })).filter((item) => item.school || item.degree || item.field || item.location);
}

function candidateEducationTimelineEvents(education: Candidate["education"]) {
  return candidateEducationRows(education)
    .filter((item) => item.start_date || item.end_date)
    .map((item, index) => ({
      id: `education-${item.school || item.degree || index}`,
      title: item.degree || item.field || "Education",
      organization: item.school,
      start_date: item.start_date || item.end_date,
      end_date: item.end_date || item.start_date,
      summary: [item.field, item.location, ...item.details.slice(0, 2)].filter(Boolean).join(" | "),
      relationship: "education",
      workstreams: [],
      overlaps_with: [],
    }));
}

function educationDateLabel(item: { start_date?: string; end_date?: string }) {
  if (item.start_date && item.end_date && item.start_date !== item.end_date) return `${item.start_date} - ${item.end_date}`;
  if (item.end_date) return `Completed ${item.end_date}`;
  if (item.start_date) return `Started ${item.start_date}`;
  return "Dates not extracted";
}

function timelineDateRangeLabel(item: { start_date?: string | null; end_date?: string | null }, isEducation: boolean) {
  const start = textValue(item.start_date);
  const end = textValue(item.end_date);
  if (isEducation && end && (!start || start === end)) return `Completed ${end}`;
  if (isEducation && start && !end) return `Started ${start}`;
  return `${start || "Unknown"} - ${end || (isEducation ? "Completed" : "Present")}`;
}

function isEducationTimelineEvent(value: any) {
  const relationship = String(value?.relationship ?? value?.kind ?? value?.type ?? "").toLowerCase();
  return relationship === "education" || relationship === "school" || relationship === "degree";
}

function dedupeTimelineEvents(events: any[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      isEducationTimelineEvent(event) ? "education" : "work",
      normalizeComparableText(event?.title),
      normalizeComparableText(event?.organization),
      String(event?.start_date ?? ""),
      String(event?.end_date ?? ""),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTimelineRows(events: any[]) {
  const dated = events
    .map((event) => ({ ...event, startIndex: timelineMonthIndex(event.start_date), endIndex: timelineMonthIndex(event.end_date || "Present") }))
    .filter((event) => typeof event.startIndex === "number" && typeof event.endIndex === "number");
  if (!dated.length) return [];
  const byId = new Map(dated.map((event) => [event.id, event]));
  const min = Math.min(...dated.map((event) => event.startIndex));
  const max = Math.max(...dated.map((event) => event.endIndex));
  const span = Math.max(1, max - min);
  return dated.map((event) => {
    const overlapIds = Array.isArray(event.overlaps_with) ? event.overlaps_with : [];
    const crossCompanyOverlap = overlapIds.some((id: string) => {
      const other = byId.get(id);
      return other && normalizeOrg(other.organization) !== normalizeOrg(event.organization);
    });
    return {
      ...event,
      crossCompanyOverlap,
      left: Math.max(0, ((event.startIndex - min) / span) * 100),
      width: Math.max(3, ((event.endIndex - event.startIndex) / span) * 100),
      minYear: Math.floor(min / 12),
      maxYear: Math.floor(max / 12),
    };
  });
}

function timelineYearMarkers(rows: any[]) {
  const years = rows.flatMap((row) => [row.minYear, row.maxYear]).filter((value) => typeof value === "number") as number[];
  if (!years.length) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (max <= min) return [min];
  const span = max - min;
  const step = span > 10 ? 2 : 1;
  const markers: number[] = [];
  for (let year = min; year <= max; year += step) markers.push(year);
  if (markers[markers.length - 1] !== max) markers.push(max);
  return markers;
}

function timelineMonthIndex(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || ["present", "current", "now"].includes(text)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth() + 1;
  }
  const match = text.match(/(\d{4})(?:[-/](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] || 1);
  return year * 12 + Math.max(1, Math.min(12, month));
}

function normalizeOrg(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeComparableText(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function batchProgress(batch: ParseBatch) {
  if (!batch.total_files) return 0;
  return ((batch.completed_count + batch.failed_count) / batch.total_files) * 100;
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

function formatYears(value: unknown) {
  return typeof value === "number" ? `${value} yrs` : "Unknown";
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

function validateCompanyForm(name: string, ownerEmail: string, seatLimit: number, ownerRole: string) {
  if (name.trim().length < 2) return "Company name must be at least 2 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail.trim())) return "Enter a valid first company admin email.";
  if (!["tenant_owner", "tenant_admin"].includes(ownerRole)) return "First admin role must be tenant owner or tenant admin.";
  if (!Number.isFinite(seatLimit) || seatLimit < 1) return "Seat limit must be at least 1.";
  if (seatLimit > 500) return "Seat limit cannot exceed 500.";
  return "";
}

function domainYears(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const years = (value as { years?: unknown }).years;
    return typeof years === "number" ? years : 0;
  }
  return 0;
}

function domainOriginalYears(value: unknown) {
  if (value && typeof value === "object") {
    const objectValue = value as { original_years?: unknown; years?: unknown };
    if (typeof objectValue.original_years === "number") return objectValue.original_years;
    if (typeof objectValue.years === "number") return objectValue.years;
  }
  return domainYears(value);
}

function domainStoredEvidenceTerms(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const terms = (value as { evidence_terms?: unknown }).evidence_terms;
  return Array.isArray(terms) ? terms.map((item) => String(item)).filter(Boolean) : [];
}

function domainStoredReviewFlags(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const flags = (value as { review_flags?: unknown }).review_flags;
  return Array.isArray(flags) ? flags.map((item) => String(item)).filter(Boolean) : [];
}

function numericYears(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function isPlatformAdmin(user: CurrentUser | null) {
  return user?.platform_role === "platform_admin" || user?.platform_role === "admin" || user?.role === "platform_admin" || user?.role === "admin";
}

function isCandidateUser(user: CurrentUser | null) {
  return user?.workspace_access === "candidate" || user?.platform_role === "candidate" || user?.role === "candidate";
}

function isTenantAdmin(user: CurrentUser | null) {
  return ["tenant_owner", "tenant_admin"].includes(user?.tenant_role ?? "");
}
