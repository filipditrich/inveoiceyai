import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function IssuerQuotaNotice({ limit }: { limit: number }) {
  const t = await getTranslations("Issuers.quota");
  return (
    <div className="rounded-lg border bg-card p-6" role="status">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("description", { limit })}
      </p>
      <Button
        className="mt-4"
        render={<Link href="/settings/workspace/billing" />}
      >
        {t("plans")}
      </Button>
    </div>
  );
}
