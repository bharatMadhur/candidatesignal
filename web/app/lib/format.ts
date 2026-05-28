export function domainLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function humanizeLabel(value: string) {
  return value.split("_").map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(" ");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

export function formatBytes(value?: number | null) {
  if (!value) return "Not recorded";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortHash(value?: string | null) {
  if (!value) return "missing";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

export function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return String(item ?? "");
      const objectItem = item as Record<string, unknown>;
      const preferred = objectItem.role ?? objectItem.note ?? objectItem.title ?? objectItem.summary ?? objectItem.name ?? objectItem.label;
      if (typeof preferred === "string") return preferred;
      return JSON.stringify(objectItem);
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueTextList(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function splitCommaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
