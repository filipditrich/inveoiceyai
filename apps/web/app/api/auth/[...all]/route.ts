import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { checkBotId } from "botid/server";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

// OAuth clients run on servers and cannot supply a browser BotID token.
// Better Auth still enforces protocol validation, client auth and rate limits.
const machineOAuthPaths = new Set([
  "/api/auth/oauth2/register",
  "/api/auth/oauth2/token",
  "/api/auth/oauth2/introspect",
  "/api/auth/oauth2/revoke",
]);

export async function POST(request: Request) {
  if (machineOAuthPaths.has(new URL(request.url).pathname)) {
    return handler.POST(request);
  }
  const verification = await checkBotId();
  if (verification.isBot) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  return handler.POST(request);
}
