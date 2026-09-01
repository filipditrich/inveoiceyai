import { IssuersDataGrid } from "@/components/issuers/issuers-data-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import { desc, eq } from "drizzle-orm";
import { BriefcaseBusinessIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  IssuerSnapshotSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

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
  const [t, tErrors, sp, { workspaceId }] = await Promise.all([
    getTranslations("Issuers"),
    getTranslations("Errors.invalid"),
    searchParams,
    requireWorkspace(),
  ]);
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
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button render={<Link href="/issuers/new" prefetch />} size="sm">
            {t("newButton")}
          </Button>
        }
        description={t("subtitle")}
        icon={<BriefcaseBusinessIcon />}
        title={t("title")}
      />

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{t("empty")}</p>
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
