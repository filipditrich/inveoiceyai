import { InvoiceAiDraftClient } from "@/components/invoices/invoice-ai-draft-client";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { getWorkspaceTokenSummary } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";

export default async function InvoiceAiPage() {
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("Invoices.ai");
  const summary = await getWorkspaceTokenSummary(db, workspaceId);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <PageHeader
        actions={
          <Link
            href="/invoices"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            {t("backToInvoices")}
          </Link>
        }
        description={t("subtitle")}
        eyebrow={t("eyebrow")}
        icon={<SparklesIcon />}
        title={t("title")}
      />
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
