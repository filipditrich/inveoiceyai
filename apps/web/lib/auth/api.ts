import "server-only";
import { NextResponse } from "next/server";

import { getOptionalWorkspace, type WorkspaceContext } from "./session";

/**
 * Workspace gate for route handlers.
 *
 * `requireWorkspace()` redirects, which is right for pages but wrong for an
 * API. This returns the context, or a `Response` the caller should return as
 * is: a redirect for browser navigations (these are reached via `<a download>`,
 * so landing on raw JSON would be confusing) and 401 JSON for everything else.
 */
export async function requireWorkspaceForRoute(
  request: Request,
): Promise<{ context: WorkspaceContext } | { response: Response }> {
  const context = await getOptionalWorkspace();
  if (context) {
    return { context };
  }

  const wantsHtml = request.headers.get("accept")?.includes("text/html");
  if (wantsHtml) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", new URL(request.url).pathname);
    return { response: NextResponse.redirect(url) };
  }

  return {
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  };
}
