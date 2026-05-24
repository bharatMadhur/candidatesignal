import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COOKIE_NAME = "candidate_signal_staging_gate";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function POST(request: NextRequest) {
  if (!stagingGateEnabled(request)) {
    return NextResponse.redirect(publicUrl("/", request), 303);
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? "/"));
  if (!verifyPassword(password)) {
    const url = publicUrl("/staging-gate", request);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(publicUrl(next, request), 303);
  response.cookies.set(cookieName(), cookieValue(), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds(),
  });
  return response;
}

function stagingGateEnabled(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase();
  return process.env.NEXT_PUBLIC_DEPLOY_ENV === "staging" || host.startsWith("staging.");
}

function verifyPassword(password: string) {
  const configuredPassword = process.env.STAGING_GATE_PASSWORD;
  if (configuredPassword) return timingSafeTextEqual(password, configuredPassword);
  const configuredHash = process.env.STAGING_GATE_PASSWORD_HASH;
  if (!configuredHash) return false;
  return timingSafeTextEqual(sha256(password), configuredHash);
}

function cookieValue() {
  const secret = process.env.STAGING_GATE_PASSWORD_HASH || sha256(process.env.STAGING_GATE_PASSWORD || "");
  return sha256(`candidate-signal-staging-gate:${secret}`);
}

function cookieName() {
  return process.env.STAGING_GATE_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

function maxAgeSeconds() {
  const configured = Number(process.env.STAGING_GATE_MAX_AGE_SECONDS || "");
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_AGE_SECONDS;
}

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/staging-gate")) return "/";
  return value;
}

function publicUrl(path: string, request: NextRequest) {
  return new URL(path, publicOrigin(request));
}

function publicOrigin(request: NextRequest) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const configuredOrigin = process.env.BETTER_AUTH_URL || process.env.RESUME_INTEL_APP_BASE_URL;
  if (configuredOrigin?.startsWith("http://") || configuredOrigin?.startsWith("https://")) {
    return configuredOrigin;
  }

  return request.nextUrl.origin;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
