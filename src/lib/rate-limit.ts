/**
 * Failed-login throttling.
 *
 * The shared access code is short, so the login endpoint needs a brake: without
 * one, an attacker can walk the keyspace at whatever rate the network allows.
 * This is a sliding window over *failures only* — a correct code is never
 * delayed, and successes clear the counter so a fat-fingered evening doesn't
 * punish the real user.
 *
 * Scope and limits, stated plainly: the counters live in this process's memory.
 * On Vercel that means per-instance and per-cold-start, so it raises the cost of
 * brute force rather than making it impossible. A platform-level rule (Vercel
 * Firewall rate limiting, or a shared store such as Redis if the plan covers it)
 * is the durable backstop. Multi-user households behind one NAT share a bucket.
 */

/** Failures allowed inside one window before we start refusing. */
export const MAX_FAILURES = 5;
/** Window length in milliseconds. */
export const WINDOW_MS = 15 * 60 * 1000;
/** Hard ceiling on tracked keys so a spoofed-header flood can't grow memory. */
const MAX_TRACKED_KEYS = 5000;

const failures = new Map<string, number[]>();

/** Drop timestamps that have aged out; delete keys that no longer have any. */
function prune(now: number): void {
  for (const [key, stamps] of failures) {
    const live = stamps.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) failures.delete(key);
    else if (live.length !== stamps.length) failures.set(key, live);
  }
}

/**
 * Best-effort client identity. Vercel sets `x-forwarded-for`; the left-most
 * entry is the client. Falls back to a constant so the limiter still counts
 * total failures when headers are absent (local dev, direct-to-node requests).
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export interface ThrottleState {
  limited: boolean;
  /** Seconds until the oldest failure leaves the window. Only meaningful when limited. */
  retryAfterSec: number;
  /** Attempts left before the next failure is refused. 0 when limited. */
  remaining: number;
}

/** Read-only check — call before doing any credential work. */
export function checkThrottle(key: string, now = Date.now()): ThrottleState {
  const stamps = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length === 0) {
    failures.delete(key);
    return { limited: false, retryAfterSec: 0, remaining: MAX_FAILURES };
  }
  failures.set(key, stamps);
  if (stamps.length >= MAX_FAILURES) {
    const oldest = Math.min(...stamps);
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { limited: true, retryAfterSec, remaining: 0 };
  }
  return { limited: false, retryAfterSec: 0, remaining: MAX_FAILURES - stamps.length };
}

/** Record one failed attempt. */
export function noteFailure(key: string, now = Date.now()): void {
  if (failures.size > MAX_TRACKED_KEYS) prune(now);
  if (failures.size >= MAX_TRACKED_KEYS && !failures.has(key)) return; // shed load, never crash
  const stamps = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  stamps.push(now);
  failures.set(key, stamps);
}

/** Clear a key after a successful login. */
export function clearFailures(key: string): void {
  failures.delete(key);
}

/** Test seam — resets all state. Not used by the app. */
export function _resetThrottle(): void {
  failures.clear();
}
