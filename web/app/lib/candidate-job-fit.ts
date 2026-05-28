import type { CandidateSelfMatch } from "../../lib/api";

export function inferTargetRoleFromRequirement(requirementText: string) {
  const lines = requirementText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const explicit = lines.find((line) => /^(role|job title|title|position)\s*:/i.test(line));
  if (explicit) return explicit.replace(/^(role|job title|title|position)\s*:/i, "").trim().slice(0, 80);
  const heading = lines.find((line) => line.length <= 80 && /(engineer|developer|analyst|manager|designer|architect|consultant|scientist|specialist|lead)/i.test(line));
  if (heading) return heading.replace(/^job\s*/i, "").trim().slice(0, 80);
  return "";
}

export function candidateJobEditPlan(match: CandidateSelfMatch | null, targetRole: string) {
  if (!match) return [];
  const matched = match.matched_terms.slice(0, 8).join(", ") || "No strong matched terms yet.";
  const missing = match.missing_or_unclear_terms.slice(0, 8).join(", ") || "No major gaps detected.";
  const skills = match.skill_hits.slice(0, 8).join(", ") || matched;
  return [
    {
      title: "Fit read",
      body: match.summary || `This version scored ${match.score}% for the role. Use this as a decision aid, not a reason to invent missing details.`,
    },
    {
      title: "Positioning",
      body: targetRole
        ? `Create a version that clearly targets ${targetRole}. The summary and headline should mention the role only if the resume evidence supports it.`
        : "Add a target role before creating the version so the export has a clear direction.",
    },
    {
      title: "Evidence to emphasize",
      body: `Bring these signals higher in the resume where they are factual: ${matched}.`,
    },
    {
      title: "Missing or unclear keywords",
      body: `Verify these before adding them: ${missing}. If they are not true, keep them out and prepare an interview answer instead.`,
    },
    {
      title: "ATS keyword focus",
      body: `The strongest skill overlap is: ${skills}. Use the editor to sharpen bullets around these skills before export.`,
    },
    {
      title: "What not to fake",
      body: "Do not add tools, years, locations, certifications, or employers unless they are true. Mark unclear items as questions to verify.",
    },
  ];
}
