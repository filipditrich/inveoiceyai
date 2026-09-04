"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpIcon,
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  ListIcon,
  SquareIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  wrapMarkdownSelection,
  type MarkdownWrapKind,
} from "./assistant-markdown-wrap";
import { useAssistant, useAssistantSession } from "./assistant-provider";
import { isReloadableAssistantError } from "./assistant-errors";

export function AssistantComposer() {
  const t = useTranslations("Assistant");
  const { open } = useAssistant();
  const session = useAssistantSession();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const status = session?.agent.status ?? "ready";
  const busy = status === "submitted" || status === "streaming";
  /**
   * Cookie-auth and Security Checkpoint failures cannot be retried by sending
   * another message — every turn hits the same rejected request, so the
   * composer would just collect dead-end attempts until the page is reloaded.
   */
  const signedOut = isReloadableAssistantError(
    session?.agent.error?.message ?? "",
  );

  useEffect(() => {
    if (open && !signedOut) inputRef.current?.focus();
  }, [open, signedOut]);

  function submit() {
    const text = value.trim();
    if (!session || !text || busy || signedOut) return;
    setValue("");
    void session.agent.send(text);
  }

  function applyWrap(kind: MarkdownWrapKind) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = wrapMarkdownSelection(value, start, end, kind);
    setValue(next.value);
    queueMicrotask(() => {
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  }

  return (
    <form
      className="border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="rounded-xl border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="flex items-center gap-0.5 px-1.5 pt-1.5">
          <FormatButton
            label={t("composerBold")}
            onClick={() => applyWrap("bold")}
          >
            <BoldIcon />
          </FormatButton>
          <FormatButton
            label={t("composerItalic")}
            onClick={() => applyWrap("italic")}
          >
            <ItalicIcon />
          </FormatButton>
          <FormatButton
            label={t("composerCode")}
            onClick={() => applyWrap("code")}
          >
            <CodeIcon />
          </FormatButton>
          <FormatButton
            label={t("composerList")}
            onClick={() => applyWrap("list")}
          >
            <ListIcon />
          </FormatButton>
          <span className="ml-auto pr-1.5 text-[0.65rem] tracking-wide text-muted-foreground">
            {t("composerMarkdownHint")}
          </span>
        </div>
        <div className="flex items-end gap-2 p-1.5 pt-1">
          <Textarea
            aria-label={t("composerLabel")}
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={signedOut}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "b") {
                event.preventDefault();
                applyWrap("bold");
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "i") {
                event.preventDefault();
                applyWrap("italic");
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "e") {
                event.preventDefault();
                applyWrap("code");
                return;
              }
              /** Enter sends, Shift+Enter breaks the line — chat convention. */
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={t("placeholder")}
            ref={inputRef}
            rows={1}
            value={value}
          />
          {busy ? (
            <Button
              aria-label={t("stop")}
              onClick={() => session?.agent.stop()}
              size="icon"
              type="button"
              variant="outline"
            >
              <SquareIcon />
            </Button>
          ) : (
            <Button
              aria-label={t("send")}
              disabled={!value.trim() || signedOut}
              size="icon"
              type="submit"
            >
              <ArrowUpIcon />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="text-muted-foreground"
            onClick={onClick}
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
