import { z } from "zod";

import { GeneratorDraftUrlSchema, type GeneratorDraft } from "./draft";

export const GENERATOR_DRAFT_KEY = "invoicey:generator-draft";
const StoredDraftSchema = z.object({
  version: z.literal(1),
  draft: GeneratorDraftUrlSchema,
});

export function loadGeneratorDraft(): GeneratorDraft | null {
  try {
    const raw = globalThis.sessionStorage.getItem(GENERATOR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = StoredDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.draft : null;
  } catch {
    return null;
  }
}

export function saveGeneratorDraft(draft: GeneratorDraft): boolean {
  try {
    globalThis.sessionStorage.setItem(
      GENERATOR_DRAFT_KEY,
      JSON.stringify({ version: 1, draft }),
    );
    return true;
  } catch {
    return false;
  }
}
