"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CandidateAiSuggestion, CandidatePortalProfile, CandidateResumeVersion } from "../../lib/api";
import { normalizeEditableProfileItems, splitLineList } from "../lib/candidate-portal";
import { candidateProfileFromResume, candidateResumeFromProfile } from "../lib/candidate-resume-profile";
import { formatDateTime, splitCommaList, toTextList } from "../lib/format";
import { CandidateResumeDocumentEditor, candidateStarterResumeProfile } from "./candidate-resume-document-editor";
import { CandidateResumeGuidedForm } from "./candidate-resume-guided-form";
import { CandidateAtsConfidencePanel, CandidateCvPreview, CandidateTemplateSelector } from "./candidate-resume-export-panels";

type ResumeEditorMode = "canvas" | "guided";

function useCandidateModalResumeEditor(
  initialProfile: CandidatePortalProfile["profile"],
  resetKey: string,
  saveProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>,
) {
  const [mode, setMode] = useState<ResumeEditorMode>("canvas");
  const [draft, setDraft] = useState<CandidatePortalProfile["profile"]>(initialProfile);
  const [skillsText, setSkillsText] = useState(toTextList(initialProfile.skills).join(", "));
  const [certificationsText, setCertificationsText] = useState(toTextList(initialProfile.certifications).join("\n"));
  const [awardsText, setAwardsText] = useState(toTextList(initialProfile.awards).join("\n"));
  const [publicationsText, setPublicationsText] = useState(toTextList(initialProfile.publications).join("\n"));
  const [languagesText, setLanguagesText] = useState(toTextList(initialProfile.languages).join(", "));
  const [linksText, setLinksText] = useState(toTextList(initialProfile.links).join("\n"));
  const [referencesText, setReferencesText] = useState(toTextList((initialProfile.other_sections ?? {}).references).join("\n"));
  const [experienceItems, setExperienceItems] = useState<Array<Record<string, any>>>(initialProfile.experience ?? []);
  const [educationItems, setEducationItems] = useState<Array<Record<string, any>>>(initialProfile.education ?? []);
  const [projectItems, setProjectItems] = useState<Array<Record<string, any>>>(initialProfile.projects ?? []);
  const [headerAlign, setHeaderAlign] = useState<"left" | "center">("center");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const initialProfileRef = useRef(initialProfile);

  function loadProfile(nextProfile: CandidatePortalProfile["profile"]) {
    setDraft(nextProfile);
    setSkillsText(toTextList(nextProfile.skills).join(", "));
    setCertificationsText(toTextList(nextProfile.certifications).join("\n"));
    setAwardsText(toTextList(nextProfile.awards).join("\n"));
    setPublicationsText(toTextList(nextProfile.publications).join("\n"));
    setLanguagesText(toTextList(nextProfile.languages).join(", "));
    setLinksText(toTextList(nextProfile.links).join("\n"));
    setReferencesText(toTextList((nextProfile.other_sections ?? {}).references).join("\n"));
    setExperienceItems(nextProfile.experience ?? []);
    setEducationItems(nextProfile.education ?? []);
    setProjectItems(nextProfile.projects ?? []);
  }

  useEffect(() => {
    initialProfileRef.current = initialProfile;
  }, [initialProfile]);

  useEffect(() => {
    loadProfile(initialProfileRef.current);
  }, [resetKey]);

  function updateDraft(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function profileFromFacts() {
    return {
      ...draft,
      skills: splitCommaList(skillsText),
      certifications: splitLineList(certificationsText),
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
    };
  }

  async function saveCurrentProfile() {
    const nextProfile = profileFromFacts();
    loadProfile(nextProfile);
    await saveProfile(nextProfile);
    return nextProfile;
  }

  async function saveEditorProfile(nextProfile: CandidatePortalProfile["profile"]) {
    loadProfile(nextProfile);
    await saveProfile(nextProfile);
  }

  function loadStarterResume() {
    loadProfile(candidateStarterResumeProfile());
    setMode("canvas");
  }

  return {
    mode,
    setMode,
    draft,
    updateDraft,
    skillsText,
    setSkillsText,
    certificationsText,
    setCertificationsText,
    awardsText,
    setAwardsText,
    publicationsText,
    setPublicationsText,
    languagesText,
    setLanguagesText,
    linksText,
    setLinksText,
    referencesText,
    setReferencesText,
    experienceItems,
    setExperienceItems,
    educationItems,
    setEducationItems,
    projectItems,
    setProjectItems,
    headerAlign,
    setHeaderAlign,
    density,
    setDensity,
    loadStarterResume,
    saveCurrentProfile,
    saveEditorProfile,
  };
}

function CandidateModalEditorModeBar({
  mode,
  setMode,
}: {
  mode: ResumeEditorMode;
  setMode: (mode: ResumeEditorMode) => void;
}) {
  return (
    <div className="candidateEditorModeBar candidateEditorModeBar-modal">
      <div>
        <span className="eyebrow">Editing surface</span>
        <strong>{mode === "canvas" ? "Resume Canvas is what you export" : "Edit Facts keeps the data clean"}</strong>
        <small>{mode === "canvas" ? "Write naturally, select text, and ask AI to improve it." : "Fix dates, links, sections, roles, projects, education, and optional fields."}</small>
      </div>
      <div className="candidateEditorModeToggle" role="tablist" aria-label="Resume modal editor mode">
        <button type="button" role="tab" aria-selected={mode === "canvas"} className={mode === "canvas" ? "active" : ""} onClick={() => setMode("canvas")}>Resume Canvas</button>
        <button type="button" role="tab" aria-selected={mode === "guided"} className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}>Edit Facts</button>
      </div>
    </div>
  );
}

function CandidateModalEditorSurface({
  editor,
  targetRole,
  selectedTemplateId,
  requestAiSuggestion,
  recordAiLearning,
  busy,
}: {
  editor: ReturnType<typeof useCandidateModalResumeEditor>;
  targetRole: string;
  selectedTemplateId: string;
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
  return (
    <>
      <CandidateModalEditorModeBar mode={editor.mode} setMode={editor.setMode} />
      {editor.mode === "canvas" ? (
        <CandidateResumeDocumentEditor
          draft={editor.draft}
          updateDraft={editor.updateDraft}
          skillsText={editor.skillsText}
          setSkillsText={editor.setSkillsText}
          certificationsText={editor.certificationsText}
          setCertificationsText={editor.setCertificationsText}
          awardsText={editor.awardsText}
          setAwardsText={editor.setAwardsText}
          publicationsText={editor.publicationsText}
          setPublicationsText={editor.setPublicationsText}
          languagesText={editor.languagesText}
          setLanguagesText={editor.setLanguagesText}
          linksText={editor.linksText}
          setLinksText={editor.setLinksText}
          referencesText={editor.referencesText}
          setReferencesText={editor.setReferencesText}
          experienceItems={editor.experienceItems}
          setExperienceItems={editor.setExperienceItems}
          educationItems={editor.educationItems}
          setEducationItems={editor.setEducationItems}
          projectItems={editor.projectItems}
          setProjectItems={editor.setProjectItems}
          headerAlign={editor.headerAlign}
          setHeaderAlign={editor.setHeaderAlign}
          density={editor.density}
          setDensity={editor.setDensity}
          loadStarterResume={editor.loadStarterResume}
          saveEditorProfile={editor.saveEditorProfile}
          requestAiSuggestion={(payload) => requestAiSuggestion({ ...payload, profile: editor.draft, target_role: targetRole })}
          onLearn={recordAiLearning}
          busy={busy}
          templateId={selectedTemplateId}
          compactChrome
        />
      ) : (
        <CandidateResumeGuidedForm
          draft={editor.draft}
          updateDraft={editor.updateDraft}
          skillsText={editor.skillsText}
          setSkillsText={editor.setSkillsText}
          certificationsText={editor.certificationsText}
          setCertificationsText={editor.setCertificationsText}
          awardsText={editor.awardsText}
          setAwardsText={editor.setAwardsText}
          publicationsText={editor.publicationsText}
          setPublicationsText={editor.setPublicationsText}
          languagesText={editor.languagesText}
          setLanguagesText={editor.setLanguagesText}
          linksText={editor.linksText}
          setLinksText={editor.setLinksText}
          referencesText={editor.referencesText}
          setReferencesText={editor.setReferencesText}
          experienceItems={editor.experienceItems}
          setExperienceItems={editor.setExperienceItems}
          educationItems={editor.educationItems}
          setEducationItems={editor.setEducationItems}
          projectItems={editor.projectItems}
          setProjectItems={editor.setProjectItems}
          loadStarterResume={editor.loadStarterResume}
          save={async () => {
            await editor.saveCurrentProfile();
          }}
          busy={busy}
        />
      )}
    </>
  );
}

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
  const initialProfile = candidateProfileFromResume(version?.resume_json ?? candidateResumeFromProfile(fallbackProfile), fallbackProfile);
  const editor = useCandidateModalResumeEditor(initialProfile, version?.id ?? "loading-version", saveVersionProfile);
  const previewResume = candidateResumeFromProfile(editor.draft);
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
              <CandidateModalEditorSurface
                editor={editor}
                targetRole={targetRole}
                selectedTemplateId={selectedTemplateId}
                requestAiSuggestion={requestAiSuggestion}
                recordAiLearning={recordAiLearning}
                busy={busy}
              />
            </main>
            <aside>
              <CandidateTemplateSelector selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} />
              <article className="candidatePortalCard candidateVersionEditorPreviewCard">
                <div className="candidatePortalSectionHead">
                  <div>
                    <span className="eyebrow">Live layout preview</span>
                    <h2>Template changes show here</h2>
                    <p>Switch templates here before exporting. Content updates after saving the editor.</p>
                  </div>
                </div>
                <CandidateCvPreview resume={previewResume} templateId={selectedTemplateId} />
              </article>
              <CandidateAtsConfidencePanel profile={editor.draft} resume={previewResume} selectedTemplateId={selectedTemplateId} versions={[version]} applications={[]} />
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

export function CandidateScratchEditorOverlay({
  profile,
  title,
  setTitle,
  targetRole,
  setTargetRole,
  selectedTemplateId,
  setSelectedTemplateId,
  close,
  saveProfile,
  createVersion,
  requestAiSuggestion,
  recordAiLearning,
  busy,
}: {
  profile: CandidatePortalProfile["profile"];
  title: string;
  setTitle: (value: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  close: () => void;
  saveProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>;
  createVersion: () => Promise<void>;
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
  const editor = useCandidateModalResumeEditor(profile, "scratch-editor", saveProfile);
  const previewResume = candidateResumeFromProfile(editor.draft);

  async function saveAndCreateVersion() {
    await editor.saveCurrentProfile();
    await createVersion();
  }

  return (
    <div className="candidateVersionEditorOverlay" role="dialog" aria-modal="true" aria-label="Start resume from scratch">
      <div className="candidateVersionEditorBackdrop" onClick={close} />
      <section className="candidateVersionEditorModal candidateScratchEditorModal">
        <header className="candidateVersionEditorTopbar">
          <div>
            <span className="eyebrow">Start from scratch</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="New resume version title" />
            <small>Use the sample structure, replace it with real facts, then save or create a version.</small>
          </div>
          <label>Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Software Engineer, Data Analyst..." /></label>
          <div>
            <button className="secondary" type="button" disabled={busy} onClick={() => void editor.saveCurrentProfile()}>Save profile</button>
            <button className="primary" type="button" disabled={busy || !title.trim()} onClick={() => void saveAndCreateVersion()}>Create version</button>
            <button className="plain" type="button" onClick={close}>Close</button>
          </div>
        </header>
        <div className="candidateVersionEditorBody">
          <main>
            <CandidateModalEditorSurface
              editor={editor}
              targetRole={targetRole}
              selectedTemplateId={selectedTemplateId}
              requestAiSuggestion={requestAiSuggestion}
              recordAiLearning={recordAiLearning}
              busy={busy}
            />
          </main>
          <aside>
            <CandidateTemplateSelector selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} />
            <article className="candidatePortalCard candidateVersionEditorPreviewCard">
              <div className="candidatePortalSectionHead">
                <div>
                  <span className="eyebrow">Export preview</span>
                  <h2>Pick a layout before exporting</h2>
                  <p>Template changes show here immediately. Resume text updates after saving.</p>
                </div>
              </div>
              <CandidateCvPreview resume={previewResume} templateId={selectedTemplateId} />
            </article>
            <article className="candidatePortalCard">
              <span className="eyebrow">How to start</span>
              <h2>Replace sample lines with real facts</h2>
              <p>Select a bullet and ask AI to tighten it. AI can rewrite wording, but the candidate must supply facts, metrics, dates, and links.</p>
            </article>
          </aside>
        </div>
      </section>
    </div>
  );
}
