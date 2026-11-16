import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

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
