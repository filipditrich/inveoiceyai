import { CLASSIC_LOOK_1_0_0 } from "./classic";
import { MINIMAL_LOOK_1_0_0 } from "./minimal";
import {
  CLASSIC_LOOK_ID,
  LookDocumentSchema,
  type LookDocument,
} from "./schema";
import { lookDocumentIsValid } from "./validate";

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

export function canApplyLook(
  apply: "classic" | "catalog",
  lookId: string,
): boolean {
  return lookId === CLASSIC_LOOK_ID || apply === "catalog";
}
