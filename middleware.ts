import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/**
 * Gate: dashboard pages and API routes require the session cookie.
 * Cookie presence is checked here for cheap redirects; every API route
 * re-verifies the sealed session server-side via requireUser().
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const protectedPage = pathname === "/" || pathname.startsWith("/clips") || pathname.startsWith("/brand");
  const protectedApi = pathname.startsWith("/api/");
  if ((protectedPage || protectedApi) && !req.cookies.get(sessionCookieName())) {
    if (protectedPage) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/clips/:path*", "/brand/:path*", "/api/:path*"],
};
