"use client";

import type { CandidatePortalProfile, CandidateResumeVersion } from "../../lib/api";
import { textValue, toTextList, uniqueTextList } from "../lib/format";
import { EmptyPanel } from "./primitives";

export function CandidateScratchBuilderGuide({
  busy,
  saveProfile,
  createVersion,
}: {
  busy: boolean;
  saveProfile: () => Promise<void>;
  createVersion: () => Promise<void>;
}) {
  const steps = [
    ["Identity", "Add name, contact, location, LinkedIn, GitHub, or portfolio only if you have them."],
    ["Direction", "Write the target role and a rough summary. The coach can tighten it after facts exist."],
    ["Evidence", "Add education, roles, projects, skills, certifications, publications, or references as needed."],
    ["Version", "Save the profile, then create a version for the first application."],
  ];
  return (
    <section className="candidateScratchGuide">
      <div>
        <span className="eyebrow">Start from scratch</span>
        <h2>No resume file needed.</h2>
        <p>Use the structured editor below as the source of truth. Add only facts you can defend, then create a resume version and export it.</p>
      </div>
      <ol>
        {steps.map(([title, body]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{body}</span>
          </li>
        ))}
      </ol>
      <div>
        <button className="primary" type="button" disabled={busy} onClick={saveProfile}>
          Save profile
        </button>
        <button className="secondary" type="button" disabled={busy} onClick={createVersion}>
          Save and create first version
        </button>
      </div>
    </section>
  );
}

export function CandidatePracticalJobBoard({
  profile,
  versions,
  selectedVersionId,
  setSelectedVersionId,
  setRequirementText,
}: {
  profile: CandidatePortalProfile["profile"];
  versions: CandidateResumeVersion[];
  selectedVersionId: string;
  setSelectedVersionId: (versionId: string) => void;
  setRequirementText: (value: string) => void;
}) {
  const cards = practicalJobCardsForCandidate(profile, versions);
  return (
    <section className="candidateJobBoardPanel">
      <div className="candidatePortalSectionHead">
        <div>
          <span className="eyebrow">Practical job board</span>
          <h2>Roles worth testing</h2>
          <p>These are not random jobs. They are practical targets inferred from the approved profile, skills, projects, and existing versions.</p>
        </div>
      </div>
      <div className="candidateJobCards">
        {cards.length ? (
          cards.map((card) => (
            <article key={card.role}>
              <div>
                <strong>{card.role}</strong>
                <span>{card.fit}</span>
              </div>
              <p>{card.reason}</p>
              <div className="nativeCandidateTags">
                {card.keywords.slice(0, 6).map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
              <footer>
                <small>{card.versionTitle || "Use any version"}</small>
                <button
                  className="secondary small"
                  type="button"
                  onClick={() => {
                    if (card.versionId && card.versionId !== selectedVersionId) setSelectedVersionId(card.versionId);
                    setRequirementText(card.requirementText);
                  }}
                >
                  Use as job brief
                </button>
              </footer>
            </article>
          ))
        ) : (
          <EmptyPanel title="No practical roles yet" body="Upload and parse a resume first. The job board should only show practical roles after the profile has evidence." />
        )}
      </div>
    </section>
  );
}

function practicalJobCardsForCandidate(profile: CandidatePortalProfile["profile"], versions: CandidateResumeVersion[]) {
  const enhancement = normalizedAiEnhancement(profile.ai_enhancement);
  const aiRoles = cvTextList(enhancement.best_fit_roles);
  const versionRoles = versions.map((version) => version.target_role || "").filter(Boolean);
  const headlineRoles = textValue(profile.headline)
    ? [textValue(profile.headline).replace(/\|/g, " ").split(",")[0]?.trim()].filter(Boolean)
    : [];
  const roles = uniqueTextList([...aiRoles, ...versionRoles, ...headlineRoles]).slice(0, 6);
  const skills = toTextList(profile.skills).slice(0, 12);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const latest = experience[0] ?? {};
  return roles.map((role) => {
    const roleNeedle = role.toLowerCase().split(" ")[0] || role.toLowerCase();
    const matchingVersion = versions.find((version) => (version.target_role || version.title || "").toLowerCase().includes(roleNeedle));
    const keywords = uniqueTextList([...skills, ...cvTextList(enhancement.search_keywords)]).slice(0, 8);
    return {
      role,
      versionId: matchingVersion?.id || versions[0]?.id || "",
      versionTitle: matchingVersion?.title || versions[0]?.title || "",
      fit: matchingVersion ? "Version exists" : "Create or tailor a version",
      reason: [
        latest.title && latest.company ? `Recent evidence includes ${latest.title} at ${latest.company}.` : "",
        skills.length ? `Core searchable skills include ${skills.slice(0, 5).join(", ")}.` : "",
        textValue(enhancement.profile_read || enhancement.career_narrative),
      ].filter(Boolean)[0] || "This role is inferred from the candidate profile. Verify against a real requirement before applying.",
      keywords,
      requirementText: [
        `Role: ${role}`,
        skills.length ? `Relevant skills to test: ${skills.slice(0, 10).join(", ")}` : "",
        latest.title || latest.company ? `Recent experience evidence: ${[latest.title, latest.company].filter(Boolean).join(" at ")}` : "",
        "Use this as a starting job brief. Paste the real requirement to get a better match.",
      ].filter(Boolean).join("\n"),
    };
  });
}

function normalizedAiEnhancement(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function cvTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return toTextList(value);
}
