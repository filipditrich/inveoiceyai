import {
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  MINIMAL_LOOK_ID,
  LookSemverSchema,
} from "./schema";

export function parseLookSemver(
  version: string,
): [number, number, number] | undefined {
  const parsed = LookSemverSchema.safeParse(version);
  if (!parsed.success) return undefined;
  const [major, minor, patch] = parsed.data.split(".").map(Number) as [
    number,
    number,
    number,
  ];
  return [major, minor, patch];
}

export function compareLookSemver(left: string, right: string): number {
  const a = parseLookSemver(left);
  const b = parseLookSemver(right);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}

export function bumpLookVersion(
  version: string,
  part: "major" | "minor" | "patch",
): string {
  const parsed = parseLookSemver(version);
  if (!parsed) return CLASSIC_LOOK_VERSION;
  const [major, minor, patch] = parsed;
  if (part === "major") return `${major + 1}.0.0`;
  if (part === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function isReservedLookId(id: string): boolean {
  return id === CLASSIC_LOOK_ID || id === MINIMAL_LOOK_ID;
}
