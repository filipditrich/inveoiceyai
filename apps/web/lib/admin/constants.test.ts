import { describe, expect, it } from "vitest";

import {
  PLATFORM_AUDIT_TYPES,
  coerceDate,
  emptyMonthlySeries,
  utcDaysAgo,
  utcFirstOfMonthMonthsAgo,
} from "./constants";

describe("emptyMonthlySeries", () => {
  it("returns 12 UTC months ending at now's month", () => {
    const series = emptyMonthlySeries(new Date("2026-09-03T12:00:00Z"));
    expect(series).toHaveLength(12);
    expect(series[0]?.month).toBe("2025-10");
    expect(series[11]?.month).toBe("2026-09");
    expect(series.every((p) => p.issued === 0 && p.paid === 0)).toBe(true);
  });
});

describe("utcDaysAgo", () => {
  it("subtracts calendar days in UTC", () => {
    expect(utcDaysAgo(7, new Date("2026-09-03T12:00:00Z")).toISOString()).toBe(
      "2026-08-27T12:00:00.000Z",
    );
  });
});

describe("utcFirstOfMonthMonthsAgo", () => {
  it("aligns with the first point of emptyMonthlySeries for 11 months", () => {
    const now = new Date("2026-09-03T12:00:00Z");
    const start = utcFirstOfMonthMonthsAgo(11, now);
    expect(start.toISOString()).toBe("2025-10-01T00:00:00.000Z");
    expect(emptyMonthlySeries(now)[0]?.month).toBe("2025-10");
  });
});

describe("coerceDate", () => {
  it("keeps a valid Date", () => {
    const value = new Date("2026-09-04T12:00:00.000Z");
    expect(coerceDate(value)?.toISOString()).toBe("2026-09-04T12:00:00.000Z");
  });

  it("parses neon HTTP timestamp aggregates", () => {
    expect(coerceDate("2026-09-04T12:00:00.000Z")?.toISOString()).toBe(
      "2026-09-04T12:00:00.000Z",
    );
  });

  it("returns null for empty values", () => {
    expect(coerceDate(null)).toBeNull();
    expect(coerceDate(undefined)).toBeNull();
    expect(coerceDate("not-a-date")).toBeNull();
  });
});

describe("PLATFORM_AUDIT_TYPES", () => {
  it("includes plan assign and update so the log matches the writes", () => {
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_plan_assign");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_plan_update");
  });

  it("includes the 18c control writes", () => {
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_session_revoke");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_device_revoke");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_api_key_revoke");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_drive_device_revoke");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_workspace_freeze");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_workspace_unfreeze");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_entitlement_override");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_email_suppression_lift");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_community_look_unpublish");
    expect(PLATFORM_AUDIT_TYPES).toContain("platform_bank_disconnect");
  });
});
