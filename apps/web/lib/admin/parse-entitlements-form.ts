import { EntitlementsSchema, type Entitlements } from "@invoicey/db";

function formString(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw : "";
}

/** `""` and `"unlimited"` both mean no ceiling; anything else must parse. */
function nullableLimit(raw: FormDataEntryValue | null): number | null {
  const value = formString(raw).trim();
  if (value === "" || value.toLowerCase() === "unlimited") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function integer(raw: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(formString(raw).trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const PERMISSION_MODES = ["off", "roles", "advanced"] as const;

function parsePermissionMode(
  raw: FormDataEntryValue | null,
): (typeof PERMISSION_MODES)[number] {
  const value = formString(raw);
  return PERMISSION_MODES.find((mode) => mode === value) ?? "off";
}

/**
 * Presence, not value. An unchecked box submits nothing at all, and Base UI's
 * checkbox submits the field *name* as its value rather than the native `"on"`.
 */
const checked = (form: FormData, name: string) => form.get(name) !== null;

/** `"nfctron.com, example.com"` → `["nfctron.com", "example.com"]`. */
export function parseDomainList(raw: FormDataEntryValue | null): string[] {
  return formString(raw)
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Typed entitlement blob from the shared admin form. Grant rules ride along
 * from `existing` — their keys are idempotency identifiers (ADR 0037).
 */
export function parseEntitlementsForm(
  form: FormData,
  existing: Entitlements,
): Entitlements {
  return EntitlementsSchema.parse({
    ...existing,
    seats: { max: nullableLimit(form.get("seatsMax")) },
    issuers: { max: nullableLimit(form.get("issuersMax")) },
    ai: {
      ...existing.ai,
      monthlyIncludedTokens: integer(form.get("monthlyIncludedTokens")),
      topUpEnabled: checked(form, "topUpEnabled"),
    },
    clients: {
      createMode:
        form.get("clientsCreateMode") === "managed"
          ? ("managed" as const)
          : ("open" as const),
    },
    permissions: {
      mode: parsePermissionMode(form.get("permissionsMode")),
    },
    looks: {
      apply:
        form.get("looksApply") === "catalog"
          ? ("catalog" as const)
          : ("classic" as const),
    },
    features: {
      bankConnections: checked(form, "bankConnections"),
      recurring: checked(form, "recurring"),
      historicalImport: checked(form, "historicalImport"),
      agents: checked(form, "agents"),
    },
    auth: {
      allowedEmailDomains: parseDomainList(form.get("allowedEmailDomains")),
    },
    audit: { retentionDays: nullableLimit(form.get("auditRetentionDays")) },
  });
}
