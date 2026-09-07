import { BrandLogo } from "@/components/brand-logo";
import { DriveOauthBounce } from "@/components/drive/drive-oauth-bounce";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appendDriveCallbackParams } from "@/lib/drive/redirect";
import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DriveOauthPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    error?: string;
  }>;
}) {
  const query = await searchParams;
  const t = await getTranslations("DriveOauth");
  const code = query.code?.trim() ?? "";
  const error = query.error?.trim() ?? "";
  const params: Record<string, string> = {};
  if (code.length > 0) {
    params.code = code;
  }
  if (error.length > 0) {
    params.error = error;
  }
  const appHref = appendDriveCallbackParams("invoicey-drive://oauth", params);
  const failed = error.length > 0 || code.length === 0;

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="marketing-grid pointer-events-none absolute inset-0 opacity-[0.28]" />
      <header className="relative flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLogo size={34} priority />
          <span className="font-semibold tracking-tight">Invoicey</span>
        </Link>
        <LocaleSwitcher size="sm" />
      </header>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-6">
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
                <p>{error.length > 0 ? error : t("missingCode")}</p>
              </div>
            </CardContent>
          ) : (
            <CardFooter className="flex-col items-stretch gap-2 pt-5">
              <DriveOauthBounce href={appHref} />
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
