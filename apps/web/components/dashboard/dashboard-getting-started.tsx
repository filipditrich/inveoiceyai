import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function DashboardGettingStarted() {
  const t = await getTranslations("Dashboard.gettingStarted");

  return (
    <Card className="max-w-3xl">
      <CardHeader className="space-y-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full">
            <CheckIcon className="size-4" />
          </span>
          {t("businessReady")}
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button render={<Link href="/invoices/new" prefetch />}>
          {t("create")}
        </Button>
        <Button
          render={<Link href="/invoices/ai" prefetch />}
          variant="outline"
        >
          <SparklesIcon data-icon="inline-start" />
          {t("ai")}
        </Button>
      </CardContent>
    </Card>
  );
}
