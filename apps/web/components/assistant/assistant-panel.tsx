"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { ASSISTANT_CONTEXT_WARN_RATIO } from "@/lib/assistant-limits";
import { cn } from "@/lib/utils";
import { PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AssistantComposer } from "./assistant-composer";
import { AssistantHistory } from "./assistant-history";
import { useAssistant, useAssistantSession } from "./assistant-provider";
import { AssistantThread } from "./assistant-thread";

/**
 * The assistant drawer.
 *
 * Deliberately not a modal dialog: the point of an in-app assistant is that you
 * can keep reading the invoice you are asking about, and every turn carries the
 * current route as context. So it overlays without a backdrop and never traps
 * focus away from the page.
 */
export function AssistantPanel() {
  const t = useTranslations("Assistant");
  const { open, setOpen } = useAssistant();
  const session = useAssistantSession();

  const outOfTokens = (session?.balance?.totalAvailable ?? 1) <= 0;
  const contextTokens = session?.contextTokens ?? 0;
  const contextLimit = session?.contextLimit ?? 1;
  const contextRatio = Math.min(1, contextTokens / contextLimit);
  const contextFull = contextTokens >= contextLimit && contextTokens > 0;

  return (
    <aside
      aria-hidden={!open}
      aria-label={t("title")}
      className={cn(
        /**
         * `z-50` on purpose. The panel renders after the shell, so at equal
         * z-index it paints over the sticky app header — while portalled popups
         * (selects, tooltips), which mount at the end of `body`, still land on
         * top of the panel. Raising it further would bury its own dropdowns.
         */
        "bg-popover fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-lg transition-transform duration-200 ease-out sm:w-[30rem]",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SparklesIcon className="text-brand size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{t("title")}</p>
          <p className="text-muted-foreground truncate text-xs">
            {session?.balance
              ? t("tokensAvailable", {
                  available: formatTokenCount(session.balance.totalAvailable),
                })
              : t("subtitle")}
            {contextTokens > 0 ? (
              <>
                <span className="mx-1.5 opacity-40" aria-hidden>
                  ·
                </span>
                {t("contextUsage", {
                  used: formatTokenCount(contextTokens),
                  limit: formatTokenCount(contextLimit),
                })}
              </>
            ) : null}
          </p>
          {contextTokens > 0 ? (
            <div
              aria-hidden
              className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  contextRatio >= 1
                    ? "bg-destructive"
                    : contextRatio >= ASSISTANT_CONTEXT_WARN_RATIO
                      ? "bg-amber-500"
                      : "bg-brand",
                )}
                style={{ width: `${Math.max(4, contextRatio * 100)}%` }}
              />
            </div>
          ) : null}
        </div>

        <AssistantHistory />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("newConversation")}
                onClick={() => session?.newConversation()}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <PlusIcon />
          </TooltipTrigger>
          <TooltipContent>{t("newConversation")}</TooltipContent>
        </Tooltip>

        <Button
          aria-label={t("close")}
          onClick={() => setOpen(false)}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </header>

      <AssistantThread />

      {outOfTokens ? (
        <div className="text-muted-foreground border-t px-4 py-3 text-sm">
          {t("outOfTokens")}{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/settings/usage"
          >
            {t("viewUsage")}
          </Link>
        </div>
      ) : contextFull ? (
        <div className="text-muted-foreground border-t px-4 py-3 text-sm">
          {t("contextFull")}
        </div>
      ) : (
        <AssistantComposer />
      )}
    </aside>
  );
}
