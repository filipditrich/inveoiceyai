import { AssistantOpenButton } from "@/components/assistant/assistant-open-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function DashboardGettingStarted() {
  const t = await getTranslations("Dashboard.gettingStarted");

  return (
    <Card className="max-w-3xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckIcon className="size-4" />
          </span>
          {t("businessReady")}
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button render={<Link href="/invoices/new" prefetch />}>
          {t("create")}
        </Button>
        <AssistantOpenButton variant="outline">
          <SparklesIcon data-icon="inline-start" />
          {t("ai")}
        </AssistantOpenButton>
      </CardContent>
    </Card>
  );
}
