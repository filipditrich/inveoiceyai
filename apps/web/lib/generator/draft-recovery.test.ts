import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sampleGeneratorDraft } from "./draft";
import {
  GENERATOR_DRAFT_KEY,
  loadGeneratorDraft,
  saveGeneratorDraft,
} from "./draft-recovery";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("generator tab recovery", () => {
  it("restores edited line items, parties, dates and document language after serialization", () => {
    const draft = sampleGeneratorDraft({
      issuerId: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
      clientId: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
      locale: "en",
    });
    draft.client.name = "Recovery client";
    draft.items[0]!.description = "October retainer";
    draft.dueDate = "2026-11-18";
    expect(saveGeneratorDraft(draft)).toBe(true);
    const recovered = loadGeneratorDraft();
    expect(recovered?.client.name).toBe("Recovery client");
    expect(recovered?.items[0]?.description).toBe("October retainer");
    expect(recovered?.dueDate).toBe("2026-11-18");
    expect(recovered?.language).toBe("en");
    expect(recovered).not.toBe(draft);
  });
  it("rejects malformed, future-version and invalid drafts instead of breaking initialization", () => {
    const draft = sampleGeneratorDraft({
      issuerId: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
      clientId: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
      locale: "cs",
    });
    for (const raw of [
      "{broken",
      JSON.stringify({ version: 2, draft }),
      JSON.stringify({ version: 1, draft: { ...draft, currency: "invalid" } }),
    ]) {
      values.set(GENERATOR_DRAFT_KEY, raw);
      expect(loadGeneratorDraft()).toBeNull();
    }
  });
  it("keeps editing available when the browser refuses storage access or writes", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("Full", "QuotaExceededError");
      },
    });
    expect(loadGeneratorDraft()).toBeNull();
    expect(
      saveGeneratorDraft(
        sampleGeneratorDraft({
          issuerId: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
          clientId: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
          locale: "cs",
        }),
      ),
    ).toBe(false);
  });
});
