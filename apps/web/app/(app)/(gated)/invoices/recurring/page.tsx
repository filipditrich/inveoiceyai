import {
  RecurringEmpty,
  RecurringTable,
} from "@/components/invoices/recurring-table";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import { and, eq, sql } from "drizzle-orm";
import { Repeat2Icon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { listRecurring } from "@invoicey/invoice-tools/ops";

import type { AppLocale } from "@/i18n/config";

type Search = Promise<{ invalid?: string }>;

export default async function RecurringInvoicesPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const t = await getTranslations("Recurring");
  const tErrors = await getTranslations("Errors.invalid");
  const locale = (await getLocale()) as AppLocale;
  const sp = await searchParams;
  const { workspaceId } = await requireWorkspace();
  const items = await listRecurring({ workspaceId });
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(eq(invoices.workspaceId, workspaceId)));
  const hasInvoices = (countRow?.n ?? 0) > 0;
  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        description={t("list.subtitle")}
        icon={<Repeat2Icon />}
        title={t("list.title")}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {items.length === 0 ? (
        <RecurringEmpty hasInvoices={hasInvoices} />
      ) : (
        <RecurringTable items={items} locale={locale} />
      )}
    </div>
  );
}
