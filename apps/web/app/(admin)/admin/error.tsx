"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportRuntimeError } from "@/lib/observability";
import { useTranslations } from "next-intl";

/**
 * Catches errors thrown by any admin route (e.g. a bad list query) so a
 * single broken view does not take down the whole admin shell with Next's
 * default error page. Sits alongside `admin/layout.tsx`, so the sidebar and
 * header stay mounted while this replaces just the failed page content.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("AdminError");

  useEffect(() => {
    reportRuntimeError(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        {t("description")}
        {error.digest ? ` (ref ${error.digest})` : null}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()} size="sm" type="button">
          {t("retry")}
        </Button>
        <Button
          render={<a href="/admin" />}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("backToAdmin")}
        </Button>
      </div>
    </div>
  );
}
