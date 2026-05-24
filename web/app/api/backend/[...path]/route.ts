import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_HEADER_ALLOWLIST = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "user-agent",
  "x-request-id",
]);

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

async function proxyToBackend(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).map(encodeURIComponent).join("/");
  const incomingUrl = new URL(request.url);
  const target = `${backendBase()}/${path}${incomingUrl.search}`;
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(normalized) && FORWARDED_HEADER_ALLOWLIST.has(normalized)) headers.set(key, value);
  });
  if (!headers.has("authorization")) {
    const sessionToken = betterAuthSessionToken(request);
    if (sessionToken) headers.set("authorization", `Bearer ${sessionToken}`);
  }
  headers.set("x-request-id", requestId);
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const controller = new AbortController();
  const timeoutMs = proxyTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({
      detail: aborted ? "Backend request timed out. Try again or check worker/API status." : "Backend request failed. Check API health.",
      code: aborted ? "backend_timeout" : "backend_unreachable",
      retryable: true,
      request_id: requestId,
    }, {
      status: aborted ? 504 : 502,
      headers: { "x-request-id": requestId },
    });
  } finally {
    clearTimeout(timeout);
  }
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.set("x-request-id", requestId);
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function betterAuthSessionToken(request: NextRequest) {
  const exact = request.cookies.get("better-auth.session_token")?.value || request.cookies.get("better-auth-session_token")?.value;
  if (exact) return exact;
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.endsWith("session_token") && cookie.name.includes("better-auth")) return cookie.value;
  }
  return "";
}

function backendBase() {
  const configured = process.env.SERVER_API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  return "http://127.0.0.1:8010";
}

function proxyTimeoutMs() {
  const configured = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || "");
  return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
}
