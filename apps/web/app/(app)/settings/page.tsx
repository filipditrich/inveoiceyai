import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
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
  const tLocale = await getTranslations("Common.locale");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeModeSwitcher className="max-w-xs" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{tLocale("label")}</CardTitle>
          <CardDescription>{t("languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocaleSwitcher />
        </CardContent>
      </Card>
    </div>
  );
}
