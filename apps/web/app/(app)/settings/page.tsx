import { getTranslations } from "next-intl/server";

import { ThemeModeSwitcher } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsAppearancePage() {
  const t = await getTranslations("App.settings.appearance");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ThemeModeSwitcher className="max-w-xs" />
      </CardContent>
    </Card>
  );
}
