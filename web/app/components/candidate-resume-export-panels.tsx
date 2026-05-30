"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { CandidateApplication, CandidatePortalProfile, CandidateResumeVersion } from "../../lib/api";
import { humanizeLabel, textValue, toTextList, uniqueTextList } from "../lib/format";

type ResumeJson = Record<string, unknown>;

export const CANDIDATE_RESUME_TEMPLATES = [
  { id: "atlas", name: "Atlas", tone: "Balanced", note: "Clean professional default for most roles." },
  { id: "classic", name: "Classic", tone: "Traditional", note: "Best for conservative HR and academic-style readers." },
  { id: "modern", name: "Modern", tone: "Sharp", note: "Stronger hierarchy without breaking ATS safety." },
  { id: "compact", name: "Compact", tone: "Dense", note: "For longer careers that need tight spacing." },
  { id: "executive", name: "Executive", tone: "Senior", note: "For leadership, strategy, and client-facing profiles." },
  { id: "technical", name: "Technical", tone: "Engineering", note: "For software, data, infra, and technical roles." },
  { id: "academic", name: "Academic", tone: "Research", note: "For publications, education, and research-heavy profiles." },
  { id: "startup", name: "Startup", tone: "Builder", note: "For founding, product, and high-ownership resumes." },
  { id: "consulting", name: "Consulting", tone: "Client-ready", note: "For business, transformation, and advisory roles." },
  { id: "minimal", name: "Minimal", tone: "ATS-first", note: "Maximum simplicity for strict ATS parsing." },
] as const;

export function CandidateTemplateSelector({
  selectedTemplateId,
  setSelectedTemplateId,
}: {
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
}) {
  return (
    <article className="candidatePortalCard candidateTemplateSelector">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">PDF templates</span>
          <h2>Choose export style</h2>
          <p>All templates are standardized and ATS-safe. The candidate verifies the look before downloading.</p>
        </div>
      </div>
      <div className="candidateTemplateGrid">
        {CANDIDATE_RESUME_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={selectedTemplateId === template.id ? "active" : ""}
            type="button"
            onClick={() => setSelectedTemplateId(template.id)}
          >
            <i />
            <strong>{template.name}</strong>
            <span>{template.tone}</span>
            <small>{template.note}</small>
          </button>
        ))}
      </div>
      <p className="candidateTemplateActiveLabel">Preview is using {selectedTemplateLabel(selectedTemplateId)}.</p>
    </article>
  );
}

export function CandidateAtsConfidencePanel({
  profile,
  resume,
  selectedTemplateId,
  versions,
  applications,
}: {
  profile: CandidatePortalProfile["profile"];
  resume: ResumeJson;
  selectedTemplateId: string;
  versions: CandidateResumeVersion[];
  applications: CandidateApplication[];
}) {
  const checks = candidateAtsSignals(profile, resume, selectedTemplateId, versions, applications);
  const passed = checks.filter((item) => item.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return (
    <article className="candidatePortalCard candidateAtsPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">ATS confidence</span>
          <h2>{score}% ready</h2>
          <p>Checks for the practical things that usually break resume screening before export.</p>
        </div>
        <strong>{selectedTemplateLabel(selectedTemplateId)}</strong>
      </div>
      <div className="candidateAtsMeter">
        <i style={{ width: `${score}%` }} />
      </div>
      <div className="candidateAtsChecks">
        {checks.map((item) => (
          <span key={item.label} className={item.ok ? "ok" : "warn"}>
            {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}

export function CandidateVersionDiffPanel({
  baseResume,
  version,
  resume,
}: {
  baseResume: ResumeJson;
  version: CandidateResumeVersion | null;
  resume: ResumeJson;
}) {
  const baseSkills = toTextList(baseResume.skills).map((item) => item.toLowerCase());
  const versionSkills = toTextList(resume.skills);
  const prioritizedSkills = versionSkills.filter((item) => !baseSkills.includes(item.toLowerCase())).slice(0, 8);
  const jobTailoring = recordValue(resume.job_tailoring);
  const targetRole = textValue(jobTailoring.target_role || version?.target_role || resume.headline);
  const matchedTerms = toTextList(jobTailoring.matched_terms).slice(0, 8);
  const missingTerms = toTextList(jobTailoring.missing_or_unclear_terms).slice(0, 8);
  const changes = [
    {
      label: "Headline",
      value:
        textValue(baseResume.headline) === textValue(resume.headline)
          ? "Same as master profile"
          : `${textValue(baseResume.headline) || "No master headline"} -> ${textValue(resume.headline) || "No version headline"}`,
    },
    {
      label: "Experience",
      value: `${Array.isArray(resume.experience) ? resume.experience.length : 0} roles carried into this version`,
    },
    {
      label: "Projects",
      value: `${Array.isArray(resume.projects) ? resume.projects.length : 0} projects carried into this version`,
    },
  ];
  return (
    <article className="candidatePortalCard candidateVersionDiffPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Version changes</span>
          <h2>{targetRole ? `Tailored for ${targetRole}` : "Compared with master profile"}</h2>
          <p>Shows what this version emphasizes without hiding missing or unclear evidence.</p>
        </div>
      </div>
      <div className="candidateVersionDiffRows">
        {changes.map((item) => (
          <span key={item.label}>
            <strong>{item.label}</strong>
            {item.value}
          </span>
        ))}
      </div>
      {prioritizedSkills.length || matchedTerms.length ? (
        <div className="candidateDiffTags">
          {[...prioritizedSkills, ...matchedTerms].slice(0, 12).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {missingTerms.length ? (
        <div className="candidateMissingTerms">
          <strong>Missing or unclear</strong>
          <p>{missingTerms.join(", ")}</p>
        </div>
      ) : null}
    </article>
  );
}

export function CandidateCvPreview({ resume, templateId = "atlas" }: { resume: ResumeJson; templateId?: string }) {
  const contact = recordValue(resume.contact);
  const skills = toTextList(resume.skills);
  const summaryHighlights = toTextList(resume.summary_highlights);
  const skillGroups = skillGroupEntries(resume.skill_groups, skills);
  const experience = recordList(resume.experience);
  const education = recordList(resume.education);
  const projects = recordList(resume.projects);
  const certifications = toTextList(resume.certifications);
  const awards = toTextList(resume.awards);
  const publications = toTextList(resume.publications);
  const languages = toTextList(resume.languages);
  const otherSections = resumeOtherSectionEntries(resume.other_sections);
  const links = uniqueTextList(
    toTextList(resume.links).filter((link) => !toTextList([contact.linkedin_url, contact.portfolio_url, contact.github_url]).includes(link)),
  );
  const normalizedTemplate = CANDIDATE_RESUME_TEMPLATES.some((template) => template.id === templateId) ? templateId : "atlas";
  return (
    <div className={`candidateCvPreview candidateCvTemplate-${normalizedTemplate}`}>
      <h1>{textValue(resume.name) || "Candidate Name"}</h1>
      <p className="cvHeadline">{textValue(resume.headline)}</p>
      <p className="cvMeta">{toTextList([contact.location, contact.email, contact.phone, contact.linkedin_url, contact.portfolio_url, contact.github_url]).join(" | ")}</p>
      {resume.summary ? <p>{textValue(resume.summary)}</p> : null}
      {summaryHighlights.length ? <TextListSection title="Summary Highlights" items={summaryHighlights} /> : null}
      {skillGroups.length ? (
        <section>
          <h2>Skills</h2>
          <SkillGroups groups={skillGroups} />
        </section>
      ) : skills.length ? (
        <section>
          <h2>Skills</h2>
          <div className="cvSkills">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        </section>
      ) : null}
      {experience.length ? (
        <section>
          <h2>Experience</h2>
          {experience.map((item, index) => <CvItem key={`${textValue(item.company || item.title || "experience")}-${index}`} item={item} />)}
        </section>
      ) : null}
      {projects.length ? (
        <section>
          <h2>Projects</h2>
          {projects.map((item, index) => <CvItem key={`${textValue(item.name || item.role || "project")}-${index}`} item={item} />)}
        </section>
      ) : null}
      {education.length ? (
        <section>
          <h2>Education</h2>
          {education.map((item, index) => <CvItem key={`${textValue(item.school || item.degree || "education")}-${index}`} item={item} />)}
        </section>
      ) : null}
      <TextListSection title="Certifications" items={certifications} />
      <TextListSection title="Awards" items={awards} />
      <TextListSection title="Publications" items={publications} />
      <TextListSection title="Languages" items={languages} />
      {otherSections.map((section) => <TextListSection key={section.title} title={section.title} items={section.items} />)}
      <TextListSection title="Additional Links" items={links} />
    </div>
  );
}

export function selectedTemplateLabel(templateId: string) {
  return CANDIDATE_RESUME_TEMPLATES.find((template) => template.id === templateId)?.name ?? "Atlas";
}

function candidateAtsSignals(
  profile: CandidatePortalProfile["profile"],
  resume: ResumeJson,
  selectedTemplateId: string,
  versions: CandidateResumeVersion[],
  applications: CandidateApplication[],
) {
  const contact = recordValue(resume.contact);
  const experience = recordList(resume.experience);
  const education = recordList(resume.education);
  const projects = recordList(resume.projects);
  const skills = toTextList(resume.skills);
  const hasDates = experience.some((item) => textValue(item.start_date) || textValue(item.end_date));
  const hasLinks = Boolean(contact.linkedin_url || contact.portfolio_url || contact.github_url || profile.linkedin_url || profile.portfolio_url || profile.github_url);
  const hasTargetedVersion = versions.some((version) => Boolean(textValue(version.target_role)));
  return [
    { label: "Name and headline", ok: Boolean(textValue(resume.name || profile.display_name) && textValue(resume.headline || profile.headline)) },
    { label: "Contact details", ok: Boolean(textValue(contact.email || profile.email) || textValue(contact.phone || profile.phone)) },
    { label: "Location", ok: Boolean(textValue(contact.location || profile.current_location)) },
    { label: "Professional links", ok: hasLinks },
    { label: "Summary", ok: Boolean(textValue(resume.summary || profile.summary)) },
    { label: "Experience bullets", ok: experience.some((item) => cvTextList(item.bullets || item.details || item.description).length) },
    { label: "Role dates", ok: hasDates },
    { label: "Skills", ok: skills.length >= 6 },
    { label: "Education or projects", ok: education.length > 0 || projects.length > 0 },
    { label: "ATS-safe template", ok: CANDIDATE_RESUME_TEMPLATES.some((template) => template.id === selectedTemplateId) },
    { label: "Role-specific version", ok: hasTargetedVersion || versions.length === 1 },
    { label: "Submission tracking", ok: applications.length > 0 },
  ];
}

function SkillGroups({ groups }: { groups: Array<{ label: string; skills: string[] }> }) {
  return (
    <div className="cvSkillGroups">
      {groups.map((group) => (
        <p key={group.label}>
          <strong>{group.label}:</strong> {group.skills.join(", ")}
        </p>
      ))}
    </div>
  );
}

function TextListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function CvItem({ item }: { item: ResumeJson }) {
  const title = textValue(item.title || item.name || item.degree);
  const place = textValue(item.company || item.school || item.role);
  const location = textValue(item.location);
  const dates = [textValue(item.start_date), textValue(item.end_date)].filter(Boolean).join(" - ");
  const technologies = cvTextList(item.technologies);
  const links = cvTextList(item.links);
  const bullets = cvTextList(item.bullets || item.details || item.description);
  const workstreams = recordList(item.workstreams);
  return (
    <article className="cvItem">
      <h3>{[title, place].filter(Boolean).join(" — ")}</h3>
      <p>{[location, dates, technologies.join(", "), links.join(", ")].filter(Boolean).join(" | ")}</p>
      {bullets.length ? <ul>{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
      {workstreams.length ? (
        <div className="cvWorkstreams">
          {workstreams.map((workstream, index) => (
            <CvItem key={`${textValue(workstream.name || workstream.role || "workstream")}-${index}`} item={workstream} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function cvTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const objectItem = item as Record<string, unknown>;
        return textValue(objectItem.name || objectItem.title || objectItem.label || objectItem.value);
      }
      return textValue(item);
    }).filter(Boolean);
  }
  return toTextList(value);
}

function recordValue(value: unknown): ResumeJson {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ResumeJson : {};
}

function recordList(value: unknown): ResumeJson[] {
  return Array.isArray(value)
    ? value.filter((item): item is ResumeJson => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function skillGroupEntries(groups: unknown, fallbackSkills: string[]) {
  if (groups && typeof groups === "object" && !Array.isArray(groups)) {
    const entries = Object.entries(groups as Record<string, unknown>)
      .map(([label, values]) => ({ label: humanizeLabel(label), skills: cvTextList(values) }))
      .filter((group) => group.skills.length);
    if (entries.length) return entries;
  }
  return fallbackSkills.length ? [{ label: "Skills", skills: fallbackSkills }] : [];
}

function resumeOtherSectionEntries(value: unknown): Array<{ title: string; items: string[] }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([title, items]) => ({
      title: humanizeLabel(title),
      items: cvTextList(items),
    }))
    .filter((section) => section.items.length);
}
