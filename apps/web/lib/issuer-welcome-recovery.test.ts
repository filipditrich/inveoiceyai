import { describe, expect, it } from "vitest";

import {
  clearWelcomeRecovery,
  loadWelcomeRecovery,
  saveWelcomeRecovery,
} from "./issuer-welcome-recovery";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: () => null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("issuer welcome recovery", () => {
  const value = {
    icoInput: "12345678",
    name: "Example",
    dic: "",
    street: "Street",
    city: "Prague",
    zip: "11000",
    contactEmail: "office@example.test",
    vatPayer: true,
    accountNumber: "123",
    iban: "CZ00",
    bic: "",
  };
  it("is scoped to the current workspace", () => {
    const session = storage();
    saveWelcomeRecovery(session, "workspace-a", value);
    expect(loadWelcomeRecovery(session, "workspace-a")).toEqual(value);
    expect(loadWelcomeRecovery(session, "workspace-b")).toBeNull();
  });
  it("clears on completion or explicit reset", () => {
    const session = storage();
    saveWelcomeRecovery(session, "workspace-a", value);
    clearWelcomeRecovery(session, "workspace-a");
    expect(loadWelcomeRecovery(session, "workspace-a")).toBeNull();
  });
});
