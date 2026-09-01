"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { useAssistantSession } from "./assistant-provider";

/**
 * Openers, not instructions.
 *
 * The old AI-draft page had to teach a prompt format up front because it got
 * one shot at the answer. This one asks when it needs to, so the empty state
 * only has to get the first sentence out of the user.
 */
const SUGGESTION_KEYS = [
  "draftInvoice",
  "unpaidInvoices",
  "lookupCompany",
] as const;

export function AssistantEmptyState() {
  const t = useTranslations("Assistant.empty");
  const session = useAssistantSession();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-6 text-center">
      <Image
        alt={t("mascotAlt")}
        className="size-24 object-contain drop-shadow-sm"
        height={192}
        src="/brand/illustrations/invoicey-mascot.webp"
        width={192}
      />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex w-full flex-col gap-2 text-left">
        {SUGGESTION_KEYS.map((key) => {
          const prompt = t(`suggestions.${key}`);
          return (
            <Button
              className="h-auto justify-start py-2 text-left whitespace-normal"
              disabled={!session || session.agent.status !== "ready"}
              key={key}
              onClick={() => void session?.agent.send(prompt)}
              size="sm"
              variant="outline"
            >
              {prompt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
