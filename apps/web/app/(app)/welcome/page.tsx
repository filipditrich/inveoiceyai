import { IssuerWelcomeWizard } from "@/components/issuers/issuer-welcome-wizard";
import { requireWorkspace } from "@/lib/auth/session";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

type Search = Promise<{ invalid?: string; done?: string }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { workspaceId } = await requireWorkspace();
  const sp = await searchParams;

  if (sp.done) {
    return (
      <div className="px-4 py-10 lg:px-6">
        <IssuerWelcomeWizard
          doneIssuerId={sp.done}
          invalidQuery={sp.invalid ?? null}
        />
      </div>
    );
  }

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  if ((countRow[0]?.count ?? 0) > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="px-4 py-10 lg:px-6">
      <IssuerWelcomeWizard invalidQuery={sp.invalid ?? null} />
    </div>
  );
}
