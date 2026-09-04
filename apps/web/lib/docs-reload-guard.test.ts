import { describe, expect, it } from "vitest";

import { parseDocsLoadStamps, recordDocsLoads } from "./docs-reload-guard";

describe("recordDocsLoads", () => {
  it("does not trip on a handful of loads", () => {
    let timestamps: number[] = [];
    let tripped = false;
    for (let i = 0; i < 5; i += 1) {
      const next = recordDocsLoads(timestamps, i * 200);
      timestamps = next.timestamps;
      tripped = next.tripped;
    }
    expect(tripped).toBe(false);
  });

  it("trips when loads cluster inside the window", () => {
    let timestamps: number[] = [];
    let tripped = false;
    for (let i = 0; i < 10; i += 1) {
      const next = recordDocsLoads(timestamps, i * 50);
      timestamps = next.timestamps;
      tripped = next.tripped;
    }
    expect(tripped).toBe(true);
  });

  it("forgets loads that aged out of the window", () => {
    const first = recordDocsLoads([], 0);
    const later = recordDocsLoads(first.timestamps, 20_000);
    expect(later.timestamps).toEqual([20_000]);
    expect(later.tripped).toBe(false);
  });
});

describe("parseDocsLoadStamps", () => {
  it("returns an empty list for missing or invalid storage", () => {
    expect(parseDocsLoadStamps(null)).toEqual([]);
    expect(parseDocsLoadStamps("nope")).toEqual([]);
    expect(parseDocsLoadStamps('[1, "x"]')).toEqual([1]);
  });
});
