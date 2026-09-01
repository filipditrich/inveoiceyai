import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireSession } from "@/lib/auth/session";
import { UserRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, user] = await Promise.all([
    getTranslations("App.settings.scopes.account"),
    requireSession(),
  ]);

  return (
    <>
      <PageHeader
        description={t("subtitle")}
        eyebrow={t("eyebrow")}
        icon={<UserRoundIcon />}
        title={t("title", { name: user.name || user.email })}
      />
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav scope="account" />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
