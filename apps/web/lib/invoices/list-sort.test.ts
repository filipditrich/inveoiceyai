import { describe, expect, it } from "vitest";

import { parseInvoiceSort, serializeInvoiceSort } from "./list-sort";

describe("invoice list sorting", () => {
  it("normalizes supported and legacy sort query values", () => {
    expect(parseInvoiceSort("clientName.asc")).toEqual({
      id: "clientName",
      desc: false,
    });
    expect(parseInvoiceSort("date_desc")).toEqual({
      id: "issueDate",
      desc: true,
    });
    expect(parseInvoiceSort("unsupported.asc")).toEqual({
      id: "issueDate",
      desc: true,
    });
  });

  it("serializes the client-safe sort state", () => {
    expect(serializeInvoiceSort({ id: "dueDate", desc: false })).toBe(
      "dueDate.asc",
    );
  });
});
