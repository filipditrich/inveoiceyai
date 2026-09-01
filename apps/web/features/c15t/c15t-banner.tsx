"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConsentBanner } from "@c15t/react";
import { CookieIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Compact, first-party consent surface. c15t still owns state, persistence,
 * focus semantics, and actions; Invoicey owns the markup and presentation.
 */
export function C15tBanner() {
  const t = useTranslations("Consent.banner");
  return (
    <ConsentBanner.Root
      noStyle
      scrollLock={false}
      trapFocus={false}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
    >
      <ConsentBanner.Card className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-2xl border bg-popover/95 p-4 text-popover-foreground shadow-2xl shadow-black/10 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-6 sm:p-5 dark:shadow-black/35">
        <ConsentBanner.Header className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-foreground">
            <CookieIcon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <ConsentBanner.Title className="text-sm font-semibold tracking-tight">
              {t("title")}
            </ConsentBanner.Title>
            <ConsentBanner.Description className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("description")}{" "}
              <Link
                href="/cookies"
                className="text-foreground underline decoration-border underline-offset-3 hover:decoration-foreground"
              >
                {t("details")}
              </Link>
            </ConsentBanner.Description>
          </div>
        </ConsentBanner.Header>
        <ConsentBanner.Footer className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <ConsentBanner.CustomizeButton
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "h-10 px-4",
            )}
          >
            {t("customize")}
          </ConsentBanner.CustomizeButton>
          <ConsentBanner.RejectButton
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 px-4",
            )}
          >
            {t("rejectAll")}
          </ConsentBanner.RejectButton>
          <ConsentBanner.AcceptButton
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "h-10 px-4",
            )}
          >
            {t("acceptAnalytics")}
          </ConsentBanner.AcceptButton>
        </ConsentBanner.Footer>
      </ConsentBanner.Card>
    </ConsentBanner.Root>
  );
}
