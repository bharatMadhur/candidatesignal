import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
  },
});

export async function signInWithBetterAuth(email: string, password: string): Promise<{ token: string; user?: unknown }> {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => null) as { error?: { message?: string } | string; message?: string; user?: unknown } | null;
  if (!response.ok || data?.error) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message ?? data?.message ?? "Better Auth login failed";
    throw new Error(message);
  }
  const authToken = response.headers.get("set-auth-token") || "";
  return { token: authToken, user: data?.user };
}

export async function signInCandidateWithGoogle(): Promise<void> {
  const origin = window.location.origin;
  const callbackURL = `${origin}/?login=candidate&candidate_oauth=1`;
  const newUserCallbackURL = `${origin}/?login=candidate&candidate_oauth=1&new=1`;
  const errorCallbackURL = `${origin}/?login=candidate&candidate_oauth_error=1`;
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      provider: "google",
      callbackURL,
      newUserCallbackURL,
      errorCallbackURL,
      requestSignUp: true,
      disableRedirect: true,
      additionalData: { workspace_access: "candidate" },
    }),
  });
  const data = await response.json().catch(() => null) as { url?: string; error?: { message?: string } | string; message?: string } | null;
  if (!response.ok || data?.error || !data?.url) {
    const message = typeof data?.error === "string"
      ? data.error
      : data?.error?.message ?? data?.message ?? "Google login is not configured yet.";
    throw new Error(message);
  }
  window.location.assign(data.url);
}
