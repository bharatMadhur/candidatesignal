import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COOKIE_NAME = "candidate_signal_staging_gate";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function POST(request: NextRequest) {
  if (!stagingGateEnabled(request)) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? "/"));
  if (!verifyPassword(password)) {
    const url = new URL("/staging-gate", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
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

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
