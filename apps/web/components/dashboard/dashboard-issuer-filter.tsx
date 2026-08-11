import { Button } from "@/components/ui/button";
import type { IssuerOption } from "@/lib/invoice-party-types";
import { getTranslations } from "next-intl/server";

export async function DashboardIssuerFilter({
  issuers,
  selectedId,
}: {
  issuers: IssuerOption[];
  selectedId?: string;
}) {
  const t = await getTranslations("Dashboard.issuerFilter");
  const tCommon = await getTranslations("Common");

  return (
    <form className="flex flex-wrap items-end gap-2 px-4 lg:px-6" method="get">
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">{t("label")}</span>
        <select
          className="border-input bg-background block h-9 min-w-[12rem] rounded-md border px-2 text-sm"
          defaultValue={selectedId ?? ""}
          name="issuerId"
        >
          <option value="">{t("all")}</option>
          {issuers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.snapshot.name}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" type="submit" variant="secondary">
        {tCommon("apply")}
      </Button>
    </form>
  );
}
