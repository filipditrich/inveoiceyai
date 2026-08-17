import { saveSupplier } from "@/actions/suppliers";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-4">
      <PageHeader
        icon={<TruckIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <form
        action={saveSupplier}
        className="bg-card grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="supplier-name">{t("name")}</Label>
          <Input id="supplier-name" name="name" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="supplier-ico">{t("ico")}</Label>
          <Input id="supplier-ico" inputMode="numeric" name="ico" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="supplier-dic">{t("dic")}</Label>
          <Input id="supplier-dic" name="dic" />
        </div>
        <Button className="max-sm:h-10" size="lg" type="submit">
          {t("create")}
        </Button>
      </form>
      <ul className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <li className="text-muted-foreground rounded-xl border px-4 py-8 text-center text-sm">
            {t("empty")}
          </li>
        ) : (
          rows.map((row) => (
            <li className="bg-card rounded-xl border p-3" key={row.id}>
              <Link
                className="block font-medium underline-offset-2 hover:underline"
                href={`/suppliers/${row.id}`}
              >
                {row.name}
              </Link>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("ico")}: {row.ico ?? "—"} · {t("trusted")}:{" "}
                {row.isTrusted ? t("yes") : t("no")}
              </p>
            </li>
          ))
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border md:block">
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
