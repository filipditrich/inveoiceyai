import { describe, expect, it } from "vitest";

import { isBankSyncSkip } from "./bank-sync-outcome";

describe("isBankSyncSkip", () => {
  it("treats local interval guards as skips for both providers", () => {
    expect(isBankSyncSkip("fio_throttled_locally")).toBe(true);
    expect(isBankSyncSkip("moneta_throttled_locally")).toBe(true);
  });

  it("treats provider rate-limit responses as skips", () => {
    expect(isBankSyncSkip("fio_throttled")).toBe(true);
    expect(isBankSyncSkip("moneta_throttled")).toBe(true);
  });

  it("treats a contended lease as a skip", () => {
    expect(isBankSyncSkip("sync_busy")).toBe(true);
  });

  it("keeps real breakage out of the skip set so the alert streak still counts it", () => {
    for (const code of [
      "fio_token_inactive",
      "fio_account_changed",
      "fio_history_locked",
      "fio_too_many_movements",
      "moneta_unauthorized",
      "bank_account_not_found",
      "fio_sync_failed",
    ]) {
      expect(isBankSyncSkip(code)).toBe(false);
    }
  });

  it("does not treat a missing code as a skip", () => {
    expect(isBankSyncSkip(undefined)).toBe(false);
    expect(isBankSyncSkip(null)).toBe(false);
  });
});
