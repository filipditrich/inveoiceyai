import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function InvalidReferralPage() {
  const t = await getTranslations("Referral");

  return (
    <AuthShell>
      <div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
          {t("invalidTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("invalidDescription")}
        </p>
        <div className="mt-8">
          <Button className="w-full" render={<Link href="/sign-in" />}>
            {t("signInAnyway")}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
