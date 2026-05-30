"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSearch, Loader2, MessageSquare, Plus, Search } from "lucide-react";
import type { CandidateSummary, CopilotThread, JobCampaign, Requirement, RequirementMatch } from "../../lib/api";
import { candidateNoteSignalLabels, candidateRoleFactsNeedReview } from "../lib/candidate-database";
import { evidenceSourceLabel } from "../lib/candidate-evidence";
import {
  buildCopilotQueryInsights,
  copilotAnalysisQuery,
  copilotResultReason,
  filterCopilotCandidates,
  locationRequirementLabel,
  normalizeCopilotQueryIntent,
  normalizedCopilotScoreBreakdown,
  rewriteCopilotLocationPreference,
  scoreBreakdownItems,
  type CopilotFilters,
  type WorkspaceChatMessage,
} from "../lib/copilot";
import { domainLabel, splitCommaList } from "../lib/format";
import { DOCUMENT_FILE_ACCEPT, DOCUMENT_FORMAT_LABEL } from "../lib/login";
import { copyCurrentUrl } from "../lib/workspace-route";
import { EmptyPanel } from "./primitives";
import { RECRUITER_COPY } from "./recruiter-language";

export function RecruiterCopilot({
  messages,
  threads,
  activeThread,
  input,
  setInput,
  resultLimit,
  setResultLimit,
  allCandidates,
  campaigns,
  activeCampaign,
  selectedCampaignId,
  selectCampaign,
  shortlistToCampaign,
  openCampaign,
  send,
  newThread,
  openThread,
  archiveThread,
  createRequirementFromThread,
  openCandidate,
  busy,
  requirement,
  requirementText,
  setRequirementText,
  requirementFile,
  setRequirementFile,
  clarifyAnswers,
  setClarifyAnswers,
  createRequirement,
  finalize,
  match,
  matches,
}: {
  messages: WorkspaceChatMessage[];
  threads: CopilotThread[];
  activeThread: CopilotThread | null;
  input: string;
  setInput: (value: string) => void;
  resultLimit: number;
  setResultLimit: (value: number) => void;
  allCandidates: CandidateSummary[];
  campaigns: JobCampaign[];
  activeCampaign: JobCampaign | null;
  selectedCampaignId: string;
  selectCampaign: (id: string) => void;
  shortlistToCampaign: (candidateId: string) => void;
  openCampaign: (id: string) => void;
  send: (messageOverride?: string, limitOverride?: number) => void;
  newThread: () => void;
  openThread: (id: string) => void;
  archiveThread: (id: string) => void;
  createRequirementFromThread: (id: string) => void;
  openCandidate: (id: string) => void;
  busy: boolean;
  requirement: Requirement | null;
  requirementText: string;
  setRequirementText: (value: string) => void;
  requirementFile: File | null;
  setRequirementFile: (file: File | null) => void;
  clarifyAnswers: Record<string, string>;
  setClarifyAnswers: (value: Record<string, string>) => void;
  createRequirement: () => void;
  finalize: () => void;
  match: () => void;
  matches: RequirementMatch[];
}) {
  const [activeTab, setActiveTab] = useState<"search" | "requirement">("search");
  const [filters, setFilters] = useState<CopilotFilters>({
    sort: "relevance",
    minScore: 0,
    exactEvidenceOnly: false,
    country: "all",
    seniority: "all",
  });
  const [ignoredCandidateIds, setIgnoredCandidateIds] = useState<string[]>([]);
  const latestResultCount = messages.reduce((count, message) => count + (message.candidates?.length ?? 0), 0);
  const selectedCampaign = activeCampaign?.id === selectedCampaignId
    ? activeCampaign
    : campaigns.find((item) => item.id === selectedCampaignId) ?? null;
  const shortlistedCandidateIds = useMemo(() => new Set(
    (selectedCampaign?.candidates ?? [])
      .filter((item) => item.status === "shortlisted")
      .map((item) => item.candidate_id)
  ), [selectedCampaign?.candidates]);
  const countryOptions = useMemo(() => {
    const countries = new Set<string>();
    allCandidates.forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country)));
    messages.forEach((message) => (message.candidates ?? []).forEach((candidate) => (candidate.countries ?? []).forEach((country) => country && countries.add(country))));
    return Array.from(countries).sort((left, right) => left.localeCompare(right));
  }, [allCandidates, messages]);
  const latestCandidateMessage = useMemo(() => [...messages].reverse().find((message) => message.candidates?.length), [messages]);
  const latestQuery = latestCandidateMessage?.query ?? input;
  const latestQueryIntent = useMemo(
    () => normalizeCopilotQueryIntent(latestCandidateMessage?.metadata?.query_intent, latestQuery),
    [latestCandidateMessage?.metadata, latestQuery]
  );
  const latestFilteredCandidates = useMemo(() => {
    return filterCopilotCandidates(latestCandidateMessage?.candidates ?? [], filters, latestQuery)
      .filter((candidate) => !ignoredCandidateIds.includes(candidate.document_id));
  }, [filters, ignoredCandidateIds, latestCandidateMessage?.candidates, latestQuery]);
  const computedQueryInsights = useMemo(() => buildCopilotQueryInsights(latestQuery, latestCandidateMessage?.candidates ?? latestFilteredCandidates, latestQueryIntent), [latestQuery, latestCandidateMessage?.candidates, latestFilteredCandidates, latestQueryIntent]);
  const [queryDraft, setQueryDraft] = useState(computedQueryInsights);
  const queryDraftResetRef = useRef("");
  const queryDraftResetKey = latestCandidateMessage
    ? `${activeThread?.id ?? "new"}:${latestCandidateMessage.query ?? ""}:${latestCandidateMessage.candidates?.length ?? 0}`
    : `draft:${activeThread?.id ?? "new"}`;
  useEffect(() => {
    if (queryDraftResetRef.current === queryDraftResetKey) return;
    queryDraftResetRef.current = queryDraftResetKey;
    setQueryDraft(computedQueryInsights);
  }, [queryDraftResetKey, computedQueryInsights]);
  const isSearching = busy && activeTab === "search";
  const canShowMore = Boolean(latestQuery.trim()) && !isSearching && (latestCandidateMessage?.candidates?.length ?? 0) >= resultLimit;
  function updateQueryDraft(next: typeof queryDraft) {
    setQueryDraft(next);
    setInput(copilotAnalysisQuery(next));
  }
  function showMoreResults() {
    const nextLimit = Math.min(100, resultLimit + 10);
    setResultLimit(nextLimit);
    send(latestQuery, nextLimit);
  }
  return (
    <section className="copilotPage">
      <div className="copilotModeBar">
        <div className="copilotTabs">
          <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}><MessageSquare size={16} /> Search Copilot</button>
          <button className={activeTab === "requirement" ? "active" : ""} onClick={() => setActiveTab("requirement")}><FileSearch size={16} /> {RECRUITER_COPY.requirementAssistant}</button>
        </div>
        <div className="copilotModeActions">
          <label className="copilotCampaignSelector">
            <span>Shortlist to</span>
            <select value={selectedCampaignId} onChange={(event) => selectCampaign(event.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.filter((item) => item.status !== "archived").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {selectedCampaignId ? <button className="secondary" type="button" onClick={() => openCampaign(selectedCampaignId)}>Open Campaign</button> : null}
          {activeThread?.id ? <button className="plain" type="button" onClick={() => copyCurrentUrl()}>Copy Thread Link</button> : null}
          <button className="secondary" onClick={newThread}><Plus size={16} /> New Thread</button>
        </div>
      </div>
      <div className="copilotGrid">
        {activeTab === "search" ? <section className="stitchCopilotMain">
          <form
            className="stitchSearchCommand"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Search size={30} />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Find senior data engineers with heavy PySpark experience, ideal locations, and evidence."
            />
            <button disabled={busy || !input.trim()} type="submit">
              {busy ? <><Loader2 size={14} /> Searching</> : "Search"}
            </button>
          </form>
          {isSearching ? (
            <section className="copilotSearchingBanner" aria-live="polite">
              <Loader2 size={18} />
              <div>
                <strong>Finding candidates</strong>
                <span>Checking profiles, raw CV text, recruiter notes, and source-backed evidence.</span>
              </div>
              <i />
            </section>
          ) : null}
          <section className="stitchSignals">
            <div className="stitchSignalsHead">
              <div>
                <h3>Recommended Candidates</h3>
                <span>{latestFilteredCandidates.length || latestResultCount} Matches</span>
              </div>
              <div className="copilotControlGroup">
                <label>
                  Sorted by
                  <select value={filters.sort} onChange={(event) => setFilters((value) => ({ ...value, sort: event.target.value as CopilotFilters["sort"] }))}>
                    <option value="relevance">Match Quality</option>
                    <option value="recency">Recency</option>
                  </select>
                </label>
                <label>
                  Results
                  <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="copilotFilterStrip">
              <label>
                Country
                <select value={filters.country} onChange={(event) => setFilters((value) => ({ ...value, country: event.target.value }))}>
                  <option value="all">Any country</option>
                  {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
                </select>
              </label>
              <button className={filters.seniority === "senior" ? "filterChip active" : "filterChip"} onClick={() => setFilters((value) => ({ ...value, seniority: value.seniority === "senior" ? "all" : "senior" }))}>Senior+</button>
              <button className={filters.exactEvidenceOnly ? "filterChip active" : "filterChip"} onClick={() => setFilters((value) => ({ ...value, exactEvidenceOnly: !value.exactEvidenceOnly }))}>Exact evidence only</button>
            </div>
            <div className="copilotIntentPanel">
              <div>
                <span>Role intent</span>
                <strong>{latestQueryIntent.role_intent}</strong>
              </div>
              <div>
                <span>Locations</span>
                <strong>{latestQueryIntent.locations.length ? latestQueryIntent.locations.join(", ") : "Not specified"}</strong>
              </div>
              <div>
                <span>Location mode</span>
                <strong>{locationRequirementLabel(latestQueryIntent.location_requirement)}</strong>
              </div>
              <div className="locationPreferenceButtons" aria-label="Location preference controls">
                <button className={latestQueryIntent.location_requirement === "preferred" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "preferred"))}>Preferred</button>
                <button className={latestQueryIntent.location_requirement === "required" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "required"))}>Required</button>
                <button className={latestQueryIntent.location_requirement === "ignored" ? "active" : ""} type="button" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "ignored"))}>Ignore location</button>
              </div>
            </div>
            <div className={isSearching ? "copilotResultList searching" : "copilotResultList"}>
              {isSearching && !latestFilteredCandidates.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <article className="stitchCandidateCard copilotCompactCard copilotSkeletonCard" key={`loading-${index}`}>
                    <div><i /><i /><b /></div>
                    <span />
                    <p />
                  </article>
                ))
              ) : null}
              {latestFilteredCandidates.map((candidate, index) => {
                const reason = copilotResultReason(candidate, latestQuery);
                const evidenceItems = (candidate.evidence ?? []).filter((item) => item.snippet).slice(0, 2);
                const breakdown = normalizedCopilotScoreBreakdown(candidate);
                const scoreItems = scoreBreakdownItems(breakdown);
                const isShortlisted = shortlistedCandidateIds.has(candidate.document_id);
                const noteSignalTags = candidateNoteSignalLabels(candidate).slice(0, 3);
                return (
                  <article className="stitchCandidateCard copilotCompactCard" key={candidate.document_id}>
                    <div className="stitchCandidateTop">
                      <div className="rankAvatar">{index + 1}</div>
                      <button onClick={() => openCandidate(candidate.document_id)}>
                        <strong>{candidate.name ?? "Unnamed candidate"}</strong>
                        <span>{candidate.current_title ?? "No title"} {candidate.current_company ? `at ${candidate.current_company}` : ""}</span>
                        <em>{candidate.location || "Location not stated"}{candidate.countries?.length ? ` · ${candidate.countries.join(", ")}` : ""}</em>
                      </button>
                      <b>{Math.round(Number(breakdown.total_score ?? candidate.semantic_score ?? 0) * 100)}% Match</b>
                    </div>
                    <div className="copilotScorePills">
                      {scoreItems.map((item) => (
                        <span key={item.label}><strong>{item.value}%</strong> {item.label}</span>
                      ))}
                    </div>
                    <div className="copilotWhyShown">
                      <span>{breakdown.location_reason ? `${reason} Location: ${breakdown.location_reason}.` : reason}</span>
                    </div>
                    {evidenceItems.length ? (
                      <div className="copilotInlineEvidence">
                        <strong>{evidenceSourceLabel(evidenceItems[0])}</strong>
                        <span>{evidenceItems[0].snippet}</span>
                      </div>
                    ) : (
                      <details className="copilotEvidenceDetails mutedEvidence">
                        <summary>No exact snippet returned</summary>
                        <p>This candidate matched the semantic/profile index. Use “Exact evidence only” for stricter results.</p>
                      </details>
                    )}
                    <div className="stitchCandidateActions">
                      {noteSignalTags.map((signal) => <span className="noteSignalChip" key={signal}>{signal}</span>)}
                      {(candidate.top_domains ?? []).slice(0, 2).map((domain) => <span key={domain}>{domainLabel(domain)}</span>)}
                      {candidateRoleFactsNeedReview(candidate) ? <span className="factReviewAction">Role facts need review</span> : null}
                      <button onClick={() => setIgnoredCandidateIds((ids) => [...ids, candidate.document_id])}>Ignore</button>
                      <button className="shortlist" disabled={!selectedCampaignId || isShortlisted} onClick={() => shortlistToCampaign(candidate.document_id)}>
                        {isShortlisted ? "Shortlisted" : selectedCampaignId ? "Shortlist" : "Select campaign"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {!latestFilteredCandidates.length && !isSearching ? <EmptyPanel title="No candidate results yet" body="Write what you are looking for and click Search to review the company candidate database." /> : null}
            </div>
            {latestFilteredCandidates.length ? (
              <div className="copilotShowMoreBar">
                <div>
                  <strong>{latestFilteredCandidates.length} candidates visible</strong>
                  <span>Current search asks for up to {resultLimit} results. Retrieval can expand to 100; LLM synthesis stays capped to the strongest 10 to control cost.</span>
                </div>
                <button className="secondary" disabled={!canShowMore} onClick={showMoreResults}>
                  {canShowMore ? `Show 10 more` : "All returned results shown"}
                </button>
              </div>
            ) : null}
          </section>
        </section> : (
          <section className="panel copilotThread">
            <div className="panelHead">
              <h3>Requirement Builder</h3>
              <span>{requirement?.status ?? "No requirement loaded"}</span>
            </div>
            <div className="requirementHITLGrid">
              <section className="requirementDrop">
                <h3>Upload requirement</h3>
                <label className="fileDrop compact">
                  <FileSearch size={22} />
                  <span>{requirementFile ? requirementFile.name : `Choose ${DOCUMENT_FORMAT_LABEL}`}</span>
                  <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => setRequirementFile(event.target.files?.[0] ?? null)} />
                </label>
              </section>
              <section className="requirementPaste">
                <h3>Or paste requirement</h3>
                <textarea value={requirementText} onChange={(event) => setRequirementText(event.target.value)} placeholder="Paste the job requirement, client email, JD, or hiring manager notes here." />
              </section>
            </div>
            <button className="primary" disabled={busy || (!requirementFile && !requirementText.trim())} onClick={createRequirement}>
              Build Requirement Profile
            </button>
            {requirement ? (
              <section className="hitlPanel">
                <div className="panelHead">
                  <h3>{requirement.title || "Requirement clarification"}</h3>
                  <span>{requirement.status}</span>
                </div>
                <div className="hitlQuestions">
                  {(requirement.clarification_questions?.length ? requirement.clarification_questions : ["Confirm must-have skills, years, seniority, location, dealbreakers, and nice-to-haves."]).map((question) => (
                    <label key={question}>
                      <span>{question}</span>
                      <input value={clarifyAnswers[question] ?? ""} onChange={(event) => setClarifyAnswers({ ...clarifyAnswers, [question]: event.target.value })} placeholder="Recruiter answer" />
                    </label>
                  ))}
                </div>
                {requirement.final_requirement_profile ? (
                  <div className="requirementProfilePreview">
                    <strong>Final profile ready</strong>
                    <span>Use the confirmed scorecard to find candidates. Raw extraction JSON stays hidden from the recruiter workflow.</span>
                  </div>
                ) : null}
                <div className="actions">
                  <button className="secondary" onClick={finalize} disabled={busy}>Confirm Requirement</button>
                  <button className="primary" onClick={match} disabled={busy || requirement.status !== "finalized"}>{RECRUITER_COPY.matchingButton}</button>
                </div>
              </section>
            ) : null}
            {matches.length ? <p className="muted">{matches.length} candidates ranked. Review evidence, gaps, shortlist decisions, and rejects from the campaign or match results.</p> : null}
          </section>
        )}
        <aside className="panel copilotGuide">
          <header className="copilotGuideHeader">
            <div>
              <Search size={28} />
              <h3>{activeTab === "search" ? "Search Copilot" : "Requirement Assistant"}</h3>
            </div>
            <span>•••</span>
          </header>
          <h3>Editable Query Analysis</h3>
          <div className="queryAnalysisCard editableQueryAnalysis">
            <div className="queryAnalysisSummary">
              <span>Interpreted search</span>
              <strong>{latestQuery.trim() || "Start with a hiring question"}</strong>
            </div>
            <label>
              <span>Role intent</span>
              <input
                value={queryDraft.roleIntent}
                onChange={(event) => updateQueryDraft({ ...queryDraft, roleIntent: event.target.value })}
              />
            </label>
            <label>
              <span>Skills / signals</span>
              <input
                value={queryDraft.skills.join(", ")}
                onChange={(event) => updateQueryDraft({ ...queryDraft, skills: splitCommaList(event.target.value) })}
                placeholder="Spark, Python, healthcare"
              />
            </label>
            <label>
              <span>Location preference</span>
              <input
                value={queryDraft.locations.join(", ")}
                onChange={(event) => updateQueryDraft({ ...queryDraft, locations: splitCommaList(event.target.value) })}
                placeholder="New York, remote, USA"
              />
            </label>
            <div className="queryAnalysisFooter">
              <span>Visible candidates</span>
              <strong>{latestFilteredCandidates.length}</strong>
              <em>{locationRequirementLabel(latestQueryIntent.location_requirement)}</em>
            </div>
          </div>
          <section className="savedThreadsDrawer">
            <div className="savedThreadsHeader">
              <h3>Saved Threads</h3>
              <span>{threads.length}</span>
            </div>
            <div className="threadList">
              {threads.length ? threads.map((thread) => (
                <article className={activeThread?.id === thread.id ? "active" : ""} key={thread.id}>
                  <button onClick={() => openThread(thread.id)}>
                    <strong>{thread.title}</strong>
                    <span>{thread.message_count ?? 0} messages | {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString() : "No date"}</span>
                  </button>
                  <div className="threadActions">
                    <button className="plain tiny" onClick={() => createRequirementFromThread(thread.id)}>Req</button>
                    <button className="plain tiny danger" onClick={() => archiveThread(thread.id)}>Archive</button>
                  </div>
                </article>
              )) : <EmptyPanel title="No saved threads" body="Ask a Copilot question and the thread will be saved for the recruiter workspace." />}
            </div>
          </section>
          <h3>Quick Refinements</h3>
          <div className="guideList">
            <button className="promptChip" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "preferred"))}>Treat location as preferred</button>
            <button className="promptChip" onClick={() => setInput(rewriteCopilotLocationPreference(latestQuery, "required"))}>Make location required</button>
            <button className="promptChip" onClick={() => setInput(`${latestQuery || queryDraft.roleIntent} with recent experience and recruiter-note relevance`)}>Add recency + notes</button>
          </div>
        </aside>
      </div>
    </section>
  );
}
