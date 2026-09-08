import { describe, expect, it } from "vitest";

import {
  buildSpaydPayloadFromFacts,
  type SpaydPaymentFacts,
} from "./build-spayd-payload";

const base: SpaydPaymentFacts = {
  iban: "CZ9708000000001920014539",
  bic: "GIBACZPX",
  amount: 500,
  currency: "CZK",
  beneficiaryName: "Filip Ditrich",
};

describe("buildSpaydPayloadFromFacts", () => {
  it("builds a payable payload with no invoice in sight", () => {
    expect(buildSpaydPayloadFromFacts(base)).toBe(
      "SPD*1.0*ACC:CZ9708000000001920014539+GIBACZPX*AM:500*CC:CZK*RN:Filip Ditrich*PT:IP*",
    );
  });

  it("always asks for an instant payment and never schedules one", () => {
    const payload = buildSpaydPayloadFromFacts(base);
    expect(payload).toContain("*PT:IP*");
    expect(payload).not.toContain("*DT:");
  });

  it("refuses a non-CZK payment", () => {
    expect(buildSpaydPayloadFromFacts({ ...base, currency: "EUR" })).toBeNull();
  });

  it("omits the BIC separator when there is no BIC", () => {
    expect(buildSpaydPayloadFromFacts({ ...base, bic: null })).toContain(
      "*ACC:CZ9708000000001920014539*",
    );
    expect(buildSpaydPayloadFromFacts({ ...base, bic: "  " })).toContain(
      "*ACC:CZ9708000000001920014539*",
    );
  });

  it("keeps segments in SPAYD order regardless of input order", () => {
    const payload = buildSpaydPayloadFromFacts({
      ...base,
      specificSymbol: "77",
      constantSymbol: "0308",
      variableSymbol: "9123456789",
    });
    expect(payload).toBe(
      "SPD*1.0*ACC:CZ9708000000001920014539+GIBACZPX*AM:500*CC:CZK*RN:Filip Ditrich*X-VS:9123456789*X-SS:77*X-KS:0308*PT:IP*",
    );
  });

  it("drops diacritics and truncates names and messages for scanners", () => {
    const payload = buildSpaydPayloadFromFacts({
      ...base,
      beneficiaryName: `Prilisne zlutoucky kun ${"x".repeat(40)}`,
      beneficiaryMessage: `Zprava ${"y".repeat(80)}`,
    });
    expect(payload).toContain("*RN:Prilisne zlutoucky kun xxxxxxxxxxxx*");
    expect(payload).toContain(`*MSG:Zprava ${"y".repeat(53)}*`);
  });

  it("escapes an asterisk so it cannot forge a segment boundary", () => {
    expect(
      buildSpaydPayloadFromFacts({ ...base, beneficiaryName: "A*B" }),
    ).toContain("*RN:A%2AB*");
  });

  it("omits optional text when null but keeps an explicit empty string", () => {
    expect(buildSpaydPayloadFromFacts(base)).not.toContain("MSG:");
    expect(
      buildSpaydPayloadFromFacts({ ...base, beneficiaryMessage: "" }),
    ).toContain("*MSG:*");
  });

  it("formats amounts as koruny, trimming a whole-crown decimal", () => {
    expect(buildSpaydPayloadFromFacts({ ...base, amount: 1210 })).toContain(
      "*AM:1210*",
    );
    expect(buildSpaydPayloadFromFacts({ ...base, amount: 1210.5 })).toContain(
      "*AM:1210.50*",
    );
  });
});
