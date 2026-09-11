import { describe, expect, it } from "vitest";

import {
  appendPocketCallbackParams,
  isAllowedPocketRedirect,
} from "./redirect";

describe("Pocket pairing callback allowlist", () => {
  it("accepts the native callback and canonical universal link", () => {
    expect(
      isAllowedPocketRedirect(
        "invoicey-pocket://oauth",
        "https://invoicey.app",
      ),
    ).toBe(true);
    expect(
      isAllowedPocketRedirect(
        "https://invoicey.app/pocket/oauth",
        "https://invoicey.app",
      ),
    ).toBe(true);
  });

  it("rejects an attacker origin and callback fragments", () => {
    expect(
      isAllowedPocketRedirect(
        "https://attacker.example/pocket/oauth",
        "https://invoicey.app",
      ),
    ).toBe(false);
    expect(
      isAllowedPocketRedirect(
        "invoicey-pocket://oauth#token=stolen",
        "https://invoicey.app",
      ),
    ).toBe(false);
  });

  it("appends the one-time code without replacing existing query data", () => {
    expect(
      appendPocketCallbackParams("invoicey-pocket://oauth?source=app", {
        code: "once",
      }),
    ).toBe("invoicey-pocket://oauth?source=app&code=once");
  });
});
