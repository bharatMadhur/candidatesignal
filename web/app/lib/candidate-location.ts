import { textValue } from "./format";
import { normalizeComparableText } from "./candidate-timeline";

export type CandidateLocationChip = {
  label: string;
  current: boolean;
};

export function candidateLocationChips(signals: unknown, currentLocation: string) {
  const chips: CandidateLocationChip[] = [];
  const seen = new Set<string>();
  const current = normalizeComparableText(currentLocation);
  if (currentLocation) addLocationChip(chips, seen, currentLocation, true);
  for (const signal of Array.isArray(signals) ? signals : []) {
    const label = locationSignalLabel(signal);
    if (!label) continue;
    const normalized = normalizeComparableText(label);
    const isCurrent = Boolean(current && (normalized.includes(current) || current.includes(normalized)));
    addLocationChip(chips, seen, label, isCurrent);
  }
  return chips.slice(0, 10);
}

function addLocationChip(chips: CandidateLocationChip[], seen: Set<string>, label: string, current: boolean) {
  const key = normalizeComparableText(label);
  if (!key) return;
  const existing = chips.find((item) => normalizeComparableText(item.label) === key);
  if (existing) {
    existing.current = existing.current || current;
    return;
  }
  if (seen.has(key)) return;
  seen.add(key);
  chips.push({ label, current });
}

function locationSignalLabel(signal: unknown) {
  if (typeof signal === "string") return signal;
  if (!signal || typeof signal !== "object") return "";
  const item = signal as Record<string, unknown>;
  const location = textValue(item.location ?? item.current_location ?? item.city);
  const region = textValue(item.region ?? item.state);
  const country = textValue(item.country ?? item.country_name);
  const combined = [location, region, country].filter(Boolean).join(", ");
  return combined || textValue(item.label ?? item.name ?? item.value);
}
