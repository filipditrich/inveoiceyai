"use client";

import { ConsentBanner } from "@c15t/react";
import { CookieIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Compact, first-party consent surface. c15t still owns state, persistence,
 * focus semantics, and actions; Invoicey owns the markup and presentation.
 */
export function C15tBanner() {
  return (
    <ConsentBanner.Root
      noStyle
      scrollLock={false}
      trapFocus={false}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
    >
      <ConsentBanner.Card className="bg-popover/95 text-popover-foreground pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-2xl border p-4 shadow-2xl shadow-black/10 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-6 sm:p-5 dark:shadow-black/35">
        <ConsentBanner.Header className="flex min-w-0 flex-1 items-start gap-3">
          <span className="bg-brand/15 text-foreground mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl">
            <CookieIcon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <ConsentBanner.Title className="text-sm font-semibold tracking-tight">
              Vaše soukromí, vaše volba
            </ConsentBanner.Title>
            <ConsentBanner.Description className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Nezbytné cookies drží Invoicey v chodu. Anonymní měření nám můžete
              povolit zvlášť. Žádné reklamní cookies.{" "}
              <Link
                href="/cookies"
                className="text-foreground decoration-border underline-offset-3 hover:decoration-foreground underline"
              >
                Podrobnosti
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
            Nastavení
          </ConsentBanner.CustomizeButton>
          <ConsentBanner.RejectButton
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 px-4",
            )}
          >
            Pouze nezbytné
          </ConsentBanner.RejectButton>
          <ConsentBanner.AcceptButton
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "h-10 px-4",
            )}
          >
            Povolit analytiku
          </ConsentBanner.AcceptButton>
        </ConsentBanner.Footer>
      </ConsentBanner.Card>
    </ConsentBanner.Root>
  );
}
