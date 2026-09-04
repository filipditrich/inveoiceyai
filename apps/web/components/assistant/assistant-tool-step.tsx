"use client";

import { toolOutputSnippet } from "@/agent/lib/slack-tool-output";
import { toolDoneLabel, toolLabel } from "@/agent/lib/tool-presentation";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EveDynamicToolPart } from "eve/react";

/**
 * One thinking step in the web thread.
 *
 * Slack dumps `toolOutputSnippet` next to the progressive label — that snippet
 * is the whole Slack row. Here the reply already lists the result, so a
 * successful step is just a past-tense label. Failures still show a snippet
 * because there is no reply to carry the error.
 */
export function AssistantToolStep({ part }: { part: EveDynamicToolPart }) {
  const t = useTranslations("Assistant.hitl");
  const done =
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied";
  const failed =
    part.state === "output-error" ||
    part.state === "output-denied" ||
    (part.state === "output-available" && isFailure(part.output));

  const label =
    done && !failed ? toolDoneLabel(part.toolName) : toolLabel(part.toolName);

  const snippet = failed
    ? part.state === "output-available"
      ? toolOutputSnippet(part.toolName, part.output)
      : part.state === "output-error"
        ? part.errorText
        : t("denied")
    : undefined;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="shrink-0">
        {!done ? (
          <Spinner className="size-3" />
        ) : failed ? (
          <XIcon className="size-3 text-destructive" />
        ) : (
          <CheckIcon className="size-3" />
        )}
      </span>
      <span className="min-w-0">
        <span className={cn(done && "opacity-80")}>{label}</span>
        {snippet ? <span className="opacity-70"> · {snippet}</span> : null}
      </span>
    </div>
  );
}

function isFailure(output: unknown): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as { ok?: unknown }).ok === false
  );
}
