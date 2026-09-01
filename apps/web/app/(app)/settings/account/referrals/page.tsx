import { ReferralsPanel } from "@/components/settings/referrals-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { ensureUserReferralCode, getReferralStats } from "@/lib/auth/referral";
import { requireSession } from "@/lib/auth/session";
import { GiftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { env } from "@invoicey/env/server";

export default async function SettingsReferralsPage() {
  const session = await requireSession();
  const t = await getTranslations("Settings.referrals");
  const origin = (env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );

  let referralUrl: string | null = null;
  let clicks = 0;
  let signups = 0;
  try {
    const code = await ensureUserReferralCode(session.id);
    referralUrl = `${origin}/r/${code}`;
    const stats = await getReferralStats(session.id);
    clicks = stats.clicks;
    signups = stats.signups;
  } catch (err) {
    console.error("[invoicey] referrals page failed", err);
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<GiftIcon />}
        title={t("pageTitle")}
      />
      <ReferralsPanel
        referralUrl={referralUrl}
        clicks={clicks}
        signups={signups}
      />
    </div>
  );
}
