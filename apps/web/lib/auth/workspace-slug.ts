/** True when Better Auth rejected create/update because the slug is taken. */
export function isOrganizationSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return /already exists|slug already taken/i.test(String(error));
  }

  const record = error as {
    message?: unknown;
    code?: unknown;
    body?: { code?: unknown; message?: unknown };
    cause?: unknown;
  };

  const code = record.code ?? record.body?.code;
  if (
    code === "ORGANIZATION_ALREADY_EXISTS" ||
    code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
  ) {
    return true;
  }

  const message = [record.message, record.body?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  if (/already exists|slug already taken/i.test(message)) {
    return true;
  }

  if (record.cause) {
    return isOrganizationSlugConflict(record.cause);
  }

  return false;
}

/** Email-local / name style slug base; strips diacritics. */
export function slugifyWorkspaceName(source: string): string {
  const slug = source
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug.slice(0, 40) : "workspace";
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
