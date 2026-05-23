export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export type Session = {
  token: string;
  expires_at: string;
  user: { id: string; email: string; name?: string | null; role: string; platform_role?: string; tenant_role?: string; tenant_id?: string | null; tenant_name?: string | null; workspace_access?: string | null };
};

export type CurrentUser = Session["user"];

export type CandidateSummary = {
  document_id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  fact_verification_status?: string | null;
  current_role_verification_status?: string | null;
  current_role_flags?: string[];
  total_years_experience?: number | null;
  seniority?: string | null;
  top_domains?: string[];
  location?: string | null;
  countries?: string[];
  semantic_score?: number;
  copilot_score_breakdown?: {
    total_score?: number;
    role_score?: number;
    evidence_score?: number;
    years_score?: number;
    location_score?: number;
    semantic_score?: number;
    location_requirement?: "preferred" | "required" | "ignored" | string;
    location_reason?: string;
  };
  semantic_top_chunks?: string[];
  top_chunks?: string[];
  evidence?: Array<{ chunk_type?: string; source_label?: string; page_number?: number | null; snippet?: string }>;
  note_signals?: Array<{ category?: string; label?: string; value?: string | null; source_text?: string | null }>;
  profile_freshness?: {
    status?: string;
    label?: string;
    score?: number;
    summary?: string;
    verified_sources?: string[];
    missing_verifications?: string[];
    flags?: Array<{ key?: string; label?: string; severity?: string }>;
  };
  coverage?: number | null;
  duplicate_risk_score?: number;
  duplicate_status?: string | null;
  reviewed_signals?: string[];
  source_file?: string | null;
  updated_at?: string | null;
};

export type WorkspaceAnalytics = {
  candidate_count: number;
  top_skills: Array<{ label: string; candidate_count: number; category?: string | null }>;
  top_domains: Array<{ label: string; candidate_count: number; average_years?: number | null; max_years?: number | null }>;
  top_companies: Array<{ label: string; candidate_count: number }>;
  top_locations: Array<{ label: string; candidate_count: number; country?: string | null; signal_type?: string | null }>;
  top_countries: Array<{ label: string; candidate_count: number }>;
  top_schools: Array<{ label: string; candidate_count: number }>;
  experience_distribution: Array<{ label: string; candidate_count: number }>;
};

export type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CopilotThreadMessage = CopilotMessage & {
  id: string;
  thread_id: string;
  query?: string | null;
  candidates?: CandidateSummary[];
  clarifying_questions?: string[];
  suggested_actions?: string[];
  metadata?: Record<string, any>;
  created_at?: string | null;
};

export type CopilotThread = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  message_count?: number;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  messages?: CopilotThreadMessage[];
};

export type CopilotResponse = {
  answer: string;
  candidates: CandidateSummary[];
  clarifying_questions: string[];
  suggested_actions: string[];
  query_intent?: {
    role_intent?: string;
    roles?: string[];
    locations?: string[];
    location_requirement?: "preferred" | "required" | "ignored" | string;
    terms?: string[];
  };
  metadata?: Record<string, any>;
  synthesis_status?: string;
  synthesis_usage?: any;
  thread?: CopilotThread;
};

export type Candidate = {
  document_id: string;
  source_file: string;
  original_filename?: string | null;
  name: string | null;
  contact: { email?: string | null; phone?: string | null; location?: string | null; links?: string[] };
  summary?: string | null;
  skills: string[];
  experience: Array<{
    company?: string | null;
    title?: string | null;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    bullets: string[];
    technologies?: string[];
    workstreams?: Array<{
      name?: string | null;
      role?: string | null;
      location?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      bullets?: string[];
      technologies?: string[];
      evidence_note?: string | null;
    }>;
  }>;
  education: Array<{
    school?: string | null;
    degree?: string | null;
    field?: string | null;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    details?: string[];
  }>;
  certifications: string[];
  notes?: Array<{ id?: string; name: string; content: string; created_at: string; updated_at?: string | null }>;
  derived?: any;
  candidate_intelligence?: any;
  llm_hr_intelligence?: any;
  llm_usage?: Array<{ pass: string; model: string; input_tokens: number; output_tokens: number; finish_reason?: string }>;
  llm_usage_totals?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  primary_key_coverage?: {
    score: number;
    present: number;
    total: number;
    items: Array<{ key: string; label: string; status: "present" | "missing"; category?: string; category_label?: string; severity?: "critical" | "standard" | "enrichment" | "context" }>;
    categories?: Array<{ key: string; label: string; score: number; present: number; total: number; status: "complete" | "needs_enrichment" | "critical_missing"; missing_keys: string[]; critical_missing_keys: string[] }>;
    status?: "good" | "needs_review" | "low_confidence" | string;
    review_threshold?: number;
    minimum_usable_threshold?: number;
    low_coverage_reasons?: Array<{ severity: string; label: string; detail: string }>;
    missing_keys: string[];
    critical_missing_keys?: string[];
    critical_missing_count?: number;
    enrichment_missing_keys?: string[];
  };
  candidate_versions?: { matches: CandidateVersionMatch[] };
  reviewed_signals?: string[];
  _metadata?: any;
};

export type LinkedInVerificationRun = {
  id: string;
  document_id: string;
  linkedin_url?: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "retrying" | string;
  stage?: string | null;
  provider?: string | null;
  result_status?: "verified" | "needs_review" | "mismatch" | string | null;
  match_confidence?: number | null;
  comparison?: Record<string, any>;
  profile_diff?: Record<string, any>;
  error_message?: string | null;
  credits_used?: number;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type LinkedInImportJob = {
  id: string;
  campaign_id?: string | null;
  linkedin_url?: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "retrying" | string;
  stage?: string | null;
  document_id?: string | null;
  profile_snapshot?: Record<string, any>;
  note_name?: string | null;
  has_note?: boolean;
  error_message?: string | null;
  credits_used?: number;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type CandidateProfileUpdate = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  total_years_experience?: number | null;
  skills?: string[];
  countries?: string[];
  experience?: Candidate["experience"];
  education?: Candidate["education"];
  certifications?: string[];
};

export type Requirement = {
  id: string;
  title?: string | null;
  source_type: string;
  original_text: string;
  extracted_requirement_json: any;
  clarification_questions: string[];
  recruiter_answers: Record<string, string>;
  final_requirement_profile?: any;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RequirementMatch = {
  candidate_id: string;
  candidate: any;
  total_score: number;
  hard_filter_pass?: boolean;
  hard_filter_failures?: string[];
  must_have_score: number;
  nice_to_have_score: number;
  years_score: number;
  domain_score: number;
  location_score: number;
  evidence: any;
  gaps: any;
  recommendation: string;
  status?: string;
};

export type RequirementMatchRun = {
  id: string;
  requirement_id: string;
  run_number: number;
  candidate_count: number;
  eligible_count: number;
  blocked_count: number;
  top_score: number;
  average_score: number;
  profile_snapshot: any;
  matches?: Array<{
    rank: number;
    candidate_id: string;
    candidate_name?: string | null;
    current_title?: string | null;
    current_company?: string | null;
    total_score: number;
    hard_filter_pass: boolean;
    status: string;
    recommendation?: string | null;
    hard_filter_failures?: string[];
    gaps?: any;
  }>;
  created_at: string;
};

export type RequirementMatchRunChange = {
  candidate_id: string;
  candidate_name?: string | null;
  change_type: "added" | "removed" | "changed";
  score_delta: number;
  rank_delta?: number | null;
  previous_rank?: number | null;
  current_rank?: number | null;
  previous_score?: number | null;
  current_score?: number | null;
};

export type CandidateVersionMatch = {
  id?: string;
  document_id?: string;
  left_document_id?: string;
  right_document_id?: string;
  name?: string | null;
  left_name?: string | null;
  right_name?: string | null;
  left_profile?: any;
  right_profile?: any;
  left_version?: CandidateVersionMetadata;
  right_version?: CandidateVersionMetadata;
  field_diffs?: CandidateVersionDiff[];
  score: number;
  reasons: any[];
  status?: string;
  audit_events?: Array<{ action: string; user_id?: string | null; user_email?: string | null; metadata?: any; created_at: string }>;
};

export type CandidateVersionMetadata = {
  document_id: string;
  candidate_created_at?: string | null;
  candidate_updated_at?: string | null;
  latest_document?: CandidateVersionDocument | null;
  documents: CandidateVersionDocument[];
  page_methods?: Array<{ extraction_method?: string | null; page_count: number }>;
};

export type CandidateVersionDocument = {
  id: string;
  storage_backend: string;
  storage_key: string;
  original_filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  extraction_method?: string | null;
  page_count?: number | null;
  uploaded_at?: string | null;
  parse_status?: string | null;
  parse_stage?: string | null;
  attempt_count?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
  parse_completed_at?: string | null;
};

export type CandidateVersionDiff = {
  key: string;
  label: string;
  status: "same" | "different" | "missing";
  left: string;
  right: string;
  left_only?: string[];
  right_only?: string[];
  overlap?: string[];
  detail?: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  seat_limit: number;
  member_count?: number;
  candidate_count?: number;
  parse_job_count?: number;
  created_at?: string | null;
};

export type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  joined_at?: string | null;
  created_at: string;
};

export type TenantInvitation = {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  status: string;
  invite_token?: string;
  expires_at?: string | null;
  accepted_at?: string | null;
  created_at?: string | null;
};

export type GovernancePolicy = {
  tenant_id: string;
  external_llm_synthesis_enabled: boolean;
  redact_pii_before_external_llm: boolean;
  contact_pii_visible_to_roles: string[];
  updated_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PiiAccessEvent = {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  user_email?: string | null;
  document_id?: string | null;
  candidate_name?: string | null;
  fields: string[];
  action: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
};

export type TenantAdminDetail = {
  tenant: Tenant;
  members: TeamMember[];
  invitations: TenantInvitation[];
  recent_candidates: Array<{ document_id: string; name?: string | null; email?: string | null; source_file?: string | null; created_at?: string | null; updated_at?: string | null }>;
  recent_requirements: Array<{ id: string; title?: string | null; status: string; source_type: string; created_at?: string | null; updated_at?: string | null }>;
  recent_parse_jobs: Array<{ id: string; original_filename: string; status: string; stage: string; progress_percent?: number | null; error_message?: string | null; created_at?: string | null; updated_at?: string | null }>;
  audit_events: Array<{ id: string; action: string; entity_type: string; entity_id?: string | null; user_email?: string | null; metadata?: any; created_at?: string | null }>;
  usage?: {
    document_count: number;
    document_storage_bytes: number;
  };
};

export type AuditEvent = {
  id: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  user_email?: string | null;
  metadata?: any;
  created_at?: string | null;
};

export type ParseJob = {
  id: string;
  tenant_id: string;
  batch_id?: string | null;
  original_filename: string;
  source_file: string;
  storage_backend?: string | null;
  storage_key?: string | null;
  document_id?: string | null;
  status: string;
  stage: string;
  stage_label?: string;
  progress_percent?: number;
  warning_message?: string | null;
  has_initial_note?: boolean;
  initial_note_name?: string | null;
  attempt_count: number;
  max_attempts: number;
  error_message?: string | null;
  ocr_used?: boolean | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  events?: ParseJobEvent[];
};

export type ParseJobEvent = {
  id: string;
  tenant_id: string;
  batch_id?: string | null;
  job_id: string;
  event_type: string;
  status: string;
  stage: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
};

export type ParseDeadLetter = {
  id: string;
  tenant_id: string;
  batch_id?: string | null;
  batch_name?: string | null;
  job_id: string;
  original_filename?: string | null;
  job_status?: string | null;
  job_stage?: string | null;
  error_message: string;
  attempt_count: number;
  max_attempts: number;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  job_updated_at?: string | null;
  resolved_at?: string | null;
};

export type DocumentPage = {
  page_number: number;
  extraction_method: string;
  raw_text: string;
  quality_flags: string[];
  created_at?: string | null;
};

export type ParseBatch = {
  id: string;
  tenant_id: string;
  campaign_id?: string | null;
  name: string;
  source_type: string;
  total_files: number;
  queued_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
  progress_percent?: number;
  context_note?: string | null;
  estimated_cost?: number;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  jobs?: ParseJob[];
  events?: ParseJobEvent[];
};

export type JobCampaignCandidate = {
  id: string;
  campaign_id: string;
  candidate_id: string;
  source: string;
  status: string;
  score: number;
  evidence?: any;
  candidate?: CandidateSummary;
  stage_note?: string | null;
  owner_user_id?: string | null;
  last_stage_changed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  activity_events?: Array<{
    id: string;
    event_type: string;
    title: string;
    body?: string | null;
    metadata?: any;
    user_email?: string | null;
    created_at?: string | null;
  }>;
};

export type CampaignPipelineStatus =
  | "recommended"
  | "uploaded"
  | "matched"
  | "below_threshold"
  | "shortlisted"
  | "contacted"
  | "replied"
  | "screened"
  | "submitted"
  | "interviewing"
  | "offer"
  | "placed"
  | "rejected"
  | "archived";

export type JobCampaign = {
  id: string;
  tenant_id: string;
  requirement_id?: string | null;
  requirement_title?: string | null;
  requirement_status?: string | null;
  requirement?: {
    id: string;
    title?: string | null;
    status?: string | null;
    original_text?: string | null;
    extracted_requirement_json?: any;
    final_requirement_profile?: any;
    recruiter_answers?: Record<string, string>;
  } | null;
  scorecard?: CampaignScorecard;
  name: string;
  description: string;
  status: string;
  candidate_count: number;
  upload_batch_count: number;
  candidates?: JobCampaignCandidate[];
  upload_batches?: Array<{
    id: string;
    name: string;
    status: string;
    total_files: number;
    completed_count: number;
    failed_count: number;
    context_note?: string | null;
    estimated_cost?: number | null;
    updated_at?: string | null;
  }>;
  matches?: RequirementMatch[];
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type CampaignScorecard = {
  title?: string | null;
  role_intent?: string | null;
  location_preference?: string[];
  seniority?: string | null;
  min_years_experience?: number | string | null;
  must_have_skills?: string[];
  nice_to_have_skills?: string[];
  dealbreakers?: string[];
  domains?: string[];
  industry_preferences?: string[];
  soft_preferences?: string[];
  hidden_intent?: string[];
  strict_must_haves?: boolean;
  strict_min_years?: boolean;
  score_weights?: Record<string, number>;
};

export type WorkerStatus = {
  online: boolean;
  queued_count: number;
  running_count: number;
  failed_count: number;
  dead_letter_count?: number;
  online_window_seconds: number;
  workers: Array<{
    worker_id: string;
    tenant_id?: string | null;
    status: string;
    current_job_id?: string | null;
    processed_jobs: number;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
    started_at?: string | null;
    last_seen_at?: string | null;
    online?: boolean;
  }>;
};

export type CandidateMaintenanceJob = {
  id: string;
  tenant_id: string;
  created_by_user_id?: string | null;
  created_by_email?: string | null;
  job_type: string;
  status: string;
  stage: string;
  stage_label?: string;
  progress_percent: number;
  total_candidates: number;
  processed_candidates: number;
  failed_candidates: number;
  refresh_embeddings: boolean;
  error_message?: string | null;
  result?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type OperationalAlert = {
  id: string;
  tenant_id?: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  body: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
};

export type OperationalAlertDelivery = {
  id: string;
  tenant_id?: string | null;
  alert_id: string;
  channel: string;
  destination: string;
  status: string;
  status_code?: number | null;
  latency_ms?: number | null;
  error_message?: string | null;
  created_at?: string | null;
};

export async function bootstrap(email: string, password: string) {
  return request("/auth/bootstrap", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function me(token: string) {
  return request("/auth/me", { token });
}

export async function selectTenantWorkspace(token: string, tenantId: string): Promise<{ user: CurrentUser }> {
  return request(`/auth/platform/tenant-workspace/${tenantId}`, { method: "POST", token });
}

export async function clearTenantWorkspace(token: string): Promise<{ user: CurrentUser }> {
  return request("/auth/platform/tenant-workspace/clear", { method: "POST", token });
}

export async function acceptInvitation(token: string, name: string, password: string): Promise<{ user: CurrentUser; tenant_id: string }> {
  return request("/team/invitations/accept", { method: "POST", body: JSON.stringify({ token, name, password }) });
}

export async function listCandidates(token: string): Promise<{ candidates: CandidateSummary[] }> {
  return request("/candidates", { token });
}

export async function semanticSearchCandidates(token: string, query: string, limit = 100): Promise<{ results: Record<string, { semantic_score: number; top_chunks: string[] }> }> {
  return request("/candidates/semantic-search", {
    method: "POST",
    token,
    body: JSON.stringify({ query, limit }),
  });
}

export async function searchCandidates(token: string, query: string, limit = 50): Promise<{ results: CandidateSummary[] }> {
  return request("/candidates/search", {
    method: "POST",
    token,
    body: JSON.stringify({ query, limit }),
  });
}

export async function getWorkspaceAnalytics(token: string, limit = 15): Promise<{ analytics: WorkspaceAnalytics }> {
  return request(`/analytics/workspace?limit=${limit}`, { token });
}

export async function listCopilotThreads(token: string): Promise<{ threads: CopilotThread[] }> {
  return request("/copilot/threads", { token });
}

export async function createCopilotThread(token: string, title?: string): Promise<{ thread: CopilotThread }> {
  return request("/copilot/threads", {
    method: "POST",
    token,
    body: JSON.stringify({ title: title || null }),
  });
}

export async function getCopilotThread(token: string, id: string): Promise<{ thread: CopilotThread }> {
  return request(`/copilot/threads/${id}`, { token });
}

export async function archiveCopilotThread(token: string, id: string): Promise<{ thread: CopilotThread }> {
  return request(`/copilot/threads/${id}`, { method: "DELETE", token });
}

export async function createRequirementFromCopilotThread(token: string, id: string): Promise<{ requirement: Requirement; thread: CopilotThread }> {
  return request(`/copilot/threads/${id}/requirement-draft`, { method: "POST", token });
}

export async function chatCopilot(token: string, message: string, history: CopilotMessage[] = [], limit = 10, threadId?: string | null): Promise<CopilotResponse> {
  return request("/copilot/chat", {
    method: "POST",
    token,
    body: JSON.stringify({ message, history, limit, thread_id: threadId || null }),
  });
}

export async function getCandidate(token: string, id: string): Promise<Candidate> {
  return request(`/candidates/${id}`, { token });
}

export async function deleteCandidate(token: string, id: string, reason = "removed_by_recruiter"): Promise<{ candidate: { document_id: string; deleted: boolean; reason: string } }> {
  const search = new URLSearchParams({ reason });
  return request(`/candidates/${id}?${search.toString()}`, { method: "DELETE", token });
}

export async function updateCandidateProfile(token: string, id: string, payload: CandidateProfileUpdate): Promise<Candidate> {
  return request(`/candidates/${id}/profile`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function markCandidateReviewSignal(token: string, id: string, signalKey: string, note = ""): Promise<{ review: any }> {
  return request(`/candidates/${id}/review-signals/${encodeURIComponent(signalKey)}/reviewed`, {
    method: "POST",
    token,
    body: JSON.stringify({ note }),
  });
}

export async function getCandidateSource(token: string, id: string): Promise<Blob> {
  const response = await fetch(`${apiBase()}/candidates/${id}/document-preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
}

export async function getCandidateRawText(token: string, id: string): Promise<string> {
  const response = await fetch(`${apiBase()}/candidates/${id}/raw-text`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

export async function getCandidateDocumentHtml(token: string, id: string): Promise<{ filename: string; source_type: string; html: string }> {
  return request(`/candidates/${id}/document-html`, { token });
}

export async function getCandidatePages(token: string, id: string): Promise<{ pages: DocumentPage[] }> {
  return request(`/candidates/${id}/pages`, { token });
}

export async function getLinkedInVerification(token: string, id: string): Promise<{ run: LinkedInVerificationRun | null }> {
  return request(`/candidates/${id}/linkedin/verification`, { token });
}

export async function verifyLinkedInProfile(token: string, id: string, linkedinUrl?: string, autoStart = true): Promise<{ run: LinkedInVerificationRun }> {
  return request(`/candidates/${id}/linkedin/verify`, {
    method: "POST",
    token,
    body: JSON.stringify({ linkedin_url: linkedinUrl || null, auto_start: autoStart }),
  });
}

export async function importLinkedInCandidate(
  token: string,
  linkedinUrl: string,
  campaignId?: string,
  noteName?: string,
  noteContent?: string,
  autoStart = true,
): Promise<{ import: LinkedInImportJob }> {
  return request("/candidates/linkedin-imports", {
    method: "POST",
    token,
    body: JSON.stringify({
      linkedin_url: linkedinUrl,
      campaign_id: campaignId || null,
      note_name: noteName || null,
      note_content: noteContent || null,
      auto_start: autoStart,
    }),
  });
}

export async function getLinkedInImport(token: string, importId: string): Promise<{ import: LinkedInImportJob }> {
  return request(`/candidates/linkedin-imports/${importId}`, { token });
}

export async function listLinkedInImports(token: string, limit = 10): Promise<{ imports: LinkedInImportJob[] }> {
  return request(`/candidates/linkedin-imports?limit=${encodeURIComponent(String(limit))}`, { token });
}

export async function uploadResume(file: File, noteName: string, note: string, token: string): Promise<{ batch: ParseBatch; job: ParseJob; message: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("note_name", noteName);
  body.append("note", note);
  return request("/resumes/upload", { method: "POST", token, body, form: true });
}

export async function bulkUploadResumes(files: File[], batchName: string, token: string, autoStart = false, contextNote = ""): Promise<{ batch: ParseBatch }> {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  if (batchName.trim()) body.append("batch_name", batchName.trim());
  if (contextNote.trim()) body.append("context_note", contextNote.trim());
  body.append("auto_start", String(autoStart));
  return request("/resumes/bulk-upload", { method: "POST", token, body, form: true });
}

export async function listCampaigns(token: string): Promise<{ campaigns: JobCampaign[] }> {
  return request("/campaigns", { token });
}

export async function createCampaign(token: string, name: string, description: string, requirementId?: string | null): Promise<JobCampaign> {
  return request("/campaigns", {
    method: "POST",
    token,
    body: JSON.stringify({ name, description, requirement_id: requirementId || null }),
  });
}

export async function updateCampaign(token: string, id: string, payload: { name?: string; description?: string; status?: string; requirement_id?: string | null; unlink_requirement?: boolean }): Promise<JobCampaign> {
  return request(`/campaigns/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteCampaign(token: string, id: string, confirmation: string, reason = "removed_by_recruiter"): Promise<{ id: string; deleted: boolean; already_deleted?: boolean }> {
  return request(`/campaigns/${id}`, {
    method: "DELETE",
    token,
    body: JSON.stringify({ confirmation, reason }),
  });
}

export async function getCampaign(token: string, id: string): Promise<JobCampaign> {
  return request(`/campaigns/${id}`, { token });
}

export async function createCampaignRequirement(token: string, campaignId: string, text: string): Promise<JobCampaign> {
  return request(`/campaigns/${campaignId}/requirement`, {
    method: "POST",
    token,
    body: JSON.stringify({ text }),
  });
}

export async function uploadCampaignRequirement(token: string, campaignId: string, file: File): Promise<JobCampaign> {
  const body = new FormData();
  body.append("file", file);
  return request(`/campaigns/${campaignId}/requirement/upload`, { method: "POST", token, body, form: true });
}

export async function updateCampaignScorecard(token: string, campaignId: string, scorecard: CampaignScorecard): Promise<JobCampaign> {
  return request(`/campaigns/${campaignId}/scorecard`, {
    method: "PATCH",
    token,
    body: JSON.stringify(scorecard),
  });
}

export async function matchCampaign(token: string, id: string, mode: "full" | "incremental" = "full", candidateIds: string[] = []): Promise<JobCampaign> {
  return request(`/campaigns/${id}/match`, {
    method: "POST",
    token,
    body: JSON.stringify({ mode, candidate_ids: candidateIds }),
  });
}

export async function uploadCampaignResumes(token: string, campaignId: string, files: File[], contextNote = "", batchName = ""): Promise<{ campaign: JobCampaign; batch: ParseBatch }> {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  if (contextNote.trim()) body.append("context_note", contextNote.trim());
  if (batchName.trim()) body.append("batch_name", batchName.trim());
  return request(`/campaigns/${campaignId}/resumes`, { method: "POST", token, body, form: true });
}

export async function updateCampaignCandidateStatus(token: string, campaignId: string, candidateId: string, status: CampaignPipelineStatus, note = ""): Promise<JobCampaignCandidate> {
  return request(`/campaigns/${campaignId}/candidates/${candidateId}/status`, {
    method: "POST",
    token,
    body: JSON.stringify({ status, note: note || null }),
  });
}

export async function listParseBatches(token: string): Promise<{ batches: ParseBatch[] }> {
  return request("/parse-batches", { token });
}

export async function getWorkerStatus(token: string): Promise<WorkerStatus> {
  return request("/parse-worker/status", { token });
}

export async function listCandidateMaintenanceJobs(token: string): Promise<{ jobs: CandidateMaintenanceJob[] }> {
  return request("/maintenance/candidate-rederive-jobs", { token });
}

export async function createCandidateRederiveJob(token: string, refreshEmbeddings = false, autoStart = true): Promise<{ job: CandidateMaintenanceJob }> {
  return request("/maintenance/candidates/rederive", {
    method: "POST",
    token,
    body: JSON.stringify({ refresh_embeddings: refreshEmbeddings, auto_start: autoStart }),
  });
}

export async function retryCandidateMaintenanceJob(token: string, id: string): Promise<{ job: CandidateMaintenanceJob }> {
  return request(`/maintenance/candidate-rederive-jobs/${id}/retry`, { method: "POST", token });
}

export async function cancelCandidateMaintenanceJob(token: string, id: string): Promise<{ job: CandidateMaintenanceJob }> {
  return request(`/maintenance/candidate-rederive-jobs/${id}/cancel`, { method: "POST", token });
}

export async function listParseDeadLetters(token: string, status = "open"): Promise<{ dead_letters: ParseDeadLetter[] }> {
  const search = new URLSearchParams({ status });
  const response = await request(`/parse-file-reviews?${search.toString()}`, { token }) as { file_reviews?: ParseDeadLetter[]; dead_letters?: ParseDeadLetter[] };
  return { dead_letters: response.file_reviews ?? response.dead_letters ?? [] };
}

export async function resolveParseDeadLetter(token: string, id: string): Promise<{ dead_letter: ParseDeadLetter }> {
  const response = await request(`/parse-file-reviews/${id}/resolve`, { method: "POST", token }) as { file_review?: ParseDeadLetter; dead_letter?: ParseDeadLetter };
  return { dead_letter: response.file_review ?? response.dead_letter! };
}

export async function listOperationalAlerts(token: string, status = "open"): Promise<{ alerts: OperationalAlert[] }> {
  const search = new URLSearchParams({ status });
  return request(`/operational-alerts?${search.toString()}`, { token });
}

export async function acknowledgeOperationalAlert(token: string, id: string): Promise<{ alert: OperationalAlert }> {
  return request(`/operational-alerts/${id}/acknowledge`, { method: "POST", token });
}

export async function listOperationalAlertDeliveries(token: string): Promise<{ deliveries: OperationalAlertDelivery[] }> {
  return request("/operational-alert-deliveries", { token });
}

export async function getParseBatch(token: string, id: string): Promise<ParseBatch> {
  return request(`/parse-batches/${id}`, { token });
}

export async function retryParseJob(token: string, id: string): Promise<{ queued: boolean; job: ParseJob }> {
  return request(`/parse-jobs/${id}/retry`, { method: "POST", token });
}

export async function cancelParseJob(token: string, id: string): Promise<ParseJob> {
  return request(`/parse-jobs/${id}/cancel`, { method: "POST", token });
}

export async function cancelParseBatch(token: string, id: string): Promise<ParseBatch> {
  return request(`/parse-batches/${id}/cancel`, { method: "POST", token });
}

export async function reparseCandidate(token: string, id: string, autoStart = true): Promise<{ batch: ParseBatch; job: ParseJob }> {
  return request(`/candidates/${id}/reparse`, {
    method: "POST",
    token,
    body: JSON.stringify({ auto_start: autoStart }),
  });
}

export async function addNote(documentId: string, name: string, content: string, token: string): Promise<Candidate> {
  return request(`/candidates/${documentId}/notes`, {
    method: "POST",
    token,
    body: JSON.stringify({ name, content }),
  });
}

export async function updateNote(documentId: string, noteId: string, name: string, content: string, token: string): Promise<Candidate> {
  return request(`/candidates/${documentId}/notes/${noteId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ name, content }),
  });
}

export async function deleteNote(documentId: string, noteId: string, token: string): Promise<Candidate> {
  return request(`/candidates/${documentId}/notes/${noteId}`, {
    method: "DELETE",
    token,
  });
}

export async function listRequirements(token: string): Promise<{ requirements: Requirement[] }> {
  return request("/requirements", { token });
}

export async function createRequirement(token: string, text: string): Promise<Requirement> {
  return request("/requirements", { method: "POST", token, body: JSON.stringify({ text }) });
}

export async function uploadRequirement(token: string, file: File): Promise<Requirement> {
  const body = new FormData();
  body.append("file", file);
  return request("/requirements/upload", { method: "POST", token, body, form: true });
}

export async function clarifyRequirement(token: string, id: string, answers: Record<string, string>): Promise<Requirement> {
  return request(`/requirements/${id}/clarify`, { method: "POST", token, body: JSON.stringify({ answers }) });
}

export async function finalizeRequirement(token: string, id: string, answers: Record<string, string>): Promise<Requirement> {
  return request(`/requirements/${id}/finalize`, { method: "POST", token, body: JSON.stringify({ answers }) });
}

export async function matchRequirement(token: string, id: string): Promise<{ matches: RequirementMatch[] }> {
  return request(`/requirements/${id}/match`, { method: "POST", token });
}

export async function getRequirementMatches(token: string, id: string): Promise<{ matches: RequirementMatch[] }> {
  return request(`/requirements/${id}/matches`, { token });
}

export async function listRequirementMatchRuns(token: string, id: string): Promise<{ runs: RequirementMatchRun[] }> {
  return request(`/requirements/${id}/match-runs`, { token });
}

export async function compareLatestRequirementMatchRuns(token: string, id: string): Promise<{ runs: RequirementMatchRun[]; changes: RequirementMatchRunChange[] }> {
  return request(`/requirements/${id}/match-runs/compare/latest`, { token });
}

export async function shortlistMatch(token: string, requirementId: string, candidateId: string): Promise<RequirementMatch> {
  return request(`/requirements/${requirementId}/matches/${candidateId}/shortlist`, { method: "POST", token });
}

export async function rejectMatch(token: string, requirementId: string, candidateId: string): Promise<RequirementMatch> {
  return request(`/requirements/${requirementId}/matches/${candidateId}/reject`, { method: "POST", token });
}

export async function listCandidateVersionClusters(token: string): Promise<{ clusters: CandidateVersionMatch[] }> {
  return request("/candidate-versions/clusters", { token });
}

export async function decideCandidateVersion(token: string, matchId: string, decision: "versioned" | "separate" | "review-later") {
  return request(`/candidate-versions/${matchId}/${decision}`, { method: "POST", token });
}

export async function listTenants(token: string): Promise<{ tenants: Tenant[] }> {
  return request("/admin/tenants", { token });
}

export async function createTenant(token: string, name: string, seatLimit: number, ownerEmail?: string, ownerRole = "tenant_owner"): Promise<{ tenant: Tenant; owner_invitation?: TenantInvitation | null }> {
  return request("/admin/tenants", {
    method: "POST",
    token,
    body: JSON.stringify({ name, seat_limit: seatLimit, owner_email: ownerEmail || null, owner_role: ownerRole }),
  });
}

export async function getTenantAdminDetail(token: string, tenantId: string): Promise<TenantAdminDetail> {
  return request(`/admin/tenants/${tenantId}`, { token });
}

export async function listAuditLogs(token: string, params: { tenantId?: string; action?: string; limit?: number } = {}): Promise<{ audit_events: AuditEvent[] }> {
  const search = new URLSearchParams();
  if (params.tenantId) search.set("tenant_id", params.tenantId);
  if (params.action) search.set("action", params.action);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request(`/admin/audit-logs${suffix}`, { token });
}

export async function disableTenant(token: string, tenantId: string): Promise<{ tenant: Tenant }> {
  return request(`/admin/tenants/${tenantId}/disable`, { method: "POST", token });
}

export async function reactivateTenant(token: string, tenantId: string): Promise<{ tenant: Tenant }> {
  return request(`/admin/tenants/${tenantId}/reactivate`, { method: "POST", token });
}

export async function getTeam(token: string): Promise<{ tenant: { id: string; name?: string | null }; members: TeamMember[]; invitations: TenantInvitation[]; governance_policy: GovernancePolicy; pii_access_events: PiiAccessEvent[] }> {
  return request("/team", { token });
}

export async function updateGovernancePolicy(token: string, policy: Partial<GovernancePolicy>): Promise<{ governance_policy: GovernancePolicy }> {
  return request("/team/governance-policy", { method: "PATCH", token, body: JSON.stringify(policy) });
}

export async function listPiiAccessEvents(token: string, limit = 100): Promise<{ pii_access_events: PiiAccessEvent[] }> {
  return request(`/team/pii-access-events?limit=${limit}`, { token });
}

export async function inviteTeamMember(token: string, email: string, role: string): Promise<TenantInvitation> {
  return request("/team/invitations", { method: "POST", token, body: JSON.stringify({ email, role }) });
}

export async function resendInvitation(token: string, invitationId: string): Promise<TenantInvitation> {
  return request(`/team/invitations/${invitationId}/resend`, { method: "POST", token });
}

export async function cancelInvitation(token: string, invitationId: string): Promise<TenantInvitation> {
  return request(`/team/invitations/${invitationId}/cancel`, { method: "POST", token });
}

export async function updateMemberRole(token: string, membershipId: string, role: string): Promise<TeamMember> {
  return request(`/team/members/${membershipId}/role`, { method: "POST", token, body: JSON.stringify({ role }) });
}

export async function disableMember(token: string, membershipId: string): Promise<TeamMember> {
  return request(`/team/members/${membershipId}/disable`, { method: "POST", token });
}

async function request(path: string, options: { method?: string; token?: string; body?: BodyInit; form?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (!options.form) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${apiBase()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function apiBase() {
  if (typeof window === "undefined") return API_BASE;
  if (API_BASE === "/api") return "/api/backend";
  if (API_BASE === "http://localhost:8010" || API_BASE === "http://127.0.0.1:8010") {
    return "/api/backend";
  }
  return API_BASE;
}
