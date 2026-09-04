import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GENERATOR_HANDOFF_KEY,
  readGeneratorHandoff,
  writeGeneratorHandoff,
} from "./handoff";

const memory = new Map<string, string>();
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
};

describe("generator handoff", () => {
  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: store,
    });
  });

  afterEach(() => {
    memory.clear();
  });

  it("stores an 8-digit IČO for the generator to read", () => {
    writeGeneratorHandoff({ issuerIco: "2708 2440" });
    expect(readGeneratorHandoff()).toEqual({ issuerIco: "27082440" });
    expect(readGeneratorHandoff()).toEqual({ issuerIco: "27082440" });
    expect(store.getItem(GENERATOR_HANDOFF_KEY)).toContain("27082440");
  });

  it("ignores a short or empty IČO", () => {
    writeGeneratorHandoff({ issuerIco: "123" });
    expect(JSON.parse(store.getItem(GENERATOR_HANDOFF_KEY) ?? "{}")).toEqual(
      {},
    );
    writeGeneratorHandoff({});
    expect(readGeneratorHandoff()).toEqual({});
  });
});
