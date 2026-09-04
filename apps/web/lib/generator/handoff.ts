import { z } from "zod";

const STORAGE_KEY = "invoicey_generator_handoff";

export type GeneratorHandoff = {
  issuerIco?: string;
};

const StoredHandoffSchema = z.object({
  issuerIco: z.string().optional(),
});

function digitsIco(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 8);
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

/** Persist typed homepage state so the generator can pick it up. */
export function writeGeneratorHandoff(handoff: GeneratorHandoff): void {
  const store = sessionStore();
  if (!store) return;
  const issuerIco = handoff.issuerIco ? digitsIco(handoff.issuerIco) : "";
  const payload: GeneratorHandoff = issuerIco.length === 8 ? { issuerIco } : {};
  store.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Read homepage teaser state. Kept until the next write so Strict Mode remounts still see it. */
export function readGeneratorHandoff(): GeneratorHandoff {
  const store = sessionStore();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = StoredHandoffSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return {};
    const issuerIco = parsed.data.issuerIco
      ? digitsIco(parsed.data.issuerIco)
      : "";
    return issuerIco.length === 8 ? { issuerIco } : {};
  } catch {
    return {};
  }
}

export { STORAGE_KEY as GENERATOR_HANDOFF_KEY };
