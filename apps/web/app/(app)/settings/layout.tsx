import { getTranslations } from "next-intl/server";

import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/layout/page-header";
import { requireSession } from "@/lib/auth/session";
import { Settings2Icon } from "lucide-react";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const t = await getTranslations("App.settings");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <PageHeader
        description={t("subtitle")}
        eyebrow={t("eyebrow")}
        icon={<Settings2Icon />}
        title={t("title")}
      />
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
