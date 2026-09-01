import { describe, expect, it } from "vitest";

import { isAllowedDriveRedirect } from "./redirect";

const APP = "http://localhost:3000";

describe("isAllowedDriveRedirect", () => {
  it("allows the local custom scheme and loopback oauth", () => {
    expect(isAllowedDriveRedirect("invoicey-drive://oauth", APP)).toBe(true);
    expect(isAllowedDriveRedirect("http://127.0.0.1:54321/oauth", APP)).toBe(
      true,
    );
    expect(isAllowedDriveRedirect("http://localhost:9/oauth", APP)).toBe(true);
  });

  it("allows the production https callback", () => {
    expect(
      isAllowedDriveRedirect("https://invoicey.ditrich.me/drive/oauth", APP),
    ).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isAllowedDriveRedirect("https://evil.example/oauth", APP)).toBe(
      false,
    );
    expect(isAllowedDriveRedirect("invoicey-drive://steal", APP)).toBe(false);
    expect(isAllowedDriveRedirect("http://127.0.0.1/not-oauth", APP)).toBe(
      false,
    );
  });
});
