import { InvoiceAiDraftClient } from "@/components/invoices/invoice-ai-draft-client";
import { requireWorkspace } from "@/lib/auth/session";
import { getWorkspaceTokenSummary } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function InvoiceAiPage() {
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("Invoices.ai");
  const summary = await getWorkspaceTokenSummary(db, workspaceId);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">{t("eyebrow")}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/invoices"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("backToInvoices")}
        </Link>
      </div>
      <InvoiceAiDraftClient
        initialBalance={{
          giftedRemaining: summary.giftedRemaining,
          monthlyRemaining: summary.monthlyRemaining,
          monthlyLimit: summary.monthlyLimit,
          purchasedRemaining: summary.purchasedRemaining,
          totalAvailable: summary.totalAvailable,
          daysUntilRenewal: summary.daysUntilRenewal,
        }}
      />
    </div>
  );
}
