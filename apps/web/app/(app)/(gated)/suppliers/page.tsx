import { saveSupplier } from "@/actions/suppliers";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { suppliers } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import { TruckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SuppliersPage() {
  const [t, { workspaceId }] = await Promise.all([
    getTranslations("Suppliers"),
    requireWorkspace(),
  ]);
  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.workspaceId, workspaceId))
    .orderBy(desc(suppliers.updatedAt));

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<TruckIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <form
        action={saveSupplier}
        className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-4"
      >
        <input
          name="name"
          required
          placeholder={t("name")}
          className="border-input rounded-md border px-2 py-1.5"
        />
        <input
          name="ico"
          placeholder={t("ico")}
          className="border-input rounded-md border px-2 py-1.5"
        />
        <input
          name="dic"
          placeholder={t("dic")}
          className="border-input rounded-md border px-2 py-1.5"
        />
        <Button type="submit">{t("create")}</Button>
      </form>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("name")}</th>
              <th className="px-3 py-2">{t("ico")}</th>
              <th className="px-3 py-2">{t("trusted")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-8 text-center"
                  colSpan={3}
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/suppliers/${row.id}`}
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.ico ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.isTrusted ? t("yes") : t("no")}
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
