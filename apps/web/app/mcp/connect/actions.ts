"use server";
import { auth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth/session";
import { requireMcpWorkspace } from "@/lib/mcp/membership";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";

const reconnect = "/mcp/connect/error";

function formString(form: FormData, name: string) {
  const result = z.string().min(1).safeParse(form.get(name));
  if (!result.success) redirect(reconnect);
  return result.data;
}

async function oauthRequest(endpoint: "consent" | "continue") {
  const requestHeaders = new Headers(await headers());
  // Better Auth requires a Request to resume authorization. Explicit JSON mode
  // gives this server action the callback URL instead of a provider Response.
  requestHeaders.set("accept", "application/json");
  return {
    headers: requestHeaders,
    asResponse: false as const,
    request: new Request(
      `${(await auth.$context).baseURL}/oauth2/${endpoint}`,
      {
        method: "POST",
        headers: requestHeaders,
      },
    ),
  };
}

async function connectionDestination(
  operation: () => Promise<{ url?: string }>,
) {
  try {
    return (await operation()).url ?? reconnect;
  } catch (error) {
    if (isAPIError(error) && error.statusCode >= 400 && error.statusCode < 500)
      return reconnect;
    throw error;
  }
}

export async function approveConnection(form: FormData) {
  const user = await requireSession();
  const oauthQuery = formString(form, "oauthQuery");
  const accept = form.get("decision") === "allow";
  const request = await oauthRequest("consent");
  const destination = await connectionDestination(async () => {
    const consent = () =>
      auth.api.oauth2Consent({
        ...request,
        body: { accept, oauth_query: oauthQuery },
      });
    if (!accept) return consent();
    const workspaceId = await requireMcpWorkspace(
      user.id,
      formString(form, "workspaceId"),
    );
    return runWithInvoiceyContext({ userId: user.id, workspaceId }, consent);
  });
  redirect(destination);
}

export async function continueConnection(form: FormData) {
  await requireSession();
  const oauthQuery = formString(form, "oauthQuery");
  const request = await oauthRequest("continue");
  const destination = await connectionDestination(() =>
    auth.api.oauth2Continue({
      ...request,
      body: { selected: true, oauth_query: oauthQuery },
    }),
  );
  redirect(destination);
}
