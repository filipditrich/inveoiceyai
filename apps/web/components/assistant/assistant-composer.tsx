"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useAssistant, useAssistantSession } from "./assistant-provider";

export function AssistantComposer() {
  const t = useTranslations("Assistant");
  const { open } = useAssistant();
  const session = useAssistantSession();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const status = session?.agent.status ?? "ready";
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    const text = value.trim();
    if (!session || !text || busy) return;
    setValue("");
    void session.agent.send(text);
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        aria-label={t("composerLabel")}
        className="max-h-40 min-h-10 resize-none py-2"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
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
          disabled={!value.trim()}
          size="icon"
          type="submit"
        >
          <ArrowUpIcon />
        </Button>
      )}
    </form>
  );
}
