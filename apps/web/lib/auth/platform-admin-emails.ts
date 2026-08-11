/** Parse a comma-separated email list into a lowercase set. */
export function parsePlatformAdminEmails(raw: string | undefined): Set<string> {
  const value = raw?.trim() ?? "";
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
