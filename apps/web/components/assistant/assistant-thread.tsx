"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

import { AssistantAuthorization } from "./assistant-authorization";
import { AssistantEmptyState } from "./assistant-empty-state";
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
                {friendlyError(session.agent.error.message, t)}
              </p>
              {isAuthRequiredError(session.agent.error.message) ? (
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

/** The cookie-auth check in `web-identity.ts` fails with this exact message. */
export function isAuthRequiredError(message: string): boolean {
  return message.toLowerCase().includes("authorization is required");
}

function friendlyError(
  message: string,
  t: (key: "authRequired") => string,
): string {
  if (isAuthRequiredError(message)) {
    return t("authRequired");
  }
  return message;
}
