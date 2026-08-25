import { describe, expect, it } from "vitest";

import { diffCorrection } from "./correction-diff";

describe("diffCorrection", () => {
  it("returns nothing when the correction changed nothing", () => {
    const snapshot = {
      number: "2026-114",
      total: "12100.00",
      dueDate: "2026-09-01",
    };
    expect(diffCorrection(snapshot, snapshot)).toEqual([]);
  });

  it("reports only the fields that changed", () => {
    const diff = diffCorrection(
      { number: "2026-114", total: "12100.00", dueDate: "2026-09-01" },
      { number: "2026-114", total: "14520.00", dueDate: "2026-09-15" },
    );
    expect(diff.map((entry) => entry.field)).toEqual(["dueDate", "total"]);
    expect(diff[1]).toMatchObject({
      field: "total",
      before: "12100.00",
      after: "14520.00",
      numeric: true,
    });
  });

  it("compares money numerically so formatting is not a change", () => {
    expect(diffCorrection({ total: "1000.00" }, { total: "1000" })).toEqual([]);
    expect(
      diffCorrection({ total: "1000" }, { total: "1000.01" }),
    ).toHaveLength(1);
  });

  it("treats null, undefined, empty and whitespace as the same absence", () => {
    expect(
      diffCorrection(
        { variableSymbol: null, constantSymbol: "" },
        { variableSymbol: undefined, constantSymbol: "   " },
      ),
    ).toEqual([]);
  });

  it("reports a value appearing and disappearing", () => {
    expect(
      diffCorrection({ beneficiaryIban: null }, { beneficiaryIban: "CZ65" }),
    ).toEqual([
      { field: "beneficiaryIban", before: null, after: "CZ65", numeric: false },
    ]);
    expect(
      diffCorrection({ beneficiaryIban: "CZ65" }, { beneficiaryIban: null }),
    ).toEqual([
      { field: "beneficiaryIban", before: "CZ65", after: null, numeric: false },
    ]);
  });

  it("falls back to text comparison for an unparseable numeric field", () => {
    const diff = diffCorrection({ total: "n/a" }, { total: "N/A" });
    expect(diff).toHaveLength(1);
  });

  it("keeps a stable field order regardless of input order", () => {
    const diff = diffCorrection(
      { total: "1", number: "a", dueDate: "2026-01-01" },
      { total: "2", number: "b", dueDate: "2026-02-01" },
    );
    expect(diff.map((entry) => entry.field)).toEqual([
      "number",
      "dueDate",
      "total",
    ]);
  });

  it("counts a line being added", () => {
    expect(diffCorrection({ lineCount: 3 }, { lineCount: 4 })[0]).toMatchObject(
      {
        field: "lineCount",
        before: "3",
        after: "4",
      },
    );
  });
});
