import type { LookDocument } from "./schema";
import { isReservedLookId } from "./version";

/** Copy a workspace look into the community catalog at the same id and version. */
export function communityLookFrom(
  source: LookDocument,
):
  | { ok: true; look: LookDocument }
  | { ok: false; error: "not_workspace_look" | "reserved_look_id" } {
  if (source.origin !== "workspace") {
    return { ok: false, error: "not_workspace_look" };
  }
  if (isReservedLookId(source.id)) {
    return { ok: false, error: "reserved_look_id" };
  }
  return {
    ok: true,
    look: {
      ...source,
      origin: "community",
    },
  };
}
