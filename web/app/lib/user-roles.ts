import type { CurrentUser } from "../../lib/api";

export function isPlatformAdmin(user: CurrentUser | null) {
  return user?.platform_role === "platform_admin" || user?.platform_role === "admin" || user?.role === "platform_admin" || user?.role === "admin";
}

export function isCandidateUser(user: CurrentUser | null) {
  return user?.workspace_access === "candidate" || user?.platform_role === "candidate" || user?.role === "candidate";
}

export function isTenantAdmin(user: CurrentUser | null) {
  return ["tenant_owner", "tenant_admin"].includes(user?.tenant_role ?? "");
}
