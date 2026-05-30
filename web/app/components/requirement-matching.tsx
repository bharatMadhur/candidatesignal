import { useState } from "react";
import { FileSearch, FileUp, ShieldCheck } from "lucide-react";
import type { Requirement, RequirementMatch, RequirementMatchRun, RequirementMatchRunChange } from "../../lib/api";
import { evidenceSourceLabel } from "../lib/candidate-evidence";
import { DOCUMENT_FILE_ACCEPT } from "../lib/login";
import {
  gapItems,
  hasMatchGaps,
  matchDistribution,
  matchFilterHit,
  matchNextAction,
  profileAnswerValue,
  requirementStructuredFields,
  type MatchFilter,
} from "../lib/matching-display";
import { domainLabel, formatDateTime } from "../lib/format";
import type { View } from "../lib/workspace-route";
import { RECRUITER_COPY } from "./recruiter-language";
import { Metric } from "./primitives";

type RequirementProfile = Record<string, unknown> & {
  min_years_experience?: string | number | null;
  must_have_skills?: unknown[];
  required_locations?: unknown[];
  required_countries?: unknown[];
};

export function RequirementIntake(props: {
  requirement: Requirement | null;
  requirementText: string;
  setRequirementText: (value: string) => void;
  requirementFile: File | null;
  setRequirementFile: (file: File | null) => void;
  clarifyAnswers: Record<string, string>;
  setClarifyAnswers: (answers: Record<string, string>) => void;
  createRequirement: () => void;
  finalize: () => void;
  match: () => void;
  requirements: Requirement[];
  selectRequirement: (requirement: Requirement) => void;
}) {
  const locked = props.requirement?.status === "finalized" || props.requirement?.status === "matched";
  const inputMode = props.requirementFile ? "file" : props.requirementText.trim() ? "text" : "none";
  const activeProfile = (props.requirement?.final_requirement_profile ?? props.requirement?.extracted_requirement_json ?? {}) as RequirementProfile;
  const updateAnswer = (key: string, value: string) => props.setClarifyAnswers({ ...props.clarifyAnswers, [key]: value });
  return (
    <section className="requirementPage">
      <div className="pageTitle centered">
        <div>
          <h2>Build Requirement Profile</h2>
          <p>Extract the job profile, answer clarifying questions, confirm the scorecard, then find matching candidates.</p>
        </div>
      </div>
      <div className="intakeMethods">
        <label className={inputMode === "file" ? "intakeMethod active" : "intakeMethod"}>
          <FileUp size={28} />
          <strong>Upload Requirement</strong>
          <p>Upload a job description document. The system extracts the role, skills, location preferences, and dealbreakers.</p>
          <span>{props.requirementFile ? props.requirementFile.name : "Browse files ->"}</span>
          <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => props.setRequirementFile(event.target.files?.[0] ?? null)} />
        </label>
        <article className={inputMode === "text" || inputMode === "none" ? "intakeMethod active" : "intakeMethod"}>
          <FileSearch size={28} />
          <strong>Paste Text Requirement</strong>
          <p>Paste plain text from an email, internal req board, or hiring manager note.</p>
          <span>Active input</span>
        </article>
      </div>
      <section className="panel requirementTextPanel">
        <label>Requirement Text</label>
        <textarea value={props.requirementText} onChange={(event) => props.setRequirementText(event.target.value)} placeholder="Paste job description here..." />
        <button className="plain" disabled={!props.requirementText.trim() && !props.requirementFile} onClick={props.createRequirement}>Build Profile</button>
      </section>
      <section className="panel requirementHistory">
        <div className="panelHead"><h3>Requirement History</h3><span>{props.requirements.length}</span></div>
        {props.requirements.slice(0, 5).map((item) => (
          <button className={props.requirement?.id === item.id ? "historyItem active" : "historyItem"} key={item.id} onClick={() => props.selectRequirement(item)}>
            <strong>{item.title ?? "Untitled requirement"}</strong>
            <span>{item.status} | {new Date(item.updated_at).toLocaleDateString()}</span>
          </button>
        ))}
        {!props.requirements.length ? <p className="muted">No saved requirements yet.</p> : null}
      </section>
      <section className="clarificationPanel">
        <h3><ShieldCheck size={20} /> Clarifying Questions</h3>
        <p>Clarify ambiguous parameters before matching so weak assumptions do not become hard filters.</p>
        {props.requirement ? (
          <>
            <div className="requirementLifecycle">
              <span className={props.requirement.status === "draft" ? "active" : ""}>1. Extracted</span>
              <span className={props.requirement.status === "finalized" ? "active" : ""}>2. Confirmed</span>
              <span className={props.requirement.status === "matched" ? "active" : ""}>3. Matched</span>
            </div>
            <section className="requirementSummary">
              <Metric label="Title" value={props.requirement.title ?? "Untitled"} />
              <Metric label="Minimum Years" value={`${activeProfile?.min_years_experience ?? "Not set"}`} />
              <Metric label="Must-Haves" value={`${Array.isArray(activeProfile?.must_have_skills) ? activeProfile.must_have_skills.length : 0}`} />
              <Metric
                label="Locations"
                value={`${(Array.isArray(activeProfile?.required_locations) ? activeProfile.required_locations.length : 0) + (Array.isArray(activeProfile?.required_countries) ? activeProfile.required_countries.length : 0)}`}
              />
            </section>
            <section className="structuredClarification">
              <div className="cardTitle"><h3>Editable Scorecard</h3><span>These fields directly affect matching</span></div>
              {requirementStructuredFields.map((field) => (
                <label key={field.key} className={field.multiline ? "structuredField wide" : "structuredField"}>
                  <span>{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      disabled={locked}
                      value={profileAnswerValue(props.clarifyAnswers, props.requirement?.recruiter_answers ?? {}, activeProfile, field)}
                      onChange={(event) => updateAnswer(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      disabled={locked}
                      value={profileAnswerValue(props.clarifyAnswers, props.requirement?.recruiter_answers ?? {}, activeProfile, field)}
                      onChange={(event) => updateAnswer(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                  <small>{field.help}</small>
                </label>
              ))}
            </section>
            {(props.requirement.clarification_questions ?? []).length ? (
              <section className="openQuestions">
                <div className="cardTitle"><h3>Open Questions</h3><span>Additional recruiter context</span></div>
                {(props.requirement.clarification_questions ?? []).map((question) => (
                  <label className="question" key={question}>
                    <span>{question}</span>
                    <input disabled={locked} value={props.clarifyAnswers[question] ?? props.requirement?.recruiter_answers?.[question] ?? ""} onChange={(event) => updateAnswer(question, event.target.value)} />
                  </label>
                ))}
              </section>
            ) : null}
            <div className="actions">
              <button className="secondary" disabled={locked} onClick={props.finalize}>Confirm requirement</button>
              <button className="primary" disabled={!locked} onClick={props.match}>{RECRUITER_COPY.matchingButton}</button>
            </div>
          </>
        ) : <p className="muted">Create a requirement to generate clarification questions.</p>}
      </section>
    </section>
  );
}

export function MatchResults({
  requirement,
  requirements,
  matches,
  matchRuns,
  matchRunChanges,
  openCandidate,
  shortlist,
  reject,
  setView,
  selectRequirement,
}: {
  requirement: Requirement | null;
  requirements: Requirement[];
  matches: RequirementMatch[];
  matchRuns: RequirementMatchRun[];
  matchRunChanges: RequirementMatchRunChange[];
  openCandidate: (id: string) => void;
  shortlist: (id: string) => void;
  reject: (id: string) => void;
  setView: (view: View) => void;
  selectRequirement: (requirement: Requirement) => void;
}) {
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [minimumScore, setMinimumScore] = useState(0.3);
  const matchedRequirements = requirements.filter((item) => item.status === "matched");
  const scoreBuckets = matchDistribution(matches);
  const filteredMatches = matches.filter((item) => item.total_score >= minimumScore).filter((item) => matchFilterHit(item, filter));
  const counts = {
    all: matches.length,
    eligible: matches.filter((item) => !(item.evidence?.hard_filter_failures ?? []).length).length,
    blocked: matches.filter((item) => (item.evidence?.hard_filter_failures ?? []).length).length,
    shortlisted: matches.filter((item) => item.status === "shortlisted").length,
    rejected: matches.filter((item) => item.status === "rejected").length,
  };
  return (
    <section className="matchesPage">
      <div className="pageTitle">
        <div>
          <h2>Candidate Recommendations</h2>
          <p>{requirement ? `Requirement: ${requirement.title ?? "Untitled requirement"}` : "Select or create a confirmed requirement to find matching candidates."}</p>
        </div>
        <span>{filteredMatches.length}/{matches.length} candidates shown above {Math.round(minimumScore * 100)}%</span>
      </div>
      {!matches.length ? (
        <section className="panel emptyState">
          <h3>No recommendations loaded</h3>
          <p>Create a requirement, answer clarification questions, confirm the profile, then find matching candidates.</p>
          <button className="primary" onClick={() => setView("requirement")}>Go to Requirements</button>
        </section>
      ) : null}
      {matchedRequirements.length ? (
        <section className="panel requirementHistory matchHistory">
          <div className="panelHead"><h3>Matched Requirements</h3><span>{matchedRequirements.length}</span></div>
          {matchedRequirements.slice(0, 8).map((item) => (
            <button className={requirement?.id === item.id ? "historyItem active" : "historyItem"} key={item.id} onClick={() => selectRequirement(item)}>
              <strong>{item.title ?? "Untitled requirement"}</strong>
              <span>{item.status} | {new Date(item.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </section>
      ) : null}
      {matchRuns.length ? (
        <section className="panel matchRunHistory">
          <div className="panelHead"><h3>Match Run History</h3><span>{matchRuns.length} runs</span></div>
          <div className="matchRunGrid">
            {matchRuns.slice(0, 4).map((run) => (
              <article key={run.id}>
                <strong>Search #{run.run_number}</strong>
                <span>{formatDateTime(run.created_at)}</span>
                <div>
                  <Metric label="Candidates" value={String(run.candidate_count)} />
                  <Metric label="Eligible" value={String(run.eligible_count)} />
                  <Metric label="Top Score" value={`${Math.round(run.top_score * 100)}%`} />
                  <Metric label="Avg Score" value={`${Math.round(run.average_score * 100)}%`} />
                </div>
              </article>
            ))}
          </div>
          {matchRunChanges.length ? (
            <div className="matchRunChanges">
              <strong>Latest run comparison</strong>
              {matchRunChanges.slice(0, 6).map((change) => (
                <span key={`${change.candidate_id}-${change.change_type}`}>
                  {change.candidate_name ?? change.candidate_id}: {domainLabel(change.change_type)}
                  {typeof change.score_delta === "number" ? ` ${change.score_delta > 0 ? "+" : ""}${Math.round(change.score_delta * 100)} pts` : ""}
                  {change.rank_delta ? ` | rank ${change.rank_delta > 0 ? "+" : ""}${change.rank_delta}` : ""}
                </span>
              ))}
            </div>
          ) : <p className="muted">Run comparison will appear after at least two match runs.</p>}
        </section>
      ) : null}
      {matches.length ? (
        <section className="matchDistributionPanel">
          <div>
            <span className="eyebrow">Match distribution</span>
            <h3>Only review candidates above the working threshold</h3>
            <p>Candidates below 30% stay hidden from the recruiter list. Raise the threshold when the database gets large.</p>
          </div>
          <div className="matchGaugeBuckets">
            {scoreBuckets.map((bucket) => (
              <button className={minimumScore === bucket.minimum ? "active" : ""} key={bucket.label} onClick={() => setMinimumScore(bucket.minimum)}>
                <span>{bucket.label}</span>
                <strong>{bucket.count}</strong>
                <i style={{ width: `${Math.max(8, Math.min(100, bucket.percent))}%` }} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {matches.length ? (
        <section className="matchToolbar">
          {(["all", "eligible", "blocked", "shortlisted", "rejected"] as MatchFilter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {domainLabel(item)} <span>{counts[item]}</span>
            </button>
          ))}
        </section>
      ) : null}
      <div className="matchList">
        {filteredMatches.map((item, index) => (
          <article className="matchCard" key={item.candidate_id}>
            <div className="matchHead">
              <div>
                <strong>#{index + 1} {item.candidate.name}</strong>
                <span>{item.candidate.current_title} | {item.candidate.total_years_experience} yrs</span>
                <em className={`matchStatus ${item.status ?? "ranked"}`}>{item.status ?? "ranked"}</em>
              </div>
              <b>{Math.round(item.total_score * 100)}%</b>
            </div>
            <p>{item.recommendation}</p>
            <div className="nextActionBox">
              <strong>Recommended next action</strong>
              <span>{matchNextAction(item)}</span>
            </div>
            {(item.evidence?.hard_filter_failures ?? []).length ? (
              <div className="hardFilterBox">
                <strong>Must-check failures</strong>
                {(item.evidence.hard_filter_failures ?? []).map((failure: string, failureIndex: number) => <span key={`${failure}-${failureIndex}`}>{failure}</span>)}
              </div>
            ) : <div className="hardFilterPass">Must-check items passed</div>}
            <div className="scoreGrid">
              <Metric label="Must-have" value={`${Math.round(item.must_have_score * 100)}%`} />
              <Metric label="Nice-have" value={`${Math.round(item.nice_to_have_score * 100)}%`} />
              <Metric label="Years" value={`${Math.round(item.years_score * 100)}%`} />
              <Metric label="Domain" value={`${Math.round(item.domain_score * 100)}%`} />
            </div>
            <div className="chips">{(item.evidence.must_have_hits ?? []).map((hit: string) => <span key={hit}>{hit}</span>)}</div>
            {(item.evidence?.notes_relevance ?? []).length ? (
              <div className="notesRelevance">
                <strong>Recruiter notes relevance</strong>
                {(item.evidence.notes_relevance ?? []).map((noteName: string, noteIndex: number) => <span key={`${noteName}-${noteIndex}`}>{noteName}</span>)}
              </div>
            ) : null}
            {(item.evidence?.semantic_evidence ?? []).length ? (
              <div className="matchEvidence">
                <strong>Semantic evidence</strong>
                {(item.evidence.semantic_evidence ?? []).slice(0, 3).map((evidence: { source_label?: string | null; chunk_type?: string | null; page_number?: number | null; snippet?: string }, evidenceIndex: number) => (
                  <article key={`${evidence.source_label ?? "evidence"}-${evidenceIndex}`}>
                    <span>{evidenceSourceLabel(evidence)}</span>
                    <p>{evidence.snippet}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {hasMatchGaps(item.gaps) ? (
              <div className="matchGaps">
                <strong>Gaps</strong>
                {Object.entries(item.gaps ?? {}).flatMap(([key, value]) => gapItems(key, value)).map((gap) => <span key={gap}>{gap}</span>)}
              </div>
            ) : null}
            <div className="jobActions">
              <button className="plain" onClick={() => openCandidate(item.candidate_id)}>Open candidate</button>
              <button className="secondary" disabled={item.status === "shortlisted"} onClick={() => shortlist(item.candidate_id)}>Add to shortlist</button>
              <button className="plain danger" disabled={item.status === "rejected"} onClick={() => reject(item.candidate_id)}>Reject for req</button>
            </div>
          </article>
        ))}
        {matches.length && !filteredMatches.length ? (
          <section className="panel emptyState">
            <h3>No candidates in this match view</h3>
            <p>Change the match filter to review other ranked, blocked, shortlisted, or rejected candidates.</p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
