import "server-only";
import { unstable_cache } from "next/cache";

import { fetchAresEkonomickySubjekt } from "@invoicey/ares";
import { IcoSchema } from "@invoicey/invoice-core/schema";

const cachedEkonomickySubjektByIco = unstable_cache(
  async (ico: string) => fetchAresEkonomickySubjekt(ico),
  ["invoicey-ares-ekonomicky-subjekt"],
  { revalidate: 86400 },
);

/**
 * Validates IČO, then resolves ARES with a 24h process-level cache keyed by ICO.
 */
export async function lookupAresByIcoCached(icoRaw: string) {
  try {
    const ico = IcoSchema.parse((icoRaw ?? "").trim());
    return await cachedEkonomickySubjektByIco(ico);
  } catch {
    return {
      ok: false,
      kind: "invalid_ico",
      message: "IČO must be exactly 8 digits.",
    } as const;
  }
}
