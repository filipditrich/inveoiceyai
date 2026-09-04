import { describe, expect, it } from "vitest";

import {
  dashboardPeriodValues,
  dashboardPeriodWindow,
  parseDashboardPeriod,
  serializeDashboardPeriod,
} from "./dashboard-period";

describe("parseDashboardPeriod", () => {
  it("defaults to the current Prague calendar year when the query is missing", () => {
    expect(parseDashboardPeriod(undefined, "2026-09-04")).toEqual({
      kind: "year",
      year: 2026,
    });
  });

  it("accepts a calendar year, last 12 months, and all time", () => {
    expect(parseDashboardPeriod("2024", "2026-09-04")).toEqual({
      kind: "year",
      year: 2024,
    });
    expect(parseDashboardPeriod("12m", "2026-09-04")).toEqual({
      kind: "rolling12",
    });
    expect(parseDashboardPeriod("all", "2026-09-04")).toEqual({ kind: "all" });
  });

  it("falls back to the current year for junk values", () => {
    expect(parseDashboardPeriod("nope", "2026-03-01")).toEqual({
      kind: "year",
      year: 2026,
    });
    expect(parseDashboardPeriod("1999", "2026-03-01")).toEqual({
      kind: "year",
      year: 2026,
    });
  });
});

describe("serializeDashboardPeriod", () => {
  it("round-trips the query values the filter writes", () => {
    expect(serializeDashboardPeriod({ kind: "year", year: 2026 })).toBe("2026");
    expect(serializeDashboardPeriod({ kind: "rolling12" })).toBe("12m");
    expect(serializeDashboardPeriod({ kind: "all" })).toBe("all");
  });
});

describe("dashboardPeriodWindow", () => {
  it("uses the full calendar year and stops the chart at this month for the current year", () => {
    expect(
      dashboardPeriodWindow({ kind: "year", year: 2026 }, "2026-09-04"),
    ).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
      chartKeys: [
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
      ],
    });
  });

  it("keeps all 12 months for a past year", () => {
    const window = dashboardPeriodWindow(
      { kind: "year", year: 2025 },
      "2026-09-04",
    );
    expect(window.from).toBe("2025-01-01");
    expect(window.to).toBe("2025-12-31");
    expect(window.chartKeys).toHaveLength(12);
    expect(window.chartKeys[0]).toBe("2025-01");
    expect(window.chartKeys[11]).toBe("2025-12");
  });

  it("rolls 12 months ending on the current month", () => {
    expect(dashboardPeriodWindow({ kind: "rolling12" }, "2026-09-04")).toEqual({
      from: "2025-10-01",
      to: "2026-09-04",
      chartKeys: [
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
      ],
    });
  });

  it("leaves all-time queries unbounded and still charts the last 12 months", () => {
    const window = dashboardPeriodWindow({ kind: "all" }, "2026-09-04");
    expect(window.from).toBeUndefined();
    expect(window.to).toBeUndefined();
    expect(window.chartKeys[0]).toBe("2025-10");
    expect(window.chartKeys.at(-1)).toBe("2026-09");
  });
});

describe("dashboardPeriodValues", () => {
  it("lists recent years then the named ranges", () => {
    const values = dashboardPeriodValues("2026-09-04");
    expect(values.slice(0, 3)).toEqual(["2026", "2025", "2024"]);
    expect(values.at(-2)).toBe("12m");
    expect(values.at(-1)).toBe("all");
  });

  it("keeps a selected year that sits outside the usual span", () => {
    expect(dashboardPeriodValues("2026-09-04", 2015)).toContain("2015");
  });
});
