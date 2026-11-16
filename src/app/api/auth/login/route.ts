export const runtime = "nodejs";

import { z } from "zod";
import { getSession, verifyAppPassword } from "@/lib/auth";
import { checkThrottle, clearFailures, clientKey, noteFailure } from "@/lib/rate-limit";
import { findUserByEmail, verifyPassword } from "@/lib/users";

/**
 * Two ways in:
 *
 *  1. Access code — `{ code }`. Matches APP_PASSWORD (timing-safe). No database
 *     needed, which is what makes the deployed app usable before a hosted
 *     Postgres is wired. Session is stored against a fixed household id.
 *  2. Workspace account — `{ email, password }`. The original per-user path:
 *     Prisma `User.passwordHash` when DATABASE_URL is set, `.data/users.json`
 *     locally. Kept intact so nothing that already worked stopped working.
 *
 * Both paths are throttled per client IP — see `@/lib/rate-limit`. A 6-digit
 * code without a brake is a very short walk for a script.
 */

/** Stable id for code-based sessions. Not a database row — a session identity. */
const HOUSEHOLD_USER_ID = "household";

const codeSchema = z.object({ code: z.string().min(1).max(256) });
const accountSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request): Promise<Response> {
  // Throttle first: refuse before spending work on a body or a hash comparison.
  // Counted per client IP, on failures across both paths.
  const attemptKey = clientKey(req);
  const throttle = checkThrottle(attemptKey);
  if (throttle.limited) {
    return Response.json(
      { error: "too many attempts", retryAfterSec: throttle.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSec) } },
    );
  }

  const reject = (body: unknown, status: number): Response => {
    noteFailure(attemptKey);
    return Response.json(body, { status });
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reject({ error: "expected JSON {code} or {email, password}" }, 400);
  }

  // ── Path 1: shared access code ──────────────────────────────
  const asCode = codeSchema.safeParse(body);
  if (asCode.success) {
    if (!verifyAppPassword(asCode.data.code)) {
      return reject({ error: "invalid access code" }, 401);
    }
    try {
      const session = await getSession();
      session.userId = HOUSEHOLD_USER_ID;
      await session.save();
      clearFailures(attemptKey);
      return Response.json({ ok: true, userId: HOUSEHOLD_USER_ID, mode: "access-code" });
    } catch {
      return Response.json(
        { error: "SESSION_SECRET is not configured on this deployment" },
        { status: 500 },
      );
    }
  }

  // ── Path 2: workspace account ───────────────────────────────
  const asAccount = accountSchema.safeParse(body);
  if (!asAccount.success) {
    return reject({ error: asAccount.error.flatten() }, 400);
  }
  const user = await findUserByEmail(asAccount.data.email);
  if (!user?.passwordHash || !verifyPassword(asAccount.data.password, user.passwordHash)) {
    return reject({ error: "invalid credentials" }, 401);
  }
  try {
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    await session.save();
  } catch {
    return Response.json(
      { error: "SESSION_SECRET is not configured on this deployment" },
      { status: 500 },
    );
  }
  clearFailures(attemptKey);
  return Response.json({ ok: true, userId: user.id, email: user.email, mode: "account" });
}
