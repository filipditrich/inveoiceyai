import { z } from "zod";

/** String identity fields stored on issuer/client jsonb snapshots. */
export type SnapshotIdentityKey = "name" | "ico" | "dic";

const SnapshotIdentitySchema = z
  .object({
    name: z.string().optional(),
    ico: z.string().optional(),
    dic: z.string().optional(),
  })
  .passthrough();

/**
 * Read a string identity field off a jsonb snapshot.
 * Incomplete import snapshots still expose name / IČO / DIČ.
 */
export function snapshotString(
  snapshot: unknown,
  key: SnapshotIdentityKey,
): string | null {
  const parsed = SnapshotIdentitySchema.safeParse(snapshot);
  if (!parsed.success) return null;
  const value = parsed.data[key];
  return value && value.length > 0 ? value : null;
}
