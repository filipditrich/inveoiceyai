import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";
import { findUserByReferralCode } from "@/lib/auth/referral";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const t = await getTranslations("Referral");
  const referrer = await findUserByReferralCode(code);
  const session = await auth.api.getSession({ headers: await headers() });

  if (!referrer) {
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

  const title = referrer.name.trim()
    ? t("title", { name: referrer.name.trim() })
    : t("titleAnonymous");

  return (
    <AuthShell>
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          Invoicey
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>
        <div className="mt-8 space-y-3">
          {session ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("alreadySignedIn")}
              </p>
              <Button className="w-full" render={<Link href="/dashboard" />}>
                {t("openApp")}
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              render={
                <Link
                  href={`/sign-in?next=${encodeURIComponent("/onboarding")}`}
                />
              }
            >
              {t("cta")}
            </Button>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
