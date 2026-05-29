import type { CandidatePortalProfile, CandidateResumeUpload } from "../../lib/api";
import { toTextList } from "./format";

export type CandidatePortalSection = "dashboard" | "upload" | "review" | "match";

const CANDIDATE_PORTAL_SECTIONS: CandidatePortalSection[] = ["dashboard", "upload", "review", "match"];

export function candidatePortalSectionFromSearch(search: string, fallback: CandidatePortalSection = "dashboard"): CandidatePortalSection {
  const params = new URLSearchParams(search);
  const value = params.get("candidate_view") || params.get("section");
  if (value === "versions" || value === "export") return "review";
  if (value === "editor") return "review";
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
