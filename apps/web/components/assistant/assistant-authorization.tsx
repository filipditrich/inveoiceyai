"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

import type { EveAuthorizationPart } from "eve/react";

/**
 * A connection asking to be authorized mid-turn.
 *
 * No Invoicey tool needs this today — they all run in-process — but a
 * connection added later would park the turn here, and rendering the challenge
 * is what lets Eve resume it. Left in place so that day is not an empty panel.
 */
export function AssistantAuthorization({
  part,
}: {
  part: EveAuthorizationPart;
}) {
  const t = useTranslations("Assistant.authorization");

  if (part.state === "completed") {
    return (
      <p className="text-sm text-muted-foreground">
        {part.outcome === "authorized"
          ? t("connected", { name: part.displayName })
          : t("failed", { name: part.displayName, outcome: part.outcome })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <p className="text-sm">{part.description}</p>
      {part.authorization?.userCode ? (
        <code className="rounded bg-muted px-2 py-1 text-center font-mono text-sm">
          {part.authorization.userCode}
        </code>
      ) : null}
      {part.authorization?.url ? (
        <Button
          render={
            <a href={part.authorization.url} rel="noreferrer" target="_blank">
              {t("signIn", { name: part.displayName })}
            </a>
          }
          size="sm"
        />
      ) : null}
    </div>
  );
}
