"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";
import type {
  Candidate,
  CandidateProfileUpdate,
  CandidateVersionMatch,
  LinkedInVerificationRun,
  ParseBatch,
  TeamMember,
} from "../../lib/api";
import {
  getCandidateDocumentHtml,
  getCandidateRawText,
  getCandidateSource,
  getLinkedInVerification,
  verifyLinkedInProfile,
} from "../../lib/api";
import { CandidateCorrectionPanel } from "./candidate-correction-panel";
import {
  LinkedInVerificationSummary,
  NoteTypeButtons,
  PiiGroup,
  VerificationRow,
  isLinkedInVerified,
  linkedinMatchConfidence,
  linkedinVerificationLabel,
  linkedinVerificationStatus,
} from "./candidate-detail-widgets";
import { CandidateWorkEducationTimeline } from "./candidate-timeline-panel";
import { CollaborationPanel } from "./collaboration-panel";
import { EmptyPanel, Metric, ProgressBar } from "./primitives";
import { RECRUITER_COPY } from "./recruiter-language";
import {
  candidateVersionDocumentLabel,
  candidateVersionLinks,
  candidateVersionSummary,
  versionStatusLabel,
} from "../lib/candidate-versions";
import {
  candidateCorrectionForm,
  candidateCorrectionPayload,
  coverageGapReasons,
  type CandidateCorrectionForm,
} from "../lib/candidate-corrections";
import {
  buildTimelineRows,
  candidateEducationRows,
  candidateEducationTimelineEvents,
  dedupeTimelineEvents,
  educationDateLabel,
  normalizeComparableText,
  timelineYearMarkers,
} from "../lib/candidate-timeline";
import { candidateLocationChips } from "../lib/candidate-location";
import {
  candidateProfileFreshnessNeedsReview,
  profileFreshnessBadgeClass,
  type CandidateReviewSignal,
} from "../lib/candidate-database";
import { buildRecruiterEvidenceRows, evidenceTerms } from "../lib/candidate-evidence";
import { domainLabel, formatDateTime, textValue, toTextList } from "../lib/format";
import { copyCurrentUrl, type CandidateDetailTab } from "../lib/workspace-route";

export function CandidateDetail({
  candidate,
  token,
  teamMembers,
  reparseBatches,
  noteName,
  setNoteName,
  note,
  setNote,
  saveNote,
  noteSaveState,
  noteSaveError,
  deletingNoteId,
  updateSavedNote,
  deleteSavedNote,
  updateProfile,
  deleteCandidate,
  openCandidate,
  reparseCandidate,
  canReparse,
  match,
  activeTab,
  setActiveTab,
  refreshCandidate,
  openCandidateVersions,
  markReviewSignal,
}: {
  candidate: Candidate;
  token: string;
  teamMembers: TeamMember[];
  reparseBatches: ParseBatch[];
  noteName: string;
  setNoteName: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  saveNote: () => Promise<void> | void;
  noteSaveState: "idle" | "saving" | "saved" | "error";
  noteSaveError: string;
  deletingNoteId: string;
  updateSavedNote: (noteId: string, name: string, content: string) => void;
  deleteSavedNote: (noteId: string) => void;
  updateProfile: (payload: CandidateProfileUpdate) => void;
  deleteCandidate: (documentId: string) => void;
  openCandidate: (id: string) => void;
  reparseCandidate: (id: string) => void;
  canReparse: boolean;
  match: () => void;
  activeTab: CandidateDetailTab;
  setActiveTab: (tab: CandidateDetailTab) => void;
  refreshCandidate: () => Promise<void> | void;
  openCandidateVersions: () => void;
  markReviewSignal: (signalKey: CandidateReviewSignal) => void;
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
  const [showRawCvText, setShowRawCvText] = useState(false);
  const [showCorrectionPanel, setShowCorrectionPanel] = useState(false);
  const [linkedinUrlDraft, setLinkedinUrlDraft] = useState("");
  const [linkedinRun, setLinkedinRun] = useState<LinkedInVerificationRun | null>(null);
  const [linkedinVerifyState, setLinkedinVerifyState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [linkedinVerifyError, setLinkedinVerifyError] = useState("");
  const [correctionForm, setCorrectionForm] = useState<CandidateCorrectionForm>(() => candidateCorrectionForm(candidate));
  const reportTopRef = useRef<HTMLElement | null>(null);
  const intelligence = candidate.candidate_intelligence;
  const finalProfile = intelligence?.final_candidate_profile;
  const recruiterDashboard = intelligence?.hr_intelligence?.recruiter_dashboard;
  const timeline = intelligence?.timeline ?? candidate.derived?.timeline;
  const locationIntel = candidate.derived?.location_intelligence;
  const piiIntel = candidate.derived?.pii_contact_intelligence ?? {};
  const linkedinProfileUrls = toTextList(piiIntel.linkedin_urls ?? []);
  const otherLinkedinUrls = toTextList(piiIntel.other_linkedin_urls ?? []);
  const portfolioUrls = toTextList(piiIntel.portfolio_websites ?? []);
  const profileVerification = candidate.derived?.profile_verification ?? {};
  const profileFreshness = candidate.derived?.profile_freshness ?? {};
  const linkedinExternal = profileVerification.linkedin_external ?? {};
  const recruiterNoteSignals = candidate.derived?.recruiter_note_signals ?? {};
  const factVerification = candidate.derived?.fact_verification ?? {};
  const reviewedSignals = candidate.reviewed_signals ?? [];
  const roleFactNeedsReview = Boolean(factVerification.current_role_status && factVerification.current_role_status !== "verified" && !reviewedSignals.includes("role_fact_review"));
  const timelineEvents = timeline?.timeline_events ?? [];
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
  const latestJobLocation = textValue(locationIntel?.latest_role_location) || textValue(locationIntel?.current_job_location) || textValue(candidate.experience?.[0]?.location);
  const resumeHeaderLocation = textValue(locationIntel?.resume_header_location) || textValue(candidate.contact?.location);
  const currentLocation = resumeHeaderLocation || textValue(locationIntel?.current_location);
  const currentLocationSource = resumeHeaderLocation && currentLocation === resumeHeaderLocation ? "resume_header" : textValue(locationIntel?.current_location_source);
  const coverage = candidate.primary_key_coverage;
  const coverageScore = Number(coverage?.score ?? 0);
  const needsUploadReview = coverageScore > 0 && coverageScore < 0.8 && !reviewedSignals.includes("low_coverage");
  const profileFreshnessNeedsReview = candidateProfileFreshnessNeedsReview(candidate);
  const verifiedFactRows = [
    candidate.name ? { label: "Name", value: candidate.name, source: "Parsed identity field", query: [candidate.name] } : null,
    candidate.contact?.email ? { label: "Email", value: candidate.contact.email, source: "Parsed contact field", query: [candidate.contact.email] } : null,
    candidate.contact?.phone ? { label: "Phone", value: candidate.contact.phone, source: "Parsed contact field", query: [candidate.contact.phone] } : null,
    linkedinProfileUrls.length ? { label: "LinkedIn", value: linkedinProfileUrls[0], source: "Deterministic PII/link extraction", query: linkedinProfileUrls.slice(0, 2) } : null,
    portfolioUrls.length ? { label: "Portfolio", value: portfolioUrls[0], source: "Deterministic PII/link extraction", query: portfolioUrls.slice(0, 2) } : null,
    currentLocation ? { label: "Current location", value: currentLocation, source: currentLocationSource === "resume_header" ? "Resume contact/header location" : "Explicit current/profile location", query: [currentLocation] } : null,
    latestJobLocation ? { label: "Latest role location", value: latestJobLocation, source: "Latest experience location", query: [latestJobLocation] } : null,
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
    setCorrectionForm(candidateCorrectionForm(candidate));
    setShowCorrectionPanel(false);
    setLinkedinUrlDraft(primaryLinkedIn || "");
    setLinkedinVerifyState("idle");
    setLinkedinVerifyError("");
    // Keep manual correction edits stable during same-candidate refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.document_id]);

  useEffect(() => {
    let active = true;
    getLinkedInVerification(token, candidate.document_id)
      .then((result) => {
        if (active) setLinkedinRun(result.run);
      })
      .catch(() => {
        if (active) setLinkedinRun(null);
      });
    return () => {
      active = false;
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
  const educationRows = candidateEducationRows(candidate.education ?? []);
  const educationTimelineEvents = candidateEducationTimelineEvents(candidate.education ?? []);
  const fallbackWorkTimelineEvents = candidate.experience.map((item, index) => ({
      id: `${item.company ?? "company"}-${item.title ?? "role"}-${index}`,
      title: item.title,
      organization: item.company,
      start_date: item.start_date,
      end_date: item.end_date,
      summary: item.bullets?.[0],
      workstreams: item.workstreams ?? [],
      relationship: "work",
      crossCompanyOverlap: false,
    }));
  const timelineBaseEvents = timelineEvents.length ? timelineEvents : fallbackWorkTimelineEvents;
  const reportTimeline = buildTimelineRows(dedupeTimelineEvents([
    ...timelineBaseEvents,
    ...educationTimelineEvents,
  ]));
  const timelineMarkers = timelineYearMarkers(reportTimeline);
  const verifiedSkillGroups = skillTaxonomyEntries.length
    ? skillTaxonomyEntries.map(([group, values]) => ({ group, skills: toTextList(Array.isArray(values) ? values : []) }))
    : [{ group: "Skills", skills: candidate.skills ?? [] }];
  const candidateTabs: Array<{ id: CandidateDetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "evidence", label: "Evidence" },
    { id: "cv", label: "Original CV" },
    { id: "notes", label: "Notes" },
    { id: "versions", label: "Versions" },
  ];
  const locationChips = candidateLocationChips(locationSignals, currentLocation);
  const primaryLinkedIn = linkedinProfileUrls[0];
  const primaryPortfolio = portfolioUrls[0];
  const linkedinVerified = isLinkedInVerified(linkedinRun, profileVerification.linkedin, linkedinExternal);
  const linkedinConfidence = linkedinMatchConfidence(linkedinRun, linkedinExternal);
  const linkedinConfidenceLabel = typeof linkedinConfidence === "number" ? `${Math.round(linkedinConfidence * 100)}% match` : null;
  const linkedinVerificationBusy = linkedinVerifyState === "running" || linkedinRun?.status === "running" || linkedinRun?.status === "queued";
  const versionMatches = candidate.candidate_versions?.matches ?? [];
  const versionLinks = candidateVersionLinks(candidate, versionMatches);
  const versionSummary = candidateVersionSummary(versionLinks);
  const reparseStatusBatch = latestCandidateReparseBatch(reparseBatches, sourceName);
  const reparseProgress = reparseStatusBatch ? Number(reparseStatusBatch.progress_percent ?? batchProgress(reparseStatusBatch)) : 0;
  const parseQuality = candidate._metadata?.parse_quality ?? {};
  const deepParseFailed = parseQuality.deep_parse_status === "failed" || intelligence?.status === "failed";
  const recruiterEvidenceRows = buildRecruiterEvidenceRows(verifiedFactRows, aiFitRows, evidenceMap, rawText);
  const coverageReasons = coverageGapReasons(coverage);
  const structuredNoteSignals = noteSignalItems(recruiterNoteSignals);
  const recentRecruiterNotes = (candidate.notes ?? []).slice(0, 2);
  const candidateRiskItems = [
    ...concerns.slice(0, 3),
    ...coverageReasons.slice(0, 2).map((reason) => `${reason.label}: ${reason.detail}`),
    roleFactNeedsReview ? "Current role facts need recruiter review before relying on matching." : "",
    profileFreshnessNeedsReview && profileFreshness?.summary ? profileFreshness.summary : "",
    !primaryLinkedIn ? "LinkedIn profile was not found in the resume." : linkedinVerified ? "" : "LinkedIn profile is present but not verified yet.",
  ].filter((item): item is string => Boolean(item));

  function saveCandidateCorrections() {
    updateProfile(candidateCorrectionPayload(correctionForm));
    setShowCorrectionPanel(false);
  }

  function selectCandidateTab(tab: CandidateDetailTab) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      reportTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  async function verifyLinkedIn() {
    const targetUrl = linkedinUrlDraft.trim() || primaryLinkedIn || "";
    setLinkedinVerifyState("running");
    setLinkedinVerifyError("");
    try {
      const result = await verifyLinkedInProfile(token, candidate.document_id, targetUrl);
      setLinkedinRun(result.run);
      await pollLinkedInVerification(result.run.id);
    } catch (error) {
      setLinkedinVerifyState("error");
      setLinkedinVerifyError(readableError(error));
    }
  }

  async function pollLinkedInVerification(runId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await delay(1200);
      const result = await getLinkedInVerification(token, candidate.document_id);
      if (result.run) setLinkedinRun(result.run);
      if (result.run && ["succeeded", "failed"].includes(result.run.status)) {
        if (result.run.status === "succeeded") {
          setLinkedinVerifyState("done");
          await refreshCandidate();
        } else {
          setLinkedinVerifyState("error");
          setLinkedinVerifyError(result.run.error_message || "LinkedIn verification failed");
        }
        return;
      }
      if (result.run?.id !== runId && result.run?.status === "succeeded") {
        setLinkedinVerifyState("done");
        await refreshCandidate();
        return;
      }
    }
    setLinkedinVerifyState("idle");
  }

  return (
    <section className="candidateReport candidateTabbedReport candidateCleanReport">
      <header className="candidateCleanHeader">
        <section className="candidateCleanIdentity">
          <div className="candidateReportAvatar">{candidateInitials(candidate.name)}</div>
          <div>
            <span className="reportLabel">Candidate Report</span>
            <h2 className="candidateNameLine">
              {candidate.name ?? "Unknown Candidate"}
              {primaryLinkedIn ? (
                <span className={linkedinVerified ? "linkedinHeaderBadge verified" : "linkedinHeaderBadge"}>
                  {linkedinVerified ? <CheckCircle2 size={15} /> : null}
                  <a href={primaryLinkedIn} target="_blank" rel="noreferrer">LinkedIn</a>
                  {linkedinVerified ? (
                    <b>{linkedinConfidenceLabel ? `Verified · ${linkedinConfidenceLabel}` : "Verified"}</b>
                  ) : (
                    <button type="button" onClick={() => void verifyLinkedIn()} disabled={linkedinVerificationBusy}>
                      {linkedinVerificationBusy ? "Verifying..." : "Verify"}
                    </button>
                  )}
                </span>
              ) : null}
            </h2>
            <p>
              {hr?.current_title ?? finalProfile?.summary_card?.current_or_target_title ?? "Role not extracted"}
              {hr?.current_company ? ` at ${hr.current_company}` : ""}
            </p>
            <div className="candidateReportBadges">
              <span>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)} experience</span>
              {roleFactNeedsReview ? <span className="factReviewBadge"><AlertTriangle size={13} /> Role facts need review</span> : <span className="factVerifiedBadge">Role facts verified</span>}
              {profileFreshness?.label ? <span className={profileFreshnessBadgeClass(profileFreshness.status)}>{profileFreshness.label}</span> : null}
              {currentLocation ? <span className="currentLocationBadge">Current location: {currentLocation}</span> : <span className="currentLocationBadge muted">Current location not stated</span>}
              <span className={versionSummary.needsReview ? "versionReviewBadge" : ""}>{versionSummary.needsReview ? <AlertTriangle size={13} /> : null}{versionSummary.badge}</span>
              {reparseStatusBatch ? <span className="reparseStatusBadge">Reparse: {domainLabel(reparseStatusBatch.status)}</span> : null}
              {primaryPortfolio ? <a href={primaryPortfolio} target="_blank" rel="noreferrer">Portfolio</a> : null}
            </div>
          </div>
        </section>
        <section className="candidateCleanActions">
          <button className="plain" type="button" onClick={() => copyCurrentUrl()}>Copy Link</button>
          <button className="plain" type="button" onClick={() => selectCandidateTab("cv")}>View CV</button>
          <button className="plain" type="button" onClick={() => selectCandidateTab("notes")}>Recruiter Notes</button>
          {canReparse ? <button className="plain" type="button" onClick={() => reparseCandidate(candidate.document_id)}>Reparse CV</button> : null}
          {roleFactNeedsReview ? <button className="plain" type="button" onClick={() => markReviewSignal("role_fact_review")}>Mark role reviewed</button> : null}
          {profileFreshnessNeedsReview ? <button className="plain" type="button" onClick={() => markReviewSignal("profile_freshness_review")}>Mark freshness reviewed</button> : null}
          <button className="plain candidateHazardAction" type="button" onClick={() => deleteCandidate(candidate.document_id)}><AlertTriangle size={14} /> Archive Upload</button>
          <button className="primary" type="button" onClick={match}>Match to Role</button>
        </section>
      </header>
      {deepParseFailed ? (
        <article className="candidateParseQualityBanner">
          <AlertTriangle size={18} />
          <div>
            <strong>Deep AI analysis did not complete</strong>
            <span>{parseQuality.deep_parse_error || intelligence?.error || "The factual extraction is available, but the richer HR intelligence needs a retry."}</span>
          </div>
          {canReparse ? <button className="secondary" type="button" onClick={() => reparseCandidate(candidate.document_id)}>Retry deep parse</button> : null}
        </article>
      ) : null}
      {needsUploadReview ? (
        <article className="candidateBadUploadBanner">
          <AlertTriangle size={18} />
          <div>
            <strong>Profile needs review ({Math.round(coverageScore * 100)}% complete)</strong>
            <span>{coverageScore < 0.65 ? "This is below the usable profile threshold. It may be a wrong upload, weak scan, or missing core resume sections." : "This is usable but needs recruiter review before matching confidence is high."}</span>
            {coverageReasons.length ? (
              <ul>
                {coverageReasons.slice(0, 4).map((reason) => <li key={`${reason.label}-${reason.detail}`}>{reason.label}: {reason.detail}</li>)}
              </ul>
            ) : null}
          </div>
          <button className="plain" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit extracted fields</button>
          <button className="plain" onClick={() => markReviewSignal("low_coverage")}>Mark reviewed</button>
          <button className="plain candidateHazardAction" onClick={() => deleteCandidate(candidate.document_id)}><AlertTriangle size={14} /> Archive from active database</button>
        </article>
      ) : null}
      {showCorrectionPanel ? (
        <CandidateCorrectionPanel
          form={correctionForm}
          setForm={setCorrectionForm}
          save={saveCandidateCorrections}
          cancel={() => setShowCorrectionPanel(false)}
        />
      ) : null}

      <main ref={reportTopRef} className="candidateReportMain candidateCleanMainShell">
        <header className="candidateBriefHeader">
          <div>
            <h2>{activeTab === "overview" ? "Overview" : candidateTabs.find((tab) => tab.id === activeTab)?.label}</h2>
            <p>{RECRUITER_COPY.candidateReportSubtitle}</p>
          </div>
          <div>
              <button className="plain" type="button" onClick={() => selectCandidateTab("evidence")}>Source Evidence</button>
              <button className="plain" type="button" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit Extracted Data</button>
              <button className="plain" type="button" onClick={() => selectCandidateTab("notes")}>Add Note</button>
            </div>
        </header>

        <nav className="candidateReportTabs" aria-label="Candidate detail sections">
          {candidateTabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => selectCandidateTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="candidateReviewWorkspace">
          <div className="candidateReviewMain">
        {activeTab === "overview" ? (
          <section className="candidateOverviewStack">
            <div className="candidateCleanPrimary">
              <article className="candidateReportHeroCard">
                <span className="reportLabel">Recruiter Summary</span>
                <p>{dashboardBullets[0] || finalProfile?.summary_card?.headline || candidate.summary || "No recruiter summary is available yet. Review the resume and add notes."}</p>
              </article>

              <article className="briefCard candidateIdentityLocationCard">
                <div className="candidateSectionHeader">
                  <div>
                    <h3>Identity & Location</h3>
                    <p>Current location prefers the resume header/profile location. Latest role location is shown separately when it differs.</p>
                  </div>
                  <span>{currentLocation ? "Current location found" : "Current location unknown"}</span>
                </div>
                <div className="identityLocationGrid">
                  <div className="currentLocationCallout">
                    <span>Current location</span>
                    <strong>{currentLocation || "Not stated"}</strong>
                    {currentLocationSource ? <em>Source: {domainLabel(currentLocationSource)}</em> : null}
                    {latestJobLocation && latestJobLocation !== currentLocation ? <em>Latest role: {latestJobLocation}</em> : null}
                  </div>
                  <div className="locationChipList">
                    {locationChips.length ? locationChips.map((item, index) => (
                      <span className={item.current ? "currentLocationChip" : ""} key={`${item.label}-${index}`}>{item.label}</span>
                    )) : <span>No country or location signals found</span>}
                  </div>
                </div>
                <div className="piiList clean identityPiiList">
                  <PiiGroup label="Email" values={piiIntel.emails ?? (candidate.contact?.email ? [candidate.contact.email] : [])} />
                  <PiiGroup label="Phone" values={piiIntel.phones ?? (candidate.contact?.phone ? [candidate.contact.phone] : [])} />
                  <PiiGroup label="LinkedIn profile" values={linkedinProfileUrls} />
                  {otherLinkedinUrls.length ? <PiiGroup label="Other LinkedIn links" values={otherLinkedinUrls} compact /> : null}
                  <PiiGroup label="Portfolio" values={portfolioUrls} />
                </div>
              </article>

              <section className="candidateDecisionGrid" aria-label="Recruiter decision cards">
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Role fit</span>
                  <h3>Best Roles</h3>
                  <div className="roleCards">{bestFitRoles.length ? bestFitRoles.slice(0, 5).map((role, index) => <span key={`${role}-${index}`}>{role}</span>) : <span>No suggested roles generated</span>}</div>
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Decision signal</span>
                  <h3><CheckCircle2 size={18} /> Why Call</h3>
                  {strengths.length ? (
                    <ul>{strengths.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                  ) : <p className="muted">No strong signals generated yet.</p>}
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Profile verification</span>
                  <h3><ShieldCheck size={18} /> Verification</h3>
                  <div className="decisionFactList">
                    <div><span>Freshness</span><strong>{profileFreshness?.label ?? "Unknown"}</strong></div>
                    <div><span>LinkedIn</span><strong>{linkedinVerified ? (linkedinConfidenceLabel ?? "Verified") : primaryLinkedIn ? "Needs verification" : "Not found"}</strong></div>
                    <div><span>Portfolio</span><strong>{primaryPortfolio ? "Found" : "Not found"}</strong></div>
                    <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong></div>
                  </div>
                  {profileFreshness?.summary ? <p className="muted">{profileFreshness.summary}</p> : null}
                  {profileFreshnessNeedsReview ? (
                    <button className="plain small" type="button" onClick={() => markReviewSignal("profile_freshness_review")}>Mark freshness reviewed</button>
                  ) : null}
                </article>
                <article className="briefCard candidateDecisionCard">
                  <span className="reportLabel">Recruiter context</span>
                  <h3>Notes & Constraints</h3>
                  {structuredNoteSignals.length ? (
                    <div className="noteSignalList compact">
                      {structuredNoteSignals.slice(0, 5).map((item, index) => (
                        <span key={`${item.category}-${item.label}-${item.value ?? index}`}>
                          <b>{domainLabel(item.category)}</b>
                          {domainLabel(item.value || item.label)}
                        </span>
                      ))}
                    </div>
                  ) : recentRecruiterNotes.length ? (
                    <ul>{recentRecruiterNotes.map((item, index) => <li key={`${item.name}-${item.created_at ?? index}`}>{item.name}: {item.content}</li>)}</ul>
                  ) : <p className="muted">No recruiter notes or structured constraints saved yet.</p>}
                </article>
                <article className="briefCard candidateDecisionCard concern">
                  <span className="reportLabel">Screening plan</span>
                  <h3><AlertTriangle size={18} /> Risks & Questions</h3>
                  {candidateRiskItems.length || screeningQuestions.length ? (
                    <ul>
                      {candidateRiskItems.slice(0, 3).map((item, index) => <li key={`risk-${index}`}>{item}</li>)}
                      {screeningQuestions.slice(0, Math.max(1, 4 - candidateRiskItems.length)).map((question, index) => <li key={`question-${index}`}>Ask: {question}</li>)}
                    </ul>
                  ) : <p className="muted">No concerns generated. Recruiter should still validate fit in screening.</p>}
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

              <article className="briefCard candidateEducationCard">
                <div className="candidateSectionHeader">
                  <div>
                    <h3>Education</h3>
                    <p>Parsed from the CV and included in candidate matching context.</p>
                  </div>
                  <span>{educationRows.length ? `${educationRows.length} record${educationRows.length === 1 ? "" : "s"}` : "Missing"}</span>
                </div>
                {educationRows.length ? (
                  <div className="educationList">
                    {educationRows.map((item, index) => (
                      <article key={`${item.school}-${item.degree}-${index}`}>
                        <div>
                          <strong>{item.degree || item.field || "Education"}</strong>
                          <span>{item.school || "School not extracted"}</span>
                        </div>
                        <em>{[item.field, item.location].filter(Boolean).join(" | ") || "Field/location not stated"}</em>
                        <small>{educationDateLabel(item)}</small>
                        {item.details.length ? <p>{item.details.slice(0, 2).join(" ")}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : <p className="muted">No education history was extracted. Use source evidence or reparse if the CV contains education.</p>}
              </article>

              <CandidateWorkEducationTimeline
                rows={reportTimeline}
                markers={timelineMarkers}
                uniqueExperience={formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "timeline" ? (
          <CandidateWorkEducationTimeline
            rows={reportTimeline}
            markers={timelineMarkers}
            uniqueExperience={formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}
          />
        ) : null}

        {activeTab === "notes" ? (
          <section className="candidateNotesWorkspace" id="candidate-notes">
            <article className="briefCard recruiterNotesReport polishedNotesReport">
              <div className="notesComposerHeader">
                <div>
                  <h3>Recruiter Notes</h3>
                  <p>Notes are saved to the candidate profile and included in search/matching context.</p>
                </div>
                <NoteTypeButtons setNoteName={setNoteName} />
              </div>
              <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write recruiter notes. These become searchable candidate context." />
              <button className="secondary" type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteSaveState === "saving"}>
                {noteSaveState === "saving" ? "Saving..." : noteSaveState === "saved" ? "Saved" : "Save Note"}
              </button>
              {noteSaveError ? <p className="noteSaveFeedback error">{noteSaveError}</p> : null}
              {noteSaveState === "saved" ? <p className="noteSaveFeedback success">Recruiter note saved to this candidate.</p> : null}
              <div className="notes">
                {(candidate.notes ?? []).map((item, index) => (
                  <article key={`${item.created_at}-${index}`}>
                    {editingNoteId === item.id ? (
                      <>
                        <input value={editingNoteName} onChange={(event) => setEditingNoteName(event.target.value)} />
                        <textarea value={editingNoteContent} onChange={(event) => setEditingNoteContent(event.target.value)} />
                        <div className="jobActions">
                          <button className="plain small" type="button" onClick={() => setEditingNoteId("")}>Cancel</button>
                          <button className="secondary small" type="button" onClick={() => {
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
                        <span>{item.created_at ? new Date(item.created_at).toLocaleString() : "Saved"} | {domainLabel(item.visibility ?? "team")}</span>
                        {item.id ? (
                          <div className="jobActions">
                            <button className="plain small" type="button" onClick={() => {
                              setEditingNoteId(item.id ?? "");
                              setEditingNoteName(item.name);
                              setEditingNoteContent(item.content);
                            }}>Edit</button>
                            <button
                              className="plain small danger"
                              type="button"
                              disabled={deletingNoteId === item.id}
                              onClick={() => item.id && deleteSavedNote(item.id)}
                            >
                              {deletingNoteId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                ))}
              </div>
            </article>
            <CollaborationPanel token={token} entityType="candidate" entityId={candidate.document_id} teamMembers={teamMembers} />
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
            <CandidateVersionRail candidate={candidate} matches={versionMatches} openCandidate={openCandidate} openCandidateVersions={openCandidateVersions} />
          </section>
        ) : null}
          </div>

          <aside className="candidateContextRail candidatePersistentRail" aria-label="Candidate recruiter context">
            <article className="briefCard recruiterQuickNotes">
              <div className="railCardHeader">
                <div>
                  <span className="reportLabel">Recruiter Context</span>
                  <h3>Notes</h3>
                </div>
                <button className="plain small" type="button" onClick={() => selectCandidateTab("notes")}>All Notes</button>
              </div>
              <NoteTypeButtons setNoteName={setNoteName} />
              <input value={noteName} onChange={(event) => setNoteName(event.target.value)} placeholder="Note title" />
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a quick recruiter note. It becomes searchable context." />
              <button className="secondary" type="button" onClick={() => void saveNote()} disabled={!note.trim() || noteSaveState === "saving"}>
                {noteSaveState === "saving" ? "Saving..." : noteSaveState === "saved" ? "Saved" : "Save Note"}
              </button>
              {noteSaveError ? <p className="noteSaveFeedback error">{noteSaveError}</p> : null}
              {noteSaveState === "saved" ? <p className="noteSaveFeedback success">Recruiter note saved.</p> : null}
              <div className="recentNotesCompact">
                {(candidate.notes ?? []).slice(0, 3).map((item, index) => (
                  <article key={`${item.id ?? item.created_at}-${index}`}>
                    <strong>{item.name}</strong>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Saved"}</span>
                    <p>{item.content}</p>
                    {item.id ? (
                      <div className="noteMiniActions">
                        <button className="plain small" type="button" onClick={() => {
                          setEditingNoteId(item.id ?? "");
                          setEditingNoteName(item.name);
                          setEditingNoteContent(item.content);
                          selectCandidateTab("notes");
                        }}>Edit</button>
                        <button
                          className="plain small danger"
                          type="button"
                          disabled={deletingNoteId === item.id}
                          onClick={() => item.id && deleteSavedNote(item.id)}
                        >
                          {deletingNoteId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!(candidate.notes ?? []).length ? <p className="muted">No recruiter notes yet.</p> : null}
              </div>
            </article>

            <article className="briefCard candidateRailActions">
              <h3>Next Action</h3>
              <div>
                <button className="primary" onClick={match}>Match to Role</button>
                <button className="plain" onClick={() => selectCandidateTab("cv")}>View Resume</button>
                <button className="plain" onClick={() => setShowCorrectionPanel((value) => !value)}>Edit Fields</button>
              </div>
            </article>

            <article className="briefCard candidateRailSnapshot">
              <h3>Profile Snapshot</h3>
              <div className="compactMetaList">
                <div><span>Coverage</span><strong>{coverage ? `${Math.round(coverage.score * 100)}%` : "Unknown"}</strong></div>
                <div><span>Experience</span><strong>{formatYears(accounting?.total_years_unique ?? hr?.total_years_experience)}</strong></div>
                <div><span>Top domain</span><strong>{domainRows[0] ? domainLabel(domainRows[0].domain) : "Not found"}</strong></div>
                <div><span>Location</span><strong>{currentLocation || "Current location not stated"}</strong></div>
                <div><span>LinkedIn</span><strong>{linkedinVerified ? (linkedinConfidenceLabel ?? "Verified") : primaryLinkedIn ? "Not verified" : "Not found"}</strong></div>
                <div><span>Versions</span><strong>{versionSummary.quickFact}</strong></div>
              </div>
              <div className="profileVerificationList compact">
                <div className="profileVerificationHead">
                  <strong>Profile checks</strong>
                  <span>{domainLabel(profileVerification.external_verification_status ?? "not_configured")}</span>
                </div>
                <VerificationRow label="LinkedIn" item={profileVerification.linkedin} />
                <VerificationRow label="Portfolio" item={profileVerification.portfolio} />
              </div>
            </article>

            {(!primaryLinkedIn || linkedinVerifyError || linkedinRun?.status === "failed") ? (
            <article className="briefCard linkedinVerifyCard">
              <div className="railCardHeader">
                <div>
                  <span className="reportLabel">External profile</span>
                  <h3>LinkedIn Verification</h3>
                </div>
                <span className={`linkedinStatus ${linkedinVerificationStatus(linkedinRun, linkedinExternal)}`}>
                  {linkedinVerificationLabel(linkedinRun, linkedinExternal)}
                </span>
              </div>
              <p>
                Verify that the LinkedIn profile belongs to this candidate and surface updated roles, location, education, and certifications for recruiter review.
              </p>
              <input
                value={linkedinUrlDraft}
                onChange={(event) => setLinkedinUrlDraft(event.target.value)}
                placeholder="https://www.linkedin.com/in/..."
              />
              <button className="secondary" type="button" onClick={() => void verifyLinkedIn()} disabled={linkedinVerifyState === "running" || (!linkedinUrlDraft.trim() && !primaryLinkedIn)}>
                {linkedinVerifyState === "running" ? "Verifying..." : "Verify LinkedIn"}
              </button>
              {linkedinVerifyError ? <p className="noteSaveFeedback error">{linkedinVerifyError}</p> : null}
              <LinkedInVerificationSummary run={linkedinRun} external={linkedinExternal} />
            </article>
            ) : null}

            {noteSignalCount(recruiterNoteSignals) ? (
              <article className="briefCard noteSignalCard">
                <div className="railCardHeader">
                  <h3>Structured Note Signals</h3>
                  <span>{noteSignalCount(recruiterNoteSignals)} found</span>
                </div>
                <div className="noteSignalList">
                  {noteSignalItems(recruiterNoteSignals).slice(0, 8).map((item, index) => (
                    <span key={`${item.category}-${item.label}-${item.value ?? index}`}>
                      <b>{domainLabel(item.category)}</b>
                      {domainLabel(item.value || item.label)}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {versionLinks.length ? (
              <article className="briefCard candidateRailVersions">
                <div className="railCardHeader">
                  <h3>Versions</h3>
                  <button className="plain small" type="button" onClick={() => selectCandidateTab("versions")}>Review</button>
                </div>
                <p>{versionSummary.railText}</p>
                <button className="plain small" type="button" onClick={openCandidateVersions}>Open Candidate Versions</button>
              </article>
            ) : null}
          </aside>
        </section>

      </main>
    </section>
  );
}

function formatYears(value: unknown) {
  return typeof value === "number" ? `${value} yrs` : "Unknown";
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

function latestCandidateReparseBatch(batches: ParseBatch[], sourceName: string) {
  const normalizedSource = normalizeComparableText(sourceName);
  const matching = batches
    .filter((batch) => batch.source_type === "candidate_reparse")
    .filter((batch) => !normalizedSource || normalizeComparableText(batch.name).includes(normalizedSource))
    .sort((left, right) => new Date(right.updated_at ?? right.created_at ?? 0).getTime() - new Date(left.updated_at ?? left.created_at ?? 0).getTime());
  return matching[0] ?? null;
}

function batchProgress(batch: ParseBatch) {
  if (!batch.total_files) return 0;
  return ((batch.completed_count + batch.failed_count) / batch.total_files) * 100;
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
  if (raw.includes("Login did not return a session")) return "Login succeeded but the session could not be restored. Refresh the page and try again.";
  return raw;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function candidateInitials(name?: string | null) {
  const parts = String(name || "Candidate").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function noteSignalItems(signals: any): Array<{ category: string; label: string; value?: string | null }> {
  if (Array.isArray(signals?.signals)) return signals.signals;
  const grouped = signals?.by_category ?? {};
  return Object.entries(grouped).flatMap(([category, items]) => (
    Array.isArray(items) ? items.map((item: any) => ({ category, label: String(item.label ?? ""), value: item.value })) : []
  ));
}

function noteSignalCount(signals: any) {
  if (typeof signals?.count === "number") return signals.count;
  return noteSignalItems(signals).length;
}

function CandidateVersionRail({
  candidate,
  matches,
  openCandidate,
  openCandidateVersions,
}: {
  candidate: Candidate;
  matches: CandidateVersionMatch[];
  openCandidate: (id: string) => void;
  openCandidateVersions: () => void;
}) {
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
        <button className="plain small" type="button" onClick={openCandidateVersions}>Open Candidate Versions</button>
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
