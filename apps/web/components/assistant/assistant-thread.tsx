"use client";

import { cn } from "@/lib/utils";
import type { EveMessage, EveMessagePart } from "eve/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { AssistantAuthorization } from "./assistant-authorization";
import { AssistantEmptyState } from "./assistant-empty-state";
import { AssistantInputRequest } from "./assistant-input-request";
import { AssistantInvoiceCard } from "./assistant-invoice-card";
import { AssistantMarkdown } from "./assistant-markdown";
import { useAssistantSession } from "./assistant-provider";
import { AssistantToolStep } from "./assistant-tool-step";
import { invoiceCardFromToolPart } from "./invoice-card-from-tool";

export function AssistantThread() {
  const t = useTranslations("Assistant");
  const session = useAssistantSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = session?.agent.data.messages ?? [];
  const status = session?.agent.status ?? "ready";

  /** Follow the tail while a turn streams, the way a chat is expected to. */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
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
            <p className="text-muted-foreground animate-pulse text-sm">
              {t("thinking")}
            </p>
          ) : null}
          {session?.agent.error ? (
            <p className="text-destructive text-sm" role="alert">
              {session.agent.error.message}
            </p>
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
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, index) => (
        <AssistantPart key={partKey(part, index)} part={part} />
      ))}
    </div>
  );
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
          "bg-muted max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3 py-2 text-sm",
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
