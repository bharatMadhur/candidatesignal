import { NextRequest, NextResponse } from "next/server";

const DEFAULT_COOKIE_NAME = "candidate_signal_staging_gate";

export async function proxy(request: NextRequest) {
  if (!stagingGateEnabled(request) || isGateBypassPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expected = await expectedCookieValue();
  if (!expected) {
    return new NextResponse("Staging gate is not configured.", { status: 503 });
  }

  const actual = request.cookies.get(cookieName())?.value;
  if (actual === expected) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "staging gate required" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/staging-gate";
  url.search = "";
  url.searchParams.set("next", nextPath || "/");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};

function stagingGateEnabled(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase();
  return process.env.NEXT_PUBLIC_DEPLOY_ENV === "staging" || host.startsWith("staging.");
}

function isGateBypassPath(pathname: string) {
  return pathname === "/staging-gate" || pathname.startsWith("/api/staging-gate") || pathname.startsWith("/healthz");
}

function cookieName() {
  return process.env.STAGING_GATE_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

async function expectedCookieValue() {
  const secret = process.env.STAGING_GATE_PASSWORD_HASH || (process.env.STAGING_GATE_PASSWORD ? await sha256(process.env.STAGING_GATE_PASSWORD) : "");
  if (!secret) return "";
  return sha256(`candidate-signal-staging-gate:${secret}`);
}

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
