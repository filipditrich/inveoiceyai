"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HistoryIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { useAssistantSession } from "./assistant-provider";

export function AssistantHistory() {
  const t = useTranslations("Assistant");
  const format = useFormatter();
  const session = useAssistantSession();
  const threads = session?.threads ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={t("history")} size="icon-sm" variant="ghost" />
        }
      >
        <HistoryIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("history")}</DropdownMenuLabel>
        {threads.length === 0 ? (
          <p className="text-muted-foreground px-1.5 py-2 text-sm">
            {t("historyEmpty")}
          </p>
        ) : (
          threads.map((thread) => (
            <div className="flex items-center gap-0.5" key={thread.id}>
              <DropdownMenuItem
                className="min-w-0 flex-1"
                onClick={() => session?.openThread(thread.id)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {thread.id === session?.activeThreadId
                      ? t("historyCurrent", {
                          title: thread.title || t("untitledConversation"),
                        })
                      : thread.title || t("untitledConversation")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format.relativeTime(new Date(thread.updatedAt))}
                  </span>
                </span>
              </DropdownMenuItem>
              <Button
                aria-label={t("deleteConversation")}
                className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                onClick={() => session?.deleteThread(thread.id)}
                size="icon-xs"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </div>
          ))
        )}
        {threads.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => session?.newConversation()}>
          {t("newConversation")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
