from __future__ import annotations

import html
import logging
import os
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field
from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from psycopg.types.json import Jsonb

from .analytics import tenant_workspace_analytics
from .auth import bootstrap_platform_admin, clear_platform_tenant_workspace, current_user, login, logout, security, select_platform_tenant_workspace
from .campaigns import (
    attach_campaign_requirement,
    create_campaign,
    create_campaign_requirement_from_text,
    get_campaign,
    list_campaigns,
    set_campaign_candidate_status,
    soft_delete_campaign,
    update_campaign,
    update_campaign_scorecard,
)
from .collaboration import (
    create_comment as create_collaboration_comment,
    create_task as create_recruiter_task,
    delete_comment as delete_collaboration_comment,
    delete_saved_view as delete_workspace_view,
    delete_task as delete_recruiter_task,
    list_comments as list_collaboration_comments,
    list_notifications as list_recruiter_notifications,
    list_saved_views as list_workspace_views,
    list_tasks as list_recruiter_tasks,
    mark_notification_read as mark_recruiter_notification_read,
    save_workspace_view,
    update_task as update_recruiter_task,
)
from .copilot_synthesis import COPILOT_SYNTHESIS_CANDIDATE_LIMIT, synthesize_copilot_answer
from .copilot_threads import append_copilot_message, archive_copilot_thread, create_copilot_thread, get_copilot_thread, list_copilot_threads
from .db import db, migrate
from .db_store import (
    add_note_db,
    candidate_document_metadata,
    delete_note_db,
    list_candidates_db,
    list_document_pages_db,
    load_candidate_db,
    load_raw_text_db,
    mark_candidate_review_signal_db,
    public_candidate_record,
    reindex_candidate_search_db,
    reviewed_candidate_signals_db,
    soft_delete_candidate_db,
    update_candidate_profile_db,
    update_note_db,
)
from .candidate_versions import candidate_version_requirements, decide_match, find_matches_for_record, list_clusters, list_matches_for_candidate, persist_matches
from .governance import get_tenant_governance_policy, list_pii_access_events, role_can_view_contact_pii, update_tenant_governance_policy
from .llm_provider import Message, NormalizedProvider
from .linkedin_verification import (
    enqueue_linkedin_import,
    enqueue_linkedin_verification,
    get_linkedin_import_job,
    latest_linkedin_imports,
    latest_linkedin_verification,
    run_linkedin_import,
    run_linkedin_verification,
)
from .logging_config import configure_logging
from .mail_service import (
    build_invitation_mail,
    list_mail_messages,
    queue_mail,
    retry_mail_message,
    send_mail_message_safe,
)
from .matching import (
    apply_copilot_direct_evidence_policy as _apply_copilot_direct_evidence_policy,
    build_copilot_answer as _build_copilot_answer,
    candidate_has_direct_evidence as _candidate_has_direct_evidence,
    copilot_candidate_results as _copilot_candidate_results,
    copilot_clarifying_questions as _copilot_clarifying_questions,
    copilot_query_intent as _copilot_query_intent,
    promote_direct_evidence as _promote_direct_evidence,
    public_copilot_query_intent as _public_copilot_query_intent,
    rank_and_filter_copilot_candidates as _rank_and_filter_copilot_candidates,
    should_require_direct_evidence as _should_require_direct_evidence,
    significant_query_terms as _significant_query_terms,
)
from .maintenance_jobs import (
    cancel_candidate_maintenance_job,
    create_candidate_rederive_job,
    get_candidate_maintenance_job,
    list_candidate_maintenance_jobs,
    retry_candidate_maintenance_job,
    run_candidate_rederive_job,
)
from .match_jobs import (
    cancel_campaign_match_job,
    create_campaign_match_job,
    get_campaign_match_job,
    list_campaign_match_jobs,
    retry_campaign_match_job,
)
from .parse_jobs import cancel_batch, cancel_job, create_parse_batch, create_reparse_job_for_candidate, get_parse_batch, get_parse_job, get_worker_status, list_parse_batches, retry_job, run_job, run_next_job
from .pii import redact_contact_pii_payload, redact_contact_pii_text
from .pipeline import SUPPORTED_EXTENSIONS
from .requirements import (
    clarify_requirement,
    create_requirement_from_file,
    create_requirement_from_text,
    finalize_requirement,
    compare_match_runs,
    get_matches,
    get_match_run,
    get_requirement,
    list_match_runs,
    list_requirements,
    match_requirement,
    set_match_status,
)
from .routers.health import router as health_router
from .routers.operations import router as operations_router
from .schema import Education, Experience
from .settings import load_settings
from .tenancy import (
    accept_invitation,
    cancel_invitation,
    create_invitation,
    create_self_service_company,
    create_tenant,
    create_tenant_with_owner_invitation,
    deactivate_member,
    list_invitations,
    list_audit_logs,
    list_members,
    list_tenants,
    require_platform_admin,
    require_tenant_admin,
    require_tenant_write,
    resend_invitation,
    set_tenant_status,
    tenant_admin_detail,
    update_member_role,
    validate_tenant_creation_request,
)
from .storage import document_storage, validate_tenant_storage_key
from .vector_search import candidate_search as hybrid_candidate_search, semantic_candidate_scores, semantic_candidate_search


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
INPUT_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "output"
WORK_DIR = DATA_DIR / "work"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

configure_logging()
http_logger = logging.getLogger("resume_intel.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate()
    yield


app = FastAPI(title="candidateSignal.ai API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(operations_router)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        http_logger.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "latency_ms": int((time.perf_counter() - started) * 1000),
                "error_type": exc.__class__.__name__,
            },
        )
        raise
    latency_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-request-id"] = request_id
    http_logger.info(
        "request_completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": latency_ms,
        },
    )
    return response


class NoteRequest(BaseModel):
    name: str
    content: str
    visibility: str = "team"
    note_type: str = "general"
    campaign_id: str | None = None


class CandidateProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    total_years_experience: float | int | None = None
    skills: list[str] | None = None
    countries: list[str] | None = None
    experience: list[Experience] | None = None
    education: list[Education] | None = None
    certifications: list[str] | None = None


class CandidateReviewSignalRequest(BaseModel):
    note: str | None = None


class MatchStatusRequest(BaseModel):
    status: str


class AuthRequest(BaseModel):
    email: str
    password: str
    name: str | None = None
    setup_token: str | None = None


class CompanySignupRequest(BaseModel):
    company_name: str
    owner_name: str
    email: str
    password: str


class TenantRequest(BaseModel):
    name: str
    seat_limit: int = 5
    owner_email: str | None = None
    owner_role: str = "tenant_owner"


class InviteRequest(BaseModel):
    email: str
    role: str = "recruiter"


class AcceptInviteRequest(BaseModel):
    token: str
    name: str
    password: str


class MemberRoleRequest(BaseModel):
    role: str


class RequirementTextRequest(BaseModel):
    text: str


class ClarifyRequest(BaseModel):
    answers: dict[str, str]


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 20


class CopilotChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)
    limit: int = 10
    thread_id: str | None = None


class CopilotThreadRequest(BaseModel):
    title: str | None = None


class CampaignRequest(BaseModel):
    name: str
    description: str = ""
    requirement_id: str | None = None


class CampaignUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    requirement_id: str | None = None
    unlink_requirement: bool = False


class CampaignDeleteRequest(BaseModel):
    confirmation: str
    reason: str = "removed_by_recruiter"


class CampaignRequirementTextRequest(BaseModel):
    text: str


class CampaignScorecardRequest(BaseModel):
    title: str | None = None
    role_intent: str | None = None
    location_preference: list[str] = Field(default_factory=list)
    seniority: str | None = None
    min_years_experience: float | int | None = None
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    dealbreakers: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    industry_preferences: list[str] = Field(default_factory=list)
    soft_preferences: list[str] = Field(default_factory=list)
    hidden_intent: list[str] = Field(default_factory=list)
    strict_must_haves: bool = False
    strict_min_years: bool = False
    score_weights: dict[str, float] = Field(default_factory=dict)


class CampaignCandidateStatusRequest(BaseModel):
    status: str
    note: str | None = None


class CollaborationCommentRequest(BaseModel):
    entity_type: str
    entity_id: str
    body: str
    visibility: str = "team"
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecruiterTaskRequest(BaseModel):
    entity_type: str
    entity_id: str
    title: str
    body: str | None = None
    assignee_user_id: str | None = None
    due_at: str | None = None
    priority: str = "normal"
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecruiterTaskUpdateRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    status: str | None = None
    assignee_user_id: str | None = None
    due_at: str | None = None
    priority: str | None = None


class SavedWorkspaceViewRequest(BaseModel):
    name: str
    view_type: str
    query: str | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"


class CampaignMatchRequest(BaseModel):
    mode: str = "full"
    candidate_ids: list[str] = Field(default_factory=list)


class GovernancePolicyRequest(BaseModel):
    external_llm_synthesis_enabled: bool | None = None
    redact_pii_before_external_llm: bool | None = None
    contact_pii_visible_to_roles: list[str] | None = None


class CandidateMaintenanceRequest(BaseModel):
    refresh_embeddings: bool = False
    auto_start: bool = True


class CandidateReparseRequest(BaseModel):
    auto_start: bool = True


class LinkedInVerificationRequest(BaseModel):
    linkedin_url: str | None = None
    auto_start: bool = True


class LinkedInImportRequest(BaseModel):
    linkedin_url: str
    campaign_id: str | None = None
    note_name: str | None = None
    note_content: str | None = None
    auto_start: bool = True


@app.post("/auth/bootstrap")
def bootstrap(request: AuthRequest) -> dict:
    user = bootstrap_platform_admin(request.email, request.password, request.name, request.setup_token)
    return {"user": user}


@app.post("/auth/company-signup")
def auth_company_signup(request: CompanySignupRequest) -> dict:
    return create_self_service_company(
        company_name=request.company_name,
        owner_name=request.owner_name,
        owner_email=request.email,
        password=request.password,
    )


@app.post("/auth/login")
def auth_login(request: AuthRequest) -> dict:
    if (os.getenv("RESUME_INTEL_ENABLE_LEGACY_AUTH") or "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=410, detail="legacy FastAPI login is disabled; use Better Auth /api/auth/sign-in/email")
    return login(request.email, request.password)


@app.get("/auth/me")
def auth_me(user: dict = Depends(current_user)) -> dict:
    return {"user": user}


@app.post("/auth/platform/tenant-workspace/clear")
def auth_clear_tenant_workspace(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="missing bearer token")
    return clear_platform_tenant_workspace(credentials.credentials)


@app.post("/auth/platform/tenant-workspace/{tenant_id}")
def auth_select_tenant_workspace(tenant_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="missing bearer token")
    return select_platform_tenant_workspace(credentials.credentials, tenant_id)


@app.post("/auth/logout")
def auth_logout(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if credentials:
        logout(credentials.credentials)
    return {"ok": True}


@app.get("/candidates")
def candidates(user: dict = Depends(current_user)) -> dict:
    items = list_candidates_db(_tenant_id(user))
    if not _can_view_pii(user):
        items = [_redact_summary_pii(item) for item in items]
    else:
        _audit_bulk_pii_access(
            user,
            "list_candidates",
            ["candidate_email", "candidate_phone"],
            {"candidate_count": len(items)},
        )
    return {"candidates": items, "user": user}


@app.post("/candidates/semantic-search")
def semantic_search(request: SemanticSearchRequest, user: dict = Depends(current_user)) -> dict:
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="query is required")
    return {"results": semantic_candidate_scores(request.query, request.limit, tenant_id=_tenant_id(user)), "user": user}


@app.post("/candidates/search")
def candidate_search(request: SemanticSearchRequest, user: dict = Depends(current_user)) -> dict:
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="query is required")
    results = hybrid_candidate_search(request.query, request.limit, tenant_id=_tenant_id(user))
    if not _can_view_pii(user):
        results = [_redact_summary_pii(item) for item in results]
    else:
        _audit_search_pii_access(user, "candidate_search", request.query, results)
    return {"results": results, "user": user}


@app.get("/candidates/linkedin-imports")
def candidate_linkedin_imports(limit: int = Query(10, ge=1, le=50), user: dict = Depends(current_user)) -> dict:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="LinkedIn imports contain profile PII and require recruiter permission")
    return {"imports": latest_linkedin_imports(_tenant_id(user), limit), "user": user}


@app.get("/candidates/linkedin-imports/{import_id}")
def candidate_linkedin_import(import_id: str, user: dict = Depends(current_user)) -> dict:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="LinkedIn imports contain profile PII and require recruiter permission")
    job = get_linkedin_import_job(import_id, _tenant_id(user))
    if not job:
        raise HTTPException(status_code=404, detail="LinkedIn import not found")
    return {"import": job, "user": user}


@app.post("/candidates/linkedin-imports", status_code=202)
def import_candidate_from_linkedin(
    request: LinkedInImportRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="LinkedIn import requires recruiter PII permission")
    tenant_id = _tenant_id(user)
    try:
        job = enqueue_linkedin_import(
            tenant_id=tenant_id,
            user_id=user["id"],
            linkedin_url=request.linkedin_url,
            campaign_id=request.campaign_id,
            note_name=request.note_name,
            note_content=request.note_content,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if request.auto_start:
        background_tasks.add_task(run_linkedin_import, job["id"], tenant_id)
    return {"import": job, "user": user}


@app.get("/analytics/workspace")
def workspace_analytics(limit: int = Query(15, ge=1, le=50), user: dict = Depends(current_user)) -> dict:
    return {"analytics": tenant_workspace_analytics(_tenant_id(user), limit=limit), "user": user}


@app.get("/copilot/threads")
def copilot_threads(user: dict = Depends(current_user)) -> dict:
    return {"threads": list_copilot_threads(_tenant_id(user)), "user": user}


@app.post("/copilot/threads")
def copilot_thread_create(request: CopilotThreadRequest, user: dict = Depends(current_user)) -> dict:
    return {"thread": create_copilot_thread(_tenant_id(user), user["id"], request.title), "user": user}


@app.get("/copilot/threads/{thread_id}")
def copilot_thread_detail(thread_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        thread = get_copilot_thread(thread_id, _tenant_id(user))
        if not _can_view_pii(user):
            thread = _redact_copilot_thread_pii(thread)
        return {"thread": thread, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="copilot thread not found") from exc


@app.delete("/copilot/threads/{thread_id}")
def copilot_thread_archive(thread_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return {"thread": archive_copilot_thread(thread_id, _tenant_id(user), user["id"]), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="copilot thread not found") from exc


@app.post("/copilot/threads/{thread_id}/requirement-draft")
def copilot_thread_requirement_draft(thread_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    try:
        thread = get_copilot_thread(thread_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="copilot thread not found") from exc
    user_messages = [
        message["content"].strip()
        for message in thread.get("messages", [])
        if message.get("role") == "user" and message.get("content", "").strip()
    ]
    if not user_messages:
        raise HTTPException(status_code=400, detail="copilot thread has no recruiter requirement text")
    draft_text = f"Recruiter Copilot thread: {thread['title']}\n\n" + "\n\n".join(user_messages)
    requirement = create_requirement_from_text(draft_text, user["id"], load_settings(), tenant_id)
    if not _can_view_pii(user):
        thread = _redact_copilot_thread_pii(thread)
    return {"requirement": requirement, "thread": thread, "user": user}


@app.post("/copilot/chat")
def copilot_chat(request: CopilotChatRequest, user: dict = Depends(current_user)) -> dict:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    tenant_id = _tenant_id(user)
    limit = max(1, min(request.limit, 100))
    if request.thread_id:
        try:
            thread = get_copilot_thread(request.thread_id, tenant_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="copilot thread not found") from exc
    else:
        thread = create_copilot_thread(tenant_id, user["id"], message)
    append_copilot_message(tenant_id, thread["id"], user["id"], "user", message)
    query_intent = _public_copilot_query_intent(message)
    results = _copilot_candidate_results(message, tenant_id, limit)
    if not _can_view_pii(user):
        results = [_redact_summary_pii(item) for item in results]
    else:
        _audit_search_pii_access(user, "copilot_candidate_search", message, results)
    deterministic_answer = _build_copilot_answer(message, results)
    synthesis = synthesize_copilot_answer(
        tenant_id=tenant_id,
        user_id=user["id"],
        message=message,
        results=results,
        fallback_answer=deterministic_answer,
        settings=load_settings(),
    )
    answer = synthesis["answer"]
    clarifying_questions = _copilot_clarifying_questions(message)
    if synthesis.get("clarifying_questions"):
        clarifying_questions = list(dict.fromkeys([*synthesis["clarifying_questions"], *clarifying_questions]))[:4]
    suggested_actions = [
        "Open the strongest candidate and review the Evidence tab.",
        "Convert this search into a requirement if you need a ranked shortlist.",
        "Add recruiter notes to candidates when the search intent depends on soft signals.",
    ]
    if synthesis.get("suggested_actions"):
        suggested_actions = list(dict.fromkeys([*synthesis["suggested_actions"], *suggested_actions]))[:5]
    copilot_metadata = {
        "limit": limit,
        "returned_count": len(results),
        "synthesis_candidate_limit": COPILOT_SYNTHESIS_CANDIDATE_LIMIT,
        "synthesis_candidate_count": min(len(results), COPILOT_SYNTHESIS_CANDIDATE_LIMIT),
        "query_intent": query_intent,
        "synthesis": {key: value for key, value in synthesis.items() if key != "answer"},
    }
    append_copilot_message(
        tenant_id,
        thread["id"],
        None,
        "assistant",
        answer,
        query=message,
        candidates=results,
        clarifying_questions=clarifying_questions,
        suggested_actions=suggested_actions,
        metadata=copilot_metadata,
    )
    thread = get_copilot_thread(thread["id"], tenant_id)
    if not _can_view_pii(user):
        thread = _redact_copilot_thread_pii(thread)
    return {
        "answer": answer,
        "candidates": results,
        "clarifying_questions": clarifying_questions,
        "suggested_actions": suggested_actions,
        "query_intent": query_intent,
        "metadata": copilot_metadata,
        "synthesis_status": synthesis["status"],
        "synthesis_usage": synthesis.get("usage"),
        "thread": thread,
        "user": user,
    }


@app.get("/candidates/{document_id}")
def candidate(document_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        tenant_id = _tenant_id(user)
        raw_record = load_candidate_db(document_id, tenant_id)
        matches = list_matches_for_candidate(document_id, tenant_id)
        if not matches:
            live_matches = find_matches_for_record(raw_record, tenant_id=tenant_id)
            persist_matches(raw_record, live_matches, tenant_id)
            matches = list_matches_for_candidate(document_id, tenant_id)
        record = _public_candidate_for_user(raw_record, user)
        record["candidate_versions"] = {"matches": matches}
        record["reviewed_signals"] = reviewed_candidate_signals_db(document_id, tenant_id)
        if _can_view_pii(user):
            _audit_pii_access(user, document_id, _candidate_pii_fields(record), action="view_candidate_detail")
        return record
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc


@app.delete("/candidates/{document_id}")
def delete_candidate(document_id: str, reason: str = Query("removed_by_recruiter"), user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        deleted = soft_delete_candidate_db(document_id, _tenant_id(user), user["id"], reason)
        return {"candidate": deleted, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc


@app.patch("/candidates/{document_id}/profile")
def update_candidate_profile(document_id: str, request: CandidateProfileUpdateRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        tenant_id = _tenant_id(user)
        record = update_candidate_profile_db(document_id, user["id"], request.model_dump(exclude_unset=True), tenant_id)
        live_matches = find_matches_for_record(record, tenant_id=tenant_id)
        persist_matches(record, live_matches, tenant_id)
        matches = list_matches_for_candidate(document_id, tenant_id)
        record["candidate_versions"] = {"matches": matches}
        public_record = _public_candidate_for_user(record, user)
        public_record["reviewed_signals"] = reviewed_candidate_signals_db(document_id, tenant_id)
        return public_record
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc


@app.post("/candidates/{document_id}/review-signals/{signal_key}/reviewed")
def mark_candidate_review_signal(
    document_id: str,
    signal_key: str,
    request: CandidateReviewSignalRequest,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    try:
        review = mark_candidate_review_signal_db(document_id, _tenant_id(user), user["id"], signal_key, request.note)
        return {"review": review, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/candidates/{document_id}/linkedin/verification")
def candidate_linkedin_verification(document_id: str, user: dict = Depends(current_user)) -> dict:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="LinkedIn verification contains profile PII and requires recruiter permission")
    tenant_id = _tenant_id(user)
    try:
        load_candidate_db(document_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    return {"run": latest_linkedin_verification(document_id, tenant_id), "user": user}


@app.post("/candidates/{document_id}/linkedin/verify", status_code=202)
def verify_candidate_linkedin(
    document_id: str,
    request: LinkedInVerificationRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="LinkedIn verification requires recruiter PII permission")
    tenant_id = _tenant_id(user)
    try:
        run = enqueue_linkedin_verification(document_id, tenant_id, user["id"], request.linkedin_url)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if request.auto_start:
        background_tasks.add_task(run_linkedin_verification, run["id"], tenant_id)
    return {"run": run, "user": user}


@app.get("/candidates/{document_id}/source")
@app.get("/candidates/{document_id}/document-preview")
def candidate_source(document_id: str, user: dict = Depends(current_user)) -> FileResponse:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="PII/source CV access requires recruiter permission")
    try:
        metadata = candidate_document_metadata(document_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc

    resolved = _resolve_candidate_source_path(metadata)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="source file not found")
    _audit_pii_access(
        user,
        document_id,
        ["source_cv", "original_file"],
        action="view_original_cv",
        metadata={"filename": metadata.get("original_filename"), "mime_type": metadata.get("mime_type")},
    )
    return FileResponse(resolved, filename=metadata.get("original_filename") or resolved.name, media_type=metadata.get("mime_type"))


@app.get("/candidates/{document_id}/document-html")
def candidate_document_html(document_id: str, user: dict = Depends(current_user)) -> dict:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="PII/source CV access requires recruiter permission")
    try:
        metadata = candidate_document_metadata(document_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    resolved = _resolve_candidate_source_path(metadata)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="source file not found")
    filename = metadata.get("original_filename") or resolved.name
    suffix = Path(filename).suffix.lower() or resolved.suffix.lower()
    if suffix == ".docx":
        rendered_html = _docx_to_safe_html(resolved)
        _audit_pii_access(user, document_id, ["source_cv", "docx_preview"], action="view_document_html", metadata={"filename": filename})
        return {"filename": filename, "source_type": "docx", "html": rendered_html}
    if suffix in {".txt", ".md"}:
        rendered_html = f"<pre>{html.escape(resolved.read_text(errors='ignore'))}</pre>"
        _audit_pii_access(user, document_id, ["source_cv", "text_preview"], action="view_document_html", metadata={"filename": filename})
        return {"filename": filename, "source_type": suffix.lstrip('.'), "html": rendered_html}
    raise HTTPException(status_code=415, detail="HTML preview is only available for DOCX, TXT, and MD files")


@app.get("/candidates/{document_id}/raw-text", response_class=PlainTextResponse)
def candidate_raw_text(document_id: str, user: dict = Depends(current_user)) -> str:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="raw CV text access requires recruiter permission")
    try:
        raw_text = load_raw_text_db(document_id, _tenant_id(user))
        _audit_pii_access(user, document_id, ["raw_cv_text"], action="view_raw_text", metadata={"character_count": len(raw_text)})
        return raw_text
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc


@app.get("/candidates/{document_id}/pages")
def candidate_pages(document_id: str, user: dict = Depends(current_user)) -> dict:
    if not _can_view_pii(user):
        raise HTTPException(status_code=403, detail="page-level CV text access requires recruiter permission")
    try:
        load_candidate_db(document_id, _tenant_id(user))
        pages = list_document_pages_db(document_id, _tenant_id(user))
        _audit_pii_access(user, document_id, ["page_level_cv_text"], action="view_page_text", metadata={"page_count": len(pages)})
        return {"pages": pages}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc


@app.post("/candidates/{document_id}/reparse", status_code=202)
def candidate_reparse(
    document_id: str,
    request: CandidateReparseRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    tenant_id = _tenant_id(user)
    try:
        result = create_reparse_job_for_candidate(document_id, tenant_id, user["id"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="stored source document not found for this candidate") from exc
    if request.auto_start:
        background_tasks.add_task(run_job, result["job"]["id"], tenant_id)
    return result | {"user": user}


@app.post("/upload", status_code=202)
def upload_resume(
    file: UploadFile = File(...),
    note_name: str = Form("HR Notes"),
    note: str = Form(""),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    suffix = Path(file.filename or "resume.pdf").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="unsupported file type")
    _validate_upload_size(file)
    try:
        batch = create_parse_batch(
            tenant_id,
            user["id"],
            [(file.filename or f"resume{suffix}", file.file)],
            f"Single resume upload - {Path(file.filename or f'resume{suffix}').name}",
            note_name,
            note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job = batch["jobs"][0] if batch.get("jobs") else None
    return {"batch": batch, "job": job, "message": "resume queued for deep parsing"}


@app.post("/resumes/upload", status_code=202)
def upload_resume_alias(
    file: UploadFile = File(...),
    note_name: str = Form("HR Notes"),
    note: str = Form(""),
    user: dict = Depends(current_user),
) -> dict:
    return upload_resume(file, note_name, note, user)


def _schedule_candidate_search_reindex(background_tasks: BackgroundTasks, document_id: str, tenant_id: str) -> None:
    background_tasks.add_task(_reindex_candidate_search_safe, document_id, tenant_id)


def _reindex_candidate_search_safe(document_id: str, tenant_id: str) -> None:
    try:
        reindex_candidate_search_db(document_id, tenant_id)
    except Exception as exc:
        http_logger.exception(
            "candidate_search_reindex_failed",
            extra={
                "document_id": document_id,
                "tenant_id": tenant_id,
                "error_type": exc.__class__.__name__,
            },
        )


@app.post("/candidates/{document_id}/notes")
def create_note(
    document_id: str,
    request: NoteRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="note content is required")
    try:
        tenant_id = _tenant_id(user)
        record = add_note_db(
            document_id,
            user["id"],
            request.name,
            request.content,
            tenant_id,
            visibility=request.visibility,
            note_type=request.note_type,
            campaign_id=request.campaign_id,
            reindex_search=False,
        )
        _schedule_candidate_search_reindex(background_tasks, document_id, tenant_id)
        return _public_candidate_for_user(record, user)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/candidates/{document_id}/notes/{note_id}")
def update_note(
    document_id: str,
    note_id: str,
    request: NoteRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="note content is required")
    try:
        tenant_id = _tenant_id(user)
        record = update_note_db(
            document_id,
            note_id,
            user["id"],
            request.name,
            request.content,
            tenant_id,
            visibility=request.visibility,
            note_type=request.note_type,
            campaign_id=request.campaign_id,
            can_manage_any_note=_can_manage_recruiter_notes(user),
            reindex_search=False,
        )
        _schedule_candidate_search_reindex(background_tasks, document_id, tenant_id)
        return _public_candidate_for_user(record, user)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate or note not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/candidates/{document_id}/notes/{note_id}")
def delete_note(
    document_id: str,
    note_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    try:
        tenant_id = _tenant_id(user)
        record = delete_note_db(
            document_id,
            note_id,
            user["id"],
            tenant_id,
            can_manage_any_note=_can_manage_recruiter_notes(user),
            reindex_search=False,
        )
        _schedule_candidate_search_reindex(background_tasks, document_id, tenant_id)
        return _public_candidate_for_user(record, user)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate or note not found") from exc


@app.get("/collaboration/comments")
def collaboration_comments(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    user: dict = Depends(current_user),
) -> dict:
    try:
        comments = list_collaboration_comments(_tenant_id(user), user["id"], entity_type, entity_id)
        return {"comments": comments, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="collaboration entity not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/collaboration/comments")
def collaboration_comment_create(request: CollaborationCommentRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        comment = create_collaboration_comment(
            _tenant_id(user),
            user["id"],
            request.entity_type,
            request.entity_id,
            request.body,
            request.visibility,
            request.metadata,
        )
        return {"comment": comment, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="collaboration entity not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/collaboration/comments/{comment_id}")
def collaboration_comment_delete(comment_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return delete_collaboration_comment(_tenant_id(user), user["id"], comment_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="comment not found") from exc


@app.get("/collaboration/tasks")
def collaboration_tasks(
    status: str | None = Query(None),
    assignee: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    user: dict = Depends(current_user),
) -> dict:
    try:
        tasks = list_recruiter_tasks(
            _tenant_id(user),
            user["id"],
            status=status,
            assignee=assignee,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        return {"tasks": tasks, "user": user}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/collaboration/tasks")
def collaboration_task_create(request: RecruiterTaskRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        task = create_recruiter_task(
            _tenant_id(user),
            user["id"],
            request.entity_type,
            request.entity_id,
            request.title,
            body=request.body,
            assignee_user_id=request.assignee_user_id,
            due_at=request.due_at,
            priority=request.priority,
            metadata=request.metadata,
        )
        return {"task": task, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="collaboration entity or assignee not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/collaboration/tasks/{task_id}")
def collaboration_task_update(task_id: str, request: RecruiterTaskUpdateRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        task = update_recruiter_task(
            _tenant_id(user),
            user["id"],
            task_id,
            title=request.title,
            body=request.body,
            status=request.status,
            assignee_user_id=request.assignee_user_id,
            due_at=request.due_at,
            priority=request.priority,
        )
        return {"task": task, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task or assignee not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/collaboration/tasks/{task_id}")
def collaboration_task_delete(task_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return delete_recruiter_task(_tenant_id(user), user["id"], task_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc


@app.get("/collaboration/notifications")
def collaboration_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    user: dict = Depends(current_user),
) -> dict:
    notifications = list_recruiter_notifications(_tenant_id(user), user["id"], unread_only=unread_only, limit=limit)
    return {"notifications": notifications, "user": user}


@app.post("/collaboration/notifications/{notification_id}/read")
def collaboration_notification_read(notification_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        notification = mark_recruiter_notification_read(_tenant_id(user), user["id"], notification_id)
        return {"notification": notification, "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="notification not found") from exc


@app.get("/collaboration/saved-views")
def collaboration_saved_views(view_type: str | None = Query(None), user: dict = Depends(current_user)) -> dict:
    try:
        views = list_workspace_views(_tenant_id(user), user["id"], view_type=view_type)
        return {"views": views, "user": user}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/collaboration/saved-views")
def collaboration_saved_view_create(request: SavedWorkspaceViewRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        view = save_workspace_view(
            _tenant_id(user),
            user["id"],
            request.name,
            request.view_type,
            query=request.query,
            filters=request.filters,
            visibility=request.visibility,
        )
        return {"view": view, "user": user}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/collaboration/saved-views/{view_id}")
def collaboration_saved_view_delete(view_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return delete_workspace_view(_tenant_id(user), user["id"], view_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="saved view not found") from exc


@app.get("/candidates/{document_id}/entity-resolution")
def candidate_versions_for_candidate_legacy(document_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidates/{document_id}/candidate-versions",
    )


@app.get("/candidates/{document_id}/candidate-versions")
def candidate_versions_for_candidate(document_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        tenant_id = _tenant_id(user)
        record = load_candidate_db(document_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="candidate not found") from exc
    matches = list_matches_for_candidate(document_id, tenant_id)
    if not matches:
        live_matches = find_matches_for_record(record, tenant_id=tenant_id)
        persist_matches(record, live_matches, tenant_id)
        matches = list_matches_for_candidate(document_id, tenant_id)
    return {"matches": matches, "requirements": candidate_version_requirements(), "user": user}


@app.get("/entity-resolution/requirements")
def resolution_requirements(user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidate-versions/requirements",
    )


@app.get("/candidate-versions/requirements")
def version_requirements(user: dict = Depends(current_user)) -> dict:
    return candidate_version_requirements()


@app.get("/entity-resolution/clusters")
def resolution_clusters(user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidate-versions/clusters",
    )


@app.get("/candidate-versions/clusters")
def version_clusters(user: dict = Depends(current_user)) -> dict:
    return {"clusters": list_clusters(_tenant_id(user)), "user": user}


@app.post("/entity-resolution/{match_id}/same-person")
def same_person(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="same-person decisions are retired; use /candidate-versions/{match_id}/versioned",
    )


@app.post("/entity-resolution/{match_id}/not-same-person")
def not_same_person(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="not-same-person decisions are retired; use /candidate-versions/{match_id}/separate",
    )


@app.post("/entity-resolution/{match_id}/versioned")
def versioned_candidate(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidate-versions/{match_id}/versioned",
    )


@app.post("/candidate-versions/{match_id}/versioned")
def mark_candidate_versions(match_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return decide_match(match_id, "versioned", user["id"], _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match not found") from exc


@app.post("/entity-resolution/{match_id}/separate")
def separate_candidate_versions(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidate-versions/{match_id}/separate",
    )


@app.post("/candidate-versions/{match_id}/separate")
def keep_candidate_versions_separate(match_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return decide_match(match_id, "separate", user["id"], _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match not found") from exc


@app.post("/entity-resolution/{match_id}/review-later")
def review_later(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="entity resolution is retired; use /candidate-versions/{match_id}/review-later",
    )


@app.post("/candidate-versions/{match_id}/review-later")
def review_candidate_versions_later(match_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return decide_match(match_id, "review_later", user["id"], _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match not found") from exc


@app.post("/entity-resolution/{match_id}/merge")
def merge_entity(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="candidate merging is disabled; upload copies are preserved as candidate versions",
    )


@app.post("/candidate-versions/{match_id}/merge")
def merge_candidate_versions(match_id: str, user: dict = Depends(current_user)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="candidate merging is disabled; upload copies are preserved as candidate versions",
    )


@app.get("/requirements")
def requirements(user: dict = Depends(current_user)) -> dict:
    return {"requirements": list_requirements(_tenant_id(user)), "user": user}


@app.post("/requirements")
def create_requirement(request: RequirementTextRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="requirement text is required")
    return create_requirement_from_text(request.text, user["id"], load_settings(), _tenant_id(user))


@app.post("/requirements/upload")
def upload_requirement(file: UploadFile = File(...), user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    input_dir, _, work_dir = _tenant_dirs(tenant_id)
    input_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "requirement.pdf").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="unsupported file type")
    target = input_dir / Path(file.filename or f"requirement{suffix}").name
    with target.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    return create_requirement_from_file(target, user["id"], load_settings(), work_dir, tenant_id)


@app.get("/requirements/{requirement_id}")
def requirement(requirement_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return get_requirement(requirement_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="requirement not found") from exc


@app.post("/requirements/{requirement_id}/clarify")
def clarify(requirement_id: str, request: ClarifyRequest, user: dict = Depends(current_user)) -> dict:
    try:
        return clarify_requirement(requirement_id, request.answers, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="requirement not found") from exc


@app.post("/requirements/{requirement_id}/finalize")
def finalize(requirement_id: str, request: ClarifyRequest, user: dict = Depends(current_user)) -> dict:
    try:
        return finalize_requirement(requirement_id, request.answers, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="requirement not found") from exc


@app.post("/requirements/{requirement_id}/match")
def match(requirement_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return {"matches": match_requirement(requirement_id, _tenant_id(user))}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="requirement not found") from exc


@app.get("/requirements/{requirement_id}/matches")
def requirement_matches(requirement_id: str, user: dict = Depends(current_user)) -> dict:
    return {"matches": get_matches(requirement_id, _tenant_id(user))}


@app.get("/requirements/{requirement_id}/match-runs")
def requirement_match_runs(requirement_id: str, user: dict = Depends(current_user)) -> dict:
    return {"runs": list_match_runs(requirement_id, _tenant_id(user))}


@app.get("/requirements/{requirement_id}/match-runs/{run_id}")
def requirement_match_run(requirement_id: str, run_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return get_match_run(requirement_id, run_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match run not found") from exc


@app.get("/requirements/{requirement_id}/match-runs/compare/latest")
def requirement_match_run_compare_latest(requirement_id: str, user: dict = Depends(current_user)) -> dict:
    return compare_match_runs(requirement_id, tenant_id=_tenant_id(user))


@app.post("/requirements/{requirement_id}/matches/{candidate_id}/shortlist")
def shortlist_match(requirement_id: str, candidate_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return set_match_status(requirement_id, candidate_id, "shortlisted", _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match not found") from exc


@app.post("/requirements/{requirement_id}/matches/{candidate_id}/reject")
def reject_match(requirement_id: str, candidate_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return set_match_status(requirement_id, candidate_id, "rejected", _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="match not found") from exc


@app.get("/campaigns")
def campaigns(user: dict = Depends(current_user)) -> dict:
    return {"campaigns": list_campaigns(_tenant_id(user)), "user": user}


@app.post("/campaigns")
def create_job_campaign(request: CampaignRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return create_campaign(_tenant_id(user), user["id"], request.name, request.description, request.requirement_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/campaigns/{campaign_id}")
def update_job_campaign(campaign_id: str, request: CampaignUpdateRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        campaign = update_campaign(
            campaign_id,
            _tenant_id(user),
            user["id"],
            name=request.name,
            description=request.description,
            status=request.status,
            requirement_id=request.requirement_id,
            unlink_requirement=request.unlink_requirement,
        )
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return campaign
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign or requirement not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/campaigns/{campaign_id}")
def job_campaign(campaign_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        campaign = get_campaign(campaign_id, _tenant_id(user))
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return campaign
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc


@app.delete("/campaigns/{campaign_id}")
def delete_job_campaign(campaign_id: str, request: CampaignDeleteRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    if request.confirmation not in {"archive", "delete"}:
        raise HTTPException(status_code=400, detail="type archive to confirm campaign archive")
    try:
        return soft_delete_campaign(
            campaign_id,
            _tenant_id(user),
            user["id"],
            reason=request.reason,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc


@app.post("/campaigns/{campaign_id}/requirement")
def create_campaign_requirement(campaign_id: str, request: CampaignRequirementTextRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        campaign = create_campaign_requirement_from_text(campaign_id, _tenant_id(user), user["id"], request.text)
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return campaign
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/campaigns/{campaign_id}/requirement/upload")
def upload_campaign_requirement(campaign_id: str, file: UploadFile = File(...), user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    try:
        get_campaign(campaign_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc
    input_dir, _, work_dir = _tenant_dirs(tenant_id)
    input_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "requirement.pdf").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="unsupported file type")
    safe_name = Path(file.filename or f"campaign-requirement{suffix}").name
    target = input_dir / f"campaign-requirement-{uuid.uuid4().hex[:10]}-{safe_name}"
    with target.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    requirement = create_requirement_from_file(target, user["id"], load_settings(), work_dir, tenant_id)
    campaign = attach_campaign_requirement(campaign_id, tenant_id, user["id"], requirement)
    if not _can_view_pii(user):
        campaign = _redact_campaign_pii(campaign)
    return campaign


@app.patch("/campaigns/{campaign_id}/scorecard")
def save_campaign_scorecard(campaign_id: str, request: CampaignScorecardRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        campaign = update_campaign_scorecard(campaign_id, _tenant_id(user), user["id"], request.model_dump())
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return campaign
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/campaigns/{campaign_id}/match", status_code=202)
def match_job_campaign(campaign_id: str, request: CampaignMatchRequest | None = None, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        request = request or CampaignMatchRequest()
        job = create_campaign_match_job(campaign_id, _tenant_id(user), user["id"], mode=request.mode, candidate_ids=request.candidate_ids)
        campaign = get_campaign(campaign_id, _tenant_id(user))
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return {"job": job, "campaign": campaign}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/campaigns/{campaign_id}/match-jobs")
def campaign_match_jobs(campaign_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        get_campaign(campaign_id, _tenant_id(user))
        return {"jobs": list_campaign_match_jobs(campaign_id, _tenant_id(user))}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc


@app.get("/campaigns/{campaign_id}/match-jobs/{job_id}")
def campaign_match_job(campaign_id: str, job_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        job = get_campaign_match_job(job_id, _tenant_id(user))
        if job["campaign_id"] != campaign_id:
            raise FileNotFoundError(job_id)
        campaign = get_campaign(campaign_id, _tenant_id(user))
        if not _can_view_pii(user):
            campaign = _redact_campaign_pii(campaign)
        return {"job": job, "campaign": campaign}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign match job not found") from exc


@app.post("/campaigns/{campaign_id}/match-jobs/{job_id}/retry")
def retry_campaign_match(campaign_id: str, job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        existing = get_campaign_match_job(job_id, _tenant_id(user))
        if existing["campaign_id"] != campaign_id:
            raise FileNotFoundError(job_id)
        job = retry_campaign_match_job(job_id, _tenant_id(user))
        return {"job": job}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign match job not found") from exc


@app.post("/campaigns/{campaign_id}/match-jobs/{job_id}/cancel")
def cancel_campaign_match(campaign_id: str, job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        existing = get_campaign_match_job(job_id, _tenant_id(user))
        if existing["campaign_id"] != campaign_id:
            raise FileNotFoundError(job_id)
        job = cancel_campaign_match_job(job_id, _tenant_id(user))
        return {"job": job}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign match job not found") from exc


@app.post("/campaigns/{campaign_id}/resumes", status_code=202)
def upload_campaign_resumes(
    campaign_id: str,
    files: list[UploadFile] = File(...),
    context_note: str = Form(""),
    batch_name: str = Form(""),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    try:
        campaign = get_campaign(campaign_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign not found") from exc
    for file in files:
        suffix = Path(file.filename or "resume.pdf").suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"unsupported file type: {file.filename}")
        _validate_upload_size(file)
    try:
        batch = create_parse_batch(
            tenant_id,
            user["id"],
            [(file.filename or "resume.pdf", file.file) for file in files],
            batch_name.strip() or _auto_batch_name(files, prefix=f"Campaign upload - {campaign['name']}"),
            initial_note_name="Upload Context" if context_note.strip() else None,
            initial_note_content=context_note,
            campaign_id=campaign_id,
            context_note=context_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    campaign = get_campaign(campaign_id, tenant_id)
    if not _can_view_pii(user):
        campaign = _redact_campaign_pii(campaign)
    return {"campaign": campaign, "batch": batch}


@app.post("/campaigns/{campaign_id}/candidates/{candidate_id}/status")
def update_campaign_candidate_status(
    campaign_id: str,
    candidate_id: str,
    request: CampaignCandidateStatusRequest,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    try:
        return set_campaign_candidate_status(campaign_id, candidate_id, request.status, _tenant_id(user), user["id"], request.note)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="campaign candidate not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/admin/tenants")
def admin_tenants(user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    return {"tenants": list_tenants(), "user": user}


@app.post("/admin/tenants")
def admin_create_tenant(request: TenantRequest, background_tasks: BackgroundTasks, user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    validate_tenant_creation_request(request.name, request.seat_limit, request.owner_email, request.owner_role)
    result = create_tenant_with_owner_invitation(
        request.name,
        request.seat_limit,
        user["id"],
        request.owner_email,
        request.owner_role,
    )
    invitation = result.get("owner_invitation")
    if invitation and invitation.get("invite_token"):
        invitation["mail_delivery"] = _queue_invitation_mail(
            invitation,
            invitation["invite_token"],
            tenant_name=result.get("tenant", {}).get("name") or request.name,
            actor_name=user.get("name") or user.get("email"),
            message_type="tenant_owner_invitation",
            background_tasks=background_tasks,
        )
    return result


@app.get("/admin/tenants/{tenant_id}")
def admin_tenant(tenant_id: str, user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    try:
        return tenant_admin_detail(tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="tenant not found") from exc


@app.get("/admin/audit-logs")
def admin_audit_logs(
    tenant_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(current_user),
) -> dict:
    require_platform_admin(user)
    return {"audit_events": list_audit_logs(tenant_id=tenant_id, action=action, limit=limit), "user": user}


@app.post("/admin/tenants/{tenant_id}/disable")
def admin_disable_tenant(tenant_id: str, user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    try:
        return {"tenant": set_tenant_status(tenant_id, "disabled", user["id"])}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="tenant not found") from exc


@app.post("/admin/tenants/{tenant_id}/reactivate")
def admin_reactivate_tenant(tenant_id: str, user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    try:
        return {"tenant": set_tenant_status(tenant_id, "active", user["id"])}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="tenant not found") from exc


@app.get("/team")
def team(user: dict = Depends(current_user)) -> dict:
    tenant_id = _tenant_id(user)
    can_manage_team = user.get("tenant_role") in {"tenant_owner", "tenant_admin"}
    return {
        "tenant": {"id": tenant_id, "name": user.get("tenant_name")},
        "members": list_members(tenant_id) if can_manage_team else [],
        "invitations": list_invitations(tenant_id) if can_manage_team else [],
        "governance_policy": get_tenant_governance_policy(tenant_id),
        "pii_access_events": list_pii_access_events(tenant_id, limit=50) if can_manage_team else [],
        "user": user,
    }


@app.patch("/team/governance-policy")
def patch_team_governance_policy(request: GovernancePolicyRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    tenant_id = _tenant_id(user)
    return {
        "governance_policy": update_tenant_governance_policy(
            tenant_id,
            user["id"],
            external_llm_synthesis_enabled=request.external_llm_synthesis_enabled,
            redact_pii_before_external_llm=request.redact_pii_before_external_llm,
            contact_pii_visible_to_roles=request.contact_pii_visible_to_roles,
        ),
        "user": user,
    }


@app.get("/team/pii-access-events")
def team_pii_access_events(
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    tenant_id = _tenant_id(user)
    return {"pii_access_events": list_pii_access_events(tenant_id, limit=limit), "user": user}


@app.post("/team/invitations")
def invite_member(request: InviteRequest, background_tasks: BackgroundTasks, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    invitation = create_invitation(_tenant_id(user), request.email, request.role, user["id"])
    invitation["mail_delivery"] = _queue_invitation_mail(
        invitation,
        invitation["invite_token"],
        tenant_name=user.get("tenant_name") or "your company",
        actor_name=user.get("name") or user.get("email"),
        message_type="team_invitation",
        background_tasks=background_tasks,
    )
    return invitation


@app.post("/team/invitations/{invitation_id}/resend")
def resend_member_invite(invitation_id: str, background_tasks: BackgroundTasks, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        invitation = resend_invitation(_tenant_id(user), invitation_id, user["id"])
        invitation["mail_delivery"] = _queue_invitation_mail(
            invitation,
            invitation["invite_token"],
            tenant_name=user.get("tenant_name") or "your company",
            actor_name=user.get("name") or user.get("email"),
            message_type="team_invitation_resend",
            background_tasks=background_tasks,
        )
        return invitation
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="invitation not found") from exc


@app.get("/mail/messages")
def mail_messages(
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"mail_messages": list_mail_messages(_tenant_id(user), limit=limit), "user": user}


@app.post("/mail/messages/{message_id}/retry")
def retry_mail_delivery(message_id: str, background_tasks: BackgroundTasks, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        message = retry_mail_message(message_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="mail message not found or not retryable") from exc
    background_tasks.add_task(send_mail_message_safe, message["id"])
    return {"mail_message": message, "user": user}


@app.post("/team/invitations/{invitation_id}/cancel")
def cancel_member_invite(invitation_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        return cancel_invitation(_tenant_id(user), invitation_id, user["id"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="invitation not found") from exc


@app.post("/team/invitations/accept")
def accept_invite(request: AcceptInviteRequest) -> dict:
    return accept_invitation(request.token, request.name, request.password)


@app.post("/team/members/{membership_id}/role")
def change_member_role(membership_id: str, request: MemberRoleRequest, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        return update_member_role(_tenant_id(user), membership_id, request.role, user["id"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="member not found") from exc


@app.post("/team/members/{membership_id}/disable")
def disable_member(membership_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        return deactivate_member(_tenant_id(user), membership_id, user["id"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="member not found") from exc


@app.post("/resumes/bulk-upload", status_code=202)
def bulk_upload_resumes(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    batch_name: str = Form(""),
    context_note: str = Form(""),
    auto_start: bool = Form(False),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    for file in files:
        suffix = Path(file.filename or "resume.pdf").suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"unsupported file type: {file.filename}")
        _validate_upload_size(file)
    try:
        batch = create_parse_batch(
            tenant_id,
            user["id"],
            [(file.filename or "resume.pdf", file.file) for file in files],
            batch_name.strip() or _auto_batch_name(files),
            initial_note_name="Upload Context" if context_note.strip() else None,
            initial_note_content=context_note,
            context_note=context_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if auto_start:
        for job in batch["jobs"]:
            background_tasks.add_task(run_job, job["id"], tenant_id)
    return {"batch": batch}


@app.get("/parse-batches")
def parse_batches(user: dict = Depends(current_user)) -> dict:
    return {"batches": list_parse_batches(_tenant_id(user)), "user": user}


@app.get("/parse-batches/{batch_id}")
def parse_batch(batch_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return get_parse_batch(batch_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="batch not found") from exc


@app.get("/parse-jobs/{job_id}")
def parse_job(job_id: str, user: dict = Depends(current_user)) -> dict:
    try:
        return get_parse_job(job_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="parse job not found") from exc


@app.post("/parse-jobs/{job_id}/retry")
def retry_parse_job(job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    tenant_id = _tenant_id(user)
    try:
        job = retry_job(job_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="parse job not found") from exc
    return {"queued": True, "job": job}


@app.post("/parse-jobs/{job_id}/cancel")
def cancel_parse_job(job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return cancel_job(job_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="parse job not found or not cancellable") from exc


@app.post("/parse-batches/{batch_id}/cancel")
def cancel_parse_batch(batch_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return cancel_batch(batch_id, _tenant_id(user))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="batch not found or not cancellable") from exc


@app.post("/parse-worker/run-next")
def parse_worker_run_next(user: dict = Depends(current_user)) -> dict:
    require_platform_admin(user)
    job = run_next_job()
    return {"job": job}


@app.get("/parse-worker/status")
def parse_worker_status(user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    return get_worker_status(_tenant_id(user))


@app.get("/maintenance/candidate-rederive-jobs")
def candidate_rederive_jobs(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"jobs": list_candidate_maintenance_jobs(_tenant_id(user), limit=limit), "user": user}


@app.post("/maintenance/candidates/rederive", status_code=202)
def create_candidate_rederive(
    request: CandidateMaintenanceRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    tenant_id = _tenant_id(user)
    try:
        job = create_candidate_rederive_job(tenant_id, user["id"], refresh_embeddings=request.refresh_embeddings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if request.auto_start:
        background_tasks.add_task(run_candidate_rederive_job, job["id"], tenant_id)
    return {"job": job}


@app.get("/maintenance/candidate-rederive-jobs/{job_id}")
def candidate_rederive_job(job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        return {"job": get_candidate_maintenance_job(job_id, _tenant_id(user)), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="maintenance job not found") from exc


@app.post("/maintenance/candidate-rederive-jobs/{job_id}/retry", status_code=202)
def retry_candidate_rederive_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    tenant_id = _tenant_id(user)
    try:
        job = retry_candidate_maintenance_job(job_id, tenant_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="maintenance job not found or not retryable") from exc
    background_tasks.add_task(run_candidate_rederive_job, job["id"], tenant_id)
    return {"job": job}


@app.post("/maintenance/candidate-rederive-jobs/{job_id}/cancel")
def cancel_candidate_rederive_job(job_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_admin(user)
    try:
        return {"job": cancel_candidate_maintenance_job(job_id, _tenant_id(user)), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="maintenance job not found or not cancellable") from exc




def _tenant_id(user: dict) -> str:
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="tenant membership required")
    return tenant_id


def _queue_invitation_mail(
    invitation: dict,
    invite_token: str,
    *,
    tenant_name: str,
    actor_name: str | None,
    message_type: str,
    background_tasks: BackgroundTasks,
) -> dict:
    draft = build_invitation_mail(
        invitation=invitation,
        invite_token=invite_token,
        tenant_name=tenant_name,
        actor_name=actor_name,
        message_type=message_type,
    )
    message = queue_mail(draft)
    if message["status"] == "queued":
        background_tasks.add_task(send_mail_message_safe, message["id"])
    return message


def _auto_batch_name(files: list[UploadFile], *, prefix: str = "Resume upload") -> str:
    count = len(files)
    first_name = Path(files[0].filename or "resume").stem if files else "resumes"
    if count == 1:
        return f"{prefix} - {first_name[:60]}"
    return f"{prefix} - {count} files - {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"


def _can_view_pii(user: dict) -> bool:
    tenant_id = user.get("tenant_id")
    return bool(tenant_id and role_can_view_contact_pii(tenant_id, user.get("tenant_role")))


def _can_manage_recruiter_notes(user: dict) -> bool:
    return user.get("tenant_role") in {"tenant_owner", "tenant_admin"}


def _public_candidate_for_user(record: dict, user: dict) -> dict:
    public = public_candidate_record(record, allow_pii=_can_view_pii(user))
    public["notes"] = _visible_notes_for_user(public.get("notes"), user)
    return public


def _visible_notes_for_user(notes: Any, user: dict) -> list[dict]:
    if not isinstance(notes, list):
        return []
    user_id = str(user.get("id") or "")
    visible: list[dict] = []
    for note in notes:
        if not isinstance(note, dict):
            continue
        if note.get("visibility") == "private" and str(note.get("user_id") or "") != user_id:
            continue
        visible.append(note)
    return visible


def _redact_summary_pii(item: dict) -> dict:
    redacted = redact_contact_pii_payload(dict(item))
    candidate_name = str(redacted.get("name") or "").strip()
    if redacted.get("email"):
        redacted["email"] = "[redacted]"
    if redacted.get("phone"):
        redacted["phone"] = "[redacted]"
    evidence = []
    for chunk in redacted.get("evidence") or []:
        if not isinstance(chunk, dict):
            evidence.append(chunk)
            continue
        clone = dict(chunk)
        if clone.get("chunk_type") == "contact_pii":
            clone["snippet"] = "[PII evidence redacted]"
        elif clone.get("snippet"):
            clone["snippet"] = redact_contact_pii_text(clone.get("snippet"), names=[candidate_name])
        evidence.append(clone)
    if evidence:
        redacted["evidence"] = evidence
    return redacted


def _redact_campaign_pii(campaign: dict) -> dict:
    redacted = dict(campaign)
    candidates = []
    for item in campaign.get("candidates") or []:
        if not isinstance(item, dict):
            candidates.append(item)
            continue
        clone = dict(item)
        candidate = clone.get("candidate")
        if isinstance(candidate, dict):
            clone["candidate"] = _redact_summary_pii(candidate)
        candidates.append(clone)
    if "candidates" in campaign:
        redacted["candidates"] = candidates
    return redacted


def _redact_copilot_thread_pii(thread: dict) -> dict:
    redacted = dict(thread)
    messages = []
    for item in thread.get("messages") or []:
        if not isinstance(item, dict):
            messages.append(item)
            continue
        clone = dict(item)
        clone["candidates"] = [
            _redact_summary_pii(candidate) if isinstance(candidate, dict) else candidate
            for candidate in (item.get("candidates") or [])
        ]
        messages.append(clone)
    if "messages" in thread:
        redacted["messages"] = messages
    return redacted


def _candidate_pii_fields(record: dict) -> list[str]:
    fields = []
    contact = record.get("contact") or {}
    if contact.get("email"):
        fields.append("email")
    if contact.get("phone"):
        fields.append("phone")
    if contact.get("links"):
        fields.append("links")
    pii = (record.get("derived") or {}).get("pii_contact_intelligence") or {}
    for key in ("linkedin_urls", "github_urls", "portfolio_websites", "all_urls"):
        if pii.get(key):
            fields.append(key)
    return sorted(set(fields))


def _audit_pii_access(
    user: dict,
    document_id: str | None,
    fields: list[str],
    *,
    action: str,
    metadata: dict | None = None,
) -> None:
    if not fields:
        return
    with db() as conn:
        conn.execute(
            """
            insert into pii_access_events (tenant_id, user_id, document_id, fields, action, metadata)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (_tenant_id(user), user["id"], document_id, Jsonb(sorted(set(fields))), action, Jsonb(metadata or {})),
        )
        conn.commit()


def _audit_bulk_pii_access(user: dict, action: str, fields: list[str], metadata: dict | None = None) -> None:
    _audit_pii_access(user, None, fields, action=action, metadata=metadata)


def _audit_search_pii_access(user: dict, action: str, query: str, results: list[dict]) -> None:
    fields = set()
    for item in results:
        if item.get("email"):
            fields.add("candidate_email")
        if item.get("phone"):
            fields.add("candidate_phone")
        for evidence in item.get("evidence") or []:
            if isinstance(evidence, dict) and evidence.get("chunk_type") == "contact_pii":
                fields.add("contact_pii_evidence")
    if fields:
        _audit_pii_access(
            user,
            None,
            sorted(fields),
            action=action,
            metadata={"query_preview": query[:160], "result_count": len(results)},
        )


def _validate_upload_size(file: UploadFile) -> None:
    current = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(current)
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"{file.filename or 'upload'} exceeds 25 MB upload limit")


def _tenant_dirs(tenant_id: str) -> tuple[Path, Path, Path]:
    tenant_root = DATA_DIR / "tenants" / tenant_id
    return tenant_root / "input", tenant_root / "output", tenant_root / "work"


def _resolve_candidate_source_path(metadata: dict) -> Path:
    storage_key = metadata.get("storage_key")
    if storage_key:
        validate_tenant_storage_key(storage_key, metadata.get("tenant_id"))
        return document_storage(metadata.get("storage_backend") or "local").open_for_preview(storage_key).resolve()
    source_file = metadata.get("source_file")
    if not source_file:
        raise HTTPException(status_code=404, detail="source file not found")
    path = Path(source_file)
    if not path.is_absolute():
        path = ROOT / path
    try:
        resolved = path.resolve()
        resolved.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="source file is outside the project") from exc
    return resolved


def _docx_to_safe_html(path: Path) -> str:
    document = Document(str(path))
    parts: list[str] = ['<article class="docxDocument">']
    for block in _iter_docx_blocks(document):
        if isinstance(block, Paragraph):
            rendered = _render_docx_paragraph(block)
        elif isinstance(block, Table):
            rendered = _render_docx_table(block)
        else:
            rendered = ""
        if rendered:
            parts.append(rendered)
    parts.append("</article>")
    if len(parts) <= 2:
        return '<article class="docxDocument"><p>No readable DOCX content was found.</p></article>'
    return "".join(parts)


def _iter_docx_blocks(parent: Any) -> Any:
    parent_element = parent.element.body if hasattr(parent.element, "body") else parent._tc
    for child in parent_element.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def _render_docx_table(table: Table) -> str:
    parts = ["<table>"]
    for row_index, row in enumerate(table.rows):
        parts.append("<tr>")
        for cell in row.cells:
            tag = "th" if row_index == 0 else "td"
            text_paragraphs = [paragraph for paragraph in cell.paragraphs if paragraph.text.strip()]
            if len(text_paragraphs) == 1 and _is_plain_docx_paragraph(text_paragraphs[0]):
                cell_html = html.escape(text_paragraphs[0].text.strip())
            else:
                cell_parts: list[str] = []
                for paragraph in text_paragraphs:
                    rendered = _render_docx_paragraph(paragraph)
                    if rendered:
                        cell_parts.append(rendered)
                cell_html = "".join(cell_parts) or html.escape(cell.text.strip())
            parts.append(f"<{tag}>{cell_html}</{tag}>")
        parts.append("</tr>")
    parts.append("</table>")
    return "".join(parts)


def _is_plain_docx_paragraph(paragraph: Any) -> bool:
    style = (paragraph.style.name if paragraph.style else "").lower()
    if style and style not in {"normal"}:
        return False
    return not any(run.bold or run.italic or run.underline for run in paragraph.runs)


def _render_docx_paragraph(paragraph: Any) -> str:
    text = paragraph.text.strip()
    if not text:
        return ""
    style = (paragraph.style.name if paragraph.style else "").lower()
    content = _render_docx_runs(paragraph)
    if "heading 1" in style or style == "title":
        return f"<h2>{content}</h2>"
    if "heading" in style or "subtitle" in style:
        return f"<h3>{content}</h3>"
    if "list" in style:
        list_class = "numbered" if "number" in style else "bullet"
        tag = "ol" if list_class == "numbered" else "ul"
        return f'<{tag}><li class="{list_class}">{content}</li></{tag}>'
    return f"<p>{content}</p>"


def _render_docx_runs(paragraph: Any) -> str:
    if not paragraph.runs:
        return html.escape(paragraph.text.strip())
    parts: list[str] = []
    for run in paragraph.runs:
        escaped = html.escape(run.text)
        if not escaped:
            continue
        if run.bold:
            escaped = f"<strong>{escaped}</strong>"
        if run.italic:
            escaped = f"<em>{escaped}</em>"
        if run.underline:
            escaped = f"<u>{escaped}</u>"
        parts.append(escaped)
    rendered = "".join(parts).strip()
    return rendered or html.escape(paragraph.text.strip())


def main() -> None:
    import uvicorn

    uvicorn.run("resume_intel.web:app", host="127.0.0.1", port=8010, reload=True)


if __name__ == "__main__":
    main()
