"use client";

import { useState } from "react";
import { toolLabel } from "@/agent/lib/tool-presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  HelpCircleIcon,
  ShieldQuestionIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useAssistantSession } from "./assistant-provider";
import type { EveDynamicToolPart, EveMessageInputRequest } from "eve/react";

/**
 * A parked turn, rendered inline.
 *
 * Both things that park a turn arrive here: an `ask_question` the agent chose
 * to ask instead of guessing, and an Allow/Deny on a tool gated by
 * `approval: always()` (`issue_invoice`, `mark_invoice_paid`,
 * `send_invoice_email`). Slack renders these as a select menu and an approval
 * card; this is the same protocol answered with `respond()`, so a user can move
 * between the two surfaces and meet the same questions.
 *
 * Approvals show the tool input verbatim — the agent is instructed to fill
 * `confirm` with the number, client and total copied off the card — so nobody
 * is ever approving a bare id.
 */
export function AssistantInputRequest({
  part,
  request,
}: {
  part: EveDynamicToolPart;
  request: EveMessageInputRequest;
}) {
  const t = useTranslations("Assistant.hitl");
  const session = useAssistantSession();
  const [freeform, setFreeform] = useState("");

  const answered =
    part.toolMetadata?.eve?.inputResponse ??
    (part.state === "approval-responded" ? part.approval : undefined);
  const busy =
    session?.agent.status === "streaming" ||
    session?.agent.status === "submitted";
  const isApproval = request.kind === "tool-approval";

  async function answer(response: { optionId?: string; text?: string }) {
    if (!session || busy) return;
    await session.agent.respond([
      { requestId: request.requestId, ...response },
    ]);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3",
        isApproval ? "border-amber-500/40 bg-amber-500/5" : "bg-card",
      )}
    >
      <div className="flex gap-2">
        {isApproval ? (
          <ShieldQuestionIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
        ) : (
          <HelpCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          {isApproval ? (
            <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              {t("approvalEyebrow", { tool: toolLabel(part.toolName) })}
            </p>
          ) : null}
          <p className="text-sm">{request.prompt}</p>
          {isApproval ? <ApprovalInput input={part.input} /> : null}
        </div>
      </div>

      {answered ? (
        <p className="text-xs text-muted-foreground">{t("answered")}</p>
      ) : (
        <>
          {request.options && request.options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {request.options.map((option) => (
                <Button
                  disabled={busy}
                  key={option.id}
                  onClick={() => void answer({ optionId: option.id })}
                  size="sm"
                  title={option.description}
                  variant={
                    option.style === "danger"
                      ? "outline"
                      : option.style === "primary"
                        ? "default"
                        : "outline"
                  }
                >
                  {isApproval && option.style === "primary" ? (
                    <CheckIcon />
                  ) : null}
                  {isApproval && option.style === "danger" ? <XIcon /> : null}
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}

          {request.allowFreeform || !request.options?.length ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = freeform.trim();
                if (!text) return;
                setFreeform("");
                void answer({ text });
              }}
            >
              <Input
                disabled={busy}
                onChange={(event) => setFreeform(event.target.value)}
                placeholder={t("freeformPlaceholder")}
                value={freeform}
              />
              <Button
                disabled={busy || !freeform.trim()}
                size="sm"
                type="submit"
              >
                {t("send")}
              </Button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The `confirm` block the tool schemas require, shown as-is. If the agent
 * skipped it, the raw input is shown rather than nothing — an approval with
 * hidden arguments is worse than an ugly one.
 */
function ApprovalInput({ input }: { input: unknown }) {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const confirm = record.confirm;
  const entries = Object.entries(
    confirm && typeof confirm === "object"
      ? (confirm as Record<string, unknown>)
      : record,
  ).filter(([, value]) => value !== null && typeof value !== "object");

  if (entries.length === 0) return null;

  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            {key}
          </dt>
          <dd className="text-sm font-medium">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
