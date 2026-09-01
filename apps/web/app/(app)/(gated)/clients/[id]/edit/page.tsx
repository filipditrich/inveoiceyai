import { deleteClient } from "@/actions/clients";
import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireWorkspace } from "@/lib/auth/session";
import { clientsAreManaged } from "@/lib/entitlements/managed-clients";
import { and, eq } from "drizzle-orm";
import { ContactRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";

type Search = Promise<{ invalid?: string }>;

type Params = Promise<{ id: string }>;

export default async function ClientEditPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  // A managed workspace has no client it may create or edit (ADR 0036). The
  // server actions refuse anyway, but a refused action only redirects — the
  // form would sit there doing nothing, which reads as a broken page.
  const { workspaceId: managedCheckWorkspaceId } = await requireWorkspace();
  if (await clientsAreManaged(managedCheckWorkspaceId)) {
    redirect("/clients");
  }

  const { id } = await params;
  const { workspaceId } = await requireWorkspace();
  const sp = await searchParams;
  const t = await getTranslations("Clients");
  const tCommon = await getTranslations("Common");

  const hit = await db
    .select()
    .from(clients)
    .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, id)))
    .limit(1);
  const row = hit[0];

  if (!row) {
    notFound();
  }

  const snap = ClientSnapshotSchema.safeParse(row.snapshot);
  if (!snap.success) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            render={<Link href="/clients" prefetch />}
            size="sm"
            variant="outline"
          >
            ← {tCommon("back")}
          </Button>
        }
        description={snap.data.name}
        icon={<ContactRoundIcon />}
        title={t("editTitle")}
      />
      <ClientEditorForm
        invalidQuery={sp.invalid ?? null}
        mode="edit"
        snapshot={snap.data}
      />

      <div className="rounded-md border border-destructive/40 p-4">
        <form
          action={deleteClient}
          className="flex flex-wrap items-center gap-3"
        >
          <input name="id" type="hidden" value={id} />
          <SubmitButton pendingLabel={t("deleting")} variant="destructive">
            {t("deleteClient")}
          </SubmitButton>
          <span className="text-sm text-muted-foreground">
            {t("deleteIrreversible")}
          </span>
        </form>
      </div>
    </div>
  );
}
