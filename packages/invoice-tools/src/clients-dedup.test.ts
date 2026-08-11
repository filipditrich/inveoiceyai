import {
  clientMergeGroupKey,
  groupClientsForMerge,
  normalizeClientName,
  normalizeIco,
  pickMergeKeepId,
  type ClientMergeRow,
} from "@invoicey/db";
import { describe, expect, it } from "vitest";

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

  it("clientMergeGroupKey prefers ico over name", () => {
    expect(
      clientMergeGroupKey(
        row("a", { name: "NFCtron Pay a.s.", ico: "19099339" }, t0),
      ),
    ).toBe("ico:19099339");
  });
});
