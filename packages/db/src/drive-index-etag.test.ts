import { describe, expect, it } from "vitest";

import {
  driveIndexEtag,
  driveIndexRevisionKey,
  ifNoneMatchHits,
  type DriveIndexRevisionInput,
} from "./drive-index-etag";

const BASE: DriveIndexRevisionInput = {
  pragueDate: "2026-09-28",
  layoutTemplate: "{year}/{kind}_{number}",
  includeIsdoc: false,
  hiddenWorkspaceIds: [],
  workspaces: [{ id: "ws", name: "Acme" }],
  invoiceCount: 2,
  invoiceStamp: "aaa",
  issuerStamp: "bbb",
};

describe("driveIndexEtag", () => {
  it("stays put when the index inputs are unchanged", () => {
    expect(driveIndexEtag(BASE)).toBe(driveIndexEtag({ ...BASE }));
  });

  it("changes when an invoice, the calendar day, or a workspace name changes", () => {
    const original = driveIndexEtag(BASE);
    expect(driveIndexEtag({ ...BASE, invoiceStamp: "ccc" })).not.toBe(original);
    expect(driveIndexEtag({ ...BASE, pragueDate: "2026-09-29" })).not.toBe(
      original,
    );
    expect(
      driveIndexEtag({
        ...BASE,
        workspaces: [{ id: "ws", name: "Acme s.r.o." }],
      }),
    ).not.toBe(original);
  });

  it("ignores workspace order", () => {
    const forward = driveIndexRevisionKey({
      ...BASE,
      workspaces: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    });
    const backward = driveIndexRevisionKey({
      ...BASE,
      workspaces: [
        { id: "b", name: "B" },
        { id: "a", name: "A" },
      ],
    });
    expect(forward).toBe(backward);
  });
});

describe("ifNoneMatchHits", () => {
  const etag = driveIndexEtag(BASE);

  it("matches the tag the server issued", () => {
    expect(ifNoneMatchHits(etag, etag)).toBe(true);
    expect(ifNoneMatchHits(`W/${etag}`, etag)).toBe(true);
    expect(ifNoneMatchHits(`"other", ${etag}`, etag)).toBe(true);
    expect(ifNoneMatchHits("*", etag)).toBe(true);
  });

  it("misses when the client has a different copy", () => {
    expect(ifNoneMatchHits(null, etag)).toBe(false);
    expect(ifNoneMatchHits('"drv1-other"', etag)).toBe(false);
  });
});
