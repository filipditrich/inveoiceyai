import { describe, expect, it } from "vitest";

import { createWorkspaceFileId, workspaceOwnsFile } from "./workspace-file-id";

describe("persistent upload ownership", () => {
  it("attributes an unattached upload only to its workspace", () => {
    const id = createWorkspaceFileId("workspace-a");
    expect(workspaceOwnsFile("workspace-a", id)).toBe(true);
    expect(workspaceOwnsFile("workspace-b", id)).toBe(false);
    expect(workspaceOwnsFile("workspace", id)).toBe(false);
  });
  it("does not treat legacy or malformed IDs as owned", () => {
    expect(workspaceOwnsFile("workspace-a", null)).toBe(false);
    expect(workspaceOwnsFile("workspace-a", "invoicey:workspace-a:")).toBe(
      false,
    );
  });
  it("assigns different identifiers to repeated uploads", () => {
    expect(createWorkspaceFileId("workspace-a")).not.toBe(
      createWorkspaceFileId("workspace-a"),
    );
  });
});
