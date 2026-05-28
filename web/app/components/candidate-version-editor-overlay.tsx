"use client";

import { Loader2 } from "lucide-react";
import type { CandidateAiSuggestion, CandidatePortalProfile, CandidateResumeVersion } from "../../lib/api";
import { candidateProfileFromResume, candidateResumeFromProfile } from "../lib/candidate-resume-profile";
import { formatDateTime } from "../lib/format";
import { CandidateResumeDocumentEditor } from "./candidate-resume-document-editor";
import { CandidateAtsConfidencePanel, CandidateTemplateSelector } from "./candidate-resume-export-panels";

export function CandidateVersionEditorOverlay({
  version,
  fallbackProfile,
  title,
  setTitle,
  targetRole,
  setTargetRole,
  selectedTemplateId,
  setSelectedTemplateId,
  close,
  saveVersionProfile,
  previewVersion,
  exportVersion,
  requestAiSuggestion,
  recordAiLearning,
  busy,
}: {
  version: CandidateResumeVersion | null;
  fallbackProfile: CandidatePortalProfile["profile"];
  title: string;
  setTitle: (value: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  close: () => void;
  saveVersionProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>;
  previewVersion: () => void;
  exportVersion: () => void;
  requestAiSuggestion: (payload: {
    action: "coach" | "rewrite_selection" | "tailor_section" | "gap_check";
    selected_text?: string;
    instruction?: string;
    profile?: CandidatePortalProfile["profile"];
    resume_html?: string;
    target_role?: string;
    requirement_text?: string;
  }) => Promise<CandidateAiSuggestion | null>;
  recordAiLearning: (type: string, detail: string, event?: Partial<{ original_text: string; suggested_text: string; accepted: boolean; metadata: Record<string, any> }>) => void;
  busy: boolean;
}) {
  const draft = candidateProfileFromResume(version?.resume_json ?? candidateResumeFromProfile(fallbackProfile), fallbackProfile);
  return (
    <div className="candidateVersionEditorOverlay" role="dialog" aria-modal="true" aria-label="Resume version editor">
      <div className="candidateVersionEditorBackdrop" onClick={close} />
      <section className="candidateVersionEditorModal">
        <header className="candidateVersionEditorTopbar">
          <div>
            <span className="eyebrow">Editing resume version</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Resume version title" />
            <small>{version ? `Last updated ${formatDateTime(version.updated_at)}` : "Loading version content..."}</small>
          </div>
          <label>Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="General, Data Engineer, AI Engineer..." /></label>
          <div>
            <button className="secondary" type="button" disabled={!version} onClick={previewVersion}>Preview</button>
            <button className="secondary" type="button" disabled={!version} onClick={exportVersion}>Export PDF</button>
            <button className="plain" type="button" onClick={close}>Close</button>
          </div>
        </header>
        {!version ? (
          <div className="candidateVersionEditorLoading">
            <Loader2 size={22} className="spin" />
            <strong>Loading resume version</strong>
          </div>
        ) : (
          <div className="candidateVersionEditorBody">
            <main>
              <CandidateResumeDocumentEditor
                draft={draft}
                updateDraft={() => undefined}
                skillsText=""
                setSkillsText={() => undefined}
                certificationsText=""
                setCertificationsText={() => undefined}
                awardsText=""
                setAwardsText={() => undefined}
                publicationsText=""
                setPublicationsText={() => undefined}
                languagesText=""
                setLanguagesText={() => undefined}
                linksText=""
                setLinksText={() => undefined}
                referencesText=""
                setReferencesText={() => undefined}
                experienceItems={[]}
                setExperienceItems={() => undefined}
                educationItems={[]}
                setEducationItems={() => undefined}
                projectItems={[]}
                setProjectItems={() => undefined}
                headerAlign="center"
                setHeaderAlign={() => undefined}
                density="comfortable"
                setDensity={() => undefined}
                loadStarterResume={() => undefined}
                saveEditorProfile={saveVersionProfile}
                requestAiSuggestion={(payload) => requestAiSuggestion({ ...payload, profile: draft, target_role: targetRole })}
                onLearn={recordAiLearning}
                busy={busy}
                compactChrome
              />
            </main>
            <aside>
              <CandidateTemplateSelector selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} />
              <CandidateAtsConfidencePanel profile={fallbackProfile} resume={version.resume_json ?? {}} selectedTemplateId={selectedTemplateId} versions={[version]} applications={[]} />
              <article className="candidatePortalCard">
                <span className="eyebrow">How to edit</span>
                <h2>Select text, then ask AI</h2>
                <p>Highlight a bullet, summary, role, or project above. Use the bottom AI bar to rewrite it. Accept/reject keeps every change under your control.</p>
              </article>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
