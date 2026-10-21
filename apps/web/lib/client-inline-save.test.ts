import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ denied: false, managed: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requireWritableWorkspace: async () => ({ workspaceId: "qa-workspace" }),
}));
vi.mock("@/lib/authz/can", () => ({
  assertCan: async () => {
    if (state.denied) throw new Error("Not allowed to manage clients");
  },
}));
vi.mock("@/lib/entitlements/managed-clients", () => ({
  assertClientsWritable: async () => {
    if (state.managed) throw new Error("Managed client catalog");
  },
  clientsAreManaged: async () => state.managed,
}));
vi.mock("@/lib/cached-ares", () => ({ lookupAresByIcoCached: vi.fn() }));
vi.mock("@invoicey/db/client", () => ({
  db: {
    select: () => {
      throw new Error("Validation must precede database access");
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("Inline validation must not navigate");
  },
}));

import { saveClientInline } from "@/actions/clients";

function clientForm() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id: "11111111-1111-4111-8111-111111111111",
    name: "QA client",
    street: "Test 1",
    city: "Praha",
    zip: "11000",
    country: "CZ",
  }))
    data.set(key, value);
  return data;
}

beforeEach(() => {
  state.denied = false;
  state.managed = false;
});

it("refuses an inline save when the caller cannot manage clients", async () => {
  state.denied = true;
  await expect(saveClientInline(clientForm())).rejects.toThrow(
    "Not allowed to manage clients",
  );
});
it("refuses an inline save into a managed client catalog", async () => {
  state.managed = true;
  await expect(saveClientInline(clientForm())).rejects.toThrow(
    "Managed client catalog",
  );
});
for (const [field, value, code] of [
  ["name", "", "required_fields"],
  ["ico", "broken", "bad_ico"],
  ["dic", "broken", "bad_dic"],
  ["country", "X", "snapshot_validation"],
] as const) {
  it(`returns ${code} without redirecting or accessing the database`, async () => {
    const data = clientForm();
    data.set(field, value);
    await expect(saveClientInline(data)).resolves.toEqual({ ok: false, code });
  });
}
