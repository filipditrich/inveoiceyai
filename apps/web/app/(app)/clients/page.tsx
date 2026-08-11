import { mergeClientsAction } from "@/actions/clients";
import { ClientsDataGrid } from "@/components/clients/clients-data-grid";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import {
  ClientSnapshotSchema,
  type ClientSnapshot,
} from "@invoicey/invoice-core/schema";
import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

type ClientTableItem = {
  rowId: string;
  source: string;
  snapshot: ClientSnapshot;
};

export default async function ClientsPage() {
  const { workspaceId } = await requireWorkspace();
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

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Customers — ARES lookup or manual entry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={mergeClientsAction}>
            <Button size="sm" type="submit" variant="outline">
              Sloučit duplicity
            </Button>
          </form>
          <Button render={<Link href="/clients/new" prefetch />} size="sm">
            New client
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground mb-3 text-sm">
            No clients yet. Add a customer via ARES or manually.
          </p>
          <Button render={<Link href="/clients/new" prefetch />} size="sm">
            Create your first client
          </Button>
        </div>
      ) : (
        <ClientsDataGrid items={items} />
      )}
    </div>
  );
}
