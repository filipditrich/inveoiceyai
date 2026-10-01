"use server";
import { auth } from "@/lib/auth/auth";
import { requireSession } from "@/lib/auth/session";
import { requireMcpWorkspace } from "@/lib/mcp/membership";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";

export async function approveConnection(form: FormData) {
  const user = await requireSession();
  const workspaceId = await requireMcpWorkspace(
    user.id,
    z.string().parse(form.get("workspaceId")),
  );
  const requestHeaders = await headers();
  const oauthQuery = z.string().parse(form.get("oauthQuery"));
  const accept = form.get("decision") === "allow";
  const result = await runWithInvoiceyContext(
    { userId: user.id, workspaceId },
    () =>
      auth.api.oauth2Consent({
        headers: requestHeaders,
        body: { accept, oauth_query: oauthQuery },
      }),
  );
  if (result.url) redirect(result.url);
}
export async function continueConnection(form: FormData) {
  await requireSession();
  const result = await auth.api.oauth2Continue({
    headers: await headers(),
    body: {
      selected: true,
      oauth_query: z.string().parse(form.get("oauthQuery")),
    },
  });
  if (result.url) redirect(result.url);
}
