"use client";

import { useEffect, useMemo, useState } from "react";
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
  Menu,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  Candidate,
  CandidateMaintenanceJob,
  CandidateSummary,
  AuditEvent,
  CopilotMessage,
  CopilotThread,
  CurrentUser,
  EntityMatch,
  CandidateVersionDiff,
  GovernancePolicy,
  JobCampaign,
  JobCampaignCandidate,
  OperationalAlert,
  OperationalAlertDelivery,
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
  createCampaign,
  createCandidateRederiveJob,
  createTenant,
  createRequirement,
  createRequirementFromCopilotThread,
  decideCandidateVersion,
  getTeam,
  getCampaign,
  getCandidateDocumentHtml,
  getCopilotThread,
  getTenantAdminDetail,
  getCandidateRawText,
  getCandidateSource,
  getCandidate,
  getRequirementMatches,
  listRequirementMatchRuns,
  compareLatestRequirementMatchRuns,
  finalizeRequirement,
  getParseBatch,
  getWorkerStatus,
  inviteTeamMember,
  listCandidates,
  listCampaigns,
  listCopilotThreads,
  listAuditLogs,
  listEntityClusters,
  listOperationalAlertDeliveries,
  listOperationalAlerts,
  listPiiAccessEvents,
  listCandidateMaintenanceJobs,
  listParseDeadLetters,
  listParseBatches,
  listRequirements,
  listTenants,
  me,
  matchRequirement,
  matchCampaign,
  reactivateTenant,
  rejectMatch,
  resendInvitation,
  resolveParseDeadLetter,
  retryCandidateMaintenanceJob,
  retryParseJob,
  reparseCandidate,
  searchCandidates,
  shortlistMatch,
  updateMemberRole,
  updateNote,
  uploadRequirement,
  uploadResume,
  uploadCampaignResumes,
  updateCampaignCandidateStatus,
  updateGovernancePolicy,
  deleteNote,
  disableTenant,
  disableMember,
} from "../lib/api";
import { authClient } from "../lib/auth-client";

type View = "dashboard" | "copilot" | "database" | "upload" | "operations" | "candidate" | "requirement" | "matches" | "campaigns" | "versions" | "team" | "admin";

type WorkspaceChatMessage = CopilotMessage & {
  query?: string;
  candidates?: CandidateSummary[];
  clarifying_questions?: string[];
  suggested_actions?: string[];
  metadata?: Record<string, any>;
};

const COPILOT_GREETING: WorkspaceChatMessage = {
  role: "assistant",
  content: "Ask me to find candidates, compare profiles, surface evidence from raw CV text, or turn a hiring intent into a shortlist query.",
};

type CopilotFilters = {
  sort: "relevance" | "recency";
  minScore: number;
  exactEvidenceOnly: boolean;
  country: string;
  seniority: "all" | "senior";
};

type CopilotQueryIntent = {
  role_intent: string;
  roles: string[];
  locations: string[];
  location_requirement: "preferred" | "required" | "ignored" | string;
  terms: string[];
};

type HomeAppProps = {
  initialLoginMode?: "company" | "admin";
  lockedLoginMode?: boolean;
};

const LOCAL_LOGIN_ALIASES: Record<string, string> = {
  admin: "admin@example.com",
  platform: "admin@example.com",
  platform_admin: "admin@example.com",
  recruiter: "recruiter@example.com",
  company: "recruiter@example.com",
  tenant: "recruiter@example.com",
};

const DOCUMENT_FILE_ACCEPT = ".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp";
const DOCUMENT_FORMAT_LABEL = "PDF, DOCX, TXT, MD, JPG, PNG, WEBP, TIFF, BMP";

function resolveLoginIdentifier(value: string, mode: "company" | "admin") {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error("Enter an email or username.");
  if (normalized.includes("@")) return normalized;
  const mapped = LOCAL_LOGIN_ALIASES[normalized];
  if (mapped) return mapped;
  const expected = mode === "admin" ? "admin" : "recruiter";
  throw new Error(`Unknown username. Use a full email address or local username "${expected}".`);
}

export default function Home() {
  return <LandingPage />;
}

function LandingPage() {
  return (
    <main className="publicHome">
      <header className="publicNav">
        <a className="publicBrand" href="/">
          <span className="brandMark" aria-hidden="true"><i /><i /><i /></span>
          <strong>candidatSignal.ai</strong>
        </a>
        <nav>
          <a href="#platform">Solutions</a>
          <a href="#privacy">Privacy</a>
          <a href="#security">Security</a>
        </nav>
        <div>
          <a className="adminNavLink" href="/admin/login">Platform Admin</a>
          <a className="plainLink" href="/login">Company Login</a>
        </div>
      </header>
      <section className="homeHero">
        <div className="homeHeroCopy">
          <h1>
            <span>Upload resumes.</span>
            <span>Understand candidates.</span>
            <em>Find the right fit faster.</em>
          </h1>
          <p>candidatSignal.ai turns resumes, notes, raw CV text, and job campaigns into evidence-backed recruiter decisions without mixing company data.</p>
          <div className="homeHeroActions">
            <a className="primaryLink large" href="/login">Company Login</a>
            <a className="plainLink large" href="/login?invite=1">Accept Invite</a>
          </div>
          <a className="adminHeroLink" href="/admin/login">Platform Admin Portal</a>
        </div>
      </section>
      <section className="homeFeatureGrid" id="platform">
        <article className="wideFeature">
          <FileSearch size={34} />
          <strong>Intelligence-First Parsing</strong>
          <span>Upload documents and let the system extract skills, experience, location signals, PII links, and candidate evidence without rigid formatting requirements.</span>
          <div className="featureSkeleton" aria-hidden="true"><i /><i /><b /><i /></div>
        </article>
        <article>
          <CheckCircle2 size={38} />
          <strong>Evidence-Backed Matching</strong>
          <span>Every match score is supported by source-linked evidence. Recruiters see exactly why a candidate fits or misses a role.</span>
          <div className="matchCallout">Found direct matches for required senior leadership experience.</div>
        </article>
        <article>
          <Search size={38} />
          <strong>Search Copilot</strong>
          <span>Ask complex questions about the company talent pool and get precise, filtered candidate results.</span>
        </article>
        <article className="wideFeature" id="privacy">
          <ShieldCheck size={40} />
          <strong>Absolute Privacy & Data Isolation</strong>
          <span>Your company data stays strictly isolated. Platform admins manage tenants and seats, not recruiter candidate data.</span>
        </article>
      </section>
      <footer className="publicFooter" id="security">
        <div>
          <strong>candidatSignal.ai</strong>
          <span>(c) 2026 candidatSignal.ai. Built for calm, evidence-backed hiring.</span>
        </div>
        <nav>
          <a href="#privacy">Privacy Policy</a>
          <a href="#security">Security Commitment</a>
          <a href="#platform">Terms of Service</a>
          <a href="#platform">Contact Support</a>
        </nav>
      </footer>
    </main>
  );
}

export function HomeApp({ initialLoginMode, lockedLoginMode = false }: HomeAppProps = {}) {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [workspaceMode, setWorkspaceMode] = useState<"admin" | "tenant">("admin");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [matches, setMatches] = useState<RequirementMatch[]>([]);
  const [matchRuns, setMatchRuns] = useState<RequirementMatchRun[]>([]);
  const [matchRunChanges, setMatchRunChanges] = useState<RequirementMatchRunChange[]>([]);
  const [campaigns, setCampaigns] = useState<JobCampaign[]>([]);
  const [campaign, setCampaign] = useState<JobCampaign | null>(null);
  const [clusters, setClusters] = useState<EntityMatch[]>([]);
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
  const [governancePolicy, setGovernancePolicy] = useState<GovernancePolicy | null>(null);
  const [piiAccessEvents, setPiiAccessEvents] = useState<PiiAccessEvent[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState("Initial bulk resume import");
  const [bulkCampaignId, setBulkCampaignId] = useState("workspace");
  const [requirementFile, setRequirementFile] = useState<File | null>(null);
  const [requirementText, setRequirementText] = useState("");
  const [campaignName, setCampaignName] = useState("New job campaign");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignFiles, setCampaignFiles] = useState<File[]>([]);
  const [noteName, setNoteName] = useState("Recruiter Notes");
  const [note, setNote] = useState("");
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CandidateSummary[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotResultLimit, setCopilotResultLimit] = useState(5);
  const [copilotCampaignId, setCopilotCampaignId] = useState("");
  const [copilotThreads, setCopilotThreads] = useState<CopilotThread[]>([]);
  const [copilotThread, setCopilotThread] = useState<CopilotThread | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<WorkspaceChatMessage[]>([COPILOT_GREETING]);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteMode, setInviteMode] = useState(false);
  const [loginMode, setLoginMode] = useState<"company" | "admin">(initialLoginMode ?? "company");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setInviteToken(invite);
      setInviteMode(true);
    }
    const saved = window.localStorage.getItem("resume-intel-token");
    if (saved) {
      setToken(saved);
      void refresh(saved).catch((error) => handleSessionFailure(error));
    }
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
    if (!token || !copilotCampaignId) return;
    if (campaign?.id === copilotCampaignId && Array.isArray(campaign.candidates)) return;
    if (!campaigns.some((item) => item.id === copilotCampaignId)) return;
    void handleSelectCopilotCampaign(copilotCampaignId);
  }, [campaign?.candidates, campaign?.id, campaigns, copilotCampaignId, token]);

  async function refresh(activeToken = token, nextWorkspaceMode = workspaceMode) {
    if (!activeToken) return;
    const meResult = await me(activeToken) as { user: CurrentUser };
    const user = meResult.user;
    const isPlatform = isPlatformAdmin(user);
    if (lockedLoginMode && initialLoginMode === "company" && isPlatform) {
      window.localStorage.removeItem("resume-intel-token");
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("tenant");
      setView("dashboard");
      setStatus("Platform admin session found. Use Admin Login.");
      return;
    }
    if (lockedLoginMode && initialLoginMode === "admin" && !isPlatform) {
      window.localStorage.removeItem("resume-intel-token");
      setToken("");
      setCurrentUser(null);
      setWorkspaceMode("admin");
      setView("admin");
      setStatus("Company session found. Use Company Login.");
      return;
    }
    setCurrentUser(user);
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
      listEntityClusters(activeToken),
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
      const [workerResult, deadLetterResult, alertResult, alertDeliveryResult, maintenanceResult] = await Promise.all([
        getWorkerStatus(activeToken),
        listParseDeadLetters(activeToken),
        listOperationalAlerts(activeToken),
        listOperationalAlertDeliveries(activeToken),
        listCandidateMaintenanceJobs(activeToken),
      ]);
      setWorkerStatus(workerResult);
      setParseDeadLetters(deadLetterResult.dead_letters);
      setOperationalAlerts(alertResult.alerts);
      setOperationalAlertDeliveries(alertDeliveryResult.deliveries);
      setMaintenanceJobs(maintenanceResult.jobs);
    } else {
      setWorkerStatus(null);
      setParseDeadLetters([]);
      setOperationalAlerts([]);
      setOperationalAlertDeliveries([]);
      setMaintenanceJobs([]);
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

  useEffect(() => {
    if (!token) return;
    const tenantAdmin = isTenantAdmin(currentUser);
    const hasActiveBatch = parseBatches.some(isActiveBatch) || Boolean(selectedBatch && isActiveBatch(selectedBatch));
    const hasActiveMaintenanceJob = maintenanceJobs.some(isActiveMaintenanceJob);
    if (!hasActiveBatch && !hasActiveMaintenanceJob) return;
    const timer = window.setInterval(() => {
      listParseBatches(token)
        .then((result) => setParseBatches(result.batches))
        .catch(() => undefined);
      if (tenantAdmin) {
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
      if (selectedBatch?.id) {
        getParseBatch(token, selectedBatch.id)
          .then((batch) => setSelectedBatch(batch))
          .catch(() => undefined);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [token, currentUser?.tenant_role, parseBatches, selectedBatch?.id, selectedBatch?.status, maintenanceJobs]);

  function handleSessionFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("invalid or expired session") ||
      message.includes("missing bearer token") ||
      message.includes("unsigned bearer token rejected") ||
      message.includes("invalid Better Auth bearer signature")
    ) {
      window.localStorage.removeItem("resume-intel-token");
      setToken("");
      setCurrentUser(null);
      setStatus("Session expired. Please log in again.");
      setLoginError("Your session expired. Please log in again.");
      return;
    }
    const readable = readableError(message || "Could not load workspace");
    setStatus(readable);
    setLoginError(readable);
  }

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

  async function handleLogin() {
    setBusy(true);
    setStatus("Signing in with Better Auth...");
    setLoginError("");
    try {
      window.localStorage.removeItem("resume-intel-token");
      const loginEmail = resolveLoginIdentifier(email, loginMode);
      const result = await authClient.signIn.email({ email: loginEmail, password });
      if (result.error) {
        throw new Error(result.error.message || "Better Auth login failed");
      }
      const tokenFromHeader = window.localStorage.getItem("resume-intel-token") || "";
      const tokenFromResponse = (result.data as { token?: string } | null)?.token || "";
      const nextToken = tokenFromHeader || tokenFromResponse;
      if (!nextToken) throw new Error("Login did not return a bearer token");
      const current = await me(nextToken) as { user: CurrentUser };
      const platform = isPlatformAdmin(current.user);
      if (loginMode === "admin" && !platform) {
        window.localStorage.removeItem("resume-intel-token");
        throw new Error("This account belongs to a company workspace. Use Company Login.");
      }
      if (loginMode === "company" && platform) {
        window.localStorage.removeItem("resume-intel-token");
        throw new Error("This account is a platform admin. Use Admin Login.");
      }
      window.localStorage.setItem("resume-intel-token", nextToken);
      const session = { token: nextToken, user: current.user };
      setToken(session.token);
      setCurrentUser(session.user);
      setWorkspaceMode(platform ? "admin" : "tenant");
      setView(platform ? "admin" : "dashboard");
      setStatus("Login successful");
      await refresh(session.token, platform ? "admin" : "tenant");
    } catch (error) {
      const message = readableError(error);
      window.localStorage.removeItem("resume-intel-token");
      setToken("");
      setCurrentUser(null);
      setLoginError(message);
      setStatus("Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!inviteToken.trim() || !inviteName.trim() || !invitePassword.trim()) return;
    await run("Accepting invite", () => acceptInvitation(inviteToken, inviteName, invitePassword));
    setInviteMode(false);
    setInviteToken("");
    setEmail("");
    setPassword("");
    setStatus("Invite accepted. Log in with the invited email and password.");
  }

  async function handleBootstrap() {
    await run("Creating admin", () => bootstrap(email, password));
    await handleLogin();
  }

  function handleLoginModeChange(mode: "company" | "admin") {
    if (lockedLoginMode) return;
    setLoginMode(mode);
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
    window.localStorage.removeItem("resume-intel-token");
    setToken("");
    setCurrentUser(null);
    setWorkspaceMode("admin");
    setCandidate(null);
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
    if (bulkCampaignId !== "workspace") {
      const result = await run("Queueing campaign resumes", () => uploadCampaignResumes(token, bulkCampaignId, bulkFiles));
      if (!result) return;
      setBulkFiles([]);
      setCampaign(result.campaign);
      setCampaigns((items) => [result.campaign, ...items.filter((item) => item.id !== result.campaign.id)]);
      setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
      setSelectedBatch(result.batch);
      await refresh();
      return;
    }
    const result = await run("Creating parse batch", () => bulkUploadResumes(bulkFiles, batchName, token, false));
    if (!result) return;
    setBulkFiles([]);
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    setSelectedBatch(result.batch);
    await refresh();
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
    if (!window.confirm("Queue a full deep reparse from the stored original CV? This will run OCR/LLM parsing again and update the candidate record.")) return;
    const result = await run("Queueing full candidate reparse", () => reparseCandidate(token, documentId, true));
    if (!result) return;
    setSelectedBatch(result.batch);
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    await refresh();
  }

  async function handleOpenCandidate(id: string) {
    const result = await run("Loading candidate", () => getCandidate(token, id));
    if (!result) return;
    setCandidate(result);
    setView("candidate");
  }

  async function handleSendCopilotMessage() {
    const message = copilotInput.trim();
    if (!message || !token) return;
    const nextHistory: WorkspaceChatMessage[] = [...copilotMessages, { role: "user", content: message }];
    setCopilotMessages(nextHistory);
    setCopilotInput("");
    try {
      const response = await run("Searching workspace with Copilot", () =>
        chatCopilot(
          token,
          message,
          nextHistory.map((item) => ({ role: item.role, content: item.content })),
          copilotResultLimit,
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
            metadata: { query_intent: response.query_intent },
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
    if (!window.confirm("Recalculate deterministic candidate intelligence for this company? This will not call OCR, LLM parsing, or embeddings.")) return;
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
    if (!candidate || !note.trim()) return;
    const result = await run("Saving note", () => addNote(candidate.document_id, noteName, note, token));
    if (!result) return;
    setCandidate(result);
    setNote("");
    await refresh();
  }

  async function handleUpdateNote(noteId: string, name: string, content: string) {
    if (!candidate) return;
    const result = await run("Updating note", () => updateNote(candidate.document_id, noteId, name, content, token));
    if (!result) return;
    setCandidate(result);
    await refresh();
  }

  async function handleDeleteNote(noteId: string) {
    if (!candidate) return;
    const result = await run("Deleting note", () => deleteNote(candidate.document_id, noteId, token));
    if (!result) return;
    setCandidate(result);
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
    const ranked = await run("Ranking candidates", () => matchRequirement(token, requirement.id));
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
    if (result.requirement_id) {
      await handleOpenCampaign(result.id);
      return;
    }
    setCampaignDescription("");
    setView("campaigns");
  }

  async function handleOpenCampaign(id: string) {
    const result = await run("Loading campaign", () => getCampaign(token, id));
    if (!result) return;
    setCampaign(result);
    setView("campaigns");
  }

  async function handleMatchCampaign(id = campaign?.id) {
    if (!id || !token) return;
    const result = await run("Ranking campaign candidates", () => matchCampaign(token, id));
    if (!result) return;
    setCampaign(result);
    setCampaigns((items) => items.map((item) => item.id === result.id ? result : item));
  }

  async function handleUploadCampaignResumes() {
    if (!campaign?.id || !campaignFiles.length || !token) return;
    const result = await run("Queueing campaign resumes", () => uploadCampaignResumes(token, campaign.id, campaignFiles));
    if (!result) return;
    setCampaignFiles([]);
    setCampaign(result.campaign);
    setSelectedBatch(result.batch);
    setParseBatches((items) => [result.batch, ...items.filter((item) => item.id !== result.batch.id)]);
    await refresh();
  }

  async function handleCampaignCandidateStatus(candidateId: string, status: "recommended" | "shortlisted" | "rejected") {
    if (!campaign?.id || !token) return;
    const updated = await run("Updating campaign candidate", () => updateCampaignCandidateStatus(token, campaign.id, candidateId, status));
    if (!updated) return;
    setCampaign((current) => {
      if (!current) return current;
      return {
        ...current,
        candidates: (current.candidates ?? []).map((item) => item.candidate_id === candidateId ? { ...item, ...updated } : item),
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

  async function handleEntityDecision(matchId: string, decision: "versioned" | "separate" | "review-later") {
    if (decision !== "review-later" && !window.confirm(`Save candidate-version decision: ${decision}? This is non-destructive and keeps every uploaded resume copy.`)) return;
    await run("Saving decision", () => decideCandidateVersion(token, matchId, decision));
    const result = await listEntityClusters(token);
    setClusters(result.clusters);
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
    if (!window.confirm("Disable this team member? They should lose access to this company workspace.")) return;
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

  const filteredCandidates = useMemo(() => {
    const needle = query.toLowerCase();
    if (!needle) return candidates;
    if (searchResults.length) return searchResults;
    return candidates.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
  }, [candidates, query, searchResults]);

  if (!token) {
    const showBootstrap = process.env.NODE_ENV !== "production";
    const showLocalDevHelp = process.env.NODE_ENV !== "production";
    const showLoginChoice = !inviteMode && !lockedLoginMode;
    const isAdminLogin = loginMode === "admin";
    return (
      <main className="loginShell">
        <section className="landingIntro loginIntroCompact">
          <span className="eyebrow">candidatSignal.ai</span>
          <h1>{showLoginChoice ? "Choose your workspace." : isAdminLogin ? "Platform admin login." : "Company workspace login."}</h1>
          <p>
            {showLoginChoice
              ? "Admin and recruiter workspaces are separate so company candidate data stays tenant-isolated."
              : isAdminLogin
                ? "Use this only to create companies, manage seats, and review platform audit data."
                : "Use this for resumes, candidates, campaigns, requirements, matching, and Team Settings."}
          </p>
          <div className="loginBoundaryCard">
            <strong>{isAdminLogin ? "Admin system" : showLoginChoice ? "Separate systems" : "Company workspace"}</strong>
            <span>
              {isAdminLogin
                ? "No candidate database access from this side."
                : showLoginChoice
                  ? "Admin manages companies. Company users work with resumes."
                  : "Your candidate database is isolated to your company."}
            </span>
          </div>
        </section>
        <section className="loginPanel">
          <ShieldCheck size={28} />
          {showLoginChoice ? (
            <>
              <h1>Sign in</h1>
              <p>Pick the correct entry point. Admin users cannot enter the recruiter app.</p>
              <div className="loginChoiceStack">
                <a className="primary actionLink loginChoice" href="/login">
                  <strong>Company Login</strong>
                  <span>Recruiters, tenant admins, resume database, matching, campaigns.</span>
                </a>
                <a className="secondary actionLink loginChoice" href="/admin/login">
                  <strong>Admin Login</strong>
                  <span>Platform owner only: create companies, seats, invitations.</span>
                </a>
              </div>
              <button className="plain" onClick={() => setInviteMode(true)} disabled={busy}>
                Accept company invite
              </button>
            </>
          ) : inviteMode ? (
            <>
              <h1>Accept Company Invite</h1>
              <p>Create your account for the company workspace.</p>
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
              <h1>{isAdminLogin ? "Admin Login" : "Company Login"}</h1>
              <p>{isAdminLogin ? "Platform owners only. This opens the admin system, not the recruiter app." : "Company users only. This opens the recruiter workspace for one tenant."}</p>
              <div className="loginModeLocked">
                <strong>{isAdminLogin ? "Admin System" : "Company Workspace"}</strong>
                <span>{isAdminLogin ? "Create companies, allocate seats, invite company owners." : "Upload resumes, search candidates, run campaigns and matching."}</span>
              </div>
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setLoginError("");
                }}
                onKeyDown={handleLoginKeyDown}
                placeholder={isAdminLogin ? "admin@example.com" : "recruiter@example.com"}
                aria-label={isAdminLogin ? "Admin email or username" : "Company email or username"}
                autoComplete="username"
              />
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginError("");
                }}
                onKeyDown={handleLoginKeyDown}
                placeholder="resume-intel"
                type="password"
                aria-label="Password"
                autoComplete="current-password"
              />
              <button className="primary" onClick={handleLogin} disabled={busy || !email.trim() || !password.trim()}>
                <LogIn size={16} /> {busy ? "Signing in..." : isAdminLogin ? "Enter Admin System" : "Enter Company Workspace"}
              </button>
              {loginError ? <div className="loginError">{loginError}</div> : null}
              {showLocalDevHelp ? <div className="loginHelpBox">
                <strong>Local dev login</strong>
                <span>{isAdminLogin ? "admin or admin@example.com / resume-intel" : "recruiter or recruiter@example.com / resume-intel"}</span>
              </div> : null}
              <a className="plain actionLink" href={isAdminLogin ? "/login" : "/admin/login"}>
                {isAdminLogin ? "Go to Company Login" : "Go to Admin Login"}
              </a>
              {isAdminLogin && showBootstrap ? <button className="plain" onClick={handleBootstrap} disabled={busy || !email.trim() || !password.trim()}>
                Create local platform admin
              </button> : null}
              {!isAdminLogin ? <button className="plain" onClick={() => setInviteMode(true)} disabled={busy}>
                Accept invite
              </button> : null}
            </>
          )}
          <div className="status">{busy ? <Loader2 className="spin" size={16} /> : null}{busy ? "Working..." : status}</div>
        </section>
      </main>
    );
  }

  if (token && !currentUser) {
    return (
      <main className="loginShell">
        <section className="landingIntro loginIntroCompact">
          <span className="eyebrow">candidatSignal.ai</span>
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
      <section className="appMain">
        {useWorkspaceTopNav ? <WorkspaceTopNav view={view} setView={setView} user={currentUser} status={status} busy={busy} logout={handleLogout} /> : null}
        {!useWorkspaceTopNav && useAdminTopBar ? <AdminShellTopBar user={currentUser} status={status} busy={busy} logout={handleLogout} /> : null}
        <section className={useWorkspaceTopNav ? "canvas withWorkspaceTopNav" : useAdminTopBar ? "canvas withShellTopBar" : "canvas"}>
          {workspaceMode === "tenant" && view === "dashboard" ? (
            <Dashboard
              candidates={candidates}
              requirements={requirements}
              campaigns={campaigns}
              clusters={clusters}
              deadLetterCount={operationalAlerts.length || parseDeadLetters.length}
              setView={setView}
              openCandidate={handleOpenCandidate}
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
            <DatabaseView candidates={filteredCandidates} query={query} setQuery={setQuery} open={handleOpenCandidate} />
          ) : null}

          {workspaceMode === "tenant" && view === "upload" ? (
            <UploadResumeView
              resumeFile={resumeFile}
              setResumeFile={setResumeFile}
              bulkFiles={bulkFiles}
              setBulkFiles={setBulkFiles}
              batchName={batchName}
              setBatchName={setBatchName}
              campaigns={campaigns}
              bulkCampaignId={bulkCampaignId}
              setBulkCampaignId={setBulkCampaignId}
              noteName={noteName}
              setNoteName={setNoteName}
              note={note}
              setNote={setNote}
              upload={handleUploadResume}
              bulkUpload={handleBulkUpload}
              batches={parseBatches}
              deadLetters={parseDeadLetters}
              workerStatus={workerStatus}
              selectedBatch={selectedBatch}
              selectBatch={handleSelectBatch}
              retryJob={handleRetryJob}
              cancelJob={handleCancelJob}
              cancelBatch={handleCancelBatch}
              openCandidate={handleOpenCandidate}
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
              <AccessDeniedPanel title="Upload queue is restricted" body="Ask a company admin to review parse jobs, worker failures, and operational alerts." />
            )
          ) : null}

          {workspaceMode === "tenant" && view === "candidate" && candidate ? (
            <CandidateDetail
              candidate={candidate}
              user={currentUser}
              token={token}
              reparseBatches={parseBatches}
              noteName={noteName}
              setNoteName={setNoteName}
              note={note}
              setNote={setNote}
              saveNote={handleAddNote}
              updateSavedNote={handleUpdateNote}
              deleteSavedNote={handleDeleteNote}
              openCandidate={handleOpenCandidate}
              reparseCandidate={handleReparseCandidate}
              canReparse={isTenantAdmin(currentUser)}
              match={() => setView("requirement")}
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
              campaigns={campaigns}
              campaign={campaign}
              campaignName={campaignName}
              setCampaignName={setCampaignName}
              campaignDescription={campaignDescription}
              setCampaignDescription={setCampaignDescription}
              campaignFiles={campaignFiles}
              setCampaignFiles={setCampaignFiles}
              createCampaign={handleCreateCampaign}
              openCampaign={handleOpenCampaign}
              matchCampaign={handleMatchCampaign}
              uploadResumes={handleUploadCampaignResumes}
              updateCandidateStatus={handleCampaignCandidateStatus}
              openCandidate={handleOpenCandidate}
              busy={busy}
            />
          ) : null}

          {workspaceMode === "tenant" && view === "versions" ? <CandidateVersionReview clusters={clusters} decide={handleEntityDecision} /> : null}

          {workspaceMode === "tenant" && view === "team" ? (
            canManageWorkspaceSettings ? (
              <TeamSettings
                members={teamMembers}
                invitations={teamInvites}
                governancePolicy={governancePolicy}
                piiAccessEvents={piiAccessEvents}
                inviteMember={handleInviteMember}
                resendInvite={handleResendInvite}
                cancelInvite={handleCancelInvite}
                updateRole={handleUpdateMemberRole}
                disableMember={handleDisableMember}
                updateGovernancePolicy={handleUpdateGovernancePolicy}
                refreshPiiAudit={handleRefreshPiiAudit}
              />
            ) : (
              <AccessDeniedPanel title="Team settings are restricted" body="Only company owners and tenant admins can invite users, change roles, or review contact-data access." />
            )
          ) : null}

          {workspaceMode === "admin" && isPlatformAdmin(currentUser) ? (
            <AdminSettings tenants={tenants} invitations={teamInvites} auditEvents={auditEvents} selectedTenant={tenantDetail} selectTenant={handleSelectTenant} createTenant={handleCreateTenant} setTenantStatus={handleTenantStatus} />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "topNavLink active" : "topNavLink"} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function AdminShellTopBar({ user, status, busy, logout }: { user: CurrentUser | null; status: string; busy: boolean; logout: () => void }) {
  return (
    <header className="shellTopBar adminShellTopBar">
      <div>
        <strong>candidatSignal.ai</strong>
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
        <button className="shellIconButton" type="button" aria-label="Open workspace home" onClick={() => setView("dashboard")}><Menu size={24} /></button>
        <strong>candidatSignal.ai</strong>
      </div>
      <nav>
        <NavButton icon={<Database size={28} />} label="Workspace" active={view === "dashboard"} onClick={() => setView("dashboard")} />
        <NavButton icon={<Search size={28} />} label="Search" active={view === "copilot" || view === "requirement" || view === "matches"} onClick={() => setView("copilot")} />
        <NavButton icon={<Rocket size={28} />} label="Campaigns" active={view === "campaigns"} onClick={() => setView("campaigns")} />
        <NavButton icon={<Users size={28} />} label="Profiles" active={view === "database" || view === "candidate"} onClick={() => setView("database")} />
      </nav>
      <div className="topNavActions">
        <button className={view === "upload" ? "shellUploadButton active" : "shellUploadButton"} type="button" onClick={() => setView("upload")}>
          <UploadCloud size={18} /> Upload
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
  function switchLogin(path: "/login" | "/admin/login") {
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
            {canManageWorkspaceSettings ? <button type="button" onClick={() => setView("operations")}><AlertTriangle size={16} /> Upload Queue</button> : null}
            <button type="button" onClick={() => setView("versions")}><GitBranch size={16} /> Candidate Versions</button>
          </div>
        ) : null}
        <div className="accountMenuActions">
          <button type="button" onClick={() => switchLogin("/login")}><LogIn size={16} /> Company Login</button>
          <button type="button" onClick={() => switchLogin("/admin/login")}><ShieldCheck size={16} /> Admin Login</button>
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
  requirements,
  campaigns,
  clusters,
  deadLetterCount,
  setView,
  openCandidate,
}: {
  candidates: CandidateSummary[];
  requirements: Requirement[];
  campaigns: JobCampaign[];
  clusters: EntityMatch[];
  deadLetterCount: number;
  setView: (view: View) => void;
  openCandidate: (id: string) => void;
}) {
  const incomplete = candidates.filter((item) => (item.coverage ?? 0) < 0.9).length;
  const duplicateCount = candidates.filter((item) => (item.duplicate_risk_score ?? 0) >= 0.75).length || clusters.filter((item) => item.status === "suggested").length;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newToday = candidates.filter((item) => item.updated_at && new Date(item.updated_at).getTime() >= dayAgo).length;
  const newThisWeek = candidates.filter((item) => item.updated_at && new Date(item.updated_at).getTime() >= weekAgo).length;
  const readyForReview = candidates.filter((item) => (item.coverage ?? 0) >= 0.8 && !(item.duplicate_risk_score && item.duplicate_risk_score >= 0.75)).length;
  const lastUpdated = candidates
    .map((item) => item.updated_at ? new Date(item.updated_at).getTime() : 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const domainCounts = topDomainCounts(candidates);
  const actionItems = [
    ...candidates
      .filter((item) => (item.duplicate_risk_score ?? 0) >= 0.75)
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} has a possible newer resume version`,
        body: `${Math.round((item.duplicate_risk_score ?? 0) * 100)}% version signal from matching identity/profile fields.`,
        action: "Review profile",
        run: () => openCandidate(item.document_id),
      })),
    ...candidates
      .filter((item) => (item.coverage ?? 0) < 0.8)
      .slice(0, 2)
      .map((item) => ({
        title: `${item.name ?? "Candidate"} needs missing profile fields`,
        body: `Coverage is ${Math.round((item.coverage ?? 0) * 100)}%. Add notes or re-upload a cleaner file if needed.`,
        action: "Open profile",
        run: () => openCandidate(item.document_id),
      })),
    ...(deadLetterCount ? [{
      title: "Some resume uploads need attention",
      body: `${deadLetterCount} upload or parsing item${deadLetterCount === 1 ? "" : "s"} require retry, replacement, or support review.`,
      action: "Open upload queue",
      run: () => setView("upload"),
    }] : []),
  ].slice(0, 5);
  const activeCampaigns = campaigns.filter((item) => item.status !== "archived").slice(0, 4);
  return (
    <section className="snapshotPage">
      <main className="snapshotMain">
        <header className="stitchHeader">
          <h2>Recruiting Snapshot</h2>
          <p>Here is what requires your attention today.</p>
        </header>
        <div className="stitchMetricGrid">
          <button className="stitchMetricCard" onClick={() => setView("database")}>
            <div><span>Resumes Added (24h)</span><b><FileUp size={20} /></b></div>
            <strong>{newToday || newThisWeek}</strong>
            <em>Updated from recent resume activity</em>
          </button>
          <button className="stitchMetricCard attention" onClick={() => setView("upload")}>
            <div><span>Needs Attention</span><b><AlertTriangle size={20} /></b></div>
            <strong>{incomplete + duplicateCount + deadLetterCount}</strong>
            <em>Profiles flagged for review</em>
          </button>
          <button className="stitchMetricCard" onClick={() => setView("database")}>
            <div><span>Ready For Review</span><b><CheckCircle2 size={20} /></b></div>
            <strong>{readyForReview}</strong>
            <em>This week</em>
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
          <h3><AlertTriangle size={22} /> Action Needed</h3>
          <span>{actionItems.length || 0} Tasks</span>
        </div>
        <div className="stitchActionList">
          {actionItems.length ? actionItems.slice(0, 3).map((item, index) => (
            <article className={index === 0 ? "urgent" : ""} key={item.title}>
              <div className="actionPerson">
                <div className="avatarDot">{item.title.slice(0, 1)}</div>
                <div>
                  <strong>{item.title.split(" has ")[0].replace(" needs missing profile fields", "")}</strong>
                  <span>{index === 0 ? "AI Flag" : "Review"}</span>
                </div>
              </div>
              <p>{item.body}</p>
              <button onClick={item.run}>{item.action}</button>
            </article>
          )) : <EmptyPanel title="No tasks" body="Profiles needing review will appear here." />}
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
  send: () => void;
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
  const queryInsights = useMemo(() => buildCopilotQueryInsights(latestQuery, latestCandidateMessage?.candidates ?? latestFilteredCandidates, latestQueryIntent), [latestQuery, latestCandidateMessage?.candidates, latestFilteredCandidates, latestQueryIntent]);
  return (
    <section className="copilotPage">
      <div className="copilotModeBar">
        <div className="copilotTabs">
          <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}><MessageSquare size={16} /> Search Copilot</button>
          <button className={activeTab === "requirement" ? "active" : ""} onClick={() => setActiveTab("requirement")}><FileSearch size={16} /> Requirement Upload</button>
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
            <button disabled={busy || !input.trim()} type="submit">✦ Generate</button>
          </form>
          <section className="stitchSignals">
            <div className="stitchSignalsHead">
              <div>
                <h3>Top Signals</h3>
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
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
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
            <div className="copilotResultList">
              {latestFilteredCandidates.map((candidate, index) => {
                const reason = copilotResultReason(candidate, latestQuery);
                const evidenceItems = (candidate.evidence ?? []).filter((item) => item.snippet).slice(0, 2);
                const breakdown = normalizedCopilotScoreBreakdown(candidate);
                const scoreItems = scoreBreakdownItems(breakdown);
                const isShortlisted = shortlistedCandidateIds.has(candidate.document_id);
                return (
                  <article className="stitchCandidateCard copilotCompactCard" key={candidate.document_id}>
                    <div className="stitchCandidateTop">
                      <div className="rankAvatar">{index + 1}</div>
                      <button onClick={() => openCandidate(candidate.document_id)}>
                        <strong>{candidate.name ?? "Unnamed candidate"}</strong>
                        <span>{candidate.current_title ?? "No title"} {candidate.current_company ? `at ${candidate.current_company}` : ""}</span>
                        <em>Current location: {candidate.location || "Not stated"}{candidate.countries?.length ? ` · Associated: ${candidate.countries.join(", ")}` : ""}</em>
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
                      <details className="copilotEvidenceDetails">
                        <summary>Evidence snippets ({evidenceItems.length})</summary>
                        {evidenceItems.map((evidence, evidenceIndex) => (
                          <div className="stitchEvidenceExtract" key={`${candidate.document_id}-${evidenceIndex}`}>
                            <strong>{evidenceSourceLabel(evidence)}</strong>
                            <p>{evidence.snippet}</p>
                          </div>
                        ))}
                      </details>
                    ) : (
                      <details className="copilotEvidenceDetails mutedEvidence">
                        <summary>No exact snippet returned</summary>
                        <p>This candidate matched the semantic/profile index. Use “Exact evidence only” for stricter results.</p>
                      </details>
                    )}
                    <div className="stitchCandidateActions">
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
              {!latestFilteredCandidates.length ? <EmptyPanel title="No generated matches yet" body="Write what you are looking for and click Generate to search the tenant database." /> : null}
            </div>
          </section>
        </section> : (
          <section className="panel copilotThread">
            <div className="panelHead">
              <h3>Requirement HITL Intake</h3>
              <span>{requirement?.status ?? "No requirement loaded"}</span>
            </div>
            <div className="requirementHITLGrid">
              <section className="requirementDrop">
                <h3>Upload requirement</h3>
                <label className="fileDrop compact">
                  <FileSearch size={22} />
                  <span>{requirementFile ? requirementFile.name : "Choose PDF, DOCX, TXT, or MD"}</span>
                  <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setRequirementFile(event.target.files?.[0] ?? null)} />
                </label>
              </section>
              <section className="requirementPaste">
                <h3>Or paste requirement</h3>
                <textarea value={requirementText} onChange={(event) => setRequirementText(event.target.value)} placeholder="Paste the job requirement, client email, JD, or hiring manager notes here." />
              </section>
            </div>
            <button className="primary" disabled={busy || (!requirementFile && !requirementText.trim())} onClick={createRequirement}>
              Extract Requirement And Ask HITL Questions
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
                    <span>Use the locked recruiter-facing controls to rank candidates. Raw extraction JSON is hidden from this workflow.</span>
                  </div>
                ) : null}
                <div className="actions">
                  <button className="secondary" onClick={finalize} disabled={busy}>Lock Final Requirement</button>
                  <button className="primary" onClick={match} disabled={busy || requirement.status !== "finalized"}>Rank Tenant Candidates</button>
                </div>
              </section>
            ) : null}
            {matches.length ? <p className="muted">{matches.length} matches created. Use Search or the match results view to review evidence, gaps, shortlist, and reject.</p> : null}
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
          <h3>Query Analysis</h3>
          <div className="queryAnalysisCard">
            <div><span>Role intent</span><strong>{queryInsights.roleIntent}</strong></div>
            <div><span>Mandatory signals</span><strong>{queryInsights.skills.length ? queryInsights.skills.join(", ") : "Not specified"}</strong></div>
            <div><span>Location signals</span><strong>{queryInsights.locations.length ? queryInsights.locations.join(", ") : "Any location"}</strong></div>
            <div><span>Current result set</span><strong>{latestFilteredCandidates.length} visible candidates</strong></div>
          </div>
          <h3>Suggested Tweaks</h3>
          <div className="guideList">
            {queryInsights.tweaks.map((tweak) => <button className="promptChip" key={tweak} onClick={() => setInput(tweak)}>{tweak}</button>)}
          </div>
          <details className="savedThreadsDrawer">
            <summary>Saved Threads ({threads.length})</summary>
            <div className="threadList">
              {threads.length ? threads.slice(0, 8).map((thread) => (
                <article className={activeThread?.id === thread.id ? "active" : ""} key={thread.id}>
                  <button onClick={() => openThread(thread.id)}>
                    <strong>{thread.title}</strong>
                    <span>{thread.message_count ?? 0} messages | {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString() : "No date"}</span>
                  </button>
                  <button className="plain tiny danger" onClick={() => archiveThread(thread.id)}>Archive</button>
                  <button className="plain tiny" onClick={() => createRequirementFromThread(thread.id)}>Make Requirement</button>
                </article>
              )) : <EmptyPanel title="No saved threads" body="Ask a Copilot question and the thread will be saved for the company workspace." />}
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}

function DatabaseView({ candidates, query, setQuery, open }: { candidates: CandidateSummary[]; query: string; setQuery: (value: string) => void; open: (id: string) => void }) {
  const [filters, setFilters] = useState<string[]>(["coverage"]);
  const readyCount = candidates.filter((candidate) => (candidate.coverage ?? 0) >= 0.8 && Number(candidate.duplicate_risk_score ?? 0) < 0.75).length;
  const needsReviewCount = candidates.filter((candidate) => (candidate.coverage ?? 0) < 0.8 || Number(candidate.duplicate_risk_score ?? 0) >= 0.75).length;
  const missingLocationCount = candidates.filter((candidate) => !candidate.location && !(candidate.countries ?? []).length).length;
  const versionSignalCount = candidates.filter((candidate) => Number(candidate.duplicate_risk_score ?? 0) >= 0.75).length;
  const countryFilters = useMemo(() => {
    const countries = new Set<string>();
    candidates.forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country)));
    return Array.from(countries).sort((left, right) => left.localeCompare(right)).slice(0, 6);
  }, [candidates]);
  const filteredCandidates = applyDatabaseFilters(candidates, filters);
  const filterOptions = [
    { id: "ai", label: "AI / GenAI" },
    { id: "experience", label: "5+ Years" },
    ...countryFilters.map((country) => ({ id: `country:${country}`, label: country })),
    { id: "seniority", label: "Lead/Senior" },
    { id: "duplicate", label: "Version Signal" },
    { id: "coverage", label: "Coverage > 80%" },
    { id: "missing_location", label: "Missing Location" },
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
          <span>Total Profiles</span>
          <strong>{candidates.length}</strong>
          <em>Company database</em>
        </article>
        <article>
          <span>Ready</span>
          <strong>{readyCount}</strong>
          <em>Good profile coverage</em>
        </article>
        <article className={needsReviewCount ? "attention" : ""}>
          <span>Needs Review</span>
          <strong>{needsReviewCount}</strong>
          <em>Missing fields or version signal</em>
        </article>
        <article className={missingLocationCount ? "attention" : ""}>
          <span>Missing Location</span>
          <strong>{missingLocationCount}</strong>
          <em>Country/location not captured</em>
        </article>
        <article>
          <span>Resume Versions</span>
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

      <CandidateTable candidates={filteredCandidates} open={open} />
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
  campaigns: JobCampaign[];
  bulkCampaignId: string;
  setBulkCampaignId: (value: string) => void;
  noteName: string;
  setNoteName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  upload: () => void;
  bulkUpload: () => void;
  batches: ParseBatch[];
  deadLetters: ParseDeadLetter[];
  workerStatus: WorkerStatus | null;
  selectedBatch: ParseBatch | null;
  selectBatch: (batch: ParseBatch) => void;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  cancelBatch: (batchId: string) => void;
  openCandidate: (id: string) => void;
  busy: boolean;
}) {
  const selectedCampaign = props.campaigns.find((item) => item.id === props.bulkCampaignId);
  const activeBatch = props.selectedBatch ?? props.batches[0] ?? null;
  const activeProgress = activeBatch ? (activeBatch.progress_percent ?? batchProgress(activeBatch)) : 0;
  return (
    <section className="uploadPage stitchUploadPage">
      <header className="stitchHeader compact">
        <h2>Bulk Resume Upload</h2>
        <p>Securely parse and add candidates to your workspace or a specific campaign.</p>
      </header>
      <label className="stitchDropZone">
        <FileUp size={34} />
        <strong>{props.bulkFiles.length ? `${props.bulkFiles.length} file${props.bulkFiles.length === 1 ? "" : "s"} selected` : "Drag and drop files here"}</strong>
        <span>Supported formats: {DOCUMENT_FORMAT_LABEL}. Scanned PDFs and image resumes use local OCR.</span>
        <b>Browse Files</b>
        <input
          type="file"
          multiple
          accept={DOCUMENT_FILE_ACCEPT}
          onChange={(event) => props.setBulkFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      <section className="stitchProgressCard">
        <div>
          <strong>Batch Parsing Progress</strong>
          <span>{Math.round(activeProgress)}%</span>
        </div>
        <ProgressBar value={activeProgress} />
        <div className="stitchBatchControls">
          <input value={props.batchName} onChange={(event) => props.setBatchName(event.target.value)} placeholder="Batch name" />
          <select value={props.bulkCampaignId} onChange={(event) => props.setBulkCampaignId(event.target.value)}>
            <option value="workspace">Unassigned (Workspace)</option>
            {props.campaigns.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <button className="primary" disabled={!props.bulkFiles.length || props.busy} onClick={props.bulkUpload}>
            {selectedCampaign ? `Queue into campaign` : "Queue resumes"}
          </button>
        </div>
        <p>{activeBatch ? `Processing ${activeBatch.completed_count + activeBatch.failed_count} of ${activeBatch.total_files} files.` : "Select resumes to create a parsing batch."}</p>
      </section>
      <section className="stitchQueueTable">
        <div className="stitchQueueHead">
          <h3>Parsing Queue</h3>
          {activeBatch ? <button className="plain danger" onClick={() => props.cancelBatch(activeBatch.id)}>Cancel batch</button> : null}
        </div>
        <div className="jobTable">
          <div className="jobRow uploadQueueRow header"><span>Filename</span><span>Campaign Assignment</span><span>Status</span><span>Action</span></div>
          {(activeBatch?.jobs ?? []).map((job) => (
            <div className="jobRow uploadQueueRow" key={job.id}>
              <span>{job.original_filename}</span>
              <span>{activeBatch?.source_type === "campaign" ? activeBatch.name : "Unassigned (Workspace)"}</span>
              <span className="queueStatusCell">
                <b className={`queueStatus ${job.status}`}>{domainLabel(job.status)}</b>
                <small>{job.stage_label ?? job.stage}{job.error_message ? ` | ${job.error_message}` : ""}</small>
              </span>
              <span className="jobActions">
                {job.document_id ? <button className="plain small" onClick={() => props.openCandidate(job.document_id!)}>View Profile</button> : null}
                <button className="plain small" disabled={!["failed", "retrying", "cancelled"].includes(job.status)} onClick={() => props.retryJob(job.id)}>Retry</button>
                <button className="plain small danger" disabled={!["queued", "retrying", "failed", "running", "processing"].includes(job.status)} onClick={() => props.cancelJob(job.id)}>Cancel</button>
              </span>
            </div>
          ))}
          {!activeBatch?.jobs?.length ? (
            <div className="emptyTableState">No files queued yet. Select resumes and click Queue resumes.</div>
          ) : null}
        </div>
      </section>
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
  const activeMaintenanceJobs = props.maintenanceJobs.filter(isActiveMaintenanceJob);
  const alertCount = props.alerts.length || props.deadLetters.length;
  return (
    <section className="operationsPage">
      <div className="pageTitle">
        <div>
          <h2>Upload Queue</h2>
          <p>Track resume batches, processing progress, failed files, retries, and cancelled uploads.</p>
        </div>
        <span className={alertCount ? "statusPill dangerPill" : "statusPill"}>
          {alertCount} open alerts
        </span>
      </div>
      <section className="panel operationsAlertPanel">
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
      <section className="panel workerStatusPanel">
        <div>
          <h3>Processing Status</h3>
          <p>{props.workerStatus?.online ? "Resume processing is online." : "Processing is offline. Queued resumes will wait."}</p>
        </div>
        <div className="workerStats">
          <Metric label="Queued" value={`${props.workerStatus?.queued_count ?? 0}`} />
          <Metric label="Running" value={`${props.workerStatus?.running_count ?? 0}`} />
          <Metric label="Failed" value={`${props.workerStatus?.failed_count ?? 0}`} />
          <Metric label="Needs Review" value={`${props.workerStatus?.dead_letter_count ?? 0}`} />
          <Metric label="Active Batches" value={`${activeBatches.length}`} />
          <Metric label="Maintenance" value={`${activeMaintenanceJobs.length}`} />
        </div>
      </section>
      <section className="panel maintenancePanel">
        <div className="panelHead">
          <div>
            <h3>Candidate Intelligence Maintenance</h3>
            <span>Recalculate deterministic fields, timeline totals, countries, coverage, and normalized analytics without OCR, LLM parsing, or embeddings.</span>
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
                    {job.status} | {job.processed_candidates}/{job.total_candidates} processed | {job.failed_candidates} failed | {job.refresh_embeddings ? "embeddings enabled" : "local only"}
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
      <section className="panel">
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
      <div className="operationsGrid">
        <section className="panel deadLetterPanel">
          <div className="panelHead">
            <div>
              <h3>Files Needing Review</h3>
              <span>Retry files that can be processed or acknowledge items that need manual replacement.</span>
            </div>
            <span className={props.deadLetters.length ? "statusPill dangerPill" : "statusPill"}>{props.deadLetters.length} open</span>
          </div>
          {props.deadLetters.length ? (
            <div className="deadLetterList">
              {props.deadLetters.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.original_filename ?? "Unknown file"}</strong>
                    <span>{item.batch_name ?? "No batch"} | attempts {item.attempt_count}/{item.max_attempts || "?"} | {formatDateTime(item.created_at)}</span>
                    <p>{item.error_message}</p>
                  </div>
                  <div className="jobActions vertical">
                    <button className="plain small" disabled={props.busy} onClick={() => props.retryJob(item.job_id)}>Retry job</button>
                    <button className="plain small danger" disabled={props.busy} onClick={() => props.resolveDeadLetter(item.id)}>Acknowledge</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No files need review" body="Files that exhaust retries will appear here with the exact file, stage, attempts, and error." />
          )}
        </section>
        <section className="panel">
          <div className="panelHead">
            <div>
              <h3>Recent Batches</h3>
              <span>Click a batch to inspect per-file progress and events.</span>
            </div>
            <span>{props.batches.length} total</span>
          </div>
          <div className="batchList operationsBatchList">
            {props.batches.length ? props.batches.slice(0, 10).map((batch) => (
              <article key={batch.id} role="button" tabIndex={0} onClick={() => props.selectBatch(batch)}>
                <strong>{batch.name}</strong>
                <span>{batch.status} | {batch.completed_count}/{batch.total_files} succeeded | {batch.failed_count} failed</span>
                <ProgressBar value={batch.progress_percent ?? batchProgress(batch)} />
              </article>
            )) : <EmptyPanel title="No parse batches" body="Single and bulk uploads will create parse batches here." />}
          </div>
        </section>
      </div>
      {props.selectedBatch ? (
        <section className="panel batchDetail">
          <div className="panelHead">
            <div>
              <h3>{props.selectedBatch.name}</h3>
              <span>{props.selectedBatch.status} | {props.selectedBatch.completed_count}/{props.selectedBatch.total_files} succeeded</span>
              <ProgressBar value={props.selectedBatch.progress_percent ?? batchProgress(props.selectedBatch)} />
            </div>
            <button className="plain danger" disabled={props.busy} onClick={() => props.cancelBatch(props.selectedBatch!.id)}>Cancel batch</button>
          </div>
          <div className="jobTable">
            <div className="jobRow header"><span>File</span><span>Status</span><span>Progress</span><span>Actions</span></div>
            {(props.selectedBatch.jobs ?? []).map((job) => (
              <div className="jobRow" key={job.id}>
                <span>{job.original_filename}</span>
                <span>{job.status}</span>
                <span>
                  <ProgressBar value={job.progress_percent ?? 0} />
                  <small>{job.stage_label ?? job.stage}{job.error_message ? ` | ${job.error_message}` : ""}</small>
                </span>
                <span className="jobActions">
                  <button className="plain small" disabled={props.busy || !["failed", "retrying", "cancelled"].includes(job.status)} onClick={() => props.retryJob(job.id)}>Retry</button>
                  <button className="plain small danger" disabled={props.busy || !["queued", "retrying", "failed", "running", "processing"].includes(job.status)} onClick={() => props.cancelJob(job.id)}>Cancel</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
        <button onClick={() => changeSort("title")}>Current Title {sortArrow(sort, "title")}</button>
        <button onClick={() => changeSort("company")}>Company {sortArrow(sort, "company")}</button>
        <button onClick={() => changeSort("years")}>Experience {sortArrow(sort, "years")}</button>
        <span>Domains</span>
        <span>Location / Country</span>
        <button onClick={() => changeSort("coverage")}>Coverage {sortArrow(sort, "coverage")}</button>
        <button onClick={() => changeSort("risk")}>Version Signal {sortArrow(sort, "risk")}</button>
        <button onClick={() => changeSort("updated")}>Updated {sortArrow(sort, "updated")}</button>
      </div>
      {!sortedCandidates.length ? (
        <div className="tableEmpty">
          <strong>No candidates match this view.</strong>
          <span>Clear filters, change the search query, or upload resumes to build the database.</span>
        </div>
      ) : null}
      {sortedCandidates.map((item) => (
        <button className="tableRow" key={item.document_id} onClick={() => open(item.document_id)}>
          <span className="truncateCell" title={item.name ?? "Unknown"}>
            {item.name ?? "Unknown"}
            <small>{item.email ?? item.phone ?? "No contact ID"}</small>
          </span>
          <span className="truncateCell" title={item.current_title ?? "Missing"}>
            {item.current_title ?? "Missing"}
            {candidateRoleFactsNeedReview(item) ? <small className="factReviewText">Role facts need review</small> : null}
          </span>
          <span className="truncateCell" title={item.current_company ?? "Missing"}>{item.current_company ?? "Missing"}</span>
          <span>{typeof item.total_years_experience === "number" ? `${item.total_years_experience} yrs` : "N/A"}<small>{item.seniority ?? "Unknown seniority"}</small></span>
          <span className="truncateCell" title={(item.top_domains ?? []).map(domainLabel).join(", ") || "Missing"}>{(item.top_domains ?? []).slice(0, 2).map(domainLabel).join(", ") || "Missing"}</span>
          <span className="truncateCell" title={[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}>{[item.location, ...(item.countries ?? [])].filter(Boolean).join(" / ") || "Missing"}</span>
          <span className="coverageCell"><i style={{ width: `${Math.round((item.coverage ?? 0) * 100)}%` }} />{item.coverage ? `${Math.round(item.coverage * 100)}%` : "N/A"}</span>
          <span>{item.duplicate_risk_score ? <b className="riskBadge">{Math.round(item.duplicate_risk_score * 100)}% {versionStatusLabel(item.duplicate_status)}</b> : "Unique"}</span>
          <span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "N/A"}</span>
        </button>
      ))}
    </div>
  );
}

type CandidateDetailTab = "overview" | "timeline" | "evidence" | "cv" | "notes" | "versions" | "debug";

function CandidateDetail({
  candidate,
  user,
  token,
  reparseBatches,
  noteName,
  setNoteName,
  note,
  setNote,
  saveNote,
  updateSavedNote,
  deleteSavedNote,
  openCandidate,
  reparseCandidate,
  canReparse,
  match,
}: {
  candidate: Candidate;
  user: CurrentUser | null;
  token: string;
  reparseBatches: ParseBatch[];
  noteName: string;
  setNoteName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  saveNote: () => void;
  updateSavedNote: (noteId: string, name: string, content: string) => void;
  deleteSavedNote: (noteId: string) => void;
  openCandidate: (id: string) => void;
  reparseCandidate: (id: string) => void;
  canReparse: boolean;
  match: () => void;
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
  const [activeTab, setActiveTab] = useState<CandidateDetailTab>("overview");
  const [showRawCvText, setShowRawCvText] = useState(false);
  const intelligence = candidate.candidate_intelligence;
  const finalProfile = intelligence?.final_candidate_profile;
  const recruiterDashboard = intelligence?.hr_intelligence?.recruiter_dashboard;
  const timeline = intelligence?.timeline ?? candidate.derived?.timeline;
  const locationIntel = candidate.derived?.location_intelligence;
  const piiIntel = candidate.derived?.pii_contact_intelligence ?? {};
  const profileVerification = candidate.derived?.profile_verification ?? {};
  const factVerification = candidate.derived?.fact_verification ?? {};
  const roleFactNeedsReview = factVerification.current_role_status && factVerification.current_role_status !== "verified";
  const timelineEvents = timeline?.timeline_events ?? [];
  const timelineRows = buildTimelineRows(timelineEvents);
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
  const latestJobLocation = textValue(locationIntel?.current_job_location) || textValue(candidate.experience?.[0]?.location);
  const resumeHeaderLocation = textValue(locationIntel?.resume_header_location) || textValue(candidate.contact?.location);
  const currentLocation = latestJobLocation;
  const coverage = candidate.primary_key_coverage;
  const verifiedFactRows = [
    candidate.name ? { label: "Name", value: candidate.name, source: "Parsed identity field", query: [candidate.name] } : null,
    candidate.contact?.email ? { label: "Email", value: candidate.contact.email, source: "Parsed contact field", query: [candidate.contact.email] } : null,
    candidate.contact?.phone ? { label: "Phone", value: candidate.contact.phone, source: "Parsed contact field", query: [candidate.contact.phone] } : null,
    piiIntel?.linkedin_urls?.length ? { label: "LinkedIn", value: piiIntel.linkedin_urls[0], source: "Deterministic PII/link extraction", query: piiIntel.linkedin_urls.slice(0, 2) } : null,
    piiIntel?.portfolio_websites?.length ? { label: "Portfolio", value: piiIntel.portfolio_websites[0], source: "Deterministic PII/link extraction", query: piiIntel.portfolio_websites.slice(0, 2) } : null,
    currentLocation ? { label: "Latest job location", value: currentLocation, source: "Latest experience location", query: [currentLocation] } : null,
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
  const reportTimeline = timelineRows.length
    ? timelineRows
    : candidate.experience.map((item, index) => ({
      id: `${item.company ?? "company"}-${item.title ?? "role"}-${index}`,
      title: item.title,
      organization: item.company,
      start_date: item.start_date,
      end_date: item.end_date,
      summary: item.bullets?.[0],
      workstreams: item.workstreams ?? [],
      crossCompanyOverlap: false,
    }));
  const timelineMarkers = timelineYearMarkers(reportTimeline);
  const verifiedSkillGroups = skillTaxonomyEntries.length
    ? skillTaxonomyEntries.map(([group, values]) => ({ group, skills: toTextList(Array.isArray(values) ? values : []) }))
    : [{ group: "Skills", skills: candidate.skills ?? [] }];
  const canViewDebug = ["tenant_owner", "tenant_admin"].includes(user?.tenant_role ?? "") || isPlatformAdmin(user);
  const candidateTabs: Array<{ id: CandidateDetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "evidence", label: "Evidence" },
    { id: "cv", label: "Original CV" },
    { id: "notes", label: "Notes" },
    { id: "versions", label: "Versions" },
    ...(canViewDebug ? [{ id: "debug" as CandidateDetailTab, label: "Debug" }] : []),
  ];
  const locationChips = candidateLocationChips(locationSignals, currentLocation);
  const primaryLinkedIn = toTextList(piiIntel.linkedin_urls ?? [])[0];
  const primaryPortfolio = toTextList(piiIntel.portfolio_websites ?? [])[0];
  const versionMatches = candidate.candidate_versions?.matches ?? candidate.entity_resolution?.matches ?? [];
  const versionCount = candidateVersionLinks(candidate, versionMatches).length;
  const reparseStatusBatch = latestCandidateReparseBatch(reparseBatches, sourceName);
  const reparseProgress = reparseStatusBatch ? Number(reparseStatusBatch.progress_percent ?? batchProgress(reparseStatusBatch)) : 0;
  const recruiterEvidenceRows = buildRecruiterEvidenceRows(verifiedFactRows, aiFitRows, evidenceMap, rawText);

  return (
    <section className="candidateReport candidateTabbedReport candidateCleanReport">
      <header className="candidateCleanHeader">
        <section className="candidateCleanIdentity">
          <div className="candidateReportAvatar">{candidateInitials(candidate.name)}</div>
          <div>
            <span className="reportLabel">Candidate Report</span>
            <h2>{candidate.name ?? "Unknown Candidate"}</h2>
            <p>
              {hr?.current_title ?? finalProfile?.summary_card?.current_or_target_title ?? "Role not extracted"}
              {hr?.current_company ? ` at ${hr.current_company}` : ""}
            </p>
            <div className="candidateReportBadges">
              <span>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)} experience</span>
              {roleFactNeedsReview ? <span className="factReviewBadge">Role facts need review</span> : <span className="factVerifiedBadge">Role facts verified</span>}
              {currentLocation ? <span className="currentLocationBadge">Latest role: {currentLocation}</span> : <span className="currentLocationBadge muted">Latest role location not stated</span>}
              <span>{versionCount ? `${versionCount} other version${versionCount === 1 ? "" : "s"}` : "No other versions"}</span>
              {reparseStatusBatch ? <span className="reparseStatusBadge">Reparse: {domainLabel(reparseStatusBatch.status)}</span> : null}
              {primaryLinkedIn ? <a href={primaryLinkedIn} target="_blank" rel="noreferrer">LinkedIn</a> : null}
              {primaryPortfolio ? <a href={primaryPortfolio} target="_blank" rel="noreferrer">Portfolio</a> : null}
            </div>
          </div>
        </section>
        <section className="candidateCleanActions">
          <button className="plain" onClick={() => setActiveTab("cv")}>View CV</button>
          <button className="plain" onClick={() => setActiveTab("notes")}>Recruiter Notes</button>
          {canReparse ? <button className="plain" onClick={() => reparseCandidate(candidate.document_id)}>Reparse CV</button> : null}
          <button className="primary" onClick={match}>Match to Role</button>
        </section>
      </header>

      <main className="candidateReportMain candidateCleanMainShell">
        <header className="candidateBriefHeader">
          <div>
            <h2>{activeTab === "overview" ? "Overview" : candidateTabs.find((tab) => tab.id === activeTab)?.label}</h2>
            <p>Clean recruiter view with facts, AI interpretation, source evidence, and notes kept separate.</p>
          </div>
          <div>
            <button className="plain" onClick={() => setActiveTab("evidence")}>Source Evidence</button>
            <button className="plain" onClick={() => setActiveTab("notes")}>Add Note</button>
          </div>
        </header>

        <nav className="candidateReportTabs" aria-label="Candidate detail sections">
          {candidateTabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" ? (
          <section className="candidateCleanLayout">
            <div className="candidateCleanPrimary">
              <article className="candidateReportHeroCard">
                <span className="reportLabel">Recruiter Summary</span>
                <p>{dashboardBullets[0] || finalProfile?.summary_card?.headline || candidate.summary || "No recruiter summary is available yet. Review the resume and add notes."}</p>
              </article>

              <section className="candidateReportTwoCol">
                <article className="briefCard">
                  <h3>Best Fit Roles</h3>
                  <div className="roleCards">{bestFitRoles.length ? bestFitRoles.slice(0, 5).map((role, index) => <span key={`${role}-${index}`}>{role}</span>) : <span>No suggested roles generated</span>}</div>
                </article>
                <article className="briefCard">
                  <h3><CheckCircle2 size={20} /> Strong Signals</h3>
                  {strengths.length ? (
                    <ul>{strengths.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  ) : <p className="muted">No strong signals generated yet.</p>}
                </article>
              </section>

              <section className="candidateReportTwoCol">
                <article className="briefCard concern">
                  <h3><AlertTriangle size={20} /> Concerns</h3>
                  {concerns.length ? (
                    <ul>{concerns.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  ) : <p className="muted">No concerns generated. Recruiter should still validate fit in screening.</p>}
                </article>
                <article className="briefCard">
                  <h3>Questions to Ask</h3>
                  {screeningQuestions.length ? (
                    <ul>{screeningQuestions.slice(0, 4).map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ul>
                  ) : <p className="muted">No screening questions generated yet.</p>}
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
            </div>

            <aside className="candidateContextRail">
              <article className="briefCard recruiterQuickNotes">
                <h3>Recruiter Notes</h3>
                <NoteTypeButtons setNoteName={setNoteName} />
                <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a quick recruiter note. It becomes searchable context." />
                <button className="secondary" onClick={saveNote} disabled={!note.trim()}>Save Note</button>
                <div className="recentNotesCompact">
                  {(candidate.notes ?? []).slice(0, 3).map((item, index) => (
                    <article key={`${item.id ?? item.created_at}-${index}`}>
                      <strong>{item.name}</strong>
                      <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Saved"}</span>
                      <p>{item.content}</p>
                      {item.id ? (
                        <div className="noteMiniActions">
                          <button className="plain small" onClick={() => {
                            setEditingNoteId(item.id ?? "");
                            setEditingNoteName(item.name);
                            setEditingNoteContent(item.content);
                            setActiveTab("notes");
                          }}>Edit</button>
                          <button className="plain small danger" onClick={() => item.id && deleteSavedNote(item.id)}>Delete</button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {!(candidate.notes ?? []).length ? <p className="muted">No recruiter notes yet.</p> : null}
                </div>
              </article>

              <article className="briefCard">
                <h3>Contact & Location</h3>
                <div className="currentLocationCallout">
                  <span>Latest role location</span>
                  <strong>{currentLocation || "Not stated in latest role"}</strong>
                  {resumeHeaderLocation && resumeHeaderLocation !== currentLocation ? <em>Resume header: {resumeHeaderLocation}</em> : null}
                </div>
                <div className="locationChipList">
                  {locationChips.length ? locationChips.map((item, index) => (
                    <span className={item.current ? "currentLocationChip" : ""} key={`${item.label}-${index}`}>{item.label}</span>
                  )) : <span>No country or location signals found</span>}
                </div>
                <div className="piiList clean">
                  <PiiGroup label="Email" values={piiIntel.emails ?? (candidate.contact?.email ? [candidate.contact.email] : [])} />
                  <PiiGroup label="Phone" values={piiIntel.phones ?? (candidate.contact?.phone ? [candidate.contact.phone] : [])} />
                  <PiiGroup label="LinkedIn" values={piiIntel.linkedin_urls ?? []} />
                  <PiiGroup label="Portfolio" values={piiIntel.portfolio_websites ?? []} />
                </div>
                <div className="profileVerificationList">
                  <div className="profileVerificationHead">
                    <strong>Application Profile Verification</strong>
                    <span>{domainLabel(profileVerification.external_verification_status ?? "not_configured")}</span>
                  </div>
                  <VerificationRow label="LinkedIn" item={profileVerification.linkedin} />
                  <VerificationRow label="Portfolio" item={profileVerification.portfolio} />
                  <VerificationRow label="GitHub" item={profileVerification.github} />
                </div>
              </article>

              <article className="briefCard">
                <h3>Quick Facts</h3>
                <div className="compactMetaList">
                  <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong></div>
                  <div><span>Experience</span><strong>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}</strong></div>
                  <div><span>Top domain</span><strong>{domainRows[0] ? domainLabel(domainRows[0].domain) : "Not found"}</strong></div>
                  <div><span>Versions</span><strong>{versionCount || "None"}</strong></div>
                </div>
              </article>
            </aside>
          </section>
        ) : null}

        {activeTab === "timeline" ? (
          <section className="candidateReportTimeline cleanTimeline">
            <div className="timelineHeader">
              <div>
                <h3>Experience Timeline</h3>
                <p>Same-company projects stay nested. Red bars only indicate true cross-company overlap.</p>
              </div>
              <div className="timelineAccounting">
                <span>Unique experience</span>
                <strong>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}</strong>
              </div>
            </div>
            {reportTimeline.length ? (
              <div className="timelineBoard">
                <div className="timelineYearAxis">
                  <span />
                  <div>
                    {timelineMarkers.map((year) => <b key={year}>{year}</b>)}
                  </div>
                </div>
                {reportTimeline.slice(0, 10).map((item: any, index: number) => (
                  <article className={item.crossCompanyOverlap ? "timelineRow crossOverlap" : "timelineRow"} key={item.id ?? index}>
                    <div className="timelineRoleLabel">
                      <strong>{item.title ?? "Role"}</strong>
                      <span>{item.organization ?? "Unknown company"}</span>
                      <em>{item.start_date ?? "Unknown"} - {item.end_date ?? "Present"}</em>
                    </div>
                    <div className="timelineTrack">
                      <i style={{ left: `${Math.max(0, Math.min(96, Number(item.left ?? 0)))}%`, width: `${Math.max(4, Math.min(100, Number(item.width ?? 100)))}%` }} />
                      {item.crossCompanyOverlap ? <b>Cross-company overlap</b> : null}
                    </div>
                    {item.summary ? <p>{item.summary}</p> : null}
                    {item.workstreams?.length ? <WorkstreamList workstreams={item.workstreams} /> : null}
                  </article>
                ))}
              </div>
            ) : <EmptyPanel title="No dated timeline extracted" body="The parser did not extract dated experience. Review the source evidence panel." />}
          </section>
        ) : null}

        {activeTab === "notes" ? (
          <section className="briefCard recruiterNotesReport polishedNotesReport" id="candidate-notes">
          <div className="notesComposerHeader">
            <div>
              <h3>Recruiter Notes</h3>
              <p>Notes are saved to the candidate profile and included in search/matching context.</p>
            </div>
            <NoteTypeButtons setNoteName={setNoteName} />
          </div>
          <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write recruiter notes. These become searchable candidate context." />
          <button className="secondary" onClick={saveNote} disabled={!note.trim()}>Save Note</button>
          <div className="notes">
            {(candidate.notes ?? []).map((item, index) => (
              <article key={`${item.created_at}-${index}`}>
                {editingNoteId === item.id ? (
                  <>
                    <input value={editingNoteName} onChange={(event) => setEditingNoteName(event.target.value)} />
                    <textarea value={editingNoteContent} onChange={(event) => setEditingNoteContent(event.target.value)} />
                    <div className="jobActions">
                      <button className="plain small" onClick={() => setEditingNoteId("")}>Cancel</button>
                      <button className="secondary small" onClick={() => {
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
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString() : "Saved"}</span>
                    {item.id ? (
                      <div className="jobActions">
                        <button className="plain small" onClick={() => {
                          setEditingNoteId(item.id ?? "");
                          setEditingNoteName(item.name);
                          setEditingNoteContent(item.content);
                        }}>Edit</button>
                        <button className="plain small danger" onClick={() => item.id && deleteSavedNote(item.id)}>Delete</button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))}
          </div>
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
            <CandidateVersionRail candidate={candidate} matches={versionMatches} openCandidate={openCandidate} />
          </section>
        ) : null}

        {canViewDebug && activeTab === "debug" ? (
          <section className="candidateTabPanel candidateDebugPanel">
            <article className="briefCard">
              <h3>Debug</h3>
              <p className="muted">Admin-only extraction, OCR, coverage, and raw JSON diagnostics.</p>
            </article>
            <section className="factsAiReportGrid">
              <article className="briefCard">
                <h3>Extraction</h3>
                <div className="claimRows">
                  <div><span>Method</span><strong>{candidate._metadata?.extraction_method ?? "Unknown"}</strong><em>Document extraction path</em></div>
                  <div><span>Pages</span><strong>{candidate._metadata?.page_count ?? candidate._metadata?.pages?.length ?? "Unknown"}</strong><em>Stored page metadata</em></div>
                  <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong><em>Current coverage calculation</em></div>
                </div>
              </article>
              <article className="briefCard">
                <h3>LLM Usage</h3>
                <div className="claimRows inference">
                  <div><span>Input tokens</span><strong>{candidate.llm_usage_totals?.input_tokens ?? 0}</strong><em>Debug only</em></div>
                  <div><span>Output tokens</span><strong>{candidate.llm_usage_totals?.output_tokens ?? 0}</strong><em>Debug only</em></div>
                  <div><span>Total tokens</span><strong>{candidate.llm_usage_totals?.total_tokens ?? 0}</strong><em>Debug only</em></div>
                </div>
              </article>
            </section>
            <details className="debugDetails">
              <summary>Primary coverage JSON</summary>
              <pre className="jsonPreview">{JSON.stringify(candidate.primary_key_coverage, null, 2)}</pre>
            </details>
            <details className="debugDetails">
              <summary>Derived profile JSON</summary>
              <pre className="jsonPreview">{JSON.stringify(candidate.derived, null, 2)}</pre>
            </details>
          </section>
        ) : null}
      </main>
    </section>
  );
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

function CandidateVersionRail({ candidate, matches, openCandidate }: { candidate: Candidate; matches: EntityMatch[]; openCandidate: (id: string) => void }) {
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

function candidateVersionLinks(candidate: Candidate, matches: EntityMatch[]) {
  const currentId = candidate.document_id;
  const rows: Array<{
    documentId: string;
    name: string;
    fileName: string;
    score: number;
    status: string;
    uploadedAt?: string | null;
    extractionMethod?: string | null;
    diffs: CandidateVersionDiff[];
  }> = [];
  const seen = new Set<string>();
  for (const match of matches ?? []) {
    const currentIsLeft = match.left_document_id === currentId;
    const currentIsRight = match.right_document_id === currentId;
    if (!currentIsLeft && !currentIsRight) continue;
    const otherId = currentIsLeft ? match.right_document_id : match.left_document_id;
    if (!otherId || seen.has(otherId)) continue;
    seen.add(otherId);
    const otherName = currentIsLeft ? match.right_name : match.left_name;
    const version = currentIsLeft ? match.right_version : match.left_version;
    rows.push({
      documentId: otherId,
      name: otherName || "Candidate version",
      fileName: version?.latest_document?.original_filename || version?.documents?.[0]?.original_filename || "Uploaded resume",
      score: Number(match.score ?? 0),
      status: match.status || "version_candidate",
      uploadedAt: version?.latest_document?.uploaded_at || version?.candidate_updated_at || version?.candidate_created_at,
      extractionMethod: version?.latest_document?.extraction_method || version?.page_methods?.[0]?.extraction_method,
      diffs: match.field_diffs ?? [],
    });
  }
  return rows.sort((left, right) => right.score - left.score);
}

function candidateVersionDocumentLabel(candidate: Candidate) {
  return candidate.original_filename || candidate.source_file?.split("/").pop() || "Uploaded resume";
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

function CoverageSummary({ coverage }: { coverage?: Candidate["primary_key_coverage"] }) {
  if (!coverage) {
    return (
      <section className="reportSideSection coverageSummary">
        <span className="reportLabel">Profile Completeness</span>
        <p className="muted">Coverage not calculated for this profile yet.</p>
      </section>
    );
  }
  const missingItems = (coverage.items ?? []).filter((item) => item.status === "missing");
  const criticalMissing = missingItems.filter((item) => item.severity === "critical");
  const enrichmentMissing = missingItems.filter((item) => item.severity !== "critical");
  return (
    <section className="reportSideSection coverageSummary">
      <div className="coverageSummaryHead">
        <span className="reportLabel">Profile Completeness</span>
        <strong>{Math.round((coverage.score ?? 0) * 100)}%</strong>
      </div>
      <ProgressBar value={(coverage.score ?? 0) * 100} />
      <div className="coverageCategoryList">
        {(coverage.categories ?? []).map((category) => (
          <article className={category.status === "critical_missing" ? "critical" : category.status === "needs_enrichment" ? "warn" : "complete"} key={category.key}>
            <div>
              <strong>{category.label}</strong>
              <span>{category.present}/{category.total}</span>
            </div>
            <ProgressBar value={(category.score ?? 0) * 100} />
          </article>
        ))}
      </div>
      {criticalMissing.length ? (
        <div className="coverageMissingBlock critical">
          <strong>Critical missing</strong>
          {criticalMissing.slice(0, 5).map((item) => <span key={item.key}>{item.label}</span>)}
        </div>
      ) : <div className="coverageMissingBlock complete"><strong>Critical fields complete</strong></div>}
      {enrichmentMissing.length ? (
        <div className="coverageMissingBlock">
          <strong>Enrichment gaps</strong>
          {enrichmentMissing.slice(0, 6).map((item) => <span key={item.key}>{item.label}</span>)}
        </div>
      ) : null}
    </section>
  );
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
          <h2>Intake New Requirement</h2>
          <p>Extract the job profile, answer clarifying questions, lock the final requirement, then rank candidates.</p>
        </div>
      </div>
      <div className="intakeMethods">
        <label className={inputMode === "file" ? "intakeMethod active" : "intakeMethod"}>
          <FileUp size={28} />
          <strong>Upload PDF Requirement</strong>
          <p>Upload a standard job description document. The system extracts entities automatically.</p>
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
        <label>Raw Requirement Text</label>
        <textarea value={props.requirementText} onChange={(event) => props.setRequirementText(event.target.value)} placeholder="Paste job description here..." />
        <button className="plain" disabled={!props.requirementText.trim() && !props.requirementFile} onClick={props.createRequirement}>Extract Entities</button>
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
        <h3><ShieldCheck size={20} /> System Clarification Questions</h3>
        <p>Based on the provided requirement, clarify ambiguous parameters before ranking candidates.</p>
        {props.requirement ? (
          <>
            <div className="requirementLifecycle">
              <span className={props.requirement.status === "draft" ? "active" : ""}>1. Extracted</span>
              <span className={props.requirement.status === "finalized" ? "active" : ""}>2. Finalized</span>
              <span className={props.requirement.status === "matched" ? "active" : ""}>3. Ranked</span>
            </div>
            <section className="requirementSummary">
              <Metric label="Title" value={props.requirement.title ?? "Untitled"} />
              <Metric label="Minimum Years" value={`${activeProfile?.min_years_experience ?? "Not set"}`} />
              <Metric label="Must-Haves" value={`${(activeProfile?.must_have_skills ?? []).length}`} />
              <Metric label="Locations" value={`${(activeProfile?.required_locations ?? []).length + (activeProfile?.required_countries ?? []).length}`} />
            </section>
            <section className="structuredClarification">
              <div className="cardTitle"><h3>Structured Match Controls</h3><span>These fields directly affect ranking</span></div>
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
                <div className="cardTitle"><h3>System Open Questions</h3><span>Additional recruiter context</span></div>
                {(props.requirement.clarification_questions ?? []).map((question) => (
                  <label className="question" key={question}>
                    <span>{question}</span>
                    <input disabled={locked} value={props.clarifyAnswers[question] ?? props.requirement?.recruiter_answers?.[question] ?? ""} onChange={(event) => updateAnswer(question, event.target.value)} />
                  </label>
                ))}
              </section>
            ) : null}
            <div className="actions">
              <button className="secondary" disabled={locked} onClick={props.finalize}>Lock finalized profile</button>
              <button className="primary" disabled={!locked} onClick={props.match}>Rank candidates</button>
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
    help: "Non-negotiable capabilities. Missing hits become hard-filter failures.",
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
    help: "Used as a hard requirement and years-fit score.",
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
  const matchedRequirements = requirements.filter((item) => item.status === "matched");
  const filteredMatches = matches.filter((item) => matchFilterHit(item, filter));
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
          <h2>Ranked Matches</h2>
          <p>{requirement ? `Requirement: ${requirement.title ?? "Untitled requirement"}` : "Select or create a finalized requirement to rank candidates."}</p>
        </div>
        <span>{filteredMatches.length}/{matches.length} candidates shown</span>
      </div>
      {!matches.length ? (
        <section className="panel emptyState">
          <h3>No match run loaded</h3>
          <p>Create a requirement, answer clarification questions, lock the final profile, then run matching to rank candidates.</p>
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
                <strong>Run #{run.run_number}</strong>
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
                <strong>Hard filter failures</strong>
                {(item.evidence.hard_filter_failures ?? []).map((failure: string, failureIndex: number) => <span key={`${failure}-${failureIndex}`}>{failure}</span>)}
              </div>
            ) : <div className="hardFilterPass">Hard filters passed</div>}
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
  campaigns,
  campaign,
  campaignName,
  setCampaignName,
  campaignDescription,
  setCampaignDescription,
  campaignFiles,
  setCampaignFiles,
  createCampaign,
  openCampaign,
  matchCampaign,
  uploadResumes,
  updateCandidateStatus,
  openCandidate,
  busy,
}: {
  campaigns: JobCampaign[];
  campaign: JobCampaign | null;
  campaignName: string;
  setCampaignName: (value: string) => void;
  campaignDescription: string;
  setCampaignDescription: (value: string) => void;
  campaignFiles: File[];
  setCampaignFiles: (files: File[]) => void;
  createCampaign: () => void;
  openCampaign: (id: string) => void;
  matchCampaign: (id?: string) => void;
  uploadResumes: () => void;
  updateCandidateStatus: (candidateId: string, status: "recommended" | "shortlisted" | "rejected") => void;
  openCandidate: (id: string) => void;
  busy: boolean;
}) {
  const activeCampaign = campaign ?? campaigns[0] ?? null;
  const selectedCandidates = useMemo(() => activeCampaign?.candidates ?? [], [activeCampaign?.candidates]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [autoOpenedCampaignId, setAutoOpenedCampaignId] = useState("");
  const recommendedCandidates = selectedCandidates.filter((item) => !["shortlisted", "rejected", "reviewing"].includes(item.status));
  const reviewingCandidates = selectedCandidates.filter((item) => item.status === "reviewing");
  const shortlistedCandidates = selectedCandidates.filter((item) => item.status === "shortlisted");
  const shortlisted = shortlistedCandidates.length;
  const rejected = selectedCandidates.filter((item) => item.status === "rejected").length;
  const selectedCampaignCandidate = selectedCandidates.find((item) => item.candidate_id === selectedCandidateId) ?? selectedCandidates[0];
  const campaignProgress = campaignProgressStats(activeCampaign, selectedCandidates);
  const campaignTimeline = useMemo(() => campaignTimelineItems(activeCampaign, selectedCandidates), [activeCampaign, selectedCandidates]);

  useEffect(() => {
    if (!selectedCandidates.length) {
      setSelectedCandidateId("");
      return;
    }
    if (!selectedCandidates.some((item) => item.candidate_id === selectedCandidateId)) {
      setSelectedCandidateId(selectedCandidates[0].candidate_id);
    }
  }, [selectedCandidates, selectedCandidateId]);

  useEffect(() => {
    const firstCampaignId = campaigns[0]?.id;
    if (!campaign && firstCampaignId && autoOpenedCampaignId !== firstCampaignId) {
      setAutoOpenedCampaignId(firstCampaignId);
      openCampaign(firstCampaignId);
    }
  }, [autoOpenedCampaignId, campaign, campaigns, openCampaign]);

  return (
    <section className="campaignPage">
      <div className={activeCampaign ? "pageTitle campaignFocusTitle" : "pageTitle"}>
        <div>
          {activeCampaign ? <span className="eyebrow">Active campaign <i /></span> : null}
          <h2>{activeCampaign?.name ?? "Job Campaigns"}</h2>
          <p>{activeCampaign?.description || "Start a hiring campaign, rank existing candidates, and upload new resumes into the same campaign and database."}</p>
        </div>
        {activeCampaign ? (
          <div className="campaignHeaderActions">
            <button className="secondary" onClick={() => activeCampaign && matchCampaign(activeCampaign.id)} disabled={busy || !activeCampaign.requirement_id}>Find Matches</button>
            <label className="primary uploadMini">
              Source More
              <input type="file" multiple accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setCampaignFiles(Array.from(event.target.files ?? []))} />
            </label>
            <button className="plain" onClick={uploadResumes} disabled={busy || !campaignFiles.length}>Queue {campaignFiles.length || ""} resume{campaignFiles.length === 1 ? "" : "s"}</button>
          </div>
        ) : <span>{campaigns.length} active workflows</span>}
      </div>
      {!activeCampaign ? <div className="campaignGrid">
        <section className="panel campaignComposer">
          <div className="panelHead"><h3>Start Campaign</h3><span>Requirement + matching workflow</span></div>
          <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name" />
          <textarea value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} placeholder="Paste role description, hiring-manager note, or portfolio requirement..." />
          <button className="primary" onClick={createCampaign} disabled={busy || !campaignName.trim()}>Create campaign profile</button>
          <p className="muted">Creating a campaign also creates a requirement profile when description text is provided.</p>
        </section>
        <section className="panel campaignList">
          <div className="panelHead"><h3>Campaign Queue</h3><span>{campaigns.length}</span></div>
          {campaigns.map((item) => (
            <button className={campaign?.id === item.id ? "historyItem active" : "historyItem"} key={item.id} onClick={() => openCampaign(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.status} | {item.candidate_count} candidates | {item.upload_batch_count} upload batches</span>
            </button>
          ))}
          {!campaigns.length ? <EmptyPanel title="No campaigns yet" body="Create a job campaign from a requirement or hiring-manager brief." /> : null}
        </section>
      </div> : null}
      {activeCampaign ? (
        <section className="campaignSwitcher">
          <div>
            {campaigns.slice(0, 6).map((item) => (
              <button className={activeCampaign.id === item.id ? "active" : ""} key={item.id} onClick={() => openCampaign(item.id)}>
                {item.name}
              </button>
            ))}
          </div>
          <details>
            <summary>New campaign</summary>
            <div className="campaignQuickCreate">
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name" />
              <textarea value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} placeholder="Paste requirement or hiring-manager note..." />
              <button className="primary" onClick={createCampaign} disabled={busy || !campaignName.trim()}>Create campaign</button>
            </div>
          </details>
        </section>
      ) : null}

      {activeCampaign ? (
        <section className="panel campaignDetail">
          <div className="campaignHero">
            <div>
              <span className="eyebrow">Active campaign</span>
              <h3>{activeCampaign.name}</h3>
              <p>{activeCampaign.description || "No description stored."}</p>
            </div>
            <div className="campaignActions">
              <button className="secondary" onClick={() => matchCampaign(activeCampaign.id)} disabled={busy || !activeCampaign.requirement_id}>Find best-fit candidates</button>
              <label className="plain uploadMini">
                Add resumes
                <input type="file" multiple accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setCampaignFiles(Array.from(event.target.files ?? []))} />
              </label>
              <button className="plain" onClick={uploadResumes} disabled={busy || !campaignFiles.length}>Queue {campaignFiles.length || ""} resume{campaignFiles.length === 1 ? "" : "s"}</button>
            </div>
          </div>
          <details className="campaignMetaDetails">
            <summary>Campaign activity</summary>
            <div className="metricGrid">
              <Metric label="Candidates" value={String(selectedCandidates.length)} />
              <Metric label="Shortlisted" value={String(shortlisted)} />
              <Metric label="Rejected" value={String(rejected)} />
              <Metric label="Requirement" value={activeCampaign.requirement_status ?? "Not linked"} />
            </div>
            {activeCampaign.upload_batches?.length ? (
              <div className="campaignBatches">
                <strong>Campaign upload history</strong>
                {activeCampaign.upload_batches.map((batch) => (
                  <article key={batch.id}>
                    <div>
                      <span>{batch.name}</span>
                      <em>{batch.status} | {batch.completed_count}/{batch.total_files} completed, {batch.failed_count} failed | {formatDateTime(batch.updated_at)}</em>
                    </div>
                    <ProgressBar value={batch.total_files ? Math.round((batch.completed_count / batch.total_files) * 100) : 0} />
                  </article>
                ))}
              </div>
            ) : null}
          </details>
          <section className="campaignProgressPanel">
            <div className="campaignProgressHead">
              <div>
                <span className="eyebrow">Campaign Progress</span>
                <h3>{campaignProgress.label}</h3>
                <p>{campaignProgress.description}</p>
              </div>
              <strong>{campaignProgress.percent}%</strong>
            </div>
            <ProgressBar value={campaignProgress.percent} />
            <div className="campaignStageList">
              {campaignProgress.stages.map((stage) => (
                <article className={stage.done ? "done" : stage.active ? "active" : ""} key={stage.label}>
                  <span>{stage.label}</span>
                  <strong>{stage.value}</strong>
                </article>
              ))}
            </div>
          </section>
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
          {selectedCandidates.length ? (
            <div className="campaignBoardShell">
              <div className="campaignBoard">
                <CampaignColumn
                  title="Recommended"
                  count={recommendedCandidates.length}
                  candidates={recommendedCandidates}
                  selectedId={selectedCampaignCandidate?.candidate_id}
                  selectCandidate={setSelectedCandidateId}
                />
                <CampaignColumn
                  title="Reviewing"
                  count={reviewingCandidates.length}
                  candidates={reviewingCandidates}
                  selectedId={selectedCampaignCandidate?.candidate_id}
                  selectCandidate={setSelectedCandidateId}
                />
                <CampaignColumn
                  title="Shortlisted"
                  count={shortlistedCandidates.length}
                  candidates={shortlistedCandidates}
                  selectedId={selectedCampaignCandidate?.candidate_id}
                  selectCandidate={setSelectedCandidateId}
                />
              </div>
              <aside className="campaignCandidatePanel">
                {selectedCampaignCandidate ? (
                  <>
                    <span className="eyebrow">Selected candidate</span>
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
                        <strong>Hard filters need review</strong>
                        {campaignHardFilterFailures(selectedCampaignCandidate).slice(0, 3).map((failure, failureIndex) => <span key={`${failure}-${failureIndex}`}>{failure}</span>)}
                      </div>
                    ) : <div className="campaignHardFilterPass">Hard filters passed</div>}
                    <strong className="campaignPanelSubhead">Why this candidate</strong>
                    <div className="campaignEvidence">
                      {campaignReasonItems(selectedCampaignCandidate).slice(0, 5).map((reason, reasonIndex) => <span key={`${selectedCampaignCandidate.candidate_id}-side-${reasonIndex}`}>{reason}</span>)}
                    </div>
                    {campaignGapItems(selectedCampaignCandidate).length ? (
                      <div className="campaignGaps">
                        {campaignGapItems(selectedCampaignCandidate).slice(0, 5).map((gap, gapIndex) => <span key={`${gap}-${gapIndex}`}>{gap}</span>)}
                      </div>
                    ) : null}
                    <div className="draftBox">
                      <strong>Draft reachout angle</strong>
                      <span>{selectedCampaignCandidate.evidence?.recommendation ?? "Open the candidate report to tailor outreach from resume evidence and recruiter notes."}</span>
                    </div>
                    <div className="jobActions">
                      <button className="plain small" onClick={() => openCandidate(selectedCampaignCandidate.candidate_id)}>Open report</button>
                      <button className="secondary small" onClick={() => updateCandidateStatus(selectedCampaignCandidate.candidate_id, "shortlisted")} disabled={selectedCampaignCandidate.status === "shortlisted"}>Shortlist</button>
                      <button className="plain small danger" onClick={() => updateCandidateStatus(selectedCampaignCandidate.candidate_id, "rejected")} disabled={selectedCampaignCandidate.status === "rejected"}>Reject</button>
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          ) : <EmptyPanel title="No campaign candidates yet" body="Run matching to rank the existing database, or upload resumes directly into this campaign." />}
        </section>
      ) : (
        <section className="panel emptyState">
          <h3>Select a campaign</h3>
          <p>Open a campaign to see ranked candidates, uploaded resume batches, shortlist/reject state, and evidence.</p>
        </section>
      )}
    </section>
  );
}

function CampaignColumn({
  title,
  count,
  candidates,
  selectedId,
  selectCandidate,
}: {
  title: string;
  count: number;
  candidates: JobCampaignCandidate[];
  selectedId?: string;
  selectCandidate: (candidateId: string) => void;
}) {
  return (
    <section className="campaignColumn">
      <div className="campaignColumnHead"><strong>{title}</strong><span>{count}</span></div>
      {candidates.length ? candidates.map((item) => (
        <button className={selectedId === item.candidate_id ? "campaignMiniCard active" : "campaignMiniCard"} key={item.candidate_id} onClick={() => selectCandidate(item.candidate_id)}>
          <strong>{item.candidate?.name ?? item.candidate_id}</strong>
          <span>{item.candidate?.current_title ?? "No title"} | {item.candidate?.current_company ?? "No company"}</span>
          {item.candidate && candidateRoleFactsNeedReview(item.candidate) ? <span className="factReviewText">Role facts need review</span> : null}
          <em>{Math.round((item.score ?? 0) * 100)}% match | {domainLabel(item.source)}</em>
        </button>
      )) : <div className="campaignColumnEmpty">No candidates</div>}
    </section>
  );
}

function campaignEvidenceItems(item: JobCampaignCandidate) {
  return [
    ...toTextList(item.evidence?.top_reasons),
    ...toTextList(item.evidence?.evidence?.must_have_hits),
    ...toTextList(item.evidence?.evidence?.nice_to_have_hits),
  ].filter(Boolean);
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
  const explicit = toTextList(item.evidence?.top_gaps);
  if (explicit.length) return explicit;
  return Object.entries(item.evidence?.gaps ?? {}).flatMap(([key, value]) => gapItems(key, value));
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
    if (item.status === "shortlisted" || item.status === "rejected") {
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

function CandidateVersionReview({ clusters, decide }: { clusters: EntityMatch[]; decide: (id: string, decision: "versioned" | "separate" | "review-later") => void }) {
  const [filter, setFilter] = useState<ResolutionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(clusters[0]?.id);
  const filteredClusters = clusters.filter((cluster) => filter === "all" || (cluster.status ?? "suggested") === filter);
  const selected = filteredClusters.find((cluster) => cluster.id === selectedId) ?? filteredClusters[0];
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
            <span>{Math.round(item.score * 100)}% Version signal</span>
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
              </div>
              <div className="actions">
                <button className="plain" onClick={() => selected.id && decide(selected.id, "review-later")}>Review Later</button>
                <button className="plain" onClick={() => selected.id && decide(selected.id, "separate")}>Keep Separate</button>
                <button className="primary" onClick={() => selected.id && decide(selected.id, "versioned")}>Mark as Versions</button>
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
                {entityCompareRows(selected).map((row) => (
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

function VersionMetadataCard({ label, version }: { label: string; version?: EntityMatch["left_version"] }) {
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
  governancePolicy,
  piiAccessEvents,
  inviteMember,
  resendInvite,
  cancelInvite,
  updateRole,
  disableMember,
  updateGovernancePolicy,
  refreshPiiAudit,
}: {
  members: TeamMember[];
  invitations: TenantInvitation[];
  governancePolicy: GovernancePolicy | null;
  piiAccessEvents: PiiAccessEvent[];
  inviteMember: (email: string, role: string) => void;
  resendInvite: (invitationId: string) => void;
  cancelInvite: (invitationId: string) => void;
  updateRole: (membershipId: string, role: string) => void;
  disableMember: (membershipId: string) => void;
  updateGovernancePolicy: (policy: Partial<GovernancePolicy>) => void;
  refreshPiiAudit: () => void;
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
          <strong>candidatSignal.ai</strong>
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
                    <strong>Enable External LLM Processing</strong>
                    <small>Allow sanitized, non-PII candidate data to be processed by third-party LLM providers for advanced matching.</small>
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
                <p>Invite company users and manage roles without exposing this workspace to platform admins.</p>
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
          <p>Monitor company health, seat utilization, pending invites, and workspace access. Candidate data stays inside each company workspace.</p>
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
          <p>Platform-admin governance view. Recruiter workspace access belongs only to invited company users.</p>
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
          rows={[[`${detail.tenant.candidate_count ?? 0} candidate records`, "Profile details hidden", "Company users access recruiter records"]]}
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

function Tab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "tab active" : "tab"} onClick={onClick}>{icon}{label}</button>;
}

function MetricCard({ label, value, action }: { label: string; value: string; action: () => void }) {
  return <button className="metricCard" onClick={action}><span>{label}</span><strong>{value}</strong></button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
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

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="designedEmpty">
      <strong>{title}</strong>
      <span>{body}</span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function FieldEvidence({ source, snippet, compact = false }: { source: string; snippet?: string; compact?: boolean }) {
  return (
    <div className={compact ? "fieldEvidence compact" : "fieldEvidence"}>
      <small>Source: {source}</small>
      {snippet ? <q>{snippet}</q> : <em>Raw CV snippet not found for this field.</em>}
    </div>
  );
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
  return candidates.filter((candidate) => {
    if (filters.includes("ai") && !(candidate.top_domains ?? []).some((domain) => /ai|gen|llm|conversation/i.test(domain))) return false;
    if (filters.includes("experience") && Number(candidate.total_years_experience ?? 0) < 5) return false;
    if (selectedCountries.length && !selectedCountries.some((country) => (candidate.countries ?? []).includes(country))) return false;
    if (filters.includes("seniority") && !/lead|senior|principal|staff/i.test(candidate.seniority ?? `${candidate.current_title ?? ""}`)) return false;
    if (filters.includes("duplicate") && Number(candidate.duplicate_risk_score ?? 0) < 0.75) return false;
    if (filters.includes("coverage") && Number(candidate.coverage ?? 0) <= 0.8) return false;
    if (filters.includes("missing_location") && candidate.location) return false;
    return true;
  });
}

function filterCopilotCandidates(candidates: CandidateSummary[], filters: CopilotFilters, query: string) {
  const queryTerms = significantTerms(query);
  const filtered = candidates.filter((candidate) => {
    if (Number(candidate.semantic_score ?? 0) < filters.minScore) return false;
    if (filters.country !== "all" && !(candidate.countries ?? []).includes(filters.country)) return false;
    if (filters.seniority === "senior" && !/senior|lead|principal|staff|founding/i.test(`${candidate.seniority ?? ""} ${candidate.current_title ?? ""}`)) return false;
    if (filters.exactEvidenceOnly && queryTerms.length && !candidateHasEvidenceTerm(candidate, queryTerms)) return false;
    return true;
  });
  return filtered.sort((left, right) => {
    if (filters.sort === "recency") {
      return new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime();
    }
    return Number(right.semantic_score ?? 0) - Number(left.semantic_score ?? 0);
  });
}

function copilotResultReason(candidate: CandidateSummary, query: string) {
  const queryTerms = significantTerms(query);
  const evidenceText = (candidate.evidence ?? [])
    .map((item) => `${item.source_label ?? ""} ${item.chunk_type ?? ""} ${item.snippet ?? ""}`)
    .join(" ")
    .toLowerCase();
  const evidenceHits = queryTerms
    .filter((term) => term.length >= 3 && evidenceText.includes(term.toLowerCase()))
    .slice(0, 5);
  if (evidenceHits.length) return `Direct resume/search evidence includes: ${Array.from(new Set(evidenceHits)).join(", ")}.`;
  if ((candidate.top_domains ?? []).length) return `Profile domains matched the search: ${(candidate.top_domains ?? []).slice(0, 2).map(domainLabel).join(", ")}.`;
  if (Number(candidate.semantic_score ?? 0) > 0) return "Semantic search matched the candidate profile, raw resume text, or recruiter notes.";
  return "Candidate is visible after the current Copilot filters.";
}

function normalizeCopilotQueryIntent(raw: unknown, query: string): CopilotQueryIntent {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const fallback = clientCopilotQueryIntent(query);
  const roles = arrayOfText(item.roles);
  const locations = arrayOfText(item.locations);
  const terms = arrayOfText(item.terms);
  const locationRequirement = textValue(item.location_requirement) || fallback.location_requirement;
  return {
    role_intent: textValue(item.role_intent) || fallback.role_intent,
    roles: roles.length ? roles : fallback.roles,
    locations: locations.length ? locations : fallback.locations,
    location_requirement: ["preferred", "required", "ignored"].includes(locationRequirement) ? locationRequirement : "preferred",
    terms: terms.length ? terms : fallback.terms,
  };
}

function clientCopilotQueryIntent(query: string): CopilotQueryIntent {
  const normalized = query.toLowerCase();
  const rolePatterns: Array<[RegExp, string]> = [
    [/data\s+engineer|etl|spark|databricks|pipeline/, "Data Engineering"],
    [/\bai\b|genai|llm|rag|langchain|machine learning|ml engineer/, "AI / ML"],
    [/cloud|azure|aws|gcp|architect/, "Cloud Architecture"],
    [/analytics|bi|tableau|power bi|looker/, "Analytics / BI"],
    [/security|identity|iam|oauth|governance/, "Security / Identity"],
  ];
  const locationPatterns: Array<[RegExp, string]> = [
    [/new\s+york|nyc|\bny\b/, "New York"],
    [/columbus|ohio|\boh\b/, "Columbus, OH"],
    [/san\s+francisco|bay area|\bsf\b/, "San Francisco"],
    [/seattle/, "Seattle"],
    [/austin/, "Austin"],
    [/boston/, "Boston"],
    [/india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune/, "India"],
    [/remote/, "Remote"],
  ];
  const roles = rolePatterns.filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
  const locations = locationPatterns.filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
  const location_requirement = /ignore location|any location|location flexible|remote ok|location optional/.test(normalized)
    ? "ignored"
    : /must|required|strict|only|mandatory|onsite|local/.test(normalized)
      ? "required"
      : "preferred";
  return {
    role_intent: roles[0] || "Open candidate search",
    roles,
    locations,
    location_requirement,
    terms: significantTerms(query),
  };
}

function arrayOfText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => textValue(item)).filter(Boolean);
}

function locationRequirementLabel(value: string) {
  if (value === "required") return "Required hard filter";
  if (value === "ignored") return "Ignored";
  return "Preferred scoring signal";
}

function rewriteCopilotLocationPreference(query: string, mode: "preferred" | "required" | "ignored") {
  const base = query
    .replace(/\((location required|location preferred|ignore location)\)/gi, "")
    .replace(/\b(location required|location preferred|ignore location|required location|preferred location)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const suffix = mode === "required" ? "location required" : mode === "ignored" ? "ignore location" : "location preferred";
  return `${base || "Find candidates"} (${suffix})`;
}

function normalizedCopilotScoreBreakdown(candidate: CandidateSummary) {
  const breakdown = candidate.copilot_score_breakdown ?? {};
  const total = Number(breakdown.total_score ?? candidate.semantic_score ?? 0);
  return {
    total_score: Number.isFinite(total) ? total : 0,
    role_score: Number(breakdown.role_score ?? 0),
    evidence_score: Number(breakdown.evidence_score ?? 0),
    years_score: Number(breakdown.years_score ?? 0),
    location_score: Number(breakdown.location_score ?? 0),
    semantic_score: Number(breakdown.semantic_score ?? candidate.semantic_score ?? 0),
    location_reason: breakdown.location_reason,
  };
}

function scoreBreakdownItems(breakdown: ReturnType<typeof normalizedCopilotScoreBreakdown>) {
  return [
    { label: "Role", value: percentScore(breakdown.role_score) },
    { label: "Evidence", value: percentScore(breakdown.evidence_score) },
    { label: "Years", value: percentScore(breakdown.years_score) },
    { label: "Location", value: percentScore(breakdown.location_score) },
  ];
}

function percentScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
}

function buildCopilotQueryInsights(query: string, candidates: CandidateSummary[], intent: CopilotQueryIntent) {
  const terms = significantTerms(query);
  const knownSkills = [
    "ai",
    "genai",
    "rag",
    "llm",
    "langchain",
    "azure",
    "aws",
    "gcp",
    "spark",
    "databricks",
    "python",
    "analytics",
    "healthcare",
    "salesforce",
    "postgres",
    "m365",
    "security",
  ];
  const skills = knownSkills.filter((skill) => terms.some((term) => term.toLowerCase() === skill || term.toLowerCase().includes(skill))).slice(0, 8);
  const locationTerms = ["new york", "nyc", "columbus", "ohio", "united states", "usa", "us", "india", "canada", "remote", "hybrid", "onsite", "europe", "uk"];
  const normalizedQuery = query.toLowerCase();
  const locations = locationTerms.filter((item) => normalizedQuery.includes(item)).map((item) => {
    if (item === "usa" || item === "us") return "United States";
    if (item === "nyc") return "New York";
    return domainLabel(item);
  });
  const seniority = /founding|principal|staff|lead|senior|architect|manager|director/i.exec(query)?.[0];
  const roleTerms = terms.filter((term) => /engineer|architect|developer|scientist|analyst|manager|consultant|recruiter|designer|product|data|ai/i.test(term)).slice(0, 5);
  const roleIntent = intent.role_intent || [seniority, ...roleTerms].filter(Boolean).join(" ") || "Open candidate search";
  const strongestCompany = candidates
    .map((candidate) => candidate.current_company)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const tweaks = [
    skills.length ? `Show strongest evidence for ${skills.slice(0, 3).join(", ")} and separate must-have from nice-to-have.` : "Ask me clarifying questions before ranking these candidates.",
    (intent.locations.length || locations.length) ? `Treat ${[...intent.locations, ...locations].slice(0, 3).join(" or ")} as preferred unless you explicitly mark it required.` : "Add location, timezone, or work authorization preferences.",
    "Sort this result by recency and recruiter notes relevance.",
    strongestCompany ? `Compare candidates with similar company exposure to ${strongestCompany}.` : "Turn this search into a requirement draft.",
  ];
  return {
    roleIntent: roleIntent.replace(/\s+/g, " ").trim(),
    skills: Array.from(new Set(skills.map(domainLabel))),
    locations: Array.from(new Set([...intent.locations, ...locations])),
    tweaks,
  };
}

function copilotThreadMessages(thread: CopilotThread): WorkspaceChatMessage[] {
  const messages = (thread.messages ?? []).map((message) => ({
    role: message.role,
    content: message.content,
    query: message.query ?? undefined,
    candidates: message.candidates ?? undefined,
    clarifying_questions: message.clarifying_questions ?? undefined,
    suggested_actions: message.suggested_actions ?? undefined,
    metadata: message.metadata ?? undefined,
  }));
  return messages.length ? messages : [COPILOT_GREETING];
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

function domainEvidenceTerms(domain: string) {
  const aliases: Record<string, string[]> = {
    generative_ai: ["generative ai", "genai", "llm", "rag", "langchain", "langgraph", "openai"],
    conversational_ai: ["chatbot", "assistant", "bot", "dialogflow", "copilot"],
    data_engineering: ["data engineering", "etl", "spark", "databricks", "pipeline"],
    cloud_architecture: ["azure", "aws", "gcp", "cloud", "microservices"],
    analytics_bi: ["analytics", "tableau", "power bi", "looker", "reporting"],
    security_identity: ["security", "identity", "oauth", "rbac", "governance"],
    microsoft_365: ["microsoft 365", "m365", "sharepoint", "teams", "outlook"],
  };
  return aliases[domain] ?? [domain.replaceAll("_", " ")];
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

function entityCompareRows(match: EntityMatch) {
  if (match.field_diffs?.length) {
    return match.field_diffs.map((row) => ({
      label: row.label,
      left: row.left,
      right: row.right,
      status: row.status,
      detail: row.detail,
    }));
  }
  const left = match.left_profile ?? {};
  const right = match.right_profile ?? {};
  return [
    { label: "Email", left: left.email, right: right.email, status: undefined, detail: undefined },
    { label: "Phone", left: left.phone, right: right.phone, status: undefined, detail: undefined },
    { label: "Current title", left: left.current_title, right: right.current_title, status: undefined, detail: undefined },
    { label: "Current company", left: left.current_company, right: right.current_company, status: undefined, detail: undefined },
    { label: "Location", left: left.location, right: right.location, status: undefined, detail: undefined },
    { label: "Countries", left: listValue(left.countries), right: listValue(right.countries), status: undefined, detail: undefined },
    { label: "Companies", left: listValue(left.companies), right: listValue(right.companies), status: undefined, detail: undefined },
    { label: "Education", left: listValue(left.education), right: listValue(right.education), status: undefined, detail: undefined },
    { label: "Skills", left: listValue(left.skills), right: listValue(right.skills), status: undefined, detail: undefined },
  ];
}

function listValue(value: unknown) {
  if (!Array.isArray(value)) return typeof value === "string" ? value : "";
  return value.filter(Boolean).slice(0, 10).join(", ");
}

function significantTerms(query: string) {
  const stopwords = new Set(["find", "show", "candidate", "candidates", "with", "that", "have", "need", "the", "and", "for", "from", "resume", "profiles"]);
  return Array.from(new Set((query.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{2,}/g) ?? []).filter((term) => !stopwords.has(term))));
}

function candidateHasEvidenceTerm(candidate: CandidateSummary, terms: string[]) {
  const evidenceText = [
    candidate.current_company,
    ...(candidate.evidence ?? []).map((item) => item.snippet ?? ""),
  ].join(" ").toLowerCase();
  return terms.some((term) => evidenceText.includes(term.toLowerCase()));
}

function candidateRoleFactsNeedReview(candidate: CandidateSummary) {
  return Boolean(
    candidate.current_role_verification_status
    && candidate.current_role_verification_status !== "verified"
    && candidate.current_role_verification_status !== "missing"
  );
}

function domainLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function formatBytes(value?: number | null) {
  if (!value) return "Not recorded";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value?: string | null) {
  if (!value) return "missing";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function versionStatusLabel(value?: string | null) {
  if (!value) return "possible version";
  const mapped: Record<string, string> = {
    suggested: "possible version",
    review_later: "review later",
    versioned: "versioned",
    separate: "kept separate",
    same_person: "versioned",
    not_same_person: "kept separate",
    merged: "legacy merged",
  };
  return mapped[value] ?? domainLabel(value);
}

function latestCandidateReparseBatch(batches: ParseBatch[], sourceName: string) {
  const normalizedSource = normalizeComparableText(sourceName);
  const matching = batches
    .filter((batch) => batch.source_type === "candidate_reparse")
    .filter((batch) => !normalizedSource || normalizeComparableText(batch.name).includes(normalizedSource))
    .sort((left, right) => new Date(right.updated_at ?? right.created_at ?? 0).getTime() - new Date(left.updated_at ?? left.created_at ?? 0).getTime());
  return matching[0] ?? null;
}

function ProgressBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="progressTrack" aria-label={`Progress ${percent}%`}>
      <i style={{ width: `${percent}%` }} />
      <span>{percent}%</span>
    </div>
  );
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

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function batchProgress(batch: ParseBatch) {
  if (!batch.total_files) return 0;
  return ((batch.completed_count + batch.failed_count) / batch.total_files) * 100;
}

function isActiveBatch(batch: ParseBatch) {
  return ["created", "queued", "running", "processing", "retrying"].includes(batch.status);
}

function isActiveMaintenanceJob(job: CandidateMaintenanceJob) {
  return ["queued", "running"].includes(job.status);
}

function Fact({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {typeof progress === "number" ? <i><b style={{ width: `${Math.round(progress * 100)}%` }} /></i> : null}
    </div>
  );
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
  if (raw.includes("Login did not return a bearer token")) return "Login succeeded but Better Auth did not return a session token. Refresh the page and try again.";
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

function isTenantAdmin(user: CurrentUser | null) {
  return ["tenant_owner", "tenant_admin"].includes(user?.tenant_role ?? "");
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return String(item ?? "");
      const objectItem = item as Record<string, unknown>;
      const preferred = objectItem.role ?? objectItem.note ?? objectItem.title ?? objectItem.summary ?? objectItem.name ?? objectItem.label;
      if (typeof preferred === "string") return preferred;
      return JSON.stringify(objectItem);
    })
    .map((item) => item.trim())
    .filter(Boolean);
}
