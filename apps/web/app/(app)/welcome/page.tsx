import { IssuerWelcomeWizard } from "@/components/issuers/issuer-welcome-wizard";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { welcomeDoneIssuerId } from "@/lib/issuer-welcome-query";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";

type Search = Promise<{ invalid?: string; done?: string }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { workspaceId, userId } = await requireWorkspace();
  const sp = await searchParams;

  const workspaces = await listUserWorkspaces(userId);
  const activeWorkspace = workspaces.find((item) => item.id === workspaceId);
  const workspaceProps = {
    workspaceName: activeWorkspace?.name ?? "",
    workspaceLogo: activeWorkspace?.logo ?? null,
    uploadConfigured: Boolean(process.env.UPLOADTHING_TOKEN?.trim()),
  };

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  const doneIssuerId = welcomeDoneIssuerId(sp.done);
  if (sp.done) {
    const [issuer] = doneIssuerId
      ? await db
          .select({ id: issuerBusinesses.id })
          .from(issuerBusinesses)
          .where(
            and(
              eq(issuerBusinesses.id, doneIssuerId),
              eq(issuerBusinesses.workspaceId, workspaceId),
            ),
          )
          .limit(1)
      : [];
    if (!issuer && (countRow[0]?.count ?? 0) > 0) {
      redirect("/dashboard?invalid=not_found");
    }
    return (
      <div className="px-4 py-10 lg:px-6">
        <IssuerWelcomeWizard
          doneIssuerId={issuer?.id ?? null}
          invalidQuery={sp.invalid ?? (issuer ? null : "not_found")}
          workspaceId={workspaceId}
          {...workspaceProps}
        />
      </div>
    );
  }

  if ((countRow[0]?.count ?? 0) > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="px-4 py-10 lg:px-6">
      <IssuerWelcomeWizard
        invalidQuery={sp.invalid ?? null}
        workspaceId={workspaceId}
        {...workspaceProps}
      />
    </div>
  );
}
