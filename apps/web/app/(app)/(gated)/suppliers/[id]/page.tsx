import { confirmSupplierBankAccount, saveSupplier } from "@/actions/suppliers";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import {
  incomingInvoices,
  supplierBankAccounts,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq } from "drizzle-orm";
import { TruckIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, { workspaceId, role }] = await Promise.all([
    getTranslations("Suppliers"),
    requireWorkspace(),
  ]);
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.workspaceId, workspaceId)))
    .limit(1);
  if (!supplier) notFound();
  const accounts = await db
    .select()
    .from(supplierBankAccounts)
    .where(eq(supplierBankAccounts.supplierId, supplier.id));
  const invoices = await db
    .select()
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.workspaceId, workspaceId),
        eq(incomingInvoices.supplierId, supplier.id),
      ),
    )
    .orderBy(desc(incomingInvoices.createdAt))
    .limit(50);
  const canConfirm = role === "admin" || role === "owner";

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<TruckIcon />}
        title={supplier.name}
        description={supplier.ico ?? "—"}
      />
      <form
        action={saveSupplier}
        className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={supplier.id} />
        <label className="grid gap-1 text-sm">
          <span>{t("name")}</span>
          <input
            name="name"
            defaultValue={supplier.name}
            className="border-input rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t("ico")}</span>
          <input
            name="ico"
            defaultValue={supplier.ico ?? ""}
            className="border-input rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isTrusted"
            defaultChecked={supplier.isTrusted}
          />
          {t("trusted")}
        </label>
        <Button type="submit">{t("save")}</Button>
      </form>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("accounts")}</h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">IBAN</th>
                <th className="px-3 py-2">{t("account")}</th>
                <th className="px-3 py-2">{t("confirmed")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t">
                  <td className="px-3 py-2">{account.iban ?? "—"}</td>
                  <td className="px-3 py-2">
                    {account.accountNumber
                      ? `${account.accountNumber}/${account.bankCode ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {account.confirmedAt ? (
                      <Badge>{t("yes")}</Badge>
                    ) : canConfirm ? (
                      <form action={confirmSupplierBankAccount}>
                        <input type="hidden" name="id" value={account.id} />
                        <input
                          type="hidden"
                          name="supplierId"
                          value={supplier.id}
                        />
                        <Button size="sm" type="submit">
                          {t("confirm")}
                        </Button>
                      </form>
                    ) : (
                      <Badge variant="outline">{t("no")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("invoices")}</h2>
        <ul className="space-y-1 text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                className="underline-offset-2 hover:underline"
                href={`/incoming-invoices/${invoice.id}`}
              >
                {invoice.number ?? invoice.id.slice(0, 8)} · {invoice.total}{" "}
                {invoice.currency}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
