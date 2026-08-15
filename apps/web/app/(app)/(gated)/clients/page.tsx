import { mergeClientsAction } from "@/actions/clients";
import { ClientsDataGrid } from "@/components/clients/clients-data-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import {
  ClientSnapshotSchema,
  type ClientSnapshot,
} from "@invoicey/invoice-core/schema";
import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ContactRoundIcon } from "lucide-react";

type Search = Promise<{ invalid?: string }>;

type ClientTableItem = {
  rowId: string;
  source: string;
  snapshot: ClientSnapshot;
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const [t, tErrors, sp, { workspaceId }] = await Promise.all([
    getTranslations("Clients"),
    getTranslations("Errors.invalid"),
    searchParams,
    requireWorkspace(),
  ]);
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.workspaceId, workspaceId))
    .orderBy(desc(clients.updatedAt));

  const items: ClientTableItem[] = [];
  for (const r of rows) {
    const parsed = ClientSnapshotSchema.safeParse(r.snapshot);
    if (!parsed.success) {
      continue;
    }
    items.push({
      rowId: r.id,
      source: r.source,
      snapshot: parsed.data,
    });
  }

  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        actions={
          <>
            <form action={mergeClientsAction}>
              <Button size="sm" type="submit" variant="outline">
                {t("mergeDuplicates")}
              </Button>
            </form>
            <Button render={<Link href="/clients/new" prefetch />} size="sm">
              {t("newButton")}
            </Button>
          </>
        }
        description={t("subtitle")}
        icon={<ContactRoundIcon />}
        title={t("title")}
      />
      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground mb-3 text-sm">{t("empty")}</p>
          <Button render={<Link href="/clients/new" prefetch />} size="sm">
            {t("createFirst")}
          </Button>
        </div>
      ) : (
        <ClientsDataGrid items={items} />
      )}
    </div>
  );
}
