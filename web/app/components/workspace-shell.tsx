"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Database,
  GitBranch,
  LogIn,
  LogOut,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";

import type { CurrentUser } from "../../lib/api";
import { domainLabel } from "../lib/format";
import type { View } from "../lib/workspace-route";
import { isPlatformAdmin, isTenantAdmin } from "../lib/user-roles";
import { BrandMark } from "./brand";
import { WORKSPACE_NAV_LABELS } from "./recruiter-language";

export function EnvironmentBanner({ isStaging }: { isStaging: boolean }) {
  if (!isStaging) return null;
  return (
    <aside className="environmentBanner" role="note" aria-label="Staging environment">
      <strong>Staging Environment</strong>
      <span>Test data only. Do not upload production resumes or customer information.</span>
    </aside>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "topNavLink active" : "topNavLink"} onClick={onClick}>{icon}<span>{label}</span></button>;
}

export function AdminShellTopBar({ user, status, busy, logout }: { user: CurrentUser | null; status: string; busy: boolean; logout: () => void }) {
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

export function WorkspaceTopNav({
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

export function AccessDeniedPanel({ title, body }: { title: string; body: string }) {
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
