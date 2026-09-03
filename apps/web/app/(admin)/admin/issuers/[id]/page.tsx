import { AdminCopyId } from "@/components/admin/admin-copy-id";
import {
  AdminEmpty,
  AdminFacts,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { adminGetIssuer } from "@/lib/admin/detail";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import { ArrowLeftIcon, Building2Icon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { AppLocale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminIssuerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [t, tIssuers, format] = await Promise.all([
    getTranslations("Admin.issuerDetail"),
    getTranslations("Admin.issuers"),
    getFormatter(),
  ]);
  /** SAFETY: request config constrains next-intl locale to AppLocale. */
  const locale = (await getLocale()) as AppLocale;

  const detail = await adminGetIssuer(id);
  if (!detail) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        href="/admin/issuers"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>

      <PageHeader
        description={detail.ico ?? detail.workspaceName}
        eyebrow={t("eyebrow")}
        icon={<Building2Icon />}
        title={detail.name}
      />

      <AdminSection title={t("overviewTitle")}>
        <AdminFacts
          items={[
            {
              label: t("facts.workspace"),
              value: (
                <Link
                  className="hover:underline"
                  href={`/admin/workspaces/${detail.workspaceId}`}
                >
                  {detail.workspaceName}
                </Link>
              ),
            },
            {
              label: t("facts.ico"),
              value: detail.ico ?? "—",
            },
            {
              label: t("facts.dic"),
              value: detail.dic ?? "—",
            },
            {
              label: t("facts.source"),
              value:
                detail.source === "ares"
                  ? tIssuers("source.ares")
                  : tIssuers("source.manual"),
            },
            {
              label: t("facts.invoices"),
              value: format.number(detail.invoiceCount),
            },
            {
              label: t("facts.updated"),
              value: format.dateTime(detail.updatedAt, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            },
            {
              label: t("facts.id"),
              value: <AdminCopyId value={detail.id} />,
            },
          ]}
        />
      </AdminSection>

      <AdminSection title={t("invoicesTitle")}>
        {detail.invoices.length === 0 ? (
          <AdminEmpty>{t("invoicesEmpty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.number"),
              t("columns.client"),
              t("columns.total"),
              t("columns.issueDate"),
              t("columns.status"),
            ]}
            rows={detail.invoices.map((invoice) => [
              <Link
                key={invoice.id}
                className="font-medium hover:underline"
                href={`/admin/invoices/${invoice.id}`}
              >
                {invoice.number ?? "—"}
              </Link>,
              invoice.clientName,
              formatMoney(Number(invoice.total) || 0, invoice.currency, locale),
              formatInvoiceDate(invoice.issueDate, locale),
              <InvoiceStatusBadge
                key="status"
                status={invoice.displayStatus}
              />,
            ])}
          />
        )}
      </AdminSection>
    </div>
  );
}
