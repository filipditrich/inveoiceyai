"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportRuntimeError } from "@/lib/observability";
import { useTranslations } from "next-intl";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("AppError");

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
          render={<a href="/dashboard" />}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("backToDashboard")}
        </Button>
      </div>
    </div>
  );
}
