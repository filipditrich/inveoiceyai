"use client";

import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

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
    <div className="flex h-full flex-col items-start justify-center gap-4 py-6">
      <div className="flex flex-col gap-1">
        <SparklesIcon className="text-brand size-5" />
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {SUGGESTION_KEYS.map((key) => {
          const prompt = t(`suggestions.${key}`);
          return (
            <Button
              className="h-auto justify-start whitespace-normal py-2 text-left"
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
