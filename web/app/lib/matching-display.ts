import type { RequirementMatch } from "../../lib/api";
import { domainLabel } from "./format";

export type MatchFilter = "all" | "eligible" | "blocked" | "shortlisted" | "rejected";

export const requirementStructuredFields = [
  {
    key: "__profile.must_have_skills",
    profileKey: "must_have_skills",
    label: "Must-have skills",
    placeholder: "Azure OpenAI, LangChain, RAG",
    help: "Non-negotiable capabilities only if the recruiter truly means hard requirement.",
    multiline: true,
  },
  {
    key: "__profile.nice_to_have_skills",
    profileKey: "nice_to_have_skills",
    label: "Nice-to-have skills",
    placeholder: "Databricks, LangGraph, Kubernetes",
    help: "Improves score but should not block otherwise strong candidates.",
    multiline: true,
  },
  {
    key: "__profile.min_years_experience",
    profileKey: "min_years_experience",
    label: "Minimum years",
    placeholder: "5",
    help: "Used for years-fit scoring. Treat as hard only when the requirement explicitly says so.",
    multiline: false,
  },
  {
    key: "__profile.seniority",
    profileKey: "seniority",
    label: "Required seniority",
    placeholder: "Senior / Lead / Principal",
    help: "Sets recruiter intent for title and responsibility fit.",
    multiline: false,
  },
  {
    key: "__profile.required_countries",
    profileKey: "required_countries",
    label: "Required countries",
    placeholder: "United States, Canada",
    help: "Candidate country/location signals are checked against this list.",
    multiline: false,
  },
  {
    key: "__profile.required_locations",
    profileKey: "required_locations",
    label: "Required locations / time zones",
    placeholder: "EST, New York, Remote US",
    help: "Use for city, timezone, remote, or office-specific constraints.",
    multiline: false,
  },
  {
    key: "__profile.domains",
    profileKey: "domains",
    label: "Priority domains",
    placeholder: "generative_ai, data_engineering",
    help: "Domain fit is scored separately from raw skill matches.",
    multiline: false,
  },
  {
    key: "__profile.work_authorization",
    profileKey: "work_authorization",
    label: "Work authorization",
    placeholder: "US work authorization required",
    help: "Only make strict if it is a real hiring constraint.",
    multiline: false,
  },
  {
    key: "__profile.dealbreakers",
    profileKey: "dealbreakers",
    label: "Dealbreakers",
    placeholder: "No production AI experience; no cloud experience",
    help: "Active dealbreakers are shown as hard-filter failures when detected.",
    multiline: true,
  },
] as const;

export function hasMatchGaps(gaps: unknown) {
  return Object.values(gaps ?? {}).some((value) => Array.isArray(value) ? value.length > 0 : Number(value ?? 0) > 0);
}

export function gapItems(key: string, value: unknown) {
  const label = domainLabel(key);
  if (Array.isArray(value)) return value.map((item) => `${label}: ${item}`);
  if (Number(value ?? 0) > 0) return [`${label}: ${value}`];
  return [];
}

export function matchFilterHit(match: RequirementMatch, filter: MatchFilter) {
  if (filter === "all") return true;
  if (filter === "eligible") return !(match.evidence?.hard_filter_failures ?? []).length;
  if (filter === "blocked") return (match.evidence?.hard_filter_failures ?? []).length > 0;
  return match.status === filter;
}

export function matchNextAction(match: RequirementMatch) {
  if ((match.evidence?.hard_filter_failures ?? []).length) return "Do not outreach yet. Resolve hard-filter failures or change the requirement constraints.";
  if (match.status === "shortlisted") return "Already shortlisted. Move to recruiter screen or hiring-manager review.";
  if (match.status === "rejected") return "Rejected for this requirement. Keep the decision for audit/history.";
  if (match.total_score >= 0.78) return "Shortlist and open the candidate detail to review raw evidence before outreach.";
  if (hasMatchGaps(match.gaps)) return "Review gaps and semantic evidence before deciding whether to shortlist.";
  return "Open candidate detail and compare against other eligible candidates.";
}

export function matchDistribution(matches: Array<{ total_score?: number; score?: number }>) {
  const buckets = [
    { label: "80-100%", minimum: 0.8, min: 0.8, max: 1.01 },
    { label: "65-79%", minimum: 0.65, min: 0.65, max: 0.8 },
    { label: "50-64%", minimum: 0.5, min: 0.5, max: 0.65 },
    { label: "30-49%", minimum: 0.3, min: 0.3, max: 0.5 },
  ];
  const total = Math.max(1, matches.length);
  return buckets.map((bucket) => {
    const count = matches.filter((item) => {
      const score = Number(item.total_score ?? item.score ?? 0);
      return score >= bucket.min && score < bucket.max;
    }).length;
    return { ...bucket, count, percent: Math.round((count / total) * 100) };
  });
}

export function profileAnswerValue(
  draftAnswers: Record<string, string>,
  savedAnswers: Record<string, string>,
  profile: Record<string, unknown>,
  field: (typeof requirementStructuredFields)[number],
) {
  if (Object.prototype.hasOwnProperty.call(draftAnswers, field.key)) return draftAnswers[field.key] ?? "";
  if (Object.prototype.hasOwnProperty.call(savedAnswers, field.key)) return savedAnswers[field.key] ?? "";
  const value = profile?.[field.profileKey];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}
