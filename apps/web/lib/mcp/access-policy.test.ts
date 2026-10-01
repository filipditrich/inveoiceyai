import { describe, expect, it } from "vitest";

import { oauthIdentity, toolAccessError } from "./access-policy";
describe("MCP authorization", () => {
  it("does not let write OAuth consent elevate a read-only member", () => {
    expect(
      toolAccessError(
        "issue_invoice",
        ["invoicey:write"],
        new Set(["invoices:read"]),
      ),
    ).toBe("forbidden");
  });
  it("does not let an owner's role bypass read-only consent", () => {
    expect(
      toolAccessError(
        "create_invoice",
        ["invoicey:read"],
        new Set(["invoices:create"]),
      ),
    ).toBe("insufficient_scope");
    expect(
      toolAccessError(
        "create_invoice",
        ["invoicey:write"],
        new Set(["invoices:create"]),
      ),
    ).toBeNull();
  });
  it("rejects tokens without a workspace or user session instead of defaulting to another tenant", () => {
    expect(
      oauthIdentity({ sub: "user", azp: "client", scope: "invoicey:read" }),
    ).toBeNull();
    const result = oauthIdentity({
      sub: "user",
      azp: "client",
      scope: "invoicey:read",
      workspace_id: "approved-workspace",
      sid: "session",
    });
    expect(result?.workspaceId).toBe("approved-workspace");
  });
});
