import { describe, expect, it } from "vitest";

import {
  clientAddressIdentity,
  clientMergeGroupKey,
  groupClientsForMerge,
  normalizeClientName,
  normalizeIco,
  pickMergeKeepId,
  type ClientMergeRow,
} from "@invoicey/db";

function row(
  id: string,
  snapshot: Record<string, unknown>,
  createdAt: Date,
): ClientMergeRow {
  return { id, snapshot, createdAt };
}

describe("normalizeIco", () => {
  it("strips non-digits", () => {
    expect(normalizeIco("190 993 39")).toBe("19099339");
    expect(normalizeIco("19099339")).toBe("19099339");
  });

  it("returns undefined for empty / non-string", () => {
    expect(normalizeIco("")).toBeUndefined();
    expect(normalizeIco("   ")).toBeUndefined();
    expect(normalizeIco(null)).toBeUndefined();
  });
});

describe("normalizeClientName", () => {
  it("trims and lowercases", () => {
    expect(normalizeClientName("  NFCtron a.s. ")).toBe("nfctron a.s.");
  });

  it("returns undefined for blank", () => {
    expect(normalizeClientName("  ")).toBeUndefined();
  });
});

describe("clientAddressIdentity", () => {
  it("normalizes legal name and the full address", () => {
    expect(
      clientAddressIdentity({
        name: "  NFCtron   a.s. ",
        address: {
          street: "Masarykova  10",
          city: "Brno",
          zip: "602 00",
          country: "CZ",
        },
      }),
    ).toBe("nfctron a.s.|masarykova 10|brno|60200|cz");
  });
});

describe("groupClientsForMerge / pickMergeKeepId", () => {
  const t0 = new Date("2024-01-01T00:00:00.000Z");
  const t1 = new Date("2024-02-01T00:00:00.000Z");
  const t2 = new Date("2024-03-01T00:00:00.000Z");

  it("groups same IČO together even when formatting differs", () => {
    const groups = groupClientsForMerge([
      row("a", { name: "Pay", ico: "19099339" }, t0),
      row("b", { name: "Pay", ico: "190 99339" }, t1),
      row("c", { name: "Other", ico: "12345678" }, t0),
    ]);
    expect(
      groups
        .get("ico:19099339")
        ?.map((r) => r.id)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(groups.get("ico:12345678")?.map((r) => r.id)).toEqual(["c"]);
  });

  it("groups IČO-less rows by normalized name", () => {
    const groups = groupClientsForMerge([
      row("a", { name: "NFCtron a.s." }, t0),
      row("b", { name: "nfctron a.s." }, t1),
      row("c", { name: "NFCtron a.s.", ico: "19099339" }, t2),
    ]);
    expect(
      groups
        .get("name:nfctron a.s.")
        ?.map((r) => r.id)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(groups.get("ico:19099339")?.map((r) => r.id)).toEqual(["c"]);
  });

  it("keeps oldest created_at as merge survivor", () => {
    const keep = pickMergeKeepId([
      row("newer", { name: "X", ico: "1" }, t2),
      row("older", { name: "X", ico: "1" }, t0),
      row("mid", { name: "X", ico: "1" }, t1),
    ]);
    expect(keep).toBe("older");
  });

  it("bridges an IČO-less draft to the identified client at the same address", () => {
    const address = {
      street: "Masarykova 10",
      city: "Brno",
      zip: "602 00",
      country: "CZ",
    };
    const groups = groupClientsForMerge([
      row("draft", { name: "NFCtron a.s.", address }, t0),
      row("ares", { name: "NFCtron a.s.", ico: "07283539", address }, t1),
    ]);
    expect(groups.get("ico:07283539")?.map((r) => r.id)).toEqual([
      "draft",
      "ares",
    ]);
    expect(pickMergeKeepId(groups.get("ico:07283539") ?? [])).toBe("ares");
  });

  it("does not merge different IČOs that share a name and address", () => {
    const address = {
      street: "Shared 1",
      city: "Praha",
      zip: "110 00",
      country: "CZ",
    };
    const groups = groupClientsForMerge([
      row("one", { name: "Branch", ico: "12345678", address }, t0),
      row("two", { name: "Branch", ico: "87654321", address }, t1),
    ]);
    expect(groups.get("ico:12345678")?.map((r) => r.id)).toEqual(["one"]);
    expect(groups.get("ico:87654321")?.map((r) => r.id)).toEqual(["two"]);
  });

  it("clientMergeGroupKey prefers ico over name", () => {
    expect(
      clientMergeGroupKey(
        row("a", { name: "NFCtron Pay a.s.", ico: "19099339" }, t0),
      ),
    ).toBe("ico:19099339");
  });
});
