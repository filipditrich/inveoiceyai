import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AppNotFound() {
  const t = await getTranslations("AppNotFound");

  return (
    <div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
      <p className="text-primary font-mono text-sm font-semibold">
        {t("code")}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground max-w-lg text-sm">
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
