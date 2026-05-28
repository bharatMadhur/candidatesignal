"use client";

import { useState } from "react";
import { Database, FileSearch, Loader2, Plus, ShieldCheck, Sparkles } from "lucide-react";

import type { CandidateResumeVersion, CandidateSelfMatch } from "../../lib/api";
import { candidateJobEditPlan, inferTargetRoleFromRequirement } from "../lib/candidate-job-fit";
import { humanizeLabel, textValue, toTextList } from "../lib/format";

export function CandidateCoachChat({
  messages,
  input,
  setInput,
  send,
  busy,
  enhancement,
  applyHeadline,
  applySummary,
}: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  input: string;
  setInput: (value: string) => void;
  send: () => void | Promise<void>;
  busy: boolean;
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
          <button key={prompt} className="plain" type="button" onClick={() => setInput(prompt)}>
            {prompt}
          </button>
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
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="Ask: make my summary stronger, what template should I use, what is missing for data engineer roles..."
        />
        <button className="primary fullWidth" type="button" disabled={busy || !input.trim()} onClick={() => void send()}>
          {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Send to coach
        </button>
      </div>
    </article>
  );
}

export function CandidateVisibilityPanel({
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
        <span>
          <ShieldCheck size={15} /> PII permission required
        </span>
        <span>
          <Database size={15} /> Candidate-owned profile
        </span>
        <span>
          <FileSearch size={15} /> Resume versions stay controlled
        </span>
      </div>
      <button className={nativeSearchEnabled ? "secondary fullWidth" : "primary fullWidth"} type="button" disabled={busy} onClick={() => toggleNativeSearch(!nativeSearchEnabled)}>
        {nativeSearchEnabled ? "Turn recruiter discovery off" : "Make searchable without PII"}
      </button>
    </article>
  );
}

export function CandidateJobAiEditor({
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
      <label>
        Resume version
        <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
          <option value="">Select version</option>
          {versions.map((version) => <option value={version.id} key={version.id}>{version.title} · {version.target_role || "General"}</option>)}
        </select>
      </label>
      <label>
        Target role
        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder={inferredRole || "Senior Data Engineer"} />
      </label>
      <label>
        Job requirement
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

export function CandidateEditorCoachTools({
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
            <button className="secondary small" type="button" onClick={() => applyHeadline(headline)}>
              Accept
            </button>
            <button className="plain small" type="button" onClick={() => setIgnoredHeadline(true)}>
              Ignore
            </button>
          </div>
        </article>
      ) : null}
      {summary && !ignoredSummary ? (
        <article>
          <strong>Suggested summary direction</strong>
          <span>{summary}</span>
          <div className="candidateCoachSuggestionActions">
            <button className="secondary small" type="button" onClick={() => applySummary(summary)}>
              Accept
            </button>
            <button className="plain small" type="button" onClick={() => setIgnoredSummary(true)}>
              Ignore
            </button>
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

function cvTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return toTextList(value);
}
