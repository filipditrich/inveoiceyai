import { randomUUID } from "node:crypto";
import { z } from "zod";

const WorkspaceFileId = z.tuple([
  z.literal("invoicey"),
  z.string().min(1).max(64),
  z.string().uuid(),
]);

/** Provider-persisted identity survives an abandoned form or failed DB write. */
export function createWorkspaceFileId(workspaceId: string): string {
  return WorkspaceFileId.parse([
    "invoicey",
    encodeURIComponent(workspaceId),
    randomUUID(),
  ]).join(":");
}

export function workspaceOwnsFile(
  workspaceId: string,
  customId: string | null,
): boolean {
  const parsed = WorkspaceFileId.safeParse(customId?.split(":"));
  return parsed.success && parsed.data[1] === encodeURIComponent(workspaceId);
}
