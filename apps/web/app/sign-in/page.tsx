import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth/auth";
import { safeNext } from "@/lib/auth/safe-next";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Přihlášení",
  description: "Přihlaste se do Invoicey přes Google nebo GitHub.",
  robots: { index: false, follow: false },
};

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

  if (session) {
    redirect(target);
  }

  const providers = configuredProviders();

  return (
    <AuthShell>
      <div>
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">
          Vítejte zpět
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
          Přihlášení do Invoicey
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Pokračujte účtem Google nebo GitHub. Invoicey nevytváří ani neukládá
          další heslo.
        </p>

        <div className="mt-8">
          {providers.length > 0 ? (
            <SignInForm next={target} providers={providers} />
          ) : (
            <div className="border-destructive/25 bg-destructive/5 text-destructive rounded-2xl border p-4 text-sm leading-relaxed">
              Není nastavený žádný poskytovatel přihlášení. Doplňte přístupové
              údaje Google nebo GitHub a stránku načtěte znovu.
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
          Pokračováním potvrzujete, že jste se seznámili s podmínkami používání
          a zásadami ochrany soukromí.
        </p>
      </div>
    </AuthShell>
  );
}
