import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out users (Next 16 `proxy` convention). NOT an authorization boundary —
 * it only checks that a session cookie is present, never that it is valid.
 * Every page, action and route handler calls `requireWorkspace()` itself.
 *
 * The matcher is an allowlist, so adding a public route never requires
 * remembering to exempt it here.
 */
export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (getSessionCookie(request)) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const url = new URL("/sign-in", request.url);
  url.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(url);
}

// No `runtime` key: a Proxy file always runs on Node, and Next rejects route
// segment config here. That is what this file is for — as `middleware.ts` it
// built as an Edge Function, which `withEve()` cannot deploy ("Service 'eve'
// produced Edge Function output '_middleware'").
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/clients/:path*",
    "/issuers/:path*",
    "/settings/:path*",
    "/welcome",
    "/welcome/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
