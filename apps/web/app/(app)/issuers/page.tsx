import { IssuersDataGrid } from "@/components/issuers/issuers-data-grid";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import {
  IssuerSnapshotSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

type IssuerTableItem = {
  rowId: string;
  source: string;
  snapshot: IssuerSnapshot;
  isDefault: boolean;
};

type Search = Promise<{ invalid?: string }>;

export default async function IssuersPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const t = await getTranslations("Issuers");
  const tErrors = await getTranslations("Errors.invalid");
  const sp = await searchParams;
  const { workspaceId } = await requireWorkspace();
  const rows = await db
    .select()
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId))
    .orderBy(desc(issuerBusinesses.updatedAt));

  const items: IssuerTableItem[] = [];
  for (const r of rows) {
    const parsed = IssuerSnapshotSchema.safeParse(r.snapshot);
    if (!parsed.success) {
      continue;
    }
    items.push({
      rowId: r.id,
      source: r.source,
      snapshot: parsed.data,
      isDefault: r.isDefault,
    });
  }

  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button render={<Link href="/issuers/new" prefetch />} size="sm">
          {t("newButton")}
        </Button>
      </div>

      {err ? <p className="text-destructive text-sm">{err}</p> : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-muted-foreground mb-3 text-sm">{t("empty")}</p>
          <Button render={<Link href="/welcome" prefetch />} size="sm">
            {t("createFirst")}
          </Button>
        </div>
      ) : (
        <IssuersDataGrid items={items} />
      )}
    </div>
  );
}
