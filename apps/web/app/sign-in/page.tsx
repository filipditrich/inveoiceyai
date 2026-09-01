import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth/auth";
import { safeNext } from "@/lib/auth/safe-next";
import { ArrowRightIcon, ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import type { Metadata } from "next";

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
  /** The visitor was bounced here from a gated page, so promise them the way back. */
  const returnsToRequestedPage = target !== "/dashboard";

  return (
    <AuthShell>
      <div className="rounded-3xl border bg-card p-7 shadow-xs sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>

        {returnsToRequestedPage ? (
          <p className="mt-5 rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {t("continueNote")}
          </p>
        ) : null}

        <div className="mt-7">
          {providers.length > 0 ? (
            <SignInForm next={target} providers={providers} />
          ) : (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">
              {t("noProviders")}
            </div>
          )}
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          {t("secureNote")}
        </p>

        <p className="mt-6 border-t pt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {t("consent")}
        </p>
      </div>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {t("docsPrompt")}
        <Link
          href="/docs"
          className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
        >
          {t("docsCta")}
          <ArrowRightIcon className="size-3" />
        </Link>
      </p>
    </AuthShell>
  );
}
