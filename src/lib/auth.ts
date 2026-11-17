import { getIronSession, type IronSession } from "iron-session";
import { cookies, headers } from "next/headers";

export interface SessionData {
  userId?: string;
  email?: string;
}

const COOKIE_NAME = "clipmvp_session";

function sessionOptions() {
  const password = process.env.SESSION_SECRET || "";
  if (password.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return {
    password,
    cookieName: COOKIE_NAME,
    ttl: 60 * 60 * 24 * 7, // 7-day sessions for a 2-user household dashboard
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

/** The single shared workspace both people write to. */
export const WORKSPACE_USER_ID = "household";

/**
 * Local-only auth bypass, for the owner's own machine.
 *
 * `LOCAL_AUTH_BYPASS=1` skips the access code on loopback. Three guards keep it
 * from ever weakening the deployed app:
 *
 *  1. `process.env.VERCEL` short-circuits to `false`, so a Vercel deploy is
 *     always gated even if the flag is copied into its env vars by mistake.
 *  2. Both the middleware and `requireUser()` require a loopback hostname, so
 *     routes excluded from middleware still ask for the code on the LAN.
 *  3. It never widens the API boundary: `requireUser()` returns the same
 *     workspace id the access-code login does, so local writes land in the same
 *     rows the hosted app reads. Skipping the login screen is not the same as
 *     skipping the user.
 */
export function authBypassActive(): boolean {
  if (process.env.VERCEL) return false;
  return process.env.LOCAL_AUTH_BYPASS === "1";
}

/** True for localhost / 127.0.0.1 / ::1 only. */
export function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function appPassword(): string {
  return process.env.APP_PASSWORD || "";
}

/** Server-side gate for protected API routes. Returns the user or a 401 Response. */
export async function requireUser(): Promise<{ userId: string; email?: string } | Response> {
  // 1. Session cookie (dashboard login).
  try {
    const session = await getSession();
    if (session.userId) return { userId: session.userId, email: session.email };
  } catch {
    // Fall through to bearer check (e.g. misconfigured secret -> deny below).
  }
  // 2. Local-only bypass. Same workspace id the access code resolves to, so a
  //    local session writes to the exact rows the hosted app reads.
  if (authBypassActive()) {
    const rawHost = (await headers()).get("host") || "";
    const host = rawHost.startsWith("[")
      ? rawHost.slice(0, rawHost.indexOf("]") + 1)
      : rawHost.split(":")[0];
    if (isLoopbackHost(host)) return { userId: WORKSPACE_USER_ID };
  }
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** Verify the shared gate password with a timing-safe comparison. */
export function verifyAppPassword(candidate: string): boolean {
  const expected = appPassword();
  if (!expected || !candidate) return false;
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}
