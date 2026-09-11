import { IssuerWelcomeWizard } from "@/components/issuers/issuer-welcome-wizard";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import {
  welcomeDoneIssuerId,
  welcomeMigrateRequested,
} from "@/lib/issuer-welcome-query";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";

type Search = Promise<{ invalid?: string; done?: string; migrate?: string }>;

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
      <IssuerWelcomeWizard
        doneIssuerId={issuer?.id ?? null}
        invalidQuery={sp.invalid ?? (issuer ? null : "not_found")}
        showMigrate={welcomeMigrateRequested(sp.migrate)}
        workspaceId={workspaceId}
        {...workspaceProps}
      />
    );
  }

  if ((countRow[0]?.count ?? 0) > 0) {
    redirect("/dashboard");
  }

  return (
    <IssuerWelcomeWizard
      invalidQuery={sp.invalid ?? null}
      workspaceId={workspaceId}
      {...workspaceProps}
    />
  );
}
