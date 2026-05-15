import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? readParentEnv("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Better Auth");
}

const betterAuthSecret = resolveBetterAuthSecret();

export const auth = betterAuth({
  database: new Pool({ connectionString: databaseUrl }),
  secret: betterAuthSecret,
  baseURL: process.env.BETTER_AUTH_URL ?? readParentEnv("BETTER_AUTH_URL") ?? "http://127.0.0.1:3001",
  trustedOrigins: resolveTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password: {
      hash: async (password: string) => hashPassword(password),
      verify: async ({ hash, password }: { hash: string; password: string }) => verifyPassword(password, hash),
    },
  },
  plugins: [bearer()],
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
});

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.pbkdf2Sync(password, salt, 310_000, 32, "sha256");
  return `pbkdf2_sha256$310000$${salt.toString("base64")}$${digest.toString("base64")}`;
}

function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, saltB64, digestB64] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !saltB64 || !digestB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(digestB64, "base64");
  const actual = crypto.pbkdf2Sync(password, salt, Number(iterations), expected.length, "sha256");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function readParentEnv(key: string) {
  const envPath = path.resolve(process.cwd(), "..", ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

function resolveBetterAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET ?? readParentEnv("BETTER_AUTH_SECRET") ?? readSecretFile(process.env.BETTER_AUTH_SECRET_FILE);
  if (secret) return secret;
  if (isStrictProductionRuntime()) {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return "resume-intel-local-dev-secret-change-me";
}

function readSecretFile(filePath?: string) {
  if (!filePath) return undefined;
  try {
    return fs.readFileSync(filePath, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveTrustedOrigins() {
  const configured = process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? readParentEnv("BETTER_AUTH_TRUSTED_ORIGINS");
  const origins = [
    process.env.BETTER_AUTH_URL ?? readParentEnv("BETTER_AUTH_URL") ?? "http://127.0.0.1:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    ...(configured ? configured.split(",") : []),
  ];
  return Array.from(new Set(origins.map((origin) => origin.trim()).filter(Boolean)));
}

function isStrictProductionRuntime() {
  const env = process.env.RESUME_INTEL_ENV ?? process.env.APP_ENV;
  if (env === "production" || env === "prod") return true;
  const authUrl = process.env.BETTER_AUTH_URL ?? readParentEnv("BETTER_AUTH_URL");
  return Boolean(authUrl && !authUrl.includes("localhost") && !authUrl.includes("127.0.0.1"));
}
