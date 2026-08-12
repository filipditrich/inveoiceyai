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
import { linkedSlackWorkspace } from "./slack-identity";

export type SlackToolGateError = {
  ok: false;
  error: "not_linked" | "not_a_member";
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
  if (isSlackSession(current)) {
    const linked = linkedSlackWorkspace(current);
    if (!linked) return { ok: false, error: "not_linked" };
    const database = tryCreateDbFromEnv();
    if (database) {
      const memberOk = await isWorkspaceMember(database, {
        userId: linked.userId,
        workspaceId: linked.workspaceId,
      });
      if (!memberOk) return { ok: false, error: "not_a_member" };
    }
    return runWithInvoiceyContext(linked, fn);
  }

  return runWithInvoiceyContext(
    {
      workspaceId: workspaceFromSession(ctx),
      userId: userIdFromSession(ctx),
    },
    fn,
  );
}
