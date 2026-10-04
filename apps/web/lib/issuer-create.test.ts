import { beforeEach, describe, expect, it, vi } from "vitest";

type SavedIssuer = typeof import("@invoicey/db").issuerBusinesses.$inferInsert;
type IssuerTable = typeof import("@invoicey/db").issuerBusinesses;
type NumberingTable = typeof import("@invoicey/db").issuerNumberingSchemes;
type TestTransaction = {
  select: () => {
    from: (table: IssuerTable | NumberingTable) => {
      where: () => { limit: () => Promise<{ id: string }[]> };
    };
  };
  insert: (table: IssuerTable | NumberingTable) => {
    values: (value: SavedIssuer) => Promise<void>;
  };
};
const state = vi.hoisted<{
  limit: number | null;
  existing: { id: string }[];
  saved: SavedIssuer[];
  entitlementError: Error | null;
}>(() => ({
  limit: 1,
  existing: [{ id: "first-company" }],
  saved: [],
  entitlementError: null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@invoicey/invoice-core", () => ({
  extractIsdocFromPdf: vi.fn(),
  parseIssuerFromIsdoc: vi.fn(),
}));
vi.mock("@/actions/clients", () => ({ lookupClientFromAres: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireWritableWorkspace: async () => ({ workspaceId: "workspace" }),
}));
vi.mock("@/lib/authz/can", () => ({ assertCan: async () => {} }));
vi.mock("@/lib/issuer-welcome", () => ({
  dismissIssuerWelcomeForWorkspace: vi.fn(),
}));
vi.mock("@/lib/entitlements/entitlements", () => ({
  loadEntitlements: async () => {
    if (state.entitlementError) throw state.entitlementError;
    return { entitlements: { issuers: { max: state.limit } } };
  },
}));
vi.mock("@invoicey/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => state.existing }) }),
  },
}));
vi.mock("@invoicey/db/transaction", async () => {
  const { issuerBusinesses } = await import("../../../packages/db/src/schema");
  return {
    withDbTransaction: async (run: (tx: TestTransaction) => Promise<void>) =>
      run({
        select: () => ({
          from: (table: IssuerTable | NumberingTable) => ({
            where: () => ({
              limit: async () =>
                table === issuerBusinesses ? state.existing : [],
            }),
          }),
        }),
        insert: (table: IssuerTable | NumberingTable) => ({
          values: async (value: SavedIssuer) => {
            if (table === issuerBusinesses) state.saved.push(value);
          },
        }),
      }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { createIssuer } from "@/actions/issuers";

function secondCompany() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id: "c7ec8293-17af-4710-bbcd-76f13e41ee19",
    name: "Second company",
    ico: "27074358",
    street: "Test 1",
    city: "Praha",
    zip: "11000",
    contactEmail: "company@example.test",
    vatPayer: "false",
    accountNumber: "19-2000145399/0800",
    iban: "CZ6508000000192000145399",
  }))
    data.set(key, value);
  return data;
}

describe("creating a second issuer", () => {
  beforeEach(() => {
    state.limit = 1;
    state.existing = [{ id: "first-company" }];
    state.saved = [];
    state.entitlementError = null;
  });

  it("returns a recoverable quota message instead of crashing the Free-plan form", async () => {
    await expect(createIssuer(secondCompany())).rejects.toThrow(
      "REDIRECT:/issuers/new?invalid=issuer_quota",
    );
    expect(state.saved).toHaveLength(0);
  });

  it.each([2, null])(
    "saves a second company with limit %s without replacing the default",
    async (limit) => {
      state.limit = limit;
      await expect(createIssuer(secondCompany())).rejects.toThrow(
        "REDIRECT:/issuers/c7ec8293-17af-4710-bbcd-76f13e41ee19/edit/identity?toast=issuer_saved",
      );
      expect(state.saved).toEqual([
        expect.objectContaining({
          workspaceId: "workspace",
          isDefault: false,
          snapshot: expect.objectContaining({
            name: "Second company",
            ico: "27074358",
          }),
        }),
      ]);
    },
  );

  it("does not disguise an entitlement lookup failure as a plan limit", async () => {
    state.entitlementError = new Error("database unavailable");
    await expect(createIssuer(secondCompany())).rejects.toThrow(
      "database unavailable",
    );
    expect(state.saved).toHaveLength(0);
  });
});
