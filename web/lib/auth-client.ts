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
