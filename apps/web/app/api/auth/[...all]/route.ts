import { checkBotId } from "botid/server";
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  return handler.POST(request);
}
