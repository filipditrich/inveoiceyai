import {
  getDefaultWorkspaceId,
  isWorkspaceMember,
  tryCreateDbFromEnv,
} from "@invoicey/db";
import {
  runWithInvoiceyContext,
  resolveWorkspaceId,
} from "@invoicey/invoice-tools/workspace-context";
import type { ToolContext } from "eve/tools";

import { isSlackSession } from "./metering-identity";
import { resolveSlackToolPrincipal } from "./slack-identity";

export type SlackToolGateError = {
  ok: false;
  error: "not_linked" | "not_a_member";
  message: string;
};

const NOT_LINKED: SlackToolGateError = {
  ok: false,
  error: "not_linked",
  message:
    "This Slack account is not linked to Invoicey. Tell the user to confirm the DM link before looking up companies or drafting invoices. Do not retry this tool.",
};

const NOT_A_MEMBER: SlackToolGateError = {
  ok: false,
  error: "not_a_member",
  message:
    "This Slack account is no longer a member of the linked Invoicey workspace. Tell the user to re-link from the DM. Do not retry this tool.",
};

function workspaceFromSession(ctx: ToolContext): string {
  const attrs = ctx.session.auth.current?.attributes;
  const fromAuth =
    typeof attrs?.workspaceId === "string" ? attrs.workspaceId.trim() : "";
  if (fromAuth) return fromAuth;
  return resolveWorkspaceId() || getDefaultWorkspaceId();
}

function userIdFromSession(ctx: ToolContext): string | undefined {
  const current = ctx.session.auth.current;
  const attrs = current?.attributes;
  if (typeof attrs?.userId === "string") return attrs.userId;
  if (current?.principalType === "user") return current.principalId;
  return undefined;
}

/** Bind invoice-tools ALS to the Eve session. Slack without a linked identity fails closed. */
export async function withEveToolWorkspace<T>(
  ctx: ToolContext,
  fn: () => Promise<T> | T,
): Promise<T | SlackToolGateError> {
  const current = ctx.session.auth.current;
  const initiator = ctx.session.auth.initiator;
  if (isSlackSession(current) || isSlackSession(initiator)) {
    const principal = await resolveSlackToolPrincipal({ current, initiator });
    switch (principal.status) {
      case "linked":
        break;
      case "not_member":
        return NOT_A_MEMBER;
      case "unlinked":
      case "not_slack":
        return NOT_LINKED;
      default: {
        const _exhaustive: never = principal;
        return NOT_LINKED;
      }
    }
    const database = tryCreateDbFromEnv();
    if (database) {
      const memberOk = await isWorkspaceMember(database, {
        userId: principal.identity.userId,
        workspaceId: principal.identity.workspaceId,
      });
      if (!memberOk) return NOT_A_MEMBER;
    }
    return runWithInvoiceyContext(
      {
        workspaceId: principal.identity.workspaceId,
        userId: principal.identity.userId,
      },
      fn,
    );
  }

  return runWithInvoiceyContext(
    {
      workspaceId: workspaceFromSession(ctx),
      userId: userIdFromSession(ctx),
    },
    fn,
  );
}
