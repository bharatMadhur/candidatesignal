const LOCAL_LOGIN_ALIASES: Record<string, string> = {
  admin: "admin@example.com",
  platform: "admin@example.com",
  platform_admin: "admin@example.com",
  recruiter: "recruiter@example.com",
  company: "recruiter@example.com",
  tenant: "recruiter@example.com",
  candidate: "candidate@example.com",
  applicant: "candidate@example.com",
  student: "candidate@example.com",
};

export const DOCUMENT_FILE_ACCEPT = ".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp";
export const DOCUMENT_FORMAT_LABEL = "PDF, DOCX, TXT, MD, JPG, PNG, WEBP, TIFF, BMP";

export function resolveLoginIdentifier(value: string, mode: "company" | "admin" | "candidate") {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error("Enter an email or username.");
  if (normalized.includes("@")) return normalized;
  const mapped = LOCAL_LOGIN_ALIASES[normalized];
  if (mapped) return mapped;
  const expected = mode === "admin" ? "admin" : mode === "candidate" ? "candidate" : "recruiter";
  throw new Error(`Unknown username. Use a full email address or local username "${expected}".`);
}
