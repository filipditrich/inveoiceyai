import { LookSlugSchema, type LookDocument } from "./schema";
import { isReservedLookId } from "./version";

/** Copy a look as a workspace document at 1.0.0. */
export function workspaceLookFrom(
  source: LookDocument,
  input: { id: string; name: string },
):
  | { ok: true; look: LookDocument }
  | { ok: false; error: "reserved_look_id" | "invalid_look_id" } {
  const slug = LookSlugSchema.safeParse(input.id);
  if (!slug.success) {
    return { ok: false, error: "invalid_look_id" };
  }
  if (isReservedLookId(slug.data)) {
    return { ok: false, error: "reserved_look_id" };
  }
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "invalid_look_id" };
  }
  return {
    ok: true,
    look: {
      ...source,
      id: slug.data,
      version: "1.0.0",
      origin: "workspace",
      name: name.slice(0, 80),
    },
  };
}

export function versionBumpForLookChange(
  previous: LookDocument,
  next: LookDocument,
): "minor" | "patch" {
  return JSON.stringify(previous.layout) === JSON.stringify(next.layout)
    ? "patch"
    : "minor";
}
