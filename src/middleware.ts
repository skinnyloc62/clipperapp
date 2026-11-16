import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/auth";

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

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

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
