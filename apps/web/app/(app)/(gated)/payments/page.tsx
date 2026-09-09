import { syncBankConnectionsFromPayments } from "@/actions/payments";
import { PageHeader } from "@/components/layout/page-header";
import { SectionPager } from "@/components/layout/section-pager";
import { ManualPaymentDialog } from "@/components/payments/manual-payment-dialog";
import {
  PaymentsHistoryTable,
  PaymentsIncomingTable,
} from "@/components/payments/payments-ledger-tables";
import { PaymentsSuggestedTable } from "@/components/payments/payments-suggested-table";
import { Button } from "@/components/ui/button";
import { ProductToastTracker } from "@/features/c15t/product-toast-tracker";
import { isAppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan, can } from "@/lib/authz/can";
import { messageLookup } from "@/lib/i18n-lookup";
import { listActiveBankConnections } from "@/lib/payments/connections";
import { loadPaymentsRecon } from "@/lib/payments/load-payments-recon";
import { parseIncomingState, parsePage } from "@/lib/payments/page-query";
import { ArrowLeftRightIcon, RefreshCwIcon } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import type { AppLocale } from "@/i18n/config";

function todayPrague(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function visibleCount(sliceTo: number, total: number): number {
  return sliceTo === 0 ? 0 : total;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    toast?: string;
    incoming?: string;
    history?: string;
    matches?: string;
    incomingState?: string;
  }>;
}) {
  await assertCan("payments:read");
  const { workspaceId } = await requireWorkspace();
  const [canManagePayments, connections, t, tNav, localeValue, messages, sp] =
    await Promise.all([
      can("payments:manage"),
      listActiveBankConnections(workspaceId),
      getTranslations("Payments"),
      getTranslations("App.nav"),
      getLocale(),
      getMessages(),
      searchParams,
    ]);
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const incomingState = parseIncomingState(sp.incomingState);
  const query = {
    incoming: sp.incoming,
    history: sp.history,
    matches: sp.matches,
    incomingState: incomingState === "all" ? undefined : incomingState,
  };
  const recon = await loadPaymentsRecon(workspaceId, {
    incoming: parsePage(sp.incoming),
    history: parsePage(sp.history),
    matches: parsePage(sp.matches),
    incomingState,
  });
  /** SAFETY: Payments catalog leaves are string maps used with messageLookup. */
  const paymentCatalog = messages.Payments as {
    reasons: Record<string, string>;
    blockers: Record<string, string>;
    sources: Record<string, string>;
  };
  const hasBankConnection = canManagePayments && connections.length > 0;

  return (
    <div className="space-y-4">
      <ProductToastTracker toast={sp.toast ?? null} />
      <PageHeader
        actions={
          <>
            {hasBankConnection ? (
              <form action={syncBankConnectionsFromPayments}>
                <Button type="submit" variant="outline">
                  <RefreshCwIcon data-icon="inline-start" />
                  {t("syncNow")}
                </Button>
              </form>
            ) : null}
            {canManagePayments ? (
              <ManualPaymentDialog
                defaultDate={todayPrague()}
                invoices={recon.outstandingInvoices}
                locale={locale}
              />
            ) : null}
          </>
        }
        description={t("description")}
        eyebrow={tNav("payments")}
        icon={<ArrowLeftRightIcon />}
        title={t("title")}
      />

      <PaymentsSuggestedTable
        blockerLabels={paymentCatalog.blockers}
        count={visibleCount(recon.matchesSlice.to, recon.matchesTotal)}
        from={recon.matchesSlice.from}
        locale={locale}
        page={recon.matchesSlice.page}
        pageCount={recon.matchesSlice.pageCount}
        proposals={recon.proposals}
        query={query}
        reasonLabels={paymentCatalog.reasons}
        to={recon.matchesSlice.to}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PaymentsIncomingTable
          incomingState={incomingState}
          locale={locale}
          pager={{
            ...recon.incomingSlice,
            count: visibleCount(recon.incomingSlice.to, recon.incomingTotal),
            query,
            pageKey: "incoming",
          }}
          transactions={recon.transactions}
        />
        <PaymentsHistoryTable
          allocations={recon.allocations.map((allocation) => ({
            ...allocation,
            sourceLabel: messageLookup(
              paymentCatalog.sources,
              allocation.source,
            ),
          }))}
          locale={locale}
          pager={{
            ...recon.historySlice,
            count: visibleCount(recon.historySlice.to, recon.historyTotal),
            query,
            pageKey: "history",
          }}
        />
      </div>
      <SectionPager group="payments" />
    </div>
  );
}
