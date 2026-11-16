import { NextResponse, type NextRequest } from "next/server";
import { authBypassActive, isLoopbackHost, sessionCookieName } from "@/lib/auth";

/**
 * Login gate.
 *
 * NOTE: this file lives in `src/` on purpose. This app uses a `src/` directory,
 * and Next.js only reads `middleware.ts` from the root OR `src/` (never both).
 * For a long time this gate sat at the repo root where Next ignored it, so every
 * page was reachable without signing in. `src/middleware.ts` is the location that
 * actually runs.
 *
 * The cookie's presence is checked here for cheap redirects. Real verification
 * happens server-side: pages call getSession(), API routes call requireUser().
 */

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/** App pages that require a session. */
const PROTECTED_PAGES = ["/", "/clips", "/approvals", "/earnings", "/editor", "/radar", "/settings"];

/** Host header minus port and IPv6 brackets. */
function requestHost(req: NextRequest): string {
  const raw = req.headers.get("host") ?? req.nextUrl.hostname;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  return raw.split(":")[0];
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  /**
   * Local-only bypass for the owner's own machine (see authBypassActive).
   * Requires BOTH the flag and a loopback hostname, so a dev server shared over
   * the LAN still asks for the access code. /login redirects home instead of
   * rendering a gate that would be pointless here.
   */
  if (authBypassActive() && isLoopbackHost(requestHost(req))) {
    if (pathname === "/login") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const protectedPage = PROTECTED_PAGES.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
  const protectedApi = pathname.startsWith("/api/");

  if ((protectedPage || protectedApi) && !req.cookies.get(sessionCookieName())) {
    if (protectedPage) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The hosted site is a viewer. Cutting, monitoring, and settings live in
  // the Mac app; direct hosted page URLs must not imply they work on Vercel.
  if (process.env.VERCEL && protectedPage && pathname !== "/" && !pathname.startsWith("/clips")) {
    const url = req.nextUrl.clone();
    url.pathname = "/clips";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/clips/:path*",
    "/approvals/:path*",
    "/earnings/:path*",
    "/editor/:path*",
    "/radar/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
