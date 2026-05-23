import type { CandidateSummary, CopilotMessage, CopilotThread } from "../../lib/api";
import { domainLabel, textValue } from "./format";

export type WorkspaceChatMessage = CopilotMessage & {
  query?: string;
  candidates?: CandidateSummary[];
  clarifying_questions?: string[];
  suggested_actions?: string[];
  metadata?: Record<string, any>;
};

export type CopilotFilters = {
  sort: "relevance" | "recency";
  minScore: number;
  exactEvidenceOnly: boolean;
  country: string;
  seniority: "all" | "senior";
};

export type CopilotQueryIntent = {
  role_intent: string;
  roles: string[];
  locations: string[];
  location_requirement: "preferred" | "required" | "ignored" | string;
  terms: string[];
};

export const COPILOT_GREETING: WorkspaceChatMessage = {
  role: "assistant",
  content: "Ask me to find candidates, compare profiles, surface evidence from raw CV text, or turn a hiring intent into a shortlist query.",
};

export function filterCopilotCandidates(candidates: CandidateSummary[], filters: CopilotFilters, query: string) {
  const queryTerms = significantTerms(query);
  const filtered = candidates.filter((candidate) => {
    if (Number(candidate.semantic_score ?? 0) < filters.minScore) return false;
    if (filters.country !== "all" && !(candidate.countries ?? []).includes(filters.country)) return false;
    if (filters.seniority === "senior" && !/senior|lead|principal|staff|founding/i.test(`${candidate.seniority ?? ""} ${candidate.current_title ?? ""}`)) return false;
    if (filters.exactEvidenceOnly && queryTerms.length && !candidateHasEvidenceTerm(candidate, queryTerms)) return false;
    return true;
  });
  return filtered.sort((left, right) => {
    if (filters.sort === "recency") {
      return new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime();
    }
    return Number(right.semantic_score ?? 0) - Number(left.semantic_score ?? 0);
  });
}

export function copilotResultReason(candidate: CandidateSummary, query: string) {
  const queryTerms = significantTerms(query);
  const evidenceText = (candidate.evidence ?? [])
    .map((item) => `${item.source_label ?? ""} ${item.chunk_type ?? ""} ${item.snippet ?? ""}`)
    .join(" ")
    .toLowerCase();
  const evidenceHits = queryTerms
    .filter((term) => term.length >= 3 && evidenceText.includes(term.toLowerCase()))
    .slice(0, 5);
  if (evidenceHits.length) return `Direct resume/search evidence includes: ${Array.from(new Set(evidenceHits)).join(", ")}.`;
  if ((candidate.top_domains ?? []).length) return `Profile domains matched the search: ${(candidate.top_domains ?? []).slice(0, 2).map(domainLabel).join(", ")}.`;
  if (Number(candidate.semantic_score ?? 0) > 0) return "Semantic search matched the candidate profile, raw resume text, or recruiter notes.";
  return "Candidate is visible after the current Copilot filters.";
}

export function normalizeCopilotQueryIntent(raw: unknown, query: string): CopilotQueryIntent {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const fallback = clientCopilotQueryIntent(query);
  const roles = arrayOfText(item.roles);
  const locations = arrayOfText(item.locations);
  const terms = arrayOfText(item.terms);
  const locationRequirement = textValue(item.location_requirement) || fallback.location_requirement;
  return {
    role_intent: textValue(item.role_intent) || fallback.role_intent,
    roles: roles.length ? roles : fallback.roles,
    locations: locations.length ? locations : fallback.locations,
    location_requirement: ["preferred", "required", "ignored"].includes(locationRequirement) ? locationRequirement : "preferred",
    terms: terms.length ? terms : fallback.terms,
  };
}

export function clientCopilotQueryIntent(query: string): CopilotQueryIntent {
  const normalized = query.toLowerCase();
  const rolePatterns: Array<[RegExp, string]> = [
    [/data\s+engineer|etl|spark|databricks|pipeline/, "Data Engineering"],
    [/\bai\b|genai|llm|rag|langchain|machine learning|ml engineer/, "AI / ML"],
    [/cloud|azure|aws|gcp|architect/, "Cloud Architecture"],
    [/analytics|bi|tableau|power bi|looker/, "Analytics / BI"],
    [/security|identity|iam|oauth|governance/, "Security / Identity"],
  ];
  const locationPatterns: Array<[RegExp, string]> = [
    [/new\s+york|nyc|\bny\b/, "New York"],
    [/columbus|ohio|\boh\b/, "Columbus, OH"],
    [/san\s+francisco|bay area|\bsf\b/, "San Francisco"],
    [/seattle/, "Seattle"],
    [/austin/, "Austin"],
    [/boston/, "Boston"],
    [/india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune/, "India"],
    [/remote/, "Remote"],
  ];
  const roles = rolePatterns.filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
  const locations = locationPatterns.filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
  const location_requirement = /ignore location|any location|location flexible|remote ok|location optional/.test(normalized)
    ? "ignored"
    : /must|required|strict|only|mandatory|onsite|local/.test(normalized)
      ? "required"
      : "preferred";
  return {
    role_intent: roles[0] || "Open candidate search",
    roles,
    locations,
    location_requirement,
    terms: significantTerms(query),
  };
}

export function locationRequirementLabel(value: string) {
  if (value === "required") return "Required hard filter";
  if (value === "ignored") return "Ignored";
  return "Preferred scoring signal";
}

export function rewriteCopilotLocationPreference(query: string, mode: "preferred" | "required" | "ignored") {
  const base = query
    .replace(/\((location required|location preferred|ignore location)\)/gi, "")
    .replace(/\b(location required|location preferred|ignore location|required location|preferred location)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const suffix = mode === "required" ? "location required" : mode === "ignored" ? "ignore location" : "location preferred";
  return `${base || "Find candidates"} (${suffix})`;
}

export function normalizedCopilotScoreBreakdown(candidate: CandidateSummary) {
  const breakdown = candidate.copilot_score_breakdown ?? {};
  const total = Number(breakdown.total_score ?? candidate.semantic_score ?? 0);
  return {
    total_score: Number.isFinite(total) ? total : 0,
    role_score: Number(breakdown.role_score ?? 0),
    evidence_score: Number(breakdown.evidence_score ?? 0),
    years_score: Number(breakdown.years_score ?? 0),
    location_score: Number(breakdown.location_score ?? 0),
    semantic_score: Number(breakdown.semantic_score ?? candidate.semantic_score ?? 0),
    location_reason: breakdown.location_reason,
  };
}

export function scoreBreakdownItems(breakdown: ReturnType<typeof normalizedCopilotScoreBreakdown>) {
  return [
    { label: "Role", value: percentScore(breakdown.role_score) },
    { label: "Evidence", value: percentScore(breakdown.evidence_score) },
    { label: "Years", value: percentScore(breakdown.years_score) },
    { label: "Location", value: percentScore(breakdown.location_score) },
  ];
}

export function percentScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0) * 100)));
}

export function buildCopilotQueryInsights(query: string, candidates: CandidateSummary[], intent: CopilotQueryIntent) {
  const terms = significantTerms(query);
  const knownSkills = [
    "ai",
    "genai",
    "rag",
    "llm",
    "langchain",
    "azure",
    "aws",
    "gcp",
    "spark",
    "databricks",
    "python",
    "analytics",
    "healthcare",
    "salesforce",
    "postgres",
    "m365",
    "security",
  ];
  const skills = knownSkills.filter((skill) => terms.some((term) => term.toLowerCase() === skill || term.toLowerCase().includes(skill))).slice(0, 8);
  const locationTerms = ["new york", "nyc", "columbus", "ohio", "united states", "usa", "us", "india", "canada", "remote", "hybrid", "onsite", "europe", "uk"];
  const normalizedQuery = query.toLowerCase();
  const locations = locationTerms.filter((item) => normalizedQuery.includes(item)).map((item) => {
    if (item === "usa" || item === "us") return "United States";
    if (item === "nyc") return "New York";
    return domainLabel(item);
  });
  const seniority = /founding|principal|staff|lead|senior|architect|manager|director/i.exec(query)?.[0];
  const roleTerms = terms.filter((term) => /engineer|architect|developer|scientist|analyst|manager|consultant|recruiter|designer|product|data|ai/i.test(term)).slice(0, 5);
  const roleIntent = intent.role_intent || [seniority, ...roleTerms].filter(Boolean).join(" ") || "Open candidate search";
  const strongestCompany = candidates
    .map((candidate) => candidate.current_company)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const tweaks = [
    skills.length ? `Show strongest evidence for ${skills.slice(0, 3).join(", ")} and separate must-have from nice-to-have.` : "Ask me clarifying questions before ranking these candidates.",
    (intent.locations.length || locations.length) ? `Treat ${[...intent.locations, ...locations].slice(0, 3).join(" or ")} as preferred unless you explicitly mark it required.` : "Add location, timezone, or work authorization preferences.",
    "Sort this result by recency and recruiter notes relevance.",
    strongestCompany ? `Compare candidates with similar company exposure to ${strongestCompany}.` : "Turn this search into a requirement draft.",
  ];
  return {
    roleIntent: roleIntent.replace(/\s+/g, " ").trim(),
    skills: Array.from(new Set(skills.map(domainLabel))),
    locations: Array.from(new Set([...intent.locations, ...locations])),
    tweaks,
  };
}

export function copilotAnalysisQuery(analysis: { roleIntent: string; skills: string[]; locations: string[] }) {
  const parts = [
    analysis.roleIntent || "candidate",
    analysis.skills.length ? `with ${analysis.skills.join(", ")}` : "",
    analysis.locations.length ? `near/preferred ${analysis.locations.join(", ")}` : "",
  ].filter(Boolean);
  return `Find ${parts.join(" ")}`.replace(/\s+/g, " ").trim();
}

export function copilotThreadMessages(thread: CopilotThread): WorkspaceChatMessage[] {
  const messages = (thread.messages ?? []).map((message) => ({
    role: message.role,
    content: message.content,
    query: message.query ?? undefined,
    candidates: message.candidates ?? undefined,
    clarifying_questions: message.clarifying_questions ?? undefined,
    suggested_actions: message.suggested_actions ?? undefined,
    metadata: message.metadata ?? undefined,
  }));
  return messages.length ? messages : [COPILOT_GREETING];
}

function arrayOfText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => textValue(item)).filter(Boolean);
}

function significantTerms(query: string) {
  const stopwords = new Set(["find", "show", "candidate", "candidates", "with", "that", "have", "need", "the", "and", "for", "from", "resume", "profiles"]);
  return Array.from(new Set((query.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{2,}/g) ?? []).filter((term) => !stopwords.has(term))));
}

function candidateHasEvidenceTerm(candidate: CandidateSummary, terms: string[]) {
  const evidenceText = [
    candidate.current_company,
    ...(candidate.evidence ?? []).map((item) => item.snippet ?? ""),
  ].join(" ").toLowerCase();
  return terms.some((term) => evidenceText.includes(term.toLowerCase()));
}
