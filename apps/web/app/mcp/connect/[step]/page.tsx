import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { oauthQuery } from "@/lib/mcp/oauth-query";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { approveConnection, continueConnection } from "../actions";

export const metadata = { robots: { index: false, follow: false } };
export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { step } = await params;
  const query = await searchParams;
  const search = oauthQuery(query);
  const t = await getTranslations("McpConnect");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/mcp/connect/${step}?${search}`)}`,
    );
  const workspaces = await listUserWorkspaces(session.user.id);
  if (!workspaces.length) redirect("/onboarding");
  const clientId = search.get("client_id");
  const client = clientId
    ? await auth.api
        .getOAuthClientPublic({
          headers: await headers(),
          query: { client_id: clientId },
        })
        .catch(() => null)
    : null;
  const consent = step === "consent";
  const scopes = (search.get("scope") ?? "").split(" ");
  return (
    <AuthShell>
      <section className="rounded-3xl border bg-card p-7 sm:p-8">
        <p className="text-sm text-muted-foreground">
          Invoicey · {z.string().catch(t("application")).parse(client?.name)}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {t(consent ? "title" : "continueTitle")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(consent ? "description" : "continueDescription")}
        </p>
        <form
          action={consent ? approveConnection : continueConnection}
          className="mt-6 space-y-5"
        >
          <input type="hidden" name="oauthQuery" value={search.toString()} />
          {consent && (
            <>
              <label className="grid gap-2 text-sm font-medium">
                {t("workspace")}
                <select
                  name="workspaceId"
                  defaultValue={
                    session.session.activeOrganizationId ?? workspaces[0].id
                  }
                  className="h-11 rounded-xl border bg-background px-3"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <ul className="space-y-3 rounded-2xl bg-muted p-4 text-sm">
                {scopes.includes("invoicey:read") && <li>{t("read")}</li>}
                {scopes.includes("invoicey:write") && <li>{t("write")}</li>}
                {scopes.includes("offline_access") && <li>{t("offline")}</li>}
              </ul>
              <p className="text-xs text-muted-foreground">{t("revokeNote")}</p>
            </>
          )}
          <div className="flex gap-3">
            {consent && (
              <Button
                type="submit"
                variant="outline"
                name="decision"
                value="deny"
              >
                {t("deny")}
              </Button>
            )}
            <Button
              type="submit"
              name="decision"
              value="allow"
              className="flex-1"
            >
              {t(consent ? "allow" : "continue")}
            </Button>
          </div>
        </form>
      </section>
    </AuthShell>
  );
}
