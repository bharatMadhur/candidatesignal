"use client";

import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck } from "lucide-react";

import type { AuditEvent, Tenant, TenantAdminDetail, TenantInvitation } from "../../lib/api";
import { domainLabel, formatDateTime } from "../lib/format";
import { EmptyPanel, Metric, ProgressBar } from "./primitives";

type AdminSettingsProps = {
  tenants: Tenant[];
  invitations: TenantInvitation[];
  auditEvents: AuditEvent[];
  selectedTenant: TenantAdminDetail | null;
  selectTenant: (tenantId: string) => void;
  createTenant: (name: string, seatLimit: number, ownerEmail: string, ownerRole: string) => void;
  setTenantStatus: (tenantId: string, status: "active" | "disabled") => void;
};

export function AdminSettings({
  tenants,
  invitations,
  auditEvents,
  selectedTenant,
  selectTenant,
  createTenant,
  setTenantStatus,
}: AdminSettingsProps) {
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

function isPlatformAdminAuditEvent(event: AuditEvent) {
  const action = `${event.action} ${event.entity_type}`.toLowerCase();
  return /tenant|company|member|invite|invitation|role|seat|user|admin|governance/.test(action)
    && !/workspace|candidate|resume|parse|requirement|match|copilot|pii|document|note/.test(action);
}

function validateCompanyForm(name: string, ownerEmail: string, seatLimit: number, ownerRole: string) {
  if (name.trim().length < 2) return "Company name must be at least 2 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail.trim())) return "Enter a valid first company admin email.";
  if (!["tenant_owner", "tenant_admin"].includes(ownerRole)) return "First admin role must be tenant owner or tenant admin.";
  if (!Number.isFinite(seatLimit) || seatLimit < 1) return "Seat limit must be at least 1.";
  if (seatLimit > 500) return "Seat limit cannot exceed 500.";
  return "";
}
