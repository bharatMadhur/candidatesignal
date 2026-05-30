"use client";

import { useState } from "react";
import { Database, ShieldCheck, Users } from "lucide-react";

import type { GovernancePolicy, MailMessage, PiiAccessEvent, TeamMember, TenantInvitation } from "../../lib/api";
import { domainLabel, formatDateTime, formatRole } from "../lib/format";

type TeamSettingsProps = {
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
};

export function TeamSettings({
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
}: TeamSettingsProps) {
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
