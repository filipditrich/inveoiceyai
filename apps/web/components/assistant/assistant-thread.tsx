"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

import { AssistantAuthorization } from "./assistant-authorization";
import { AssistantEmptyState } from "./assistant-empty-state";
import {
  friendlyAssistantError,
  isReloadableAssistantError,
} from "./assistant-errors";
import { AssistantInputRequest } from "./assistant-input-request";
import { AssistantInvoiceCard } from "./assistant-invoice-card";
import { AssistantMarkdown } from "./assistant-markdown";
import { useAssistantSession } from "./assistant-provider";
import { AssistantToolStep } from "./assistant-tool-step";
import { invoiceCardFromToolPart } from "./invoice-card-from-tool";
import type { EveMessage, EveMessagePart } from "eve/react";

export function AssistantThread() {
  const t = useTranslations("Assistant");
  const session = useAssistantSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = session?.agent.data.messages ?? [];
  const status = session?.agent.status ?? "ready";

  /** Follow the tail while a turn streams, the way a chat is expected to. */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- messages is a new array every render
  }, [messages, status]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <AssistantEmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <AssistantMessage key={message.id} message={message} />
          ))}
          {status === "submitted" ? (
            <p className="animate-pulse text-sm text-muted-foreground">
              {t("thinking")}
            </p>
          ) : null}
          {session?.agent.error ? (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
              role="alert"
            >
              <p className="text-sm text-destructive">
                {friendlyAssistantError(session.agent.error.message, t)}
              </p>
              {isReloadableAssistantError(session.agent.error.message) ? (
                <Button
                  className="shrink-0"
                  onClick={() => window.location.reload()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("reload")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function AssistantMessage({ message }: { message: EveMessage }) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }

  const groups = groupAssistantParts(message.parts);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) =>
        group.kind === "tools" ? (
          <div className="flex flex-col gap-1" key={`tools:${index}`}>
            {group.parts.map((part) => (
              <AssistantToolStep key={part.toolCallId} part={part} />
            ))}
          </div>
        ) : (
          <AssistantPart key={partKey(group.part, index)} part={group.part} />
        ),
      )}
    </div>
  );
}

type AssistantPartGroup =
  | {
      kind: "tools";
      parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[];
    }
  | { kind: "part"; part: EveMessagePart };

/**
 * Consecutive plain tool steps sit in one cluster so they do not take a
 * full message-gap between each other and the reply.
 */
function groupAssistantParts(
  parts: readonly EveMessagePart[],
): AssistantPartGroup[] {
  const groups: AssistantPartGroup[] = [];
  for (const part of parts) {
    if (isPlainToolStep(part)) {
      const last = groups.at(-1);
      if (last?.kind === "tools") {
        last.parts.push(part);
        continue;
      }
      groups.push({ kind: "tools", parts: [part] });
      continue;
    }
    groups.push({ kind: "part", part });
  }
  return groups;
}

function isPlainToolStep(
  part: EveMessagePart,
): part is Extract<EveMessagePart, { type: "dynamic-tool" }> {
  if (part.type !== "dynamic-tool") return false;
  if (part.toolMetadata?.eve?.inputRequest) return false;
  if (invoiceCardFromToolPart(part)) return false;
  return true;
}

function UserMessage({ message }: { message: EveMessage }) {
  const text = message.parts
    .filter(
      (part): part is Extract<EveMessagePart, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) return null;

  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap",
          message.metadata?.status === "failed" && "text-destructive",
        )}
      >
        {text}
      </div>
    </div>
  );
}

function AssistantPart({ part }: { part: EveMessagePart }) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? <AssistantMarkdown text={part.text} /> : null;

    case "reasoning":
      /** Reasoning is noise next to the thinking steps, which say what ran. */
      return null;

    case "authorization":
      return <AssistantAuthorization part={part} />;

    case "dynamic-tool": {
      const request = part.toolMetadata?.eve?.inputRequest;
      if (request) {
        return <AssistantInputRequest part={part} request={request} />;
      }
      /**
       * A tool that produced a card is shown as the card, not as a step: the
       * card is the result, and repeating "Creating invoice draft… ✓" above it
       * says nothing the card does not.
       */
      const card = invoiceCardFromToolPart(part);
      if (card) return <AssistantInvoiceCard card={card} />;
      return <AssistantToolStep part={part} />;
    }

    case "file":
    case "step-start":
      return null;

    default:
      return null;
  }
}

function partKey(part: EveMessagePart, index: number): string {
  if (part.type === "dynamic-tool") return part.toolCallId;
  return `${part.type}:${index}`;
}
