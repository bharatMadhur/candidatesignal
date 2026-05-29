import {
  emptyEducationCorrection,
  emptyExperienceCorrection,
  type CandidateCorrectionEducation,
  type CandidateCorrectionExperience,
  type CandidateCorrectionForm,
} from "../lib/candidate-corrections";
import { EmptyPanel } from "./primitives";

type CandidateCorrectionTextField = Exclude<keyof CandidateCorrectionForm, "experience" | "education">;

export function CandidateCorrectionPanel({
  form,
  setForm,
  save,
  cancel,
}: {
  form: CandidateCorrectionForm;
  setForm: (form: CandidateCorrectionForm) => void;
  save: () => void;
  cancel: () => void;
}) {
  const update = (key: CandidateCorrectionTextField, value: string) => setForm({ ...form, [key]: value });
  const updateExperience = (index: number, key: keyof CandidateCorrectionExperience, value: string) => {
    setForm({
      ...form,
      experience: form.experience.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    });
  };
  const updateEducation = (index: number, key: keyof CandidateCorrectionEducation, value: string) => {
    setForm({
      ...form,
      education: form.education.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    });
  };
  const addExperience = () => setForm({ ...form, experience: [...form.experience, emptyExperienceCorrection()] });
  const removeExperience = (index: number) => setForm({ ...form, experience: form.experience.filter((_, itemIndex) => itemIndex !== index) });
  const addEducation = () => setForm({ ...form, education: [...form.education, emptyEducationCorrection()] });
  const removeEducation = (index: number) => setForm({ ...form, education: form.education.filter((_, itemIndex) => itemIndex !== index) });
  return (
    <section className="candidateCorrectionPanel">
      <div>
        <span className="reportLabel">Manual correction</span>
        <h3>Edit extracted profile data</h3>
        <p>Use this when the parser missed or confused a field. The original CV stays unchanged; these corrections update the candidate profile, timeline, coverage, search index, and matching context.</p>
      </div>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Basics</strong>
          <span>Identity, contact, location, and headline fields.</span>
        </div>
        <div className="candidateCorrectionGrid">
          <label><span>Name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><span>Email</span><input value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
          <label><span>Current location</span><input value={form.location} onChange={(event) => update("location", event.target.value)} /></label>
          <label><span>Current title</span><input value={form.current_title} onChange={(event) => update("current_title", event.target.value)} /></label>
          <label><span>Current company</span><input value={form.current_company} onChange={(event) => update("current_company", event.target.value)} /></label>
          <label><span>Total years</span><input value={form.total_years_experience} onChange={(event) => update("total_years_experience", event.target.value)} /></label>
          <label><span>Countries</span><input value={form.countries} onChange={(event) => update("countries", event.target.value)} placeholder="United States, India" /></label>
          <label className="wide"><span>Summary</span><textarea value={form.summary} onChange={(event) => update("summary", event.target.value)} /></label>
          <label className="wide"><span>Skills</span><textarea value={form.skills} onChange={(event) => update("skills", event.target.value)} placeholder="Python, Spark, Databricks" /></label>
          <label className="wide"><span>Certifications</span><textarea value={form.certifications} onChange={(event) => update("certifications", event.target.value)} placeholder="AWS Solutions Architect, PMP" /></label>
        </div>
      </section>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Work history & dates</strong>
          <span>These rows drive the visible timeline and non-overlapping experience calculation.</span>
          <button className="plain small" type="button" onClick={addExperience}>Add role</button>
        </div>
        <div className="candidateEditableList">
          {form.experience.length ? form.experience.map((item, index) => (
            <article className="candidateEditableCard" key={`experience-${index}`}>
              <div className="candidateEditableCardHeader">
                <strong>Role {index + 1}</strong>
                <button className="plain danger small" type="button" onClick={() => removeExperience(index)}>Remove</button>
              </div>
              <div className="candidateCorrectionGrid">
                <label><span>Company</span><input value={item.company} onChange={(event) => updateExperience(index, "company", event.target.value)} /></label>
                <label><span>Title</span><input value={item.title} onChange={(event) => updateExperience(index, "title", event.target.value)} /></label>
                <label><span>Location</span><input value={item.location} onChange={(event) => updateExperience(index, "location", event.target.value)} placeholder="City, country, remote" /></label>
                <label><span>Start date</span><input value={item.start_date} onChange={(event) => updateExperience(index, "start_date", event.target.value)} placeholder="2022-01" /></label>
                <label><span>End date</span><input value={item.end_date} onChange={(event) => updateExperience(index, "end_date", event.target.value)} placeholder="Present" /></label>
                <label className="wide"><span>Bullets</span><textarea value={item.bullets} onChange={(event) => updateExperience(index, "bullets", event.target.value)} placeholder="One bullet per line" /></label>
              </div>
            </article>
          )) : <EmptyPanel title="No work history rows" body="Add roles here if the parser missed the candidate's experience." />}
        </div>
      </section>
      <section className="candidateCorrectionSection">
        <div className="candidateCorrectionSubhead">
          <strong>Education</strong>
          <span>Education appears in the candidate report and matching context.</span>
          <button className="plain small" type="button" onClick={addEducation}>Add education</button>
        </div>
        <div className="candidateEditableList">
          {form.education.length ? form.education.map((item, index) => (
            <article className="candidateEditableCard" key={`education-${index}`}>
              <div className="candidateEditableCardHeader">
                <strong>Education {index + 1}</strong>
                <button className="plain danger small" type="button" onClick={() => removeEducation(index)}>Remove</button>
              </div>
              <div className="candidateCorrectionGrid">
                <label><span>School</span><input value={item.school} onChange={(event) => updateEducation(index, "school", event.target.value)} /></label>
                <label><span>Degree</span><input value={item.degree} onChange={(event) => updateEducation(index, "degree", event.target.value)} /></label>
                <label><span>Field</span><input value={item.field} onChange={(event) => updateEducation(index, "field", event.target.value)} /></label>
                <label><span>Location</span><input value={item.location} onChange={(event) => updateEducation(index, "location", event.target.value)} /></label>
                <label><span>Start date</span><input value={item.start_date} onChange={(event) => updateEducation(index, "start_date", event.target.value)} /></label>
                <label><span>End date</span><input value={item.end_date} onChange={(event) => updateEducation(index, "end_date", event.target.value)} /></label>
                <label className="wide"><span>Details</span><textarea value={item.details} onChange={(event) => updateEducation(index, "details", event.target.value)} placeholder="One detail per line" /></label>
              </div>
            </article>
          )) : <EmptyPanel title="No education rows" body="Add education if the CV contains it but parsing missed it." />}
        </div>
      </section>
      <div className="candidateCorrectionActions">
        <button className="plain" onClick={cancel}>Cancel</button>
        <button className="primary" onClick={save}>Save corrections</button>
      </div>
    </section>
  );
}
