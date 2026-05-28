import type { Candidate } from "../../lib/api";
import { textValue, toTextList } from "./format";

type TimelineEventInput = {
  id?: string;
  title?: unknown;
  organization?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  relationship?: unknown;
  kind?: unknown;
  type?: unknown;
  overlaps_with?: unknown;
};

type TimelineRowInput = TimelineEventInput & {
  startIndex: number;
  endIndex: number;
};

export function candidateEducationRows(education: Candidate["education"]) {
  return (education ?? []).map((item) => ({
    school: textValue(item.school),
    degree: textValue(item.degree),
    field: textValue(item.field),
    location: textValue(item.location),
    start_date: textValue(item.start_date),
    end_date: textValue(item.end_date),
    details: toTextList(item.details ?? []),
  })).filter((item) => item.school || item.degree || item.field || item.location);
}

export function candidateEducationTimelineEvents(education: Candidate["education"]) {
  return candidateEducationRows(education)
    .filter((item) => item.start_date || item.end_date)
    .map((item, index) => ({
      id: `education-${item.school || item.degree || index}`,
      title: item.degree || item.field || "Education",
      organization: item.school,
      start_date: item.start_date || item.end_date,
      end_date: item.end_date || item.start_date,
      summary: [item.field, item.location, ...item.details.slice(0, 2)].filter(Boolean).join(" | "),
      relationship: "education",
      workstreams: [],
      overlaps_with: [],
    }));
}

export function educationDateLabel(item: { start_date?: string; end_date?: string }) {
  if (item.start_date && item.end_date && item.start_date !== item.end_date) return `${item.start_date} - ${item.end_date}`;
  if (item.end_date) return `Completed ${item.end_date}`;
  if (item.start_date) return `Started ${item.start_date}`;
  return "Dates not extracted";
}

export function timelineDateRangeLabel(item: { start_date?: string | null; end_date?: string | null }, isEducation: boolean) {
  const start = textValue(item.start_date);
  const end = textValue(item.end_date);
  if (isEducation && end && (!start || start === end)) return `Completed ${end}`;
  if (isEducation && start && !end) return `Started ${start}`;
  return `${start || "Unknown"} - ${end || (isEducation ? "Completed" : "Present")}`;
}

export function isEducationTimelineEvent(value: TimelineEventInput | null | undefined) {
  const relationship = String(value?.relationship ?? value?.kind ?? value?.type ?? "").toLowerCase();
  return relationship === "education" || relationship === "school" || relationship === "degree";
}

export function dedupeTimelineEvents<T extends TimelineEventInput>(events: T[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      isEducationTimelineEvent(event) ? "education" : "work",
      normalizeComparableText(event?.title),
      normalizeComparableText(event?.organization),
      String(event?.start_date ?? ""),
      String(event?.end_date ?? ""),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildTimelineRows<T extends TimelineEventInput>(events: T[]) {
  const dated = events
    .map((event) => ({ ...event, startIndex: timelineMonthIndex(event.start_date), endIndex: timelineMonthIndex(event.end_date || "Present") }))
    .filter((event): event is T & TimelineRowInput => typeof event.startIndex === "number" && typeof event.endIndex === "number");
  if (!dated.length) return [];
  const byId = new Map(dated.map((event) => [event.id, event]));
  const min = Math.min(...dated.map((event) => event.startIndex));
  const max = Math.max(...dated.map((event) => event.endIndex));
  const span = Math.max(1, max - min);
  return dated.map((event) => {
    const overlapIds = Array.isArray(event.overlaps_with) ? event.overlaps_with : [];
    const crossCompanyOverlap = overlapIds.some((id) => {
      const other = byId.get(String(id));
      return other && normalizeOrg(other.organization) !== normalizeOrg(event.organization);
    });
    return {
      ...event,
      crossCompanyOverlap,
      left: Math.max(0, ((event.startIndex - min) / span) * 100),
      width: Math.max(3, ((event.endIndex - event.startIndex) / span) * 100),
      minYear: Math.floor(min / 12),
      maxYear: Math.floor(max / 12),
    };
  });
}

export function timelineYearMarkers(rows: Array<{ minYear?: unknown; maxYear?: unknown }>) {
  const years = rows.flatMap((row) => [row.minYear, row.maxYear]).filter((value) => typeof value === "number") as number[];
  if (!years.length) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (max <= min) return [min];
  const span = max - min;
  const step = span > 10 ? 2 : 1;
  const markers: number[] = [];
  for (let year = min; year <= max; year += step) markers.push(year);
  if (markers[markers.length - 1] !== max) markers.push(max);
  return markers;
}

function timelineMonthIndex(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || ["present", "current", "now"].includes(text)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth() + 1;
  }
  const match = text.match(/(\d{4})(?:[-/](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] || 1);
  return year * 12 + Math.max(1, Math.min(12, month));
}

function normalizeOrg(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeComparableText(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
