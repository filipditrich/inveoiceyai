import { AdminCopyId } from "@/components/admin/admin-copy-id";
import {
  AdminEmpty,
  AdminFacts,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { adminGetInvoice } from "@/lib/admin/detail";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatInvoiceDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ORIGIN_PROVIDER_LABELS } from "@invoicey/invoice-core/import";

import type { AppLocale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [t, tInvoices, format] = await Promise.all([
    getTranslations("Admin.invoiceDetail"),
    getTranslations("Admin.invoices"),
    getFormatter(),
  ]);
  /** SAFETY: request config constrains next-intl locale to AppLocale. */
  const locale = (await getLocale()) as AppLocale;

  const detail = await adminGetInvoice(id);
  if (!detail) {
    notFound();
  }

  /** SAFETY: unknown providers fall through to originLabel / raw id. */
  const originLabel = detail.originProvider
    ? (ORIGIN_PROVIDER_LABELS[
        detail.originProvider as keyof typeof ORIGIN_PROVIDER_LABELS
      ] ??
      detail.originLabel ??
      detail.originProvider)
    : t("native");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        href="/admin/invoices"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>

      <PageHeader
        description={detail.clientName}
        eyebrow={t("eyebrow")}
        icon={<FileTextIcon />}
        title={detail.number ?? tInvoices("columns.number")}
      />

      <AdminSection title={t("overviewTitle")}>
        <AdminFacts
          items={[
            {
              label: t("facts.number"),
              value: detail.number ?? "—",
            },
            {
              label: t("facts.status"),
              value: <InvoiceStatusBadge status={detail.displayStatus} />,
            },
            {
              label: t("facts.client"),
              value: detail.clientName,
            },
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
              label: t("facts.issuer"),
              value: (
                <Link
                  className="hover:underline"
                  href={`/admin/issuers/${detail.issuerId}`}
                >
                  {detail.issuerName}
                </Link>
              ),
            },
            {
              label: t("facts.total"),
              value: formatMoney(
                Number(detail.total) || 0,
                detail.currency,
                locale,
              ),
            },
            {
              label: t("facts.issueDate"),
              value: formatInvoiceDate(detail.issueDate, locale),
            },
            {
              label: t("facts.dueDate"),
              value: formatInvoiceDate(detail.dueDate, locale),
            },
            {
              label: t("facts.type"),
              value: detail.docType,
            },
            {
              label: tInvoices("columns.id"),
              value: <AdminCopyId value={detail.id} />,
            },
          ]}
        />
      </AdminSection>

      <AdminSection title={t("provenanceTitle")}>
        <AdminFacts
          items={[
            {
              label: t("facts.origin"),
              value: originLabel,
            },
            {
              label: t("facts.version"),
              value: detail.originVersion ?? "—",
            },
            {
              label: t("facts.imported"),
              value: detail.importedAt
                ? format.dateTime(detail.importedAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—",
            },
            {
              label: t("facts.completeness"),
              value: detail.importCompleteness ?? "—",
            },
            {
              label: t("facts.batch"),
              value: detail.importBatch
                ? `${detail.importBatch.originProvider} · +${detail.importBatch.createdCount}`
                : "—",
            },
            {
              label: t("artifactsTitle"),
              value: detail.artifactsImmutable ? t("immutable") : t("mutable"),
            },
          ]}
        />
      </AdminSection>

      <AdminSection title={t("artifactsTitle")}>
        <div className="flex flex-wrap gap-2">
          {detail.pdfUrl ? (
            <a
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              href={detail.pdfUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("openPdf")}
            </a>
          ) : (
            <AdminEmpty>{t("noPdf")}</AdminEmpty>
          )}
          {detail.isdocUrl ? (
            <a
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              href={detail.isdocUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("openIsdoc")}
            </a>
          ) : null}
          {!detail.isdocUrl && detail.pdfUrl ? (
            <p className="self-center text-sm text-muted-foreground">
              {t("noIsdoc")}
            </p>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title={t("emailsTitle")}>
        {detail.emails.length === 0 ? (
          <AdminEmpty>{t("emailsEmpty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.to"),
              t("columns.template"),
              t("columns.status"),
              t("columns.when"),
            ]}
            rows={detail.emails.map((email) => [
              email.toEmail,
              email.template,
              email.status,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(email.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
            ])}
          />
        )}
      </AdminSection>
    </div>
  );
}
