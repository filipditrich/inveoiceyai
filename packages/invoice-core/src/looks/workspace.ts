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

/** Slug a display name for a new workspace look. Empty when it cannot be a slug. */
export function lookSlugFromName(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  const candidate = /^[0-9]/u.test(folded)
    ? `n-${folded}`.slice(0, 63)
    : folded;
  return LookSlugSchema.safeParse(candidate).success ? candidate : "";
}

/** Name, layout, and theme — the fields a save actually versions. */
export function lookContentEquals(
  left: LookDocument,
  right: LookDocument,
): boolean {
  return (
    left.name === right.name &&
    JSON.stringify(left.layout) === JSON.stringify(right.layout) &&
    JSON.stringify(left.theme) === JSON.stringify(right.theme)
  );
}
