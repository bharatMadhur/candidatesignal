import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  fetchOptions: {
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken && typeof window !== "undefined") {
        window.localStorage.setItem("resume-intel-token", authToken);
      }
    },
    auth: {
      type: "Bearer",
      token: () => {
        if (typeof window === "undefined") return "";
        return window.localStorage.getItem("resume-intel-token") || "";
      },
    },
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
  const authToken = response.headers.get("set-auth-token");
  if (!authToken) {
    throw new Error("Better Auth did not return a signed bearer token");
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem("resume-intel-token", authToken);
  }
  return { token: authToken, user: data?.user };
}
