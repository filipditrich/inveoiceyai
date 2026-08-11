import { getTranslations } from "next-intl/server";

import { SettingsNav } from "@/components/settings/settings-nav";
import { requireSession } from "@/lib/auth/session";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const t = await getTranslations("App.settings");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
