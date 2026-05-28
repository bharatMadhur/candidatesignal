import type { CandidatePortalProfile } from "../../lib/api";
import { textValue, toTextList } from "./format";

export function candidateResumeFromProfile(profile: CandidatePortalProfile["profile"]): Record<string, any> {
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

export function candidateProfileFromResume(resume: Record<string, any>, fallback: CandidatePortalProfile["profile"] = {}): CandidatePortalProfile["profile"] {
  const contact = resume.contact && typeof resume.contact === "object" ? resume.contact as Record<string, any> : {};
  return {
    ...fallback,
    display_name: textValue(resume.name) || textValue(fallback.display_name),
    headline: textValue(resume.headline) || textValue(fallback.headline),
    summary: textValue(resume.summary) || textValue(fallback.summary),
    summary_highlights: toTextList(resume.summary_highlights).length ? toTextList(resume.summary_highlights) : fallback.summary_highlights,
    current_location: textValue(contact.location) || textValue(fallback.current_location),
    email: textValue(contact.email) || textValue(fallback.email),
    phone: textValue(contact.phone) || textValue(fallback.phone),
    linkedin_url: textValue(contact.linkedin_url) || textValue(fallback.linkedin_url),
    portfolio_url: textValue(contact.portfolio_url) || textValue(fallback.portfolio_url),
    github_url: textValue(contact.github_url) || textValue(fallback.github_url),
    skills: toTextList(resume.skills).length ? toTextList(resume.skills) : fallback.skills,
    skill_groups: resume.skill_groups && typeof resume.skill_groups === "object" ? resume.skill_groups : fallback.skill_groups,
    experience: Array.isArray(resume.experience) ? resume.experience : fallback.experience,
    education: Array.isArray(resume.education) ? resume.education : fallback.education,
    certifications: toTextList(resume.certifications).length ? toTextList(resume.certifications) : fallback.certifications,
    awards: toTextList(resume.awards).length ? toTextList(resume.awards) : fallback.awards,
    publications: toTextList(resume.publications).length ? toTextList(resume.publications) : fallback.publications,
    languages: toTextList(resume.languages).length ? toTextList(resume.languages) : fallback.languages,
    projects: Array.isArray(resume.projects) ? resume.projects : fallback.projects,
    links: toTextList(resume.links).length ? toTextList(resume.links) : fallback.links,
    other_sections: resume.other_sections && typeof resume.other_sections === "object" ? resume.other_sections : fallback.other_sections,
    ai_enhancement: resume.ai_enhancement && typeof resume.ai_enhancement === "object" ? resume.ai_enhancement : fallback.ai_enhancement,
  };
}

export function candidateProfileHasContent(profile: CandidatePortalProfile["profile"]) {
  return Boolean(
    textValue(profile.display_name)
    || textValue(profile.headline)
    || textValue(profile.summary)
    || toTextList(profile.skills).length
    || (Array.isArray(profile.experience) && profile.experience.length)
    || (Array.isArray(profile.education) && profile.education.length)
    || (Array.isArray(profile.projects) && profile.projects.length)
  );
}
