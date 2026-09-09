import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { hasEntitlement } from "@/lib/entitlements/entitlements";
import { cn } from "@/lib/utils";
import { FileDownIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { InvoiceRenderForm } from "./invoice-render-form";

export default async function InvoiceRenderPage() {
  const t = await getTranslations("Invoices.render");
  const canRender = await hasEntitlement("features.invoiceRender").catch(
    () => false,
  );

  if (canRender) {
    return <InvoiceRenderForm />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link
            href="/invoices"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-auto shrink-0 py-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {t("backToInvoices")}
          </Link>
        }
        description={t.rich("subtitle", {
          code: (chunks) => (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {chunks}
            </code>
          ),
        })}
        eyebrow={t("eyebrow")}
        icon={<FileDownIcon />}
        title={t("title")}
      />
      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <h2 className="text-base font-medium">{t("lockedTitle")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("lockedBody")}
        </p>
        <Link
          href="/settings/workspace"
          className={cn(buttonVariants(), "mt-4")}
        >
          {t("lockedCta")}
        </Link>
      </div>
    </div>
  );
}
