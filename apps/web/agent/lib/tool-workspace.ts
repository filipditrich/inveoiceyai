import { getDefaultWorkspaceId } from "@invoicey/db";
import {
  runWithInvoiceyContext,
  resolveWorkspaceId,
} from "@invoicey/invoice-tools/workspace-context";
import type { ToolContext } from "eve/tools";

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

/** Bind invoice-tools ALS to the Eve session principal workspace. */
export function withEveToolWorkspace<T>(
  ctx: ToolContext,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return runWithInvoiceyContext(
    {
      workspaceId: workspaceFromSession(ctx),
      userId: userIdFromSession(ctx),
    },
    fn,
  );
}
