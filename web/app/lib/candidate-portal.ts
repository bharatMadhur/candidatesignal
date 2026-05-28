import type { CandidatePortalProfile, CandidateResumeUpload } from "../../lib/api";
import { splitCommaList, textValue, toTextList } from "./format";

export type CandidatePortalSection = "dashboard" | "upload" | "review" | "profile" | "match";

const CANDIDATE_PORTAL_SECTIONS: CandidatePortalSection[] = ["dashboard", "upload", "review", "profile", "match"];

export function candidatePortalSectionFromSearch(search: string, fallback: CandidatePortalSection = "dashboard"): CandidatePortalSection {
  const params = new URLSearchParams(search);
  const value = params.get("candidate_view") || params.get("section");
  if (value === "versions" || value === "export") return "review";
  if (value === "editor") return "profile";
  if (value === "job_board") return "match";
  return CANDIDATE_PORTAL_SECTIONS.includes(value as CandidatePortalSection) ? value as CandidatePortalSection : fallback;
}

export function candidatePortalSectionCopy(section: CandidatePortalSection, latestUpload: CandidateResumeUpload | null, versionCount: number) {
  if (section === "upload") {
    return {
      eyebrow: "Upload",
      title: "Bring in your existing resume.",
      body: "Preview the file first, then turn it into an editable master profile you control.",
    };
  }
  if (section === "review") {
    return {
      eyebrow: "Versions",
      title: versionCount ? "Manage your resume versions." : "Create your first clean resume version.",
      body: "Open a version to edit, preview, export as PDF, share safely, or tailor it to a job.",
    };
  }
  if (section === "profile") {
    return {
      eyebrow: "Resume",
      title: "Edit your master resume.",
      body: "Write directly in the resume canvas, use the coach when needed, and keep the structured facts available as backup.",
    };
  }
  if (section === "match") {
    return {
      eyebrow: "Jobs",
      title: "Tailor one version to one job.",
      body: "Paste a job requirement, choose a resume version, and get a clear fit read before applying.",
    };
  }
  return {
    eyebrow: "Candidate workspace",
    title: latestUpload ? "Own the resume you send." : "Start from the resume you already have.",
    body: "Maintain one approved profile, create targeted versions, export clean PDFs, and track where every version was shared.",
  };
}

export function cvTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return toTextList(value);
}

export function splitLineList(value: string): string[] {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

export function candidateUploadPreviewKind(file: File | null): "pdf" | "image" | "document" | "none" {
  if (!file) return "none";
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"].some((suffix) => name.endsWith(suffix))) return "image";
  return "document";
}

export function candidateCoachReply(profile: CandidatePortalProfile["profile"], message: string) {
  const enhancement = normalizedAiEnhancement(profile.ai_enhancement);
  const lower = message.toLowerCase();
  const skills = toTextList(profile.skills).slice(0, 8);
  const bestRoles = cvTextList(enhancement.best_fit_roles).slice(0, 4);
  const questions = cvTextList(enhancement.screening_questions || enhancement.likely_missed_details).slice(0, 4);
  if (lower.includes("template") || lower.includes("pdf") || lower.includes("download")) {
    return "Use Atlas for the default professional export, Technical for engineering/data roles, Compact if the resume is too long, and Minimal when you want the safest ATS-first version. Verify the selected template in preview before downloading.";
  }
  if (lower.includes("summary") || lower.includes("headline")) {
    const suggested = textValue(enhancement.headline_suggestion || enhancement.career_narrative || enhancement.profile_read);
    return suggested
      ? `I would start with this positioning: ${suggested}`
      : "Your summary should be evidence-led: current role, strongest domain, top 3 skills, and one quantified impact. Add metrics from the resume before exporting.";
  }
  if (lower.includes("missing") || lower.includes("improve") || lower.includes("weak")) {
    return questions.length
      ? `The main missing items to verify are: ${questions.join("; ")}. Add these in the structured editor so every resume version improves.`
      : "Check dates, latest title, location, LinkedIn/portfolio, quantified bullets, project ownership, and role-specific keywords. Those fields usually improve matching the most.";
  }
  if (lower.includes("job") || lower.includes("role") || lower.includes("match")) {
    return bestRoles.length
      ? `The strongest practical directions look like: ${bestRoles.join(", ")}. Use Job Board to test one version against a real requirement before applying.`
      : `Based on captured skills${skills.length ? ` like ${skills.join(", ")}` : ""}, create a targeted version for the job and then match it against the requirement.`;
  }
  return `I would improve this profile by tightening the headline, making bullets outcome-based, and ensuring role-specific keywords are present${skills.length ? `: ${skills.slice(0, 5).join(", ")}` : ""}. Ask me about summary, missing evidence, template choice, or job matching.`;
}

export function normalizedAiEnhancement(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeEditableProfileItems(items: Array<Record<string, unknown>>, detailsKey: "bullets" | "details") {
  return items
    .map((item) => {
      const normalized = { ...item };
      normalized[detailsKey] = toTextList(item[detailsKey]);
      if (Array.isArray(normalized.workstreams)) {
        normalized.workstreams = normalized.workstreams
          .map((workstream: Record<string, unknown>) => ({
            ...workstream,
            bullets: toTextList(workstream.bullets || workstream.details || workstream.description),
            technologies: toTextList(workstream.technologies),
          }))
          .filter((workstream: Record<string, unknown>) => Object.values(workstream).some((value) => Array.isArray(value) ? value.length : Boolean(String(value ?? "").trim())));
      }
      return normalized;
    })
    .filter((item) => Object.values(item).some((value) => Array.isArray(value) ? value.length : Boolean(String(value ?? "").trim())));
}

export function candidatePortalCompleteness(profile: CandidatePortalProfile["profile"]) {
  const checks = [
    profile.display_name,
    profile.headline,
    profile.current_location,
    profile.email,
    profile.phone,
    profile.linkedin_url || profile.portfolio_url || profile.github_url,
    profile.summary,
    profile.skills?.length,
    profile.experience?.length,
    profile.education?.length,
    profile.projects?.length,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

export function profileListPayload(value: string, mode: "comma" | "line") {
  return mode === "comma" ? splitCommaList(value) : splitLineList(value);
}
