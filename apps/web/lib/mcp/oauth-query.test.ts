import { expect, it } from "vitest";

import { oauthQuery } from "./oauth-query";
it("retains repeated signed authorization parameters and encoding through the consent page", () => {
  const query = oauthQuery({
    scope: "invoicey:read invoicey:write",
    signed: ["abc+/=", "second"],
    omitted: undefined,
  });
  expect(query.toString()).toBe(
    "scope=invoicey%3Aread+invoicey%3Awrite&signed=abc%2B%2F%3D&signed=second",
  );
});
