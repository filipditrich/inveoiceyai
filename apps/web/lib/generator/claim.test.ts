import { slugifyWorkspaceName } from "@/lib/auth/workspace-slug";
import { describe, expect, it } from "vitest";

describe("claim slug derivation", () => {
  it("uses the email local-part the same way personal workspaces do", () => {
    expect(slugifyWorkspaceName("jan.novak")).toBe("jan-novak");
    expect(slugifyWorkspaceName("České")).toBe("ceske");
  });
});
