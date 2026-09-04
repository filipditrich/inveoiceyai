import { describe, expect, it } from "vitest";

import {
  friendlyAssistantError,
  isAuthRequiredError,
  isReloadableAssistantError,
  isSecurityCheckpointError,
} from "./assistant-errors";

const CHECKPOINT_HTML = `<!DOCTYPE html><html lang="en" data-astro-cid-4wdtffzm><head></head><body><p>Enable JavaScript to continue</p><p>fra1::1788533419-RnfHutN8hl9i2EBPheODXsbCEgsRJCRG</p></body></html>`;

describe("isAuthRequiredError", () => {
  it("matches Eve's unauthorized JSON error", () => {
    expect(
      isAuthRequiredError("Authorization is required for this route."),
    ).toBe(true);
  });

  it("does not claim other failures", () => {
    expect(isAuthRequiredError("ARES vrátilo HTTP 502.")).toBe(false);
  });
});

describe("isSecurityCheckpointError", () => {
  it("recognises the Vercel Security Checkpoint page", () => {
    expect(isSecurityCheckpointError(CHECKPOINT_HTML)).toBe(true);
  });

  it("does not treat a short tool error as a checkpoint", () => {
    expect(isSecurityCheckpointError("ARES vrátilo HTTP 502.")).toBe(false);
  });
});

describe("friendlyAssistantError", () => {
  const t = (key: "authRequired" | "blocked") =>
    key === "authRequired" ? "sign-in failed" : "blocked";

  it("does not dump checkpoint HTML into the panel", () => {
    expect(friendlyAssistantError(CHECKPOINT_HTML, t)).toBe("blocked");
    expect(friendlyAssistantError(CHECKPOINT_HTML, t)).not.toContain(
      "<!DOCTYPE",
    );
  });

  it("keeps the auth copy for Eve 401s", () => {
    expect(
      friendlyAssistantError("Authorization is required for this route.", t),
    ).toBe("sign-in failed");
  });

  it("passes ordinary messages through", () => {
    expect(friendlyAssistantError("ARES vrátilo HTTP 502.", t)).toBe(
      "ARES vrátilo HTTP 502.",
    );
  });
});

describe("isReloadableAssistantError", () => {
  it("offers reload for auth and checkpoint failures", () => {
    expect(
      isReloadableAssistantError("Authorization is required for this route."),
    ).toBe(true);
    expect(isReloadableAssistantError(CHECKPOINT_HTML)).toBe(true);
    expect(isReloadableAssistantError("ARES vrátilo HTTP 502.")).toBe(false);
  });
});
