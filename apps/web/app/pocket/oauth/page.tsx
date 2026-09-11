import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PocketOauthBounce } from "@/components/pocket/pocket-oauth-bounce";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appendPocketCallbackParams } from "@/lib/pocket/redirect";
import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PocketOauthPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const query = await searchParams;
  const t = await getTranslations("PocketOauth");
  const code = query.code?.trim() ?? "";
  const error = query.error?.trim() ?? "";
  const params: Record<string, string> = {};
  if (code) params.code = code;
  if (error) params.error = error;
  const appHref = appendPocketCallbackParams("invoicey-pocket://oauth", params);
  const failed = Boolean(error) || !code;
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl">
          <BrandLogo size={34} priority />
          <span className="font-semibold tracking-tight">Invoicey</span>
        </Link>
        <LocaleSwitcher size="sm" />
      </header>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{failed ? t("errorTitle") : t("title")}</CardTitle>
            <CardDescription>
              {failed ? t("errorDescription") : t("description")}
            </CardDescription>
          </CardHeader>
          {failed ? (
            <CardContent className="pt-5">
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <p>{error || t("missingCode")}</p>
              </div>
            </CardContent>
          ) : (
            <CardFooter className="pt-5">
              <PocketOauthBounce href={appHref} />
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
