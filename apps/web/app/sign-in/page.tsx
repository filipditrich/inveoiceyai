import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — Invoicey" };

type Provider = "google" | "github";

/** Only offer providers that are actually configured (see lib/auth/auth.ts). */
function configuredProviders(): Provider[] {
  const configured = Object.keys(
    (auth.options.socialProviders ?? {}) as Record<string, unknown>,
  );
  return (["google", "github"] as const).filter((p) => configured.includes(p));
}

/** Keep the post-sign-in redirect on this origin — never an attacker's URL. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
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
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <BrandLogo size={40} priority className="mb-2" />
          <CardTitle>Sign in to Invoicey</CardTitle>
          <CardDescription>
            Use your Google or GitHub account. No password to remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length > 0 ? (
            <SignInForm next={target} providers={providers} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No sign-in provider is configured. Set the Google or GitHub client
              id and secret, then reload.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
