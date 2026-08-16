import { IncomingInvoiceTabs } from "@/components/incoming-invoices/incoming-invoice-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { inboxStatusMessageKey } from "@/lib/incoming-invoices/inbox-status-message";
import { loadIncomingQueueCounts } from "@/lib/incoming-invoices/queue-counts";
import { inboxItems, incomingDocuments } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import { MailIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function IncomingInboxPage() {
  const [t, tQueue, { workspaceId }, locale] = await Promise.all([
    getTranslations("IncomingInvoices.inbox"),
    getTranslations("IncomingInvoices"),
    requireWorkspace(),
    getLocale(),
  ]);
  const appLocale = locale as AppLocale;
  const [items, counts] = await Promise.all([
    db
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.workspaceId, workspaceId))
      .orderBy(desc(inboxItems.receivedAt))
      .limit(100),
    loadIncomingQueueCounts(workspaceId),
  ]);
  const documents = await db
    .select()
    .from(incomingDocuments)
    .where(eq(incomingDocuments.workspaceId, workspaceId));
  const byItem = new Map<string, typeof documents>();
  for (const document of documents) {
    if (!document.inboxItemId) continue;
    const list = byItem.get(document.inboxItemId) ?? [];
    list.push(document);
    byItem.set(document.inboxItemId, list);
  }

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<MailIcon />}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button render={<Link href="/incoming-invoices/upload" prefetch />}>
            <UploadIcon />
            {tQueue("upload")}
          </Button>
        }
      />
      <IncomingInvoiceTabs active="inbox" counts={counts} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("received")}</th>
              <th className="px-3 py-2">{t("from")}</th>
              <th className="px-3 py-2">{t("subject")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2">{t("documents")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-8 text-center"
                  colSpan={5}
                >
                  <p>{t("empty")}</p>
                  <p className="mt-1">{t("emptyHint")}</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDateTime(item.receivedAt, appLocale)}
                  </td>
                  <td className="px-3 py-2">
                    {item.parsedOriginalFrom ?? item.fromAddress ?? "—"}
                  </td>
                  <td className="px-3 py-2">{item.subject ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {t(inboxStatusMessageKey(item.status))}
                    </Badge>
                    {item.errorCode ? (
                      <Badge variant="secondary">{item.errorCode}</Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {(byItem.get(item.id) ?? []).map((document) => (
                      <div key={document.id}>
                        <Link
                          className="underline-offset-2 hover:underline"
                          href={`/api/incoming-documents/${document.id}`}
                        >
                          {document.fileName}
                        </Link>
                      </div>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
