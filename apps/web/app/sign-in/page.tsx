import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth/auth";
import { safeNext } from "@/lib/auth/safe-next";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.meta");
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

type Provider = "google" | "github";

/** Only offer providers that are actually configured (see lib/auth/auth.ts). */
function configuredProviders(): Provider[] {
  const configured = Object.keys(
    (auth.options.socialProviders ?? {}) as Record<string, unknown>,
  );
  return (["google", "github"] as const).filter((p) => configured.includes(p));
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const { next } = await searchParams;
  const target = safeNext(next);
  const t = await getTranslations("Auth");

  if (session) {
    redirect(target);
  }

  const providers = configuredProviders();

  return (
    <AuthShell>
      <div>
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {t("subtitle")}
        </p>

        <div className="mt-8">
          {providers.length > 0 ? (
            <SignInForm next={target} providers={providers} />
          ) : (
            <div className="border-destructive/25 bg-destructive/5 text-destructive rounded-2xl border p-4 text-sm leading-relaxed">
              {t("noProviders")}
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
          {t("consent")}
        </p>
      </div>
    </AuthShell>
  );
}
