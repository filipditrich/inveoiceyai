import { CLASSIC_LOOK_1_0_0 } from "./classic";
import { MINIMAL_LOOK_1_0_0 } from "./minimal";
import {
  CLASSIC_LOOK_ID,
  LookDocumentSchema,
  type LookDocument,
} from "./schema";
import { lookDocumentIsValid } from "./validate";
import { compareLookSemver } from "./version";

const FIRST_PARTY: readonly LookDocument[] = [
  LookDocumentSchema.parse(CLASSIC_LOOK_1_0_0),
  LookDocumentSchema.parse(MINIMAL_LOOK_1_0_0),
];

for (const look of FIRST_PARTY) {
  if (!lookDocumentIsValid(look)) {
    throw new Error(`invalid first-party look ${look.id}@${look.version}`);
  }
}

export const FIRST_PARTY_LOOKS: readonly LookDocument[] = FIRST_PARTY;

export function getFirstPartyLook(
  id: string,
  version: string,
): LookDocument | undefined {
  return FIRST_PARTY.find((look) => look.id === id && look.version === version);
}

export function listFirstPartyLooks(): readonly LookDocument[] {
  return FIRST_PARTY_LOOKS;
}

export function findLookDocument(
  id: string,
  version: string,
  extra: readonly LookDocument[] = [],
): LookDocument | undefined {
  return (
    getFirstPartyLook(id, version) ??
    extra.find((look) => look.id === id && look.version === version)
  );
}

export function latestLooksById(
  looks: readonly LookDocument[],
): LookDocument[] {
  const latest = new Map<string, LookDocument>();
  for (const look of looks) {
    const current = latest.get(look.id);
    if (!current || compareLookSemver(look.version, current.version) > 0) {
      latest.set(look.id, look);
    }
  }
  return [...latest.values()];
}

export function looksForPicker(
  extra: readonly LookDocument[],
  selected?: { id: string; version: string },
): LookDocument[] {
  const firstParty = listFirstPartyLooks();
  const workspaceLatest = latestLooksById(
    extra.filter((look) => look.origin === "workspace"),
  );
  const workspaceIds = new Set(workspaceLatest.map((look) => look.id));
  const communityLatest = latestLooksById(
    extra.filter((look) => look.origin === "community"),
  ).filter((look) => !workspaceIds.has(look.id));
  const listed = [...firstParty, ...workspaceLatest, ...communityLatest];
  if (!selected) return listed;
  const already = listed.some(
    (look) => look.id === selected.id && look.version === selected.version,
  );
  if (already) return listed;
  const pinned = findLookDocument(selected.id, selected.version, extra);
  return pinned ? [...listed, pinned] : listed;
}

export function canApplyLook(
  apply: "classic" | "catalog",
  lookId: string,
): boolean {
  return lookId === CLASSIC_LOOK_ID || apply === "catalog";
}
