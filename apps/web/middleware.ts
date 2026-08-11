import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out users. NOT an authorization boundary —
 * it only checks that a session cookie is present, never that it is valid.
 * Every page, action and route handler calls `requireWorkspace()` itself.
 *
 * The matcher is an allowlist, so adding a public route never requires
 * remembering to exempt it here.
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  const url = new URL("/sign-in", request.url);
  url.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/clients/:path*",
    "/issuers/:path*",
    "/settings/:path*",
  ],
};
