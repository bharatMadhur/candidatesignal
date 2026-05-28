import type { Candidate, CandidateProfileUpdate } from "../../lib/api";
import { textValue, toTextList } from "./format";

export type CandidateCorrectionForm = {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  current_title: string;
  current_company: string;
  total_years_experience: string;
  skills: string;
  countries: string;
  certifications: string;
  experience: CandidateCorrectionExperience[];
  education: CandidateCorrectionEducation[];
};

export type CandidateCorrectionExperience = {
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string;
  technologies: string[];
  workstreams: Candidate["experience"][number]["workstreams"];
};

export type CandidateCorrectionEducation = {
  school: string;
  degree: string;
  field: string;
  location: string;
  start_date: string;
  end_date: string;
  details: string;
};

export function candidateCorrectionForm(candidate: Candidate): CandidateCorrectionForm {
  const hr = candidate.derived?.hr_profile ?? {};
  return {
    name: textValue(candidate.name),
    email: textValue(candidate.contact?.email),
    phone: textValue(candidate.contact?.phone),
    location: textValue(candidate.contact?.location),
    summary: textValue(candidate.summary),
    current_title: textValue(hr.current_title),
    current_company: textValue(hr.current_company),
    total_years_experience: textValue(hr.total_years_experience),
    skills: (candidate.skills ?? []).join(", "),
    countries: toTextList(candidate.derived?.countries_associated ?? []).join(", "),
    certifications: (candidate.certifications ?? []).join(", "),
    experience: (candidate.experience ?? []).map((item) => ({
      company: textValue(item.company),
      title: textValue(item.title),
      location: textValue(item.location),
      start_date: textValue(item.start_date),
      end_date: textValue(item.end_date),
      bullets: (item.bullets ?? []).join("\n"),
      technologies: item.technologies ?? [],
      workstreams: item.workstreams ?? [],
    })),
    education: (candidate.education ?? []).map((item) => ({
      school: textValue(item.school),
      degree: textValue(item.degree),
      field: textValue(item.field),
      location: textValue(item.location),
      start_date: textValue(item.start_date),
      end_date: textValue(item.end_date),
      details: (item.details ?? []).join("\n"),
    })),
  };
}

export function candidateCorrectionPayload(form: CandidateCorrectionForm): CandidateProfileUpdate {
  const years = Number(form.total_years_experience.replace(/[^\d.]/g, ""));
  return {
    name: form.name.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    location: form.location.trim() || null,
    summary: form.summary.trim() || null,
    current_title: form.current_title.trim() || null,
    current_company: form.current_company.trim() || null,
    total_years_experience: Number.isFinite(years) ? years : null,
    skills: candidateInputList(form.skills),
    countries: candidateInputList(form.countries),
    certifications: candidateInputList(form.certifications),
    experience: form.experience.map((item) => ({
      company: nullableCandidateText(item.company),
      title: nullableCandidateText(item.title),
      location: nullableCandidateText(item.location),
      start_date: nullableCandidateText(item.start_date),
      end_date: nullableCandidateText(item.end_date),
      bullets: candidateTextLines(item.bullets),
      technologies: item.technologies ?? [],
      workstreams: item.workstreams ?? [],
    })).filter((item) => hasCandidateExperienceContent(item)),
    education: form.education.map((item) => ({
      school: nullableCandidateText(item.school),
      degree: nullableCandidateText(item.degree),
      field: nullableCandidateText(item.field),
      location: nullableCandidateText(item.location),
      start_date: nullableCandidateText(item.start_date),
      end_date: nullableCandidateText(item.end_date),
      details: candidateTextLines(item.details),
    })).filter((item) => hasCandidateEducationContent(item)),
  };
}

export function emptyExperienceCorrection(): CandidateCorrectionExperience {
  return { company: "", title: "", location: "", start_date: "", end_date: "", bullets: "", technologies: [], workstreams: [] };
}

export function emptyEducationCorrection(): CandidateCorrectionEducation {
  return { school: "", degree: "", field: "", location: "", start_date: "", end_date: "", details: "" };
}

export function coverageGapReasons(coverage?: Candidate["primary_key_coverage"]) {
  if (!coverage) return [];
  const generated = coverage.low_coverage_reasons ?? [];
  if (generated.length) return generated;
  return (coverage.items ?? [])
    .filter((item) => item.status === "missing")
    .slice(0, 8)
    .map((item) => ({
      severity: item.severity ?? "standard",
      label: item.label,
      detail: `${item.category_label ?? "Profile"} field is missing.`,
    }));
}

function nullableCandidateText(value: string) {
  const text = value.trim();
  return text || null;
}

function candidateTextLines(value: string) {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function hasCandidateExperienceContent(item: Candidate["experience"][number]) {
  return Boolean(item.company || item.title || item.location || item.start_date || item.end_date || item.bullets.length);
}

function hasCandidateEducationContent(item: Candidate["education"][number]) {
  return Boolean(item.school || item.degree || item.field || item.location || item.start_date || item.end_date || item.details?.length);
}

function candidateInputList(value: string) {
  return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}
