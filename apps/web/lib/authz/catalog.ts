import type { WorkspaceRole } from "@/lib/auth/workspace-types";

/**
 * The permission catalog (ADR 0038).
 *
 * Flat, stable strings. A rank check (`owner > admin > member`) cannot express
 * "may issue invoices but may not see payments", because that is not a point on
 * a line — which is exactly what Pro and Enterprise workspaces need.
 *
 * Adding a permission means adding it here and to the presets below. Never
 * branch on a role directly in a feature; ask `assertCan` instead.
 */
export const PERMISSIONS = [
  "invoices:read",
  "invoices:create",
  "invoices:issue",
  "invoices:send",
  "invoices:delete",
  "clients:read",
  "clients:manage",
  "issuers:read",
  "issuers:manage",
  "payments:read",
  "payments:manage",
  "bank:manage",
  "recurring:manage",
  "import:run",
  "ai:use",
  "members:manage",
  "workspace:manage",
  "apikeys:manage",
  "billing:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Named roles a workspace picks from. Members do not author permission sets. */
export const ROLE_PRESETS = [
  "owner",
  "admin",
  "accountant",
  "issuer",
  "viewer",
] as const;

export type RolePreset = (typeof ROLE_PRESETS)[number];

const READS: Permission[] = ["invoices:read", "clients:read", "issuers:read"];

/**
 * `owner` holds everything, including `workspace:manage` (rename, delete,
 * transfer). `admin` is deliberately everything *except* that — an admin runs
 * the workspace day to day but cannot dissolve it.
 */
const ADMIN: Permission[] = PERMISSIONS.filter(
  (permission) => permission !== "workspace:manage",
);

export const PRESET_PERMISSIONS: Record<RolePreset, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: ADMIN,
  /** Books and money, but not the shape of the workspace. */
  accountant: [
    ...READS,
    "invoices:issue",
    "invoices:send",
    "payments:read",
    "payments:manage",
    "bank:manage",
    "ai:use",
  ],
  /** Raises and sends invoices; never sees the payments layer. */
  issuer: [
    ...READS,
    "invoices:create",
    "invoices:issue",
    "invoices:send",
    "recurring:manage",
    "ai:use",
  ],
  viewer: READS,
};

/**
 * Better Auth stores `owner | admin | member` on the membership row (ADR 0019).
 * `member` maps to the `issuer` preset: the common case for an extra seat is
 * somebody who raises invoices, not somebody who reads them passively.
 *
 * Custom presets are stored in `members.role` directly once a workspace has
 * `permissions.mode === "roles"` or higher; this map is the fallback for the
 * three roles Better Auth itself writes.
 */
const BUILTIN_ROLE_PRESET: Record<WorkspaceRole, RolePreset> = {
  owner: "owner",
  admin: "admin",
  member: "issuer",
};

export function presetForRole(role: string): RolePreset {
  if ((ROLE_PRESETS as readonly string[]).includes(role)) {
    return role as RolePreset;
  }
  return BUILTIN_ROLE_PRESET[role as WorkspaceRole] ?? "viewer";
}

/** Explicit per-member deviations, layered over the preset (Pro+ only). */
export interface PermissionOverrides {
  grant?: Permission[];
  deny?: Permission[];
}

/**
 * Resolves the effective set. **Deny wins over grant** — an explicit "must not"
 * is a stronger statement than an explicit "may", and a rule that can be
 * silently widened by adding a grant elsewhere is not worth having.
 */
export function resolvePermissions(
  role: string,
  overrides?: PermissionOverrides | null,
): Set<Permission> {
  const effective = new Set<Permission>(
    PRESET_PERMISSIONS[presetForRole(role)],
  );

  for (const permission of overrides?.grant ?? []) {
    effective.add(permission);
  }
  for (const permission of overrides?.deny ?? []) {
    effective.delete(permission);
  }
  return effective;
}

/**
 * The entitlement a permission depends on, when it has one. `assertCan` checks
 * this first: a member of a Free workspace cannot be granted bank access by
 * role, because the workspace does not have the feature at all.
 */
export const PERMISSION_ENTITLEMENT: Partial<
  Record<
    Permission,
    | "features.bankConnections"
    | "features.recurring"
    | "features.historicalImport"
  >
> = {
  "payments:read": "features.bankConnections",
  "payments:manage": "features.bankConnections",
  "bank:manage": "features.bankConnections",
  "recurring:manage": "features.recurring",
  "import:run": "features.historicalImport",
};
