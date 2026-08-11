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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="space-y-1.5">
        <p className="text-brand text-xs font-medium uppercase tracking-[0.14em]">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {t("subtitle")}
        </p>
      </div>
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
