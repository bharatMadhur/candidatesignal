import type { CampaignPipelineStatus, CampaignScorecard, JobCampaign, JobCampaignCandidate } from "../../lib/api";
import { percentScore } from "./copilot";
import { textValue, toTextList, uniqueTextList } from "./format";
import { gapItems } from "./matching-display";

export type CampaignScorecardForm = {
  role_intent: string;
  location_preference: string;
  seniority: string;
  min_years_experience: string;
  must_have_skills: string;
  nice_to_have_skills: string;
  domains: string;
  industry_preferences: string;
  soft_preferences: string;
  hidden_intent: string;
  dealbreakers: string;
  strict_must_haves: boolean;
  strict_min_years: boolean;
  weight_skills: string;
  weight_role: string;
  weight_domain: string;
  weight_years: string;
  weight_location: string;
  weight_recency: string;
  weight_seniority: string;
  weight_notes: string;
};

export function emptyCampaignScorecardForm(): CampaignScorecardForm {
  return {
    role_intent: "",
    location_preference: "",
    seniority: "",
    min_years_experience: "",
    must_have_skills: "",
    nice_to_have_skills: "",
    domains: "",
    industry_preferences: "",
    soft_preferences: "",
    hidden_intent: "",
    dealbreakers: "",
    strict_must_haves: false,
    strict_min_years: false,
    weight_skills: "30",
    weight_role: "18",
    weight_domain: "15",
    weight_years: "12",
    weight_location: "10",
    weight_recency: "8",
    weight_seniority: "5",
    weight_notes: "2",
  };
}

export function campaignScorecardForm(campaign: JobCampaign): CampaignScorecardForm {
  const scorecard = campaign.scorecard ?? {};
  const profile = campaign.requirement?.final_requirement_profile ?? campaign.requirement?.extracted_requirement_json ?? {};
  const locationPreference = firstCampaignList(
    scorecard.location_preference,
    profile.preferred_locations,
    profile.location_preference,
    profile.required_locations,
    profile.required_countries,
  );
  return {
    role_intent: textValue(scorecard.role_intent ?? profile.role_intent),
    location_preference: campaignListInput(locationPreference),
    seniority: textValue(scorecard.seniority ?? profile.seniority),
    min_years_experience: textValue(scorecard.min_years_experience ?? profile.min_years_experience),
    must_have_skills: campaignListInput(scorecard.must_have_skills ?? profile.must_have_skills),
    nice_to_have_skills: campaignListInput(scorecard.nice_to_have_skills ?? profile.nice_to_have_skills),
    domains: campaignListInput(scorecard.domains ?? profile.domains),
    industry_preferences: campaignListInput(scorecard.industry_preferences ?? profile.industry_preferences),
    soft_preferences: campaignListInput(scorecard.soft_preferences ?? profile.soft_preferences),
    hidden_intent: campaignListInput(scorecard.hidden_intent ?? profile.hidden_intent),
    dealbreakers: campaignListInput(scorecard.dealbreakers ?? profile.dealbreakers),
    strict_must_haves: Boolean(scorecard.strict_must_haves ?? profile.strict_must_haves),
    strict_min_years: Boolean(scorecard.strict_min_years ?? profile.strict_min_years),
    weight_skills: scoreWeightPercent(scorecard.score_weights?.skills ?? profile.score_weights?.skills, "30"),
    weight_role: scoreWeightPercent(scorecard.score_weights?.role ?? profile.score_weights?.role, "18"),
    weight_domain: scoreWeightPercent(scorecard.score_weights?.domain ?? profile.score_weights?.domain, "15"),
    weight_years: scoreWeightPercent(scorecard.score_weights?.years ?? profile.score_weights?.years, "12"),
    weight_location: scoreWeightPercent(scorecard.score_weights?.location ?? profile.score_weights?.location, "10"),
    weight_recency: scoreWeightPercent(scorecard.score_weights?.recency ?? profile.score_weights?.recency, "8"),
    weight_seniority: scoreWeightPercent(scorecard.score_weights?.seniority ?? profile.score_weights?.seniority, "5"),
    weight_notes: scoreWeightPercent(scorecard.score_weights?.notes ?? profile.score_weights?.notes, "2"),
  };
}

function firstCampaignList(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string" && value.trim()) return value;
  }
  return [];
}

export function campaignScorecardPayload(form: CampaignScorecardForm, campaign: JobCampaign): CampaignScorecard {
  const years = Number(form.min_years_experience.replace(/[^\d.]/g, ""));
  return {
    title: campaign.requirement_title || campaign.name,
    role_intent: form.role_intent.trim() || null,
    location_preference: campaignInputList(form.location_preference),
    seniority: form.seniority.trim() || null,
    min_years_experience: Number.isFinite(years) && years > 0 ? years : null,
    must_have_skills: campaignInputList(form.must_have_skills),
    nice_to_have_skills: campaignInputList(form.nice_to_have_skills),
    domains: campaignInputList(form.domains),
    industry_preferences: campaignInputList(form.industry_preferences),
    soft_preferences: campaignInputList(form.soft_preferences),
    hidden_intent: campaignInputList(form.hidden_intent),
    dealbreakers: campaignInputList(form.dealbreakers),
    strict_must_haves: form.strict_must_haves,
    strict_min_years: form.strict_min_years,
    score_weights: {
      skills: percentInputToDecimal(form.weight_skills),
      role: percentInputToDecimal(form.weight_role),
      domain: percentInputToDecimal(form.weight_domain),
      years: percentInputToDecimal(form.weight_years),
      location: percentInputToDecimal(form.weight_location),
      recency: percentInputToDecimal(form.weight_recency),
      seniority: percentInputToDecimal(form.weight_seniority),
      notes: percentInputToDecimal(form.weight_notes),
    },
  };
}

export function campaignScorecardCompleteness(form: CampaignScorecardForm) {
  const checks = [
    form.role_intent.trim(),
    form.must_have_skills.trim(),
    form.min_years_experience.trim(),
    form.seniority.trim(),
    form.location_preference.trim(),
    form.domains.trim() || form.industry_preferences.trim(),
    form.dealbreakers.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreWeightPercent(value: unknown, fallback: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return String(Math.round((numeric <= 1 ? numeric * 100 : numeric) * 10) / 10);
}

function percentInputToDecimal(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function campaignListInput(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  if (value == null) return "";
  return String(value);
}

function campaignInputList(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function campaignEvidenceItems(item: JobCampaignCandidate) {
  return [
    ...toTextList(item.evidence?.top_reasons),
    ...toTextList(item.evidence?.evidence?.must_have_hits),
    ...toTextList(item.evidence?.evidence?.nice_to_have_hits),
  ].filter(Boolean);
}

export function mergeCampaignCandidateUpdate(current: JobCampaignCandidate, updated: JobCampaignCandidate): JobCampaignCandidate {
  const seen = new Set<string>();
  const activityEvents = [
    ...(updated.activity_events ?? []),
    ...(current.activity_events ?? []),
  ].filter((event) => {
    if (!event?.id || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
  return { ...current, ...updated, activity_events: activityEvents };
}

export function stageCandidateStatus(status: string): CampaignPipelineStatus {
  if (status === "uploaded" || status === "matched" || status === "reviewing") return "recommended";
  if (status === "below_threshold") return "below_threshold";
  if (
    [
      "recommended",
      "shortlisted",
      "contacted",
      "replied",
      "screened",
      "submitted",
      "interviewing",
      "offer",
      "placed",
      "rejected",
      "archived",
    ].includes(status)
  ) {
    return status as CampaignPipelineStatus;
  }
  return "recommended";
}

export function campaignCandidateVisibleInPipeline(item: JobCampaignCandidate, threshold: number) {
  if (item.status === "below_threshold") return false;
  if (["shortlisted", "contacted", "replied", "screened", "submitted", "interviewing", "offer", "placed", "rejected", "archived"].includes(item.status)) {
    return true;
  }
  return Number(item.score ?? 0) >= threshold;
}

export function campaignScoreBreakdownItems(item: JobCampaignCandidate) {
  const breakdown = item.evidence?.score_breakdown ?? {};
  const fallbackTotal = Number(item.score ?? 0);
  return [
    { label: "Total", raw: breakdown.total ?? fallbackTotal },
    { label: "Must", raw: breakdown.must_have },
    { label: "Nice", raw: breakdown.nice_to_have },
    { label: "Years", raw: breakdown.years },
    { label: "Domain", raw: breakdown.domain },
    { label: "Location", raw: breakdown.location },
  ]
    .map((item) => ({ label: item.label, value: percentScore(Number(item.raw ?? 0)) }))
    .filter((item) => Number.isFinite(item.value));
}

export function campaignHardFilterFailures(item: JobCampaignCandidate) {
  return [
    ...toTextList(item.evidence?.hard_filter_failures),
    ...toTextList(item.evidence?.evidence?.hard_filter_failures),
  ];
}

export function campaignReasonItems(item: JobCampaignCandidate) {
  const explicit = toTextList(item.evidence?.top_reasons);
  if (explicit.length) return explicit;
  return campaignEvidenceItems(item);
}

export function campaignGapItems(item: JobCampaignCandidate) {
  const threshold = Number(item.evidence?.incremental_match?.visibility_threshold ?? 0);
  const thresholdLabel = threshold ? `${Math.round(threshold * 100)}%` : "review";
  const thresholdReason = item.status === "below_threshold"
    ? [`Below ${thresholdLabel} campaign threshold.`]
    : [];
  const incrementalReason = typeof item.evidence?.incremental_match?.reason === "string"
    ? [item.evidence.incremental_match.reason]
    : toTextList(item.evidence?.incremental_match?.reason);
  const explicit = toTextList(item.evidence?.top_gaps);
  const fallback = Object.entries(item.evidence?.gaps ?? {}).flatMap(([key, value]) => gapItems(key, value));
  return uniqueTextList([...thresholdReason, ...incrementalReason, ...explicit, ...fallback]);
}

export function campaignProgressStats(campaign: JobCampaign | null, candidates: JobCampaignCandidate[]) {
  const uploads = campaign?.upload_batches ?? [];
  const totalUploaded = uploads.reduce((sum, batch) => sum + Number(batch.total_files ?? 0), 0);
  const completedUploads = uploads.reduce((sum, batch) => sum + Number(batch.completed_count ?? 0) + Number(batch.failed_count ?? 0), 0);
  const uploadPercent = totalUploaded ? Math.round((completedUploads / totalUploaded) * 100) : 0;
  const shortlisted = candidates.filter((item) => item.status === "shortlisted").length;
  const rejected = candidates.filter((item) => item.status === "rejected").length;
  const reviewed = shortlisted + rejected;
  const reviewPercent = candidates.length ? Math.round((reviewed / candidates.length) * 100) : 0;
  const matched = candidates.length > 0;
  const percent = Math.max(uploadPercent, matched ? Math.max(35, reviewPercent) : campaign?.requirement_id ? 20 : 5);
  return {
    percent: Math.min(100, percent),
    label: matched ? `${candidates.length} ranked candidates` : campaign?.requirement_id ? "Requirement ready" : "Campaign setup",
    description: matched
      ? "Review recommended candidates, shortlist the strongest profiles, and keep rejects tied to this campaign."
      : "Create or link criteria, then run matching against the company database and any campaign-specific uploads.",
    stages: [
      { label: "Criteria", value: campaign?.requirement_status ?? (campaign?.requirement_id ? "linked" : "missing"), done: Boolean(campaign?.requirement_id), active: !campaign?.requirement_id },
      { label: "Uploads", value: uploads.length ? `${completedUploads}/${totalUploaded} files` : "none yet", done: Boolean(totalUploaded && completedUploads >= totalUploaded), active: Boolean(totalUploaded && completedUploads < totalUploaded) },
      { label: "Ranked", value: `${candidates.length} candidates`, done: matched, active: Boolean(campaign?.requirement_id && !matched) },
      { label: "Reviewed", value: `${reviewed}/${candidates.length || 0}`, done: Boolean(candidates.length && reviewed === candidates.length), active: Boolean(candidates.length && reviewed < candidates.length) },
    ],
  };
}

export function campaignTimelineItems(campaign: JobCampaign | null, candidates: JobCampaignCandidate[]) {
  if (!campaign) return [];
  const events: Array<{ id: string; title: string; body: string; date?: string | null }> = [];
  events.push({
    id: `${campaign.id}-created`,
    title: "Campaign created",
    body: campaign.requirement_id ? "Requirement profile linked for matching." : "Campaign shell created; add criteria before ranking.",
    date: campaign.created_at,
  });
  for (const batch of campaign.upload_batches ?? []) {
    events.push({
      id: `${campaign.id}-batch-${batch.id}`,
      title: `Upload batch: ${batch.status}`,
      body: `${batch.completed_count}/${batch.total_files} resumes processed, ${batch.failed_count} failed.`,
      date: batch.updated_at,
    });
  }
  for (const item of candidates) {
    const activityEvents = item.activity_events ?? [];
    for (const event of activityEvents) {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-activity-${event.id}`,
        title: `${item.candidate?.name ?? item.candidate_id}: ${event.title}`,
        body: event.body || "No note added.",
        date: event.created_at,
      });
    }
    if (!activityEvents.length && (item.status === "shortlisted" || item.status === "rejected")) {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-${item.status}`,
        title: item.status === "shortlisted" ? "Candidate shortlisted" : "Candidate rejected",
        body: item.candidate?.name ?? item.candidate_id,
        date: item.updated_at,
      });
    } else if (item.source === "matched") {
      events.push({
        id: `${campaign.id}-${item.candidate_id}-matched`,
        title: "Candidate ranked",
        body: `${item.candidate?.name ?? item.candidate_id} scored ${Math.round((item.score ?? 0) * 100)}%.`,
        date: item.updated_at,
      });
    }
  }
  events.push({
    id: `${campaign.id}-updated`,
    title: "Campaign updated",
    body: `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} currently attached.`,
    date: campaign.updated_at,
  });
  return events
    .filter((event) => event.date || event.title)
    .sort((left, right) => new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime());
}
