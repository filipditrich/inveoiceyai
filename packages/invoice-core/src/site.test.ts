import { describe, expect, it } from "vitest";

import { invoiceyIssuedWithUrl } from "./site";

describe("invoiceyIssuedWithUrl", () => {
  it("tags the invoice footer by surface", () => {
    expect(invoiceyIssuedWithUrl("pdf")).toContain("utm_source=invoice");
    expect(invoiceyIssuedWithUrl("pdf")).toContain("utm_medium=pdf");
    expect(invoiceyIssuedWithUrl("dom")).toContain("utm_medium=dom");
    expect(invoiceyIssuedWithUrl("pdf")).toContain("utm_campaign=issued_with");
  });
});
