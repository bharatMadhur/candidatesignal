"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Loader2, Sparkles } from "lucide-react";
import type { CandidateAiSuggestion, CandidatePortalProfile } from "../../lib/api";
import { splitCommaList, textValue, toTextList, uniqueTextList } from "../lib/format";

export function CandidateResumeDocumentEditor(props: {
  draft: CandidatePortalProfile["profile"];
  updateDraft: (key: string, value: string) => void;
  skillsText: string;
  setSkillsText: (value: string) => void;
  certificationsText: string;
  setCertificationsText: (value: string) => void;
  awardsText: string;
  setAwardsText: (value: string) => void;
  publicationsText: string;
  setPublicationsText: (value: string) => void;
  languagesText: string;
  setLanguagesText: (value: string) => void;
  linksText: string;
  setLinksText: (value: string) => void;
  referencesText: string;
  setReferencesText: (value: string) => void;
  experienceItems: Array<Record<string, any>>;
  setExperienceItems: (items: Array<Record<string, any>>) => void;
  educationItems: Array<Record<string, any>>;
  setEducationItems: (items: Array<Record<string, any>>) => void;
  projectItems: Array<Record<string, any>>;
  setProjectItems: (items: Array<Record<string, any>>) => void;
  headerAlign: "left" | "center";
  setHeaderAlign: (value: "left" | "center") => void;
  density: "comfortable" | "compact";
  setDensity: (value: "comfortable" | "compact") => void;
  loadStarterResume: () => void;
  saveEditorProfile: (profile: CandidatePortalProfile["profile"]) => Promise<void>;
  requestAiSuggestion: (payload: {
    action: "rewrite_selection" | "tailor_section" | "gap_check";
    selected_text?: string;
    instruction?: string;
    resume_html?: string;
  }) => Promise<CandidateAiSuggestion | null>;
  onLearn?: (type: string, detail: string, event?: Partial<{ original_text: string; suggested_text: string; accepted: boolean; metadata: Record<string, any> }>) => void;
  busy: boolean;
  compactChrome?: boolean;
}) {
  const {
    draft,
    headerAlign,
    setHeaderAlign,
    density,
    setDensity,
    loadStarterResume,
    saveEditorProfile,
    requestAiSuggestion,
    onLearn,
    busy,
    compactChrome = false,
  } = props;
  const [aiRewriteBusy, setAiRewriteBusy] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [selectedTextPreview, setSelectedTextPreview] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    from: number;
    to: number;
    original: string;
    suggestion: CandidateAiSuggestion;
  } | null>(null);
  const loadedProfileKeyRef = useRef("");
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Resume section";
          return "Write directly in the resume. Use bullets for evidence, metrics, tools, and scope.";
        },
      }),
    ],
    content: candidateEditorHtmlFromProfile(draft),
    editorProps: {
      attributes: {
        "aria-label": "Resume document editor",
        spellcheck: "true",
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" && event.key !== " ") return false;
        const paragraphText = view.state.selection.$from.parent.textBetween(0, view.state.selection.$from.parentOffset, undefined, "\ufffc");
        const command = candidateEditorSlashCommand(paragraphText);
        if (!command) return false;
        const activeEditor = editorRef.current;
        if (!activeEditor) return false;
        event.preventDefault();
        const to = view.state.selection.from;
        const from = Math.max(1, to - command.raw.length);
        activeEditor.chain().focus().deleteRange({ from, to }).insertContent(candidateEditorBlockHtml(command.kind)).run();
        return true;
      },
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      const { from, to, empty } = activeEditor.state.selection;
      if (empty) {
        setSelectedTextPreview("");
        return;
      }
      setSelectedTextPreview(activeEditor.state.doc.textBetween(from, to, " ").trim());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const nextKey = candidateEditorProfileFingerprint(draft);
    if (nextKey === loadedProfileKeyRef.current) return;
    if (editor.isFocused && editor.getText().trim().length > 0) return;
    editor.commands.setContent(candidateEditorHtmlFromProfile(draft), { emitUpdate: false });
    loadedProfileKeyRef.current = nextKey;
  }, [draft, editor]);

  async function saveDocument() {
    if (!editor) return;
    const nextProfile = candidateProfileFromEditorHtml(editor.getHTML(), draft);
    loadedProfileKeyRef.current = candidateEditorProfileFingerprint(nextProfile);
    await saveEditorProfile(nextProfile);
  }

  function loadSampleIntoEditor() {
    const starter = candidateStarterResumeProfile();
    loadStarterResume();
    editor?.commands.setContent(candidateEditorHtmlFromProfile(starter), { emitUpdate: false });
    loadedProfileKeyRef.current = candidateEditorProfileFingerprint(starter);
  }

  async function improveSelection() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) return;
    const selectionSafety = candidateEditorRewriteRangeSafety(editor, from, to);
    if (!selectionSafety.safe) {
      setPendingSuggestion({
        from,
        to,
        original: selectedText,
        suggestion: candidateEditorBlockedSuggestion(selectionSafety.reason),
      });
      return;
    }
    setAiRewriteBusy(true);
    try {
      const suggestion = await requestAiSuggestion({
        action: "rewrite_selection",
        selected_text: selectedText,
        instruction: "Rewrite the selected resume text to be clearer, stronger, and ATS-safe without adding facts.",
        resume_html: editor.getHTML(),
      });
      const localSuggestion = strengthenResumeSelection(selectedText);
      const safeSuggestedText = candidateEditorPlainTextSuggestion(suggestion?.suggested_text || localSuggestion);
      setPendingSuggestion({
        from,
        to,
        original: selectedText,
        suggestion: suggestion?.suggested_text ? {
          ...suggestion,
          suggested_text: safeSuggestedText,
          warnings: uniqueTextList([
            ...(suggestion.warnings ?? []),
            "Layout-safe edit: only the selected text inside this paragraph or bullet will be replaced.",
          ]),
        } : {
          status: "fallback",
          assistant_message: "Local fallback kept the text factual and only tightened wording.",
          suggested_text: safeSuggestedText,
          rationale: ["No facts were added."],
          warnings: ["Verify every claim before saving.", "Layout-safe edit: only the selected text inside this paragraph or bullet will be replaced."],
          action: "rewrite_selection",
        },
      });
    } finally {
      setAiRewriteBusy(false);
    }
  }

  async function askAiFromComposer(instructionOverride?: string) {
    if (!editor) return;
    const instruction = (instructionOverride ?? aiInstruction).trim();
    if (!instruction) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, " ").trim();
    setAiInstruction("");
    if (selectedText) {
      const selectionSafety = candidateEditorRewriteRangeSafety(editor, from, to);
      if (!selectionSafety.safe) {
        setPendingSuggestion({
          from,
          to,
          original: selectedText,
          suggestion: candidateEditorBlockedSuggestion(selectionSafety.reason),
        });
        return;
      }
      setAiRewriteBusy(true);
      try {
        const suggestion = await requestAiSuggestion({
          action: "rewrite_selection",
          selected_text: selectedText,
          instruction,
          resume_html: editor.getHTML(),
        });
        const safeSuggestedText = candidateEditorPlainTextSuggestion(suggestion?.suggested_text || strengthenResumeSelection(selectedText));
        setPendingSuggestion({
          from,
          to,
          original: selectedText,
          suggestion: suggestion?.suggested_text ? {
            ...suggestion,
            suggested_text: safeSuggestedText,
            warnings: uniqueTextList([
              ...(suggestion.warnings ?? []),
              "Layout-safe edit: only the selected text inside this paragraph or bullet will be replaced.",
            ]),
          } : {
            status: "fallback",
            assistant_message: "I tightened the selected text without adding facts.",
            suggested_text: safeSuggestedText,
            rationale: ["No facts were added."],
            warnings: ["Verify every claim before saving."],
            action: "rewrite_selection",
          },
        });
      } finally {
        setAiRewriteBusy(false);
      }
      return;
    }
    setAiRewriteBusy(true);
    try {
      const suggestion = await requestAiSuggestion({
        action: "gap_check",
        instruction,
        resume_html: editor.getHTML(),
      });
      setPendingSuggestion({
        from: 1,
        to: 1,
        original: "Full resume",
        suggestion: {
          status: suggestion?.status || "needs_more_context",
          assistant_message: suggestion?.assistant_message || "Select a specific line or bullet above if you want me to rewrite text directly.",
          suggested_text: "",
          rationale: suggestion?.rationale || ["No text was selected, so I reviewed the resume instead of replacing content."],
          warnings: suggestion?.warnings || ["Select text before asking for a direct rewrite."],
          missing_facts: suggestion?.missing_facts,
          learning_tags: suggestion?.learning_tags,
          action: "gap_check",
        },
      });
    } finally {
      setAiRewriteBusy(false);
    }
  }

  function acceptPendingSuggestion() {
    if (!editor || !pendingSuggestion?.suggestion.suggested_text) return;
    const safeText = candidateEditorPlainTextSuggestion(pendingSuggestion.suggestion.suggested_text);
    const rangeSafety = candidateEditorRewriteRangeSafety(editor, pendingSuggestion.from, pendingSuggestion.to, pendingSuggestion.original);
    if (!safeText || !rangeSafety.safe) {
      setPendingSuggestion({
        ...pendingSuggestion,
        suggestion: candidateEditorBlockedSuggestion(rangeSafety.reason || "The resume changed after the suggestion was created. Select the text again and retry."),
      });
      return;
    }
    editor.view.dispatch(editor.state.tr.insertText(safeText, pendingSuggestion.from, pendingSuggestion.to));
    editor.commands.focus();
    onLearn?.("canvas_rewrite", `Accepted AI rewrite: ${pendingSuggestion.original.slice(0, 80)}`, {
      original_text: pendingSuggestion.original,
      suggested_text: safeText,
      accepted: true,
      metadata: {
        status: pendingSuggestion.suggestion.status,
        rationale: pendingSuggestion.suggestion.rationale ?? [],
        warnings: pendingSuggestion.suggestion.warnings ?? [],
        learning_tags: pendingSuggestion.suggestion.learning_tags ?? [],
      },
    });
    setPendingSuggestion(null);
  }

  function rejectPendingSuggestion() {
    if (!pendingSuggestion) return;
    onLearn?.("canvas_rewrite_rejected", `Rejected AI rewrite: ${pendingSuggestion.original.slice(0, 80)}`, {
      original_text: pendingSuggestion.original,
      suggested_text: pendingSuggestion.suggestion.suggested_text,
      accepted: false,
      metadata: {
        status: pendingSuggestion.suggestion.status,
        rationale: pendingSuggestion.suggestion.rationale ?? [],
        warnings: pendingSuggestion.suggestion.warnings ?? [],
        learning_tags: pendingSuggestion.suggestion.learning_tags ?? [],
      },
    });
    setPendingSuggestion(null);
  }

  function insertResumeBlock(kind: CandidateEditorBlockKind) {
    editor?.chain().focus().insertContent(candidateEditorBlockHtml(kind)).run();
    onLearn?.("section_insert", `Inserted ${kind} block in Resume Canvas`);
  }

  const formatButtons = [
    { label: "Bold", active: "bold", run: () => editor?.chain().focus().toggleBold().run() },
    { label: "Italic", active: "italic", run: () => editor?.chain().focus().toggleItalic().run() },
    { label: "H2", active: "heading", attrs: { level: 2 }, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", active: "heading", attrs: { level: 3 }, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Bullets", active: "bulletList", run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Numbers", active: "orderedList", run: () => editor?.chain().focus().toggleOrderedList().run() },
  ];
  const hasSelection = selectedTextPreview.trim().length > 0;
  const selectedTextLabel = selectedTextPreview.length > 110 ? `${selectedTextPreview.slice(0, 110)}...` : selectedTextPreview;

  return (
    <section className={`candidateDocumentEditor candidateDocumentEditor-${density} candidateDocumentEditor-align-${headerAlign}${compactChrome ? " candidateDocumentEditor-overlay" : ""}`}>
      <div className="candidateDocumentToolbar" aria-label="Resume editor toolbar">
        <div>
          <span className="eyebrow">Resume editor</span>
          <strong>Write like a document</strong>
        </div>
        <div className="candidateDocToolbarGroup candidateDocToolbarGroup-format" aria-label="Formatting">
          {formatButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              className={editor?.isActive(button.active, button.attrs ?? {}) ? "active" : ""}
              disabled={!editor}
              onClick={button.run}
            >
              {button.label}
            </button>
          ))}
          <button type="button" disabled={!editor || !editor.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>Undo</button>
          <button type="button" disabled={!editor || !editor.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>Redo</button>
        </div>
        <div className="candidateDocToolbarGroup" aria-label="Header alignment">
          <span>Header</span>
          <button type="button" className={headerAlign === "left" ? "active" : ""} onClick={() => setHeaderAlign("left")}>Left</button>
          <button type="button" className={headerAlign === "center" ? "active" : ""} onClick={() => setHeaderAlign("center")}>Center</button>
        </div>
        <div className="candidateDocToolbarGroup" aria-label="Editor density">
          <span>Spacing</span>
          <button type="button" className={density === "comfortable" ? "active" : ""} onClick={() => setDensity("comfortable")}>Comfort</button>
          <button type="button" className={density === "compact" ? "active" : ""} onClick={() => setDensity("compact")}>Compact</button>
        </div>
        {!compactChrome ? <button className="secondary" type="button" onClick={loadSampleIntoEditor}>Load sample resume</button> : null}
        <button className="secondary" type="button" disabled={!editor || aiRewriteBusy} onClick={() => void improveSelection()}>
          {aiRewriteBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Improve selection
        </button>
        <button className="primary" type="button" disabled={busy || !editor} onClick={saveDocument}>Save editor</button>
      </div>

      <div className="candidateSmartBlockBar" aria-label="Insert resume section">
        <div>
          <span className="eyebrow">Smart blocks</span>
          <p>Add correctly formatted resume sections instead of manually fighting formatting.</p>
        </div>
        <div>
          {candidateEditorBlockOptions.map((block) => (
            <button key={block.kind} type="button" disabled={!editor} onClick={() => insertResumeBlock(block.kind)}>{block.label}</button>
          ))}
        </div>
      </div>

      <div className="candidateEditorHintBar">
        <span>Tip</span>
        <p>Type slash commands like /experience, /project, /education, /skills, or use Smart blocks. Select weak text and use Improve selection.</p>
      </div>

      {pendingSuggestion ? (
        <aside className="candidateAiSuggestionPanel">
          <div>
            <span className="eyebrow">Candidate-approved AI edit</span>
            <h3>{pendingSuggestion.suggestion.status === "needs_more_context" ? "More facts needed" : "Suggested rewrite"}</h3>
            <p>{pendingSuggestion.suggestion.assistant_message}</p>
          </div>
          {pendingSuggestion.suggestion.suggested_text ? (
            <blockquote>{pendingSuggestion.suggestion.suggested_text}</blockquote>
          ) : null}
          {pendingSuggestion.suggestion.missing_facts?.length ? (
            <div className="candidateAiSuggestionNotes">
              <strong>Missing facts</strong>
              <span>{pendingSuggestion.suggestion.missing_facts.join(" · ")}</span>
            </div>
          ) : null}
          {pendingSuggestion.suggestion.warnings?.length ? (
            <div className="candidateAiSuggestionNotes">
              <strong>Guardrails</strong>
              <span>{pendingSuggestion.suggestion.warnings.join(" · ")}</span>
            </div>
          ) : null}
          <div className="candidateAiSuggestionActions">
            <button className="primary" type="button" disabled={!pendingSuggestion.suggestion.suggested_text} onClick={acceptPendingSuggestion}>Accept edit</button>
            <button className="secondary" type="button" onClick={rejectPendingSuggestion}>Reject</button>
          </div>
        </aside>
      ) : null}

      <article className="candidateDocumentPaperEditor candidateDocumentPaperTiptap" data-candidate-editor-section="Identity">
        <EditorContent editor={editor} className="candidateTiptapEditor" />
      </article>
      <div className={hasSelection ? "candidateAiBottomComposer hasSelection" : "candidateAiBottomComposer"}>
        <div className="candidateAiComposerHeader">
          <div>
            <span className="eyebrow"><Sparkles size={13} /> AI resume editor</span>
            <strong>{hasSelection ? "Selection ready" : "Highlight text in the resume first"}</strong>
            <p>
              {hasSelection
                ? `Selected: "${selectedTextLabel}"`
                : "Drag across one bullet, sentence, or section above. Then choose a quick action or type your own instruction."}
            </p>
          </div>
          <span className="candidateAiComposerHint">⌘ Enter to run</span>
        </div>
        <div className="candidateAiQuickActions" aria-label="AI resume editing shortcuts">
          <button type="button" disabled={!editor || !hasSelection || aiRewriteBusy} onClick={() => void askAiFromComposer("Rewrite the selected text to be sharper, concise, quantified where facts already exist, and ATS-safe. Do not add new facts.")}>
            Tighten selected text
          </button>
          <button type="button" disabled={!editor || !hasSelection || aiRewriteBusy} onClick={() => void askAiFromComposer("Make the selected resume text more impact-oriented while preserving every fact. Keep it recruiter-readable.")}>
            Make it stronger
          </button>
          <button type="button" disabled={!editor || !hasSelection || aiRewriteBusy} onClick={() => void askAiFromComposer("Improve formatting and wording for the selected text without changing meaning or adding facts.")}>
            Fix wording/format
          </button>
          <button type="button" disabled={!editor || aiRewriteBusy} onClick={() => void askAiFromComposer("Review this resume and tell me the biggest missing facts, weak sections, and what I should improve before applying.")}>
            Review whole resume
          </button>
        </div>
        <div className="candidateAiComposerInputRow">
          <textarea
            value={aiInstruction}
            onChange={(event) => setAiInstruction(event.target.value)}
            rows={2}
            placeholder={hasSelection ? "Example: tailor this for a senior data engineer role..." : "First highlight resume text above, or ask for a whole-resume review..."}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void askAiFromComposer();
            }}
          />
          <button className="primary" type="button" disabled={!editor || aiRewriteBusy || !aiInstruction.trim()} onClick={() => void askAiFromComposer()}>
            {aiRewriteBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Ask AI
          </button>
        </div>
      </div>
    </section>
  );
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

function candidateEditorProfileFingerprint(profile: CandidatePortalProfile["profile"]) {
  return JSON.stringify(candidateResumeFromProfile(profile));
}

function candidateEditorHtmlFromProfile(profile: CandidatePortalProfile["profile"]) {
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  const otherSections = profile.other_sections && typeof profile.other_sections === "object" && !Array.isArray(profile.other_sections)
    ? profile.other_sections as Record<string, unknown>
    : {};
  return [
    `<h1>${candidateEditorEscapeHtml(textValue(profile.display_name) || "Your Name")}</h1>`,
    `<p>${candidateEditorEscapeHtml(textValue(profile.headline) || "Target role or professional headline")}</p>`,
    `<p>${candidateEditorEscapeHtml(candidateEditorContactLine(profile) || "City, State | email@example.com | phone | LinkedIn | Portfolio | GitHub")}</p>`,
    "<h2>Summary</h2>",
    candidateEditorParagraphHtml(profile.summary, "Write a 2-4 line factual summary with role direction, domain, strongest skills, and measurable scope."),
    "<h2>Professional Experience</h2>",
    experience.length
      ? experience.map((item) => candidateEditorItemHtml(item, "experience")).join("")
      : candidateEditorItemHtml({ title: "Role title", company: "Company", location: "Location", start_date: "Start", end_date: "End", bullets: ["Describe scope, ownership, tools, and measurable impact."] }, "experience"),
    "<h2>Projects</h2>",
    projects.length
      ? projects.map((item) => candidateEditorItemHtml(item, "project")).join("")
      : candidateEditorItemHtml({ name: "Project name", role: "Your role / stack", bullets: ["Describe the problem, your contribution, technologies, and result."] }, "project"),
    "<h2>Education</h2>",
    education.length
      ? education.map((item) => candidateEditorItemHtml(item, "education")).join("")
      : candidateEditorItemHtml({ degree: "Degree", school: "School", field: "Field of study", location: "Location", end_date: "Graduation year", details: ["Relevant coursework, honors, thesis, or GPA if useful."] }, "education"),
    "<h2>Skills</h2>",
    `<p>${candidateEditorEscapeHtml(toTextList(profile.skills).join(", ") || "Skill one, Skill two, Tool or platform, Domain keyword")}</p>`,
    "<h2>Certifications</h2>",
    candidateEditorListHtml(profile.certifications, "Certification name"),
    "<h2>Awards</h2>",
    candidateEditorListHtml(profile.awards, "Award, scholarship, publication recognition, or competition result"),
    "<h2>Publications</h2>",
    candidateEditorListHtml(profile.publications, "Publication, patent, paper, article, or conference item"),
    "<h2>Languages</h2>",
    `<p>${candidateEditorEscapeHtml(toTextList(profile.languages).join(", ") || "Language one, Language two")}</p>`,
    "<h2>Additional Links</h2>",
    candidateEditorListHtml(profile.links, "Portfolio, blog, project, publication, or other URL"),
    "<h2>References</h2>",
    candidateEditorListHtml(toTextList(otherSections.references), "Available on request"),
  ].join("\n");
}

function candidateProfileFromEditorHtml(html: string, fallback: CandidatePortalProfile["profile"]): CandidatePortalProfile["profile"] {
  if (typeof window === "undefined") return fallback;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bodyChildren = Array.from(doc.body.children);
  const firstSectionIndex = bodyChildren.findIndex((element) => element.tagName.toLowerCase() === "h2");
  const topChildren = firstSectionIndex >= 0 ? bodyChildren.slice(0, firstSectionIndex) : bodyChildren;
  const topParagraphs = topChildren
    .filter((element) => element.tagName.toLowerCase() === "p")
    .map((element) => candidateEditorCleanText(element.textContent))
    .filter(Boolean);
  const name = candidateEditorCleanText(doc.body.querySelector("h1")?.textContent);
  const headline = topParagraphs[0] ?? "";
  const contact = candidateEditorContactFromLine(topParagraphs[1] ?? "", fallback);
  const sections = candidateEditorSections(doc);
  const experience = candidateEditorParseItems(sections.experience ?? [], "experience", Array.isArray(fallback.experience) ? fallback.experience : []);
  const projects = candidateEditorParseItems(sections.projects ?? [], "project", Array.isArray(fallback.projects) ? fallback.projects : []);
  const education = candidateEditorParseItems(sections.education ?? [], "education", Array.isArray(fallback.education) ? fallback.education : []);
  const certifications = candidateEditorSectionList(sections.certifications ?? []);
  const awards = candidateEditorSectionList(sections.awards ?? []);
  const publications = candidateEditorSectionList(sections.publications ?? []);
  const languages = splitCommaList(candidateEditorSectionText(sections.languages ?? []));
  const links = uniqueTextList([...contact.links, ...candidateEditorSectionList(sections.links ?? [])]);
  const references = candidateEditorSectionList(sections.references ?? []);
  return {
    ...fallback,
    display_name: name || textValue(fallback.display_name),
    headline: headline || textValue(fallback.headline),
    current_location: contact.location || textValue(fallback.current_location),
    email: contact.email || textValue(fallback.email),
    phone: contact.phone || textValue(fallback.phone),
    linkedin_url: contact.linkedin_url || textValue(fallback.linkedin_url),
    portfolio_url: contact.portfolio_url || textValue(fallback.portfolio_url),
    github_url: contact.github_url || textValue(fallback.github_url),
    summary: candidateEditorSectionText(sections.summary ?? []) || textValue(fallback.summary),
    skills: uniqueTextList(splitCommaList(candidateEditorSectionText(sections.skills ?? []))),
    experience: experience.length ? experience : fallback.experience,
    projects: projects.length ? projects : fallback.projects,
    education: education.length ? education : fallback.education,
    certifications: certifications.length ? certifications : fallback.certifications,
    awards: awards.length ? awards : fallback.awards,
    publications: publications.length ? publications : fallback.publications,
    languages: languages.length ? languages : fallback.languages,
    links: links.length ? links : fallback.links,
    other_sections: {
      ...((fallback.other_sections && typeof fallback.other_sections === "object" && !Array.isArray(fallback.other_sections)) ? fallback.other_sections : {}),
      references: references.length ? references : toTextList((fallback.other_sections as Record<string, unknown> | undefined)?.references),
    },
  };
}

function candidateEditorContactLine(profile: CandidatePortalProfile["profile"]) {
  return [
    textValue(profile.current_location),
    textValue(profile.email),
    textValue(profile.phone),
    textValue(profile.linkedin_url),
    textValue(profile.portfolio_url),
    textValue(profile.github_url),
  ].filter(Boolean).join(" | ");
}

function candidateEditorContactFromLine(line: string, fallback: CandidatePortalProfile["profile"]) {
  const result = {
    location: "",
    email: "",
    phone: "",
    linkedin_url: "",
    portfolio_url: "",
    github_url: "",
    links: [] as string[],
  };
  const tokens = line.split(/\s*[|•]\s*/).map(candidateEditorCleanText).filter(Boolean);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!result.email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(token)) {
      result.email = token.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? token;
    } else if (!result.phone && token.replace(/\D/g, "").length >= 7 && !lower.includes("linkedin")) {
      result.phone = token;
    } else if (!result.linkedin_url && lower.includes("linkedin")) {
      result.linkedin_url = candidateEditorNormalizeUrl(token);
      result.links.push(result.linkedin_url);
    } else if (!result.github_url && lower.includes("github")) {
      result.github_url = candidateEditorNormalizeUrl(token);
      result.links.push(result.github_url);
    } else if (/^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(token)) {
      const url = candidateEditorNormalizeUrl(token);
      result.portfolio_url ||= url;
      result.links.push(url);
    } else if (!result.location) {
      result.location = token;
    }
  }
  return {
    location: result.location || textValue(fallback.current_location),
    email: result.email || textValue(fallback.email),
    phone: result.phone || textValue(fallback.phone),
    linkedin_url: result.linkedin_url || textValue(fallback.linkedin_url),
    portfolio_url: result.portfolio_url || textValue(fallback.portfolio_url),
    github_url: result.github_url || textValue(fallback.github_url),
    links: uniqueTextList(result.links),
  };
}

function candidateEditorItemHtml(item: Record<string, any>, kind: "experience" | "project" | "education") {
  const title = kind === "education" ? textValue(item.degree || item.title) : textValue(item.title || item.name || item.role);
  const place = kind === "education" ? textValue(item.school) : kind === "experience" ? textValue(item.company) : textValue(item.role || item.company);
  const heading = [title, place].filter(Boolean).join(" — ");
  const dateRange = [textValue(item.start_date), textValue(item.end_date)].filter(Boolean).join(" - ");
  const meta = kind === "education"
    ? [textValue(item.field), textValue(item.location), dateRange || textValue(item.end_date)].filter(Boolean).join(" | ")
    : [textValue(item.location), dateRange].filter(Boolean).join(" | ");
  const bullets = toTextList(item.bullets || item.details || item.description);
  return [
    `<h3>${candidateEditorEscapeHtml(heading || (kind === "education" ? "Degree — School" : kind === "project" ? "Project name — Role / stack" : "Role title — Company"))}</h3>`,
    `<p>${candidateEditorEscapeHtml(meta || (kind === "education" ? "Field | Location | Graduation year" : "Location | Start - End"))}</p>`,
    candidateEditorListHtml(bullets, kind === "education" ? "Relevant coursework, honors, thesis, or GPA if useful." : "Describe scope, ownership, tools, and measurable impact."),
  ].join("\n");
}

function candidateEditorParseItems(elements: Element[], kind: "experience" | "project" | "education", fallbackItems: Array<Record<string, any>>) {
  const parsed: Array<Record<string, any>> = [];
  let current: Record<string, any> | null = null;
  let metaConsumed = false;
  function pushCurrent() {
    if (!current) return;
    const hasContent = Object.values(current).some((value) => Array.isArray(value) ? value.length : Boolean(textValue(value)));
    if (!hasContent) return;
    const fallback = fallbackItems[parsed.length] ?? {};
    parsed.push({ ...fallback, ...current });
  }
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (tag === "h3") {
      pushCurrent();
      current = candidateEditorParseItemHeading(candidateEditorCleanText(element.textContent), kind);
      metaConsumed = false;
      continue;
    }
    if (!current) continue;
    if (tag === "p") {
      const text = candidateEditorCleanText(element.textContent);
      if (!text) continue;
      if (!metaConsumed) {
        Object.assign(current, candidateEditorParseMetaLine(text, kind));
        metaConsumed = true;
      } else {
        const key = kind === "education" ? "details" : "bullets";
        current[key] = uniqueTextList([...(toTextList(current[key])), text]);
      }
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      const key = kind === "education" ? "details" : "bullets";
      current[key] = uniqueTextList([...(toTextList(current[key])), ...candidateEditorListItems(element)]);
    }
  }
  pushCurrent();
  return parsed.filter((item) => {
    if (kind === "experience") return textValue(item.title) || textValue(item.company) || toTextList(item.bullets).length;
    if (kind === "project") return textValue(item.name) || textValue(item.role) || toTextList(item.bullets).length;
    return textValue(item.degree) || textValue(item.school) || toTextList(item.details).length;
  });
}

function candidateEditorParseItemHeading(text: string, kind: "experience" | "project" | "education") {
  const [left, ...rest] = text.split(/\s+(?:—|–|-|\bat\b)\s+/i).map(candidateEditorCleanText).filter(Boolean);
  const right = rest.join(" - ");
  if (kind === "education") return { degree: left || "", school: right || "" };
  if (kind === "project") return { name: left || "", role: right || "" };
  return { title: left || "", company: right || "" };
}

function candidateEditorParseMetaLine(text: string, kind: "experience" | "project" | "education") {
  const pieces = text.split(/\s*[|•]\s*/).map(candidateEditorCleanText).filter(Boolean);
  const datePiece = pieces.find(candidateEditorLooksLikeDateRange) ?? "";
  const [startDate, endDate] = candidateEditorSplitDateRange(datePiece);
  const location = pieces.find((piece) => piece !== datePiece && candidateEditorLooksLikeLocation(piece)) ?? "";
  if (kind === "education") {
    const field = pieces.find((piece) => piece !== datePiece && piece !== location) ?? "";
    return { field, location, start_date: startDate, end_date: endDate || datePiece };
  }
  return { location, start_date: startDate, end_date: endDate };
}

function candidateEditorSections(doc: Document) {
  const sections: Record<string, Element[]> = {};
  let currentKey = "";
  for (const element of Array.from(doc.body.children)) {
    if (element.tagName.toLowerCase() === "h2") {
      currentKey = candidateEditorSectionKey(element.textContent ?? "");
      if (currentKey) sections[currentKey] = [];
      continue;
    }
    if (currentKey) sections[currentKey].push(element);
  }
  return sections;
}

function candidateEditorSectionKey(title: string) {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized.includes("summary")) return "summary";
  if (normalized.includes("experience") || normalized.includes("employment") || normalized.includes("work history")) return "experience";
  if (normalized.includes("project")) return "projects";
  if (normalized.includes("education")) return "education";
  if (normalized.includes("skill")) return "skills";
  if (normalized.includes("certification") || normalized.includes("license")) return "certifications";
  if (normalized.includes("award") || normalized.includes("honor")) return "awards";
  if (normalized.includes("publication") || normalized.includes("patent")) return "publications";
  if (normalized.includes("language")) return "languages";
  if (normalized.includes("link") || normalized.includes("portfolio")) return "links";
  if (normalized.includes("reference")) return "references";
  return normalized.replace(/\s+/g, "_");
}

function candidateEditorSectionText(elements: Element[]) {
  return elements
    .flatMap((element) => element.tagName.toLowerCase() === "ul" || element.tagName.toLowerCase() === "ol"
      ? candidateEditorListItems(element)
      : [candidateEditorCleanText(element.textContent)])
    .filter(Boolean)
    .join("\n");
}

function candidateEditorSectionList(elements: Element[]) {
  return uniqueTextList(elements.flatMap((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") return candidateEditorListItems(element);
    return splitLineList(candidateEditorCleanText(element.textContent));
  }));
}

function candidateEditorListItems(element: Element) {
  return Array.from(element.querySelectorAll("li")).map((item) => candidateEditorCleanText(item.textContent)).filter(Boolean);
}

function candidateEditorListHtml(value: unknown, placeholder: string) {
  const items = toTextList(value);
  return `<ul>${(items.length ? items : [placeholder]).map((item) => `<li>${candidateEditorEscapeHtml(item)}</li>`).join("")}</ul>`;
}

function candidateEditorParagraphHtml(value: unknown, placeholder: string) {
  const lines = splitLineList(textValue(value));
  return (lines.length ? lines : [placeholder]).map((line) => `<p>${candidateEditorEscapeHtml(line)}</p>`).join("\n");
}

function candidateEditorEscapeHtml(value: unknown) {
  return textValue(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

function candidateEditorCleanText(value: unknown) {
  const clean = textValue(value).replace(/\s+/g, " ").trim();
  const placeholder = /^(your name|target role or professional headline|city, state|write a 2-4 line|role title|company|location|start|end|project name|degree|school|field|graduation year|skill one|certification name|award, scholarship|publication, patent|language one|portfolio, blog|available on request|describe scope|relevant coursework)/i;
  return placeholder.test(clean) ? "" : clean;
}

function candidateEditorNormalizeUrl(value: string) {
  const clean = value.trim().replace(/[),.;]+$/g, "");
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean.replace(/^\/+/, "")}`;
}

function candidateEditorLooksLikeDateRange(value: string) {
  return /\b(19|20)\d{2}\b|\b(present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(value);
}

function candidateEditorLooksLikeLocation(value: string) {
  return /,|\b(remote|united states|usa|india|canada|uk|london|new york|pittsburgh|columbus|austin|chicago|california|texas|ohio|bengaluru|delhi|mumbai)\b/i.test(value);
}

function candidateEditorSplitDateRange(value: string): [string, string] {
  const clean = candidateEditorCleanText(value);
  if (!clean) return ["", ""];
  const parts = clean.split(/\s+(?:-|–|—|to)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" - ")];
  return ["", clean];
}

function strengthenResumeSelection(value: string) {
  const cleaned = textValue(value).replace(/^[-•]\s*/, "");
  return strengthenResumeBullet(cleaned, null);
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

function candidateEditorBlockedSuggestion(reason?: string): CandidateAiSuggestion {
  return {
    status: "needs_more_context",
    assistant_message: reason || "Select one sentence, bullet, or paragraph at a time. AI edits cannot safely replace section headings or multiple resume blocks.",
    missing_facts: ["Select a smaller range inside a single bullet or paragraph."],
    warnings: ["This guard prevents AI suggestions from changing the resume layout."],
    action: "rewrite_selection",
  };
}

function candidateEditorPlainTextSuggestion(value: unknown) {
  let clean = textValue(value);
  if (!clean) return "";
  if (typeof window !== "undefined" && /<\/?[a-z][\s\S]*>/i.test(clean)) {
    const doc = new DOMParser().parseFromString(clean, "text/html");
    clean = doc.body.textContent || clean;
  }
  const ignoredLine = /^(suggested rewrite|rewrite|suggestion|rationale|why this works|notes?|guardrails?|warning)s?\s*:?$/i;
  return clean
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !ignoredLine.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateEditorNormalizeComparableText(value: string) {
  return textValue(value).replace(/\s+/g, " ").trim();
}

function candidateEditorRewriteRangeSafety(editor: any, from: number, to: number, originalText?: string): { safe: boolean; reason?: string } {
  const state = editor?.state;
  if (!state || !Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return { safe: false, reason: "Select one sentence, bullet, or paragraph before asking AI to improve it." };
  }
  try {
    const docSize = state.doc.content.size;
    if (from < 0 || to > docSize) {
      return { safe: false, reason: "The resume changed after the suggestion was created. Select the text again and retry." };
    }
    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);
    const sameParent = typeof $from.sameParent === "function" ? $from.sameParent($to) : $from.parent === $to.parent;
    if (!sameParent) {
      return { safe: false, reason: "The selection crosses multiple resume blocks. Select text inside one bullet or paragraph so the layout stays intact." };
    }
    const parent = $from.parent;
    if (!parent?.isTextblock || parent.type?.name === "heading") {
      return { safe: false, reason: "AI rewrite is disabled for headings and section labels. Edit headings manually to protect the resume structure." };
    }
    let hasHeading = false;
    let blockCount = 0;
    state.doc.nodesBetween(from, to, (node: any) => {
      if (node.type?.name === "heading") hasHeading = true;
      if (node.isBlock) blockCount += 1;
      return !hasHeading;
    });
    if (hasHeading || blockCount > 1) {
      return { safe: false, reason: "The selection includes section structure. Select only the text inside one paragraph or one bullet." };
    }
    if (originalText) {
      const currentText = state.doc.textBetween(from, to, " ").trim();
      if (candidateEditorNormalizeComparableText(currentText) !== candidateEditorNormalizeComparableText(originalText)) {
        return { safe: false, reason: "The selected text changed after the suggestion was created. Select the updated text and ask AI again." };
      }
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: "The editor could not safely apply that suggestion. Select the text again and retry." };
  }
}

type CandidateEditorBlockKind = "summary" | "experience" | "project" | "education" | "skills" | "certification" | "publication" | "award" | "reference" | "custom";

const candidateEditorBlockOptions: Array<{ kind: CandidateEditorBlockKind; label: string }> = [
  { kind: "experience", label: "Experience" },
  { kind: "project", label: "Project" },
  { kind: "education", label: "Education" },
  { kind: "skills", label: "Skills" },
  { kind: "certification", label: "Certification" },
  { kind: "custom", label: "Custom" },
];

function candidateEditorSlashCommand(textBeforeCursor: string): { raw: string; kind: CandidateEditorBlockKind } | null {
  const match = textBeforeCursor.match(/(?:^|\s)(\/(?:summary|experience|role|job|project|education|school|skills|certification|publication|award|reference|custom))$/i);
  if (!match) return null;
  const raw = match[1];
  const normalized = raw.slice(1).toLowerCase();
  const kind: CandidateEditorBlockKind =
    normalized === "role" || normalized === "job" ? "experience"
      : normalized === "school" ? "education"
        : normalized === "certification" ? "certification"
          : normalized === "publication" ? "publication"
            : normalized === "award" ? "award"
              : normalized === "reference" ? "reference"
                : normalized === "summary" ? "summary"
                  : normalized === "project" ? "project"
                    : normalized === "skills" ? "skills"
                      : normalized === "custom" ? "custom"
                        : "custom";
  return { raw, kind };
}

function candidateEditorBlockHtml(kind: CandidateEditorBlockKind) {
  if (kind === "summary") {
    return [
      "<h2>Summary</h2>",
      "<p>Write a concise factual summary with target role, strongest domain, key tools, and measurable scope.</p>",
    ].join("\n");
  }
  if (kind === "experience") {
    return candidateEditorItemHtml({
      title: "Role Title",
      company: "Company",
      location: "Location",
      start_date: "Start",
      end_date: "End",
      bullets: [
        "Owned scope, tools, users/data volume, and measurable business or technical result.",
        "Collaborated with teams/stakeholders and improved reliability, cost, speed, quality, or user adoption.",
      ],
    }, "experience");
  }
  if (kind === "project") {
    return candidateEditorItemHtml({
      name: "Project Name",
      role: "Your Role / Stack",
      start_date: "Start",
      end_date: "End",
      bullets: [
        "Built or contributed to the project using relevant tools and explain the problem solved.",
        "Quantify usage, scale, accuracy, latency, savings, automation, or other measurable outcome if true.",
      ],
    }, "project");
  }
  if (kind === "education") {
    return candidateEditorItemHtml({
      degree: "Degree",
      school: "School",
      field: "Field of Study",
      location: "Location",
      end_date: "Graduation Year",
      details: ["Relevant coursework, thesis, honors, GPA, research, or leadership if useful."],
    }, "education");
  }
  if (kind === "skills") {
    return "<h2>Skills</h2><p>Languages: Python, JavaScript, SQL<br>Frameworks: React, FastAPI<br>Platforms: AWS, Azure, Docker<br>Domains: Data Engineering, AI, Analytics</p>";
  }
  if (kind === "certification") {
    return "<h2>Certifications</h2><ul><li>Certification name — issuer, year</li></ul>";
  }
  if (kind === "publication") {
    return "<h2>Publications</h2><ul><li>Publication, patent, paper, article, or conference item</li></ul>";
  }
  if (kind === "award") {
    return "<h2>Awards</h2><ul><li>Award, scholarship, competition result, or recognition</li></ul>";
  }
  if (kind === "reference") {
    return "<h2>References</h2><ul><li>Available on request</li></ul>";
  }
  return "<h2>Custom Section</h2><p>Add section details here.</p><ul><li>Add one strong supporting point.</li></ul>";
}

export function candidateStarterResumeProfile(): CandidatePortalProfile["profile"] {
  return {
    display_name: "Aarav Mehta",
    headline: "Software Engineer",
    current_location: "Austin, TX",
    email: "aarav.mehta@email.com",
    phone: "555.018.2048",
    linkedin_url: "https://www.linkedin.com/in/aarav-mehta",
    portfolio_url: "https://aarav.dev",
    github_url: "https://github.com/aaravm",
    summary: "Software engineer focused on building reliable web applications, internal tools, and data-backed product workflows. Experienced with React, TypeScript, Python, APIs, SQL, and cloud deployment. Strong at turning ambiguous user needs into maintainable product features.",
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Python",
      "FastAPI",
      "PostgreSQL",
      "REST APIs",
      "AWS",
      "Docker",
      "CI/CD",
    ],
    experience: [
      {
        title: "Software Engineer",
        company: "Northstar Analytics",
        location: "Austin, TX",
        start_date: "2023-06",
        end_date: "Present",
        bullets: [
          "Built customer-facing dashboards in React and TypeScript used by operations teams to monitor daily workflow performance.",
          "Created Python and FastAPI services that reduced manual data cleanup work by standardizing API responses and validation rules.",
          "Improved release quality by adding automated checks, deployment runbooks, and production issue triage notes for recurring failures.",
        ],
        workstreams: [
          {
            name: "Reporting automation",
            role: "Full-stack owner",
            technologies: ["React", "FastAPI", "PostgreSQL"],
            bullets: [
              "Designed reusable reporting screens and API endpoints for account, usage, and exception review workflows.",
            ],
          },
        ],
      },
      {
        title: "Software Engineering Intern",
        company: "BrightCart",
        location: "Remote",
        start_date: "2022-05",
        end_date: "2022-08",
        bullets: [
          "Implemented reusable UI components for product catalog management and wrote integration tests for key seller workflows.",
          "Partnered with a senior engineer to debug API latency issues and document practical monitoring steps for the support team.",
        ],
      },
    ],
    projects: [
      {
        name: "Resume Match Assistant",
        role: "Creator",
        start_date: "2024-01",
        end_date: "2024-03",
        bullets: [
          "Built a resume-to-job matching prototype that compared structured resume sections against job requirements and highlighted missing terms.",
          "Added PDF export, version labels, and a basic application tracker so users could remember which resume was shared where.",
        ],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        school: "University of Texas at Austin",
        field: "Computer Science",
        location: "Austin, TX",
        end_date: "2023",
        details: ["Relevant coursework: databases, distributed systems, software engineering, data structures."],
      },
    ],
    certifications: ["AWS Cloud Practitioner"],
    awards: ["Dean's List"],
    publications: [],
    languages: ["English"],
    links: ["https://aarav.dev/projects/resume-match"],
    other_sections: {
      references: ["Available on request"],
    },
  };
}

function splitLineList(value: string): string[] {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}
