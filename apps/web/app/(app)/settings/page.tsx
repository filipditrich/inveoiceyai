import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeModeSwitcher } from "@/components/theme-toggle";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LanguagesIcon, MonitorCogIcon, PaletteIcon } from "lucide-react";

export default async function SettingsAppearancePage() {
  const t = await getTranslations("App.settings.appearance");
  const tLocale = await getTranslations("Common.locale");

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<PaletteIcon />}
        title={t("pageTitle")}
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MonitorCogIcon className="text-muted-foreground size-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ThemeModeSwitcher className="max-w-sm" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LanguagesIcon className="text-muted-foreground size-4" />
            {tLocale("label")}
          </CardTitle>
          <CardDescription>{t("languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <LocaleSwitcher />
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("deviceNote")}
      </p>
    </div>
  );
}
