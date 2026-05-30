"use client";

import type { CandidatePortalProfile } from "../../lib/api";
import { textValue, toTextList } from "../lib/format";
import { EmptyPanel } from "./primitives";

type EditableResumeItem = Record<string, unknown>;
type SetEditableResumeItems = (items: EditableResumeItem[]) => void;

export function CandidateResumeGuidedForm({
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
  loadStarterResume,
  save,
  busy,
}: {
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
  experienceItems: EditableResumeItem[];
  setExperienceItems: SetEditableResumeItems;
  educationItems: EditableResumeItem[];
  setEducationItems: SetEditableResumeItems;
  projectItems: EditableResumeItem[];
  setProjectItems: SetEditableResumeItems;
  loadStarterResume: () => void;
  save: () => Promise<void>;
  busy: boolean;
}) {
  function updateListItem(setItems: SetEditableResumeItems, items: EditableResumeItem[], index: number, key: string, value: string) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function updateListDetails(setItems: SetEditableResumeItems, items: EditableResumeItem[], index: number, key: "bullets" | "details", value: string) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: splitLineList(value) } : item));
  }

  return (
    <section className="candidateGuidedForm" aria-label="Guided resume form">
      <div className="candidateGuidedIntro">
        <div>
          <span className="eyebrow">Guided Form</span>
          <h3>Fill facts here, polish wording in Canvas.</h3>
          <p>This is the structured source of truth for versions, search, matching, and PDF export. Use Canvas after facts are clean.</p>
        </div>
        <div>
          <button className="secondary" type="button" onClick={loadStarterResume}>Load sample resume</button>
          <button className="primary" type="button" disabled={busy} onClick={save}>Save facts</button>
        </div>
      </div>

      <section className="candidateGuidedSection" data-candidate-editor-section="Identity">
        <div className="candidateGuidedSectionHead">
          <h3>Identity</h3>
          <p>Name, headline, contact, and searchable professional links.</p>
        </div>
        <div className="candidateFormGrid">
          <label>Name<input value={draft.display_name ?? ""} onChange={(event) => updateDraft("display_name", event.target.value)} placeholder="Your full name" /></label>
          <label>Headline<input value={draft.headline ?? ""} onChange={(event) => updateDraft("headline", event.target.value)} placeholder="Data Engineer, Reliability Engineer, Product Analyst" /></label>
          <label>Current location<input value={draft.current_location ?? ""} onChange={(event) => updateDraft("current_location", event.target.value)} placeholder="City, State / Country" /></label>
          <label>Email<input value={draft.email ?? ""} onChange={(event) => updateDraft("email", event.target.value)} placeholder="you@email.com" /></label>
          <label>Phone<input value={draft.phone ?? ""} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="+1..." /></label>
          <label>LinkedIn<input value={draft.linkedin_url ?? ""} onChange={(event) => updateDraft("linkedin_url", event.target.value)} placeholder="https://linkedin.com/in/..." /></label>
          <label>Portfolio<input value={draft.portfolio_url ?? ""} onChange={(event) => updateDraft("portfolio_url", event.target.value)} placeholder="https://your-site.com" /></label>
          <label>GitHub<input value={draft.github_url ?? ""} onChange={(event) => updateDraft("github_url", event.target.value)} placeholder="https://github.com/..." /></label>
        </div>
      </section>

      <section className="candidateGuidedSection" data-candidate-editor-section="Summary">
        <div className="candidateGuidedSectionHead">
          <h3>Summary</h3>
          <p>Keep this factual. Role direction, strongest domain, tools, and measurable scope.</p>
        </div>
        <label className="candidateWideField">Professional summary<textarea value={draft.summary ?? ""} onChange={(event) => updateDraft("summary", event.target.value)} rows={5} placeholder="2-4 lines. Example: Data engineer with 5 years across Spark, Python, SQL, healthcare analytics..." /></label>
      </section>

      <section className="candidateGuidedSection" data-candidate-editor-section="Experience">
        <div className="candidateGuidedSectionHead">
          <div>
            <h3>Experience</h3>
            <p>Use one row per actual role. Put product/client work under Projects if it was within the same job.</p>
          </div>
          <button className="secondary small" type="button" onClick={() => setExperienceItems([...experienceItems, { title: "", company: "", location: "", start_date: "", end_date: "", bullets: [] }])}>Add role</button>
        </div>
        <div className="editableProfileList">
          {experienceItems.length ? experienceItems.map((item, index) => (
            <article className="editableProfileItem" key={`guided-experience-${index}`}>
              <div className="candidateFormGrid">
                <label>Title<input value={textValue(item.title)} onChange={(event) => updateListItem(setExperienceItems, experienceItems, index, "title", event.target.value)} /></label>
                <label>Company<input value={textValue(item.company)} onChange={(event) => updateListItem(setExperienceItems, experienceItems, index, "company", event.target.value)} /></label>
                <label>Location<input value={textValue(item.location)} onChange={(event) => updateListItem(setExperienceItems, experienceItems, index, "location", event.target.value)} /></label>
                <label>Start<input value={textValue(item.start_date)} onChange={(event) => updateListItem(setExperienceItems, experienceItems, index, "start_date", event.target.value)} placeholder="2023-01" /></label>
                <label>End<input value={textValue(item.end_date)} onChange={(event) => updateListItem(setExperienceItems, experienceItems, index, "end_date", event.target.value)} placeholder="Present" /></label>
              </div>
              <label className="candidateWideField">Bullets<textarea value={toTextList(item.bullets || item.details || item.description).join("\n")} onChange={(event) => updateListDetails(setExperienceItems, experienceItems, index, "bullets", event.target.value)} rows={5} placeholder="One bullet per line. Add tools, scale, ownership, and measurable impact." /></label>
              <button className="plain dangerText small" type="button" onClick={() => setExperienceItems(experienceItems.filter((_, itemIndex) => itemIndex !== index))}>Remove role</button>
            </article>
          )) : <EmptyPanel title="No roles yet" body="Add jobs, internships, assistantships, contract roles, or major work experience." />}
        </div>
      </section>

      <section className="candidateGuidedSection" data-candidate-editor-section="Projects">
        <div className="candidateGuidedSectionHead">
          <div>
            <h3>Projects</h3>
            <p>Use this for portfolio work, capstones, same-company product workstreams, publications, or hackathons.</p>
          </div>
          <button className="secondary small" type="button" onClick={() => setProjectItems([...projectItems, { name: "", role: "", start_date: "", end_date: "", bullets: [] }])}>Add project</button>
        </div>
        <div className="editableProfileList">
          {projectItems.length ? projectItems.map((item, index) => (
            <article className="editableProfileItem" key={`guided-project-${index}`}>
              <div className="candidateFormGrid">
                <label>Project<input value={textValue(item.name)} onChange={(event) => updateListItem(setProjectItems, projectItems, index, "name", event.target.value)} /></label>
                <label>Role / stack<input value={textValue(item.role)} onChange={(event) => updateListItem(setProjectItems, projectItems, index, "role", event.target.value)} /></label>
                <label>Start<input value={textValue(item.start_date)} onChange={(event) => updateListItem(setProjectItems, projectItems, index, "start_date", event.target.value)} /></label>
                <label>End<input value={textValue(item.end_date)} onChange={(event) => updateListItem(setProjectItems, projectItems, index, "end_date", event.target.value)} /></label>
              </div>
              <label className="candidateWideField">Project bullets<textarea value={toTextList(item.bullets || item.details || item.description).join("\n")} onChange={(event) => updateListDetails(setProjectItems, projectItems, index, "bullets", event.target.value)} rows={4} placeholder="Problem, your contribution, technologies, result." /></label>
              <button className="plain dangerText small" type="button" onClick={() => setProjectItems(projectItems.filter((_, itemIndex) => itemIndex !== index))}>Remove project</button>
            </article>
          )) : <EmptyPanel title="No projects yet" body="Add proof-of-work projects if they strengthen the application." />}
        </div>
      </section>

      <section className="candidateGuidedSection" data-candidate-editor-section="Education">
        <div className="candidateGuidedSectionHead">
          <div>
            <h3>Education</h3>
            <p>Degrees, bootcamps, thesis, coursework, honors, and academic projects.</p>
          </div>
          <button className="secondary small" type="button" onClick={() => setEducationItems([...educationItems, { degree: "", school: "", field: "", location: "", end_date: "", details: [] }])}>Add education</button>
        </div>
        <div className="editableProfileList">
          {educationItems.length ? educationItems.map((item, index) => (
            <article className="editableProfileItem" key={`guided-education-${index}`}>
              <div className="candidateFormGrid">
                <label>Degree<input value={textValue(item.degree)} onChange={(event) => updateListItem(setEducationItems, educationItems, index, "degree", event.target.value)} /></label>
                <label>School<input value={textValue(item.school)} onChange={(event) => updateListItem(setEducationItems, educationItems, index, "school", event.target.value)} /></label>
                <label>Field<input value={textValue(item.field)} onChange={(event) => updateListItem(setEducationItems, educationItems, index, "field", event.target.value)} /></label>
                <label>Location<input value={textValue(item.location)} onChange={(event) => updateListItem(setEducationItems, educationItems, index, "location", event.target.value)} /></label>
                <label>Graduation / end<input value={textValue(item.end_date)} onChange={(event) => updateListItem(setEducationItems, educationItems, index, "end_date", event.target.value)} /></label>
              </div>
              <label className="candidateWideField">Details<textarea value={toTextList(item.details || item.bullets || item.description).join("\n")} onChange={(event) => updateListDetails(setEducationItems, educationItems, index, "details", event.target.value)} rows={3} placeholder="Coursework, GPA, thesis, honors, clubs, publications." /></label>
              <button className="plain dangerText small" type="button" onClick={() => setEducationItems(educationItems.filter((_, itemIndex) => itemIndex !== index))}>Remove education</button>
            </article>
          )) : <EmptyPanel title="No education yet" body="Add degrees, certifications programs, bootcamps, or relevant coursework." />}
        </div>
      </section>

      <section className="candidateGuidedSection" data-candidate-editor-section="Skills">
        <div className="candidateGuidedSectionHead">
          <h3>Skills and optional sections</h3>
          <p>These sections improve search, matching, and targeted exports.</p>
        </div>
        <div className="candidateFormGrid">
          <label>Skills<textarea value={skillsText} onChange={(event) => setSkillsText(event.target.value)} rows={3} placeholder="Python, Spark, SQL, Databricks, Reliability Engineering" /></label>
          <label>Certifications<textarea value={certificationsText} onChange={(event) => setCertificationsText(event.target.value)} rows={3} placeholder="One per line" /></label>
          <label>Awards<textarea value={awardsText} onChange={(event) => setAwardsText(event.target.value)} rows={3} placeholder="One per line" /></label>
          <label>Publications<textarea value={publicationsText} onChange={(event) => setPublicationsText(event.target.value)} rows={3} placeholder="One per line" /></label>
          <label>Languages<input value={languagesText} onChange={(event) => setLanguagesText(event.target.value)} placeholder="English, Hindi, Spanish" /></label>
          <label>Additional links<textarea value={linksText} onChange={(event) => setLinksText(event.target.value)} rows={3} placeholder="Portfolio, blog, project, publication, LeetCode, GitHub" /></label>
          <label>References<textarea value={referencesText} onChange={(event) => setReferencesText(event.target.value)} rows={3} placeholder="Available on request, or named references if you want them exported." /></label>
        </div>
      </section>
    </section>
  );
}

function splitLineList(value: string): string[] {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}
