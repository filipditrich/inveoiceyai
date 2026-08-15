import { deleteClient } from "@/actions/clients";
import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireWorkspace } from "@/lib/auth/session";
import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";
import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactRoundIcon } from "lucide-react";

type Search = Promise<{ invalid?: string }>;

type Params = Promise<{ id: string }>;

export default async function ClientEditPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
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
    <div className="space-y-6 px-4 py-6 lg:px-6">
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

      <div className="border-destructive/40 rounded-md border p-4">
        <form
          action={deleteClient}
          className="flex flex-wrap items-center gap-3"
        >
          <input name="id" type="hidden" value={id} />
          <SubmitButton pendingLabel={t("deleting")} variant="destructive">
            {t("deleteClient")}
          </SubmitButton>
          <span className="text-muted-foreground text-sm">
            {t("deleteIrreversible")}
          </span>
        </form>
      </div>
    </div>
  );
}
