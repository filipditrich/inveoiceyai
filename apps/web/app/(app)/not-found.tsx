import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AppNotFound() {
  const t = await getTranslations("AppNotFound");

  return (
    <div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
      <p className="font-mono text-sm font-semibold text-primary">
        {t("code")}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        {t("description")}
      </p>
      <div className="flex gap-2">
        <Button render={<Link href="/invoices" />} size="sm">
          {t("backToInvoices")}
        </Button>
        <Button render={<Link href="/dashboard" />} size="sm" variant="outline">
          {t("backToDashboard")}
        </Button>
      </div>
    </div>
  );
}
