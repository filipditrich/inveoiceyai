"use client";

import { toolOutputSnippet } from "@/agent/lib/slack-tool-output";
import { toolLabel } from "@/agent/lib/tool-presentation";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";

import type { EveDynamicToolPart } from "eve/react";

/**
 * One thinking step.
 *
 * The Slack channel streams these into a Thinking Steps block; here they are
 * rows in the thread. Both label the tool with `toolLabel` and summarize the
 * result with `toolOutputSnippet`, so a step that reads "Searching ARES… ·
 * NFCtron a.s. · IČO 08453961" reads the same in either place — that snippet is
 * the whole reason the step is worth showing at all.
 */
export function AssistantToolStep({ part }: { part: EveDynamicToolPart }) {
  const label = toolLabel(part.toolName);
  const done =
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied";
  const failed =
    part.state === "output-error" ||
    part.state === "output-denied" ||
    (part.state === "output-available" && isFailure(part.output));

  const snippet =
    part.state === "output-available"
      ? toolOutputSnippet(part.toolName, part.output)
      : part.state === "output-error"
        ? part.errorText
        : part.state === "output-denied"
          ? "Denied"
          : undefined;

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0">
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
