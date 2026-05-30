export function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Action failed");
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? JSON.stringify(item)).join("; ");
  } catch {
    // Fall through to normalized raw text.
  }
  if (raw === "Failed to fetch") return "Cannot reach the backend. Check that the API is running on 127.0.0.1:8010.";
  if (raw.includes("Login did not return a session")) return "Login succeeded but the session could not be restored. Refresh the page and try again.";
  return raw;
}
